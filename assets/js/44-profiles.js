// PERFIS
// 
let perfilEmEdicaoCodigo = null;

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
  const base = permissoes || Object.fromEntries(PERFIL_PERMISSOES.map(item => [item.key, false]));
  grid.innerHTML = `
    <div class="perm-matriz perfil-permissoes-tabela">
      <div class="perm-matriz-cabecalho">
        <span>Módulo</span><span>Função</span>${PERFIL_ACOES_COLUNAS.map(acao => `<span>${acao.label}</span>`).join('')}
      </div>
      ${PERFIL_MODULOS_MATRIZ.map(modulo => modulo.recursos.map(recurso => {
        const filtro = normalizarTextoFiltroPermissao(`${modulo.nome} ${recurso.nome}`);
        return `<div class="perm-matriz-linha" data-label="${escaparHtmlBasico(filtro)}" data-modulo="${escaparHtmlBasico(normalizarTextoFiltroPermissao(modulo.nome))}">
          <span class="perm-modulo-coluna">${escaparHtmlBasico(modulo.nome)}</span>
          <span class="perm-recurso-nome">${escaparHtmlBasico(recurso.nome)}</span>
          ${PERFIL_ACOES_COLUNAS.map(acao => {
            const chave = recurso[acao.key];
            if (!chave) return '<span class="perm-celula indisponivel">—</span>';
            const podeConceder = usuarioPodeConcederPermissaoPerfil(chave);
            const bloqueado = podeConceder ? '' : 'disabled';
            const titulo = podeConceder
              ? `${acao.label}: ${recurso.nome}`
              : `Você não possui a permissão: ${acao.label} - ${recurso.nome}`;
            return `<label class="perm-celula${podeConceder ? '' : ' bloqueada'}" title="${escaparHtmlBasico(titulo)}"><input type="checkbox" data-permissao="${chave}" ${base[chave] ? 'checked' : ''} ${bloqueado} onchange="atualizarBotaoMarcarPermissoesPerfil()"><span class="sr-only">${acao.label}</span></label>`;
          }).join('')}
        </div>`;
      }).join('')).join('')}
    </div>`;
  filtrarPermissoesPerfil();
}

function filtrarPermissoesPerfil() {
  const termo = normalizarTextoFiltroPermissao(document.getElementById('filtroPermissoesPerfil')?.value || '');
  document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha').forEach(item => {
    const texto = String(item.dataset.label || '').trim();
    item.hidden = !!termo && !texto.includes(termo);
  });
  atualizarBotaoMarcarPermissoesPerfil();
}

function marcarPermissoesPerfil(marcado = true) {
  document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha:not([hidden]) [data-permissao]:not(:disabled)').forEach(input => {
    input.checked = !!marcado;
  });
  atualizarBotaoMarcarPermissoesPerfil();
}

function todasPermissoesVisiveisMarcadas() {
  const inputs = Array.from(document.querySelectorAll('#permissoesPerfilGrid .perm-matriz-linha:not([hidden]) [data-permissao]:not(:disabled)'));
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

function usuarioPodeConcederPermissaoPerfil(chave) {
  if (usuarioEhAdministrador()) return true;
  return obterPermissoesUsuario()?.[chave] === true;
}

function validarPermissoesConcedidasPerfil(permissoes) {
  if (usuarioEhAdministrador()) return [];
  return Object.entries(permissoes || {})
    .filter(([chave, ativa]) => ativa === true && !usuarioPodeConcederPermissaoPerfil(chave))
    .map(([chave]) => chave);
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
  if (acao === 'criar') return permissoes.perfis === true || permissoes.perfis_criar === true;
  if (Object.prototype.hasOwnProperty.call(permissoes, chave)) return permissoes[chave] === true;
  return permissoes.perfis === true;
}

function obterContextoLojaCadastroPerfil() {
  const lojaId = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  const lojasConhecidas = [
    ...(typeof obterLojasPermitidasSessao === 'function' ? obterLojasPermitidasSessao() : []),
    ...(Array.isArray(lojasCadastroCache) ? lojasCadastroCache : []),
    ...(typeof lojasSaasCache !== 'undefined' && Array.isArray(lojasSaasCache) ? lojasSaasCache : []),
  ];
  const lojaAtual = lojasConhecidas.find(loja => String(loja?.id || loja?.loja_id || '').trim() === lojaId);
  return {
    lojaId,
    empresaId: String(obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || lojaAtual?.empresa_id || '').trim(),
    lojaNome: String(usuarioSistemaLogado?.loja_nome || lojaAtual?.nome || document.getElementById('topbar-store-name')?.textContent || '').trim(),
  };
}

async function completarContextoLojaCadastroPerfil(contexto) {
  if (!contexto?.lojaId || contexto.empresaId) return contexto;
  const { data, error } = await executarSemFiltrosTenantTemporario(() => sb.from('lojas')
    .select('id, nome, empresa_id')
    .eq('id', contexto.lojaId)
    .maybeSingle());
  if (error || !data) return contexto;
  return {
    ...contexto,
    empresaId: String(data.empresa_id || '').trim(),
    lojaNome: contexto.lojaNome || String(data.nome || '').trim(),
  };
}

function gerarCodigoBasePerfil(nome) {
  const slug = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42) || 'PERFIL';
  return `CUSTOM_${slug}`;
}

async function gerarCodigoUnicoPerfil(nome) {
  if (perfilEmEdicaoId && perfilEmEdicaoCodigo) return perfilEmEdicaoCodigo;
  const base = gerarCodigoBasePerfil(nome);
  const { data, error } = await sb.from('perfis').select('codigo');
  if (error) throw error;
  const usados = new Set((data || []).map(item => String(item.codigo || '').toUpperCase()));
  if (!usados.has(base)) return base;
  let sufixo = 2;
  while (usados.has(`${base}_${sufixo}`)) sufixo += 1;
  return `${base}_${sufixo}`;
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
        <div class="item-detalhe">Perfil exclusivo desta loja</div>
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
  const editandoAgora = !!perfilEmEdicaoId;
  const acao = editandoAgora ? 'editar' : 'criar';
  if (!usuarioPodeAcaoCadastroPerfis(acao)) { setMsg('msgPerfis', `Seu usuário não tem permissão para ${acao} perfis.`, 'err'); return; }
  const contexto = await completarContextoLojaCadastroPerfil(obterContextoLojaCadastroPerfil());
  if (!contexto.lojaId || !contexto.empresaId) { setMsg('msgPerfis', 'Selecione uma loja no topo antes de salvar o perfil.', 'err'); return; }
  if (!nome) { setMsg('msgPerfis', 'Digite o nome do perfil.', 'err'); return; }

  const permissoes = coletarPermissoesPerfil();
  const naoConcediveis = validarPermissoesConcedidasPerfil(permissoes);
  if (naoConcediveis.length) {
    setMsg('msgPerfis', 'O perfil contém permissões superiores às do seu usuário. Desmarque as funções bloqueadas.', 'err');
    return;
  }

  const btnSalvar = document.getElementById('btnSalvarPerfil');
  if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }
  try {
    const codigo = await gerarCodigoUnicoPerfil(nome);
    const payloadBase = { nome, codigo, permissoes, loja_id: contexto.lojaId, empresa_id: contexto.empresaId, ativo: true };
    const resposta = editandoAgora
      ? sb.from('perfis').update(payloadBase).eq('id', perfilEmEdicaoId)
      : sb.from('perfis').insert([payloadBase]);

    const { error } = await resposta;
    if (error) {
      if (isMissingProfilesTableError(error)) {
        setMsg('msgPerfis', 'Rode o SQL da tabela perfis antes de usar esta tela.', 'err');
        return;
      }
      setMsg('msgPerfis', `${editandoAgora ? 'Erro ao salvar perfil' : 'Erro ao cadastrar perfil'}: ${mensagemErroSupabase(error, 'verifique se já existe um perfil com este nome na loja')}.`, 'err');
      return;
    }

    limparFormularioPerfil();
    setMsg('msgPerfis', editandoAgora ? 'Perfil atualizado.' : 'Perfil cadastrado.', 'ok');
    await carregarPerfis();
    await carregarSelectPerfisFuncionario();
    if (usuarioSistemaLogado?.tipo === 'admin_loja') {
      atualizarSessaoAdminLojaComPerfilCorreto(localStorage.getItem('zuqui_auth') != null || localStorage.getItem('check_diario_auth_persistente') != null);
    } else {
      aplicarPermissoesSistema();
    }
  } catch (error) {
    setMsg('msgPerfis', `Não foi possível salvar o perfil: ${mensagemErroSupabase(error, 'erro desconhecido')}.`, 'err');
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = perfilEmEdicaoId ? 'Salvar' : 'Cadastrar';
    }
  }
}

function limparFormularioPerfil() {
  perfilEmEdicaoId = null;
  perfilEmEdicaoCodigo = null;
  document.getElementById('nomePerfil').value = '';
  renderizarPermissoesPerfil(Object.fromEntries(PERFIL_PERMISSOES.map(item => [item.key, false])));
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
  perfilEmEdicaoCodigo = String(perfil.codigo || '').trim() || gerarCodigoBasePerfil(perfil.nome);
  document.getElementById('nomePerfil').value = perfil.nome || '';
  const codigoPerfilNormalizado = normalizarCodigoPerfil(perfil.codigo || 'FUNCIONARIO');
  renderizarPermissoesPerfil(perfil.permissoes || obterPermissoesBase(codigoPerfilNormalizado || 'FUNCIONARIO'));
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
