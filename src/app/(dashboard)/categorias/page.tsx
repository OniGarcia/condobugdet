import { getCategoriasTree, getCategoriasFlat } from '@/actions/categorias'
import { TreeCategoryView } from '@/components/budget/TreeCategoryView'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const [categorias, allFlat] = await Promise.all([
    getCategoriasTree(),
    getCategoriasFlat(),
  ])

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Plano de Contas</h1>
        <p className="text-neutral-400">
          Gerencie a estrutura hierárquica de até 5 níveis. Importe o modelo XLSX ou cadastre manualmente.
        </p>
      </div>

      <TreeCategoryView data={categorias} allFlat={allFlat} />
    </div>
  )
}
