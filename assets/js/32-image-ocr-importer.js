// Importacao gratuita por imagem: OCR local no navegador com Tesseract.js.
// O resultado cai na mesma tela de revisao do importador OFX.
(function () {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  function imagemCompraHojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function imagemCompraAdicionarDiasISO(baseISO, dias) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(String(baseISO || '')) ? baseISO : imagemCompraHojeISO();
    const d = new Date(`${base}T12:00:00`);
    d.setDate(d.getDate() + Number(dias || 0));
    return d.toISOString().slice(0, 10);
  }

  function imagemCompraNormalizarTexto(texto) {
    return String(texto || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function imagemCompraRemoverAcentos(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function imagemCompraParseValor(valorTexto) {
    const limpo = String(valorTexto || '').replace(/[^\d.,]/g, '');
    if (!limpo) return null;
    const normalizado = limpo.includes(',')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo;
    const valor = Number.parseFloat(normalizado);
    return Number.isFinite(valor) && valor > 0 ? Number(valor.toFixed(2)) : null;
  }

  function imagemCompraParseData(texto, referenciaISO) {
    const raw = String(texto || '');
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(String(referenciaISO || '')) ? referenciaISO : imagemCompraHojeISO();
    if (/\bontem\b/i.test(raw)) return imagemCompraAdicionarDiasISO(ref, -1);
    const mBR = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if (mBR) {
      const dia = Number(mBR[1]);
      const mes = Number(mBR[2]);
      let ano = mBR[3] ? Number(mBR[3]) : Number(ref.slice(0, 4));
      if (ano < 100) ano += 2000;
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
        return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      }
    }
    const mISO = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (mISO) return `${mISO[1]}-${mISO[2]}-${mISO[3]}`;
    return ref;
  }

  function imagemCompraLimparDescricao(desc) {
    return String(desc || '')
      .replace(/\s+para\s+o\s+cart[aã]o.*$/i, '')
      .replace(/\s+final\s+\d+.*$/i, '')
      .replace(/\s+aprovad[ao].*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s:.-]+|[\s:.-]+$/g, '')
      .trim()
      .slice(0, 120);
  }

  function imagemCompraDeduplicar(itens) {
    const vistos = new Set();
    return (itens || []).filter(item => {
      const chave = [
        item.data,
        Math.round(Number(item.valor || 0) * 100),
        imagemCompraRemoverAcentos(item.descricao || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
      ].join('|');
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  }

  function imagemCompraExtrairNubank(texto, dataPadrao) {
    const itens = [];
    const compacto = imagemCompraNormalizarTexto(texto).replace(/\n+/g, ' ');
    const regex = /(?:((?:ontem|hoje)[^A-Za-z0-9]{0,4}\d{0,2}:?\d{0,2})\s+)?Compra\s+de\s+R\$\s*([\d.]+,\d{2})\s+APROVAD[AO]\s+em\s+(.+?)(?=\s+para\s+o\s+cart[aã]o|\s+Compra\s+no\s+cr[eé]dito|\s+Compra\s+de\s+R\$|$)/gi;
    let m;
    while ((m = regex.exec(compacto)) !== null) {
      const valor = imagemCompraParseValor(m[2]);
      const descricao = imagemCompraLimparDescricao(m[3]);
      if (!valor || !descricao) continue;
      itens.push({
        data: imagemCompraParseData(m[1] || '', dataPadrao),
        descricao,
        valor,
        fitid: null,
        vencimento_fatura: imagemCompraParseData(m[1] || '', dataPadrao),
        selecionado: true,
        _obsManual: descricao,
        _origemImagem: true,
      });
    }
    return itens;
  }

  function imagemCompraExtrairGenerico(texto, dataPadrao) {
    const linhas = imagemCompraNormalizarTexto(texto).split('\n').map(l => l.trim()).filter(Boolean);
    if (!linhas.length) return [];

    const linhaRuido = (linha) => {
      const l = imagemCompraRemoverAcentos(linha).toLowerCase();
      return !l
        || /^(hoje|ontem|amanha)$/.test(l)
        || /^\d{1,2}:?\d{2}$/.test(l)
        || /(total|selecionad|venc|parcelas|obs|importar|arquivo|bancario|ocr|categoria|fornecedor|cartao|aprovad|final \d+)/i.test(l);
    };
    const limparDescricaoLinha = (linha) => imagemCompraLimparDescricao(
      String(linha || '')
        .replace(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g, ' ')
        .replace(/\b\d{1,2}:?\d{2}\b/g, ' ')
        .replace(/\b(h[aá]\s*)?\d+\s*h\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
    );
    const ehDescricao = (linha) => {
      const desc = limparDescricaoLinha(linha);
      return desc.length >= 3 && /[A-Za-zÀ-ÿ]{3,}/.test(desc) && !linhaRuido(desc);
    };
    const descricaoProxima = (idx, linhaAtual) => {
      const atual = limparDescricaoLinha(linhaAtual);
      if (ehDescricao(atual)) return atual;
      for (let i = idx - 1; i >= Math.max(0, idx - 5); i -= 1) {
        const candidata = limparDescricaoLinha(linhas[i]);
        if (ehDescricao(candidata)) return candidata;
      }
      for (let i = idx + 1; i <= Math.min(linhas.length - 1, idx + 2); i += 1) {
        const candidata = limparDescricaoLinha(linhas[i]);
        if (ehDescricao(candidata)) return candidata;
      }
      return '';
    };

    const compras = [];
    linhas.forEach((linha, idx) => {
      const ehTotal = /total|subtotal|selecionad|saldo|limite/i.test(linha);
      const matches = linha.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
      matches.forEach(v => {
        const valor = imagemCompraParseValor(v);
        if (!valor || ehTotal) return;
        const descricao = descricaoProxima(idx, linha);
        if (!descricao) return;
        const data = imagemCompraParseData(linha, dataPadrao);
        compras.push({
          data,
          descricao,
          valor,
          fitid: null,
          vencimento_fatura: data,
          selecionado: true,
          _obsManual: descricao,
          _origemImagem: true,
          _exigeFornecedorManual: true,
        });
      });
    });
    if (compras.length > 1) return compras;
    if (compras.length === 1 && linhas.filter(l => /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/.test(l)).length === 1) {
      return compras;
    }

    const candidatosValor = [];
    linhas.forEach((linha, idx) => {
      const temTotal = /total|valor|debito|credito|cart[aã]o|pago|pagamento/i.test(linha);
      const matches = linha.match(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
      matches.forEach(v => {
        const valor = imagemCompraParseValor(v);
        if (valor) candidatosValor.push({ valor, idx, peso: temTotal ? 2 : 1 });
      });
    });
    if (!candidatosValor.length) return [];

    candidatosValor.sort((a, b) => (b.peso - a.peso) || (b.valor - a.valor));
    const escolhido = candidatosValor[0];
    const dataLinha = linhas.find(l => /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/.test(l)) || '';
    const data = imagemCompraParseData(dataLinha, dataPadrao);
    const nome = linhas.find(l =>
      !/(cnpj|cpf|cupom|extrato|valor|total|data|hora|aut|nsu|comprovante|debito|credito|visa|master|elo)/i.test(l) &&
      /[A-Za-zÀ-ÿ]{3,}/.test(l)
    ) || 'Compra importada por imagem';
    const descricao = imagemCompraLimparDescricao(nome) || 'Compra importada por imagem';

    return [{
      data,
      descricao,
      valor: escolhido.valor,
      fitid: null,
      vencimento_fatura: data,
      selecionado: true,
      _obsManual: descricao,
      _origemImagem: true,
    }];
  }

  function imagemCompraExtrairItens(texto) {
    const dataPadrao = imagemCompraHojeISO();
    const nubank = imagemCompraExtrairNubank(texto, dataPadrao);
    if (nubank.length) return imagemCompraDeduplicar(nubank);
    return imagemCompraDeduplicar(imagemCompraExtrairGenerico(texto, dataPadrao));
  }

  async function imagemCompraCarregarTesseract() {
    if (window.Tesseract?.recognize) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const existente = document.querySelector(`script[src="${TESSERACT_CDN}"]`);
      if (existente) {
        existente.addEventListener('load', resolve, { once: true });
        existente.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Nao foi possivel carregar a biblioteca OCR.'));
      document.head.appendChild(script);
    });
    if (!window.Tesseract?.recognize) throw new Error('Biblioteca OCR indisponivel.');
    return window.Tesseract;
  }

  function imagemCompraPrepararArquivo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(String(file.type || ''))) {
        reject(new Error('Selecione uma imagem PNG, JPG, WEBP ou BMP.'));
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const limite = 1800;
          const escala = Math.min(2, limite / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const largura = Math.max(1, Math.round((img.naturalWidth || 1) * escala));
          const altura = Math.max(1, Math.round((img.naturalHeight || 1) * escala));
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, largura, altura);
          const imageData = ctx.getImageData(0, 0, largura, altura);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const cinza = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const altoContraste = cinza > 165 ? 255 : Math.max(0, cinza - 20);
            data[i] = data[i + 1] = data[i + 2] = altoContraste;
          }
          ctx.putImageData(imageData, 0, 0);
          canvas.toBlob(blob => {
            URL.revokeObjectURL(url);
            resolve(blob || file);
          }, 'image/png');
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Nao foi possivel abrir a imagem.'));
      };
      img.src = url;
    });
  }

  window.imagemCompraHandleDrop = function imagemCompraHandleDrop(e) {
    e.preventDefault();
    const dz = document.getElementById('imagemCompraDropZone');
    if (dz) dz.style.borderColor = 'var(--border-mid)';
    const file = e.dataTransfer?.files?.[0];
    if (file) window.imagemCompraHandleFile(file);
  };

  window.imagemCompraHandleFile = async function imagemCompraHandleFile(file) {
    if (!file) return;
    const input = document.getElementById('imagemCompraFileInput');
    if (input) input.value = '';
    _faturaArquivoNome = file.name || 'imagem';
    _faturaBancoDetectado = 'Imagem/OCR';
    setMsg('msgImportarFatura', '', '');
    document.getElementById('faturaStep1').style.display = 'none';
    const step2 = document.getElementById('faturaStep2');
    if (step2) {
      step2.style.display = 'flex';
      step2.style.flexDirection = 'column';
      step2.style.alignItems = 'center';
    }
    faturaSetProgress(8, 'Preparando imagem...');

    try {
      const imagem = await imagemCompraPrepararArquivo(file);
      faturaSetProgress(18, 'Carregando OCR gratuito...');
      const Tesseract = await imagemCompraCarregarTesseract();
      faturaSetProgress(30, 'Lendo texto da imagem...');
      const resultado = await Tesseract.recognize(imagem, 'por+eng', {
        logger: info => {
          if (info?.status === 'recognizing text') {
            faturaSetProgress(30 + Math.round((info.progress || 0) * 55), 'Lendo texto da imagem...');
          }
        },
      });
      const texto = resultado?.data?.text || '';
      faturaSetProgress(88, 'Interpretando compras...');
      const itens = imagemCompraExtrairItens(texto).map((item, idx) => ({
        id: `img_${Date.now()}_${idx}`,
        ...item,
        fornecedor_id: null,
        _fornAuto: false,
        _exigeFornecedorManual: true,
      }));
      if (!itens.length) {
        throw new Error('Nao encontrei valor de compra na imagem. Tente uma imagem mais nitida ou use o cadastro manual.');
      }
      _faturaItensExtraidos = itens;
      faturaSetProgress(100, 'Concluido!');
      setTimeout(() => {
        faturaExibirRevisao({
          banco: 'Imagem/OCR',
          // Preserva o texto completo porque o emissor (ex.: BRADESCO CARTOES)
          // geralmente esta no cabecalho, fora da descricao de cada compra.
          referenciaCartao: texto,
          vencimento: itens[0]?.vencimento_fatura || itens[0]?.data || imagemCompraHojeISO(),
          total_fatura: itens.reduce((s, item) => s + Number(item.valor || 0), 0),
        });
        setMsg('msgImportarFatura', 'Revise data, fornecedor e categoria antes de lancar. A leitura por imagem pode errar quando a foto esta torta, escura ou cortada.', 'ok');
      }, 250);
    } catch (e) {
      console.error('Erro ao importar imagem por OCR:', e);
      if (step2) step2.style.display = 'none';
      const step1 = document.getElementById('faturaStep1');
      if (step1) step1.style.display = '';
      setMsg('msgImportarFatura', e?.message || 'Nao foi possivel ler a imagem.', 'err');
    }
  };
})();
