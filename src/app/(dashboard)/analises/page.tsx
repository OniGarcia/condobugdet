import { getCategoriasTree } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { getTodosRealizados } from '@/actions/realizado'
import { DashboardCharts } from '@/components/budget/DashboardCharts'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { PeriodSelector } from '@/components/budget/PeriodSelector'
import { OrcamentoPrevisto, DadosRealizados } from '@/types'

export const dynamic = 'force-dynamic'

function parsePeriod(
  param: string | undefined,
  fallback: { ano: number; mes: number },
): { ano: number; mes: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [ano, mes] = param.split('-').map(Number)
    return { ano, mes }
  }
  return fallback
}

/** Min e max (ano*100+mes) da união entre orçados e realizados. */
function calcDataRange(
  orcamentos: OrcamentoPrevisto[],
  realizados: DadosRealizados[],
): { dataInicio: { ano: number; mes: number }; dataFim: { ano: number; mes: number } } | null {
  const keys = [
    ...orcamentos.map(o => o.ano * 100 + o.mes),
    ...realizados.map(r => r.ano * 100 + r.mes),
  ]
  if (keys.length === 0) return null
  const minKey = Math.min(...keys)
  const maxKey = Math.max(...keys)
  return {
    dataInicio: { ano: Math.floor(minKey / 100), mes: minKey % 100 },
    dataFim:    { ano: Math.floor(maxKey / 100), mes: maxKey % 100 },
  }
}

export default async function AnalisesPage({
  searchParams,
}: {
  searchParams: Promise<{ simulacao?: string; inicio?: string; fim?: string }>
}) {
  const params = await searchParams

  // Busca infraestrutura e todos os realizados em paralelo
  const [categorias, simulacoes, todosRealizados] = await Promise.all([
    getCategoriasTree(),
    getSimulacoes(),
    getTodosRealizados(),
  ])

  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find(s => s.id === selectedSimId) ?? simulacoes[0]

  let orcamentos: OrcamentoPrevisto[] = []
  if (activeSim) {
    orcamentos = await getOrcamentosPorSimulacao(activeSim.id)
  }

  // Range real dos dados = menor e maior data entre orçado (da sim ativa) e realizados (todos)
  const dataRange = calcDataRange(orcamentos, todosRealizados)

  const defaultInicio = dataRange?.dataInicio ?? { ano: activeSim?.ano_inicio ?? 0, mes: activeSim?.mes_inicio ?? 1 }
  const defaultFim    = dataRange?.dataFim    ?? { ano: activeSim?.ano_fim    ?? 0, mes: activeSim?.mes_fim    ?? 12 }

  const filterInicio = parsePeriod(params.inicio, defaultInicio)
  const filterFim    = parsePeriod(params.fim,    defaultFim)

  const startKey = filterInicio.ano * 100 + filterInicio.mes
  const endKey   = filterFim.ano   * 100 + filterFim.mes

  const orcamentosFiltrados  = orcamentos.filter(o => { const k = o.ano * 100 + o.mes; return k >= startKey && k <= endKey })
  const realizadosFiltrados  = todosRealizados.filter(r => { const k = r.ano * 100 + r.mes; return k >= startKey && k <= endKey })

  const selectedInicio = `${filterInicio.ano}-${String(filterInicio.mes).padStart(2, '0')}`
  const selectedFim    = `${filterFim.ano}-${String(filterFim.mes).padStart(2, '0')}`

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-6 flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Painel de Controle</h1>
            <p className="text-neutral-600 dark:text-neutral-400">Análise de variação orçamentária (Previsto x Realizado).</p>
          </div>
          <div className="flex gap-3 items-center">
            <SimulationSelector simulacoes={simulacoes} selectedId={activeSim?.id} targetPath="/analises" />
            <button className="px-5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium rounded-lg transition-all border border-emerald-500/20">
              Exportar CSV
            </button>
          </div>
        </div>

        {dataRange && (
          <PeriodSelector
            dataInicio={dataRange.dataInicio}
            dataFim={dataRange.dataFim}
            selectedInicio={selectedInicio}
            selectedFim={selectedFim}
            simulacaoId={activeSim?.id}
          />
        )}
      </div>

      <div className="flex-1 overflow-auto pr-2 pb-10">
        {activeSim ? (
          <DashboardCharts
            categorias={categorias}
            orcamentos={orcamentosFiltrados}
            realizados={realizadosFiltrados}
            simulacao={activeSim}
            filterInicio={filterInicio}
            filterFim={filterFim}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl text-neutral-600 dark:text-neutral-400">
            <p className="mb-4">Nenhuma simulação de orçamento encontrada.</p>
            <a href="/orcamento" className="px-5 py-2 bg-emerald-500 text-neutral-900 dark:text-white rounded-lg hover:bg-emerald-600 font-medium">
              Ir para Orçamentos
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
