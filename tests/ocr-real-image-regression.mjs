import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const importer = fs.readFileSync(new URL('../assets/js/32-image-ocr-importer.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 480, height: 456 }, deviceScaleFactor: 1 });

try {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;width:480px;height:456px;overflow:hidden;background:#8f8178;font-family:Arial,sans-serif;color:#fff}
    #shot{width:480px;height:456px;padding:4px 2px;background:linear-gradient(115deg,#85756b,#b4a59c 55%,#756860)}
    .card{position:relative;height:81px;margin:0 0 10px;border-radius:20px;border:1px solid rgba(255,255,255,.32);background:rgba(54,54,54,.56);padding:4px 8px 3px 77px;box-shadow:0 1px 2px rgba(0,0,0,.25)}
    .icon{position:absolute;left:21px;top:17px;width:42px;height:42px;border-radius:10px;background:#d31567}
    .bank{font-size:16px;font-weight:700;line-height:1.05}.time{position:absolute;right:31px;top:5px;font-size:14px;color:#e5ded9}
    .msg{font-size:16px;line-height:1.2;margin-top:2px;letter-spacing:0}
  </style></head><body><main id="shot">
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">11:36</div><div class="msg">Compra de R$ 56,74 APROVADA em<br>SUPERMERCADOS K, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">08:11</div><div class="msg">Compra de R$ 124,42 APROVADA em<br>SUPERMERCADOS K, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">Ontem, 21:26</div><div class="msg">Compra de R$ 1.072,24 APROVADA em<br>AURORA ALIME*AU, no Cartão final 6546.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">seg., 11:17</div><div class="msg">Compra de R$ 24,00 APROVADA em CHAVEIRO<br>CARLIN, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">seg., 10:20</div><div class="msg">Compra de R$ 130,00 APROVADA em J&nbsp; D&nbsp; S<br>COMERCIO, no Cartão final 1018.</div></section>
  </main></body></html>`);
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js' });
  await page.evaluate(code => {
    window.parseBRLCurrency = value => Number(String(value).replace(/^\s*(?:R\s*\$|R[S5]|S)\s*/i, '').replace(/\./g, '').replace(',', '.'));
    window.eval(code);
  }, importer);

  const imagemBase64 = (await page.locator('#shot').screenshot({ type: 'png' })).toString('base64');
  const resultado = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), caractere => caractere.charCodeAt(0));
    const bitmapOriginal = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    // Mesmo pre-processamento do importador: imagens pequenas sao ampliadas 2x.
    const preparado = document.createElement('canvas');
    preparado.width = 960;
    preparado.height = 912;
    preparado.getContext('2d').drawImage(bitmapOriginal, 0, 0, preparado.width, preparado.height);
    const bitmap = await createImageBitmap(preparado);
    const worker = await Tesseract.createWorker('por+eng');
    const textos = [];
    for (const inicio of [0, .18, .38, .58, .78]) {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = Math.round(Math.min(912 * .22, 912 * (1 - inicio)));
      canvas.getContext('2d').drawImage(bitmap, 0, Math.round(912 * inicio), 960, canvas.height, 0, 0, 960, canvas.height);
      const leitura = await worker.recognize(canvas, { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      textos.push(leitura.data.text || '');
    }
    await worker.terminate();
    const itens = textos.flatMap(texto => window.imagemCompraExtrairNotificacaoIsolada(texto));
    return { textos, itens: itens.map(({ valor, descricao }) => ({ valor, descricao })) };
  }, imagemBase64);

  assert.equal(resultado.itens.length, 5, `OCR real deveria achar 5 contas. Texto:\n${resultado.textos.join('\n---\n')}`);
  assert.deepEqual(resultado.itens.map(item => item.valor), [56.74, 124.42, 1072.24, 24, 130]);
  assert.deepEqual(resultado.itens.map(item => item.descricao), ['SUPERMERCADOS K', 'SUPERMERCADOS K', 'AURORA ALIME*AU', 'CHAVEIRO CARLIN', 'J D S COMERCIO']);
  console.log('ocr-real-image-regression: 5 contas reconhecidas corretamente');
} finally {
  await browser.close();
}
