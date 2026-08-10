// Integração com o conector local do Raffinato (Radmin VPN).
const RAFFINATO_BRIDGE_URL = 'http://127.0.0.1:8766';
let raffinatoSangrias = [];
let raffinatoConsultaController = null;
let raffinatoTelaInicializada = false;
let raffinatoIntegracaoAtual = null;
let raffinatoTesteValido = false;
let raffinatoLoadSequence = 0;
let raffinatoFiltrosAnaliticos = { data:'', motivo:'', semana:'', faixa:'', tipo:'' };
let raffinatoOrdenacao = { coluna:'data', direcao:'asc' };
let raffinatoBuscaDetalhe = '';
let raffinatoItensVisiveis = [];
const RAFFINATO_RELAY_FUNCTION = 'raffinato-relay';

async function raffinatoRelay(body) {
  const { data, error } = await sb.functions.invoke(RAFFINATO_RELAY_FUNCTION, { body });
  if (error) throw new Error(error.message || 'Falha na comunicacao externa com o Raffinato.');
  if (data?.error) throw new Error(data.error);
  return data || {};
}

function gerarTokenRaffinato() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function parearConectorExternoRaffinato() {
  const contexto = contextoRaffinato();
  const token = gerarTokenRaffinato();
  await raffinatoBridgePost('/api/integracoes/raffinato/parear', {
    loja_id: contexto.lojaId, empresa_id: contexto.empresaId, relay_token: token,
  });
  await raffinatoRelay({
    action:'pair', token, empresa_id:contexto.empresaId, loja_id:contexto.lojaId,
    usuario_id:String(usuarioSistemaLogado?.id || ''),
  });
}

function contextoRaffinato() {
  const lojaId = String((typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : '') || usuarioSistemaLogado?.loja_id || '').trim();
  const empresaId = String((typeof obterEmpresaIdSessao === 'function' ? obterEmpresaIdSessao() : '') || usuarioSistemaLogado?.empresa_id || '').trim();
  const lojaNome = String(usuarioSistemaLogado?.loja_nome || document.getElementById('topbar-store-name')?.textContent || 'Loja atual').trim();
  if (!lojaId || !empresaId) throw new Error('Selecione uma loja antes de configurar o Raffinato.');
  return { lojaId, empresaId, lojaNome };
}

function dataLocalIso(data = new Date()) {
  const offset = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - offset).toISOString().slice(0, 10);
}

function iniciarTelaSangriasRaffinato() {
  if (!raffinatoTelaInicializada) {
    const hoje = dataLocalIso();
    const inicio = document.getElementById('raffinatoDataInicio');
    const fim = document.getElementById('raffinatoDataFim');
    if (inicio && !inicio.value) inicio.value = hoje;
    if (fim && !fim.value) fim.value = hoje;
    raffinatoTelaInicializada = true;
  }
  verificarConectorRaffinato();
  carregarIntegracaoRaffinato();
}

function iniciarTelaRelatorioSangriasRaffinato() {
  if (!raffinatoTelaInicializada) {
    const hoje = dataLocalIso();
    const inicio = document.getElementById('raffinatoDataInicio');
    const fim = document.getElementById('raffinatoDataFim');
    if (inicio) inicio.value = hoje;
    if (fim) fim.value = hoje;
    raffinatoTelaInicializada = true;
  }
  verificarConectorRaffinato();
  carregarIntegracaoRaffinato();
}

async function raffinatoBridgePost(path, body) {
  const response = await fetch(`${RAFFINATO_BRIDGE_URL}${path}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Falha no conector Raffinato.');
  return payload;
}

function dadosFormularioRaffinato() {
  const { lojaId } = contextoRaffinato();
  return {
    loja_id: lojaId,
    server: document.getElementById('raffinatoSqlServer')?.value.trim(),
    database: document.getElementById('raffinatoDatabase')?.value.trim(),
    uid: document.getElementById('raffinatoDbUser')?.value.trim(),
    pwd: document.getElementById('raffinatoDbPassword')?.value || '',
  };
}

function preencherFormularioIntegracaoRaffinato(item) {
  document.getElementById('raffinatoSqlServer').value = item?.instancia_sql || '';
  document.getElementById('raffinatoDatabase').value = item?.banco_dados || '';
  document.getElementById('raffinatoDbUser').value = item?.usuario_mascarado || '';
  document.getElementById('raffinatoDbPassword').value = '';
  document.getElementById('raffinatoDbPassword').placeholder = item ? 'Senha protegida; preencha apenas para alterar' : 'Senha do banco';
  document.getElementById('raffinatoDeleteIntegrationBtn').hidden = !item;
  const ocultarConsulta = !item || item.status !== 'ativa';
  document.getElementById('raffinatoSangriasPanel').hidden = ocultarConsulta;
  document.getElementById('raffinatoSummary').hidden = ocultarConsulta;
  document.getElementById('raffinatoTableCard').hidden = ocultarConsulta;
  document.getElementById('raffinatoCharts').hidden = ocultarConsulta || !raffinatoSangrias.length;
  raffinatoTesteValido = false;
  document.getElementById('raffinatoSaveBtn').disabled = true;
}

async function carregarIntegracaoRaffinato() {
  const msg = document.getElementById('msgRaffinatoIntegracao');
  const sequence = ++raffinatoLoadSequence;
  try {
    const contexto = contextoRaffinato();
    document.getElementById('raffinatoLojaContexto').textContent = `Configuração exclusiva de ${contexto.lojaNome}`;
    raffinatoIntegracaoAtual = null;
    raffinatoSangrias = [];
    preencherFormularioIntegracaoRaffinato(null);
    document.getElementById('raffinatoTestResult').hidden = true;
    if (msg) { msg.className = 'msg'; msg.textContent = `Carregando integração de ${contexto.lojaNome}...`; }
    const { data, error } = await sb.from('raffinato_integracoes').select('*')
      .eq('empresa_id', contexto.empresaId).eq('loja_id', contexto.lojaId).maybeSingle();
    if (error) throw error;
    const contextoAtual = contextoRaffinato();
    if (sequence !== raffinatoLoadSequence || contextoAtual.lojaId !== contexto.lojaId || contextoAtual.empresaId !== contexto.empresaId) return;
    raffinatoIntegracaoAtual = data || null;
    preencherFormularioIntegracaoRaffinato(raffinatoIntegracaoAtual);
    if (data && !data.conector_token_hash) {
      try {
        await parearConectorExternoRaffinato();
        raffinatoIntegracaoAtual.conector_token_hash = 'pareado';
      } catch (pairError) {
        console.warn('Pareamento externo do Raffinato pendente:', pairError);
      }
    }
    if (msg) { msg.className = 'msg'; msg.textContent = data ? 'Integração cadastrada. Teste novamente antes de salvar alterações.' : 'Cadastre a conexão do Raffinato para esta loja.'; }
  } catch (error) {
    if (sequence !== raffinatoLoadSequence) return;
    raffinatoIntegracaoAtual = null;
    preencherFormularioIntegracaoRaffinato(null);
    if (msg) { msg.className = 'msg err'; msg.textContent = error?.message || 'Não foi possível carregar a integração.'; }
  }
}

function renderizarTesteIntegracaoRaffinato(result) {
  const box = document.getElementById('raffinatoTestResult');
  box.hidden = false;
  box.innerHTML = `<div class="raffinato-test-title"><span>Conexão estabelecida com sucesso</span><span>${escapeRaffinatoHtml(result.latencia_ms)} ms</span></div><div class="raffinato-test-steps">${(result.steps || []).map(step => `<div class="raffinato-test-step"><span class="raffinato-test-check">✓</span>${escapeRaffinatoHtml(step.label)}</div>`).join('')}</div>`;
}

async function testarIntegracaoRaffinato() {
  const btn = document.getElementById('raffinatoTestBtn');
  const msg = document.getElementById('msgRaffinatoIntegracao');
  try {
    btn.disabled = true; btn.textContent = 'Testando...';
    raffinatoTesteValido = false;
    document.getElementById('raffinatoSaveBtn').disabled = true;
    const result = await raffinatoBridgePost('/api/integracoes/raffinato/testar', dadosFormularioRaffinato());
    renderizarTesteIntegracaoRaffinato(result);
    raffinatoTesteValido = true;
    document.getElementById('raffinatoSaveBtn').disabled = false;
    atualizarStatusConectorRaffinato('online', 'Raffinato conectado');
    if (msg) { msg.className = 'msg ok'; msg.textContent = `Servidor ${result.servidor} e banco ${result.banco} validados.`; }
  } catch (error) {
    document.getElementById('raffinatoTestResult').hidden = true;
    if (msg) { msg.className = 'msg err'; msg.textContent = error?.message || 'Falha no teste.'; }
  } finally { btn.disabled = false; btn.textContent = 'Testar conexão'; }
}

async function salvarIntegracaoRaffinato() {
  if (!raffinatoTesteValido) return;
  const btn = document.getElementById('raffinatoSaveBtn');
  const msg = document.getElementById('msgRaffinatoIntegracao');
  try {
    btn.disabled = true; btn.textContent = 'Salvando...';
    const contexto = contextoRaffinato();
    const form = dadosFormularioRaffinato();
    const result = await raffinatoBridgePost('/api/integracoes/raffinato/salvar', form);
    const atorId = /^[0-9a-f-]{36}$/i.test(String(usuarioSistemaLogado?.id || '')) ? usuarioSistemaLogado.id : null;
    const payload = { empresa_id:contexto.empresaId, loja_id:contexto.lojaId, instancia_sql:form.server, banco_dados:form.database, usuario_mascarado:form.uid, referencia_segredo:result.referencia_segredo, status:'ativa', ultimo_teste_em:new Date().toISOString(), ultimo_erro:null, criado_por:atorId };
    const { error } = await sb.from('raffinato_integracoes').upsert(payload, { onConflict:'loja_id' });
    if (error) throw error;
    await parearConectorExternoRaffinato();
    if (msg) { msg.className = 'msg ok'; msg.textContent = 'Integração salva para esta loja.'; }
    await carregarIntegracaoRaffinato();
  } catch (error) {
    if (msg) { msg.className = 'msg err'; msg.textContent = error?.message || 'Não foi possível salvar.'; }
  } finally { btn.textContent = 'Salvar integração'; }
}

function cancelarEdicaoIntegracaoRaffinato() {
  preencherFormularioIntegracaoRaffinato(raffinatoIntegracaoAtual);
  document.getElementById('raffinatoTestResult').hidden = true;
  const msg = document.getElementById('msgRaffinatoIntegracao');
  if (msg) { msg.className = 'msg'; msg.textContent = 'Edição cancelada.'; }
}

async function excluirIntegracaoRaffinato() {
  const resposta = typeof abrirConfirmacaoSistema === 'function'
    ? await abrirConfirmacaoSistema({ title:'Excluir integração Raffinato?', subtitle:'A configuração será removida somente desta loja.', confirmText:'Excluir' })
    : { confirmado:window.confirm('Excluir a integração Raffinato desta loja?') };
  if (!resposta?.confirmado) return;
  const msg = document.getElementById('msgRaffinatoIntegracao');
  try {
    const { lojaId } = contextoRaffinato();
    await raffinatoBridgePost('/api/integracoes/raffinato/excluir', { loja_id:lojaId });
    const { error } = await sb.from('raffinato_integracoes').delete().eq('loja_id', lojaId);
    if (error) throw error;
    raffinatoIntegracaoAtual = null;
    preencherFormularioIntegracaoRaffinato(null);
    document.getElementById('raffinatoTestResult').hidden = true;
    if (msg) { msg.className = 'msg ok'; msg.textContent = 'Integração excluída desta loja.'; }
  } catch (error) { if (msg) { msg.className = 'msg err'; msg.textContent = error?.message || 'Falha ao excluir.'; } }
}

function atualizarStatusConectorRaffinato(estado, texto) {
  [
    ['raffinatoConnectionStatus', 'raffinatoConnectionLabel'],
    ['raffinatoReportConnectionStatus', 'raffinatoReportConnectionLabel'],
  ].forEach(([statusId, labelId]) => {
    const status = document.getElementById(statusId);
    const label = document.getElementById(labelId);
    if (!status || !label) return;
    status.classList.remove('is-online', 'is-offline');
    if (estado) status.classList.add(`is-${estado}`);
    label.textContent = texto;
  });
}

async function verificarConectorRaffinato() {
  try {
    const contexto = contextoRaffinato();
    const statusRemoto = await raffinatoRelay({
      action:'status', empresa_id:contexto.empresaId, loja_id:contexto.lojaId,
      usuario_id:String(usuarioSistemaLogado?.id || ''),
    });
    if (!statusRemoto.online) {
      atualizarStatusConectorRaffinato('offline', statusRemoto.pareado ? 'Aguardando sincronizacao' : 'Conector nao pareado');
      return false;
    }
    atualizarStatusConectorRaffinato('online', 'Conector Raffinato ativo');
    return true;
  } catch (_) {
    atualizarStatusConectorRaffinato('offline', 'Conector indisponível');
    return false;
  }
}

function definirPeriodoSangriasRaffinato(dias) {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(fim.getDate() - Math.max(0, Number(dias) - 1));
  document.getElementById('raffinatoDataInicio').value = dataLocalIso(inicio);
  document.getElementById('raffinatoDataFim').value = dataLocalIso(fim);
  document.getElementById('raffinatoHoraInicio').value = '00:00';
  document.getElementById('raffinatoHoraFim').value = '23:59';
}

function obterPeriodoSangriasRaffinato() {
  const dataInicio = document.getElementById('raffinatoDataInicio')?.value;
  const horaInicio = document.getElementById('raffinatoHoraInicio')?.value || '00:00';
  const dataFim = document.getElementById('raffinatoDataFim')?.value;
  const horaFim = document.getElementById('raffinatoHoraFim')?.value || '23:59';
  if (!dataInicio || !dataFim) throw new Error('Informe as datas inicial e final.');
  const inicio = `${dataInicio}T${horaInicio}:00`;
  const fimSelecionado = new Date(`${dataFim}T${horaFim}:00`);
  const fimExclusivoDate = new Date(fimSelecionado);
  fimExclusivoDate.setMinutes(fimExclusivoDate.getMinutes() + 1);
  const fimExclusivo = `${dataLocalIso(fimExclusivoDate)}T${String(fimExclusivoDate.getHours()).padStart(2,'0')}:${String(fimExclusivoDate.getMinutes()).padStart(2,'0')}:00`;
  if (fimExclusivoDate <= new Date(inicio)) throw new Error('A data final deve ser posterior à data inicial.');
  return { inicio, fim:fimExclusivo, fimExclusivo, dataInicio, dataFim };
}

function escapeRaffinatoHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}

function formatarMoedaRaffinato(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function normalizarMovimentoRaffinato(item) {
  const tipo = Number(item?.tipo_comprovante_nao_fiscal ?? item?.TipoComprovanteNaoFiscal ?? (String(item?.tipo_movimento || '').toUpperCase() === 'RETIRADA' ? 4 : 1));
  return {
    ...item,
    valor:Number(item?.valor ?? item?.ValorTotal ?? 0),
    motivo:String(item?.motivo ?? item?.Motivo ?? 'Sem motivo'),
    data:String(item?.data ?? item?.data_formatada ?? ''),
    hora:String(item?.hora ?? item?.hora_formatada ?? ''),
    tipo_comprovante_nao_fiscal:tipo,
    tipo_movimento:tipo === 4 ? 'RETIRADA' : 'SANGRIA',
    finalidade:tipo === 4 ? 'Retirada para cofre' : 'Pagamento de despesa',
    id_usuario:String(item?.id_usuario ?? item?.IdUsuario ?? ''),
    id_usuario_autorizador:String(item?.id_usuario_autorizador ?? item?.IdUsuarioAutorizadorSangria ?? ''),
  };
}

function ehRetiradaCofreRaffinato(item) { return Number(item?.tipo_comprovante_nao_fiscal) === 4; }

function chaveTextoRaffinato(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function distanciaLevenshteinRaffinato(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  const linha = Array.from({ length:b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = linha[0]; linha[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const anterior = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = anterior;
    }
  }
  return linha[b.length];
}

function motivosSemelhantesRaffinato(a, b) {
  if (a === b) return true;
  if (!a || !b || Math.min(a.length, b.length) < 4) return false;
  const maior = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) <= 2 && 1 - distanciaLevenshteinRaffinato(a, b) / maior >= .86) return true;
  const ta = new Set(a.split(' ').filter(t => t.length > 1));
  const tb = new Set(b.split(' ').filter(t => t.length > 1));
  const intersecao = [...ta].filter(t => tb.has(t)).length;
  const uniao = new Set([...ta, ...tb]).size;
  return uniao > 0 && intersecao / uniao >= .8;
}

function prepararMotivosAgrupadosRaffinato(items) {
  const frequencias = new Map();
  items.forEach(item => {
    const chave = chaveTextoRaffinato(item.motivo) || 'sem motivo';
    const atual = frequencias.get(chave) || { chave, quantidade:0, valor:0, rotulos:new Map() };
    atual.quantidade += 1;
    atual.valor += Number(item.valor || 0);
    const rotulo = String(item.motivo || 'Sem motivo').trim() || 'Sem motivo';
    atual.rotulos.set(rotulo, (atual.rotulos.get(rotulo) || 0) + 1);
    frequencias.set(chave, atual);
  });
  const grupos = [];
  [...frequencias.values()].sort((a,b) => b.quantidade - a.quantidade).forEach(item => {
    let grupo = grupos.find(candidato => motivosSemelhantesRaffinato(candidato.chave, item.chave));
    if (!grupo) { grupo = { chave:item.chave, chaves:[], quantidade:0, valor:0, rotulos:new Map() }; grupos.push(grupo); }
    grupo.chaves.push(item.chave); grupo.quantidade += item.quantidade; grupo.valor += item.valor;
    item.rotulos.forEach((qtd, rotulo) => grupo.rotulos.set(rotulo, (grupo.rotulos.get(rotulo) || 0) + qtd));
  });
  grupos.forEach(grupo => {
    grupo.rotulo = [...grupo.rotulos.entries()].sort((a,b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] || 'Sem motivo';
    grupo.rotulo = grupo.rotulo.charAt(0).toUpperCase() + grupo.rotulo.slice(1);
  });
  return grupos;
}

function dataRaffinatoParaDate(item) {
  const partes = String(item.data || '').split('/').map(Number);
  if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
  const data = new Date(item.data);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

const RAFFINATO_DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const RAFFINATO_FAIXAS = [['00–06h',0,6],['06–09h',6,9],['09–12h',9,12],['12–15h',12,15],['15–18h',15,18],['18–21h',18,21],['21–24h',21,24]];
function faixaHoraRaffinato(item) { const h = Number(String(item.hora || '0').slice(0,2)); return RAFFINATO_FAIXAS.find(([,min,max]) => h >= min && h < max)?.[0] || '00–06h'; }
function diaSemanaRaffinato(item) { return RAFFINATO_DIAS_SEMANA[dataRaffinatoParaDate(item).getDay()]; }

function itensFiltradosRaffinato() {
  return raffinatoSangrias.filter(item => {
    const f = raffinatoFiltrosAnaliticos;
    const motivo = chaveTextoRaffinato(item.motivo) || 'sem motivo';
    return (!f.data || item.data === f.data) && (!f.motivo || motivosSemelhantesRaffinato(f.motivo, motivo))
      && (!f.semana || diaSemanaRaffinato(item) === f.semana) && (!f.faixa || faixaHoraRaffinato(item) === f.faixa)
      && (!f.tipo || item.tipo_movimento === f.tipo);
  });
}

function alternarFiltroAnaliticoRaffinato(tipo, valor) { raffinatoFiltrosAnaliticos[tipo] = raffinatoFiltrosAnaliticos[tipo] === valor ? '' : valor; atualizarPainelAnaliticoRaffinato(); }
function removerFiltroAnaliticoRaffinato(tipo) { raffinatoFiltrosAnaliticos[tipo] = ''; atualizarPainelAnaliticoRaffinato(); }
function limparFiltrosAnaliticosRaffinato() { raffinatoFiltrosAnaliticos = { data:'', motivo:'', semana:'', faixa:'', tipo:'' }; raffinatoBuscaDetalhe = ''; const busca = document.getElementById('raffinatoDetailSearch'); if (busca) busca.value = ''; atualizarPainelAnaliticoRaffinato(); }
function definirBuscaDetalheRaffinato(valor) { raffinatoBuscaDetalhe = chaveTextoRaffinato(valor); renderizarDetalhamentoRaffinato(itensFiltradosRaffinato()); }

function renderizarFiltrosAtivosRaffinato() {
  const box = document.getElementById('raffinatoActiveFilters');
  const chips = document.getElementById('raffinatoFilterChips');
  if (!box || !chips) return;
  const nomes = { data:'Data', motivo:'Motivo', semana:'Dia', faixa:'Horário', tipo:'Tipo' };
  const ativos = Object.entries(raffinatoFiltrosAnaliticos).filter(([,valor]) => valor);
  box.hidden = !ativos.length;
  chips.innerHTML = ativos.map(([tipo,valor]) => `<button type="button" class="raffinato-filter-chip" onclick="removerFiltroAnaliticoRaffinato('${tipo}')"><span>${nomes[tipo]}:</span> ${escapeRaffinatoHtml(tipo === 'motivo' ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor)} ×</button>`).join('');
}

function valorOrdenacaoRaffinato(item, coluna) {
  if (coluna === 'valor') return Number(item.valor || 0);
  if (coluna === 'data') return dataRaffinatoParaDate(item).getTime();
  if (coluna === 'hora') return String(item.hora || '');
  return chaveTextoRaffinato(item.motivo);
}

function ordenarDetalhamentoRaffinato(coluna) {
  raffinatoOrdenacao = { coluna, direcao:raffinatoOrdenacao.coluna === coluna && raffinatoOrdenacao.direcao === 'asc' ? 'desc' : 'asc' };
  renderizarDetalhamentoRaffinato(itensFiltradosRaffinato());
}

function renderizarDetalhamentoRaffinato(items) {
  const body = document.getElementById('raffinatoTableBody');
  const empty = document.getElementById('raffinatoEmpty');
  const table = document.getElementById('raffinatoTable');
  if (!body || !empty || !table) return;
  const busca = raffinatoBuscaDetalhe;
  const filtrados = items.filter(item => !busca || chaveTextoRaffinato(`${item.data} ${item.hora} ${item.tipo_movimento} ${item.finalidade} ${item.motivo} ${item.id_usuario} ${item.id_usuario_autorizador} ${item.valor}`).includes(busca));
  const fator = raffinatoOrdenacao.direcao === 'asc' ? 1 : -1;
  raffinatoItensVisiveis = [...filtrados].sort((a,b) => {
    const va = valorOrdenacaoRaffinato(a, raffinatoOrdenacao.coluna), vb = valorOrdenacaoRaffinato(b, raffinatoOrdenacao.coluna);
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric:true })) * fator;
  });
  if (!raffinatoItensVisiveis.length) {
    table.hidden = true;
    empty.hidden = false;
    empty.innerHTML = '<div><strong>Nenhum movimento encontrado</strong>Remova algum filtro ou altere o período.</div>';
  } else {
    body.innerHTML = raffinatoItensVisiveis.map(item => { const retirada = ehRetiradaCofreRaffinato(item); return `<tr class="${retirada ? 'is-vault' : 'is-expense'}"><td class="is-time"><button class="raffinato-cell-filter" onclick="alternarFiltroAnaliticoRaffinato('data','${escapeRaffinatoHtml(item.data)}')">${escapeRaffinatoHtml(item.data)}</button></td><td class="is-time">${escapeRaffinatoHtml(item.hora)}</td><td><button class="raffinato-type-badge ${retirada ? 'is-vault' : 'is-expense'}" onclick="alternarFiltroAnaliticoRaffinato('tipo','${item.tipo_movimento}')">${retirada ? 'RETIRADA PARA COFRE' : 'SANGRIA / DESPESA'}</button><small>${escapeRaffinatoHtml(item.finalidade)}</small></td><td>${escapeRaffinatoHtml(item.motivo)}</td><td class="raffinato-user-cell"><span>${escapeRaffinatoHtml(item.id_usuario || '—')}</span><small>Autoriza: ${escapeRaffinatoHtml(item.id_usuario_autorizador || '—')}</small></td><td class="is-value">${formatarMoedaRaffinato(item.valor)}</td></tr>`; }).join('');
    table.hidden = false;
    empty.hidden = true;
  }
  ['Data','Hora','Motivo','Valor'].forEach(nome => { const el = document.getElementById(`raffinatoSort${nome}`); if (el) el.textContent = raffinatoOrdenacao.coluna === nome.toLowerCase() ? (raffinatoOrdenacao.direcao === 'asc' ? '↑' : '↓') : '↕'; });
  const resumo = document.getElementById('raffinatoTableSummary');
  if (resumo) resumo.textContent = `${raffinatoItensVisiveis.length} registro(s) exibido(s) · ordenado por ${raffinatoOrdenacao.coluna}`;
  document.getElementById('raffinatoExportBtn').disabled = !raffinatoItensVisiveis.length;
}

function agruparSangriasRaffinato(items, keyFn, valueFn = item => Number(item.valor || 0)) {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + valueFn(item));
  });
  return [...map.entries()];
}

function barrasSangriasRaffinato(entries, formatValue = formatarMoedaRaffinato, tipoFiltro = '') {
  const max = Math.max(1, ...entries.map(([, value]) => Number(value || 0)));
  return entries.map(([label, value, meta]) => `<button type="button" class="raffinato-chart-row ${tipoFiltro && raffinatoFiltrosAnaliticos[tipoFiltro] === (meta?.filtro || label) ? 'is-selected' : ''}" ${tipoFiltro ? `onclick="alternarFiltroAnaliticoRaffinato('${tipoFiltro}','${escapeRaffinatoHtml(meta?.filtro || label)}')"` : ''}><span class="raffinato-chart-label" title="${escapeRaffinatoHtml(label)}">${escapeRaffinatoHtml(label)}</span><span class="raffinato-chart-track"><span class="raffinato-chart-bar" style="width:${Math.max(2, Number(value || 0) / max * 100)}%"></span></span><span class="raffinato-chart-value">${escapeRaffinatoHtml(formatValue(value, meta))}</span></button>`).join('');
}

const RAFFINATO_CORES = ['#f97316','#22c55e','#38bdf8','#a78bfa','#facc15','#fb7185','#14b8a6','#60a5fa','#e879f9','#94a3b8'];
function renderizarPizzaRaffinato(containerId, entries, tipoFiltro) {
  const el = document.getElementById(containerId); if (!el) return;
  const total = entries.reduce((s,e) => s + Number(e[1] || 0), 0) || 1;
  let acumulado = 0;
  const fatias = entries.map((entry,i) => { const pct = Number(entry[1] || 0) / total * 100; const ini = acumulado; acumulado += pct; return `${RAFFINATO_CORES[i % RAFFINATO_CORES.length]} ${ini}% ${acumulado}%`; });
  const legenda = entries.map(([label,value,meta],i) => `<button type="button" class="raffinato-donut-item ${raffinatoFiltrosAnaliticos[tipoFiltro] === (meta?.filtro || label) ? 'is-selected' : ''}" onclick="alternarFiltroAnaliticoRaffinato('${tipoFiltro}','${escapeRaffinatoHtml(meta?.filtro || label)}')"><i style="background:${RAFFINATO_CORES[i % RAFFINATO_CORES.length]}"></i><span>${escapeRaffinatoHtml(label)}</span><strong>${escapeRaffinatoHtml(meta?.texto || String(value))}</strong></button>`).join('');
  el.innerHTML = `<div class="raffinato-donut" style="background:conic-gradient(${fatias.join(',')})"><div><strong>${entries.length}</strong><span>grupos</span></div></div><div class="raffinato-donut-legend">${legenda}</div>`;
}

function renderizarGraficosSangriasRaffinato(items) {
  const charts = document.getElementById('raffinatoCharts');
  if (!charts) return;
  charts.hidden = !items.length;
  if (!items.length) return;
  const ordenarDias = entries => entries.sort((a, b) => {
    const br = value => String(value).split('/').reverse().join('-');
    return br(a[0]).localeCompare(br(b[0]));
  });
  const sangrias = items.filter(item => !ehRetiradaCofreRaffinato(item));
  const retiradas = items.filter(ehRetiradaCofreRaffinato);
  const porDiaSangrias = ordenarDias(agruparSangriasRaffinato(sangrias, item => item.data));
  const porDiaRetiradas = ordenarDias(agruparSangriasRaffinato(retiradas, item => item.data));
  const motivos = prepararMotivosAgrupadosRaffinato(sangrias).sort((a,b) => b.quantidade - a.quantidade);
  const top10 = motivos.slice(0,10).map(g => [g.rotulo, g.quantidade, { filtro:g.chave, texto:`${g.quantidade}× · ${formatarMoedaRaffinato(g.valor)}` }]);
  const totalSangrias = sangrias.reduce((sum,item) => sum + item.valor, 0);
  const totalRetiradas = retiradas.reduce((sum,item) => sum + item.valor, 0);
  const composicao = [
    ['Pagamentos de despesas', totalSangrias, { filtro:'SANGRIA', texto:formatarMoedaRaffinato(totalSangrias) }],
    ['Retiradas para cofre', totalRetiradas, { filtro:'RETIRADA', texto:formatarMoedaRaffinato(totalRetiradas) }],
  ];
  document.getElementById('raffinatoChartSangriasDias').innerHTML = porDiaSangrias.length ? barrasSangriasRaffinato(porDiaSangrias, formatarMoedaRaffinato, 'data') : '<div class="raffinato-chart-empty">Sem sangrias no período.</div>';
  document.getElementById('raffinatoChartRetiradasDias').innerHTML = porDiaRetiradas.length ? barrasSangriasRaffinato(porDiaRetiradas, formatarMoedaRaffinato, 'data') : '<div class="raffinato-chart-empty">Sem retiradas para cofre no período.</div>';
  document.getElementById('raffinatoChartMotivos').innerHTML = barrasSangriasRaffinato(top10, (value,meta) => meta.texto, 'motivo');
  renderizarPizzaRaffinato('raffinatoPizzaComposicao', composicao, 'tipo');
  document.getElementById('raffinatoHistoricoRetiradas').innerHTML = retiradas.length ? [...retiradas].sort((a,b) => `${b.data_hora || b.data} ${b.hora}`.localeCompare(`${a.data_hora || a.data} ${a.hora}`)).map(item => `<div class="raffinato-vault-item"><div><strong>${escapeRaffinatoHtml(item.data)} · ${escapeRaffinatoHtml(item.hora)}</strong><span>${escapeRaffinatoHtml(item.motivo)}</span></div><div><strong>${formatarMoedaRaffinato(item.valor)}</strong><small>Usuário ${escapeRaffinatoHtml(item.id_usuario || '—')} · autoriza ${escapeRaffinatoHtml(item.id_usuario_autorizador || '—')}</small></div></div>`).join('') : '<div class="raffinato-chart-empty">Nenhuma retirada para cofre neste período.</div>';
}

function atualizarPainelAnaliticoRaffinato() {
  const items = itensFiltradosRaffinato();
  const sangrias = items.filter(item => !ehRetiradaCofreRaffinato(item));
  const retiradas = items.filter(ehRetiradaCofreRaffinato);
  const totalSangrias = sangrias.reduce((sum,item) => sum + Number(item.valor || 0), 0);
  const totalRetiradas = retiradas.reduce((sum,item) => sum + Number(item.valor || 0), 0);
  const total = totalSangrias + totalRetiradas;
  document.getElementById('raffinatoTotalSangrias').textContent = formatarMoedaRaffinato(totalSangrias);
  document.getElementById('raffinatoTotalRetiradas').textContent = formatarMoedaRaffinato(totalRetiradas);
  document.getElementById('raffinatoTotalGeral').textContent = formatarMoedaRaffinato(total);
  document.getElementById('raffinatoQuantidadeSangrias').textContent = String(sangrias.length);
  document.getElementById('raffinatoQuantidadeRetiradas').textContent = String(retiradas.length);
  document.getElementById('raffinatoTicketMedio').textContent = formatarMoedaRaffinato(items.length ? total / items.length : 0);
  renderizarFiltrosAtivosRaffinato();
  renderizarGraficosSangriasRaffinato(items);
  renderizarDetalhamentoRaffinato(items);
}

function renderizarSangriasRaffinato(items) {
  if (!items.length) document.getElementById('raffinatoCharts').hidden = true;
  atualizarPainelAnaliticoRaffinato();
}

function setConsultaRaffinatoCarregando(carregando) {
  const executar = document.getElementById('raffinatoQueryBtn');
  const cancelar = document.getElementById('raffinatoCancelBtn');
  if (executar) { executar.disabled = carregando; executar.textContent = carregando ? 'Consultando...' : 'Executar consulta'; }
  if (cancelar) cancelar.hidden = !carregando;
}

async function consultarSangriasRaffinato() {
  const msg = document.getElementById('msgRaffinatoSangrias');
  try {
    const periodo = obterPeriodoSangriasRaffinato();
    raffinatoConsultaController?.abort();
    setConsultaRaffinatoCarregando(true);
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
    const empty = document.getElementById('raffinatoEmpty');
    const table = document.getElementById('raffinatoTable');
    if (table) table.hidden = true;
    if (empty) { empty.hidden = false; empty.innerHTML = '<div><div class="raffinato-spinner"></div><strong>Consultando o Raffinato</strong>Aguarde a resposta pela rede Radmin VPN.</div>'; }

    const contexto = contextoRaffinato();
    let payload;
    try {
      // Fonte de verdade: consulta o DocumentoFiscal diretamente no Raffinato.
      payload = await raffinatoBridgePost('/api/sangrias', {
        inicio:periodo.inicio, fim:periodo.fim, fim_exclusivo:periodo.fimExclusivo,
        loja_id:contexto.lojaId,
      });
    } catch (localError) {
      // Permite consultar em celular ou computador no qual o conector não esteja aberto.
      payload = await raffinatoRelay({
        action:'dashboard', inicio:periodo.inicio, fim:periodo.fim, fim_exclusivo:periodo.fimExclusivo,
        empresa_id:contexto.empresaId, loja_id:contexto.lojaId,
        usuario_id:String(usuarioSistemaLogado?.id || ''),
      });
      payload.origem_consulta = 'sincronizacao';
    }
    raffinatoSangrias = Array.isArray(payload.items) ? payload.items.map(normalizarMovimentoRaffinato) : [];
    raffinatoFiltrosAnaliticos = { data:'', motivo:'', semana:'', faixa:'', tipo:'' };
    raffinatoBuscaDetalhe = '';
    const buscaDetalhe = document.getElementById('raffinatoDetailSearch');
    if (buscaDetalhe) buscaDetalhe.value = '';
    renderizarSangriasRaffinato(raffinatoSangrias, Number(payload.total || 0));
    atualizarStatusConectorRaffinato('online', 'Raffinato conectado');
    if (msg) { const retiradas = raffinatoSangrias.filter(ehRetiradaCofreRaffinato).length; msg.className = 'msg ok'; msg.textContent = `${raffinatoSangrias.length - retiradas} sangria(s) e ${retiradas} retirada(s) para cofre encontradas${payload.origem_consulta === 'sincronizacao' ? ' na sincronização' : ' diretamente no Raffinato'}.`; }
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (msg) { msg.className = 'msg'; msg.textContent = 'Consulta cancelada.'; }
      renderizarSangriasRaffinato(raffinatoSangrias, raffinatoSangrias.reduce((sum, item) => sum + Number(item.valor || 0), 0));
      return;
    }
    atualizarStatusConectorRaffinato('offline', 'Verifique conector e VPN');
    if (msg) { msg.className = 'msg err'; msg.textContent = error?.message || 'Não foi possível realizar a consulta.'; }
    const empty = document.getElementById('raffinatoEmpty');
    if (empty) { empty.hidden = false; empty.innerHTML = '<div><strong>Conexão indisponível</strong>Abra o conector Raffinato neste computador e confira o Radmin VPN.</div>'; }
  } finally {
    setConsultaRaffinatoCarregando(false);
    raffinatoConsultaController = null;
  }
}

function cancelarConsultaSangriasRaffinato() {
  raffinatoConsultaController?.abort();
}

function exportarSangriasRaffinatoExcel() {
  if (!raffinatoItensVisiveis.length) return;
  const rows = [['Data', 'Hora', 'Tipo', 'Finalidade', 'Motivo', 'Usuário', 'Autorizador', 'Valor'], ...raffinatoItensVisiveis.map(item => [item.data, item.hora, item.tipo_movimento, item.finalidade, item.motivo, item.id_usuario, item.id_usuario_autorizador, Number(item.valor || 0).toFixed(2).replace('.', ',')])];
  rows.push(['', '', '', '', '', '', 'TOTAL', raffinatoItensVisiveis.reduce((sum, item) => sum + Number(item.valor || 0), 0).toFixed(2).replace('.', ',')]);
  const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  link.download = `saidas-caixa-raffinato-${dataLocalIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}
