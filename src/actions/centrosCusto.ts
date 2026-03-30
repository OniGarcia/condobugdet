'use server'

import { createClient } from '@/lib/supabase/server'
import { CentroCusto } from '@/types'
import { revalidatePath } from 'next/cache'

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getCentrosCusto(): Promise<CentroCusto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('centros_custo')
    .select('*, categoria_centro_custo(categoria_id)')
    .order('nome', { ascending: true })
  if (error) throw new Error(`Failed to fetch centros de custo: ${error.message}`)

  return data.map((cc: any) => ({
    ...cc,
    categoria_ids: (cc.categoria_centro_custo ?? []).map((r: any) => r.categoria_id),
    categoria_centro_custo: undefined,
  })) as CentroCusto[]
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createCentroCusto(data: { nome: string; descricao: string | null }) {
  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('centros_custo')
    .insert([data])
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/centros-custo')
  return { data: created as CentroCusto }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateCentroCusto(id: string, data: { nome: string; descricao: string | null }) {
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('centros_custo')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/centros-custo')
  return { data: updated as CentroCusto }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCentroCusto(id: string) {
  const supabase = await createClient()
  // Junction rows are deleted via ON DELETE CASCADE in the DB
  const { error } = await supabase.from('centros_custo').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/centros-custo')
  return { success: true }
}

// ─── Category Association ──────────────────────────────────────────────────────

/**
 * Replace all category associations for a cost center.
 * Deletes existing rows and inserts the new set atomically.
 */
export async function setCentroCategories(centroCustoId: string, categoriaIds: string[]) {
  const supabase = await createClient()

  const { error: delError } = await supabase
    .from('categoria_centro_custo')
    .delete()
    .eq('centro_custo_id', centroCustoId)
  if (delError) return { error: `Erro ao limpar categorias: ${delError.message}` }

  if (categoriaIds.length > 0) {
    const rows = categoriaIds.map(categoria_id => ({ centro_custo_id: centroCustoId, categoria_id }))
    const { error: insError } = await supabase.from('categoria_centro_custo').insert(rows)
    if (insError) return { error: `Erro ao associar categorias: ${insError.message}` }
  }

  revalidatePath('/centros-custo')
  return { success: true }
}
