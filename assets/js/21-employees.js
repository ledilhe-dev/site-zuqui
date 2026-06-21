// FUNCIONÁRIOS
// 
async function carregarFuncionarios() {
  atualizarSelectLojasFuncionario();
  const lista = document.getElementById('listaFuncionarios');
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';
  renderizarFiltroLojasCheckbox('filtroLojasFuncionarios', 'carregarFuncionarios()');
  const lojasSelecionadas = obterIdsLojasSelecionadasFiltroMultiLoja('filtroLojasFuncionarios');

  try {
    const executarConsultaFuncionarios = usuarioSistemaLogado?.tipo === 'admin'
      ? executarSemFiltrosTenantTemporario
      : executarSemFiltroLojaTemporario;
    const { data, error } = await executarConsultaFuncionarios(() => {
      let query = sb.from('funcionarios').select('*, perfis(nome, codigo)').order('nome');
      return query;
    });

    if (error) {
      console.error('Erro ao carregar funcionários:', error);
      lista.innerHTML = '<div class="empty">Erro ao carregar funcionários. Verifique a conexão com o banco de dados.</div>';
      return;
    }

    let funcionariosVisiveis = data || [];
    const ehAdminSistema = usuarioEhAdministrador();
    const lojasPermitidasGestao = obterIdsLojasPermitidasGestaoFuncionarios();
    const funcionariosVinculadosPermitidos = new Set();
    if (!ehAdminSistema) {
      if (!lojasPermitidasGestao.size) {
        funcionariosVisiveis = [];
      } else {
        const { data: vinculosPermitidos, error: erroVinculosPermitidos } = await executarSemFiltrosTenantTemporario(() => sb
          .from('funcionario_lojas')
          .select('funcionario_id, loja_id, ativo')
          .in('loja_id', [...lojasPermitidasGestao])
          .eq('ativo', true));
        if (erroVinculosPermitidos) throw erroVinculosPermitidos;
        (vinculosPermitidos || []).forEach(v => funcionariosVinculadosPermitidos.add(String(v.funcionario_id || '')));
        funcionariosVisiveis = funcionariosVisiveis.filter(f =>
          f?.é_administrador !== true
          && (lojasPermitidasGestao.has(String(f?.loja_id || '')) || funcionariosVinculadosPermitidos.has(String(f?.id || '')))
        );
      }
    }
    if (lojasSelecionadas.length) {
      const idsLojasFiltro = lojasSelecionadas.map(String);
      const idsVinculados = new Set();
      try {
        const { data: vinculosFiltro, error: erroVinculosFiltro } = await executarSemFiltroLojaTemporario(() =>
          sb.from('funcionario_lojas')
            .select('funcionario_id, loja_id, ativo')
            .in('loja_id', idsLojasFiltro)
            .eq('ativo', true)
        );
        if (!erroVinculosFiltro) (vinculosFiltro || []).forEach(v => idsVinculados.add(String(v.funcionario_id || '')));
      } catch (erroVinculosFiltro) {
        console.warn('Não foi possível considerar vínculos multi-loja na lista de funcionários:', erroVinculosFiltro);
      }
      funcionariosVisiveis = funcionariosVisiveis.filter(f =>
        f?.é_administrador === true
        || idsLojasFiltro.includes(String(f?.loja_id || ''))
        || idsVinculados.has(String(f?.id || ''))
      );
    }

    if (!funcionariosVisiveis.length) {
      lista.innerHTML = '<div class="empty">Nenhum funcionário cadastrado.</div>';
      return;
    }

    const lojaAtualId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    const ehAdminGlobal = usuarioEhAdministrador();
    lista.innerHTML = '<div class="lista">' + funcionariosVisiveis.map(f => {
      const nomeLoja = f?.é_administrador === true
        ? 'Todas as lojas (Administrador do Sistema)'
        : (obterNomeLojaFiltroMultiLoja(f.loja_id) || (!f.loja_id ? 'Acesso por vínculos' : '-'));
      // Admin global pode editar qualquer funcionário (não tem loja_id vinculada).
      const podeEditarNestaLoja = ehAdminGlobal || (
        f?.é_administrador !== true
        && String(f?.id || '') !== String(usuarioSistemaLogado?.id || '')
        && (lojasPermitidasGestao.has(String(f?.loja_id || '')) || funcionariosVinculadosPermitidos.has(String(f?.id || '')))
      );
      return `
      <div class="item tarefa-cadastrada-item">
        <div class="item-info">
          <div class="item-nome">${f.nome}</div>
          <div class="item-detalhe">Loja: ${nomeLoja || '-'} · E-mail: ${f.email || '-'} · Senha: ${f.pin ? '••••••' : '-'}${f.perfis?.nome ? ' · Perfil: ' + f.perfis.nome : ' · Perfil: Pendente'}</div>
          <div class="item-detalhe">Turno: ${f.horario_trabalho_inicio || '--:--'} às ${f.horario_trabalho_fim || '--:--'} · Intervalos: ${resumirIntervalosSemanaFuncionario(f.intervalos_semana, f.tempo_intervalo_minutos)}</div>
        </div>
        <div class="item-actions">
          ${f.ativo ? '' : '<span class="tag tag-gray">Inativo</span>'}
          ${!f.email ? '<span class="tag tag-gray">Sem e-mail</span>' : f.email_verificado === true ? '<span class="tag tag-green">E-mail ok</span>' : '<span class="tag tag-amber">E-mail pendente</span>'}
          ${f.email && f.email_verificado !== true ? `<button class="btn btn-ghost btn-sm" onclick="reenviarVerificacaoFuncionarioLista('${f.id}', '${String(f.email || '').replace(/'/g, "\\'")}', '${String(f.nome || '').replace(/'/g, "\\'")}')">Reenviar e-mail</button>` : ''}
          ${podeEditarNestaLoja ? `
            <button class="btn btn-ghost btn-sm" onclick="editarFuncionario('${f.id}')">Editar</button>
            <button class="btn btn-amber btn-sm" onclick="toggleFuncionario('${f.id}', ${f.ativo})">${f.ativo ? 'Desativar' : 'Ativar'}</button>
            <button class="btn btn-red" onclick="excluirFuncionario('${f.id}')">Excluir</button>
          ` : '<span class="tag tag-gray">Troque a loja para editar</span>'}
        </div>
      </div>`;
    }).join('') + '</div>';
  } catch (err) {
    console.error('Erro inesperado ao carregar funcionários:', err);
    lista.innerHTML = '<div class="empty">Erro inesperado ao carregar funcionários. Tente novamente mais tarde.</div>';
  }
}

function atualizarEstadoCadastroFuncionarioUI() {
  const conteudo = document.getElementById('cadastroFuncionarioConteudo');
  const btnToggle = document.getElementById('btnToggleCadastroFuncionario');
  const titulo = document.getElementById('tituloCadastroFuncionario');
  const subtitulo = document.getElementById('subtituloCadastroFuncionario');
  const labelPin = document.getElementById('labelPinFuncionario');
  const campoPin = document.getElementById('pinFuncionario');
  const btnSalvar = document.getElementById('btnSalvarFuncionario');

  if (!conteudo || !btnToggle || !titulo || !subtitulo) return;

  conteudo.hidden = !cadastroFuncionarioAberto;

  if (funcionarioEmEdicaoId) {
    titulo.textContent = 'Editar funcionário';
    subtitulo.textContent = 'Atualize os dados. A senha só muda se preencher o campo.';
    btnToggle.textContent = 'Fechar cadastro';
    if (labelPin) labelPin.textContent = 'Alterar senha (opcional)';
    if (campoPin) campoPin.placeholder = 'Nova senha';
    if (btnSalvar) btnSalvar.textContent = 'Salvar';
    return;
  }

  titulo.textContent = 'Novo funcionário';
  subtitulo.textContent = cadastroFuncionarioAberto
    ? 'Preencha os dados para cadastrar.'
    : 'Clique em "Novo cadastro" para abrir o formulário.';
  btnToggle.textContent = cadastroFuncionarioAberto ? 'Fechar cadastro' : 'Novo cadastro';
  if (labelPin) labelPin.textContent = 'Senha';
  if (campoPin) campoPin.placeholder = 'Senha';
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
}

function toggleCadastroFuncionario(forcarAberto = null) {
  if (typeof forcarAberto === 'boolean') {
    cadastroFuncionarioAberto = forcarAberto;
  } else {
    cadastroFuncionarioAberto = !cadastroFuncionarioAberto;
  }
  atualizarEstadoCadastroFuncionarioUI();

  if (cadastroFuncionarioAberto) {

    window.setTimeout(() => {
      const alvo = funcionarioEmEdicaoId
        ? document.getElementById('pinFuncionario')
        : document.getElementById('nomeFuncionario');
      alvo?.focus();
    }, 0);
  }
}

function normalizarIntervalosSemanaFuncionario(valor = null, padraoMinutos = null) {
  const base = {};
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => { base[token] = []; });
  let origem = valor || {};
  if (typeof origem === 'string') {
    try { origem = JSON.parse(origem); } catch (_) { origem = {}; }
  }
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => {
    const lista = Array.isArray(origem?.[token]) ? origem[token] : [];
    base[token] = lista
      .map(item => Number(item || 0))
      .filter(item => Number.isFinite(item) && item > 0)
      .map(item => Math.round(item));
  });
  const padrao = Number(padraoMinutos || 0);
  if (padrao > 0 && !Object.values(base).some(lista => lista.length)) {
    DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => { base[token] = [Math.round(padrao)]; });
  }
  return base;
}

function prepararIntervalosSemanaFuncionarioParaRender(valor = null) {
  const base = {};
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => { base[token] = []; });
  let origem = valor || {};
  if (typeof origem === 'string') {
    try { origem = JSON.parse(origem); } catch (_) { origem = {}; }
  }
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => {
    const lista = Array.isArray(origem?.[token]) ? origem[token] : [];
    base[token] = lista
      .map(item => String(item ?? '').trim())
      .filter(item => item === '' || (Number.isFinite(Number(item)) && Number(item) > 0));
  });
  return base;
}

function resumirIntervalosSemanaFuncionario(valor = null, padraoMinutos = null) {
  const config = normalizarIntervalosSemanaFuncionario(valor, padraoMinutos);
  const partes = DIAS_SEMANA_INTERVALO_FUNCIONARIO
    .map(([token, rotulo]) => {
      const lista = config[token] || [];
      if (!lista.length) return '';
      return `${rotulo.slice(0, 3)} ${lista.join('+')} min`;
    })
    .filter(Boolean);
  return partes.length ? partes.join(' · ') : '-';
}

function atualizarResumoIntervalosSemanaFuncionario(config = null) {
  const resumo = document.getElementById('resumoIntervalosSemanaFuncionario');
  if (!resumo) return;
  const dados = normalizarIntervalosSemanaFuncionario(config || obterIntervalosSemanaFuncionarioCadastro());
  const partes = DIAS_SEMANA_INTERVALO_FUNCIONARIO
    .map(([token, rotulo]) => {
      const lista = dados[token] || [];
      if (!lista.length) return '';
      const total = lista.reduce((acc, item) => acc + Number(item || 0), 0);
      return `<span class="tag tag-green">${rotulo}: ${lista.join(' + ')} min (${total} min)</span>`;
    })
    .filter(Boolean);
  resumo.innerHTML = partes.length
    ? partes.join('')
    : '<span class="tag tag-gray">Nenhum intervalo cadastrado por dia.</span>';
}

function renderizarIntervalosSemanaFuncionario(valor = null) {
  const container = document.getElementById('intervalosSemanaFuncionario');
  if (!container) return;
  const config = prepararIntervalosSemanaFuncionarioParaRender(valor);
  container.innerHTML = DIAS_SEMANA_INTERVALO_FUNCIONARIO.map(([token, rotulo]) => {
    const intervalos = config[token] || [];
    return `
      <div class="funcionario-intervalo-dia" data-dia="${token}">
        <div class="funcionario-intervalo-dia-titulo">${rotulo}</div>
        <div class="funcionario-intervalo-inputs">
          ${intervalos.length ? intervalos.map((minutos, idx) => `
            <div class="funcionario-intervalo-input-row">
              <div class="funcionario-intervalo-input-wrap">
                <label class="funcionario-intervalo-input-label">${idx + 1}º intervalo</label>
                <input class="intervalo-dia-funcionario" data-dia="${token}" type="number" min="0" step="1" placeholder="Minutos" value="${minutos || ''}" oninput="atualizarResumoIntervalosSemanaFuncionario()">
              </div>
              <button class="btn btn-red btn-sm" type="button" title="Excluir este intervalo" onclick="removerIntervaloDiaFuncionario('${token}', ${idx})">Excluir</button>
            </div>
          `).join('') : '<div class="funcionario-intervalo-dia-vazio">Sem intervalo neste dia.</div>'}
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:8px">
          <button class="btn btn-ghost btn-sm" type="button" onclick="adicionarIntervaloDiaFuncionario('${token}')">+ intervalo</button>
          <button class="btn btn-ghost btn-sm" type="button" onclick="limparIntervalosDiaFuncionario('${token}')">Limpar</button>
        </div>
      </div>
    `;
  }).join('');
  atualizarResumoIntervalosSemanaFuncionario(config);
}

function obterIntervalosSemanaFuncionarioCadastro() {
  const config = {};
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => { config[token] = []; });
  document.querySelectorAll('.intervalo-dia-funcionario').forEach(input => {
    const token = input.getAttribute('data-dia');
    if (!config[token]) config[token] = [];
    const valor = Number(String(input.value || '').trim());
    if (Number.isFinite(valor) && valor > 0) config[token].push(Math.round(valor));
  });
  return config;
}

function adicionarIntervaloDiaFuncionario(token) {
  const config = obterIntervalosSemanaFuncionarioCadastro();
  if (!config[token]) config[token] = [];
  config[token].push('');
  renderizarIntervalosSemanaFuncionario(config);
}

function removerIntervaloDiaFuncionario(token, index) {
  const config = obterIntervalosSemanaFuncionarioCadastro();
  if (!config[token]) config[token] = [];
  config[token].splice(index, 1);
  renderizarIntervalosSemanaFuncionario(config);
}

function limparIntervalosDiaFuncionario(token) {
  const config = obterIntervalosSemanaFuncionarioCadastro();
  config[token] = [];
  renderizarIntervalosSemanaFuncionario(config);
}

function copiarIntervaloPadraoParaSemanaFuncionario() {
  const padrao = Number(String(document.getElementById('tempoIntervaloFuncionario')?.value || '').trim());
  if (!Number.isFinite(padrao) || padrao <= 0) {
    setMsg('msgFuncionarios', 'Informe um intervalo padrão em minutos antes de aplicar na semana.', 'err');
    return;
  }
  const config = {};
  DIAS_SEMANA_INTERVALO_FUNCIONARIO.forEach(([token]) => {
    config[token] = [Math.round(padrao)];
  });
  renderizarIntervalosSemanaFuncionario(config);
  setMsg('msgFuncionarios', `Intervalo padrão de ${Math.round(padrao)} min aplicado em todos os dias.`, 'ok');
}

function atualizarAvisoVerificacaoFuncionarioEmail({
  visivel = false,
  email = '',
  nome = '',
  funcionarioId = '',
  erro = false,
  detalhe = '',
} = {}) {
  const box = document.getElementById('avisoVerificacaoFuncionarioEmail');
  const titulo = document.getElementById('avisoVerificacaoFuncionarioTitulo');
  const texto = document.getElementById('avisoVerificacaoFuncionarioTexto');
  if (!box || !titulo || !texto) return;

  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (visivel && emailNormalizado) {
    funcionarioEmailVerificacaoPendente = {
      id: String(funcionarioId || '').trim(),
      nome: String(nome || '').trim(),
      email: emailNormalizado,
    };
  }

  box.style.display = visivel ? 'block' : 'none';
  box.classList.toggle('is-error', !!erro);
  titulo.textContent = erro
    ? 'Não foi possível enviar o e-mail de validação.'
    : 'Favor verificar sua caixa de entrada.';
  texto.textContent = detalhe || (emailNormalizado
    ? `Enviamos o link de validação para ${emailNormalizado}.`
    : 'Enviamos o link de validação para o e-mail cadastrado.');
}

function atualizarAvisoEmailFuncionarioDigitado() {
  const email = String(document.getElementById('emailFuncionario')?.value || '').trim().toLowerCase();
  if (!email) {
    if (!funcionarioEmailVerificacaoPendente.email) {
      atualizarAvisoVerificacaoFuncionarioEmail({ visivel: false });
    }
    return;
  }
  if (!emailPareceValido(email)) return;

  atualizarAvisoVerificacaoFuncionarioEmail({
    visivel: true,
    email,
    nome: String(document.getElementById('nomeFuncionario')?.value || '').trim(),
    funcionarioId: funcionarioEmEdicaoId || '',
    detalhe: funcionarioEmEdicaoId
      ? 'Ao salvar, enviaremos um link de validação para este e-mail. Depois confira a caixa de entrada.'
      : 'Ao cadastrar, enviaremos um link de validação para este e-mail. Depois confira a caixa de entrada.',
  });
}

async function reenviarVerificacaoFuncionarioCadastro() {
  const email = String(funcionarioEmailVerificacaoPendente.email || document.getElementById('emailFuncionario')?.value || '').trim().toLowerCase();
  const funcionarioId = String(funcionarioEmailVerificacaoPendente.id || funcionarioEmEdicaoId || '').trim();
  const nome = String(funcionarioEmailVerificacaoPendente.nome || document.getElementById('nomeFuncionario')?.value || '').trim();

  if (!funcionarioId) {
    setMsg('msgFuncionarios', 'Salve o cadastro do funcionário antes de reenviar o e-mail de validação.', 'err');
    atualizarAvisoVerificacaoFuncionarioEmail({ visivel: true, email, nome, funcionarioId, erro: true, detalhe: 'Salve o funcionário primeiro. Depois o botão de reenviar ficará vinculado ao cadastro salvo.' });
    return;
  }

  if (!email || !emailPareceValido(email)) {
    setMsg('msgFuncionarios', 'Informe um e-mail válido para reenviar a validação.', 'err');
    atualizarAvisoVerificacaoFuncionarioEmail({ visivel: true, email, nome, funcionarioId, erro: true, detalhe: 'Não há e-mail válido selecionado para reenvio.' });
    return;
  }

  try {
    setMsg('msgFuncionarios', 'Reenviando e-mail de validação...', 'ok');
    await enviarVerificacaoEmailFuncionario(email, { funcionarioId });
    atualizarAvisoVerificacaoFuncionarioEmail({ visivel: true, email, nome, funcionarioId });
    setMsg('msgFuncionarios', `E-mail de validação reenviado para ${email}.`, 'ok');
  } catch (error) {
    atualizarAvisoVerificacaoFuncionarioEmail({
      visivel: true,
      email,
      nome,
      funcionarioId,
      erro: true,
      detalhe: error.message || 'Verifique as configurações da API de e-mail e tente novamente.',
    });
    setMsg('msgFuncionarios', error.message || 'Não foi possível reenviar o e-mail de validação.', 'err');
  }
}

async function reenviarVerificacaoFuncionarioLista(funcionarioId, email, nome = '') {
  funcionarioEmailVerificacaoPendente = {
    id: String(funcionarioId || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    nome: String(nome || '').trim(),
  };
  atualizarAvisoVerificacaoFuncionarioEmail({
    visivel: true,
    email: funcionarioEmailVerificacaoPendente.email,
    nome: funcionarioEmailVerificacaoPendente.nome,
    funcionarioId: funcionarioEmailVerificacaoPendente.id,
  });
  await reenviarVerificacaoFuncionarioCadastro();
}

// Resolve uma empresa/loja padrão para a solicitação pública (tela de login, sem sessão).
// Tenta várias estratégias e nunca depende de colunas opcionais de ordenação.
async function resolverTenantPublicoParaSolicitacao() {
  // 1) Se houver sessão (caso raro nesta tela), aproveita.
  try {
    const sessao = await resolverTenantParaCadastroFuncionario();
    if (sessao?.loja_id && sessao?.empresa_id) return sessao;
  } catch (e) { /* ignora e segue para as próximas estratégias */ }

  // 2) Primeira loja ativa (com empresa vinculada).
  try {
    const { data: lojas } = await executarSemFiltrosTenantTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id, ativo')
      .eq('ativo', true)
      .limit(50));
    const lojaValida = (lojas || []).find(l => l.empresa_id);
    if (lojaValida) {
      return {
        loja_id: String(lojaValida.id || '').trim() || null,
        empresa_id: String(lojaValida.empresa_id || '').trim() || null,
      };
    }
  } catch (e) { /* tenta a próxima */ }

  // 3) Qualquer loja (mesmo inativa) que tenha empresa.
  try {
    const { data: lojas } = await executarSemFiltrosTenantTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id')
      .limit(50));
    const lojaValida = (lojas || []).find(l => l.empresa_id);
    if (lojaValida) {
      return {
        loja_id: String(lojaValida.id || '').trim() || null,
        empresa_id: String(lojaValida.empresa_id || '').trim() || null,
      };
    }
  } catch (e) { /* tenta a próxima */ }

  // 4) Primeira empresa ativa + qualquer loja dela.
  try {
    const { data: empresas } = await executarSemFiltrosTenantTemporario(() => sb
      .from('empresas')
      .select('id, ativo')
      .eq('ativo', true)
      .limit(1));
    const empresa = (empresas || [])[0];
    if (empresa?.id) {
      const { data: lojaDaEmpresa } = await executarSemFiltrosTenantTemporario(() => sb
        .from('lojas')
        .select('id, empresa_id')
        .eq('empresa_id', empresa.id)
        .limit(1));
      const loja = (lojaDaEmpresa || [])[0];
      return {
        loja_id: loja?.id ? String(loja.id).trim() : null,
        empresa_id: String(empresa.id).trim(),
      };
    }
  } catch (e) { /* desiste */ }

  return { loja_id: null, empresa_id: null };
}

async function resolverTenantParaCadastroFuncionario() {
  const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  let empresaSessao = String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim();

  if (lojaSessao && empresaSessao) {
    return { loja_id: lojaSessao, empresa_id: empresaSessao };
  }

  if (lojaSessao && !empresaSessao) {
    const { data: lojaAtual, error: erroLojaAtual } = await executarSemFiltroLojaTemporario(() => sb
      .from('lojas')
      .select('id, empresa_id')
      .eq('id', lojaSessao)
      .maybeSingle());
    if (!erroLojaAtual && lojaAtual?.empresa_id) {
      empresaSessao = String(lojaAtual.empresa_id || '').trim();
      if (empresaSessao) {
        return { loja_id: lojaSessao, empresa_id: empresaSessao };
      }
    }
  }

  const { data: lojaPadrao, error: erroLojaPadrao } = await executarSemFiltroLojaTemporario(() => sb
    .from('lojas')
    .select('id, empresa_id')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle());

  if (erroLojaPadrao || !lojaPadrao?.id || !lojaPadrao?.empresa_id) {
    return { loja_id: null, empresa_id: null };
  }

  return {
    loja_id: String(lojaPadrao.id || '').trim() || null,
    empresa_id: String(lojaPadrao.empresa_id || '').trim() || null,
  };
}


// ── GERENCIADOR DE VÍNCULOS EMPRESA → LOJAS ──────────────────────────────
let _vinculosFuncionarioAtual = [];
let _empresasCacheVinculos = [];
let _lojasCacheVinculos = [];
let _perfisCache = [];

function obterIdsLojasPermitidasGestaoFuncionarios() {
  const ids = new Set();
  const lojas = Array.isArray(usuarioSistemaLogado?.lojas_permitidas) ? usuarioSistemaLogado.lojas_permitidas : [];
  lojas.forEach(loja => {
    const id = String(loja?.id || loja?.loja_id || '').trim();
    if (id) ids.add(id);
  });
  const lojaAtual = String(usuarioSistemaLogado?.loja_id || obterLojaIdSessao?.() || '').trim();
  if (lojaAtual) ids.add(lojaAtual);
  return ids;
}

function usuarioPodeGerenciarAcessosFuncionarios() {
  return usuarioEhAdministrador() || usuarioPodeAcessar('funcionarios');
}

function usuarioPodeGerenciarLojaFuncionario(lojaId) {
  if (usuarioEhAdministrador()) return true;
  return obterIdsLojasPermitidasGestaoFuncionarios().has(String(lojaId || '').trim());
}

function obterPerfisAtribuiveisFuncionario() {
  if (usuarioEhAdministrador()) return _perfisCache;
  const permissoesAtor = obterPermissoesUsuario();
  return _perfisCache.filter(perfil => {
    const codigo = normalizarCodigoPerfil(perfil?.codigo || '');
    if (codigo === 'ADM' || codigo === 'MASTER') return false;
    const perfilNormalizado = normalizarPerfilUsuario(perfil);
    const permissoesPerfil = { ...obterPermissoesBase(codigo), ...(perfilNormalizado?.permissoes || {}) };
    return Object.entries(permissoesPerfil).every(([chave, ativa]) => ativa !== true || permissoesAtor?.[chave] === true);
  });
}

function usuarioPodeAtribuirPerfilFuncionario(perfilId) {
  const id = String(perfilId || '').trim();
  if (!id) return true;
  return obterPerfisAtribuiveisFuncionario().some(perfil => String(perfil.id) === id);
}

async function validarEscopoGestaoFuncionario(funcionarioId, { exigirTodasLojas = false } = {}) {
  if (!usuarioPodeGerenciarAcessosFuncionarios()) {
    return { ok: false, motivo: 'Seu perfil não permite gerenciar funcionários.' };
  }
  if (usuarioEhAdministrador()) return { ok: true };

  const alvoId = String(funcionarioId || '').trim();
  if (!alvoId) return { ok: false, motivo: 'Funcionário não identificado.' };
  if (alvoId === String(usuarioSistemaLogado?.id || '').trim()) {
    return { ok: false, motivo: 'Você não pode alterar o próprio perfil ou acesso às lojas. Solicite a um Administrador do Sistema.' };
  }

  const alvoRes = await executarSemFiltrosTenantTemporario(() => sb.from('funcionarios')
    .select('id, loja_id, perfil_id, é_administrador')
    .eq('id', alvoId)
    .maybeSingle());
  if (alvoRes.error || !alvoRes.data?.id) {
    return { ok: false, motivo: 'Não foi possível validar o funcionário selecionado.' };
  }
  if (alvoRes.data.é_administrador === true) {
    return { ok: false, motivo: 'Somente outro Administrador do Sistema pode alterar este usuário.' };
  }

  const lojasPermitidas = obterIdsLojasPermitidasGestaoFuncionarios();
  if (!lojasPermitidas.size) return { ok: false, motivo: 'Sua sessão não possui lojas autorizadas para esta operação.' };
  const vinculosRes = await executarSemFiltrosTenantTemporario(() => sb.from('funcionario_lojas')
    .select('loja_id, ativo')
    .eq('funcionario_id', alvoId)
    .eq('ativo', true));
  const lojasAlvo = new Set((vinculosRes.data || []).map(v => String(v.loja_id || '')).filter(Boolean));
  const lojaPrincipal = String(alvoRes.data.loja_id || '').trim();
  if (lojaPrincipal) lojasAlvo.add(lojaPrincipal);
  if (![...lojasAlvo].some(id => lojasPermitidas.has(id))) {
    return { ok: false, motivo: 'Este funcionário não pertence a uma loja que você pode administrar.' };
  }
  if (exigirTodasLojas && [...lojasAlvo].some(id => !lojasPermitidas.has(id))) {
    return { ok: false, motivo: 'Este funcionário também possui acesso a outra loja. Somente um Administrador do Sistema pode alterar seus dados gerais.' };
  }
  return { ok: true, funcionario: alvoRes.data, lojasPermitidas };
}

  async function atualizarSelectLojasFuncionario() {
    // Carrega empresas no select de adicionar vínculo
    try {
      const idsPermitidos = [...obterIdsLojasPermitidasGestaoFuncionarios()];
      let resLojas;
      if (usuarioEhAdministrador()) {
        resLojas = await executarSemFiltrosTenantTemporario(() => sb.from('lojas').select('id, nome, empresa_id, codigo').eq('ativo', true).order('nome'));
      } else if (idsPermitidos.length) {
        resLojas = await executarSemFiltrosTenantTemporario(() => sb.from('lojas').select('id, nome, empresa_id, codigo').eq('ativo', true).in('id', idsPermitidos).order('nome'));
      } else {
        resLojas = { data: [], error: null };
      }
      _lojasCacheVinculos = resLojas.data || [];
      const empresasPermitidas = [...new Set(_lojasCacheVinculos.map(loja => String(loja.empresa_id || '')).filter(Boolean))];
      const resEmpresas = empresasPermitidas.length
        ? await executarSemFiltrosTenantTemporario(() => sb.from('empresas').select('id, nome').eq('ativo', true).in('id', empresasPermitidas).order('nome'))
        : { data: [], error: null };
      _empresasCacheVinculos = resEmpresas.data || [];

      const sel = document.getElementById('selectEmpresaVinculo');
      if (sel) {
        sel.innerHTML = '<option value="">- Empresa -</option>' +
          _empresasCacheVinculos.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
      }
    } catch(e) { console.warn('Erro ao carregar empresas/lojas:', e); }
  }

  function atualizarLojaFuncionarioSelecionada() { /* legado — mantido para compatibilidade */ }

  async function carregarVinculosFuncionario(funcionarioId) {
    const container = document.getElementById('listaVinculosEmpresas');
    const btnGerenciar = document.getElementById('btnAbrirSeletorLojas');
    if (!container) return;
    const ehAdmin = usuarioEhAdministrador();
    const podeGerenciar = usuarioPodeGerenciarAcessosFuncionarios()
      && (ehAdmin || String(funcionarioId || '') !== String(usuarioSistemaLogado?.id || ''));
    const alvoEhAdminSistema = document.getElementById('funcionarioAdmin')?.checked === true;
    if (btnGerenciar) btnGerenciar.style.display = (podeGerenciar && funcionarioId && !alvoEhAdminSistema) ? '' : 'none';
    if (!funcionarioId) {
      container.innerHTML = '<div class="empty" style="font-size:11px;">Selecione ou edite um funcionário para gerenciar acessos.</div>';
      return;
    }
    if (alvoEhAdminSistema) {
      _vinculosFuncionarioAtual = [];
      container.innerHTML = '<div style="padding:12px;border:1px solid rgba(245,158,11,.45);border-radius:8px;background:rgba(245,158,11,.08);color:var(--amber);font-size:11px;font-weight:700;">Usuário administrador: acesso global a todas as empresas, lojas e ao painel SaaS. Não depende de vínculos individuais.</div>';
      return;
    }
    container.innerHTML = '<div class="empty" style="font-size:11px;">Carregando⬦</div>';
    try {
      const lojasPermitidas = [...obterIdsLojasPermitidasGestaoFuncionarios()];
      let resVinculos = await executarSemFiltrosTenantTemporario(() => {
        let query = sb.from('funcionario_lojas').select('id, loja_id, perfil_id, ativo').eq('funcionario_id', funcionarioId).eq('ativo', true);
        if (!ehAdmin) query = lojasPermitidas.length ? query.in('loja_id', lojasPermitidas) : query.in('loja_id', ['__sem_loja_permitida__']);
        return query;
      });
      if (resVinculos.error && isMissingColumnError(resVinculos.error)) {
        resVinculos = await executarSemFiltrosTenantTemporario(() => {
          let query = sb.from('funcionario_lojas').select('id, loja_id, ativo').eq('funcionario_id', funcionarioId).eq('ativo', true);
          if (!ehAdmin) query = lojasPermitidas.length ? query.in('loja_id', lojasPermitidas) : query.in('loja_id', ['__sem_loja_permitida__']);
          return query;
        });
      }
      if (resVinculos.error) throw resVinculos.error;
      const vinculosBase = resVinculos.data || [];
      const idsLojas = [...new Set(vinculosBase.map(v => String(v.loja_id || '')).filter(Boolean))];
      let lojasPorId = new Map();
      if (idsLojas.length) {
        let resLojas = await executarSemFiltroLojaTemporario(() => sb.from('lojas').select('id, nome, empresa_id, codigo, cidade').in('id', idsLojas));
        if (resLojas.error && isMissingColumnError(resLojas.error)) {
          resLojas = await executarSemFiltroLojaTemporario(() => sb.from('lojas').select('id, nome, empresa_id, codigo').in('id', idsLojas));
        }
        if (resLojas.error) throw resLojas.error;
        lojasPorId = new Map((resLojas.data || []).map(loja => [String(loja.id), loja]));
      }
      const idsPerfis = [...new Set(vinculosBase.map(v => String(v.perfil_id || '')).filter(Boolean))];
      let perfisPorId = new Map();
      if (idsPerfis.length) {
        const resPerfis = await executarSemFiltroLojaTemporario(() => sb.from('perfis').select('id, nome').in('id', idsPerfis));
        if (!resPerfis.error) perfisPorId = new Map((resPerfis.data || []).map(perfil => [String(perfil.id), perfil]));
      }
      const vinculos = vinculosBase.map(v => ({ ...v, lojas: lojasPorId.get(String(v.loja_id || '')) || null, perfis: perfisPorId.get(String(v.perfil_id || '')) || null }));
      _vinculosFuncionarioAtual = [];
      const porEmpresa = {};
      (vinculos || []).forEach(v => {
        const empId = v.lojas?.empresa_id || 'sem-empresa';
        const empNome = _empresasCacheVinculos.find(e => e.id === empId)?.nome || 'Empresa desconhecida';
        if (!porEmpresa[empId]) porEmpresa[empId] = { empresa_id: empId, empresa_nome: empNome, lojas: [] };
        porEmpresa[empId].lojas.push({ vinculo_id: v.id, loja_id: v.loja_id, loja_nome: v.lojas?.nome || '-', loja_codigo: v.lojas?.codigo || '', loja_cidade: v.lojas?.cidade || '', perfil_id: v.perfil_id, perfil_nome: v.perfis?.nome || 'Padrão' });
      });
      _vinculosFuncionarioAtual = Object.values(porEmpresa);
      if (!_vinculosFuncionarioAtual.length) {
        container.innerHTML = alvoEhAdminSistema
          ? '<div style="padding:10px;border:1px solid rgba(245,158,11,.45);border-radius:8px;background:rgba(245,158,11,.08);color:var(--amber);font-size:11px;font-weight:700;">Usuário administrador: acesso global a todas as empresas, lojas e ao painel SaaS. Não depende de vínculos individuais.</div>'
          : '<div class="empty" style="font-size:11px;">Nenhum acesso configurado.' + (podeGerenciar ? ' Clique em "Gerenciar lojas".' : '') + '</div>';
        return;
      }
      const perfisOpts = '<option value="">Perfil padrão</option>' + obterPerfisAtribuiveisFuncionario().map(p => `<option value="${p.id}">${escaparHtmlBasico(p.nome)}</option>`).join('');
      const avisoGlobal = alvoEhAdminSistema
        ? '<div style="padding:10px;margin-bottom:8px;border:1px solid rgba(245,158,11,.45);border-radius:8px;background:rgba(245,158,11,.08);color:var(--amber);font-size:11px;font-weight:700;">Usuário administrador: acesso global ativo. Os vínculos abaixo são legados e não limitam seu acesso.</div>'
        : '';
      container.innerHTML = avisoGlobal + _vinculosFuncionarioAtual.map(emp => `
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 8px;background:var(--surface2);">
          <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">🏢 ${escaparHtmlBasico(emp.empresa_nome)}</div>
          ${emp.lojas.map(loja => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-top:1px solid var(--border);">
              <div style="min-width:0;flex:1;">
                <span style="font-size:11px;color:var(--text);">🏪 ${escaparHtmlBasico(loja.loja_nome)}</span>
                ${loja.loja_cidade ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">${escaparHtmlBasico(loja.loja_cidade)}</span>` : ''}
              </div>
              ${podeGerenciar ? `
              <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
                <select style="font-size:10px;padding:1px 4px;height:22px;max-width:120px;" onchange="alterarPerfilVinculo('${loja.vinculo_id}', this.value)" data-vinculo-perfil="${loja.vinculo_id}">${perfisOpts}</select>
                <button class="btn btn-red btn-sm" style="padding:1px 7px;font-size:10px;height:22px;" onclick="removerVinculoLoja('${loja.vinculo_id}')">✕</button>
              </div>` : `<span style="font-size:10px;color:var(--text-muted);">${escaparHtmlBasico(loja.perfil_nome)}</span>`}
            </div>
          `).join('')}
        </div>
      `).join('');
      if (podeGerenciar) {
        container.querySelectorAll('[data-vinculo-perfil]').forEach(sel => {
          const vinculoId = sel.dataset.vinculoPerfil;
          const loja = _vinculosFuncionarioAtual.flatMap(e => e.lojas).find(l => l.vinculo_id === vinculoId);
          if (loja?.perfil_id) sel.value = loja.perfil_id;
        });
      }
    } catch(e) {
      console.error('Erro ao carregar vínculos:', e);
      container.innerHTML = '<div class="empty" style="font-size:11px;color:var(--red);">Erro ao carregar acessos.</div>';
    }
  }

  function abrirSeletorLojas() {
    if (!funcionarioEmEdicaoId) { alert('Salve o funcionário primeiro.'); return; }
    if (!usuarioPodeGerenciarAcessosFuncionarios()) { alert('Seu perfil não permite gerenciar acessos.'); return; }
    if (!usuarioEhAdministrador() && String(funcionarioEmEdicaoId) === String(usuarioSistemaLogado?.id || '')) {
      alert('Você não pode alterar o próprio acesso. Solicite a um Administrador do Sistema.');
      return;
    }
    const modal = document.getElementById('modalSeletorLojas');
    const nomeEl = document.getElementById('seletorLojasFuncionarioNome');
    const filtro = document.getElementById('filtroSeletorLojas');
    if (nomeEl) nomeEl.textContent = 'Funcionário: ' + (document.getElementById('nomeFuncionario')?.value || '');
    if (filtro) filtro.value = '';
    if (modal) modal.style.display = 'flex';
    filtrarSeletorLojas();
  }

  function fecharSeletorLojas() {
    const modal = document.getElementById('modalSeletorLojas');
    if (modal) modal.style.display = 'none';
  }

  function filtrarSeletorLojas() {
    const lista = document.getElementById('listaSeletorLojas');
    if (!lista) return;
    const termo = (document.getElementById('filtroSeletorLojas')?.value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const lojasVinculadas = new Set(_vinculosFuncionarioAtual.flatMap(e => e.lojas).map(l => l.loja_id));
    const lojasFiltradas = _lojasCacheVinculos.filter(l => {
      if (!termo) return true;
      const alvo = [l.nome, l.codigo, l.cidade, l.uf, l.municipio].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      return alvo.includes(termo);
    });
    const perfisOpts = '<option value="">Perfil padrão</option>' + obterPerfisAtribuiveisFuncionario().map(p => `<option value="${p.id}">${escaparHtmlBasico(p.nome)}</option>`).join('');
    if (!lojasFiltradas.length) {
      lista.innerHTML = '<div class="empty" style="font-size:12px;">Nenhuma loja encontrada.</div>';
      return;
    }
    // Agrupar por empresa
    const porEmpresa = {};
    lojasFiltradas.forEach(l => {
      const empId = l.empresa_id || 'sem-empresa';
      const empNome = _empresasCacheVinculos.find(e => e.id === empId)?.nome || 'Sem empresa';
      if (!porEmpresa[empId]) porEmpresa[empId] = { nome: empNome, lojas: [] };
      porEmpresa[empId].lojas.push(l);
    });
    lista.innerHTML = Object.entries(porEmpresa).map(([empId, emp]) => `
      <div style="margin-bottom:6px;">
        <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.4px;padding:4px 0;border-bottom:1px solid var(--border);">🏢 ${escaparHtmlBasico(emp.nome)}</div>
        ${emp.lojas.map(loja => {
          const vinculada = lojasVinculadas.has(loja.id);
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
            <div style="min-width:0;flex:1;">
              <div style="font-size:12px;color:var(--text);">🏪 ${escaparHtmlBasico(loja.nome || loja.codigo || '-')}</div>
              <div style="font-size:10px;color:var(--text-muted);">${[loja.cidade, loja.uf].filter(Boolean).map(escaparHtmlBasico).join(' · ')}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:10px;">
              ${vinculada
                ? `<span style="font-size:10px;color:var(--green);font-weight:600;">✓ Vinculada</span>
                   <button class="btn btn-red btn-sm" style="font-size:10px;padding:2px 8px;height:22px;" onclick="removerVinculoPorLojaId('${loja.id}')">Remover</button>`
                : `<select id="perfilSeletor_${loja.id}" style="font-size:10px;padding:1px 4px;height:22px;max-width:110px;">${perfisOpts}</select>
                   <button class="btn btn-green btn-sm" style="font-size:10px;padding:2px 8px;height:22px;" onclick="adicionarVinculoLoja('${loja.id}')">+ Vincular</button>`
              }
            </div>
          </div>`;
        }).join('')}
      </div>
    `).join('');
  }

  async function adicionarVinculoLoja(lojaId) {
    const perfilId = document.getElementById('perfilSeletor_' + lojaId)?.value || null;
    try {
      const escopo = await validarEscopoGestaoFuncionario(funcionarioEmEdicaoId);
      if (!escopo.ok) throw new Error(escopo.motivo);
      if (!usuarioPodeGerenciarLojaFuncionario(lojaId)) throw new Error('Você não pode conceder acesso a esta loja.');
      if (!usuarioPodeAtribuirPerfilFuncionario(perfilId)) throw new Error('Você não pode atribuir um perfil com permissões superiores às suas.');
      const { error } = await executarSemFiltroLojaTemporario(() =>
        sb.from('funcionario_lojas').insert([{ funcionario_id: funcionarioEmEdicaoId, loja_id: lojaId, perfil_id: perfilId, ativo: true }])
      );
      if (error) throw error;
      await carregarVinculosFuncionario(funcionarioEmEdicaoId);
      filtrarSeletorLojas();
    } catch(e) { alert('Erro ao vincular: ' + (e.message || e)); }
  }

  async function removerVinculoPorLojaId(lojaId) {
    const vinculo = _vinculosFuncionarioAtual.flatMap(e => e.lojas).find(l => l.loja_id === lojaId);
    if (!vinculo) return;
    await removerVinculoLoja(vinculo.vinculo_id);
    filtrarSeletorLojas();
  }

  async function removerVinculoLoja(vinculoId) {
    if (!confirm('Remover este acesso?')) return;
    try {
      const escopo = await validarEscopoGestaoFuncionario(funcionarioEmEdicaoId);
      if (!escopo.ok) throw new Error(escopo.motivo);
      const vinculoAtual = _vinculosFuncionarioAtual.flatMap(e => e.lojas).find(l => String(l.vinculo_id) === String(vinculoId));
      if (!vinculoAtual || !usuarioPodeGerenciarLojaFuncionario(vinculoAtual.loja_id)) throw new Error('Você não pode remover o acesso desta loja.');
      const { error } = await executarSemFiltroLojaTemporario(() =>
        sb.from('funcionario_lojas').update({ ativo: false }).eq('id', vinculoId)
      );
      if (error) throw error;
      await carregarVinculosFuncionario(funcionarioEmEdicaoId);
    } catch(e) { alert('Erro ao remover: ' + (e.message || e)); }
  }

  async function alterarPerfilVinculo(vinculoId, perfilId) {
    try {
      const escopo = await validarEscopoGestaoFuncionario(funcionarioEmEdicaoId);
      if (!escopo.ok) throw new Error(escopo.motivo);
      const vinculoAtual = _vinculosFuncionarioAtual.flatMap(e => e.lojas).find(l => String(l.vinculo_id) === String(vinculoId));
      if (!vinculoAtual || !usuarioPodeGerenciarLojaFuncionario(vinculoAtual.loja_id)) throw new Error('Você não pode alterar o perfil desta loja.');
      if (!usuarioPodeAtribuirPerfilFuncionario(perfilId)) throw new Error('Você não pode atribuir um perfil com permissões superiores às suas.');
      const { error } = await executarSemFiltroLojaTemporario(() =>
        sb.from('funcionario_lojas').update({ perfil_id: perfilId || null }).eq('id', vinculoId)
      );
      if (error) throw error;
    } catch(e) { alert('Erro ao alterar perfil: ' + (e.message || e)); }
  }
  // ── FIM GERENCIADOR DE VÍNCULOS ──────────────────────────────────────────

  async function criarFuncionario() {
  try {
    if (!usuarioPodeGerenciarAcessosFuncionarios()) {
      setMsg('msgFuncionarios', 'Seu perfil não permite cadastrar ou editar funcionários.', 'err');
      return;
    }
    if (funcionarioEmEdicaoId && !usuarioEhAdministrador()) {
      const escopoEdicao = await validarEscopoGestaoFuncionario(funcionarioEmEdicaoId, { exigirTodasLojas: true });
      if (!escopoEdicao.ok) { setMsg('msgFuncionarios', escopoEdicao.motivo, 'err'); return; }
    }
    const nome = document.getElementById('nomeFuncionario').value.trim();
    const email = document.getElementById('emailFuncionario').value.trim().toLowerCase();
    const pin = document.getElementById('pinFuncionario').value.trim();
    const horarioInicio = null;
    const horarioFim = null;
    const tempoIntervaloMinutos = null;
    const intervalosSemana = {};
    const perfilId = document.getElementById('perfilFuncionario').value;
    const lojaId = null; // loja agora é gerenciada via vínculos empresa/lojas
    const emailInformado = !!email;
    const editandoAgora = !!funcionarioEmEdicaoId;
    const nomeMantidoComoOriginal = editandoAgora && normalizarTextoComparacao(nome) === normalizarTextoComparacao(funcionarioNomeOriginalEdicao);
    const emailOriginalNormalizado = String(funcionarioEmailOriginalEdicao || '').trim().toLowerCase();
    const emailAlterado = !editandoAgora || email !== emailOriginalNormalizado;
    if (!nome) { setMsg('msgFuncionarios', 'Digite o nome do funcionario.', 'err'); return; }
    if (!nomePareceCompleto(nome) && !nomeMantidoComoOriginal) { setMsg('msgFuncionarios', 'Informe um nome com pelo menos 4 caracteres.', 'err'); return; }
    if (emailInformado && !emailPareceValido(email)) { setMsg('msgFuncionarios', 'Informe um e-mail valido e real do funcionario.', 'err'); return; }

    const chkAdmin = document.getElementById('funcionarioAdmin');
    // Se a checkbox está desabilitada (usuário sem permissão), preservar o valor atual do banco
    // para não sobrescrever acidentalmente com false
    const funcionarioAdmin = chkAdmin?.disabled
      ? chkAdmin?.checked === true  // mantém o valor que foi carregado do banco
      : !!chkAdmin?.checked;
    if (funcionarioAdmin && !usuarioEhAdministrador()) {
      setMsg('msgFuncionarios', 'Somente um Administrador do Sistema pode conceder acesso global.', 'err');
      return;
    }
    if (!editandoAgora && !usuarioPodeAtribuirPerfilFuncionario(perfilId)) {
      setMsg('msgFuncionarios', 'Você não pode atribuir um perfil com permissões superiores às suas.', 'err');
      return;
    }
    // lojaId agora é gerenciado via vínculos — não bloqueia mais o cadastro
    if (!perfilId && !funcionarioAdmin) { setMsg('msgFuncionarios', 'Selecione o perfil ou marque Funcionário admin para usar o perfil ADM padrão.', 'err'); return; }
    const mensagemDuplicidade = await validarDuplicidadeCadastro({
      nome,
      email: emailInformado ? email : null,
      pin,
      funcionarioIdIgnorar: funcionarioEmEdicaoId || null,
      verificarSolicitacoesPendentes: false,
    });
    if (mensagemDuplicidade) { setMsg('msgFuncionarios', mensagemDuplicidade, 'err'); return; }
    const tenantCadastro = await resolverTenantParaCadastroFuncionario();
    // Loja agora é selecionada manualmente no formulário
    const lojaParaSalvar = await resolverTenantParaCadastroFuncionario();
    if (!lojaParaSalvar.empresa_id && !editandoAgora) {
      setMsg('msgFuncionarios', 'Não foi possível identificar empresa para o cadastro.', 'err');
      return;
    }
    // Loja logada que receberá o vínculo automático ao criar um novo funcionário.
    // Resolve de várias fontes, ignorando o filtro temporário de loja (que pode zerar obterLojaIdSessao).
    const lojaLogadaParaVinculo = String(
      usuarioSistemaLogado?.loja_id
      || (typeof window !== 'undefined' ? window.lojaAtualId : '')
      || obterLojaAtualParaIsolamento?.()
      || lojaParaSalvar.loja_id
      || ''
    ).trim();

    // Sem loja logada não dá para vincular: bloqueia o cadastro para não gerar registro órfão.
    if (!editandoAgora && !lojaLogadaParaVinculo) {
      setMsg('msgFuncionarios', 'Não foi possível identificar a loja logada para vincular o funcionário. Selecione/troque a loja no topo e tente novamente.', 'err');
      return;
    }
    const perfilIdParaSalvar = await (async () => {
      if (funcionarioAdmin) {
        const perfilAdmin = await buscarPerfilAdminPadraoParaFuncionario();
        return perfilAdmin?.id || perfilId;
      }
      if (editandoAgora && !usuarioEhAdministrador()) return funcionarioPerfilOriginalEdicao || perfilId;
      return perfilId;
    })();

    if (funcionarioAdmin && !perfilIdParaSalvar) {
      setMsg('msgFuncionarios', 'Nenhum perfil ADM encontrado para salvar o funcionário como admin. Cadastre um perfil ADM primeiro.', 'err');
      return;
    }

    const payload = editandoAgora
      ? {
          nome,
          email: emailInformado ? email : null,
          ...(pin ? { pin } : {}),
          loja_id: lojaId,
          é_administrador: funcionarioAdmin,
          perfil_id: perfilIdParaSalvar,
          horario_trabalho_inicio: horarioInicio,
          horario_trabalho_fim: horarioFim,
          tempo_intervalo_minutos: tempoIntervaloMinutos,
          intervalos_semana: intervalosSemana,
          ...(emailAlterado ? { email_verificado: false } : {}),
        }
      : {
          nome,
          email: emailInformado ? email : null,
          pin: pin || null,
          loja_id: lojaLogadaParaVinculo || null,
          empresa_id: lojaParaSalvar.empresa_id,
          é_administrador: funcionarioAdmin,
          perfil_id: perfilIdParaSalvar,
          horario_trabalho_inicio: horarioInicio,
          horario_trabalho_fim: horarioFim,
          tempo_intervalo_minutos: tempoIntervaloMinutos,
          intervalos_semana: intervalosSemana,
          email_verificado: false,
        };
    const funcionarioIdAtual = funcionarioEmEdicaoId;
    const salvarFuncionarioPayload = (payloadSalvar) => editandoAgora
      ? sb.from('funcionarios').update(payloadSalvar).eq('id', funcionarioIdAtual).select('id, nome, email').maybeSingle()
      : sb.from('funcionarios').insert([{ ...payloadSalvar, ativo: true }]).select('id, nome, email').single();
    const executarSalvamentoFuncionario = usuarioSistemaLogado?.tipo === 'admin'
      ? executarSemFiltrosTenantTemporario
      : executarSemFiltroLojaTemporario;
    let { data: funcionarioSalvo, error } = await executarSalvamentoFuncionario(() => salvarFuncionarioPayload(payload));
    if (error && String(error.message || '').toLowerCase().includes('tempo_intervalo_minutos') && tempoIntervaloMinutos === null) {
      const { tempo_intervalo_minutos, intervalos_semana, ...payloadSemTempoIntervalo } = payload;
      ({ data: funcionarioSalvo, error } = await executarSalvamentoFuncionario(() => salvarFuncionarioPayload(payloadSemTempoIntervalo)));
    }
    if (error && String(error.message || '').toLowerCase().includes('intervalos_semana') && !temIntervalosSemanaPreenchidos) {
      const { intervalos_semana, ...payloadSemTempoIntervalo } = payload;
      ({ data: funcionarioSalvo, error } = await executarSalvamentoFuncionario(() => salvarFuncionarioPayload(payloadSemTempoIntervalo)));
    }
    if (error) {
      if (isMissingWorkShiftColumnsError(error)) {
        setMsg('msgFuncionarios', 'Rode o SQL das colunas de turno (horario_trabalho_inicio/fim) na tabela funcionarios.', 'err');
        return;
      }
      if (String(error.message || '').toLowerCase().includes('tempo_intervalo_minutos')) {
        setMsg('msgFuncionarios', 'Falta aplicar a coluna tempo_intervalo_minutos no banco. Rode a nova migration antes de salvar o tempo de intervalo.', 'err');
        return;
      }
      if (String(error.message || '').toLowerCase().includes('intervalos_semana')) {
        setMsg('msgFuncionarios', 'Falta aplicar a coluna intervalos_semana no banco. Rode a nova migration antes de salvar os intervalos por dia.', 'err');
        return;
      }
      const erroTexto = String(error.message || '').toLowerCase();
      if (String(error.code || '') === '23505' || erroTexto.includes('duplicate key')) {
        if (erroTexto.includes('funcionarios_nome_unique') || erroTexto.includes('nome')) {
          setMsg('msgFuncionarios', `Já existe um funcionário cadastrado com o nome "${nome}". Escolha um nome diferente (ex.: inclua sobrenome ou loja).`, 'err');
          return;
        }
        if (erroTexto.includes('email')) {
          setMsg('msgFuncionarios', 'Já existe um funcionário cadastrado com este e-mail. Use outro e-mail.', 'err');
          return;
        }
        if (erroTexto.includes('pin')) {
          setMsg('msgFuncionarios', 'Esta senha/PIN já está em uso por outro funcionário. Escolha uma senha diferente.', 'err');
          return;
        }
        setMsg('msgFuncionarios', 'Já existe um registro com esses dados. Verifique nome, e-mail e senha e tente novamente.', 'err');
        return;
      }
      setMsg('msgFuncionarios', `${editandoAgora ? 'Erro ao salvar alterações' : 'Erro ao cadastrar'}: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      return;
    }
    const funcionarioIdParaEmail = funcionarioSalvo?.id || funcionarioIdAtual || '';
    const funcionarioNomeParaEmail = funcionarioSalvo?.nome || nome;

    // Vínculo automático com a loja logada (apenas em cadastro novo). Evita registro órfão sem loja.
    if (!editandoAgora && funcionarioSalvo?.id && lojaLogadaParaVinculo) {
      try {
        await executarSemFiltroLojaTemporario(async () => {
          // Não duplica vínculo caso já exista.
          const { data: vinculoExistente } = await sb.from('funcionario_lojas')
            .select('id')
            .eq('funcionario_id', funcionarioSalvo.id)
            .eq('loja_id', lojaLogadaParaVinculo)
            .maybeSingle();
          if (!vinculoExistente) {
            await sb.from('funcionario_lojas').insert([{
              funcionario_id: funcionarioSalvo.id,
              loja_id: lojaLogadaParaVinculo,
              perfil_id: perfilIdParaSalvar || null,
              ativo: true,
            }]);
          }
        });
      } catch (vincErro) {
        console.warn('Não foi possível criar o vínculo automático com a loja logada:', vincErro);
        // Não bloqueia o cadastro; o vínculo pode ser ajustado na edição.
      }
    }

    limparFormularioFuncionario();
    carregarFuncionarios();
    if (emailInformado && emailAlterado) {
      try {
        await enviarVerificacaoEmailFuncionario(email, { funcionarioId: funcionarioIdParaEmail });
        atualizarAvisoVerificacaoFuncionarioEmail({ visivel: true, email, nome: funcionarioNomeParaEmail, funcionarioId: funcionarioIdParaEmail });
        setMsg('msgFuncionarios', editandoAgora
          ? 'Funcionário atualizado. Favor verificar sua caixa de entrada para confirmar o novo endereço.'
          : 'Funcionário cadastrado. Favor verificar sua caixa de entrada para confirmar o endereço e liberar o acesso por e-mail.', 'ok');
      } catch (emailError) {
        atualizarAvisoVerificacaoFuncionarioEmail({
          visivel: true,
          email,
          nome: funcionarioNomeParaEmail,
          funcionarioId: funcionarioIdParaEmail,
          erro: true,
          detalhe: `${emailError.message || 'Falha no envio.'} Confira o vínculo/configuração da API de e-mail e use Reenviar e-mail.`,
        });
        setMsg('msgFuncionarios', `${editandoAgora ? 'Funcionário atualizado' : 'Funcionário cadastrado'}, mas não foi possível enviar o e-mail de validação: ${emailError.message}`, 'err');
      }
      return;
    }
    atualizarAvisoVerificacaoFuncionarioEmail({ visivel: false });
    setMsg('msgFuncionarios', editandoAgora ? 'Funcionário atualizado.' : 'Funcionário cadastrado.', 'ok');
  } catch (error) {
    setMsg('msgFuncionarios', `Erro ao cadastrar: ${mensagemErroSupabase(error, 'erro inesperado no formulário')}`, 'err');
  }
}

function limparFormularioFuncionario() {
  funcionarioEmEdicaoId = null;
  funcionarioNomeOriginalEdicao = '';
  funcionarioEmailOriginalEdicao = '';
  funcionarioPerfilOriginalEdicao = '';
  document.getElementById('nomeFuncionario').value = '';
  document.getElementById('emailFuncionario').value = '';
  document.getElementById('pinFuncionario').value = '';

  document.getElementById('perfilFuncionario').value = '';
  document.getElementById('perfilFuncionario').disabled = false;
  atualizarVisibilidadeCheckboxAdmin();
  const funcionarioAdmin = document.getElementById('funcionarioAdmin');
  if (funcionarioAdmin) {
    funcionarioAdmin.checked = false;
    atualizarVisibilidadeCheckboxAdmin();
  }
  carregarVinculosFuncionario(null);
  const btnCancelar = document.getElementById('btnCancelarEdicaoFuncionario');
  if (btnCancelar) btnCancelar.style.display = 'none';
  cadastroFuncionarioAberto = false;
  atualizarEstadoCadastroFuncionarioUI();
}

async function editarFuncionario(id) {
  atualizarAvisoVerificacaoFuncionarioEmail({ visivel: false });
  let funcionario = null;
  let error = null;

  const executarEdicaoFuncionario = usuarioSistemaLogado?.tipo === 'admin'
    ? executarSemFiltrosTenantTemporario
    : executarSemFiltroLojaTemporario;
  const respostaSingle = await executarEdicaoFuncionario(() => sb.from('funcionarios').select('*').eq('id', id).single());
  funcionario = respostaSingle.data;
  error = respostaSingle.error;

  // Fallback para evitar quebra quando o .single() falha por ambiguidade/ausência.
  if (error || !funcionario) {
    const respostaFallback = await executarEdicaoFuncionario(() => sb.from('funcionarios').select('*').eq('id', id).limit(1));
    funcionario = (respostaFallback.data || [])[0] || null;
    error = funcionario ? null : (respostaFallback.error || error);
  }

  if (error || !funcionario) {
    console.error('Erro ao carregar funcionário para edição:', error);
    setMsg('msgFuncionarios', `Não foi possível carregar o funcionário: ${mensagemErroSupabase(error, 'erro desconhecido')}.`, 'err');
    return;
  }

  if (!usuarioEhAdministrador()) {
    const escopo = await validarEscopoGestaoFuncionario(id, { exigirTodasLojas: true });
    if (!escopo.ok) { setMsg('msgFuncionarios', escopo.motivo, 'err'); return; }
  }

  funcionarioEmEdicaoId = id;
  funcionarioNomeOriginalEdicao = funcionario.nome || '';
  funcionarioEmailOriginalEdicao = funcionario.email || '';
  funcionarioPerfilOriginalEdicao = funcionario.perfil_id || '';
  cadastroFuncionarioAberto = true;
  document.getElementById('nomeFuncionario').value = funcionario.nome || '';
  document.getElementById('emailFuncionario').value = funcionario.email || '';
  document.getElementById('pinFuncionario').value = '';

  document.getElementById('perfilFuncionario').value = funcionario.perfil_id || '';
  document.getElementById('perfilFuncionario').disabled = !usuarioEhAdministrador();
  atualizarVisibilidadeCheckboxAdmin();
  const funcionarioAdmin = document.getElementById('funcionarioAdmin');
  if (funcionarioAdmin) {
    // Usar a flag é_administrador, não o perfil
    funcionarioAdmin.checked = funcionario.é_administrador === true;
    atualizarVisibilidadeCheckboxAdmin();
  }
  const btnCancelar = document.getElementById('btnCancelarEdicaoFuncionario');
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  atualizarEstadoCadastroFuncionarioUI();
  setMsg('msgFuncionarios', `Editando funcionário: ${funcionario.nome}.`, 'ok');
  // Carregar vínculos de empresa/lojas
  await carregarVinculosFuncionario(id);

  window.setTimeout(() => {
    document.getElementById('pinFuncionario')?.focus();
  }, 0);
}

function cancelarEdicaoFuncionario() {
  limparFormularioFuncionario();
  atualizarAvisoVerificacaoFuncionarioEmail({ visivel: false });
  setMsg('msgFuncionarios', 'Edição cancelada.', 'ok');
}

async function excluirFuncionario(id) {
  const escopo = await validarEscopoGestaoFuncionario(id, { exigirTodasLojas: true });
  if (!escopo.ok) { setMsg('msgFuncionarios', escopo.motivo, 'err'); return; }
  if (!confirm('Excluir este funcionário?')) return;
  // Busca SEM filtro de loja: funcionários órfãos (sem loja) ou de outra loja
  // não seriam encontrados pelo filtro padrão, impedindo a exclusão.
  const { data: funcionario, error } = await executarSemFiltrosTenantTemporario(() =>
    sb.from('funcionarios').select('id, email').eq('id', id).maybeSingle()
  );
  if (error || !funcionario) {
    setMsg('msgFuncionarios', 'Não foi possível localizar o funcionário.', 'err');
    return;
  }

  if (funcionario.email) {
    const preparo = await desvincularFuncionarioParaExclusao(id);
    if (!preparo.success) {
      setMsg('msgFuncionarios', preparo.message || 'Não foi possível preparar a exclusão do funcionário.', 'err');
      return;
    }

    const resultado = await excluirCadastroCompletoPorEmail(funcionario.email, {
      confirmar: false,
    });
    if (!resultado.success) {
      setMsg('msgFuncionarios', resultado.message || 'Não foi possível excluir o funcionário.', 'err');
      return;
    }
  } else {
    const preparo = await desvincularFuncionarioParaExclusao(id);
    if (!preparo.success) {
      setMsg('msgFuncionarios', preparo.message || 'Não foi possível preparar a exclusão do funcionário.', 'err');
      return;
    }

    const { error: erroDelete } = await executarSemFiltrosTenantTemporario(() =>
      sb.from('funcionarios').delete().eq('id', id)
    );
    if (erroDelete) {
      if (isForeignKeyViolationError(erroDelete)) {
        setMsg('msgFuncionarios', 'Não foi possível excluir porque esse usuário ainda possui vínculos obrigatórios no histórico.', 'err');
        return;
      }
      setMsg('msgFuncionarios', `Não foi possível excluir o funcionário: ${mensagemErroSupabase(erroDelete, 'erro desconhecido')}`, 'err');
      return;
    }
  }

  if (funcionarioEmEdicaoId === id) limparFormularioFuncionario();
  setMsg('msgFuncionarios', 'Funcionário excluído com sucesso.', 'ok');
  carregarFuncionarios();
  carregarSolicitacoesAcesso();
}

async function toggleFuncionario(id, ativo) {
  const escopo = await validarEscopoGestaoFuncionario(id, { exigirTodasLojas: true });
  if (!escopo.ok) { setMsg('msgFuncionarios', escopo.motivo, 'err'); return; }
  const executarToggle = usuarioSistemaLogado?.tipo === 'admin' ? executarSemFiltrosTenantTemporario : executarSemFiltroLojaTemporario;
  await executarToggle(() => sb.from('funcionarios').update({ ativo: !ativo }).eq('id', id));
  carregarFuncionarios();
}

// 
