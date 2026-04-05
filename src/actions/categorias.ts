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

export async function createCategoria(data: {
  codigo_reduzido: string
  nome_conta: string
  tipo: CategoriaTipo
  parent_id?: string | null
}) {
  const { condoId } = await validateAccess('editor')
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
  const { condoId } = await validateAccess('editor')
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
