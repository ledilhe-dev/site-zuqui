// CONFIGURACOES DA LOJA
// 
function obterNomeRegistroLoja(item = {}) {
  return String(item.nome || item.nome_loja || item.descricao || '').trim();
}

function obterCodigoRegistroLoja(item = {}) {
  return String(item.codigo || item.sigla || '').trim();
}

function obterAtivoRegistroLoja(item = {}) {
  if (typeof item.ativo === 'boolean') return item.ativo;
  if (typeof item.inativo === 'boolean') return !item.inativo;
  return true;
}

function atualizarFormularioLojaCadastroPorPermissao() {
  const criando = !lojaCadastroEmEdicaoId;
  // criação de filiais agora restrita a administradores
  const podeCriar = usuarioEhAdministrador();
  const bloqueado = criando && !podeCriar;
  const nome = document.getElementById('nomeLojaCadastro');
  const codigo = document.getElementById('codigoLojaCadastro');
  const cep = document.getElementById('cepLojaCadastro');
  const cidade = document.getElementById('cidadeLojaCadastro');
  const estado = document.getElementById('estadoLojaCadastro');
  const ativo = document.getElementById('ativoLojaCadastro');
  const btnSalvar = document.getElementById('btnSalvarLojaCadastro');
  if (nome) nome.disabled = bloqueado;
  if (codigo) codigo.disabled = bloqueado;
  if (cep) cep.disabled = bloqueado;
  if (cidade) cidade.disabled = bloqueado;
  if (estado) estado.disabled = bloqueado;
  if (ativo) ativo.disabled = bloqueado || (!criando && !podeCriar);
  if (btnSalvar) {
    btnSalvar.disabled = bloqueado;
    if (bloqueado) {
      btnSalvar.textContent = 'Selecione uma filial';
      btnSalvar.title = 'Apenas administradores podem cadastrar filiais';
    } else {
      btnSalvar.title = '';
    }
  }
}

function limparFormularioLojaCadastro() {
  lojaCadastroEmEdicaoId = null;
  const nome = document.getElementById('nomeLojaCadastro');
  const codigo = document.getElementById('codigoLojaCadastro');
  const cep = document.getElementById('cepLojaCadastro');
  const cidade = document.getElementById('cidadeLojaCadastro');
  const estado = document.getElementById('estadoLojaCadastro');
  const ativo = document.getElementById('ativoLojaCadastro');
  const btnSalvar = document.getElementById('btnSalvarLojaCadastro');
  const btnCancelar = document.getElementById('btnCancelarEdicaoLojaCadastro');
  if (nome) nome.value = '';
  if (codigo) codigo.value = '';
  if (cep) cep.value = '';
  if (cidade) cidade.value = '';
  if (estado) estado.value = '';
  if (ativo) ativo.checked = true;
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar filial';
  if (btnCancelar) btnCancelar.style.display = 'none';
  atualizarFormularioLojaCadastroPorPermissao();
}

function renderizarListaLojasCadastro() {
  const lista = document.getElementById('listaLojasCadastro');
  if (!lista) return;

  if (!lojasCadastroCache.length) {
    lista.innerHTML = '<div class="empty">Nenhuma filial cadastrada.</div>';
    return;
  }

  const ordenadas = [...lojasCadastroCache].sort((a, b) =>
    obterNomeRegistroLoja(a).localeCompare(obterNomeRegistroLoja(b), 'pt-BR', { sensitivity: 'base' })
  );

  lista.innerHTML = '<div class="lista">' + ordenadas.map(item => {
    const id = String(item.id || '');
    const nome = obterNomeRegistroLoja(item) || 'Sem nome';
    const codigo = obterCodigoRegistroLoja(item);
    const ativa = obterAtivoRegistroLoja(item);
    const cidade = String(item.cidade || item.municipio || '').trim();
    const estado = String(item.estado || item.uf || '').trim().toUpperCase();
    const cep = String(item.cep || '').trim();
    const detalhe = [
      codigo ? `Código: ${codigo}` : '',
      cep ? `CEP: ${cep}` : '',
      cidade || estado ? `Local: ${[cidade, estado].filter(Boolean).join('/')}` : '',
      `Status: ${ativa ? 'Ativa' : 'Inativa'}`,
    ].filter(Boolean).join(' · ');

    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(nome)}</div>
          <div class="item-detalhe">${escaparHtmlBasico(detalhe || 'Sem detalhes')}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" onclick="editarLojaCadastro('${id}')">Editar</button>
          ${usuarioPodeCriarLojasGlobais() ? `<button class="btn btn-ghost btn-sm" onclick="alternarAtivoLojaCadastro('${id}')">${ativa ? 'Inativar' : 'Ativar'}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

async function carregarLojasCadastro() {
  const lista = document.getElementById('listaLojasCadastro');
  if (!lista) return;
  if (!usuarioPodeGerenciarLojasGlobais()) {
    lojasCadastroCache = [];
    atualizarSelectLojasAdminCadastro();
    lista.innerHTML = '<div class="empty">Cadastro de lojas disponível apenas para perfil autorizado.</div>';
    return;
  }
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  const tentativas = [];
  for (const tabela of ['lojas', 'filiais']) {
    const { data, error } = await sb.from(tabela).select('*');
    tentativas.push({ tabela, data: data || [], error });
  }

  const comDados = tentativas.find(item => !item.error && item.data.length > 0);
  const semDadosMasValida = tentativas.find(item => !item.error);
  const escolhida = comDados || semDadosMasValida;

  if (!escolhida) {
    const erroRelevante = tentativas.find(item => item.error && !isMissingStoresTableError(item.error))?.error
      || tentativas.find(item => item.error)?.error
      || null;
    lojasCadastroCache = [];
    if (!erroRelevante || isMissingStoresTableError(erroRelevante)) {
      lista.innerHTML = '<div class="empty">Tabela de lojas/filiais não encontrada. Rode o SQL da estrutura multi filiais.</div>';
      setMsg('msgLojasCadastro', 'As tabelas public.lojas/public.filiais ainda não estão disponíveis neste ambiente.', 'err');
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar filiais.</div>';
    setMsg('msgLojasCadastro', `Não foi possível carregar filiais: ${mensagemErroSupabase(erroRelevante, 'erro desconhecido')}`, 'err');
    return;
  }

  tabelaLojasCadastroAtiva = escolhida.tabela;
  const lojaIdSessao = usuarioSistemaLogado?.tipo === 'admin_loja'
    ? String(usuarioSistemaLogado.loja_id || '').trim()
    : '';
  lojasCadastroCache = lojaIdSessao
    ? escolhida.data.filter(item => String(item.id || '').trim() === lojaIdSessao)
    : escolhida.data;
  atualizarSelectLojasAdminCadastro();
  renderizarListaLojasCadastro();
  setMsg('msgLojasCadastro', `Tabela ativa: ${tabelaLojasCadastroAtiva}.`, 'ok');
}

function obterVariantesPayloadLoja({ nome, codigo, ativo, cep = '', cidade = '', estado = '' }) {
  const codigoNormalizado = codigo || null;
  const cepNormalizado = formatarCepLoja(cep) || null;
  const cidadeNormalizada = String(cidade || '').trim() || null;
  const estadoNormalizado = String(estado || '').trim().toUpperCase() || null;
  return [
    { nome, codigo: codigoNormalizado, cep: cepNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado, uf: estadoNormalizado, municipio: cidadeNormalizada, ativo },
    { nome_loja: nome, codigo: codigoNormalizado, cep: cepNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado, uf: estadoNormalizado, municipio: cidadeNormalizada, ativo },
    { nome, codigo: codigoNormalizado, cep: cepNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado, ativo },
    { nome_loja: nome, codigo: codigoNormalizado, cep: cepNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado, ativo },
    { nome, codigo: codigoNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado },
    { nome_loja: nome, codigo: codigoNormalizado, cidade: cidadeNormalizada, estado: estadoNormalizado },
    { nome, ativo },
    { nome_loja: nome, ativo },
    { nome },
    { nome_loja: nome },
  ];
}

async function persistirLojaComFallback({ id = '', nome = '', codigo = '', ativo = true, cep = '', cidade = '', estado = '' }) {
  const variantes = obterVariantesPayloadLoja({ nome, codigo, ativo, cep, cidade, estado });
  let ultimoErro = null;

  for (const payload of variantes) {
    for (const tabela of [tabelaLojasCadastroAtiva, 'lojas', 'filiais']) {
      let erro = null;
      if (id) {
        ({ error: erro } = await sb.from(tabela).update(payload).eq('id', id));
      } else {
        ({ error: erro } = await sb.from(tabela).insert([payload]));
      }

      if (!erro) {
        tabelaLojasCadastroAtiva = tabela;
        return { error: null };
      }

      ultimoErro = erro;
      if (isMissingStoresTableError(erro)) continue;
      if (!isMissingColumnError(erro)) {
        return { error: erro };
      }
    }
  }

  return { error: ultimoErro };
}

async function salvarLojaCadastro() {
  if (!usuarioPodeGerenciarLojasGlobais()) {
    setMsg('msgLojasCadastro', 'Você não tem permissão para cadastrar filiais.', 'err');
    return;
  }
  // criação de nova filial só por administradores (reduz risco de cruzamento de dados)
  if (!lojaCadastroEmEdicaoId && !usuarioPodeCriarLojasGlobais()) {
    setMsg('msgLojasCadastro', 'Você pode editar a loja vinculada, mas não cadastrar novas filiais.', 'err');
    return;
  }
  if (!lojaCadastroEmEdicaoId && !usuarioEhAdministrador()) {
    setMsg('msgLojasCadastro', 'Apenas administradores podem cadastrar novas filiais.', 'err');
    return;
  }
  const nome = String(document.getElementById('nomeLojaCadastro')?.value || '').trim();
  const codigo = String(document.getElementById('codigoLojaCadastro')?.value || '').trim();
  const cep = formatarCepLoja(document.getElementById('cepLojaCadastro')?.value || '');
  const cidade = String(document.getElementById('cidadeLojaCadastro')?.value || '').trim();
  const estado = String(document.getElementById('estadoLojaCadastro')?.value || '').trim().toUpperCase();
  const ativo = document.getElementById('ativoLojaCadastro')?.checked !== false;

  if (!nome) {
    setMsg('msgLojasCadastro', 'Informe o nome da filial.', 'err');
    return;
  }
  if (!cidade || !estado) {
    setMsg('msgLojasCadastro', 'Cidade e estado são obrigatórios para calcular feriados estaduais e municipais.', 'err');
    return;
  }

  const { error } = await persistirLojaComFallback({
    id: lojaCadastroEmEdicaoId,
    nome,
    codigo,
    cep,
    cidade,
    estado,
    ativo,
  });

  if (error) {
    if (isMissingStoresTableError(error)) {
      setMsg('msgLojasCadastro', 'Tabela de lojas não encontrada. Rode o SQL da estrutura multi filiais.', 'err');
      return;
    }
    setMsg('msgLojasCadastro', `Não foi possível salvar filial: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  const estavaEditando = !!lojaCadastroEmEdicaoId;
  limparFormularioLojaCadastro();
  setMsg('msgLojasCadastro', estavaEditando ? 'Filial atualizada com sucesso.' : 'Filial cadastrada com sucesso.', 'ok');
  await carregarLojasCadastro();
  await carregarAdminsLojaCadastro();
}

function editarLojaCadastro(id) {
  if (!usuarioPodeGerenciarLojasGlobais()) {
    setMsg('msgLojasCadastro', 'Você não tem permissão para editar filiais.', 'err');
    return;
  }
  const item = lojasCadastroCache.find(loja => String(loja.id) === String(id));
  if (!item) {
    setMsg('msgLojasCadastro', 'Filial não encontrada para edição.', 'err');
    return;
  }

  lojaCadastroEmEdicaoId = String(item.id);
  const nome = document.getElementById('nomeLojaCadastro');
  const codigo = document.getElementById('codigoLojaCadastro');
  const cep = document.getElementById('cepLojaCadastro');
  const cidade = document.getElementById('cidadeLojaCadastro');
  const estado = document.getElementById('estadoLojaCadastro');
  const ativo = document.getElementById('ativoLojaCadastro');
  const btnSalvar = document.getElementById('btnSalvarLojaCadastro');
  const btnCancelar = document.getElementById('btnCancelarEdicaoLojaCadastro');

  if (nome) nome.value = obterNomeRegistroLoja(item);
  if (codigo) codigo.value = obterCodigoRegistroLoja(item);
  if (cep) cep.value = formatarCepLoja(item.cep || '');
  if (cidade) cidade.value = String(item.cidade || item.municipio || '').trim();
  if (estado) estado.value = String(item.estado || item.uf || '').trim().toUpperCase();
  if (ativo) ativo.checked = obterAtivoRegistroLoja(item);
  if (btnSalvar) btnSalvar.textContent = 'Salvar filial';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  atualizarFormularioLojaCadastroPorPermissao();
  setMsg('msgLojasCadastro', `Editando filial: ${obterNomeRegistroLoja(item) || '-'}.`, 'ok');
}

function cancelarEdicaoLojaCadastro() {
  limparFormularioLojaCadastro();
  setMsg('msgLojasCadastro', 'Edição de filial cancelada.', 'ok');
}

async function alternarAtivoLojaCadastro(id) {
  if (!usuarioPodeCriarLojasGlobais()) {
    setMsg('msgLojasCadastro', 'Você não tem permissão para ativar ou inativar filiais.', 'err');
    return;
  }
  if (!usuarioPodeGerenciarLojasGlobais()) {
    setMsg('msgLojasCadastro', 'Você não tem permissão para alterar filiais.', 'err');
    return;
  }
  const item = lojasCadastroCache.find(loja => String(loja.id) === String(id));
  if (!item) {
    setMsg('msgLojasCadastro', 'Filial não encontrada.', 'err');
    return;
  }

  const novoAtivo = !obterAtivoRegistroLoja(item);
  const variantes = [
    { ativo: novoAtivo },
    { inativo: !novoAtivo },
  ];

  let erroFinal = null;
  for (const payload of variantes) {
    for (const tabela of [tabelaLojasCadastroAtiva, 'lojas', 'filiais']) {
      const { error } = await sb.from(tabela).update(payload).eq('id', id);
      if (!error) {
        tabelaLojasCadastroAtiva = tabela;
        setMsg('msgLojasCadastro', `Filial ${novoAtivo ? 'ativada' : 'inativada'} com sucesso.`, 'ok');
        await carregarLojasCadastro();
        await carregarAdminsLojaCadastro();
        return;
      }
      erroFinal = error;
      if (isMissingStoresTableError(error)) continue;
      if (!isMissingColumnError(error)) break;
    }
    if (erroFinal && !isMissingColumnError(erroFinal) && !isMissingStoresTableError(erroFinal)) {
      break;
    }
  }

  setMsg('msgLojasCadastro', `Não foi possível alterar status da filial: ${mensagemErroSupabase(erroFinal, 'erro desconhecido')}`, 'err');
}

function obterNomeLojaCadastroPorId(lojaId = '') {
  const id = String(lojaId || '').trim();
  if (!id) return '';
  const loja = lojasCadastroCache.find(item => String(item.id || '') === id);
  return obterNomeRegistroLoja(loja) || id;
}

function atualizarSelectLojasAdminCadastro() {
  const select = document.getElementById('lojaAdminCadastro');
  if (!select) return;

  const valorAtual = String(select.value || '').trim();
  select.innerHTML = '<option value="">- Selecione a loja -</option>';

  const ordenadas = [...lojasCadastroCache].sort((a, b) =>
    obterNomeRegistroLoja(a).localeCompare(obterNomeRegistroLoja(b), 'pt-BR', { sensitivity: 'base' })
  );

  ordenadas.forEach(item => {
    const option = document.createElement('option');
    option.value = String(item.id || '');
    const nome = obterNomeRegistroLoja(item) || 'Loja sem nome';
    const codigo = obterCodigoRegistroLoja(item);
    option.textContent = codigo ? `${nome} (${codigo})` : nome;
    select.appendChild(option);
  });

  if (valorAtual && ordenadas.some(item => String(item.id || '') === valorAtual)) {
    select.value = valorAtual;
  }
}

function limparFormularioAdminLojaCadastro() {
  adminLojaCadastroEmEdicaoId = null;
  const loja = document.getElementById('lojaAdminCadastro');
  const nome = document.getElementById('nomeAdminCadastro');
  const usuario = document.getElementById('usuarioAdminCadastro');
  const pin = document.getElementById('pinAdminCadastro');
  const ativo = document.getElementById('ativoAdminCadastro');
  const btnSalvar = document.getElementById('btnSalvarAdminCadastro');
  const btnCancelar = document.getElementById('btnCancelarEdicaoAdminCadastro');
  const podeCriar = usuarioPodeCriarAdminsLojasGlobais();
  const criando = !adminLojaCadastroEmEdicaoId;
  if (loja) loja.value = '';
  if (nome) nome.value = '';
  if (usuario) usuario.value = '';
  if (pin) pin.value = '';
  if (ativo) ativo.checked = true;
  if (loja) loja.disabled = criando && !podeCriar;
  if (nome) nome.disabled = criando && !podeCriar;
  if (usuario) usuario.disabled = criando && !podeCriar;
  if (pin) pin.disabled = criando && !podeCriar;
  if (ativo) ativo.disabled = criando && !podeCriar;
  if (btnSalvar) {
    btnSalvar.textContent = podeCriar ? 'Cadastrar admin' : 'Selecione um admin';
    btnSalvar.disabled = criando && !podeCriar;
  }
  if (btnCancelar) btnCancelar.style.display = 'none';
}

function renderizarListaAdminsLojaCadastro() {
  const lista = document.getElementById('listaAdminsCadastro');
  if (!lista) return;

  if (!adminsLojaCadastroCache.length) {
    lista.innerHTML = '<div class="empty">Nenhum admin por loja cadastrado.</div>';
    return;
  }

  const podeEditarAdmins = usuarioPodeEditarAdminsDaLojaLogada();

  const ordenados = [...adminsLojaCadastroCache].sort((a, b) =>
    String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' })
  );

  lista.innerHTML = '<div class="lista">' + ordenados.map(item => {
    const id = String(item.id || '');
    const ativo = item.ativo !== false;
    const lojaNome = obterNomeLojaCadastroPorId(item.loja_id);
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(item.nome || '-')}</div>
          <div class="item-detalhe">Usuário: ${escaparHtmlBasico(item.usuario || '-')} · Loja: ${escaparHtmlBasico(lojaNome || '-')} · Status: ${ativo ? 'Ativo' : 'Inativo'}</div>
        </div>
        <div class="item-actions">
          ${podeEditarAdmins ? `<button class="btn btn-ghost btn-sm" onclick="editarAdminLojaCadastro('${id}')">Editar</button>` : ''}
          ${podeEditarAdmins ? `<button class="btn btn-ghost btn-sm" onclick="alternarAtivoAdminLojaCadastro('${id}')">${ativo ? 'Inativar' : 'Ativar'}</button>` : ''}
          ${podeEditarAdmins ? `<button class="btn btn-ghost btn-sm" onclick="excluirAdminLojaCadastro('${id}')" style="color:#e05c5c">Excluir</button>` : ''}
        </div>
      </div>
    `;
  }).join('') + '</div>';
}

async function carregarAdminsLojaCadastro() {
  const lista = document.getElementById('listaAdminsCadastro');
  if (!lista) return;
  if (!usuarioPodeEditarAdminsDaLojaLogada()) {
    adminsLojaCadastroCache = [];
    lista.innerHTML = '<div class="empty">Cadastro de admins por loja disponível apenas para perfil autorizado.</div>';
    return;
  }
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  const consultarAdmins = () => sb
    .from('usuarios_admin')
    .select('id, loja_id, nome, usuario, ativo')
    .order('nome', { ascending: true });
  const { data, error } = usuarioSistemaLogado?.tipo === 'admin'
    ? await executarSemFiltroLojaTemporario(consultarAdmins)
    : await consultarAdmins();

  if (error) {
    adminsLojaCadastroCache = [];
    if (isMissingAdminUsersTableError(error)) {
      lista.innerHTML = '<div class="empty">Tabela de admins por loja não encontrada. Rode o SQL 8.</div>';
      setMsg('msgAdminsCadastro', 'A tabela public.usuarios_admin ainda não está disponível neste ambiente.', 'err');
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar admins por loja.</div>';
    setMsg('msgAdminsCadastro', `Não foi possível carregar admins: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  adminsLojaCadastroCache = data || [];
  renderizarListaAdminsLojaCadastro();
  setMsg('msgAdminsCadastro', '', '');
}

async function salvarAdminLojaCadastro() {
  if (!adminLojaCadastroEmEdicaoId && !usuarioPodeCriarAdminsLojasGlobais()) {
    setMsg('msgAdminsCadastro', 'Você pode editar/remover admins da loja, mas não cadastrar novos admins.', 'err');
    return;
  }
  if (!usuarioPodeEditarAdminsDaLojaLogada()) {
    setMsg('msgAdminsCadastro', 'Você não tem permissão para cadastrar admins por loja.', 'err');
    return;
  }
  const lojaId = String(document.getElementById('lojaAdminCadastro')?.value || '').trim();
  const nome = String(document.getElementById('nomeAdminCadastro')?.value || '').trim();
  const usuario = String(document.getElementById('usuarioAdminCadastro')?.value || '').trim().toLowerCase();
  const pinInformado = String(document.getElementById('pinAdminCadastro')?.value || '').trim();
  const ativo = document.getElementById('ativoAdminCadastro')?.checked !== false;

  if (!lojaId) {
    setMsg('msgAdminsCadastro', 'Selecione a loja do admin.', 'err');
    return;
  }
  if (!nome) {
    setMsg('msgAdminsCadastro', 'Informe o nome do admin.', 'err');
    return;
  }
  if (!usuario) {
    setMsg('msgAdminsCadastro', 'Informe o usuário de login.', 'err');
    return;
  }

  if (!adminLojaCadastroEmEdicaoId && !pinInformado) {
    setMsg('msgAdminsCadastro', 'Informe o PIN/senha do admin.', 'err');
    return;
  }

  let senhaAtualGestor = '';
  if (pinInformado) {
    const confirmacao = await abrirModalPin({
      titulo: 'Confirmar senha do administrador',
      subtitulo: 'Digite a sua própria senha para autorizar esta alteração.',
      textoAcao: 'Autorizar alteração',
      exibirUsuario: false,
      placeholderInput: 'Sua senha atual',
    });
    if (!confirmacao?.pin) {
      setMsg('msgAdminsCadastro', 'Alteração de senha cancelada.', 'err');
      return;
    }
    senhaAtualGestor = confirmacao.pin;
  }

  const payload = { loja_id: lojaId, nome, usuario, ativo };
  const salvarAdmin = () => adminLojaCadastroEmEdicaoId
    ? sb.from('usuarios_admin').update(payload).eq('id', adminLojaCadastroEmEdicaoId).select('id').maybeSingle()
    : sb.from('usuarios_admin').insert([payload]).select('id').single();
  const { data: adminSalvo, error } = usuarioSistemaLogado?.tipo === 'admin'
    ? await executarSemFiltroLojaTemporario(salvarAdmin)
    : await salvarAdmin();
  if (error) {
    if (isMissingAdminUsersTableError(error)) {
      setMsg('msgAdminsCadastro', 'Tabela de admins por loja não encontrada. Rode o SQL 8.', 'err');
      return;
    }
    if (error?.code === '23505') {
      setMsg('msgAdminsCadastro', 'Este usuário já existe. Use outro login para este admin.', 'err');
      return;
    }
    setMsg('msgAdminsCadastro', `Não foi possível salvar admin: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (pinInformado) {
    try {
      await chamarFuncaoAutenticacao({
        action: 'admin_set_store_admin_password',
        actorId: usuarioSistemaLogado?.id,
        actorType: usuarioSistemaLogado?.tipo,
        actorPassword: senhaAtualGestor,
        targetId: adminSalvo?.id || adminLojaCadastroEmEdicaoId,
        newPassword: pinInformado,
      });
    } catch (senhaError) {
      if (!adminLojaCadastroEmEdicaoId && adminSalvo?.id) {
        await sb.from('usuarios_admin').delete().eq('id', adminSalvo.id);
      }
      setMsg('msgAdminsCadastro', `Não foi possível definir a senha do admin: ${senhaError.message || senhaError}`, 'err');
      return;
    }
  }

  const editando = !!adminLojaCadastroEmEdicaoId;
  limparFormularioAdminLojaCadastro();
  setMsg('msgAdminsCadastro', editando ? 'Admin atualizado com sucesso.' : 'Admin cadastrado com sucesso.', 'ok');
  await carregarAdminsLojaCadastro();
}

function editarAdminLojaCadastro(id) {
  if (!usuarioPodeEditarAdminsDaLojaLogada()) {
    setMsg('msgAdminsCadastro', 'Você não tem permissão para editar admins por loja.', 'err');
    return;
  }
  const item = adminsLojaCadastroCache.find(admin => String(admin.id || '') === String(id));
  if (!item) {
    setMsg('msgAdminsCadastro', 'Admin não encontrado.', 'err');
    return;
  }

  adminLojaCadastroEmEdicaoId = String(item.id);
  const loja = document.getElementById('lojaAdminCadastro');
  const nome = document.getElementById('nomeAdminCadastro');
  const usuario = document.getElementById('usuarioAdminCadastro');
  const pin = document.getElementById('pinAdminCadastro');
  const ativo = document.getElementById('ativoAdminCadastro');
  const btnSalvar = document.getElementById('btnSalvarAdminCadastro');
  const btnCancelar = document.getElementById('btnCancelarEdicaoAdminCadastro');

  if (loja) loja.value = String(item.loja_id || '');
  if (nome) nome.value = String(item.nome || '');
  if (usuario) usuario.value = String(item.usuario || '');
  if (pin) {
    pin.value = '';
    pin.placeholder = 'Deixe vazio para manter a senha';
  }
  if (ativo) ativo.checked = item.ativo !== false;
  if (loja) loja.disabled = !usuarioPodeCriarAdminsLojasGlobais();
  if (nome) nome.disabled = false;
  if (usuario) usuario.disabled = false;
  if (pin) pin.disabled = false;
  if (ativo) ativo.disabled = false;
  if (btnSalvar) btnSalvar.textContent = 'Salvar admin';
  if (btnSalvar) btnSalvar.disabled = false;
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgAdminsCadastro', `Editando admin ${item.nome || '-'} (${item.usuario || '-'})`, 'ok');
}

function cancelarEdicaoAdminLojaCadastro() {
  limparFormularioAdminLojaCadastro();
  setMsg('msgAdminsCadastro', 'Edição de admin cancelada.', 'ok');
}

async function excluirAdminLojaCadastro(id) {
  if (!usuarioPodeEditarAdminsDaLojaLogada()) {
    setMsg('msgAdminsCadastro', 'Você não tem permissão para excluir admins por loja.', 'err');
    return;
  }
  const item = adminsLojaCadastroCache.find(admin => String(admin.id || '') === String(id));
  if (!item) return;
  if (!confirm(`Excluir permanentemente o admin "${item.nome}"?`)) return;
  const excluirAdmin = () => sb.from('usuarios_admin').delete().eq('id', id);
  const { error } = usuarioSistemaLogado?.tipo === 'admin'
    ? await executarSemFiltroLojaTemporario(excluirAdmin)
    : await excluirAdmin();
  if (error) {
    setMsg('msgAdminsCadastro', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgAdminsCadastro', 'Admin excluído com sucesso.', 'ok');
  await carregarAdminsLojaCadastro();
}

async function alternarAtivoAdminLojaCadastro(id) {
  if (!usuarioPodeEditarAdminsDaLojaLogada()) {
    setMsg('msgAdminsCadastro', 'Você não tem permissão para alterar admins por loja.', 'err');
    return;
  }
  const item = adminsLojaCadastroCache.find(admin => String(admin.id || '') === String(id));
  if (!item) {
    setMsg('msgAdminsCadastro', 'Admin não encontrado.', 'err');
    return;
  }

  const novoAtivo = item.ativo === false;
  const alternarAdmin = () => sb.from('usuarios_admin').update({ ativo: novoAtivo }).eq('id', id);
  const { error } = usuarioSistemaLogado?.tipo === 'admin'
    ? await executarSemFiltroLojaTemporario(alternarAdmin)
    : await alternarAdmin();
  if (error) {
    setMsg('msgAdminsCadastro', `Não foi possível alterar status do admin: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  setMsg('msgAdminsCadastro', `Admin ${novoAtivo ? 'ativado' : 'inativado'} com sucesso.`, 'ok');
  await carregarAdminsLojaCadastro();
}

function aplicarVisibilidadeConfiguracoesLoja() {
  const podeConfiguracoes = usuarioEhAdministrador();

  const cardDados = document.getElementById('cardDadosLojaConfig');
  const cardLembrete = document.getElementById('cardLembreteLojaConfig');

  if (cardDados) cardDados.style.display = podeConfiguracoes ? '' : 'none';
  if (cardLembrete) cardLembrete.style.display = podeConfiguracoes ? '' : 'none';
}


async function obterLojaAtualCadastroConfig() {
  const lojaId = String(usuarioSistemaLogado?.loja_id || usuarioSistemaLogado?.lojaId || '').trim();
  if (!lojaId || !sb) return null;
  const { data, error } = await sb
    .from('lojas')
    .select('id,nome,nome_loja,codigo,cep,cidade,estado,uf,municipio,horario_abertura,horario_fechamento')
    .eq('id', lojaId)
    .maybeSingle();
  if (error) {
    console.warn('Não foi possível carregar dados da loja atual em public.lojas:', error);
    return null;
  }
  return data || null;
}

async function salvarDadosLojaAtualEmLojas(payloadConfig = {}) {
  const lojaId = String(usuarioSistemaLogado?.loja_id || usuarioSistemaLogado?.lojaId || '').trim();
  if (!lojaId || !sb) return;
  const cidade = String(payloadConfig.cidade || '').trim() || null;
  const estado = String(payloadConfig.estado || '').trim().toUpperCase() || null;
  const cep = formatarCepLoja(payloadConfig.cep || '') || null;
  const nome = String(payloadConfig.nome_loja || payloadConfig.nome || '').trim() || null;
  const tentativas = [
    { nome, nome_loja: nome, cep, cidade, estado, uf: estado, municipio: cidade, horario_abertura: payloadConfig.horario_abertura, horario_fechamento: payloadConfig.horario_fechamento },
    { nome, cep, cidade, estado, horario_abertura: payloadConfig.horario_abertura, horario_fechamento: payloadConfig.horario_fechamento },
    { nome_loja: nome, cep, cidade, estado },
    { cep, cidade, estado },
  ];
  for (const dados of tentativas) {
    const limpo = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined));
    const { error } = await sb.from('lojas').update(limpo).eq('id', lojaId);
    if (!error) return;
    if (!isMissingColumnError(error)) {
      console.warn('Não foi possível salvar dados da loja atual em public.lojas:', error);
      return;
    }
  }
}

async function carregarConfiguracoesLoja() {
  aplicarVisibilidadeConfiguracoesLoja();
  const resultado = await obterConfiguracoesLoja();
  if (resultado.missing) {
    setMsg('msgConfiguracoes', 'Rode o SQL da tabela configuracoes_loja para salvar estas informações.', 'err');
    document.getElementById('configNomeLoja').value = 'CHECK DIARIO';
    document.getElementById('configCepLoja').value = '';
    document.getElementById('configCidadeLoja').value = '';
    document.getElementById('configEstadoLoja').value = '';
    document.getElementById('configHorarioAbertura').value = '04:00';
    document.getElementById('configHorarioFechamento').value = '20:00';
    document.getElementById('configHorarioLancamento').value = '';
    document.getElementById('configHorarioLembrete').value = '';
    document.getElementById('configEnviarEmailLembrete').checked = false;
    return;
  }

  const cfgBase = resultado.data || {};
  const lojaAtual = await obterLojaAtualCadastroConfig();
  const cfg = { ...cfgBase, ...(lojaAtual || {}) };
  document.getElementById('configNomeLoja').value = cfg.nome_loja || cfg.nome || 'CHECK DIARIO';
  document.getElementById('configCepLoja').value = formatarCepLoja(cfg.cep || '');
  document.getElementById('configCidadeLoja').value = cfg.cidade || cfg.municipio || '';
  document.getElementById('configEstadoLoja').value = String(cfg.estado || cfg.uf || '').toUpperCase();
  document.getElementById('configHorarioAbertura').value = cfg.horario_abertura || '04:00';
  document.getElementById('configHorarioFechamento').value = cfg.horario_fechamento || '20:00';
  document.getElementById('configHorarioLancamento').value = cfg.horario_lancamento_checklist || '';
  document.getElementById('configHorarioLembrete').value = cfg.horario_lembrete_checklist || '';
  document.getElementById('configEnviarEmailLembrete').checked = !!cfg.enviar_email_lembrete;
  setMsg('msgConfiguracoes', '', '');
}

async function salvarConfiguracoesLoja() {
  const nomeLoja = document.getElementById('configNomeLoja').value.trim() || 'CHECK DIARIO';
  const cepLoja = formatarCepLoja(document.getElementById('configCepLoja')?.value || '');
  const cidadeLoja = String(document.getElementById('configCidadeLoja')?.value || '').trim();
  const estadoLoja = String(document.getElementById('configEstadoLoja')?.value || '').trim().toUpperCase();
  const horarioAbertura = document.getElementById('configHorarioAbertura').value || '04:00';
  const horarioFechamento = document.getElementById('configHorarioFechamento').value || '20:00';
  const horarioLancamento = document.getElementById('configHorarioLancamento').value || null;
  const horarioLembrete = document.getElementById('configHorarioLembrete').value || null;
  const enviarEmail = !!document.getElementById('configEnviarEmailLembrete').checked;

  if (!cidadeLoja || !estadoLoja) {
    setMsg('msgConfiguracoes', 'Cidade e estado são obrigatórios para o calendário de feriados funcionar corretamente.', 'err');
    return;
  }

  const resultado = await obterConfiguracoesLoja();
  if (resultado.missing) {
    setMsg('msgConfiguracoes', 'Rode o SQL da tabela configuracoes_loja antes de salvar.', 'err');
    return;
  }

  const payload = {
    nome_loja: nomeLoja,
    cep: cepLoja || null,
    cidade: cidadeLoja,
    estado: estadoLoja,
    horario_abertura: horarioAbertura,
    horario_fechamento: horarioFechamento,
    horario_lancamento_checklist: horarioLancamento,
    horario_lembrete_checklist: horarioLembrete,
    enviar_email_lembrete: enviarEmail,
  };

  const query = resultado.data?.id
    ? sb.from('configuracoes_loja').update(payload).eq('id', resultado.data.id)
    : sb.from('configuracoes_loja').insert([payload]);

  const { error } = await query;
  if (error) {
    setMsg('msgConfiguracoes', 'Não foi possível salvar as configurações da loja.', 'err');
    return;
  }

  await salvarDadosLojaAtualEmLojas(payload);
  setMsg('msgConfiguracoes', 'Configurações da loja salvas com sucesso.', 'ok');
  await carregarLojasSaas();
  carregarNotificacoes();
}

// 

//
