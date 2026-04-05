-- ==========================================
-- Renomear roles: editor→gestor, viewer→visualizador
-- Níveis de acesso: Super Admin (admin), Gestor (gestor), Visualizador (visualizador)
-- ==========================================

-- 1. Remover constraint CHECK antiga
ALTER TABLE public.memberships
    DROP CONSTRAINT IF EXISTS memberships_role_check;

-- 2. Migrar valores existentes
UPDATE public.memberships SET role = 'gestor'       WHERE role = 'editor';
UPDATE public.memberships SET role = 'visualizador' WHERE role = 'viewer';

-- 3. Adicionar nova constraint CHECK
ALTER TABLE public.memberships
    ADD CONSTRAINT memberships_role_check
    CHECK (role IN ('admin', 'gestor', 'visualizador'));

-- 4. Ajustar default da coluna
ALTER TABLE public.memberships
    ALTER COLUMN role SET DEFAULT 'visualizador';

-- ==========================================
-- Atualizar políticas RLS que referenciam 'editor' e 'viewer'
-- ==========================================

-- categorias
DROP POLICY IF EXISTS "categorias_insert" ON public.categorias;
DROP POLICY IF EXISTS "categorias_update" ON public.categorias;
DROP POLICY IF EXISTS "categorias_delete" ON public.categorias;

CREATE POLICY "categorias_insert" ON public.categorias
    FOR INSERT WITH CHECK (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor'))
    );
CREATE POLICY "categorias_update" ON public.categorias
    FOR UPDATE USING (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor'))
    );
CREATE POLICY "categorias_delete" ON public.categorias
    FOR DELETE USING (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin')
    );

-- orcamentos_simulacoes
DROP POLICY IF EXISTS "simulacoes_insert" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "simulacoes_update" ON public.orcamentos_simulacoes;
DROP POLICY IF EXISTS "simulacoes_delete" ON public.orcamentos_simulacoes;

CREATE POLICY "simulacoes_insert" ON public.orcamentos_simulacoes
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "simulacoes_update" ON public.orcamentos_simulacoes
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "simulacoes_delete" ON public.orcamentos_simulacoes
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- orcamento_previsto
DROP POLICY IF EXISTS "orcamento_previsto_insert" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "orcamento_previsto_update" ON public.orcamento_previsto;
DROP POLICY IF EXISTS "orcamento_previsto_delete" ON public.orcamento_previsto;

CREATE POLICY "orcamento_previsto_insert" ON public.orcamento_previsto
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "orcamento_previsto_update" ON public.orcamento_previsto
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "orcamento_previsto_delete" ON public.orcamento_previsto
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- dados_realizados
DROP POLICY IF EXISTS "dados_realizados_insert" ON public.dados_realizados;
DROP POLICY IF EXISTS "dados_realizados_update" ON public.dados_realizados;
DROP POLICY IF EXISTS "dados_realizados_delete" ON public.dados_realizados;

CREATE POLICY "dados_realizados_insert" ON public.dados_realizados
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "dados_realizados_update" ON public.dados_realizados
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "dados_realizados_delete" ON public.dados_realizados
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- centros_custo
DROP POLICY IF EXISTS "centros_custo_insert" ON public.centros_custo;
DROP POLICY IF EXISTS "centros_custo_update" ON public.centros_custo;
DROP POLICY IF EXISTS "centros_custo_delete" ON public.centros_custo;

CREATE POLICY "centros_custo_insert" ON public.centros_custo
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "centros_custo_update" ON public.centros_custo
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')));
CREATE POLICY "centros_custo_delete" ON public.centros_custo
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- memberships: política de insert/delete já usa 'admin' — sem alteração necessária
