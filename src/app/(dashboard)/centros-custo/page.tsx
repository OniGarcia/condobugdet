import { getCentrosCusto } from '@/actions/centrosCusto'
import { getCategoriasFlat, getCategoriasTree } from '@/actions/categorias'
import { CostCenterView } from '@/components/budget/CostCenterView'
import { validateAccess } from '@/lib/supabase/validateAccess'

export const dynamic = 'force-dynamic'

export default async function CentrosCustoPage() {
  const [centros, allFlat, categoriaTree, { role }] = await Promise.all([
    getCentrosCusto(),
    getCategoriasFlat(),
    getCategoriasTree(),
    validateAccess('viewer'),
  ])

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Centros de Custo</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Agrupe categorias do Plano de Contas para análise financeira especializada (ex: Taxa Condominial, Manutenção).
        </p>
      </div>

      <CostCenterView data={centros} allFlat={allFlat} categoriaTree={categoriaTree} role={role} />
    </div>
  )
}
