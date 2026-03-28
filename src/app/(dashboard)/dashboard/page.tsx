import { getCategoriasTree } from '@/actions/categorias'
import { getOrcamentosGlobais } from '@/actions/orcamento'
import { getDadosRealizados } from '@/actions/importacao'
import { DashboardCharts } from '@/components/budget/DashboardCharts'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const currentYear = new Date().getFullYear();
  
  // Fetch data in parallel
  const [categorias, orcamentos, realizados] = await Promise.all([
    getCategoriasTree(),
    getOrcamentosGlobais(currentYear),
    getDadosRealizados(currentYear)
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Painel de Controle</h1>
          <p className="text-neutral-400">Análise de variação orçamentária (Previsto x Realizado).</p>
        </div>
        
        <div className="flex gap-3">
          <select className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all">
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
          <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400">
            Importar CSV/OFX
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-2 pb-10">
        <DashboardCharts categorias={categorias} orcamentos={orcamentos} realizados={realizados} />
      </div>
    </div>
  )
}
