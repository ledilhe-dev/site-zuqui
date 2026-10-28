import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../assets/js/36-raffinato-sales-analysis.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/css/112-raffinato-sales-analysis.css',import.meta.url),'utf8');

test('origem usa multisselecao com as tres opcoes reais',()=>{
  assert.match(html,/id="rsOriginsMulti"/);
  assert.match(html,/class="rs-origin-option"[^>]+value="VENDA_RAPIDA"/);
  assert.match(html,/class="rs-origin-option"[^>]+value="CARTAO_MESA"/);
  assert.match(html,/class="rs-origin-option"[^>]+value="DELIVERY"/);
  assert.doesNotMatch(html,/id="rsModule"/);
  assert.match(css,/\.rs-origin-panel/);
});

test('consulta aplica uma ou duas origens e todas ou nenhuma equivalem a sem filtro',()=>{
  assert.match(js,/function rsSelectedOrigins\(\)/);
  assert.match(js,/modules:rsSelectedOrigins\(\)/);
  assert.match(js,/module:initial\.modules\.length===3\?\[\]:initial\.modules/);
  assert.match(js,/selected\.length===all\.length\?'Todas as origens'/);
  assert.match(js,/'Sem filtro de origem'/);
});

test('delivery fica fora inclusive das operacoes abertas quando nao selecionado',()=>{
  assert.match(js,/modules=\['DELIVERY','CARTAO_MESA'\]\.filter\(x=>!selected\.length\|\|selected\.includes\(x\)\)/);
  assert.match(js,/rsOpenOperations\.filter\(x=>!originFilter\.length\|\|originFilter\.includes\(String\(x\.modulo_venda\)\)\)/);
});

