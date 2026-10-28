import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  '../index.html',
  '../assets/js/04-navigation.js',
  '../assets/js/20-checklists.js',
  '../assets/js/92-date-filter-standardizer.js',
  '../assets/js/93-raffinato-managerial.js',
  '../assets/js/97-raffinato-daily-detail.js',
];

test('campos de data preservam digitacao nativa sem abertura forcada', () => {
  const source = files.map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert.match(source, /type=["']date["']/);
  assert.doesNotMatch(source, /showPicker\s*\(/);
  assert.doesNotMatch(source, /onclick=["'][^"']*showPicker/);
});

test('padronizador cria datas com o mesmo input nativo do relatorio novo', () => {
  const standardizer = fs.readFileSync(new URL('../assets/js/92-date-filter-standardizer.js', import.meta.url), 'utf8');
  const report = fs.readFileSync(new URL('../assets/js/97-raffinato-daily-detail.js', import.meta.url), 'utf8');
  assert.match(standardizer, /class="date-filter-start" type="date"/);
  assert.match(standardizer, /class="date-filter-end" type="date"/);
  assert.match(report, /id="rddStart" type="date"/);
  assert.match(report, /id="rddEnd" type="date"/);
});
