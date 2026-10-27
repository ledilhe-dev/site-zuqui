export function detailedTotals(dailyRows, sales, products) {
  const revenue = dailyRows.reduce((sum, row) => sum + Number(row.faturamento || 0), 0);
  const days = dailyRows.length;
  return {
    faturamento: revenue,
    vendas: Number(sales || 0),
    ticket_medio: sales ? revenue / sales : 0,
    dias: days,
    media_diaria: days ? revenue / days : 0,
    maior_dia: days ? Math.max(...dailyRows.map(row => Number(row.faturamento || 0))) : 0,
    menor_dia: days ? Math.min(...dailyRows.map(row => Number(row.faturamento || 0))) : 0,
    produtos: Number(products || 0),
  };
}

export function historicalMonthlyReport(rows, groupBy) {
  const revenue = rows.reduce((sum, row) => sum + Number(row.faturamento || 0), 0);
  const sales = rows.reduce((sum, row) => sum + Number(row.vendas || 0), 0);
  const quantity = rows.reduce((sum, row) => sum + Number(row.quantidade || 0), 0);
  const yearly = new Map();
  for (const source of rows) {
    const name = String(source.ano);
    const row = yearly.get(name) || { nome:name, faturamento:0, vendas:0, quantidade:0 };
    row.faturamento += Number(source.faturamento || 0);
    row.vendas += Number(source.vendas || 0);
    row.quantidade += Number(source.quantidade || 0);
    yearly.set(name, row);
  }
  const decorate = row => ({
    ...row,
    ticket_medio: row.vendas ? row.faturamento / row.vendas : 0,
    media_diaria: null,
    dias: null,
    participacao: revenue ? row.faturamento / revenue * 100 : 0,
  });
  const years = [...yearly.values()].map(decorate).sort((a,b) => a.nome.localeCompare(b.nome));
  const months = rows.map(source => decorate({
    nome:`${String(source.mes).padStart(2,'0')}/${source.ano}`,
    data:`${source.ano}-${String(source.mes).padStart(2,'0')}`,
    ano:Number(source.ano),
    mes:Number(source.mes),
    faturamento:Number(source.faturamento || 0),
    vendas:Number(source.vendas || 0),
    quantidade:Number(source.quantidade || 0),
  }));
  const lines = groupBy === 'ano' ? years : groupBy === 'nenhum'
    ? [decorate({ nome:'Total geral', faturamento:revenue, vendas:sales, quantidade:quantity })]
    : months;
  return {
    totalizadores:{ faturamento:revenue, vendas:sales, ticket_medio:sales ? revenue / sales : 0,
      dias:null, media_diaria:null, maior_dia:null, menor_dia:null, produtos:null },
    linhas:lines,
    evolucao:months,
    anos:years,
  };
}
