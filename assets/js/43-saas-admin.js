// ADMINISTRAÇÃO SAAS - EMPRESAS E LOJAS
//
let empresasSaasCache = [];
let lojasSaasCache = [];
let empresaSaasEmEdicaoId = null;
let lojaSaasEmEdicaoId = null;
let copiaDadosEntreLojasEmAndamento = false;
let painelAdminGlobalCache = null;
let connectorPairCountdownTimer = null;
let connectorPairCurrentCode = '';

async function obterDadosPainelAdminGlobal({ renovar = false } = {}) {
  if (!contextoEhAdminGlobal() || usuarioSistemaLogado?.global_admin_authorized !== true) throw new Error('Contexto administrativo global não autorizado.');
  if (painelAdminGlobalCache && !renovar) return painelAdminGlobalCache;
  const { data, error } = await sb.rpc('obter_painel_admin_global', {
    p_funcionario_id:usuarioSistemaLogado.id,
    p_token:usuarioSistemaLogado.global_admin_token,
  });
  if (error) throw error;
  painelAdminGlobalCache = data || { empresas:[], lojas:[], usuarios:[], conectores:[] };
  return painelAdminGlobalCache;
}

async function carregarDashboardSaas() {
  const alvo=document.getElementById('dashboardSaasMetricas'),msg=document.getElementById('msgDashboardSaas');
  if(!alvo)return;
  try {
    const dados=await obterDadosPainelAdminGlobal({renovar:true});
    const empresas=dados.empresas||[],lojas=dados.lojas||[],usuarios=dados.usuarios||[],conectores=dados.conectores||[];
    const online=conectores.filter(item=>item.status==='ativa'&&item.ultima_sincronizacao_em&&(Date.now()-new Date(item.ultima_sincronizacao_em).getTime()<150000)).length;
    const cards=[['Empresas',empresas.length],['Lojas / filiais',lojas.length],['Usuários ativos',usuarios.filter(x=>x.ativo!==false).length],['Conectores',conectores.length],['Conectores online',online],['Conectores offline',Math.max(0,conectores.length-online)]];
    alvo.innerHTML=cards.map(([label,value])=>`<div class="card"><div class="card-title">${escaparHtmlBasico(label)}</div><div style="font-size:32px;font-weight:800">${Number(value)}</div></div>`).join('');
    if(msg){msg.className='msg ok';msg.textContent='Métricas carregadas diretamente da administração SaaS.';}
  } catch(error){alvo.innerHTML='<div class="card"><div class="empty">Acesso administrativo não autorizado.</div></div>';if(msg){msg.className='msg err';msg.textContent=mensagemErroSupabase(error,'Falha ao carregar o painel SaaS.');}}
}

async function carregarUsuariosSaas() {
  const alvo=document.getElementById('listaUsuariosSaas');if(!alvo)return;
  try { const dados=await obterDadosPainelAdminGlobal(); const empresas=new Map((dados.empresas||[]).map(x=>[String(x.id),nomeEmpresaSaas(x)]));const lojas=new Map((dados.lojas||[]).map(x=>[String(x.id),nomeLojaSaas(x)]));
    alvo.innerHTML=(dados.usuarios||[]).length?'<div class="lista">'+dados.usuarios.map(x=>`<div class="item"><div class="item-info"><div class="item-nome">${escaparHtmlBasico(x.nome||x.email||'Usuário')}</div><div class="item-detalhe">${escaparHtmlBasico(empresas.get(String(x.empresa_id))||'Sem empresa')} · ${escaparHtmlBasico(lojas.get(String(x.loja_id))||'Sem loja')} · ${x.ativo===false?'Inativo':'Ativo'}</div></div></div>`).join('')+'</div>':'<div class="empty">Nenhum usuário encontrado.</div>';
  } catch(error){alvo.innerHTML=`<div class="empty">${escaparHtmlBasico(mensagemErroSupabase(error,'Acesso negado.'))}</div>`;}
}

async function carregarConectoresSaas() {
  const alvo=document.getElementById('listaConectoresSaas');if(!alvo)return;
  try { const dados=await obterDadosPainelAdminGlobal({renovar:true}); const empresas=new Map((dados.empresas||[]).map(x=>[String(x.id),nomeEmpresaSaas(x)]));const lojas=new Map((dados.lojas||[]).map(x=>[String(x.id),nomeLojaSaas(x)]));
    const select=document.getElementById('connectorPairEmpresa');if(select){const atual=select.value;select.innerHTML='<option value="">- Selecione -</option>'+(dados.empresas||[]).filter(x=>x.ativo!==false).map(x=>`<option value="${escaparHtmlBasico(x.id)}">${escaparHtmlBasico(nomeEmpresaSaas(x))}</option>`).join('');if([...select.options].some(o=>o.value===atual))select.value=atual;}
    const vinculos=dados.conectores||[],instancias=dados.connector_instances||[];
    alvo.innerHTML=instancias.length?'<div class="lista">'+instancias.map(x=>{const relacionados=vinculos.filter(v=>String(v.connector_instance_id||'')===String(x.id));const nomesLojas=relacionados.map(v=>`${lojas.get(String(v.loja_id))||'Loja'} (Filial ${Number(v.raffinato_filial_id||1)})`).join(', ')||'Nenhuma filial vinculada';const contato=x.ultimo_contato_em?new Date(x.ultimo_contato_em).toLocaleString('pt-BR'):'Nunca';return `<div class="item"><div class="item-info"><div class="item-nome">${escaparHtmlBasico(x.nome||'Conector Raffinato')} · ${String(x.status||'offline').toUpperCase()}</div><div class="item-detalhe">Empresa: ${escaparHtmlBasico(empresas.get(String(x.empresa_id))||'-')} · Versão: ${escaparHtmlBasico(x.versao||'-')} · Último contato: ${escaparHtmlBasico(contato)}<br>Instalação: ${escaparHtmlBasico(x.id)} · Perfis: ${Number(x.perfis_cadastrados||0)} · Filiais: ${Number(x.filiais_vinculadas||0)}<br>${escaparHtmlBasico(nomesLojas)}</div></div></div>`}).join('')+'</div>':'<div class="empty">Nenhuma instalação física pareada.</div>';
  } catch(error){alvo.innerHTML=`<div class="empty">${escaparHtmlBasico(mensagemErroSupabase(error,'Acesso negado.'))}</div>`;}
}

async function gerarCodigoPareamentoConector(){
  const empresaId=String(document.getElementById('connectorPairEmpresa')?.value||'').trim(),msg=document.getElementById('connectorPairCode');
  if(!empresaId){if(msg){msg.className='msg err';msg.textContent='Selecione uma empresa.';}return;}
  try{const {data,error}=await sb.rpc('gerar_codigo_pareamento_raffinato',{p_funcionario_id:usuarioSistemaLogado.id,p_token:usuarioSistemaLogado.global_admin_token,p_empresa_id:empresaId});if(error)throw error;connectorPairCurrentCode=String(data.codigo||'').trim();renderizarCodigoPareamentoConector(data.expira_em);if(connectorPairCountdownTimer)clearInterval(connectorPairCountdownTimer);connectorPairCountdownTimer=setInterval(()=>renderizarCodigoPareamentoConector(data.expira_em),1000);}catch(error){msg.className='msg err';msg.textContent=mensagemErroSupabase(error,'Não foi possível gerar o código.');}
}

function renderizarCodigoPareamentoConector(expiraEm){
  const msg=document.getElementById('connectorPairCode');if(!msg||!connectorPairCurrentCode)return;
  const restante=Math.max(0,new Date(expiraEm).getTime()-Date.now()),segundos=Math.ceil(restante/1000),expirado=segundos<=0,min=String(Math.floor(segundos/60)).padStart(2,'0'),seg=String(segundos%60).padStart(2,'0');
  msg.className=`connector-pair-result ${expirado?'is-expired':'is-waiting'}`;
  msg.innerHTML=`<div class="connector-pair-state">${expirado?'EXPIRADO':'AGUARDANDO VINCULAÇÃO'}</div><div class="connector-pair-title">Código de vinculação</div><div class="connector-pair-code-row"><code>${escaparHtmlBasico(connectorPairCurrentCode)}</code><button class="btn btn-ghost" type="button" onclick="copiarCodigoPareamentoConector(this)" ${expirado?'disabled':''}>COPIAR</button></div><div class="connector-pair-meta"><span>${expirado?'Código expirado':`Expira em ${min}:${seg}`}</span><span>Uso único</span></div>${expirado?'<button class="btn btn-green" type="button" onclick="gerarCodigoPareamentoConector()">GERAR NOVO CÓDIGO</button>':''}`;
  if(expirado&&connectorPairCountdownTimer){clearInterval(connectorPairCountdownTimer);connectorPairCountdownTimer=null;}
}

async function copiarCodigoPareamentoConector(botao){
  if(!connectorPairCurrentCode)return;try{await navigator.clipboard.writeText(connectorPairCurrentCode);const anterior=botao.textContent;botao.textContent='✓ Copiado';setTimeout(()=>{if(botao.isConnected)botao.textContent=anterior;},1600);}catch(_){window.prompt('Copie o código:',connectorPairCurrentCode);}
}

function usuarioPodeGerenciarEmpresasSaas() {
  return contextoEhAdminGlobal() && usuarioSistemaLogado?.global_admin_authorized === true;
}

function usuarioPodeGerenciarLojasSaas() {
  return contextoEhAdminGlobal() && usuarioSistemaLogado?.global_admin_authorized === true;
}

function nomeEmpresaSaas(item = {}) {
  return String(item.nome || item.razao_social || item.nome_fantasia || item.descricao || '').trim();
}

function gerarSlugEmpresaSaas(nome = '', idAtual = '') {
  const base = String(nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'empresa';

  const usados = new Set((empresasSaasCache || [])
    .filter(item => String(item.id || '') !== String(idAtual || ''))
    .map(item => String(item.slug || item.codigo || '').trim())
    .filter(Boolean));

  let slug = base;
  let contador = 2;
  while (usados.has(slug)) {
    slug = `${base}-${contador}`;
    contador += 1;
  }
  return slug;
}

function codigoEmpresaSaas(item = {}) {
  return String(item.slug || item.codigo || '').trim();
}

function empresaSaasAtiva(item = {}) {
  if (typeof item.ativo === 'boolean') return item.ativo;
  if (typeof item.inativo === 'boolean') return !item.inativo;
  return true;
}

function nomeLojaSaas(item = {}) {
  return String(item.nome || item.nome_loja || item.descricao || '').trim();
}

function codigoLojaSaas(item = {}) {
  return String(item.codigo || item.sigla || '').trim();
}

function lojaSaasAtiva(item = {}) {
  if (typeof item.ativo === 'boolean') return item.ativo;
  if (typeof item.inativo === 'boolean') return !item.inativo;
  return true;
}

function nomeEmpresaSaasPorId(id = '') {
  const empresa = empresasSaasCache.find(item => String(item.id || '') === String(id || ''));
  return nomeEmpresaSaas(empresa) || String(id || '');
}

function atualizarSelectEmpresaLojaSaas() {
  const select = document.getElementById('saasEmpresaLoja');
  if (!select) return;
  const atual = String(select.value || '').trim();
  select.innerHTML = '<option value="">- Selecione a empresa -</option>';
  [...empresasSaasCache]
    .sort((a, b) => nomeEmpresaSaas(a).localeCompare(nomeEmpresaSaas(b), 'pt-BR', { sensitivity: 'base' }))
    .forEach(item => {
      const opt = document.createElement('option');
      opt.value = String(item.id || '');
      const nome = nomeEmpresaSaas(item) || 'Empresa sem nome';
      const codigo = codigoEmpresaSaas(item);
      opt.textContent = codigo ? `${nome} (${codigo})` : nome;
      select.appendChild(opt);
    });
  if (atual && empresasSaasCache.some(item => String(item.id || '') === atual)) select.value = atual;
}

async function carregarEmpresasSaas({ render = true, silencioso = false } = {}) {
  const lista = document.getElementById('listaEmpresasSaas');
  if (render && lista) lista.innerHTML = '<div class="empty">Carregando empresas...</div>';
  if (!usuarioPodeGerenciarEmpresasSaas() && !usuarioPodeGerenciarLojasSaas()) {
    empresasSaasCache = [];
    if (render && lista) lista.innerHTML = '<div class="empty">Sem permissão para visualizar empresas.</div>';
    return [];
  }

  let data, error;
  try { data = (await obterDadosPainelAdminGlobal({ renovar:true })).empresas || []; }
  catch (erro) { error = erro; }
  if (error) {
    empresasSaasCache = [];
    if (render && lista) lista.innerHTML = '<div class="empty">Erro ao carregar empresas.</div>';
    if (!silencioso) setMsg('msgEmpresasSaas', `Erro ao carregar empresas: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return [];
  }

  empresasSaasCache = Array.isArray(data) ? data : [];
  atualizarSelectEmpresaLojaSaas();
  if (render) renderizarEmpresasSaas();
  return empresasSaasCache;
}

function renderizarEmpresasSaas() {
  const lista = document.getElementById('listaEmpresasSaas');
  if (!lista) return;
  if (!empresasSaasCache.length) {
    lista.innerHTML = '<div class="empty">Nenhuma empresa cadastrada.</div>';
    return;
  }
  const podeEditar = usuarioPodeGerenciarEmpresasSaas();
  lista.innerHTML = '<div class="lista">' + empresasSaasCache.map(item => {
    const id = String(item.id || '');
    const nome = nomeEmpresaSaas(item) || 'Sem nome';
    const codigo = codigoEmpresaSaas(item);
    const ativa = empresaSaasAtiva(item);
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(nome)}</div>
          <div class="item-detalhe">${codigo ? `Identificador: ${escaparHtmlBasico(codigo)} · ` : ''}CNPJ: ${escaparHtmlBasico(item.cnpj || '-')} · Status: ${ativa ? 'Ativa' : 'Inativa'}</div>
        </div>
        <div class="item-actions">
          ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="editarEmpresaSaas('${id}')">Editar</button>` : ''}
          ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="alternarEmpresaSaas('${id}')">${ativa ? 'Inativar' : 'Ativar'}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function limparFormularioEmpresaSaas() {
  empresaSaasEmEdicaoId = null;
  const nome = document.getElementById('saasNomeEmpresa');
  const cnpj = document.getElementById('saasCnpjEmpresa');
  const ativo = document.getElementById('saasAtivoEmpresa');
  const btnSalvar = document.getElementById('btnSalvarEmpresaSaas');
  const btnCancelar = document.getElementById('btnCancelarEmpresaSaas');
  if (nome) nome.value = '';
  if (cnpj) cnpj.value = '';
  if (ativo) ativo.checked = true;
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar empresa';
  if (btnSalvar) {
    btnSalvar.disabled = !usuarioEhAdministrador();
    if (btnSalvar.disabled) btnSalvar.title = 'Apenas administradores podem cadastrar empresas';
    else btnSalvar.title = '';
  }
  if (btnCancelar) btnCancelar.style.display = 'none';
}

function cancelarEdicaoEmpresaSaas() {
  limparFormularioEmpresaSaas();
  setMsg('msgEmpresasSaas', 'Edição cancelada.', 'ok');
}

function editarEmpresaSaas(id) {
  if (!usuarioPodeGerenciarEmpresasSaas()) return;
  const item = empresasSaasCache.find(empresa => String(empresa.id || '') === String(id || ''));
  if (!item) return;
  empresaSaasEmEdicaoId = String(item.id || '');
  const nome = document.getElementById('saasNomeEmpresa');
  const cnpj = document.getElementById('saasCnpjEmpresa');
  const ativo = document.getElementById('saasAtivoEmpresa');
  const btnSalvar = document.getElementById('btnSalvarEmpresaSaas');
  const btnCancelar = document.getElementById('btnCancelarEmpresaSaas');
  if (nome) nome.value = nomeEmpresaSaas(item);
  if (cnpj) cnpj.value = String(item.cnpj || '');
  if (ativo) ativo.checked = empresaSaasAtiva(item);
  if (btnSalvar) btnSalvar.textContent = 'Salvar empresa';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgEmpresasSaas', `Editando empresa: ${nomeEmpresaSaas(item) || '-'}.`, 'ok');
}

async function salvarEmpresaSaas() {
  if (!usuarioPodeGerenciarEmpresasSaas()) {
    setMsg('msgEmpresasSaas', 'Você não tem permissão para gerenciar empresas.', 'err');
    return;
  }
  // criação de empresas restrita a administradores
  if (!empresaSaasEmEdicaoId && !usuarioEhAdministrador()) {
    setMsg('msgEmpresasSaas', 'Apenas administradores podem cadastrar novas empresas.', 'err');
    return;
  }
  const nome = String(document.getElementById('saasNomeEmpresa')?.value || '').trim();
  const cnpj = String(document.getElementById('saasCnpjEmpresa')?.value || '').replace(/\D/g, '');
  const ativo = document.getElementById('saasAtivoEmpresa')?.checked !== false;
  if (!nome) {
    setMsg('msgEmpresasSaas', 'Informe o nome da empresa.', 'err');
    return;
  }
  if (cnpj && cnpj.length !== 14) {
    setMsg('msgEmpresasSaas', 'Informe um CNPJ com 14 números.', 'err');
    return;
  }

  const slug = gerarSlugEmpresaSaas(nome, empresaSaasEmEdicaoId);
  const payload = { nome, slug, cnpj: cnpj || null, ativo };
  const req = empresaSaasEmEdicaoId
    ? sb.from('empresas').update(payload).eq('id', empresaSaasEmEdicaoId)
    : sb.from('empresas').insert([payload]);
  const { error } = await req;
  if (error) {
    setMsg('msgEmpresasSaas', `Não foi possível salvar empresa: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  const editando = !!empresaSaasEmEdicaoId;
  limparFormularioEmpresaSaas();
  setMsg('msgEmpresasSaas', editando ? 'Empresa atualizada.' : 'Empresa cadastrada.', 'ok');
  await carregarEmpresasSaas();
}

async function alternarEmpresaSaas(id) {
  if (!usuarioPodeGerenciarEmpresasSaas()) return;
  const item = empresasSaasCache.find(empresa => String(empresa.id || '') === String(id || ''));
  if (!item) return;
  const novoAtivo = !empresaSaasAtiva(item);
  const { error } = await sb.from('empresas').update({ ativo: novoAtivo }).eq('id', id);
  if (error) {
    setMsg('msgEmpresasSaas', `Não foi possível alterar status: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgEmpresasSaas', `Empresa ${novoAtivo ? 'ativada' : 'inativada'}.`, 'ok');
  await carregarEmpresasSaas();
}

async function carregarLojasSaas() {
  const lista = document.getElementById('listaLojasSaas');
  if (lista) lista.innerHTML = '<div class="empty">Carregando lojas...</div>';
  if (!usuarioPodeGerenciarLojasSaas()) {
    lojasSaasCache = [];
    inicializarCopiarDadosEntreLojasSaas();
    if (lista) lista.innerHTML = '<div class="empty">Sem permissão para visualizar lojas.</div>';
    return [];
  }

  let data, error;
  try { data = (await obterDadosPainelAdminGlobal({ renovar:true })).lojas || []; }
  catch (erro) { error = erro; }
  if (error) {
    lojasSaasCache = [];
    inicializarCopiarDadosEntreLojasSaas();
    if (lista) lista.innerHTML = '<div class="empty">Erro ao carregar lojas.</div>';
    setMsg('msgLojasSaas', `Erro ao carregar lojas: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return [];
  }

  lojasSaasCache = Array.isArray(data) ? data : [];
  renderizarLojasSaas();
  inicializarCopiarDadosEntreLojasSaas();
  return lojasSaasCache;
}

function renderizarLojasSaas() {
  const lista = document.getElementById('listaLojasSaas');
  if (!lista) return;
  if (!lojasSaasCache.length) {
    lista.innerHTML = '<div class="empty">Nenhuma loja cadastrada.</div>';
    return;
  }
  const podeEditar = usuarioPodeGerenciarLojasSaas();
  lista.innerHTML = '<div class="lista">' + lojasSaasCache.map(item => {
    const id = String(item.id || '');
    const nome = nomeLojaSaas(item) || 'Sem nome';
    const codigo = codigoLojaSaas(item);
    const ativa = lojaSaasAtiva(item);
    const empresaNome = nomeEmpresaSaasPorId(item.empresa_id);
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(nome)}</div>
          <div class="item-detalhe">Empresa: ${escaparHtmlBasico(empresaNome || '-')} · ${codigo ? `Identificador: ${escaparHtmlBasico(codigo)} · ` : ''}Status: ${ativa ? 'Ativa' : 'Inativa'}</div>
        </div>
        <div class="item-actions">
          ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="editarLojaSaas('${id}')">Editar</button>` : ''}
          ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick="alternarLojaSaas('${id}')">${ativa ? 'Inativar' : 'Ativar'}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

function limparFormularioLojaSaas() {
  lojaSaasEmEdicaoId = null;
  const empresa = document.getElementById('saasEmpresaLoja');
  const nome = document.getElementById('saasNomeLoja');
  const codigo = document.getElementById('saasCodigoLoja');
  const cep = document.getElementById('saasCepLoja');
  const cidade = document.getElementById('saasCidadeLoja');
  const estado = document.getElementById('saasEstadoLoja');
  const ativo = document.getElementById('saasAtivoLoja');
  const btnSalvar = document.getElementById('btnSalvarLojaSaas');
  const btnCancelar = document.getElementById('btnCancelarLojaSaas');
  if (empresa) empresa.value = '';
  if (nome) nome.value = '';
  if (codigo) {
    codigo.value = '';
    codigo.readOnly = true;
    codigo.placeholder = 'Automático';
    codigo.title = 'Código gerado automaticamente no cadastro de nova loja';
  }
  if (cep) cep.value = '';
  if (cidade) cidade.value = '';
  if (estado) estado.value = '';
  if (ativo) ativo.checked = true;
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar loja';
  if (btnSalvar) {
    btnSalvar.disabled = !usuarioEhAdministrador();
    if (btnSalvar.disabled) btnSalvar.title = 'Apenas administradores podem cadastrar lojas';
    else btnSalvar.title = '';
  }
  if (btnCancelar) btnCancelar.style.display = 'none';
}

function cancelarEdicaoLojaSaas() {
  limparFormularioLojaSaas();
  setMsg('msgLojasSaas', 'Edição cancelada.', 'ok');
}

function editarLojaSaas(id) {
  if (!usuarioPodeGerenciarLojasSaas()) return;
  const item = lojasSaasCache.find(loja => String(loja.id || '') === String(id || ''));
  if (!item) return;
  lojaSaasEmEdicaoId = String(item.id || '');
  const empresa = document.getElementById('saasEmpresaLoja');
  const nome = document.getElementById('saasNomeLoja');
  const codigo = document.getElementById('saasCodigoLoja');
  const cep = document.getElementById('saasCepLoja');
  const cidade = document.getElementById('saasCidadeLoja');
  const estado = document.getElementById('saasEstadoLoja');
  const ativo = document.getElementById('saasAtivoLoja');
  const btnSalvar = document.getElementById('btnSalvarLojaSaas');
  const btnCancelar = document.getElementById('btnCancelarLojaSaas');
  if (empresa) empresa.value = String(item.empresa_id || '');
  if (nome) nome.value = nomeLojaSaas(item);
  if (codigo) {
    codigo.value = codigoLojaSaas(item);
    codigo.readOnly = false;
    codigo.placeholder = 'Código';
    codigo.title = 'Você pode ajustar o código ao editar a loja';
  }
  if (cep) cep.value = formatarCepLoja(item.cep || '');
  if (cidade) cidade.value = String(item.cidade || item.municipio || '').trim();
  if (estado) estado.value = String(item.estado || item.uf || '').trim().toUpperCase();
  if (ativo) ativo.checked = lojaSaasAtiva(item);
  if (btnSalvar) btnSalvar.textContent = 'Salvar loja';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgLojasSaas', `Editando loja: ${nomeLojaSaas(item) || '-'}.`, 'ok');
}

async function salvarLojaSaas() {
  if (!usuarioPodeGerenciarLojasSaas()) {
    setMsg('msgLojasSaas', 'Você não tem permissão para gerenciar lojas.', 'err');
    return;
  }
  // criação de lojas via painel SaaS apenas por administradores
  if (!lojaSaasEmEdicaoId && !usuarioEhAdministrador()) {
    setMsg('msgLojasSaas', 'Apenas administradores podem cadastrar novas lojas.', 'err');
    return;
  }
  const empresaId = String(document.getElementById('saasEmpresaLoja')?.value || '').trim();
  const nome = String(document.getElementById('saasNomeLoja')?.value || '').trim();
  const codigo = String(document.getElementById('saasCodigoLoja')?.value || '').trim();
  const cep = formatarCepLoja(document.getElementById('saasCepLoja')?.value || '');
  const cidade = String(document.getElementById('saasCidadeLoja')?.value || '').trim();
  const estado = String(document.getElementById('saasEstadoLoja')?.value || '').trim().toUpperCase();
  const ativo = document.getElementById('saasAtivoLoja')?.checked !== false;
  if (!empresaId) {
    setMsg('msgLojasSaas', 'Selecione a empresa da loja.', 'err');
    return;
  }
  if (!nome) {
    setMsg('msgLojasSaas', 'Informe o nome da loja.', 'err');
    return;
  }
  if (!cidade || !estado) {
    setMsg('msgLojasSaas', 'Cidade e estado são obrigatórios para calcular feriados estaduais e municipais.', 'err');
    return;
  }
  const payload = { empresa_id: empresaId, nome, codigo: codigo || null, cep: cep || null, cidade, estado, ativo };
  const req = lojaSaasEmEdicaoId
    ? sb.from('lojas').update(payload).eq('id', lojaSaasEmEdicaoId)
    : sb.from('lojas').insert([payload]);
  const { error } = await req;
  if (error) {
    setMsg('msgLojasSaas', `Não foi possível salvar loja: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  const editando = !!lojaSaasEmEdicaoId;
  limparFormularioLojaSaas();
  setMsg('msgLojasSaas', editando ? 'Loja atualizada.' : 'Loja cadastrada.', 'ok');
  await carregarLojasSaas();
}

async function alternarLojaSaas(id) {
  if (!usuarioPodeGerenciarLojasSaas()) return;
  const item = lojasSaasCache.find(loja => String(loja.id || '') === String(id || ''));
  if (!item) return;
  const novoAtivo = !lojaSaasAtiva(item);
  const { error } = await sb.from('lojas').update({ ativo: novoAtivo }).eq('id', id);
  if (error) {
    setMsg('msgLojasSaas', `Não foi possível alterar status: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgLojasSaas', `Loja ${novoAtivo ? 'ativada' : 'inativada'}.`, 'ok');
  await carregarLojasSaas();
}

function normalizarNumeroCnpj(valor = '') {
  return String(valor || '').replace(/\D/g, '');
}

function normalizarNomeComparacao(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function obterEmpresaSelecionadaCopiarDadosLojas() {
  const select = document.getElementById('saasEmpresaCopiarDados');
  const empresaSelecionada = String(select?.value || '').trim();
  if (empresaSelecionada) return empresaSelecionada;
  return String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
}

function preencherSelectComLojas(selectId = '', lojas = [], lojaSelecionada = '') {
  const select = document.getElementById(selectId);
  if (!select) return;
  const atual = String(lojaSelecionada || select.value || '').trim();
  const placeholder = selectId === 'saasLojaOrigemCopiarDados' ? '- Loja origem -' : '- Loja destino -';
  select.innerHTML = `<option value="">${placeholder}</option>`;
  lojas.forEach(loja => {
    const id = String(loja?.id || '').trim();
    if (!id) return;
    const nome = String(loja?.nome || loja?.nome_loja || id).trim();
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = nome;
    select.appendChild(opt);
  });
  if (atual && lojas.some(loja => String(loja?.id || '').trim() === atual)) {
    select.value = atual;
  }
}

function sincronizarSelectsCopiarDadosEntreLojas() {
  const empresaId = obterEmpresaSelecionadaCopiarDadosLojas();
  const lojasEmpresa = (lojasSaasCache || []).filter(loja => String(loja?.empresa_id || '').trim() === empresaId);
  const origem = String(document.getElementById('saasLojaOrigemCopiarDados')?.value || '').trim();
  const destino = String(document.getElementById('saasLojaDestinoCopiarDados')?.value || '').trim();

  preencherSelectComLojas('saasLojaOrigemCopiarDados', lojasEmpresa, origem);
  preencherSelectComLojas('saasLojaDestinoCopiarDados', lojasEmpresa, destino);
}

function inicializarCopiarDadosEntreLojasSaas() {
  const card = document.getElementById('cardCopiarDadosLojasSaas');
  if (!card) return;

  const podeGerenciar = usuarioPodeGerenciarLojasSaas();
  card.style.display = podeGerenciar ? '' : 'none';
  if (!podeGerenciar) return;

  const selectEmpresa = document.getElementById('saasEmpresaCopiarDados');
  if (!selectEmpresa) return;

  const empresaAtual = String(selectEmpresa.value || '').trim();
  const empresaSessao = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();
  const empresasDisponiveis = [...(empresasSaasCache || [])].filter(empresa => {
    const id = String(empresa?.id || '').trim();
    return !empresaSessao || id === empresaSessao;
  });

  selectEmpresa.innerHTML = '<option value="">- Empresa -</option>';
  empresasDisponiveis.forEach(empresa => {
    const id = String(empresa?.id || '').trim();
    if (!id) return;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = nomeEmpresaSaas(empresa) || id;
    selectEmpresa.appendChild(opt);
  });

  if (empresaAtual && empresasDisponiveis.some(empresa => String(empresa?.id || '').trim() === empresaAtual)) {
    selectEmpresa.value = empresaAtual;
  } else if (empresaSessao) {
    selectEmpresa.value = empresaSessao;
  } else if (empresasDisponiveis.length === 1) {
    selectEmpresa.value = String(empresasDisponiveis[0].id || '');
  }

  sincronizarSelectsCopiarDadosEntreLojas();
}

function marcarOpcoesCopiarDadosLojas(marcar = true) {
  document.querySelectorAll('#cardCopiarDadosLojasSaas input[type="checkbox"]').forEach(input => {
    input.checked = !!marcar;
  });
}

function limparCamposSistemaParaCopiaLoja(registro = {}) {
  const copia = { ...(registro || {}) };
  ['id', 'created_at', 'updated_at', 'criado_em', 'atualizado_em'].forEach(campo => delete copia[campo]);
  return copia;
}

async function copiarCadastroSimplesEntreLojasSaas({
  tabela,
  empresaId,
  lojaOrigemId,
  lojaDestinoId,
  chave = item => normalizarNomeComparacao(item?.nome || ''),
}) {
  const { data: origem, error: erroOrigem } = await sb
    .from(tabela)
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaOrigemId);
  if (erroOrigem) throw erroOrigem;

  const { data: destino, error: erroDestino } = await sb
    .from(tabela)
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaDestinoId);
  if (erroDestino) throw erroDestino;

  const existentes = new Set((destino || []).map(chave).filter(Boolean));
  const inserir = [];
  let ignorados = 0;
  for (const item of origem || []) {
    const chaveItem = chave(item);
    if (!chaveItem || existentes.has(chaveItem)) {
      ignorados += 1;
      continue;
    }
    existentes.add(chaveItem);
    inserir.push({
      ...limparCamposSistemaParaCopiaLoja(item),
      empresa_id: empresaId,
      loja_id: lojaDestinoId,
    });
  }

  if (inserir.length) {
    const { error: erroInsert } = await sb.from(tabela).insert(inserir);
    if (erroInsert) throw erroInsert;
  }
  return { inseridos: inserir.length, ignorados };
}

async function obterMapaGruposFornecedoresEntreLojasSaas(empresaId, lojaOrigemId, lojaDestinoId) {
  const [origemRes, destinoRes] = await Promise.all([
    sb.from('grupos_fornecedor').select('id, nome').eq('empresa_id', empresaId).eq('loja_id', lojaOrigemId),
    sb.from('grupos_fornecedor').select('id, nome').eq('empresa_id', empresaId).eq('loja_id', lojaDestinoId),
  ]);
  if (origemRes.error) throw origemRes.error;
  if (destinoRes.error) throw destinoRes.error;

  const destinoPorNome = new Map((destinoRes.data || []).map(item => [normalizarNomeComparacao(item?.nome || ''), item.id]));
  return new Map((origemRes.data || []).map(item => [
    String(item.id || ''),
    destinoPorNome.get(normalizarNomeComparacao(item?.nome || '')) || null,
  ]));
}

async function copiarFornecedoresEntreLojasSaas(empresaId = '', lojaOrigemId = '', lojaDestinoId = '') {
  const { data: fornecedoresOrigem, error: erroOrigem } = await sb
    .from('fornecedores')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaOrigemId)
    .order('nome', { ascending: true });

  if (erroOrigem) throw erroOrigem;
  if (!Array.isArray(fornecedoresOrigem) || !fornecedoresOrigem.length) {
    return { inseridos: 0, ignorados: 0 };
  }

  const { data: fornecedoresDestino, error: erroDestino } = await sb
    .from('fornecedores')
    .select('id, nome, cnpj')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaDestinoId);

  if (erroDestino) throw erroDestino;

  const existentes = new Set((fornecedoresDestino || []).map(item => {
    const cnpj = normalizarNumeroCnpj(item?.cnpj || '');
    if (cnpj) return `cnpj:${cnpj}`;
    return `nome:${normalizarNomeComparacao(item?.nome || '')}`;
  }));
  const mapaGrupos = await obterMapaGruposFornecedoresEntreLojasSaas(empresaId, lojaOrigemId, lojaDestinoId);

  const inserir = [];
  let ignorados = 0;
  for (const fornecedor of fornecedoresOrigem) {
    const cnpj = normalizarNumeroCnpj(fornecedor?.cnpj || '');
    const chave = cnpj ? `cnpj:${cnpj}` : `nome:${normalizarNomeComparacao(fornecedor?.nome || '')}`;
    if (existentes.has(chave)) {
      ignorados += 1;
      continue;
    }
    existentes.add(chave);

    const { id, created_at, updated_at, loja_id, empresa_id, ...restante } = fornecedor || {};
    inserir.push({
      ...restante,
      grupo_id: fornecedor?.grupo_id ? (mapaGrupos.get(String(fornecedor.grupo_id)) || null) : null,
      empresa_id: empresaId,
      loja_id: lojaDestinoId,
    });
  }

  if (inserir.length) {
    const { error: erroInsert } = await sb.from('fornecedores').insert(inserir);
    if (erroInsert) throw erroInsert;
  }

  return { inseridos: inserir.length, ignorados };
}

async function copiarChecklistsEntreLojasSaas(empresaId = '', lojaOrigemId = '', lojaDestinoId = '') {
  const { data: checklistsOrigem, error: erroOrigem } = await sb
    .from('checklists')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaOrigemId)
    .order('nome', { ascending: true });

  if (erroOrigem) throw erroOrigem;
  if (!Array.isArray(checklistsOrigem) || !checklistsOrigem.length) {
    return { checklistsInseridos: 0, itensInseridos: 0, checklistsIgnorados: 0 };
  }

  const { data: checklistsDestino, error: erroDestino } = await sb
    .from('checklists')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('loja_id', lojaDestinoId);

  if (erroDestino) throw erroDestino;

  const nomesDestino = new Set((checklistsDestino || []).map(item => normalizarNomeComparacao(item?.nome || '')));
  const mapaChecklistNovoPorAntigo = new Map();
  let checklistsIgnorados = 0;

  for (const checklist of checklistsOrigem) {
    const nomeNormalizado = normalizarNomeComparacao(checklist?.nome || '');
    if (!nomeNormalizado || nomesDestino.has(nomeNormalizado)) {
      checklistsIgnorados += 1;
      continue;
    }
    nomesDestino.add(nomeNormalizado);

    const { id, created_at, updated_at, loja_id, empresa_id, ...restante } = checklist || {};
    const payload = {
      ...restante,
      empresa_id: empresaId,
      loja_id: lojaDestinoId,
    };
    const { data: novoChecklist, error: erroInsertChecklist } = await sb
      .from('checklists')
      .insert([payload])
      .select('id')
      .single();

    if (erroInsertChecklist) throw erroInsertChecklist;

    const idAntigo = String(id || '').trim();
    const idNovo = String(novoChecklist?.id || '').trim();
    if (idAntigo && idNovo) {
      mapaChecklistNovoPorAntigo.set(idAntigo, idNovo);
    }
  }

  const idsOriginaisCopiados = Array.from(mapaChecklistNovoPorAntigo.keys());
  if (!idsOriginaisCopiados.length) {
    return { checklistsInseridos: 0, itensInseridos: 0, checklistsIgnorados };
  }

  const { data: itensOrigem, error: erroItensOrigem } = await sb
    .from('checklist_itens')
    .select('*')
    .in('checklist_id', idsOriginaisCopiados);

  if (erroItensOrigem) throw erroItensOrigem;

  const itensParaInserir = [];
  (itensOrigem || []).forEach(item => {
    const checklistAntigoId = String(item?.checklist_id || '').trim();
    const checklistNovoId = mapaChecklistNovoPorAntigo.get(checklistAntigoId);
    if (!checklistNovoId) return;
    const { id, created_at, updated_at, checklist_id, ...restante } = item || {};
    itensParaInserir.push({
      ...restante,
      checklist_id: checklistNovoId,
    });
  });

  if (itensParaInserir.length) {
    const { error: erroInsertItens } = await sb.from('checklist_itens').insert(itensParaInserir);
    if (erroInsertItens) throw erroInsertItens;
  }

  return {
    checklistsInseridos: idsOriginaisCopiados.length,
    itensInseridos: itensParaInserir.length,
    checklistsIgnorados,
  };
}

async function copiarDadosEntreLojasSaas() {
  if (!usuarioPodeGerenciarLojasSaas()) {
    setMsg('msgCopiarDadosLojasSaas', 'Você não tem permissão para copiar dados entre lojas.', 'err');
    return;
  }
  if (copiaDadosEntreLojasEmAndamento) return;

  const empresaId = obterEmpresaSelecionadaCopiarDadosLojas();
  const lojaOrigemId = String(document.getElementById('saasLojaOrigemCopiarDados')?.value || '').trim();
  const lojaDestinoId = String(document.getElementById('saasLojaDestinoCopiarDados')?.value || '').trim();
  const copiarFornecedores = document.getElementById('copiarDadosFornecedores')?.checked === true;
  const copiarChecklists = document.getElementById('copiarDadosChecklists')?.checked === true;
  const copiarPerfis = document.getElementById('copiarDadosPerfis')?.checked === true;
  const copiarGruposFornecedores = document.getElementById('copiarDadosGruposFornecedores')?.checked === true;
  const copiarCategoriasCompra = document.getElementById('copiarDadosCategoriasCompra')?.checked === true;
  const copiarFormasPagamento = document.getElementById('copiarDadosFormasPagamento')?.checked === true;

  if (!empresaId) {
    setMsg('msgCopiarDadosLojasSaas', 'Selecione a empresa para copiar dados entre lojas.', 'err');
    return;
  }
  if (!lojaOrigemId || !lojaDestinoId) {
    setMsg('msgCopiarDadosLojasSaas', 'Selecione loja de origem e de destino.', 'err');
    return;
  }
  if (lojaOrigemId === lojaDestinoId) {
    setMsg('msgCopiarDadosLojasSaas', 'A loja de origem deve ser diferente da loja de destino.', 'err');
    return;
  }
  if (![copiarFornecedores, copiarChecklists, copiarPerfis, copiarGruposFornecedores, copiarCategoriasCompra, copiarFormasPagamento].some(Boolean)) {
    setMsg('msgCopiarDadosLojasSaas', 'Selecione ao menos um tipo de dado para copiar.', 'err');
    return;
  }

  const lojasEmpresa = (lojasSaasCache || []).filter(loja => String(loja?.empresa_id || '').trim() === empresaId);
  const origemValida = lojasEmpresa.some(loja => String(loja?.id || '').trim() === lojaOrigemId);
  const destinoValido = lojasEmpresa.some(loja => String(loja?.id || '').trim() === lojaDestinoId);
  if (!origemValida || !destinoValido) {
    setMsg('msgCopiarDadosLojasSaas', 'Origem e destino devem pertencer à mesma empresa selecionada.', 'err');
    return;
  }

  const btn = document.getElementById('btnCopiarDadosEntreLojas');
  const textoOriginal = btn?.textContent || 'Copiar dados entre lojas';
  copiaDadosEntreLojasEmAndamento = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Copiando...';
  }
  setMsg('msgCopiarDadosLojasSaas', 'Processando cópia de dados entre lojas...', 'ok');

  try {
    const resumo = {
      fornecedoresInseridos: 0,
      fornecedoresIgnorados: 0,
      checklistsInseridos: 0,
      checklistsIgnorados: 0,
      checklistItensInseridos: 0,
      perfis: null,
      gruposFornecedores: null,
      categoriasCompra: null,
      formasPagamento: null,
    };

    await executarSemFiltroLojaTemporario(async () => {
      if (copiarPerfis) {
        resumo.perfis = await copiarCadastroSimplesEntreLojasSaas({
          tabela: 'perfis', empresaId, lojaOrigemId, lojaDestinoId,
          chave: item => normalizarNomeComparacao(item?.codigo || item?.nome || ''),
        });
      }

      if (copiarGruposFornecedores) {
        resumo.gruposFornecedores = await copiarCadastroSimplesEntreLojasSaas({
          tabela: 'grupos_fornecedor', empresaId, lojaOrigemId, lojaDestinoId,
        });
      }

      if (copiarFornecedores) {
        const resultadoFornecedores = await copiarFornecedoresEntreLojasSaas(empresaId, lojaOrigemId, lojaDestinoId);
        resumo.fornecedoresInseridos = resultadoFornecedores.inseridos;
        resumo.fornecedoresIgnorados = resultadoFornecedores.ignorados;
      }

      if (copiarCategoriasCompra) {
        resumo.categoriasCompra = await copiarCadastroSimplesEntreLojasSaas({
          tabela: 'categorias_compra', empresaId, lojaOrigemId, lojaDestinoId,
        });
      }

      if (copiarFormasPagamento) {
        resumo.formasPagamento = await copiarCadastroSimplesEntreLojasSaas({
          tabela: 'formas_pagamento', empresaId, lojaOrigemId, lojaDestinoId,
        });
      }

      if (copiarChecklists) {
        const resultadoChecklists = await copiarChecklistsEntreLojasSaas(empresaId, lojaOrigemId, lojaDestinoId);
        resumo.checklistsInseridos = resultadoChecklists.checklistsInseridos;
        resumo.checklistsIgnorados = resultadoChecklists.checklistsIgnorados;
        resumo.checklistItensInseridos = resultadoChecklists.itensInseridos;
      }
    });

    const partes = [];
    if (copiarPerfis) partes.push(`Perfis: ${resumo.perfis.inseridos} copiado(s), ${resumo.perfis.ignorados} existente(s)`);
    if (copiarGruposFornecedores) partes.push(`Grupos: ${resumo.gruposFornecedores.inseridos} copiado(s), ${resumo.gruposFornecedores.ignorados} existente(s)`);
    if (copiarFornecedores) {
      partes.push(`Fornecedores: ${resumo.fornecedoresInseridos} copiado(s), ${resumo.fornecedoresIgnorados} ignorado(s)`);
    }
    if (copiarCategoriasCompra) partes.push(`Categorias: ${resumo.categoriasCompra.inseridos} copiada(s), ${resumo.categoriasCompra.ignorados} existente(s)`);
    if (copiarFormasPagamento) partes.push(`Formas de pagamento: ${resumo.formasPagamento.inseridos} copiada(s), ${resumo.formasPagamento.ignorados} existente(s)`);
    if (copiarChecklists) {
      partes.push(`Checklist: ${resumo.checklistsInseridos} copiado(s), ${resumo.checklistsIgnorados} ignorado(s), ${resumo.checklistItensInseridos} item(ns) replicado(s)`);
    }

    setMsg('msgCopiarDadosLojasSaas', `Cópia concluída. ${partes.join(' · ')}`, 'ok');
  } catch (error) {
    setMsg('msgCopiarDadosLojasSaas', `Falha ao copiar dados: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
  } finally {
    copiaDadosEntreLojasEmAndamento = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  }
}
