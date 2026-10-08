let produtosVencimentoCache = [];
function pvEsc(v) {
  const e = document.createElement("div");
  e.textContent = String(v ?? "");
  return e.innerHTML;
}
function pvHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pvDataBR(v) {
  if (!v) return "-";
  const [a, m, d] = String(v).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
function pvDiasAte(v) {
  const a = new Date(pvHoje() + "T12:00:00"),
    b = new Date(String(v).slice(0, 10) + "T12:00:00");
  return Math.round((b - a) / 86400000);
}
function pvContexto() {
  return {
    empresaId: String(
      obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || "",
    ).trim(),
    lojaId: String(
      obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || "",
    ).trim(),
  };
}
function pvPode(acao = "visualizar") {
  if (usuarioEhAdministrador?.()) return true;
  const p = obterPermissoesUsuario?.() || {};
  return (
    p[
      acao === "visualizar"
        ? "produtos_vencimento"
        : `produtos_vencimento_${acao}`
    ] === true
  );
}
function pvSetMsg(texto, tipo = "") {
  const e = document.getElementById("pvMsg");
  if (e) {
    e.textContent = texto;
    e.className = `msg ${tipo}`;
  }
}
function limparProdutoVencimentoForm() {
  ["pvId", "pvNome", "pvCodigo", "pvPin", "pvObservacao"].forEach((id) => {
    const e = document.getElementById(id);
    if (e) e.value = "";
  });
  const data = document.getElementById("pvData");
  if (data) data.value = "";
  document.getElementById("pvDias").value = "1";
  document.getElementById("pvQuantidade").value = "1";
  document.getElementById("pvHorario").value = "08:00";
  document.getElementById("pvAlertar").checked = true;
  document.getElementById("pvNoDia").checked = true;
  document.getElementById("pvFormTitle").textContent = "Cadastrar produto";
  document.getElementById("pvSalvar").textContent = "Cadastrar produto";
  document.getElementById("pvCancelar").hidden = true;
  pvSetMsg("");
}
async function carregarProdutosVencimento() {
  const lista = document.getElementById("pvLista");
  if (!lista) return;
  if (!pvPode()) {
    lista.innerHTML =
      '<div class="pv-empty">Seu perfil não possui acesso a este módulo.</div>';
    return;
  }
  const { lojaId } = pvContexto();
  if (!lojaId) {
    lista.innerHTML = '<div class="pv-empty">Selecione uma loja.</div>';
    return;
  }
  lista.innerHTML = '<div class="pv-empty">Carregando...</div>';
  const { data, error } = await sb
    .from("produtos_vencimento")
    .select("*")
    .eq("loja_id", lojaId)
    .order("data_vencimento", { ascending: true })
    .order("nome_produto");
  if (error) {
    lista.innerHTML = `<div class="pv-empty">Erro ao carregar: ${pvEsc(error.message)}</div>`;
    return;
  }
  produtosVencimentoCache = data || [];
  renderizarProdutosVencimento();
}
function renderizarProdutosVencimento() {
  const lista = document.getElementById("pvLista");
  if (!lista) return;
  const busca = String(document.getElementById("pvBusca")?.value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const filtro = document.getElementById("pvFiltro")?.value || "ativos";
  const itens = produtosVencimentoCache.filter((x) => {
    const dias = pvDiasAte(x.data_vencimento);
    const texto = `${x.nome_produto} ${x.codigo_barras}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (busca && !texto.includes(busca)) return false;
    if (filtro === "ativos") return x.ativo !== false && dias >= 0;
    if (filtro === "vencidos") return dias < 0 || x.ativo === false;
    return true;
  });
  if (!itens.length) {
    lista.innerHTML =
      '<div class="pv-empty">Nenhum produto encontrado nesta loja.</div>';
    return;
  }
  lista.innerHTML =
    '<div class="pv-list">' +
    itens
      .map((x) => {
        const dias = pvDiasAte(x.data_vencimento),
          classe =
            dias < 0 ? "vencido" : dias <= x.dias_antecedencia ? "proximo" : "";
        const prazo =
          dias < 0
            ? `Vencido há ${Math.abs(dias)} dia(s)`
            : dias === 0
              ? "Vence hoje"
              : `Vence em ${dias} dia(s)`;
        return `<article class="pv-item ${classe}"><div><div class="pv-name">${pvEsc(x.nome_produto)}</div><div class="pv-meta">Código: ${pvEsc(x.codigo_barras || "não informado")} · Quantidade: ${pvEsc(x.quantidade || 1)}${x.observacao ? `<br>Observação: ${pvEsc(x.observacao)}` : ""}</div></div><div><div class="pv-label">Vencimento</div><div class="pv-date">${pvDataBR(x.data_vencimento)}</div></div><div><span class="pv-badge">${pvEsc(prazo)}</span></div><div class="pv-meta">Telegram: ${x.alertar_telegram ? `${x.dias_antecedencia} dia(s) antes · ${String(x.horario_alerta).slice(0, 5)}` : "desativado"}<br>Responsável: ${pvEsc(x.funcionario_nome)}</div><div class="pv-item-actions">${pvPode("editar") ? `<button class="btn btn-ghost btn-sm" onclick="editarProdutoVencimento('${x.id}')">Editar</button>` : ""}${pvPode("excluir") ? `<button class="btn btn-red btn-sm" onclick="excluirProdutoVencimento('${x.id}')">Excluir</button>` : ""}</div></article>`;
      })
      .join("") +
    "</div>";
}
async function salvarProdutoVencimento() {
  const id = String(document.getElementById("pvId").value || ""),
    nome = document.getElementById("pvNome").value.trim(),
    codigo = document.getElementById("pvCodigo").value.trim(),
    quantidade = Number(document.getElementById("pvQuantidade").value),
    observacao = document.getElementById("pvObservacao").value.trim(),
    dataV = document.getElementById("pvData").value,
    pin = document.getElementById("pvPin").value.trim(),
    dias = Number(document.getElementById("pvDias").value),
    horario = document.getElementById("pvHorario").value || "08:00",
    alertar = document.getElementById("pvAlertar").checked,
    noDia = document.getElementById("pvNoDia").checked;
  if (!pvPode(id ? "editar" : "criar")) {
    pvSetMsg("Seu perfil não possui permissão para esta ação.", "err");
    return;
  }
  if (
    !nome ||
    !dataV ||
    !pin ||
    !Number.isInteger(quantidade) ||
    quantidade < 1 ||
    !Number.isInteger(dias) ||
    dias < 0 ||
    dias > 365
  ) {
    pvSetMsg(
      "Preencha nome, vencimento, PIN e antecedência corretamente.",
      "err",
    );
    return;
  }
  pvSetMsg("Validando PIN e salvando...");
  const funcionario = await obterFuncionarioAtivoPorPin(pin);
  if (!funcionario) {
    pvSetMsg("PIN operacional inválido para esta loja.", "err");
    return;
  }
  const { empresaId, lojaId } = pvContexto();
  if (!empresaId || !lojaId) {
    pvSetMsg("Empresa/loja da sessão não identificada.", "err");
    return;
  }
  const payload = {
    empresa_id: empresaId,
    loja_id: lojaId,
    nome_produto: nome,
    codigo_barras: codigo,
    quantidade,
    observacao,
    data_vencimento: dataV,
    funcionario_id: funcionario.id,
    funcionario_nome: funcionario.nome || "Funcionário",
    dias_antecedencia: dias,
    alertar_telegram: alertar,
    avisar_no_vencimento: noDia,
    horario_alerta: horario,
    ativo: true,
    atualizado_em: new Date().toISOString(),
  };
  const resposta = id
    ? await sb
        .from("produtos_vencimento")
        .update(payload)
        .eq("id", id)
        .eq("loja_id", lojaId)
    : await sb.from("produtos_vencimento").insert(payload);
  if (resposta.error) {
    pvSetMsg("Não foi possível salvar: " + resposta.error.message, "err");
    return;
  }
  if (!id && alertar) {
    try {
      await sb.functions.invoke("telegram-webhook", {
        body: { origem: "cron" },
      });
    } catch (e) {
      console.warn("Produto salvo; envio imediato seguirá pelo agendador.", e);
    }
  }
  limparProdutoVencimentoForm();
  pvSetMsg(
    id
      ? "Produto atualizado."
      : "Produto cadastrado e alerta enviado ao Telegram.",
    "ok",
  );
  await carregarProdutosVencimento();
}
function editarProdutoVencimento(id) {
  const x = produtosVencimentoCache.find((i) => String(i.id) === String(id));
  if (!x) return;
  document.getElementById("pvId").value = x.id;
  document.getElementById("pvNome").value = x.nome_produto || "";
  document.getElementById("pvCodigo").value = x.codigo_barras || "";
  document.getElementById("pvQuantidade").value = x.quantidade || 1;
  document.getElementById("pvObservacao").value = x.observacao || "";
  document.getElementById("pvData").value = String(x.data_vencimento).slice(
    0,
    10,
  );
  document.getElementById("pvDias").value = x.dias_antecedencia;
  document.getElementById("pvHorario").value = String(x.horario_alerta).slice(
    0,
    5,
  );
  document.getElementById("pvAlertar").checked = x.alertar_telegram !== false;
  document.getElementById("pvNoDia").checked = x.avisar_no_vencimento !== false;
  document.getElementById("pvPin").value = "";
  document.getElementById("pvFormTitle").textContent = "Editar produto";
  document.getElementById("pvSalvar").textContent = "Salvar alteração";
  document.getElementById("pvCancelar").hidden = false;
  document.getElementById("pvNome").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function excluirProdutoVencimento(id) {
  if (!pvPode("excluir")) return;
  const pin = await abrirModalPin({
    titulo: "Excluir produto",
    subtitulo: "Informe o PIN operacional para confirmar.",
    textoAcao: "Excluir",
    exibirUsuario: false,
    placeholderInput: "PIN operacional",
  });
  if (!pin?.pin) return;
  const funcionario = await obterFuncionarioAtivoPorPin(pin.pin);
  if (!funcionario) {
    pvSetMsg("PIN operacional inválido para esta loja.", "err");
    return;
  }
  const { lojaId } = pvContexto();
  const { error } = await sb
    .from("produtos_vencimento")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("loja_id", lojaId);
  if (error) {
    pvSetMsg("Erro ao excluir: " + error.message, "err");
    return;
  }
  pvSetMsg("Produto removido do controle.", "ok");
  await carregarProdutosVencimento();
}
window.carregarProdutosVencimento = carregarProdutosVencimento;
window.renderizarProdutosVencimento = renderizarProdutosVencimento;
window.salvarProdutoVencimento = salvarProdutoVencimento;
window.editarProdutoVencimento = editarProdutoVencimento;
window.excluirProdutoVencimento = excluirProdutoVencimento;
window.limparProdutoVencimentoForm = limparProdutoVencimentoForm;

// Mantem a acao principal junto do horario e elimina o espaco vazio do formulario.
const pvAlertRow = document.querySelector(".pv-alert-row");
const pvActions = document.querySelector("#produtos_vencimento .pv-actions");
if (pvAlertRow && pvActions) pvAlertRow.appendChild(pvActions);
