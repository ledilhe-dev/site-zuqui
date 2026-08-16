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
test('agregação usa unidade venda+pai e fração 1/N',()=>{
  const base={id_venda:1,id_pai:10,id_produto_pai:2,produto_pai:'Pizza',id_grupo_obrigatorio:7,grupo_obrigatorio:'Sabores',quantidade_produto_principal:1,valor_item:50,quantidade_componente:1,valor_componente:0};
  const data=aggregatePizzaMandatoryV1([{...base,id_item:1,id_componente:101,componente:'A'},{...base,id_item:2,id_componente:102,componente:'B'}]);
  assert.equal(data.resumo.total_pais,1);assert.equal(data.resumo.duas,1);assert.equal(data.itens[0].equivalente,.5);assert.equal(data.itens[1].equivalente,.5);
});
test('lifecycle SPA invalida e aborta ao desmontar',()=>{
  assert.match(frontend,/state\.generation\+\+/);assert.match(frontend,/state\.controller\?\.abort\(\)/);assert.match(frontend,/key\(context\(\)\)===key\(ctx\)/);
});
test('exclusão da conexão exige token temporário de uso único',()=>{
  const settings=fs.readFileSync('assets/js/34-raffinato-sangrias.js','utf8');
  assert.match(connector,/DELETE_TOKENS\.pop\(supplied,None\)/);
  assert.match(connector,/expected\[0\]!=store_id/);
  assert.match(settings,/token-exclusao/);
  assert.match(settings,/delete_token:raffinatoDeleteToken/);
});
