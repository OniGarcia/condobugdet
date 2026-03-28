import { getCategoriasTree } from '@/actions/categorias'
import { TreeCategoryView } from '@/components/budget/TreeCategoryView'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const categorias = await getCategoriasTree()

  return (
    <div className="max-w-4xl max-h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Plano de Contas</h1>
        <p className="text-neutral-400">Gerencie a estrutura hierárquica das categorias de receitas e despesas.</p>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl">
        <TreeCategoryView data={categorias} />
      </div>
    </div>
  )
}
