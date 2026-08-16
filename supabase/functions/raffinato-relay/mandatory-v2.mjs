export function aggregateMandatoryV2(rows) {
  const units = new Map();
  for (const row of rows) {
    const key = `${row.id_venda}:${row.id_pai}:${row.id_grupo_obrigatorio}`;
    const list = units.get(key) || [];
    list.push(row);
    units.set(key, list);
  }
  const flavors = new Map(), products = new Map(), groups = new Map();
  let whole = 0, two = 0, three = 0, multiple = 0, componentValue = 0;
  for (const list of units.values()) {
    const first = list[0];
    const distinct = [...new Map(list.map(row => [String(row.id_componente), row])).values()];
    const count = distinct.length;
    if (count === 1) whole++; else if (count === 2) two++; else if (count === 3) three++; else if (count > 3) multiple++;
    const fraction = count ? 1 / count : 0;
    const kind = count === 1 ? "inteiras" : count === 2 ? "meias" : count === 3 ? "tercos" : "outras";
    for (const row of distinct) {
      const key = `${row.id_grupo_obrigatorio}:${row.id_componente}`;
      const item = flavors.get(key) || {tipo_tamanho:row.grupo_obrigatorio,produto_principal:row.produto_pai,grupo_obrigatorio:row.grupo_obrigatorio,item:row.componente,inteiras:0,meias:0,tercos:0,outras:0,participacoes:0,equivalente:0,quantidade:0,valor:0};
      item[kind]++; item.participacoes++; item.equivalente += fraction;
      item.quantidade += Number(row.quantidade_componente || 0); item.valor += Number(row.valor_componente || 0);
      flavors.set(key, item); componentValue += Number(row.valor_componente || 0);
    }
    const productKey = String(first.id_produto_pai ?? "sem-produto");
    const product = products.get(productKey) || {produto:first.produto_pai || "Sem produto pai",quantidade:0,inteiras:0,duas:0,tres:0,multiplas:0,valor:0};
    product.quantidade++; product[count === 1 ? "inteiras" : count === 2 ? "duas" : count === 3 ? "tres" : "multiplas"]++; product.valor += Number(first.valor_item || 0); products.set(productKey, product);
    const groupKey = String(first.id_grupo_obrigatorio);
    const group = groups.get(groupKey) || {id:first.id_grupo_obrigatorio,descricao:first.grupo_obrigatorio,quantidade_maxima:first.quantidade_maxima,quantidade_minima:first.quantidade_minima,quantidade:0,valor:0};
    group.quantidade += distinct.reduce((sum, row) => sum + Number(row.quantidade_componente || 0), 0); group.valor += distinct.reduce((sum, row) => sum + Number(row.valor_componente || 0), 0); groups.set(groupKey, group);
  }
  const total = units.size;
  return {resumo:{total,inteiras:whole,duas:two,tres:three,multiplas:multiple,sabores:new Set(rows.map(row=>String(row.id_componente))).size,valor_itens:componentValue,ticket_medio:total?componentValue/total:0,percentual_inteiras:total?whole/total*100:0,percentual_duas:total?two/total*100:0,percentual_tres:total?three/total*100:0},itens:[...flavors.values()].sort((a,b)=>b.equivalente-a.equivalente),produtos:[...products.values()].sort((a,b)=>b.quantidade-a.quantidade),grupos_obrigatorios:[...groups.values()].sort((a,b)=>String(a.descricao).localeCompare(String(b.descricao),"pt-BR"))};
}

