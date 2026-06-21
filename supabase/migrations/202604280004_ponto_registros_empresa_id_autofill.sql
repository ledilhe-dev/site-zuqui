-- =============================================================================
-- Migration: Preenchimento automático de empresa_id em ponto_registros
-- Data: 2026-04-28
-- Objetivo: evitar falha de INSERT quando empresa_id vier nulo no frontend
-- =============================================================================

-- 1) Backfill de empresa_id já existente em ponto_registros
UPDATE public.ponto_registros pr
SET    empresa_id = f.empresa_id
FROM   public.funcionarios f
WHERE  pr.empresa_id IS NULL
  AND  pr.funcionario_id = f.id
  AND  f.empresa_id IS NOT NULL;

UPDATE public.ponto_registros pr
SET    empresa_id = l.empresa_id
FROM   public.lojas l
WHERE  pr.empresa_id IS NULL
  AND  pr.loja_id = l.id
  AND  l.empresa_id IS NOT NULL;

UPDATE public.ponto_registros
SET    empresa_id = (
  SELECT id
  FROM public.empresas
  ORDER BY criado_em ASC
  LIMIT 1
)
WHERE  empresa_id IS NULL;

-- 2) Trigger de segurança: preencher loja_id e empresa_id automaticamente
CREATE OR REPLACE FUNCTION public.fn_ponto_registros_require_loja_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_func_loja_id uuid;
  v_func_empresa_id uuid;
  v_loja_empresa_id uuid;
  v_empresa_default_id uuid;
BEGIN
  IF NEW.funcionario_id IS NOT NULL THEN
    SELECT f.loja_id, f.empresa_id
      INTO v_func_loja_id, v_func_empresa_id
      FROM public.funcionarios f
     WHERE f.id = NEW.funcionario_id;

    IF NEW.loja_id IS NULL THEN
      NEW.loja_id := v_func_loja_id;
    END IF;

    IF NEW.empresa_id IS NULL THEN
      NEW.empresa_id := v_func_empresa_id;
    END IF;
  END IF;

  IF NEW.loja_id IS NOT NULL THEN
    SELECT l.empresa_id
      INTO v_loja_empresa_id
      FROM public.lojas l
     WHERE l.id = NEW.loja_id;

    IF NEW.empresa_id IS NULL THEN
      NEW.empresa_id := v_loja_empresa_id;
    ELSIF v_loja_empresa_id IS NOT NULL AND NEW.empresa_id <> v_loja_empresa_id THEN
      NEW.empresa_id := v_loja_empresa_id;
    END IF;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    SELECT e.id
      INTO v_empresa_default_id
      FROM public.empresas e
     ORDER BY e.criado_em ASC
     LIMIT 1;
    NEW.empresa_id := v_empresa_default_id;
  END IF;

  IF NEW.loja_id IS NULL THEN
    RAISE EXCEPTION
      'ponto_registros.loja_id não pode ser nulo. Verifique se o funcionario_id "%" possui loja_id cadastrado.',
      NEW.funcionario_id;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION
      'ponto_registros.empresa_id não pode ser nulo. Verifique se a loja "%" possui empresa_id cadastrado.',
      NEW.loja_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Validação rápida
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.ponto_registros
   WHERE empresa_id IS NULL;

  IF v_count > 0 THEN
    RAISE WARNING '% registro(s) em ponto_registros ainda sem empresa_id após backfill.', v_count;
  ELSE
    RAISE NOTICE 'OK: todos os ponto_registros possuem empresa_id.';
  END IF;
END $$;
