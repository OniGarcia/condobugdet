'use client'

import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CentroCusto, GestaoCCResult, GestaoCCMes,
  GestaoCCMatrizCategoria, OrcamentoSimulacao, CategoriaTipo, StatusSemaforo,
} from '@/types'
import {
  Wallet, TrendingUp, TrendingDown, Scale, BarChart3,
  ChevronDown, ChevronRight, ChevronLeft, ArrowUpCircle, ArrowDownCircle,
  CircleDollarSign, AlertTriangle, CheckCircle2, Info, Printer, Table2, Building2, Radar,
} from 'lucide-react'
import { exportElementToPdf } from '@/lib/exportPdf'

const BRL  = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT  = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const MESES_ABR  = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const MONTH_OPTIONS: { value: string; label: string }[] = []
for (let ano = 2023; ano <= 2030; ano++) {
  for (let mes = 1; mes <= 12; mes++) {
    MONTH_OPTIONS.push({
      value: `${ano}-${String(mes).padStart(2, '0')}`,
      label: `${MESES_ABR[mes - 1]}/${ano}`,
    })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function valColor(v: number, neutral = 'text-neutral-600 dark:text-neutral-400') {
  if (v > 0) return 'text-sky-400'
  if (v < 0) return 'text-red-400'
  return neutral
}

/** Para receitas: >= 95% do alvo acumulado = bom. Para despesas: <= 105% do alvo acumulado = bom. */
function pctStatus(pct: number | null, tipo?: CategoriaTipo): 'good' | 'warn' | 'neutral' {
  if (pct === null || !tipo) return 'neutral'
  
  if (tipo === 'RECEITA') {
    return pct >= 95 ? 'good' : 'warn'
  }
  return pct <= 105 ? 'good' : 'warn'
}

function variacaoColor(variacao: number): string {
  if (variacao > 0) return 'text-sky-400'
  if (variacao < 0) return 'text-red-400'
  return 'text-neutral-600 dark:text-neutral-400 font-medium'
}

// ─── KPI Card enriquecido ─────────────────────────────────────────────────────
function KPICard({
  label, realizado, previsto, previstoAnual, projetadoAnual, metaPct, icon: Icon, tipo, isBalance,
}: {
  label: string
  realizado: number
  previsto?: number
  previstoAnual?: number
  projetadoAnual?: number
  metaPct?: number | null
  icon: React.ElementType
  tipo?: CategoriaTipo
  isBalance?: boolean
}) {
  const hasPrevisto = previstoAnual !== undefined && previstoAnual !== null
  const pctAnual = hasPrevisto && previstoAnual !== 0 ? (realizado / previstoAnual!) * 100 : null
  
  const hasProjetado = projetadoAnual !== undefined && projetadoAnual !== null
  const pctProjetado = hasPrevisto && previstoAnual !== 0 ? (projetadoAnual! / previstoAnual!) * 100 : null
  
  // Para o status e texto de execução, usamos o previsto do alvo (performance) 
  const hasPrevistoTarget = previsto !== undefined && previsto !== null
  const pctTarget = hasPrevistoTarget && previsto !== 0 ? (realizado / previsto!) * 100 : null
  const status = tipo ? pctStatus(pctTarget, tipo) : null

  const mainColor = isBalance
    ? realizado >= 0 ? 'text-sky-400' : 'text-red-400'
    : tipo === 'RECEITA' ? 'text-sky-400'
    : tipo === 'DESPESA' ? 'text-red-400'
    : realizado >= 0 ? 'text-sky-400' : 'text-red-400'

  const bgColor = isBalance
    ? realizado >= 0 ? 'bg-sky-500/5 border-sky-500/30' : 'bg-red-500/5 border-red-500/30'
    : tipo === 'RECEITA' ? 'bg-sky-500/5 border-neutral-200 dark:border-white/10'
    : tipo === 'DESPESA' ? 'bg-red-500/5 border-neutral-200 dark:border-white/10'
    : 'bg-sky-500/5 border-neutral-200 dark:border-white/10'

  const iconColor = isBalance
    ? realizado >= 0 ? 'text-sky-400' : 'text-red-400'
    : tipo === 'RECEITA' ? 'text-sky-400'
    : tipo === 'DESPESA' ? 'text-red-400'
    : 'text-sky-400'

  return (
    <div className={`flex flex-col gap-2.5 p-5 rounded-2xl border ${bgColor} backdrop-blur-xl h-full`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-xl ${isBalance ? 'bg-sky-500/10' : tipo === 'RECEITA' ? 'bg-sky-500/10' : tipo === 'DESPESA' ? 'bg-red-500/10' : 'bg-sky-500/10'} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {isBalance && (
          <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">FINAL</span>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-bold tabular-nums leading-none ${mainColor}`}>{BRL.format(realizado)}</p>

        {hasPrevisto && (
          <div className="mt-2 space-y-3">
            {/* Performance do Período (Micro View) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">Performance do Período</span>
                <span className={`text-xs font-bold ${status === 'good' ? 'text-sky-400' : 'text-amber-400'}`}>
                  {pctTarget !== null ? PCT.format(pctTarget) : '0'}%
                </span>
              </div>
              <div className="relative w-full h-1.5 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-all ${status === 'good' ? 'bg-sky-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(pctTarget ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-neutral-500 font-medium">
                <span>Meta: {BRL.format(previsto!)}</span>
                <span>Realizado: {BRL.format(realizado)}</span>
              </div>
            </div>

            {pctAnual !== null && (
              <div className="pt-2 border-t border-white/5 space-y-3">
                {/* Barra 1: Realizado vs Orçamento Anual */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-bold">
                    <span>Progresso Anual (Execução)</span>
                    <span>{PCT.format(pctAnual)}%</span>
                  </div>
                  <div className="relative w-full h-2 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden border border-white/10 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all ${status === 'good' ? 'bg-sky-500/60' : 'bg-amber-500/60'}`}
                      style={{ width: `${Math.min(pctAnual, 100)}%` }}
                    />
                    {metaPct !== null && metaPct !== undefined && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-black dark:bg-white z-20"
                        title={`Meta acumulada no ano: ${PCT.format(metaPct)}%`}
                        style={{ left: `${Math.min(metaPct, 100)}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-200 dark:bg-white/10 rounded ${className}`} />
}

function KPICardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-12 h-4 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-32 h-6" />
      </div>
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="space-y-2">
          <div className="flex justify-between"><Skeleton className="w-24 h-2" /><Skeleton className="w-8 h-2" /></div>
          <Skeleton className="w-full h-1.5" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between"><Skeleton className="w-24 h-2" /><Skeleton className="w-8 h-2" /></div>
          <Skeleton className="w-full h-2" />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 space-y-2">
        <Skeleton className="w-48 h-4" />
        <Skeleton className="w-full h-3" />
      </div>
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="w-1/3 h-4" />
            <Skeleton className="flex-1 h-4" />
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-24 h-4" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Linha mensal expansível ──────────────────────────────────────────────────
function MesRow({ mes, temSimulacao }: { mes: GestaoCCMes; temSimulacao: boolean }) {
  const [open, setOpen] = useState(false)
  const hasMovimento = mes.entradas > 0 || mes.saidas > 0 ||
    mes.entradasPrevisto > 0 || mes.saidasPrevisto > 0
  const mesLabel = `${MESES_FULL[mes.mes - 1]}/${mes.ano}`
  const saldoPositivo = mes.saldoFinal >= 0

  return (
    <>
      <tr
        onClick={() => hasMovimento && setOpen(o => !o)}
        className={`group border-b border-white/5 transition-colors ${hasMovimento ? 'cursor-pointer hover:bg-white/[0.04]' : 'opacity-50'}`}
      >
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 shrink-0 text-neutral-600">
              {hasMovimento
                ? open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                : <span className="block" />}
            </span>
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{mesLabel}</span>
          </div>
        </td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          {mes.entradas > 0
            ? <div>
                <span className="text-sky-400 font-medium block">+ {BRL.format(mes.entradas)}</span>
                {temSimulacao && mes.entradasPrevisto > 0 && (
                  <span className="text-[10px] text-neutral-700 dark:text-neutral-400 font-bold">prev: {BRL.format(mes.entradasPrevisto)}</span>
                )}
              </div>
            : <span className="text-neutral-700 font-medium">—</span>}
        </td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          {mes.saidas > 0
            ? <div>
                <span className="text-red-400 font-medium block">− {BRL.format(mes.saidas)}</span>
                {temSimulacao && mes.saidasPrevisto > 0 && (
                  <span className="text-[10px] text-neutral-700 dark:text-neutral-400 font-bold">prev: {BRL.format(mes.saidasPrevisto)}</span>
                )}
              </div>
            : <span className="text-neutral-700 font-medium">—</span>}
        </td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          <span className={`font-medium ${valColor(mes.resultado, 'text-neutral-700 dark:text-neutral-400')}`}>
            {mes.resultado === 0 ? '—' : `${mes.resultado > 0 ? '+' : ''} ${BRL.format(mes.resultado)}`}
          </span>
          {temSimulacao && mes.resultadoPrevisto !== 0 && (
            <span className="text-[10px] text-neutral-700 dark:text-neutral-400 font-bold block">prev: {BRL.format(mes.resultadoPrevisto)}</span>
          )}
        </td>

        <td className="py-3 pl-3 pr-4 text-right">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-bold tabular-nums ${saldoPositivo ? 'bg-sky-500/10 text-sky-400' : 'bg-red-500/10 text-red-400'}`}>
            {BRL.format(mes.saldoFinal)}
          </span>
        </td>
      </tr>

      {open && hasMovimento && (
        <tr className="bg-black/20">
          <td colSpan={5} className="px-0 pb-0">
            <div className="mx-4 mb-3 mt-1 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/60 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                    <th className="text-left px-4 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Cód.</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Categoria</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Tipo</th>
                    {temSimulacao && <th className="text-right px-3 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Previsto</th>}
                    <th className="text-right px-4 py-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Realizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {mes.categorias.map(cat => (
                    <tr key={cat.categoriaId} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-2 font-mono text-neutral-800 dark:text-neutral-400 font-bold">{cat.codigoReduzido}</td>
                      <td className="px-3 py-2 text-neutral-900 dark:text-neutral-200 font-medium">{cat.categoriaNome}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${cat.tipo === 'RECEITA' ? 'bg-sky-500/10 text-sky-400' : 'bg-red-500/10 text-red-400'}`}>
                          {cat.tipo === 'RECEITA' ? '↑' : '↓'} {cat.tipo === 'RECEITA' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      {temSimulacao && (
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-400 font-medium">
                          {cat.previsto > 0 ? BRL.format(cat.previsto) : <span className="text-neutral-800 dark:text-neutral-200">—</span>}
                        </td>
                      )}
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${cat.tipo === 'RECEITA' ? 'text-sky-400' : 'text-red-400'}`}>
                        {BRL.format(cat.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-white/5">
                  <tr>
                    <td colSpan={temSimulacao ? 4 : 3} className="px-4 py-2 text-[10px] font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">
                      Resultado {mesLabel}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-bold ${valColor(mes.resultado)}`}>
                      {mes.resultado > 0 ? '+' : ''}{BRL.format(mes.resultado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Matriz Previsto vs Realizado (hierárquica, colapsável) ──────────────────
function MatrizCC({ matriz, temSimulacao }: { matriz: GestaoCCMatrizCategoria[]; temSimulacao: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (!temSimulacao) return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Previsto vs Realizado</h3>
      </div>
      <div className="flex items-center gap-3 py-8 justify-center text-neutral-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">Selecione uma simulação de orçamento nos filtros acima para comparar previsto vs realizado.</p>
      </div>
    </div>
  )

  if (matriz.length === 0) return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Previsto vs Realizado</h3>
      </div>
      <div className="flex items-center gap-3 py-8 justify-center text-neutral-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">Nenhum dado para o período selecionado.</p>
      </div>
    </div>
  )

  // Determine visible rows respecting collapsed parents
  const visibleRows: GestaoCCMatrizCategoria[] = []
  const skipAboveDepth: number[] = []
  for (const row of matriz) {
    while (skipAboveDepth.length > 0 && skipAboveDepth[skipAboveDepth.length - 1] >= row.depth) {
      skipAboveDepth.pop()
    }
    if (skipAboveDepth.length > 0) continue
    visibleRows.push(row)
    if (!expanded.has(row.categoriaId) && row.hasChildren) {
      skipAboveDepth.push(row.depth)
    }
  }

  // Resultado líquido — usando apenas raízes (depth === 0)
  const roots = matriz.filter(r => r.depth === 0)
  const sumTipo = (tipo: CategoriaTipo) => {
    const f = roots.filter(r => r.tipo === tipo)
    return {
      previsto:  f.reduce((s, r) => s + r.previsto, 0),
      realizado: f.reduce((s, r) => s + r.realizado, 0),
    }
  }
  const totRec = sumTipo('RECEITA')
  const totDes = sumTipo('DESPESA')
  const resultado = {
    previsto:  totRec.previsto  - totDes.previsto,
    realizado: totRec.realizado - totDes.realizado,
  }
  const hasResultado = roots.some(r => r.tipo === 'RECEITA') && roots.some(r => r.tipo === 'DESPESA')

  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10">
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neutral-800 dark:text-neutral-400" />
          Previsto vs Realizado — Acumulado até o Corte
        </h3>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">% = performance (100% = meta atingida). Meta = progresso anual esperado. Verde = tolerância de 5%.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider min-w-[220px]">Categoria</th>
               <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">Realizado</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">Previsto</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">Variação</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">Meta</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider">Execução</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map(row => {
              const isExpanded = expanded.has(row.categoriaId)
              const status = pctStatus(row.pct, row.tipo)
              const vColor = variacaoColor(row.variacao)

              return (
                <tr key={row.categoriaId} className="hover:bg-white/[0.03] transition-colors">
                  {/* Categoria com indentação */}
                  <td className="py-2.5 pr-4" style={{ paddingLeft: `${row.depth * 1.5 + 1}rem` }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => row.hasChildren && toggle(row.categoriaId)}
                        className={`p-0.5 rounded text-neutral-600 w-5 shrink-0 ${row.hasChildren ? 'hover:text-neutral-900 dark:text-white cursor-pointer' : 'cursor-default'}`}
                      >
                        {row.hasChildren
                          ? expanded.has(row.categoriaId)
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                          : <span className="block w-3.5 h-3.5" />}
                      </button>
                      <span className="font-mono text-xs text-neutral-800 dark:text-neutral-400 w-12 shrink-0 font-bold">{row.codigoReduzido}</span>
                      <span className={row.depth === 0 ? 'text-neutral-800 dark:text-neutral-100 font-medium' : 'text-neutral-700 dark:text-neutral-300'}>
                        {row.categoriaNome}
                      </span>
                    </div>
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${row.tipo === 'RECEITA' ? 'text-sky-400' : 'text-red-400'}`}>
                    {BRL.format(row.realizado)}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {row.previsto > 0 ? BRL.format(row.previsto) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${vColor}`}>
                    {row.variacao === 0 ? '—'
                      : `${row.variacao > 0 ? '+' : ''}${BRL.format(row.variacao)}`}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-700 dark:text-neutral-400 font-bold whitespace-nowrap">
                    {row.metaPct !== null ? `${PCT.format(row.metaPct)}%` : '—'}
                  </td>

                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                    {row.pctExecucaoAnual !== null ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold ${
                        (row.tipo === 'RECEITA' ? row.pctExecucaoAnual >= (row.metaPct ?? 0) - 0.5 : row.pctExecucaoAnual <= (row.metaPct ?? 0) + 0.5)
                          ? 'bg-sky-500/10 text-sky-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {(row.tipo === 'RECEITA' ? row.pctExecucaoAnual >= (row.metaPct ?? 0) - 0.5 : row.pctExecucaoAnual <= (row.metaPct ?? 0) + 0.5)
                          ? <CheckCircle2 className="w-3 h-3" />
                          : <AlertTriangle className="w-3 h-3" />}
                        {PCT.format(row.pctExecucaoAnual)}%
                      </span>
                    ) : <span className="text-neutral-700 dark:text-neutral-400 text-xs font-bold">—</span>}
                  </td>
                </tr>
              )
            })}

            {/* Resultado Líquido */}
            {hasResultado && (
              <tr className="bg-gradient-to-r from-sky-950/40 to-transparent border-t-2 border-white/20">
                <td className="py-3.5 pl-4 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="block w-5 shrink-0" />
                    <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">---</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-widest">Resultado Líquido</span>
                  </div>
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(resultado.realizado)}`}>
                  {BRL.format(resultado.realizado)}
                </td>

                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(resultado.previsto)}`}>
                  {BRL.format(resultado.previsto)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${variacaoColor(resultado.realizado - resultado.previsto)}`}>
                  {resultado.realizado - resultado.previsto === 0 ? '—'
                    : `${resultado.realizado - resultado.previsto > 0 ? '+' : ''}${BRL.format(resultado.realizado - resultado.previsto)}`}
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right font-bold text-neutral-500">
                  {/* Somente valor conforme solicitado - variação já mostrada na coluna ao lado */}
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Helpers de semáforo ─────────────────────────────────────────────────────
function saldoColorClass(status: StatusSemaforo): string {
  switch (status) {
    case 'VERDE':    return 'text-sky-400'
    case 'AMARELO':  return 'text-amber-400'
    case 'VERMELHO': return 'text-red-400'
  }
}

function saldoBgClass(status: StatusSemaforo): string {
  switch (status) {
    case 'VERDE':    return 'bg-sky-500/10'
    case 'AMARELO':  return 'bg-amber-500/10'
    case 'VERMELHO': return 'bg-red-500/10'
  }
}

// ─── Matriz Analítica Detalhada (somente acumulado) ──────────────────────────
function MatrizAnalitica({ matriz, temSimulacao, periodoLabel }: {
  matriz: GestaoCCMatrizCategoria[]
  temSimulacao: boolean
  periodoLabel: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (!temSimulacao) return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <Table2 className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Matriz Analítica Detalhada</h3>
      </div>
      <div className="flex items-center gap-3 py-8 justify-center text-neutral-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">Selecione uma simulação de orçamento nos filtros acima para visualizar a matriz analítica.</p>
      </div>
    </div>
  )

  if (matriz.length === 0) return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <Table2 className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Matriz Analítica Detalhada</h3>
      </div>
      <div className="flex items-center gap-3 py-8 justify-center text-neutral-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">Nenhum dado para o período selecionado.</p>
      </div>
    </div>
  )

  // Visible rows respecting collapsed
  const visibleRows: GestaoCCMatrizCategoria[] = []
  const skipAboveDepth: number[] = []
  for (const row of matriz) {
    while (skipAboveDepth.length > 0 && skipAboveDepth[skipAboveDepth.length - 1] >= row.depth) {
      skipAboveDepth.pop()
    }
    if (skipAboveDepth.length > 0) continue
    visibleRows.push(row)
    if (!expanded.has(row.categoriaId) && row.hasChildren) {
      skipAboveDepth.push(row.depth)
    }
  }

  // Resultado líquido
  const roots = matriz.filter(r => r.depth === 0)
  const sumTipo = (tipo: CategoriaTipo) => {
    const f = roots.filter(r => r.tipo === tipo)
    return {
      previsto:  f.reduce((s, r) => s + r.previsto, 0),
      realizado: f.reduce((s, r) => s + r.realizado, 0),
      orcAnual:  f.reduce((s, r) => s + r.orcamentoAnualTotal, 0),
      projAnual: f.reduce((s, r) => s + r.projetadoAnual, 0),
      saldoAno:  f.reduce((s, r) => s + r.saldoDisponivelAno, 0),
    }
  }
  const totRec = sumTipo('RECEITA')
  const totDes = sumTipo('DESPESA')
  const res = {
    previsto:  totRec.previsto  - totDes.previsto,
    realizado: totRec.realizado - totDes.realizado,
    orcAnual:  totRec.orcAnual  - totDes.orcAnual,
    projAnual: totRec.projAnual - totDes.projAnual,
    saldoAno:  totRec.saldoAno  - totDes.saldoAno,
  }
  const hasResultado = roots.some(r => r.tipo === 'RECEITA') && roots.some(r => r.tipo === 'DESPESA')

  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Table2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          Matriz Analítica Detalhada — Valores Acumulados e Forecasting
        </h3>
        <p className="text-xs text-neutral-700 dark:text-neutral-400 mt-0.5 font-bold">
          Acumulado: {periodoLabel} · Proj. Anual (EAC) = Realizado Acum. + Projetado Futuro · Saldo Ano = Proj. Anual − Orç. Anual
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider min-w-[220px]">Categoria</th>
               <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Realizado Acum.</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Previsto Acum.</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Orç. Anual</th>
              <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Proj. Anual</th>
              <th className="text-right px-4 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  Saldo Sugerido
                  <span title="Projetado Anual (EAC) − Orçamento Anual" className="cursor-help">
                    <Info className="w-3.5 h-3.5 text-neutral-600" />
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map(row => {
              const isExpanded = expanded.has(row.categoriaId)
              const colorClass = saldoColorClass(row.statusSemaforoAno)
              const bgClass = saldoBgClass(row.statusSemaforoAno)
              const pctSaldo = row.orcamentoAnualTotal !== 0
                ? row.saldoDisponivelAno / row.orcamentoAnualTotal
                : null

              return (
                <tr key={row.categoriaId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-2.5 pr-4" style={{ paddingLeft: `${row.depth * 1.5 + 1}rem` }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => row.hasChildren && toggle(row.categoriaId)}
                        className={`p-0.5 rounded text-neutral-600 w-5 shrink-0 ${row.hasChildren ? 'hover:text-neutral-900 dark:text-white cursor-pointer' : 'cursor-default'}`}
                      >
                        {row.hasChildren
                          ? expanded.has(row.categoriaId)
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                          : <span className="block w-3.5 h-3.5" />}
                      </button>
                      <span className="font-mono text-xs text-neutral-800 dark:text-neutral-400 w-12 shrink-0 font-bold">{row.codigoReduzido}</span>
                      <span className={row.depth === 0 ? 'text-neutral-800 dark:text-neutral-100 font-medium' : 'text-neutral-700 dark:text-neutral-300'}>
                        {row.categoriaNome}
                      </span>
                    </div>
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${row.tipo === 'RECEITA' ? 'text-sky-400' : 'text-red-400'}`}>
                    {BRL.format(row.realizado)}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {row.previsto > 0 ? BRL.format(row.previsto) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {row.orcamentoAnualTotal > 0 ? BRL.format(row.orcamentoAnualTotal) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-800 dark:text-neutral-100 font-bold whitespace-nowrap">
                    {row.projetadoAnual > 0 ? BRL.format(row.projetadoAnual) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className="py-2.5 pl-3 pr-4 text-right tabular-nums whitespace-nowrap">
                    <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded font-bold ${colorClass} ${bgClass}`}>
                      {BRL.format(row.saldoDisponivelAno)}
                      {pctSaldo !== null && (
                        <span className="text-xs font-normal opacity-60">
                          {PCT.format(pctSaldo * 100)}%
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}

            {/* Resultado Líquido */}
            {hasResultado && (
              <tr className="bg-gradient-to-r from-sky-950/40 to-transparent border-t-2 border-white/20">
                <td className="py-3.5 pl-4 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="block w-5 shrink-0" />
                    <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">---</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-widest">Resultado Líquido</span>
                  </div>
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.realizado)}`}>
                  {BRL.format(res.realizado)}
                </td>

                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.previsto)}`}>
                  {BRL.format(res.previsto)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.orcAnual)}`}>
                  {BRL.format(res.orcAnual)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.projAnual)}`}>
                  {BRL.format(res.projAnual)}
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right tabular-nums whitespace-nowrap">
                  <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded font-bold ${
                    res.saldoAno >= 0 ? 'text-sky-400 bg-sky-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {BRL.format(res.saldoAno)}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────
interface GestaoCCViewProps {
  centrosCusto: CentroCusto[]
  simulacoes: OrcamentoSimulacao[]
  selectedCCId: string
  selectedSimId: string
  filterInicio: { ano: number; mes: number }
  filterFim: { ano: number; mes: number }
  cutoffAno: number
  cutoffMes: number
  gestaoDados: GestaoCCResult | null
  condoNome: string | null
}

export function GestaoCCView({
  centrosCusto, simulacoes,
  selectedCCId, selectedSimId,
  filterInicio, filterFim,
  cutoffAno, cutoffMes,
  gestaoDados,
  condoNome,
}: GestaoCCViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [isFilterExpanded, setIsFilterExpanded] = useState(true)

  // Persistência do estado de expansão
  useEffect(() => {
    const saved = localStorage.getItem('dashboardFilterExpanded')
    if (saved !== null) {
      setIsFilterExpanded(saved === 'true')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('dashboardFilterExpanded', String(isFilterExpanded))
  }, [isFilterExpanded])

  const handleExportPdf = useCallback(async () => {
    if (!printRef.current || exporting) return
    setExporting(true)
    try {
      const ccName = gestaoDados?.centroCustoNome ?? 'gestao-cc'
      const safe = ccName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      await exportElementToPdf(printRef.current, {
        filename: `gestao_${safe}.pdf`,
      })
    } finally {
      setExporting(false)
    }
  }, [gestaoDados, exporting])

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      v === undefined ? params.delete(k) : params.set(k, v)
    }
    return `/dashboard?${params.toString()}`
  }

  const activeSim = simulacoes.find(s => s.id === selectedSimId)

  const handleCutoffChange = (ano: number, mes: number) => {
    startTransition(() => {
      router.push(buildUrl({ cutoff: `${ano}-${String(mes).padStart(2, '0')}` }))
    })
  }

  const periodMonths: { ano: number; mes: number }[] = []
  if (activeSim) {
    let curr = new Date(activeSim.ano_inicio, activeSim.mes_inicio - 1, 1)
    const end = new Date(activeSim.ano_fim, activeSim.mes_fim - 1, 1)
    while (curr <= end) {
      periodMonths.push({ ano: curr.getFullYear(), mes: curr.getMonth() + 1 })
      curr.setMonth(curr.getMonth() + 1)
    }
  } else {
    // Fallback se não houver simulação (opções genéricas ao redor do atual)
    const now = new Date()
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      periodMonths.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 })
    }
  }

  const moveCutoff = (delta: number) => {
    const idx = periodMonths.findIndex(m => m.ano === cutoffAno && m.mes === cutoffMes)
    if (idx === -1) return
    const next = periodMonths[idx + delta]
    if (next) handleCutoffChange(next.ano, next.mes)
  }

  const cutoffStr = `${cutoffAno}-${String(cutoffMes).padStart(2, '0')}`

  const periodoLabel = gestaoDados
    ? `${MESES_FULL[gestaoDados.periodo.mesInicio - 1]}/${gestaoDados.periodo.anoInicio} → ${MESES_FULL[gestaoDados.periodo.mesFim - 1]}/${gestaoDados.periodo.anoFim}`
    : ''

  const temSim = gestaoDados?.temSimulacao ?? false

  return (
    <div className="flex flex-col gap-8 relative">
      {/* ── Barra de Progresso Superior (GitHub/YouTube style) ── */}
      {isPending && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[9999] overflow-hidden bg-sky-500/20">
          <div className="h-full bg-sky-500 w-[40%] animate-[loading-bar_1.5s_infinite_linear]" />
          <style jsx>{`
            @keyframes loading-bar {
              0% { transform: translateX(-100%); width: 30%; }
              50% { width: 60%; }
              100% { transform: translateX(350%); width: 30%; }
            }
          `}</style>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Gestão por Centro de Custo</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Extrato de caixa mensal e análise orçamentária por centro de custo.</p>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting || !gestaoDados}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-neutral-900 dark:text-white font-medium rounded-xl transition-all shadow-lg shadow-sky-500/20 text-sm shrink-0 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
          {exporting ? 'Gerando...' : 'Gerar PDF'}
        </button>
      </div>

      {/* ── Filtros (4 colunas) ─────────────────────────────────────────────── */}
      {/* ── Filtros Colapsáveis ─────────────────────────────────────────────── */}
      <div className={`relative z-[45] bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-visible backdrop-blur-xl`}>
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
            {isFilterExpanded ? <ChevronDown className="w-4 h-4 text-sky-500" /> : <ChevronRight className="w-4 h-4 text-sky-500" />}
            Configurações
          </div>
          <div className="text-xs text-neutral-400 font-normal">
            {gestaoDados?.centroCustoNome ?? 'Selecione um CC'} · {temSim ? (simulacoes.find(s => s.id === selectedSimId)?.nome ?? 'Sem orçamento') : 'Sem orçamento'}
          </div>
        </button>

        {isFilterExpanded && (
          <div className="no-print flex flex-wrap items-end gap-6 px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-white/5">
            {/* Simulação */}
            <div className="space-y-1.5 flex-1 min-w-[240px]">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
                Orçamento Previsto
              </label>
              <div className="relative">
                <select value={selectedSimId} onChange={e => {
                    const sim = simulacoes.find(s => s.id === e.target.value)
                    const updates: Record<string, string | undefined> = { sim: e.target.value || undefined }
                    if (sim) {
                      if (sim.centro_custo_id) updates.cc = sim.centro_custo_id
                    }
                    startTransition(() => {
                      router.push(buildUrl(updates))
                    })
                  }}
                  className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-xl px-4 py-2 text-sm appearance-none focus:ring-2 focus:ring-sky-500 outline-none transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10">
                  <option value="" className="bg-white dark:bg-neutral-950">Sem orçamento</option>
                  {simulacoes.map(s => <option key={s.id} value={s.id} className="bg-white dark:bg-neutral-950">{s.nome}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              </div>
            </div>

            {/* Corte do Realizado */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Corte do Realizado</label>
              <div className="flex items-center gap-2 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-1.5">
                <button
                  onClick={() => moveCutoff(-1)}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors text-neutral-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={cutoffStr}
                  onChange={e => {
                    const [a, m] = e.target.value.split('-').map(Number)
                    handleCutoffChange(a, m)
                  }}
                  className="bg-transparent text-sm font-bold text-sky-600 dark:text-sky-400 outline-none cursor-pointer text-center appearance-none px-2"
                >
                  {periodMonths.map(({ ano, mes }) => (
                    <option
                      key={`${ano}-${mes}`}
                      value={`${ano}-${String(mes).padStart(2, '0')}`}
                      className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white"
                    >
                      {MESES_ABR[mes - 1]}/{ano}
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
        )}
      </div>

      {/* ── Banner do Condomínio ──────────────────────────────────────────── */}
      {condoNome && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl backdrop-blur-xl">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Condomínio</p>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white truncate leading-tight">{condoNome}</h2>
          </div>
          {gestaoDados && (
            <span className="shrink-0 text-xs text-neutral-500 bg-neutral-100 dark:bg-white/10 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10 font-medium">
              {periodoLabel}
            </span>
          )}
        </div>
      )}

      {!gestaoDados && (
        <div className="text-center py-20 text-neutral-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione um Centro de Custo para visualizar a gestão financeira.</p>
        </div>
      )}

      {gestaoDados && (
        <div ref={printRef} className={`flex flex-col gap-8 transition-all duration-500 ${isPending ? 'opacity-40 blur-[1px]' : 'opacity-100 blur-0'}`}>
          {/* ── Header do CC (Printable) ─────────────────────────────────────────── */}
          <div className="px-1 flex flex-col gap-1">
            {condoNome && (
              <p className="text-[10px] font-bold text-sky-500 uppercase tracking-[0.2em] mb-0.5">{condoNome}</p>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-4 text-sky-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">{gestaoDados.centroCustoNome}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">{periodoLabel}</p>
              </div>
            </div>
          </div>

          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {isPending ? (
              <>
                <KPICardSkeleton />
                <KPICardSkeleton />
                <KPICardSkeleton />
              </>
            ) : (
              <>
                <KPICard
                  label="Total Entradas"
                  realizado={gestaoDados.totalEntradas}
                  previsto={temSim ? gestaoDados.totalEntradasPrevisto : undefined}
                  previstoAnual={temSim ? gestaoDados.totalEntradasPrevistoAnual : undefined}
                  projetadoAnual={temSim ? gestaoDados.totalEntradasProjetadoAnual : undefined}
                  metaPct={temSim ? gestaoDados.totalMetaEntradasPct : undefined}
                  icon={ArrowUpCircle}
                  tipo="RECEITA"
                />
                <KPICard
                  label="Total Saídas"
                  realizado={gestaoDados.totalSaidas}
                  previsto={temSim ? gestaoDados.totalSaidasPrevisto : undefined}
                  previstoAnual={temSim ? gestaoDados.totalSaidasPrevistoAnual : undefined}
                  projetadoAnual={temSim ? gestaoDados.totalSaidasProjetadoAnual : undefined}
                  metaPct={temSim ? gestaoDados.totalMetaSaidasPct : undefined}
                  icon={ArrowDownCircle}
                  tipo="DESPESA"
                />
                <KPICard
                  label="Resultado"
                  realizado={gestaoDados.resultado}
                  previsto={temSim ? gestaoDados.resultadoPrevisto : undefined}
                  previstoAnual={temSim ? gestaoDados.resultadoPrevistoAnual : undefined}
                  projetadoAnual={temSim ? gestaoDados.resultadoProjetadoAnual : undefined}
                  icon={Scale}
                  isBalance
                />
              </>
            )}
          </div>

           {/* ── Matriz Analítica Detalhada ─────────────────────────────── */}
          {isPending ? <TableSkeleton /> : <MatrizAnalitica matriz={gestaoDados.matriz} temSimulacao={temSim} periodoLabel={periodoLabel} />}

          {/* ── Matriz Previsto vs Realizado ─────────────────────────────── */}
          {isPending ? <TableSkeleton /> : <MatrizCC matriz={gestaoDados.matriz} temSimulacao={temSim} />}

          {/* ── Extrato Mensal ────────────────────────────────────────────── */}
          {isPending ? <TableSkeleton /> : (
            <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="px-4 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Extrato de Caixa Mensal</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Clique em um mês para ver o detalhamento por categoria</p>
              </div>
              <span className="text-xs text-neutral-600 bg-white/60 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10">
                {gestaoDados.meses.length} meses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-white/10 bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider min-w-[160px]">Mês</th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-sky-600 uppercase tracking-wider whitespace-nowrap">↑ Entradas</th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-red-600 uppercase tracking-wider whitespace-nowrap">↓ Saídas</th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-neutral-700 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Resultado</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider whitespace-nowrap">Resultado Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {gestaoDados.meses.map(mes => (
                    <MesRow key={`${mes.ano}-${mes.mes}`} mes={mes} temSimulacao={temSim} />
                  ))}
                  <tr className="border-t-2 border-white/20 bg-gradient-to-r from-sky-950/40 to-transparent">
                    <td className="px-4 py-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">◆ Total do Período</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-sm font-bold text-sky-400">+ {BRL.format(gestaoDados.totalEntradas)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-sm font-bold text-red-400">− {BRL.format(gestaoDados.totalSaidas)}</td>
                    <td className={`px-3 py-3.5 text-right tabular-nums text-sm font-bold ${gestaoDados.resultado >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                      {gestaoDados.resultado > 0 ? '+' : ''}{BRL.format(gestaoDados.resultado)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${
                        gestaoDados.saldoFinal >= 0
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'bg-red-500/15 text-red-300 border border-red-500/30'
                      }`}>
                        {BRL.format(gestaoDados.saldoFinal)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}



          {/* ── Despesas Acima do Orçamento & Não Previstas ──────────────── */}
          {temSim && (() => {
            const leaves = gestaoDados.matriz.filter(r => !r.hasChildren && r.tipo === 'DESPESA')

            // Radar de Riscos (EAC): Categorias onde a projeção anual ultrapassa o orçamento anual total
            const riscosEAC = leaves
              .filter(r => r.orcamentoAnualTotal > 0 && r.projetadoAnual > r.orcamentoAnualTotal)
              .map(r => {
                const estouroAnual = r.projetadoAnual - r.orcamentoAnualTotal
                return { ...r, estouroAnual }
              })
              .sort((a, b) => b.estouroAnual - a.estouroAnual)
              .slice(0, 5)

            // Não previstas: previsto === 0 e realizado > 500
            const naoPrevistas = leaves
              .filter(r => r.previsto === 0 && r.realizado > 500)
              .sort((a, b) => b.realizado - a.realizado)
              .slice(0, 5)

            if (isPending) return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TableSkeleton />
                <TableSkeleton />
              </div>
            )

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Acima do Orçamento */}
                <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Radar className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white text-pretty">Radar de Riscos (EAC)</h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium italic">Projeção anual acima do orçamento total (Top 5)</p>
                    </div>
                  </div>

                  {riscosEAC.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-neutral-500">
                      <CheckCircle2 className="w-4 h-4 text-sky-500" />
                      <p className="text-sm">Nenhum risco de estouro anual detectado.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {riscosEAC.map((item, i) => {
                        const pctExcessoAnual = ((item.projetadoAnual / item.orcamentoAnualTotal) - 1) * 100
                        const maxEstouro = riscosEAC[0].estouroAnual
                        const barW = maxEstouro > 0 ? (item.estouroAnual / maxEstouro) * 100 : 0

                        return (
                          <div key={item.categoriaId} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono text-neutral-600 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate font-bold">{item.categoriaNome}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <span className="text-xs text-amber-500 font-bold">+{PCT.format(pctExcessoAnual)}%</span>
                                <span className="text-sm font-bold text-amber-500 tabular-nums" title="Estouro Anual Estimado">{BRL.format(item.estouroAnual)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                <div
                                  className="h-full bg-amber-500 relative rounded-full transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                                  style={{ width: `${barW}%` }}
                                >
                                  {/* Padrão listrado para indicar estimativa (Storytelling) */}
                                  <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.5)_8px,rgba(0,0,0,0.5)_16px)]" />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[10px] text-neutral-600">Orç. Anual: {BRL.format(item.orcamentoAnualTotal)}</span>
                              <span className="text-[10px] text-red-400 font-bold">Proj. Anual: {BRL.format(item.projetadoAnual)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Despesas Não Previstas */}
                <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                      <CircleDollarSign className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white text-pretty">Despesas Não Previstas ({">"} R$ 500,00)</h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium italic">Gastos extras significativos identificados no período</p>
                    </div>
                  </div>

                  {naoPrevistas.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-neutral-500">
                      <CheckCircle2 className="w-4 h-4 text-sky-500" />
                      <p className="text-sm">Nenhuma despesa não prevista no período.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {naoPrevistas.map((item, i) => {
                        const maxVal = naoPrevistas[0].realizado
                        const barW = maxVal > 0 ? (item.realizado / maxVal) * 100 : 0

                        return (
                          <div key={item.categoriaId} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono text-neutral-600 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate font-medium">{item.categoriaNome}</span>
                              </div>
                              <span className="text-sm font-bold text-rose-500 tabular-nums shrink-0 ml-3">{BRL.format(item.realizado)}</span>
                            </div>
                            <div className="h-1.5 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden border border-white/5">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all shadow-[0_0_8px_rgba(244,63,94,0.2)]"
                                style={{ width: `${barW}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
