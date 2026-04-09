import { getCategoriasTree } from '@/actions/categorias'
import { getDadosRealizadosAnual } from '@/actions/realizado'
import { RealizadoGrid } from '@/components/budget/RealizadoGrid'
import { validateAccess } from '@/lib/supabase/validateAccess'

export const dynamic = 'force-dynamic'

export default async function RealizadoPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const params = await searchParams
  const anoAtual = new Date().getFullYear()
  const selectedYear = params.ano ? parseInt(params.ano) : anoAtual
  const availableYears = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i)

  const [categorias, realizados, { role }] = await Promise.all([
    getCategoriasTree(),
    getDadosRealizadosAnual(selectedYear),
    validateAccess('visualizador'),
  ])

  const canEdit = role === 'admin' || role === 'gestor'

  return (
    <RealizadoGrid
      categorias={categorias}
      realizados={realizados}
      ano={selectedYear}
      canEdit={canEdit}
      availableYears={availableYears}
    />
  )
}
