import { getCentrosCusto } from '@/actions/centrosCusto'
import { getSimulacoes } from '@/actions/orcamento'
import { getGestaoCentroCusto } from '@/actions/gestaoCentroCusto'
import { getCurrentCondo } from '@/actions/auth'
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
  searchParams: Promise<{ cc?: string; inicio?: string; fim?: string; sim?: string; cutoff?: string }>
}) {
  const params = await searchParams

  const [centrosCusto, simulacoes, currentCondo] = await Promise.all([
    getCentrosCusto(),
    getSimulacoes(),
    getCurrentCondo(),
  ])

  const selectedSimId = params.sim || simulacoes[0]?.id || ''
  const activeSim = simulacoes.find(s => s.id === selectedSimId)

  // CC: usa o param da URL; se não vier, deriva do centro de custo da simulação; senão, primeiro CC
  const selectedCCId = params.cc || activeSim?.centro_custo_id || centrosCusto[0]?.id || ''

  // Período: Se houver simulação, usa o período dela. Caso contrário, usa fallback de 1 mês.
  const now = new Date()
  const fallbackFim = { ano: now.getFullYear(), mes: now.getMonth() + 1 }
  const fallbackIni = {
    ano: fallbackFim.mes === 1 ? fallbackFim.ano - 1 : fallbackFim.ano,
    mes: fallbackFim.mes === 1 ? 12 : fallbackFim.mes - 1,
  }

  const filterInicio = activeSim
    ? { ano: activeSim.ano_inicio, mes: activeSim.mes_inicio }
    : parsePeriod(params.inicio, fallbackIni)

  const filterFim = activeSim
    ? { ano: activeSim.ano_fim, mes: activeSim.mes_fim }
    : parsePeriod(params.fim, fallbackFim)

  // Corte do Realizado: usa param da URL; se não vier, usa o mês anterior ao atual
  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const fallbackCutoff = { ano: lastMonthDate.getFullYear(), mes: lastMonthDate.getMonth() + 1 }
  const cutoff = parsePeriod(params.cutoff, fallbackCutoff)

  const gestaoDados = selectedCCId
    ? await getGestaoCentroCusto(
        selectedCCId,
        filterInicio.ano, filterInicio.mes,
        filterFim.ano,    filterFim.mes,
        selectedSimId || undefined,
        cutoff.ano,
        cutoff.mes,
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
        cutoffAno={cutoff.ano}
        cutoffMes={cutoff.mes}
        gestaoDados={gestaoDados}
        condoNome={currentCondo?.nome ?? null}
      />
    </div>
  )
}
