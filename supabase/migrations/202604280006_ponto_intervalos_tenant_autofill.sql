-- =============================================================================
-- Migration: Garantir tenant (loja/empresa) em ponto_intervalos
-- Data: 2026-04-28
-- Objetivo: evitar erro de NOT NULL em empresa_id ao inserir/recriar intervalos
-- =============================================================================

-- 1) Garante colunas
ALTER TABLE public.ponto_intervalos
  ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);

ALTER TABLE public.ponto_intervalos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

-- 2) Backfill por ponto_registros
UPDATE public.ponto_intervalos pi
SET loja_id = pr.loja_id,
    empresa_id = COALESCE(pi.empresa_id, pr.empresa_id)
FROM public.ponto_registros pr
WHERE pi.ponto_registro_id = pr.id
  AND (pi.loja_id IS NULL OR pi.empresa_id IS NULL);

-- 3) Fallback por funcionario (quando existir na tabela)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ponto_intervalos'
      AND column_name = 'funcionario_id'
  ) THEN
    UPDATE public.ponto_intervalos pi
    SET loja_id = COALESCE(pi.loja_id, f.loja_id),
        empresa_id = COALESCE(pi.empresa_id, f.empresa_id)
    FROM public.funcionarios f
    WHERE pi.funcionario_id = f.id
      AND (pi.loja_id IS NULL OR pi.empresa_id IS NULL);
  END IF;
END $$;

-- 4) Fallback final padrão
UPDATE public.ponto_intervalos
SET loja_id = (
  SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1
)
WHERE loja_id IS NULL;

UPDATE public.ponto_intervalos
SET empresa_id = (
  SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1
)
WHERE empresa_id IS NULL;

-- 5) Trigger para autopreencher tenant
CREATE OR REPLACE FUNCTION public.fn_ponto_intervalos_fill_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_loja_id uuid;
  v_empresa_id uuid;
BEGIN
  IF NEW.ponto_registro_id IS NOT NULL THEN
    SELECT pr.loja_id, pr.empresa_id
      INTO v_loja_id, v_empresa_id
      FROM public.ponto_registros pr
     WHERE pr.id = NEW.ponto_registro_id;

    IF NEW.loja_id IS NULL THEN
      NEW.loja_id := v_loja_id;
    END IF;

    IF NEW.empresa_id IS NULL THEN
      NEW.empresa_id := v_empresa_id;
    END IF;
  END IF;

  IF NEW.empresa_id IS NULL AND NEW.loja_id IS NOT NULL THEN
    SELECT l.empresa_id
      INTO NEW.empresa_id
      FROM public.lojas l
     WHERE l.id = NEW.loja_id;
  END IF;

  IF NEW.loja_id IS NULL THEN
    RAISE EXCEPTION
      'ponto_intervalos.loja_id não pode ser nulo. ponto_registro_id=%',
      NEW.ponto_registro_id;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION
      'ponto_intervalos.empresa_id não pode ser nulo. ponto_registro_id=%',
      NEW.ponto_registro_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_intervalos_fill_tenant ON public.ponto_intervalos;
CREATE TRIGGER trg_ponto_intervalos_fill_tenant
  BEFORE INSERT OR UPDATE ON public.ponto_intervalos
  FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_intervalos_fill_tenant();

-- 6) Constraints finais
ALTER TABLE public.ponto_intervalos ALTER COLUMN loja_id SET NOT NULL;
ALTER TABLE public.ponto_intervalos ALTER COLUMN empresa_id SET NOT NULL;

-- 7) Índices
CREATE INDEX IF NOT EXISTS idx_ponto_intervalos_loja_id ON public.ponto_intervalos(loja_id);
CREATE INDEX IF NOT EXISTS idx_ponto_intervalos_empresa_id ON public.ponto_intervalos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ponto_intervalos_registro_ordem ON public.ponto_intervalos(ponto_registro_id, ordem);

-- 8) Relatório
DO $$
DECLARE
  v_sem_loja integer;
  v_sem_empresa integer;
BEGIN
  SELECT COUNT(*) INTO v_sem_loja FROM public.ponto_intervalos WHERE loja_id IS NULL;
  SELECT COUNT(*) INTO v_sem_empresa FROM public.ponto_intervalos WHERE empresa_id IS NULL;

  RAISE NOTICE 'ponto_intervalos sem loja_id: %', v_sem_loja;
  RAISE NOTICE 'ponto_intervalos sem empresa_id: %', v_sem_empresa;
END $$;
