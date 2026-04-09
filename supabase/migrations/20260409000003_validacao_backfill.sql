-- =============================================================================
-- VALIDAÇÃO: Verificar resultado do backfill de centro_custo_id
-- =============================================================================

-- 1. Resumo geral: quantos orçamentos foram associados vs. quantos ficaram sem CC
SELECT
    COUNT(*)                                            AS total_simulacoes,
    COUNT(centro_custo_id)                              AS com_centro_custo,
    COUNT(*) FILTER (WHERE centro_custo_id IS NULL)     AS sem_centro_custo
FROM public.orcamentos_simulacoes;


-- 2. Detalhe: todos os orçamentos com o nome do centro de custo associado
SELECT
    sim.nome            AS nome_simulacao,
    sim.ano_inicio,
    sim.mes_inicio,
    sim.ano_fim,
    sim.mes_fim,
    cc.nome             AS centro_custo,
    cc.descricao        AS descricao_cc
FROM public.orcamentos_simulacoes sim
LEFT JOIN public.centros_custo cc ON cc.id = sim.centro_custo_id
ORDER BY sim.nome;
