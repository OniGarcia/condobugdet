# Plano de Melhorias

## Base Atual

Arquivos principais identificados no projeto:

- Schema do banco em `supabase/migrations/20260327000000_condo_budget_schema.sql`
- Categorias em `src/actions/categorias.ts`
- Orçamentos em `src/actions/orcamento.ts`
- Despesas/realizados em `src/actions/realizado.ts`
- Página de relatório em `src/app/(dashboard)/relatorios/page.tsx`
- Container da UI em `src/components/dashboard/ReportsView.tsx`
- Tabela atual do relatório em `src/components/dashboard/ComparativeTable.tsx`

## Entendimento do Schema Atual

O schema atual contém:

- `categorias`: árvore hierárquica com `parent_id`, `tipo` (`RECEITA` ou `DESPESA`)
- `orcamentos_simulacoes`: versão/configuração de orçamento
- `orcamento_previsto`: orçamento mensal por `simulacao_id + categoria_id + ano + mes`
- `dados_realizados`: realizado mensal por `categoria_id + ano + mes`

Observação importante:

- Não existe coluna explícita de `orcamentoAnualTotal`.
- Para o relatório solicitado, `orcamentoAnualTotal` deverá ser derivado pela soma dos 12 meses do ano alvo na tabela `orcamento_previsto`, dentro da simulação selecionada.

## Plano de Implementação

### 1. Backend: criar serviço específico do relatório

Criar um serviço/server action específico para o relatório anual por categoria, seguindo o padrão atual do projeto em `src/actions`.

Entrada mínima sugerida:

- `simulacaoId`
- `ano`
- `mesAlvo`
- opcional: `centroCustoId`

Saída:

- lista já consolidada e pronta para a tabela do frontend

### 2. Levantar e consolidar os dados base

O serviço deverá:

- buscar categorias planas para montar mapa `id -> categoria`
- buscar orçamento da simulação para os 12 meses do ano alvo
- buscar realizados de janeiro até o `mesAlvo` do ano alvo
- aplicar filtro de centro de custo antes da agregação, se existir

### 3. Regras de cálculo do relatório

Para cada categoria processada no mês alvo, retornar estritamente:

- `previstoMes = orcamentoAnualTotal / 12`
- `realizadoMes = soma das despesas da categoria no mesAlvo`
- `previstoAcumuladoYTD = previstoMes * numero do mesAlvo`
- `realizadoAcumuladoYTD = soma de janeiro até o fim do mesAlvo`
- `orcamentoAnualTotal = soma dos 12 meses do ano`
- `saldoDisponivelAno = orcamentoAnualTotal - realizadoAcumuladoYTD`
- `statusSemaforoAno`:
  - `VERDE` se `saldoDisponivelAno > 0`
  - `AMARELO` se `saldoDisponivelAno === 0` ou dentro de margem de centavos
  - `VERMELHO` se `saldoDisponivelAno < 0`

### 4. Regra de agregação por hierarquia

Como o projeto já usa estrutura de categorias em árvore e a tabela atual já soma filhos nos pais, a recomendação é manter a visão hierárquica.

Isso significa:

- categorias folha usam seus próprios valores
- categorias pai exibem a soma dos descendentes

### 5. Precisão e arredondamento financeiro

Para evitar problemas com comparação de centavos:

- verificar se já existe biblioteca financeira no projeto
- se não existir, padronizar arredondamento para 2 casas no backend
- aplicar tolerância para o status `AMARELO`, por exemplo `Math.abs(saldoDisponivelAno) < 0.01`

### 6. Casos limite

#### 6.1. Orçamento nulo ou zero

Garantir fallback para:

- `orcamentoAnualTotal = 0`
- `previstoMes = 0`
- `previstoAcumuladoYTD = 0`

#### 6.2. Despesas sem categoria

Mesmo com FK obrigatória em `dados_realizados.categoria_id`, implementar fallback defensivo.

Se houver realizado cujo `categoria_id` não exista no mapa de categorias:

- agrupar em uma linha `Não Categorizado`
- usar `orcamentoAnualTotal = 0`
- o semáforo tende a `VERMELHO` quando houver gasto

#### 6.3. Categorias sem movimento

Recomendação:

- manter categorias com orçamento, mesmo sem realizado
- ocultar categorias sem orçamento e sem realizado, para evitar ruído
- exceção: mostrar `Não Categorizado` sempre que houver valores nela

### 7. Integração com a página de relatório

Atualizar `src/app/(dashboard)/relatorios/page.tsx` para consumir o novo serviço consolidado.

Definição prática sugerida:

- usar `filterFim` como `mesAlvo`
- calcular o YTD de janeiro até `filterFim`

Isso permite reaproveitar os filtros já existentes sem redesenhar a navegação agora.

### 8. Frontend: atualizar a tabela do relatório

Atualizar a interface de tabela para renderizar as colunas nesta ordem exata:

1. Categoria
2. Mês Atual - Previsto
3. Mês Atual - Realizado
4. Acumulado Ano (YTD) - Previsto
5. Acumulado Ano (YTD) - Realizado
6. Orçamento Anual Total
7. Saldo Disponível do Ano

Além disso:

- destacar `Saldo Disponível do Ano` em negrito
- remover da tabela atual colunas que não pertencem a esse novo relatório, se necessário

### 9. Regra visual do semáforo

Na coluna `Saldo Disponível do Ano`, aplicar:

- `VERDE`: texto/fundo verde
- `AMARELO`: texto/fundo neutro ou amarelo claro
- `VERMELHO`: texto/fundo vermelho

Adicionar tooltip com o texto:

`Mostra o quanto ainda podemos gastar nesta categoria até o fim do ano`

### 10. Tipagem

Adicionar um tipo específico em `src/types/index.ts` para o payload do relatório, por exemplo:

- `RelatorioCategoriaAno`

Campos esperados:

- `categoriaId`
- `categoriaNome`
- `codigoReduzido`
- `previstoMes`
- `realizadoMes`
- `previstoAcumuladoYTD`
- `realizadoAcumuladoYTD`
- `orcamentoAnualTotal`
- `saldoDisponivelAno`
- `statusSemaforoAno`
- campos auxiliares de hierarquia, se necessários para a UI

### 11. Validação final

Testar ao menos estes cenários:

- categoria com orçamento anual e gasto abaixo do total
- categoria com saldo exatamente zerado
- categoria acima do orçamento
- categoria sem orçamento aprovado
- linha `Não Categorizado`
- categoria pai somando corretamente os filhos

## Arquivos Prováveis de Alteração

- `src/actions/orcamento.ts` ou novo `src/actions/relatorios.ts`
- `src/types/index.ts`
- `src/app/(dashboard)/relatorios/page.tsx`
- `src/components/dashboard/ReportsView.tsx`
- `src/components/dashboard/ComparativeTable.tsx`

## Risco Principal

O principal ponto funcional a confirmar é:

- o relatório deve listar apenas categorias folha ou manter categorias pai com soma dos filhos?

Recomendação atual:

- manter a visão hierárquica, pois ela já é o padrão do projeto

## Decisão Recomendada

- Backend com novo serviço/action consolidado
- Frontend reaproveitando a tela `/relatorios`
- `mesAlvo` baseado em `filterFim`
- agregação hierárquica
- arredondamento financeiro centralizado no backend
