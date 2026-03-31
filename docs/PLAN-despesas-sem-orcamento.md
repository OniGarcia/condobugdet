# PLAN-despesas-sem-orcamento.md

## Objetivo
Substituir o card de "Maior Economia" por um card de "Despesas Não Previstas" (categorias com orçamento zero mas com gasto realizado), ordenadas por valor absoluto (R$).

## User Review Required
> [!IMPORTANT]
> 1. Diferenciação Visual: Conforme a proposta no `implementation_plan.md`, usaremos **Âmbar/Laranja** para estas despesas para diferenciá-las de estouros reais.
2. Comportamento Vazio: Definir se o card deve desaparecer se não houver extras ou se deve mostrar uma mensagem "Nenhum gasto extra".

## Proposed Changes

### Componente `InsightsCards.tsx`

#### [MODIFY] [InsightsCards.tsx](file:///c%3A/Users/jonatas.garcia/OneDrive%20-%20Conjel%20Contabilidade%20e%20Controladoria%20Ss%20Ltda/Documents/APP_ORCAMENTO_CONDOMINIO/src/components/dashboard/InsightsCards.tsx)

- Remover lógica de `topEconomia`.
- Adicionar lógica de `topSemOrcamento`:
    - Filtro: `orcamentoAnualTotal === 0` && `realizadoAcumuladoYTD > 0`.
    - Ordenação: Valor absoluto descrescente.
- Remover o segundo card (verde) do JSX.
- Adicionar o novo card de alertas para gastos extras com estilo `amber` ou `orange`.

## Task Breakdown
- [ ] Mapear lógica de agregação em `InsightsCards`.
- [ ] Implementar filtro e ordenação conforme critério de relevância.
- [ ] Atualizar o JSX com o novo card de despesas imprevistas.
- [ ] Testar se itens com orçamento zero aparecem corretamente e se itens com economia sumiram.

## Verification Plan
1. Conferir no dashboard se o card de "Maior Economia" foi removido.
2. Verificar se uma despesa sem orçamento é listada no novo card orange/amber com o valor correto em R$.
