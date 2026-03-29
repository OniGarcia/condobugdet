export type CategoriaTipo = 'RECEITA' | 'DESPESA';

export interface Categoria {
  id: string;
  codigo_reduzido: string;
  nome_conta: string;
  tipo: CategoriaTipo;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Fields added by the app/client logic
  children?: Categoria[];
}

export interface OrcamentoSimulacao {
  id: string;
  nome: string;
  mes_inicio: number;
  ano_inicio: number;
  mes_fim: number;
  ano_fim: number;
  created_at: string;
}

export interface OrcamentoPrevisto {
  id: string;
  simulacao_id: string;
  categoria_id: string;
  mes: number;
  ano: number;
  valor_previsto: number;
  created_at: string;
  updated_at: string;
}

export interface DadosRealizados {
  id: string;
  categoria_id: string;
  ano: number;
  mes: number;
  valor_realizado: number;
  descricao: string | null;
  criado_em: string;
}
