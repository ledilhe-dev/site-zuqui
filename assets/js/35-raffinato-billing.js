let rbInitialized = false;
let rbRows = [];
let rbTotals = {};
let rbPeriodLabel = '';

function rbMoney(value) { return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function rbEscape(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char])); }
function rbIsoLocal(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0,10); }
function rbNumber(item, key) { return Number(item?.[key] ?? item?.[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())] ?? 0); }

function definirPeriodoFaturamentoRaffinato(days) {
  const end = new Date(), start = new Date(); start.setDate(end.getDate() - Math.max(0, Number(days) - 1));
  document.getElementById('rbDataInicio').value = rbIsoLocal(start); document.getElementById('rbDataFim').value = rbIsoLocal(end);
  document.getElementById('rbHoraInicio').value = '00:00'; document.getElementById('rbHoraFim').value = '23:59';
}

function rbPeriod() {
  const startDate = document.getElementById('rbDataInicio').value, endDate = document.getElementById('rbDataFim').value;
  const startTime = document.getElementById('rbHoraInicio').value || '00:00', endTime = document.getElementById('rbHoraFim').value || '23:59';
  if (!startDate || !endDate) throw new Error('Informe o período da consulta.');
  const start = `${startDate}T${startTime}:00`, exclusiveDate = new Date(`${endDate}T${endTime}:00`); exclusiveDate.setMinutes(exclusiveDate.getMinutes() + 1);
  const exclusive = `${rbIsoLocal(exclusiveDate)}T${String(exclusiveDate.getHours()).padStart(2,'0')}:${String(exclusiveDate.getMinutes()).padStart(2,'0')}:00`;
  if (new Date(start) >= exclusiveDate) throw new Error('O fim deve ser posterior ao início.');
  return { inicio:start, fim_exclusivo:exclusive, data_inicial:startDate, data_final_exclusiva:rbIsoLocal(exclusiveDate) };
}

async function rbLoadPaymentMethods() {
  const select = document.getElementById('rbFormaPagamento');
  try {
    const context = contextoRaffinato();
    const payload = await raffinatoBridgePost('/api/raffinato/formas-pagamento', { loja_id:context.lojaId });
    const forms = Array.isArray(payload.formas) ? payload.formas : [];
    select.innerHTML = '<option value="">Todas as formas</option>' + forms.map(item => `<option value="${rbEscape(item.id)}">${rbEscape(item.nome)}</option>`).join('');
  } catch (localError) {
    try {
      const context=contextoRaffinato(),payload=await raffinatoRelay({action:'billing_forms',empresa_id:context.empresaId,loja_id:context.lojaId,usuario_id:String(usuarioSistemaLogado?.id||'')});
      const forms=Array.isArray(payload.formas)?payload.formas:[];
      select.innerHTML='<option value="">Todas as formas</option>'+forms.map(item=>`<option value="${rbEscape(item.id)}">${rbEscape(item.nome)}</option>`).join('');
    } catch (relayError) {
      console.error('[Raffinato faturamento] Falha ao carregar formas',{endpoint:'/api/raffinato/formas-pagamento',localError:String(localError),relayError:String(relayError)});
      select.innerHTML='<option value="">Todas as formas</option>';
    }
  }
}

function iniciarTelaFaturamentoRaffinato() {
  if (!rbInitialized) { definirPeriodoFaturamentoRaffinato(1); rbInitialized = true; }
  rbLoadPaymentMethods();
}

function rbBars(entries, formatter = rbMoney) {
  if (!entries.length) return '<div class="empty">Sem dados no período.</div>';
  const max = Math.max(1, ...entries.map(item => Number(item.value || 0)));
  return entries.map(item => `<div class="rb-bar-row"><span class="rb-bar-label" title="${rbEscape(item.label)}">${rbEscape(item.label)}</span><span class="rb-bar-track"><span class="rb-bar-fill" style="width:${Math.max(2,item.value/max*100)}%"></span></span><span class="rb-bar-value">${rbEscape(formatter(item.value,item))}</span></div>`).join('');
}

function rbRender(payload) {
  rbRows = Array.isArray(payload.formas_pagamento) ? payload.formas_pagamento : [];
  rbTotals = payload.totalizadores || {};
  const keys = [['rbTotalMovimento','valor_movimento'],['rbTotalAbertura','valor_abertura'],['rbTotalSuprimento','valor_suprimento'],['rbTotalSangria','valor_sangria'],['rbTotalApurado','valor_apurado'],['rbTotalConfirmado','valor_confirmado']];
  keys.forEach(([id,key]) => document.getElementById(id).textContent = rbMoney(rbNumber(rbTotals,key)));
  if (rbTotals.valor_confirmado === null) document.getElementById('rbTotalConfirmado').textContent = 'Aguardando fechamento';
  ['rbKpis','rbAnalytics','rbTableCard'].forEach(id => document.getElementById(id).hidden = false);
  const ordered = [...rbRows].sort((a,b) => rbNumber(b,'valor_movimento') - rbNumber(a,'valor_movimento'));
  const totalMovement = rbNumber(rbTotals,'valor_movimento');
  document.getElementById('rbChartFormas').innerHTML = rbBars(ordered.map(item => ({label:item.forma_pagamento,value:rbNumber(item,'valor_movimento')})));
  document.getElementById('rbChartParticipacao').innerHTML = rbBars(ordered.map(item => ({label:item.forma_pagamento,value:totalMovement ? rbNumber(item,'valor_movimento')/totalMovement*100 : 0})), value => `${value.toFixed(1).replace('.',',')}%`);
  const evolution = Array.isArray(payload.evolucao) ? payload.evolucao : [];
  const days = new Map(); evolution.forEach(item => days.set(item.data,(days.get(item.data)||0)+rbNumber(item,'valor_movimento')));
  document.getElementById('rbChartEvolucao').innerHTML = rbBars([...days].map(([label,value])=>({label,value})));
  document.getElementById('rbRanking').innerHTML = ordered.map((item,index) => `<div class="rb-ranking-item"><span>${index+1}º ${rbEscape(item.forma_pagamento)}<small>${totalMovement ? (rbNumber(item,'valor_movimento')/totalMovement*100).toFixed(1).replace('.',',') : '0,0'}%</small></span><strong>${rbMoney(rbNumber(item,'valor_movimento'))}</strong></div>`).join('');
  document.getElementById('rbComparison').innerHTML = [['Movimento','valor_movimento'],['Apurado','valor_apurado'],['Confirmado','valor_confirmado']].map(([label,key]) => `<div class="rb-comparison-item"><span>${label}</span><strong>${rbMoney(rbNumber(rbTotals,key))}</strong></div>`).join('');
  const cells = item => [rbEscape(item.forma_pagamento),...['valor_movimento','valor_abertura','valor_suprimento','valor_sangria','valor_apurado'].map(key=>rbMoney(rbNumber(item,key))),item.valor_confirmado_disponivel===false?'—':rbMoney(rbNumber(item,'valor_confirmado'))];
  document.getElementById('rbTableBody').innerHTML = rbRows.map(item => `<tr>${cells(item).map(value=>`<td>${value}</td>`).join('')}</tr>`).join('');
  document.getElementById('rbMobileList').innerHTML = rbRows.map(item => `<article class="rb-payment-card"><h4>${rbEscape(item.forma_pagamento)}</h4><div class="rb-payment-values">${[['Movimento','valor_movimento'],['Abertura','valor_abertura'],['Suprimento','valor_suprimento'],['Sangria','valor_sangria'],['Apurado','valor_apurado'],['Confirmado','valor_confirmado']].map(([label,key])=>`<div>${label}<strong>${key==='valor_confirmado'&&item.valor_confirmado_disponivel===false?'—':rbMoney(rbNumber(item,key))}</strong></div>`).join('')}</div></article>`).join('');
  document.getElementById('rbTableSummary').textContent = `${rbRows.length} forma(s) de pagamento · ${rbPeriodLabel}`;
}

async function consultarFaturamentoRaffinato() {
  const button = document.getElementById('rbQueryBtn'), message = document.getElementById('rbMessage'), status = document.getElementById('rbStatus');
  try {
    const period = rbPeriod(), context = contextoRaffinato(), paymentId = document.getElementById('rbFormaPagamento').value || null;
    rbPeriodLabel = `${period.data_inicial} a ${period.data_final_exclusiva}`; button.disabled = true; button.textContent = 'Consultando Raffinato...'; message.className='msg'; message.textContent='Consultando Raffinato...';
    let payload;
    try {
      payload=await raffinatoBridgePost('/api/raffinato/faturamento',{...period,id_forma_pagamento:paymentId,loja_id:context.lojaId,id_filial:1});
    } catch(localError) {
      const started=performance.now();
      try { payload=await raffinatoRelay({action:'billing_dashboard',inicio:period.inicio,fim_exclusivo:period.fim_exclusivo,id_forma_pagamento:paymentId,empresa_id:context.empresaId,loja_id:context.lojaId,usuario_id:String(usuarioSistemaLogado?.id||'')}); }
      catch(relayError){console.error('[Raffinato faturamento] Falha de consulta',{endpoint:'raffinato-relay/billing_dashboard',method:'POST',localError:String(localError),relayError:String(relayError),elapsedMs:Math.round(performance.now()-started)});throw new Error('Não foi possível consultar o Raffinato.');}
    }
    rbRender(payload); status.classList.add('is-ready'); status.querySelector('strong').textContent=payload.caixa_aberto?(payload.valor_confirmado_parcial?'Dados parciais — caixa em operação':'Caixa aberto — dados parciais'):(payload.origem_consulta==='sincronizacao'?'Dados sincronizados':'Caixa fechado'); message.className='msg ok'; message.textContent=payload.caixa_aberto?'Movimento atual carregado. O valor confirmado estará disponível após o fechamento.':'Consulta concluída.';
  } catch (error) {
    status.classList.remove('is-ready');status.querySelector('strong').textContent='Consulta indisponível';message.className='msg err';message.textContent='Não foi possível consultar o Raffinato.';
  } finally { button.disabled=false; button.textContent='Executar consulta'; }
}

function exportarFaturamentoRaffinatoCsv() {
  if (!rbRows.length) return;
  const header=['Período','Forma de pagamento','Movimento','Abertura','Suprimento','Sangria','Apurado','Confirmado'];
  const rows=rbRows.map(item=>[rbPeriodLabel,item.forma_pagamento,'valor_movimento','valor_abertura','valor_suprimento','valor_sangria','valor_apurado','valor_confirmado'].map((value,index)=>index>1?rbNumber(item,value).toFixed(2).replace('.',','):value));
  const csv='\ufeff'+[header,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); link.download=`faturamento-raffinato-${rbIsoLocal()}.csv`; document.body.appendChild(link); link.click(); URL.revokeObjectURL(link.href); link.remove();
}
