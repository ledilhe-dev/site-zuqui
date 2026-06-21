(function(){
  // Estrutura segura: não mexe em login/ponto.
  // Usa loja_id + ano para gerar feriados por loja quando a tabela feriados_loja existir.
  function normFeriadoLoja(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); }
  function isoFeriadoLoja(ano,mes,dia){ return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; }
  function pascoaFeriadoLoja(ano){ const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1; return new Date(ano,mes-1,dia); }
  function addDiasFeriadoLoja(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
  function chaveDataFeriadoLoja(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function nacionaisFeriadoLoja(ano){ const p=pascoaFeriadoLoja(ano); return [
    {data:isoFeriadoLoja(ano,1,1), nome:'Confraternização Universal', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,4,21), nome:'Tiradentes', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,5,1), nome:'Dia do Trabalhador', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,9,7), nome:'Independência do Brasil', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,10,12), nome:'Nossa Senhora Aparecida', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,11,2), nome:'Finados', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,11,15), nome:'Proclamação da República', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,11,20), nome:'Consciência Negra', tipo:'nacional'},
    {data:isoFeriadoLoja(ano,12,25), nome:'Natal', tipo:'nacional'},
    {data:chaveDataFeriadoLoja(addDiasFeriadoLoja(p,-2)), nome:'Sexta-feira Santa', tipo:'nacional'},
    {data:chaveDataFeriadoLoja(addDiasFeriadoLoja(p,60)), nome:'Corpus Christi', tipo:'nacional'}
  ]; }
  async function buscarFeriadosBaseLoja(ano, loja){
    const lista=[...nacionaisFeriadoLoja(ano)];
    try{
      if(typeof sb==='undefined' || !sb?.from) return lista;
      const resp=await sb.from('feriados_calendario').select('nome,tipo,ano,mes,dia,data,uf,estado,cidade,municipio,ativo').or(`ano.is.null,ano.eq.${ano}`);
      if(resp?.error) return lista;
      const uf=normFeriadoLoja(loja.estado || loja.uf);
      const cidade=normFeriadoLoja(loja.cidade || loja.municipio);
      (resp.data||[]).forEach(f=>{
        if(f.ativo===false) return;
        const tipo=String(f.tipo||'').toLowerCase()||'feriado';
        const fUf=normFeriadoLoja(f.uf||f.estado);
        const fCidade=normFeriadoLoja(f.cidade||f.municipio);
        const aplica = tipo==='nacional' || ((!fUf || fUf===uf) && (!fCidade || fCidade===cidade));
        if(!aplica) return;
        let data=String(f.data||'').slice(0,10);
        if(!data && f.mes && f.dia) data=isoFeriadoLoja(ano, Number(f.mes), Number(f.dia));
        if(data && f.nome) lista.push({data,nome:f.nome,tipo});
      });
    }catch(e){ console.warn('Não foi possível buscar feriados base:', e); }
    return lista;
  }
  window.atualizarFeriadosLojaAno = async function(ano, lojaId){
    ano = Number(ano || new Date().getFullYear());
    lojaId = String(lojaId || (typeof obterLojaIdSessao==='function' ? obterLojaIdSessao() : '') || usuarioSistemaLogado?.loja_id || '').trim();
    if(!lojaId) throw new Error('Loja não identificada.');
    if(typeof sb==='undefined' || !sb?.from) throw new Error('Supabase não iniciado.');
    const lojaResp = await sb.from('lojas').select('id,nome,cep,cidade,estado,uf,municipio').eq('id', lojaId).maybeSingle();
    if(lojaResp.error) throw lojaResp.error;
    const loja = lojaResp.data || { id: lojaId };
    const feriados = await buscarFeriadosBaseLoja(ano, loja);
    const payload = feriados.map(f=>({
      loja_id: lojaId,
      ano,
      data: f.data,
      nome: f.nome,
      tipo: f.tipo || 'feriado',
      uf: String(loja.estado || loja.uf || '').toUpperCase(),
      cidade: String(loja.cidade || loja.municipio || '').toUpperCase(),
      fonte: 'auto'
    }));
    const resp = await sb.from('feriados_loja').upsert(payload,{onConflict:'loja_id,data,nome'});
    if(resp.error) throw resp.error;
    return { loja, ano, total: payload.length };
  };
})();
