'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  BarChart2, TableProperties, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Building2,
} from 'lucide-react'
import { Categoria, OrcamentoSimulacao, OrcamentoPrevisto, DadosRealizados, FluxoProjetado } from '@/types'
import { ForecastGrid } from './ForecastGrid'
import { ForecastCharts } from './ForecastCharts'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  categorias: Categoria[]
  simulacao: OrcamentoSimulacao
  simulacoes: OrcamentoSimulacao[]
  selectedSimId: string
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  projetados: FluxoProjetado[]
  cutoffAno: number
  cutoffMes: number
  canEdit: boolean
}

const MESES_NOME = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── Main Shell ───────────────────────────────────────────────────────────────
export function ForecastPage({
  categorias,
  simulacao,
  simulacoes,
  selectedSimId,
  orcamentos,
  realizados,
  projetados,
  cutoffAno,
  cutoffMes,
  canEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<'tabela' | 'graficos'>('tabela')
  const [isFilterExpanded, setIsFilterExpanded] = useState(true)
  const [localCutoffAno, setLocalCutoffAno] = useState(cutoffAno)
  const [localCutoffMes, setLocalCutoffMes] = useState(cutoffMes)

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Build list of months in the simulation period
  const periodMonths: { ano: number; mes: number }[] = []
  let cur = { ano: simulacao.ano_inicio, mes: simulacao.mes_inicio }
  let guard = 0
  while (
    (cur.ano < simulacao.ano_fim || (cur.ano === simulacao.ano_fim && cur.mes <= simulacao.mes_fim)) &&
    guard < 60
  ) {
    periodMonths.push({ ...cur })
    cur = { ...cur, mes: cur.mes + 1 }
    if (cur.mes > 12) { cur.mes = 1; cur.ano++ }
    guard++
  }

  const handleCutoffChange = (ano: number, mes: number) => {
    setLocalCutoffAno(ano)
    setLocalCutoffMes(mes)
    const params = new URLSearchParams(searchParams.toString())
    params.set('cutoff', `${ano}-${String(mes).padStart(2, '0')}`)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const moveCutoff = (direction: 1 | -1) => {
    let newMes = localCutoffMes + direction
    let newAno = localCutoffAno
    if (newMes > 12) { newMes = 1; newAno++ }
    if (newMes < 1) { newMes = 12; newAno-- }
    const afterStart = newAno > simulacao.ano_inicio || (newAno === simulacao.ano_inicio && newMes >= simulacao.mes_inicio)
    const beforeEnd = newAno < simulacao.ano_fim || (newAno === simulacao.ano_fim && newMes <= simulacao.mes_fim)
    if (afterStart && beforeEnd) handleCutoffChange(newAno, newMes)
  }

  // Persistência do estado de expansão
  useEffect(() => {
    const saved = localStorage.getItem('forecastFilterExpanded')
    if (saved !== null) {
      setIsFilterExpanded(saved === 'true')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('forecastFilterExpanded', String(isFilterExpanded))
  }, [isFilterExpanded])

  // Persistência da última simulação selecionada
  useEffect(() => {
    if (selectedSimId) {
      localStorage.setItem('lastForecastSimId', selectedSimId)
    }
  }, [selectedSimId])

  // Restauração da última simulação se não houver parâmetro na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (!urlParams.has('simulacao')) {
      const savedId = localStorage.getItem('lastForecastSimId')
      if (savedId && savedId !== selectedSimId && simulacoes.find(s => s.id === savedId)) {
        router.push(`/forecast?simulacao=${savedId}`)
      }
    }
  }, [router, selectedSimId, simulacoes])

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ─── HEADER AREA ─── */}
      <div className="shrink-0">
        {/* Title row + tab toggle */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Fluxo Projetado
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Combine o realizado com projeções futuras para estimar o resultado.
            </p>
          </div>

          {/* View toggle */}
          <div className="flex bg-neutral-200/50 dark:bg-white/5 rounded-lg p-1 gap-1 self-start">
            <button
              onClick={() => setActiveTab('tabela')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                activeTab === 'tabela'
                  ? 'bg-white dark:bg-[#1a1a1a] text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <TableProperties className="w-4 h-4" />
              Tabela
            </button>
            <button
              onClick={() => setActiveTab('graficos')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all',
                activeTab === 'graficos'
                  ? 'bg-white dark:bg-[#1a1a1a] text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <BarChart2 className="w-4 h-4" />
              Gráficos
            </button>
          </div>
        </div>

        {/* Collapsible filter row */}
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl mb-4 overflow-hidden">
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
              {isFilterExpanded ? <ChevronUp className="w-4 h-4 text-sky-500" /> : <ChevronDown className="w-4 h-4 text-sky-500" />}
              Configurações
            </span>
            <span className="text-xs text-neutral-400 font-normal">
              {simulacao.nome} · Corte: {MESES_NOME[localCutoffMes - 1]}/{localCutoffAno}
            </span>
          </button>

          {isFilterExpanded && (
            <div className="px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-white/5">
              <div className="flex flex-wrap items-end gap-6">
                {/* Simulation selector */}
                {simulacoes.length > 0 && (
                  <div className="flex-1 min-w-60">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Simulação Híbrida</label>
                    <SimulationSelector
                      simulacoes={simulacoes}
                      selectedId={selectedSimId}
                      targetPath="/forecast"
                    />
                  </div>
                )}

                {/* CC badge */}
                {simulacao.centro_custo_nome && (
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Centro de Custo</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs text-sky-400 font-medium">{simulacao.centro_custo_nome}</span>
                    </div>
                  </div>
                )}

                {/* Cutoff selector */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Corte do Realizado</label>
                  <div className="flex items-center gap-2 bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2">
                    <button
                      onClick={() => moveCutoff(-1)}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <select
                      value={`${localCutoffAno}-${String(localCutoffMes).padStart(2, '0')}`}
                      onChange={e => {
                        const [a, m] = e.target.value.split('-').map(Number)
                        handleCutoffChange(a, m)
                      }}
                      className="bg-transparent text-sm font-bold text-sky-600 dark:text-sky-400 outline-none cursor-pointer text-center"
                    >
                      {periodMonths.map(({ ano, mes }) => (
                        <option
                          key={`${ano}-${mes}`}
                          value={`${ano}-${String(mes).padStart(2, '0')}`}
                          className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white"
                        >
                          {MESES_NOME[mes - 1]}/{ano}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => moveCutoff(1)}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend bar */}
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl mb-4 px-5 py-3 flex items-center gap-4">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Legenda:</span>
          <span className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium text-sky-700 dark:text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            Realizado
          </span>
          <span className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Projetado (editável)
          </span>
          <span className="flex items-center gap-2 px-2 py-1 rounded text-xs font-medium text-neutral-600 dark:text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-neutral-400" />
            Orçado (referência)
          </span>
        </div>
      </div>

      {/* ─── TABLE / CHARTS AREA ─── */}
      <div className="flex-1 bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'tabela' ? (
          <ForecastGrid
            categorias={categorias}
            simulacao={simulacao}
            orcamentos={orcamentos}
            realizados={realizados}
            projetados={projetados}
            cutoffAno={localCutoffAno}
            cutoffMes={localCutoffMes}
            canEdit={canEdit}
          />
        ) : (
          <div className="overflow-auto h-full">
            <ForecastCharts
              categorias={categorias}
              simulacao={simulacao}
              orcamentos={orcamentos}
              realizados={realizados}
              projetados={projetados}
              cutoffAno={localCutoffAno}
              cutoffMes={localCutoffMes}
            />
          </div>
        )}
      </div>
    </div>
  )
}
