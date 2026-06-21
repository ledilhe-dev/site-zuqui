-- =============================================================================
-- Migration: Backfill loja_id em ponto_registros e tabelas relacionadas
-- Data: 2026-04-28
-- Objetivo:
--   1. Backfill de loja_id em ponto_registros (e tabelas relacionadas) via funcionarios
--   2. Validação / relatório de funcionarios sem loja_id
--   3. NOT NULL constraint em ponto_registros.loja_id para impedir registros sem loja
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Garantir que a coluna loja_id existe em ponto_registros (idempotente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ponto_registros'
      AND column_name  = 'loja_id'
  ) THEN
    ALTER TABLE public.ponto_registros ADD COLUMN loja_id uuid REFERENCES public.lojas(id);
    CREATE INDEX IF NOT EXISTS idx_ponto_registros_loja_id ON public.ponto_registros (loja_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Backfill loja_id em ponto_registros via funcionarios
-- -----------------------------------------------------------------------------
UPDATE public.ponto_registros pr
SET    loja_id = f.loja_id
FROM   public.funcionarios f
WHERE  pr.funcionario_id = f.id
  AND  pr.loja_id IS NULL
  AND  f.loja_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Backfill loja_id em ponto_intervalos (se a coluna existir)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ponto_intervalos'
      AND column_name  = 'loja_id'
  ) THEN
    UPDATE public.ponto_intervalos pi
    SET    loja_id = pr.loja_id
    FROM   public.ponto_registros pr
    WHERE  pi.ponto_registro_id = pr.id
      AND  pi.loja_id IS NULL
      AND  pr.loja_id IS NOT NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ponto_intervalos'
      AND column_name  = 'funcionario_id'
  ) THEN
    -- Fallback: busca loja via funcionario diretamente
    UPDATE public.ponto_intervalos pi
    SET    loja_id = f.loja_id
    FROM   public.funcionarios f
    WHERE  pi.funcionario_id = f.id
      AND  pi.loja_id IS NULL
      AND  f.loja_id IS NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Backfill loja_id em ponto_ajustes_solicitacoes (se a coluna existir)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ponto_ajustes_solicitacoes'
      AND column_name  = 'loja_id'
  ) THEN
    UPDATE public.ponto_ajustes_solicitacoes pas
    SET    loja_id = f.loja_id
    FROM   public.funcionarios f
    WHERE  pas.funcionario_id = f.id
      AND  pas.loja_id IS NULL
      AND  f.loja_id IS NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Backfill loja_id em ponto_batidas_auditoria (se a coluna existir)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ponto_batidas_auditoria'
      AND column_name  = 'loja_id'
  ) THEN
    UPDATE public.ponto_batidas_auditoria pba
    SET    loja_id = pr.loja_id
    FROM   public.ponto_registros pr
    WHERE  pba.ponto_registro_id = pr.id
      AND  pba.loja_id IS NULL
      AND  pr.loja_id IS NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Relatório: funcionarios ainda sem loja_id (deve retornar 0 linhas)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.funcionarios
  WHERE loja_id IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING 'Existem % funcionario(s) sem loja_id em public.funcionarios. '
                  'Esses registros precisam ser corrigidos manualmente antes de '
                  'aplicar a constraint NOT NULL em ponto_registros.', v_count;
  ELSE
    RAISE NOTICE 'OK: todos os funcionarios possuem loja_id.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Relatório: ponto_registros que ainda ficaram sem loja_id após backfill
--    (funcionarios com loja_id nulo ou funcionario_id inválido)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.ponto_registros
  WHERE loja_id IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING '% registro(s) em ponto_registros ainda sem loja_id. '
                  'Provavelmente o funcionario referenciado também não tem loja_id. '
                  'A constraint NOT NULL NÃO será aplicada até que esses registros '
                  'sejam corrigidos.', v_count;
  ELSE
    RAISE NOTICE 'OK: todos os ponto_registros possuem loja_id. Aplicando NOT NULL constraint.';

    -- Só aplica NOT NULL se não houver nulos restantes
    ALTER TABLE public.ponto_registros
      ALTER COLUMN loja_id SET NOT NULL;

    RAISE NOTICE 'NOT NULL constraint aplicada em ponto_registros.loja_id com sucesso.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Trigger: impede INSERT/UPDATE em ponto_registros sem loja_id
--    (camada extra de segurança, independente da constraint)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ponto_registros_require_loja_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se loja_id não foi fornecido, tenta preencher automaticamente via funcionario
  IF NEW.loja_id IS NULL AND NEW.funcionario_id IS NOT NULL THEN
    SELECT f.loja_id INTO NEW.loja_id
    FROM public.funcionarios f
    WHERE f.id = NEW.funcionario_id;
  END IF;

  IF NEW.loja_id IS NULL THEN
    RAISE EXCEPTION
      'ponto_registros.loja_id não pode ser nulo. '
      'Verifique se o funcionario_id "%" possui loja_id cadastrado.',
      NEW.funcionario_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_registros_require_loja_id ON public.ponto_registros;

CREATE TRIGGER trg_ponto_registros_require_loja_id
  BEFORE INSERT OR UPDATE ON public.ponto_registros
  FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_registros_require_loja_id();

-- -----------------------------------------------------------------------------
-- 8. Índice composto para queries de ponto por loja + funcionario + data
--    (melhora performance das consultas do app)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ponto_registros_loja_func_data
  ON public.ponto_registros (loja_id, funcionario_id, data_ponto);

CREATE INDEX IF NOT EXISTS idx_ponto_registros_loja_created
  ON public.ponto_registros (loja_id, created_at);
