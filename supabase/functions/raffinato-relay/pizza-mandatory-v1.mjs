export function aggregatePizzaMandatoryV1(rows){
  const parents=new Map(),items=new Map();
  for(const row of rows){
    const parentKey=`${row.id_venda}:${row.id_pai}`,component=Number(row.id_componente),group=Number(row.id_grupo_obrigatorio);
    let parent=parents.get(parentKey);if(!parent){parent={groups:new Map(),quantity:Number(row.quantidade_produto_principal||1),value:Number(row.valor_item||0)};parents.set(parentKey,parent)}
    if(!parent.groups.has(group))parent.groups.set(group,new Set());if(Number.isFinite(component))parent.groups.get(group).add(component);
  }
  let inteiras=0,duas=0,tres=0,multiplas=0,valor=0,quantidade=0;
  for(const p of parents.values()){const n=Math.max(1,...[...p.groups.values()].map(s=>s.size));if(n===1)inteiras++;else if(n===2)duas++;else if(n===3)tres++;else multiplas++;valor+=p.value;quantidade+=p.quantity}
  for(const row of rows){const parent=parents.get(`${row.id_venda}:${row.id_pai}`),n=Math.max(1,parent?.groups.get(Number(row.id_grupo_obrigatorio))?.size||1),key=`${row.id_produto_pai}:${row.id_grupo_obrigatorio}:${row.id_componente}`,item=items.get(key)||{produto_pai:row.produto_pai,grupo_obrigatorio:row.grupo_obrigatorio,componente:row.componente,classificacao:n===1?'Inteira':n===2?'Meio a meio':n===3?'Terços':`${n} sabores`,participacoes:0,equivalente:0,quantidade:0,valor:0};item.participacoes++;item.equivalente+=1/n;item.quantidade+=Number(row.quantidade_componente||0);item.valor+=Number(row.valor_componente||0);items.set(key,item)}
  return{resumo:{total_pais:parents.size,inteiras,duas,tres,multiplas,sabores:new Set(rows.map(r=>r.id_componente)).size,quantidade,valor},itens:[...items.values()].sort((a,b)=>b.equivalente-a.equivalente)};
}
