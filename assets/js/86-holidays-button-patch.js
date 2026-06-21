(function(){
  async function buscarLojaAtualParaFeriados() {
    var lojaId = '';
    try {
      lojaId = String((typeof obterLojaIdSessao === 'function' && obterLojaIdSessao()) || (window.usuarioSistemaLogado && window.usuarioSistemaLogado.loja_id) || '').trim();
    } catch (_) {}

    var cidade = String(document.getElementById('configCidadeLoja')?.value || '').trim();
    var estado = String(document.getElementById('configEstadoLoja')?.value || '').trim().toUpperCase();
    var cep = String(document.getElementById('configCepLoja')?.value || '').trim();

    if (lojaId && typeof sb !== 'undefined' && sb?.from) {
      try {
        var resp = await sb.from('lojas').select('id,nome,nome_loja,cep,cidade,estado,uf,municipio').eq('id', lojaId).maybeSingle();
        if (!resp.error && resp.data) {
          cidade = cidade || String(resp.data.cidade || resp.data.municipio || '').trim();
          estado = estado || String(resp.data.estado || resp.data.uf || '').trim().toUpperCase();
          cep = cep || String(resp.data.cep || '').trim();
          return { id: lojaId, cep, cidade, estado };
        }
      } catch (_) {}
    }

    if (!lojaId) {
      try { lojaId = String(window.usuarioSistemaLogado?.loja_id || '').trim(); } catch (_) {}
    }
    return { id: lojaId, cep, cidade, estado };
  }

  window.atualizarFeriadosDaLojaAtual = async function() {
    try {
      if (typeof setMsg === 'function') setMsg('msgConfiguracoes', 'Atualizando feriados da loja...', 'ok');
      if (typeof sb === 'undefined' || !sb?.from) throw new Error('Supabase não iniciado.');

      var anoAtual = new Date().getFullYear();
      var loja = await buscarLojaAtualParaFeriados();
      if (!loja.id) throw new Error('Loja logada não identificada.');
      if (!loja.cidade || !loja.estado) throw new Error('Informe cidade e estado da loja antes de atualizar os feriados.');

      // Garante que a loja principal também tenha cidade/estado/CEP atualizados quando possível.
      try {
        await sb.from('lojas').update({
          cep: loja.cep || null,
          cidade: loja.cidade,
          estado: loja.estado
        }).eq('id', loja.id);
      } catch (_) {}

      var total = 0;
      if (typeof window.atualizarFeriadosLojaAno === 'function') {
        var anos = [anoAtual, anoAtual + 1];
        for (var i = 0; i < anos.length; i++) {
          var r = await window.atualizarFeriadosLojaAno(anos[i], loja.id);
          total += Number(r?.total || 0);
        }
      } else {
        throw new Error('Função de atualização de feriados não encontrada no index.');
      }

      if (typeof setMsg === 'function') {
        setMsg('msgConfiguracoes', 'Feriados atualizados para ' + loja.cidade + '/' + loja.estado + ' (' + anoAtual + ' e ' + (anoAtual + 1) + '). Total: ' + total + '.', 'ok');
      }
      try {
        if (typeof window.renderizarEscalaPlantoes === 'function') window.renderizarEscalaPlantoes();
      } catch (_) {}
    } catch (e) {
      console.error('Erro ao atualizar feriados da loja:', e);
      if (typeof setMsg === 'function') setMsg('msgConfiguracoes', 'Não foi possível atualizar feriados: ' + (e.message || 'erro desconhecido'), 'err');
    }
  };
})();
