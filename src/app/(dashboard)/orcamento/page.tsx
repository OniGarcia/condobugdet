import { getCategoriasTree } from '@/actions/categorias'
import { getOrcamentosGlobais } from '@/actions/orcamento'
import { BudgetGrid } from '@/components/budget/BudgetGrid'

export const dynamic = 'force-dynamic'

export default async function OrcamentoPage() {
  const currentYear = new Date().getFullYear();
  
  // Fetch data in parallel
  const [categorias, orcamentos] = await Promise.all([
    getCategoriasTree(),
    getOrcamentosGlobais(currentYear)
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Orçamento Anual</h1>
          <p className="text-neutral-400">Gerencie a previsão financeira condominal do exercício vigente.</p>
        </div>
        
        <div className="flex gap-3">
          <select className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all">
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
          <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400">
            Exportar XLS
          </button>
        </div>
      </div>

      {/* Main Budget Data Grid Area */}
      <BudgetGrid categorias={categorias} orcamentos={orcamentos} ano={currentYear} />
    </div>
  )
}
