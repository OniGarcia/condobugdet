-- ==========================================
-- FASE 1: Multi-Tenancy - Tabelas e Colunas
-- ==========================================
-- Aplicar em 2 etapas (ver comentários):
--   ETAPA A: Criar tabelas + adicionar colunas nullable (sem RLS)
--   ETAPA B: Ativar RLS (somente após Fases 2 e 3 do deploy)
-- ==========================================

-- ==========================================
-- ETAPA A: NOVAS TABELAS
-- ==========================================

-- 1. Tabela: condos (Condomínios)
CREATE TABLE IF NOT EXISTS public.condos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela: profiles (Extensão de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255),
    avatar_url TEXT,
    cargo VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela: memberships (Ligação N:N usuários <-> condomínios)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    condo_id UUID NOT NULL REFERENCES public.condos(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_membership UNIQUE (user_id, condo_id)
);

CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_condo_id ON public.memberships(condo_id);

-- ==========================================
-- ETAPA A: ADICIONAR condo_id NAS TABELAS EXISTENTES (nullable para não quebrar dados)
-- ==========================================

ALTER TABLE public.categorias
    ADD COLUMN IF NOT EXISTS condo_id UUID REFERENCES public.condos(id) ON DELETE CASCADE;
-- NULL = categoria global (compartilhada entre todos os condomínios)

ALTER TABLE public.orcamentos_simulacoes
    ADD COLUMN IF NOT EXISTS condo_id UUID REFERENCES public.condos(id) ON DELETE CASCADE;

ALTER TABLE public.orcamento_previsto
    ADD COLUMN IF NOT EXISTS condo_id UUID REFERENCES public.condos(id) ON DELETE CASCADE;

ALTER TABLE public.dados_realizados
    ADD COLUMN IF NOT EXISTS condo_id UUID REFERENCES public.condos(id) ON DELETE CASCADE;

ALTER TABLE public.centros_custo
    ADD COLUMN IF NOT EXISTS condo_id UUID REFERENCES public.condos(id) ON DELETE CASCADE;

-- Índices para filtro por condo_id
CREATE INDEX IF NOT EXISTS idx_categorias_condo_id ON public.categorias(condo_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_simulacoes_condo_id ON public.orcamentos_simulacoes(condo_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_previsto_condo_id ON public.orcamento_previsto(condo_id);
CREATE INDEX IF NOT EXISTS idx_dados_realizados_condo_id ON public.dados_realizados(condo_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_condo_id ON public.centros_custo(condo_id);

-- ==========================================
-- ETAPA A: DADOS INICIAIS
-- Atribuir registros existentes ao "Condomínio Inicial"
-- ==========================================

-- Inserir condomínio padrão para dados legados
INSERT INTO public.condos (id, nome, cnpj)
VALUES ('00000000-0000-0000-0000-000000000001', 'Condomínio Inicial', NULL)
ON CONFLICT (id) DO NOTHING;

-- Associar todos os registros existentes sem condo_id ao condomínio inicial
UPDATE public.categorias SET condo_id = '00000000-0000-0000-0000-000000000001' WHERE condo_id IS NULL AND codigo_reduzido != '9.9.9.9.9';
UPDATE public.orcamentos_simulacoes SET condo_id = '00000000-0000-0000-0000-000000000001' WHERE condo_id IS NULL;
UPDATE public.orcamento_previsto SET condo_id = '00000000-0000-0000-0000-000000000001' WHERE condo_id IS NULL;
UPDATE public.dados_realizados SET condo_id = '00000000-0000-0000-0000-000000000001' WHERE condo_id IS NULL;
UPDATE public.centros_custo SET condo_id = '00000000-0000-0000-0000-000000000001' WHERE condo_id IS NULL;

-- Triggers updated_at para novas tabelas
CREATE TRIGGER trg_condos_updated_at
    BEFORE UPDATE ON public.condos
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger: criar profile automaticamente ao criar usuário no auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, nome)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- ETAPA B: RLS (APLICAR SOMENTE APÓS FASES 2 E 3 DO DEPLOY)
-- ==========================================
-- ATENÇÃO: Execute este bloco separadamente, APENAS quando:
--   1. Middleware de auth estiver funcionando
--   2. Todas as server actions filtrarem por condo_id
--   3. Testes em staging estiverem OK
-- ==========================================

-- Helper: retorna o condo_id do cookie/claim atual da sessão
-- O valor é injetado pelo middleware via set_config
CREATE OR REPLACE FUNCTION public.current_condo_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_condo_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS
ALTER TABLE public.condos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_previsto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

-- Policies: condos (lê apenas os condomínios onde tem membership)
CREATE POLICY "condos_select" ON public.condos
    FOR SELECT USING (
        id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid())
    );

-- Policies: profiles (cada usuário vê apenas seu próprio perfil)
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Policies: memberships (vê membros do mesmo condomínio se for admin/editor)
CREATE POLICY "memberships_select" ON public.memberships
    FOR SELECT USING (
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid())
    );
CREATE POLICY "memberships_insert_admin" ON public.memberships
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE user_id = auth.uid() AND condo_id = memberships.condo_id AND role = 'admin'
        )
    );
CREATE POLICY "memberships_delete_admin" ON public.memberships
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE user_id = auth.uid() AND condo_id = memberships.condo_id AND role = 'admin'
        )
    );

-- Policies: categorias (globais são visíveis para todos; específicas só para membros do condo)
CREATE POLICY "categorias_select" ON public.categorias
    FOR SELECT USING (
        condo_id IS NULL
        OR condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid())
    );
CREATE POLICY "categorias_insert" ON public.categorias
    FOR INSERT WITH CHECK (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "categorias_update" ON public.categorias
    FOR UPDATE USING (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor'))
    );
CREATE POLICY "categorias_delete" ON public.categorias
    FOR DELETE USING (
        condo_id IS NOT NULL AND
        condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Policies: orcamentos_simulacoes
CREATE POLICY "simulacoes_select" ON public.orcamentos_simulacoes
    FOR SELECT USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "simulacoes_insert" ON public.orcamentos_simulacoes
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "simulacoes_update" ON public.orcamentos_simulacoes
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "simulacoes_delete" ON public.orcamentos_simulacoes
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies: orcamento_previsto
CREATE POLICY "orcamento_previsto_select" ON public.orcamento_previsto
    FOR SELECT USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "orcamento_previsto_insert" ON public.orcamento_previsto
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "orcamento_previsto_update" ON public.orcamento_previsto
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "orcamento_previsto_delete" ON public.orcamento_previsto
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies: dados_realizados
CREATE POLICY "dados_realizados_select" ON public.dados_realizados
    FOR SELECT USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "dados_realizados_insert" ON public.dados_realizados
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "dados_realizados_update" ON public.dados_realizados
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "dados_realizados_delete" ON public.dados_realizados
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies: centros_custo
CREATE POLICY "centros_custo_select" ON public.centros_custo
    FOR SELECT USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid()));
CREATE POLICY "centros_custo_insert" ON public.centros_custo
    FOR INSERT WITH CHECK (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "centros_custo_update" ON public.centros_custo
    FOR UPDATE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role IN ('admin', 'editor')));
CREATE POLICY "centros_custo_delete" ON public.centros_custo
    FOR DELETE USING (condo_id IN (SELECT condo_id FROM public.memberships WHERE user_id = auth.uid() AND role = 'admin'));
