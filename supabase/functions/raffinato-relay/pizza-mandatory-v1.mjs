const EPSILON=0.00001;
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const close=(a,b)=>Math.abs(a-b)<=EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
const fractionKind=f=>close(f,1)?'inteiras':close(f,.5)?'meias':close(f,1/3)?'tercos':close(f,2/3)?'dois_tercos':'outras_fracoes';

function composition(flavors,valid){
  if(!valid)return'REVISAR';
  const fractions=flavors.map(x=>x.fraction).sort((a,b)=>b-a);
  if(fractions.length===1&&close(fractions[0],1))return'INTEIRA';
  if(fractions.length===2&&fractions.every(x=>close(x,.5)))return'MEIO_A_MEIO';
  if(fractions.length===3&&fractions.every(x=>close(x,1/3)))return'TRES_SABORES';
  if(fractions.length>=4)return'QUATRO_MAIS';
  return'OUTRAS';
}

export function normalizePizzaMandatoryV1(rows){
  const groups=new Map();
  for(const row of rows||[]){
    const key=`${row.id_venda}:${row.id_pai}:${row.id_grupo_obrigatorio}`;
    let group=groups.get(key);
    if(!group){const parentQty=Math.max(number(row.quantidade_produto_principal),1);group={key,id_venda:number(row.id_venda),id_pai:number(row.id_pai),id_grupo_obrigatorio:number(row.id_grupo_obrigatorio),grupo_obrigatorio:String(row.grupo_obrigatorio||'Sem tipo'),id_produto_pai:number(row.id_produto_pai),produto_pai:String(row.produto_pai||'Sem produto'),id_agrupamento_pai:number(row.id_agrupamento_pai),agrupamento_pai:String(row.agrupamento_pai||'Sem agrupamento'),origem:String(row.origem||'VENDA_RAPIDA'),data:String(row.data||''),hora:String(row.hora||'00:00:00'),parentQty,maxSlots:number(row.quantidade_maxima),valor_pai:number(row.valor_item),flavors:new Map()};groups.set(key,group)}
    const flavorKey=String(row.id_componente??row.componente??'');let flavor=group.flavors.get(flavorKey);
    if(!flavor){flavor={id_sabor:number(row.id_componente),sabor:String(row.componente||'Sem nome'),slotQty:0,value:0};group.flavors.set(flavorKey,flavor)}
    flavor.slotQty+=number(row.quantidade_componente);flavor.value+=number(row.valor_componente);
  }
  const records=[];
  for(const group of groups.values()){
    const expected=group.maxSlots*group.parentQty,observed=[...group.flavors.values()].reduce((s,x)=>s+x.slotQty,0),valid=group.maxSlots>0&&group.parentQty>0&&close(expected,observed);
    const flavors=[...group.flavors.values()].map(x=>({...x,fraction:expected>0?x.slotQty/expected:0,equivalent:group.maxSlots>0?x.slotQty/group.maxSlots:0})),classification=composition(flavors,valid);
    for(const flavor of flavors){const bucket=valid?fractionKind(flavor.fraction):'outras_fracoes';records.push({...group,flavors:undefined,composition:classification,valid,expectedSlots:expected,observedSlots:observed,id_sabor:flavor.id_sabor,sabor:flavor.sabor,slotQty:flavor.slotQty,fraction:flavor.fraction,equivalent:flavor.equivalent,flavorValue:flavor.value,participations:group.parentQty,fractionBucket:bucket})}
  }
  return records;
}

export function aggregateRecordsPizzaMandatoryV1(records){
  const groups=new Map(),flavors=new Map(),products=new Map(),types=new Map();
  for(const record of records||[]){
    if(!groups.has(record.key))groups.set(record.key,record);
    const flavorKey=`${record.id_sabor}:${record.grupo_obrigatorio}`,flavor=flavors.get(flavorKey)||{sabor:record.sabor,tipo:record.grupo_obrigatorio,inteiras:0,meias:0,tercos:0,dois_tercos:0,outras_fracoes:0,participacoes:0,equivalente:0,quantidade:0,valor:0};
    flavor[record.fractionBucket]+=record.participations;flavor.participacoes+=record.participations;flavor.equivalente+=record.equivalent;flavor.quantidade+=record.slotQty;flavor.valor+=record.flavorValue;flavors.set(flavorKey,flavor);
    if(!products.has(record.produto_pai))products.set(record.produto_pai,{produto:record.produto_pai,keys:new Set(),valor:0});const product=products.get(record.produto_pai);if(!product.keys.has(record.key)){product.keys.add(record.key);product.valor+=record.valor_pai}
    if(!types.has(record.grupo_obrigatorio))types.set(record.grupo_obrigatorio,{tipo:record.grupo_obrigatorio,keys:new Set(),valor:0});const type=types.get(record.grupo_obrigatorio);if(!type.keys.has(record.key)){type.keys.add(record.key);type.valor+=record.valor_pai}
  }
  const summary={total_pais:0,inteiras:0,duas:0,tres:0,multiplas:0,outras:0,revisar:0,sabores:new Set((records||[]).map(x=>x.id_sabor||x.sabor)).size,quantidade:0,valor:0};
  for(const group of groups.values()){summary.total_pais+=group.parentQty;summary.quantidade+=group.parentQty;summary.valor+=group.valor_pai;const field={INTEIRA:'inteiras',MEIO_A_MEIO:'duas',TRES_SABORES:'tres',QUATRO_MAIS:'multiplas',OUTRAS:'outras',REVISAR:'revisar'}[group.composition];summary[field]+=group.parentQty}
  return{resumo:summary,itens:[...flavors.values()].sort((a,b)=>b.equivalente-a.equivalente),produtos:[...products.values()].map(x=>({produto:x.produto,quantidade:[...x.keys].reduce((s,k)=>s+groups.get(k).parentQty,0),valor:x.valor})).sort((a,b)=>b.quantidade-a.quantidade),tipos:[...types.values()].map(x=>({tipo:x.tipo,quantidade:[...x.keys].reduce((s,k)=>s+groups.get(k).parentQty,0),valor:x.valor})).sort((a,b)=>b.quantidade-a.quantidade)};
}

export function aggregatePizzaMandatoryV1(rows){const records=normalizePizzaMandatoryV1(rows);return{...aggregateRecordsPizzaMandatoryV1(records),records}}
