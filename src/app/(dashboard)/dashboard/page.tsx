import { getCentrosCusto } from '@/actions/centrosCusto'
import { getSimulacoes } from '@/actions/orcamento'
import { getGestaoCentroCusto } from '@/actions/gestaoCentroCusto'
import { GestaoCCView } from '@/components/dashboard/GestaoCCView'

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cc?: string; inicio?: string; fim?: string; sim?: string }>
}) {
  const params = await searchParams

  const [centrosCusto, simulacoes] = await Promise.all([
    getCentrosCusto(),
    getSimulacoes(),
  ])

  const selectedCCId  = params.cc  || centrosCusto[0]?.id || ''
  const selectedSimId = params.sim || simulacoes[0]?.id   || ''

  // Período padrão: mês atual
  const now = new Date()
  const defaultFim = { ano: now.getFullYear(), mes: now.getMonth() + 1 }
  const defaultIni = {
    ano: defaultFim.mes === 1 ? defaultFim.ano - 1 : defaultFim.ano,
    mes: defaultFim.mes === 1 ? 12 : defaultFim.mes - 1,
  }

  const filterInicio = parsePeriod(params.inicio, defaultIni)
  const filterFim    = parsePeriod(params.fim,    defaultFim)

  const gestaoDados = selectedCCId
    ? await getGestaoCentroCusto(
        selectedCCId,
        filterInicio.ano, filterInicio.mes,
        filterFim.ano,    filterFim.mes,
        selectedSimId || undefined,
      )
    : null

  return (
    <div className="flex flex-col min-h-screen">
      <GestaoCCView
        centrosCusto={centrosCusto}
        simulacoes={simulacoes}
        selectedCCId={selectedCCId}
        selectedSimId={selectedSimId}
        filterInicio={filterInicio}
        filterFim={filterFim}
        gestaoDados={gestaoDados}
      />
    </div>
  )
}
