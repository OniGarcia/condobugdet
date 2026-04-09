'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { BarChart2, TableProperties, ChevronLeft, ChevronRight } from 'lucide-react'
import { Categoria, OrcamentoSimulacao, OrcamentoPrevisto, DadosRealizados, FluxoProjetado } from '@/types'
import { ForecastGrid } from './ForecastGrid'
import { ForecastCharts } from './ForecastCharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  categorias: Categoria[]
  simulacao: OrcamentoSimulacao
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
  orcamentos,
  realizados,
  projetados,
  cutoffAno,
  cutoffMes,
  canEdit,
}: Props) {
  const [activeTab, setActiveTab] = useState<'tabela' | 'graficos'>('tabela')
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

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* ── Control Bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">

        {/* Cutoff Selector */}
        <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">
            Realizado até:
          </span>
          <button
            onClick={() => moveCutoff(-1)}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={`${localCutoffAno}-${String(localCutoffMes).padStart(2, '0')}`}
            onChange={e => {
              const [a, m] = e.target.value.split('-').map(Number)
              handleCutoffChange(a, m)
            }}
            className="bg-transparent text-sm font-semibold text-sky-600 dark:text-sky-400 outline-none cursor-pointer"
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
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend Chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            Realizado
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Projetado (editável)
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20 font-medium">
            <span className="w-2 h-2 rounded-full bg-neutral-400 inline-block" />
            Orçado (referência)
          </span>
        </div>

        {/* Tab Toggle */}
        <div className="ml-auto flex bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('tabela')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tabela'
                ? 'bg-sky-800 text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            Tabela
          </button>
          <button
            onClick={() => setActiveTab('graficos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'graficos'
                ? 'bg-sky-800 text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Gráficos
          </button>
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
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
          <div className="overflow-y-auto h-full pr-1">
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
