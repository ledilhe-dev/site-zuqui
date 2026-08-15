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
  pares: new Map(), processando: false, filtro: 'todos', leitura: null, importacaoId: null,
  contaEmCadastro: null,
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
    IFConciliacao.leitura = null;
    if (nome.endsWith('.ofx') || nome.endsWith('.qfx')) {
      itens = await ifConcLerOFX(file);
      IFConciliacao.leitura = { leitor:'OFX estruturado', confianca_documento:1, alertas:[] };
    } else if (nome.endsWith('.pdf') || file.type === 'application/pdf') {
      const ia = await ifConcLerComIA(file);
      if (ia?.itens?.length) { itens = ia.itens; IFConciliacao.leitura = ia.meta; }
      else { itens = await ifConcLerPDF(file); IFConciliacao.leitura = { leitor:'Texto do PDF', confianca_documento:.72, alertas:['IA indisponível: confirme os lançamentos antes de concluir.'] }; }
    } else if (/^image\//i.test(file.type)) {
      const ia = await ifConcLerComIA(file);
      if (ia?.itens?.length) { itens = ia.itens; IFConciliacao.leitura = ia.meta; }
      else { itens = await ifConcLerImagem(file); IFConciliacao.leitura = { leitor:'OCR local', confianca_documento:.62, alertas:['Leitura por OCR local: confira datas e valores.'] }; }
    }
    else throw new Error('Formato não aceito. Use PDF, imagem, OFX ou QFX.');
    IFConciliacao.itensArquivo = ifConcDeduplicar(itens).map((item, indice) => ({ ...item, id: `ext_${indice}`, status: 'pendente' }));
    if (!IFConciliacao.itensArquivo.length) throw new Error('Não encontrei lançamentos no arquivo. Confira a qualidade ou o formato da fatura.');
    await ifConcRegistrarImportacao(file);
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

async function ifConcHashArquivo(file) {
  if (!crypto?.subtle) return `${file.name}:${file.size}:${file.lastModified}`;
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function ifConcRegistrarImportacao(file) {
  try {
    const empresaId = usuarioSistemaLogado?.empresa_id || null;
    const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
    if (!empresaId || !lojaId) throw new Error('Loja não identificada.');
    const nome = file.name.toLowerCase();
    const tipo = nome.endsWith('.pdf') ? 'pdf' : nome.endsWith('.ofx') ? 'ofx' : nome.endsWith('.qfx') ? 'qfx' : 'imagem';
    const leitura = IFConciliacao.leitura || {};
    const ator = typeof obterAtorAuditoriaAtual === 'function' ? obterAtorAuditoriaAtual() : {};
    const payload = {
      empresa_id:empresaId, loja_id:lojaId, fornecedor_id:IFConciliacao.fornecedorId,
      arquivo_nome:file.name, arquivo_tipo:tipo, arquivo_hash:await ifConcHashArquivo(file),
      arquivo_mime:file.type || null, arquivo_tamanho:file.size,
      leitor:String(leitura.leitor || '').startsWith('IA') ? 'openai' : tipo === 'ofx' || tipo === 'qfx' ? 'ofx' : tipo === 'pdf' ? 'pdf_texto' : 'ocr_local',
      status:'revisao', total_documento:leitura.total_documento ?? null,
      total_lancamentos:IFConciliacao.itensArquivo.reduce((s,i) => s + Number(i.valor || 0), 0),
      confianca:leitura.confianca_documento || null, alertas:leitura.alertas || [],
      metadados:{ response_id:leitura.response_id || null },
      conteudo_extraido:{ leitor:leitura.leitor || null, total_documento:leitura.total_documento ?? null, quantidade:IFConciliacao.itensArquivo.length },
      criado_por_id:ator?.funcionarioId || null,
      criado_por_nome:ator?.nome || usuarioSistemaLogado?.nome || 'Sistema',
    };
    const { data:importacao, error } = await sb.from('conciliacao_importacoes')
      .upsert(payload, { onConflict:'loja_id,arquivo_hash' }).select('id').single();
    if (error) throw error;
    IFConciliacao.importacaoId = importacao.id;
    const linhas = IFConciliacao.itensArquivo.map((i,ordem) => ({
      importacao_id:importacao.id, empresa_id:empresaId, loja_id:lojaId, ordem,
      data_movimento:i.data || null, descricao:i.descricao, valor:Number(i.valor), tipo:'debito',
      identificador_bancario:i.fitid || null, texto_evidencia:i.evidencia || null,
      pagina:i.pagina || null, confianca:i.confianca ?? null, status:'pendente',
    }));
    const { error:erroItens } = await sb.from('conciliacao_importacao_itens').upsert(linhas, { onConflict:'importacao_id,ordem' });
    if (erroItens) throw erroItens;
  } catch (e) {
    console.warn('Não foi possível registrar a sessão de conciliação:', e?.message || e);
    IFConciliacao.importacaoId = null;
  }
}

async function ifConcArquivoBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = '';
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) binario += String.fromCharCode(...bytes.subarray(i, i + bloco));
  return btoa(binario);
}
async function ifConcLerComIA(file) {
  if (file.size > 20 * 1024 * 1024 || !sb?.functions?.invoke) return null;
  try {
    ifConcMsg('Leitura inteligente em alta fidelidade...', '');
    const empresaId = usuarioSistemaLogado?.empresa_id || null;
    const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
    if (!empresaId || !lojaId) throw new Error('Loja da sessão não identificada.');
    const { data, error } = await sb.functions.invoke('conciliacao-leitor-ia', { body: {
      arquivo_base64: await ifConcArquivoBase64(file),
      mime_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      arquivo_nome: file.name, empresa_id: empresaId, loja_id: lojaId, fornecedor_id: IFConciliacao.fornecedorId,
    }});
    if (error || !data?.lancamentos) throw error || new Error(data?.error || 'Resposta inválida da IA.');
    const itens = data.lancamentos
      .filter(i => ['debito','tarifa','juros','outro'].includes(i.tipo) && Number(i.valor) > 0)
      .map(i => ({
        data:i.data || '', descricao:i.descricao, valor:Number(i.valor), fitid:i.identificador || null,
        confianca:Number(i.confianca || 0), evidencia:i.texto_evidencia || '', pagina:i.pagina || null,
        parcela_atual:i.parcela_atual || null, total_parcelas:i.parcelas_total || null,
      }));
    const soma = itens.reduce((s,i) => s + Number(i.valor || 0), 0);
    const alertas = [...(data.alertas || [])];
    if (data.total_documento != null && Math.abs(soma - Number(data.total_documento)) > .01) {
      alertas.push(`A soma dos lançamentos (${ifMoeda(soma)}) difere do total identificado (${ifMoeda(data.total_documento)}).`);
    }
    return { itens, meta:{
      leitor:`IA · ${data.modelo || 'OpenAI'}`, confianca_documento:Number(data.confianca_documento || 0),
      total_documento:data.total_documento, alertas, response_id:data.response_id || null,
    }};
  } catch (e) {
    console.warn('Leitor de IA indisponível; usando fallback local:', e?.message || e);
    return null;
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
    .select('id,ofx_fitid,valor_original,valor_compra,valor_pago,data_compra,data_vencimento,data_pagamento,observacao,fornecedor_id,categoria_id,numero_parcela,qtd_parcelas,loja_id,fornecedores(nome)')
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
      const fitidIgual = !!ext.fitid && String(c.ofx_fitid || '') === String(ext.fitid);
      const valorIgual = ifCentavos(c.valor_compra) === ifCentavos(ext.valor);
      const dias = Math.min(ifDiffDias(c.data_compra, ext.data), ifDiffDias(c.data_vencimento, ext.data));
      const nome = ifNorm(`${c.observacao || ''} ${c.fornecedores?.nome || ''}`);
      const termos = ifNorm(ext.descricao).split(' ').filter(t => t.length > 2);
      const textoScore = termos.length ? termos.filter(t => nome.includes(t)).length / termos.length : 0;
      return { conta:c, fitidIgual, valorIgual, dias, textoScore, score:(fitidIgual ? 1000 : 0) + (valorIgual ? 100 : 0) + (dias <= 5 ? 25 - dias : 0) + textoScore * 20 };
    }).sort((a,b) => b.score - a.score);
    const melhor = candidatos[0];
    if (melhor && (melhor.fitidIgual || melhor.valorIgual || melhor.score >= 25)) {
      IFConciliacao.pares.set(ext.id, String(melhor.conta.id));
      usados.add(String(melhor.conta.id));
      ext.status = melhor.fitidIgual || melhor.valorIgual ? 'localizado' : 'divergente';
      ext.scoreCorrespondencia = melhor.fitidIgual ? 1 : Math.min(.99, melhor.score / 145);
      ext.criteriosCorrespondencia = { fitid:melhor.fitidIgual, valor:melhor.valorIgual, dias:melhor.dias, descricao:Number(melhor.textoScore.toFixed(3)) };
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
  const leitura = IFConciliacao.leitura || {};
  const confiancaPct = Math.round(Number(leitura.confianca_documento || 0) * 100);
  root.innerHTML = `
    <div class="if-conc-quality ${confiancaPct >= 90 && !(leitura.alertas || []).length ? 'ok' : 'alerta'}">
      <div><strong>${ifEsc(leitura.leitor || 'Leitor do arquivo')}</strong><span>Confiança do documento: ${confiancaPct || '—'}%</span></div>
      ${(leitura.alertas || []).length ? `<ul>${leitura.alertas.map(a => `<li>${ifEsc(a)}</li>`).join('')}</ul>` : '<span>Leitura validada sem alertas estruturais.</span>'}
    </div>
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
  const conf = ext.confianca == null ? null : Math.round(Number(ext.confianca) * 100);
  return `<div class="if-conc-row ${localizado ? 'localizado' : 'divergente'}">
    <div class="if-conc-item"><span class="if-conc-status">${localizado ? '✓' : '!'}</span><div><strong>${ifEsc(ext.descricao)}</strong><span>${ifData(ext.data)} · ${ifMoeda(ext.valor)}</span></div></div>
    <div class="if-conc-link">${conta ? (localizado ? '＝' : '≠') : '→'}</div>
    <div class="if-conc-system">
      <select onchange="ifConcTrocarPar('${ifEsc(ext.id)}',this.value)">${opts}</select>
      ${conta ? `<div class="if-conc-system-info"><span>${ifEsc(conta.observacao || conta.fornecedores?.nome || 'Conta')}</span><strong>${ifMoeda(conta.valor_compra)}</strong></div>` : '<span class="if-conc-nao-achou">Nenhuma conta correspondente</span>'}
      ${conf != null ? `<div class="if-conc-evidence"><span class="${conf >= 90 ? 'alta' : conf >= 70 ? 'media' : 'baixa'}">${conf}% confiança</span>${ext.pagina ? `<small>Página ${ext.pagina}</small>` : ''}${ext.evidencia ? `<small title="${ifEsc(ext.evidencia)}">Ver evidência</small>` : ''}</div>` : ''}
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
  const valorAnterior = Number(conta.valor_compra);
  const resposta = typeof abrirConfirmacaoSistema === 'function'
    ? await abrirConfirmacaoSistema({ title:'Conciliar valores', subtitle:'O valor será atualizado; observação, categoria e demais dados serão mantidos.', body:`${ifEsc(conta.observacao || 'Conta')}<br><strong>${ifMoeda(conta.valor_compra)} → ${ifMoeda(ext.valor)}</strong>`, confirmText:'Conciliar' })
    : { confirmado: window.confirm(`Atualizar o valor de ${ifMoeda(conta.valor_compra)} para ${ifMoeda(ext.valor)}?`) };
  if (!resposta?.confirmado) return;
  const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
  const ator = typeof obterAtorAuditoriaAtual === 'function' ? obterAtorAuditoriaAtual() : {};
  const ordem = IFConciliacao.itensArquivo.indexOf(ext);
  const { data:itemDb } = IFConciliacao.importacaoId
    ? await sb.from('conciliacao_importacao_itens').select('id').eq('importacao_id',IFConciliacao.importacaoId).eq('ordem',ordem).maybeSingle()
    : { data:null };
  const { error } = await sb.rpc('conciliar_conta_pagar_com_arquivo', {
    p_loja_id:lojaId, p_conta_pagar_id:conta.id, p_importacao_id:IFConciliacao.importacaoId || null,
    p_item_id:itemDb?.id || null, p_valor_arquivo:Number(ext.valor),
    p_ator_id:ator?.funcionarioId || null, p_ator_nome:ator?.nome || usuarioSistemaLogado?.nome || 'Sistema',
  });
  if (error) { ifConcMsg(`Não foi possível conciliar: ${error.message}`, 'err'); return; }
  conta.valor_compra = Number(ext.valor);
  if (conta.data_pagamento) conta.valor_pago = Number(ext.valor);
  ext.status = 'localizado';
  ifConcRenderResultado(); ifConcMsg('Conta conciliada. Somente o valor foi atualizado; os demais dados foram preservados.', 'ok');
}
async function ifConcCadastrar(extId) {
  const ext = IFConciliacao.itensArquivo.find(i => i.id === extId);
  if (!ext) return;
  const resposta = typeof abrirConfirmacaoSistema === 'function'
    ? await abrirConfirmacaoSistema({
        title:'Conta a pagar não encontrada',
        subtitle:'Não encontramos uma conta a pagar correspondente a este lançamento. Deseja cadastrá-la agora?',
        body:`<div class="if-conc-cadastro-resumo"><strong>${ifEsc(ext.descricao || 'Lançamento')}</strong><span>${ifData(ext.data)} · ${ifMoeda(ext.valor)}</span></div>`,
        cancelText:'Continuar sem cadastrar', cancelClass:'btn-ghost',
        confirmText:'Cadastrar conta a pagar', confirmClass:'btn-green',
      })
    : { confirmado: window.confirm('Conta a pagar não encontrada. Deseja cadastrá-la agora?') };
  if (!resposta?.confirmado) return;
  IFConciliacao.contaEmCadastro = { extId:ext.id };
  if (typeof abrirPagina === 'function') abrirPagina('financeiro_contasapagar', document.querySelector('[data-page="financeiro_contasapagar"]'));
  if (typeof ncAbrir !== 'function') return;
  ncAbrir();
  setTimeout(() => {
    if (typeof ncSelForn === 'function') ncSelForn(IFConciliacao.fornecedorId, IFConciliacao.fornecedorNome);
    const dataConfiavel = /^\d{4}-\d{2}-\d{2}$/.test(String(ext.data || '').slice(0,10)) ? String(ext.data).slice(0,10) : '';
    if (dataConfiavel) { NC.dataCompra = dataConfiavel; NC.dataVenc = dataConfiavel; }
    if (Number(ext.valor) > 0) NC.valor = Number(ext.valor);
    if (String(ext.descricao || '').trim()) NC.obs = String(ext.descricao).trim();
    const campos = { ncDataCompra:NC.dataCompra, ncVencCustom:NC.dataVenc, ncValor:NC.valor == null ? '' : ifMoeda(NC.valor), ncObs:NC.obs };
    Object.entries(campos).forEach(([id,v]) => { const el=document.getElementById(id); if(el) el.value=v; });
    if (typeof ncVencCust === 'function') ncVencCust();
    if (typeof ncObsInput === 'function') ncObsInput(document.getElementById('ncObs'));
  }, 80);
}
async function ifConcContaCadastrada(resultado = {}) {
  const retorno = IFConciliacao.contaEmCadastro;
  if (!retorno) return false;
  IFConciliacao.contaEmCadastro = null;
  if (typeof abrirPagina === 'function') abrirPagina('integracoes_financeiras_conciliacao', document.querySelector('[data-page="integracoes_financeiras_conciliacao"]'));
  try {
    await ifConcComparar();
    const novaId = (resultado.ids || [])[0];
    const ext = IFConciliacao.itensArquivo.find(item => String(item.id) === String(retorno.extId));
    const novaConta = novaId ? IFConciliacao.contas.find(conta => String(conta.id) === String(novaId)) : null;
    if (ext && novaConta) {
      IFConciliacao.pares.set(ext.id, String(novaConta.id));
      ext.status = ifCentavos(ext.valor) === ifCentavos(novaConta.valor_compra) ? 'localizado' : 'divergente';
      ifConcRenderResultado();
    }
    ifConcMsg('Conta cadastrada. A conciliação foi atualizada sem refazer a importação.', 'ok');
  } catch (error) {
    console.error('Conta salva, mas a conciliação não pôde ser atualizada:', error);
    ifConcMsg('Conta cadastrada. Atualize a comparação para carregá-la na conciliação.', 'err');
  }
  return true;
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
window.ifConcContaCadastrada = ifConcContaCadastrada;
window.ifConcExcluirConta = ifConcExcluirConta;
