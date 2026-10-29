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

test('regiao parcialmente ilegivel vira rascunho editavel em vez de desaparecer', () => {
  const item = context.window.imagemCompraCriarRascunhoNotificacao(
    'BRADESCO CARTOES Compra aprovada em CHAVEIRO CARLIN no Cartao final 1018',
    '24,00',
    3,
    '2026-10-29'
  );
  assert.equal(item.valor, 24);
  assert.equal(item.valorTotalCompra, 24);
  assert.equal(item._ocrRegiao, 4);
  assert.equal(item._ocrRevisaoObrigatoria, true);
  assert.equal(item.selecionado, true);
  assert.match(item.descricao, /CHAVEIRO CARLIN/i);
});

test('regiao totalmente ilegivel permanece na conferencia para correcao manual', () => {
  const item = context.window.imagemCompraCriarRascunhoNotificacao('', '', 4, '2026-10-29');
  assert.equal(item.valor, 0);
  assert.equal(item._ocrRegiao, 5);
  assert.equal(item._ocrRevisaoObrigatoria, true);
  assert.equal(item.selecionado, false);
  assert.match(item.descricao, /preencher observacao/i);
});

test('rascunho nao transforma cabecalho corrompido em nome de fornecedor', () => {
  const item = context.window.imagemCompraCriarRascunhoNotificacao(
    '| — BRAD 8 SARTOES Y', '24,00', 3, '2026-10-29'
  );
  assert.equal(item.descricao, 'Compra 4 - preencher observacao');
  assert.equal(item.valor, 24);
  assert.doesNotMatch(item.descricao, /BRAD|SARTOES/i);
});

test('notificacao Nubank identifica valor observacao e fornecedor sem incluir o rodape', () => {
  const texto = `Compra no crédito aprovada Ontem, 18:58
Compra de R$ 53,90 APROVADA em Google
YouTubePremium para o cartão com final 1842.`;
  const item = context.window.imagemCompraInterpretarCartaoV2([texto], 0, null, '2026-10-29');
  assert.ok(item);
  assert.equal(item.valor, 53.90);
  assert.equal(item.descricao, 'Google YouTubePremium');
  assert.equal(item._obsManual, 'Google YouTubePremium');
  assert.equal(item._bancoImagem, 'Nubank');
});

test('parser geral tambem aceita rodape Nubank para imagens com um unico cartao', () => {
  const texto = `Compra no crédito aprovada Ontem, 18:58
Compra de R$ 53,90 APROVADA em Google YouTubePremium para o cartão com final 1842.`;
  const itens = context.window.imagemCompraExtrairItens(texto);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].valor, 53.90);
  assert.equal(itens[0].descricao, 'Google YouTubePremium');
  assert.equal(itens[0]._bancoImagem, 'Nubank');
});

test('cartoes fisicos independentes nao passam novamente pela deduplicacao global', () => {
  assert.match(source, /criarFaixasNotificacaoV2/);
  assert.match(source, /itemCartao = imagemCompraInterpretarCartaoV2/);
  assert.match(source, /concluirImportacao\(itensV2/);
  assert.match(source, /itensReconhecidos\.every\(item => item\?\._ocrRegiao\)/);
});

test('pipeline V2 nunca conclui notificacao com valor ou observacao vazios', () => {
  assert.match(source, /if \(!\(valor > 0\) \|\| !descricao\) return null/);
  assert.match(source, /A importacao foi interrompida para nao criar dados em branco ou inventados/);
  assert.match(source, /frequenciaValores/);
  assert.match(source, /frequenciaDescricoes/);
  assert.doesNotMatch(source, /Lendo cada notificacao separadamente/);
  assert.match(source, /const genericos = telaNotificacoes \? \[\] : imagemCompraExtrairGenerico/);
});
