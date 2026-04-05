import { getCategoriasTree } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { BudgetGrid } from '@/components/budget/BudgetGrid'
import { CreateSimulationModal } from '@/components/budget/CreateSimulationModal'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { SimulationActionsDropdown } from '@/components/budget/SimulationActionsDropdown'
import { validateAccess } from '@/lib/supabase/validateAccess'

export const dynamic = 'force-dynamic'

export default async function OrcamentoPage({ searchParams }: { searchParams: Promise<{ simulacao?: string }> }) {
  const params = await searchParams

  // Fetch data in parallel
  const [categorias, simulacoes, { role }] = await Promise.all([
    getCategoriasTree(),
    getSimulacoes(),
    validateAccess('visualizador'),
  ]);
  const canEdit = role === 'admin' || role === 'gestor'

  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find(s => s.id === selectedSimId)
  
  const orcamentos = selectedSimId ? await getOrcamentosPorSimulacao(selectedSimId) : []

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Previsão Orçamentária</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Configure simulações de orçamento condominal para exercícios dinâmicos.</p>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-neutral-200 dark:border-white/10">
            <SimulationSelector simulacoes={simulacoes} selectedId={selectedSimId} />
            {canEdit && activeSim && <SimulationActionsDropdown simulacao={activeSim} />}
          </div>

          {canEdit && <CreateSimulationModal />}

          <button
           disabled={!activeSim}
           className="px-5 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-medium rounded-lg transition-all border border-sky-500/20 disabled:opacity-50"
          >
            Exportar XLS
          </button>
        </div>
      </div>

      {/* Main Budget Data Grid Area */}
      {activeSim ? (
        <BudgetGrid categorias={categorias} orcamentos={orcamentos} simulacao={activeSim} canEdit={canEdit} />
      ) : (
        <div className="flex-1 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl flex items-center justify-center flex-col gap-4 text-neutral-600 dark:text-neutral-400">
          <p>Nenhuma simulação de orçamento encontrada.</p>
          {canEdit && <CreateSimulationModal />}
        </div>
      )}
    </div>
  )
}

