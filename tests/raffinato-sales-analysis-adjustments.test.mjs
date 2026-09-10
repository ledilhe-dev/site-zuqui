import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/93-raffinato-managerial.js',import.meta.url),'utf8');
const relay=fs.readFileSync(new URL('../supabase/functions/raffinato-relay/index.ts',import.meta.url),'utf8');
const connector=fs.readFileSync(new URL('../tools/raffinato-bridge/raffinato_bridge.py',import.meta.url),'utf8');

test('grupos carregam do catálogo antes da consulta e com escopo da loja',()=>{
  assert.match(source,/async function rmInit\(\).*await rmLoadGroups\(\);rmRenderGroupOptions\(\);rmLoad\(\)/);
  assert.match(source,/\/api\/raffinato\/metadados/);
  assert.match(source,/action:'metadata_dashboard'/);
  assert.match(source,/tenantKey=`\$\{c\.empresaId\}:\$\{c\.lojaId\}:1`/);
  assert.match(source,/Todos os grupos/);
});

test('troca de tenant invalida grupos e descarta resposta atrasada',()=>{
  assert.match(source,/request!==RM\.groupsRequest\|\|currentKey!==tenantKey/);
  assert.match(source,/RM\.groupsTenantKey='';RM\.groupsRequest\+\+/);
  assert.match(source,/void rmLoadGroups\(\)/);
});

test('ordena strings e números internos antes do limite visual',()=>{
  const sandbox={window:{},registrarModuloTenantScoped(){},console,document:{getElementById(){return null}}};
  vm.runInNewContext(source,sandbox);
  const rows=[
    {produto:'C',agrupamento:'X',quantidade:3,faturamento:100,participacao:10},
    {produto:'A',agrupamento:'Z',quantidade:20,faturamento:3,participacao:2},
    {produto:'B',agrupamento:'Y',quantidade:1,faturamento:20,participacao:30},
  ];
  const sorted=vm.runInNewContext(`RM.sortField='faturamento';RM.sortDirection='asc';rmSortedProducts(${JSON.stringify(rows)})`,sandbox);
  assert.deepEqual(Array.from(sorted,x=>x.faturamento),[3,20,100]);
  assert.match(source,/sorted=rmSortedProducts\(prepared\);rmRenderBIBase/);
});

test('cinco cabeçalhos têm botão, indicador e aria-sort',()=>{
  for(const field of ['produto','agrupamento','quantidade','faturamento','participacao'])assert.match(source,new RegExp(`rmSortHeader\\('${field}'`));
  assert.match(source,/aria-sort=/);
  assert.match(source,/↑/);
  assert.match(source,/↓/);
});

test('agrupamentos possuem busca, checkboxes e payload multiseleção',()=>{
  assert.match(source,/id="rmGroupSearch"/);
  assert.match(source,/type="checkbox"/);
  assert.match(source,/function rmFilterGroupOptions/);
  assert.match(source,/id_agrupamentos:groups/);
  assert.match(source,/body\.id_agrupamentos\.length>1/);
  assert.match(relay,/groupSet\.has\(String\(x\.id_agrupamento\)\)/);
  assert.match(relay,/Number\.isSafeInteger/);
});

test('lista de grupos combina cadastro direto e grupos do catálogo de produtos',()=>{
  assert.match(source,/payload\.agrupamentos/);
  assert.match(source,/payload\.produtos/);
  assert.match(source,/x\.id_agrupamento,nome:x\.agrupamento/);
  assert.match(source,/groupMap=new Map/);
});

test('seletor sempre renderiza Todos e usa grupos do resultado como contingência',()=>{
  assert.match(source,/rows=\[\{id:'',nome:'Todos os grupos',all:true\}/);
  assert.match(source,/function rmMergeGroupsFromResult/);
  assert.match(source,/rmMergeGroupsFromResult\(d\)/);
});

test('renderiza opções reais no DOM do seletor',()=>{
  const elements={rmGroupOptions:{innerHTML:''},rmGroupButton:{textContent:'',disabled:false},rmGroup:{value:''},rmGroupSearch:{value:''}};
  const sandbox={window:{},registrarModuloTenantScoped(){},console,document:{getElementById(id){return elements[id]||null},querySelectorAll(){return[]}}};
  vm.runInNewContext(source,sandbox);
  vm.runInNewContext("RM.groupOptions=[{id:'10',nome:'Bebidas'},{id:'20',nome:'Lanches'}];rmRenderGroupOptions()",sandbox);
  assert.match(elements.rmGroupOptions.innerHTML,/Todos os grupos/);
  assert.match(elements.rmGroupOptions.innerHTML,/Bebidas/);
  assert.match(elements.rmGroupOptions.innerHTML,/Lanches/);
  assert.match(elements.rmGroupOptions.innerHTML,/type="checkbox"/);
});

test('conector 1.7.14 entrega todos os agrupamentos configurados da filial',()=>{
  assert.match(connector,/CONNECTOR_VERSION = "1\.7\.14"/);
  const sql=connector.match(/SQL_AGRUPAMENTOS = """([\s\S]*?)"""/)?.[1]||'';
  assert.match(sql,/CA\.IdFilial=\?/);
  assert.doesNotMatch(sql,/BloqueiaVenda/);
  assert.match(connector,/catalogo_agrupamentos_completo/);
});

test('análise e curva ABC tentam o conector local e período vazio não vira erro',()=>{
  assert.doesNotMatch(source,/remoteOnly=path==='\/api\/raffinato\/curva-abc'/);
  assert.doesNotMatch(relay,/CACHE_MISS: periodo ainda nao sincronizado pelo conector/);
});
