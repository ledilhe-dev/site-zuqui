(function(){
  'use strict';
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
  function byId(id){return document.getElementById(id);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function msg(id,tipoTexto,tipo){try{if(typeof window.setMsg==='function')window.setMsg(id,tipoTexto,tipo||'');else{var el=byId(id);if(el)el.textContent=tipoTexto||'';}}catch(e){}}
  function usuario(){try{return window.usuarioSistemaLogado || (typeof usuarioSistemaLogado!=='undefined'?usuarioSistemaLogado:null) || {};}catch(e){return {};}}
  function permissoes(){var u=usuario();return (u.permissoes||u.perfil_permissoes||(u.perfil&&u.perfil.permissoes)||{});}
  function isAdmin(){
    try{if(typeof window.usuarioEhAdministrador==='function' && window.usuarioEhAdministrador()) return true;}catch(e){}
    var u=usuario(), p=u.perfil||{}, per=permissoes();
    var texto=norm([u.nome,u.username,u.email,u.tipo,u.cargo,u.perfil_codigo,u.perfil_nome,p.codigo,p.nome].join(' '));
    if(per && (per.admin===true || per.administrador===true || per.sistema_admin===true || per.relatorio_plantao===true)) return true;
    return /\b(ADM|ADMIN|ADMINISTRADOR|MASTER|SUPERADMIN|PROPRIETARIO|PATRICK|LILIANE)\b/.test(texto);
  }
  function lojaIdsPossiveis(){
    var u=usuario(), ids=[];
    function add(v){if(v && ids.indexOf(String(v))<0)ids.push(String(v));}
    try{if(typeof window.obterLojaIdSessao==='function')add(window.obterLojaIdSessao());}catch(e){}
    ['loja_id','lojaId','id_loja','loja_atual_id'].forEach(function(k){add(u[k]);});
    try{if(u.loja)add(u.loja.id||u.loja.loja_id);}catch(e){}
    try{if(typeof lojaAtualId!=='undefined')add(lojaAtualId);}catch(e){}
    try{if(window.lojaAtual) add(window.lojaAtual.id||window.lojaAtual.loja_id);}catch(e){}
    try{var ls=JSON.parse(localStorage.getItem('zuqui_usuario_logado')||localStorage.getItem('usuarioSistemaLogado')||'null'); if(ls){add(ls.loja_id); add(ls.lojaId); if(ls.loja)add(ls.loja.id||ls.loja.loja_id);}}catch(e){}
    return ids;
  }
  function dataBR(v){var s=String(v||'').slice(0,10),p=s.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s;}
  function hora(v){return String(v||'').slice(0,5);}
  function moeda(v){var n=Number(v||0);try{return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}catch(e){return 'R$ '+n.toFixed(2).replace('.',',');}}
  function tipoLabel(v){v=String(v||'plantao').toLowerCase();return v==='folga'?'Folga':v==='reuniao'?'Reunião':v==='compromisso'?'Compromisso':'Plantão';}
  function faixa(){
    var iniEl=byId('escalaRelatorioDataInicio'), fimEl=byId('escalaRelatorioDataFim');
    var ini=String(iniEl&&iniEl.value||'').slice(0,10), fim=String(fimEl&&fimEl.value||'').slice(0,10);
    var ref=(window.escalaPlantoesDataReferencia instanceof Date)?window.escalaPlantoesDataReferencia:new Date();
    function f(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    if(!ini){ini=f(new Date(ref.getFullYear(),ref.getMonth(),1)); if(iniEl)iniEl.value=ini;}
    if(!fim){fim=f(new Date(ref.getFullYear(),ref.getMonth()+1,0)); if(fimEl)fimEl.value=fim;}
    if(ini>fim){var t=ini;ini=fim;fim=t;}
    return {inicio:ini,fim:fim};
  }
  async function carregarRelatorioEscala(){
    var f=faixa(), dados=[];
    if(window.sb && window.sb.from){
      var cols='id,loja_id,empresa_id,funcionario_id,data_plantao,inicio_hora,fim_hora,tipo,titulo,observacao,valor_combinado,deleted_at,deleted_by_nome,deleted_by_funcionario_id,created_at,updated_at';
      var ids=lojaIdsPossiveis();
      var consultas=[];
      if(ids.length){
        for(var i=0;i<ids.length;i++) consultas.push(window.sb.from('escala_plantoes').select(cols).eq('loja_id',ids[i]).gte('data_plantao',f.inicio).lte('data_plantao',f.fim).order('data_plantao',{ascending:true}).order('inicio_hora',{ascending:true}));
      }
      consultas.push(window.sb.from('escala_plantoes').select(cols).gte('data_plantao',f.inicio).lte('data_plantao',f.fim).order('data_plantao',{ascending:true}).order('inicio_hora',{ascending:true}));
      var ultimoErro=null;
      for(var c=0;c<consultas.length;c++){
        var r=await consultas[c];
        if(r.error){ultimoErro=r.error; continue;}
        dados=r.data||[];
        if(dados.length || c===consultas.length-1) break;
      }
      if(!dados.length && ultimoErro) throw ultimoErro;
      var fids=[...new Set(dados.map(function(x){return x.funcionario_id;}).filter(Boolean).map(String))];
      var nomes={};
      if(fids.length){try{var rf=await window.sb.from('funcionarios').select('id,nome').in('id',fids); if(!rf.error)(rf.data||[]).forEach(function(x){nomes[String(x.id)]=x.nome||'';});}catch(e){}}
      dados.forEach(function(x){x.funcionario_nome=nomes[String(x.funcionario_id)] || x.funcionario_nome || x.titulo || 'Funcionário';});
    } else {
      dados=(window.escalaPlantoesEventos||[]).filter(function(x){var d=String(x.data_plantao||'').slice(0,10);return d>=f.inicio&&d<=f.fim;});
    }
    return dados;
  }
  function diaSemanaBR(v){var d=String(v||'').slice(0,10); if(!d)return '-'; var p=d.split('-'); if(p.length!==3)return '-'; var dt=new Date(Number(p[0]),Number(p[1])-1,Number(p[2])); return ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'][dt.getDay()]||'-';}
  function excluidoPor(it){return it&&it.deleted_at ? (it.deleted_by_nome || '-') : '-';}
  function status(it){return it&&it.deleted_at?('Excluído'+(it.deleted_by_nome?' por '+it.deleted_by_nome:'')):'Ativo';}
  function podeVerValor(){try{return typeof window.usuarioPodeVerValorCombinadoEscala==='function'?window.usuarioPodeVerValorCombinadoEscala():true;}catch(e){return true;}}
  async function renderRelatorioEscala(){
    var lista=byId('listaRelatorioEscalaPlantoes'), resumo=byId('escalaRelatorioResumo'); if(!lista)return;
    if(!isAdmin()){
      if(resumo)resumo.textContent='Relatório disponível apenas para perfil Administrador.';
      lista.innerHTML='<div class="empty">Sem permissão para visualizar este relatório.</div>';
      return;
    }
    lista.innerHTML='<div class="empty">Carregando relatório...</div>';
    try{
      var eventos=await carregarRelatorioEscala(), verValor=podeVerValor();
      var ativos=eventos.filter(function(x){return !x.deleted_at;});
      var total=ativos.reduce(function(a,x){return a+Number(x.valor_combinado||0);},0);
      if(resumo)resumo.textContent=eventos.length?(eventos.length+' lançamento(s) no período · '+ativos.length+' ativo(s)'+(verValor?' · Total ativo: '+moeda(total):'')):'Sem lançamentos no período.';
      if(!eventos.length){lista.innerHTML='<div class="empty">Sem lançamentos.</div>';return;}
      lista.innerHTML=eventos.map(function(it){
        var del=!!it.deleted_at, tipo=String(it.tipo||'plantao').toLowerCase(), nome=it.funcionario_nome||it.titulo||'Funcionário';
        return '<div class="escala-relatorio-item" style="'+(del?'opacity:.62;border-color:rgba(239,68,68,.35);':'')+'">'+
          '<div><strong>'+esc(dataBR(it.data_plantao))+'</strong><div class="item-detalhe">'+esc(diaSemanaBR(it.data_plantao))+'</div><div class="item-detalhe">'+esc(status(it))+'</div>'+(it.deleted_at?'<div class="item-detalhe">Excluído por: '+esc(excluidoPor(it))+'</div>':'')+'</div>'+
          '<div><strong>'+esc(nome)+'</strong><div class="item-detalhe">'+esc(it.titulo||'')+'</div></div>'+
          '<div class="tipo '+esc(tipo)+'">'+esc(tipoLabel(tipo))+'</div>'+
          '<div>'+esc(hora(it.inicio_hora))+' → '+esc(hora(it.fim_hora))+'</div>'+
          (verValor?'<div class="escala-relatorio-valor" data-permissao-valor-escala>'+esc(moeda(it.valor_combinado))+'</div>':'')+
        '</div>';
      }).join('');
    }catch(e){console.error('Relatório escala/plantões:',e); if(resumo)resumo.textContent='Erro ao buscar relatório.'; lista.innerHTML='<div class="empty">Não foi possível carregar: '+esc(e.message||'erro desconhecido')+'</div>';}
  }
  window.renderizarRelatorioEscalaPlantoes=renderRelatorioEscala;
  window.buscarEventosRelatorioEscalaExportacao=carregarRelatorioEscala;
  window.exportarRelatorioEscalaExcel=async function(){
    if(!isAdmin()){msg('msgEscalaPlantoes','Somente Administrador pode exportar este relatório.','err');return;}
    var eventos=await carregarRelatorioEscala(); if(!eventos.length){msg('msgEscalaPlantoes','Não há dados para exportar no período selecionado.','err');return;}
    var verValor=podeVerValor();
    var linhas=[verValor?['Data','Dia da semana','Funcionário','Tipo','Início','Fim','Título','Valor combinado','Status','Excluído por','Observação']:['Data','Dia da semana','Funcionário','Tipo','Início','Fim','Título','Status','Excluído por','Observação']];
    eventos.forEach(function(it){var row=[dataBR(it.data_plantao),diaSemanaBR(it.data_plantao),it.funcionario_nome||it.titulo||'Funcionário',tipoLabel(it.tipo),hora(it.inicio_hora),hora(it.fim_hora),it.titulo||'']; if(verValor)row.push(Number(it.valor_combinado||0).toFixed(2).replace('.',',')); row.push(status(it)); row.push(excluidoPor(it)); row.push(it.observacao||''); linhas.push(row);});
    var csv='\ufeff'+linhas.map(function(r){return r.map(function(c){return '"'+String(c==null?'':c).replace(/"/g,'""')+'"';}).join(';');}).join('\n');
    var f=faixa(), blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='relatorio-escala-'+f.inicio+'-a-'+f.fim+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  window.exportarRelatorioEscalaPDF=async function(){
    if(!isAdmin()){msg('msgEscalaPlantoes','Somente Administrador pode exportar este relatório.','err');return;}
    var eventos=await carregarRelatorioEscala(); if(!eventos.length){msg('msgEscalaPlantoes','Não há dados para exportar no período selecionado.','err');return;}
    var verValor=podeVerValor(), f=faixa(), total=eventos.filter(function(e){return !e.deleted_at;}).reduce(function(a,e){return a+Number(e.valor_combinado||0);},0);
    var rows=eventos.map(function(it){var del=!!it.deleted_at;return '<tr style="'+(del?'color:#991b1b;text-decoration:line-through;':'')+'"><td>'+esc(dataBR(it.data_plantao))+'</td><td>'+esc(diaSemanaBR(it.data_plantao))+'</td><td>'+esc(it.funcionario_nome||it.titulo||'Funcionário')+'</td><td>'+esc(tipoLabel(it.tipo))+'</td><td>'+esc(hora(it.inicio_hora))+' → '+esc(hora(it.fim_hora))+'</td>'+(verValor?'<td>'+esc(moeda(it.valor_combinado))+'</td>':'')+'<td>'+esc(status(it))+'</td><td>'+esc(excluidoPor(it))+'</td><td>'+esc(it.observacao||'')+'</td></tr>';}).join('');
    var w=window.open('','_blank'); if(!w){msg('msgEscalaPlantoes','Pop-up bloqueado. Permita pop-ups para exportar PDF.','err');return;}
    var geradoEm=new Date().toLocaleString('pt-BR'), filtrosRodape='Período: '+dataBR(f.inicio)+' até '+dataBR(f.fim);
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório de Escala</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}th{background:#f3f4f6}.meta{color:#555;margin-bottom:16px}'+cssRodapeRelatorioImpressao()+'</style></head><body><h1>Relatório de Escalas</h1><div class="meta">Período: '+esc(dataBR(f.inicio))+' até '+esc(dataBR(f.fim))+(verValor?' · Total ativo: '+esc(moeda(total)):'')+' · Gerado em '+esc(geradoEm)+'</div><table><thead><tr><th>Data</th><th>Dia da semana</th><th>Funcionário</th><th>Tipo</th><th>Horário</th>'+(verValor?'<th>Valor</th>':'')+'<th>Status</th><th>Excluído por</th><th>Observação</th></tr></thead><tbody>'+rows+'</tbody></table>'+htmlRodapeRelatorioImpressao(geradoEm,filtrosRodape)+'</body></html>');
    w.document.close(); w.focus(); setTimeout(function(){w.print();},300);
  };
  function ajustarVisibilidade(){
    var admin=isAdmin();
    document.querySelectorAll('[data-page="relatorio_plantao"], button[onclick*="relatorio_plantao"]').forEach(function(el){el.style.display=admin?'':'none';});
  }
  var old=window.abrirPagina;
  if(typeof old==='function' && !old.__relatorioEscalaAdminFinal){
    window.abrirPagina=function(id,btn){
      if(id==='relatorio_plantao' && !isAdmin()){msg('msgEscalaPlantoes','Relatório da escala disponível apenas para Administrador.','err');return;}
      var r=old.apply(this,arguments); if(id==='relatorio_plantao') setTimeout(renderRelatorioEscala,150); return r;
    };
    window.abrirPagina.__relatorioEscalaAdminFinal=true;
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(ajustarVisibilidade,800); setTimeout(function(){if(byId('relatorio_plantao')&&byId('relatorio_plantao').classList.contains('ativa'))renderRelatorioEscala();},1000);});
  setTimeout(ajustarVisibilidade,1500);
})();
