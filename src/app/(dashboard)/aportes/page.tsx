import { getAportes } from '@/actions/aportesCentroCusto'
import { AportesList } from '@/components/aportes/AportesList'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AportesPage() {
  const { role, condoId } = await validateAccess('visualizador')
  
  const supabase = await createClient()
  const { data: centros_custo } = await supabase
    .from('centros_custo')
    .select('*')
    .eq('condo_id', condoId)
    .order('nome')
    
  const aportes = await getAportes()

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Aportes e Financiamentos</h1>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-3xl">
          Registre entradas de capital não operacionais, como destinações do Fundo de Reserva ou financiamentos bancários. 
          Estes valores serão somados fisicamente ao Saldo Final dos Centros de Custo sem distorcer as métricas de Receita Operacional.
        </p>
      </div>

      <AportesList 
        aportes={aportes}
        centrosDeCusto={centros_custo || []} 
        role={role} 
      />
    </div>
  )
}
