import { getCategoriasTree } from '@/actions/categorias'
import { getSimulacoes, getOrcamentosPorSimulacao } from '@/actions/orcamento'
import { getTodosRealizados } from '@/actions/realizado'
import { getCentrosCusto } from '@/actions/centrosCusto'
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
  searchParams: Promise<{ simulacao?: string; inicio?: string; fim?: string }>
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

  let orcamentos: OrcamentoPrevisto[] = []
  if (activeSim) {
    orcamentos = await getOrcamentosPorSimulacao(activeSim.id)
  }

  const dataRange = calcDataRange(orcamentos, todosRealizados)
  const defaultInicio = dataRange?.dataInicio ?? { ano: activeSim?.ano_inicio ?? 0, mes: activeSim?.mes_inicio ?? 1 }
  const defaultFim    = dataRange?.dataFim    ?? { ano: activeSim?.ano_fim    ?? 0, mes: activeSim?.mes_fim    ?? 12 }

  const filterInicio = parsePeriod(params.inicio, defaultInicio)
  const filterFim    = parsePeriod(params.fim,    defaultFim)

  return (
    <div className="flex flex-col min-h-screen">
      <ReportsView
        categorias={categorias}
        orcamentos={orcamentos}
        realizados={todosRealizados}
        simulacoes={simulacoes}
        centrosCusto={centrosCusto}
        activeSim={activeSim}
        filterInicio={filterInicio}
        filterFim={filterFim}
        dataRange={dataRange}
      />
    </div>
  )
}
