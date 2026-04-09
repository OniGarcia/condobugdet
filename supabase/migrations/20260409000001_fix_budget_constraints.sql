-- Fix unique constraints to include condo_id for multi-tenancy support
-- Problem: After adding condo_id column (multi-tenancy), the old unique constraints
-- did not include it. This caused "no unique constraint matching ON CONFLICT" errors
-- when doing upserts in bulkUpsertRealizados and bulkUpsertOrcamentos.

-- 1. Fix dados_realizados: drop old constraint (missing condo_id) and create new one
ALTER TABLE public.dados_realizados
  DROP CONSTRAINT IF EXISTS unq_realizados_categoria_data;

ALTER TABLE public.dados_realizados
  ADD CONSTRAINT unq_realizados_categoria_data
  UNIQUE (condo_id, categoria_id, ano, mes);

-- 2. Fix orcamento_previsto: drop old constraint (missing condo_id) and create new one
ALTER TABLE public.orcamento_previsto
  DROP CONSTRAINT IF EXISTS unq_orcamento_categoria_data;

ALTER TABLE public.orcamento_previsto
  ADD CONSTRAINT unq_orcamento_categoria_data
  UNIQUE (condo_id, simulacao_id, categoria_id, ano, mes);
