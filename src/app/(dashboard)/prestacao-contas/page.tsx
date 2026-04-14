import { getPrestacaoContas } from '@/actions/prestacaoContas'
import { getCurrentCondo } from '@/actions/auth'
import { PrestacaoContasView } from '@/components/prestacaoContas/PrestacaoContasView'

export const dynamic = 'force-dynamic'

export default async function PrestacaoContasPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const ano = params.ano ? Number(params.ano) : now.getFullYear()

  const [data, currentCondo] = await Promise.all([
    getPrestacaoContas(ano),
    getCurrentCondo(),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <PrestacaoContasView
        data={data}
        ano={ano}
        condoNome={currentCondo?.nome ?? null}
      />
    </div>
  )
}
