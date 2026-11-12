import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/125-app-design-system.css', import.meta.url), 'utf8');
const fallback = fs.readFileSync(new URL('../assets/js/81-schedule-modal-patch.js', import.meta.url), 'utf8');

test('modal da agenda separa corpo rolavel do rodape de acoes', () => {
  assert.match(html, /class="escala-modal-scroll"[\s\S]*class="escala-modal-actions"/);
  assert.match(fallback, /escala-modal-scroll/);
  assert.match(css, /#modalEscalaPlantao \.escala-modal-scroll[\s\S]*overflow-y:\s*auto/);
});

test('campos da agenda mobile permanecem compactos e salvar fica visivel', () => {
  assert.match(css, /#modalEscalaPlantao \.escala-modal-grid :is\(input:not\(\[type="hidden"\]\), select\)[\s\S]*height:\s*44px !important/);
  assert.match(css, /#modalEscalaPlantao \.escala-modal-actions[\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /max-height:\s*calc\(100dvh - 12px\) !important/);
});
