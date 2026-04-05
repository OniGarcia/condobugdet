'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { revalidatePath } from 'next/cache'
import { DadosRealizados } from '@/types'

export async function getDadosRealizadosAnual(ano: number): Promise<any[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  let allData: any[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('dados_realizados')
      .select('id, categoria_id, ano, mes, valor_realizado, descricao')
      .eq('ano', ano)
      .eq('condo_id', condoId)
      .range(from, to)

    if (error) {
      console.error('Error fetching realized data for year:', ano, error)
      return allData
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
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
 * Fetch ALL realized data without date bounds — used by the dashboard
 * to compute the actual available period (min/max dates).
 */
export async function getTodosRealizados(): Promise<DadosRealizados[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  let allData: DadosRealizados[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('dados_realizados')
      .select('id, categoria_id, ano, mes, valor_realizado, descricao')
      .eq('condo_id', condoId)
      .order('ano', { ascending: true })
      .order('mes', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('Error fetching all realized data:', error)
      return allData
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as DadosRealizados[])
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
 * Fetch actuals across multiple years/months for the dashboard comparison.
 */
export async function getDadosRealizadosSimulacao(
    ano_inicio: number,
    mes_inicio: number,
    ano_fim: number,
    mes_fim: number
): Promise<any[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  // Since we don't have a single date field anymore, we need an OR condition or a smarter query.
  // We can just fetch all data between ano_inicio and ano_fim, then filter in JS
  // because typically a simulation spans 1-2 years max (12 to 24 rows per account).
  // This is safer and easier than complex Postgres raw SQL for year/month boundaries via REST.

  let allData: any[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('dados_realizados')
      .select('id, categoria_id, ano, mes, valor_realizado, descricao')
      .eq('condo_id', condoId)
      .gte('ano', ano_inicio)
      .lte('ano', ano_fim)
      .range(from, to)

    if (error) {
      console.error('Error fetching realized data for simulation:', error)
      return allData
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
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

  // Filter in memory for precise start/end month bounds
  const filtered = allData.filter(d => {
      // If it's a multi-year span, middle years don't need month filtering
      if (d.ano > ano_inicio && d.ano < ano_fim) return true;
      
      // If it's the exact same year
      if (ano_inicio === ano_fim) {
         return d.ano === ano_inicio && d.mes >= mes_inicio && d.mes <= mes_fim;
      }
      
      // If it's the start year
      if (d.ano === ano_inicio) {
         return d.mes >= mes_inicio;
      }
      
      // If it's the end year
      if (d.ano === ano_fim) {
         return d.mes <= mes_fim;
      }
      
      return false;
  })

  return filtered
}


export async function bulkUpsertRealizados(ano: number, entries: { categoria_id: string, mes: number, valor_realizado: number }[]) {
  const { condoId } = await validateAccess('editor')
  const supabase = await createClient()

  const payload = entries.map(e => ({
    categoria_id: e.categoria_id,
    ano: ano,
    mes: e.mes,
    valor_realizado: e.valor_realizado,
    condo_id: condoId
  }))

  const { error } = await supabase
    .from('dados_realizados')
    .upsert(payload, { onConflict: 'categoria_id,ano,mes,condo_id' })

  if (error) {
    console.error('Error saving realized data:', error.message)
    return { error: error.message }
  }

  revalidatePath('/realizado')
  revalidatePath('/dashboard')
  return { success: true }
}
