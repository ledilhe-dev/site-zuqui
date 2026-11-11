import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/css/125-app-design-system.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/js/99-app-design-system.js', import.meta.url), 'utf8');

test('canonical design-system layer is loaded last', () => {
  assert.match(html, /125-app-design-system\.css/);
  assert.match(html, /99-app-design-system\.js/);
  assert.ok(html.lastIndexOf('125-app-design-system.css') > html.lastIndexOf('121-mobile-density.css'));
});

test('shared tokens define compact controls and accessible touch targets', () => {
  assert.match(css, /--app-control-height:\s*36px/);
  assert.match(css, /--app-touch-target:\s*44px/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(css, /@container\s*\(max-width:\s*560px\)/);
});

test('popover contract is viewport safe', () => {
  assert.match(css, /max-width:\s*calc\(100vw - 24px\)/);
  assert.match(js, /AppUI\.positionPopover/);
  assert.match(js, /boundaryLeft/);
  assert.match(js, /spaceBelow < 220/);
  assert.match(js, /boundaryRight - width/);
  assert.match(js, /dashGfDropdownCat/);
});

test('payable categories keep checkboxes and gain accent-insensitive search', () => {
  assert.match(html, /id="dropdownCategoriasContaAPagar"/);
  assert.match(js, /normalize\('NFD'\)/);
  assert.match(js, /Pesquisar categorias/);
  assert.match(js, /querySelectorAll\('label'\)/);
  assert.doesNotMatch(js, /filtroContaAPagarCategoriasSelecionadas\.(?:clear|delete)/);
});

