import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {aggregatePizzaMandatoryV1} from '../supabase/functions/raffinato-relay/pizza-mandatory-v1.mjs';

const relay=fs.readFileSync('supabase/functions/raffinato-relay/index.ts','utf8');
const frontend=fs.readFileSync('assets/js/96-raffinato-item-obrigatorio-pizza.js','utf8');
const connector=fs.readFileSync('tools/raffinato-bridge/raffinato_bridge.py','utf8');

test('frontend remoto nunca envia filial nem usa localhost',()=>{
  assert.doesNotMatch(frontend,/127\.0\.0\.1|localhost/);
  assert.match(frontend,/hasOwnProperty\.call\(payload,'id_filial'\)/);
  assert.doesNotMatch(frontend,/id_filial\s*:/);
});
test('relay bloqueia filial do cliente antes de resolver o vínculo',()=>{
  const guard=relay.indexOf('startsWith("pizza_mandatory_")&&body.id_filial!==undefined');
  const assignment=relay.indexOf('body.id_filial=Number(mapping.raffinato_filial_id)');
  assert.ok(guard>0&&guard<assignment);
  assert.match(relay,/filial!==Number\(integration\.raffinato_filial_id\)/);
});
test('datasets são exclusivos e chave inclui tenant, filial e versão',()=>{
  const migration=fs.readFileSync('supabase/migrations/202608160002_item_obrigatorio_pizza_v1.sql','utf8');
  assert.match(migration,/primary key\(empresa_id,loja_id,id_filial,dataset_version,id_agrupamento\)/);
  assert.match(migration,/raffinato_pizza_mandatory_data_v1/);
  assert.doesNotMatch(frontend,/mandatory_v2|RaffinatoMandatoryItems/);
});
test('SQL usa configuração ativa, pai real e quantidade do pai',()=>{
  assert.match(connector,/ConfiguracaoAgrupamento CA/);
  assert.match(connector,/CA\.IdFilial=\?/);
  assert.match(connector,/ISNULL\(CA\.BloqueiaVenda,0\)=0/);
  assert.match(connector,/SQL_PIZZA_MANDATORY_DATA_V1[\s\S]*PAI\.Quantidade quantidade_produto_principal/);
  assert.match(connector,/INNER JOIN dbo\.VendaItem PAI/);
  assert.match(connector,/VI\.IdTipoRegistro=3 AND VI\.IdAgrupamentoItemObrigatorio IS NOT NULL/);
});
const base={id_venda:1,id_pai:10,id_produto_pai:2,produto_pai:'Pizza',id_grupo_obrigatorio:7,grupo_obrigatorio:'PIZZA GRAND',quantidade_produto_principal:1,quantidade_maxima:2,valor_item:50,valor_componente:0};
const flavors=(max,parent,values)=>values.map(([id,name,qty],index)=>({...base,quantidade_maxima:max,quantidade_produto_principal:parent,id_item:index+1,id_componente:id,componente:name,quantidade_componente:qty}));
const byFlavor=(data,name)=>data.itens.find(x=>x.sabor===name);
test('max 2: sabor com dois slots é inteira',()=>{const d=aggregatePizzaMandatoryV1(flavors(2,1,[[1,'Calabresa',2]]));assert.equal(d.resumo.inteiras,1);assert.equal(byFlavor(d,'Calabresa').inteiras,1);assert.equal(byFlavor(d,'Calabresa').equivalente,1)});
test('max 2: 1+1 é meio a meio',()=>{const d=aggregatePizzaMandatoryV1(flavors(2,1,[[1,'Calabresa',1],[2,'Portuguesa',1]]));assert.equal(d.resumo.duas,1);assert.equal(byFlavor(d,'Calabresa').meias,1);assert.equal(byFlavor(d,'Calabresa').equivalente,.5)});
test('max 3: três slots do mesmo sabor é inteira',()=>{const d=aggregatePizzaMandatoryV1(flavors(3,1,[[1,'Calabresa',3]]));assert.equal(d.resumo.inteiras,1);assert.equal(byFlavor(d,'Calabresa').inteiras,1)});
test('max 3: 2/3 + 1/3 é outra composição',()=>{const d=aggregatePizzaMandatoryV1(flavors(3,1,[[1,'Calabresa',2],[2,'Portuguesa',1]]));assert.equal(d.resumo.outras,1);assert.equal(byFlavor(d,'Calabresa').dois_tercos,1);assert.ok(Math.abs(byFlavor(d,'Calabresa').equivalente-2/3)<1e-8);assert.equal(byFlavor(d,'Portuguesa').tercos,1)});
test('max 3: 1+1+1 são três sabores',()=>{const d=aggregatePizzaMandatoryV1(flavors(3,1,[[1,'Calabresa',1],[2,'Portuguesa',1],[3,'Mignon',1]]));assert.equal(d.resumo.tres,1);assert.ok(d.itens.every(x=>x.tercos===1))});
test('pai 2: quatro slots iguais são duas inteiras',()=>{const d=aggregatePizzaMandatoryV1(flavors(2,2,[[1,'Calabresa',4]]));assert.equal(d.resumo.inteiras,2);assert.equal(byFlavor(d,'Calabresa').inteiras,2)});
test('pai 2: 2+2 são duas pizzas meio a meio',()=>{const d=aggregatePizzaMandatoryV1(flavors(2,2,[[1,'Calabresa',2],[2,'Portuguesa',2]]));assert.equal(d.resumo.duas,2);assert.equal(byFlavor(d,'Calabresa').meias,2);assert.equal(byFlavor(d,'Calabresa').equivalente,1)});
test('slots divergentes são marcados para revisão',()=>{const d=aggregatePizzaMandatoryV1(flavors(3,1,[[1,'Calabresa',2]]));assert.equal(d.resumo.revisar,1);assert.equal(d.records[0].composition,'REVISAR')});
test('lifecycle SPA invalida e aborta ao desmontar',()=>{
  assert.match(frontend,/state\.generation\+\+/);assert.match(frontend,/state\.controller\?\.abort\(\)/);assert.match(frontend,/key\(context\(\)\)===key\(ctx\)/);
});
test('BI cruza filtros em memória e não consulta novamente a cada clique',()=>{
  assert.match(frontend,/biFilters/);assert.match(frontend,/state\.records\.filter/);assert.match(frontend,/data-pair-flavor/);assert.match(frontend,/data-sort-table/);
  assert.equal((frontend.match(/pizza_mandatory_report_v1/g)||[]).length,1);
});
test('relatório antigo foi removido da aplicação',()=>{
  const index=fs.readFileSync('index.html','utf8'),navigation=fs.readFileSync('assets/js/04-navigation.js','utf8'),manifest=fs.readFileSync('assets/manifest.json','utf8');
  assert.doesNotMatch(index,/raffinato_itens_obrigatorios_v2|95-raffinato-mandatory|116-raffinato-mandatory/);
  assert.doesNotMatch(navigation,/raffinato_itens_obrigatorios_v2|RaffinatoMandatoryItems/);
  assert.doesNotMatch(manifest,/95-raffinato-mandatory|116-raffinato-mandatory/);
});
test('exclusão da conexão exige token temporário de uso único',()=>{
  const settings=fs.readFileSync('assets/js/34-raffinato-sangrias.js','utf8');
  assert.match(connector,/DELETE_TOKENS\.pop\(supplied,None\)/);
  assert.match(connector,/expected\[0\]!=store_id/);
  assert.match(settings,/token-exclusao/);
  assert.match(settings,/delete_token:raffinatoDeleteToken/);
});
