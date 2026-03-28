'use server'

import { createClient } from '@/lib/supabase/server'
import { Categoria, CategoriaTipo } from '@/types'
import { revalidatePath } from 'next/cache'

// Helper to build the tree
function buildTree(categorias: Categoria[], parentId: string | null = null): Categoria[] {
  return categorias
    .filter(cat => cat.parent_id === parentId)
    .map(cat => ({
      ...cat,
      children: buildTree(categorias, cat.id)
    }))
    .sort((a, b) => a.codigo_reduzido.localeCompare(b.codigo_reduzido, undefined, { numeric: true }));
}

/**
 * Get all categories as a flat array
 */
export async function getCategoriasFlat(): Promise<Categoria[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('codigo_reduzido', { ascending: true })

  if (error) {
    console.error('Error fetching categorias:', error)
    throw new Error('Failed to fetch categories')
  }

  return data as Categoria[]
}

/**
 * Get categories as a hierarchical tree
 */
export async function getCategoriasTree(): Promise<Categoria[]> {
  const flatData = await getCategoriasFlat()
  return buildTree(flatData)
}

/**
 * Create a new category 
 */
export async function createCategoria(data: {
  codigo_reduzido: string;
  nome_conta: string;
  tipo: CategoriaTipo;
  parent_id?: string | null;
}) {
  const supabase = await createClient()
  
  const { data: newCat, error } = await supabase
    .from('categorias')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('Error creating categoria:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  return { data: newCat }
}

/**
 * Update a category
 */
export async function updateCategoria(id: string, data: Partial<Categoria>) {
  const supabase = await createClient()
  
  const { data: updated, error } = await supabase
    .from('categorias')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating categoria:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  return { data: updated }
}

/**
 * Delete a category
 */
export async function deleteCategoria(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting categoria:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  return { success: true }
}
