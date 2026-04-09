-- Add centro_custo_id to orcamentos_simulacoes
-- Makes cost center selection available when creating a budget simulation.
-- Nullable at DB level to avoid breaking existing rows; required in the application UI.

ALTER TABLE public.orcamentos_simulacoes
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID
    REFERENCES public.centros_custo(id) ON DELETE SET NULL;
