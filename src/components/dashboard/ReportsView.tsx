'use client'

import { useState, useMemo } from 'react'
import { FileText, Printer, ChevronDown, Boxes, LayoutDashboard } from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados, OrcamentoSimulacao, CentroCusto } from '@/types'
import { DashboardCharts } from '@/components/budget/DashboardCharts'
import { ComparativeTable } from '@/components/dashboard/ComparativeTable'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { PeriodSelector } from '@/components/budget/PeriodSelector'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs))
}

interface ReportsViewProps {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  simulacoes: OrcamentoSimulacao[]
  centrosCusto: CentroCusto[]
  activeSim: OrcamentoSimulacao | undefined
  filterInicio: { ano: number; mes: number }
  filterFim: { ano: number; mes: number }
  dataRange: any
}

export function ReportsView({
  categorias,
  orcamentos,
  realizados,
  simulacoes,
  centrosCusto,
  activeSim,
  filterInicio,
  filterFim,
  dataRange,
}: ReportsViewProps) {
  const [selectedCCId, setSelectedCCId] = useState<string>('all')

  const selectedCC = useMemo(() => 
    centrosCusto.find(cc => cc.id === selectedCCId),
    [centrosCusto, selectedCCId]
  )

  const { filteredOrcamentos, filteredRealizados } = useMemo(() => {
    const startKey = filterInicio.ano * 100 + filterInicio.mes
    const endKey = filterFim.ano * 100 + filterFim.mes

    // 1. Time filter
    let oFil = orcamentos.filter(o => {
      const k = o.ano * 100 + o.mes
      return k >= startKey && k <= endKey
    })
    let rFil = realizados.filter(r => {
      const k = r.ano * 100 + r.mes
      return k >= startKey && k <= endKey
    })

    // 2. Cost Center filter
    if (selectedCC && selectedCCId !== 'all') {
      const ccCatIds = new Set(selectedCC.categoria_ids)
      oFil = oFil.filter(o => ccCatIds.has(o.categoria_id))
      rFil = rFil.filter(r => ccCatIds.has(r.categoria_id))
    }

    return { filteredOrcamentos: oFil, filteredRealizados: rFil }
  }, [orcamentos, realizados, filterInicio, filterFim, selectedCC, selectedCCId])

  const handlePrint = () => {
    window.print()
  }

  const selectedInicioStr = `${filterInicio.ano}-${String(filterInicio.mes).padStart(2, '0')}`
  const selectedFimStr = `${filterFim.ano}-${String(filterFim.mes).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── Header & Toolbar (No Print) ────────────────────────────────────────── */}
      <div className="no-print flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Relatórios Gerenciais</h1>
            <p className="text-neutral-400">Geração de relatórios financeiros consolidados e por centro de custo.</p>
          </div>
          <div className="flex gap-3">
             <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              <Printer className="w-4 h-4" />
              Gerar PDF / Imprimir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Simulação</label>
            <SimulationSelector simulacoes={simulacoes} selectedId={activeSim?.id} targetPath="/relatorios" />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Centro de Custo</label>
            <div className="relative group">
              <select
                value={selectedCCId}
                onChange={(e) => setSelectedCCId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-neutral-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-white/10"
              >
                <option value="all" className="bg-neutral-900">Todos os Lançamentos</option>
                {centrosCusto.map(cc => (
                  <option key={cc.id} value={cc.id} className="bg-neutral-900">{cc.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-300 transition-colors" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Período</label>
            {dataRange && (
              <PeriodSelector
                dataInicio={dataRange.dataInicio}
                dataFim={dataRange.dataFim}
                selectedInicio={selectedInicioStr}
                selectedFim={selectedFimStr}
                simulacaoId={activeSim?.id}
                targetPath="/relatorios"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Report Content (Print Ready) ────────────────────────────────────────── */}
      <div className="flex flex-col gap-8 print:gap-12">
        
        {/* Print Header (Visible only on PDF) */}
        <div className="hidden print:flex justify-between items-start border-b-2 border-neutral-900 pb-6 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-neutral-900 flex items-center justify-center">
                <LayoutDashboard className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">CondoBudget</h2>
            </div>
            <h1 className="text-2xl font-black text-neutral-950">RELATÓRIO FINANCEIRO</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Período: {selectedInicioStr.split('-').reverse().join('/')} até {selectedFimStr.split('-').reverse().join('/')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Centro de Custo</p>
            <p className="text-lg font-bold text-neutral-900">{selectedCC?.nome ?? 'Consolidado Geral'}</p>
            <p className="text-xs text-neutral-500 mt-2">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* 1. Statistics (KPI Cards) & Charts */}
        <div className="break-inside-avoid">
           {activeSim && (
             <DashboardCharts
                categorias={categorias}
                orcamentos={filteredOrcamentos}
                realizados={filteredRealizados}
                simulacao={activeSim}
                filterInicio={filterInicio}
                filterFim={filterFim}
                hideTable={true} // We render the table separately for better control
             />
           )}
        </div>

        {/* 2. Analytical Matrix (Table) */}
        <div className="break-inside-avoid">
          <h3 className="text-lg font-bold text-white print:text-neutral-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 print:hidden" />
            Matriz Analítica Detalhada
          </h3>
          <ComparativeTable
            categorias={categorias}
            orcamentos={filteredOrcamentos}
            realizados={filteredRealizados}
            filterInicio={filterInicio}
            filterFim={filterFim}
          />
        </div>
      </div>

    </div>
  )
}
