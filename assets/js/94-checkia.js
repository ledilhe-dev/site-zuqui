(function () {
  "use strict";
  const state = { intent: null, data: null, recognition: null };
  const $ = (id) => document.getElementById(id);
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const money = (v) =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const fuzzy = (wanted, list, key = "nome") => {
    const w = norm(wanted);
    if (!w) return null;
    return (list || [])
      .map((x) => {
        const n = norm(x?.[key]);
        let score = n === w ? 1 : n.includes(w) || w.includes(n) ? 0.86 : 0;
        const words = w.split(/\s+/).filter(Boolean);
        if (!score && words.length)
          score =
            (words.filter((p) => n.includes(p)).length / words.length) * 0.72;
        return { x, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.score >= 0.45
      ? (list || [])
          .map((x) => ({
            x,
            score: (() => {
              const n = norm(x?.[key]);
              if (n === w) return 1;
              if (n.includes(w) || w.includes(n)) return 0.86;
              const z = w.split(/\s+/).filter(Boolean);
              return z.length
                ? (z.filter((p) => n.includes(p)).length / z.length) * 0.72
                : 0;
            })(),
          }))
          .sort((a, b) => b.score - a.score)[0].x
      : null;
  };
  function ensureUI() {
    if ($("checkiaOverlay")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<button class="checkia-fab" id="checkiaFab" type="button" aria-label="Abrir CHECKIA"><span class="checkia-fab-dot"></span><svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm-1 3.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93Z"/></svg><span class="checkia-fab-label">CHECKIA</span></button><div class="checkia-overlay" id="checkiaOverlay"><section class="checkia-card" role="dialog" aria-modal="true" aria-labelledby="checkiaTitle"><header class="checkia-head"><div class="checkia-brand"><span class="checkia-logo">✦</span><div><div class="checkia-title" id="checkiaTitle">CHECKIA</div><div class="checkia-sub">Sua assistente do CheckDiário</div></div></div><button class="checkia-close" id="checkiaClose" type="button">×</button></header><div class="checkia-body"><div class="checkia-examples">Fale ou digite: “conta a pagar de 100 reais do cartão Bradesco em 2x”, “agenda reunião amanhã às 14h” ou “qual o total da fatura Nubank?”.</div><div class="checkia-compose"><textarea class="checkia-input" id="checkiaInput" placeholder="O que você quer fazer?"></textarea><button class="checkia-mic" id="checkiaMic" type="button" title="Falar">🎙</button></div><div class="checkia-actions"><button class="btn btn-ghost" id="checkiaClear" type="button">Limpar</button><button class="btn btn-green" id="checkiaInterpret" type="button">Interpretar</button></div><div class="checkia-status" id="checkiaStatus"></div><div class="checkia-result" id="checkiaResult" hidden></div></div></section></div>`,
    );
    $("checkiaFab").onclick = open;
    $("checkiaClose").onclick = close;
    $("checkiaOverlay").onclick = (e) => {
      if (e.target === $("checkiaOverlay")) close();
    };
    $("checkiaInterpret").onclick = interpret;
    $("checkiaClear").onclick = () => {
      $("checkiaInput").value = "";
      $("checkiaResult").hidden = true;
      $("checkiaStatus").textContent = "";
    };
    $("checkiaMic").onclick = listen;
    $("checkiaInput").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") interpret();
    });
  }
  function open() {
    $("checkiaOverlay").classList.add("aberta");
    setTimeout(() => $("checkiaInput").focus(), 50);
  }
  function close() {
    $("checkiaOverlay").classList.remove("aberta");
  }
  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $("checkiaStatus").textContent =
        "Este navegador não oferece reconhecimento de voz. Você ainda pode digitar o pedido.";
      return;
    }
    if (state.recognition) {
      state.recognition.stop();
      return;
    }
    const r = new SR();
    state.recognition = r;
    r.lang = "pt-BR";
    r.interimResults = true;
    r.continuous = false;
    $("checkiaMic").classList.add("ouvindo");
    $("checkiaStatus").textContent = "Ouvindo…";
    r.onresult = (e) => {
      $("checkiaInput").value = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
    };
    r.onerror = (e) =>
      ($("checkiaStatus").textContent =
        `Não consegui ouvir (${e.error}). Tente novamente.`);
    r.onend = () => {
      state.recognition = null;
      $("checkiaMic").classList.remove("ouvindo");
      if ($("checkiaInput").value.trim()) interpret();
    };
    r.start();
  }
  function parseDate(t) {
    const n = norm(t),
      d = new Date();
    if (n.includes("depois de amanha")) d.setDate(d.getDate() + 2);
    else if (n.includes("amanha")) d.setDate(d.getDate() + 1);
    const br = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (br) {
      const y = br[3]
        ? Number(br[3].length === 2 ? "20" + br[3] : br[3])
        : d.getFullYear();
      return `${y}-${String(br[2]).padStart(2, "0")}-${String(br[1]).padStart(2, "0")}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function uiCatalog() {
    const pages = Array.from(document.querySelectorAll(".nav-btn[data-page]"))
      .filter((b) => b.style.display !== "none")
      .map((b) => ({
        id: b.dataset.page,
        name:
          b.querySelector(".nav-title")?.textContent?.trim() ||
          b.textContent.trim(),
        element: b,
      }));
    return { pages };
  }
  function parseUiCommand(text, n) {
    const pageMatch = n.match(
      /^(?:abra|abrir|va para|ir para|mostre|mostrar|acesse|acessar)\s+(?:a pagina\s+|o menu\s+|a aba\s+)?(.+)$/,
    );
    if (pageMatch)
      return { intent: "ui", action: "page", target: pageMatch[1] };
    const fieldMatch = text.match(
      /^(?:preencha|digite|coloque|informe)\s+(?:o\s+)?(?:campo\s+)?(.+?)\s+(?:com|como)\s+(.+)$/iu,
    );
    if (fieldMatch)
      return {
        intent: "ui",
        action: "field",
        target: fieldMatch[1],
        value: fieldMatch[2],
      };
    const clickMatch = text.match(
      /^(?:clique|aperte|pressione|selecione)\s+(?:em|no|na)?\s*(.+)$/iu,
    );
    if (clickMatch)
      return { intent: "ui", action: "click", target: clickMatch[1] };
    if (
      /(leia|liste|explique|o que tem).*(pagina|tela|aba)|^leia (?:a )?(?:pagina|tela)/.test(
        n,
      )
    )
      return { intent: "ui", action: "read" };
    return null;
  }
  function parse(text) {
    const n = norm(text);
    const ui = parseUiCommand(text, n);
    if (ui) return ui;
    if (
      /(qual|quanto|total|soma).*(fatura|cartao|gasto|categoria)|(?:fatura|cartao).*(total|quanto)/.test(
        n,
      )
    )
      return {
        intent: "consulta",
        target:
          (text.match(
            /(?:fatura|cart[aã]o)(?:\s+(?:do|da))?\s+([\p{L}\d ]+?)(?:\?|,|$)/iu,
          ) || [])[1] || "",
        category:
          (text.match(/categoria\s+([\p{L}\d ]+?)(?:\?|,|$)/iu) || [])[1] || "",
      };
    const value =
      Number(
        (
          (text.match(
            /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)?/i,
          ) || [])[1] || ""
        )
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0;
    const installments = Number(
      (n.match(/\b(?:em\s+)?(\d+)\s*x\b/) || [])[1] || 1,
    );
    if (/receb|conta a receber|cobrar/.test(n))
      return {
        intent: "recebivel",
        value,
        installments,
        date: parseDate(text),
        party:
          (text.match(
            /(?:de|do pagador|da empresa)\s+([\p{L}\d ]+?)(?:,|\s+em\s+\d+|\s+para\s+|$)/iu,
          ) || [])[1] || "",
        description: text,
      };
    if (/agenda|agende|compromisso|reuniao|plantao|folga/.test(n)) {
      const tm = text.match(/(?:as|às|a)\s*(\d{1,2})(?::|h)?(\d{2})?/i);
      return {
        intent: "agenda",
        date: parseDate(text),
        time: tm ? `${String(tm[1]).padStart(2, "0")}:${tm[2] || "00"}` : "",
        title: text
          .replace(/^(cadastre|crie|agende|agenda)\s+/i, "")
          .slice(0, 120),
        type: /reuni/.test(n)
          ? "reuniao"
          : /folga/.test(n)
            ? "folga"
            : /plantao/.test(n)
              ? "plantao"
              : "compromisso",
      };
    }
    const supplier =
      (text.match(
        /(?:fornecedor|cart[aã]o|do|da)\s+([\p{L}\d ]+?)(?:,|\s+em\s+\d+\s*x|\s+separe|\s+divid|$)/iu,
      ) || [])[1] || "";
    const cats = ((text.match(/categorias?[,\s:]+(.+)$/iu) || [])[1] || "")
      .replace(/^ex(?:emplo)?\.?\s*/i, "")
      .split(/,|\s+e\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);
    return {
      intent: "pagar",
      value,
      installments,
      supplier,
      categories: cats,
      date: parseDate(text),
      description: text,
    };
  }
  async function interpret() {
    const text = $("checkiaInput").value.trim();
    if (!text) {
      $("checkiaStatus").textContent = "Diga ou escreva um pedido primeiro.";
      return;
    }
    $("checkiaStatus").textContent =
      "Interpretando e conferindo seus cadastros…";
    const data = parse(text);
    state.intent = data.intent;
    state.data = data;
    try {
      if (data.intent === "consulta") await renderQuery(data);
      else if (data.intent === "ui") renderUiReview(data);
      else renderReview(data);
      $("checkiaStatus").textContent =
        "Confira abaixo. Nada será gravado sem sua confirmação.";
    } catch (e) {
      $("checkiaStatus").textContent =
        "Não consegui consultar agora: " + (e?.message || e);
    }
  }
  async function renderQuery(d) {
    if (
      typeof carregarContasAPagarFinanceiro === "function" &&
      !(window.contasAPagarFinanceiroCache || []).length
    )
      await carregarContasAPagarFinanceiro();
    const target = norm(d.target),
      cat = norm(d.category);
    const rows = (
      window.contasAPagarFinanceiroCache ||
      contasAPagarFinanceiroCache ||
      []
    ).filter((x) => {
      const forn = norm(x.fornecedor_nome || x.fornecedores?.nome);
      const categoria = norm(x.categoria_nome || x.categorias_compra?.nome);
      return (
        (!target || forn.includes(target) || target.includes(forn)) &&
        (!cat || categoria.includes(cat) || cat.includes(categoria)) &&
        norm(x.status) !== "pago"
      );
    });
    const total = rows.reduce(
      (s, x) => s + Number(x.valor_original ?? x.valor ?? 0),
      0,
    );
    const box = $("checkiaResult");
    box.hidden = false;
    box.innerHTML = `<h3>Consulta financeira</h3><div class="checkia-answer">${money(total)}</div><div>${rows.length} lançamento(s) em aberto${d.target ? ` para <b>${escapeHtml(d.target)}</b>` : ""}.</div><div class="checkia-warn">O total usa os lançamentos atualmente disponíveis para a loja logada.</div>`;
  }
  function escapeHtml(s) {
    const e = document.createElement("div");
    e.textContent = String(s || "");
    return e.innerHTML;
  }
  function visibleElements() {
    const page = document.querySelector(".pagina.ativa") || document;
    const visible = (el) =>
      !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) &&
      !el.disabled;
    return Array.from(
      page.querySelectorAll("input:not([type=hidden]),select,textarea,button"),
    ).filter(visible);
  }
  function elementName(el) {
    const label =
      el.closest("label")?.textContent ||
      document.querySelector(`label[for="${CSS.escape(el.id || "")}"]`)
        ?.textContent ||
      "";
    return String(
      label ||
        el.getAttribute("aria-label") ||
        el.placeholder ||
        el.textContent ||
        el.name ||
        el.id ||
        "",
    )
      .replace(/\s+/g, " ")
      .trim();
  }
  function bestNamed(target, items, getter) {
    const wanted = norm(target);
    return items
      .map((item) => {
        const name = norm(getter(item));
        const score =
          name === wanted
            ? 1
            : name.includes(wanted) || wanted.includes(name)
              ? 0.86
              : (wanted.split(/\s+/).filter((p) => name.includes(p)).length /
                  Math.max(1, wanted.split(/\s+/).length)) *
                0.7;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)[0];
  }
  function renderUiReview(d) {
    let title = "Comando da interface",
      detail = "";
    if (d.action === "page") {
      const found = bestNamed(d.target, uiCatalog().pages, (x) => x.name);
      d.resolved = found?.score >= 0.4 ? found.item : null;
      detail = d.resolved
        ? `Abrir a página <b>${escapeHtml(d.resolved.name)}</b>.`
        : `Não encontrei uma página parecida com “${escapeHtml(d.target)}”.`;
    }
    if (d.action === "field") {
      const found = bestNamed(
        d.target,
        visibleElements().filter(
          (e) => !["BUTTON", "SELECT"].includes(e.tagName),
        ),
        elementName,
      );
      d.resolved = found?.score >= 0.35 ? found.item : null;
      detail = d.resolved
        ? `Preencher <b>${escapeHtml(elementName(d.resolved))}</b> com “${escapeHtml(d.value)}”.`
        : `Não encontrei esse campo na página atual.`;
    }
    if (d.action === "click") {
      const found = bestNamed(
        d.target,
        visibleElements().filter(
          (e) =>
            e.tagName === "BUTTON" ||
            e.type === "button" ||
            e.type === "submit",
        ),
        elementName,
      );
      d.resolved = found?.score >= 0.35 ? found.item : null;
      detail = d.resolved
        ? `Acionar <b>${escapeHtml(elementName(d.resolved))}</b>.`
        : `Não encontrei esse botão na página atual.`;
    }
    if (d.action === "read") {
      const page = document.querySelector(".pagina.ativa");
      const titlePage =
        page?.querySelector(".page-title")?.textContent?.trim() ||
        "página atual";
      const names = visibleElements()
        .map(elementName)
        .filter(Boolean)
        .slice(0, 30);
      detail = `<b>${escapeHtml(titlePage)}</b><br>${escapeHtml(names.join(" · ") || "Nenhum campo ou ação disponível.")}`;
      d.spoken = `${titlePage}. ${names.join(", ")}`;
    }
    const canRun = d.action === "read" || !!d.resolved;
    const box = $("checkiaResult");
    box.hidden = false;
    box.innerHTML = `<h3>${title}</h3><div>${detail}</div><div class="checkia-warn">A CHECKIA respeita as permissões do usuário e só enxerga controles disponíveis na loja e sessão atuais.</div>${canRun ? '<div class="checkia-actions"><button class="btn btn-green" id="ciaUiRun" type="button">Confirmar comando</button></div>' : ""}`;
    if (canRun) $("ciaUiRun").onclick = () => executeUi(d);
  }
  function executeUi(d) {
    if (d.action === "page" && d.resolved) d.resolved.element.click();
    if (d.action === "field" && d.resolved) {
      d.resolved.focus();
      d.resolved.value = d.value;
      d.resolved.dispatchEvent(new Event("input", { bubbles: true }));
      d.resolved.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (d.action === "click" && d.resolved) d.resolved.click();
    if (d.action === "read" && d.spoken && "speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(d.spoken));
    }
    close();
  }
  function renderReview(d) {
    const title = {
      pagar: "Conta a pagar",
      recebivel: "Recebível",
      agenda: "Agenda",
    }[d.intent];
    const fields =
      d.intent === "agenda"
        ? `<div class="checkia-field"><label>Data</label><input id="ciaDate" type="date" value="${d.date}"></div><div class="checkia-field"><label>Horário</label><input id="ciaTime" type="time" value="${d.time}"></div><div class="checkia-field full"><label>Título</label><input id="ciaTitle" value="${escapeHtml(d.title)}"></div>`
        : `<div class="checkia-field"><label>Valor total</label><input id="ciaValue" type="number" step="0.01" value="${d.value || ""}"></div><div class="checkia-field"><label>Parcelas</label><input id="ciaInstallments" type="number" min="1" value="${d.installments || 1}"></div><div class="checkia-field full"><label>${d.intent === "pagar" ? "Fornecedor" : "Pagador"}</label><input id="ciaParty" value="${escapeHtml(d.supplier || d.party || "")}"></div>${d.intent === "pagar" ? `<div class="checkia-field full"><label>Categorias entendidas</label><input id="ciaCategories" value="${escapeHtml((d.categories || []).join(", "))}" placeholder="Separe por vírgulas"></div>` : ""}`;
    const box = $("checkiaResult");
    box.hidden = false;
    box.innerHTML = `<h3>Conferência — ${title}</h3><div class="checkia-grid">${fields}</div><div class="checkia-warn">Revise os dados. Ao continuar, a CHECKIA abrirá o cadastro oficial já preenchido para a confirmação final.</div><div class="checkia-actions"><button class="btn btn-green" id="ciaContinue" type="button">Continuar para cadastro</button></div>`;
    $("ciaContinue").onclick = continueNative;
  }
  async function continueNative() {
    const d = state.data;
    if (d.intent === "agenda") {
      if (typeof abrirPagina === "function") abrirPagina("escala_plantoes");
      setTimeout(() => {
        if (typeof abrirModalCadastroPlantaoEscala === "function")
          abrirModalCadastroPlantaoEscala($("ciaDate").value);
        setTimeout(() => {
          const ti = $("escalaPlantaoTitulo"),
            hr = $("escalaPlantaoInicio");
          if (ti) ti.value = $("ciaTitle").value;
          if (hr) hr.value = $("ciaTime").value;
        }, 250);
      }, 200);
      close();
      return;
    }
    if (d.intent === "recebivel") {
      if (typeof nrAbrir !== "function") return;
      nrAbrir(false);
      setTimeout(() => {
        const value = Number($("ciaValue").value),
          name = $("ciaParty").value,
          qtd = $("ciaInstallments").value;
        NR.valor = value;
        const ve = $("recebivelValor");
        if (ve) ve.value = nrFmtBR(value);
        const qe = $("recebivelQtdParcelas");
        if (qe) qe.value = qtd;
        const match = fuzzy(
          name,
          window.fornecedoresFinanceiroCache ||
            fornecedoresFinanceiroCache ||
            [],
        );
        if (match) nrSelPagador(match.id, match.nome);
        else {
          const be = $("nrPagadorBusca");
          if (be) be.value = name;
        }
      }, 350);
      close();
      return;
    }
    if (typeof ncAbrir !== "function") return;
    ncAbrir(false);
    setTimeout(() => {
      const value = Number($("ciaValue").value),
        name = $("ciaParty").value,
        qtd = Math.max(1, Number($("ciaInstallments").value) || 1),
        cats = $("ciaCategories")
          .value.split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      NC.valor = value;
      NC.parcelas = qtd;
      NC.parcelado = qtd > 1;
      const ve = $("ncValor");
      if (ve) ve.value = ncFmtBR(value);
      const pe = $("ncParcCustom");
      if (pe) pe.value = String(qtd);
      ncSyncParceladoUI();
      const supplier = fuzzy(
        name,
        window.fornecedoresFinanceiroCache || fornecedoresFinanceiroCache || [],
      );
      if (supplier) ncSelForn(supplier.id, supplier.nome);
      const category = fuzzy(
        cats[0],
        window.categoriasCompraCache || categoriasCompraCache || [],
      );
      if (category) {
        NC.catId = category.id;
        const card = document.querySelector(
          `#ncCatGrid [data-id="${CSS.escape(String(category.id))}"]`,
        );
        if (card) ncSelCat(card);
      }
      const obs = $("ncObs");
      if (obs)
        obs.value =
          (cats.length > 1
            ? `CHECKIA — separar igualmente em: ${cats.join(" / ")}. `
            : "") + d.description;
      if (obs) NC.obs = obs.value;
    }, 400);
    close();
  }
  document.addEventListener("DOMContentLoaded", ensureUI);
  if (document.readyState !== "loading") ensureUI();
  window.abrirCheckia = open;
})();
