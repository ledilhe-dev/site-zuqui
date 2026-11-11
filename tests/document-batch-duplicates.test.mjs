import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');

test('Leitura de documento procura duplicidade por valor, janela de data e evidência do estabelecimento', () => {
  assert.match(js, /toleranciaDias: 3, compararDescricao: true/);
  assert.match(js, /descricao_documento: item\.descricao/);
  assert.match(js, /observacao_documento: item\._obsManual/);
  assert.match(js, /estabelecimentoEmComum/);
});

test('possíveis duplicidades ficam na revisão em vermelho e desmarcadas', () => {
  assert.match(js, /item\._duplicidadeDetectadaNoDocumento = true/);
  assert.match(js, /item\.selecionado = false/);
  assert.match(js, /card\.style\.border = '2px solid var\(--red\)'/);
  assert.match(js, /Conta possivelmente já lançada/);
  assert.doesNotMatch(js, /title: 'Conta possivelmente ja cadastrada'/);
});

test('seleção geral ignora suspeitas e marcação individual autoriza conscientemente', () => {
  assert.match(js, /checked && !i\._duplicidadeDetectadaNoDocumento/);
  assert.match(js, /function faturaAlternarSelecaoItem/);
  assert.match(js, /item\._duplicidadeAutorizada = marcado === true/);
});

test('valor editado no iPhone e sincronizado antes da validacao', () => {
  assert.match(js, /function faturaSincronizarValorDigitado/);
  assert.match(js, /oninput="faturaMascararValorImportado\(this\); faturaSincronizarValorDigitado/);
  assert.match(js, /document\.querySelectorAll\('\[data-fatura-valor-item\]'\)/);
  assert.match(js, /item\.valorTotalCompra = novoValor/);
});

test('rascunho de documento incompleto nao aprende categoria de texto corrompido', () => {
  assert.match(js, /!item\.categoria_id && !item\._revisaoDocumentoObrigatoria/);
  assert.match(js, /item\._revisaoDocumentoObrigatoria \? null : faturaSugerirPorHistorico/);
});
