(function(){
  'use strict';
  var ESCALA_STATE = { data:'', id:'', eventos: [] };
  function byId(id){ return document.getElementById(id); }
  function esc(v){
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function msg(id, texto, tipo){ if (typeof window.setMsg === 'function') window.setMsg(id, texto, tipo || ''); else { var el=byId(id); if(el) el.textContent=texto||''; } }
  function hojeIso(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function br(dataIso){ var p=String(dataIso||'').slice(0,10).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : dataIso; }
  function hora(v){ return String(v||'').slice(0,5); }
  function lojaIdAtual(){
    try { if (typeof window.obterLojaIdSessao === 'function') { var a=window.obterLojaIdSessao(); if(a) return String(a); } } catch(e) {}
    try { if (window.usuarioSistemaLogado && window.usuarioSistemaLogado.loja_id) return String(window.usuarioSistemaLogado.loja_id); } catch(e) {}
    try { if (window.lojaAtualId) return String(window.lojaAtualId); } catch(e) {}
    try { var s=JSON.parse(localStorage.getItem('zuqui_usuario_logado')||'null'); if(s && s.loja_id) return String(s.loja_id); } catch(e) {}
    return '';
  }
  function empresaIdAtual(){
    try { if (typeof window.obterEmpresaIdSessao === 'function') { var a=window.obterEmpresaIdSessao(); if(a) return String(a); } } catch(e) {}
    try { if (window.usuarioSistemaLogado && window.usuarioSistemaLogado.empresa_id) return String(window.usuarioSistemaLogado.empresa_id); } catch(e) {}
    return '';
  }
  function tabelaAgenda(){ return window.AGENDA_TABLE || 'agenda'; }
  function garantirModalEscala(){
    var modal=byId('modalEscalaPlantao');
    if(modal){
      var tituloExistente = modal.querySelector('.escala-modal-title');
      if(tituloExistente){ tituloExistente.id = 'escalaModalTitulo'; tituloExistente.textContent = 'Cadastro de Agenda'; }
      var labelFuncionario = byId('escalaPlantaoFuncionario')?.closest('label');
      if(labelFuncionario && labelFuncionario.childNodes.length){ labelFuncionario.childNodes[0].textContent = 'Responsável'; }
      var btnSalvarExistente = byId('btnSalvarPlantaoEscala');
      if(btnSalvarExistente) btnSalvarExistente.textContent = 'Salvar agenda';
      if(!byId('escalaPlantaoValor')){
        var titulo=byId('escalaPlantaoTitulo');
        if(titulo && titulo.parentElement){ var lab=document.createElement('label'); lab.id='escalaPlantaoValorWrap'; lab.setAttribute('data-permissao-valor-escala',''); lab.innerHTML='Valor combinado do dia<input id="escalaPlantaoValor" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ex: 120,00">'; titulo.parentElement.insertAdjacentElement('afterend', lab); }
      }
      return modal;
    }
    var wrap=document.createElement('div');
    wrap.innerHTML = '<div class="escala-modal-overlay" id="modalEscalaPlantao" aria-hidden="true">'+
      '<div class="escala-modal-card">'+
      '<div class="escala-modal-title" id="escalaModalTitulo">Cadastro de Agenda</div>'+
      '<input id="escalaPlantaoEventoId" type="hidden">'+
      '<div class="escala-modal-sub" id="escalaModalDataTexto">Selecione o dia no calendário.</div>'+
      '<div class="escala-modal-grid">'+
      '<label class="escala-modal-full">Responsável<select id="escalaPlantaoFuncionario"></select></label>'+
      '<label>Início<input id="escalaPlantaoInicio" type="time"></label>'+
      '<label>Fim<input id="escalaPlantaoFim" type="time"></label>'+
      '<label>Tipo<select id="escalaPlantaoTipo"><option value="plantao">Plantão</option><option value="folga">Folga</option><option value="reuniao">Reunião</option><option value="compromisso">Compromisso</option></select></label>'+
      '<label>Título<input id="escalaPlantaoTitulo" type="text" placeholder="Ex: Plantão manhã"></label>'+
      '<label id="escalaPlantaoValorWrap" data-permissao-valor-escala>Valor combinado do dia<input id="escalaPlantaoValor" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Ex: 120,00"></label>'+
      '<label class="escala-modal-full">Observação<textarea id="escalaPlantaoObservacao" placeholder="Opcional"></textarea></label>'+
      '</div><div class="escala-modal-lista" id="escalaPlantaoListaDia"></div><div class="msg" id="msgModalEscalaPlantao" style="margin-top:10px"></div>'+
      '<div class="escala-modal-actions"><button class="btn btn-ghost" type="button" data-escala-cancelar>Cancelar</button><button class="btn btn-ghost" id="btnExcluirPlantaoEscala" type="button" data-escala-excluir style="display:none;color:#fca5a5;border-color:rgba(239,68,68,.45)">Excluir</button><button class="btn btn-green" id="btnSalvarPlantaoEscala" type="button" data-escala-salvar>Salvar agenda</button></div>'+
      '</div></div>';
    document.body.appendChild(wrap.firstChild);
    return byId('modalEscalaPlantao');
  }
  async function resolverLojaAtivaBlindadaEscala(){
    // Prioridade máxima: a loja visível no topo da tela. Isso evita cache/login antigo trazer filial errada.
    var nomeTopo = String(byId('topbar-store-name')?.textContent || '').trim();
    var empresa = empresaIdAtual();
    async function run(q){
      if (typeof window.executarSemFiltroLojaTemporario === 'function') return await window.executarSemFiltroLojaTemporario(function(){ return q; });
      return await q;
    }
    if(nomeTopo && nomeTopo !== '-'){
      try{
        var q1 = window.sb.from('lojas').select('id,nome,ativo,empresa_id').eq('ativo',true).ilike('nome',nomeTopo).limit(1).maybeSingle();
        var r1 = await run(q1);
        if(!r1.error && r1.data && r1.data.id) return r1.data;
      }catch(_e){}
      try{
        var q2 = window.sb.from('lojas').select('id,nome,ativo,empresa_id').eq('ativo',true).ilike('nome','%'+nomeTopo+'%').limit(1).maybeSingle();
        var r2 = await run(q2);
        if(!r2.error && r2.data && r2.data.id) return r2.data;
      }catch(_e){}
    }
    var loja = lojaIdAtual();
    if(loja){
      try{
        var q3 = window.sb.from('lojas').select('id,nome,ativo,empresa_id').eq('id',loja).eq('ativo',true).limit(1).maybeSingle();
        var r3 = await run(q3);
        if(!r3.error && r3.data && r3.data.id) return r3.data;
      }catch(_e){}
      return { id: loja, empresa_id: empresa || null, ativo: true };
    }
    return null;
  }
  async function carregarFuncionariosSelect(){
    garantirModalEscala();
    var select=byId('escalaPlantaoFuncionario');
    if(!select) return;
    select.innerHTML='<option value="">Carregando...</option>';
    if(!window.sb || !window.sb.from){ select.innerHTML='<option value="">Supabase não iniciado</option>'; return; }
    try{
      var lojaObj = await resolverLojaAtivaBlindadaEscala();
      var loja = String(lojaObj && lojaObj.id || '').trim();
      if(!loja){
        select.innerHTML='<option value="">Loja logada não identificada</option>';
        msg('msgModalEscalaPlantao','Loja logada não identificada. Reabra o sistema antes de lançar escala.','err');
        return;
      }
      var funcionariosPorId = {};
      var q=window.sb.from('funcionarios').select('id,nome,loja_id,empresa_id,ativo').eq('ativo',true).eq('loja_id',loja).order('nome',{ascending:true});
      var r;
      if (typeof window.executarSemFiltroLojaTemporario === 'function') r = await window.executarSemFiltroLojaTemporario(function(){ return q; });
      else r = await q;
      if(r.error) throw r.error;
      (r.data||[]).forEach(function(f){ if(String(f.loja_id||'')===loja && f.ativo===true) funcionariosPorId[String(f.id)] = f; });
      try {
        var qv=window.sb.from('funcionario_lojas').select('funcionario_id,loja_id,ativo').eq('loja_id',loja).eq('ativo',true);
        var rv=typeof window.executarSemFiltrosTenantTemporario === 'function' ? await window.executarSemFiltrosTenantTemporario(function(){ return qv; }) : await qv;
        var ids=[...new Set((rv.data||[]).map(function(v){return String(v.funcionario_id||'').trim();}).filter(Boolean))];
        if(!rv.error && ids.length){
          var qf=window.sb.from('funcionarios').select('id,nome,loja_id,empresa_id,ativo').in('id',ids).eq('ativo',true).order('nome',{ascending:true});
          var rf=typeof window.executarSemFiltrosTenantTemporario === 'function' ? await window.executarSemFiltrosTenantTemporario(function(){ return qf; }) : await qf;
          if(!rf.error) (rf.data||[]).forEach(function(f){ if(f.ativo===true) funcionariosPorId[String(f.id)] = f; });
        }
      } catch(eVinculos) {
        console.warn('Nao foi possivel considerar vinculos multi-loja na agenda:', eVinculos);
      }
      var lista=Object.values(funcionariosPorId).sort(function(a,b){ return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'); });
      select.innerHTML='<option value="">Agenda da loja (sem responsável)</option>'+lista.map(function(f){return '<option value="'+esc(f.id)+'">'+esc(f.nome||'Funcionário')+'</option>';}).join('');
    }catch(e){
      console.warn('Erro funcionários escala:',e);
      select.innerHTML='<option value="">Agenda da loja (sem responsável)</option>';
      msg('msgModalEscalaPlantao','Não foi possível carregar responsáveis, mas a agenda pode ser salva pela loja.','ok');
    }
  }
  function eventosAtuais(){ return window.escalaPlantoesEventos || ESCALA_STATE.eventos || []; }
  function itensDoDia(dataIso){ return (eventosAtuais()||[]).filter(function(ev){ return String(ev.data_plantao||'').slice(0,10)===dataIso; }); }
  function renderItensDia(){
    var lista=byId('escalaPlantaoListaDia'); if(!lista) return;
    var itens=itensDoDia(ESCALA_STATE.data);
    if(!itens.length){ lista.innerHTML='<div class="escala-modal-empty">Nenhum compromisso lançado nesse dia.</div>'; return; }
    lista.innerHTML=itens.map(function(item){
      var nome=item.funcionario_nome || item.funcionarios?.nome || item.titulo || 'Funcionário';
      var texto=hora(item.inicio_hora)+' → '+hora(item.fim_hora)+' · '+nome;
      return '<button class="escala-modal-item" type="button" data-escala-editar="'+esc(item.id)+'"><strong>'+esc(texto)+'</strong><span>'+esc(item.tipo||'plantao')+'</span></button>';
    }).join('');
  }
  async function carregarEventosMesSeguro(){
    if(!window.sb || !window.sb.from) return;
    try{
      var ref=window.escalaPlantoesDataReferencia instanceof Date ? window.escalaPlantoesDataReferencia : new Date();
      var inicio=ref.getFullYear()+'-'+String(ref.getMonth()+1).padStart(2,'0')+'-01';
      var fim=new Date(ref.getFullYear(),ref.getMonth()+1,0); fim=fim.getFullYear()+'-'+String(fim.getMonth()+1).padStart(2,'0')+'-'+String(fim.getDate()).padStart(2,'0');
      var q=window.sb.from(tabelaAgenda()).select('id,loja_id,empresa_id,funcionario_id,data_plantao,inicio_hora,fim_hora,tipo,titulo,observacao,valor_combinado,deleted_at,deleted_by_nome,deleted_by_funcionario_id').gte('data_plantao',inicio).lte('data_plantao',fim).is('deleted_at', null).order('data_plantao',{ascending:true}).order('inicio_hora',{ascending:true});
      var lojaObj = await resolverLojaAtivaBlindadaEscala();
      var loja = String(lojaObj && lojaObj.id || lojaIdAtual() || '').trim();
      if(loja) q=q.eq('loja_id',loja);
      var r=await q; if(r.error) throw r.error;
      var dados=r.data||[];
      var ids=[...new Set(dados.map(function(x){return x.funcionario_id;}).filter(Boolean))];
      var nomes={};
      if(ids.length){ try{ var rf=await window.sb.from('funcionarios').select('id,nome').in('id',ids); if(!rf.error)(rf.data||[]).forEach(function(f){nomes[String(f.id)]=f.nome||'';}); }catch(_e){} }
      dados.forEach(function(ev){ ev.funcionario_nome=nomes[String(ev.funcionario_id)] || ev.titulo || 'Funcionário'; });
      window.escalaPlantoesEventos=dados; ESCALA_STATE.eventos=dados;
      msg('msgEscalaPlantoes','','');
      if(typeof window.renderizarEscalaPlantoes==='function') window.renderizarEscalaPlantoes();
      if(typeof window.renderizarRelatorioEscalaPlantoes==='function') window.renderizarRelatorioEscalaPlantoes();
    }catch(e){
      console.warn('Erro ao carregar escala:',e);
      msg('msgEscalaPlantoes','Não foi possível carregar escala_plantoes. Confira SQL, loja_id e permissões.','err');
    }
  }
  window.abrirModalCadastroPlantaoEscala = async function(dataIso){
    garantirModalEscala();
    if (typeof aplicarPermissaoValorCombinadoEscala === 'function') aplicarPermissaoValorCombinadoEscala();
    ESCALA_STATE.data = String(dataIso||'').slice(0,10) || hojeIso();
    ESCALA_STATE.id = '';
    var ids=['escalaPlantaoEventoId','escalaPlantaoInicio','escalaPlantaoFim','escalaPlantaoTitulo','escalaPlantaoValor','escalaPlantaoObservacao'];
    ids.forEach(function(id){ var el=byId(id); if(el) el.value=''; });
    var tipo=byId('escalaPlantaoTipo'); if(tipo) tipo.value='plantao';
    var dt=byId('escalaModalDataTexto'); if(dt) dt.textContent='Data selecionada: '+br(ESCALA_STATE.data);
    var title=byId('escalaModalTitulo'); if(title) title.textContent='Cadastro de Agenda';
    var bx=byId('btnExcluirPlantaoEscala'); if(bx) bx.style.display='none';
    var bs=byId('btnSalvarPlantaoEscala'); if(bs) bs.textContent='Salvar agenda';
    msg('msgModalEscalaPlantao','','');
    await carregarFuncionariosSelect();
    renderItensDia();
    var modal=byId('modalEscalaPlantao'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  };
  window.fecharModalCadastroPlantaoEscala = function(){ var m=byId('modalEscalaPlantao'); if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true');} };
  window.abrirModalEditarPlantaoEscala = async function(id){
    garantirModalEscala();
    if (typeof aplicarPermissaoValorCombinadoEscala === 'function') aplicarPermissaoValorCombinadoEscala();
    var item=(eventosAtuais()||[]).find(function(ev){return String(ev.id)===String(id);});
    if(!item){ msg('msgModalEscalaPlantao','Item da escala não encontrado.','err'); return; }
    ESCALA_STATE.data=String(item.data_plantao||'').slice(0,10); ESCALA_STATE.id=String(item.id||'');
    await carregarFuncionariosSelect();
    var map={escalaPlantaoEventoId:item.id||'', escalaPlantaoFuncionario:item.funcionario_id||'', escalaPlantaoInicio:hora(item.inicio_hora), escalaPlantaoFim:hora(item.fim_hora), escalaPlantaoTipo:item.tipo||'plantao', escalaPlantaoTitulo:item.titulo||'', escalaPlantaoValor:(item.valor_combinado ?? ''), escalaPlantaoObservacao:item.observacao||''};
    Object.keys(map).forEach(function(k){ var el=byId(k); if(el) el.value=map[k]; });
    var dt=byId('escalaModalDataTexto'); if(dt) dt.textContent='Editando: '+br(ESCALA_STATE.data);
    var title=byId('escalaModalTitulo'); if(title) title.textContent='Editar Agenda';
    var bx=byId('btnExcluirPlantaoEscala'); if(bx) bx.style.display='inline-flex';
    var bs=byId('btnSalvarPlantaoEscala'); if(bs) bs.textContent='Salvar alteração';
    renderItensDia();
    var modal=byId('modalEscalaPlantao'); modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  };
  window.salvarPlantaoEscala = async function(){
    garantirModalEscala();
    if(!window.sb || !window.sb.from){ msg('msgModalEscalaPlantao','Supabase não iniciado. Faça login novamente.','err'); return; }
    var funcionario=String(byId('escalaPlantaoFuncionario')?.value||'').trim();
    var inicio=String(byId('escalaPlantaoInicio')?.value||'').trim();
    var fim=String(byId('escalaPlantaoFim')?.value||'').trim();
    var tipo=String(byId('escalaPlantaoTipo')?.value||'plantao').trim();
    var titulo=String(byId('escalaPlantaoTitulo')?.value||'').trim();
    var obs=String(byId('escalaPlantaoObservacao')?.value||'').trim();
    var podeVerValor = (typeof usuarioPodeVerValorCombinadoEscala === 'function') ? usuarioPodeVerValorCombinadoEscala() : true;
    var valorRaw=podeVerValor ? String(byId('escalaPlantaoValor')?.value||'').replace(',','.').trim() : '';
    var valorCombinado=valorRaw ? Number(valorRaw) : null;
    if(valorRaw && (!Number.isFinite(valorCombinado) || valorCombinado < 0)){ msg('msgModalEscalaPlantao','Informe um valor combinado válido.','err'); return; }
    if(!ESCALA_STATE.data){ msg('msgModalEscalaPlantao','Selecione um dia no calendário.','err'); return; }
    if(!inicio || !fim){ msg('msgModalEscalaPlantao','Informe início e fim.','err'); return; }
    if(inicio>=fim){ msg('msgModalEscalaPlantao','O horário final precisa ser maior que o inicial.','err'); return; }
    var lojaObj = await resolverLojaAtivaBlindadaEscala();
    var loja = String(lojaObj && lojaObj.id || lojaIdAtual() || '').trim();
    if(!loja){ msg('msgModalEscalaPlantao','Não consegui identificar a loja para salvar esta agenda. Reabra o sistema e tente novamente.','err'); return; }
    var payload={ loja_id:loja, funcionario_id:funcionario || null, data_plantao:ESCALA_STATE.data, inicio_hora:inicio, fim_hora:fim, tipo:tipo, titulo:titulo || (tipo==='plantao'?'Plantão':tipo==='folga'?'Folga':tipo==='reuniao'?'Reunião':'Compromisso'), observacao:obs||null, valor_combinado:valorCombinado };
    var emp=String(lojaObj && lojaObj.empresa_id || empresaIdAtual() || '').trim(); if(emp) payload.empresa_id=emp;
    try{
      var r;
      if(ESCALA_STATE.id || byId('escalaPlantaoEventoId')?.value){
        var id=ESCALA_STATE.id || byId('escalaPlantaoEventoId').value;
        r=await window.sb.from(tabelaAgenda()).update(payload).eq('id',id).eq('loja_id',loja);
      } else {
        r=await window.sb.from(tabelaAgenda()).insert([payload]);
      }
      if(r.error) throw r.error;
      window.fecharModalCadastroPlantaoEscala();
      msg('msgEscalaPlantoes','Escala salva com sucesso.','ok');
      await carregarEventosMesSeguro();
    }catch(e){
      console.warn('Erro salvar escala:',e);
      msg('msgModalEscalaPlantao','Não foi possível salvar. Confira SQL da tabela escala_plantoes e permissões.','err');
    }
  };
  window.excluirPlantaoEscala = async function(){
    var id=ESCALA_STATE.id || String(byId('escalaPlantaoEventoId')?.value||'').trim();
    if(!id){ msg('msgModalEscalaPlantao','Nenhum item selecionado para excluir.','err'); return; }

    var resp = null;
    if (typeof window.abrirModalPin === 'function') {
      resp = await window.abrirModalPin({
        titulo:'Excluir escala',
        subtitulo:'Informe o PIN de um usuário autorizado.',
        textoUsuario:'Apenas perfis com permissão para excluir itens da Agenda podem confirmar.',
        textoAcao:'Excluir',
        placeholderInput:'PIN'
      });
    } else {
      resp = { pin: window.prompt('Digite o PIN/senha para excluir:') };
    }
    if(!resp || !resp.pin){ msg('msgModalEscalaPlantao','Exclusão cancelada.','err'); return; }

    var loja=lojaIdAtual();
    var autorizacaoExclusao = { funcionario:null, motivo:'pin_invalido' };
    try {
      if (typeof window.validarPinExclusaoAgenda === 'function') {
        autorizacaoExclusao = await window.validarPinExclusaoAgenda(resp.pin, loja);
      }
    } catch(_e) {}
    var usuarioExclusao = autorizacaoExclusao.funcionario;
    if(!usuarioExclusao || !usuarioExclusao.id){
      var textoNegado = autorizacaoExclusao.motivo === 'sem_permissao'
        ? 'PIN reconhecido, mas este perfil não permite excluir itens da Agenda.'
        : 'PIN inválido ou usuário sem vínculo ativo com esta loja.';
      msg('msgModalEscalaPlantao',textoNegado+' A escala não foi excluída.','err');
      return;
    }

    var nomeExclusao=usuarioExclusao.nome || usuarioExclusao.nome_completo || 'Funcionário';

    async function tentarUpdate(payload){
      var q=window.sb.from(tabelaAgenda()).update(payload).eq('id',id);
      if(loja) q=q.eq('loja_id',loja);
      return await q;
    }

    try{
      // 1ª tentativa: exclusão lógica completa, sem updated_at para não quebrar em bancos antigos.
      var r = await tentarUpdate({
        deleted_at:new Date().toISOString(),
        deleted_by_funcionario_id:usuarioExclusao.id,
        deleted_by_nome:nomeExclusao
      });

      // Se o PostgREST ainda estiver com cache antigo ou alguma coluna estiver diferente,
      // tenta uma versão menor mantendo pelo menos data e nome do responsável.
      if(r.error){
        console.warn('Falha exclusão completa da escala, tentando fallback com nome:', r.error);
        r = await tentarUpdate({
          deleted_at:new Date().toISOString(),
          deleted_by_nome:nomeExclusao
        });
      }

      // Último fallback: se as colunas de exclusão ainda não estiverem disponíveis no cache,
      // faz delete físico para não travar a operação. O relatório de excluídos depende das colunas acima.
      if(r.error){
        console.warn('Falha exclusão lógica da escala, tentando delete físico:', r.error);
        var qDel=window.sb.from(tabelaAgenda()).delete().eq('id',id);
        if(loja) qDel=qDel.eq('loja_id',loja);
        r = await qDel;
      }

      if(r.error) throw r.error;

      window.fecharModalCadastroPlantaoEscala();
      msg('msgEscalaPlantoes','Item excluído da escala por '+nomeExclusao+'.','ok');
      await carregarEventosMesSeguro();
    }catch(e){
      console.warn('Erro excluir escala:', e);
      msg('msgModalEscalaPlantao','Não foi possível excluir: '+(e.message || 'erro desconhecido')+'.','err');
    }
  };
  function moedaBR(v){ var n=Number(v||0); return n ? n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '-'; }
  function dataBR(v){ return br(String(v||'').slice(0,10)); }
  function diaSemanaBR(v){
    var d=String(v||'').slice(0,10);
    if(!d) return '-';
    var parts=d.split('-');
    if(parts.length!==3) return '-';
    var dt=new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
    var nomes=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    return nomes[dt.getDay()] || '-';
  }
  function tipoLabel(v){ v=String(v||'plantao'); return v==='folga'?'Folga':v==='reuniao'?'Reunião':v==='compromisso'?'Compromisso':'Plantão'; }
  function faixaRelatorioEscalaExportacao(){
    var iniEl=byId('escalaRelatorioDataInicio');
    var fimEl=byId('escalaRelatorioDataFim');
    var ini=String(iniEl && iniEl.value || '').slice(0,10);
    var fim=String(fimEl && fimEl.value || '').slice(0,10);
    if(!ini || !fim){
      var ref=window.escalaPlantoesDataReferencia instanceof Date ? window.escalaPlantoesDataReferencia : new Date();
      var primeiro=new Date(ref.getFullYear(), ref.getMonth(), 1);
      var ultimo=new Date(ref.getFullYear(), ref.getMonth()+1, 0);
      var fmt=function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
      if(!ini) ini=fmt(primeiro);
      if(!fim) fim=fmt(ultimo);
      if(iniEl && !iniEl.value) iniEl.value=ini;
      if(fimEl && !fimEl.value) fimEl.value=fim;
    }
    if(ini > fim){ var t=ini; ini=fim; fim=t; }
    return {inicio:ini, fim:fim};
  }
  async function buscarEventosRelatorioEscalaExportacao(){
    var faixa=faixaRelatorioEscalaExportacao();
    if(!window.sb || !window.sb.from){
      return (eventosAtuais()||[]).slice().filter(function(it){ var d=String(it.data_plantao||'').slice(0,10); return d>=faixa.inicio && d<=faixa.fim; });
    }
    try{
      var q=window.sb.from(tabelaAgenda())
        .select('id,loja_id,empresa_id,funcionario_id,data_plantao,inicio_hora,fim_hora,tipo,titulo,observacao,valor_combinado,deleted_at,deleted_by_nome,deleted_by_funcionario_id,created_at,updated_at')
        .gte('data_plantao',faixa.inicio)
        .lte('data_plantao',faixa.fim)
        .order('data_plantao',{ascending:true})
        .order('inicio_hora',{ascending:true});
      var loja=lojaIdAtual();
      if(loja) q=q.eq('loja_id',loja);
      var r=await q;
      if(r.error) throw r.error;
      var dados=r.data||[];
      var ids=[...new Set(dados.map(function(x){return x.funcionario_id;}).filter(Boolean))];
      var nomes={};
      if(ids.length){
        try{
          var rf=await window.sb.from('funcionarios').select('id,nome').in('id',ids);
          if(!rf.error)(rf.data||[]).forEach(function(f){nomes[String(f.id)]=f.nome||'';});
        }catch(_e){}
      }
      dados.forEach(function(ev){ ev.funcionario_nome=nomes[String(ev.funcionario_id)] || ev.titulo || 'Funcionário'; });
      return dados;
    }catch(e){
      console.warn('Erro ao buscar relatório de escala por período:', e);
      msg('msgEscalaPlantoes','Não foi possível buscar o relatório no período: '+(e.message||'erro desconhecido')+'.','err');
      return [];
    }
  }
  function statusEscalaRelatorio(it){
    return it && it.deleted_at ? ('Excluído'+(it.deleted_by_nome ? ' por '+it.deleted_by_nome : '')) : 'Ativo';
  }
  function excluidoPorEscalaRelatorio(it){ return it && it.deleted_at ? (it.deleted_by_nome || '-') : '-'; }
  window.renderizarRelatorioEscalaPlantoes = function(){
    var lista=byId('listaRelatorioEscalaPlantoes'); var resumo=byId('escalaRelatorioResumo');
    if(!lista) return;
    var podeVerValor = (typeof usuarioPodeVerValorCombinadoEscala === 'function') ? usuarioPodeVerValorCombinadoEscala() : true;
    if (typeof aplicarPermissaoValorCombinadoEscala === 'function') aplicarPermissaoValorCombinadoEscala();
    var eventos=(eventosAtuais()||[]).slice().sort(function(a,b){ return String(a.data_plantao||'').localeCompare(String(b.data_plantao||'')) || String(a.inicio_hora||'').localeCompare(String(b.inicio_hora||'')); });
    var total=eventos.reduce(function(acc,it){ return acc + Number(it.valor_combinado||0); },0);
    if(resumo) resumo.textContent = eventos.length ? (eventos.length+' lançamento(s) no mês'+(podeVerValor ? ' · Total combinado: '+moedaBR(total) : '')) : 'Sem lançamentos no período.';
    if(!eventos.length){ lista.innerHTML='<div class="empty">Sem lançamentos.</div>'; return; }
    lista.innerHTML=eventos.map(function(it){
      var nome=it.funcionario_nome || it.funcionarios?.nome || it.titulo || 'Funcionário';
      var tipo=String(it.tipo||'plantao');
      return '<div class="escala-relatorio-item">'+
        '<div><strong>'+esc(dataBR(it.data_plantao))+'</strong></div>'+
        '<div><strong>'+esc(nome)+'</strong><div class="item-detalhe">'+esc(it.titulo||'')+'</div></div>'+
        '<div class="tipo '+esc(tipo)+'">'+esc(tipoLabel(tipo))+'</div>'+
        '<div>'+esc(hora(it.inicio_hora))+' → '+esc(hora(it.fim_hora))+'</div>'+
        (podeVerValor ? '<div class="escala-relatorio-valor" data-permissao-valor-escala>'+esc(moedaBR(it.valor_combinado))+'</div>' : '')+
      '</div>';
    }).join('');
  };
  window.exportarRelatorioEscalaExcel = async function(){
    var eventos=await buscarEventosRelatorioEscalaExportacao();
    if(!eventos.length){ msg('msgEscalaPlantoes','Não há dados para exportar no período selecionado.','err'); return; }
    var podeVerValor = (typeof usuarioPodeVerValorCombinadoEscala === 'function') ? usuarioPodeVerValorCombinadoEscala() : true;
    var linhas=[podeVerValor ? ['Data','Dia da semana','Funcionário','Tipo','Início','Fim','Título','Valor combinado','Status','Excluído por','Observação'] : ['Data','Dia da semana','Funcionário','Tipo','Início','Fim','Título','Status','Excluído por','Observação']];
    eventos.forEach(function(it){
      var row=[dataBR(it.data_plantao), diaSemanaBR(it.data_plantao), it.funcionario_nome||it.titulo||'Funcionário', tipoLabel(it.tipo), hora(it.inicio_hora), hora(it.fim_hora), it.titulo||''];
      if(podeVerValor) row.push(Number(it.valor_combinado||0).toFixed(2).replace('.',','));
      row.push(statusEscalaRelatorio(it));
      row.push(excluidoPorEscalaRelatorio(it));
      row.push(it.observacao||'');
      linhas.push(row);
    });
    var csv='﻿'+linhas.map(function(row){return row.map(function(c){return '"'+String(c??'').replace(/"/g,'""')+'"';}).join(';');}).join('\n');
    var faixa=faixaRelatorioEscalaExportacao();
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download='relatorio-escala-'+faixa.inicio+'-a-'+faixa.fim+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  window.exportarRelatorioEscalaPDF = async function(){
    var eventos=await buscarEventosRelatorioEscalaExportacao();
    if(!eventos.length){ msg('msgEscalaPlantoes','Não há dados para exportar no período selecionado.','err'); return; }
    var podeVerValor = (typeof usuarioPodeVerValorCombinadoEscala === 'function') ? usuarioPodeVerValorCombinadoEscala() : true;
    var total=eventos.reduce(function(acc,it){return acc+Number(it.valor_combinado||0);},0);
    var faixa=faixaRelatorioEscalaExportacao();
    var linhas=eventos.map(function(it){
      var tipo=String(it.tipo||'plantao');
      var status=statusEscalaRelatorio(it);
      var statusStyle=it.deleted_at ? ' style="color:#b91c1c;font-weight:bold"' : '';
      return '<tr><td>'+esc(dataBR(it.data_plantao))+'</td><td>'+esc(diaSemanaBR(it.data_plantao))+'</td><td>'+esc(it.funcionario_nome||it.titulo||'Funcionário')+'</td><td class="'+esc(tipo)+'">'+esc(tipoLabel(tipo))+'</td><td>'+esc(hora(it.inicio_hora))+' → '+esc(hora(it.fim_hora))+'</td>'+(podeVerValor ? '<td>'+esc(moedaBR(it.valor_combinado))+'</td>' : '')+'<td'+statusStyle+'>'+esc(status)+'</td><td>'+esc(excluidoPorEscalaRelatorio(it))+'</td><td>'+esc(it.observacao||'')+'</td></tr>';
    }).join('');
    var w=window.open('','_blank'); if(!w){ msg('msgEscalaPlantoes','Pop-up bloqueado. Permita pop-ups para exportar PDF.','err'); return; }
    var geradoEm=new Date().toLocaleString('pt-BR'), filtrosRodape='Período: '+dataBR(faixa.inicio)+' até '+dataBR(faixa.fim);
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório de Escala</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{margin:0 0 6px}.meta{margin-bottom:16px;color:#555}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}th{background:#f2f2f2}.plantao,.folga{color:#dc2626}.folga{font-weight:bold}.reuniao{color:#7c3aed}.compromisso{color:#0284c7}.total{margin-top:14px;font-weight:bold}'+cssRodapeRelatorioImpressao()+'</style></head><body><h1>Relatório de Escalas</h1><div class="meta">Período: '+esc(dataBR(faixa.inicio))+' até '+esc(dataBR(faixa.fim))+(podeVerValor ? ' · Total combinado: '+esc(moedaBR(total)) : '')+' · Gerado em '+esc(geradoEm)+'</div><table><thead><tr><th>Data</th><th>Dia da semana</th><th>Funcionário</th><th>Tipo</th><th>Horário</th>'+(podeVerValor ? '<th>Valor</th>' : '')+'<th>Status</th><th>Excluído por</th><th>Observação</th></tr></thead><tbody>'+linhas+'</tbody></table>'+htmlRodapeRelatorioImpressao(geradoEm,filtrosRodape)+'</body></html>');
    w.document.close(); w.focus(); setTimeout(function(){w.print();},300);
  };
  var originalCarregar = window.carregarEscalaPlantoes;
  window.carregarEscalaPlantoes = async function(){
    if(typeof originalCarregar==='function'){ try{ await originalCarregar(); }catch(e){ console.warn('carregarEscalaPlantoes original falhou:',e); } }
    await carregarEventosMesSeguro();
    if(typeof window.renderizarRelatorioEscalaPlantoes==='function') window.renderizarRelatorioEscalaPlantoes();
  };
  document.addEventListener('click', function(ev){
    var cancel=ev.target.closest && ev.target.closest('[data-escala-cancelar]'); if(cancel){ ev.preventDefault(); window.fecharModalCadastroPlantaoEscala(); return; }
    var salvar=ev.target.closest && ev.target.closest('[data-escala-salvar]'); if(salvar){ ev.preventDefault(); window.salvarPlantaoEscala(); return; }
    var excluir=ev.target.closest && ev.target.closest('[data-escala-excluir]'); if(excluir){ ev.preventDefault(); window.excluirPlantaoEscala(); return; }
    var editar=ev.target.closest && ev.target.closest('[data-escala-editar]'); if(editar){ ev.preventDefault(); ev.stopPropagation(); window.abrirModalEditarPlantaoEscala(editar.getAttribute('data-escala-editar')); return; }
    var diaNumero=ev.target.closest && ev.target.closest('#escalaCalendarioGrid .escala-dia-numero');
    if(diaNumero){
      var diaCell=diaNumero.closest('#escalaCalendarioGrid .escala-dia');
      var dataFiltro=diaCell && diaCell.getAttribute('data-data');
      if(dataFiltro && typeof window.atualizarTotalPagoPlantaoEscala === 'function'){
        ev.preventDefault();
        ev.stopPropagation();
        window.atualizarTotalPagoPlantaoEscala(dataFiltro);
        return;
      }
    }
    var evBtn=ev.target.closest && ev.target.closest('#escalaCalendarioGrid .escala-evento');
    if(evBtn){
      ev.preventDefault();
      ev.stopPropagation();
      var diaEvento=evBtn.closest('#escalaCalendarioGrid .escala-dia');
      var dataEvento=diaEvento && diaEvento.getAttribute('data-data');
      if(dataEvento && typeof window.abrirModalCadastroPlantaoEscala === 'function') window.abrirModalCadastroPlantaoEscala(dataEvento);
      return;
    }
    var cell=ev.target.closest && ev.target.closest('#escalaCalendarioGrid .escala-dia');
    if(cell && !cell.classList.contains('escala-dia-vazio')){ var data=cell.getAttribute('data-data'); if(data){ ev.preventDefault(); ev.stopPropagation(); window.abrirModalCadastroPlantaoEscala(data); } }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ garantirModalEscala(); }, 300); });
})();
