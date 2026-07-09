(function(){
  'use strict';

  var state = { data: '', id: '' };

  function byId(id){ return document.getElementById(id); }
  function msg(id, texto, tipo){
    if (typeof window.setMsg === 'function') window.setMsg(id, texto, tipo || '');
    else { var el = byId(id); if (el) el.textContent = texto || ''; }
  }
  function esc(v){
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function lojaIdAtual(){
    try { if (typeof window.obterLojaIdSessao === 'function') { var a = window.obterLojaIdSessao(); if (a) return String(a); } } catch(_e) {}
    try { if (window.usuarioSistemaLogado && window.usuarioSistemaLogado.loja_id) return String(window.usuarioSistemaLogado.loja_id); } catch(_e) {}
    try { if (window.lojaAtualId) return String(window.lojaAtualId); } catch(_e) {}
    return '';
  }
  function empresaIdAtual(){
    try { if (typeof window.obterEmpresaIdSessao === 'function') { var a = window.obterEmpresaIdSessao(); if (a) return String(a); } } catch(_e) {}
    try { if (window.usuarioSistemaLogado && window.usuarioSistemaLogado.empresa_id) return String(window.usuarioSistemaLogado.empresa_id); } catch(_e) {}
    return '';
  }
  function tabelaAgenda(){ return window.AGENDA_TABLE || 'agenda'; }
  function hojeIso(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function hora(v){ return String(v || '').slice(0, 5); }
  function tituloPadrao(tipo){
    return tipo === 'plantao' ? 'Plantao' : tipo === 'folga' ? 'Folga' : tipo === 'reuniao' ? 'Reuniao' : 'Compromisso';
  }
  function eventosAtuais(){
    return Array.isArray(window.escalaPlantoesEventos) ? window.escalaPlantoesEventos : [];
  }
  function normalizarModalAgenda(){
    var modal = byId('modalEscalaPlantao');
    if (!modal) return;
    var titulo = modal.querySelector('.escala-modal-title');
    if (titulo) {
      titulo.id = 'escalaModalTitulo';
      if (!state.id) titulo.textContent = 'Cadastro de Agenda';
      else titulo.textContent = 'Editar Agenda';
    }
    var label = byId('escalaPlantaoFuncionario')?.closest('label');
    if (label && label.childNodes.length) label.childNodes[0].textContent = 'Responsável';
    var btn = byId('btnSalvarPlantaoEscala');
    if (btn) btn.textContent = state.id ? 'Salvar alteração' : 'Salvar agenda';
  }
  function dataAtualModal(){
    if (state.data) return state.data;
    var id = String(byId('escalaPlantaoEventoId')?.value || '').trim();
    if (id) {
      var item = eventosAtuais().find(function(ev){ return String(ev.id) === id; });
      if (item && item.data_plantao) return String(item.data_plantao).slice(0, 10);
    }
    return hojeIso();
  }
  async function executarAmplo(query){
    if (typeof window.executarSemFiltrosTenantTemporario === 'function') {
      return await window.executarSemFiltrosTenantTemporario(function(){ return query; });
    }
    if (typeof window.executarSemFiltroLojaTemporario === 'function') {
      return await window.executarSemFiltroLojaTemporario(function(){ return query; });
    }
    return await query;
  }
  async function carregarResponsaveisAgendaLoja(){
    var select = byId('escalaPlantaoFuncionario');
    if (!select || !window.sb || !window.sb.from) return;

    normalizarModalAgenda();
    var valorAtual = String(select.value || '').trim();
    var loja = lojaIdAtual();
    select.innerHTML = '<option value="">Agenda da loja (sem responsável)</option>';
    if (!loja) return;

    var mapa = {};
    try {
      var diretos = await executarAmplo(window.sb
        .from('funcionarios')
        .select('id,nome,loja_id,ativo')
        .eq('ativo', true)
        .eq('loja_id', loja)
        .order('nome', { ascending: true }));
      if (!diretos.error) {
        (diretos.data || []).forEach(function(f){
          if (String(f.loja_id || '') === loja && f.ativo === true) mapa[String(f.id)] = f;
        });
      }

      var vinculos = await executarAmplo(window.sb
        .from('funcionario_lojas')
        .select('funcionario_id,loja_id,ativo')
        .eq('loja_id', loja)
        .eq('ativo', true));
      var ids = [...new Set((vinculos.data || []).map(function(v){ return String(v.funcionario_id || '').trim(); }).filter(Boolean))];
      if (!vinculos.error && ids.length) {
        var vinculados = await executarAmplo(window.sb
          .from('funcionarios')
          .select('id,nome,loja_id,ativo')
          .in('id', ids)
          .eq('ativo', true)
          .order('nome', { ascending: true }));
        if (!vinculados.error) {
          (vinculados.data || []).forEach(function(f){ if (f.ativo === true) mapa[String(f.id)] = f; });
        }
      }
    } catch(e) {
      console.warn('Agenda por loja: falha ao carregar responsaveis opcionais:', e);
    }

    var lista = Object.values(mapa).sort(function(a,b){
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
    select.innerHTML = '<option value="">Agenda da loja (sem responsável)</option>' + lista.map(function(f){
      return '<option value="' + esc(f.id) + '">' + esc(f.nome || 'Funcionario') + '</option>';
    }).join('');
    if (valorAtual && Array.from(select.options).some(function(opt){ return opt.value === valorAtual; })) {
      select.value = valorAtual;
    }
  }

  async function recarregarEventosMes(){
    if (typeof window.carregarEscalaPlantoes === 'function') {
      await window.carregarEscalaPlantoes();
    } else if (typeof window.renderizarEscalaPlantoes === 'function') {
      window.renderizarEscalaPlantoes();
    }
    if (typeof window.renderizarRelatorioEscalaPlantoes === 'function') window.renderizarRelatorioEscalaPlantoes();
  }

  function podeSalvarAgenda(){
    try {
      if (typeof window.usuarioPodeGerenciarEscala === 'function') return window.usuarioPodeGerenciarEscala();
      if (typeof window.usuarioTemPermissao === 'function') return window.usuarioTemPermissao('cadastro_plantao');
    } catch(_e) {}
    return true;
  }

  function dataBr(dataIso){
    var p = String(dataIso || '').slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(dataIso || '');
  }

  function nomeResponsavelAgenda(item){
    var id = String(item && item.funcionario_id || '').trim();
    var select = byId('escalaPlantaoFuncionario');
    if (id && select) {
      var opt = Array.from(select.options || []).find(function(o){ return String(o.value || '') === id; });
      if (opt && opt.textContent) return String(opt.textContent).trim();
    }
    return String(
      item && (item.funcionario_nome || item.funcionarios?.nome || item.titulo) ||
      'Agenda da loja'
    ).trim();
  }

  function eventoAtualEditado(id){
    if (!id) return null;
    return eventosAtuais().find(function(ev){ return String(ev.id) === String(id); }) || null;
  }

  async function buscarAgendasMesmoHorario(payload, idAtual, loja){
    var encontrados = [];
    try {
      var q = window.sb.from(tabelaAgenda())
        .select('id,loja_id,funcionario_id,data_plantao,inicio_hora,fim_hora,tipo,titulo,observacao,deleted_at')
        .eq('loja_id', loja)
        .eq('data_plantao', payload.data_plantao)
        .eq('inicio_hora', payload.inicio_hora)
        .eq('fim_hora', payload.fim_hora)
        .is('deleted_at', null);
      var r = await q;
      if (!r.error) encontrados = r.data || [];
    } catch(e) {
      console.warn('Agenda: nao foi possivel consultar conflitos de horario:', e);
    }

    var atual = eventoAtualEditado(idAtual);
    var mudouResponsavel = atual && String(atual.funcionario_id || '') !== String(payload.funcionario_id || '');
    var porId = {};
    encontrados.forEach(function(item){ if (item && item.id) porId[String(item.id)] = item; });
    if (mudouResponsavel && atual && atual.id) porId[String(atual.id)] = atual;

    return Object.values(porId).filter(function(item){
      if (!item) return false;
      var mesmoRegistro = idAtual && String(item.id) === String(idAtual);
      if (mesmoRegistro && !mudouResponsavel) return false;
      return true;
    });
  }

  async function confirmarMesmoHorario(itens, payload){
    if (!itens.length) return { salvar: true, inserirNovo: false };
    var linhas = itens.map(function(item){
      return '<div class="nc-confirm-line">'+
        '<span>' + esc(hora(item.inicio_hora) + ' → ' + hora(item.fim_hora) + ' · ' + nomeResponsavelAgenda(item)) + '</span>'+
        '<strong>' + esc(item.titulo || tituloPadrao(item.tipo || 'plantao')) + '<small>' + esc(item.tipo || 'plantao') + '</small></strong>'+
      '</div>';
    }).join('');
    var texto = 'Já existe uma agenda para esse mesmo dia e horário. Confira o que já está cadastrado:';
    if (typeof window.abrirConfirmacaoSistema === 'function') {
      var decisao = await window.abrirConfirmacaoSistema({
        title: 'Agenda no mesmo horário',
        subtitle: dataBr(payload.data_plantao) + ' · ' + hora(payload.inicio_hora) + ' → ' + hora(payload.fim_hora),
        body: '<div class="msg ok" style="margin-bottom:10px;">' + esc(texto) + '</div><div class="nc-confirm-lines">' + linhas + '</div>',
        cancelText: 'Cancelar e voltar',
        cancelClass: 'btn-ghost',
        confirmText: 'Salvar mesmo assim',
        confirmClass: 'btn-green'
      });
      return { salvar: !!decisao?.confirmado, inserirNovo: !!decisao?.confirmado };
    }
    var resumo = itens.map(function(item){
      return hora(item.inicio_hora) + ' - ' + hora(item.fim_hora) + ' - ' + nomeResponsavelAgenda(item);
    }).join('\n');
    return { salvar: window.confirm(texto + '\n\n' + resumo + '\n\nSalvar mesmo assim?'), inserirNovo: true };
  }

  async function salvarAgendaPorLoja(){
    if (!podeSalvarAgenda()) {
      msg('msgModalEscalaPlantao', 'Sem permissao para salvar itens da Agenda.', 'err');
      return;
    }
    if (!window.sb || !window.sb.from) {
      msg('msgModalEscalaPlantao', 'Supabase nao iniciado. Faca login novamente.', 'err');
      return;
    }

    var loja = lojaIdAtual();
    if (!loja) {
      msg('msgModalEscalaPlantao', 'Nao consegui identificar a loja para salvar esta agenda.', 'err');
      return;
    }

    var data = dataAtualModal();
    var funcionario = String(byId('escalaPlantaoFuncionario')?.value || '').trim();
    var inicio = String(byId('escalaPlantaoInicio')?.value || '').trim();
    var fim = String(byId('escalaPlantaoFim')?.value || '').trim();
    var tipo = String(byId('escalaPlantaoTipo')?.value || 'plantao').trim();
    var titulo = String(byId('escalaPlantaoTitulo')?.value || '').trim();
    var obs = String(byId('escalaPlantaoObservacao')?.value || '').trim();
    var podeVerValor = typeof window.usuarioPodeVerValorCombinadoEscala === 'function' ? window.usuarioPodeVerValorCombinadoEscala() : true;
    var valorRaw = podeVerValor ? String(byId('escalaPlantaoValor')?.value || '').replace(',','.').trim() : '';
    var valor = valorRaw ? Number(valorRaw) : null;

    if (!data) { msg('msgModalEscalaPlantao', 'Selecione um dia no calendario.', 'err'); return; }
    if (!inicio || !fim) { msg('msgModalEscalaPlantao', 'Informe inicio e fim.', 'err'); return; }
    if (inicio >= fim) { msg('msgModalEscalaPlantao', 'O horario final precisa ser maior que o inicial.', 'err'); return; }
    if (valorRaw && (!Number.isFinite(valor) || valor < 0)) { msg('msgModalEscalaPlantao', 'Informe um valor combinado valido.', 'err'); return; }

    var payload = {
      loja_id: loja,
      funcionario_id: funcionario || null,
      data_plantao: data,
      inicio_hora: inicio,
      fim_hora: fim,
      tipo: tipo,
      titulo: titulo || tituloPadrao(tipo),
      observacao: obs || null,
      valor_combinado: valor
    };
    var empresa = empresaIdAtual();
    if (empresa) payload.empresa_id = empresa;

    try {
      var id = state.id || String(byId('escalaPlantaoEventoId')?.value || '').trim();
      var conflitos = await buscarAgendasMesmoHorario(payload, id, loja);
      var decisaoConflito = await confirmarMesmoHorario(conflitos, payload);
      if (!decisaoConflito.salvar) {
        msg('msgModalEscalaPlantao', 'A agenda não foi salva. Ajuste as informações e tente novamente.', 'err');
        return;
      }
      var deveInserirNovo = !id || decisaoConflito.inserirNovo;
      var resp = !deveInserirNovo
        ? await window.sb.from(tabelaAgenda()).update(payload).eq('id', id).eq('loja_id', loja)
        : await window.sb.from(tabelaAgenda()).insert([payload]);
      if (resp.error) throw resp.error;
      if (typeof window.fecharModalCadastroPlantaoEscala === 'function') window.fecharModalCadastroPlantaoEscala();
      msg('msgEscalaPlantoes', 'Agenda salva com sucesso.', 'ok');
      await recarregarEventosMes();
    } catch(e) {
      console.warn('Agenda por loja: erro ao salvar:', e);
      var texto = String(e.message || e.details || '').toLowerCase();
      var complemento = texto.includes('funcionario_id') ? ' Rode a migracao para permitir agenda sem funcionario obrigatorio.' : '';
      msg('msgModalEscalaPlantao', 'Nao foi possivel salvar a agenda por loja.' + complemento, 'err');
    }
  }

  function instalar(){
    if (window.__agendaPorLojaPatchInstalado) return;
    if (typeof window.abrirModalCadastroPlantaoEscala !== 'function' || typeof window.abrirModalEditarPlantaoEscala !== 'function') return;
    window.__agendaPorLojaPatchInstalado = true;

    var abrirNovo = window.abrirModalCadastroPlantaoEscala;
    window.abrirModalCadastroPlantaoEscala = async function(dataIso){
      state.data = String(dataIso || '').slice(0, 10) || hojeIso();
      state.id = '';
      await abrirNovo.apply(this, arguments);
      normalizarModalAgenda();
      await carregarResponsaveisAgendaLoja();
    };

    var abrirEditar = window.abrirModalEditarPlantaoEscala;
    window.abrirModalEditarPlantaoEscala = async function(id){
      var item = eventosAtuais().find(function(ev){ return String(ev.id) === String(id); });
      state.data = String(item?.data_plantao || '').slice(0, 10);
      state.id = String(id || '');
      await abrirEditar.apply(this, arguments);
      normalizarModalAgenda();
      await carregarResponsaveisAgendaLoja();
      var select = byId('escalaPlantaoFuncionario');
      if (select && item?.funcionario_id) select.value = item.funcionario_id;
    };

    window.salvarPlantaoEscala = salvarAgendaPorLoja;

    document.addEventListener('click', function(ev){
      var salvar = ev.target.closest && ev.target.closest('#btnSalvarPlantaoEscala, [data-escala-salvar]');
      if (!salvar) return;
      ev.preventDefault();
      ev.stopPropagation();
      salvarAgendaPorLoja();
    }, true);
  }

  var tentativas = 0;
  var timer = setInterval(function(){
    tentativas++;
    instalar();
    if (window.__agendaPorLojaPatchInstalado || tentativas > 80) clearInterval(timer);
  }, 100);
})();
