import { getPrestacaoContas } from '@/actions/prestacaoContas'
import { getCurrentCondo } from '@/actions/auth'
import { PrestacaoContasView } from '@/components/prestacaoContas/PrestacaoContasView'

export const dynamic = 'force-dynamic'

function parsePeriod(param: string | undefined, fallback: { ano: number; mes: number }) {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [ano, mes] = param.split('-').map(Number)
    if (mes >= 1 && mes <= 12) return { ano, mes }
  }
  return fallback
}

export default async function PrestacaoContasPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const params = await searchParams
  const now = new Date()

  const inicio = parsePeriod(params.inicio, { ano: now.getFullYear(), mes: 1 })
  const fim    = parsePeriod(params.fim,    { ano: now.getFullYear(), mes: 12 })

  const [data, currentCondo] = await Promise.all([
    getPrestacaoContas(inicio.ano, inicio.mes, fim.ano, fim.mes),
    getCurrentCondo(),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <PrestacaoContasView
        data={data}
        inicio={inicio}
        fim={fim}
        condoNome={currentCondo?.nome ?? null}
      />
    </div>
  )
}
