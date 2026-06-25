(function(){
  function h(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v ?? '').replace(/[&<>'"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]; });
  }
  function iso(d){
    const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function addDays(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
  function pascoa(ano){
    const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),hh=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-hh-k)%7,m=Math.floor((a+11*hh+22*l)/451),mes=Math.floor((hh+l-7*m+114)/31),dia=((hh+l-7*m+114)%31)+1;
    return new Date(ano,mes-1,dia);
  }
  function feriadosNacionais(ano){
    const p=pascoa(ano);
    const lista=[
      [`${ano}-01-01`,'Confraternização Universal'],[`${ano}-04-21`,'Tiradentes'],[`${ano}-05-01`,'Dia do Trabalhador'],[`${ano}-09-07`,'Independência do Brasil'],[`${ano}-10-12`,'Nossa Senhora Aparecida'],[`${ano}-11-02`,'Finados'],[`${ano}-11-15`,'Proclamação da República'],[`${ano}-11-20`,'Consciência Negra'],[`${ano}-12-25`,'Natal'],
      [iso(addDays(p,-48)),'Carnaval'],[iso(addDays(p,-47)),'Carnaval'],[iso(addDays(p,-2)),'Sexta-feira Santa'],[iso(addDays(p,60)),'Corpus Christi']
    ];
    return Object.fromEntries(lista);
  }
  function eventosPorDia(){
    return (window.escalaPlantoesEventos || escalaPlantoesEventos || []).reduce(function(acc,item){
      const k=String(item.data_plantao||'').slice(0,10); if(!k) return acc; (acc[k]||(acc[k]=[])).push(item); return acc;
    },{});
  }
  window.renderizarEscalaPlantoes = function(){
    const grid=document.getElementById('escalaCalendarioGrid');
    const titulo=document.getElementById('escalaMesTitulo');
    if(!grid) return;
    if(!(window.escalaPlantoesDataReferencia instanceof Date) || Number.isNaN(window.escalaPlantoesDataReferencia?.getTime?.())) window.escalaPlantoesDataReferencia=new Date();
    const ref=window.escalaPlantoesDataReferencia;
    const ano=ref.getFullYear(); const mes=ref.getMonth();
    const nomes=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    if(titulo) titulo.textContent=`${nomes[mes]} de ${ano}`;
    const showFeriados=document.getElementById('escalaFiltroFeriados')?.checked!==false;
    const showDomingos=document.getElementById('escalaFiltroDomingos')?.checked!==false;
    const feriados=showFeriados ? feriadosNacionais(ano) : {};
    const primeiro=new Date(ano,mes,1);
    const ultimo=new Date(ano,mes+1,0);
    const diasNoMes=ultimo.getDate();
    const blanksAntes=primeiro.getDay();
    const totalCelulas=Math.ceil((blanksAntes+diasNoMes)/7)*7;
    const hoje=iso(new Date()); const evDia=eventosPorDia();
    const dias=['DOM.','SEG.','TER.','QUA.','QUI.','SEX.','SÁB.'];
    let html=dias.map(d=>`<div class="escala-dia-semana">${d}</div>`).join('');
    for(let i=0;i<totalCelulas;i++){
      const diaMes=i-blanksAntes+1;
      if(diaMes<1 || diaMes>diasNoMes){
        html += `<div class="escala-dia escala-dia-vazio" aria-hidden="true"></div>`;
        continue;
      }
      const data=new Date(ano,mes,diaMes); const k=iso(data); const domingo=data.getDay()===0; const feriado=feriados[k] || '';
      const classes=['escala-dia', domingo&&showDomingos?'domingo':'', feriado?'feriado':'', k===hoje?'hoje':''].filter(Boolean).join(' ');
      const feriadoHtml=feriado?`<div class="escala-feriado-label" title="${h(feriado)}">${h(feriado)}</div>`:'';
      const eventos=(evDia[k]||[]);
      const eventosHtml=eventos.slice(0,4).map(function(ev){
        const nome=ev.funcionario_nome || ev.funcionarios?.nome || 'Funcionário';
        const ini=String(ev.inicio_hora||'').slice(0,5);
        const txt=`${ini} ${nome}`.trim();
        return `<button class="escala-evento ${h(ev.tipo||'plantao')}" type="button" title="${h(txt)}">${h(txt)}</button>`;
      }).join('');
      const mais=eventos.length>4?`<button class="escala-evento" type="button">mais +${eventos.length-4}</button>`:'';
      html += `<div class="${classes}" data-data="${k}" onclick="abrirModalCadastroPlantaoEscala('${k}')"><div class="escala-dia-numero">${data.getDate()}</div>${feriadoHtml}${eventosHtml}${mais}</div>`;
    }
    grid.innerHTML=html;
  };
  window.carregarEscalaPlantoes = async function(){
    if(!(window.escalaPlantoesDataReferencia instanceof Date)) window.escalaPlantoesDataReferencia=new Date();
    window.renderizarEscalaPlantoes();
    try{
      const ref=window.escalaPlantoesDataReferencia;
      const inicio=iso(new Date(ref.getFullYear(),ref.getMonth(),1));
      const fim=iso(new Date(ref.getFullYear(),ref.getMonth()+1,0));
      if(typeof sb !== 'undefined' && sb?.from){
        let q=sb.from('escala_plantoes').select('id, empresa_id, loja_id, funcionario_id, data_plantao, inicio_hora, fim_hora, tipo, titulo, observacao').gte('data_plantao',inicio).lte('data_plantao',fim).order('data_plantao',{ascending:true}).order('inicio_hora',{ascending:true});
        const lojaId=String((typeof obterLojaIdSessao==='function' ? obterLojaIdSessao() : '') || usuarioSistemaLogado?.loja_id || lojaAtualId || '').trim();
        if(lojaId) q=q.eq('loja_id',lojaId);
        const r=await q;
        if(!r.error) {
          const dados = r.data || [];
          const funcionarioIds = [...new Set(dados.map(ev => ev.funcionario_id).filter(Boolean))];
          const nomes = {};
          if (funcionarioIds.length) {
            try {
              const rf = await sb.from('funcionarios').select('id, nome').in('id', funcionarioIds);
              if (!rf.error) (rf.data || []).forEach(f => { nomes[String(f.id)] = f.nome || ''; });
            } catch (_) {}
          }
          window.escalaPlantoesEventos = escalaPlantoesEventos = dados.map(ev => ({
            ...ev,
            funcionario_nome: nomes[String(ev.funcionario_id)] || ev.funcionario_nome || 'Funcionário'
          }));
          if(typeof setMsg==='function') setMsg('msgEscalaPlantoes', '', 'ok');
        } else if(typeof setMsg==='function') {
          const msg = (r.error && (r.error.message || r.error.details || r.error.hint || r.error.code)) || 'erro desconhecido';
          const textoErro = String(msg).toLowerCase();
          if (textoErro.includes('empresa_id')) {
            setMsg('msgEscalaPlantoes', 'Tabela escala_plantoes existe, mas falta a coluna empresa_id. Rode o SQL de correção multi-filial e recarregue a página.', 'err');
          } else if (textoErro.includes('loja_id')) {
            setMsg('msgEscalaPlantoes', 'Tabela escala_plantoes existe, mas falta a coluna loja_id. Rode o SQL de correção multi-filial e recarregue a página.', 'err');
          } else if (String(r.error?.code || '').includes('42P01') || textoErro.includes('could not find the table') || textoErro.includes('schema cache') || (textoErro.includes('relation') && textoErro.includes('does not exist'))) {
            setMsg('msgEscalaPlantoes', "Tabela escala_plantoes existe no banco, mas o Supabase REST ainda não atualizou o schema cache. Rode o SQL de recarregar schema e atualize a página.", 'err');
          } else {
            setMsg('msgEscalaPlantoes', `Erro ao carregar escala_plantoes: ${msg}`, 'err');
          }
        }
      }
    }catch(e){ console.warn('Falha ao buscar escala_plantoes:', e); }
    window.renderizarEscalaPlantoes();
  };
  window.mudarMesEscalaPlantoes=function(delta){ const r=window.escalaPlantoesDataReferencia || new Date(); window.escalaPlantoesDataReferencia=new Date(r.getFullYear(),r.getMonth()+Number(delta||0),1); window.carregarEscalaPlantoes(); };
  window.irParaHojeEscalaPlantoes=function(){ window.escalaPlantoesDataReferencia=new Date(); window.carregarEscalaPlantoes(); };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ if(document.getElementById('escalaCalendarioGrid')) window.renderizarEscalaPlantoes(); }, 400); });
})();
