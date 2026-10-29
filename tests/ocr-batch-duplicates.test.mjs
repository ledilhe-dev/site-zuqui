import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');

test('OCR procura duplicidade por valor, janela de data e evidência do estabelecimento', () => {
  assert.match(js, /toleranciaDias: 3, compararDescricao: true/);
  assert.match(js, /descricao_ocr: item\.descricao/);
  assert.match(js, /observacao_ocr: item\._obsManual/);
  assert.match(js, /estabelecimentoEmComum/);
});

test('possíveis duplicidades ficam na revisão em vermelho e desmarcadas', () => {
  assert.match(js, /item\._duplicidadeDetectadaNoOCR = true/);
  assert.match(js, /item\.selecionado = false/);
  assert.match(js, /card\.style\.border = '2px solid var\(--red\)'/);
  assert.match(js, /Conta possivelmente já lançada/);
  assert.doesNotMatch(js, /title: 'Conta possivelmente ja cadastrada'/);
});

test('seleção geral ignora suspeitas e marcação individual autoriza conscientemente', () => {
  assert.match(js, /checked && !i\._duplicidadeDetectadaNoOCR/);
  assert.match(js, /function faturaAlternarSelecaoItem/);
  assert.match(js, /item\._duplicidadeAutorizada = marcado === true/);
});
