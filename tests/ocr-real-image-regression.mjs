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
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">há 43m</div><div class="msg">Compra de R$ 38,31 APROVADA em<br>SUPERMERCADOS K, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">10:54</div><div class="msg">Compra de R$ 917,46 APROVADA em<br>KOMPRAO KOCH AT, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">10:49</div><div class="msg">Compra de R$ 586,83 APROVADA em<br>KOMPRAO KOCH AT, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">Ontem, 11:36</div><div class="msg">Compra de R$ 56,74 APROVADA em<br>SUPERMERCADOS K, no Cartão final 1018.</div></section>
    <section class="card"><i class="icon"></i><div class="bank">BRADESCO CARTÕES</div><div class="time">Ontem, 08:11</div><div class="msg">Compra de R$ 124,42 APROVADA em<br>SUPERMERCADOS K, no Cartão final 1018.</div></section>
  </main></body></html>`);
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js' });
  await page.evaluate(code => {
    window.parseBRLCurrency = value => Number(String(value).replace(/^\s*(?:R\s*\$|R[S5]|S)\s*/i, '').replace(/\./g, '').replace(',', '.'));
    window.eval(code);
  }, importer);

  const imagemBase64 = (await page.locator('#shot').screenshot({ type: 'png' })).toString('base64');
  const resultado = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), caractere => caractere.charCodeAt(0));
    const arquivo = new File([bytes], 'notificacoes.png', { type: 'image/png' });
    const preparado = await window.imagemCompraPrepararArquivo(arquivo);
    const faixas = await preparado.criarFaixasNotificacaoV2(5);
    const worker = await Tesseract.createWorker('por+eng');
    const textos = [];
    const itens = [];
    for (let indice = 0; indice < faixas.length; indice += 1) {
      const textosCartao = [];
      let item = null;
      for (const variante of faixas[indice]) {
        const leitura = await worker.recognize(variante, { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        textosCartao.push(leitura.data.text || '');
        item = window.imagemCompraInterpretarCartaoV2(textosCartao, indice, null, '2026-10-29');
        // Le todas as variantes para validar a reconciliacao de valores.
      }
      textos.push(textosCartao.join('\n'));
      if (item) itens.push({ valor: item.valor, descricao: item.descricao, observacao: item._obsManual, banco: item._bancoImagem });
    }
    await worker.terminate();
    return { textos, itens };
  }, imagemBase64);

  assert.equal(resultado.itens.length, 5, `OCR real deveria achar 5 contas. Texto:\n${resultado.textos.join('\n---\n')}`);
  assert.deepEqual(resultado.itens.map(item => item.valor), [38.31, 917.46, 586.83, 56.74, 124.42]);
  assert.deepEqual(resultado.itens.map(item => item.descricao), ['SUPERMERCADOS K', 'KOMPRAO KOCH AT', 'KOMPRAO KOCH AT', 'SUPERMERCADOS K', 'SUPERMERCADOS K']);
  assert.deepEqual(resultado.itens.map(item => item.observacao), resultado.itens.map(item => item.descricao));
  assert.ok(resultado.itens.every(item => /bradesco/i.test(item.banco)), 'fornecedor/banco deve ser Bradesco');

  await page.locator('#shot').evaluate(elemento => {
    elemento.innerHTML = `<section class="card"><i class="icon" style="background:#7200d9"></i><div class="bank">Compra no crédito aprovada</div><div class="time">Ontem, 18:58</div><div class="msg">Compra de R$ 53,90 APROVADA em Google<br>YouTubePremium para o cartão com final 1842.</div></section>`;
  });
  const nubankBase64 = (await page.locator('#shot').screenshot({ type: 'png' })).toString('base64');
  const nubank = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), caractere => caractere.charCodeAt(0));
    const preparado = await window.imagemCompraPrepararArquivo(new File([bytes], 'nubank.png', { type: 'image/png' }));
    const [faixa] = await preparado.criarFaixasNotificacaoV2(1);
    const worker = await Tesseract.createWorker('por+eng');
    const textos = [];
    for (const variante of faixa) {
      const leitura = await worker.recognize(variante, { tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      textos.push(leitura.data.text || '');
    }
    await worker.terminate();
    const item = window.imagemCompraInterpretarCartaoV2(textos, 0, null, '2026-10-29');
    return item ? { valor: item.valor, descricao: item.descricao, observacao: item._obsManual, banco: item._bancoImagem } : null;
  }, nubankBase64);
  assert.deepEqual(nubank, {
    valor: 53.90,
    descricao: 'Google YouTubePremium',
    observacao: 'Google YouTubePremium',
    banco: 'Nubank',
  });
  console.log('ocr-real-image-regression: 5 contas reconhecidas corretamente');
} finally {
  await browser.close();
}
