import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../assets/js/97-raffinato-daily-detail.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');

test('relatorio somente consulta pelo botao Consultar',()=>{
  assert.match(js,/onclick="consultarRelatorioDetalhadoVendaDiariaRaffinato\(\)"/);
  const init=js.match(/async function iniciarRelatorioDetalhadoVendaDiariaRaffinato\(\)[\s\S]*?\n(?=async function rddLoadMetadata)/)?.[0]||'';
  assert.doesNotMatch(init,/consultarRelatorioDetalhadoVendaDiariaRaffinato/);
  assert.doesNotMatch(js,/onchange="consultarRelatorioDetalhadoVendaDiariaRaffinato/);
});

test('menu, permissao e backend estao ligados',()=>{
  assert.match(html,/data-page="relatorio_detalhado_venda_diaria_raffinato"/);
  assert.match(relay,/authorizeReportPermission\(admin,body\.usuario_id,body\.loja_id,"relatorio_detalhado_venda_diaria_raffinato"/);
  assert.match(relay,/body\.action === "detailed_daily_sales_report"/);
  assert.match(relay,/totalizadores:detailedTotals\(dailyRows,saleIds\.size,productMap\.size\)/);
  assert.match(relay,/linhas:lines,/);
});

test('filtros extensos ficam recolhidos e o layout possui breakpoints de tablet e celular',()=>{
  const css=fs.readFileSync(new URL('../assets/css/123-raffinato-daily-detail.css',import.meta.url),'utf8');
  assert.match(js,/<details class="rdd-advanced">/);
  assert.match(js,/id="rddGroupPanel" class="rdd-group-panel" hidden/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(max-width:460px\)/);
  assert.match(css,/max-height:48dvh/);
});

test('seletores usam multisselecao recolhivel, busca contem e todos por padrao',()=>{
  assert.match(js,/rddMakeSelector\(id,label\)/);
  assert.match(js,/placeholder="Buscar por contém"/);
  assert.match(js,/Selecionar todos/);
  assert.match(js,/Desmarcar todos/);
  assert.match(js,/<option value="999999" selected>Todos<\/option>/);
  assert.match(js,/selected\.length===all\.length\)return\[\]/);
  assert.doesNotMatch(js,/onchange="consultarRelatorioDetalhadoVendaDiariaRaffinato/);
});

test('anos selecionados viram intervalo detalhado e atalhos reativam as datas',()=>{
  assert.match(js,/selectedYears=rddSelected\('#rddYears input'\)\.map\(Number\)/);
  assert.match(js,/inicio=selectedYears\.length\?`\$\{selectedYears\[0\]\}-01-01`/);
  assert.match(js,/fim=selectedYears\.length\?\(selectedYears\.at\(-1\)===new Date\(\)\.getFullYear\(\)\?today/);
  assert.match(js,/anos=\[\]/);
  assert.match(js,/inicio,fim,anos,meses:/);
  assert.match(js,/function rddActivateDateRange\(\)\{document\.querySelectorAll\('#rddYears input'\)\.forEach\(x=>x\.checked=false\)/);
  assert.match(js,/start\.disabled=usingYears/);
  assert.match(js,/end\.disabled=usingYears/);
  assert.match(js,/consulta detalhada pelo período exibido/);
});

test('api escolhe uma unica fonte por consulta e bloqueia detalhe historico indisponivel',()=>{
  assert.match(relay,/from\("raffinato_anual_cache"\)/);
  assert.match(relay,/String\(x\.modulo_venda\)==="TODOS"/);
  assert.match(relay,/String\(x\.modulo_venda\)!=="TODOS"/);
  assert.match(relay,/mode=requestedYears\.length\?"historico_mensal":"intervalo_detalhado"/);
  assert.match(relay,/O histórico mensal não possui detalhe confiável/);
  assert.match(relay,/não será executada parcialmente/);
  assert.doesNotMatch(relay,/tailDocs=|annualRevenue\+tailRevenue|cache_historico_mensal_mais_detalhe/);
  assert.match(js,/Modo histórico mensal/);
  assert.match(js,/FILTROS APLICADOS/);
  assert.match(js,/TOTALIZADORES/);
});

test('limpar filtros restaura intervalo e estado visual sem selecionar anos',()=>{
  const clear=js.match(/function limparRelatorioDetalhadoVendaDiariaRaffinato\(\)[\s\S]*?\n(?=function rddBars)/)?.[0]||'';
  assert.match(clear,/rddPeriod\(30\)/);
  assert.match(clear,/RDD\.data=null/);
  assert.match(clear,/#rddYears input'\)\.forEach\(x=>x\.checked=false\)/);
  assert.match(clear,/#rddGroups input'\)\.forEach\(x=>x\.checked=true\)/);
  assert.match(clear,/Nenhuma consulta realizada/);
});

test('impede datas futuras e normaliza o periodo antes da consulta',()=>{
  assert.match(js,/input\.max=today/);
  assert.match(js,/function rddClampFutureDates\(\)/);
  assert.match(js,/const adjusted=rddClampFutureDates\(\)/);
  assert.match(js,/Data final ajustada para/);
});

test('faturamento por canal usa os mesmos documentos e integra interface e exportacoes',()=>{
  assert.match(relay,/canais:channelRows/);
  assert.match(relay,/reconciliacao_canais:/);
  assert.match(relay,/media_por_ocorrencia:/);
  assert.match(js,/Faturamento por Canal de Venda/);
  assert.match(js,/Delivery não identifica necessariamente iFood/);
  assert.match(js,/Faturamento por Canal'\)/);
  assert.match(js,/FATURAMENTO POR CANAL/);
});

test('ano completo consulta detalhe local e cruza modulo por dia da semana',()=>{
  assert.match(js,/function rddLocalAnnualReport\(body\)/);
  assert.match(js,/comparativo-anual/);
  assert.match(js,/mode:'detail'/);
  assert.match(js,/moduleDetails=await Promise\.all/);
  assert.match(js,/canais_dias_semana:channelWeek/);
  assert.match(js,/origem_consulta:'raffinato_local_detalhado'/);
  assert.match(js,/if\(!RDD\.data\)RDD\.data=await raffinatoRelay\(body\)/);
});

test('historico diario remoto sustenta graficos anuais sem loopback',()=>{
  assert.match(relay,/raffinato_historico_diario_cache/);
  assert.match(relay,/modo:"historico_diario"/);
  assert.match(relay,/canais_dias_semana:channelWeek/);
  assert.match(relay,/origem_consulta:"cache_historico_diario"/);
  assert.match(relay,/O conector ainda precisa sincronizar o detalhamento diário desta loja/);
});
