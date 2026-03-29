-- ==========================================
-- DESTROY EXISTING TABLES (CLEAN SLATE)
-- ==========================================
-- This will delete all data and table structures related to this module.
-- Use with caution in production!
DROP TABLE IF EXISTS public.dados_realizados CASCADE;
DROP TABLE IF EXISTS public.orcamento_previsto CASCADE;
DROP TABLE IF EXISTS public.categorias CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.condos CASCADE;
DROP TABLE IF EXISTS public.cost_centers CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;

-- Drop functions if they exist (Triggers drop automatically with tables)
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;

-- ==========================================
-- CREATE NEW SCHEMA AND RELATIONSHIPS
-- ==========================================

-- 1. Table: categorias (Chart of Accounts / Plano de Contas)
CREATE TABLE public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_reduzido VARCHAR(50) NOT NULL UNIQUE, -- e.g., "1", "1.1", "1.1.1.1.1"
    nome_conta VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    parent_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for tree lookups
CREATE INDEX idx_categorias_parent_id ON public.categorias(parent_id);

-- 2. Table: orcamentos_simulacoes (Budget Versions/Configurations)
CREATE TABLE public.orcamentos_simulacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    mes_inicio INTEGER NOT NULL CHECK (mes_inicio >= 1 AND mes_inicio <= 12),
    ano_inicio INTEGER NOT NULL,
    mes_fim INTEGER NOT NULL CHECK (mes_fim >= 1 AND mes_fim <= 12),
    ano_fim INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table: orcamento_previsto (Budget Forecast)
CREATE TABLE public.orcamento_previsto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulacao_id UUID NOT NULL REFERENCES public.orcamentos_simulacoes(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    valor_previsto NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure exactly one budget entry per category, month, year AND simulacao
    CONSTRAINT unq_orcamento_categoria_data UNIQUE (simulacao_id, categoria_id, ano, mes)
);

-- Indexes for querying by time period
CREATE INDEX idx_orcamento_previsto_data ON public.orcamento_previsto(simulacao_id, ano, mes);

-- 3. Table: dados_realizados (Actuals / Cash flow executed)
CREATE TABLE public.dados_realizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    valor_realizado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    descricao VARCHAR(255),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure exactly one value per category, month, year
    CONSTRAINT unq_realizados_categoria_data UNIQUE (categoria_id, ano, mes)
);

-- Generate updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_categorias_updated_at
    BEFORE UPDATE ON public.categorias
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER trg_orcamento_previsto_updated_at
    BEFORE UPDATE ON public.orcamento_previsto
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Insert fallback category (Crucial for the Import module to handle missing codes)
INSERT INTO public.categorias (id, codigo_reduzido, nome_conta, tipo) 
VALUES (gen_random_uuid(), '9.9.9.9.9', 'NAO ENCONTRADA', 'DESPESA');
