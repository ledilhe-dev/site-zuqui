import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('layout do gerador adapta desktop tablet e celular', () => {
  const css = fs.readFileSync(new URL('../assets/css/124-smart-schedule.css', import.meta.url), 'utf8');
  for (const token of [
    'container-type:inline-size',
    'max-width:1180px',
    'max-width:860px',
    'max-width:560px',
    'min-height:44px',
    'grid-template-columns:1fr'
  ]) assert.ok(css.includes(token), `regra responsiva ausente: ${token}`);
  assert.match(css, /\.ss-filters fieldset label[\s\S]*display:inline-flex/);
});

test('menu inclui icone elegante do gerador de escalas', () => {
  const js = fs.readFileSync(new URL('../assets/js/93-sidebar-icons.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/css/106-sidebar-icons.css', import.meta.url), 'utf8');
  assert.match(js, /gerador_inteligente_escalas: icon/);
  assert.match(js, /data-nav-item-id="gerador_inteligente_escalas"/);
  assert.match(css, /data-sidebar-icon='gerador_inteligente_escalas'/);
});
