// Integrações financeiras e conciliação bancária.
const INTEGRACOES_FINANCEIRAS_PAGINAS = {
  integracoes_financeiras_dashboard: { titulo: 'Dashboard Financeiro', descricao: 'Visão consolidada das futuras conexões financeiras.' },
  integracoes_financeiras_contas: { titulo: 'Contas Bancárias', descricao: 'Contas importadas ou cadastradas manualmente.' },
  integracoes_financeiras_cartoes: { titulo: 'Cartões', descricao: 'Cartões e faturas vinculados às instituições.' },
  integracoes_financeiras_movimentacoes: { titulo: 'Movimentações', descricao: 'Extrato normalizado de contas e cartões.' },
  integracoes_financeiras_categorias: { titulo: 'Categorias', descricao: 'Classificação de receitas e despesas.' },
  integracoes_financeiras_fornecedores: { titulo: 'Fornecedores', descricao: 'Contrapartes identificadas nas movimentações.' },
  integracoes_financeiras_conciliacao: { titulo: 'Conciliação bancária', descricao: 'Compare a fatura com os lançamentos do Check Diário.' },
  integracoes_financeiras_regras: { titulo: 'Regras Automáticas', descricao: 'Regras declarativas para classificação futura.' },
  integracoes_financeiras_configuracoes: { titulo: 'Configurações', descricao: 'Conexões, provedores e histórico de sincronização.' },
};

const integracoesFinanceirasProviders = Object.freeze({
  manual: { id: 'manual', nome: 'Manual', disponivel: true },
  open_finance: { id: 'open_finance', nome: 'Open Finance', disponivel: false },
  pluggy: { id: 'pluggy', nome: 'Pluggy', disponivel: false },
  belvo: { id: 'belvo', nome: 'Belvo', disponivel: false },
});

const FinanceAI = Object.freeze({
  disponivel: false,
  capacidades: ['classificar_compras', 'detectar_duplicidades', 'detectar_assinaturas', 'sugerir_categorias', 'identificar_padroes', 'gerar_insights'],
  async analisar() { throw new Error('Finance AI ainda não está habilitado.'); },
});

const IFConciliacao = {
  arquivo: null, fornecedorId: '', fornecedorNome: '', itensArquivo: [], contas: [],
  pares: new Map(), processando: false, filtro: 'todos',
};

function ifEsc(texto) {
  if (typeof escaparHtmlBasico === 'function') return escaparHtmlBasico(String(texto || ''));
  return String(texto || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ifMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function ifData(data) {
  if (!data) return 'Sem data';
  return typeof formatarDataBRFinanceiro === 'function' ? formatarDataBRFinanceiro(data) : data;
}
function ifNorm(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function ifDiffDias(a, b) {
  const da = new Date(`${String(a || '').slice(0,10)}T12:00:00`);
  const db = new Date(`${String(b || '').slice(0,10)}T12:00:00`);
  return Number.isNaN(da.getTime()) || Number.isNaN(db.getTime()) ? 9999 : Math.abs(Math.round((da - db) / 86400000));
}
function ifCentavos(v) { return Math.round(Number(v || 0) * 100); }

function renderizarDashboardIntegracoesFinanceiras(container) {
  const indicadores = ['Saldo', 'Receitas', 'Despesas', 'Faturas', 'Contas conectadas', 'Última sincronização'];
  container.innerHTML = `<div class="if-status-banner"><span class="if-status-dot"></span>Módulo preparado. Nenhuma integração externa está ativa.</div>
    <div class="if-metrics">${indicadores.map(item => `<div class="stat-card"><div class="stat-label">${item}</div><div class="stat-value">--</div><div class="if-stat-note">Aguardando conexão</div></div>`).join('')}</div>`;
}
function renderizarPaginaEstruturalIntegracoesFinanceiras(container, pagina) {
  container.innerHTML = `<div class="card if-structure-card"><div class="if-structure-head"><div><div class="card-title">${pagina.titulo}</div><div class="page-sub">${pagina.descricao}</div></div><span class="if-phase-badge">Em preparação</span></div><div class="empty">Estrutura pronta para receber dados.</div></div>`;
}

function renderizarConciliacaoFinanceira(container) {
  container.innerHTML = `
    <div class="if-conc-toolbar card">
      <div class="if-conc-intro">
        <div class="card-title">Conferir fatura</div>
        <div class="page-sub">Importe PDF, imagem ou OFX. Primeiro escolha o fornecedor do cartão/banco.</div>
      </div>
      <div class="if-conc-controls">
        <label><span>Fornecedor</span><select id="ifConcFornecedor" onchange="ifConcSelecionarFornecedor(this.value)"><option value="">Selecione...</option></select></label>
        <input id="ifConcArquivo" type="file" accept=".pdf,.ofx,.qfx,image/*" hidden onchange="ifConcReceberArquivo(this.files[0])">
        <button class="btn btn-green" type="button" onclick="document.getElementById('ifConcArquivo').click()">📎 Importar arquivo</button>
      </div>
      <div id="ifConcDrop" class="if-conc-drop" onclick="document.getElementById('ifConcArquivo').click()"
        ondragover="event.preventDefault();this.classList.add('ativo')" ondragleave="this.classList.remove('ativo')"
        ondrop="event.preventDefault();this.classList.remove('ativo');ifConcReceberArquivo(event.dataTransfer.files[0])">
        <strong>Arraste a fatura aqui</strong><span>PDF, foto/print, OFX ou QFX</span>
      </div>
      <div class="msg" id="ifConcMsg"></div>
    </div>
    <div id="ifConcResultado"></div>`;
  ifConcCarregarFornecedores();
}

async function ifConcCarregarFornecedores() {
  try {
    if (typeof carregarFornecedoresFinanceiro === 'function') await carregarFornecedoresFinanceiro();
    const select = document.getElementById('ifConcFornecedor');
    if (!select) return;
    const lista = (typeof fornecedoresFinanceiroCache !== 'undefined' ? fornecedoresFinanceiroCache : []) || [];
    select.innerHTML = '<option value="">Selecione o fornecedor do cartão...</option>' +
      lista.map(f => `<option value="${ifEsc(f.id)}">${ifEsc(f.nome)}</option>`).join('');
  } catch (e) { ifConcMsg('Não foi possível carregar os fornecedores.', 'err'); }
}
function ifConcSelecionarFornecedor(id) {
  IFConciliacao.fornecedorId = String(id || '');
  const select = document.getElementById('ifConcFornecedor');
  IFConciliacao.fornecedorNome = select?.selectedOptions?.[0]?.textContent || '';
  if (IFConciliacao.itensArquivo.length) ifConcComparar();
}
function ifConcMsg(texto, tipo = '') {
  const el = document.getElementById('ifConcMsg');
  if (!el) return;
  if (typeof setMsg === 'function') setMsg('ifConcMsg', texto, tipo);
  else { el.textContent = texto; el.className = `msg ${tipo}`; }
}

async function ifConcReceberArquivo(file) {
  if (!file || IFConciliacao.processando) return;
  if (!IFConciliacao.fornecedorId) {
    ifConcMsg('Selecione primeiro o fornecedor do cartão ou banco.', 'err');
    document.getElementById('ifConcArquivo').value = '';
    return;
  }
  IFConciliacao.processando = true;
  IFConciliacao.arquivo = file;
  ifConcMsg(`Lendo ${file.name}...`, '');
  try {
    const nome = file.name.toLowerCase();
    let itens;
    if (nome.endsWith('.ofx') || nome.endsWith('.qfx')) itens = await ifConcLerOFX(file);
    else if (nome.endsWith('.pdf') || file.type === 'application/pdf') itens = await ifConcLerPDF(file);
    else if (/^image\//i.test(file.type)) itens = await ifConcLerImagem(file);
    else throw new Error('Formato não aceito. Use PDF, imagem, OFX ou QFX.');
    IFConciliacao.itensArquivo = ifConcDeduplicar(itens).map((item, indice) => ({ ...item, id: `ext_${indice}`, status: 'pendente' }));
    if (!IFConciliacao.itensArquivo.length) throw new Error('Não encontrei lançamentos no arquivo. Confira a qualidade ou o formato da fatura.');
    await ifConcComparar();
    ifConcMsg(`${IFConciliacao.itensArquivo.length} lançamento(s) lido(s) de ${file.name}.`, 'ok');
  } catch (e) {
    console.error('Conciliação:', e);
    ifConcMsg(e?.message || 'Não foi possível ler o arquivo.', 'err');
  } finally {
    IFConciliacao.processando = false;
    const input = document.getElementById('ifConcArquivo');
    if (input) input.value = '';
  }
}

function ifConcDeduplicar(itens) {
  const vistos = new Set();
  return (itens || []).filter(i => {
    if (!i.descricao || !Number.isFinite(Number(i.valor)) || Number(i.valor) <= 0) return false;
    const chave = `${i.data || ''}|${ifCentavos(i.valor)}|${ifNorm(i.descricao)}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave); return true;
  });
}
async function ifConcLerOFX(file) {
  const texto = await file.text();
  if (typeof ofxParseLancamentos !== 'function') throw new Error('Leitor OFX indisponível.');
  return ofxParseLancamentos(texto).filter(i => Number(i.valor) < 0).map(i => ({
    data: i.data, descricao: i.descricao, valor: Math.abs(i.valor), fitid: i.fitid || null,
  }));
}
async function ifConcCarregarScript(src, teste) {
  if (teste()) return;
  await new Promise((resolve, reject) => {
    const anterior = document.querySelector(`script[src="${src}"]`);
    if (anterior) { anterior.addEventListener('load', resolve, { once:true }); anterior.addEventListener('error', reject, { once:true }); return; }
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
async function ifConcLerPDF(file) {
  await ifConcCarregarScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs', () => !!window.pdfjsLib).catch(() => {});
  // A versão UMD é usada como fallback para navegadores que não expõem o módulo global.
  if (!window.pdfjsLib) await ifConcCarregarScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let texto = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    texto += '\n' + conteudo.items.map(i => i.str).join(' ');
  }
  return ifConcExtrairTextoFatura(texto);
}
async function ifConcLerImagem(file) {
  await ifConcCarregarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!window.Tesseract?.recognize);
  const resultado = await window.Tesseract.recognize(file, 'por+eng', {
    logger: info => { if (info?.status === 'recognizing text') ifConcMsg(`Lendo imagem... ${Math.round((info.progress || 0) * 100)}%`, ''); },
  });
  const texto = resultado?.data?.text || '';
  const especializado = typeof window.imagemCompraExtrairItens === 'function' ? window.imagemCompraExtrairItens(texto) : [];
  return especializado.length ? especializado : ifConcExtrairTextoFatura(texto);
}

function ifConcExtrairTextoFatura(texto) {
  const bruto = String(texto || '').replace(/\r/g, '\n');
  const linhas = bruto.split(/\n|(?=\b\d{2}\/\d{2}(?:\/\d{2,4})?\b)/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const itens = [];
  const regexValor = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2})(?!\d)/g;
  linhas.forEach(linha => {
    const dataM = linha.match(/\b(\d{2})[\/.-](\d{2})(?:[\/.-](\d{2,4}))?\b/);
    const valores = [...linha.matchAll(regexValor)];
    if (!valores.length) return;
    const achado = valores[valores.length - 1];
    const raw = achado[1];
    const valor = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!Number.isFinite(valor) || valor <= 0) return;
    const hojeAno = new Date().getFullYear();
    let data = '';
    if (dataM) {
      let ano = dataM[3] ? Number(dataM[3]) : hojeAno;
      if (ano < 100) ano += 2000;
      data = `${ano}-${dataM[2]}-${dataM[1]}`;
    }
    const descricao = linha
      .replace(dataM?.[0] || '', ' ').replace(achado[0], ' ')
      .replace(/\b(?:compra|nacional|internacional|parcela|d[eé]bito|cr[eé]dito)\b/gi, ' ')
      .replace(/\s+/g, ' ').replace(/^[\s\-–—·:]+|[\s\-–—·:]+$/g, '').trim().slice(0, 140);
    if (descricao.length >= 2 && !/\b(total|pagamento recebido|saldo anterior|limite)\b/i.test(descricao)) itens.push({ data, descricao, valor });
  });
  return itens;
}

async function ifConcComparar() {
  if (!IFConciliacao.fornecedorId || !IFConciliacao.itensArquivo.length) return;
  ifConcMsg('Buscando lançamentos do Check Diário...', '');
  let query = sb.from('contasapagar')
    .select('id,valor_compra,data_compra,data_vencimento,observacao,fornecedor_id,categoria_id,numero_parcela,qtd_parcelas,status,loja_id,fornecedores(nome)')
    .eq('fornecedor_id', IFConciliacao.fornecedorId).is('excluido_em', null).order('data_compra', { ascending: true });
  const datasValidas = IFConciliacao.itensArquivo.map(i => String(i.data || '').slice(0,10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (datasValidas.length) {
    const deslocar = (iso, dias) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0,10); };
    query = query.gte('data_compra', deslocar(datasValidas[0], -45)).lte('data_compra', deslocar(datasValidas[datasValidas.length - 1], 45));
  }
  const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id;
  if (lojaId) query = query.eq('loja_id', lojaId);
  const { data, error } = await query;
  if (error) throw error;
  IFConciliacao.contas = data || [];
  IFConciliacao.pares.clear();
  const usados = new Set();
  IFConciliacao.itensArquivo.forEach(ext => {
    const candidatos = IFConciliacao.contas.filter(c => !usados.has(String(c.id))).map(c => {
      const valorIgual = ifCentavos(c.valor_compra) === ifCentavos(ext.valor);
      const dias = Math.min(ifDiffDias(c.data_compra, ext.data), ifDiffDias(c.data_vencimento, ext.data));
      const nome = ifNorm(`${c.observacao || ''} ${c.fornecedores?.nome || ''}`);
      const termos = ifNorm(ext.descricao).split(' ').filter(t => t.length > 2);
      const textoScore = termos.length ? termos.filter(t => nome.includes(t)).length / termos.length : 0;
      return { conta:c, valorIgual, dias, score:(valorIgual ? 100 : 0) + (dias <= 5 ? 25 - dias : 0) + textoScore * 20 };
    }).sort((a,b) => b.score - a.score);
    const melhor = candidatos[0];
    if (melhor && (melhor.valorIgual || melhor.score >= 25)) {
      IFConciliacao.pares.set(ext.id, String(melhor.conta.id));
      usados.add(String(melhor.conta.id));
      ext.status = melhor.valorIgual ? 'localizado' : 'divergente';
    } else ext.status = 'nao_localizado';
  });
  ifConcRenderResultado();
}

function ifConcResumo() {
  const localizados = IFConciliacao.itensArquivo.filter(i => i.status === 'localizado');
  const pendentes = IFConciliacao.itensArquivo.filter(i => i.status !== 'localizado');
  const usados = new Set(IFConciliacao.pares.values());
  const sobraSistema = IFConciliacao.contas.filter(c => !usados.has(String(c.id)));
  return {
    totalArquivo: IFConciliacao.itensArquivo.reduce((s,i) => s + Number(i.valor || 0), 0),
    totalLocalizado: localizados.reduce((s,i) => s + Number(i.valor || 0), 0),
    localizados: localizados.length, pendentes: pendentes.length, sobraSistema,
  };
}
function ifConcRenderResultado() {
  const root = document.getElementById('ifConcResultado');
  if (!root) return;
  const resumo = ifConcResumo();
  const usados = new Set(IFConciliacao.pares.values());
  root.innerHTML = `
    <div class="if-conc-summary">
      <div class="stat-card"><div class="stat-label">Total da fatura</div><div class="stat-value">${ifMoeda(resumo.totalArquivo)}</div></div>
      <div class="stat-card ok"><div class="stat-label">Localizado</div><div class="stat-value">${ifMoeda(resumo.totalLocalizado)}</div><small>${resumo.localizados} item(ns)</small></div>
      <div class="stat-card erro"><div class="stat-label">A conferir</div><div class="stat-value">${ifMoeda(resumo.totalArquivo-resumo.totalLocalizado)}</div><small>${resumo.pendentes} item(ns)</small></div>
      <div class="stat-card"><div class="stat-label">Só no sistema</div><div class="stat-value">${resumo.sobraSistema.length}</div><small>possível lançamento indevido</small></div>
    </div>
    <div class="if-conc-legend"><span class="ok">● Localizado</span><span class="erro">● Divergência</span><span>Selecione outro lançamento quando necessário</span></div>
    <div class="if-conc-columns-head"><strong>Arquivo importado</strong><span></span><strong>Check Diário</strong></div>
    <div class="if-conc-lista">${IFConciliacao.itensArquivo.map(ext => ifConcLinha(ext)).join('')}</div>
    ${resumo.sobraSistema.length ? `<div class="card if-conc-sobras"><div class="card-title">Lançado somente no Check Diário</div><div class="page-sub">Se a conta foi cadastrada indevidamente, você pode excluí-la daqui.</div>
      ${resumo.sobraSistema.map(c => `<div class="if-conc-sobra"><div><strong>${ifEsc(c.observacao || c.fornecedores?.nome || 'Conta')}</strong><span>${ifData(c.data_compra)} · ${ifMoeda(c.valor_compra)}</span></div><button class="btn btn-red btn-sm" onclick="ifConcExcluirConta('${ifEsc(c.id)}')">Excluir</button></div>`).join('')}</div>` : ''}`;
}
function ifConcLinha(ext) {
  const contaId = IFConciliacao.pares.get(ext.id) || '';
  const conta = IFConciliacao.contas.find(c => String(c.id) === contaId);
  const localizado = ext.status === 'localizado';
  const opts = ['<option value="">Não encontrado no sistema</option>', ...IFConciliacao.contas.map(c =>
    `<option value="${ifEsc(c.id)}" ${String(c.id) === contaId ? 'selected' : ''}>${ifData(c.data_compra)} · ${ifEsc(c.observacao || c.fornecedores?.nome || 'Conta')} · ${ifMoeda(c.valor_compra)}</option>`
  )].join('');
  return `<div class="if-conc-row ${localizado ? 'localizado' : 'divergente'}">
    <div class="if-conc-item"><span class="if-conc-status">${localizado ? '✓' : '!'}</span><div><strong>${ifEsc(ext.descricao)}</strong><span>${ifData(ext.data)} · ${ifMoeda(ext.valor)}</span></div></div>
    <div class="if-conc-link">${conta ? (localizado ? '＝' : '≠') : '→'}</div>
    <div class="if-conc-system">
      <select onchange="ifConcTrocarPar('${ifEsc(ext.id)}',this.value)">${opts}</select>
      ${conta ? `<div class="if-conc-system-info"><span>${ifEsc(conta.observacao || conta.fornecedores?.nome || 'Conta')}</span><strong>${ifMoeda(conta.valor_compra)}</strong></div>` : '<span class="if-conc-nao-achou">Nenhuma conta correspondente</span>'}
      <div class="if-conc-actions">
        ${conta && !localizado ? `<button class="btn btn-green btn-sm" onclick="ifConcConciliar('${ifEsc(ext.id)}')">Conciliar pelo valor da fatura</button>` : ''}
        ${!conta ? `<button class="btn btn-ghost btn-sm" onclick="ifConcCadastrar('${ifEsc(ext.id)}')">+ Cadastrar conta</button>` : ''}
      </div>
    </div>
  </div>`;
}
function ifConcTrocarPar(extId, contaId) {
  if (contaId) IFConciliacao.pares.set(extId, String(contaId)); else IFConciliacao.pares.delete(extId);
  const ext = IFConciliacao.itensArquivo.find(i => i.id === extId);
  const conta = IFConciliacao.contas.find(c => String(c.id) === String(contaId));
  if (ext) ext.status = conta ? (ifCentavos(ext.valor) === ifCentavos(conta.valor_compra) ? 'localizado' : 'divergente') : 'nao_localizado';
  ifConcRenderResultado();
}
async function ifConcConciliar(extId) {
  const ext = IFConciliacao.itensArquivo.find(i => i.id === extId);
  const contaId = IFConciliacao.pares.get(extId);
  const conta = IFConciliacao.contas.find(c => String(c.id) === String(contaId));
  if (!ext || !conta) return;
  const resposta = typeof abrirConfirmacaoSistema === 'function'
    ? await abrirConfirmacaoSistema({ title:'Conciliar valores', subtitle:'O valor será atualizado; observação, categoria e demais dados serão mantidos.', body:`${ifEsc(conta.observacao || 'Conta')}<br><strong>${ifMoeda(conta.valor_compra)} → ${ifMoeda(ext.valor)}</strong>`, confirmText:'Conciliar' })
    : { confirmado: window.confirm(`Atualizar o valor de ${ifMoeda(conta.valor_compra)} para ${ifMoeda(ext.valor)}?`) };
  if (!resposta?.confirmado) return;
  const { error } = await sb.from('contasapagar').update({ valor_compra: Number(ext.valor) }).eq('id', conta.id).is('excluido_em', null);
  if (error) { ifConcMsg(`Não foi possível conciliar: ${error.message}`, 'err'); return; }
  conta.valor_compra = Number(ext.valor); ext.status = 'localizado';
  ifConcRenderResultado(); ifConcMsg('Conta conciliada. Somente o valor foi atualizado; os demais dados foram preservados.', 'ok');
}
function ifConcCadastrar(extId) {
  const ext = IFConciliacao.itensArquivo.find(i => i.id === extId);
  if (!ext) return;
  if (typeof ncAbrir !== 'function') { abrirPagina('financeiro_contasapagar', document.querySelector('[data-page="financeiro_contasapagar"]')); return; }
  ncAbrir();
  setTimeout(() => {
    if (typeof ncSelForn === 'function') ncSelForn(IFConciliacao.fornecedorId, IFConciliacao.fornecedorNome);
    NC.dataCompra = ext.data || new Date().toISOString().slice(0,10);
    NC.dataVenc = ext.data || NC.dataCompra; NC.valor = Number(ext.valor); NC.obs = ext.descricao;
    const campos = { ncDataCompra:NC.dataCompra, ncVencCustom:NC.dataVenc, ncValor:ifMoeda(NC.valor), ncObs:NC.obs };
    Object.entries(campos).forEach(([id,v]) => { const el=document.getElementById(id); if(el) el.value=v; });
    if (typeof ncVencCust === 'function') ncVencCust();
    if (typeof ncObsInput === 'function') ncObsInput(document.getElementById('ncObs'));
  }, 80);
}
async function ifConcExcluirConta(id) {
  const conta = IFConciliacao.contas.find(c => String(c.id) === String(id));
  if (!conta || typeof excluirContaAPagarFinanceiro !== 'function') return;
  if (typeof contasAPagarFinanceiroCache !== 'undefined' && !contasAPagarFinanceiroCache.some(c => String(c.id) === String(id))) contasAPagarFinanceiroCache.push(conta);
  await excluirContaAPagarFinanceiro(id);
  await ifConcComparar();
}

function carregarPaginaIntegracoesFinanceiras(pageId) {
  const pagina = INTEGRACOES_FINANCEIRAS_PAGINAS[pageId];
  const container = document.querySelector(`#${pageId} .if-page-content`);
  if (!pagina || !container) return;
  if (pageId === 'integracoes_financeiras_conciliacao') {
    if (container.dataset.rendered !== 'true') renderizarConciliacaoFinanceira(container);
    else ifConcCarregarFornecedores();
  } else if (container.dataset.rendered !== 'true') {
    if (pageId === 'integracoes_financeiras_dashboard') renderizarDashboardIntegracoesFinanceiras(container);
    else renderizarPaginaEstruturalIntegracoesFinanceiras(container, pagina);
  }
  container.dataset.rendered = 'true';
}

window.INTEGRACOES_FINANCEIRAS_PAGINAS = INTEGRACOES_FINANCEIRAS_PAGINAS;
window.integracoesFinanceirasProviders = integracoesFinanceirasProviders;
window.FinanceAI = FinanceAI;
window.carregarPaginaIntegracoesFinanceiras = carregarPaginaIntegracoesFinanceiras;
window.ifConcSelecionarFornecedor = ifConcSelecionarFornecedor;
window.ifConcReceberArquivo = ifConcReceberArquivo;
window.ifConcTrocarPar = ifConcTrocarPar;
window.ifConcConciliar = ifConcConciliar;
window.ifConcCadastrar = ifConcCadastrar;
window.ifConcExcluirConta = ifConcExcluirConta;
