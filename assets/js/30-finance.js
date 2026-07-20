// FINANCEIRO
// 
function textoFinanceiroNormalizado(valor = '') {
  return normalizarTextoComparacao(String(valor || ''));
}

function digitosDocumentoFinanceiro(valor = '') {
  return String(valor || '').replace(/\D+/g, '');
}

function formatarCpfCnpjParcialFinanceiro(valor = '') {
  const digitos = digitosDocumentoFinanceiro(valor).slice(0, 14);
  if (!digitos) return '';

  if (digitos.length <= 11) {
    if (digitos.length <= 3) return digitos;
    if (digitos.length <= 6) return digitos.replace(/(\d{3})(\d+)/, '$1.$2');
    if (digitos.length <= 9) return digitos.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  }

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return digitos.replace(/(\d{2})(\d+)/, '$1.$2');
  if (digitos.length <= 8) return digitos.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (digitos.length <= 12) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
}

function aplicarMascaraCpfCnpjFornecedorFinanceiro(campo) {
  if (!campo) return;
  campo.value = formatarCpfCnpjParcialFinanceiro(campo.value);
}

function normalizarDocumentoFornecedorFinanceiro(campo) {
  if (!campo) return;
  const validacao = validarCpfCnpjFinanceiro(campo.value);
  if (validacao.ok && validacao.valor) {
    campo.value = validacao.valor;
  } else if (!digitosDocumentoFinanceiro(campo.value)) {
    campo.value = '';
  } else {
    campo.value = formatarCpfCnpjParcialFinanceiro(campo.value);
  }
}

function formatarCpfCnpjFinanceiro(valor = '') {
  const digitos = digitosDocumentoFinanceiro(valor);
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(valor || '').trim();
}

function cpfFinanceiroEhValido(valor = '') {
  const cpf = digitosDocumentoFinanceiro(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(cpf[10]);
}

function cnpjFinanceiroEhValido(valor = '') {
  const cnpj = digitosDocumentoFinanceiro(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcularDigito = (base, pesos) => {
    const soma = base.split('').reduce((acc, numero, idx) => acc + Number(numero) * pesos[idx], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base12 = cnpj.slice(0, 12);
  const digito1 = calcularDigito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(`${base12}${digito1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${digito1}${digito2}` === cnpj.slice(12);
}

function validarCpfCnpjFinanceiro(valor = '') {
  const digitos = digitosDocumentoFinanceiro(valor);
  if (!digitos) return { ok: true, tipo: '', valor: null };
  if (digitos.length === 11) {
    if (!cpfFinanceiroEhValido(digitos)) return { ok: false, tipo: 'CPF', valor: digitos };
    return { ok: true, tipo: 'CPF', valor: formatarCpfCnpjFinanceiro(digitos) };
  }
  if (digitos.length === 14) {
    if (!cnpjFinanceiroEhValido(digitos)) return { ok: false, tipo: 'CNPJ', valor: digitos };
    return { ok: true, tipo: 'CNPJ', valor: formatarCpfCnpjFinanceiro(digitos) };
  }
  return { ok: false, tipo: 'CPF/CNPJ', valor: digitos };
}

function formatarDataBRFinanceiro(valor = '') {
  const txt = String(valor || '').trim();
  if (!txt) return '-';
  const d = new Date(`${txt}T00:00:00`);
  if (Number.isNaN(d.getTime())) return txt;
  return d.toLocaleDateString('pt-BR');
}

function formatarEntradaDataBRFinanceiro(valor = '') {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

function converterDataBRParaISOFinanceiro(valor = '') {
  const txt = String(valor || '').trim();
  if (!txt) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;

  const match = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const [, diaTxt, mesTxt, anoTxt] = match;
  const dia = Number(diaTxt);
  const mes = Number(mesTxt);
  const ano = Number(anoTxt);
  const data = new Date(ano, mes - 1, dia);
  if (
    Number.isNaN(data.getTime()) ||
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return '';
  }

  return `${anoTxt}-${mesTxt}-${diaTxt}`;
}

function converterDataISOParaBRFinanceiro(valor = '') {
  const txt = String(valor || '').trim();
  if (!txt) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    const [ano, mes, dia] = txt.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return formatarEntradaDataBRFinanceiro(txt);
}

function configurarCampoDataContaAPagarFinanceiro(campoId, valor = '') {
  const campo = document.getElementById(campoId);
  if (!campo) return '';

  if (campo.dataset.financeiroDataReady !== '1') {
    campo.dataset.financeiroDataReady = '1';
    campo.setAttribute('inputmode', 'numeric');
    campo.setAttribute('autocomplete', 'off');
    campo.addEventListener('input', () => {
      campo.value = formatarEntradaDataBRFinanceiro(campo.value);
    });
    campo.addEventListener('blur', () => {
      campo.value = converterDataISOParaBRFinanceiro(converterDataBRParaISOFinanceiro(campo.value) || campo.value);
    });
  }

  campo.value = converterDataISOParaBRFinanceiro(valor);
  return campo.value;
}

function formatarMoedaBRFinanceiro(valor = 0) {
  const n = Number(valor || 0);
  const seguro = Number.isFinite(n) ? n : 0;
  return seguro.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function lerValorMonetarioFinanceiro(valor = '') {
  const txt = String(valor || '').trim();
  if (!txt) return NaN;
  const semMoeda = txt.replace(/[^\d,.-]/g, '');
  if (!semMoeda) return NaN;
  const normalizado = semMoeda.replace(/\./g, '').replace(',', '.');
  return Number(normalizado);
}

function formatarEntradaMoedaFinanceiro(valor = '') {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '';
  return formatarMoedaBRFinanceiro(Number(digitos) / 100);
}

function formatarDigitacaoMoedaFinanceiro(valor = '') {
  const texto = String(valor || '').replace(/[^\d,]/g, '');
  if (!texto) return '';
  const partes = texto.split(',');
  const reais = partes[0].replace(/^0+(?=\d)/, '') || '0';
  const centavos = partes.length > 1 ? partes.slice(1).join('').replace(/\D/g, '').slice(0, 2) : '';
  return partes.length > 1 ? `${reais},${centavos}` : reais;
}

function formatarValorCampoMoedaFinanceiro(valor = '') {
  const numero = lerValorMonetarioFinanceiro(valor);
  if (!Number.isFinite(numero)) return '';
  return formatarMoedaBRFinanceiro(numero);
}

function prepararValorCampoMoedaParaEdicao(valor = '') {
  const numero = lerValorMonetarioFinanceiro(valor);
  if (!Number.isFinite(numero)) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function prepararCampoMoedaFinanceiro(campo) {
  if (!campo || campo.dataset.financeiroMoedaReady === '1') return;
  campo.dataset.financeiroMoedaReady = '1';
  campo.setAttribute('autocomplete', 'off');
  campo.addEventListener('input', () => {
    campo.value = formatarDigitacaoMoedaFinanceiro(campo.value);
  });
  campo.addEventListener('focus', () => {
    campo.value = prepararValorCampoMoedaParaEdicao(campo.value);
    window.setTimeout(() => campo.select(), 0);
  });
  campo.addEventListener('blur', () => {
    campo.value = formatarValorCampoMoedaFinanceiro(campo.value);
  });
}

function configurarCampoValorCompraFinanceiro(limpar = false) {
  const campo = document.getElementById('contaValorCompra');
  if (!campo) return;
  prepararCampoMoedaFinanceiro(campo);

  if (limpar) {
    campo.value = '';
    campo.removeAttribute('value');
    return;
  }

  campo.value = formatarValorCampoMoedaFinanceiro(campo.value);
}

function configurarCampoValorRecebivelFinanceiro(limpar = false, valor = '') {
  const campo = document.getElementById('recebivelValor');
  if (!campo) return;
  prepararCampoMoedaFinanceiro(campo);

  if (limpar) {
    campo.value = '';
    campo.removeAttribute('value');
    return;
  }

  if (valor !== '') {
    campo.value = formatarMoedaBRFinanceiro(valor || 0);
    return;
  }

  campo.value = formatarValorCampoMoedaFinanceiro(campo.value);
}

function configurarCampoSaldoContaFinanceira(limpar = false, valor = '') {
  const campo = document.getElementById('contaFinanceiraSaldoAtual');
  if (!campo) return;
  prepararCampoMoedaFinanceiro(campo);

  if (limpar) {
    campo.value = '';
    campo.removeAttribute('value');
    return;
  }

  if (valor !== '') {
    campo.value = formatarMoedaBRFinanceiro(valor || 0);
    return;
  }

  campo.value = formatarValorCampoMoedaFinanceiro(campo.value);
}

function configurarEnterCadastrosFinanceiros() {
  const grupos = [
    {
      ids: ['fornecedorNome', 'fornecedorCnpj', 'fornecedorTelefone', 'fornecedorEmail'],
      salvar: () => salvarFornecedorFinanceiro(),
    },
    {
      ids: ['formaPagamentoNome'],
      salvar: () => salvarFormaPagamentoFinanceiro(),
    },
    {
      ids: ['contaFornecedorBusca', 'contaDataCompra', 'contaDataVencimento', 'contaValorCompra', 'contaQtdParcelas', 'contaIntervaloParcelasDias', 'contaObservacao'],
      salvar: () => salvarContaAPagarFinanceiro(),
    },
    {
      ids: ['contaFinanceiraNome', 'contaFinanceiraSaldoAtual'],
      salvar: () => salvarContaFinanceira(),
    },
    {
      ids: ['recebivelPagadorBusca', 'recebivelFormaPagamentoId', 'recebivelValor', 'recebivelContaFinanceiraId'],
      salvar: () => salvarRecebivelFinanceiro(),
    },
  ];

  grupos.forEach(grupo => {
    grupo.ids.forEach(id => {
      const campo = document.getElementById(id);
      if (!campo || campo.dataset.enterCadastroReady === '1') return;
      campo.dataset.enterCadastroReady = '1';
      campo.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        grupo.salvar();
      });
    });
  });
}

function valoresContaAPagarAlterados(contaAnterior = {}, payload = {}) {
  const anteriorValor = Number(contaAnterior?.valor_compra || 0);
  const novoValor = Number(payload?.valor_compra || 0);
  return (
    String(contaAnterior?.fornecedor_id || '') !== String(payload?.fornecedor_id || '') ||
    String(contaAnterior?.data_compra || '') !== String(payload?.data_compra || '') ||
    String(contaAnterior?.data_vencimento || '') !== String(payload?.data_vencimento || '') ||
    Number(anteriorValor.toFixed(2)) !== Number(novoValor.toFixed(2)) ||
    String(contaAnterior?.observacao || '').trim() !== String(payload?.observacao || '').trim() ||
    Number(contaAnterior?.qtd_parcelas || 1) !== Number(payload?.qtd_parcelas || 1) ||
    Number(contaAnterior?.intervalo_parcelas_dias || 0) !== Number(payload?.intervalo_parcelas_dias || 0)
  );
}

function descreverAlteracoesContaAPagar(contaAnterior = {}, payload = {}) {
  const detalhes = [];
  const valorAnterior = Number(contaAnterior?.valor_compra || 0);
  const novoValor = Number(payload?.valor_compra || 0);
  if (Number(valorAnterior.toFixed(2)) !== Number(novoValor.toFixed(2))) {
    detalhes.push(`Valor: ${formatarMoedaBRFinanceiro(valorAnterior)} -> ${formatarMoedaBRFinanceiro(novoValor)}`);
  }
  if (String(contaAnterior?.data_compra || '') !== String(payload?.data_compra || '')) {
    detalhes.push(`Compra: ${formatarDataBRFinanceiro(contaAnterior?.data_compra)} -> ${formatarDataBRFinanceiro(payload?.data_compra)}`);
  }
  if (String(contaAnterior?.data_vencimento || '') !== String(payload?.data_vencimento || '')) {
    detalhes.push(`Vencimento: ${formatarDataBRFinanceiro(contaAnterior?.data_vencimento)} -> ${formatarDataBRFinanceiro(payload?.data_vencimento)}`);
  }
  if (String(contaAnterior?.observacao || '').trim() !== String(payload?.observacao || '').trim()) {
    detalhes.push(`Observação: ${String(payload?.observacao || '').trim() || '-'}`);
  }
  if (Number(contaAnterior?.qtd_parcelas || 1) !== Number(payload?.qtd_parcelas || 1)) {
    detalhes.push(`Qtd. parcelas: ${payload?.qtd_parcelas || 1}`);
  }
  if (Number(contaAnterior?.intervalo_parcelas_dias || 0) !== Number(payload?.intervalo_parcelas_dias || 0)) {
    detalhes.push(`Intervalo: ${payload?.intervalo_parcelas_dias || '-'} dia(s)`);
  }
  return detalhes;
}

function adicionarDiasDataISOFinanceiro(dataISO = '', dias = 0) {
  const base = String(dataISO || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '';
  const dt = new Date(`${base}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + Number(dias || 0));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizarChaveFormaPagamentoFinanceiro(valor = '') {
  return String(valor || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function limparFormularioFormaPagamentoFinanceiro() {
  formaPagamentoFinanceiroEmEdicaoId = null;
  const campoNome = document.getElementById('formaPagamentoNome');
  if (campoNome) campoNome.value = '';
  const btnSalvar = document.getElementById('btnSalvarFormaPagamentoFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarFormaPagamentoFinanceiro');
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

function obterFormasPagamentoAtivasFinanceiro() {
  return (formasPagamentoFinanceiroCache || []).filter(item => item?.ativo !== false);
}

function montarDescricaoOpcoesFormasPagamentoFinanceiro(lista = []) {
  return lista.map((item, idx) => `${idx + 1} - ${item.nome}`).join(', ');
}

function resolverFormaPagamentoPorEntradaFinanceiro(entrada = '', lista = []) {
  const texto = String(entrada || '').trim();
  if (!texto) return null;

  const idx = Number.parseInt(texto, 10);
  if (Number.isFinite(idx) && idx >= 1 && idx <= lista.length) {
    return lista[idx - 1] || null;
  }

  const chave = normalizarChaveFormaPagamentoFinanceiro(texto);
  return lista.find(item => normalizarChaveFormaPagamentoFinanceiro(item.nome) === chave) || null;
}

async function carregarFormasPagamentoFinanceiro({ render = true, silencioso = false } = {}) {
  const lista = document.getElementById('listaFormasPagamentoFinanceiro');
  if (render && lista) lista.innerHTML = '<div class="empty">Carregando...</div>';

  const { data, error } = await sb
    .from('formas_pagamento')
    .select('id, nome, ativo, created_at')
    .order('nome', { ascending: true });

  if (error) {
    formasPagamentoFinanceiroCache = [];
    if (!silencioso) {
      if (isMissingFormasPagamentoTableError(error)) {
        setMsg('msgFormaPagamentoFinanceiro', 'Rode o SQL das formas de pagamento antes de usar esta tela.', 'err');
      } else {
        setMsg('msgFormaPagamentoFinanceiro', `Erro ao carregar formas: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      }
    }
    if (render && lista) {
      if (isMissingFormasPagamentoTableError(error)) {
        lista.innerHTML = '<div class="empty">Rode o SQL da tabela formas_pagamento para habilitar este cadastro.</div>';
      } else {
        lista.innerHTML = '<div class="empty">Erro ao carregar formas de pagamento.</div>';
      }
    }
    return [];
  }

  formasPagamentoFinanceiroCache = data || [];
  preencherSelectRecebivelFormasPagamentoFinanceiro(document.getElementById('recebivelFormaPagamentoId')?.value || '');

  if (render && lista) {
    if (!formasPagamentoFinanceiroCache.length) {
      lista.innerHTML = '<div class="empty">Nenhuma forma de pagamento cadastrada.</div>';
    } else {
      lista.innerHTML = '<div class="lista">' + formasPagamentoFinanceiroCache.map(item => `
        <div class="item">
          <div class="item-info">
            <div class="item-nome">${item.nome || '-'}</div>
            <div class="item-detalhe">Status: ${item.ativo === false ? 'Inativa' : 'Ativa'}</div>
          </div>
          <div class="item-actions">
            ${item.ativo === false ? '<span class="tag">Inativa</span>' : '<span class="tag tag-green">Ativa</span>'}
            <button class="btn btn-ghost btn-sm" onclick="editarFormaPagamentoFinanceiro('${item.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleFormaPagamentoFinanceiro('${item.id}', ${item.ativo === false ? 'false' : 'true'})">${item.ativo === false ? 'Ativar' : 'Inativar'}</button>
            <button class="btn btn-red" onclick="excluirFormaPagamentoFinanceiro('${item.id}')">Excluir</button>
          </div>
        </div>
      `).join('') + '</div>';
    }
  }

  return formasPagamentoFinanceiroCache;
}

async function salvarFormaPagamentoFinanceiro() {
  const nomeCampo = document.getElementById('formaPagamentoNome');
  const nome = String(nomeCampo?.value || '').trim().replace(/\s+/g, ' ');
  if (!nome) {
    setMsg('msgFormaPagamentoFinanceiro', 'Digite o nome da forma de pagamento.', 'err');
    return;
  }

  const chave = normalizarChaveFormaPagamentoFinanceiro(nome);
  const duplicado = formasPagamentoFinanceiroCache.find(item =>
    normalizarChaveFormaPagamentoFinanceiro(item.nome) === chave &&
    String(item.id) !== String(formaPagamentoFinanceiroEmEdicaoId || '')
  );
  if (duplicado) {
    setMsg('msgFormaPagamentoFinanceiro', 'J? existe uma forma de pagamento com este nome.', 'err');
    return;
  }

  const editando = !!formaPagamentoFinanceiroEmEdicaoId;

  let query;
  if (editando) {
    query = sb.from('formas_pagamento').update({ nome }).eq('id', formaPagamentoFinanceiroEmEdicaoId);
  } else {
    // Resolver loja/empresa de forma robusta para evitar loja_id nulo (erro 23502).
    let tenant;
    try {
      tenant = await resolverTenantFornecedorFinanceiro();
    } catch (eTenant) {
      setMsg('msgFormaPagamentoFinanceiro', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
      return;
    }
    query = sb.from('formas_pagamento').insert([{
      nome,
      ativo: true,
      loja_id: tenant.loja_id,
      empresa_id: tenant.empresa_id,
    }]);
  }

  const { error } = await query;
  if (error) {
    if (isMissingFormasPagamentoTableError(error)) {
      setMsg('msgFormaPagamentoFinanceiro', 'Rode o SQL das formas de pagamento antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgFormaPagamentoFinanceiro', `N?o foi poss?vel salvar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  limparFormularioFormaPagamentoFinanceiro();
  setMsg('msgFormaPagamentoFinanceiro', editando ? 'Forma de pagamento atualizada.' : 'Forma de pagamento cadastrada.', 'ok');
  await carregarFormasPagamentoFinanceiro();
}

function editarFormaPagamentoFinanceiro(id) {
  const item = formasPagamentoFinanceiroCache.find(f => String(f.id) === String(id));
  if (!item) {
    setMsg('msgFormaPagamentoFinanceiro', 'Forma de pagamento n?o encontrada.', 'err');
    return;
  }

  formaPagamentoFinanceiroEmEdicaoId = id;
  const campoNome = document.getElementById('formaPagamentoNome');
  if (campoNome) campoNome.value = item.nome || '';
  const btnSalvar = document.getElementById('btnSalvarFormaPagamentoFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarFormaPagamentoFinanceiro');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgFormaPagamentoFinanceiro', `Editando forma: ${item.nome}.`, 'ok');
}

function cancelarEdicaoFormaPagamentoFinanceiro() {
  limparFormularioFormaPagamentoFinanceiro();
  setMsg('msgFormaPagamentoFinanceiro', 'Edi·o cancelada.', 'ok');
}

async function toggleFormaPagamentoFinanceiro(id, ativoAtual = true) {
  const novoStatus = !ativoAtual;
  const { error } = await sb.from('formas_pagamento').update({ ativo: novoStatus }).eq('id', id);
  if (error) {
    if (isMissingFormasPagamentoTableError(error)) {
      setMsg('msgFormaPagamentoFinanceiro', 'Rode o SQL das formas de pagamento antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgFormaPagamentoFinanceiro', `N?o foi poss?vel alterar status: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgFormaPagamentoFinanceiro', novoStatus ? 'Forma ativada.' : 'Forma inativada.', 'ok');
  await carregarFormasPagamentoFinanceiro();
}

async function excluirFormaPagamentoFinanceiro(id) {
  if (!confirm('Excluir esta forma de pagamento?')) return;

  const { count, error: erroVinculo } = await sb
    .from('contasapagar')
    .select('*', { count: 'exact', head: true })
    .eq('forma_pagamento_id', id);

  if (erroVinculo && !isMissingContasAPagarPagamentoColumnsError(erroVinculo) && !isMissingContasAPagarTableError(erroVinculo)) {
    setMsg('msgFormaPagamentoFinanceiro', `N?o foi poss?vel validar v?nculos: ${mensagemErroSupabase(erroVinculo, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!erroVinculo && Number(count || 0) > 0) {
    setMsg('msgFormaPagamentoFinanceiro', 'N?o ? poss?vel excluir: existem contas vinculadas a esta forma.', 'err');
    return;
  }

  const { count: countRecebiveis, error: erroVinculoRecebiveis } = await sb
    .from('recebiveis')
    .select('*', { count: 'exact', head: true })
    .eq('forma_pagamento_id', id);

  if (erroVinculoRecebiveis && !isMissingRecebiveisTableError(erroVinculoRecebiveis)) {
    setMsg('msgFormaPagamentoFinanceiro', `N?o foi poss?vel validar receb?veis: ${mensagemErroSupabase(erroVinculoRecebiveis, 'erro desconhecido')}`, 'err');
    return;
  }

  if (!erroVinculoRecebiveis && Number(countRecebiveis || 0) > 0) {
    setMsg('msgFormaPagamentoFinanceiro', 'N?o ? poss?vel excluir: existem receb?veis vinculados a esta forma.', 'err');
    return;
  }

  const { error } = await sb.from('formas_pagamento').delete().eq('id', id);
  if (error) {
    if (isMissingFormasPagamentoTableError(error)) {
      setMsg('msgFormaPagamentoFinanceiro', 'Rode o SQL das formas de pagamento antes de usar esta tela.', 'err');
      return;
    }
    if (isForeignKeyViolationError(error)) {
      setMsg('msgFormaPagamentoFinanceiro', 'N?o ? poss?vel excluir: forma vinculada a contas j? cadastradas.', 'err');
      return;
    }
    setMsg('msgFormaPagamentoFinanceiro', `N?o foi poss?vel excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (String(formaPagamentoFinanceiroEmEdicaoId || '') === String(id)) {
    limparFormularioFormaPagamentoFinanceiro();
  }

  setMsg('msgFormaPagamentoFinanceiro', 'Forma de pagamento exclu?da.', 'ok');
  await carregarFormasPagamentoFinanceiro();
}

async function solicitarFormaPagamentoObrigatoriaFinanceiro(formaAtual = '') {
  const listaCompleta = await carregarFormasPagamentoFinanceiro({ render: false, silencioso: true });
  if (!listaCompleta.length) {
    setMsg('msgBaixarContasFinanceiro', 'Cadastre formas de pagamento na aba Financeiro antes de baixar t?tulos.', 'err');
    return null;
  }

  const formasAtivas = obterFormasPagamentoAtivasFinanceiro();
  if (!formasAtivas.length) {
    setMsg('msgBaixarContasFinanceiro', 'Nenhuma forma ativa dispon?vel. Ative ao menos uma em Formas de pagamento.', 'err');
    return null;
  }

  const selecionada = await abrirModalFormaPagamentoFinanceiro({
    formas: formasAtivas,
    formaAtual: String(formaAtual || '').trim(),
  });
  if (selecionada === null) return null;

  const validaSelecionada = formasAtivas.find(item => String(item.id) === String(selecionada.id)) || null;
  if (!validaSelecionada) {
    setMsg('msgBaixarContasFinanceiro', 'Forma de pagamento inv?lida. Escolha uma op·o ativa cadastrada.', 'err');
    return null;
  }

  return validaSelecionada;
}

function construirTextoBuscaFornecedorFinanceiro(item = {}) {
  const nome = String(item.nome || '').trim();
  const cnpj = String(item.cnpj || '').trim();
  const documento = cnpj ? formatarCpfCnpjFinanceiro(cnpj) : '';
  const telefone = String(item.telefone || '').trim();
  const email = String(item.email || '').trim();
  const partes = [nome];
  if (documento) partes.push(`CPF/CNPJ: ${documento}`);
  if (telefone) partes.push(`Tel: ${telefone}`);
  if (email) partes.push(`Email: ${email}`);
  return partes.filter(Boolean).join(' | ');
}

function atualizarDatalistFornecedoresFinanceiro() {
  const html = fornecedoresFinanceiroCache.map(item => {
    const textoBusca = construirTextoBuscaFornecedorFinanceiro(item).replace(/"/g, '&quot;');
    return `<option value="${textoBusca}"></option>`;
  }).join('');
  const datalist = document.getElementById('fornecedoresFinanceiroAutoList');
  if (datalist) datalist.innerHTML = html;
  const datalistRecebiveis = document.getElementById('recebiveisPagadoresFinanceiroAutoList');
  if (datalistRecebiveis) datalistRecebiveis.innerHTML = html;
}

function atualizarFornecedorSelecionadoContaAPagar() {
  const campoBusca = document.getElementById('contaFornecedorBusca');
  const campoId = document.getElementById('contaFornecedorId');
  if (!campoBusca || !campoId) return;

  const texto = String(campoBusca.value || '').trim();
  if (!texto) {
    campoId.value = '';
    return;
  }

  const alvo = textoFinanceiroNormalizado(texto);
  const fornecedoresComBusca = fornecedoresFinanceiroCache.map(item => ({
    ...item,
    _buscaTexto: textoFinanceiroNormalizado(construirTextoBuscaFornecedorFinanceiro(item)),
    _nomeTexto: textoFinanceiroNormalizado(item.nome || ''),
    _cnpjTexto: textoFinanceiroNormalizado(item.cnpj || ''),
    _cnpjDigitos: digitosDocumentoFinanceiro(item.cnpj || ''),
    _telefoneTexto: textoFinanceiroNormalizado(item.telefone || ''),
    _emailTexto: textoFinanceiroNormalizado(item.email || ''),
  }));

  const alvoDigitos = digitosDocumentoFinanceiro(texto);

  let selecionado = fornecedoresComBusca.find(item =>
    item._buscaTexto === alvo ||
    item._nomeTexto === alvo ||
    item._cnpjTexto === alvo ||
    (alvoDigitos && item._cnpjDigitos === alvoDigitos) ||
    item._telefoneTexto === alvo ||
    item._emailTexto === alvo
  ) || null;

  if (!selecionado) {
    const similares = fornecedoresComBusca.filter(item =>
      item._buscaTexto.includes(alvo) ||
      item._nomeTexto.includes(alvo) ||
      item._cnpjTexto.includes(alvo) ||
      (alvoDigitos && item._cnpjDigitos.includes(alvoDigitos)) ||
      item._telefoneTexto.includes(alvo) ||
      item._emailTexto.includes(alvo)
    );
    if (similares.length === 1) selecionado = similares[0];
  }

  campoId.value = selecionado?.id || '';
}

function atualizarPagadorSelecionadoRecebivelFinanceiro() {
  // Pagador agora gerenciado pelo motor NR (nrPagadorBusca/nrPagadorId)
}

function preencherSelectRecebivelFormasPagamentoFinanceiro(valorAtual = '') {
  const select = document.getElementById('recebivelFormaPagamentoId');
  if (!select) return;
  const formas = formasPagamentoFinanceiroCache || [];
  const opcoes = formas.filter(item => item?.ativo !== false || String(item.id) === String(valorAtual || ''));
  select.innerHTML = '<option value="">Selecione a forma</option>' + opcoes.map(item => (
    `<option value="${item.id}"${String(item.id) === String(valorAtual || '') ? ' selected' : ''}>${item.nome || '-'}</option>`
  )).join('');
}

function preencherSelectRecebivelContasFinanceiras(valorAtual = '') {
  const select = document.getElementById('recebivelContaFinanceiraId');
  if (!select) return;
  const contas = contasFinanceirasCache || [];
  const opcoes = contas.filter(item => item?.ativo !== false || String(item.id) === String(valorAtual || ''));
  select.innerHTML = '<option value="">Selecione a conta</option>' + opcoes.map(item => (
    `<option value="${item.id}"${String(item.id) === String(valorAtual || '') ? ' selected' : ''}>${item.nome || '-'} (${formatarMoedaBRFinanceiro(item.saldo_atual || 0)})</option>`
  )).join('');
}

function preencherFiltroExtratoContasFinanceiras(valorAtual = '') {
  const select = document.getElementById('filtroExtratoContaFinanceira');
  if (!select) return;
  select.innerHTML = '<option value="">- Todas as contas -</option>' + (contasFinanceirasCache || []).map(item => (
    `<option value="${item.id}"${String(item.id) === String(valorAtual || '') ? ' selected' : ''}>${item.nome || '-'}</option>`
  )).join('');
}

function obterIdsLojasFinanceirasPermitidas() {
  const ids = new Set();
  try {
    obterLojasDisponiveisParaFiltroMultiLoja()
      .map(loja => String(loja?.id || '').trim())
      .filter(Boolean)
      .forEach(id => ids.add(id));
  } catch (_) {}

  const lojaSessaoId = String(usuarioSistemaLogado?.loja_id || '').trim();
  if (lojaSessaoId) ids.add(lojaSessaoId);
  return Array.from(ids);
}

function aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds = null) {
  const ids = Array.isArray(lojasPermitidasIds) ? lojasPermitidasIds : obterIdsLojasFinanceirasPermitidas();
  if (ids.length && query && typeof query.in === 'function') return query.in('loja_id', ids);
  return query;
}

function obterIdsLojasSelecionadasFiltroFinanceiroPage(containerId = '') {
  const ids = obterIdsLojasSelecionadasFiltroMultiLoja(containerId || '');
  return ids.length ? ids : obterIdsLojasFinanceirasPermitidas();
}

function limparFormularioContaFinanceira() {
  contaFinanceiraEmEdicaoId = null;
  const campoNome = document.getElementById('contaFinanceiraNome');
  if (campoNome) campoNome.value = '';
  configurarCampoSaldoContaFinanceira(true);
  const btnSalvar = document.getElementById('btnSalvarContaFinanceira');
  const btnCancelar = document.getElementById('btnCancelarContaFinanceira');
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

async function carregarContasFinanceiras({ render = true, silencioso = false } = {}) {
  const lista = document.getElementById('listaContasFinanceiras');
  if (render && lista) lista.innerHTML = '<div class="empty">Carregando...</div>';

  const lojasPermitidasIds = obterIdsLojasSelecionadasFiltroFinanceiroPage('filtroLojasContasFinanceiras');
  const { data, error } = await executarSemFiltroLojaTemporario(() => {
    let query = sb
      .from('contas_financeiras')
      .select('id, nome, saldo_atual, ativo, created_at, loja_id, empresa_id')
      .order('nome', { ascending: true });
    query = aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds);
    return query;
  });

  if (error) {
    contasFinanceirasCache = [];
    preencherSelectRecebivelContasFinanceiras();
    preencherFiltroExtratoContasFinanceiras();
    if (!silencioso) {
      setMsg('msgContaFinanceira', isMissingContasFinanceirasTableError(error)
        ? 'Rode o SQL de contas financeiras antes de usar esta tela.'
        : `Erro ao carregar contas financeiras: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    }
    if (render && lista) {
      lista.innerHTML = isMissingContasFinanceirasTableError(error)
        ? '<div class="empty">Rode o SQL da tabela contas_financeiras para habilitar este cadastro.</div>'
        : '<div class="empty">Erro ao carregar contas financeiras.</div>';
    }
    return [];
  }

  contasFinanceirasCache = data || [];
  preencherSelectRecebivelContasFinanceiras(document.getElementById('recebivelContaFinanceiraId')?.value || '');
  preencherFiltroExtratoContasFinanceiras(document.getElementById('filtroExtratoContaFinanceira')?.value || '');

  if (render && lista) {
    if (!contasFinanceirasCache.length) {
      lista.innerHTML = '<div class="empty">Nenhuma conta financeira cadastrada.</div>';
    } else {
      lista.innerHTML = '<div class="lista">' + contasFinanceirasCache.map(item => `
        <div class="item">
          <div class="item-info">
            <div class="item-nome">${escaparHtmlBasico(item.nome || '-')}</div>
            <div class="item-detalhe">Saldo atual: ${formatarMoedaBRFinanceiro(item.saldo_atual || 0)} · Status: ${item.ativo === false ? 'Inativa' : 'Ativa'}</div>
          </div>
          <div class="item-actions">
            ${item.ativo === false ? '<span class="tag">Inativa</span>' : '<span class="tag tag-green">Ativa</span>'}
            <button class="btn btn-ghost btn-sm" onclick="verExtratoContaFinanceira('${item.id}')">Extrato</button>
            <button class="btn btn-ghost btn-sm" onclick="editarContaFinanceira('${item.id}')">Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleContaFinanceira('${item.id}', ${item.ativo === false ? 'false' : 'true'})">${item.ativo === false ? 'Ativar' : 'Inativar'}</button>
            <button class="btn btn-red" onclick="excluirContaFinanceira('${item.id}')">Excluir</button>
          </div>
        </div>
      `).join('') + '</div>';
    }
  }

  return contasFinanceirasCache;
}

async function salvarContaFinanceira() {
  const nome = String(document.getElementById('contaFinanceiraNome')?.value || '').trim().replace(/\s+/g, ' ');
  const saldoTexto = String(document.getElementById('contaFinanceiraSaldoAtual')?.value || '').trim();
  const saldoAtual = lerValorMonetarioFinanceiro(saldoTexto);

  if (!nome) {
    setMsg('msgContaFinanceira', 'Digite o nome da conta financeira.', 'err');
    return;
  }
  if (!saldoTexto) {
    setMsg('msgContaFinanceira', 'Informe o saldo atual da conta.', 'err');
    return;
  }
  if (!Number.isFinite(saldoAtual)) {
    setMsg('msgContaFinanceira', 'Informe um saldo atual v?lido.', 'err');
    return;
  }

  const payload = {
    nome,
    saldo_atual: Number(saldoAtual.toFixed(2)),
  };
  const editando = !!contaFinanceiraEmEdicaoId;

  let query;
  if (editando) {
    query = sb.from('contas_financeiras').update(payload).eq('id', contaFinanceiraEmEdicaoId);
  } else {
    let tenant;
    try {
      tenant = await resolverTenantFornecedorFinanceiro();
    } catch (eTenant) {
      setMsg('msgContaFinanceira', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
      return;
    }
    query = sb.from('contas_financeiras').insert([{ ...payload, ativo: true, loja_id: tenant.loja_id, empresa_id: tenant.empresa_id }]);
  }

  const { error } = await query;
  if (error) {
    if (isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
      setMsg('msgContaFinanceira', 'Rode o SQL de contas financeiras antes de usar esta tela.', 'err');
      return;
    }
    setMsg('msgContaFinanceira', `N?o foi poss?vel salvar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  limparFormularioContaFinanceira();
  setMsg('msgContaFinanceira', editando ? 'Conta financeira atualizada.' : 'Conta financeira cadastrada.', 'ok');
  await carregarContasFinanceiras();
  await carregarExtratoContaFinanceira();
}

function editarContaFinanceira(id) {
  const item = contasFinanceirasCache.find(conta => String(conta.id) === String(id));
  if (!item) {
    setMsg('msgContaFinanceira', 'Conta financeira n?o encontrada.', 'err');
    return;
  }
  contaFinanceiraEmEdicaoId = id;
  const campoNome = document.getElementById('contaFinanceiraNome');
  if (campoNome) campoNome.value = item.nome || '';
  configurarCampoSaldoContaFinanceira(false, item.saldo_atual || 0);
  const btnSalvar = document.getElementById('btnSalvarContaFinanceira');
  const btnCancelar = document.getElementById('btnCancelarContaFinanceira');
  if (btnSalvar) btnSalvar.textContent = 'Salvar';
  if (btnCancelar) btnCancelar.style.display = 'inline-flex';
  setMsg('msgContaFinanceira', `Editando conta: ${item.nome || '-'}.`, 'ok');
}

function cancelarEdicaoContaFinanceira() {
  limparFormularioContaFinanceira();
  setMsg('msgContaFinanceira', 'Edi·o cancelada.', 'ok');
}

async function toggleContaFinanceira(id, ativoAtual = true) {
  const novoStatus = !ativoAtual;
  const { error } = await sb.from('contas_financeiras').update({ ativo: novoStatus }).eq('id', id);
  if (error) {
    setMsg('msgContaFinanceira', `N?o foi poss?vel alterar status: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }
  setMsg('msgContaFinanceira', novoStatus ? 'Conta ativada.' : 'Conta inativada.', 'ok');
  await carregarContasFinanceiras();
}

async function excluirContaFinanceira(id) {
  if (!confirm('Excluir esta conta financeira?')) return;

  const { count: countRecebiveis, error: erroRecebiveis } = await sb
    .from('recebiveis')
    .select('*', { count: 'exact', head: true })
    .eq('conta_financeira_id', id);
  if (erroRecebiveis && !isMissingRecebiveisTableError(erroRecebiveis) && !isMissingColumnError(erroRecebiveis)) {
    setMsg('msgContaFinanceira', `N?o foi poss?vel validar receb?veis: ${mensagemErroSupabase(erroRecebiveis, 'erro desconhecido')}`, 'err');
    return;
  }
  if (!erroRecebiveis && Number(countRecebiveis || 0) > 0) {
    setMsg('msgContaFinanceira', 'N?o ? poss?vel excluir: existem receb?veis vinculados a esta conta.', 'err');
    return;
  }

  const { count: countMov, error: erroMov } = await sb
    .from('contas_financeiras_movimentacoes')
    .select('*', { count: 'exact', head: true })
    .eq('conta_financeira_id', id);
  if (erroMov && !isMissingContasFinanceirasMovimentacoesTableError(erroMov)) {
    setMsg('msgContaFinanceira', `N?o foi poss?vel validar extrato: ${mensagemErroSupabase(erroMov, 'erro desconhecido')}`, 'err');
    return;
  }
  if (!erroMov && Number(countMov || 0) > 0) {
    setMsg('msgContaFinanceira', 'N?o ? poss?vel excluir: esta conta possui extrato financeiro.', 'err');
    return;
  }

  const { error } = await sb.from('contas_financeiras').delete().eq('id', id);
  if (error) {
    setMsg('msgContaFinanceira', `N?o foi poss?vel excluir: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
    return;
  }

  if (String(contaFinanceiraEmEdicaoId || '') === String(id)) limparFormularioContaFinanceira();
  setMsg('msgContaFinanceira', 'Conta financeira exclu?da.', 'ok');
  await carregarContasFinanceiras();
  await carregarExtratoContaFinanceira();
}

function verExtratoContaFinanceira(id) {
  const filtro = document.getElementById('filtroExtratoContaFinanceira');
  if (filtro) filtro.value = id;
  carregarExtratoContaFinanceira();
}

async function carregarExtratoContaFinanceira() {
  const lista = document.getElementById('listaExtratoContaFinanceira');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  const filtroConta = String(document.getElementById('filtroExtratoContaFinanceira')?.value || '').trim();
  const filtroBusca = textoFinanceiroNormalizado(document.getElementById('filtroExtratoContaBusca')?.value || '');

  const lojasPermitidasIds = obterIdsLojasSelecionadasFiltroFinanceiroPage('filtroLojasContasFinanceiras');
  let query = sb
    .from('contas_financeiras_movimentacoes')
    .select('id, conta_financeira_id, recebivel_id, tipo, valor, descricao, saldo_apos, created_at, contas_financeiras(nome), recebiveis(id, fornecedores(nome), formas_pagamento(nome))')
    .order('created_at', { ascending: false });
  if (filtroConta) query = query.eq('conta_financeira_id', filtroConta);
  query = aplicarFiltroLojasFinanceirasPermitidas(query, lojasPermitidasIds);

  const { data, error } = await query;
  if (error) {
    extratoContaFinanceiraCache = [];
    if (isMissingContasFinanceirasMovimentacoesTableError(error) || isMissingContasFinanceirasTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL de contas financeiras para habilitar o extrato.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar extrato.</div>';
    return;
  }

  extratoContaFinanceiraCache = data || [];
  const itens = extratoContaFinanceiraCache.filter(item => {
    const conta = String(item.contas_financeiras?.nome || '').trim();
    const descricao = String(item.descricao || '').trim();
    const pagador = String(item.recebiveis?.fornecedores?.nome || '').trim();
    const forma = String(item.recebiveis?.formas_pagamento?.nome || '').trim();
    const valor = formatarMoedaBRFinanceiro(item.valor || 0);
    return !filtroBusca || textoFinanceiroNormalizado(`${conta} ${descricao} ${pagador} ${forma} ${valor}`).includes(filtroBusca);
  });

  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhuma movimenta·o encontrada.</div>';
    return;
  }

  lista.innerHTML = '<div class="lista">' + itens.map(item => {
    const tipo = String(item.tipo || 'entrada').toLowerCase();
    const tag = tipo === 'entrada' ? '<span class="tag tag-green">Entrada</span>' : '<span class="tag tag-red">Estorno</span>';
    const conta = escaparHtmlBasico(item.contas_financeiras?.nome || 'Conta não encontrada');
    const descricao = escaparHtmlBasico(item.descricao || '-');
    const pagador = escaparHtmlBasico(item.recebiveis?.fornecedores?.nome || '');
    const forma = escaparHtmlBasico(item.recebiveis?.formas_pagamento?.nome || '');
    const detalheRecebivel = [pagador, forma].filter(Boolean).join(' ? ');
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${conta}</div>
          <div class="item-detalhe">Valor: ${formatarMoedaBRFinanceiro(item.valor || 0)} · Saldo após: ${formatarMoedaBRFinanceiro(item.saldo_apos || 0)}${detalheRecebivel ? ` · ${detalheRecebivel}` : ''}</div>
        </div>
        <div class="item-actions">${tag}</div>
      </div>
    `;
  }).join('') + '</div>';
}

async function registrarMovimentacaoContaFinanceira({ contaFinanceiraId, recebivelId = null, contaApagarId = null, tipo = 'entrada', valor = 0, descricao = '' } = {}) {
  const contaId = String(contaFinanceiraId || '').trim();
  const valorMov = Number(valor || 0);
  if (!contaId || !Number.isFinite(valorMov) || valorMov <= 0) return { error: null };

  const { data: conta, error: erroConta } = await executarSemFiltroLojaTemporario(() => sb
    .from('contas_financeiras')
    .select('id, saldo_atual, empresa_id, loja_id')
    .eq('id', contaId)
    .maybeSingle());
  if (erroConta) return { error: erroConta };
  if (!conta?.id) return { error: new Error('Conta financeira não encontrada.') };

  const tipoMov = String(tipo || 'entrada').toLowerCase();
  const delta = (tipoMov === 'saida' || tipoMov === 'estorno') ? -valorMov : valorMov;
  const saldoAntes = Number(conta.saldo_atual || 0);
  const saldoApos = Number((saldoAntes + delta).toFixed(2));

  let { error: erroUpdate } = await executarSemFiltroLojaTemporario(() => sb
    .from('contas_financeiras')
    .update({ saldo_atual: saldoApos, updated_at: new Date().toISOString() })
    .eq('id', contaId));

  // Fallback para bancos que ainda n?o t?m a coluna updated_at em contas_financeiras.
  // Antes, quando essa coluna faltava, o receb?vel podia ser salvo mas a tela parava antes de atualizar a lista,
  // dando a impress?o de que o bot?o Cadastrar n?o fazia nada.
  if (erroUpdate && isMissingColumnError(erroUpdate)) {
    const tentativaSemUpdatedAt = await executarSemFiltroLojaTemporario(() => sb
      .from('contas_financeiras')
      .update({ saldo_atual: saldoApos })
      .eq('id', contaId));
    erroUpdate = tentativaSemUpdatedAt.error;
  }
  if (erroUpdate) return { error: erroUpdate };

  const empresaIdMov = String(conta.empresa_id || usuarioSistemaLogado?.empresa_id || '').trim() || null;
  const lojaIdMov = String(conta.loja_id || usuarioSistemaLogado?.loja_id || '').trim() || null;

  const { error: erroMov } = await executarSemFiltroLojaTemporario(() => sb
    .from('contas_financeiras_movimentacoes')
    .insert([{
      conta_financeira_id: contaId,
      recebivel_id: recebivelId || null,
      conta_apagar_id: contaApagarId || null,
      tipo,
      valor: Number(valorMov.toFixed(2)),
      descricao: descricao || null,
      saldo_apos: saldoApos,
      empresa_id: empresaIdMov,
      loja_id: lojaIdMov,
    }]));

  if (erroMov) {
    let { error: erroRollback } = await executarSemFiltroLojaTemporario(() => sb
      .from('contas_financeiras')
      .update({ saldo_atual: saldoAntes, updated_at: new Date().toISOString() })
      .eq('id', contaId));
    if (erroRollback && isMissingColumnError(erroRollback)) {
      const tentativaRollbackSemUpdatedAt = await executarSemFiltroLojaTemporario(() => sb
        .from('contas_financeiras')
        .update({ saldo_atual: saldoAntes })
        .eq('id', contaId));
      erroRollback = tentativaRollbackSemUpdatedAt.error;
    }
    if (erroRollback) console.warn('Falha ao desfazer saldo apos erro no extrato:', erroRollback);
  }

  return { error: erroMov || null, saldoAnterior: saldoAntes, saldoApos };
}

async function recebiveisSaldoGerenciadoNoBanco() {
  if (recebiveisSaldoGerenciadoBancoCache !== null) return recebiveisSaldoGerenciadoBancoCache;
  try {
    if (!sb || typeof sb.rpc !== 'function') {
      recebiveisSaldoGerenciadoBancoCache = false;
      return false;
    }
    const { data, error } = await sb.rpc('financeiro_recebiveis_saldo_trigger_ativo');
    recebiveisSaldoGerenciadoBancoCache = !error && data === true;
    return recebiveisSaldoGerenciadoBancoCache;
  } catch (_) {
    recebiveisSaldoGerenciadoBancoCache = false;
    return false;
  }
}

function limparFormularioRecebivelFinanceiro() {
  recebivelFinanceiroEmEdicaoId = null;
  const campoPagador = document.getElementById('recebivelPagadorBusca');
  const campoPagadorId = document.getElementById('recebivelPagadorId');
  const campoForma = document.getElementById('recebivelFormaPagamentoId');
  const campoConta = document.getElementById('recebivelContaFinanceiraId');
  if (campoPagador) campoPagador.value = '';
  if (campoPagadorId) campoPagadorId.value = '';
  if (campoForma) campoForma.value = '';
  if (campoConta) campoConta.value = '';
  configurarCampoValorRecebivelFinanceiro(true);
  preencherSelectRecebivelFormasPagamentoFinanceiro();
  preencherSelectRecebivelContasFinanceiras();
  // Limpar motor NR
  NR.pagadorId = null; NR.pagadorNome = null; NR.valor = null;
  nrLimparPagador();
  const campoQtd = document.getElementById('recebivelQtdParcelas');
  const campoDias = document.getElementById('recebivelDiasIntervalo');
  const campoDataPrevista = document.getElementById('recebivelDataPrevista');
  const campoObs = document.getElementById('recebivelObservacao');
  const campoVal = document.getElementById('recebivelValor');
  if (campoQtd) campoQtd.value = '1';
  if (campoDias) campoDias.value = '30';
  if (campoDataPrevista) campoDataPrevista.value = '';
  if (campoObs) { campoObs.value = ''; campoObs.style.borderColor = ''; }
  if (campoVal) campoVal.value = '';
  ['recebivelObsErr','nrQtdErr','nrDiasErr'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const btnSalvar = document.getElementById('btnSalvarRecebivelFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarRecebivelFinanceiro');
  if (btnSalvar) btnSalvar.textContent = 'Cadastrar';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

// Valida·o inline da observa·o
function recebivelObsInput(inp) {
  const e = document.getElementById('recebivelObsErr');
  if (e) e.style.display = inp.value.trim() ? 'none' : '';
  if (inp) inp.style.borderColor = inp.value.trim() ? '' : 'var(--red)';
}

let salvandoRecebivelFinanceiroEmAndamento = false;
async function salvarRecebivelFinanceiro() {
  if (salvandoRecebivelFinanceiroEmAndamento) return;
  salvandoRecebivelFinanceiroEmAndamento = true;
  const btnCadastrarRecebivel = document.getElementById('btnSalvarRecebivelFinanceiro');
  if (btnCadastrarRecebivel) btnCadastrarRecebivel.disabled = true;
  try {
    // L? pagador do motor NR (sheet) ou do campo hidden legado (edi·o)
    const pagadorId = String(NR.pagadorId || document.getElementById('nrPagadorId')?.value || '').trim();
    const formaPagamentoId = String(document.getElementById('recebivelFormaPagamentoId')?.value || '').trim();
    const contaFinanceiraId = String(document.getElementById('recebivelContaFinanceiraId')?.value || '').trim();
    const valorTexto = String(document.getElementById('recebivelValor')?.value || '').trim();
    const valorRecebivel = lerValorMonetarioFinanceiro(valorTexto);
    const qtdParcelas = parseInt(document.getElementById('recebivelQtdParcelas')?.value || '1', 10) || 1;
    const diasIntervalo = parseInt(document.getElementById('recebivelDiasIntervalo')?.value || '30', 10) || 30;
    const dataPrevista = String(document.getElementById('recebivelDataPrevista')?.value || '').trim();
    const observacao = String(document.getElementById('recebivelObservacao')?.value || '').trim();

    if (!pagadorId) {
      setMsg('msgRecebivelFinanceiro', 'Selecione um pagador v?lido na busca de fornecedores.', 'err');
      return;
    }
    if (!formaPagamentoId) {
      setMsg('msgRecebivelFinanceiro', 'Selecione uma forma de pagamento cadastrada.', 'err');
      return;
    }
    if (!contaFinanceiraId) {
      setMsg('msgRecebivelFinanceiro', 'Selecione a conta financeira que receber? este dinheiro.', 'err');
      return;
    }
    if (!valorTexto) {
      setMsg('msgRecebivelFinanceiro', 'Informe o valor do receb?vel.', 'err');
      return;
    }
    if (!Number.isFinite(valorRecebivel) || valorRecebivel <= 0) {
      setMsg('msgRecebivelFinanceiro', 'Informe um valor v?lido para o receb?vel.', 'err');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrevista)) {
      setMsg('msgRecebivelFinanceiro', 'Informe a data prevista do primeiro pagamento.', 'err');
      document.getElementById('recebivelDataPrevista')?.focus();
      return;
    }
    if (!observacao) {
      const obsErr = document.getElementById('recebivelObsErr');
      const obsEl = document.getElementById('recebivelObservacao');
      if (obsErr) obsErr.style.display = '';
      if (obsEl) obsEl.style.borderColor = 'var(--red)';
      setMsg('msgRecebivelFinanceiro', 'Preencha a observa·o.', 'err');
      return;
    }

    const contaSelecionada = (contasFinanceirasCache || []).find(item => String(item.id) === String(contaFinanceiraId)) || null;
    let empresaIdSessao = contaSelecionada?.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null;
    let lojaIdSessao = contaSelecionada?.loja_id || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null;
    if (!lojaIdSessao || !empresaIdSessao) {
      try {
        const t = await resolverTenantFornecedorFinanceiro();
        lojaIdSessao = lojaIdSessao || t.loja_id;
        empresaIdSessao = empresaIdSessao || t.empresa_id;
      } catch (eTenant) {
        setMsg('msgRecebivelFinanceiro', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
        return;
      }
    }

    const payloadBase = {
      pagador_id: pagadorId,
      forma_pagamento_id: formaPagamentoId,
      conta_financeira_id: contaFinanceiraId,
      valor: Number(valorRecebivel.toFixed(2)),
      empresa_id: empresaIdSessao,
      loja_id: lojaIdSessao,
      qtd_parcelas: qtdParcelas > 0 ? qtdParcelas : 1,
      intervalo_dias: diasIntervalo > 0 ? diasIntervalo : 30,
      observacao: observacao || null,
    };
    const editando = !!recebivelFinanceiroEmEdicaoId;
    if (!editando) {
      const quantidade = Math.max(1, qtdParcelas);
      const criadoPorNome = obterNomeAdminAtual?.() || usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Usuario';
      const provisionamentos = Array.from({ length: quantidade }, (_, indice) => ({
        pagador_id: pagadorId,
        forma_pagamento_id: formaPagamentoId,
        conta_financeira_id: contaFinanceiraId,
        valor: Number(valorRecebivel.toFixed(2)),
        data_prevista: calcularVencimentoParcelaFinanceiro(dataPrevista, indice, 30),
        intervalo_dias: 30,
        qtd_recorrencias: quantidade,
        numero_recorrencia: indice + 1,
        observacao: observacao || null,
        criado_por_nome: criadoPorNome,
        empresa_id: empresaIdSessao,
        loja_id: lojaIdSessao,
        ativo: true,
      }));
      const { error: erroProvisionamento } = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros').insert(provisionamentos)
      );
      if (erroProvisionamento) {
        setMsg('msgRecebivelFinanceiro', `N?o foi poss?vel cadastrar os recebimentos: ${mensagemErroSupabase(erroProvisionamento, 'erro desconhecido')}`, 'err');
        return;
      }

      nrFechar();
      limparFormularioRecebivelFinanceiro();
      await carregarRecFuturos();
      setMsg('msgRecFuturosLista', `${quantidade} recebimento(s) provisionado(s), mantendo o dia combinado de cada m?s.`, 'ok');
      return;
    }
    const payload = editando
      ? { ...payloadBase, created_at: new Date(`${dataPrevista}T12:00:00`).toISOString() }
      : {
          ...payloadBase,
          criado_por_id: obterIdAdminAtual?.() || usuarioSistemaLogado?.id || null,
          criado_por_nome: obterNomeAdminAtual?.() || usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Usuario',
        };
    const recebivelAnterior = editando
      ? recebiveisFinanceiroCache.find(item => String(item.id) === String(recebivelFinanceiroEmEdicaoId)) || null
      : null;
    const montarQueryRecebivel = (dados) => editando
      ? sb.from('recebiveis').update(dados).eq('id', recebivelFinanceiroEmEdicaoId).select('id').maybeSingle()
      : sb.from('recebiveis').insert([dados]).select('id').maybeSingle();

    let { data: recebivelSalvo, error } = await montarQueryRecebivel(payload);
    if (error && isMissingColumnError(error)) {
      ({ data: recebivelSalvo, error } = await montarQueryRecebivel(payloadBase));
    }
    if (error) {
      if (isMissingRecebiveisTableError(error) || isMissingFornecedoresTableError(error) || isMissingFormasPagamentoTableError(error) || isMissingColumnError(error)) {
        setMsg('msgRecebivelFinanceiro', 'Rode o SQL mais recente do financeiro para habilitar receb?veis.', 'err');
        return;
      }
      setMsg('msgRecebivelFinanceiro', `N?o foi poss?vel salvar: ${mensagemErroSupabase(error, 'erro desconhecido')}`, 'err');
      return;
    }
    const recebivelId = recebivelSalvo?.id || recebivelFinanceiroEmEdicaoId;
    const saldoGerenciadoNoBanco = await recebiveisSaldoGerenciadoNoBanco();

    if (!saldoGerenciadoNoBanco && editando && recebivelAnterior?.conta_financeira_id && Number(recebivelAnterior.valor || 0) > 0) {
      const { error: erroEstorno } = await registrarMovimentacaoContaFinanceira({
        contaFinanceiraId: recebivelAnterior.conta_financeira_id,
        recebivelId,
        tipo: 'estorno',
        valor: Number(recebivelAnterior.valor || 0),
        descricao: 'Estorno por edi·o de receb?vel',
      });
      if (erroEstorno) {
        setMsg('msgRecebivelFinanceiro', `Recebível salvo, mas não foi possível estornar o saldo anterior: ${mensagemErroSupabase(erroEstorno, 'erro desconhecido')}`, 'err');
        return;
      }
    }

    const pagadorNome = fornecedoresFinanceiroCache.find(item => String(item.id) === pagadorId)?.nome || 'pagador';
    const formaNome = formasPagamentoFinanceiroCache.find(item => String(item.id) === formaPagamentoId)?.nome || 'forma de pagamento';
    if (!saldoGerenciadoNoBanco) {
      const { error: erroMovimentacao } = await registrarMovimentacaoContaFinanceira({
        contaFinanceiraId,
        recebivelId,
        tipo: 'entrada',
        valor: Number(valorRecebivel.toFixed(2)),
        descricao: `Recebível de ${pagadorNome} via ${formaNome}`,
      });
      if (erroMovimentacao) {
        setMsg('msgRecebivelFinanceiro', `Recebível salvo, mas não foi possível lançar a entrada na conta financeira: ${mensagemErroSupabase(erroMovimentacao, 'erro desconhecido')}`, 'err');
        return;
      }
    }

    nrFechar();
    limparFormularioRecebivelFinanceiro();
    setMsg('msgRecebivelFinanceiro', editando ? 'Recebível atualizado.' : 'Recebível cadastrado.', 'ok');
    recebiveisFinanceiroListaVisivel = true;
    await carregarContasFinanceiras({ render: false, silencioso: true });
    await carregarRecebiveisFinanceiro();
    if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) {
      await carregarCofreFinanceiro();
    }
    if (document.getElementById('relatorio_recebimentos')?.classList.contains('ativa')) {
      await carregarRelatorioRecebimentos();
    }

  } catch (erroInesperado) {
    setMsg('msgRecebivelFinanceiro', `Não foi possível cadastrar o recebível: ${mensagemErroSupabase(erroInesperado, erroInesperado?.message || 'erro inesperado')}`, 'err');
    setMsg('msgRecebivelFinanceiro', `N?o foi poss?vel cadastrar o receb?vel: ${mensagemErroSupabase(erroInesperado, erroInesperado?.message || 'erro inesperado')}`, 'err');
  } finally {
    salvandoRecebivelFinanceiroEmAndamento = false;
    if (btnCadastrarRecebivel) btnCadastrarRecebivel.disabled = false;
  }
}

function cancelarEdicaoRecebivelFinanceiro() {
  limparFormularioRecebivelFinanceiro();
  nrFechar();
}

function obterChaveUsuarioRecebivelFinanceiro(item = {}) {
  const id = String(item.criado_por_id || '').trim();
  if (id) return `id:${id}`;
  const nome = String(item.criado_por_nome || '').trim().toLowerCase();
  if (nome) return `nome:${nome}`;
  const usuarioAtual = String(usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || usuarioSistemaLogado?.email || '').trim().toLowerCase();
  return usuarioAtual ? `nome:${usuarioAtual}` : '';
}

function obterNomeUsuarioRecebivelFinanceiro(item = {}) {
  return String(item.criado_por_nome || '').trim()
    || String(usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || usuarioSistemaLogado?.email || '').trim()
    || 'Cadastro anterior';
}

function atualizarEstadoListaRecebiveisFinanceiro() {
  const lista = document.getElementById('listaRecebiveisFinanceiro');
  const btn = document.getElementById('btnToggleRecebiveisLista');
  const filtroBusca = String(document.getElementById('filtroRecebivelBusca')?.value || '').trim();
  const filtroInicio = String(document.getElementById('filtroRecebivelCadastroInicio')?.value || '').trim();
  const filtroFim = String(document.getElementById('filtroRecebivelCadastroFim')?.value || '').trim();
  const filtroUsuario = String(document.getElementById('filtroRecebivelUsuario')?.value || '').trim();
  const visivel = recebiveisFinanceiroListaVisivel || !!filtroBusca || !!filtroInicio || !!filtroFim || !!filtroUsuario;
  if (lista) lista.hidden = !visivel;
  if (btn) {
    btn.textContent = visivel ? 'Ocultar recebíveis' : 'Mostrar recebíveis';
    btn.setAttribute('aria-expanded', String(visivel));
  }
  // Atualizar IDs vis?veis e mostrar/ocultar controles de sele·o
  recebiveisFinanceiroVisiveisIds = Array.from(document.querySelectorAll('.checkbox-recebivel-financeiro')).map(el => el.getAttribute('data-recebivel-id'));
  atualizarResumoSelecaoRecebiveisFinanceiro();
}

function toggleListaRecebiveisFinanceiro() {
  recebiveisFinanceiroListaVisivel = !recebiveisFinanceiroListaVisivel;
  atualizarEstadoListaRecebiveisFinanceiro();
  if (recebiveisFinanceiroListaVisivel) carregarRecebiveisFinanceiro();
}

function preencherFiltroUsuariosRecebiveisFinanceiro(itens = []) {
  const select = document.getElementById('filtroRecebivelUsuario');
  if (!select) return;
  const valorAtual = String(select.value || '').trim();
  const usuarios = [...new Map((itens || [])
    .map(item => ({ valor: obterChaveUsuarioRecebivelFinanceiro(item), rotulo: obterNomeUsuarioRecebivelFinanceiro(item) }))
    .filter(item => item.valor)
    .map(item => [item.valor, item])).values()]
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  select.innerHTML = '<option value="">- Quem lançou -</option>' + usuarios
    .map(item => `<option value="${escaparHtmlBasico(item.valor)}">${escaparHtmlBasico(item.rotulo)}</option>`)
    .join('');
  select.value = usuarios.some(item => item.valor === valorAtual) ? valorAtual : '';
}

function resetarFiltrosRecebiveisFinanceiro({ manterListaVisivel = false } = {}) {
  const busca = document.getElementById('filtroRecebivelBusca');
  const inicio = document.getElementById('filtroRecebivelCadastroInicio');
  const fim = document.getElementById('filtroRecebivelCadastroFim');
  const usuario = document.getElementById('filtroRecebivelUsuario');
  if (busca) busca.value = '';
  if (inicio) inicio.value = '';
  if (fim) fim.value = '';
  if (usuario) usuario.value = '';
  recebiveisFinanceiroListaVisivel = !!manterListaVisivel;
  atualizarEstadoListaRecebiveisFinanceiro();
}

function limparFiltroRecebiveisFinanceiro() {
  resetarFiltrosRecebiveisFinanceiro({ manterListaVisivel: false });
  carregarRecebiveisFinanceiro();
}

function mostrarTodosRecebiveisFinanceiro() {
  resetarFiltrosRecebiveisFinanceiro({ manterListaVisivel: true });
  carregarRecebiveisFinanceiro({ amplo: true });
}

async function consultarRecebiveisFinanceiroComAuditoria({ amplo = false, incluirFuturos = false } = {}) {
  const camposComAuditoria = 'id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, created_at, criado_por_id, criado_por_nome, loja_id, empresa_id, qtd_parcelas, intervalo_dias, observacao, fornecedores(nome), formas_pagamento(id, nome, ativo), contas_financeiras(id, nome)';
  const camposSemAuditoria = 'id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, created_at, loja_id, empresa_id, qtd_parcelas, intervalo_dias, observacao, fornecedores(nome), formas_pagamento(id, nome, ativo), contas_financeiras(id, nome)';
  const executar = (campos) => sb
    .from('recebiveis')
    .select(campos)
    .order('created_at', { ascending: false });
  const executarConsulta = (campos) => amplo
    ? executarSemFiltroLojaTemporario(() => executar(campos))
    : executar(campos);
  let resultado = await executarConsulta(camposComAuditoria);
  if (resultado.error && isMissingColumnError(resultado.error)) {
    resultado = await executarConsulta(camposSemAuditoria);
  }
  return resultado;
}

function filtrarRecebiveisPorTenantAtual(itens = [], { ignorarLoja = false } = {}) {
  const empresaId = String(usuarioSistemaLogado?.empresa_id || '').trim();
  const lojasPermitidasIds = obterLojasDisponiveisParaFiltroMultiLoja()
    .map(loja => String(loja.id || '').trim())
    .filter(Boolean);
  const lojaSessaoId = String(usuarioSistemaLogado?.loja_id || '').trim();
  const lojasPermitidas = new Set(lojasPermitidasIds.length ? lojasPermitidasIds : (lojaSessaoId ? [lojaSessaoId] : []));
  return (itens || []).filter(item => {
    const itemEmpresa = String(item?.empresa_id || '').trim();
    const itemLoja = String(item?.loja_id || '').trim();
    if (!ignorarLoja && lojasPermitidas.size && itemLoja) return lojasPermitidas.has(itemLoja);
    if (empresaId && itemEmpresa && itemEmpresa !== empresaId) return false;
    return true;
  });
}

async function carregarRecebiveisFinanceiro(opcoes = {}) {
  const lista = document.getElementById('listaRecebiveisFinanceiro');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  const filtroBusca = textoFinanceiroNormalizado(document.getElementById('filtroRecebivelBusca')?.value || '');
  const filtroInicio = String(document.getElementById('filtroRecebivelCadastroInicio')?.value || '').trim();
  const filtroFim = String(document.getElementById('filtroRecebivelCadastroFim')?.value || '').trim();
  const filtroUsuario = String(document.getElementById('filtroRecebivelUsuario')?.value || '').trim();

  const usarConsultaAmpla = opcoes.amplo === true || obterLojasDisponiveisParaFiltroMultiLoja().length > 1;
  const ignorarLojaNaLista = usarConsultaAmpla || usuarioEhAdministrador?.() || usuarioSistemaLogado?.tipo === 'admin_loja';
  let { data, error } = await consultarRecebiveisFinanceiroComAuditoria({ amplo: usarConsultaAmpla });

  if (error) {
    recebiveisFinanceiroCache = [];
    if (isMissingRecebiveisTableError(error)) {
      lista.innerHTML = '<div class="empty">Rode o SQL da tabela recebiveis para habilitar este cadastro.</div>';
      return;
    }
    if (isMissingFornecedoresTableError(error) || isMissingFormasPagamentoTableError(error) || isMissingContasFinanceirasTableError(error) || isMissingColumnError(error)) {
      lista.innerHTML = '<div class="empty">Rode as migrations mais recentes do financeiro para habilitar receb?veis.</div>';
      return;
    }
    lista.innerHTML = '<div class="empty">Erro ao carregar receb?veis.</div>';
    return;
  }

  if ((!data || !data.length) && opcoes.amplo === true && !usarConsultaAmpla) {
    const fallback = await consultarRecebiveisFinanceiroComAuditoria({ amplo: true });
    if (!fallback.error) {
      data = filtrarRecebiveisPorTenantAtual(fallback.data || [], { ignorarLoja: true });
      error = null;
    }
  }

  recebiveisFinanceiroCache = usarConsultaAmpla
    ? filtrarRecebiveisPorTenantAtual(data || [], { ignorarLoja: ignorarLojaNaLista })
    : (data || []);
  preencherFiltroUsuariosRecebiveisFinanceiro(recebiveisFinanceiroCache);
  const itens = recebiveisFinanceiroCache.filter(item => {
    const pagador = String(item.fornecedores?.nome || '').trim();
    const forma = String(item.formas_pagamento?.nome || '').trim();
    const conta = String(item.contas_financeiras?.nome || '').trim();
    const valor = formatarMoedaBRFinanceiro(item.valor || 0);
    const dataCadastro = String(item.created_at || '').slice(0, 10);
    const usuario = obterChaveUsuarioRecebivelFinanceiro(item);
    if (filtroBusca && !textoFinanceiroNormalizado(`${pagador} ${forma} ${conta} ${valor}`).includes(filtroBusca)) return false;
    if (filtroInicio && (!dataCadastro || dataCadastro < filtroInicio)) return false;
    if (filtroFim && (!dataCadastro || dataCadastro > filtroFim)) return false;
    if (filtroUsuario && filtroUsuario !== usuario) return false;
    return true;
  });

  if (!itens.length) {
    lista.innerHTML = '<div class="empty">Nenhum receb?vel encontrado com os filtros atuais. Use "Mostrar todos" para limpar os filtros e exibir a lista completa.</div>';
    atualizarEstadoListaRecebiveisFinanceiro();
    return;
  }

  // Calcular totais
  const totalRecebiveisCadastrados = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
  
  // HTML com checkbox "Selecionar todos" e bot?o "Excluir selecionados"
  const htmlSelecionadores = `
    <div class="rec-selection-bar">
      <label class="rec-select-all">
        <input type="checkbox" id="checkboxSelecionarTodosRecebiveisFinanceiro" onchange="toggleSelecionarTodosRecebiveisFinanceiro()">
        <span>Selecionar todos (${itens.length})</span>
      </label>
    </div>`;

  // Renderizar cards grandes
  const htmlCards = itens.map(item => {
    const dataCadastro = String(item.created_at || '').slice(0, 10);
    const dataFormatada = formatarDataBRFinanceiro(dataCadastro);
    const valor = formatarMoedaBRFinanceiro(item.valor || 0);
    const pagador = escaparHtmlBasico(item.fornecedores?.nome || 'Pagador não encontrado');
    const forma = escaparHtmlBasico(item.formas_pagamento?.nome || '-');
    const conta = escaparHtmlBasico(item.contas_financeiras?.nome || '-');
    
    return `
      <article class="rec-card">
        <div class="rec-card-main">
          <div class="rec-card-head">
            <div class="rec-card-title">${pagador}</div>
            <div class="rec-card-value">${valor}</div>
          </div>
          <div class="rec-card-meta">
            <div>Cadastro: <strong>${dataFormatada}</strong></div>
            <div>${forma} &middot; ${conta}</div>
          </div>
        </div>
        <div class="rec-card-actions">
          <label class="rec-check" title="Selecionar recebível">
            <input type="checkbox" class="checkbox-recebivel-financeiro" data-recebivel-id="${item.id}" ${recebiveisFinanceiroSelecionadosIds.has(String(item.id)) ? 'checked' : ''} onchange="atualizarSelecaoRecebivelFinanceiro('${item.id}', this.checked)">
            <span>Selecionar</span>
          </label>
          <button class="btn btn-ghost btn-sm" onclick="editarRecebivelFinanceiro('${item.id}')">Editar</button>
          <button class="btn btn-red btn-sm" onclick="excluirRecebivelFinanceiro('${item.id}')">Excluir</button>
        </div>
      </article>
    `;
  }).join('');

  lista.innerHTML = htmlSelecionadores + `<div class="rec-grid">${htmlCards}</div>`;
  
  // Atualizar estado dos bot?es
  atualizarResumoSelecaoRecebiveisFinanceiro();
  atualizarEstadoListaRecebiveisFinanceiro();
}

function editarRecebivelFinanceiro(id) {
  const item = recebiveisFinanceiroCache.find(recebivel => String(recebivel.id) === String(id));
  if (!item) {
    setMsg('msgRecebivelFinanceiro', 'Recebível não encontrado.', 'err');
    return;
  }
  recebivelFinanceiroEmEdicaoId = id;
  // Preencher motor NR
  NR.pagadorId = item.pagador_id || null;
  NR.pagadorNome = item.fornecedores?.nome || '';
  NR.valor = Number(item.valor || 0);
  NR.modoEdicao = true;
  // Abrir o sheet no modo edi·o
  nrAbrir(true);
  // Preencher campos do sheet
  if (NR.pagadorNome) nrSelPagador(NR.pagadorId, NR.pagadorNome);
  preencherSelectRecebivelFormasPagamentoFinanceiro(item.forma_pagamento_id || '');
  preencherSelectRecebivelContasFinanceiras(item.conta_financeira_id || '');
  const vEl = document.getElementById('recebivelValor');
  if (vEl && NR.valor > 0) vEl.value = nrFmtBR(NR.valor);
  const qtdEl = document.getElementById('recebivelQtdParcelas');
  if (qtdEl) qtdEl.value = item.qtd_parcelas || 1;
  const diasEl = document.getElementById('recebivelDiasIntervalo');
  if (diasEl) diasEl.value = item.intervalo_dias || 30;
  const dataPrevistaEl = document.getElementById('recebivelDataPrevista');
  if (dataPrevistaEl) dataPrevistaEl.value = String(item.created_at || '').slice(0, 10);
  const obsEl = document.getElementById('recebivelObservacao');
  if (obsEl) obsEl.value = item.observacao || '';
  const tt = document.getElementById('nrTitulo'); if (tt) tt.textContent = 'Editar receb?vel';
  const bs = document.getElementById('btnSalvarRecebivelFinanceiro'); if (bs) bs.textContent = '✓ Salvar alterações';
  const bc = document.getElementById('btnCancelarRecebivelFinanceiro'); if (bc) bc.style.display = '';
}


// ·································
// RECEBÍVEIS FUTUROS (PROVISIONAMENTO)
// ·································
let recFuturoEmEdicaoId = null;
let recFuturosCache = [];

async function iniciarTelaRecFuturos() {
  cancelarEdicaoRecFuturo();
  await Promise.all([
    carregarFornecedoresFinanceiro(),
    carregarFormasPagamentoFinanceiro({ render: false, silencioso: true }),
    carregarContasFinanceiras({ render: false, silencioso: true }),
  ]);
  preencherSelectsRecFuturo();
  preencherPagadoresRecFuturo();
  // Data prevista padr?o: hoje
  const hoje = new Date().toISOString().slice(0, 10);
  const campoData = document.getElementById('recFuturoDataPrevista');
  if (campoData && !campoData.value) campoData.value = hoje;
  // Recorr?ncia toggle
  const chkRec = document.getElementById('recFuturoRecorrente');
  if (chkRec) chkRec.onchange = () => {
    const c = document.getElementById('containerRecFuturoRecorrencia');
    if (c) c.style.display = chkRec.checked ? '' : 'none';
  };
  await carregarRecFuturos();
}

function preencherPagadoresRecFuturo() {
  const dl = document.getElementById('recFuturoPagadoresAutoList');
  if (!dl) return;
  dl.innerHTML = (fornecedoresFinanceiroCache || []).map(f =>
    `<option value="${escaparHtmlBasico(f.nome)}" data-id="${f.id}">`
  ).join('');
}

function atualizarPagadorRecFuturo() {
  const busca = document.getElementById('recFuturoPagadorBusca');
  const campoId = document.getElementById('recFuturoPagadorId');
  if (!busca || !campoId) return;
  const nome = busca.value.trim().toLowerCase();
  const encontrado = (fornecedoresFinanceiroCache || []).find(f =>
    (f.nome || '').toLowerCase() === nome
  );
  campoId.value = encontrado?.id || '';
}

function preencherSelectsRecFuturo() {
  const selForma = document.getElementById('recFuturoFormaPagamentoId');
  const selConta = document.getElementById('recFuturoContaId');
  if (selForma) {
    selForma.innerHTML = '<option value="">Selecione a forma</option>' +
      (formasPagamentoFinanceiroCache || []).filter(f => f.ativo !== false).map(f =>
        `<option value="${f.id}">${escaparHtmlBasico(f.nome)}</option>`
      ).join('');
  }
  if (selConta) {
    selConta.innerHTML = '<option value="">Selecione a conta</option>' +
      (contasFinanceirasCache || []).map(c =>
        `<option value="${c.id}">${escaparHtmlBasico(c.nome)}</option>`
      ).join('');
  }
}

async function salvarRecFuturo() {
  atualizarPagadorRecFuturo();
  const pagadorId = String(document.getElementById('recFuturoPagadorId')?.value || '').trim();
  const formaPagamentoId = String(document.getElementById('recFuturoFormaPagamentoId')?.value || '').trim();
  const contaId = String(document.getElementById('recFuturoContaId')?.value || '').trim();
  const valorTexto = String(document.getElementById('recFuturoValor')?.value || '').trim();
  const dataPrevista = String(document.getElementById('recFuturoDataPrevista')?.value || '').trim();
  const observacao = String(document.getElementById('recFuturoObservacao')?.value || '').trim();
  const qtdTexto = String(document.getElementById('recFuturoQtdParcelas')?.value || '1').trim();
  const intervaloDiasTexto = String(document.getElementById('recFuturoIntervaloDias')?.value || '').trim();
  const qtd = Math.max(1, Number.parseInt(qtdTexto, 10) || 1);
  const intervaloDias = intervaloDiasTexto ? Number.parseInt(intervaloDiasTexto, 10) : null;
  const valor = lerValorMonetarioFinanceiro(valorTexto);

  if (!pagadorId) { setMsg('msgRecFuturo', 'Selecione um pagador v?lido.', 'err'); return; }
  if (!formaPagamentoId) { setMsg('msgRecFuturo', 'Selecione uma forma de pagamento.', 'err'); return; }
  if (!contaId) { setMsg('msgRecFuturo', 'Selecione a conta financeira prevista.', 'err'); return; }
  if (!dataPrevista) { setMsg('msgRecFuturo', 'Informe a 1? data prevista.', 'err'); return; }
  if (!Number.isFinite(valor) || valor <= 0) { setMsg('msgRecFuturo', 'Informe um valor v?lido.', 'err'); return; }
  if (qtd > 1 && (!intervaloDias || intervaloDias < 1)) { setMsg('msgRecFuturo', 'Informe o intervalo em dias para m?ltiplas repeti·es.', 'err'); return; }

  let empresaId = obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null;
  let lojaId = obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null;
  if (!lojaId || !empresaId) {
    try {
      const t = await resolverTenantFornecedorFinanceiro();
      lojaId = lojaId || t.loja_id;
      empresaId = empresaId || t.empresa_id;
    } catch (eTenant) {
      setMsg('msgRecFuturo', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
      return;
    }
  }
  const criadoPorNome = usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Usuário';

  const payloadBase = {
    pagador_id: pagadorId,
    forma_pagamento_id: formaPagamentoId,
    conta_financeira_id: contaId,
    valor: Number(valor.toFixed(2)),
    observacao: observacao || null,
    intervalo_dias: intervaloDias,
    qtd_recorrencias: qtd,
    empresa_id: empresaId,
    loja_id: lojaId,
    criado_por_nome: criadoPorNome,
  };

  try {
    const editando = !!recFuturoEmEdicaoId;
    if (editando) {
      const { error } = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros').update({ ...payloadBase, data_prevista: dataPrevista }).eq('id', recFuturoEmEdicaoId)
      );
      if (error) throw error;
      setMsg('msgRecFuturo', 'Recebimento atualizado.', 'ok');
    } else {
      const linhas = Array.from({ length: qtd }, (_, i) => ({
        ...payloadBase,
        data_prevista: adicionarDiasDataISOFinanceiro(dataPrevista, i * (intervaloDias || 0)),
        numero_recorrencia: i + 1,
      }));
      const { error } = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros').insert(linhas)
      );
      if (error) throw error;
      setMsg('msgRecFuturo', qtd > 1
        ? `${qtd} recebimentos lançados (${intervaloDias} dias de intervalo).`
        : 'Recebimento futuro lançado.', 'ok');
    }
    cancelarEdicaoRecFuturo();
    await carregarRecFuturos();
  } catch(e) {
    setMsg('msgRecFuturo', 'Erro ao salvar: ' + (mensagemErroSupabase(e, e?.message || 'erro desconhecido')), 'err');
  }
}

function cancelarEdicaoRecFuturo() {
  recFuturoEmEdicaoId = null;
  fecharModalConfirmarRecFuturo();
}

async function carregarRecFuturos() {
  const lista = document.getElementById('listaRecFuturos');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';

  const soAbertos = document.getElementById('filtroRecFuturoSoAbertos')?.checked !== false;
  const busca = textoFinanceiroNormalizado(document.getElementById('filtroRecFuturoBusca')?.value || '');
  const inicio = String(document.getElementById('filtroRecFuturoInicio')?.value || '').trim();
  const fim = String(document.getElementById('filtroRecFuturoFim')?.value || '').trim();
  const usuarioFiltro = String(document.getElementById('filtroRecFuturoUsuario')?.value || '').trim();
  const dataTipo = String(document.querySelector('#financeiro_recebiveis .recebiveis-provisionados-card .date-filter-criterion')?.value || 'especial:prevista').replace('especial:', '');

  try {
    const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    let query = sb.from('recebiveis_futuros')
      .select('id, pagador_id, forma_pagamento_id, conta_financeira_id, valor, data_prevista, confirmado_em, confirmado_por_nome, valor_confirmado, conta_financeira_confirmada_id, observacao, criado_por_nome, created_at, intervalo_dias, qtd_recorrencias, numero_recorrencia, loja_id, empresa_id, fornecedores(nome), formas_pagamento(nome), contas_financeiras(nome)')
      .eq('ativo', true)
      .order('data_prevista', { ascending: true });
    if (soAbertos) query = query.is('confirmado_em', null);
    if (lojaSessao) query = query.eq('loja_id', lojaSessao);

    const { data, error } = await query;
    if (error) throw error;

    const filtroUsuario = document.getElementById('filtroRecFuturoUsuario');
    if (filtroUsuario) {
      const atual = filtroUsuario.value;
      const nomes = [...new Set((data || []).map(item => String(item.criado_por_nome || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      filtroUsuario.innerHTML = '<option value="">- Quem lançou -</option>' + nomes.map(nome => `<option value="${escaparHtmlBasico(nome)}">${escaparHtmlBasico(nome)}</option>`).join('');
      filtroUsuario.value = nomes.includes(atual) ? atual : '';
    }

    recFuturosCache = (data || []).filter(item => {
      // Isolamento por loja em mem?ria (refor?o): nunca mostra recebimento de outra loja.
      if (lojaSessao && String(item.loja_id || '').trim() !== lojaSessao) return false;
      const pagador = textoFinanceiroNormalizado(item.fornecedores?.nome || '');
      if (busca && !pagador.includes(busca)) return false;
      if (usuarioFiltro && String(item.criado_por_nome || '').trim() !== usuarioFiltro) return false;
      const datas = { prevista:item.data_prevista, cadastro:item.created_at, recebimento:item.confirmado_em };
      const dataReferencia = String(datas[dataTipo] || '').slice(0, 10);
      if (inicio && (!dataReferencia || dataReferencia < inicio)) return false;
      if (fim && (!dataReferencia || dataReferencia > fim)) return false;
      return true;
    });

    if (!recFuturosCache.length) {
      recFuturosVisiveisIds = [];
      recFuturosSelecionadosIds.clear();
      atualizarResumoSelecaoRecFuturos();
      lista.innerHTML = '<div class="empty">Nenhum recebimento provisionado encontrado.</div>';
      return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const itensPendentesFut = recFuturosCache.filter(i => !i.confirmado_em);
    const itensConfirmadosFut = recFuturosCache.filter(i => !!i.confirmado_em);
    const totalPendentesFut = itensPendentesFut.reduce((s, i) => s + Number(i.valor || 0), 0);
    const totalConfirmadosFut = itensConfirmadosFut.reduce((s, i) => s + Number(i.valor_confirmado ?? i.valor ?? 0), 0);
    const resumoFuturosHtml = `
      <div class="rec-summary">
        <div class="item-info">
          <div class="item-nome">Total previsto pendente: ${formatarMoedaBRFinanceiro(totalPendentesFut)} <span style="font-weight:400;color:var(--text-muted);">(${itensPendentesFut.length} lançamento${itensPendentesFut.length === 1 ? '' : 's'})</span></div>
          ${itensConfirmadosFut.length ? `<div class="item-detalhe">Confirmados no filtro: ${formatarMoedaBRFinanceiro(totalConfirmadosFut)} (${itensConfirmadosFut.length})</div>` : ''}
        </div>
      </div>`;
    lista.innerHTML = '<div class="rec-grid">' + resumoFuturosHtml + recFuturosCache.map(item => {
      const confirmado = !!item.confirmado_em;
      const dp = String(item.data_prevista || '').slice(0, 10);
      const atrasado = !confirmado && dp && dp < hoje;
      const tagStatus = confirmado
        ? `<span class="tag tag-green">✓ Confirmado</span>`
        : atrasado
          ? `<span class="tag tag-red">Atrasado</span>`
          : `<span class="tag tag-amber">Pendente</span>`;
      return `
        <article class="rec-card rec-card-future">
          <div class="rec-card-main">
            <label class="rec-card-title rec-check">
              <input class="checkbox-rec-futuro-financeiro" data-rec-futuro-id="${item.id}" type="checkbox" ${recFuturosSelecionadosIds.has(String(item.id)) ? 'checked' : ''} onchange="atualizarSelecaoRecFuturo('${item.id}', this.checked)">
              <span>${escaparHtmlBasico(item.fornecedores?.nome || 'Pagador não encontrado')}</span>
            </label>
            <div class="item-detalhe">
              Forma: ${escaparHtmlBasico(item.formas_pagamento?.nome || '-')} ·
              Conta: ${escaparHtmlBasico(item.contas_financeiras?.nome || '-')}
            </div>
            <div class="item-detalhe">
              Data prevista: <strong>${formatarDataBRFinanceiro(dp)}</strong>
              ${item.observacao ? ` ? ${escaparHtmlBasico(item.observacao)}` : ''}
              ? Provisionado por: ${escaparHtmlBasico(item.criado_por_nome || '-')}
            </div>
            ${confirmado ? `<div class="item-detalhe" style="color:var(--green);">
              Confirmado em ${formatarDataBRFinanceiro(String(item.confirmado_em || '').slice(0,10))}
              ? Valor: ${formatarMoedaBRFinanceiro(item.valor_confirmado || 0)}
              ? Por: ${escaparHtmlBasico(item.confirmado_por_nome || '-')}
            </div>` : ''}
          </div>
          <div class="rec-futuro-destaque">
            <div class="rec-futuro-destaque-grupo">
              <span class="rec-futuro-destaque-label" style="color:#fca5a5;">Data prevista</span>
              <span class="rec-futuro-destaque-data">${formatarDataBRFinanceiro(dp)}</span>
            </div>
            <div class="rec-futuro-destaque-grupo">
              <span class="rec-futuro-destaque-label" style="color:#fde047;">Valor</span>
              <span class="rec-futuro-destaque-valor">${formatarMoedaBRFinanceiro(item.valor || 0)}</span>
            </div>
          </div>
          <div class="rec-card-actions">
            ${tagStatus}
            ${!confirmado ? `<button class="btn btn-green btn-sm" onclick="abrirModalConfirmarRecFuturo('${item.id}')">Confirmar recebimento</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="editarRecFuturo('${item.id}')">Editar</button>
            <button class="btn btn-red btn-sm" onclick="excluirRecFuturo('${item.id}')">Excluir</button>
          </div>
        </article>`;
    }).join('') + '</div>';
    // Atualizar IDs vis?veis e mostrar/ocultar controles de sele·o
    recFuturosVisiveisIds = Array.from(document.querySelectorAll('.checkbox-rec-futuro-financeiro')).map(el => String(el.getAttribute('data-rec-futuro-id') || ''));
    const idsVisiveis = new Set(recFuturosVisiveisIds);
    recFuturosSelecionadosIds.forEach(id => {
      if (!idsVisiveis.has(String(id))) recFuturosSelecionadosIds.delete(String(id));
    });
    atualizarResumoSelecaoRecFuturos();
  } catch(e) {
    lista.innerHTML = `<div class="empty">Erro ao carregar: ${mensagemErroSupabase(e, e?.message || '')}</div>`;
  }
}

function editarRecFuturo(id) {
  // Form de lançamento removido ? editar redireciona para confirma·o de recebimento
  abrirModalConfirmarRecFuturo(id);
}

function configurarCampoValorRecFuturo(valor = 0) {
  // Campos do form de lançamento futuro removidos ? fun·o mantida por compatibilidade
}

async function excluirRecFuturo(id) {
  if (!confirm('Excluir este provisionamento?')) return;
  try {
    const { error } = await executarSemFiltroLojaTemporario(() => sb.from('recebiveis_futuros').delete().eq('id', id));
    if (error) throw error;
    await carregarRecFuturos();
  } catch(e) { alert('Erro ao excluir: ' + (e?.message || '')); }
}

function abrirModalConfirmarRecFuturo(id) {
  const item = recFuturosCache.find(i => String(i.id) === String(id));
  if (!item) return;
  const modal = document.getElementById('modalConfirmarRecFuturo');
  if (!modal) return;
  document.getElementById('modalConfirmarRecFuturoId').value = id;
  // Pr?-preencher com valores previstos
  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById('modalConfirmarData').value = hoje;
  document.getElementById('modalConfirmarValor').value = item.valor > 0 ? formatarMoedaBRFinanceiro(item.valor) : '';
  // Preencher select de contas
  const selConta = document.getElementById('modalConfirmarConta');
  if (selConta) {
    selConta.innerHTML = '<option value="">Selecione a conta</option>' +
      (contasFinanceirasCache || []).map(c =>
        `<option value="${c.id}" ${String(c.id) === String(item.conta_financeira_id) ? 'selected' : ''}>${escaparHtmlBasico(c.nome)}</option>`
      ).join('');
  }
  document.getElementById('modalConfirmarObs').value = '';
  setMsg('msgModalConfirmarRecFuturo', '', '');
  modal.style.display = 'flex';
}

function fecharModalConfirmarRecFuturo() {
  const modal = document.getElementById('modalConfirmarRecFuturo');
  if (modal) modal.style.display = 'none';
}

async function confirmarRecebimentoFuturo() {
  const id = String(document.getElementById('modalConfirmarRecFuturoId')?.value || '').trim();
  const dataConfirmacao = String(document.getElementById('modalConfirmarData')?.value || '').trim();
  const valorTexto = String(document.getElementById('modalConfirmarValor')?.value || '').trim();
  const contaId = String(document.getElementById('modalConfirmarConta')?.value || '').trim();
  const obs = String(document.getElementById('modalConfirmarObs')?.value || '').trim();
  const valor = lerValorMonetarioFinanceiro(valorTexto);

  if (!dataConfirmacao) { setMsg('msgModalConfirmarRecFuturo', 'Informe a data do recebimento.', 'err'); return; }
  if (!contaId) { setMsg('msgModalConfirmarRecFuturo', 'Selecione a conta financeira.', 'err'); return; }
  if (!Number.isFinite(valor) || valor <= 0) { setMsg('msgModalConfirmarRecFuturo', 'Informe um valor v?lido.', 'err'); return; }

  const item = recFuturosCache.find(i => String(i.id) === String(id));
  if (!item) { setMsg('msgModalConfirmarRecFuturo', 'Recebimento n?o encontrado. Atualize a lista e tente novamente.', 'err'); return; }

  const confirmadoPorNome = usuarioSistemaLogado?.nome || usuarioSistemaLogado?.username || 'Usuário';
  const valorConfirmado = Number(valor.toFixed(2));
  // Usa a data informada no modal (meio-dia para evitar problemas de fuso hor?rio)
  const confirmadoEmISO = new Date(`${dataConfirmacao}T12:00:00`).toISOString();

  // Resolver loja/empresa para o novo receb?vel
  const contaSelecionada = (contasFinanceirasCache || []).find(c => String(c.id) === String(contaId)) || null;
  const empresaId = contaSelecionada?.empresa_id || item.empresa_id || obterEmpresaIdSessao?.() || usuarioSistemaLogado?.empresa_id || null;
  const lojaId = contaSelecionada?.loja_id || item.loja_id || obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || null;

  try {
    // 1. Marcar o recebimento futuro como confirmado (tabela recebiveis_futuros)
    const payloadConfirmacao = {
      confirmado_em: confirmadoEmISO,
      confirmado_por_nome: confirmadoPorNome,
      valor_confirmado: valorConfirmado,
      conta_financeira_confirmada_id: contaId,
    };
    let { error: erroUpdate } = await executarSemFiltroLojaTemporario(() =>
      sb.from('recebiveis_futuros').update(payloadConfirmacao).eq('id', id)
    );
    // Fallback para bancos sem as colunas de auditoria da confirma·o
    if (erroUpdate && isMissingColumnError(erroUpdate)) {
      const tentativaMinima = await executarSemFiltroLojaTemporario(() =>
        sb.from('recebiveis_futuros').update({ confirmado_em: confirmadoEmISO }).eq('id', id)
      );
      erroUpdate = tentativaMinima.error;
    }
    if (erroUpdate) throw erroUpdate;

    // 2. Criar o receb?vel real para aparecer na tela de Recebíveis
    const pagadorNome = item?.fornecedores?.nome || 'pagador';
    const formaNome = item?.formas_pagamento?.nome || 'forma de pagamento';
    const payloadRecebivelBase = {
      pagador_id: item.pagador_id,
      forma_pagamento_id: item.forma_pagamento_id,
      conta_financeira_id: contaId,
      valor: valorConfirmado,
      empresa_id: empresaId,
      loja_id: lojaId,
    };
    const payloadRecebivel = {
      ...payloadRecebivelBase,
      criado_por_id: obterIdAdminAtual?.() || usuarioSistemaLogado?.id || null,
      criado_por_nome: confirmadoPorNome,
    };
    const inserirRecebivel = (dados) => executarSemFiltroLojaTemporario(() =>
      sb.from('recebiveis').insert([dados]).select('id').maybeSingle()
    );
    let { data: recebivelSalvo, error: erroRecebivel } = await inserirRecebivel(payloadRecebivel);
    if (erroRecebivel && isMissingColumnError(erroRecebivel)) {
      ({ data: recebivelSalvo, error: erroRecebivel } = await inserirRecebivel(payloadRecebivelBase));
    }
    if (erroRecebivel) {
      // Desfaz a confirma·o para n?o deixar o registro pela metade
      try {
        await executarSemFiltroLojaTemporario(() =>
          sb.from('recebiveis_futuros').update({
            confirmado_em: null,
            confirmado_por_nome: null,
            valor_confirmado: null,
            conta_financeira_confirmada_id: null,
          }).eq('id', id)
        );
      } catch (eRollback) {
        console.warn('Falha ao desfazer confirma·o do recebimento futuro:', eRollback);
      }
      throw erroRecebivel;
    }
    const recebivelId = recebivelSalvo?.id || null;

    // 3. Somar no saldo da conta (apenas se o banco n?o gerencia o saldo via trigger,
    //    para n?o somar em duplicidade ? mesma regra do cadastro manual de receb?veis)
    const saldoGerenciadoNoBanco = await recebiveisSaldoGerenciadoNoBanco();
    if (!saldoGerenciadoNoBanco) {
      const descricao = `Recebível futuro confirmado: ${pagadorNome} via ${formaNome}${obs ? ' - ' + obs : ''}`;
      const { error: erroMov } = await registrarMovimentacaoContaFinanceira({
        contaFinanceiraId: contaId,
        recebivelId,
        tipo: 'entrada',
        valor: valorConfirmado,
        descricao,
      });
      if (erroMov) {
        setMsg('msgModalConfirmarRecFuturo', 'Recebimento confirmado, mas não foi possível lançar a entrada na conta: ' + mensagemErroSupabase(erroMov, erroMov?.message || 'erro desconhecido'), 'err');
        return;
      }
    }

    fecharModalConfirmarRecFuturo();
    await carregarRecFuturos();
    await carregarContasFinanceiras({ render: false, silencioso: true });
    if (document.getElementById('financeiro_recebiveis')?.classList.contains('ativa')) {
      recebiveisFinanceiroListaVisivel = true;
      await carregarRecebiveisFinanceiro();
    }
    if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) await carregarCofreFinanceiro();
    if (document.getElementById('relatorio_recebimentos')?.classList.contains('ativa')) await carregarRelatorioRecebimentos();
  } catch(e) {
    setMsg('msgModalConfirmarRecFuturo', 'Erro ao confirmar: ' + (mensagemErroSupabase(e, e?.message || 'erro desconhecido')), 'err');
  }
}

// ···? SELEÃ‡ÃƒO MÃšLTIPLA DE RECEBÍVEIS ···?
function atualizarSelecaoRecebivelFinanceiro(id, marcado) {
  const chave = String(id || '');
  if (!chave) return;
  if (marcado) recebiveisFinanceiroSelecionadosIds.add(chave);
  else recebiveisFinanceiroSelecionadosIds.delete(chave);
  atualizarResumoSelecaoRecebiveisFinanceiro();
}

function toggleSelecionarTodosRecebiveisFinanceiro() {
  if (!recebiveisFinanceiroVisiveisIds.length) return;
  const todosSelecionados = recebiveisFinanceiroVisiveisIds.every(id => recebiveisFinanceiroSelecionadosIds.has(String(id)));
  recebiveisFinanceiroVisiveisIds.forEach(id => {
    const chave = String(id);
    if (todosSelecionados) recebiveisFinanceiroSelecionadosIds.delete(chave);
    else recebiveisFinanceiroSelecionadosIds.add(chave);
  });
  document.querySelectorAll('.checkbox-recebivel-financeiro').forEach(input => {
    const id = input.getAttribute('data-recebivel-id');
    input.checked = recebiveisFinanceiroSelecionadosIds.has(String(id));
  });
  atualizarResumoSelecaoRecebiveisFinanceiro();
}

function atualizarResumoSelecaoRecebiveisFinanceiro() {
  const totalVisiveis = recebiveisFinanceiroVisiveisIds.length;
  const selecionadosVisiveis = recebiveisFinanceiroVisiveisIds.filter(id => recebiveisFinanceiroSelecionadosIds.has(String(id)));
  const qtdSelecionados = selecionadosVisiveis.length;
  const btnSelecionar = document.getElementById('btnSelecionarTodosRecebiveisFinanceiro');
  const btnExcluir = document.getElementById('btnExcluirRecebiveisSelecionadosFinanceiro');
  const resumo = document.getElementById('resumoSelecaoRecebiveisFinanceiro');
  const acoes = document.getElementById('acoesSelecaoRecebiveisFinanceiro');
  if (acoes) acoes.style.display = qtdSelecionados > 0 ? 'flex' : 'none';
  if (btnSelecionar) {
    btnSelecionar.textContent = totalVisiveis && qtdSelecionados === totalVisiveis ? 'Desmarcar todos' : 'Marcar todos';
    btnSelecionar.disabled = !totalVisiveis;
  }
  if (btnExcluir) btnExcluir.disabled = !qtdSelecionados;
  if (resumo) {
    resumo.textContent = qtdSelecionados
      ? `${qtdSelecionados} receb?vel(is) selecionado(s) de ${totalVisiveis}.`
      : (totalVisiveis ? `${totalVisiveis} receb?vel(is) no filtro.` : 'Nenhum receb?vel selecionado.');
  }
}

async function excluirRecebiveisSelecionadosFinanceiro() {
  const idsSelecionados = recebiveisFinanceiroVisiveisIds
    .filter(id => recebiveisFinanceiroSelecionadosIds.has(String(id)))
    .map(String);

  if (!idsSelecionados.length) {
    setMsg('msgRecebivelFinanceiro', 'Selecione pelo menos um receb?vel para excluir.', 'err');
    return;
  }

  const msg = `Deseja excluir ${idsSelecionados.length} recebível(is)? Esta ação não pode ser desfeita.`;
  if (!confirm(msg)) return;

  const btnExcluir = document.getElementById('btnExcluirRecebiveisSelecionadosFinanceiro');
  const btnSelecionar = document.getElementById('btnSelecionarTodosRecebiveisFinanceiro');
  const textoOriginal = btnExcluir?.textContent || 'Excluir selecionados';
  if (btnExcluir) {
    btnExcluir.disabled = true;
    btnExcluir.textContent = 'Excluindo...';
  }
  if (btnSelecionar) btnSelecionar.disabled = true;

  let excluidos = 0;
  for (const id of idsSelecionados) {
    const ok = await excluirRecebivelFinanceiroInterno(id, { atualizarTela: false });
    if (ok) excluidos += 1;
  }

  recebiveisFinanceiroListaVisivel = true;
  await carregarRecebiveisFinanceiro();
  if (document.getElementById('financeiro_cofre')?.classList.contains('ativa')) {
    await carregarCofreFinanceiro();
  }
  setMsg('msgRecebivelFinanceiro', `${excluidos} recebível(is) excluído(s).`, excluidos ? 'ok' : 'err');

  if (btnExcluir) btnExcluir.textContent = textoOriginal;
  atualizarResumoSelecaoRecebiveisFinanceiro();
}

// ···? SELEÃ‡ÃƒO MÃšLTIPLA DE REC FUTUROS ···?
function atualizarSelecaoRecFuturo(id, marcado) {
  const chave = String(id || '');
  if (!chave) return;
  if (marcado) recFuturosSelecionadosIds.add(chave);
  else recFuturosSelecionadosIds.delete(chave);
  atualizarResumoSelecaoRecFuturos();
}

function toggleSelecionarTodosRecFuturos() {
  if (!recFuturosVisiveisIds.length) return;
  const todosSelecionados = recFuturosVisiveisIds.every(id => recFuturosSelecionadosIds.has(String(id)));
  recFuturosVisiveisIds.forEach(id => {
    const chave = String(id);
    if (todosSelecionados) recFuturosSelecionadosIds.delete(chave);
    else recFuturosSelecionadosIds.add(chave);
  });
  document.querySelectorAll('.checkbox-rec-futuro-financeiro').forEach(input => {
    const id = input.getAttribute('data-rec-futuro-id');
    input.checked = recFuturosSelecionadosIds.has(String(id));
  });
  atualizarResumoSelecaoRecFuturos();
}

function atualizarResumoSelecaoRecFuturos() {
  const totalVisiveis = recFuturosVisiveisIds.length;
  const selecionadosVisiveis = recFuturosVisiveisIds.filter(id => recFuturosSelecionadosIds.has(String(id)));
  const qtdSelecionados = selecionadosVisiveis.length;
  const btnSelecionar = document.getElementById('btnSelecionarTodosRecFuturos');
  const btnExcluir = document.getElementById('btnExcluirRecFuturosSelecionados');
  const resumo = document.getElementById('resumoSelecaoRecFuturos');
  const acoes = document.getElementById('acoesSelecaoRecFuturos');
  const valorSelecionado = (recFuturosCache || [])
    .filter(item => selecionadosVisiveis.includes(String(item.id)))
    .reduce((soma, item) => soma + Number(item.valor || 0), 0);
  if (acoes) acoes.style.display = totalVisiveis > 0 ? 'flex' : 'none';
  if (btnSelecionar) {
    btnSelecionar.textContent = totalVisiveis && qtdSelecionados === totalVisiveis
      ? `Desmarcar todas (${totalVisiveis})`
      : `Selecionar todas (${totalVisiveis})`;
    btnSelecionar.disabled = !totalVisiveis;
  }
  if (btnExcluir) {
    btnExcluir.disabled = !qtdSelecionados;
    btnExcluir.style.display = qtdSelecionados ? '' : 'none';
  }
  if (resumo) {
    resumo.textContent = qtdSelecionados
      ? `${qtdSelecionados} selecionada(s): ${formatarMoedaBRFinanceiro(valorSelecionado)}`
      : (totalVisiveis ? `${totalVisiveis} recebimento(s) no filtro.` : 'Nenhum recebimento selecionado.');
  }
}

async function excluirRecFuturosSelecionados() {
  const idsSelecionados = recFuturosVisiveisIds
    .filter(id => recFuturosSelecionadosIds.has(String(id)))
    .map(String);

  if (!idsSelecionados.length) {
    setMsg('msgRecFuturosLista', 'Selecione pelo menos um recebimento para excluir.', 'err');
    return;
  }

  const valorSelecionado = (recFuturosCache || [])
    .filter(item => idsSelecionados.includes(String(item.id)))
    .reduce((soma, item) => soma + Number(item.valor || 0), 0);
  const msg = `Deseja excluir ${idsSelecionados.length} recebimento(s), no total de ${formatarMoedaBRFinanceiro(valorSelecionado)}? Esta ação não pode ser desfeita.`;
  if (!confirm(msg)) return;

  const btnExcluir = document.getElementById('btnExcluirRecFuturosSelecionados');
  const btnSelecionar = document.getElementById('btnSelecionarTodosRecFuturos');
  const textoOriginal = btnExcluir?.textContent || 'Excluir selecionados';
  if (btnExcluir) {
    btnExcluir.disabled = true;
    btnExcluir.textContent = 'Excluindo...';
  }
  if (btnSelecionar) btnSelecionar.disabled = true;

  let excluidos = 0;
  for (const id of idsSelecionados) {
    try {
      const { error } = await executarSemFiltroLojaTemporario(() => sb.from('recebiveis_futuros').delete().eq('id', id));
      if (!error) {
        excluidos++;
        recFuturosSelecionadosIds.delete(String(id));
      }
    } catch (e) { }
  }

  await carregarRecFuturos();
  const falhas = idsSelecionados.length - excluidos;
  setMsg(
    'msgRecFuturosLista',
    falhas
      ? `${excluidos} recebimento(s) exclu?do(s); ${falhas} n?o puderam ser exclu?dos.`
      : `${excluidos} recebimento(s) exclu?do(s) com sucesso.`,
    falhas ? 'err' : 'ok'
  );

  if (btnExcluir) btnExcluir.textContent = textoOriginal;
  atualizarResumoSelecaoRecFuturos();
}

// ·································
function exibirResultadoQuitacao(totalPendente = 0, saldoDisponivel = 0, descricao = '') {
  const label = document.getElementById('rfFaltaQuitarLabel');
  const valor = document.getElementById('rfFaltaQuitar');
  const desc = document.getElementById('rfFaltaQuitarDesc');
  if (!valor) return;

  const diferenca = Number(saldoDisponivel || 0) - Number(totalPendente || 0);
  const margemCentavos = 0.005;
  if (diferenca > margemCentavos) {
    if (label) label.textContent = 'Sobra após quitar (R$)';
    valor.textContent = formatarMoedaBRFinanceiro(diferenca);
  } else if (diferenca < -margemCentavos) {
    if (label) label.textContent = 'Falta para quitar (R$)';
    valor.textContent = formatarMoedaBRFinanceiro(Math.abs(diferenca));
  } else {
    if (label) label.textContent = 'Saldo após quitar (R$)';
    valor.textContent = formatarMoedaBRFinanceiro(0);
  }
  if (desc) desc.textContent = descricao || 'Saldo dispon?vel menos total pendente';
}

async function recalcularFaltaQuitar() {
  const seqCalculo = (window.__faltaQuitarSeq = (window.__faltaQuitarSeq || 0) + 1);
  const chk = document.getElementById('contasSomarFuturosAcoes');
  const elFaltaQuitar = document.getElementById('rfFaltaQuitar');
  if (!elFaltaQuitar) return;

  const { totalPendente = 0, saldoTotalContas = 0 } = window._contasFaltaCache || {};
  const somarFuturos = chk?.checked === true;

  if (!somarFuturos) {
    exibirResultadoQuitacao(totalPendente, saldoTotalContas, 'Saldo do cofre menos dívida no período');
    return;
  }

  // Buscar recebimentos futuros pendentes ? restritos ?s lojas marcadas no
  // filtro do pr?prio relat?rio (mesmo mecanismo do Cofre).
  try {
    const lojasPermitidasIds = obterIdsLojasSelecionadasFiltroFinanceiroPage('filtroLojasRelatorioFinanceiro');
    if (!Array.isArray(lojasPermitidasIds) || !lojasPermitidasIds.length) {
      exibirResultadoQuitacao(totalPendente, saldoTotalContas, 'N?o foi poss?vel identificar a loja para somar os futuros');
      return;
    }
    // Mesmo recorte de datas do relat?rio: futuros previstos dentro do período filtrado.
    const futInicio = String(document.getElementById('filtroRelFinanceiroDataInicio')?.value || '').trim();
    const futFim = String(document.getElementById('filtroRelFinanceiroDataFim')?.value || '').trim();
    const { data: futuros, error: erroFuturos } = await executarSemFiltrosTenantTemporario(() => {
      let queryFuturos = sb.from('recebiveis_futuros')
        .select('valor, loja_id, data_prevista')
        .eq('ativo', true)
        .is('confirmado_em', null);
      if (futInicio) queryFuturos = queryFuturos.gte('data_prevista', futInicio);
      if (futFim) queryFuturos = queryFuturos.lte('data_prevista', futFim);
      return aplicarFiltroLojasFinanceirasPermitidas(queryFuturos, lojasPermitidasIds);
    });
    if (seqCalculo !== window.__faltaQuitarSeq || chk?.checked !== true) return;
    if (erroFuturos) {
      console.warn('Erro ao buscar recebimentos futuros para "Falta para quitar":', erroFuturos);
      exibirResultadoQuitacao(totalPendente, saldoTotalContas, 'N?o foi poss?vel somar os recebimentos futuros');
      return;
    }
    const idsPermitidosFut = new Set(lojasPermitidasIds.map(id => String(id)));
    const totalFuturos = (futuros || [])
      .filter(f => idsPermitidosFut.has(String(f.loja_id || '')))
      .filter(f => {
        const dp = String(f.data_prevista || '').slice(0, 10);
        if (futInicio && dp < futInicio) return false;
        if (futFim && dp > futFim) return false;
        return true;
      })
      .reduce((s, f) => s + Number(f.valor || 0), 0);
    const saldoComFuturos = saldoTotalContas + totalFuturos;
    exibirResultadoQuitacao(
      totalPendente,
      saldoComFuturos,
      `Cofre (${formatarMoedaBRFinanceiro(saldoTotalContas)}) + entradas no período (${formatarMoedaBRFinanceiro(totalFuturos)}) − dívida (${formatarMoedaBRFinanceiro(totalPendente)})`
    );
  } catch(e) {
    console.warn('Erro ao buscar futuros:', e);
    if (seqCalculo === window.__faltaQuitarSeq) {
      exibirResultadoQuitacao(totalPendente, saldoTotalContas, 'N?o foi poss?vel somar os recebimentos futuros');
    }
  }
}


// ·································
// GRUPOS DE FORNECEDOR
// ·································
let grupoFornecedorEmEdicaoId = null;
let gruposFornecedorCache = [];


// ·································
// IMPORTADOR DE FATURA PDF
// ·································
let _faturaItensExtraidos = [];
// Controla se a pergunta "replicar fornecedor" já foi feita nesta importa·o
let _faturaPerguntouReplicarForn = false;
// Metadados da importa·o atual (para o log de auditoria)
let _faturaBancoDetectado = null;
let _faturaArquivoNome = null;

function abrirImportadorFatura() {
  _faturaPerguntouReplicarForn = false;
  const modal = document.getElementById('modalImportarFatura');
  if (modal) { modal.style.display = 'flex'; }
  faturaVoltarUpload();
}

function fecharImportadorFatura() {
  const modal = document.getElementById('modalImportarFatura');
  if (modal) modal.style.display = 'none';
  _faturaItensExtraidos = [];
}

function faturaHandleDrop(e, tipo) {
  e.preventDefault();
  document.getElementById('ofxDropZone').style.borderColor = 'var(--border-mid)';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
    faturaHandleFile(file, 'ofx');
  } else {
    setMsg('msgImportarFatura', 'Selecione um arquivo .ofx ou .qfx exportado do seu banco.', 'err');
  }
}

function faturaVoltarUpload() {
  ['faturaStep2','faturaStep3','faturaFooter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; }
  });
  document.getElementById('faturaStep1').style.display = '';
  const ofxInput = document.getElementById('ofxFileInput');
  if (ofxInput) ofxInput.value = '';
  setMsg('msgImportarFatura', '', '');
  _faturaItensExtraidos = [];
}

function faturaSetProgress(pct, msg) {
  const bar = document.getElementById('faturaProgressBar');
  const txt = document.getElementById('faturaProgressMsg');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = msg;
}

async function faturaHandleFile(file, tipo = 'ofx') {
  if (!file) return;
  setMsg('msgImportarFatura', '', '');
  // Apenas OFX ? suportado
  await faturaProcessarOFX(file);
}

// · Aprendizado de categoria por estabelecimento ·········?
// Normaliza a descri·o do lançamento em uma "chave" est?vel de estabelecimento.
// Ex.: "DL*Google Google" -> "google"; "Mc Donald's Itapema" -> "mcdonalds itapema"
function faturaChaveEstabelecimento(descricao) {
  let s = String(descricao || '').toLowerCase();
  s = s.replace(/[*]/g, ' ');                    // remove asteriscos de adquirente
  s = s.replace(/\s+\d{1,2}\/\d{1,2}\s*$/, '');  // remove sufixo de parcela "02/06"
  s = s.replace(/[^a-z0-9\s]/g, ' ');            // s? letras/n?meros
  s = s.replace(/\s+/g, ' ').trim();
  // pega as primeiras palavras significativas (at? 3) para casar varia·es
  const palavras = s.split(' ').filter(p => p.length >= 3).slice(0, 3);
  return palavras.join(' ') || s;
}

// Mapa de mem?ria (chave estabelecimento -> categoria_id), montado por importa·o
let _faturaMemoriaCategorias = {};

// Constr?i o mapa de aprendizado combinando: (1) hist?rico de contas a pagar
// j? cadastradas e (2) a tabela dedicada de mem?ria (que tem prioridade).
async function faturaConstruirMemoriaCategorias() {
  const mapa = {};

  // (1) Hist?rico do banco: agrupa por chave de estabelecimento e escolhe a categoria mais frequente.
  try {
    const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
    let query = sb.from('contasapagar')
      .select('observacao, categoria_id, fornecedores(nome)')
      .not('categoria_id', 'is', null)
      .is('excluido_em', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (lojaId) query = query.eq('loja_id', lojaId);
    const { data } = await query;
    const contagem = {}; // chave -> { categoria_id: qtd }
    (data || []).forEach(row => {
      const baseNome = row?.fornecedores?.nome || row?.observacao || '';
      const chave = faturaChaveEstabelecimento(baseNome);
      if (!chave || !row.categoria_id) return;
      contagem[chave] = contagem[chave] || {};
      contagem[chave][row.categoria_id] = (contagem[chave][row.categoria_id] || 0) + 1;
    });
    Object.entries(contagem).forEach(([chave, cats]) => {
      const melhor = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
      if (melhor) mapa[chave] = melhor[0];
    });
  } catch (e) {
    console.warn('N?o foi poss?vel ler hist?rico para aprendizado de categoria:', e);
  }

  // (2) Tabela dedicada de mem?ria (prioridade sobre o hist?rico).
  try {
    const { data } = await sb.from('fatura_categoria_memoria')
      .select('chave_estabelecimento, categoria_id');
    (data || []).forEach(row => {
      if (row.chave_estabelecimento && row.categoria_id) {
        mapa[row.chave_estabelecimento] = row.categoria_id;
      }
    });
  } catch (e) {
    console.warn('Memória de categorias indisponível (rode o SQL de importação):', e?.message || e);
    console.warn('Mem?ria de categorias indispon?vel (rode o SQL de importa·o):', e?.message || e);
  }

  // valida que as categorias ainda existem no cache atual
  const idsValidos = new Set((categoriasCompraCache || []).map(c => String(c.id)));
  Object.keys(mapa).forEach(k => { if (!idsValidos.has(String(mapa[k]))) delete mapa[k]; });

  _faturaMemoriaCategorias = mapa;
  return mapa;
}

// Salva/atualiza as escolhas de categoria desta importa·o na tabela de mem?ria,
// usando upsert por (empresa_id, loja_id, chave_estabelecimento).
async function faturaSalvarMemoriaCategorias(itens) {
  try {
    const ator = (typeof obterAtorAuditoriaAtual === 'function') ? obterAtorAuditoriaAtual() : {};
    const vistos = new Map(); // chave -> linha (deduplica dentro do mesmo lote)
    (itens || []).forEach(item => {
      if (!item.categoria_id) return;
      const chave = faturaChaveEstabelecimento(item.descricao);
      if (!chave) return;
      vistos.set(chave, {
        chave_estabelecimento: chave,
        categoria_id: item.categoria_id,
        descricao_exemplo: String(item.descricao || '').slice(0, 120),
        criado_por_id: ator?.funcionarioId || null,
        criado_por_nome: ator?.nome || usuarioSistemaLogado?.nome || 'Sistema',
        atualizado_em: new Date().toISOString(),
      });
      _faturaMemoriaCategorias[chave] = item.categoria_id;
    });
    const linhas = Array.from(vistos.values());
    if (!linhas.length) return;
    await sb.from('fatura_categoria_memoria')
      .upsert(linhas, { onConflict: 'empresa_id,loja_id,chave_estabelecimento' });
  } catch (e) {
    console.warn('Não foi possível salvar a memória de categorias:', e?.message || e);
  }
}

// Verifica quais FITIDs do arquivo OFX j? foram lançados (na loja atual).
// Retorna a lista de descri·es já existentes (para avisar o usu?rio).
async function faturaVerificarFitidsJaLancados(itens) {
  const fitids = (itens || []).map(i => i.fitid).filter(Boolean);
  if (!fitids.length) return [];
  try {
    const { data, error } = await executarSemFiltrosTenantTemporario(() => sb
      .from('contasapagar')
      .select('ofx_fitid, loja_id, observacao, fornecedores(nome)')
      .in('ofx_fitid', fitids)
      .is('excluido_em', null));
    if (error) {
      console.warn('Verificação de duplicidade indisponível (rode o SQL ofx_fitid):', error?.message || error);
      console.warn('Verifica·o de duplicidade indispon?vel (rode o SQL ofx_fitid):', error?.message || error);
      return [];
    }
    const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
    const existentes = (data || []).filter(row => !lojaSessao || String(row.loja_id || '').trim() === lojaSessao);
    const fitidsExistentes = new Set(existentes.map(r => String(r.ofx_fitid)));
    // monta descri·es para o aviso, a partir dos itens do arquivo
    return (itens || [])
      .filter(i => i.fitid && fitidsExistentes.has(String(i.fitid)))
      .map(i => `${i.descricao} ? ${formatarMoedaBRFinanceiro(i.valor)} (${formatarDataBRFinanceiro(i.data)})`);
  } catch (e) {
    console.warn('Falha na verificação de duplicidade OFX:', e?.message || e);
    return [];
  }
}

// Reconhece uma PARCELA j? provisionada no banco para um item parcelado do OFX.
// O FITID muda a cada fatura, ent?o a trava por identificador n?o pega parcela
// gerada em importa·o anterior. O casamento aqui ? por:
//   n? da parcela + total de parcelas + valor (centavo) + fornecedor (se ambos tiverem)
//   + proximidade de data (compra ?5 dias OU vencimento ?10 dias).
function faturaEncontrarParcelaExistente(item, candidatos, fornecedorIdResolvido) {
  if (!(item && item.parcela_atual && item.total_parcelas)) return null;
  const diffDias = (a, b) => {
    const da = new Date(`${String(a).slice(0,10)}T12:00:00`);
    const db = new Date(`${String(b).slice(0,10)}T12:00:00`);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 9999;
    return Math.abs(Math.round((da - db) / 86400000));
  };
  const mesmoCentavo = (a, b) => Math.round(Number(a || 0) * 100) === Math.round(Number(b || 0) * 100);
  const fornItem = String(fornecedorIdResolvido || item.fornecedor_id || '').trim();
  const dataRefVenc = /^\d{4}-\d{2}-\d{2}$/.test(String(item.vencimento_fatura || '')) ? item.vencimento_fatura : null;
  return (candidatos || []).find(c => {
    if (Number(c.numero_parcela) !== Number(item.parcela_atual)) return false;
    if (Number(c.qtd_parcelas) !== Number(item.total_parcelas)) return false;
    if (!mesmoCentavo(c.valor_compra, item.valor)) return false;
    const fornCand = String(c.fornecedor_id || '').trim();
    if (fornItem && fornCand && fornItem !== fornCand) return false;
    // Amarra por data: compra original igual/pr?xima OU vencimento provisionado pr?ximo
    // (provisionamento usa +30 dias; meses reais variam de 28 a 31 ? janela de ?10).
    const dCompra = String(c.data_compra || '').slice(0, 10);
    const compraOk = /^\d{4}-\d{2}-\d{2}$/.test(dCompra) && diffDias(dCompra, item.data) <= 5;
    const dVenc = String(c.data_vencimento || '').slice(0, 10);
    const vencOk = dataRefVenc && /^\d{4}-\d{2}-\d{2}$/.test(dVenc) && diffDias(dVenc, dataRefVenc) <= 10;
    return compraOk || vencOk;
  }) || null;
}

// Concilia os itens do OFX contra o que já existe no banco.
// 1) Por FITID (c?digo ?nico do banco) ? match forte.
// 2) Por valor + data (?3 dias) + fornecedor ? para casar lançamentos MANUAIS sem FITID.
// Marca item._jaLancado e item._motivoConciliacao; NÃƒO bloqueia a importa·o.
async function faturaConciliarComBanco(itens) {
  const lojaSessao = String(obterLojaIdSessao?.() || usuarioSistemaLogado?.loja_id || '').trim();
  // Janela de datas para reduzir a busca: do menor ao maior vencimento/compra dos itens.
  const datas = (itens || [])
    .flatMap(i => [i.data, i.vencimento_fatura])
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')));
  let candidatos = [];
  try {
    const { data, error } = await executarSemFiltrosTenantTemporario(() => {
      let q = sb.from('contasapagar')
        .select('id, ofx_fitid, valor_compra, data_compra, data_vencimento, fornecedor_id, numero_parcela, qtd_parcelas, observacao, loja_id, fornecedores(nome)')
        .is('excluido_em', null);
      return q;
    });
    if (error) {
      console.warn('Conciliação indisponível:', error?.message || error);
      return { conciliados: 0, fitid: 0, manual: 0, parcela: 0 };
    }
    candidatos = (data || []).filter(row => !lojaSessao || String(row.loja_id || '').trim() === lojaSessao);
  } catch (e) {
    console.warn('Falha na conciliação:', e?.message || e);
    return { conciliados: 0, fitid: 0, manual: 0, parcela: 0 };
  }

  const fitidsExistentes = new Set(candidatos.filter(c => c.ofx_fitid).map(c => String(c.ofx_fitid)));
  const diffDias = (a, b) => {
    const da = new Date(`${a}T12:00:00`), db = new Date(`${b}T12:00:00`);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 9999;
    return Math.abs(Math.round((da - db) / 86400000));
  };
  const mesmoCentavo = (a, b) => Math.round(Number(a || 0) * 100) === Math.round(Number(b || 0) * 100);

  let qtdFitid = 0, qtdManual = 0, qtdParcela = 0;
  const adocoesFitid = []; // parcelas provisionadas que v?o "adotar" o FITID deste m?s
  (itens || []).forEach(item => {
    item._jaLancado = false;
    item._motivoConciliacao = '';
    // (1) FITID
    if (item.fitid && fitidsExistentes.has(String(item.fitid))) {
      item._jaLancado = true;
      item._motivoConciliacao = 'fitid';
      item.selecionado = false;
      qtdFitid++;
      return;
    }
    // (1.5) PARCELA ? "LOJA 04/06" do OFX deste m?s ? parcela 4/6 j? provisionada
    // numa importa·o anterior. O FITID muda a cada fatura, ent?o sem esta etapa
    // a parcela entraria em dobro.
    const parcelaExistente = faturaEncontrarParcelaExistente(item, candidatos, null);
    if (parcelaExistente) {
      item._jaLancado = true;
      item._motivoConciliacao = 'parcela';
      item.selecionado = false;
      qtdParcela++;
      // Adota o FITID deste m?s na parcela provisionada: a partir da?, reimportar
      // o MESMO arquivo cai direto na trava por identificador (?ndice ?nico).
      if (item.fitid && !parcelaExistente.ofx_fitid) {
        parcelaExistente.ofx_fitid = String(item.fitid);
        adocoesFitid.push({ id: parcelaExistente.id, ofx_fitid: String(item.fitid) });
      }
      return;
    }
    // (2) valor + data (?3 dias) + fornecedor (r?gido). S? tenta se o item j? tem fornecedor resolvido.
    const fornItem = String(item.fornecedor_id || '').trim();
    if (!fornItem) return;
    const dataRef = /^\d{4}-\d{2}-\d{2}$/.test(String(item.vencimento_fatura || '')) ? item.vencimento_fatura : item.data;
    const achou = candidatos.find(c => {
      if (String(c.fornecedor_id || '').trim() !== fornItem) return false;
      if (!mesmoCentavo(c.valor_compra, item.valor)) return false;
      const dC = String(c.data_vencimento || c.data_compra || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(dC) && diffDias(dC, dataRef) <= 3;
    });
    if (achou) {
      item._jaLancado = true;
      item._motivoConciliacao = 'manual';
      item.selecionado = false;
      qtdManual++;
    }
  });
  // Grava o FITID adotado nas parcelas provisionadas (silencioso; melhora as
  // pr?ximas verifica·es por identificador). S? preenche onde estava vazio.
  for (const a of adocoesFitid) {
    try {
      await sb.from('contasapagar')
        .update({ ofx_fitid: a.ofx_fitid })
        .eq('id', a.id)
        .is('excluido_em', null)
        .is('ofx_fitid', null);
    } catch (eAdo) {
      console.warn('Não foi possível vincular o FITID à parcela provisionada:', eAdo?.message || eAdo);
    }
  }
  return { conciliados: qtdFitid + qtdManual + qtdParcela, fitid: qtdFitid, manual: qtdManual, parcela: qtdParcela };
}


// Regra SEM fechamento: pr?ximo dia X a partir da data da compra (se a compra for
// no dia X ou antes, vence no m?s da compra; sen?o, no m?s seguinte).
// Regra COM fechamento (diaFechamento informado ? l?gica de FATURA de cart?o):
//   - compra ANTES do dia de fechamento ? entra na fatura que fecha neste m?s;
//   - compra NO dia de fechamento ou DEPOIS ? entra na fatura do m?s seguinte;
//   - se o vencimento cai no dia do fechamento ou antes dele, a fatura vence no
//     m?s seguinte ao fechamento (ex.: fecha dia 28, vence dia 5 do m?s seguinte).
// Ajusta meses curtos (ex.: dia 31 em fevereiro).
function faturaCalcularVencimentoPorDia(dataCompraISO, diaVencimento, diaFechamento) {
  const dia = Number.parseInt(diaVencimento, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataCompraISO || '')) || !Number.isFinite(dia) || dia < 1 || dia > 31) {
    return null;
  }
  const [ano, mes, diaCompra] = dataCompraISO.split('-').map(Number);
  let anoV = ano, mesV = mes; // mes 1-12
  const fech = Number.parseInt(diaFechamento, 10);
  if (Number.isFinite(fech) && fech >= 1 && fech <= 31) {
    if (diaCompra >= fech) mesV += 1; // j? entrou na fatura seguinte
    if (dia <= fech) mesV += 1;       // fatura vence depois do fechamento
  } else if (diaCompra > dia) {
    mesV += 1;
  }
  while (mesV > 12) { mesV -= 12; anoV += 1; }
  // ?ltimo dia do m?s de vencimento (trata fevereiro, meses de 30 dias, etc.)
  const ultimoDia = new Date(anoV, mesV, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDia);
  const mm = String(mesV).padStart(2, '0');
  const dd = String(diaFinal).padStart(2, '0');
  // Fatura que vence em fim de semana/feriado paga no pr?ximo dia ?til.
  return (typeof ajustarVencimentoParaDiaUtilFinanceiro === 'function')
    ? ajustarVencimentoParaDiaUtilFinanceiro(`${anoV}-${mm}-${dd}`)
    : `${anoV}-${mm}-${dd}`;
}

function faturaObterCategoriaItem(item) {
  const id = String(item?.categoria_id || '').trim();
  return id ? (categoriasCompraCache || []).find(c => String(c.id) === id) || null : null;
}

function faturaObterFornecedorItem(item) {
  const id = String(item?.fornecedor_id || '').trim();
  return id ? (fornecedoresFinanceiroCache || []).find(f => String(f.id) === id) || null : null;
}

function faturaHtmlCategoriaBotao(item) {
  const cat = faturaObterCategoriaItem(item);
  if (!cat) {
    return '<span class="fatura-choice-icon vazio">+</span><span>Selecionar categoria</span>';
  }
  return `<span class="fatura-choice-icon" style="background:${escaparHtmlBasico(cat.cor || '#3b82f6')}22;border-color:${escaparHtmlBasico(cat.cor || '#3b82f6')}66">${htmlIconeCategoriaCompra(cat.icone, 24)}</span><span>${escaparHtmlBasico(cat.nome || 'Categoria')}</span>`;
}

function faturaHtmlFornecedorBotao(item) {
  const fornecedor = faturaObterFornecedorItem(item);
  if (!fornecedor) return '<span class="fatura-choice-icon vazio">+</span><span>Selecione um fornecedor</span>';
  return `<span class="fatura-choice-icon">F</span><span>${escaparHtmlBasico(fornecedor.nome || 'Fornecedor')}</span>`;
}

function faturaAtualizarCardSelecoes(itemId) {
  const item = (_faturaItensExtraidos || []).find(i => String(i.id) === String(itemId));
  const card = document.getElementById('faturaItem_' + itemId);
  if (!item || !card) return;
  const catBtn = card.querySelector('[data-fatura-cat-btn]');
  if (catBtn) {
    catBtn.innerHTML = faturaHtmlCategoriaBotao(item);
    catBtn.classList.toggle('selecionado', !!item.categoria_id);
  }
  const fornBtn = card.querySelector('[data-fatura-forn-btn]');
  if (fornBtn) {
    fornBtn.innerHTML = faturaHtmlFornecedorBotao(item);
    fornBtn.classList.toggle('selecionado', !!item.fornecedor_id);
  }
  const venceBtn = card.querySelector('[data-fatura-venc-fornecedor]');
  const fornecedor = faturaObterFornecedorItem(item);
  const dia = Number.parseInt(String(fornecedor?.dia_vencimento || ''), 10);
  if (venceBtn) {
    const pode = Number.isFinite(dia) && dia >= 1 && dia <= 31;
    venceBtn.style.display = pode ? '' : 'none';
    venceBtn.textContent = pode ? `Vence dia ${dia}` : 'Vence dia fornecedor';
  }
}

function faturaFecharEscolhaOverlay() {
  document.getElementById('faturaEscolhaOverlay')?.remove();
}

function faturaCriarEscolhaOverlay({ titulo = '', subtitulo = '', body = '' } = {}) {
  faturaFecharEscolhaOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'faturaEscolhaOverlay';
  overlay.className = 'fatura-choice-overlay';
  overlay.innerHTML = `
    <div class="fatura-choice-sheet">
      <div class="fatura-choice-head">
        <div>
          <div class="fatura-choice-title">${escaparHtmlBasico(titulo)}</div>
          <div class="fatura-choice-subtitle">${escaparHtmlBasico(subtitulo || '')}</div>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" onclick="faturaFecharEscolhaOverlay()">?</button>
      </div>
      <div class="fatura-choice-body">${body}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function faturaAbrirCategoriasItem(itemId) {
  const item = (_faturaItensExtraidos || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  const cards = [
    `<button type="button" class="fatura-cat-card ${!item.categoria_id ? 'selecionado' : ''}" onclick="faturaEscolherCategoriaItem('${itemId}', '')">
      <span class="fatura-cat-icone vazio">+</span>
      <strong>Sem categoria</strong>
    </button>`,
    ...(categoriasCompraCache || []).map(cat => `
      <button type="button" class="fatura-cat-card ${String(cat.id) === String(item.categoria_id || '') ? 'selecionado' : ''}" onclick="faturaEscolherCategoriaItem('${itemId}', '${cat.id}')">
        <span class="fatura-cat-icone" style="background:${escaparHtmlBasico(cat.cor || '#3b82f6')}22;border-color:${escaparHtmlBasico(cat.cor || '#3b82f6')}66">${htmlIconeCategoriaCompra(cat.icone, 30)}</span>
        <strong>${escaparHtmlBasico(cat.nome || 'Categoria')}</strong>
      </button>
    `),
  ].join('');
  faturaCriarEscolhaOverlay({
    titulo: 'Categoria',
    subtitulo: item.descricao || '',
    body: `<div class="fatura-cat-grid">${cards}</div>`,
  });
}

function faturaEscolherCategoriaItem(itemId, categoriaId) {
  faturaAoSelecionarCategoria(itemId, categoriaId);
  faturaAtualizarCardSelecoes(itemId);
  faturaFecharEscolhaOverlay();
}

function faturaAbrirFornecedoresItem(itemId) {
  const item = (_faturaItensExtraidos || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  const opcoes = (fornecedoresFinanceiroCache || []).map(f => `
    <button type="button" class="fatura-forn-row ${String(f.id) === String(item.fornecedor_id || '') ? 'selecionado' : ''}" data-fatura-forn-nome="${escaparHtmlBasico(String(f.nome || '').toLowerCase())}" onclick="faturaEscolherFornecedorItem('${itemId}', '${f.id}')">
      <span>${escaparHtmlBasico(f.nome || 'Fornecedor')}</span>
      ${f.dia_vencimento ? `<small>Vence dia ${escaparHtmlBasico(f.dia_vencimento)}</small>` : ''}
    </button>
  `).join('');
  faturaCriarEscolhaOverlay({
    titulo: 'Fornecedor',
    subtitulo: item.descricao || '',
    body: `
      <input class="fatura-choice-search" type="search" placeholder="Buscar fornecedor" oninput="faturaFiltrarFornecedoresEscolha(this.value)">
      ${item._exigeFornecedorManual ? '' : `<button type="button" class="fatura-forn-row novo ${!item.fornecedor_id ? 'selecionado' : ''}" onclick="faturaEscolherFornecedorItem('${itemId}', '')">
        <span>Novo fornecedor</span>
        <small>Usar o nome da compra ao lançar</small>
      </button>`}
      <div class="fatura-forn-list">${opcoes || '<div class="empty">Nenhum fornecedor cadastrado.</div>'}</div>
    `,
  });
}

function faturaFiltrarFornecedoresEscolha(valor) {
  const busca = String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  document.querySelectorAll('#faturaEscolhaOverlay [data-fatura-forn-nome]').forEach(btn => {
    const nome = String(btn.getAttribute('data-fatura-forn-nome') || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    btn.style.display = !busca || nome.includes(busca) ? '' : 'none';
  });
}

async function faturaEscolherFornecedorItem(itemId, fornecedorId) {
  await faturaAoSelecionarFornecedor(itemId, fornecedorId);
  faturaAtualizarCardSelecoes(itemId);
  faturaFecharEscolhaOverlay();
}

function faturaUsarVencimentoFornecedor(itemId) {
  const item = (_faturaItensExtraidos || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  const fornecedor = faturaObterFornecedorItem(item);
  const dia = Number.parseInt(String(fornecedor?.dia_vencimento || ''), 10);
  if (!fornecedor || !Number.isFinite(dia) || dia < 1 || dia > 31) return;
  const venc = faturaCalcularVencimentoPorDia(item.data, dia, fornecedor?.dia_fechamento);
  if (!venc) return;
  faturaAoAlterarVencimento(itemId, venc);
  const input = document.querySelector(`#faturaItem_${itemId} .fatura-input-vencimento`);
  if (input) {
    input.value = venc;
    input.style.boxShadow = '0 0 0 1px var(--accent) inset';
  }
}

function faturaAplicarInterfaceMobileRevisao() {
  (_faturaItensExtraidos || []).forEach(item => {
    const card = document.getElementById('faturaItem_' + item.id);
    if (!card || card.dataset.faturaMobileUi === '1') return;
    card.dataset.faturaMobileUi = '1';
    card.classList.add('fatura-review-card-enhanced');

    const selectCat = card.querySelector('.fatura-select-categoria');
    if (selectCat) {
      selectCat.style.display = 'none';
      const btnCat = document.createElement('button');
      btnCat.type = 'button';
      btnCat.className = `fatura-choice-btn ${item.categoria_id ? 'selecionado' : ''}`;
      btnCat.setAttribute('data-fatura-cat-btn', '');
      btnCat.innerHTML = faturaHtmlCategoriaBotao(item);
      btnCat.onclick = () => faturaAbrirCategoriasItem(item.id);
      selectCat.insertAdjacentElement('beforebegin', btnCat);
    }

    const selectForn = card.querySelector('.fatura-select-fornecedor');
    if (selectForn) {
      selectForn.style.display = 'none';
      const btnForn = document.createElement('button');
      btnForn.type = 'button';
      btnForn.className = `fatura-choice-btn ${item.fornecedor_id ? 'selecionado' : ''}`;
      btnForn.setAttribute('data-fatura-forn-btn', '');
      btnForn.innerHTML = faturaHtmlFornecedorBotao(item);
      btnForn.onclick = () => faturaAbrirFornecedoresItem(item.id);
      selectForn.insertAdjacentElement('beforebegin', btnForn);
    }

    const inputVenc = card.querySelector('.fatura-input-vencimento');
    if (inputVenc && !card.querySelector('[data-fatura-venc-fornecedor]')) {
      const fornecedor = faturaObterFornecedorItem(item);
      const dia = Number.parseInt(String(fornecedor?.dia_vencimento || ''), 10);
      const btnVenc = document.createElement('button');
      btnVenc.type = 'button';
      btnVenc.className = 'fatura-venc-fornecedor';
      btnVenc.setAttribute('data-fatura-venc-fornecedor', '');
      btnVenc.style.display = Number.isFinite(dia) && dia >= 1 && dia <= 31 ? '' : 'none';
      btnVenc.textContent = Number.isFinite(dia) && dia >= 1 && dia <= 31 ? `Vence dia ${dia}` : 'Vence dia fornecedor';
      btnVenc.onclick = () => faturaUsarVencimentoFornecedor(item.id);
      inputVenc.insertAdjacentElement('beforebegin', btnVenc);
    }
  });
}

async function faturaExibirRevisao(resultado) {
  document.getElementById('faturaStep2').style.display = 'none';
  const s3 = document.getElementById('faturaStep3');
  s3.style.display = 'flex';
  s3.style.flexDirection = 'column';

  const total = _faturaItensExtraidos.reduce((s,i) => s + Number(i.valor||0), 0);
  document.getElementById('faturaResumoTexto').textContent =
    `${resultado.banco || 'Fatura'} ? ${_faturaItensExtraidos.length} lançamentos`;
  document.getElementById('faturaResumoValor').textContent =
    `Total: ${formatarMoedaBRFinanceiro(total)} ? Venc: ${formatarDataBRFinanceiro(resultado.vencimento || '')}`;

  // · Pr?-preenchimento autom?tico ·················
  // Garante que os caches necess?rios estão carregados.
  if (!(fornecedoresFinanceiroCache || []).length && typeof carregarFornecedoresFinanceiro === 'function') {
    try { await carregarFornecedoresFinanceiro(); } catch(e) { /* segue */ }
  }
  if (!(categoriasCompraCache || []).length && typeof carregarCategoriasCompra === 'function') {
    try { await carregarCategoriasCompra(); } catch(e) { /* segue */ }
  }
  // 1) Fornecedor: casa o banco do OFX (Nubank/Inter/Bradesco...) com um fornecedor cadastrado.
  const fornAutoCartao = resultado.referenciaCartao
    ? faturaEncontrarFornecedorCartaoNaReferencia(resultado.referenciaCartao)
    : null;
  const fornAuto = fornAutoCartao || faturaEncontrarFornecedorPorBanco(resultado.banco);
  // 2) Categoria: monta a mem?ria (hist?rico + tabela de aprendizado).
  await faturaConstruirMemoriaCategorias();
  await faturaConstruirMemoriaInteligente();

  let qtdFornAuto = 0;
  let qtdCatAuto = 0;
  let qtdVencAuto = 0;
  let qtdObsAuto = 0;
  const fornAutoObj = fornAuto ? (fornecedoresFinanceiroCache || []).find(f => String(f.id) === String(fornAuto)) : null;
  _faturaItensExtraidos.forEach(item => {
    const sugestaoHistorico = faturaSugerirPorHistorico(item.descricao);
    item._sugestaoConfianca = sugestaoHistorico?.confianca || 0;
    let fornDoItem = item.fornecedor_id;
    const fornSugerido = (sugestaoHistorico?.confianca >= .64 ? sugestaoHistorico.fornecedor_id : null)
      || faturaEncontrarFornecedorInteligente(item.descricao)
      || fornAutoCartao
      || faturaEncontrarFornecedorPorBanco(`${resultado.banco || ''} ${item.descricao || ''}`)
      || fornAuto;
    if (fornSugerido && !item.fornecedor_id) { item.fornecedor_id = fornSugerido; item._fornAuto = true; qtdFornAuto++; fornDoItem = fornSugerido; }
    if (!item.categoria_id) {
      const chave = faturaChaveEstabelecimento(item.descricao);
      const catMem = (sugestaoHistorico?.confianca >= .62 ? sugestaoHistorico.categoria_id : null)
        || _faturaMemoriaCategorias[chave];
      if (catMem) { item.categoria_id = catMem; item._catAuto = true; qtdCatAuto++; }
    }
    // Vencimento pelo dia configurado no fornecedor (se houver), com base na data da compra.
    const fornObj = (fornecedoresFinanceiroCache || []).find(f => String(f.id) === String(fornDoItem)) || null;
    const diaVenc = fornObj?.dia_vencimento;
    if (diaVenc) {
      const venc = faturaCalcularVencimentoPorDia(item.data, diaVenc, fornObj?.dia_fechamento);
      if (venc) { item.vencimento_fatura = venc; item._vencAuto = true; qtdVencAuto++; }
    }
    // Inicializa parcelas manuais (provisionamento): 1 por padr?o; itens parcelados do OFX
    // j? trazem o total detectado e n?o usam o campo manual.
    if (item._parcelasManuais == null) {
      const texto = String(item.descricao || '');
      const mQtd = texto.match(/(?:parcelad[oa]\s*(?:em)?\s*|\bem\s+)?(\d{1,3})\s*x\b/i);
      const qtdSugerida = mQtd ? Number.parseInt(mQtd[1], 10) : 1;
      item._parcelasManuais = qtdSugerida >= 2 && qtdSugerida <= 360 ? qtdSugerida : 1;
      item._parcelasAuto = item._parcelasManuais > 1;
    }
    if (!item._modoValorParcelas) item._modoValorParcelas = 'total';
    // Obs edit?vel: pr?-preenchida com o nome da compra (memo limpo do OFX).
    if (item._obsManual == null) item._obsManual = String(item.descricao || '').trim();
    if (sugestaoHistorico?.observacao && sugestaoHistorico.confianca >= .68) {
      const observacaoSugerida = String(sugestaoHistorico.observacao).trim().slice(0, 200);
      if (observacaoSugerida && observacaoSugerida !== item._obsManual) {
        item._obsManual = observacaoSugerida;
        item._obsAuto = true;
        qtdObsAuto++;
      }
    }
  });

  // Concilia·o refor?ada: marca o que já existe no banco (FITID ou valor+data+fornecedor).
  const concil = await faturaConciliarComBanco(_faturaItensExtraidos);

  const optsCategoria = (selId, auto) =>
    '<option value=""' + (selId ? '' : ' selected') + '>Sem categoria</option>' +
    (categoriasCompraCache||[]).map(c =>
      `<option value="${c.id}" ${String(c.id) === String(selId) ? 'selected' : ''}>${escaparHtmlBasico(c.nome)}</option>`
    ).join('');
  const optsFornecedor = (selId) =>
    '<option value=""' + (selId ? '' : ' selected') + '>Novo fornecedor</option>' +
    (fornecedoresFinanceiroCache||[]).map(f =>
      `<option value="${f.id}" ${String(f.id) === String(selId) ? 'selected' : ''}>${escaparHtmlBasico(f.nome)}</option>`
    ).join('');

  const corAuto = 'box-shadow:0 0 0 1px var(--accent) inset;';
  const tagAuto = '<span style="font-size:9px;color:var(--accent);font-weight:700;margin-left:4px;">auto</span>';

  const lista = document.getElementById('faturaListaItens');
  lista.innerHTML = _faturaItensExtraidos.map(item => {
    const ehParceladoOFX = item.parcela_atual && item.total_parcelas;
    const parc = ehParceladoOFX
      ? `<span style="font-size:10px;color:var(--accent);margin-left:6px;">${item.parcela_atual}/${item.total_parcelas}x</span>`
      : '';
    const restantes = ehParceladoOFX ? item.total_parcelas - item.parcela_atual : 0;
    // Badge de quantas parcelas serão lançadas para este item.
    const qtdLancar = ehParceladoOFX ? (item.total_parcelas - item.parcela_atual + 1) : Math.max(1, Number(item._parcelasManuais || 1));
    const badgeParcelas = qtdLancar > 1
      ? `<span data-badge-parcelas style="font-size:10px;font-weight:700;color:#34d399;background:rgba(52,211,153,.12);border-radius:6px;padding:1px 6px;margin-left:6px;">${qtdLancar} parcelas</span>`
      : '';
    const jaLancado = !!item._jaLancado;
    const rotuloConcil = item._motivoConciliacao === 'fitid' ? 'OFX'
      : item._motivoConciliacao === 'parcela' ? 'parcela já provisionada'
      : 'manual';
    const seloConciliado = jaLancado
      ? `<span style="font-size:10px;font-weight:700;color:#fbbf24;background:rgba(251,191,36,.12);border-radius:6px;padding:1px 6px;margin-left:6px;">já lançado · ${rotuloConcil}</span>`
      : '';
    // Campo de observa·o edit?vel (pr?-preenchido com o nome da compra).
    const confiancaPct = Math.round(Number(item._sugestaoConfianca || 0) * 100);
    const campoObs = `<label style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px;flex:1;min-width:180px;">Obs.${item._obsAuto ? ` sugerida ${confiancaPct}%` : ''}:
         <input type="text" maxlength="200" value="${escaparHtmlBasico(item._obsManual || '')}"
           style="flex:1;min-width:140px;font-size:11px;height:24px;padding:0 6px;${item._obsAuto ? corAuto : ''}"
           onchange="faturaAoAlterarObs('${item.id}', this.value)"
           title="Observa·o que ser? gravada no contas a pagar (mant?m a marca·o 'Importado do arquivo banc?rio')">
       </label>`;
    // Campo de parcelas manuais: aparece s? quando NÃƒO ? parcelamento detectado do OFX.
    const campoParcelasManuais = !ehParceladoOFX
      ? `<label style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px;">Parcelas:
           <input type="number" min="1" max="360" step="1" value="${Math.max(1, Number(item._parcelasManuais || 1))}"
             style="width:54px;font-size:11px;height:24px;padding:0 4px;text-align:center;"
             onchange="faturaAoAlterarParcelasManuais('${item.id}', this.value)"
             title="Quantidade de parcelas a provisionar (vencimento mensal a partir do vencimento definido)">
         </label>
         <label style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px;">Valor:
           <select style="font-size:11px;height:24px;padding:0 4px;" onchange="faturaAoAlterarModoValor('${item.id}', this.value)">
             <option value="total" ${item._modoValorParcelas === 'total' ? 'selected' : ''}>Total (dividir)</option>
             <option value="parcela" ${item._modoValorParcelas === 'parcela' ? 'selected' : ''}>Por parcela</option>
           </select>
         </label>`
      : '';
    void campoObs; // usado no template abaixo
    return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;background:var(--surface2);${jaLancado ? 'opacity:.62;' : ''}" id="faturaItem_${item.id}">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <input type="checkbox" ${item.selecionado ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;"
          onchange="_faturaItensExtraidos.find(i=>i.id==='${item.id}').selecionado=this.checked;faturaAtualizarFooter()">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:600;color:var(--text);">${escaparHtmlBasico(item.descricao)}</span>
            ${parc}
            ${badgeParcelas}
            ${seloConciliado}
            ${restantes > 0 ? `<span style="font-size:10px;color:var(--text-muted);">→ +${restantes} parcelas futuras serão geradas</span>` : ''}
          </div>
          <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:11px;color:var(--text-muted);">Compra: ${formatarDataBRFinanceiro(item.data)}</span>
            <label style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:3px;">Venc.:
              <input type="date" class="fatura-input-vencimento" value="${(item.vencimento_fatura||'').slice(0,10)}"
                style="font-size:11px;height:24px;padding:0 4px;${item._vencAuto ? corAuto : ''}"
                onchange="faturaAoAlterarVencimento('${item.id}', this.value); this.style.boxShadow='';">
            </label>
            ${campoParcelasManuais}
            ${campoObs}
            <span style="font-size:13px;font-weight:700;color:var(--text);">${formatarMoedaBRFinanceiro(item.valor)}</span>
            <select class="fatura-select-categoria" style="font-size:11px;height:24px;padding:0 4px;flex:1;min-width:120px;${item._catAuto ? corAuto : ''}"
              onchange="faturaAoSelecionarCategoria('${item.id}', this.value); this.style.boxShadow='';">
              ${optsCategoria(item.categoria_id, item._catAuto)}
            </select>
            <select class="fatura-select-fornecedor" id="faturaForn_${item.id}" style="font-size:11px;height:24px;padding:0 4px;flex:1;min-width:140px;${item._fornAuto ? corAuto : ''}"
              onchange="faturaAoSelecionarFornecedor('${item.id}', this.value); this.style.boxShadow='';">
              ${optsFornecedor(item.fornecedor_id)}
            </select>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Aviso amig?vel do que foi preenchido automaticamente + concilia·o
  const partes = [];
  if (qtdFornAuto) partes.push(`fornecedor em ${qtdFornAuto}`);
  if (qtdCatAuto) partes.push(`categoria em ${qtdCatAuto}`);
  if (qtdVencAuto) partes.push(`vencimento em ${qtdVencAuto}`);
  if (qtdObsAuto) partes.push(`observação padronizada em ${qtdObsAuto}`);
  const msgsConcil = [];
  if (concil && concil.conciliados) {
    const detalhe = [];
    if (concil.fitid) detalhe.push(`${concil.fitid} pelo c?digo do banco`);
    if (concil.parcela) detalhe.push(`${concil.parcela} parcela(s) j? provisionada(s) de importa·o anterior`);
    if (concil.manual) detalhe.push(`${concil.manual} por valor/data/fornecedor`);
    msgsConcil.push(`· ${concil.conciliados} item(ns) já constavam no sistema (${detalhe.join(' e ')}) e foram desmarcados. Os novos seguem prontos para lançar.`);
  }
  const partesMsg = [];
  if (partes.length) partesMsg.push(`? Preenchi automaticamente ${partes.join(', ')} item(ns) (destacados).`);
  if (msgsConcil.length) partesMsg.push(msgsConcil.join(' '));
  if (partesMsg.length) {
    setMsg('msgImportarFatura', partesMsg.join('<br>'), concil && concil.conciliados ? 'ok' : 'ok');
  }

  const footer = document.getElementById('faturaFooter');
  footer.style.display = 'flex';
  faturaAplicarInterfaceMobileRevisao();
  faturaAtualizarFooter();
}

async function faturaAoSelecionarFornecedor(itemId, fornecedorId) {
  const item = _faturaItensExtraidos.find(i => i.id === itemId);
  if (!item) return;
  item.fornecedor_id = fornecedorId;
  item._fornAuto = false;
  // Recalcula o vencimento com base no dia configurado no novo fornecedor,
  // mas s? se o usu?rio ainda n?o tiver editado o vencimento manualmente.
  if (!item._vencEditadoManual) {
    const fornObj = (fornecedoresFinanceiroCache || []).find(f => String(f.id) === String(fornecedorId)) || null;
    const diaVenc = fornObj?.dia_vencimento;
    if (diaVenc) {
      const venc = faturaCalcularVencimentoPorDia(item.data, diaVenc, fornObj?.dia_fechamento);
      if (venc) {
        item.vencimento_fatura = venc;
        const card = document.getElementById('faturaItem_' + itemId);
        const inputVenc = card ? card.querySelector('.fatura-input-vencimento') : null;
        if (inputVenc) {
          inputVenc.value = venc;
          inputVenc.style.boxShadow = '0 0 0 1px var(--accent) inset';
        }
      }
    }
  }
}

function faturaAoAlterarVencimento(itemId, valor) {
  const item = _faturaItensExtraidos.find(i => i.id === itemId);
  if (!item) return;
  item.vencimento_fatura = valor || '';
  item._vencAuto = false;
  item._vencEditadoManual = true;
}

function faturaAoAlterarObs(itemId, valor) {
  const item = (_faturaItensExtraidos || []).find(i => String(i.id) === String(itemId));
  if (!item) return;
  item._obsManual = String(valor || '').trim().slice(0, 200);
  item._obsAuto = false;
}

function faturaAoAlterarParcelasManuais(itemId, valor) {
  const item = _faturaItensExtraidos.find(i => i.id === itemId);
  if (!item) return;
  let n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n < 1) n = 1;
  if (n > 360) n = 360;
  item._parcelasManuais = n;
  // Atualiza o badge "N parcelas" do item sem recarregar a lista inteira.
  const card = document.getElementById('faturaItem_' + itemId);
  if (card) {
    const linhaTitulo = card.querySelector('div > div > div');
    const badge = card.querySelector('[data-badge-parcelas]');
    // Recria o badge de forma simples: procura/insere após o nome.
    const cabecalho = card.querySelector('div[style*="flex-wrap:wrap"]');
    if (cabecalho) {
      let existente = cabecalho.querySelector('[data-badge-parcelas]');
      if (n > 1) {
        const html = `<span data-badge-parcelas style="font-size:10px;font-weight:700;color:#34d399;background:rgba(52,211,153,.12);border-radius:6px;padding:1px 6px;margin-left:6px;">${n} parcelas</span>`;
        if (existente) existente.outerHTML = html;
        else {
          const nome = cabecalho.querySelector('span');
          if (nome) nome.insertAdjacentHTML('afterend', html);
        }
      } else if (existente) {
        existente.remove();
      }
    }
  }
}

function faturaNormalizarDescricaoInteligente(descricao) {
  let texto = String(descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const aliases = [
    [/\b(?:chat\s*gpt|openai)(?:\s+br(?:asil)?)?\b/g, 'chatgpt'],
    [/\bspal(?:\s+ind(?:ustria)?(?:\s+brasileira)?\s+de)?\s+bebidas?\b/g, 'coca cola'],
    [/\bgoogle\s*\*?ads\b/g, 'google ads'],
    [/\bmeta\s*\*?(?:pay|ads)?\b/g, 'meta'],
  ];
  aliases.forEach(([padrao, destino]) => { texto = texto.replace(padrao, destino); });
  return texto
    .replace(/\b(?:pagamentos?|servicos?|comercio|industria|brasil|br|ltda|eireli|sa|s a|me|mei)\b/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function faturaSimilaridadeDescricao(a, b) {
  const na = faturaNormalizarDescricaoInteligente(a);
  const nb = faturaNormalizarDescricaoInteligente(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ca = na.replace(/\s/g, ''), cb = nb.replace(/\s/g, '');
  if ((ca.includes(cb) || cb.includes(ca)) && Math.min(ca.length, cb.length) >= 5) return .92;
  const ta = new Set(na.split(' ').filter(t => t.length > 1));
  const tb = new Set(nb.split(' ').filter(t => t.length > 1));
  const comuns = [...ta].filter(t => tb.has(t)).length;
  const dice = (2 * comuns) / Math.max(1, ta.size + tb.size);
  const prefixo = ca.slice(0, 5) === cb.slice(0, 5) ? .12 : 0;
  return Math.min(1, dice + prefixo);
}

let _faturaMemoriaInteligente = [];

async function faturaConstruirMemoriaInteligente() {
  const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
  const perfis = [];
  try {
    let query = sb.from('fatura_importacao_memoria').select('*').order('ultima_utilizacao_em', { ascending: false }).limit(1500);
    if (lojaId) query = query.eq('loja_id', lojaId);
    const { data, error } = await query;
    if (error) throw error;
    (data || []).forEach(row => perfis.push({
      chave: row.chave_origem,
      origem: row.descricao_origem_exemplo,
      observacao: row.observacao_padrao,
      fornecedor_id: row.fornecedor_id,
      categoria_id: row.categoria_id,
      ocorrencias: Number(row.ocorrencias || 1),
      explicita: true,
    }));
  } catch (e) {
    console.warn('Memoria inteligente de importacao indisponivel:', e?.message || e);
  }
  try {
    let query = sb.from('contasapagar')
      .select('observacao,categoria_id,fornecedor_id,fornecedores(nome),created_at')
      .is('excluido_em', null).order('created_at', { ascending: false }).limit(1500);
    if (lojaId) query = query.eq('loja_id', lojaId);
    const { data } = await query;
    (data || []).forEach(row => {
      const observacao = String(row.observacao || '').replace(/\s*[·-]\s*Importado do arquivo banc[aá]rio.*$/i, '').replace(/\s*[·-]\s*\d+\/\d+\s*$/i, '').trim();
      const origens = [observacao, row?.fornecedores?.nome].filter(Boolean);
      origens.forEach(origem => perfis.push({
        chave: faturaNormalizarDescricaoInteligente(origem), origem, observacao,
        fornecedor_id: row.fornecedor_id, categoria_id: row.categoria_id,
        ocorrencias: 1, explicita: false,
      }));
    });
  } catch (e) {
    console.warn('Historico inteligente de contas indisponivel:', e?.message || e);
  }
  _faturaMemoriaInteligente = perfis;
  return perfis;
}

function faturaSugerirPorHistorico(descricao) {
  const chave = faturaNormalizarDescricaoInteligente(descricao);
  if (!chave) return null;
  const candidatos = (_faturaMemoriaInteligente || []).map(perfil => {
    const similaridade = faturaSimilaridadeDescricao(chave, perfil.chave || perfil.origem || perfil.observacao);
    const bonus = perfil.explicita ? .08 : Math.min(.06, Math.log10(Number(perfil.ocorrencias || 1) + 1) * .03);
    return { ...perfil, confianca: Math.min(1, similaridade + bonus) };
  }).filter(item => item.confianca >= .58).sort((a, b) => b.confianca - a.confianca || b.ocorrencias - a.ocorrencias);
  return candidatos[0] || null;
}

function faturaEncontrarFornecedorInteligente(descricao) {
  const candidatos = (fornecedoresFinanceiroCache || []).map(fornecedor => ({
    id: fornecedor.id,
    confianca: faturaSimilaridadeDescricao(descricao, fornecedor.nome),
    tamanho: faturaNormalizarDescricaoInteligente(fornecedor.nome).length,
  })).filter(item => item.confianca >= .68)
    .sort((a, b) => b.confianca - a.confianca || b.tamanho - a.tamanho);
  return candidatos[0]?.id || null;
}

async function faturaSalvarMemoriaInteligente(itens) {
  const lojaId = (typeof obterLojaIdSessao === 'function' ? obterLojaIdSessao() : null) || usuarioSistemaLogado?.loja_id || null;
  const empresaId = (typeof obterEmpresaIdSessao === 'function' ? obterEmpresaIdSessao() : null) || usuarioSistemaLogado?.empresa_id || null;
  if (!lojaId || !empresaId) return;
  const porChave = new Map();
  (itens || []).forEach(item => {
    const chave = faturaNormalizarDescricaoInteligente(item.descricao);
    if (!chave) return;
    porChave.set(chave, {
      empresa_id: empresaId, loja_id: lojaId, chave_origem: chave,
      descricao_origem_exemplo: String(item.descricao || '').slice(0, 200),
      observacao_padrao: String(item._obsManual || item.descricao || '').trim().slice(0, 200) || null,
      fornecedor_id: item.fornecedor_id || null, categoria_id: item.categoria_id || null,
      ultima_utilizacao_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
    });
  });
  const linhas = [...porChave.values()];
  if (!linhas.length) return;
  try {
    const { data: existentes } = await sb.from('fatura_importacao_memoria').select('chave_origem,ocorrencias').eq('loja_id', lojaId).in('chave_origem', linhas.map(l => l.chave_origem));
    const contagens = new Map((existentes || []).map(row => [row.chave_origem, Number(row.ocorrencias || 0)]));
    linhas.forEach(linha => { linha.ocorrencias = (contagens.get(linha.chave_origem) || 0) + 1; });
    const { error } = await sb.from('fatura_importacao_memoria').upsert(linhas, { onConflict: 'empresa_id,loja_id,chave_origem' });
    if (error) throw error;
  } catch (e) {
    console.warn('Nao foi possivel salvar a memoria inteligente:', e?.message || e);
  }
}

function faturaAoAlterarModoValor(itemId, modo) {
  const item = _faturaItensExtraidos.find(i => i.id === itemId);
  if (item) item._modoValorParcelas = modo === 'parcela' ? 'parcela' : 'total';
}

function faturaAoSelecionarCategoria(itemId, categoriaId) {
  const item = _faturaItensExtraidos.find(i => i.id === itemId);
  if (item) { item.categoria_id = categoriaId; item._catAuto = false; }
}

// Tenta casar o banco detectado no OFX (ex.: "Nubank", "Inter", "Bradesco")
// com um fornecedor j? cadastrado, usando apelidos conhecidos + compara·o tolerante.
// Retorna o id do fornecedor correspondente ou null.
function faturaEncontrarFornecedorPorBanco(banco) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const alvo = norm(banco);
  if (!alvo) return null;
  const lista = fornecedoresFinanceiroCache || [];

  // Monta o conjunto de termos a procurar: o pr?prio banco + seus apelidos.
  const termos = new Set([alvo]);
  Object.values(FATURA_BANCO_APELIDOS || {}).forEach(apelidos => {
    const apelidosNorm = apelidos.map(norm);
    // se o banco bate com algum apelido do grupo, adiciona todos os apelidos do grupo
    if (apelidosNorm.some(a => a && (a === alvo || a.includes(alvo) || alvo.includes(a)))) {
      apelidosNorm.forEach(a => { if (a) termos.add(a); });
    }
  });

  const casa = (nomeForn) => {
    const n = norm(nomeForn);
    if (!n) return false;
    for (const t of termos) {
      if (!t) continue;
      // termos muito curtos (ex.: "nu", "bb") exigem igualdade para evitar falso positivo
      if (t.length <= 2) { if (n === t) return true; continue; }
      if (n === t || n.includes(t) || t.includes(n)) return true;
    }
    return false;
  };

  const candidatos = lista.filter(f => casa(f.nome));
  // Havendo nomes semelhantes, fornecedor marcado como cartao e a opcao mais
  // segura para uma importacao de fatura. A escolha continua editavel na revisao.
  let achado = candidatos.find(f => !!f.is_cartao);
  if (achado) return achado.id;
  // 1) match exato pelo nome do banco
  achado = lista.find(f => norm(f.nome) === alvo);
  if (achado) return achado.id;
  // 2) match por apelidos/tolerante
  achado = lista.find(f => casa(f.nome));
  return achado ? achado.id : null;
}

// No OCR, o emissor do cartao costuma aparecer no cabecalho da notificacao e
// nao na descricao individual de cada compra. Compara essa referencia somente
// com fornecedores marcados como cartao, evitando sugerir um fornecedor comum
// de mesmo nome. "Bradesco Cartoes" casa com "Bradesco Cartao", assim como
// Nubank, Inter, Ponto Frio e outros nomes cadastrados pelo usuario.
function faturaEncontrarFornecedorCartaoNaReferencia(referencia) {
  const normalizar = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compacto = (s) => normalizar(s).replace(/\s+/g, '');
  const texto = compacto(referencia);
  if (!texto) return null;

  const candidatos = (fornecedoresFinanceiroCache || [])
    .filter(f => !!f.is_cartao)
    .map(f => {
      const nomeBase = normalizar(f.nome)
        .replace(/\b(cartao|cartoes|credito|creditos)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      return { fornecedor: f, chave: compacto(nomeBase || f.nome) };
    })
    .filter(c => c.chave.length >= 3 && texto.includes(c.chave))
    .sort((a, b) => b.chave.length - a.chave.length);

  if (candidatos[0]) return candidatos[0].fornecedor.id;
  const porBanco = faturaEncontrarFornecedorPorBanco(referencia);
  const fornecedorBanco = (fornecedoresFinanceiroCache || [])
    .find(f => String(f.id) === String(porBanco || '') && !!f.is_cartao);
  return fornecedorBanco?.id || null;
}

function faturaAtualizarFooter() {
  const sel = _faturaItensExtraidos.filter(i => i.selecionado);
  const total = sel.reduce((s,i) => s + Number(i.valor||0), 0);
  const info = document.getElementById('faturaFooterInfo');
  if (info) info.textContent = `${sel.length} de ${_faturaItensExtraidos.length} selecionados ? ${formatarMoedaBRFinanceiro(total)}`;
}

// · Parser OFX ·························
async function faturaProcessarOFX(file) {
  _faturaPerguntouReplicarForn = false;
  _faturaArquivoNome = file?.name || null;
  document.getElementById('faturaStep1').style.display = 'none';
  const s2 = document.getElementById('faturaStep2');
  s2.style.display = 'flex'; s2.style.flexDirection = 'column'; s2.style.alignItems = 'center';
  faturaSetProgress(20, 'Lendo arquivo OFX...');

  try {
    const texto = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Erro ao ler arquivo'));
      r.readAsText(file, 'latin1');
    });

    faturaSetProgress(50, 'Interpretando transa·es...');
    const lancamentos = ofxParseLancamentos(texto);

    if (!lancamentos.length) throw new Error('Nenhuma transa·o encontrada no arquivo OFX.');

    // Extrair info do arquivo. DTEND/DUEDATE v?m como timestamp OFX (ex.: 20260704000000[-3:BRT]);
    // normalizamos com ofxParseData para ISO (YYYY-MM-DD).
    const vencRaw = ofxExtrairTag(texto, 'DTEND') || ofxExtrairTag(texto, 'DUEDATE') || '';
    const vencimento = ofxParseData(vencRaw) || new Date().toISOString().slice(0,10);
    const banco = ofxDetectarBanco(texto);
    _faturaBancoDetectado = banco;
    const total = lancamentos.reduce((s,l) => s + Math.abs(l.valor), 0);

    _faturaItensExtraidos = lancamentos.map((l, i) => ({
      id: 'ofx_' + i,
      data: l.data,
      descricao: l.descricao,
      valor: Math.abs(l.valor),
      fitid: l.fitid || null,
      parcela_atual: l.parcela_atual,
      total_parcelas: l.total_parcelas,
      vencimento_fatura: vencimento,
      selecionado: l.valor < 0, // d?bitos = compras; cr?ditos (pagamentos) desmarcados
    }));

    // Anti-duplica·o por FITID ? agora feita na revis?o (concilia·o refor?ada),
    // que tamb?m cruza lançamentos manuais por valor+data+fornecedor e n?o bloqueia
    // a importa·o ? apenas marca o que já existe e deixa os novos prontos para lançar.
    faturaSetProgress(100, 'Conclu?do!');
    setTimeout(() => faturaExibirRevisao({ banco, vencimento, total_fatura: total }), 300);

  } catch(e) {
    document.getElementById('faturaStep2').style.display = 'none';
    document.getElementById('faturaStep1').style.display = '';
    setMsg('msgImportarFatura', '? ' + (e.message || 'Erro ao processar OFX'), 'err');
  }
}

function ofxParseLancamentos(texto) {
  const lancamentos = [];
  // Suporte a formato SGML (antigo) e XML
  const regexStmt = /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi;
  let bloco;
  while ((bloco = regexStmt.exec(texto)) !== null) {
    const b = bloco[1] || bloco[2] || '';
    const tipo = ofxExtrairTag(b, 'TRNTYPE') || '';
    const dtStr = ofxExtrairTag(b, 'DTPOSTED') || '';
    const valorStr = ofxExtrairTag(b, 'TRNAMT') || '0';
    const memo = ofxExtrairTag(b, 'MEMO') || ofxExtrairTag(b, 'NAME') || '';
    const fitid = ofxExtrairTag(b, 'FITID') || '';
    const valor = parseFloat(valorStr.replace(',','.')) || 0;
    const data = ofxParseData(dtStr);
    if (!data || !memo) continue;
    // Detectar parcelamento no memo. Formatos aceitos:
    //   "Mercadolivre*Fortsaau - Parcela 7/10"  (Nubank)
    //   "AMAZON 02/06"                          (X/Y no FINAL do memo)
    // Um "X/Y" no MEIO do texto sem a palavra "parcela" e ignorado de proposito,
    // para uma data como "compra 03/06" nao virar parcelamento por engano.
    const mParcExplicito = memo.match(/parcelas?\s*[:\-]?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
    const mParcFinal = memo.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
    let parcAtual = null, parcTotal = null;
    const mParc = mParcExplicito || mParcFinal;
    if (mParc) {
      const a = parseInt(mParc[1], 10), t = parseInt(mParc[2], 10);
      // Sanidade: 1 <= atual <= total e total >= 2 (senao nao e parcelamento).
      if (Number.isFinite(a) && Number.isFinite(t) && a >= 1 && t >= 2 && a <= t) {
        parcAtual = a; parcTotal = t;
      }
    }
    // Descricao limpa: remove "- Parcela 7/10", "(7/10)", "7/10" no final etc.
    const descricaoLimpa = memo
      .replace(/\s*[-\u2013\u2014\u00b7:]?\s*parcelas?\s*[:\-]?\s*\d{1,3}\s*\/\s*\d{1,3}\s*\)?/gi, ' ')
      .replace(/\s+\(?\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s\-\u2013\u2014\u00b7:]+$/, '')
      .trim();
    lancamentos.push({
      data,
      descricao: descricaoLimpa || memo.trim(),
      valor,
      fitid: fitid || null,
      parcela_atual: parcAtual,
      total_parcelas: parcTotal,
    });
  }
  return lancamentos;
}

function ofxExtrairTag(texto, tag) {
  // Suporte SGML: <TAG>valor e XML: <TAG>valor</TAG>
  const m = texto.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}

function ofxParseData(dtStr) {
  // Formato OFX: YYYYMMDDHHMMSS ou YYYYMMDD
  if (!dtStr || dtStr.length < 8) return null;
  const y = dtStr.slice(0,4), m = dtStr.slice(4,6), d = dtStr.slice(6,8);
  return `${y}-${m}-${d}`;
}

function ofxDetectarBanco(texto) {
  const fi = ofxExtrairTag(texto, 'FI') || ofxExtrairTag(texto, 'ORG') || '';
  const amostra = (fi + ' ' + texto.slice(0, 1500)).toLowerCase();
  // Nubank aparece como "NU PAGAMENTOS S.A.", "NU PAGAMENTOS", "NUBANK", "260"(ISPB), etc.
  if (/nubank|nu pagamentos|nu financeira|260\b/.test(amostra)) return 'Nubank';
  if (/bradesco/.test(amostra)) return 'Bradesco';
  if (/banco inter|inter\b|077\b/.test(amostra)) return 'Inter';
  if (/ita[u?]|341\b/.test(amostra)) return 'Ita?';
  if (/santander|033\b/.test(amostra)) return 'Santander';
  if (/banco do brasil|001\b/.test(amostra)) return 'Banco do Brasil';
  if (/caixa|104\b/.test(amostra)) return 'Caixa';
  if (/c6 ?bank|336\b/.test(amostra)) return 'C6 Bank';
  if (/sicoob|756\b/.test(amostra)) return 'Sicoob';
  if (/sicredi|748\b/.test(amostra)) return 'Sicredi';
  return fi || 'Banco';
}

// Apelidos/sin?nimos conhecidos para casar o banco com o fornecedor cadastrado.
const FATURA_BANCO_APELIDOS = {
  'nubank': ['nubank', 'nu', 'nupagamentos', 'nu pagamentos', 'nu financeira'],
  'inter': ['inter', 'bancointer', 'banco inter'],
  'bradesco': ['bradesco'],
  'itau': ['itau', 'ita?', 'itauunibanco'],
  'santander': ['santander'],
  'bancodobrasil': ['bancodobrasil', 'bb', 'banco do brasil'],
  'caixa': ['caixa', 'caixaeconomica', 'cef'],
  'c6bank': ['c6', 'c6bank'],
  'sicoob': ['sicoob'],
  'sicredi': ['sicredi'],
};
// ································?

function faturaSelecionarTodas(checked) {
  _faturaItensExtraidos.forEach(i => i.selecionado = checked);
  document.querySelectorAll('#faturaListaItens input[type=checkbox]').forEach(cb => cb.checked = checked);
  faturaAtualizarFooter();
}

function financeiroChaveDuplicidadeConta(linha = {}) {
  return [
    String(linha.fornecedor_id || ''),
    String(linha.data_compra || '').slice(0, 10),
    String(linha.data_vencimento || '').slice(0, 10),
    Math.round(Number(linha.valor_compra || 0) * 100),
  ].join('|');
}

async function financeiroBuscarDuplicidadesContas(linhas = [], { lojaId = '', ignorarIds = [] } = {}) {
  const itens = (linhas || []).filter(l =>
    l?.fornecedor_id &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(l.data_compra || '')) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(l.data_vencimento || '')) &&
    Number(l.valor_compra || 0) > 0
  );
  if (!itens.length || !lojaId) return [];
  const ignorar = new Set((ignorarIds || []).map(id => String(id)));
  const vistos = new Set();
  const duplicados = [];

  for (const linha of itens) {
    const chaveLinha = financeiroChaveDuplicidadeConta(linha);
    if (vistos.has(chaveLinha)) continue;
    vistos.add(chaveLinha);
    try {
      const consultar = () => sb
        .from('contasapagar')
        .select('id, fornecedor_id, valor_compra, data_compra, data_vencimento, observacao, criado_por_nome, created_at, loja_id, fornecedores(nome)')
        .eq('loja_id', lojaId)
        .eq('fornecedor_id', linha.fornecedor_id)
        .eq('data_compra', linha.data_compra)
        .eq('data_vencimento', linha.data_vencimento)
        .eq('valor_compra', Number(Number(linha.valor_compra || 0).toFixed(2)))
        .is('excluido_em', null)
        .limit(5);
      const { data, error } = typeof executarSemFiltrosTenantTemporario === 'function'
        ? await executarSemFiltrosTenantTemporario(consultar)
        : await consultar();
      if (error) {
        console.warn('Nao foi possivel verificar duplicidade de conta:', error);
        continue;
      }
      (data || [])
        .filter(row => !ignorar.has(String(row.id)))
        .forEach(row => duplicados.push({ linha, existente: row }));
    } catch (e) {
      console.warn('Falha ao verificar duplicidade de conta:', e?.message || e);
    }
  }
  return duplicados;
}

async function financeiroDecidirDuplicidadeContas(duplicados = [], { titulo = 'Conta possivelmente duplicada' } = {}) {
  if (!duplicados.length) return 'sem_duplicidade';
  const linhas = duplicados.slice(0, 6).map(({ linha, existente }) => {
    const fornecedor = existente?.fornecedores?.nome || 'Fornecedor';
    const pessoa = existente?.criado_por_nome || 'Sistema';
    const cadastro = formatarDataBRFinanceiro(String(existente?.created_at || '').slice(0, 10));
    return `
      <div class="nc-confirm-line fatura-confirm-line">
        <span>${escaparHtmlBasico(fornecedor)}</span>
        <strong>${formatarMoedaBRFinanceiro(linha.valor_compra)} <small>Compra: ${formatarDataBRFinanceiro(linha.data_compra)} · Venc: ${formatarDataBRFinanceiro(linha.data_vencimento)}</small><em>Lan?ada por ${escaparHtmlBasico(pessoa)}${cadastro ? ' em ' + escaparHtmlBasico(cadastro) : ''}</em></strong>
      </div>
    `;
  }).join('');
  const extra = duplicados.length > 6
    ? `<div class="item-detalhe" style="text-align:center;">+ ${duplicados.length - 6} duplicidade(s)</div>`
    : '';
  if (typeof abrirConfirmacaoSistema !== 'function') {
    return window.confirm('J? existe conta igual. Deseja lançar mesmo assim?') ? 'lancar' : 'cancelar_total';
  }
  const decisao = await abrirConfirmacaoSistema({
    title: titulo,
    subtitle: 'Ja existe conta ativa com mesmo fornecedor, valor, compra e vencimento.',
    body: `<div class="nc-confirm-lines">${linhas}${extra}</div>`,
    cancelText: 'Cancelar',
    cancelClass: 'btn-red',
    neutralText: 'Voltar',
    neutralClass: 'btn-ghost',
    extraText: 'Ignorar duplicado(s)',
    extraClass: 'btn-amber',
    confirmText: 'Lan\u00e7ar mesmo assim',
    confirmClass: 'btn-green',
  });
  if (decisao.acao === 'extra') return 'ignorar';
  if (decisao.acao === 'neutro') return 'cancelar';
  if (decisao.confirmado) return 'lancar';
  return 'cancelar_total';
}

async function faturaConfirmarLancamentoSelecionados(selecionados) {
  if (typeof abrirConfirmacaoSistema !== 'function') return true;
  const total = (selecionados || []).reduce((s, i) => s + Number(i.valor || 0), 0);
  const semCategoria = selecionados.filter(i => !i.categoria_id).length;
  const semFornecedor = selecionados.filter(i => !i.fornecedor_id).length;
  const semFornecedorObrigatorio = selecionados.filter(i => i._exigeFornecedorManual && !i.fornecedor_id);
  if (semFornecedorObrigatorio.length) {
    await abrirConfirmacaoSistema({
      title: 'Escolha o fornecedor',
      subtitle: 'Importa·o por imagem exige confer?ncia manual.',
      body: `<div class="msg err">Selecione o fornecedor de ${semFornecedorObrigatorio.length} compra(s) antes de lan\u00e7ar.</div>`,
      cancelText: 'Voltar',
      cancelClass: 'btn-ghost',
      confirmText: 'OK',
      confirmClass: 'btn-green',
    });
    return false;
  }
  const linhas = selecionados.slice(0, 8).map(item => {
    const fornecedor = faturaObterFornecedorItem(item);
    const categoria = faturaObterCategoriaItem(item);
    const vencimento = formatarDataBRFinanceiro(String(item.vencimento_fatura || item.data || '').slice(0, 10));
    const observacao = String(item._obsManual != null ? item._obsManual : (item.descricao || '')).trim();
    return `
      <div class="nc-confirm-line fatura-confirm-line">
        <span>${escaparHtmlBasico(item.descricao || 'Compra')}</span>
        <strong>${formatarMoedaBRFinanceiro(item.valor)} <small>Venc: ${escaparHtmlBasico(vencimento || '-')}</small><em>${escaparHtmlBasico(fornecedor?.nome || 'Novo fornecedor')} - ${escaparHtmlBasico(categoria?.nome || 'Sem categoria')}</em><em class="fatura-confirm-observacao">Obs.: ${escaparHtmlBasico(observacao || '-')}</em></strong>
      </div>
    `;
  }).join('');
  const extras = selecionados.length > 8
    ? `<div class="item-detalhe" style="text-align:center;">+ ${selecionados.length - 8} lançamento(s)</div>`
    : '';
  const avisos = [
    semFornecedor ? `${semFornecedor} item(ns) sem fornecedor selecionado serão criados como novo fornecedor.` : '',
    semCategoria ? `${semCategoria} item(ns) estão sem categoria.` : '',
  ].filter(Boolean).join(' ');
  const body = `
    <div class="nc-confirm-lines">
      <div class="nc-confirm-line"><span>TOTAL</span><strong>${selecionados.length} item(ns) · ${formatarMoedaBRFinanceiro(total)}</strong></div>
      ${linhas}
      ${extras}
    </div>
    ${avisos ? `<div class="msg err" style="margin-top:10px;">${escaparHtmlBasico(avisos)}</div>` : ''}
  `;
  const decisao = await abrirConfirmacaoSistema({
    title: 'Conferir lançamentos',
    subtitle: 'Confira antes de salvar no contas a pagar.',
    body,
    cancelText: 'Voltar e ajustar',
    cancelClass: 'btn-ghost',
    confirmText: 'OK, lan\u00e7ar',
    confirmClass: 'btn-green',
  });
  return decisao?.confirmado !== false;
}

async function faturaLancarSelecionados() {
  const selecionados = _faturaItensExtraidos.filter(i => i.selecionado);
  if (!selecionados.length) { alert('Selecione pelo menos um item.'); return; }
  const semFornecedorObrigatorio = selecionados.filter(i => i._exigeFornecedorManual && !i.fornecedor_id);
  if (semFornecedorObrigatorio.length) {
    alert(`Selecione o fornecedor de ${semFornecedorObrigatorio.length} compra(s) antes de lan\u00e7ar.`);
    return;
  }

  const confirmou = await faturaConfirmarLancamentoSelecionados(selecionados);
  if (!confirmou) return;

  const btn = document.getElementById('btnFaturaLancar');
  if (btn) { btn.textContent = 'Lan\u00e7ando...'; btn.disabled = true; }

  // Resolver loja/empresa de forma robusta (mesma l?gica do cadastro manual).
  // Ã‰ a causa mais comum do erro 400: loja_id/empresa_id vindo nulo.
  let tenant;
  try {
    tenant = await resolverTenantFornecedorFinanceiro();
  } catch (eTenant) {
    if (btn) { btn.textContent = 'Lan\u00e7ar selecionados'; btn.disabled = false; }
    alert(eTenant?.message || 'N?o foi poss?vel identificar a loja/empresa. Fa?a login novamente ou selecione uma loja ativa.');
    return;
  }
  const lojaId = tenant.loja_id;
  const empresaId = tenant.empresa_id;
  const ator = (typeof obterAtorAuditoriaAtual === 'function') ? obterAtorAuditoriaAtual() : {};
  const criadoPorId = ator?.funcionarioId || null;
  const criadoPorNome = ator?.nome || usuarioSistemaLogado?.nome || 'Sistema';

  let erros = 0;
  let lancados = 0;
  let titulosLancados = 0;
  let titulosComParcelas = 0;
  let primeiroErro = '';
  const itensComErro = [];

  // Traduz erros t?cnicos do banco para uma linguagem clara para o usu?rio.
  const traduzirErroImportacao = (e) => {
    const bruto = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(' - ');
    const txt = bruto.toLowerCase();
    if (String(e?.code) === 'PARCELA_DUPLICADA') {
      return 'Lançamento DUPLICADO ? esta parcela já foi provisionada em uma importa·o anterior nesta loja (o sistema reconhece pelo n? da parcela, valor e fornecedor, j? que o c?digo do banco muda a cada fatura). Bloqueado para evitar conta em dobro.';
    }
    if (String(e?.code) === '23505' || txt.includes('uix_contasapagar_ofx_fitid_loja') || txt.includes('duplicate key')) {
      return 'Lançamento DUPLICADO ? este item já foi importado antes nesta loja. O sistema bloqueou para evitar conta em dobro. Se quiser lançar mesmo assim, cadastre manualmente.';
    }
    if (String(e?.code) === '23503' || txt.includes('foreign key')) {
      return 'Refer?ncia inv?lida ? fornecedor, categoria ou loja n?o encontrado no banco.';
    }
    if (String(e?.code) === '42501' || txt.includes('row-level security') || txt.includes('permission')) {
      return 'Sem permissão para lançar nesta loja. Verifique o login e a loja ativa.';
    }
    if (String(e?.code) === '23502' || txt.includes('not-null') || txt.includes('null value')) {
      return 'Campo obrigat?rio vazio ? confira data, valor e fornecedor do item.';
    }
    return (typeof mensagemErroSupabase === 'function')
      ? mensagemErroSupabase(e, 'erro desconhecido')
      : (e?.message || 'erro desconhecido');
  };

  // Destaca visualmente na lista do importador o item que falhou.
  const marcarItemComErroNaLista = (it, motivo) => {
    try {
      const row = document.getElementById('faturaItem_' + it.id);
      if (!row) return;
      row.style.border = '1px solid var(--red)';
      row.style.boxShadow = '0 0 0 2px var(--red-glow)';
      row.style.opacity = '1';
      if (!row.querySelector('.fatura-item-erro')) {
        const aviso = document.createElement('div');
        aviso.className = 'fatura-item-erro';
        aviso.style.cssText = 'margin-top:6px;font-size:11px;font-weight:700;color:var(--red);background:var(--red-glow);border-radius:6px;padding:4px 8px;';
        aviso.textContent = '? Não lançado: ' + motivo;
        row.appendChild(aviso);
      }
    } catch (_) { /* destaque visual ? opcional */ }
  };

  // Trava extra contra duplicidade de PARCELAS: o FITID muda a cada fatura,
  // ent?o o ?ndice ?nico sozinho n?o pega parcela j? provisionada em
  // importa·o anterior. Busca as parcelas ativas da loja uma ?nica vez.
  let parcelasExistentesLoja = [];
  if (selecionados.some(i => i.parcela_atual && i.total_parcelas)) {
    try {
      const { data: pData, error: pErr } = await executarSemFiltrosTenantTemporario(() => sb
        .from('contasapagar')
        .select('id, ofx_fitid, fornecedor_id, valor_compra, data_compra, data_vencimento, numero_parcela, qtd_parcelas, loja_id')
        .not('numero_parcela', 'is', null)
        .is('excluido_em', null));
      if (!pErr) {
        parcelasExistentesLoja = (pData || []).filter(r => String(r.loja_id || '').trim() === String(lojaId || '').trim());
      }
    } catch (ePar) {
      console.warn('Checagem de parcelas existentes indisponível:', ePar?.message || ePar);
    }
  }

  for (const item of selecionados) {
    try {
      // Resolver ou criar fornecedor
      let fornecedorId = item.fornecedor_id || null;
      if (!fornecedorId) {
        const descr = String(item.descricao || '').trim();
        const chave = descr.toLowerCase().slice(0, 6);
        const similar = chave
          ? (fornecedoresFinanceiroCache || []).find(f => String(f.nome || '').toLowerCase().includes(chave))
          : null;
        if (similar) {
          fornecedorId = similar.id;
        } else {
          const { data: novoForn, error: errForn } = await sb.from('fornecedores').insert([{
            nome: (descr || 'FORNECEDOR IMPORTADO').toUpperCase(),
            loja_id: lojaId,
            empresa_id: empresaId,
          }]).select('id').single();
          if (errForn) throw errForn;
          if (novoForn) fornecedorId = novoForn.id;
        }
      }

      if (!fornecedorId) { throw new Error('N?o foi poss?vel resolver o fornecedor.'); }

      const hojeISO = new Date().toISOString().slice(0,10);
      const ehDataValida = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '').trim());

      // data_compra nunca pode ser vazia
      const dataCompra = ehDataValida(item.data) ? item.data : hojeISO;
      // vencimento: usa o do arquivo; se inv?lido, cai para a data da compra
      const vencimentoBase = ehDataValida(item.vencimento_fatura) ? item.vencimento_fatura : dataCompra;

      const ehParceladoOFX = item.total_parcelas && item.parcela_atual;
      // Bloqueio duro: esta parcela já existe (provisionada em importação anterior)?
      if (ehParceladoOFX && parcelasExistentesLoja.length) {
        const dupParcela = faturaEncontrarParcelaExistente(item, parcelasExistentesLoja, fornecedorId);
        if (dupParcela) {
          // Aproveita para vincular o FITID deste m?s ? parcela existente.
          if (dupParcela.id && item.fitid && !dupParcela.ofx_fitid) {
            try {
              await sb.from('contasapagar')
                .update({ ofx_fitid: String(item.fitid) })
                .eq('id', dupParcela.id)
                .is('excluido_em', null)
                .is('ofx_fitid', null);
              dupParcela.ofx_fitid = String(item.fitid);
            } catch (_) { /* v?nculo ? opcional */ }
          }
          throw { code: 'PARCELA_DUPLICADA' };
        }
      }
      const qtdParcelas = ehParceladoOFX
        ? item.total_parcelas - item.parcela_atual + 1  // parcelas restantes incluindo atual
        : Math.max(1, parseInt(item._parcelasManuais, 10) || 1); // provisionamento manual
      const intervaloDias = 30;
      const grupoId = gerarGrupoParcelasIdFinanceiro?.() || crypto.randomUUID();
      // Dia de vencimento do fornecedor, para provisionamento mensal "calend?rio".
      const fornObjLanc = (fornecedoresFinanceiroCache || []).find(f => String(f.id) === String(fornecedorId)) || null;
      const diaVencForn = fornObjLanc?.dia_vencimento;
      const dividirValorTotal = !ehParceladoOFX && item._modoValorParcelas !== 'parcela' && qtdParcelas > 1;
      const valorTotalCentavos = Math.round(Number(item.valor || 0) * 100);
      const valorBaseCentavos = dividirValorTotal ? Math.floor(valorTotalCentavos / qtdParcelas) : valorTotalCentavos;
      const centavosRestantes = dividirValorTotal ? valorTotalCentavos % qtdParcelas : 0;

      // Gerar linhas das parcelas (campos id?nticos ao cadastro manual que funciona)
      const linhas = Array.from({ length: qtdParcelas }, (_, i) => {
        // Vencimentos:
        //  - Parcela ATUAL do OFX (i=0): respeita o vencimento definido na revis?o.
        //  - Parcelas seguintes (OFX) e provisionamento manual: se o fornecedor tem
        //    dia de vencimento configurado, avan?a m?s a m?s mantendo esse dia;
        //    sen?o, soma 30 dias (comportamento antigo).
        let venc;
        if (ehParceladoOFX && i === 0) {
          venc = ehDataValida(vencimentoBase) ? vencimentoBase : dataCompra;
        } else if (diaVencForn) {
          const baseISO = ehDataValida(vencimentoBase) ? vencimentoBase : dataCompra;
          const dBase = new Date(`${baseISO}T12:00:00`);
          const anoB = dBase.getFullYear();
          const mesB = dBase.getMonth(); // 0-11
          const alvoMes = mesB + i;
          const anoV = anoB + Math.floor(alvoMes / 12);
          const mesV = (alvoMes % 12) + 1; // 1-12
          const ultimoDia = new Date(anoV, mesV, 0).getDate();
          const diaFinal = Math.min(Number(diaVencForn), ultimoDia);
          venc = `${anoV}-${String(mesV).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
        } else {
          venc = adicionarDiasDataISOFinanceiro(vencimentoBase, i * intervaloDias) || vencimentoBase;
        }
        venc = ajustarVencimentoParaDiaUtilFinanceiro(venc); // s?b/dom/feriado ? dia ?til
        const numeroParcela = ehParceladoOFX ? item.parcela_atual + i : i + 1;
        const totalRotulo = ehParceladoOFX ? item.total_parcelas : qtdParcelas;
        return {
          fornecedor_id: fornecedorId,
          categoria_id: item.categoria_id || null,
          loja_id: lojaId,
          empresa_id: empresaId,
          data_compra: dataCompra,
          data_pagamento: null,
          data_vencimento: venc,
          // Distribui eventual diferenca de centavos nas primeiras parcelas,
          // garantindo que a soma final seja exatamente o valor informado.
          valor_compra: dividirValorTotal
            ? (valorBaseCentavos + (i < centavosRestantes ? 1 : 0)) / 100
            : Number(Number(item.valor || 0).toFixed(2)),
          observacao: (() => {
            const obsItem = String(item._obsManual != null ? item._obsManual : (item.descricao || '')).trim();
            const base = obsItem ? `${obsItem} · Importado do arquivo bancário` : 'Importado do arquivo bancário';
            return (qtdParcelas > 1 || ehParceladoOFX) ? `${base} · ${numeroParcela}/${totalRotulo}` : base;
          })(),
          qtd_parcelas: ehParceladoOFX ? item.total_parcelas : qtdParcelas,
          intervalo_parcelas_dias: qtdParcelas > 1 ? intervaloDias : null,
          numero_parcela: numeroParcela,
          grupo_parcelas_id: grupoId,
          ofx_fitid: i === 0 ? (item.fitid || null) : null,
          criado_por_id: criadoPorId,
          criado_por_nome: criadoPorNome,
        };
      });

      const duplicadosConta = await financeiroBuscarDuplicidadesContas(linhas, { lojaId });
      if (duplicadosConta.length) {
        const decisaoDuplicado = await financeiroDecidirDuplicidadeContas(duplicadosConta, {
          titulo: 'Conta possivelmente duplicada',
        });
        if (decisaoDuplicado === 'cancelar_total') {
          if (btn) { btn.textContent = 'Lan\u00e7ar selecionados'; btn.disabled = false; }
          fecharImportadorFatura();
          if (typeof abrirPagina === 'function') {
            abrirPagina('financeiro_contasapagar', document.querySelector('.nav-btn[data-page="financeiro_contasapagar"]'));
          }
          return;
        }
        if (decisaoDuplicado === 'cancelar') {
          if (btn) { btn.textContent = 'Lan\u00e7ar selecionados'; btn.disabled = false; }
          return;
        }
        if (decisaoDuplicado === 'ignorar') {
          item.selecionado = false;
          item._jaLancado = true;
          item._motivoConciliacao = 'duplicidade';
          marcarItemComErroNaLista(item, 'Ignorado: já existe conta com mesmo fornecedor, valor, compra e vencimento.');
          continue;
        }
      }

      const { error } = await sb.from('contasapagar').insert(linhas);
      if (error) throw error;
      // Alimenta a lista de parcelas existentes: se o MESMO arquivo trouxer o
      // item repetido, a duplicata ? barrada ainda nesta importa·o.
      if (ehParceladoOFX) {
        linhas.forEach(l => parcelasExistentesLoja.push({
          id: null, ofx_fitid: l.ofx_fitid, fornecedor_id: l.fornecedor_id,
          valor_compra: l.valor_compra, data_compra: l.data_compra,
          data_vencimento: l.data_vencimento, numero_parcela: l.numero_parcela,
          qtd_parcelas: l.qtd_parcelas, loja_id: l.loja_id,
        }));
      }
      lancados += linhas.length;
      titulosLancados += 1;
      if (linhas.length > 1) titulosComParcelas += 1;
    } catch(e) {
      console.error('Erro ao lançar item:', item.descricao, e);
      const motivo = traduzirErroImportacao(e);
      if (!primeiroErro) primeiroErro = motivo;
      itensComErro.push({
        descricao: String(item.descricao || 'Item sem descri·o').trim(),
        valor: item.valor,
        data: item.data,
        motivo,
      });
      item._erroLancamento = motivo;
      marcarItemComErroNaLista(item, motivo);
      erros++;
    }
  }

  // Atualizar cache de fornecedores
  await carregarFornecedoresFinanceiro();

  // Aprendizado: salvar as categorias escolhidas nesta importa·o (mem?ria).
  await faturaSalvarMemoriaCategorias(selecionados);
  await faturaSalvarMemoriaInteligente(selecionados);

  // Auditoria: registrar esta importa·o (quem/quando/quantos).
  try {
    const valorTotalSel = selecionados.reduce((s, i) => s + Number(i.valor || 0), 0);
    const vencLog = (selecionados.find(i => /^\d{4}-\d{2}-\d{2}$/.test(String(i.vencimento_fatura || '')))?.vencimento_fatura) || null;
    await sb.from('fatura_importacoes_log').insert([{
      loja_id: lojaId,
      empresa_id: empresaId,
      banco_detectado: _faturaBancoDetectado || null,
      arquivo_nome: _faturaArquivoNome || null,
      vencimento_fatura: vencLog,
      total_itens: selecionados.length,
      total_lancados: lancados,
      total_erros: erros,
      valor_total: Number(valorTotalSel.toFixed(2)),
      detalhe: {
        itens: selecionados.map(i => ({
          descricao: i.descricao, valor: i.valor, data: i.data,
          fornecedor_id: i.fornecedor_id || null, categoria_id: i.categoria_id || null,
          parcela_atual: i.parcela_atual || null, total_parcelas: i.total_parcelas || null,
        })),
        primeiro_erro: primeiroErro || null,
        itens_com_erro: itensComErro.length ? itensComErro : null,
      },
      criado_por_id: criadoPorId,
      criado_por_nome: criadoPorNome,
    }]);
  } catch (eLog) {
    console.warn('Não foi possível gravar o log de importação (rode o SQL de importação):', eLog?.message || eLog);
  }

  if (btn) { btn.textContent = 'Lan\u00e7ar selecionados'; btn.disabled = false; }

  const resumoParcelas = titulosComParcelas
    ? ` (${titulosLancados} t?tulo(s), incluindo ${titulosComParcelas} parcelado(s) ✅ ${lancados} parcelas no total)`
    : ` (${titulosLancados} t?tulo(s))`;

  let msg;
  if (erros === 0) {
    msg = `✅ ${lancados} lançamento(s) importados com sucesso!${resumoParcelas}`;
  } else {
    const fmtValor = (v) => (typeof formatarMoedaBRFinanceiro === 'function')
      ? formatarMoedaBRFinanceiro(v)
      : `R$ ${Number(v || 0).toFixed(2)}`;
    const fmtData = (d) => (typeof formatarDataBRFinanceiro === 'function' && d)
      ? formatarDataBRFinanceiro(d)
      : (d || 's/ data');
    const listaErros = itensComErro.map((it, idx) =>
      `${idx + 1}) ? ${it.descricao.toUpperCase()} ? ${fmtValor(it.valor)} ? compra ${fmtData(it.data)}\n   Motivo: ${it.motivo}`
    ).join('\n\n');
    msg = `${lancados ? `✅ ${lancados} lançados com sucesso${resumoParcelas}\n` : ''}⚠️ ${erros} item(ns) NÃO foi(ram) lançado(s):\n\n${listaErros}\n\nOs itens com erro ficaram destacados em vermelho na lista para você revisar.`;
  }

  // S? fecha o modal se tudo deu certo; se houve erro, mant?m aberto para o usu?rio corrigir.
  if (erros === 0) fecharImportadorFatura();

  // Recarregar lista de contas
  if (typeof carregarContasAPagarFinanceiro === 'function') await carregarContasAPagarFinanceiro();

  alert(msg);
}
// ·································
async function carregarGruposFornecedor() {
  const lista = document.getElementById('listaGruposFornecedor');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const { data, error } = await sb.from('grupos_fornecedor').select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    gruposFornecedorCache = data || [];
    preencherSelectGruposFornecedor();
    if (!gruposFornecedorCache.length) {
      lista.innerHTML = '<div class="empty">Nenhum grupo cadastrado.</div>'; return;
    }
    lista.innerHTML = '<div class="lista">' + gruposFornecedorCache.map(g => `
      <div class="item">
        <div class="item-info">
          <div class="item-nome">${escaparHtmlBasico(g.nome)}</div>
          ${g.descricao ? `<div class="item-detalhe">${escaparHtmlBasico(g.descricao)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" onclick="editarGrupoFornecedor('${g.id}')">Editar</button>
          <button class="btn btn-red btn-sm" onclick="excluirGrupoFornecedor('${g.id}')">Excluir</button>
        </div>
      </div>`).join('') + '</div>';
  } catch(e) {
    lista.innerHTML = `<div class="empty">Erro: ${mensagemErroSupabase(e, e?.message||'')}</div>`;
  }
}

function preencherSelectGruposFornecedor() {
  const opts = '<option value="">Sem grupo</option>' +
    gruposFornecedorCache.map(g => `<option value="${g.id}">${escaparHtmlBasico(g.nome)}</option>`).join('');
  ['fornecedorGrupoId','filtroRelFinanceiroGrupo','filtroRelRecebGrupo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const prev = el.value;
      el.innerHTML = id.includes('filtro')
        ? '<option value="">Todos os grupos</option>' + gruposFornecedorCache.map(g => `<option value="${g.id}">${escaparHtmlBasico(g.nome)}</option>`).join('')
        : opts;
      if (prev) el.value = prev;
    }
  });
}

async function salvarGrupoFornecedor() {
  const nome = String(document.getElementById('grupoFornecedorNome')?.value || '').trim();
  const desc = String(document.getElementById('grupoFornecedorDesc')?.value || '').trim();
  if (!nome) { setMsg('msgGrupoFornecedor', 'Informe o nome do grupo.', 'err'); return; }
  let tenantGrupo;
  try {
    tenantGrupo = await resolverTenantFornecedorFinanceiro();
  } catch (eTenant) {
    setMsg('msgGrupoFornecedor', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
    return;
  }
  const payload = { nome, descricao: desc || null, empresa_id: tenantGrupo.empresa_id, loja_id: tenantGrupo.loja_id, ativo: true };
  try {
    const { error } = grupoFornecedorEmEdicaoId
      ? await sb.from('grupos_fornecedor').update(payload).eq('id', grupoFornecedorEmEdicaoId)
      : await sb.from('grupos_fornecedor').insert([payload]);
    if (error) throw error;
    cancelarEdicaoGrupoFornecedor();
    setMsg('msgGrupoFornecedor', 'Grupo salvo.', 'ok');
    await carregarGruposFornecedor();
  } catch(e) { setMsg('msgGrupoFornecedor', 'Erro: ' + (mensagemErroSupabase(e, e?.message||'')), 'err'); }
}

function editarGrupoFornecedor(id) {
  const g = gruposFornecedorCache.find(x => x.id === id);
  if (!g) return;
  grupoFornecedorEmEdicaoId = id;
  const n = document.getElementById('grupoFornecedorNome');
  const d = document.getElementById('grupoFornecedorDesc');
  if (n) n.value = g.nome || '';
  if (d) d.value = g.descricao || '';
  const btn = document.getElementById('btnCancelarGrupoFornecedor');
  if (btn) btn.style.display = '';
}

function cancelarEdicaoGrupoFornecedor() {
  grupoFornecedorEmEdicaoId = null;
  ['grupoFornecedorNome','grupoFornecedorDesc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const btn = document.getElementById('btnCancelarGrupoFornecedor');
  if (btn) btn.style.display = 'none';
  setMsg('msgGrupoFornecedor', '', '');
}

async function excluirGrupoFornecedor(id) {
  if (!confirm('Excluir este grupo?')) return;
  try {
    const { error } = await sb.from('grupos_fornecedor').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    await carregarGruposFornecedor();
  } catch(e) { alert('Erro: ' + (e?.message||'')); }
}

// ·································
// CATEGORIAS DE COMPRA
// ·································
let categoriaEmEdicaoId = null;
let categoriasCompraCache = [];
let categoriaInlineEmEdicaoId = null;

function ehImagemCategoriaCompra(valor = '') {
  const fonte = String(valor || '').trim();
  return /^https?:\/\//i.test(fonte)
    || /^data:image\/(?:png|jpe?g|webp);base64,/i.test(fonte);
}

function htmlIconeCategoriaCompra(valor = '', tamanho = 24) {
  const icone = String(valor || '').trim();
  const px = Math.max(14, Math.min(64, Number(tamanho) || 24));
  if (!icone) return '<span aria-hidden="true">·?</span>';
  if (ehImagemCategoriaCompra(icone)) {
    return `<img src="${escaparHtmlBasico(icone)}" alt="" style="width:${px}px;height:${px}px;object-fit:cover;border-radius:5px;flex:0 0 ${px}px;" onerror="this.style.display='none'">`;
  }
  return `<span aria-hidden="true" style="font-size:${px}px;line-height:1;">${escaparHtmlBasico(icone)}</span>`;
}

function carregarImagemCategoriaCompra(input) {
  const arquivo = input?.files?.[0];
  if (!arquivo) return;
  if (!/^image\/(?:png|jpe?g|webp)$/i.test(String(arquivo.type || ''))) {
    setMsg('msgCategoriaCompra', 'Escolha uma imagem PNG, JPG ou WEBP.', 'err');
    input.value = '';
    return;
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    setMsg('msgCategoriaCompra', 'A imagem deve ter no m?ximo 5 MB.', 'err');
    input.value = '';
    return;
  }

  const leitor = new FileReader();
  leitor.onerror = () => setMsg('msgCategoriaCompra', 'N?o foi poss?vel ler a imagem escolhida.', 'err');
  leitor.onload = () => {
    const imagem = new Image();
    imagem.onerror = () => setMsg('msgCategoriaCompra', 'O arquivo escolhido n?o ? uma imagem v?lida.', 'err');
    imagem.onload = () => {
      const limite = 128;
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth || 1, imagem.naturalHeight || 1));
      const largura = Math.max(1, Math.round((imagem.naturalWidth || 1) * escala));
      const altura = Math.max(1, Math.round((imagem.naturalHeight || 1) * escala));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const contexto = canvas.getContext('2d');
      contexto.drawImage(imagem, 0, 0, largura, altura);
      const imagemComprimida = canvas.toDataURL('image/webp', 0.82);
      const campo = document.getElementById('categoriaIcone');
      if (campo) campo.value = imagemComprimida;
      setMsg('msgCategoriaCompra', 'Imagem preparada. Clique em Salvar para gravar a categoria.', 'ok');
      input.value = '';
    };
    imagem.src = String(leitor.result || '');
  };
  leitor.readAsDataURL(arquivo);
}

function renderizarListaCategoriasCompra() {
  const lista = document.getElementById('listaCategorias');
  if (!lista) return;
  const consultaBruta = String(document.getElementById('consultaCategoriasCompra')?.value || '').trim();
  const consulta = normalizarConsultaContem(consultaBruta);
  const categoriasFiltradas = (categoriasCompraCache || []).filter(categoria =>
    !consulta || normalizarConsultaContem(categoria?.nome || '').includes(consulta)
  );

  if (!(categoriasCompraCache || []).length) {
    lista.innerHTML = '<div class="empty">Nenhuma categoria cadastrada.</div>';
    return;
  }
  if (!categoriasFiltradas.length) {
    lista.innerHTML = `<div class="empty">Nenhuma categoria encontrada contendo "${escaparHtmlBasico(consultaBruta)}" no nome.</div>`;
    return;
  }

  lista.innerHTML = '<div class="lista">' + categoriasFiltradas.map(c => {
    if (String(categoriaInlineEmEdicaoId || '') === String(c.id)) {
      return renderizarFormularioInlineCategoriaCompra(c);
    }
    return `
    <div class="item">
      <div class="item-info" style="display:flex;align-items:center;gap:10px;">
        <span style="width:44px;min-width:44px;display:flex;align-items:center;justify-content:center;">${htmlIconeCategoriaCompra(c.icone, 36)}</span>
        <div>
          <div class="item-nome" style="display:flex;align-items:center;gap:6px;">
            ${escaparHtmlBasico(c.nome)}
            <span style="width:10px;height:10px;border-radius:50%;background:${escaparHtmlBasico(c.cor||'#3b82f6')};display:inline-block;"></span>
          </div>
          ${c.descricao ? `<div class="item-detalhe">${escaparHtmlBasico(c.descricao)}</div>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-ghost btn-sm" onclick="editarCategoriaCompra('${c.id}')">Editar</button>
        <button class="btn btn-red btn-sm" onclick="excluirCategoriaCompra('${c.id}')">Excluir</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function renderizarFormularioInlineCategoriaCompra(categoria) {
  const id = escaparHtmlBasico(categoria.id);
  const nome = escaparHtmlBasico(categoria.nome || '');
  const icone = escaparHtmlBasico(categoria.icone || '');
  const cor = escaparHtmlBasico(categoria.cor || '#3b82f6');
  const descricao = escaparHtmlBasico(categoria.descricao || '');
  return `
    <div class="item categoria-compra-inline-edit" data-categoria-id="${id}">
      <div class="categoria-compra-inline-preview">
        ${htmlIconeCategoriaCompra(categoria.icone, 36)}
      </div>
      <div class="categoria-compra-inline-grid">
        <div class="campo-com-label">
          <label class="campo-label" for="categoriaInlineNome_${id}">Nome</label>
          <input id="categoriaInlineNome_${id}" type="text" value="${nome}" placeholder="Nome da categoria">
        </div>
        <div class="campo-com-label">
          <label class="campo-label" for="categoriaInlineIcone_${id}">Icone, imagem ou URL</label>
          <div class="categoria-compra-inline-icon-row">
            <input id="categoriaInlineIcone_${id}" type="text" value="${icone}" placeholder="Emoji ou URL direta">
            <label class="btn btn-ghost btn-sm categoria-compra-inline-file" title="Escolher uma imagem do computador">
              Imagem
              <input id="categoriaInlineArquivo_${id}" type="file" accept="image/png,image/jpeg,image/webp" onchange="carregarImagemCategoriaCompraInline('${id}', this)" style="display:none;">
            </label>
          </div>
        </div>
        <div class="campo-com-label categoria-compra-inline-cor">
          <label class="campo-label" for="categoriaInlineCor_${id}">Cor</label>
          <input id="categoriaInlineCor_${id}" type="color" value="${cor}">
        </div>
        <div class="campo-com-label categoria-compra-inline-desc">
          <label class="campo-label" for="categoriaInlineDesc_${id}">Descricao</label>
          <input id="categoriaInlineDesc_${id}" type="text" value="${descricao}" placeholder="Opcional">
        </div>
      </div>
      <div class="item-actions categoria-compra-inline-actions">
        <button class="btn btn-green btn-sm" type="button" onclick="salvarCategoriaCompraInline('${id}')">Salvar</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="cancelarEdicaoCategoriaCompraInline()">Cancelar</button>
      </div>
    </div>`;
}

function filtrarCategoriasCompraCadastradas() {
  renderizarListaCategoriasCompra();
}

async function carregarCategoriasCompra() {
  const lista = document.getElementById('listaCategorias');
  if (!lista) return;
  lista.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const { data, error } = await sb.from('categorias_compra').select('*').eq('ativo', true).order('nome');
    if (error) throw error;
    categoriasCompraCache = data || [];
    preencherSelectCategoriasCompra();
    renderizarListaCategoriasCompra();
  } catch(e) {
    lista.innerHTML = `<div class="empty">Erro: ${mensagemErroSupabase(e, e?.message||'')}</div>`;
  }
}

function preencherSelectCategoriasCompra() {
  const opts = '<option value="">Selecione a categoria</option>' +
    categoriasCompraCache.map(c => {
      const ico = c.icone && !ehImagemCategoriaCompra(c.icone) ? c.icone + ' ' : '';
      return `<option value="${c.id}">${ico}${escaparHtmlBasico(c.nome)}</option>`;
    }).join('');
  ['contaCategoriaId'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
  // Categoria do relat?rio agora ? multi-sele·o (checkbox filter) ? renderiza via helper, preservando sele·o atual.
  const catFiltroEl = document.getElementById('filtroRelFinanceiroCategoria');
  if (catFiltroEl && catFiltroEl.classList?.contains('relatorio-check-filter') && typeof renderizarCheckboxFiltroRelatorioFinanceiro === 'function') {
    const selAtual = (typeof obterValoresCheckboxFiltroRelatorioFinanceiro === 'function')
      ? obterValoresCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria') : [];
    const opcoesCat = [
      { valor: '__sem__', rotulo: 'Sem categoria' },
      ...categoriasCompraCache.map(c => ({ valor: String(c.id), rotulo: String(c.nome || '').trim() })),
    ];
    renderizarCheckboxFiltroRelatorioFinanceiro('filtroRelFinanceiroCategoria', opcoesCat, selAtual);
  }
}

async function salvarCategoriaCompra() {
  // Padr?o de cadastro: nome de categoria sempre em MAIÃšSCULAS.
  const nome = String(document.getElementById('categoriaNome')?.value || '').trim().toUpperCase();
  const icone = String(document.getElementById('categoriaIcone')?.value || '').trim();
  const cor = String(document.getElementById('categoriaCor')?.value || '#3b82f6').trim();
  const desc = String(document.getElementById('categoriaDesc')?.value || '').trim();
  if (!nome) { setMsg('msgCategoriaCompra', 'Informe o nome.', 'err'); return; }
  if (/^data:image\//i.test(icone) && !ehImagemCategoriaCompra(icone)) {
    setMsg('msgCategoriaCompra', 'Formato de imagem inv?lido. Use PNG, JPG ou WEBP.', 'err');
    return;
  }
  if (icone.length > 150000) {
    setMsg('msgCategoriaCompra', 'A imagem est? muito grande. Use o bot?o Imagem para comprimi-la antes de salvar.', 'err');
    return;
  }
  let tenantCat;
  try {
    tenantCat = await resolverTenantFornecedorFinanceiro();
  } catch (eTenant) {
    setMsg('msgCategoriaCompra', eTenant?.message || 'Não foi possível identificar a loja/empresa. Faça login novamente ou selecione uma loja ativa.', 'err');
    return;
  }
  const payload = { nome, icone: icone||null, cor, descricao: desc||null, empresa_id: tenantCat.empresa_id, loja_id: tenantCat.loja_id, ativo: true };
  try {
    const { error } = categoriaEmEdicaoId
      ? await sb.from('categorias_compra').update(payload).eq('id', categoriaEmEdicaoId)
      : await sb.from('categorias_compra').insert([payload]);
    if (error) throw error;
    cancelarEdicaoCategoria();
    setMsg('msgCategoriaCompra', 'Categoria salva.', 'ok');
    await carregarCategoriasCompra();
  } catch(e) { setMsg('msgCategoriaCompra', 'Erro: ' + (mensagemErroSupabase(e, e?.message||'')), 'err'); }
}

function editarCategoriaCompra(id) {
  categoriaInlineEmEdicaoId = id;
  if (String(categoriaEmEdicaoId || '') === String(id)) {
    cancelarEdicaoCategoria();
  }
  renderizarListaCategoriasCompra();
  setTimeout(() => {
    const campo = document.getElementById(`categoriaInlineNome_${id}`);
    if (campo) {
      campo.focus();
      campo.select?.();
    }
  }, 0);
}

function cancelarEdicaoCategoriaCompraInline() {
  categoriaInlineEmEdicaoId = null;
  renderizarListaCategoriasCompra();
}

function carregarImagemCategoriaCompraInline(id, input) {
  const arquivo = input?.files?.[0];
  if (!arquivo) return;
  if (!/^image\/(?:png|jpe?g|webp)$/i.test(String(arquivo.type || ''))) {
    setMsg('msgCategoriaCompra', 'Escolha uma imagem PNG, JPG ou WEBP.', 'err');
    input.value = '';
    return;
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    setMsg('msgCategoriaCompra', 'A imagem deve ter no maximo 5 MB.', 'err');
    input.value = '';
    return;
  }

  const leitor = new FileReader();
  leitor.onerror = () => setMsg('msgCategoriaCompra', 'Nao foi possivel ler a imagem escolhida.', 'err');
  leitor.onload = () => {
    const imagem = new Image();
    imagem.onerror = () => setMsg('msgCategoriaCompra', 'O arquivo escolhido nao e uma imagem valida.', 'err');
    imagem.onload = () => {
      const limite = 128;
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth || 1, imagem.naturalHeight || 1));
      const largura = Math.max(1, Math.round((imagem.naturalWidth || 1) * escala));
      const altura = Math.max(1, Math.round((imagem.naturalHeight || 1) * escala));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const contexto = canvas.getContext('2d');
      contexto.drawImage(imagem, 0, 0, largura, altura);
      const campo = document.getElementById(`categoriaInlineIcone_${id}`);
      if (campo) campo.value = canvas.toDataURL('image/webp', 0.82);
      setMsg('msgCategoriaCompra', 'Imagem preparada. Clique em Salvar nesta linha para gravar a categoria.', 'ok');
      input.value = '';
    };
    imagem.src = String(leitor.result || '');
  };
  leitor.readAsDataURL(arquivo);
}

async function salvarCategoriaCompraInline(id) {
  const nome = String(document.getElementById(`categoriaInlineNome_${id}`)?.value || '').trim().toUpperCase();
  const icone = String(document.getElementById(`categoriaInlineIcone_${id}`)?.value || '').trim();
  const cor = String(document.getElementById(`categoriaInlineCor_${id}`)?.value || '#3b82f6').trim();
  const desc = String(document.getElementById(`categoriaInlineDesc_${id}`)?.value || '').trim();
  if (!nome) { setMsg('msgCategoriaCompra', 'Informe o nome.', 'err'); return; }
  if (/^data:image\//i.test(icone) && !ehImagemCategoriaCompra(icone)) {
    setMsg('msgCategoriaCompra', 'Formato de imagem invalido. Use PNG, JPG ou WEBP.', 'err');
    return;
  }
  if (icone.length > 150000) {
    setMsg('msgCategoriaCompra', 'A imagem esta muito grande. Use o botao Imagem para comprimi-la antes de salvar.', 'err');
    return;
  }
  let tenantCat;
  try {
    tenantCat = await resolverTenantFornecedorFinanceiro();
  } catch (eTenant) {
    setMsg('msgCategoriaCompra', eTenant?.message || 'Nao foi possivel identificar a loja/empresa. Faca login novamente ou selecione uma loja ativa.', 'err');
    return;
  }
  const payload = { nome, icone: icone || null, cor, descricao: desc || null, empresa_id: tenantCat.empresa_id, loja_id: tenantCat.loja_id, ativo: true };
  try {
    const { error } = await sb.from('categorias_compra').update(payload).eq('id', id);
    if (error) throw error;
    categoriaInlineEmEdicaoId = null;
    setMsg('msgCategoriaCompra', 'Categoria salva.', 'ok');
    await carregarCategoriasCompra();
  } catch(e) { setMsg('msgCategoriaCompra', 'Erro: ' + (mensagemErroSupabase(e, e?.message||'')), 'err'); }
}

function editarCategoriaCompraNoFormulario(id) {
  const c = categoriasCompraCache.find(x => x.id === id);
  if (!c) return;
  categoriaEmEdicaoId = id;
  const fields = { categoriaNome: c.nome, categoriaIcone: c.icone||'', categoriaCor: c.cor||'#3b82f6', categoriaDesc: c.descricao||'' };
  Object.entries(fields).forEach(([k,v]) => { const el = document.getElementById(k); if (el) el.value = v; });
  const btn = document.getElementById('btnCancelarCategoria');
  if (btn) btn.style.display = '';
}

function cancelarEdicaoCategoria() {
  categoriaEmEdicaoId = null;
  categoriaInlineEmEdicaoId = null;
  ['categoriaNome','categoriaIcone','categoriaDesc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cor = document.getElementById('categoriaCor'); if (cor) cor.value = '#3b82f6';
  const arquivo = document.getElementById('categoriaImagemArquivo'); if (arquivo) arquivo.value = '';
  const btn = document.getElementById('btnCancelarCategoria'); if (btn) btn.style.display = 'none';
  setMsg('msgCategoriaCompra', '', '');
}

async function excluirCategoriaCompra(id) {
  if (!confirm('Excluir esta categoria?')) return;
  try {
    const { error } = await sb.from('categorias_compra').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    await carregarCategoriasCompra();
  } catch(e) { alert('Erro: ' + (e?.message||'')); }
}

// ·································
