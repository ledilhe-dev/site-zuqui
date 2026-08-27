// SOLICITACOES DE ACESSO
// 
async function carregarSolicitacoesAcesso() {
  const lista = document.getElementById('listaSolicitacoesAcesso');
  if (!lista) return;
  if (!usuarioPodeAcessar('solicitacoes')) {
    lista.innerHTML = '<div class="empty">Solicitações de acesso disponíveis apenas para perfil autorizado.</div>';
    return;
  }
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  const { data, error } = await gerenciarSolicitacoesAcesso('listar');

  if (error) {
    if (isMissingAccessRequestsTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela solicitacoes_acesso para habilitar este fluxo.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar solicitações.</div>';
    return;
  }

  if (!data?.length) {
    lista.innerHTML = '<div class="empty">Nenhuma solicitação de acesso encontrada.</div>';
    return;
  }

  const solicitacoesVisiveis = [];
  const emailsVistos = new Set();
  for (const item of data || []) {
    const chave = String(item.email || '').trim().toLowerCase() || `id:${item.id}`;
    if (emailsVistos.has(chave)) continue;
    emailsVistos.add(chave);
    solicitacoesVisiveis.push(item);
  }

  const emails = [...new Set((solicitacoesVisiveis || []).map(item => (item.email || '').toLowerCase()).filter(Boolean))];
  let funcionariosPorEmail = {};
  if (emails.length) {
    const { data: funcionariosRelacionados } = await sb
      .from('funcionarios')
      .select('id, email, ativo')
      .in('email', emails);
    funcionariosPorEmail = Object.fromEntries((funcionariosRelacionados || []).map(item => [String(item.email).toLowerCase(), item]));
  }

  lista.innerHTML = '<div class="lista">' + solicitacoesVisiveis.map(s => `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${s.nome}</div>
        <div class="item-detalhe">${s.email} · CNPJ: ${s.cnpj || '-'} · Pedido em ${fmtDate(s.created_at)}</div>
        ${s.observacao ? `<div class="item-detalhe">Informações: ${escaparHtmlBasico(s.observacao)}</div>` : ''}
        ${s.funcionario_localizado_id ? '<div class="item-detalhe"><span class="tag tag-green">Cadastro localizado para revinculação</span></div>' : ''}
        <div class="item-detalhe">Status: ${s.status === 'pendente' ? 'Pendente' : s.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}</div>
      </div>
      <div class="item-actions">
        ${s.status === 'pendente' ? '<span class="tag tag-amber">Pendente</span>' : s.status === 'aprovada' ? '<span class="tag tag-green">Aprovada</span>' : '<span class="tag tag-red">Rejeitada</span>'}
        ${s.status === 'pendente' ? `<button class="btn btn-green btn-sm" onclick="aprovarSolicitacaoAcesso('${s.id}')">Aprovar</button>` : ''}
        ${s.status === 'pendente' ? `<button class="btn btn-red" onclick="rejeitarSolicitacaoAcesso('${s.id}')">Rejeitar</button>` : ''}
        <button class="btn btn-red" onclick="excluirSolicitacaoAcesso('${s.id}', '${String(s.email || '').toLowerCase()}')">Excluir</button>
        ${s.status === 'aprovada' && funcionariosPorEmail[String(s.email || '').toLowerCase()] ? `
          <button class="btn btn-amber btn-sm" onclick="toggleFuncionarioPorEmail('${String(s.email || '').toLowerCase()}', ${funcionariosPorEmail[String(s.email || '').toLowerCase()].ativo})">
            ${funcionariosPorEmail[String(s.email || '').toLowerCase()].ativo ? 'Bloquear' : 'Desbloquear'}
          </button>
        ` : ''}
        ${s.status === 'aprovada' && funcionariosPorEmail[String(s.email || '').toLowerCase()] ? `
          <button class="btn btn-red" onclick="excluirFuncionarioPorEmail('${String(s.email || '').toLowerCase()}')">Excluir usuário</button>
        ` : ''}
      </div>
    </div>
  `).join('') + '</div>';
}

async function aprovarSolicitacaoAcesso(id) {
  const { data: solicitacao, error: errSolicitacao } = await gerenciarSolicitacoesAcesso('obter', { id });

  if (errSolicitacao || !solicitacao) {
    setMsg('msgSolicitacoes', 'Não foi possível carregar a solicitação.', 'err');
    return;
  }

  if (!nomePareceCompleto(solicitacao.nome)) {
    setMsg('msgSolicitacoes', 'A solicitação não pode ser aprovada: o nome precisa ter pelo menos 4 caracteres.', 'err');
    return;
  }

  if (!emailPareceValido(solicitacao.email)) {
    setMsg('msgSolicitacoes', 'A solicitação não pode ser aprovada: o e-mail informado não é válido para acesso.', 'err');
    return;
  }

  const mensagemDuplicidade = solicitacao.funcionario_localizado_id ? '' : await validarDuplicidadeCadastro({
    nome: solicitacao.nome,
    email: solicitacao.email.toLowerCase(),
    solicitacaoIdIgnorar: id,
    verificarSolicitacoesPendentes: true,
  });
  if (mensagemDuplicidade && !mensagemDuplicidade.includes('solicitação pendente')) {
    setMsg('msgSolicitacoes', mensagemDuplicidade, 'err');
    return;
  }

  const { data: existente } = await sb
    .from('funcionarios')
    .select('id')
    .eq('email', solicitacao.email.toLowerCase())
    .maybeSingle();

  if (existente && String(existente.id) !== String(solicitacao.funcionario_localizado_id || '')) {
    setMsg('msgSolicitacoes', 'Já existe um funcionário com este e-mail.', 'err');
    return;
  }

  // Abre o modal onde o admin escolhe lojas (uma ou mais) + perfil por loja.
  await abrirModalAprovacaoSolicitacao(solicitacao);
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL DE APROVAÇÃO: seleção de lojas + perfil por loja
// ─────────────────────────────────────────────────────────────────────────
let _aprovacaoSolicitacaoAtual = null;        // solicitação em aprovação
let _aprovacaoLojasCache = [];                // lojas disponíveis
let _aprovacaoEmpresasCache = [];             // empresas disponíveis
let _aprovacaoPerfisCache = [];               // perfis disponíveis
let _aprovacaoSelecao = {};                   // { loja_id: perfil_id | '' }

async function abrirModalAprovacaoSolicitacao(solicitacao) {
  _aprovacaoSolicitacaoAtual = solicitacao;
  _aprovacaoSelecao = {};

  const modal = document.getElementById('modalAprovacaoSolicitacao');
  const resumo = document.getElementById('aprovacaoSolicitacaoResumo');
  const filtro = document.getElementById('filtroLojasAprovacao');
  if (resumo) resumo.textContent = `${solicitacao.nome} · ${solicitacao.email}`;
  if (filtro) filtro.value = '';
  setMsg('msgAprovacaoSolicitacao', '', '');
  if (modal) modal.style.display = 'flex';

  await recarregarLojasAprovacao();
}

function fecharModalAprovacaoSolicitacao() {
  const modal = document.getElementById('modalAprovacaoSolicitacao');
  if (modal) modal.style.display = 'none';
  _aprovacaoSolicitacaoAtual = null;
  _aprovacaoSelecao = {};
}

async function recarregarLojasAprovacao() {
  const lista = document.getElementById('listaLojasAprovacao');
  if (lista) lista.innerHTML = '<div class="empty" style="font-size:12px;">Carregando lojas…</div>';
  try {
    const [resLojas, resEmpresas, resPerfis] = await Promise.all([
      executarSemFiltrosTenantTemporario(() => sb.from('lojas').select('id, nome, codigo, cidade, uf, empresa_id, ativo').order('nome')),
      executarSemFiltrosTenantTemporario(() => sb.from('empresas').select('id, nome, ativo').order('nome')),
      executarSemFiltrosTenantTemporario(() => sb.from('perfis').select('id, nome, codigo, loja_id').eq('ativo', true).order('nome')),
    ]);
    const empresaSolicitacao = String(_aprovacaoSolicitacaoAtual?.empresa_id || '');
    _aprovacaoLojasCache = (resLojas.data || []).filter(l => l.ativo !== false && String(l.empresa_id || '') === empresaSolicitacao);
    _aprovacaoEmpresasCache = (resEmpresas.data || []).filter(e => String(e.id || '') === empresaSolicitacao);
    _aprovacaoPerfisCache = resPerfis.data || [];
  } catch (e) {
    console.error('Erro ao carregar lojas/empresas/perfis para aprovação:', e);
    if (lista) lista.innerHTML = '<div class="empty" style="font-size:12px;color:var(--red);">Erro ao carregar lojas. Tente novamente.</div>';
    return;
  }
  renderizarLojasAprovacao();
}

function renderizarLojasAprovacao() {
  const lista = document.getElementById('listaLojasAprovacao');
  if (!lista) return;

  const termo = (document.getElementById('filtroLojasAprovacao')?.value || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const lojasFiltradas = _aprovacaoLojasCache.filter(l => {
    if (!termo) return true;
    const alvo = [l.nome, l.codigo, l.cidade, l.uf].filter(Boolean).join(' ')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return alvo.includes(termo);
  });

  if (!lojasFiltradas.length) {
    lista.innerHTML = '<div class="empty" style="font-size:12px;">Nenhuma loja encontrada. Use "+ Loja" para cadastrar.</div>';
    return;
  }

  // Agrupar por empresa
  const porEmpresa = {};
  lojasFiltradas.forEach(l => {
    const empId = l.empresa_id || 'sem-empresa';
    const empNome = _aprovacaoEmpresasCache.find(e => e.id === empId)?.nome || 'Sem empresa';
    if (!porEmpresa[empId]) porEmpresa[empId] = { nome: empNome, lojas: [] };
    porEmpresa[empId].lojas.push(l);
  });

  lista.innerHTML = Object.entries(porEmpresa).map(([empId, emp]) => `
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 8px;background:var(--surface2);">
      <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;">🏢 ${escaparHtmlBasico(emp.nome)}</div>
      ${emp.lojas.map(loja => {
        const marcada = Object.prototype.hasOwnProperty.call(_aprovacaoSelecao, loja.id);
        const perfisOpts = '<option value="">Perfil padrão</option>' + _aprovacaoPerfisCache
          .filter(p => String(p.loja_id || '') === String(loja.id))
          .map(p => `<option value="${escaparHtmlBasico(p.id)}">${escaparHtmlBasico(p.nome)}</option>`).join('');
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--border);">
          <label style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:pointer;">
            <input type="checkbox" ${marcada ? 'checked' : ''} onchange="alternarLojaAprovacao('${escaparHtmlBasico(loja.id)}', this.checked)">
            <span style="min-width:0;">
              <span style="font-size:12px;color:var(--text);">🏪 ${escaparHtmlBasico(loja.nome || loja.codigo || '-')}</span>
              ${(loja.cidade || loja.uf) ? `<span style="font-size:10px;color:var(--text-muted);margin-left:6px;">${escaparHtmlBasico([loja.cidade, loja.uf].filter(Boolean).join(' · '))}</span>` : ''}
            </span>
          </label>
          <select id="perfilAprovacao_${escaparHtmlBasico(loja.id)}" style="font-size:10px;padding:1px 4px;height:24px;max-width:140px;flex-shrink:0;${marcada ? '' : 'opacity:.45;'}" ${marcada ? '' : 'disabled'} onchange="definirPerfilAprovacao('${escaparHtmlBasico(loja.id)}', this.value)">${perfisOpts}</select>
        </div>`;
      }).join('')}
    </div>
  `).join('');

  // Restaura os perfis já escolhidos
  Object.entries(_aprovacaoSelecao).forEach(([lojaId, perfilId]) => {
    const sel = document.getElementById('perfilAprovacao_' + lojaId);
    if (sel && perfilId) sel.value = perfilId;
  });
}

function alternarLojaAprovacao(lojaId, marcada) {
  const id = String(lojaId || '');
  if (!id) return;
  if (marcada) {
    if (!Object.prototype.hasOwnProperty.call(_aprovacaoSelecao, id)) _aprovacaoSelecao[id] = '';
    const sel = document.getElementById('perfilAprovacao_' + id);
    if (sel) { sel.disabled = false; sel.style.opacity = '1'; }
  } else {
    delete _aprovacaoSelecao[id];
    const sel = document.getElementById('perfilAprovacao_' + id);
    if (sel) { sel.disabled = true; sel.style.opacity = '.45'; sel.value = ''; }
  }
}

function definirPerfilAprovacao(lojaId, perfilId) {
  const id = String(lojaId || '');
  if (!id || !Object.prototype.hasOwnProperty.call(_aprovacaoSelecao, id)) return;
  _aprovacaoSelecao[id] = String(perfilId || '');
}

function abrirCadastroEmpresaDaAprovacao() {
  fecharModalAprovacaoSolicitacao();
  setMsg('msgSolicitacoes', 'Cadastre a empresa abaixo. Depois volte em Solicitações e clique novamente em "Aprovar" para escolher as lojas.', 'ok');
  try { abrirPagina('empresas_saas'); } catch (e) { console.warn('Não foi possível abrir empresas_saas:', e); }
}

function abrirCadastroLojaDaAprovacao() {
  fecharModalAprovacaoSolicitacao();
  setMsg('msgSolicitacoes', 'Cadastre a loja abaixo. Depois volte em Solicitações e clique novamente em "Aprovar" para escolher as lojas.', 'ok');
  try { abrirPagina('lojas_saas'); } catch (e) { console.warn('Não foi possível abrir lojas_saas:', e); }
}

async function confirmarAprovacaoSolicitacao() {
  const solicitacao = _aprovacaoSolicitacaoAtual;
  if (!solicitacao) { fecharModalAprovacaoSolicitacao(); return; }

  const lojasSelecionadas = Object.keys(_aprovacaoSelecao);
  if (!lojasSelecionadas.length) {
    setMsg('msgAprovacaoSolicitacao', 'Selecione pelo menos uma loja para conceder acesso.', 'err');
    return;
  }

  // Empresa/loja representativas para o registro do funcionário (a tabela exige).
  const primeiraLoja = _aprovacaoLojasCache.find(l => String(l.id) === String(lojasSelecionadas[0]));
  if (!primeiraLoja || !primeiraLoja.empresa_id) {
    setMsg('msgAprovacaoSolicitacao', 'A loja selecionada não tem empresa vinculada. Verifique o cadastro da loja.', 'err');
    return;
  }

  const btn = document.getElementById('btnConfirmarAprovacaoSolicitacao');
  if (btn) { btn.disabled = true; btn.textContent = 'Aprovando…'; }

  try {
    // Revalida duplicidade na hora (caso outra aprovação tenha acontecido).
    const { data: existente } = await sb
      .from('funcionarios')
      .select('id')
      .eq('email', solicitacao.email.toLowerCase())
      .maybeSingle();
    if (existente && String(existente.id) !== String(solicitacao.funcionario_localizado_id || '')) {
      setMsg('msgAprovacaoSolicitacao', 'Já existe um funcionário com este e-mail.', 'err');
      return;
    }

    // 1) Revincula um cadastro localizado pelo CNPJ+nome ou cria um novo funcionário.
    const dadosFuncionario = {
      nome: solicitacao.nome,
      email: solicitacao.email.toLowerCase(),
      loja_id: primeiraLoja.id,
      empresa_id: primeiraLoja.empresa_id,
      perfil_id: _aprovacaoSelecao[primeiraLoja.id] || null,
      ativo: true,
      email_verificado: false,
      senha_troca_obrigatoria: true,
    };
    const operacaoFuncionario = solicitacao.funcionario_localizado_id
      ? sb.from('funcionarios').update(dadosFuncionario).eq('id', solicitacao.funcionario_localizado_id).select('id').single()
      : sb.from('funcionarios').insert([dadosFuncionario]).select('id').single();
    const { data: funcionarioCriado, error: errInsert } = await operacaoFuncionario;

    if (errInsert || !funcionarioCriado?.id) {
      setMsg('msgAprovacaoSolicitacao', `Erro ao criar o funcionário aprovado: ${mensagemErroSupabase(errInsert, 'erro desconhecido')}`, 'err');
      return;
    }

    const funcionarioId = funcionarioCriado.id;

    // 2) Cria os vínculos por loja (funcionario_lojas) com o perfil de cada uma.
    const vinculos = lojasSelecionadas.map(lojaId => ({
      funcionario_id: funcionarioId,
      loja_id: lojaId,
      perfil_id: _aprovacaoSelecao[lojaId] || null,
      ativo: true,
    }));

    let avisoVinculos = '';
    try {
      const { error: errVinculos } = await executarSemFiltroLojaTemporario(() =>
        sb.from('funcionario_lojas').insert(vinculos)
      );
      if (errVinculos) {
        console.warn('Erro ao criar vínculos de loja:', errVinculos);
        avisoVinculos = ' (atenção: não foi possível registrar todos os acessos por loja — verifique na edição do funcionário)';
      }
    } catch (eVinc) {
      console.warn('Falha ao inserir vínculos de loja:', eVinc);
      avisoVinculos = ' (atenção: não foi possível registrar os acessos por loja — verifique na edição do funcionário)';
    }

    // 3) Marca a solicitação como aprovada e limpa duplicadas.
    const { error: errUpdate } = await gerenciarSolicitacoesAcesso('aprovar', { id: solicitacao.id });
    if (errUpdate) {
      setMsg('msgAprovacaoSolicitacao', 'Funcionário criado, mas houve erro ao marcar a solicitação como aprovada.', 'err');
    }

    await gerenciarSolicitacoesAcesso('excluir_duplicadas', { id: solicitacao.id, email: solicitacao.email });

    const nomesLojas = lojasSelecionadas
      .map(lojaId => _aprovacaoLojasCache.find(l => String(l.id) === String(lojaId))?.nome)
      .filter(Boolean);
    const resumoLojas = nomesLojas.length === 1 ? nomesLojas[0] : `${nomesLojas.length} lojas`;

    // 4) Envia o e-mail de verificação / troca de senha.
    let msgFinal;
    let tipoFinal = 'ok';
    try {
      await enviarVerificacaoEmailFuncionario(solicitacao.email, { funcionarioId });
      msgFinal = `Solicitação aprovada para ${solicitacao.nome} em ${resumoLojas}${avisoVinculos}. O e-mail de confirmação e troca de senha foi enviado ao cliente.`;
    } catch (emailError) {
      tipoFinal = 'err';
      msgFinal = `Funcionário criado e vinculado em ${resumoLojas}${avisoVinculos}, mas não foi possível enviar o e-mail de confirmação: ${emailError.message}. Use "Reenviar verificação de e-mail".`;
    }

    fecharModalAprovacaoSolicitacao();
    setMsg('msgSolicitacoes', msgFinal, tipoFinal);
    carregarSolicitacoesAcesso();
    carregarFuncionarios();
    carregarNotificacoes();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Aprovar e liberar acesso'; }
  }
}


async function rejeitarSolicitacaoAcesso(id) {
  const { error } = await gerenciarSolicitacoesAcesso('rejeitar', { id });

  if (error) {
    setMsg('msgSolicitacoes', 'Não foi possível rejeitar a solicitação.', 'err');
    return;
  }

  setMsg('msgSolicitacoes', 'Solicitação rejeitada.', 'ok');
  carregarSolicitacoesAcesso();
  carregarNotificacoes();
}

async function excluirSolicitacaoAcesso(id, email = '') {
  if (!confirm('Excluir esta solicitação de acesso?')) return;

  const { error } = await gerenciarSolicitacoesAcesso('excluir', { id });
  if (error) {
    setMsg('msgSolicitacoes', 'Não foi possível excluir a solicitação.', 'err');
    return;
  }

  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (emailNormalizado) {
    await gerenciarSolicitacoesAcesso('excluir_email', { email: emailNormalizado });
  }

  setMsg('msgSolicitacoes', 'Solicitação excluída com sucesso.', 'ok');
  carregarSolicitacoesAcesso();
  carregarNotificacoes();
}

async function toggleFuncionarioPorEmail(email, ativo) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado) return;

  const { error } = await sb
    .from('funcionarios')
    .update({ ativo: !ativo })
    .eq('email', emailNormalizado);

  if (error) {
    setMsg('msgSolicitacoes', 'Não foi possível alterar o status do usuário.', 'err');
    return;
  }

  setMsg('msgSolicitacoes', !ativo ? 'Usuário desbloqueado.' : 'Usuário bloqueado.', 'ok');
  carregarSolicitacoesAcesso();
  carregarFuncionarios();
}

async function excluirFuncionarioPorEmail(email) {
  const resultado = await excluirCadastroCompletoPorEmail(email, {
    textoConfirmacao: 'Excluir totalmente este e-mail do sistema? Isso remove o usuário, a solicitação e os tokens relacionados.',
  });
  if (!resultado.success) {
    if (!resultado.cancelled) setMsg('msgSolicitacoes', resultado.message || 'Não foi possível excluir o usuário.', 'err');
    return;
  }

  setMsg('msgSolicitacoes', 'Usuário excluído com sucesso.', 'ok');
  carregarSolicitacoesAcesso();
  carregarFuncionarios();
}

// 
