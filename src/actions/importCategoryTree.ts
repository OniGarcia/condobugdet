'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateAccess } from '@/lib/supabase/validateAccess'

interface RawCategoryRow {
  conta: string;
  codigo: string | null;
}

export async function importCategoryTree(rows: RawCategoryRow[]) {
  const { condoId } = await validateAccess('gestor')
  const supabase = await createClient()
  
  // 1. Fetch current categories to map and compare, filtered by condoId
  const { data: existing, error: fetchError } = await supabase
    .from('categorias')
    .select('id, codigo_reduzido')
    .eq('condo_id', condoId)
  
  if (fetchError) return { error: `Erro ao buscar categorias: ${fetchError.message}` }
  
  const existingMap = new Map(existing.map(c => [c.codigo_reduzido, c.id]))
  const results = { inserted: 0, updated: 0, errors: [] as string[] }
  
  // 2. Filtrar e formatar linhas válidas
  const processedRows = rows
    .filter(r => {
        if (!r.codigo || !r.conta) return false
        const cLow = String(r.codigo).toLowerCase()
        const nLow = String(r.conta).toLowerCase()
        const isHeader = cLow.includes('cód') || cLow.includes('cod') || nLow === 'conta' || nLow === 'nome da conta'
        return !isHeader
    })
    .map(r => ({
      codigo: String(r.codigo).trim(),
      conta: String(r.conta).trim()
    }))
    .sort((a, b) => a.codigo.length - b.codigo.length)

  // PASS 1: Upsert all accounts to ensure UUIDs are available
  for (const row of processedRows) {
    const { codigo, conta } = row
    const tipo = codigo.startsWith('1') ? 'RECEITA' : 'DESPESA'
    const existingId = existingMap.get(codigo)
    
    try {
      if (existingId) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome_conta: conta, tipo })
          .eq('id', existingId)
          .eq('condo_id', condoId)
        
        if (error) throw error
        results.updated++
      } else {
        const { data, error } = await supabase
          .from('categorias')
          .insert([{ 
            codigo_reduzido: codigo, 
            nome_conta: conta, 
            tipo, 
            condo_id: condoId 
          }])
          .select('id')
          .single()
        
        if (error) throw error
        if (data) {
          existingMap.set(codigo, data.id)
          results.inserted++
        }
      }
    } catch (err: any) {
      results.errors.push(`Erro na conta ${codigo}: ${err.message}`)
    }
  }
  
  // PASS 2: Identificar e vincular hierarquia (Pai/Filho)
  for (const row of processedRows) {
    const { codigo } = row
    const parts = codigo.split('.')
    
    if (parts.length > 1) {
      // Tenta encontrar o pai direto (ex: 1.1.2 -> pai é 1.1)
      const parentCodigo = parts.slice(0, -1).join('.')
      const parentId = existingMap.get(parentCodigo)
      const currentId = existingMap.get(codigo)
      
      if (currentId && parentId) {
        const { error } = await supabase
          .from('categorias')
          .update({ parent_id: parentId })
          .eq('id', currentId)
          .eq('condo_id', condoId)
          
        if (error) {
          results.errors.push(`Erro ao vincular pai de ${codigo}: ${error.message}`)
        }
      } else if (currentId) {
          // Se não encontrou o pai direto, garante que parent_id seja nulo (raíz ou órfão de arquivo)
          await supabase
            .from('categorias')
            .update({ parent_id: null })
            .eq('id', currentId)
            .eq('condo_id', condoId)
      }
    } else {
      // Categoria de nível 1 (ex: "1", "2")
      const currentId = existingMap.get(codigo)
      if (currentId) {
        await supabase
          .from('categorias')
          .update({ parent_id: null })
          .eq('id', currentId)
          .eq('condo_id', condoId)
      }
    }
  }
  
  revalidatePath('/categorias')
  revalidatePath('/orcamento')
  return results
}
