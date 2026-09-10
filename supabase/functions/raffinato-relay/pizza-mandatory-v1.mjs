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
    key:`${row.id_venda}:${row.id_pai}:${row.id_grupo_obrigatorio}:${row.id_item}`,chave_pai:chavePai,id_venda:number(row.id_venda),id_item:number(row.id_item),id_pai:number(row.id_pai),
    data:String(row.data||''),hora:String(row.hora||'00:00:00'),produto_pai:String(row.produto_pai||'Sem produto pai'),agrupamento_pai:String(row.agrupamento_pai||'Sem agrupamento de produto'),
    grupo_obrigatorio:String(row.grupo_obrigatorio||'Sem agrupamento obrigatório'),item_obrigatorio:String(row.componente||'Sem item obrigatório'),
    quantidade_pai:primeiraLinhaPai?number(row.quantidade_produto_principal):0,quantidade_pai_registrada:number(row.quantidade_produto_principal),quantidade_registrada:number(row.quantidade_componente),
    quantidade_efetiva:efetiva.quantidade,criterio_quantidade:efetiva.criterio,valor_unitario:number(row.valor_unitario_componente),valor_total:number(row.valor_componente),
    modulo:String(row.modulo_venda||row.origem||'SEM_ORIGEM'),canal:String(row.canal_venda||'NAO_IDENTIFICADO'),situacao:String(row.situacao_venda||'NAO_IDENTIFICADA'),
    origem_codigo:row.origem_codigo==null?null:number(row.origem_codigo),vinculos_modulo:number(row.vinculos_modulo),cancelado:Boolean(row.cancelado)
  }});
}

export function aggregateRecordsPizzaMandatoryV1(records){
  const liquidos=(records||[]).filter(x=>!x.cancelado),vendas=new Set(),pais=new Set(),abertas=new Set(),finalizadas=new Set();let valor=0,quantidade=0,paisQtd=0;
  for(const r of liquidos){vendas.add(r.id_venda);valor+=r.valor_total;quantidade+=r.quantidade_efetiva;if(!pais.has(r.chave_pai)){pais.add(r.chave_pai);paisQtd+=r.quantidade_pai_registrada}if(r.situacao==='EM_ABERTO')abertas.add(r.id_venda);if(r.situacao==='FINALIZADA')finalizadas.add(r.id_venda)}
  return{resumo:{vendas_gravadas:vendas.size,vendas_abertas:abertas.size,vendas_finalizadas:finalizadas.size,pais_vendidos:paisQtd,quantidade_itens:quantidade,valor_itens:valor,cancelados:(records||[]).filter(x=>x.cancelado).length}};
}

export function aggregatePizzaMandatoryV1(rows){const records=normalizePizzaMandatoryV1(rows);return{...aggregateRecordsPizzaMandatoryV1(records),records}}
