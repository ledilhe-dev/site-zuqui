import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const helpers = readFileSync(new URL('../assets/js/05-shared-helpers.js', import.meta.url), 'utf8');
const timeclock = readFileSync(new URL('../assets/js/60-timeclock.js', import.meta.url), 'utf8');
const reports = readFileSync(new URL('../assets/js/79-runtime-extensions.js', import.meta.url), 'utf8');
const trecho = helpers.slice(
  helpers.indexOf('const LIMITE_INTERVALO_ABERTO_PONTO_MS'),
  helpers.indexOf('function formatarTempoRegressivoPonto')
);
const contexto = {};
vm.createContext(contexto);
vm.runInContext(`${trecho};this.interpretarIntervaloPonto=interpretarIntervaloPonto;this.calcularTotalIntervalosPonto=calcularTotalIntervalosPonto;`, contexto);

const iso = horario => `2026-09-03T${horario}:00-03:00`;

test('caso A: retorno real fecha intervalo em 17 minutos', () => {
  assert.equal(contexto.calcularTotalIntervalosPonto([
    { inicio_em: iso('09:41'), retorno_em: iso('09:58') },
  ], null, new Date(iso('18:00')).getTime()), 17);
});

test('caso B: saída sem retorno por até duas horas é intervalo provisório', () => {
  const agora = new Date(iso('14:30')).getTime();
  const resultado = contexto.interpretarIntervaloPonto({ inicio_em: iso('13:30') }, agora);
  assert.equal(resultado.abertoProvisorio, true);
  assert.equal(contexto.calcularTotalIntervalosPonto([{ inicio_em: iso('13:30') }], null, agora), 60);
});

test('caso C: saída sem retorno acima de duas horas vira saída final somente na interpretação', () => {
  const agora = new Date(iso('15:31')).getTime();
  const resultado = contexto.interpretarIntervaloPonto({ inicio_em: iso('13:30') }, agora);
  assert.equal(resultado.abertoProvisorio, false);
  assert.equal(resultado.expirado, true);
  assert.equal(resultado.saidaFinalEm, iso('13:30'));
  assert.equal(contexto.calcularTotalIntervalosPonto([{ inicio_em: iso('13:30') }], null, agora), 0);
});

test('caso D: Lucas soma 06:19 trabalhadas e somente 00:17 de intervalo', () => {
  const agora = new Date(iso('22:00')).getTime();
  const intervalos = [
    { inicio_em: iso('09:41'), retorno_em: iso('09:58') },
    { inicio_em: iso('13:30'), retorno_em: null },
  ];
  const trabalhado = (167 + 212);
  assert.equal(trabalhado, 379);
  assert.equal(contexto.calcularTotalIntervalosPonto(intervalos, null, agora), 17);
});

test('caso E: retorno real antes de duas horas prevalece e fecha normalmente', () => {
  const agora = new Date(iso('18:00')).getTime();
  const resultado = contexto.interpretarIntervaloPonto({
    inicio_em: iso('13:30'),
    retorno_em: iso('15:00'),
  }, agora);
  assert.equal(resultado.abertoProvisorio, false);
  assert.equal(resultado.expirado, false);
  assert.equal(contexto.calcularTotalIntervalosPonto([
    { inicio_em: iso('13:30'), retorno_em: iso('15:00') },
  ], null, agora), 90);
});

test('virada do dia nunca mantém intervalo provisório aberto', () => {
  const inicio = '2026-09-03T23:30:00-03:00';
  const agora = new Date('2026-09-04T00:15:00-03:00').getTime();
  assert.equal(contexto.interpretarIntervaloPonto({ inicio_em: inicio }, agora).expirado, true);
  assert.equal(contexto.calcularTotalIntervalosPonto([{ inicio_em: inicio }], null, agora), 0);
});

test('status e resumo usam a mesma interpretação central', () => {
  assert.match(timeclock, /obterIntervaloAberto\(lista, agoraReferencia\)/);
  assert.match(timeclock, /interpretarIntervaloPonto\(item, agoraReferencia\)\.expirado/);
  assert.match(timeclock, /saidaFinalInterpretada/);
  assert.match(timeclock, /item\?\.retorno_em \|\| interpretarIntervaloPonto\(item\)\.abertoProvisorio/);
  assert.match(reports, /resumoJornada\.ultimaSaidaEm \|\| item\.saida_em/);
  assert.match(reports, /resumo\.ultimaSaidaEm \|\| item\.saida_em/);
});
