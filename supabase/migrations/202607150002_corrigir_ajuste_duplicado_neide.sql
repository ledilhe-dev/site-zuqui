-- Corrige a repeticao do ajuste de 15/07: duas batidas manuais com menos de
-- dois minutos foram interpretadas como saida/retorno e reabriram a jornada.
update public.ponto_registros pr
set saida_em = greatest(pr.inicio_intervalo_em, pr.retorno_intervalo_em),
    inicio_intervalo_em = null,
    retorno_intervalo_em = null,
    updated_at = now()
from public.funcionarios f
where f.id = pr.funcionario_id
  and lower(trim(f.nome)) = 'neide'
  and pr.data_ponto = date '2026-07-15'
  and pr.saida_em is null
  and pr.inicio_intervalo_em is not null
  and pr.retorno_intervalo_em is not null
  and abs(extract(epoch from (pr.retorno_intervalo_em - pr.inicio_intervalo_em))) <= 120;
