// DESTINATARIOS DE E-MAIL
// 
async function carregarDestinatariosEmail() {
  const lista = document.getElementById('listaDestinatariosEmail');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando⬦</div>';

  const { data, error } = await sb.from('email_notificacoes').select('*').order('nome');
  if (error) {
    if (isMissingEmailNotificationsTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela email_notificacoes para habilitar este recurso.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar destinatários.</div>';
    return;
  }

  if (!data?.length) {
    lista.innerHTML = '<div class="empty">Nenhum destinatário cadastrado.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + data.map(dest => `
    <div class="item">
      <div class="item-info">
        <div class="item-nome">${dest.nome}</div>
        <div class="item-detalhe">${dest.email}</div>
      </div>
      <div class="item-actions">
        ${dest.ativo ? '<span class="tag tag-green">Ativo</span>' : '<span class="tag tag-gray">Inativo</span>'}
        <button class="btn btn-ghost btn-sm" onclick="editarDestinatarioEmail('${dest.id}')">Editar</button>
        <button class="btn btn-amber btn-sm" onclick="toggleDestinatarioEmail('${dest.id}', ${dest.ativo})">${dest.ativo ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-red" onclick="excluirDestinatarioEmail('${dest.id}')">Excluir</button>
      </div>
    </div>
  `).join('') + '</div>';
}

async function criarDestinatarioEmail() {
  const nome = document.getElementById('nomeDestinatarioEmail').value.trim();
  const email = document.getElementById('emailDestinatarioEmail').value.trim().toLowerCase();
  if (!nome) { setMsg('msgDestinatariosEmail', 'Digite o nome do destinatário.', 'err'); return; }
  if (!email) { setMsg('msgDestinatariosEmail', 'Digite o e-mail do destinatário.', 'err'); return; }

  const payload = { nome, email };
  const editandoAgora = !!destinatarioEmailEmEdicaoId;
  const query = editandoAgora
    ? sb.from('email_notificacoes').update(payload).eq('id', destinatarioEmailEmEdicaoId)
    : sb.from('email_notificacoes').insert([{ ...payload, ativo: true }]);

  const { error } = await query;
  if (error) {
    if (isMissingEmailNotificationsTableError(error)) {
      setMsg('msgDestinatariosEmail', 'Rode o SQL da tabela email_notificacoes antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgDestinatariosEmail', editandoAgora ? 'Erro ao salvar destinatário.' : 'Erro ao cadastrar destinatário.', 'err');
    return;
  }

  limparFormularioDestinatarioEmail();
  setMsg('msgDestinatariosEmail', editandoAgora ? 'Destinatário atualizado.' : 'Destinatário cadastrado.', 'ok');
  carregarDestinatariosEmail();
}

function limparFormularioDestinatarioEmail() {
  destinatarioEmailEmEdicaoId = null;
  document.getElementById('nomeDestinatarioEmail').value = '';
  document.getElementById('emailDestinatarioEmail').value = '';
  const btnSalvar = document.getElementById('btnSalvarDestinatarioEmail');
  const btnCancelar = document.getElementById('btnCancelarEdicaoDestinatarioEmail');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function editarDestinatarioEmail(id) {
  const { data: destinatario, error } = await sb.from('email_notificacoes').select('*').eq('id', id).single();
  if (error || !destinatario) {
    setMsg('msgDestinatariosEmail', 'Não foi possível carregar o destinatário.', 'err');
    return;
  }

  destinatarioEmailEmEdicaoId = id;
  document.getElementById('nomeDestinatarioEmail').value = destinatario.nome || '';
  document.getElementById('emailDestinatarioEmail').value = destinatario.email || '';
  const btnSalvar = document.getElementById('btnSalvarDestinatarioEmail');
  const btnCancelar = document.getElementById('btnCancelarEdicaoDestinatarioEmail');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgDestinatariosEmail', `Editando destinatário: ${destinatario.nome}.`, 'ok');
}

function cancelarEdicaoDestinatarioEmail() {
  limparFormularioDestinatarioEmail();
  setMsg('msgDestinatariosEmail', 'Edição cancelada.', 'ok');
}

async function toggleDestinatarioEmail(id, ativo) {
  await sb.from('email_notificacoes').update({ ativo: !ativo }).eq('id', id);
  carregarDestinatariosEmail();
}

async function excluirDestinatarioEmail(id) {
  if (!confirm('Excluir este destinatário?')) return;
  await sb.from('email_notificacoes').delete().eq('id', id);
  if (destinatarioEmailEmEdicaoId === id) limparFormularioDestinatarioEmail();
  carregarDestinatariosEmail();
}

// 
