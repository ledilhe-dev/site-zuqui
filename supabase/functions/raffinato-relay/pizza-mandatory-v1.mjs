const number=value=>Number.isFinite(Number(value))?Number(value):0;
const close=(a,b)=>Math.abs(a-b)<=0.00001*Math.max(1,Math.abs(a),Math.abs(b));

export function quantidadeEfetivaItemObrigatorio(row){
  const registrada=number(row.quantidade_componente),pais=Math.abs(number(row.quantidade_produto_principal));
  const unitario=Math.abs(number(row.valor_unitario_componente)),total=Math.abs(number(row.valor_componente));
  if(unitario>0&&pais>0&&close(total,unitario*pais)&&!close(total,unitario*registrada))return{quantidade:pais,criterio:'valor_total_confirma_quantidade_pai'};
  return{quantidade:registrada,criterio:'quantidade_registrada'};
}

export function normalizePizzaMandatoryV1(rows){
  const paisVistos=new Set();
  return(rows||[]).map(row=>{const chavePai=`${row.id_venda}:${row.id_pai}`,primeiraLinhaPai=!paisVistos.has(chavePai);paisVistos.add(chavePai);const efetiva=quantidadeEfetivaItemObrigatorio(row);return{
    key:`${row.id_venda}:${row.id_pai}:${row.id_grupo_obrigatorio}:${row.id_item}`,chave_pai:chavePai,id_venda:number(row.id_venda),id_item:number(row.id_item),id_pai:number(row.id_pai),id_produto_pai:number(row.id_produto_pai),id_produto:number(row.id_componente),codigo_integracao:String(row.codigo_componente||''),
    data:String(row.data||''),hora:String(row.hora||'00:00:00'),produto_pai:String(row.produto_pai||'Sem produto pai'),agrupamento_pai:String(row.agrupamento_pai||'Sem agrupamento de produto'),
    grupo_obrigatorio:String(row.grupo_obrigatorio||'Sem agrupamento obrigatório'),item_obrigatorio:String(row.componente||'Sem item obrigatório'),
    quantidade_pai:primeiraLinhaPai?number(row.quantidade_produto_principal):0,quantidade_pai_registrada:number(row.quantidade_produto_principal),quantidade_registrada:number(row.quantidade_componente),
    quantidade_efetiva:efetiva.quantidade,criterio_quantidade:efetiva.criterio,valor_unitario:number(row.valor_unitario_componente),valor_total:number(row.valor_componente),
    modulo:String(row.modulo_venda||row.origem||'SEM_ORIGEM'),canal:String(row.canal_venda||'NAO_IDENTIFICADO'),situacao:String(row.situacao_venda||'NAO_IDENTIFICADA'),
    origem_codigo:row.origem_codigo==null?null:number(row.origem_codigo),origem_item:/^I/i.test(String(row.codigo_componente||''))?'IFOOD_INTEGRACAO':'MANUAL',vinculos_modulo:number(row.vinculos_modulo),cancelado:Boolean(row.cancelado)
  }});
}

const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const NON_FLAVOR_GROUP=/(MASSA|ADICION|ACOMPANH|CORTESIA|CONFIGUR|BORDA|TAMANHO|PONTO|OBSERV)/;
function isPizzaFlavor(record){return /PIZZA/.test(normalized(record.produto_pai))&&!NON_FLAVOR_GROUP.test(normalized(record.grupo_obrigatorio))}

export function reconstructPizzasMandatoryV1(records){
  const parents=new Map();
  for(const record of (records||[]).filter(x=>!x.cancelado&&isPizzaFlavor(x))){
    let pizza=parents.get(record.chave_pai);
    if(!pizza){pizza={chave_pai:record.chave_pai,id_venda:record.id_venda,id_pai:record.id_pai,id_produto_pai:record.id_produto_pai,nome_pai:record.produto_pai,modulo:record.modulo,canal:record.canal,situacao:record.situacao,origem:'MANUAL',partes:[]};parents.set(record.chave_pai,pizza)}
    const occurrences=Math.max(1,Math.round(Math.abs(number(record.quantidade_registrada))||1));
    if(record.origem_item==='IFOOD_INTEGRACAO')pizza.origem='IFOOD_INTEGRACAO';
    for(let i=0;i<occurrences;i++)pizza.partes.push({codigo_integracao:record.codigo_integracao,id_produto:record.id_produto,nome_produto:record.item_obrigatorio});
  }
  return [...parents.values()].map(pizza=>{const counts=new Map();for(const part of pizza.partes){const key=String(part.id_produto||part.nome_produto),item=counts.get(key)||{...part,ocorrencias:0};item.ocorrencias++;counts.set(key,item)}return{...pizza,quantidade_partes:pizza.partes.length,sabores_distintos:counts.size,sabores:[...counts.values()].map(x=>({...x,fracao_numerador:x.ocorrencias,fracao_denominador:pizza.partes.length}))}});
}

export function aggregateRecordsPizzaMandatoryV1(records){
  const liquidos=(records||[]).filter(x=>!x.cancelado),vendas=new Set(),pais=new Set(),abertas=new Set(),finalizadas=new Set();let valor=0,quantidade=0,paisQtd=0;
  for(const r of liquidos){vendas.add(r.id_venda);valor+=r.valor_total;quantidade+=r.quantidade_efetiva;if(!pais.has(r.chave_pai)){pais.add(r.chave_pai);paisQtd+=r.quantidade_pai_registrada}if(r.situacao==='EM_ABERTO')abertas.add(r.id_venda);if(r.situacao==='FINALIZADA')finalizadas.add(r.id_venda)}
  return{resumo:{vendas_gravadas:vendas.size,vendas_abertas:abertas.size,vendas_finalizadas:finalizadas.size,pais_vendidos:paisQtd,quantidade_itens:quantidade,valor_itens:valor,cancelados:(records||[]).filter(x=>x.cancelado).length}};
}

export function aggregatePizzaMandatoryV1(rows){const records=normalizePizzaMandatoryV1(rows);return{...aggregateRecordsPizzaMandatoryV1(records),pizzas:reconstructPizzasMandatoryV1(records),records}}
