import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const frontend=fs.readFileSync(new URL('../assets/js/32-image-document-importer.js',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../supabase/functions/openai-document-reader/index.ts',import.meta.url),'utf8');
const bridgeSchema=fs.readFileSync(new URL('../tools/codex-reader/schema.json',import.meta.url),'utf8');
test('Tesseract e PDF.js foram removidos somente deste importador',()=>{assert.doesNotMatch(frontend,/Tesseract|tesseract\.js|pdfjsLib|pdf\.worker/);assert.match(frontend,/sb\.functions\.invoke\(ENDPOINT/);});
test('OFX continua no modulo financeiro e fora do novo endpoint',()=>{const finance=fs.readFileSync(new URL('../assets/js/30-finance.js',import.meta.url),'utf8');assert.match(finance,/faturaProcessarOFX/);assert.match(finance,/faturaHandleFile\(file, tipo = 'ofx'\)/);assert.doesNotMatch(backend,/contasapagar.*insert|\.from\("contasapagar"\)\.insert/);});
test('backend aceita imagens e PDF com schema estrito',()=>{assert.match(backend,/application\/pdf/);assert.match(backend,/image\/png/);assert.match(backend,/image\/jpeg/);assert.match(backend,/image\/webp/);assert.equal(JSON.parse(bridgeSchema).additionalProperties,false);});
