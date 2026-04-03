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

export interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  saldo_inicial: number;
  created_at: string;
  updated_at: string;
  // client-side: populated when fetching with associated categories
  categoria_ids?: string[];
}

export type StatusSemaforo = 'VERDE' | 'AMARELO' | 'VERMELHO'

export interface RelatorioCategoriaAno {
  categoriaId: string
  categoriaNome: string
  codigoReduzido: string
  tipo: CategoriaTipo
  previstoMes: number
  realizadoMes: number
  previstoAcumuladoYTD: number
  realizadoAcumuladoYTD: number
  orcamentoAnualTotal: number
  saldoDisponivelAno: number
  statusSemaforoAno: StatusSemaforo
  // hierarchy
  depth: number
  hasChildren: boolean
  parentId: string | null
}

// ─── Gestão Financeira por Centro de Custo ─────────────────────────────────────

export interface GestaoCCCategoria {
  categoriaId: string
  categoriaNome: string
  codigoReduzido: string
  tipo: CategoriaTipo
  valor: number      // realizado
  previsto: number   // orçamento previsto do período
}

/** Resumo financeiro de um único mês do extrato de caixa */
export interface GestaoCCMes {
  ano: number
  mes: number
  saldoInicial: number
  entradas: number
  saidas: number
  entradasPrevisto: number
  saidasPrevisto: number
  resultado: number
  resultadoPrevisto: number
  saldoFinal: number
  categorias: GestaoCCCategoria[]
}

export interface GestaoCCMatrizCategoria {
  categoriaId: string
  categoriaNome: string
  codigoReduzido: string
  tipo: CategoriaTipo
  previsto: number
  realizado: number
  variacao: number   // realizado - previsto (receita) ou previsto - realizado (despesa)
  pct: number | null // realizado / previsto * 100
  orcamentoAnualTotal: number
  saldoDisponivelAno: number
  statusSemaforoAno: StatusSemaforo
  // hierarchy
  depth: number
  hasChildren: boolean
  parentId: string | null
}

export interface GestaoCCResult {
  centroCustoId: string
  centroCustoNome: string
  saldoInicial: number
  totalEntradas: number
  totalEntradasPrevisto: number
  totalSaidas: number
  totalSaidasPrevisto: number
  resultado: number
  resultadoPrevisto: number
  saldoFinal: number
  meses: GestaoCCMes[]
  matriz: GestaoCCMatrizCategoria[]   // visão previsto vs realizado por categoria
  periodo: {
    anoInicio: number
    mesInicio: number
    anoFim: number
    mesFim: number
  }
  temSimulacao: boolean
}

