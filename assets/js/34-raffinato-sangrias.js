// Integração com o conector local do Raffinato (Radmin VPN).
const RAFFINATO_BRIDGE_URL = 'http://127.0.0.1:8765';
let raffinatoSangrias = [];
let raffinatoConsultaController = null;
let raffinatoTelaInicializada = false;
let raffinatoIntegracaoAtual = null;
let raffinatoTesteValido = false;

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

async function raffinatoBridgePost(path, body) {
  const response = await fetch(`${RAFFINATO_BRIDGE_URL}${path}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), targetAddressSpace:'loopback',
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
  raffinatoTesteValido = false;
  document.getElementById('raffinatoSaveBtn').disabled = true;
}

async function carregarIntegracaoRaffinato() {
  const msg = document.getElementById('msgRaffinatoIntegracao');
  try {
    const contexto = contextoRaffinato();
    document.getElementById('raffinatoLojaContexto').textContent = `Configuração exclusiva de ${contexto.lojaNome}`;
    const { data, error } = await sb.from('raffinato_integracoes').select('*').eq('loja_id', contexto.lojaId).maybeSingle();
    if (error) throw error;
    raffinatoIntegracaoAtual = data || null;
    preencherFormularioIntegracaoRaffinato(raffinatoIntegracaoAtual);
    if (msg) { msg.className = 'msg'; msg.textContent = data ? 'Integração cadastrada. Teste novamente antes de salvar alterações.' : 'Cadastre a conexão do Raffinato para esta loja.'; }
  } catch (error) {
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
  const status = document.getElementById('raffinatoConnectionStatus');
  const label = document.getElementById('raffinatoConnectionLabel');
  if (!status || !label) return;
  status.classList.remove('is-online', 'is-offline');
  if (estado) status.classList.add(`is-${estado}`);
  label.textContent = texto;
}

async function verificarConectorRaffinato() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${RAFFINATO_BRIDGE_URL}/health`, {
      cache:'no-store', signal:controller.signal, targetAddressSpace:'loopback',
    });
    if (!response.ok) throw new Error('Conector indisponível');
    atualizarStatusConectorRaffinato('online', 'Conector local ativo');
    return true;
  } catch (_) {
    atualizarStatusConectorRaffinato('offline', 'Conector local desligado');
    return false;
  } finally {
    clearTimeout(timeout);
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
  const fim = `${dataFim}T${horaFim}:59`;
  if (new Date(fim) < new Date(inicio)) throw new Error('A data final deve ser posterior à data inicial.');
  return { inicio, fim, dataInicio, dataFim };
}

function escapeRaffinatoHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}

function formatarMoedaRaffinato(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
}

function renderizarSangriasRaffinato(items, total) {
  const body = document.getElementById('raffinatoTableBody');
  const empty = document.getElementById('raffinatoEmpty');
  const table = document.getElementById('raffinatoTable');
  if (!body || !empty || !table) return;
  if (!items.length) {
    table.hidden = true;
    empty.hidden = false;
    empty.innerHTML = '<div><strong>Nenhuma sangria encontrada</strong>Altere o período e execute uma nova consulta.</div>';
  } else {
    body.innerHTML = items.map(item => `<tr><td class="is-time">${escapeRaffinatoHtml(item.data)}</td><td class="is-time">${escapeRaffinatoHtml(item.hora)}</td><td>${escapeRaffinatoHtml(item.motivo)}</td><td class="is-value">${formatarMoedaRaffinato(item.valor)}</td></tr>`).join('');
    table.hidden = false;
    empty.hidden = true;
  }
  document.getElementById('raffinatoTotal').textContent = formatarMoedaRaffinato(total);
  document.getElementById('raffinatoQuantidade').textContent = String(items.length);
  document.getElementById('raffinatoTicketMedio').textContent = formatarMoedaRaffinato(items.length ? total / items.length : 0);
  document.getElementById('raffinatoExportBtn').disabled = !items.length;
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
    raffinatoConsultaController = new AbortController();
    setConsultaRaffinatoCarregando(true);
    if (msg) { msg.className = 'msg'; msg.textContent = ''; }
    const empty = document.getElementById('raffinatoEmpty');
    const table = document.getElementById('raffinatoTable');
    if (table) table.hidden = true;
    if (empty) { empty.hidden = false; empty.innerHTML = '<div><div class="raffinato-spinner"></div><strong>Consultando o Raffinato</strong>Aguarde a resposta pela rede Radmin VPN.</div>'; }

    const response = await fetch(`${RAFFINATO_BRIDGE_URL}/api/sangrias`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ inicio: periodo.inicio, fim: periodo.fim, loja_id:contextoRaffinato().lojaId }),
      signal: raffinatoConsultaController.signal,
      targetAddressSpace: 'loopback',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Falha ao consultar o Raffinato.');
    raffinatoSangrias = Array.isArray(payload.items) ? payload.items : [];
    renderizarSangriasRaffinato(raffinatoSangrias, Number(payload.total || 0));
    atualizarStatusConectorRaffinato('online', 'Raffinato conectado');
    if (msg) { msg.className = 'msg ok'; msg.textContent = `${raffinatoSangrias.length} sangria(s) encontrada(s).`; }
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
  if (!raffinatoSangrias.length) return;
  const rows = [['Data', 'Hora', 'Motivo', 'Valor'], ...raffinatoSangrias.map(item => [item.data, item.hora, item.motivo, Number(item.valor || 0).toFixed(2).replace('.', ',')])];
  rows.push(['', '', 'TOTAL', raffinatoSangrias.reduce((sum, item) => sum + Number(item.valor || 0), 0).toFixed(2).replace('.', ',')]);
  const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
  link.download = `sangrias-raffinato-${dataLocalIso()}.csv`;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}
