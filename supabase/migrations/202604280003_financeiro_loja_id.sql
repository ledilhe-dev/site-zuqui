-- =============================================================================
-- Migration: Adicionar loja_id nas tabelas financeiras
-- Data: 2026-04-28
-- Tabelas: fornecedores, formas_pagamento, contasapagar, recebiveis,
--           contas_financeiras, contas_financeiras_movimentacoes,
--           contas_financeiras_ajustes_saldo
-- =============================================================================

-- Helper: uuid da primeira loja (backfill padrão para dados legados)
DO $$
DECLARE v_loja_id uuid;
BEGIN
  SELECT id INTO v_loja_id FROM public.lojas ORDER BY criado_em ASC LIMIT 1;
  IF v_loja_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma loja encontrada em public.lojas. Cadastre ao menos uma loja antes de rodar esta migration.';
  END IF;
END $$;

-- =============================================================================
-- 1. fornecedores
-- =============================================================================
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

UPDATE public.fornecedores
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

ALTER TABLE public.fornecedores ALTER COLUMN loja_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fornecedores_loja_id ON public.fornecedores (loja_id);

-- Unique por nome dentro da loja
DROP INDEX IF EXISTS fornecedores_cnpj_uk;
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_cnpj_loja_uk
  ON public.fornecedores (loja_id, (regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g')))
  WHERE coalesce(cnpj, '') <> '';

-- =============================================================================
-- 2. formas_pagamento
-- =============================================================================
ALTER TABLE public.formas_pagamento
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

UPDATE public.formas_pagamento
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

ALTER TABLE public.formas_pagamento ALTER COLUMN loja_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_formas_pagamento_loja_id ON public.formas_pagamento (loja_id);

-- Recria unique por loja+nome (antiga era só por nome globalmente)
DROP INDEX IF EXISTS formas_pagamento_nome_uk;
CREATE UNIQUE INDEX IF NOT EXISTS formas_pagamento_loja_nome_uk
  ON public.formas_pagamento (loja_id, (lower(trim(nome))));

-- =============================================================================
-- 3. contasapagar
-- =============================================================================
ALTER TABLE public.contasapagar
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

UPDATE public.contasapagar c
SET    loja_id = f.loja_id
FROM   public.fornecedores f
WHERE  c.fornecedor_id = f.id
  AND  c.loja_id IS NULL
  AND  f.loja_id IS NOT NULL;

-- Fallback: primeira loja para registros órfãos
UPDATE public.contasapagar
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

ALTER TABLE public.contasapagar ALTER COLUMN loja_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contasapagar_loja_id ON public.contasapagar (loja_id);
CREATE INDEX IF NOT EXISTS idx_contasapagar_loja_vencimento ON public.contasapagar (loja_id, data_vencimento);

-- =============================================================================
-- 4. recebiveis
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recebiveis'
  ) THEN
    ALTER TABLE public.recebiveis
      ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

    -- Backfill via pagador (fornecedores já tem loja_id)
    UPDATE public.recebiveis r
    SET    loja_id = f.loja_id
    FROM   public.fornecedores f
    WHERE  r.pagador_id = f.id
      AND  r.loja_id IS NULL
      AND  f.loja_id IS NOT NULL;

    -- Fallback
    UPDATE public.recebiveis
    SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
    WHERE  loja_id IS NULL;

    ALTER TABLE public.recebiveis ALTER COLUMN loja_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_recebiveis_loja_id ON public.recebiveis (loja_id);

    RAISE NOTICE 'OK: loja_id adicionado em recebiveis.';
  ELSE
    RAISE NOTICE 'Tabela recebiveis não encontrada; pulando.';
  END IF;
END $$;

-- =============================================================================
-- 5. contas_financeiras
-- =============================================================================
ALTER TABLE public.contas_financeiras
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

UPDATE public.contas_financeiras
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

ALTER TABLE public.contas_financeiras ALTER COLUMN loja_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_financeiras_loja_id ON public.contas_financeiras (loja_id);

-- Unique por nome dentro da loja
DROP INDEX IF EXISTS contas_financeiras_nome_uk;
CREATE UNIQUE INDEX IF NOT EXISTS contas_financeiras_loja_nome_uk
  ON public.contas_financeiras (loja_id, (lower(trim(nome))));

-- =============================================================================
-- 6. contas_financeiras_movimentacoes
-- =============================================================================
ALTER TABLE public.contas_financeiras_movimentacoes
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

UPDATE public.contas_financeiras_movimentacoes m
SET    loja_id = cf.loja_id
FROM   public.contas_financeiras cf
WHERE  m.conta_financeira_id = cf.id
  AND  m.loja_id IS NULL
  AND  cf.loja_id IS NOT NULL;

UPDATE public.contas_financeiras_movimentacoes
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

ALTER TABLE public.contas_financeiras_movimentacoes ALTER COLUMN loja_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_mov_loja_id ON public.contas_financeiras_movimentacoes (loja_id);

-- =============================================================================
-- 7. contas_financeiras_ajustes_saldo
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contas_financeiras_ajustes_saldo'
  ) THEN
    ALTER TABLE public.contas_financeiras_ajustes_saldo
      ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

    UPDATE public.contas_financeiras_ajustes_saldo a
    SET    loja_id = cf.loja_id
    FROM   public.contas_financeiras cf
    WHERE  a.conta_financeira_id = cf.id
      AND  a.loja_id IS NULL
      AND  cf.loja_id IS NOT NULL;

    UPDATE public.contas_financeiras_ajustes_saldo
    SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
    WHERE  loja_id IS NULL;

    ALTER TABLE public.contas_financeiras_ajustes_saldo ALTER COLUMN loja_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_contas_ajustes_loja_id ON public.contas_financeiras_ajustes_saldo (loja_id);

    RAISE NOTICE 'OK: loja_id adicionado em contas_financeiras_ajustes_saldo.';
  ELSE
    RAISE NOTICE 'Tabela contas_financeiras_ajustes_saldo não encontrada; pulando.';
  END IF;
END $$;

-- =============================================================================
-- 8. Resumo final
-- =============================================================================
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.fornecedores WHERE loja_id IS NULL;
  RAISE NOTICE 'fornecedores sem loja_id: %', v_count;

  SELECT COUNT(*) INTO v_count FROM public.formas_pagamento WHERE loja_id IS NULL;
  RAISE NOTICE 'formas_pagamento sem loja_id: %', v_count;

  SELECT COUNT(*) INTO v_count FROM public.contasapagar WHERE loja_id IS NULL;
  RAISE NOTICE 'contasapagar sem loja_id: %', v_count;

  SELECT COUNT(*) INTO v_count FROM public.contas_financeiras WHERE loja_id IS NULL;
  RAISE NOTICE 'contas_financeiras sem loja_id: %', v_count;

  RAISE NOTICE 'Estrutura financeira multi-loja concluída.';
END $$;
