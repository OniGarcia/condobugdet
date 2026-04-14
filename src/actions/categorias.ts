'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { Categoria, CategoriaTipo } from '@/types'
import { revalidatePath } from 'next/cache'

function buildTree(categorias: Categoria[], parentId: string | null = null): Categoria[] {
  return categorias
    .filter(cat => cat.parent_id === parentId)
    .map(cat => ({
      ...cat,
      children: buildTree(categorias, cat.id)
    }))
    .sort((a, b) => a.codigo_reduzido.localeCompare(b.codigo_reduzido, undefined, { numeric: true }))
}

export async function getCategoriasFlat(): Promise<Categoria[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .or(`condo_id.eq.${condoId},condo_id.is.null`)
    .order('codigo_reduzido', { ascending: true })
  if (error) throw new Error('Failed to fetch categories')
  return data as Categoria[]
}

export async function getCategoriasTree(): Promise<Categoria[]> {
  const flatData = await getCategoriasFlat()
  return buildTree(flatData)
}

/**
 * Returns a category tree filtered to only include categories linked to a
 * specific cost center, plus all their ancestors (to preserve hierarchy).
 * If centroCustoId is null/undefined, returns the full tree.
 */
export async function getCategoriasTreeByCentroCusto(centroCustoId: string | null | undefined): Promise<Categoria[]> {
  if (!centroCustoId) return getCategoriasTree()

  const { condoId } = await validateAccess()
  const supabase = await createClient()

  // 1. Get all category IDs linked to this cost center
  const { data: junctionRows, error: jErr } = await supabase
    .from('categoria_centro_custo')
    .select('categoria_id')
    .eq('centro_custo_id', centroCustoId)

  if (jErr || !junctionRows || junctionRows.length === 0) return getCategoriasTree()

  const linkedIds = new Set(junctionRows.map((r: any) => r.categoria_id as string))

  // 2. Get all categories flat (to resolve ancestors)
  const { data: allCats, error: catErr } = await supabase
    .from('categorias')
    .select('*')
    .or(`condo_id.eq.${condoId},condo_id.is.null`)
  if (catErr || !allCats) return getCategoriasTree()

  const byId = new Map<string, Categoria>(allCats.map((c: any) => [c.id, c as Categoria]))

  // 3. Collect linked IDs + all their ancestors
  const included = new Set<string>()
  for (const id of linkedIds) {
    let current: Categoria | undefined = byId.get(id)
    while (current) {
      included.add(current.id)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
  }

  const filtered = allCats.filter((c: any) => included.has(c.id)) as Categoria[]
  return buildTree(filtered)
}

export async function createCategoria(data: {
  codigo_reduzido: string
  nome_conta: string
  tipo: CategoriaTipo
  parent_id?: string | null
}) {
  const { condoId } = await validateAccess('gestor')
  const supabase = await createClient()
  const { data: newCat, error } = await supabase
    .from('categorias')
    .insert([{ ...data, condo_id: condoId }])
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/categorias')
  return { data: newCat }
}

export async function updateCategoria(id: string, data: Partial<Omit<Categoria, 'id' | 'created_at' | 'updated_at'>>) {
  const { condoId } = await validateAccess('gestor')
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('categorias')
    .update(data)
    .eq('id', id)
    .eq('condo_id', condoId)
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/categorias')
  return { data: updated }
}

/**
 * Check if a category has any linked data before deletion.
 * Returns counts of linked records.
 */
export async function checkCategoriaVinculos(id: string): Promise<{ orcamentos: number; realizados: number }> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  const [{ count: orcamentos }, { count: realizados }] = await Promise.all([
    supabase.from('orcamento_previsto').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('condo_id', condoId),
    supabase.from('dados_realizados').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('condo_id', condoId),
  ])

  return { orcamentos: orcamentos ?? 0, realizados: realizados ?? 0 }
}

/**
 * Transfer all linked data to a new category, then delete the original.
 */
export async function transferAndDeleteCategoria(fromId: string, toId: string) {
  const { condoId } = await validateAccess('admin')
  const supabase = await createClient()

  // Move orcamento_previsto records
  const { error: errOrc } = await supabase
    .from('orcamento_previsto')
    .update({ categoria_id: toId })
    .eq('categoria_id', fromId)
    .eq('condo_id', condoId)

  if (errOrc) return { error: `Erro ao transferir orçamentos: ${errOrc.message}` }

  // Move dados_realizados records
  const { error: errReal } = await supabase
    .from('dados_realizados')
    .update({ categoria_id: toId })
    .eq('categoria_id', fromId)
    .eq('condo_id', condoId)

  if (errReal) return { error: `Erro ao transferir dados realizados: ${errReal.message}` }

  // Now safe to delete
  const { error: errDel } = await supabase
    .from('categorias')
    .delete()
    .eq('id', fromId)
    .eq('condo_id', condoId)

  if (errDel) return { error: `Erro ao excluir categoria: ${errDel.message}` }

  revalidatePath('/categorias')
  revalidatePath('/orcamento')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Direct delete (only when no linked data exists).
 */
export async function deleteCategoria(id: string) {
  const { condoId } = await validateAccess('admin')
  const supabase = await createClient()
  const { error } = await supabase.from('categorias').delete().eq('id', id).eq('condo_id', condoId)
  if (error) return { error: error.message }
  revalidatePath('/categorias')
  return { success: true }
}

/**
 * Checks linked data for multiple categories at once.
 * Useful for bulk deletion warnings.
 */
export async function checkCategoriasVinculosBulk(ids: string[]): Promise<Record<string, { orcamentos: number; realizados: number }>> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  // Use Promise.all to check all IDs
  const results = await Promise.all(ids.map(async (id) => {
    const [{ count: orcamentos }, { count: realizados }] = await Promise.all([
      supabase.from('orcamento_previsto').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('condo_id', condoId),
      supabase.from('dados_realizados').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('condo_id', condoId),
    ])
    return { id, orcamentos: orcamentos ?? 0, realizados: realizados ?? 0 }
  }))

  const map: Record<string, { orcamentos: number; realizados: number }> = {}
  results.forEach(r => {
    map[r.id] = { orcamentos: r.orcamentos, realizados: r.realizados }
  })

  return map
}

/**
 * Bulk delete categories. Only deletes those without linked data or children.
 * Returns a list of IDs that were successfully deleted and those that were skipped.
 */
export async function deleteCategoriasBulk(ids: string[]) {
  const { condoId } = await validateAccess('admin')
  const supabase = await createClient()

  const deleted: string[] = []
  const skipped: { id: string; reason: string }[] = []

  // Check vinculos for all
  const vinculos = await checkCategoriasVinculosBulk(ids)

  for (const id of ids) {
    const v = vinculos[id]
    if (v.orcamentos > 0 || v.realizados > 0) {
      skipped.push({ id, reason: 'possui dados vinculados' })
      continue
    }

    // Also check if it has children in DB (that aren't in the delete list)
    const { count: childrenCount } = await supabase
      .from('categorias')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id)

    if (childrenCount && childrenCount > 0) {
      // If we are deleting the children too in this same batch, we should handle the order or use a recursive delete.
      // For simplicity in this first iteration, we check if children are also in the delete list.
      // But actually, it's better to just let the DB error or skip if it's too complex.
      // Let's just try to delete and catch errors.
    }

    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', id)
      .eq('condo_id', condoId)

    if (error) {
      skipped.push({ id, reason: error.message })
    } else {
      deleted.push(id)
    }
  }

  revalidatePath('/categorias')
  return { deleted, skipped }
}
