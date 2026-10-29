import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/32-image-ocr-importer.js', import.meta.url), 'utf8');
const parseBRL = value => {
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  return Number(cleaned);
};
const context = { window: { parseBRLCurrency: parseBRL }, console, Date, Number, String, RegExp, Set, Map, Math };
vm.createContext(context);
vm.runInContext(source, context);

test('notificações aceitam somente compras com marcador monetário e descartam 566,72 inventado', () => {
  const texto = `
BRADESCO CARTÕES
Compra de R$ 56,74 APROVADA em SUPERMERCADOS K, no Cartão final 1018.
Compra de R$ 124,42 APROVADA em SUPERMERCADOS K, no Cartão final 1018.
Compra de R$ 1.072,24 APROVADA em AURORA ALIME*AU, no Cartão final 6546.
Compra de R$ 24,00 APROVADA em CHAVEIRO CARLIN, no Cartão final 1018.
Compra de R$ 130,00 APROVADA em J D S COMERCIO, no Cartão final 1018.
WPROJERA 566,72`;
  const itens = context.window.imagemCompraExtrairItens(texto);
  assert.deepEqual(Array.from(itens, item => item.valor), [56.74, 124.42, 1072.24, 24, 130]);
  assert.equal(itens.reduce((s, item) => s + item.valor, 0), 1407.4);
  assert.ok(!itens.some(item => item.valor === 566.72));
});

test('não transforma texto corrompido com R$ em compra sem a estrutura completa', () => {
  const texto = `BRADESCO CARTÕES
R$ 56,74 APRO E MA os K no Cartão final 1018
Compra de R$ 124,42 APROVADA em SUPERMERCADOS K, no Cartão final 1018.
WPROJERA 566,72`;
  const itens = context.window.imagemCompraExtrairItens(texto);
  assert.deepEqual(Array.from(itens, item => item.valor), [56.74, 124.42]);
  assert.deepEqual(Array.from(itens, item => item.descricao), ['APRO E MA os K', 'SUPERMERCADOS K']);
  assert.ok(!itens.some(item => item.valor === 566.72));
});

test('aceita pequenas falhas do OCR em APROVADA sem liberar números soltos', () => {
  const texto = `BRADESCO CARTÕES
Compra de R$ 56,74 APROVRIDA em SUPERMERCADOS K, no Cartão final 1018.
Compra de R$ 24,00 APROVAD4 em CHAVEIRO CARLIN, no Cartão final 1018.
R$ 130,00 APROV RDA ! em J D S COMERCIO, no Cartão finaI 1018.
Compra de R$ 566,72 WPROJERA`;
  const itens = context.window.imagemCompraExtrairItens(texto);
  assert.deepEqual(Array.from(itens, item => item.valor), [56.74, 24, 130]);
  assert.deepEqual(Array.from(itens, item => item.descricao), ['SUPERMERCADOS K', 'CHAVEIRO CARLIN', 'J D S COMERCIO']);
  assert.ok(!itens.some(item => item.valor === 566.72));
});

test('recupera valores quando APROVADA fica fragmentada mas o cartão final permanece', () => {
  const texto = `BRADESCO CARTÕES
Compra de R$ 56,74 APRO E MA os K, no Cartão final 1018.
Compra de R$ 124,42 APROVRIDA em SUPERMERCADOS K, no Cartão final 1018.
Compra de R$ 1.072,24 APROVADA em AURORA ALIME*AU, no Cartão final 6546.
Compra de R$ 24,00 APROVADA em CHAVEIRO CARLIN, no Cartão final 1018.
Compra de R$ 130,00 APROVADA em J D S COMERCIO, no Cartão final 1018.
WPROJERA 566,72`;
  const itens = context.window.imagemCompraExtrairItens(texto);
  assert.deepEqual(Array.from(itens, item => item.valor), [56.74, 124.42, 1072.24, 24, 130]);
  assert.ok(itens.every(item => item.quantidadeParcelas === 1));
  assert.ok(!itens.some(item => item.valor === 566.72));
});

test('nomes dos estabelecimentos são preservados como aparecem na notificação', () => {
  const texto = `BRADESCO CARTÕES
Compra de R$ 56,74 APROVADA em SUPERMERCADOS K, no Cartão final 1018.
Compra de R$ 1.072,24 APROVADA em AURORA ALIME*AU, no Cartão final 6546.
Compra de R$ 24,00 APROVADA em CHAVEIRO CARLIN, no Cartão final 1018.
Compra de R$ 130,00 APROVADA em J D S COMERCIO, no Cartão final 1018.`;
  const descricoes = Array.from(context.window.imagemCompraExtrairItens(texto), item => item.descricao);
  assert.deepEqual(descricoes, ['SUPERMERCADOS K', 'AURORA ALIME*AU', 'CHAVEIRO CARLIN', 'J D S COMERCIO']);
});

test('compra parcelada mantem total, quantidade e valor de cada parcela', () => {
  const texto = `BRADESCO CARTÕES
Compra no valor de R$ 3.000,00 em 10x LOJA TESTE hoje`;
  const [item] = context.window.imagemCompraExtrairItens(texto);
  assert.ok(item);
  assert.equal(item.descricao, 'LOJA TESTE');
  assert.equal(item.valorTotalCompra, 3000);
  assert.equal(item.quantidadeParcelas, 10);
  assert.equal(item._parcelasManuais, 10);
  assert.equal(item.valorParcela, 300);
  assert.equal(item._modoValorParcelas, 'total');
});

test('cartao isolado preserva compras curtas quando o OCR perde o simbolo R$', () => {
  const primeira = context.window.imagemCompraExtrairNotificacaoIsolada(
    'BRADESCO CARTOES Compra de 56,74 APROVADA em SUPERMERCADOS K, no Cartao final 1018.'
  );
  const quarta = context.window.imagemCompraExtrairNotificacaoIsolada(
    'BRADESCO CARTOES Compra de 24,00 APROVADA em CHAVEIRO CARLIN, no Cartao final 1018.'
  );
  assert.deepEqual(Array.from([...primeira, ...quarta], item => item.valor), [56.74, 24]);
  assert.deepEqual(Array.from([...primeira, ...quarta], item => item.descricao), ['SUPERMERCADOS K', 'CHAVEIRO CARLIN']);
});

test('telas de notificação sempre relêem as faixas e usam somente o parser estruturado', () => {
  assert.match(source, /faixasNotificacao/);
  assert.match(source, /Lendo cada notificacao separadamente/);
  assert.match(source, /if \(!telaNotificacoesCartao\)/);
  assert.match(source, /telaNotificacoesCartao && itensReconhecidos\.length < 5/);
  assert.match(source, /telaNotificacoesCartao \? imagens\.principal : imagens\.alternativas\[0\]/);
  assert.match(source, /if \(imagens\.faixasNotificacao\?\.length\)/);
  assert.match(source, /for \(let indiceFaixa = 0; indiceFaixa < imagens\.faixasNotificacao\.length/);
  assert.doesNotMatch(source, /Promise\.all\(\s*imagens\.faixasNotificacao\.map/);
  assert.match(source, /itensReconhecidos = imagemCompraDeduplicar/);
  assert.match(source, /imagemCompraExtrairNotificacoesCartao\(item\.textoCartao/);
  assert.match(source, /const genericos = telaNotificacoes \? \[\] : imagemCompraExtrairGenerico/);
});
