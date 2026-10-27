import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { detailedTotals, historicalMonthlyReport } from '../supabase/functions/raffinato-relay/daily-detail-report.mjs';

test('intervalo obrigatório 27/09/2026 a 30/09/2026 fecha todos os indicadores',()=>{
  const dailyRows=[
    {data:'2026-09-27',faturamento:5144.25},
    {data:'2026-09-28',faturamento:2204.23},
    {data:'2026-09-29',faturamento:2336.65},
    {data:'2026-09-30',faturamento:2143.31},
  ];
  const result=detailedTotals(dailyRows,457,0);
  assert.equal(Number(result.faturamento.toFixed(2)),11828.44);
  assert.equal(result.vendas,457);
  assert.equal(Number(result.ticket_medio.toFixed(2)),25.88);
  assert.equal(result.dias,4);
  assert.equal(Number(result.media_diaria.toFixed(2)),2957.11);
  assert.equal(result.maior_dia,5144.25);
  assert.equal(result.menor_dia,2143.31);
});

test('modo histórico mensal não inventa métricas diárias',()=>{
  const report=historicalMonthlyReport([
    {ano:2025,mes:1,faturamento:1000,vendas:40,quantidade:80},
    {ano:2026,mes:1,faturamento:1200,vendas:48,quantidade:96},
  ],'ano');
  assert.equal(report.totalizadores.faturamento,2200);
  assert.equal(report.totalizadores.vendas,88);
  assert.equal(report.totalizadores.dias,null);
  assert.equal(report.totalizadores.media_diaria,null);
  assert.equal(report.anos.length,2);
});

test('frontend apresenta exatamente os totalizadores da resposta mais recente',()=>{
  const source=fs.readFileSync(new URL('../assets/js/97-raffinato-daily-detail.js',import.meta.url),'utf8');
  const context={Intl,console};
  vm.runInNewContext(`${source}\nglobalThis.__kpis=rddKpiRows;`,context);
  const rows=context.__kpis({faturamento:91770.97,vendas:3412,ticket_medio:26.8965334,dias:30,
    media_diaria:3059.032333,maior_dia:5000,menor_dia:1000,produtos:500});
  const values=Object.fromEntries(rows);
  assert.match(values['Faturamento total'],/91\.770,97/);
  assert.equal(values.Vendas,'3.412');
  assert.match(values['Ticket médio'],/26,90/);
  assert.equal(values['Dias analisados'],'30');
  assert.match(values['Média diária'],/3\.059,03/);
  assert.doesNotMatch(JSON.stringify(values),/3\.507\.294,34|171\.258/);
});

test('frontend envia setembro no modo por datas e nenhum ano selecionado',()=>{
  const source=fs.readFileSync(new URL('../assets/js/97-raffinato-daily-detail.js',import.meta.url),'utf8');
  const elements={
    rddStart:{value:'2026-09-01'},rddEnd:{value:'2026-09-30'},rddGroupBy:{value:'dia_semana'},
    rddTop:{value:'999999'},
  };
  const checked=value=>({checked:true,value}),unchecked=value=>({checked:false,value});
  const selectorMap={
    '#rddYears input':[unchecked('2020'),unchecked('2021'),unchecked('2022'),unchecked('2023'),unchecked('2024'),unchecked('2025'),unchecked('2026')],
    '#rddMonths input':Array.from({length:12},(_,i)=>checked(String(i+1))),
    '.rdd-weekday':Array.from({length:7},(_,i)=>checked(String(i))),
    '#rddGroups input':[checked('1'),checked('2')],
    '#rddOrigins input':[checked('VENDA_RAPIDA'),checked('DELIVERY'),checked('CARTAO_MESA')],
  };
  const context={Intl,console,usuarioSistemaLogado:{id:'principal'},contextoRaffinato:()=>({empresaId:'empresa',lojaId:'loja'}),
    document:{getElementById:id=>elements[id],querySelectorAll:selector=>selectorMap[selector]||[]}};
  vm.runInNewContext(`${source}\nglobalThis.__body=rddBody;`,context);
  const body=context.__body();
  assert.equal(body.inicio,'2026-09-01');
  assert.equal(body.fim,'2026-09-30');
  assert.deepEqual([...body.anos],[]);
  assert.deepEqual([...body.meses],[]);
  assert.deepEqual([...body.dias_semana],[]);
  assert.deepEqual([...body.id_agrupamentos],[]);
  assert.deepEqual([...body.origens],[]);
  assert.equal(body.agrupar_por,'dia_semana');
});
