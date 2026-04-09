-- =============================================================================
-- BACKFILL: Associar centro_custo_id aos orçamentos já lançados
--
-- COMO USAR:
--   1. Execute o PASSO 1 (SELECT) e revise as correspondências propostas.
--   2. Se estiver correto, execute o PASSO 2 (UPDATE).
--   3. Execute o PASSO 3 para verificar orçamentos que ficaram sem associação.
-- =============================================================================


-- =============================================================================
-- PASSO 1 — PREVIEW: Mostra as correspondências propostas ANTES de alterar.
--
-- Lógica de match (em ordem de prioridade):
--   a) O nome do centro de custo está CONTIDO no nome da simulação (case-insensitive)
--   b) O nome da simulação está CONTIDO no nome do centro de custo (case-insensitive)
--
-- Se uma simulação tiver mais de um centro de custo candidato, todas as
-- opções aparecem para você escolher manualmente qual é o correto.
-- =============================================================================

SELECT
    sim.id                  AS simulacao_id,
    sim.nome                AS nome_simulacao,
    cc.id                   AS centro_custo_id_proposto,
    cc.nome                 AS nome_centro_custo,
    CASE
        WHEN sim.nome ILIKE '%' || cc.nome || '%' THEN 'nome CC contido no orçamento'
        WHEN cc.nome  ILIKE '%' || sim.nome || '%' THEN 'nome orçamento contido no CC'
    END                     AS criterio_match
FROM public.orcamentos_simulacoes sim
JOIN public.centros_custo cc
    ON sim.condo_id = cc.condo_id
   AND (
         sim.nome ILIKE '%' || cc.nome || '%'
      OR cc.nome  ILIKE '%' || sim.nome || '%'
   )
WHERE sim.centro_custo_id IS NULL
ORDER BY sim.nome, cc.nome;


-- =============================================================================
-- PASSO 2 — UPDATE: Aplica a associação automaticamente.
--
-- ⚠ SÓ EXECUTE APÓS REVISAR O RESULTADO DO PASSO 1.
--
-- Para cada simulação sem centro de custo, busca o PRIMEIRO centro de custo
-- cujo nome está contido no nome da simulação (match mais específico).
-- Se não houver, tenta o inverso (nome da simulação contido no CC).
--
-- Simulações com múltiplos candidatos receberão o primeiro em ordem alfabética
-- de nome do centro de custo — revise-as manualmente se necessário (PASSO 3).
-- =============================================================================

UPDATE public.orcamentos_simulacoes sim
SET centro_custo_id = (
    SELECT cc.id
    FROM public.centros_custo cc
    WHERE cc.condo_id = sim.condo_id
      AND (
            sim.nome ILIKE '%' || cc.nome || '%'
         OR cc.nome  ILIKE '%' || sim.nome || '%'
      )
    ORDER BY
        -- Prioriza match onde o nome do CC está contido no nome da simulação
        (sim.nome ILIKE '%' || cc.nome || '%') DESC,
        cc.nome ASC
    LIMIT 1
)
WHERE sim.centro_custo_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.centros_custo cc
    WHERE cc.condo_id = sim.condo_id
      AND (
            sim.nome ILIKE '%' || cc.nome || '%'
         OR cc.nome  ILIKE '%' || sim.nome || '%'
      )
  );


-- =============================================================================
-- PASSO 3 — VERIFICAÇÃO: Lista orçamentos que ainda ficaram sem associação
--           (nenhum centro de custo correspondeu pelo nome).
--           Esses precisam ser associados manualmente.
-- =============================================================================

SELECT
    sim.id          AS simulacao_id,
    sim.nome        AS nome_simulacao,
    sim.ano_inicio,
    sim.mes_inicio,
    sim.ano_fim,
    sim.mes_fim
FROM public.orcamentos_simulacoes sim
WHERE sim.centro_custo_id IS NULL
ORDER BY sim.nome;


-- =============================================================================
-- PASSO 4 (OPCIONAL) — ASSOCIAÇÃO MANUAL para orçamentos sem match automático.
--
-- Substitua <SIMULACAO_ID> e <CENTRO_CUSTO_ID> pelos valores corretos
-- obtidos no Passo 3 e na listagem de centros de custo abaixo.
-- =============================================================================

-- Lista todos os centros de custo disponíveis para referência:
-- SELECT id, nome FROM public.centros_custo ORDER BY nome;

-- Exemplo de associação manual:
-- UPDATE public.orcamentos_simulacoes
-- SET centro_custo_id = '<CENTRO_CUSTO_ID>'
-- WHERE id = '<SIMULACAO_ID>';
