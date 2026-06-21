-- =============================================================================
-- Migration: Adicionar loja_id em checklists e checklist_lancamentos
-- Data: 2026-04-28
-- Objetivo: isolar modelos de checklist e lançamentos por loja (multi-tenant)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Adicionar loja_id em checklists (idempotente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'checklists'
      AND column_name  = 'loja_id'
  ) THEN
    ALTER TABLE public.checklists ADD COLUMN loja_id uuid REFERENCES public.lojas(id);
    CREATE INDEX IF NOT EXISTS idx_checklists_loja_id ON public.checklists (loja_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Backfill checklists.loja_id via checklist_execucoes (que já tem loja_id)
-- -----------------------------------------------------------------------------
UPDATE public.checklists c
SET    loja_id = sub.loja_id
FROM (
  SELECT DISTINCT ON (checklist_id) checklist_id, loja_id
  FROM   public.checklist_execucoes
  WHERE  loja_id IS NOT NULL
  ORDER  BY checklist_id, iniciado_em DESC NULLS LAST
) sub
WHERE c.id = sub.checklist_id
  AND c.loja_id IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Backfill restante via checklist_lancamentos (se esta tabela tiver loja_id)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'checklist_lancamentos'
      AND column_name  = 'loja_id'
  ) THEN
    UPDATE public.checklists c
    SET    loja_id = sub.loja_id
    FROM (
      SELECT DISTINCT ON (checklist_id) checklist_id, loja_id
      FROM   public.checklist_lancamentos
      WHERE  loja_id IS NOT NULL
      ORDER  BY checklist_id, criado_em DESC NULLS LAST
    ) sub
    WHERE c.id = sub.checklist_id
      AND c.loja_id IS NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Checklists ainda sem loja: atribui à primeira loja cadastrada (mais antiga)
--    Estes são modelos criados antes do sistema multi-loja — pertencem à loja
--    principal (Zuqui).
-- -----------------------------------------------------------------------------
UPDATE public.checklists c
SET    loja_id = (
  SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1
)
WHERE c.loja_id IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Relatório pós-backfill
-- -----------------------------------------------------------------------------
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.checklists WHERE loja_id IS NULL;
  IF v_count > 0 THEN
    RAISE WARNING '% checklist(s) ainda sem loja_id após backfill.', v_count;
  ELSE
    RAISE NOTICE 'OK: todos os checklists possuem loja_id.';

    ALTER TABLE public.checklists ALTER COLUMN loja_id SET NOT NULL;
    RAISE NOTICE 'NOT NULL constraint aplicada em checklists.loja_id.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Trigger: auto-preenche loja_id em novos checklists via sessão RLS
--    (camada extra — o JS também já injeta via sb wrapper)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_checklists_require_loja_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.loja_id IS NULL THEN
    RAISE EXCEPTION
      'checklists.loja_id não pode ser nulo. Verifique se o usuário tem loja vinculada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklists_require_loja_id ON public.checklists;
CREATE TRIGGER trg_checklists_require_loja_id
  BEFORE INSERT OR UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.fn_checklists_require_loja_id();

-- -----------------------------------------------------------------------------
-- 7. Adicionar loja_id em checklist_lancamentos (idempotente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'checklist_lancamentos'
      AND column_name  = 'loja_id'
  ) THEN
    ALTER TABLE public.checklist_lancamentos ADD COLUMN loja_id uuid REFERENCES public.lojas(id);
    CREATE INDEX IF NOT EXISTS idx_checklist_lancamentos_loja_id ON public.checklist_lancamentos (loja_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Backfill checklist_lancamentos.loja_id via checklists (agora com loja_id)
-- -----------------------------------------------------------------------------
UPDATE public.checklist_lancamentos cl
SET    loja_id = c.loja_id
FROM   public.checklists c
WHERE  cl.checklist_id = c.id
  AND  cl.loja_id IS NULL
  AND  c.loja_id IS NOT NULL;

-- Fallback: via funcionarios (se ainda sobrarem nulos e houver funcionario_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'checklist_lancamentos'
      AND column_name  = 'funcionario_id'
  ) THEN
    UPDATE public.checklist_lancamentos cl
    SET    loja_id = f.loja_id
    FROM   public.funcionarios f
    WHERE  cl.funcionario_id = f.id
      AND  cl.loja_id IS NULL
      AND  f.loja_id IS NOT NULL;
  END IF;
END $$;

-- Fallback final: primeira loja
UPDATE public.checklist_lancamentos
SET    loja_id = (SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1)
WHERE  loja_id IS NULL;

-- Relatório
DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.checklist_lancamentos WHERE loja_id IS NULL;
  IF v_count > 0 THEN
    RAISE WARNING '% checklist_lancamentos ainda sem loja_id.', v_count;
  ELSE
    RAISE NOTICE 'OK: todos os checklist_lancamentos possuem loja_id.';
    ALTER TABLE public.checklist_lancamentos ALTER COLUMN loja_id SET NOT NULL;
    RAISE NOTICE 'NOT NULL constraint aplicada em checklist_lancamentos.loja_id.';
  END IF;
END $$;
