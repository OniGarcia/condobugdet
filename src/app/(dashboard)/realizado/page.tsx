import { getCategoriasTree } from '@/actions/categorias'
import { getDadosRealizadosAnual } from '@/actions/realizado'
import { RealizadoGrid } from '@/components/budget/RealizadoGrid'
import { validateAccess } from '@/lib/supabase/validateAccess'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function RealizadoPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const params = await searchParams
  const anoAtual = new Date().getFullYear();
  const selectedYear = params.ano ? parseInt(params.ano) : anoAtual

  // Create an array of years around the current year
  const availableYears = Array.from({ length: 5 }, (_, i) => anoAtual - 2 + i)

  // Fetch data in parallel
  const [categorias, realizados, { role }] = await Promise.all([
    getCategoriasTree(),
    getDadosRealizadosAnual(selectedYear),
    validateAccess('viewer'),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Fluxo de Caixa Realizado</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Importe o Balancete Contábil ou preencha manualmente os lançamentos executados.</p>
        </div>
        
        <div className="flex gap-3 items-center bg-white/60 dark:bg-white/5 p-1 rounded-xl border border-neutral-200 dark:border-white/10">
          <YearSelector years={availableYears} selectedYear={selectedYear} />
        </div>
      </div>

      {/* Main Realizado Data Grid Area */}
      <RealizadoGrid categorias={categorias} realizados={realizados} ano={selectedYear} canEdit={role === 'admin' || role === 'editor'} />
    </div>
  )
}

function YearSelector({ years, selectedYear }: { years: number[], selectedYear: number }) {
  // Using an inline component here because it's tiny and specific to this page.
  // We can just use next/link internally to change the param.
  return (
    <div className="flex bg-white dark:bg-neutral-950 rounded-lg overflow-hidden border border-white/5">
      {years.map(y => (
        <Link 
          key={y} 
          href={`/realizado?ano=${y}`}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            y === selectedYear 
              ? 'bg-indigo-500 text-neutral-900 dark:text-white' 
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 hover:text-neutral-900 dark:text-white block'
          }`}
        >
          {y}
        </Link>
      ))}
    </div>
  )
}
