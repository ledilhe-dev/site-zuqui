-- =============================================================================
-- Migration: Garantir tabela ponto_ajustes_solicitacoes + tenant (loja/empresa)
-- Data: 2026-04-28
-- Objetivo: corrigir erro no fluxo "Solicitar ajuste de ponto"
-- =============================================================================

-- 1) Cria tabela se não existir
CREATE TABLE IF NOT EXISTS public.ponto_ajustes_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  funcionario_nome text,
  data_ajuste date NOT NULL,
  horario_ajuste time NOT NULL,
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  aprovado_por_id uuid,
  aprovado_por_nome text,
  recusado_em timestamptz,
  recusado_por_id uuid,
  recusado_por_nome text,
  motivo_recusa text,
  loja_id uuid REFERENCES public.lojas(id),
  empresa_id uuid REFERENCES public.empresas(id)
);

-- 2) Garante colunas para bases antigas
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS funcionario_nome text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS data_ajuste date;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS horario_ajuste time;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS motivo text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS solicitado_em timestamptz;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS aprovado_por_id uuid;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS aprovado_por_nome text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS recusado_em timestamptz;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS recusado_por_id uuid;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS recusado_por_nome text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS motivo_recusa text;
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES public.lojas(id);
ALTER TABLE public.ponto_ajustes_solicitacoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);

-- Defaults seguros
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN solicitado_em SET DEFAULT now();
UPDATE public.ponto_ajustes_solicitacoes
SET solicitado_em = now()
WHERE solicitado_em IS NULL;

UPDATE public.ponto_ajustes_solicitacoes
SET status = 'pendente'
WHERE status IS NULL OR btrim(status) = '';

-- Normaliza valores de status fora do padrão
UPDATE public.ponto_ajustes_solicitacoes
SET status = 'pendente'
WHERE status NOT IN ('pendente', 'aprovado', 'recusado');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ponto_ajustes_solicitacoes_status_ck'
      AND conrelid = 'public.ponto_ajustes_solicitacoes'::regclass
  ) THEN
    ALTER TABLE public.ponto_ajustes_solicitacoes
      ADD CONSTRAINT ponto_ajustes_solicitacoes_status_ck
      CHECK (status IN ('pendente', 'aprovado', 'recusado'));
  END IF;
END $$;

-- 3) Backfill de nome/tenant
UPDATE public.ponto_ajustes_solicitacoes pas
SET funcionario_nome = f.nome
FROM public.funcionarios f
WHERE pas.funcionario_id = f.id
  AND (pas.funcionario_nome IS NULL OR btrim(pas.funcionario_nome) = '');

UPDATE public.ponto_ajustes_solicitacoes pas
SET loja_id = f.loja_id,
    empresa_id = COALESCE(pas.empresa_id, f.empresa_id)
FROM public.funcionarios f
WHERE pas.funcionario_id = f.id
  AND (pas.loja_id IS NULL OR pas.empresa_id IS NULL);

UPDATE public.ponto_ajustes_solicitacoes pas
SET empresa_id = l.empresa_id
FROM public.lojas l
WHERE pas.loja_id = l.id
  AND pas.empresa_id IS NULL;

UPDATE public.ponto_ajustes_solicitacoes
SET loja_id = (
  SELECT id FROM public.lojas ORDER BY criado_em ASC LIMIT 1
)
WHERE loja_id IS NULL;

UPDATE public.ponto_ajustes_solicitacoes
SET empresa_id = (
  SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1
)
WHERE empresa_id IS NULL;

-- 4) Trigger para autopreencher tenant e nome
CREATE OR REPLACE FUNCTION public.fn_ponto_ajustes_solicitacoes_fill_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome text;
  v_loja_id uuid;
  v_empresa_id uuid;
BEGIN
  IF NEW.funcionario_id IS NOT NULL THEN
    SELECT f.nome, f.loja_id, f.empresa_id
      INTO v_nome, v_loja_id, v_empresa_id
      FROM public.funcionarios f
     WHERE f.id = NEW.funcionario_id;

    IF (NEW.funcionario_nome IS NULL OR btrim(NEW.funcionario_nome) = '') AND v_nome IS NOT NULL THEN
      NEW.funcionario_nome := v_nome;
    END IF;

    IF NEW.loja_id IS NULL THEN
      NEW.loja_id := v_loja_id;
    END IF;

    IF NEW.empresa_id IS NULL THEN
      NEW.empresa_id := v_empresa_id;
    END IF;
  END IF;

  IF NEW.empresa_id IS NULL AND NEW.loja_id IS NOT NULL THEN
    SELECT l.empresa_id INTO NEW.empresa_id
    FROM public.lojas l
    WHERE l.id = NEW.loja_id;
  END IF;

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'pendente';
  END IF;

  IF NEW.solicitado_em IS NULL THEN
    NEW.solicitado_em := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_ajustes_solicitacoes_fill_tenant ON public.ponto_ajustes_solicitacoes;
CREATE TRIGGER trg_ponto_ajustes_solicitacoes_fill_tenant
  BEFORE INSERT OR UPDATE ON public.ponto_ajustes_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_ponto_ajustes_solicitacoes_fill_tenant();

-- 5) Constraints finais (após backfill)
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN data_ajuste SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN horario_ajuste SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN motivo SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN solicitado_em SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN loja_id SET NOT NULL;
ALTER TABLE public.ponto_ajustes_solicitacoes ALTER COLUMN empresa_id SET NOT NULL;

-- 6) Índices
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_funcionario ON public.ponto_ajustes_solicitacoes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_status ON public.ponto_ajustes_solicitacoes(status);
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_data ON public.ponto_ajustes_solicitacoes(data_ajuste);
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_solicitado_em ON public.ponto_ajustes_solicitacoes(solicitado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_loja ON public.ponto_ajustes_solicitacoes(loja_id);
CREATE INDEX IF NOT EXISTS idx_ponto_ajustes_empresa ON public.ponto_ajustes_solicitacoes(empresa_id);

-- 7) RLS (mesma regra de transição usada no projeto)
ALTER TABLE public.ponto_ajustes_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ponto_ajustes_solicitacoes_select_empresa_transition ON public.ponto_ajustes_solicitacoes;
DROP POLICY IF EXISTS ponto_ajustes_solicitacoes_insert_empresa_transition ON public.ponto_ajustes_solicitacoes;
DROP POLICY IF EXISTS ponto_ajustes_solicitacoes_update_empresa_transition ON public.ponto_ajustes_solicitacoes;
DROP POLICY IF EXISTS ponto_ajustes_solicitacoes_delete_empresa_transition ON public.ponto_ajustes_solicitacoes;

CREATE POLICY ponto_ajustes_solicitacoes_select_empresa_transition
ON public.ponto_ajustes_solicitacoes
FOR SELECT TO anon, authenticated
USING (public.current_empresa_id() IS NULL OR empresa_id = public.current_empresa_id());

CREATE POLICY ponto_ajustes_solicitacoes_insert_empresa_transition
ON public.ponto_ajustes_solicitacoes
FOR INSERT TO anon, authenticated
WITH CHECK (public.current_empresa_id() IS NULL OR empresa_id = public.current_empresa_id());

CREATE POLICY ponto_ajustes_solicitacoes_update_empresa_transition
ON public.ponto_ajustes_solicitacoes
FOR UPDATE TO anon, authenticated
USING (public.current_empresa_id() IS NULL OR empresa_id = public.current_empresa_id())
WITH CHECK (public.current_empresa_id() IS NULL OR empresa_id = public.current_empresa_id());

CREATE POLICY ponto_ajustes_solicitacoes_delete_empresa_transition
ON public.ponto_ajustes_solicitacoes
FOR DELETE TO anon, authenticated
USING (public.current_empresa_id() IS NULL OR empresa_id = public.current_empresa_id());

-- 8) Relatório
DO $$
DECLARE
  v_total integer;
  v_sem_loja integer;
  v_sem_empresa integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.ponto_ajustes_solicitacoes;
  SELECT COUNT(*) INTO v_sem_loja FROM public.ponto_ajustes_solicitacoes WHERE loja_id IS NULL;
  SELECT COUNT(*) INTO v_sem_empresa FROM public.ponto_ajustes_solicitacoes WHERE empresa_id IS NULL;

  RAISE NOTICE 'ponto_ajustes_solicitacoes total: %', v_total;
  RAISE NOTICE 'ponto_ajustes_solicitacoes sem loja_id: %', v_sem_loja;
  RAISE NOTICE 'ponto_ajustes_solicitacoes sem empresa_id: %', v_sem_empresa;
END $$;
