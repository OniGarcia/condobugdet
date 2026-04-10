# PLAN-budget-target.md - Metas Dinâmicas de Execução

Este projeto implementa a comparação da execução orçamentária real com uma meta dinâmica baseada no orçamento previsto acumulado.

## Visão Geral
Atualmente, a execução é exibida como uma porcentagem bruta. Este plano adiciona context: quão longe estamos do que *deveríamos* ter executado até agora, considerando a sazonalidade do orçamento.

## Critérios de Sucesso
- [ ] Cálculo da meta baseado no `previsto acumulado / previsto total`.
- [ ] Exibição da coluna "Meta" na matriz de categorias.
- [ ] Sinalização visual (Verde/Amarelo/Vermelho) com tolerância de 5%.
- [ ] Marcadores de meta nas barras de progresso dos cards de KPI.

## Tech Stack
- **Frontend**: Next.js, Tailwind CSS, Lucide React.
- **Backend**: Supabase (PostgreSQL), Next.js Server Actions.

## Estratégia de Implementação

### Fase 1: Atualização de Dados (Backend)
- Modificar `src/actions/gestaoCentroCusto.ts` para capturar o orçamento acumulado até o `cutoffKey`.
- Estender as interfaces em `src/types/index.ts`.

### Fase 2: Componentes UI
- Introduzir o conceito de `metaPct` no componente `KPICard`.
- Adicionar a coluna à tabela `MatrizCC`.

## Detalhamento de Tarefas

### T1: Tipagem de Metas
- **Agente**: `frontend-specialist`
- **Ação**: Adicionar `metaPct` ao `GestaoCCMatrizCategoria` em `src/types/index.ts`.
- **Verificar**: Compilação sem erros no VS Code.

### T2: Lógica de Cálculo no Servidor
- **Agente**: `backend-specialist`
- **Ação**: Em `getGestaoCentroCusto`, calcular o acumulado do previsto até o mês de corte para cada categoria. Calcular a meta global.
- **Verificar**: Logar os valores calculados para garantir precisão (Realizado vs Meta).

### T3: UI - Coluna de Meta
- **Agente**: `frontend-specialist`
- **Ação**: Adicionar a coluna à tabela na `MatrizCC` em `src/components/dashboard/GestaoCCView.tsx`.
- **Verificar**: Ver a coluna renderizada corretamente com 1 casa decimal.

### T4: UI - Marcadores nos Cards
- **Agente**: `frontend-specialist`
- **Ação**: Implementar um marcador `absolute` na barra de progresso do `KPICard`.
- **Verificar**: Visualizar o marcador posicionado proporcionalmente à meta.

## Fase X: Verificação Final
- [ ] Validar status verde (dentro de 5% de tolerância).
- [ ] Validar status amarelo/vermelho (fora da tolerância).
- [ ] Testar com orçamentos não lineares.
