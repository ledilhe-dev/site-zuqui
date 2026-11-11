import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const finance = readFileSync(new URL('../assets/js/30-finance.js', import.meta.url), 'utf8');
const importer = readFileSync(new URL('../assets/js/32-image-document-importer.js', import.meta.url), 'utf8');

test('OpenAI entrega valor e observacao sem decidir fornecedor ou categoria', () => {
  assert.match(importer, /_obsManual:descricao/);
  assert.match(importer, /fornecedor_id:null, categoria_id:null/);
  assert.match(importer, /_exigeFornecedorManual:true/);
  assert.match(finance, /const fornCartaoDoItem = item\._bancoImagem/);
  assert.match(finance, /faturaEncontrarFornecedorPorBanco\(item\._bancoImagem\)/);
  assert.match(finance, /item\._origemImagem\s*\? _faturaMemoriaCategorias\[chave\]/);
});

test('camada de conferencia mantem campos editaveis e sincronizados', () => {
  assert.match(finance, /onchange="faturaAoAlterarObs/);
  assert.match(finance, /oninput="faturaMascararValorImportado\(this\); faturaSincronizarValorDigitado/);
  assert.match(finance, /onchange="faturaAoAlterarVencimento/);
  assert.match(finance, /onchange="faturaAoAlterarParcelasManuais/);
});

test('camada de lancamento valida valor fornecedor categoria duplicidade e parcelas', () => {
  assert.match(finance, /faturaVerificarDuplicidadeInicialDocumento/);
  assert.match(finance, /const valoresInvalidos = selecionados\.filter/);
  assert.match(finance, /const semFornecedorObrigatorio = selecionados\.filter/);
  assert.match(finance, /const semCategoria = selecionados\.filter/);
  assert.match(finance, /faturaConfirmarLancamentoSelecionados/);
  assert.match(finance, /faturaGerarParcelasDoItem/);
  assert.match(finance, /valorTotalCompra/);
});
