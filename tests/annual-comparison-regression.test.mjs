import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../assets/js/38-annual-comparison.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/css/114-annual-comparison.css',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(css,/\.annual-report-page \.ar-kpis article strong[^}]*-webkit-text-fill-color:#172033!important/,'valores dos KPIs precisam vencer a regra global do tema');
assert.match(css,/\.ar-fiscal-summary :is\(article,button\) strong[^}]*-webkit-text-fill-color:#172033!important/,'valores fiscais precisam ter preenchimento legível');
assert.match(js,/yearRows=allRows\.filter/,'gráfico fiscal deve mostrar somente o ano ativo');
assert.match(js,/arMonths\.forEach/,'gráficos devem manter o eixo fixo de janeiro a dezembro');
assert.match(js,/Math\.min\(max,Math\.max\(0,v\)\)/,'pontos devem permanecer dentro da área do gráfico');
assert.match(js,/arSelectedValues\('arYearsOptions'\)/,'filtro deve aceitar vários anos');
assert.match(js,/arSelectedValues\('arModulesOptions'\)/,'filtro deve aceitar vários módulos');
assert.match(js,/modulos_venda:modules/,'consulta deve enviar os módulos selecionados');
assert.match(js,/id_agrupamentos:groups/,'filtro deve enviar vários agrupamentos');
assert.match(js,/onclick="selecionarMesComparativoAnual/,'pontos e células mensais devem permitir drill-down');
assert.match(relay,/annualSnapshot/,'resumo remoto deve preservar o consolidado histórico');
assert.match(relay,/groupSet=new Set\(groupIds\)/,'relay deve cruzar múltiplos agrupamentos');
assert.match(relay,/moduleSet=new Set\(moduleIds\)/,'relay deve cruzar múltiplos módulos');
assert.match(css,/\.annual-report-page \.ar-multiselect-panel\{z-index:320!important/,'menus múltiplos devem ficar acima do relatório');
assert.match(css,/\.annual-report-page \.ar-selection \*\{color:#4c1d95!important/,'faixa de filtros deve manter contraste legível');
assert.match(html,/>Tipo de Documento<details/,'filtro fiscal deve usar o nome Tipo de Documento');
console.log('OK: regressões do comparativo anual cobertas');
