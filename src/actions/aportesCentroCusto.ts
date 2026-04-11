'use server'

import { createClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import { revalidatePath } from 'next/cache'

export async function criarAporte(data: {
  centro_custo_id: string
  valor: number
  data_aporte: string
  origem: string
  descricao?: string
}) {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  // Calcula mês e ano a partir da data de aporte (YYYY-MM-DD)
  const dt = new Date(data.data_aporte + 'T12:00:00Z')
  const mes = dt.getUTCMonth() + 1
  const ano = dt.getUTCFullYear()

  const { error } = await supabase
    .from('aportes_centro_custo')
    .insert({
      condo_id: condoId,
      centro_custo_id: data.centro_custo_id,
      valor: data.valor,
      data_aporte: data.data_aporte,
      mes,
      ano,
      origem: data.origem,
      descricao: data.descricao || null
    })

  if (error) {
    console.error('Erro ao criar aporte:', error)
    throw new Error('Falha ao registar o aporte financeiro.')
  }

  revalidatePath('/dashboard')
  revalidatePath('/gestao-cc')
  revalidatePath('/aportes')
  return { success: true }
}

export async function deletarAporte(id: string) {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  const { error } = await supabase
    .from('aportes_centro_custo')
    .delete()
    .eq('id', id)
    .eq('condo_id', condoId)

  if (error) {
    console.error('Erro ao deletar aporte:', error)
    throw new Error('Falha ao cancelar o aporte financeiro.')
  }

  revalidatePath('/dashboard')
  revalidatePath('/gestao-cc')
  revalidatePath('/aportes')
  return { success: true }
}

export async function getAportes(centroCustoId?: string) {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  let query = supabase
    .from('aportes_centro_custo')
    .select(`
      *,
      centros_custo ( nome )
    `)
    .eq('condo_id', condoId)
    .order('data_aporte', { ascending: false })

  if (centroCustoId && centroCustoId !== 'all') {
    query = query.eq('centro_custo_id', centroCustoId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar aportes:', error)
    return []
  }

  return data
}
