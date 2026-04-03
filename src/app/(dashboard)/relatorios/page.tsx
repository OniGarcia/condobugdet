import { getCategoriasTree } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { getTodosRealizados } from '@/actions/realizado'
import { getCentrosCusto } from '@/actions/centrosCusto'
import { getRelatorioAnual } from '@/actions/relatorios'
import { ReportsView } from '@/components/dashboard/ReportsView'
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ simulacao?: string; inicio?: string; fim?: string; cc?: string }>
}) {
  const params = await searchParams

  const [categorias, simulacoes, todosRealizados, centrosCusto] = await Promise.all([
    getCategoriasTree(),
    getSimulacoes(),
    getTodosRealizados(),
    getCentrosCusto(),
  ])

  const selectedSimId = params.simulacao || simulacoes[0]?.id
  const activeSim = simulacoes.find(s => s.id === selectedSimId) ?? simulacoes[0]
  const selectedCCId = params.cc || 'all'

  let orcamentos: OrcamentoPrevisto[] = []
  if (activeSim) {
    orcamentos = await getOrcamentosPorSimulacao(activeSim.id)
  }

  const rawRange = calcDataRange(orcamentos, todosRealizados)
  // Clamp to simulation bounds so PeriodSelector only shows valid months
  const simStart = activeSim ? { ano: activeSim.ano_inicio, mes: activeSim.mes_inicio } : null
  const simEnd   = activeSim ? { ano: activeSim.ano_fim,    mes: activeSim.mes_fim    } : null
  const clampPeriod = (p: { ano: number; mes: number }, min: { ano: number; mes: number }, max: { ano: number; mes: number }) => {
    const k = p.ano * 100 + p.mes
    if (k < min.ano * 100 + min.mes) return min
    if (k > max.ano * 100 + max.mes) return max
    return p
  }
  const dataRange = rawRange && simStart && simEnd ? {
    dataInicio: clampPeriod(rawRange.dataInicio, simStart, simEnd),
    dataFim:    clampPeriod(rawRange.dataFim,    simStart, simEnd),
  } : rawRange

  const defaultInicio = dataRange?.dataInicio ?? { ano: activeSim?.ano_inicio ?? 0, mes: activeSim?.mes_inicio ?? 1 }
  const defaultFim    = dataRange?.dataFim    ?? { ano: activeSim?.ano_fim    ?? 0, mes: activeSim?.mes_fim    ?? 12 }

  const filterInicio = parsePeriod(params.inicio, defaultInicio)
  const filterFim    = parsePeriod(params.fim,    defaultFim)

  // Compute report rows server-side (mesAlvo = filterFim)
  const relatorioRows = activeSim
    ? await getRelatorioAnual(
        activeSim.id,
        filterFim.ano,
        filterFim.mes,
        selectedCCId !== 'all' ? selectedCCId : undefined,
        filterInicio.ano,
        filterInicio.mes,
        activeSim.ano_inicio,
        activeSim.mes_inicio,
        activeSim.ano_fim,
        activeSim.mes_fim,
      )
    : []

  // Filter orcamentos/realizados for DashboardCharts (period + CC)
  const selectedCC = centrosCusto.find(cc => cc.id === selectedCCId)
  const ccCatIds = selectedCC ? new Set(selectedCC.categoria_ids ?? []) : null

  const startKey = filterInicio.ano * 100 + filterInicio.mes
  const endKey   = filterFim.ano   * 100 + filterFim.mes

  const filteredOrcamentos = orcamentos.filter(o => {
    const k = o.ano * 100 + o.mes
    return k >= startKey && k <= endKey && (ccCatIds === null || ccCatIds.has(o.categoria_id))
  })
  const filteredRealizados = todosRealizados.filter(r => {
    const k = r.ano * 100 + r.mes
    return k >= startKey && k <= endKey && (ccCatIds === null || ccCatIds.has(r.categoria_id))
  })

  return (
    <div className="flex flex-col min-h-screen">
      <ReportsView
        categorias={categorias}
        orcamentos={filteredOrcamentos}
        realizados={filteredRealizados}
        simulacoes={simulacoes}
        centrosCusto={centrosCusto}
        activeSim={activeSim}
        filterInicio={filterInicio}
        filterFim={filterFim}
        dataRange={dataRange}
        selectedCCId={selectedCCId}
        relatorioRows={relatorioRows}
      />
    </div>
  )
}
