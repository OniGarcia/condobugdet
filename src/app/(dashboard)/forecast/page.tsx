import { getCategoriasTreeByCentroCusto } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { getDadosRealizadosSimulacao } from '@/actions/realizado'
import { getFluxoProjetado } from '@/actions/projetado'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { ForecastPage } from '@/components/budget/ForecastPage'

export const dynamic = 'force-dynamic'

export default async function ForecastRoute({
  searchParams,
}: {
  searchParams: Promise<{ simulacao?: string; cutoff?: string }>
}) {
  const params = await searchParams

  const [simulacoes, { role }] = await Promise.all([
    getSimulacoes(),
    validateAccess('visualizador'),
  ])

  const canEdit = role === 'admin' || role === 'gestor'
  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find((s: { id: string }) => s.id === selectedSimId)

  const categorias = await getCategoriasTreeByCentroCusto(activeSim?.centro_custo_id ?? null)

  // Default cutoff = previous month
  const now = new Date()
  let defaultCutoffAno = now.getFullYear()
  let defaultCutoffMes = now.getMonth() // 0-indexed → previous month
  if (defaultCutoffMes === 0) { defaultCutoffMes = 12; defaultCutoffAno -= 1 }

  let cutoffAno = defaultCutoffAno
  let cutoffMes = defaultCutoffMes
  if (params.cutoff && /^\d{4}-\d{2}$/.test(params.cutoff)) {
    const [a, m] = params.cutoff.split('-').map(Number)
    cutoffAno = a
    cutoffMes = m
  }

  const [orcamentos, projetados] = await Promise.all([
    selectedSimId ? getOrcamentosPorSimulacao(selectedSimId) : Promise.resolve([]),
    selectedSimId ? getFluxoProjetado(selectedSimId) : Promise.resolve([]),
  ])

  const realizados = activeSim
    ? await getDadosRealizadosSimulacao(
        activeSim.ano_inicio,
        activeSim.mes_inicio,
        activeSim.ano_fim,
        activeSim.mes_fim,
      )
    : []

  if (!activeSim) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Fluxo Projetado</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Combine o realizado com projeções futuras para estimar o resultado.</p>
        </div>
        <div className="flex-1 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl flex items-center justify-center flex-col gap-4 text-neutral-600 dark:text-neutral-400 py-24">
          <p className="text-lg font-medium">Nenhuma simulação de orçamento encontrada.</p>
          <p className="text-sm">Crie uma simulação em <strong>Orçamento Previsto</strong> para começar.</p>
        </div>
      </div>
    )
  }

  return (
    <ForecastPage
      categorias={categorias}
      simulacao={activeSim}
      simulacoes={simulacoes}
      selectedSimId={selectedSimId}
      orcamentos={orcamentos}
      realizados={realizados}
      projetados={projetados}
      cutoffAno={cutoffAno}
      cutoffMes={cutoffMes}
      canEdit={canEdit}
    />
  )
}
