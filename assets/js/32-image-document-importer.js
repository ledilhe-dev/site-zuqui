// Importacao de documentos financeiros pelo Codex no VPS, sempre por backend seguro.
(function () {
  'use strict';
  const ENDPOINT = 'openai-document-reader';
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_BATCH_FILES = 10;
  const MAX_IMAGE_DIMENSION = 2800;
  const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/bmp']);
  const leiturasDaSessao = new Map();
  const hojeISO = () => new Date().toISOString().slice(0, 10);
  function dataISOValida(valor) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false; const [a,m,d]=String(valor).split('-').map(Number),dt=new Date(Date.UTC(a,m-1,d)); return dt.getUTCFullYear()===a&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d; }
  function numeroPositivo(valor) { const n=Number(valor); return Number.isFinite(n)&&n>0?Number(n.toFixed(2)):null; }
  function textoSeguro(valor, limite=200) { return String(valor||'').replace(/\s+/g,' ').trim().slice(0,limite); }
  function adaptarItem(item, indice, documento) {
    const dataCompra=dataISOValida(item.purchase_date)?item.purchase_date:null;
    const vencimento=dataISOValida(item.due_date)?item.due_date:null;
    const total=numeroPositivo(item.total_amount), parcela=numeroPositivo(item.installment_amount);
    const quantidade=Math.max(1,Math.min(360,Number.parseInt(item.installment_count,10)||1));
    const valor=total||(parcela?Number((parcela*quantidade).toFixed(2)):null);
    const descricao=textoSeguro(item.description||documento.issuer_name||'Documento sem descricao');
    const avisos=[...(Array.isArray(item.warnings)?item.warnings:[]),...(Array.isArray(item.missing_fields)?item.missing_fields:[]),...(Array.isArray(item.ambiguous_fields)?item.ambiguous_fields:[])].map(v=>textoSeguro(v,160)).filter(Boolean);
    const revisar=documento.document_readable!==true||item.requires_review===true||!dataCompra||!vencimento||!valor||!descricao||avisos.length>0;
    return { id:`ai_${Date.now()}_${indice}`, data:dataCompra||hojeISO(), descricao, valor:valor||0, valorTotalCompra:valor||0,
      quantidadeParcelas:quantidade, valorParcela:parcela||(valor?Number((valor/quantidade).toFixed(2)):0), fitid:null,
      vencimento_fatura:vencimento||dataCompra||hojeISO(), parcela_atual:Number.isInteger(item.current_installment)?item.current_installment:null,
      total_parcelas:Number.isInteger(item.total_installments)?item.total_installments:null, selecionado:Boolean(valor&&descricao),
      fornecedor_id:null, categoria_id:null, _obsManual:descricao, _origemImagem:true, _origemOpenAI:true,
      _bancoImagem:textoSeguro(item.issuer_name||documento.issuer_name||'',120)||null, _exigeFornecedorManual:true, _fornAuto:false,
      _parcelasManuais:quantidade, _parcelasAuto:quantidade>1, _modoValorParcelas:'total', _revisaoDocumentoObrigatoria:revisar, _avisosLeitura:avisos };
  }
  function adaptarRespostaCodex(resposta) {
    if(!resposta||resposta.schema_version!=='1.0'||!Array.isArray(resposta.items)) throw new Error('O servidor retornou uma leitura em formato invalido. Tente novamente.');
    if(!resposta.items.length) throw new Error('Nao encontrei contas a pagar no documento. Confira o arquivo ou use o cadastro manual.');
    const itens=resposta.items.map((item,i)=>adaptarItem(item||{},i,resposta));
    if(!itens.some(item=>item.valor>0)) throw new Error('Nao foi possivel confirmar nenhum valor no documento. Nenhum lancamento foi criado.');
    return itens;
  }
  function converterBmpParaJpeg(file) {
    if(String(file.type||'').toLowerCase()!=='image/bmp') return Promise.resolve(file);
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d',{alpha:false}).drawImage(img,0,0);c.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(new Error('Nao foi possivel converter a imagem BMP.'));resolve(new File([blob],String(file.name||'documento.bmp').replace(/\.bmp$/i,'.jpg'),{type:'image/jpeg'}));},'image/jpeg',.94);}catch(e){URL.revokeObjectURL(url);reject(e);}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem BMP invalida.'));};img.src=url;});
  }
  async function reduzirImagemGrande(file) {
    if (!String(file.type || '').toLowerCase().startsWith('image/') || file.size < 2 * 1024 * 1024 || typeof createImageBitmap !== 'function') return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (error) {
      console.warn('Nao foi possivel otimizar a imagem; o original sera preservado:', error?.message || error);
      return file;
    }
    try {
      const maiorLado = Math.max(bitmap.width, bitmap.height);
      if (maiorLado <= MAX_IMAGE_DIMENSION) return file;
      const escala = MAX_IMAGE_DIMENSION / maiorLado;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      const contexto = canvas.getContext('2d', { alpha: false });
      if (!contexto) {
        console.warn('Nao foi possivel criar canvas para otimizar a imagem; o original sera preservado.');
        return file;
      }
      contexto.imageSmoothingQuality = 'high';
      contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .92));
      if (!blob) {
        console.warn('O navegador nao conseguiu converter a imagem; o original sera preservado.');
        return file;
      }
      if (blob.size >= file.size) return file;
      const nome = String(file.name || 'documento').replace(/\.[^.]+$/, '');
      return new File([blob], `${nome}.webp`, { type: 'image/webp' });
    } catch (error) {
      console.warn('Nao foi possivel otimizar a imagem; o original sera preservado:', error?.message || error);
      return file;
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  }
  async function prepararArquivo(file, mime) {
    const dataUrlPromise = new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result || ''));
      leitor.onerror = () => reject(new Error('Nao foi possivel abrir o arquivo.'));
      leitor.readAsDataURL(file);
    });
    const [dataUrlOriginal, bytes] = await Promise.all([dataUrlPromise, file.arrayBuffer()]);
    const separador = dataUrlOriginal.indexOf(',');
    if (separador < 0) throw new Error('Nao foi possivel codificar o documento.');
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return {
      checksum: Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''),
      dataUrl: `data:${mime};base64,${dataUrlOriginal.slice(separador + 1)}`,
    };
  }
  function contextoAtual() { const s=window.usuarioSistemaLogado||(typeof usuarioSistemaLogado!=='undefined'?usuarioSistemaLogado:null)||{};const empresa_id=String(s.empresa_id||'').trim(),loja_id=String(s.loja_id||'').trim(),usuario_id=String(s.id||window.__authPrincipalId||'').trim();if(!empresa_id||!loja_id||!usuario_id)throw new Error('Sessao ou loja invalida. Entre novamente antes de importar.');return{empresa_id,loja_id,usuario_id}; }
  async function mensagemErroFuncao(error) { try{const response=error?.context;if(response&&typeof response.clone==='function'){const payload=await response.clone().json();if(payload?.message)return payload.message;}}catch(_){} return error?.message&&!/non-2xx/i.test(error.message)?error.message:'O servico de leitura nao respondeu. Tente novamente em alguns instantes.'; }
  async function solicitarLeitura(file, checksum, dataUrl) { const contexto=contextoAtual(),mime=String(file.type||'').toLowerCase()||(/\.pdf$/i.test(file.name||'')?'application/pdf':'');const {data,error}=await sb.functions.invoke(ENDPOINT,{body:{...contexto,filename:String(file.name||'documento').slice(0,180),mime_type:mime,size:file.size,checksum,file_data:dataUrl}});if(error)throw new Error(await mensagemErroFuncao(error));if(!data?.ok||!data?.document)throw new Error(data?.message||'Leitura do documento nao concluida.');return data.document; }
  window.imagemCompraHandleDrop=function(evento){evento.preventDefault();const z=document.getElementById('imagemCompraDropZone');if(z)z.style.borderColor='var(--border-mid)';const files=Array.from(evento.dataTransfer?.files||[]);if(files.length)window.imagemCompraHandleFiles(files);};
  window.imagemCompraHandleFile=function(file){return window.imagemCompraHandleFiles(file?[file]:[]);};
  window.imagemCompraHandleFiles=async function(files){
    const selecionados=Array.from(files||[]);
    const input=document.getElementById('imagemCompraFileInput');if(input)input.value='';
    if(!selecionados.length)return;
    if(selecionados.length>MAX_BATCH_FILES){setMsg('msgImportarFatura',`Selecione no maximo ${MAX_BATCH_FILES} arquivos por vez.`,'err');return;}
    const nomes=selecionados.map(file=>String(file.name||'documento'));
    _faturaArquivoNome=nomes.join(', ').slice(0,180);_faturaBancoDetectado='Codex';setMsg('msgImportarFatura','','');
    const step1=document.getElementById('faturaStep1');if(step1)step1.style.display='none';
    const step2=document.getElementById('faturaStep2');if(step2){step2.style.display='flex';step2.style.flexDirection='column';step2.style.alignItems='center';}
    const itensTodos=[],falhas=[];
    for(let indice=0;indice<selecionados.length;indice++){
      const original=selecionados[indice],nome=nomes[indice];
      const progresso=(percentual,mensagem)=>faturaSetProgress(Math.round(((indice+percentual/100)/selecionados.length)*100),`Documento ${indice+1}/${selecionados.length}: ${mensagem}`);
      try{
        const tipo=String(original.type||'').toLowerCase();
        if(!ALLOWED_TYPES.has(tipo)&&!/\.pdf$/i.test(nome))throw new Error('Formato nao aceito; use PDF, PNG, JPG, WEBP ou BMP.');
        if(original.size<=0||original.size>MAX_FILE_BYTES)throw new Error('Arquivo vazio ou maior que 10 MB.');
        progresso(8,'validando e otimizando o arquivo...');
        let file=await converterBmpParaJpeg(original);
        file=await reduzirImagemGrande(file);
        if(file.size>MAX_FILE_BYTES)throw new Error('O documento convertido excedeu o limite de 10 MB.');
        const mime=String(file.type||'').toLowerCase()||(/\.pdf$/i.test(file.name||'')?'application/pdf':'');
        const {checksum,dataUrl}=await prepararArquivo(file,mime),ctx=contextoAtual(),chave=`${ctx.empresa_id}:${ctx.loja_id}:${checksum}`;
        let promise=leiturasDaSessao.get(chave);
        if(!promise){progresso(25,'enviando para leitura segura...');promise=solicitarLeitura(file,checksum,dataUrl);leiturasDaSessao.set(chave,promise);}
        else progresso(35,'reutilizando leitura segura desta sessao...');
        let documento;try{documento=await promise;}catch(e){leiturasDaSessao.delete(chave);throw e;}
        progresso(85,'validando dados financeiros...');
        const itens=adaptarRespostaCodex(documento);
        itens.forEach((item,itemIndice)=>{
          item.id=`ai_${Date.now()}_${indice}_${itemIndice}`;
          item._arquivoOrigem=nome;
          item._documentoOrigemId=String(indice);
        });
        itensTodos.push(...itens);
      }catch(e){
        falhas.push({nome,mensagem:String(e?.message||'Falha ao interpretar o documento.')});
        console.error('Falha segura ao interpretar documento:',e?.message||'erro');
      }
    }
    if(!itensTodos.length){
      if(step2)step2.style.display='none';if(step1)step1.style.display='';
      const detalhes=falhas.map(f=>`${escaparHtmlBasico(f.nome)}: ${escaparHtmlBasico(f.mensagem)}`).join('<br>');
      setMsg('msgImportarFatura',detalhes||'Nao foi possivel interpretar os documentos selecionados.','err');
      return;
    }
    _faturaItensExtraidos=itensTodos;
    faturaSetProgress(100,'Leitura concluida. Revise os documentos antes de lancar.');
    const vencimento=itensTodos[0]?.vencimento_fatura||itensTodos[0]?.data||hojeISO();
    const documentosLidos=new Set(itensTodos.map(item=>item._documentoOrigemId)).size;
    await faturaExibirRevisao({
      banco:documentosLidos===1?textoSeguro(itensTodos[0]?._bancoImagem||'Codex',120):`${documentosLidos} documento(s)`,
      referenciaCartao:'',
      vencimento,
      total_fatura:itensTodos.reduce((s,i)=>s+Number(i.valor||0),0),
    });
    const revisar=itensTodos.filter(i=>i._revisaoDocumentoObrigatoria).length;
    const resumo=`${itensTodos.length} conta(s) identificada(s) em ${selecionados.length-falhas.length} documento(s).${revisar?` ${revisar} exigem revisao reforcada.`:''} Confira individualmente cada arquivo, fornecedor, categoria, datas, parcelas e valores antes de lancar.`;
    const detalhesFalhas=falhas.length?`<br>Falha(s): ${falhas.map(f=>`${escaparHtmlBasico(f.nome)}: ${escaparHtmlBasico(f.mensagem)}`).join(' | ')}`:'';
    const avisoMemoria=window.faturaMemoriaCategoriasIndisponivel?'<br>A memória persistida de categorias não pôde ser consultada; as sugestões por fornecedor podem não aparecer.':'';
    setMsg('msgImportarFatura',`${resumo}${detalhesFalhas}${avisoMemoria}`,falhas.length||revisar||avisoMemoria?'err':'ok');
  };
  window.imagemCompraAdaptarRespostaCodex=adaptarRespostaCodex;
})();
