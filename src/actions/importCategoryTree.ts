'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface RawCategoryRow {
  conta: string;
  codigo: string | null;
}

export async function importCategoryTree(rows: RawCategoryRow[]) {
  const supabase = await createClient()
  
  // 1. Fetch current categories to map and compare
  const { data: existing, error: fetchError } = await supabase
    .from('categorias')
    .select('id, codigo_reduzido')
  
  if (fetchError) return { error: `Erro ao buscar categorias: ${fetchError.message}` }
  
  const existingMap = new Map(existing.map(c => [c.codigo_reduzido, c.id]))
  const results = { inserted: 0, updated: 0, errors: [] as string[] }
  
  // 2. Sort by code length to handle parents before children (conceptual help)
  const processedRows = rows
    .filter(r => !!r.codigo)
    .sort((a, b) => (a.codigo || "").length - (b.codigo || "").length)

  // PASS 1: Upsert all accounts to ensure UUIDs are available
  for (const row of processedRows) {
    const codigo = row.codigo!
    const nome = row.conta
    // Logic: 1.x = RECEITA, else = DESPESA (Standard condo/company accounting)
    const tipo = codigo.startsWith('1') ? 'RECEITA' : 'DESPESA'
    
    const existingId = existingMap.get(codigo)
    
    if (existingId) {
      const { error } = await supabase
        .from('categorias')
        .update({ nome_conta: nome, tipo })
        .eq('id', existingId)
      
      if (error) results.errors.push(`Erro no Update ${codigo}: ${error.message}`)
      else results.updated++
    } else {
      const { data, error } = await supabase
        .from('categorias')
        .insert([{ codigo_reduzido: codigo, nome_conta: nome, tipo }])
        .select('id')
        .single()
      
      if (error) {
        results.errors.push(`Erro no Insert ${codigo}: ${error.message}`)
      } else if (data) {
        existingMap.set(codigo, data.id)
        results.inserted++
      }
    }
  }
  
  // PASS 2: Link parents (Recursive structure)
  for (const row of processedRows) {
    const codigo = row.codigo!
    const parts = codigo.split('.')
    
    if (parts.length > 1) {
      const parentCodigo = parts.slice(0, -1).join('.')
      const parentId = existingMap.get(parentCodigo)
      const currentId = existingMap.get(codigo)
      
      if (parentId && currentId) {
        await supabase
          .from('categorias')
          .update({ parent_id: parentId })
          .eq('id', currentId)
      }
    } else {
        // Root category, ensure parent_id is null
        const currentId = existingMap.get(codigo)
        if (currentId) {
            await supabase
                .from('categorias')
                .update({ parent_id: null })
                .eq('id', currentId)
        }
    }
  }
  
  revalidatePath('/categorias')
  revalidatePath('/orcamento')
  return results
}
