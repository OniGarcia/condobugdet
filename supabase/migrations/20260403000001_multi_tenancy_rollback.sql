-- ==========================================
-- ROLLBACK: Multi-Tenancy
-- Execute APENAS se precisar reverter a migration 20260403000000
-- ATENÇÃO: Remove colunas condo_id e tabelas de tenancy
-- ==========================================

-- 1. Desativar RLS (se estiver ativo)
ALTER TABLE IF EXISTS public.cost_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dados_realizados DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orcamento_previsto DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orcamentos_simulacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.condos DISABLE ROW LEVEL SECURITY;

-- 2. Remover policies
DROP POLICY IF EXISTS "condos_select" ON public.condos;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "memberships_select" ON public.memberships;
DROP POLICY IF EXISTS "memberships_insert_admin" ON public.memberships;
DROP POLICY IF EXISTS "memberships_delete_admin" ON public.memberships;
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
DROP POLICY IF EXISTS "categorias_insert" ON public.categorias;
DROP POLICY IF EXISTS "categorias_update" ON public.categorias;
DROP POLICY IF EXISTS "categorias_delete" ON public.categorias;
DROP POLICY IF EXISTS "simulacoes_select" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "simulacoes_insert" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "simulacoes_update" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "simulacoes_delete" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "orcamento_previsto_select" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "orcamento_previsto_insert" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "orcamento_previsto_update" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "orcamento_previsto_delete" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "dados_realizados_select" ON public.dados_realizados;
DROP POLICY IF EXISTS "dados_realizados_insert" ON public.dados_realizados;
DROP POLICY IF EXISTS "dados_realizados_update" ON public.dados_realizados;
DROP POLICY IF EXISTS "dados_realizados_delete" ON public.dados_realizados;
DROP POLICY IF EXISTS "cost_centers_select" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_insert" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_update" ON public.cost_centers;
DROP POLICY IF EXISTS "cost_centers_delete" ON public.cost_centers;

-- 3. Remover triggers e funções auxiliares
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.current_condo_id CASCADE;
DROP TRIGGER IF EXISTS trg_condos_updated_at ON public.condos;
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;

-- 4. Remover índices de condo_id
DROP INDEX IF EXISTS public.idx_categorias_condo_id;
DROP INDEX IF EXISTS public.idx_orcamentos_simulacoes_condo_id;
DROP INDEX IF EXISTS public.idx_orcamento_previsto_condo_id;
DROP INDEX IF EXISTS public.idx_dados_realizados_condo_id;
DROP INDEX IF EXISTS public.idx_cost_centers_condo_id;
DROP INDEX IF EXISTS public.idx_memberships_user_id;
DROP INDEX IF EXISTS public.idx_memberships_condo_id;

-- 5. Remover colunas condo_id das tabelas existentes
ALTER TABLE IF EXISTS public.categorias DROP COLUMN IF EXISTS condo_id;
ALTER TABLE IF EXISTS public.orcamentos_simulacoes DROP COLUMN IF EXISTS condo_id;
ALTER TABLE IF EXISTS public.orcamento_previsto DROP COLUMN IF EXISTS condo_id;
ALTER TABLE IF EXISTS public.dados_realizados DROP COLUMN IF EXISTS condo_id;
ALTER TABLE IF EXISTS public.cost_centers DROP COLUMN IF EXISTS condo_id;

-- 6. Remover tabelas de tenancy
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.condos CASCADE;
