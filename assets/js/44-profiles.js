// PERFIS
// 
function normalizarTextoFiltroPermissao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function renderizarPermissoesPerfil(permissoes = null) {
  const grid = document.getElementById('permissoesPerfilGrid');
  if (!grid) return;
  const codigo = document.getElementById('codigoPerfil')?.value || 'FUNCIONARIO';
  const base = permissoes || obterPermissoesBase(codigo);
  const layoutCompacto = window.matchMedia('(max-width: 700px)').matches;
  grid.innerHTML = PERFIL_MODULOS_MATRIZ.map((modulo, indiceModulo) => `
    <section class="perm-modulo${layoutCompacto && indiceModulo > 0 ? ' recolhido' : ''}" data-modulo="${escaparHtmlBasico(normalizarTextoFiltroPermissao(modulo.nome))}">
      <button class="perm-modulo-titulo" type="button" onclick="alternarModuloPermissoesPerfil(this)" aria-expanded="${layoutCompacto && indiceModulo > 0 ? 'false' : 'true'}">
        <span>${escaparHtmlBasico(modulo.nome)}</span><span class="perm-modulo-contagem">${modulo.recursos.length} ${modulo.recursos.length === 1 ? 'função' : 'funções'}</span><span class="perm-modulo-seta" aria-hidden="true">▾</span>
      </button>
      <div class="perm-matriz">
        <div class="perm-matriz-cabecalho"><span>Função</span>${PERFIL_ACOES_COLUNAS.map(acao => `<span>${acao.label}</span>`).join('')}</div>
        ${modulo.recursos.map(recurso => {
          const filtro = normalizarTextoFiltroPermissao(`${modulo.nome} ${recurso.nome}`);
          return `<div class="perm-matriz-linha" data-label="${escaparHtmlBasico(filtro)}">
            <span class="perm-recurso-nome">${escaparHtmlBasico(recurso.nome)}</span>
            ${PERFIL_ACOES_COLUNAS.map(acao => {
              const chave = recurso[acao.key];
              return chave
                ? `<label class="perm-celula" title="${acao.label}: ${escaparHtmlBasico(recurso.nome)}"><input type="checkbox" data-permissao="${chave}" ${base[chave] ? 'checked' : ''} onchange="atualizarBotaoMarcarPermissoesPerfil()"><span class="sr-only">${acao.label}</span></label>`
                : '<span class="perm-celula indisponivel">—</span>';
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    </section>
  `).join('');
  filtrarPermissoesPerfil();
}

function alternarModuloPermissoesPerfil(botao) {
  const modulo = botao?.closest('.perm-modulo');
  if (!modulo) return;
  const recolhido = modulo.classList.toggle('recolhido');
  botao.setAttribute('aria-expanded', String(!recolhido));
}

function filtrarPermissoesPerfil() {
  const termo = normalizarTextoFiltroPermissao(document.getElementById('filtroPermissoesPerfil')?.value || '');
  document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha').forEach(item => {
    const texto = String(item.dataset.label || '').trim();
    item.hidden = !!termo && !texto.includes(termo);
  });
  document.querySelectorAll('#permissoesPerfilGrid .perm-modulo').forEach(modulo => {
    modulo.hidden = !modulo.querySelector('.perm-matriz-linha:not([hidden])');
    if (termo && !modulo.hidden) {
      modulo.classList.remove('recolhido');
      modulo.querySelector('.perm-modulo-titulo')?.setAttribute('aria-expanded', 'true');
    }
  });
  atualizarBotaoMarcarPermissoesPerfil();
}

function marcarPermissoesPerfil(marcado = true) {
  document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha:not([hidden]) [data-permissao]').forEach(input => {
    input.checked = !!marcado;
  });
  atualizarBotaoMarcarPermissoesPerfil();
}

function todasPermissoesVisiveisMarcadas() {
  const inputs = Array.from(document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha:not([hidden]) [data-permissao]'));
  if (!inputs.length) return false;
  return inputs.every(input => input.checked);
}

function atualizarBotaoMarcarPermissoesPerfil() {
  const btn = document.getElementById('btnMarcarDesmarcarPermissoesPerfil');
  if (!btn) return;
  btn.textContent = todasPermissoesVisiveisMarcadas() ? 'Desmarcar todos' : 'Marcar todos';
}

function toggleMarcarPermissoesPerfil() {
  marcarPermissoesPerfil(!todasPermissoesVisiveisMarcadas());
}

function coletarPermissoesPerfil() {
  const permissoes = {};
  document.querySelectorAll('#permissoesPerfilGrid [data-permissao]').forEach(input => {
    permissoes[input.dataset.permissao] = !!input.checked;
  });
  return permissoes;
}

function usuarioPodeAcaoCadastroPerfis(acao = 'visualizar') {
  if (usuarioEhAdministrador()) return true;
  const permissoes = obterPermissoesUsuario();
  const chave = {
    visualizar: 'perfis',
    criar: 'perfis_criar',
    editar: 'perfis_editar',
    excluir: 'perfis_excluir',
  }[acao] || 'perfis';
  if (Object.prototype.hasOwnProperty.call(permissoes, chave)) return permissoes[chave] === true;
  return permissoes.perfis === true;
}

function obterContextoLojaCadastroPerfil() {
  return {
    lojaId: String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim(),
    empresaId: String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || '').trim(),
    lojaNome: String(usuarioSistemaLogado?.loja_nome || document.getElementById('topbar-store-name')?.textContent || '').trim(),
  };
}

function aplicarPermissoesCadastroPerfisUI() {
  const podeCriar = usuarioPodeAcaoCadastroPerfis('criar');
  const podeEditar = usuarioPodeAcaoCadastroPerfis('editar');
  const card = document.getElementById('cardFormularioPerfil');
  if (card) card.style.display = (podeCriar || podeEditar) ? '' : 'none';
  const btnSalvar = document.getElementById('btnSalvarPerfil');
  if (btnSalvar) btnSalvar.style.display = (perfilEmEdicaoId ? podeEditar : podeCriar) ? '' : 'none';
  const contexto = obterContextoLojaCadastroPerfil();
  const tag = document.getElementById('perfilLojaContexto');
  if (tag) tag.textContent = contexto.lojaId ? `Loja: ${contexto.lojaNome || 'selecionada'}` : 'Selecione uma loja';
}

async function carregarPerfis() {
  const lista = document.getElementById('listaPerfis');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  const contexto = obterContextoLojaCadastroPerfil();
  aplicarPermissoesCadastroPerfisUI();
  if (!contexto.lojaId) {
    lista.innerHTML = '<div class="empty">Selecione uma loja no topo para visualizar e administrar seus perfis.</div>';
    return;
  }
  const resposta = await sb.from('perfis').select('*').eq('ativo', true).order('nome');
  const { data, error } = resposta;
  if (error) {
    if (isMissingProfilesTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela perfis para habilitar este recurso.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar perfis.</div>';
    return;
  }

  if (!data?.length) {
    lista.innerHTML = '<div class="empty">Nenhum perfil cadastrado.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + data.map(p => `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${p.nome}</div>
        <div class="item-detalhe">Código: ${p.codigo || '-'} · Perfil exclusivo desta loja</div>
      </div>
      <div class="item-actions">
        ${usuarioPodeAcaoCadastroPerfis('editar') ? `<button class="btn btn-ghost btn-sm" onclick="editarPerfil('${p.id}')">Editar</button>` : ''}
        ${usuarioPodeAcaoCadastroPerfis('excluir') ? `<button class="btn btn-red btn-sm" onclick="excluirPerfil('${p.id}')">Excluir</button>` : ''}
      </div>
    </div>
  `).join('') + '</div>';
}

async function carregarSelectPerfisFuncionario() {
  // Atualizar cache de perfis para o gerenciador de vínculos
  try {
    const { data } = await sb.from('perfis').select('id, nome, codigo, permissoes, loja_id').eq('ativo', true).order('nome');
    if (data) _perfisCache = data;
  } catch(e) {}
  const sel = document.getElementById('perfilFuncionario');
  if (!sel) return;
  sel.innerHTML = '<option value="">- Selecione o perfil -</option>';
  const resposta = await sb.from('perfis').select('id, nome, codigo, loja_id').eq('ativo', true).order('nome');
  const { data, error } = resposta;
  if (error) {
    if (isMissingProfilesTableError(error)) {
      setMsg('msgFuncionarios', 'Rode o SQL da tabela perfis antes de cadastrar funcionarios.', 'err');
    }
    return;
  }
  const perfisVisiveis = usuarioEhAdministrador()
    ? (data || [])
    : (data || []).filter(p => obterPerfisAtribuiveisFuncionario().some(item => String(item.id) === String(p.id)));
  perfisVisiveis.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    if (p.codigo) o.dataset.codigo = p.codigo;
    o.textContent = p.nome;
    sel.appendChild(o);
  });
  sel.disabled = false;
}

function atualizarFuncionarioAdminCheckbox() {
  // Perfil e checkbox "Funcionário admin" são completamente independentes.
  // A checkbox só é controlada manualmente por um ADM do sistema — não sincronizar com perfil.
  atualizarVisibilidadeCheckboxAdmin();
}

function atualizarVisibilidadeCheckboxAdmin() {
  // A checkbox "Funcionário admin" é controlada exclusivamente pelo tipo do usuário logado:
  // - tipo='admin' (admin global): vê e pode editar
  // Perfil Administrador de loja NÃO pode conceder esta flag global.
  const container = document.getElementById('containerFuncionarioAdmin');
  if (!container) return;
  const tipo = usuarioSistemaLogado?.tipo;
  const podeAlterar = tipo === 'admin';
  container.style.display = podeAlterar ? '' : 'none';
  const chk = document.getElementById('funcionarioAdmin');
  if (chk) {
    chk.disabled = !podeAlterar;
    chk.title = podeAlterar ? '' : 'Apenas administradores podem conceder ou revogar este acesso.';
  }
}

function atualizarFuncionarioAdminToggle() {
  // Checkbox "Funcionário admin" é independente do perfil.
  // Nenhuma alteração automática no select de perfil ao marcar/desmarcar.
  if (funcionarioEmEdicaoId) carregarVinculosFuncionario(funcionarioEmEdicaoId);
}

async function criarPerfil() {
  const nome = document.getElementById('nomePerfil').value.trim();
  const codigo = document.getElementById('codigoPerfil').value;
  const editandoAgora = !!perfilEmEdicaoId;
  const acao = editandoAgora ? 'editar' : 'criar';
  if (!usuarioPodeAcaoCadastroPerfis(acao)) { setMsg('msgPerfis', `Seu usuário não tem permissão para ${acao} perfis.`, 'err'); return; }
  const contexto = obterContextoLojaCadastroPerfil();
  if (!contexto.lojaId || !contexto.empresaId) { setMsg('msgPerfis', 'Selecione uma loja no topo antes de salvar o perfil.', 'err'); return; }
  if (!nome) { setMsg('msgPerfis', 'Digite o nome do perfil.', 'err'); return; }

  const payloadBase = { nome, codigo, permissoes: coletarPermissoesPerfil(), loja_id: contexto.lojaId, empresa_id: contexto.empresaId, ativo: true };
  const resposta = editandoAgora
    ? sb.from('perfis').update(payloadBase).eq('id', perfilEmEdicaoId)
    : sb.from('perfis').insert([payloadBase]);

  const { error } = resposta;
  if (error) {
    if (isMissingProfilesTableError(error)) {
      setMsg('msgPerfis', 'Rode o SQL da tabela perfis antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgPerfis', `${editandoAgora ? 'Erro ao salvar perfil' : 'Erro ao cadastrar perfil'}: ${mensagemErroSupabase(error, 'verifique se já existe um perfil com este código na loja')}.`, 'err');
    return;
  }

  limparFormularioPerfil();
  setMsg('msgPerfis', editandoAgora ? 'Perfil atualizado.' : 'Perfil cadastrado.', 'ok');
  carregarPerfis();
  carregarSelectPerfisFuncionario();
  if (usuarioSistemaLogado?.tipo === 'admin_loja') {
    atualizarSessaoAdminLojaComPerfilCorreto(localStorage.getItem('zuqui_auth') != null || localStorage.getItem('check_diario_auth_persistente') != null);
  } else {
    aplicarPermissoesSistema();
  }
}

function limparFormularioPerfil() {
  perfilEmEdicaoId = null;
  document.getElementById('nomePerfil').value = '';
  document.getElementById('codigoPerfil').value = 'FUNCIONARIO';
  renderizarPermissoesPerfil(obterPermissoesBase('FUNCIONARIO'));
  const titulo = document.getElementById('tituloFormularioPerfil');
  const btnSalvar = document.getElementById('btnSalvarPerfil');
  const btnCancelar = document.getElementById('btnCancelarEdicaoPerfil');
  if (titulo) titulo.textContent = 'Novo perfil';
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function editarPerfil(id) {
  if (!usuarioPodeAcaoCadastroPerfis('editar')) { setMsg('msgPerfis', 'Seu usuário pode visualizar, mas não editar perfis.', 'err'); return; }
  const { data: perfil, error } = await sb.from('perfis').select('*').eq('id', id).single();
  if (error || !perfil) {
    setMsg('msgPerfis', 'Não foi possível carregar o perfil.', 'err');
    return;
  }

  perfilEmEdicaoId = id;
  document.getElementById('nomePerfil').value = perfil.nome || '';
  const codigoPerfilNormalizado = normalizarCodigoPerfil(perfil.codigo || 'FUNCIONARIO');
  document.getElementById('codigoPerfil').value = codigoPerfilNormalizado || 'FUNCIONARIO';
  renderizarPermissoesPerfil({ ...obterPermissoesBase(codigoPerfilNormalizado || 'FUNCIONARIO'), ...(perfil.permissoes || {}) });
  const titulo = document.getElementById('tituloFormularioPerfil');
  const btnSalvar = document.getElementById('btnSalvarPerfil');
  const btnCancelar = document.getElementById('btnCancelarEdicaoPerfil');
  if (titulo) titulo.textContent = `Editando perfil: ${perfil.nome || '-'}`;
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  aplicarPermissoesCadastroPerfisUI();
  document.getElementById('nomePerfil')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function excluirPerfil(id) {
  if (!usuarioPodeAcaoCadastroPerfis('excluir')) { setMsg('msgPerfis', 'Seu usuário não tem permissão para excluir perfis.', 'err'); return; }
  const perfilRes = await sb.from('perfis').select('id, nome, codigo').eq('id', id).maybeSingle();
  if (perfilRes.error || !perfilRes.data) { setMsg('msgPerfis', 'Perfil não encontrado nesta loja.', 'err'); return; }
  const [vinculosRes, funcionariosRes] = await Promise.all([
    executarSemFiltrosTenantTemporario(() => sb.from('funcionario_lojas').select('id', { count: 'exact', head: true }).eq('perfil_id', id)),
    executarSemFiltrosTenantTemporario(() => sb.from('funcionarios').select('id', { count: 'exact', head: true }).eq('perfil_id', id)),
  ]);
  const emUso = Number(vinculosRes.count || 0) + Number(funcionariosRes.count || 0);
  if (emUso > 0) { setMsg('msgPerfis', `O perfil "${perfilRes.data.nome}" está vinculado a ${emUso} usuário(s). Troque esses vínculos antes de excluir.`, 'err'); return; }
  if (!confirm(`Excluir o perfil "${perfilRes.data.nome}" desta loja?`)) return;
  const { error } = await sb.from('perfis').delete().eq('id', id);
  if (error) { setMsg('msgPerfis', `Não foi possível excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}.`, 'err'); return; }
  if (perfilEmEdicaoId === id) limparFormularioPerfil();
  setMsg('msgPerfis', 'Perfil excluído desta loja.', 'ok');
  await carregarPerfis();
  await carregarSelectPerfisFuncionario();
}

function cancelarEdicaoPerfil() {
  limparFormularioPerfil();
  setMsg('msgPerfis', 'Edição cancelada.', 'ok');
}

// 
