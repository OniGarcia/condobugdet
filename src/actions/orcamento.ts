'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { OrcamentoPrevisto } from '@/types'

export interface ReplicarOrcamentoProps {
  categoria_id: string;
  valor_previsto: number;
  ano: number;
  mes_inicio: number;
  mes_fim: number;
}

/**
 * Replicate a budget value across multiple months for a given category.
 * If an entry already exists, it is overwritten (Upsert strategy) as per Socratic Gate decision.
 */
export async function replicarOrcamento(data: ReplicarOrcamentoProps) {
  const { categoria_id, valor_previsto, ano, mes_inicio, mes_fim } = data;
  
  if (mes_inicio > mes_fim || mes_inicio < 1 || mes_fim > 12) {
    return { error: 'Range de meses inválido. (Deve ser de 1 a 12)' };
  }

  const supabase = await createClient();
  
  // Create payload for upsert
  const entries = [];
  for (let mes = mes_inicio; mes <= mes_fim; mes++) {
    // Upsert relies on unique constraint (categoria_id, ano, mes)
    entries.push({
      categoria_id,
      ano,
      mes,
      valor_previsto
    });
  }

  // Supabase upsert
  const { error } = await supabase
    .from('orcamento_previsto')
    .upsert(entries, { onConflict: 'categoria_id,ano,mes' });

  if (error) {
    console.error('Error replicating budget:', error);
    return { error: error.message };
  }

  // Reload page cache where this is shown
  revalidatePath('/orcamento');
  return { success: true, count: entries.length };
}

/**
 * Fetch budget values for a specific year
 */
export async function getOrcamentosGlobais(ano: number): Promise<OrcamentoPrevisto[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('orcamento_previsto')
    .select('*')
    .eq('ano', ano);

  if (error) {
    console.error('Error fetching budgets:', error);
    throw new Error('Failed to fetch budgets');
  }

  return data as OrcamentoPrevisto[];
}

/**
 * Upsert single budget entry (for individual cell edits)
 */
export async function updateOrcamentoMensal(categoria_id: string, ano: number, mes: number, valor: number) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('orcamento_previsto')
    .upsert({
      categoria_id,
      ano,
      mes,
      valor_previsto: valor
    }, { onConflict: 'categoria_id,ano,mes' });

  if (error) {
    console.error('Error updating budget:', error);
    return { error: error.message };
  }

  revalidatePath('/orcamento');
  return { success: true };
}
