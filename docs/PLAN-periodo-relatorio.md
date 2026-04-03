# [OK] Plan created: docs/PLAN-periodo-relatorio.md

## Context
The "Matriz Analítica" in the Reports page currently uses a fixed analysis month. The user wants to control the start and end dates of the analysis period (Previsto vs. Realizado), impacting KPI cards, charts, and tables. Selection should be locked within simulation bounds.

## Proposed Changes

### 1. Server Configuration
- `src/app/(dashboard)/relatorios/page.tsx`:
  - Restrict `periodBounds` to the simulation's `ano_inicio/mes_inicio` and `ano_fim/mes_fim`.
  - Ensure default filtering uses the simulation's bounds if URL parameters are missing.

### 2. UI View Integration
- `src/components/dashboard/ReportsView.tsx`:
  - Update `DashboardCharts` call: pass `filterInicio` correctly (stop hardcoding month 1).
  - Update `ComparativeTable` call: pass the missing `inicio={filterInicio}` prop to ensure correct accumulation logic.

### 3. Component Verification
- `src/components/budget/DashboardCharts.tsx`: Confirm it uses the passed `filterInicio` for current YTD logic.
- `src/components/dashboard/ComparativeTable.tsx`: Confirm the table handles the new `inicio` prop to calculate the filtered period.

## Verification Checklist
- [ ] Select 12/2025 to 03/2026: Verifies both tables and cards.
- [ ] Verify KPI Cards value matching the period.
- [ ] Ensure Graph only shows months in the selected period.
- [ ] Check lock: Can't select dates outside simulation bounds.
