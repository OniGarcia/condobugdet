# Orçamento de Condomínio - Planejamento

## 1. Overview
Desenvolvimento do módulo de Orçamento e Previsão (Budget & Forecast) para o SaaS de gestão financeira de condomínios. O módulo suportará uma estrutura hierárquica de Plano de Contas, replicação automática de orçamento para 12 meses e dashboard gerencial comparativo (Previsto x Realizado).

**Project Type:** WEB / BACKEND

## 2. Success Criteria
* Tabela de Plano de Contas em árvore (self-referencing) funcionando corretamente.
* Replicação orçamentária concluída sem sobreposições não intencionais.
* Importação (CSV/Excel) fazendo correlação correta de códigos.
* Dashboard renderizando corretamente Previsto x Realizado e reajuste (%).

## 3. Socratic Gate (Decided / Closed)
Decisões estabelecidas com o usuário:
1. **Atualização de Orçamento:** Ao "Replicar até Dezembro", o sistema deverá **sobrescrever** os orçamentos previamente lançados na categoria selecionada para os meses seguintes.
2. **Importação e Exceções:** Se a despesa importada via CSV não for encontrada no código reduzido, o sistema enviará o valor para a categoria fallback de nome **NAO ENCONTRADA**.
3. **Escalabilidade do Plano de Contas:** A profundidade máxima da hierarquia será de **5 níveis** (ex: `1.1.1.1.1`).

## 4. Tech Stack
* **Banco de Dados:** Supabase / PostgreSQL (Tabelas self-referencing, queries CTE recursivas até 5 níveis).
* **Back-end:** Node.js (Rotas REST/API com Server Actions para Replicação e Importação).
* **Front-end:** React / Next.js com componentes glassmorphism, Recharts (para os gráficos customizados).

## 5. File Structure (Proposed)
```text
/src
  /app
    /api
      /categorias
      /orcamento
      /importacao
    /(dashboard)
      /orcamento
        page.tsx (Configuration Grid)
      /dashboard
        page.tsx (Managerial Dashboard)
  /components
    /budget
      TreeCategoryView.tsx
      BudgetGrid.tsx
      ComparisonTable.tsx
      DashboardCharts.tsx
  /lib
    /services
      replication.service.ts
      import.service.ts
```

## 6. Task Breakdown

### Task 1: Banco de Dados - Schema de Contas e Orçamento
* **Descrição:** Criar tabelas `categorias`, `orcamento_previsto`, `dados_realizados`.
* **Agent / Skill:** `backend-specialist` / `database-design`
* **Input:** Estruturas de colunas descritas.
* **Output:** Migrations ou setup SQL criado no banco de dados.
* **Verify:** Inserir categorias pai e filho e verificar a chave estrangeira `parent_id`.

### Task 2: API Node.js - Módulo de Plano de Contas
* **Descrição:** Criar CRUD da árvore formatada. Contas agrupadoras devem ter seu saldo (quando aplicável) somando as filhas.
* **Agent / Skill:** `backend-specialist` / `api-patterns`
* **Input:** Rotas GET, POST, PUT, DELETE.
* **Output:** Endpoints retornando JSON hierárquico.
* **Verify:** GET `/api/categorias` retorna a árvore correta até o último subnível.

### Task 3: Serviço Node.js - Replicação Orçamentária
* **Descrição:** Rota para definir valor em N meses para uma `categoria_id`.
* **Agent / Skill:** `backend-specialist` / `nodejs-best-practices`
* **Input:** `categoria_id`, `valor`, `mes_inicio`, `mes_fim`.
* **Output:** Loop de inserts na tabela `orcamento_previsto`.
* **Verify:** Conferir banco para certificar que 12 registros de orçamento foram criados corretamente.

### Task 4: Serviço Node.js - Importação
* **Descrição:** Processar arquivos CSV. Realizar matching com o código das categorias cadastradas.
* **Agent / Skill:** `backend-specialist` / `nodejs-best-practices`
* **Input:** File upload (CSV).
* **Output:** Entradas inseridas em `dados_realizados`.
* **Verify:** Validar erro amigável se formato for inválido.

### Task 5: Front-end - Grid de Configuração do Orçamento (12 Meses)
* **Descrição:** Tabela mostrando contas na lateral e meses colunas. Botão "Replicar até Dezembro".
* **Agent / Skill:** `frontend-specialist` / `frontend-design`
* **Input:** Treeview / Tabela expansível e inputs de valor.
* **Output:** UI consumindo API e realizando `POST` da replicação.
* **Verify:** Botão de replicação preenche corretamente a UI e salva.

### Task 6: Front-end - Dashboard Gerencial
* **Descrição:** Gráficos de barras (Receitas x Despesas cruzadas) e Saldo em Linha. Cards de KPIs. Tabela de variação % (Reajuste).
* **Agent / Skill:** `frontend-specialist` / `frontend-design`
* **Input:** Recharts API, design glassmorphism premium.
* **Output:** Dashboard UI integrado com os dados.
* **Verify:** Filtros de Ano/Mês atualizam os gráficos instantaneamente.

## 7. Phase X: Final Verification
- [ ] Schema validation checked.
- [ ] API routes return 200 without blocking.
- [ ] UI rendered with no template clones (uses glassmorphism/premium style).
- [ ] UX/UI standards met (no purple/violet codes if forbidden).
- [ ] No Hydration mismatched.
