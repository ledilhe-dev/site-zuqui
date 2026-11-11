// Importacao de documentos financeiros pelo Codex no VPS, sempre por backend seguro.
(function () {
  'use strict';
  const ENDPOINT = 'openai-document-reader';
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
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
  function arquivoParaDataUrl(file) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Nao foi possivel abrir o arquivo.'));r.readAsDataURL(file);}); }
  function converterBmpParaJpeg(file) {
    if(String(file.type||'').toLowerCase()!=='image/bmp') return Promise.resolve(file);
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d',{alpha:false}).drawImage(img,0,0);c.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(new Error('Nao foi possivel converter a imagem BMP.'));resolve(new File([blob],String(file.name||'documento.bmp').replace(/\.bmp$/i,'.jpg'),{type:'image/jpeg'}));},'image/jpeg',.94);}catch(e){URL.revokeObjectURL(url);reject(e);}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Imagem BMP invalida.'));};img.src=url;});
  }
  async function sha256Arquivo(file) { const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer()); return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function contextoAtual() { const s=window.usuarioSistemaLogado||(typeof usuarioSistemaLogado!=='undefined'?usuarioSistemaLogado:null)||{};const empresa_id=String(s.empresa_id||'').trim(),loja_id=String(s.loja_id||'').trim(),usuario_id=String(s.id||window.__authPrincipalId||'').trim();if(!empresa_id||!loja_id||!usuario_id)throw new Error('Sessao ou loja invalida. Entre novamente antes de importar.');return{empresa_id,loja_id,usuario_id}; }
  async function mensagemErroFuncao(error) { try{const response=error?.context;if(response&&typeof response.clone==='function'){const payload=await response.clone().json();if(payload?.message)return payload.message;}}catch(_){} return error?.message&&!/non-2xx/i.test(error.message)?error.message:'O servico de leitura nao respondeu. Tente novamente em alguns instantes.'; }
  async function solicitarLeitura(file,checksum) { const dataUrl=await arquivoParaDataUrl(file),contexto=contextoAtual(),mime=String(file.type||'').toLowerCase()||(/\.pdf$/i.test(file.name||'')?'application/pdf':'');const {data,error}=await sb.functions.invoke(ENDPOINT,{body:{...contexto,filename:String(file.name||'documento').slice(0,180),mime_type:mime,size:file.size,checksum,file_data:dataUrl}});if(error)throw new Error(await mensagemErroFuncao(error));if(!data?.ok||!data?.document)throw new Error(data?.message||'Leitura do documento nao concluida.');return data.document; }
  window.imagemCompraHandleDrop=function(evento){evento.preventDefault();const z=document.getElementById('imagemCompraDropZone');if(z)z.style.borderColor='var(--border-mid)';const f=evento.dataTransfer?.files?.[0];if(f)window.imagemCompraHandleFile(f);};
  window.imagemCompraHandleFile=async function(fileOriginal){
    if(!fileOriginal)return;const input=document.getElementById('imagemCompraFileInput');if(input)input.value='';_faturaArquivoNome=String(fileOriginal.name||'documento');_faturaBancoDetectado='Codex';setMsg('msgImportarFatura','','');
    const tipo=String(fileOriginal.type||'').toLowerCase();if(!ALLOWED_TYPES.has(tipo)&&!/\.pdf$/i.test(fileOriginal.name||'')){setMsg('msgImportarFatura','Selecione PDF, PNG, JPG, WEBP ou BMP.','err');return;}if(fileOriginal.size<=0||fileOriginal.size>MAX_FILE_BYTES){setMsg('msgImportarFatura','O documento deve ter no maximo 10 MB.','err');return;}
    document.getElementById('faturaStep1').style.display='none';const step2=document.getElementById('faturaStep2');if(step2){step2.style.display='flex';step2.style.flexDirection='column';step2.style.alignItems='center';}
    try{faturaSetProgress(8,'Protegendo e validando o documento...');const file=await converterBmpParaJpeg(fileOriginal);if(file.size>MAX_FILE_BYTES)throw new Error('O documento convertido excedeu o limite de 10 MB.');const checksum=await sha256Arquivo(file),ctx=contextoAtual(),chave=`${ctx.empresa_id}:${ctx.loja_id}:${checksum}`;let promise=leiturasDaSessao.get(chave);if(!promise){faturaSetProgress(25,'Enviando para leitura segura...');promise=solicitarLeitura(file,checksum);leiturasDaSessao.set(chave,promise);}else faturaSetProgress(35,'Reutilizando a leitura segura desta sessao...');let documento;try{documento=await promise;}catch(e){leiturasDaSessao.delete(chave);throw e;}faturaSetProgress(85,'Validando dados financeiros...');const itens=adaptarRespostaCodex(documento);_faturaItensExtraidos=itens;faturaSetProgress(100,'Leitura concluida. Revise antes de lancar.');await faturaExibirRevisao({banco:textoSeguro(documento.issuer_name||documento.document_type||'Codex',120),referenciaCartao:textoSeguro(documento.issuer_name||'',120),vencimento:itens[0]?.vencimento_fatura||itens[0]?.data||hojeISO(),total_fatura:itens.reduce((s,i)=>s+Number(i.valor||0),0)});const revisar=itens.filter(i=>i._revisaoDocumentoObrigatoria).length;setMsg('msgImportarFatura',`${itens.length} conta(s) identificada(s) pelo Codex no VPS.${revisar?` ${revisar} exigem revisao reforcada.`:''} Confira fornecedor, categoria, datas, parcelas e valores antes de lancar.`,revisar?'err':'ok');}
    catch(e){console.error('Falha segura ao interpretar documento:',e?.message||'erro');if(step2)step2.style.display='none';const step1=document.getElementById('faturaStep1');if(step1)step1.style.display='';setMsg('msgImportarFatura',e?.message||'Nao foi possivel interpretar o documento.','err');}
  };
  window.imagemCompraAdaptarRespostaCodex=adaptarRespostaCodex;
})();
