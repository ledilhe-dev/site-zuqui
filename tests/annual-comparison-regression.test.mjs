import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../assets/js/38-annual-comparison.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/css/114-annual-comparison.css',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

assert.match(css,/\.annual-report-page \.ar-kpis article strong[^}]*-webkit-text-fill-color:#172033!important/,'valores dos KPIs precisam vencer a regra global do tema');
assert.match(css,/\.ar-fiscal-summary :is\(article,button\) strong[^}]*-webkit-text-fill-color:#172033!important/,'valores fiscais precisam ter preenchimento legível');
assert.match(js,/slotIndex=new Map\(slots\.map/,'gráfico fiscal deve distribuir apenas os meses que possuem dados');
assert.match(js,/arSelectedValues\('arYearsOptions'\)/,'filtro deve aceitar vários anos');
assert.match(js,/id_agrupamentos:groups/,'filtro deve enviar vários agrupamentos');
assert.match(js,/onclick="selecionarMesComparativoAnual/,'pontos e células mensais devem permitir drill-down');
assert.match(relay,/annualSnapshot/,'resumo remoto deve preservar o consolidado histórico');
assert.match(relay,/groupSet=new Set\(groupIds\)/,'relay deve cruzar múltiplos agrupamentos');
console.log('OK: regressões do comparativo anual cobertas');
