import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vendorPath = new URL('../assets/vendor/supabase.min.js', import.meta.url);
const vendor = fs.readFileSync(vendorPath, 'utf8');

test('Supabase e servido localmente e carregado antes dos modulos da aplicacao', () => {
  const vendorIndex = html.indexOf('./assets/vendor/supabase.min.js');
  const coreIndex = html.indexOf('./assets/js/01-core-supabase.js');
  const financeIndex = html.indexOf('./assets/js/30-finance.js');
  const reportIndex = html.indexOf('./assets/js/60-timeclock.js');
  assert.ok(vendorIndex >= 0, 'bundle local do Supabase ausente');
  assert.ok(!html.includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'), 'CDN externo ainda esta em uso');
  assert.ok(vendorIndex < coreIndex && coreIndex < financeIndex && coreIndex < reportIndex);
});

test('bundle local cria window.supabase.createClient sem rede externa', () => {
  const context = {};
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(vendor, context, { filename: vendorPath.pathname });
  assert.equal(typeof context.supabase?.createClient, 'function');
});
