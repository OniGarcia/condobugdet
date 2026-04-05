'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CentroCusto, GestaoCCResult, GestaoCCMes,
  GestaoCCMatrizCategoria, OrcamentoSimulacao, CategoriaTipo, StatusSemaforo,
} from '@/types'
import {
  Wallet, TrendingUp, TrendingDown, Scale, BarChart3,
  ChevronDown, ChevronRight, ArrowUpCircle, ArrowDownCircle,
  CircleDollarSign, AlertTriangle, CheckCircle2, Info, Printer, Table2,
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
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-red-400'
  return neutral
}

/** Para receitas: > 100% = bom; Para despesas: < 100% = bom */
function pctStatus(pct: number | null, tipo: CategoriaTipo): 'good' | 'warn' | 'neutral' {
  if (pct === null) return 'neutral'
  if (tipo === 'RECEITA') return pct >= 100 ? 'good' : pct >= 80 ? 'warn' : 'warn'
  return pct <= 100 ? 'good' : 'warn'
}

function variacaoColor(variacao: number): string {
  if (variacao > 0) return 'text-emerald-400'
  if (variacao < 0) return 'text-red-400'
  return 'text-neutral-500'
}

// ─── KPI Card enriquecido ─────────────────────────────────────────────────────
function KPICard({
  label, realizado, previsto, icon: Icon, tipo, isBalance,
}: {
  label: string
  realizado: number
  previsto?: number
  icon: React.ElementType
  tipo?: CategoriaTipo
  isBalance?: boolean
}) {
  const hasPrevisto = previsto !== undefined && previsto !== null
  const pct = hasPrevisto && previsto !== 0 ? (realizado / previsto) * 100 : null
  const status = tipo ? pctStatus(pct, tipo) : null

  const mainColor = isBalance
    ? realizado >= 0 ? 'text-emerald-400' : 'text-red-400'
    : tipo === 'RECEITA' ? 'text-emerald-400'
    : tipo === 'DESPESA' ? 'text-red-400'
    : realizado >= 0 ? 'text-emerald-400' : 'text-red-400'

  const bgColor = isBalance
    ? realizado >= 0 ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-red-500/5 border-red-500/30'
    : tipo === 'RECEITA' ? 'bg-emerald-500/5 border-neutral-200 dark:border-white/10'
    : tipo === 'DESPESA' ? 'bg-red-500/5 border-neutral-200 dark:border-white/10'
    : 'bg-sky-500/5 border-neutral-200 dark:border-white/10'

  const iconColor = isBalance
    ? realizado >= 0 ? 'text-emerald-400' : 'text-red-400'
    : tipo === 'RECEITA' ? 'text-emerald-400'
    : tipo === 'DESPESA' ? 'text-red-400'
    : 'text-sky-400'

  return (
    <div className={`flex flex-col gap-2.5 p-5 rounded-2xl border ${bgColor} backdrop-blur-xl h-full`}>
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-xl ${isBalance ? 'bg-emerald-500/10' : tipo === 'RECEITA' ? 'bg-emerald-500/10' : tipo === 'DESPESA' ? 'bg-red-500/10' : 'bg-sky-500/10'} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {isBalance && (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">FINAL</span>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-bold tabular-nums leading-none ${mainColor}`}>{BRL.format(realizado)}</p>

        {hasPrevisto && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">Previsto:</span>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">{BRL.format(previsto!)}</span>
            </div>
            {pct !== null && (
              <>
                {/* Barra de progresso */}
                <div className="w-full h-1 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${status === 'good' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">Execução</span>
                  <span className={`text-xs font-bold ${status === 'good' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {PCT.format(pct)}%
                  </span>
                </div>
              </>
            )}
          </div>
        )}
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

        <td className="py-3 px-3 text-right tabular-nums text-sm text-neutral-600 dark:text-neutral-400">{BRL.format(mes.saldoInicial)}</td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          {mes.entradas > 0
            ? <div>
                <span className="text-emerald-400 font-medium block">+ {BRL.format(mes.entradas)}</span>
                {temSimulacao && mes.entradasPrevisto > 0 && (
                  <span className="text-[10px] text-neutral-600">prev: {BRL.format(mes.entradasPrevisto)}</span>
                )}
              </div>
            : <span className="text-neutral-600">—</span>}
        </td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          {mes.saidas > 0
            ? <div>
                <span className="text-red-400 font-medium block">− {BRL.format(mes.saidas)}</span>
                {temSimulacao && mes.saidasPrevisto > 0 && (
                  <span className="text-[10px] text-neutral-600">prev: {BRL.format(mes.saidasPrevisto)}</span>
                )}
              </div>
            : <span className="text-neutral-600">—</span>}
        </td>

        <td className="py-3 px-3 text-right tabular-nums text-sm">
          <span className={`font-medium ${valColor(mes.resultado, 'text-neutral-600')}`}>
            {mes.resultado === 0 ? '—' : `${mes.resultado > 0 ? '+' : ''} ${BRL.format(mes.resultado)}`}
          </span>
          {temSimulacao && mes.resultadoPrevisto !== 0 && (
            <span className="text-[10px] text-neutral-600 block">prev: {BRL.format(mes.resultadoPrevisto)}</span>
          )}
        </td>

        <td className="py-3 pl-3 pr-4 text-right">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-bold tabular-nums ${saldoPositivo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {BRL.format(mes.saldoFinal)}
          </span>
        </td>
      </tr>

      {open && hasMovimento && (
        <tr className="bg-black/20">
          <td colSpan={6} className="px-0 pb-0">
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
                      <td className="px-4 py-2 font-mono text-neutral-600">{cat.codigoReduzido}</td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{cat.categoriaNome}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${cat.tipo === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {cat.tipo === 'RECEITA' ? '↑' : '↓'} {cat.tipo === 'RECEITA' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      {temSimulacao && (
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                          {cat.previsto > 0 ? BRL.format(cat.previsto) : <span className="text-neutral-700">—</span>}
                        </td>
                      )}
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${cat.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {BRL.format(cat.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-white/5">
                  <tr>
                    <td colSpan={temSimulacao ? 4 : 3} className="px-4 py-2 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
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
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          Previsto vs Realizado — Período Completo
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">% = execução orçamentária. Verde = dentro da meta. Âmbar = atenção.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider min-w-[220px]">Categoria</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Previsto</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Realizado</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Variação</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Execução</th>
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
                      <span className="font-mono text-xs text-neutral-600 w-12 shrink-0">{row.codigoReduzido}</span>
                      <span className={row.depth === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-700 dark:text-neutral-300'}>
                        {row.categoriaNome}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {row.previsto > 0 ? BRL.format(row.previsto) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${row.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {BRL.format(row.realizado)}
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${vColor}`}>
                    {row.variacao === 0 ? '—'
                      : `${row.variacao > 0 ? '+' : ''}${BRL.format(row.variacao)}`}
                  </td>

                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                    {row.pct !== null ? (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold ${
                        status === 'good'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {status === 'good' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {PCT.format(row.pct)}%
                      </span>
                    ) : <span className="text-neutral-600 text-xs">—</span>}
                  </td>
                </tr>
              )
            })}

            {/* Resultado Líquido */}
            {hasResultado && (
              <tr className="bg-gradient-to-r from-emerald-950/40 to-transparent border-t-2 border-white/20">
                <td className="py-3.5 pl-4 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="block w-5 shrink-0" />
                    <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">---</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-widest">Resultado Líquido</span>
                  </div>
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(resultado.previsto)}`}>
                  {BRL.format(resultado.previsto)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(resultado.realizado)}`}>
                  {BRL.format(resultado.realizado)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${variacaoColor(resultado.realizado - resultado.previsto)}`}>
                  {resultado.realizado - resultado.previsto === 0 ? '—'
                    : `${resultado.realizado - resultado.previsto > 0 ? '+' : ''}${BRL.format(resultado.realizado - resultado.previsto)}`}
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right">
                  {resultado.previsto !== 0 && (
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${
                      resultado.realizado >= resultado.previsto
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}>
                      {PCT.format((resultado.realizado / resultado.previsto) * 100)}%
                    </span>
                  )}
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
    case 'VERDE':    return 'text-emerald-400'
    case 'AMARELO':  return 'text-amber-400'
    case 'VERMELHO': return 'text-red-400'
  }
}

function saldoBgClass(status: StatusSemaforo): string {
  switch (status) {
    case 'VERDE':    return 'bg-emerald-500/10'
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
      saldoAno:  f.reduce((s, r) => s + r.saldoDisponivelAno, 0),
    }
  }
  const totRec = sumTipo('RECEITA')
  const totDes = sumTipo('DESPESA')
  const res = {
    previsto:  totRec.previsto  - totDes.previsto,
    realizado: totRec.realizado - totDes.realizado,
    orcAnual:  totRec.orcAnual  - totDes.orcAnual,
    saldoAno:  totRec.saldoAno  - totDes.saldoAno,
  }
  const hasResultado = roots.some(r => r.tipo === 'RECEITA') && roots.some(r => r.tipo === 'DESPESA')

  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <Table2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          Matriz Analítica Detalhada — Valores Acumulados
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Acumulado: {periodoLabel} · Saldo Ano = Orç. Anual − Realizado Acumulado
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider min-w-[220px]">Categoria</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Previsto Acum.</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Realizado Acum.</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Orç. Anual</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  Saldo Ano
                  <span title="Orçamento Anual − Realizado Acumulado" className="cursor-help">
                    <Info className="w-3.5 h-3.5 text-neutral-500" />
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
                      <span className="font-mono text-xs text-neutral-600 w-12 shrink-0">{row.codigoReduzido}</span>
                      <span className={row.depth === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-700 dark:text-neutral-300'}>
                        {row.categoriaNome}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {row.previsto > 0 ? BRL.format(row.previsto) : <span className="text-neutral-700">—</span>}
                  </td>

                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm font-medium whitespace-nowrap ${row.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {BRL.format(row.realizado)}
                  </td>

                  <td className="py-2.5 px-3 text-right tabular-nums text-sm text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {row.orcamentoAnualTotal > 0 ? BRL.format(row.orcamentoAnualTotal) : <span className="text-neutral-700">—</span>}
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
              <tr className="bg-gradient-to-r from-emerald-950/40 to-transparent border-t-2 border-white/20">
                <td className="py-3.5 pl-4 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="block w-5 shrink-0" />
                    <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">---</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-widest">Resultado Líquido</span>
                  </div>
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.previsto)}`}>
                  {BRL.format(res.previsto)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.realizado)}`}>
                  {BRL.format(res.realizado)}
                </td>
                <td className={`py-3.5 px-3 text-right tabular-nums font-bold whitespace-nowrap ${valColor(res.orcAnual)}`}>
                  {BRL.format(res.orcAnual)}
                </td>
                <td className="py-3.5 pl-3 pr-4 text-right tabular-nums whitespace-nowrap">
                  <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded font-bold ${
                    res.saldoAno >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
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
  gestaoDados: GestaoCCResult | null
}

export function GestaoCCView({
  centrosCusto, simulacoes,
  selectedCCId, selectedSimId,
  filterInicio, filterFim,
  gestaoDados,
}: GestaoCCViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

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
    return `/gestao-cc?${params.toString()}`
  }

  const inicioStr = `${filterInicio.ano}-${String(filterInicio.mes).padStart(2, '0')}`
  const fimStr    = `${filterFim.ano}-${String(filterFim.mes).padStart(2, '0')}`

  const periodoLabel = gestaoDados
    ? `${MESES_FULL[gestaoDados.periodo.mesInicio - 1]}/${gestaoDados.periodo.anoInicio} → ${MESES_FULL[gestaoDados.periodo.mesFim - 1]}/${gestaoDados.periodo.anoFim}`
    : ''

  const temSim = gestaoDados?.temSimulacao ?? false

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Gestão por Centro de Custo</h1>
          <p className="text-neutral-600 dark:text-neutral-400">Extrato de caixa mensal e análise orçamentária por centro de custo.</p>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting || !gestaoDados}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-neutral-900 dark:text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm shrink-0 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
          {exporting ? 'Gerando...' : 'Gerar PDF'}
        </button>
      </div>

      {/* ── Filtros (4 colunas) ─────────────────────────────────────────────── */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-4 rounded-2xl backdrop-blur-xl">
        {/* CC */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Centro de Custo</label>
          <div className="relative">
            <select value={selectedCCId} onChange={e => router.push(buildUrl({ cc: e.target.value }))}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10">
              {centrosCusto.length === 0 && <option value="">Nenhum CC cadastrado</option>}
              {centrosCusto.map(cc => <option key={cc.id} value={cc.id} className="bg-white dark:bg-neutral-950">{cc.nome}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          </div>
        </div>

        {/* Simulação */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">
            Simulação (Previsto)
          </label>
          <div className="relative">
            <select value={selectedSimId} onChange={e => router.push(buildUrl({ sim: e.target.value }))}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10">
              <option value="" className="bg-white dark:bg-neutral-950">Sem orçamento</option>
              {simulacoes.map(s => <option key={s.id} value={s.id} className="bg-white dark:bg-neutral-950">{s.nome}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          </div>
        </div>

        {/* Início */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Início</label>
          <div className="relative">
            <select value={inicioStr} onChange={e => router.push(buildUrl({ inicio: e.target.value }))}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10">
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white dark:bg-neutral-950">{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          </div>
        </div>

        {/* Fim */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">Fim</label>
          <div className="relative">
            <select value={fimStr} onChange={e => router.push(buildUrl({ fim: e.target.value }))}
              className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/10">
              {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white dark:bg-neutral-950">{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {!gestaoDados && (
        <div className="text-center py-20 text-neutral-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione um Centro de Custo para visualizar a gestão financeira.</p>
        </div>
      )}

      {gestaoDados && (
        <div ref={printRef} className="flex flex-col gap-8">
          {/* ── Header do CC ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{gestaoDados.centroCustoNome}</h2>
              <p className="text-sm text-neutral-500">{periodoLabel}</p>
            </div>
          </div>

          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KPICard label="Saldo Inicial" realizado={gestaoDados.saldoInicial} icon={CircleDollarSign} />
            <KPICard
              label="Total Entradas"
              realizado={gestaoDados.totalEntradas}
              previsto={temSim ? gestaoDados.totalEntradasPrevisto : undefined}
              icon={ArrowUpCircle}
              tipo="RECEITA"
            />
            <KPICard
              label="Total Saídas"
              realizado={gestaoDados.totalSaidas}
              previsto={temSim ? gestaoDados.totalSaidasPrevisto : undefined}
              icon={ArrowDownCircle}
              tipo="DESPESA"
            />
            <KPICard
              label="Resultado"
              realizado={gestaoDados.resultado}
              previsto={temSim ? gestaoDados.resultadoPrevisto : undefined}
              icon={Scale}
            />
            {/* Saldo Final com destaque */}
            <div className="col-span-2 lg:col-span-1 h-full">
              <KPICard label="Saldo Final" realizado={gestaoDados.saldoFinal} icon={TrendingUp} isBalance />
            </div>
          </div>

          {/* ── Matriz Previsto vs Realizado ─────────────────────────────── */}
          <MatrizCC matriz={gestaoDados.matriz} temSimulacao={temSim} />

          {/* ── Extrato Mensal ────────────────────────────────────────────── */}
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider min-w-[160px]">Mês</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Saldo Inicial</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wider whitespace-nowrap">↑ Entradas</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-red-600 uppercase tracking-wider whitespace-nowrap">↓ Saídas</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">Resultado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">Saldo Final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5 bg-sky-500/5">
                    <td colSpan={5} className="px-4 py-2.5 text-xs text-sky-400 font-semibold uppercase tracking-wider">◆ Saldo Inicial do Período</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm font-bold text-sky-400">{BRL.format(gestaoDados.saldoInicial)}</td>
                  </tr>
                  {gestaoDados.meses.map(mes => (
                    <MesRow key={`${mes.ano}-${mes.mes}`} mes={mes} temSimulacao={temSim} />
                  ))}
                  <tr className="border-t-2 border-white/20 bg-gradient-to-r from-emerald-950/40 to-transparent">
                    <td className="px-4 py-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">◆ Total do Período</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-sm text-neutral-500 font-medium">{BRL.format(gestaoDados.saldoInicial)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-sm font-bold text-emerald-400">+ {BRL.format(gestaoDados.totalEntradas)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-sm font-bold text-red-400">− {BRL.format(gestaoDados.totalSaidas)}</td>
                    <td className={`px-3 py-3.5 text-right tabular-nums text-sm font-bold ${gestaoDados.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gestaoDados.resultado > 0 ? '+' : ''}{BRL.format(gestaoDados.resultado)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${
                        gestaoDados.saldoFinal >= 0
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
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

          {/* ── Matriz Analítica Detalhada ─────────────────────────────── */}
          <MatrizAnalitica matriz={gestaoDados.matriz} temSimulacao={temSim} periodoLabel={periodoLabel} />

          {/* ── Despesas Acima do Orçamento & Não Previstas ──────────────── */}
          {temSim && (() => {
            const leaves = gestaoDados.matriz.filter(r => !r.hasChildren && r.tipo === 'DESPESA')

            // Acima do orçamento: previsto > 0 e realizado > previsto (variacao negativa = estouro)
            const acimaOrc = leaves
              .filter(r => r.previsto > 0 && r.realizado > r.previsto)
              .map(r => ({ ...r, excesso: r.realizado - r.previsto }))
              .sort((a, b) => b.excesso - a.excesso)

            // Não previstas: previsto === 0 e realizado > 0
            const naoPrevistas = leaves
              .filter(r => r.previsto === 0 && r.realizado > 0)
              .sort((a, b) => b.realizado - a.realizado)

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Acima do Orçamento */}
                <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Despesas Acima do Orçamento</h3>
                      <p className="text-xs text-neutral-500">Categorias que extrapolaram o previsto, por valor de excesso</p>
                    </div>
                  </div>

                  {acimaOrc.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-neutral-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm">Nenhuma despesa acima do orçamento.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {acimaOrc.map((item, i) => {
                        const pctExcesso = ((item.realizado / item.previsto) - 1) * 100
                        const maxExcesso = acimaOrc[0].excesso
                        const barW = maxExcesso > 0 ? (item.excesso / maxExcesso) * 100 : 0

                        return (
                          <div key={item.categoriaId} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono text-neutral-600 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{item.categoriaNome}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3">
                                <span className="text-xs text-amber-400 font-bold">+{PCT.format(pctExcesso)}%</span>
                                <span className="text-sm font-bold text-red-400 tabular-nums">{BRL.format(item.excesso)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
                                  style={{ width: `${barW}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex justify-between mt-0.5">
                              <span className="text-[10px] text-neutral-600">Prev: {BRL.format(item.previsto)}</span>
                              <span className="text-[10px] text-neutral-600">Real: {BRL.format(item.realizado)}</span>
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
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <CircleDollarSign className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Despesas Não Previstas</h3>
                      <p className="text-xs text-neutral-500">Gastos em categorias sem orçamento (extras), por valor</p>
                    </div>
                  </div>

                  {naoPrevistas.length === 0 ? (
                    <div className="flex items-center gap-2 py-6 justify-center text-neutral-500">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
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
                                <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{item.categoriaNome}</span>
                              </div>
                              <span className="text-sm font-bold text-red-400 tabular-nums shrink-0 ml-3">{BRL.format(item.realizado)}</span>
                            </div>
                            <div className="h-1.5 bg-white/60 dark:bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-500/80 to-red-400 rounded-full transition-all"
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
