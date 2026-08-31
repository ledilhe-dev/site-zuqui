let rbInitialized = false;
let rbRows = [];
let rbSourceRows = [], rbEvolution = [], rbPaymentFilters = [];
let rbTotals = {};
let rbPeriodLabel = '';

registrarModuloTenantScoped('raffinato-faturamento',()=>{rbRows=[];rbSourceRows=[];rbEvolution=[];rbPaymentFilters=[];rbTotals={};rbPeriodLabel='';['rbKpis','rbCharts','rbTableBody','rbMobileList'].forEach(id=>document.getElementById(id)?.replaceChildren());const msg=document.getElementById('rbMessage');if(msg){msg.className='msg';msg.textContent='Nenhuma consulta realizada para esta loja.'}});

function rbMoney(value) { return Number(value || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function rbEscape(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char])); }
function rbIsoLocal(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0,10); }
function rbNumber(item, key) { return Number(item?.[key] ?? item?.[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())] ?? 0); }

function definirPeriodoFaturamentoRaffinato(days) {
  const end = new Date(), start = new Date(); start.setDate(end.getDate() - Math.max(0, Number(days) - 1));
  document.getElementById('rbDataInicio').value = rbIsoLocal(start); document.getElementById('rbDataFim').value = rbIsoLocal(end);
  document.getElementById('rbHoraInicio').value = '00:00'; document.getElementById('rbHoraFim').value = '23:59';
}

function limparFiltrosFaturamentoRaffinato() {
  definirPeriodoFaturamentoRaffinato(1);
  const payment=document.getElementById('rbFormaPagamento');if(payment)payment.value='';
  const message=document.getElementById('rbMessage');if(message){message.className='msg';message.textContent='Filtros limpos. Período redefinido para hoje.';}
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
  return entries.map(item => { const source=rbSourceRows.find(row=>String(row.forma_pagamento)===String(item.label)),id=item.id??source?.id_forma_pagamento,selected=id!=null&&rbPaymentFilters.includes(String(id)),muted=id!=null&&rbPaymentFilters.length&&!selected,click=id==null?'':`onclick="rbTogglePayment('${rbEscape(id)}')"`; return `<button class="rb-bar-row ${selected?'selected':''} ${muted?'muted':''}" ${click}><span class="rb-bar-label" title="${rbEscape(item.label)}">${rbEscape(item.label)}</span><span class="rb-bar-track"><span class="rb-bar-fill" style="width:${Math.max(2,item.value/max*100)}%"></span></span><span class="rb-bar-value">${rbEscape(formatter(item.value,item))}</span><title>${rbEscape(item.label)}\n${rbEscape(formatter(item.value,item))}</title></button>`; }).join('');
}

function rbTogglePayment(id){const value=String(id),selected=rbPaymentFilters.includes(value);rbPaymentFilters=selected?rbPaymentFilters.filter(x=>x!==value):[...rbPaymentFilters,value];rbRenderInteractive()}
function rbClearChartFilters(){rbPaymentFilters=[];rbRenderInteractive()}
function rbDonut(entries){if(!entries.length)return '<div class="empty">Sem dados no período.</div>';const total=entries.reduce((s,x)=>s+x.value,0)||1,has=rbPaymentFilters.length>0,colors=['#2563eb','#16a34a','#db2777','#ea580c','#7c3aed','#0891b2','#d97706','#64748b'];let offset=0;const slices=entries.map((x,i)=>{const pct=x.value/total*100,start=offset;offset+=pct;const selected=rbPaymentFilters.includes(String(x.id));return `<circle class="rs-donut-slice ${selected?'selected':''} ${has&&!selected?'muted':''}" pathLength="100" cx="60" cy="60" r="45" fill="none" stroke="${colors[i%colors.length]}" stroke-width="18" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${-start}" onclick="rbTogglePayment('${rbEscape(x.id)}')"><title>${rbEscape(x.label)}\n${rbMoney(x.value)}\n${pct.toFixed(1).replace('.',',')}%</title></circle>`}).join(''),legend=entries.map((x,i)=>{const pct=x.value/total*100,selected=rbPaymentFilters.includes(String(x.id));return `<button class="rs-donut-legend ${selected?'selected':''} ${has&&!selected?'muted':''}" onclick="rbTogglePayment('${rbEscape(x.id)}')"><i style="background:${colors[i%colors.length]}"></i><span>${rbEscape(x.label)}</span><strong>${pct.toFixed(1).replace('.',',')}%</strong></button>`}).join('');return `<div class="rs-donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" fill="none" stroke="rgba(148,163,184,.14)" stroke-width="18"></circle>${slices}<text x="60" y="58" text-anchor="middle">Total</text><text x="60" y="72" text-anchor="middle">${rbEscape(rbMoney(total))}</text></svg><div class="rs-donut-legends">${legend}</div></div>`}
function rbRenderInteractive(payload){if(payload){rbSourceRows=Array.isArray(payload.formas_pagamento)?payload.formas_pagamento:[];rbEvolution=Array.isArray(payload.evolucao)?payload.evolucao:[];rbPaymentFilters=[]}const rows=rbSourceRows.filter(x=>!rbPaymentFilters.length||rbPaymentFilters.includes(String(x.id_forma_pagamento))),keys=[['rbTotalMovimento','valor_movimento'],['rbTotalAbertura','valor_abertura'],['rbTotalSuprimento','valor_suprimento'],['rbTotalSangria','valor_sangria'],['rbTotalApurado','valor_apurado'],['rbTotalConfirmado','valor_confirmado']],totals={};for(const [,key] of keys)totals[key]=rows.reduce((s,x)=>s+rbNumber(x,key),0);rbRows=rows;rbTotals=totals;keys.forEach(([id,key])=>document.getElementById(id).textContent=rbMoney(totals[key]));['rbKpis','rbAnalytics','rbTableCard'].forEach(id=>document.getElementById(id).hidden=false);const allOrdered=[...rbSourceRows].sort((a,b)=>rbNumber(b,'valor_movimento')-rbNumber(a,'valor_movimento')),ordered=[...rows].sort((a,b)=>rbNumber(b,'valor_movimento')-rbNumber(a,'valor_movimento')),entries=allOrdered.map(x=>({id:x.id_forma_pagamento,label:x.forma_pagamento,value:rbNumber(x,'valor_movimento')})),totalMovement=totals.valor_movimento||0;document.getElementById('rbChartFormas').innerHTML=rbBars(ordered.map(x=>({label:x.forma_pagamento,value:rbNumber(x,'valor_movimento')})));document.getElementById('rbChartParticipacao').innerHTML=rbDonut(entries);const days=new Map();rbEvolution.filter(x=>!rbPaymentFilters.length||rbPaymentFilters.includes(String(x.id_forma_pagamento))).forEach(x=>days.set(x.data,(days.get(x.data)||0)+rbNumber(x,'valor_movimento')));document.getElementById('rbChartEvolucao').innerHTML=rbBars([...days].map(([label,value])=>({label,value})));document.getElementById('rbRanking').innerHTML=ordered.map((x,i)=>`<div class="rb-ranking-item"><span>${i+1}º ${rbEscape(x.forma_pagamento)}<small>${totalMovement?(rbNumber(x,'valor_movimento')/totalMovement*100).toFixed(1).replace('.',','):'0,0'}%</small></span><strong>${rbMoney(rbNumber(x,'valor_movimento'))}</strong></div>`).join('');document.getElementById('rbComparison').innerHTML=[['Movimento','valor_movimento'],['Apurado','valor_apurado'],['Confirmado','valor_confirmado']].map(([label,key])=>`<div class="rb-comparison-item"><span>${label}</span><strong>${rbMoney(totals[key])}</strong></div>`).join('');const cells=x=>[rbEscape(x.forma_pagamento),...['valor_movimento','valor_abertura','valor_suprimento','valor_sangria','valor_apurado','valor_confirmado'].map(key=>rbMoney(rbNumber(x,key)))];document.getElementById('rbTableBody').innerHTML=rows.map(x=>`<tr>${cells(x).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');document.getElementById('rbMobileList').innerHTML=rows.map(x=>`<article class="rb-payment-card"><h4>${rbEscape(x.forma_pagamento)}</h4><strong>${rbMoney(rbNumber(x,'valor_movimento'))}</strong></article>`).join('');document.getElementById('rbTableSummary').textContent=`${rows.length} forma(s) · ${rbPeriodLabel}`;const active=document.getElementById('rbActive');active.hidden=!rbPaymentFilters.length;document.getElementById('rbChips').innerHTML=rbPaymentFilters.map(id=>{const x=rbSourceRows.find(r=>String(r.id_forma_pagamento)===id);return `<button class="rs-chip" onclick="rbTogglePayment('${rbEscape(id)}')">${rbEscape(x?.forma_pagamento||id)} ×</button>`}).join('')}

const rbRenderInteractiveValidated=rbRenderInteractive;
rbRenderInteractive=function(payload){rbRenderInteractiveValidated(payload);if(payload?.totalizadores?.valor_confirmado===null)document.getElementById('rbTotalConfirmado').textContent='Aguardando fechamento'};

function rbRender(payload) {
  rbRows = Array.isArray(payload.formas_pagamento) ? payload.formas_pagamento : [];
  rbTotals = payload.totalizadores || {};
  const keys = [['rbTotalMovimento','valor_movimento'],['rbTotalAbertura','valor_abertura'],['rbTotalSuprimento','valor_suprimento'],['rbTotalSangria','valor_sangria'],['rbTotalApurado','valor_apurado'],['rbTotalConfirmado','valor_confirmado']];
  keys.forEach(([id,key]) => document.getElementById(id).textContent = rbMoney(rbNumber(rbTotals,key)));
  const openOperations=Array.isArray(payload.operacoes_abertas)?payload.operacoes_abertas:[];
  const openValue=payload.valor_em_aberto!=null?Number(payload.valor_em_aberto):openOperations.reduce((sum,item)=>sum+Number(item.valor||0),0);
  document.getElementById('rbTotalOpen').textContent=rbMoney(openValue);
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
      payload=await raffinatoBridgePost('/api/raffinato/faturamento',{...period,id_forma_pagamento:paymentId,loja_id:context.lojaId});
    } catch(localError) {
      const started=performance.now();
      try { payload=await raffinatoRelay({action:'billing_dashboard',inicio:period.inicio,fim_exclusivo:period.fim_exclusivo,id_forma_pagamento:paymentId,empresa_id:context.empresaId,loja_id:context.lojaId,usuario_id:String(usuarioSistemaLogado?.id||'')}); }
      catch(relayError){console.error('[Raffinato faturamento] Falha de consulta',{endpoint:'raffinato-relay/billing_dashboard',method:'POST',localError:String(localError),relayError:String(relayError),elapsedMs:Math.round(performance.now()-started)});throw new Error('Não foi possível consultar o Raffinato.');}
    }
    document.getElementById('rbTotalOpen').textContent=rbMoney(payload.valor_em_aberto||0);rbRenderInteractive(payload); status.classList.add('is-ready'); status.querySelector('strong').textContent=payload.caixa_aberto?(payload.valor_confirmado_parcial?'Dados parciais — caixa em operação':'Caixa aberto — dados parciais'):(payload.origem_consulta==='sincronizacao'?'Dados sincronizados':'Caixa fechado'); message.className='msg ok'; message.textContent=payload.caixa_aberto?'Movimento atual carregado. O valor confirmado estará disponível após o fechamento.':'Consulta concluída.';
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
