-- Mantém o vínculo explícito entre a provisão e o recebível real e impede
-- que duplo clique/duas sessões gerem duas baixas para o mesmo título.
create unique index if not exists recebiveis_recebivel_futuro_unico_idx
  on public.recebiveis (recebivel_futuro_id)
  where recebivel_futuro_id is not null;

notify pgrst, 'reload schema';
