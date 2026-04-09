import { getCategoriasTreeByCentroCusto } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { BudgetPageClient } from '@/components/budget/BudgetPageClient'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { CreateSimulationModal } from '@/components/budget/CreateSimulationModal'

export const dynamic = 'force-dynamic'

export default async function OrcamentoPage({ searchParams }: { searchParams: Promise<{ simulacao?: string }> }) {
  const params = await searchParams

  const [simulacoes, { role }] = await Promise.all([
    getSimulacoes(),
    validateAccess('visualizador'),
  ])
  const canEdit = role === 'admin' || role === 'gestor'

  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find((s: { id: string }) => s.id === selectedSimId)

  if (!activeSim) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Previsão Orçamentária</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Configure simulações de orçamento condominal para exercícios dinâmicos.</p>
        </div>
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-16 flex items-center justify-center flex-col gap-4 text-neutral-500">
          <p>Nenhuma simulação de orçamento encontrada.</p>
          {canEdit && <CreateSimulationModal highlight />}
        </div>
      </div>
    )
  }

  const [categorias, orcamentos] = await Promise.all([
    getCategoriasTreeByCentroCusto(activeSim?.centro_custo_id ?? null),
    selectedSimId ? getOrcamentosPorSimulacao(selectedSimId) : Promise.resolve([]),
  ])

  return (
    <BudgetPageClient
      categorias={categorias}
      orcamentos={orcamentos}
      simulacao={activeSim}
      simulacoes={simulacoes}
      selectedSimId={selectedSimId}
      canEdit={canEdit}
    />
  )
}
