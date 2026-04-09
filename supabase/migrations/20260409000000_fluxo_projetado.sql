-- 1. Table: fluxo_projetado
CREATE TABLE public.fluxo_projetado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacao_id UUID NOT NULL REFERENCES public.orcamentos_simulacoes(id) ON DELETE CASCADE,
    condo_id UUID NOT NULL REFERENCES public.condos(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    valor_projetado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure unique entry per category, month, year, condo, and simulacao
    CONSTRAINT unq_projetado_categoria_data UNIQUE (simulacao_id, condo_id, categoria_id, ano, mes)
);

-- 2. Indexes
CREATE INDEX idx_fluxo_projetado_simulacao ON public.fluxo_projetado(simulacao_id);
CREATE INDEX idx_fluxo_projetado_data ON public.fluxo_projetado(condo_id, ano, mes);

-- 3. Trigger for updated_at
CREATE TRIGGER trg_fluxo_projetado_updated_at
    BEFORE UPDATE ON public.fluxo_projetado
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Enable RLS
ALTER TABLE public.fluxo_projetado ENABLE ROW LEVEL SECURITY;

-- 5. Policies (Matching orcamento_previsto)
-- READ: Allow everyone in the condo (viewers, gestors, admins)
CREATE POLICY "fluxo_projetado_select" ON public.fluxo_projetado
    FOR SELECT
    USING (condo_id IN (
        SELECT memberships.condo_id
        FROM memberships
        WHERE memberships.user_id = auth.uid()
    ));

-- INSERT: Admin and Gestor
CREATE POLICY "fluxo_projetado_insert" ON public.fluxo_projetado
    FOR INSERT
    WITH CHECK (condo_id IN (
        SELECT memberships.condo_id
        FROM memberships
        WHERE memberships.user_id = auth.uid()
        AND (memberships.role::text = ANY (ARRAY['admin'::text, 'gestor'::text]))
    ));

-- UPDATE: Admin and Gestor
CREATE POLICY "fluxo_projetado_update" ON public.fluxo_projetado
    FOR UPDATE
    USING (condo_id IN (
        SELECT memberships.condo_id
        FROM memberships
        WHERE memberships.user_id = auth.uid()
        AND (memberships.role::text = ANY (ARRAY['admin'::text, 'gestor'::text]))
    ));

-- DELETE: Admin only (matching orcamento_previsto_delete)
CREATE POLICY "fluxo_projetado_delete" ON public.fluxo_projetado
    FOR DELETE
    USING (condo_id IN (
        SELECT memberships.condo_id
        FROM memberships
        WHERE memberships.user_id = auth.uid()
        AND (memberships.role::text = 'admin'::text)
    ));
