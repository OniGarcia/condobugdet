import { getCategoriasTree } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { getDadosRealizadosSimulacao } from '@/actions/realizado'
import { getFluxoProjetado } from '@/actions/projetado'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { ForecastPage } from '@/components/budget/ForecastPage'

export const dynamic = 'force-dynamic'

export default async function ForecastRoute({
  searchParams,
}: {
  searchParams: Promise<{ simulacao?: string; cutoff?: string }>
}) {
  const params = await searchParams

  // 1. Fetch static data in parallel
  const [categorias, simulacoes, { role }] = await Promise.all([
    getCategoriasTree(),
    getSimulacoes(),
    validateAccess('visualizador'),
  ])

  const canEdit = role === 'admin' || role === 'gestor'
  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find(s => s.id === selectedSimId)

  // 2. Default cutoff = previous month (app suggestion)
  const now = new Date()
  let defaultCutoffAno = now.getFullYear()
  let defaultCutoffMes = now.getMonth() // getMonth() is 0-indexed, so this = previous month
  if (defaultCutoffMes === 0) {
    defaultCutoffMes = 12
    defaultCutoffAno -= 1
  }

  // Allow URL override: cutoff=2026-03
  let cutoffAno = defaultCutoffAno
  let cutoffMes = defaultCutoffMes
  if (params.cutoff && /^\d{4}-\d{2}$/.test(params.cutoff)) {
    const [a, m] = params.cutoff.split('-').map(Number)
    cutoffAno = a
    cutoffMes = m
  }

  // 3. Fetch simulation-dependent data (only if a simulation is selected)
  const [orcamentos, projetados] = await Promise.all([
    selectedSimId ? getOrcamentosPorSimulacao(selectedSimId) : Promise.resolve([]),
    selectedSimId ? getFluxoProjetado(selectedSimId) : Promise.resolve([]),
  ])

  // 4. Fetch realizados using the simulation period bounds
  const realizados = activeSim
    ? await getDadosRealizadosSimulacao(
        activeSim.ano_inicio,
        activeSim.mes_inicio,
        activeSim.ano_fim,
        activeSim.mes_fim,
      )
    : []

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
            Fluxo Projetado
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Combine o realizado com projeções futuras para estimar o resultado do período.
          </p>
        </div>

        {/* Simulation Selector */}
        {simulacoes.length > 0 && (
          <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-neutral-200 dark:border-white/10">
            <SimulationSelector
              simulacoes={simulacoes}
              selectedId={selectedSimId}
              targetPath="/forecast"
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeSim ? (
        <ForecastPage
          categorias={categorias}
          simulacao={activeSim}
          orcamentos={orcamentos}
          realizados={realizados}
          projetados={projetados}
          cutoffAno={cutoffAno}
          cutoffMes={cutoffMes}
          canEdit={canEdit}
        />
      ) : (
        <div className="flex-1 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl flex items-center justify-center flex-col gap-4 text-neutral-600 dark:text-neutral-400">
          <p className="text-lg font-medium">Nenhuma simulação de orçamento encontrada.</p>
          <p className="text-sm">Crie uma simulação em <strong>Orçamento Previsto</strong> para começar.</p>
        </div>
      )}
    </div>
  )
}
