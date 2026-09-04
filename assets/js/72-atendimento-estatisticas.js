const GOOGLE_BUSINESS_FUNCTION = 'google-business';
let atendimentoCarregando = false;
let atendimentoModoSimulado = false;

function atendimentoEscape(valor = '') {
  const el = document.createElement('div');
  el.textContent = String(valor ?? '');
  return el.innerHTML;
}

function atendimentoContexto() {
  return {
    empresa_id: String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || ''),
    loja_id: String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || ''),
    usuario_id: String(usuarioSistemaLogado?.id || ''),
  };
}

async function invocarGoogleBusiness(action, payload = {}) {
  const { data, error } = await sb.functions.invoke(GOOGLE_BUSINESS_FUNCTION, {
    body: { action, ...atendimentoContexto(), ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || {};
}

function mensagemGoogleBusiness(erro) {
  const detalhe = String(erro?.message || erro || '');
  console.error('Google Business:', erro);
  if (/AUTH_REQUIRED|ACCESS_DENIED|INVALID_CONTEXT|401|403/i.test(detalhe)) return 'Sua sessão não está autorizada para esta loja. Entre novamente e tente outra vez.';
  if (/refresh_token|invalid_grant|token/i.test(detalhe)) return 'A autorização do Google expirou ou foi revogada. Reconecte a conta Google.';
  if (/Nenhuma conta|Business Profile/i.test(detalhe)) return 'Esta conta Google não possui um Perfil da Empresa disponível.';
  if (/location|localiza/i.test(detalhe)) return 'A localização do Google vinculada à loja não foi encontrada.';
  if (/Failed to send|FunctionsHttpError|fetch/i.test(detalhe)) return 'Não foi possível comunicar com a integração do Google agora. Tente novamente.';
  return 'Não foi possível concluir a operação com o Google Business. Tente novamente.';
}

function mostrarAvisoAtendimento(texto = '', erro = false) {
  const box = document.getElementById('atendimentoAviso');
  if (!box) return;
  box.hidden = !texto;
  box.textContent = texto;
  box.classList.toggle('erro', !!erro);
}

async function conectarGoogleAtendimento() {
  try {
    mostrarAvisoAtendimento('Abrindo a autorização segura do Google…');
    const retorno = await invocarGoogleBusiness('auth-url', { return_url: `${location.origin}${location.pathname}?pagina=estatisticas_atendimento` });
    if (!retorno.url) throw new Error('A função não retornou a URL de autorização.');
    location.href = retorno.url;
  } catch (erro) {
    mostrarAvisoAtendimento(mensagemGoogleBusiness(erro), true);
  }
}

async function sincronizarGoogleAtendimento() {
  try {
    mostrarAvisoAtendimento('Sincronizando contas, locais e avaliações com o Google…');
    await invocarGoogleBusiness('sync');
    mostrarAvisoAtendimento('Sincronização concluída.');
    await carregarEstatisticasAtendimento();
  } catch (erro) {
    mostrarAvisoAtendimento(mensagemGoogleBusiness(erro), true);
  }
}

async function carregarEstatisticasAtendimento() {
  if (atendimentoCarregando) return;
  atendimentoCarregando = true;
  try {
    const contexto = atendimentoContexto();
    const painel = await invocarGoogleBusiness('dashboard');
    atendimentoModoSimulado = painel.simulated === true;
    const locais = Array.isArray(painel.locais) ? painel.locais : [];
    let avaliacoes = Array.isArray(painel.avaliacoes) ? painel.avaliacoes : [];
    preencherLojasAtendimento(locais);

    const dias = Number(document.getElementById('atendimentoFiltroPeriodo')?.value || 30);
    const localId = document.getElementById('atendimentoFiltroLoja')?.value || '';
    const nota = document.getElementById('atendimentoFiltroNota')?.value || '';
    const situacao = document.getElementById('atendimentoFiltroSituacao')?.value || '';
    if (dias) {
      const limite = Date.now() - dias * 86400000;
      avaliacoes = avaliacoes.filter(item => new Date(item.criado_em).getTime() >= limite);
    }
    if (localId) avaliacoes = avaliacoes.filter(item => String(item.local_id) === localId);
    if (nota) avaliacoes = avaliacoes.filter(item => Number(item.nota) === Number(nota));
    if (situacao === 'pendente') avaliacoes = avaliacoes.filter(item => !String(item.resposta_texto || '').trim());
    if (situacao === 'respondida') avaliacoes = avaliacoes.filter(item => String(item.resposta_texto || '').trim());

    renderizarStatusAtendimento(painel.conexao || null);
    renderizarAtendimento(avaliacoes);
    const locaisDisponiveis = Array.isArray(painel.locais_disponiveis) ? painel.locais_disponiveis : [];
    if (locaisDisponiveis.length) {
      renderizarSelecaoLocalGoogle(locaisDisponiveis);
      return;
    }
    if (atendimentoModoSimulado) {
      mostrarAvisoAtendimento('Modo de demonstração: avaliações simuladas. Nenhuma consulta está sendo feita à API do Google.');
    }
    if (painel.lojas_autorizadas === 0) {
      mostrarAvisoAtendimento('Seu perfil não possui acesso às avaliações de nenhuma loja.', true);
    } else if (contexto.loja_id && !locais.length) {
      mostrarAvisoAtendimento('Nenhuma das lojas autorizadas está vinculada a um local do Google Business.');
    }
  } catch (erro) {
    console.warn('Falha ao carregar estatísticas de atendimento:', erro);
    mostrarAvisoAtendimento(mensagemGoogleBusiness(erro), true);
    renderizarAtendimento([]);
  } finally {
    atendimentoCarregando = false;
  }
}

function renderizarSelecaoLocalGoogle(locais) {
  const box = document.getElementById('atendimentoAviso');
  if (!box) return;
  box.hidden = false;
  box.classList.remove('erro');
  box.innerHTML = `<strong>Selecione o estabelecimento Google desta loja</strong>
    <select id="atendimentoLocalGoogle">${locais.map(local =>
      `<option value="${atendimentoEscape(local.id)}">${atendimentoEscape(local.nome || 'Local Google')}${local.endereco ? ` — ${atendimentoEscape(local.endereco)}` : ''}</option>`
    ).join('')}</select>
    <button class="btn btn-green btn-sm" type="button" onclick="vincularLocalGoogleAtendimento()">Vincular localização</button>`;
}

async function vincularLocalGoogleAtendimento() {
  const localId = document.getElementById('atendimentoLocalGoogle')?.value;
  if (!localId) return mostrarAvisoAtendimento('Selecione uma localização do Google.', true);
  try {
    await invocarGoogleBusiness('link-location', { local_id: localId });
    mostrarAvisoAtendimento('Localização vinculada. Sincronizando avaliações…');
    await sincronizarGoogleAtendimento();
  } catch (erro) {
    mostrarAvisoAtendimento(mensagemGoogleBusiness(erro), true);
  }
}

function preencherLojasAtendimento(locais) {
  const select = document.getElementById('atendimentoFiltroLoja');
  if (!select) return;
  const atual = select.value;
  const rotuloTodas = locais.length > 1 ? `Visão geral · ${locais.length} lojas` : 'Todas as lojas autorizadas';
  select.innerHTML = `<option value="">${rotuloTodas}</option>` + locais.map(l => `<option value="${atendimentoEscape(l.id)}">${atendimentoEscape(l.nome || 'Local Google')}</option>`).join('');
  if ([...select.options].some(o => o.value === atual)) select.value = atual;
}

function renderizarStatusAtendimento(conexao) {
  const el = document.getElementById('atendimentoSyncStatus');
  const btn = document.getElementById('btnConectarGoogleAtendimento');
  if (!el || !btn) return;
  if (atendimentoModoSimulado) { el.textContent = 'Dados simulados'; el.classList.remove('online'); btn.textContent = 'Configurar OAuth'; return; }
  if (!conexao) { el.textContent = 'Não conectado'; el.classList.remove('online'); btn.textContent = 'Conectar Google'; return; }
  const data = conexao.ultima_sincronizacao_em ? new Date(conexao.ultima_sincronizacao_em).toLocaleString('pt-BR') : 'aguardando sincronização';
  el.textContent = `Conectado · ${data}`;
  el.classList.add('online');
  btn.textContent = 'Reconectar';
}

function renderizarAtendimento(items) {
  const total = items.length;
  const soma = items.reduce((acc, item) => acc + Number(item.nota || 0), 0);
  const media = total ? soma / total : 0;
  const respondidas = items.filter(item => String(item.resposta_texto || '').trim()).length;
  const pendentes = total - respondidas;
  document.getElementById('atendimentoNota').textContent = total ? media.toFixed(1).replace('.', ',') : '—';
  document.getElementById('atendimentoTotal').textContent = total.toLocaleString('pt-BR');
  document.getElementById('atendimentoPeriodo').textContent = total.toLocaleString('pt-BR');
  document.getElementById('atendimentoTaxa').textContent = total ? `${Math.round(respondidas / total * 100)}%` : '0%';
  document.getElementById('atendimentoPendentes').textContent = `${pendentes} aguardando resposta`;
  document.getElementById('atendimentoNotaVariacao').textContent = total ? 'Média no período selecionado' : 'Sem dados do Google';
  renderizarDistribuicaoAtendimento(items);
  renderizarGraficosAtendimento(items);
  renderizarAvaliacoesAtendimento(items);
  verificarNovasAvaliacoesNegativas(items);
}

function verificarNovasAvaliacoesNegativas(items) {
  const chave = `checkdiario:google-reviews-vistas:${atendimentoContexto().empresa_id}`;
  const idsAtuais = items.slice(0, 100).map(item => String(item.id));
  let anteriores = null;
  try { anteriores = JSON.parse(localStorage.getItem(chave) || 'null'); } catch (_) {}
  try { localStorage.setItem(chave, JSON.stringify(idsAtuais)); } catch (_) {}
  if (!Array.isArray(anteriores)) return;
  const novasNegativas = items.filter(item => Number(item.nota) <= 2 && !anteriores.includes(String(item.id)));
  if (!novasNegativas.length) return;
  mostrarAvisoAtendimento(`${novasNegativas.length} nova${novasNegativas.length > 1 ? 's' : ''} avaliação${novasNegativas.length > 1 ? 'ões' : ''} negativa${novasNegativas.length > 1 ? 's' : ''} recebida${novasNegativas.length > 1 ? 's' : ''}.`, true);
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.setValueAtTime(390, ctx.currentTime + .18);
    gain.gain.setValueAtTime(.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + .42);
  } catch (_) {}
}

function renderizarDistribuicaoAtendimento(items) {
  const host = document.getElementById('atendimentoDistribuicao');
  if (!host) return;
  host.innerHTML = [5,4,3,2,1].map(nota => {
    const quantidade = items.filter(i => Number(i.nota) === nota).length;
    const percentual = items.length ? quantidade / items.length * 100 : 0;
    return `<div class="atendimento-star-row"><span class="atendimento-star-label">${nota} ★</span><div class="atendimento-star-track"><div class="atendimento-star-fill" style="width:${percentual}%"></div></div><span class="atendimento-star-count">${quantidade}</span></div>`;
  }).join('');
}

function agruparMesesAtendimento(items) {
  const mapa = new Map();
  items.forEach(item => {
    const data = new Date(item.criado_em);
    if (Number.isNaN(data.getTime())) return;
    const chave = `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`;
    const grupo = mapa.get(chave) || { chave, soma: 0, total: 0 };
    grupo.soma += Number(item.nota || 0); grupo.total++; mapa.set(chave, grupo);
  });
  return [...mapa.values()].sort((a,b) => a.chave.localeCompare(b.chave)).slice(-12);
}

function renderizarGraficosAtendimento(items) {
  const grupos = agruparMesesAtendimento(items);
  const evolucao = document.getElementById('atendimentoGraficoEvolucao');
  const volume = document.getElementById('atendimentoGraficoVolume');
  if (!grupos.length) {
    evolucao.className = volume.className = 'atendimento-chart-empty';
    evolucao.textContent = volume.textContent = 'Aguardando avaliações sincronizadas.';
    return;
  }
  const w=720,h=210,p=34,dx=(w-p*2)/Math.max(grupos.length-1,1);
  const pontos = grupos.map((g,i) => `${p+i*dx},${h-p-((g.soma/g.total-1)/4)*(h-p*2)}`).join(' ');
  const labels = grupos.map((g,i) => `<text x="${p+i*dx}" y="${h-8}" text-anchor="middle">${g.chave.slice(5)}/${g.chave.slice(2,4)}</text>`).join('');
  evolucao.className=''; evolucao.innerHTML=`<svg class="atendimento-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="atArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#22c55e" stop-opacity=".3"/><stop offset="1" stop-color="#22c55e" stop-opacity="0"/></linearGradient></defs><polyline points="${p},${h-p} ${pontos} ${w-p},${h-p}" fill="url(#atArea)" stroke="none"/><polyline points="${pontos}" fill="none" stroke="#22c55e" stroke-width="3" vector-effect="non-scaling-stroke"/>${labels}</svg>`;
  const max=Math.max(...grupos.map(g=>g.total),1), bw=(w-p*2)/grupos.length*.55;
  const barras=grupos.map((g,i)=>{const bh=g.total/max*(h-p*2);return `<rect x="${p+i*((w-p*2)/grupos.length)+bw*.4}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="4" fill="#4285f4"/><text x="${p+i*((w-p*2)/grupos.length)+bw*.9}" y="${h-p-bh-7}" text-anchor="middle">${g.total}</text>`}).join('');
  volume.className=''; volume.innerHTML=`<svg class="atendimento-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${barras}${labels}</svg>`;
}

function renderizarAvaliacoesAtendimento(items) {
  const host = document.getElementById('atendimentoAvaliacoesLista');
  const resumo = document.getElementById('atendimentoListaResumo');
  if (!host) return;
  resumo.textContent = `${items.length} avaliação${items.length === 1 ? '' : 'ões'} encontrada${items.length === 1 ? '' : 's'}`;
  if (!items.length) { host.innerHTML='<div class="atendimento-vazio"><strong>Nenhuma avaliação encontrada</strong><span>Ajuste os filtros ou sincronize com o Google.</span></div>'; return; }
  host.innerHTML = items.slice(0,100).map(item => {
    const nome = item.avaliador_nome || 'Cliente do Google';
    const inicial = nome.trim().charAt(0).toUpperCase() || 'G';
    const estrelas = '★'.repeat(Number(item.nota || 0)) + '☆'.repeat(5-Number(item.nota || 0));
    const resposta = item.resposta_texto ? `<div class="atendimento-resposta"><strong>Resposta da empresa</strong>${atendimentoEscape(item.resposta_texto)}</div>` : `<div class="atendimento-reply-form"><textarea id="resposta-${item.id}" maxlength="4096" placeholder="Escreva uma resposta pública…"></textarea><button class="btn btn-green btn-sm" onclick="responderAvaliacaoGoogle('${item.id}')">Responder</button></div>`;
    return `<article class="atendimento-review"><div class="atendimento-review-top"><div class="atendimento-review-user"><div class="atendimento-avatar">${atendimentoEscape(inicial)}</div><div><h4>${atendimentoEscape(nome)}</h4><span class="atendimento-stars">${estrelas}</span> · <small>${atendimentoEscape(item.google_business_locais?.nome || 'Google')}</small></div></div><time>${new Date(item.criado_em).toLocaleDateString('pt-BR')}</time></div>${item.comentario ? `<p class="atendimento-review-text">${atendimentoEscape(item.comentario)}</p>` : ''}${resposta}</article>`;
  }).join('');
}

async function responderAvaliacaoGoogle(id) {
  if (atendimentoModoSimulado) return mostrarAvisoAtendimento('Esta é uma avaliação simulada. A publicação de respostas será habilitada após a liberação da API.', true);
  const campo = document.getElementById(`resposta-${id}`);
  const resposta = campo?.value.trim();
  if (!resposta) return mostrarAvisoAtendimento('Digite a resposta antes de enviar.', true);
  try {
    campo.disabled = true;
    await invocarGoogleBusiness('reply', { avaliacao_id: id, resposta });
    mostrarAvisoAtendimento('Resposta publicada no Google.');
    await carregarEstatisticasAtendimento();
  } catch (erro) {
    campo.disabled = false;
    mostrarAvisoAtendimento(mensagemGoogleBusiness(erro), true);
  }
}
