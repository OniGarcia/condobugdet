'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ImportarDadoRealizadoProps {
  codigo_reduzido: string; // The code from CSV
  data_referencia: string; // YYYY-MM-DD
  valor_realizado: number;
  descricao: string;
}

export async function importarDadosRealizados(entradas: ImportarDadoRealizadoProps[]) {
  const supabase = await createClient()

  // 1. Fetch all categories to map code -> UUID
  const { data: categorias, error: catError } = await supabase
    .from('categorias')
    .select('id, codigo_reduzido')

  if (catError) {
    console.error('Failed to load categories for import:', catError)
    return { error: 'Falha ao processar categorias' }
  }

  // 2. Identify the fallback category ("NAO ENCONTRADA")
  const fallbackCat = categorias.find(c => c.codigo_reduzido === '9.9.9.9.9');
  
  if (!fallbackCat) {
    return { error: 'Categoria fallback (NAO ENCONTRADA) não configurada no banco de dados.' }
  }

  // 3. Prepare entries for insertion
  const inserts = entradas.map((entrada) => {
    // Find matching category ID.
    const matchedCategory = categorias.find(c => c.codigo_reduzido === entrada.codigo_reduzido);
    
    // As per Socratic Gate decision, fallback to NAO ENCONTRADA if not matching
    const assignedCategoryId = matchedCategory ? matchedCategory.id : fallbackCat.id;

    return {
      categoria_id: assignedCategoryId,
      data_referencia: entrada.data_referencia,
      valor_realizado: entrada.valor_realizado,
      descricao: entrada.descricao || null
    };
  });

  // 4. Batch insert
  const { error } = await supabase
    .from('dados_realizados')
    .insert(inserts)

  if (error) {
    console.error('Error importing data:', error)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true, importedCount: inserts.length }
}

/**
 * Fetch actuals for comparison in Dashboard for a specific period
 */
export async function getDadosRealizados(dataInicial: string, dataFinal: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dados_realizados')
    .select('*')
    .gte('data_referencia', dataInicial)
    .lte('data_referencia', dataFinal);

  if (error) {
    console.error('Error fetching realized data:', error)
    throw new Error('Falha ao buscar dados realizados')
  }

  return data;
}
