'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { revalidatePath } from 'next/cache'
import { FluxoProjetado } from '@/types'

/**
 * Fetch all projected values for a given simulation.
 * Returns the user-edited future months stored in fluxo_projetado.
 */
export async function getFluxoProjetado(simulacao_id: string): Promise<FluxoProjetado[]> {
  if (!simulacao_id) return []

  const { condoId } = await validateAccess()
  const supabase = await createClient()

  let allData: FluxoProjetado[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('fluxo_projetado')
      .select('id, simulacao_id, condo_id, categoria_id, ano, mes, valor_projetado, created_at, updated_at')
      .eq('simulacao_id', simulacao_id)
      .eq('condo_id', condoId)
      .range(from, to)

    if (error) {
      console.error('Error fetching fluxo_projetado:', error)
      return allData
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as FluxoProjetado[])
      if (data.length < 1000) {
        hasMore = false
      } else {
        from += 1000
        to += 1000
      }
    } else {
      hasMore = false
    }
  }

  return allData
}

/**
 * Bulk upsert projected values for a simulation.
 * Only future months (beyond cutoff) should be passed here.
 * Existing entries are updated via ON CONFLICT.
 */
export async function bulkUpsertProjetado(
  simulacao_id: string,
  entries: { categoria_id: string; mes: number; ano: number; valor_projetado: number }[]
) {
  const { condoId } = await validateAccess('gestor')
  const supabase = await createClient()

  const payload = entries.map(e => ({
    simulacao_id,
    condo_id: condoId,
    categoria_id: e.categoria_id,
    mes: e.mes,
    ano: e.ano,
    valor_projetado: e.valor_projetado,
  }))

  const { error } = await supabase
    .from('fluxo_projetado')
    .upsert(payload, { onConflict: 'simulacao_id,condo_id,categoria_id,ano,mes' })

  if (error) {
    console.error('Error saving fluxo_projetado:', error.message, error.details)
    return { error: error.message }
  }

  revalidatePath('/forecast')
  return { success: true }
}
