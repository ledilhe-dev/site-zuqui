import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/js/60-timeclock.js', import.meta.url), 'utf8');
const start = source.indexOf('function batidaPontoProximaDoFimDoTurno');
const end = source.indexOf('function deveIniciarIntervaloPonto', start);
const functionSource = source.slice(start, end);

const context = {
  horaCurta: value => String(value || '').slice(0, 5),
  horarioParaMinutos: value => {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return (hours * 60) + minutes;
  },
};
vm.createContext(context);
vm.runInContext(`${functionSource};this.isNearShiftEnd=batidaPontoProximaDoFimDoTurno;`, context);

function localReference(hours, minutes) {
  const date = new Date(2026, 10, 15, hours, minutes, 0, 0);
  return date.toISOString();
}

test('late overtime punch still closes a shift without an upper time limit', () => {
  const employee = { horario_trabalho_fim: '16:00' };
  assert.equal(context.isNearShiftEnd(employee, localReference(19, 15)), true);
  assert.equal(context.isNearShiftEnd(employee, localReference(23, 30)), true);
});

test('punch well before shift end can still start an interval', () => {
  const employee = { horario_trabalho_fim: '18:00' };
  assert.equal(context.isNearShiftEnd(employee, localReference(13, 0)), false);
  assert.equal(context.isNearShiftEnd(employee, localReference(16, 30)), true);
});

test('second punch closes the shift when no end time is configured', () => {
  assert.equal(context.isNearShiftEnd({}, localReference(19, 15)), true);
  assert.equal(context.isNearShiftEnd({ horario_trabalho_fim: null }, localReference(19, 15)), true);
});
