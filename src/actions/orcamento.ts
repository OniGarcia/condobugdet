'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { revalidatePath } from 'next/cache'
import { OrcamentoPrevisto, OrcamentoSimulacao } from '@/types'

// ==========================================
// SIMULAÇÕES (BUDGET CONFIGURATIONS)
// ==========================================

export async function getSimulacoes(): Promise<OrcamentoSimulacao[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orcamentos_simulacoes')
    .select('*')
    .eq('condo_id', condoId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching simulacoes:', error)
    return []
  }

  return data as OrcamentoSimulacao[]
}

export async function createSimulacao(nome: string, mesInicio: number, anoInicio: number, length: number = 12) {
  const { condoId } = await validateAccess('editor')
  const supabase = await createClient()

  // Calculate End Date
  // Example: mesInicio = 12, anoInicio = 2025, length = 12
  // 12 months starting from 12/2025 -> ends in 11/2026
  const totalMonths = mesInicio - 1 + length - 1 // 0-indexed calculation
  const anoFim = anoInicio + Math.floor(totalMonths / 12)
  const mesFim = (totalMonths % 12) + 1

  const { data, error } = await supabase
    .from('orcamentos_simulacoes')
    .insert({
      nome,
      mes_inicio: mesInicio,
      ano_inicio: anoInicio,
      mes_fim: mesFim,
      ano_fim: anoFim,
      condo_id: condoId
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating simulacao:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  return { success: true, simulacao: data as OrcamentoSimulacao }
}

// ==========================================
// ORÇAMENTOS (BUDGET DATA)
// ==========================================

/**
 * Fetch budget values for a specific simulation
 */
export async function getOrcamentosPorSimulacao(simulacao_id: string): Promise<OrcamentoPrevisto[]> {
  if (!simulacao_id) return [];

  const { condoId } = await validateAccess()
  const supabase = await createClient()
  let allData: any[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('orcamento_previsto')
      .select('*')
      .eq('simulacao_id', simulacao_id)
      .eq('condo_id', condoId)
      .range(from, to)

    if (error) {
      console.error('Error fetching budgets:', error)
      throw new Error('Failed to fetch budgets')
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

  return allData as OrcamentoPrevisto[]
}

/**
 * Bulk Upsert entire budget grid for a simulation
 */
export async function bulkUpsertOrcamentos(simulacao_id: string, entries: {categoria_id: string, mes: number, ano: number, valor_previsto: number}[]) {
  const { condoId } = await validateAccess('editor')
  const supabase = await createClient()

  // Inject simulacao_id into all entries
  const payload = entries.map(e => ({
    simulacao_id,
    categoria_id: e.categoria_id,
    mes: e.mes,
    ano: e.ano,
    valor_previsto: e.valor_previsto,
    condo_id: condoId
  }))

  // Instead of Upsert which might leave zombies if they deleted a row, we Upsert the new values.
  // Note: We're doing an upsert on Conflict "simulacao_id,categoria_id,ano,mes".
  const { error } = await supabase
    .from('orcamento_previsto')
    .upsert(payload, { onConflict: 'simulacao_id,categoria_id,ano,mes' })

  if (error) {
    console.error('Error saving budgets:', error.message, error.details, error.hint)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  return { success: true }
}

/**
 * Update only the name of a simulation
 */
export async function updateSimulacaoNome(id: string, nome: string) {
  const { condoId } = await validateAccess('editor')
  const supabase = await createClient()
  const { error } = await supabase
    .from('orcamentos_simulacoes')
    .update({ nome })
    .eq('id', id)
    .eq('condo_id', condoId)

  if (error) {
    console.error('Error updating simulation name:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Delete a simulation and all its linked budget data (via cascade)
 */
export async function deleteSimulacao(id: string) {
  const { condoId } = await validateAccess('admin')
  const supabase = await createClient()
  const { error } = await supabase
    .from('orcamentos_simulacoes')
    .delete()
    .eq('id', id)
    .eq('condo_id', condoId)

  if (error) {
    console.error('Error deleting simulation:', error)
    return { error: error.message }
  }

  revalidatePath('/orcamento')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Clone a simulation: Copies metadata (start/end dates) and all budget values
 */
export async function cloneSimulacao(id: string, novoNome: string) {
  const { condoId } = await validateAccess('editor')
  const supabase = await createClient()

  // 1. Fetch original metadata
  const { data: original, error: fetchError } = await supabase
    .from('orcamentos_simulacoes')
    .select('*')
    .eq('id', id)
    .eq('condo_id', condoId)
    .single()

  if (fetchError || !original) {
    return { error: 'Simulação original não encontrada.' }
  }

  // 2. Create new simulation
  const { data: cloned, error: createError } = await supabase
    .from('orcamentos_simulacoes')
    .insert({
      nome: novoNome,
      mes_inicio: original.mes_inicio,
      ano_inicio: original.ano_inicio,
      mes_fim: original.mes_fim,
      ano_fim: original.ano_fim,
      condo_id: condoId
    })
    .select()
    .single()

  if (createError || !cloned) {
    return { error: 'Erro ao criar cópia da simulação.' }
  }

  // 3. Fetch all original budget values
  let values: any[] = []
  let from = 0
  let to = 999
  let hasMore = true

  while (hasMore) {
    const { data: chunk, error: valuesError } = await supabase
      .from('orcamento_previsto')
      .select('categoria_id, ano, mes, valor_previsto')
      .eq('simulacao_id', id)
      .range(from, to)

    if (valuesError) {
      return { error: 'Simulação criada, mas erro ao copiar valores: ' + valuesError.message }
    }

    if (chunk && chunk.length > 0) {
      values = values.concat(chunk)
      if (chunk.length < 1000) {
        hasMore = false
      } else {
        from += 1000
        to += 1000
      }
    } else {
      hasMore = false
    }
  }

  // 4. Bulk insert into new simulation
  if (values && values.length > 0) {
    const payload = values.map(v => ({
      simulacao_id: cloned.id,
      categoria_id: v.categoria_id,
      ano: v.ano,
      mes: v.mes,
      valor_previsto: v.valor_previsto,
      condo_id: condoId
    }))

    const { error: insertError } = await supabase
      .from('orcamento_previsto')
      .insert(payload)

    if (insertError) {
       return { error: 'Simulação criada, mas erro ao inserir valores copiados: ' + insertError.message }
    }
  }

  revalidatePath('/orcamento')
  revalidatePath('/dashboard')
  return { success: true, id: cloned.id }
}
