const fs = require('fs');
const vm = require('vm');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Função não encontrada: ${name}`);
  const signatureEnd = source.indexOf(') {', start);
  const brace = signatureEnd + 2;
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Função incompleta: ${name}`);
}

const helpers = fs.readFileSync('assets/js/05-shared-helpers.js', 'utf8');
const timeclock = fs.readFileSync('assets/js/60-timeclock.js', 'utf8');
const namesHelpers = ['calcularTotalIntervalosPonto'];
const namesTimeclock = ['obterIntervaloAberto', 'obterIntervalosConsolidadosPonto', 'obterResumoJornadaPonto'];
const context = {
  Date,
  console,
  formatarDuracaoMinutos(total = 0) {
    const minutos = Math.max(0, Number(total || 0));
    return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
  }
};
vm.createContext(context);
for (const name of namesHelpers) vm.runInContext(extractFunction(helpers, name), context, { filename: name });
for (const name of namesTimeclock) vm.runInContext(extractFunction(timeclock, name), context, { filename: name });

const iso = hora => `2026-08-07T${hora}:00-03:00`;
function check(label, registro, intervalos, expected) {
  const result = context.obterResumoJornadaPonto(registro, intervalos);
  if (result.totalTexto !== expected) throw new Error(`${label}: esperado ${expected}, recebido ${result.totalTexto}`);
  console.log(`OK ${label}: ${result.totalTexto}`);
}

const registroLucas = {
  id: 'lucas-dia', entrada_em: iso('06:55'), inicio_intervalo_em: iso('09:53'),
  retorno_intervalo_em: iso('10:22'), saida_em: iso('13:30')
};
check('Lucas com intervalo duplicado exato', registroLucas, [
  { inicio_em: iso('09:53'), retorno_em: iso('10:22'), ordem: 1 },
  { inicio_em: iso('09:53'), retorno_em: iso('10:22'), ordem: 1 }
], '06:06');
check('Lucas com intervalo duplicado sobreposto', registroLucas, [
  { inicio_em: iso('09:53'), retorno_em: iso('10:22'), ordem: 1 },
  { inicio_em: iso('09:52'), retorno_em: iso('10:22'), ordem: 1 }
], '06:05');
check('Jornada sem intervalo', { entrada_em: iso('07:00'), saida_em: iso('13:30') }, [], '06:30');
check('Intervalo ainda aberto', { entrada_em: iso('07:00'), inicio_intervalo_em: iso('09:00') }, [
  { inicio_em: iso('09:00'), retorno_em: null, ordem: 1 }
], '02:00');
check('Dois intervalos distintos', { entrada_em: iso('07:00'), saida_em: iso('16:00') }, [
  { inicio_em: iso('09:00'), retorno_em: iso('09:15'), ordem: 1 },
  { inicio_em: iso('12:00'), retorno_em: iso('12:30'), ordem: 2 }
], '08:15');
