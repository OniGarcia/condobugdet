# [PLAN-cost-centers.md] - Functional Vision by Cost Center

This plan outlines the implementation of the **Centro de Custo (Cost Center)** feature, allowing users to group categories for specialized financial analysis (e.g., "Taxa Condominial").

## User Review Required

> [!IMPORTANT]
> **Database Access**: This feature requires creating two new tables in Supabase. I will provide the SQL script for you to run in the Supabase Dashboard, or I can attempt to run it via CLI if configured.
> **Navigation**: The "Centro de Custo" item will be placed below "Plano de Contas" in the sidebar as requested.

## Proposed Changes

### 1. Database Schema (Supabase)
Prepare a migration script to create:
- `centros_custo`: `id`, `nome`, `descricao`.
- `categoria_centro_custo`: Junction table (Many-to-Many) between categories and cost centers.

### 2. Types & Backend (Server Actions)
- **[MODIFY] [types/index.ts](file:///c:/Users/jonatas.garcia/OneDrive%20-%20Conjel%20Contabilidade%20e%20Controladoria%20Ss%20Ltda/Documents/APP_ORCAMENTO_CONDOMINIO/src/types/index.ts)**: Define `CentroCusto` and related interfaces.
- **[NEW] [actions/centrosCusto.ts](file:///c:/Users/jonatas.garcia/OneDrive%20-%20Conjel%20Contabilidade%20e%20Controladoria%20Ss%20Ltda/Documents/APP_ORCAMENTO_CONDOMINIO/src/actions/centrosCusto.ts)**: Server actions for CRUD (Create, Read, Update, Delete) and category association.

### 3. Navigation
- **[MODIFY] [layout.tsx](file:///c:/Users/jonatas.garcia/OneDrive%20-%20Conjel%20Contabilidade%20e%20Controladoria%20Ss%20Ltda/Documents/APP_ORCAMENTO_CONDOMINIO/src/app/(dashboard)/layout.tsx)**: Add "Centros de Custo" link with a suitable icon (e.g., `Boxes`).

### 4. Management UI
- **[NEW] Page `/centros-custo`**: Table list of cost centers (Glassmorphism UI).
- **[NEW] Component `CostCenterModal`**: Modal for creating/editing name and description.
- **[NEW] Component `CategorySelector`**: Tree-view of categories with checkboxes.
  - **Cascading Selection**: Clicking a parent category automatically selects/deselects all its children for ease of use.
  - **Visual Feedback**: Total number of categories selected shown in the header.

### 5. Integration (Future Phase)
- **[UPDATE] Dashboard**: Add a filter to select a Cost Center, updating all charts and cards based on the leaf nodes of the associated categories.

## Open Questions

- **Initial Data**: Should I seed a few common cost centers (e.g., "Taxa Condominial", "Administração")?
- **UI Details**: The category selector will follow the premium style of the categories tree, with folder/file icons.

## Verification Plan

### Automated/Manual Tests
- Create a Cost Center "Manutenção".
- Select 5 categories related to services and materials.
- Verify that saving persists the associations in the database.
- Navigate back and ensure the list updates.
