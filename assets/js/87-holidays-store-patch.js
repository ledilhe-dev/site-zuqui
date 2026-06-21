(function(){
  // Feriados definitivos por loja/ano. Não altera login, ponto ou permissões.
  const BASE_MUNICIPAIS = {
    // Base corrigida conforme Itapema/SC informado pelo Patrick.
    'SC|ITAPEMA': [
      { mes: 2, dia: 2, nome: 'Nossa Senhora dos Navegantes', tipo: 'municipal' },
      { mes: 6, dia: 13, nome: 'Santo Antônio', tipo: 'municipal' },
      { mes: 12, dia: 8, nome: 'Imaculada Conceição', tipo: 'municipal' }
    ]
  };
  const BASE_ESTADUAIS = {
    'SC': [
      { mes: 8, dia: 11, nome: 'Dia de Santa Catarina', tipo: 'estadual' }
    ]
  };
  function sbOk(){ return typeof sb !== 'undefined' && sb && typeof sb.from === 'function'; }
  function norm(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(); }
  function esc(v){ if(typeof escapeHtml==='function') return escapeHtml(v); return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function iso(ano,mes,dia){ return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`; }
  function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDias(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
  function pascoa(ano){ const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1; return new Date(ano,mes-1,dia); }
  function addMap(map,data,nome,tipo){ if(!data||!nome) return; if(!map[data]) map[data]=[]; const n=norm(nome); if(!map[data].some(f=>norm(f.nome)===n)) map[data].push({nome:String(nome),tipo:String(tipo||'feriado').toLowerCase()}); }
  function nacionais(ano){ const p=pascoa(ano); return [
    {data:iso(ano,1,1),nome:'Confraternização Universal',tipo:'nacional'},
    {data:iso(ano,4,21),nome:'Tiradentes',tipo:'nacional'},
    {data:iso(ano,5,1),nome:'Dia do Trabalhador',tipo:'nacional'},
    {data:iso(ano,9,7),nome:'Independência do Brasil',tipo:'nacional'},
    {data:iso(ano,10,12),nome:'Nossa Senhora Aparecida',tipo:'nacional'},
    {data:iso(ano,11,2),nome:'Finados',tipo:'nacional'},
    {data:iso(ano,11,15),nome:'Proclamação da República',tipo:'nacional'},
    {data:iso(ano,11,20),nome:'Consciência Negra',tipo:'nacional'},
    {data:iso(ano,12,25),nome:'Natal',tipo:'nacional'},
    {data:isoDate(addDias(p,-2)),nome:'Sexta-feira Santa',tipo:'nacional'},
    {data:isoDate(addDias(p,60)),nome:'Corpus Christi',tipo:'nacional'}
  ]; }
  async function lojaAtual(){
    const lojaId=String((typeof obterLojaIdSessao==='function'&&obterLojaIdSessao())||window.usuarioSistemaLogado?.loja_id||usuarioSistemaLogado?.loja_id||window.lojaAtualId||'').trim();
    let loja={id:lojaId,cidade:'',estado:'',cep:''};
    if(lojaId && sbOk()){
      try{
        const q=()=>sb.from('lojas').select('id,nome,cep,cidade,estado,uf,municipio').eq('id',lojaId).maybeSingle();
        const r=typeof executarSemFiltroLojaTemporario==='function'?await executarSemFiltroLojaTemporario(q):await q();
        if(!r.error && r.data){loja={id:lojaId,cep:String(r.data.cep||''),cidade:String(r.data.cidade||r.data.municipio||''),estado:String(r.data.estado||r.data.uf||'').toUpperCase()};}
      }catch(e){console.warn('Loja para feriados não carregou:',e);}
    }
    if(!loja.cidade) loja.cidade=String(document.getElementById('configCidadeLoja')?.value||usuarioSistemaLogado?.loja_cidade||usuarioSistemaLogado?.cidade||'');
    if(!loja.estado) loja.estado=String(document.getElementById('configEstadoLoja')?.value||usuarioSistemaLogado?.loja_estado||usuarioSistemaLogado?.uf||usuarioSistemaLogado?.estado||'').toUpperCase();
    return loja;
  }
  async function buscarBasePersonalizada(ano,loja){
    const lista=[]; if(!sbOk()) return lista;
    // Tabela opcional para cadastrar feriados municipais/estaduais sem mexer no código.
    try{
      const r=await sb.from('feriados_base').select('nome,tipo,ano,mes,dia,data,uf,estado,cidade,municipio,ativo').or(`ano.is.null,ano.eq.${ano}`);
      if(!r.error){
        const uf=norm(loja.estado), cidade=norm(loja.cidade);
        (r.data||[]).forEach(f=>{
          if(f.ativo===false) return;
          const tipo=String(f.tipo||'feriado').toLowerCase();
          const fUf=norm(f.uf||f.estado), fCid=norm(f.cidade||f.municipio);
          if(tipo!=='nacional' && fUf && fUf!==uf) return;
          if(tipo==='municipal' && fCid && fCid!==cidade) return;
          if(tipo!=='municipal' && fCid && fCid!==cidade) return;
          let data=String(f.data||'').slice(0,10); if(!data && f.mes && f.dia) data=iso(ano,Number(f.mes),Number(f.dia));
          if(data && f.nome) lista.push({data,nome:f.nome,tipo});
        });
      }
    }catch(_){ }
    return lista;
  }
  async function gerarListaFeriados(ano,loja){
    const lista=[...nacionais(ano)]; const uf=norm(loja.estado), cidade=norm(loja.cidade);
    (BASE_ESTADUAIS[uf]||[]).forEach(f=>lista.push({data:iso(ano,f.mes,f.dia),nome:f.nome,tipo:f.tipo}));
    (BASE_MUNICIPAIS[`${uf}|${cidade}`]||[]).forEach(f=>lista.push({data:iso(ano,f.mes,f.dia),nome:f.nome,tipo:f.tipo}));
    (await buscarBasePersonalizada(ano,loja)).forEach(f=>lista.push(f));
    const seen=new Set();
    return lista.filter(f=>{const k=f.data+'|'+norm(f.nome); if(seen.has(k)) return false; seen.add(k); return true;});
  }
  async function garantirFeriadosLojaAno(ano,lojaId){
    const loja=await lojaAtual();
    if(lojaId) loja.id=lojaId;
    if(!loja.id) throw new Error('Loja não identificada.');
    if(!sbOk()) throw new Error('Supabase não iniciado. Não foi possível salvar os feriados.');

    const lista=await gerarListaFeriados(ano,loja);
    const payload=lista.map(f=>({
      loja_id:loja.id,
      ano:Number(ano),
      data:f.data,
      nome:f.nome,
      tipo:f.tipo,
      uf:String(loja.estado||'').toUpperCase(),
      cidade:String(loja.cidade||'').toUpperCase(),
      fonte:'auto'
    }));

    // Remove apenas feriados automáticos desse ano/loja para não manter feriado municipal errado antigo.
    const del=await sb.from('feriados_loja').delete().eq('loja_id',loja.id).eq('ano',Number(ano)).eq('fonte','auto');
    if(del.error) throw del.error;

    if(payload.length){
      const up=await sb.from('feriados_loja').upsert(payload,{onConflict:'loja_id,data,nome'});
      if(up.error) throw up.error;
    }

    // Confirma que realmente salvou no banco antes de exibir sucesso.
    const check=await sb.from('feriados_loja').select('id',{count:'exact',head:true}).eq('loja_id',loja.id).eq('ano',Number(ano));
    if(check.error) throw check.error;
    if(!check.count) throw new Error('Nenhum feriado foi salvo no banco. Verifique permissões/RLS da tabela feriados_loja.');

    return {loja,ano,total:lista.length,salvos:check.count,lista};
  }
  async function carregarFeriadosLojaAno(ano){
    const loja=await lojaAtual(); const map={}; let achouTabela=false;
    if(sbOk() && loja.id){
      try{
        let r=await sb.from('feriados_loja').select('data,nome,tipo,fonte').eq('loja_id',loja.id).eq('ano',ano).order('data',{ascending:true});
        if(!r.error){
          achouTabela=true;
          if(!(r.data||[]).length){ await garantirFeriadosLojaAno(ano,loja.id); r=await sb.from('feriados_loja').select('data,nome,tipo,fonte').eq('loja_id',loja.id).eq('ano',ano).order('data',{ascending:true}); }
          (r.data||[]).forEach(f=>addMap(map,String(f.data).slice(0,10),f.nome,f.tipo));
        }
      }catch(e){ console.warn('Não foi possível carregar feriados_loja:',e); }
    }
    if(!achouTabela){ (await gerarListaFeriados(ano,loja)).forEach(f=>addMap(map,f.data,f.nome,f.tipo)); }
    window.__feriadosLojaDefinitivoCache={ano,loja,map};
    return map;
  }
  function eventosPorDia(){ const fonte=window.escalaPlantoesEventos||(typeof escalaPlantoesEventos!=='undefined'?escalaPlantoesEventos:[]); return (fonte||[]).reduce((acc,it)=>{ if(it.deleted_at) return acc; const k=String(it.data_plantao||'').slice(0,10); if(!k) return acc; (acc[k]||(acc[k]=[])).push(it); return acc; },{}); }
  function h(v){ return String(v||'').slice(0,5); }
  function nomeEv(it){ return it.funcionario_nome||it.funcionario?.nome||it.titulo||'Escala'; }
  async function render(){
    const grid=document.getElementById('escalaCalendarioGrid'); if(!grid) return;
    const ref=window.escalaPlantoesDataReferencia||new Date(); const ano=ref.getFullYear(), mes=ref.getMonth();
    const title=document.getElementById('escalaMesTitulo'); if(title) title.textContent=new Date(ano,mes,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
    const showF=document.getElementById('escalaFiltroFeriados')?.checked!==false; const showD=document.getElementById('escalaFiltroDomingos')?.checked!==false;
    const feriados=showF?await carregarFeriadosLojaAno(ano):{}; const evs=eventosPorDia(); const hoje=isoDate(new Date());
    const primeiro=new Date(ano,mes,1).getDay(); const total=new Date(ano,mes+1,0).getDate(); let html='';
    ['DOM.','SEG.','TER.','QUA.','QUI.','SEX.','SÁB.'].forEach(d=>html+=`<div class="escala-dia-semana">${d}</div>`);
    for(let i=0;i<primeiro;i++) html+='<div class="escala-dia escala-dia-vazio"></div>';
    for(let dia=1;dia<=total;dia++){
      const d=new Date(ano,mes,dia); const data=isoDate(d); const domingo=d.getDay()===0; const lista=feriados[data]||[];
      const tipo=lista.some(f=>f.tipo==='municipal')?'municipal':lista.some(f=>f.tipo==='estadual')?'estadual':lista.length?'nacional':'';
      const classes=['escala-dia',domingo&&showD?'domingo':'',lista.length?'feriado':'',tipo?`feriado-${tipo}`:'',data===hoje?'hoje':''].filter(Boolean).join(' ');
      const ferHtml=lista.map(f=>`<div class="escala-feriado-label feriado-${esc(f.tipo||'feriado')}" title="${esc(f.nome)}">${esc(f.nome)}</div>`).join('');
      const eventos=(evs[data]||[]); const eventosHtml=eventos.slice(0,4).map(it=>`<button type="button" class="escala-evento escala-evento-${esc(it.tipo||'plantao')}" onclick="event.stopPropagation(); abrirModalEditarPlantaoEscala('${esc(it.id)}')"><span>${esc(h(it.inicio_hora))} ${esc(nomeEv(it))}</span></button>`).join('');
      const mais=eventos.length>4?`<button type="button" class="escala-evento" onclick="event.stopPropagation()">mais +${eventos.length-4}</button>`:'';
      html+=`<div class="${classes}" data-data="${data}" onclick="abrirModalCadastroPlantaoEscala('${data}')"><div class="escala-dia-numero">${dia}</div>${ferHtml}${eventosHtml}${mais}</div>`;
    }
    grid.innerHTML=html;
  }
  window.atualizarFeriadosLojaAno=garantirFeriadosLojaAno;
  window.atualizarFeriadosDaLojaAtual=async function(){
    try{
      if(typeof setMsg==='function') setMsg('msgConfiguracoes','Atualizando feriados da loja...','ok');
      const loja=await lojaAtual(); if(!loja.id) throw new Error('Loja logada não identificada.'); if(!loja.cidade||!loja.estado) throw new Error('Informe cidade e estado da loja.');
      const ano=new Date().getFullYear(); const anos=[ano,ano+1]; let total=0; let salvos=0;
      for(const a of anos){ const r=await garantirFeriadosLojaAno(a,loja.id); total+=r.total; salvos+=(r.salvos||0); }
      window.__feriadosLojaDefinitivoCache=null;
      if(typeof setMsg==='function') setMsg('msgConfiguracoes',`Feriados salvos para ${loja.cidade}/${loja.estado} (${anos.join(' e ')}). Gerados: ${total}. No banco: ${salvos}.`,'ok');
      await render();
    }catch(e){ console.error('Erro ao atualizar feriados da loja:',e); if(typeof setMsg==='function') setMsg('msgConfiguracoes','Não foi possível atualizar feriados: '+(e.message||'erro desconhecido'),'err'); }
  };
  window.renderizarEscalaPlantoes=function(){ render().catch(e=>console.error('Erro no calendário de feriados:',e)); };
  const oldLoad=window.carregarEscalaPlantoes;
  if(typeof oldLoad==='function' && !oldLoad.__feriadosDefinitivo){
    window.carregarEscalaPlantoes=async function(){ await oldLoad.apply(this,arguments); await render(); };
    window.carregarEscalaPlantoes.__feriadosDefinitivo=true;
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ if(document.getElementById('escalaCalendarioGrid')) render(); },700));
})();
