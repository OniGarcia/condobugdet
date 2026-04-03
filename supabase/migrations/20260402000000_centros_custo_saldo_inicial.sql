-- ================================================
-- Migration: Adicionar saldo_inicial a centros_custo
-- Execute no Supabase Dashboard → SQL Editor
-- ================================================

ALTER TABLE public.centros_custo
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(15, 2) NOT NULL DEFAULT 0.00;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.centros_custo.saldo_inicial IS
  'Saldo inicial financeiro do centro de custo. Usado para calcular o saldo final do período.';
