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

  const selectedSimId = params.sim || simulacoes[0]?.id || ''
  const activeSim = simulacoes.find(s => s.id === selectedSimId)

  // CC: usa o param da URL; se não vier, deriva do centro de custo da simulação; senão, primeiro CC
  const selectedCCId = params.cc || activeSim?.centro_custo_id || centrosCusto[0]?.id || ''

  // Período: usa param da URL; se não vier, usa o período da simulação selecionada
  const now = new Date()
  const fallbackFim = { ano: now.getFullYear(), mes: now.getMonth() + 1 }
  const fallbackIni = {
    ano: fallbackFim.mes === 1 ? fallbackFim.ano - 1 : fallbackFim.ano,
    mes: fallbackFim.mes === 1 ? 12 : fallbackFim.mes - 1,
  }
  const simIni = activeSim ? { ano: activeSim.ano_inicio, mes: activeSim.mes_inicio } : fallbackIni
  const simFim = activeSim ? { ano: activeSim.ano_fim,   mes: activeSim.mes_fim   } : fallbackFim

  const filterInicio = parsePeriod(params.inicio, simIni)
  const filterFim    = parsePeriod(params.fim,    simFim)

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
