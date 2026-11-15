import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { File } from 'node:buffer';
import { webcrypto } from 'node:crypto';

const importer = fs.readFileSync(new URL('../assets/js/32-image-document-importer.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function documentWith(name) {
  return {
    schema_version: '1.0',
    document_type: 'invoice',
    issuer_name: name,
    document_readable: true,
    items: [{
      description: name,
      purchase_date: '2026-11-01',
      due_date: '2026-11-15',
      total_amount: 25,
      installment_count: 1,
      installment_amount: 25,
      requires_review: false,
    }],
  };
}

function loadImporter({ failName } = {}) {
  const calls = [];
  const statuses = [];
  const elements = new Map();
  let drawnSize = null;
  let bitmapClosed = false;
  let review;
  let activeCalls = 0;
  let maxActiveCalls = 0;
  const context = {
    window: {},
    Date,
    Number,
    String,
    Set,
    Map,
    Promise,
    console,
    crypto: webcrypto,
    Buffer,
    File,
    FileReader: class {
      readAsDataURL(file) {
        file.arrayBuffer().then(bytes => {
          this.result = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`;
          this.onload();
        }).catch(error => this.onerror(error));
      }
    },
    createImageBitmap: async () => ({
      width: 4000,
      height: 3000,
      close() { bitmapClosed = true; },
    }),
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { style: {}, value: '' });
        return elements.get(id);
      },
      createElement(tag) {
        assert.equal(tag, 'canvas');
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage() { drawnSize = [canvas.width, canvas.height]; } }),
          toBlob(callback, mime) { callback(new Blob([Uint8Array.of(1, 2, 3)], { type: mime })); },
        };
        return canvas;
      },
    },
    usuarioSistemaLogado: { id: 'user', empresa_id: 'company', loja_id: 'store' },
    setMsg: (...args) => statuses.push(args),
    faturaSetProgress() {},
    faturaExibirRevisao: async value => { review = value; },
    escaparHtmlBasico: value => String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]),
    sb: {
      functions: {
        async invoke(_endpoint, { body }) {
          calls.push(body);
          activeCalls++;
          maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
          await new Promise(resolve => setTimeout(resolve, 1));
          activeCalls--;
          if (body.filename === failName) return { error: new Error('falha simulada') };
          return { data: { ok: true, document: documentWith(body.filename) }, error: null };
        },
      },
    },
    _faturaArquivoNome: null,
    _faturaBancoDetectado: null,
    _faturaItensExtraidos: [],
  };
  vm.runInNewContext(importer, context);
  return {
    context, calls, statuses, elements, getReview: () => review,
    getMaxActiveCalls: () => maxActiveCalls,
    getDrawnSize: () => drawnSize,
    getBitmapClosed: () => bitmapClosed,
  };
}

function fakeFile(name, value) {
  const bytes = Uint8Array.of(0xff, 0xd8, value);
  return {
    name,
    type: 'image/jpeg',
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

test('a galeria aceita um lote e revisa cada documento sem concorrência ao conector', async () => {
  assert.match(index, /id="imagemCompraFileInput"[^>]*multiple/);
  assert.match(index, /onchange="imagemCompraHandleFiles\(this\.files\)"/);
  const app = loadImporter();

  await app.context.window.imagemCompraHandleFiles([
    fakeFile('nota-1.jpg', 1),
    fakeFile('nota-2.jpg', 2),
  ]);

  assert.equal(app.calls.length, 2);
  assert.equal(app.getMaxActiveCalls(), 1);
  assert.deepEqual(app.calls.map(call => call.filename), ['nota-1.jpg', 'nota-2.jpg']);
  assert.equal(app.getReview().banco, '2 documento(s)');
  assert.deepEqual(
    Array.from(app.context._faturaItensExtraidos, item => item._arquivoOrigem),
    ['nota-1.jpg', 'nota-2.jpg'],
  );
  assert.notEqual(
    app.context._faturaItensExtraidos[0].id,
    app.context._faturaItensExtraidos[1].id,
  );
});

test('falha parcial de um arquivo preserva os demais para revisao', async () => {
  const app = loadImporter({ failName: 'nota-ruim.jpg' });
  await app.context.window.imagemCompraHandleFiles([
    fakeFile('nota-ok.jpg', 1),
    fakeFile('nota-ruim.jpg', 2),
  ]);

  assert.equal(app.getReview().banco, 'nota-ok.jpg');
  assert.deepEqual(Array.from(app.context._faturaItensExtraidos, item => item._arquivoOrigem), ['nota-ok.jpg']);
  assert.match(app.statuses.at(-1)[1], /nota-ruim\.jpg/);
});

test('lote acima de dez arquivos e rejeitado antes de qualquer chamada remota', async () => {
  const app = loadImporter();
  const files = Array.from({ length: 11 }, (_, index) => fakeFile(`nota-${index}.jpg`, index));
  await app.context.window.imagemCompraHandleFiles(files);

  assert.equal(app.calls.length, 0);
  assert.match(app.statuses.at(-1)[1], /no maximo 10/);
});

test('imagem grande e reduzida sem aumentar o arquivo e sem alterar o original', async () => {
  const app = loadImporter();
  const original = {
    ...fakeFile('foto.jpg', 7),
    size: 3 * 1024 * 1024,
  };
  await app.context.window.imagemCompraHandleFile(original);

  assert.deepEqual(app.getDrawnSize(), [2800, 2100]);
  assert.equal(app.getBitmapClosed(), true);
  assert.equal(app.calls[0].mime_type, 'image/webp');
  assert.equal(app.calls[0].size, 3);
  assert.equal(original.name, 'foto.jpg');
});
