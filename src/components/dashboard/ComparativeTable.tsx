'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados } from '@/types'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gerarMeses(ini: { ano: number; mes: number }, fim: { ano: number; mes: number }): { value: string; label: string }[] {
  const meses: { value: string; label: string }[] = []
  let curMes = ini.mes
  let curAno = ini.ano
  let guard = 0
  while ((curAno < fim.ano || (curAno === fim.ano && curMes <= fim.mes)) && guard < 60) {
    meses.push({ value: `${curAno}-${String(curMes).padStart(2, '0')}`, label: `${NOMES_MESES[curMes - 1]}/${curAno}` })
    curMes++
    if (curMes > 12) { curMes = 1; curAno++ }
    guard++
  }
  return meses
}

interface RowData {
  cat: Categoria
  previsto: number
  realizado: number
  depth: number
}

function flattenTree(cats: Categoria[], orcMap: Map<string, number>, realMap: Map<string, number>, depth = 0): RowData[] {
  const rows: RowData[] = []
  cats.forEach(cat => {
    // Sum all descendants too
    const previsto = sumSubtree(cat, orcMap)
    const realizado = sumSubtree(cat, realMap)
    rows.push({ cat, previsto, realizado, depth })
    if (cat.children && cat.children.length > 0) {
      rows.push(...flattenTree(cat.children, orcMap, realMap, depth + 1))
    }
  })
  return rows
}

function sumSubtree(cat: Categoria, map: Map<string, number>): number {
  // Only count values if it's a leaf node. 
  // Parent totals are always the sum of their children's leaf values.
  if (!cat.children || cat.children.length === 0) {
    return map.get(cat.id) ?? 0
  }
  let total = 0
  cat.children.forEach(c => { total += sumSubtree(c, map) })
  return total
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ComparativeTable({
  categorias,
  orcamentos,
  realizados,
  filterInicio,
  filterFim,
}: {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  filterInicio: { ano: number; mes: number }
  filterFim: { ano: number; mes: number }
}) {
  const meses = useMemo(() => gerarMeses(filterInicio, filterFim), [filterInicio, filterFim])
  const [mesFiltro, setMesFiltro] = useState<string>('todos')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const rows = useMemo(() => {
    // Build aggregation maps filtered by month selection
    const orcMap = new Map<string, number>()
    const realMap = new Map<string, number>()

    const orcFiltrados = mesFiltro === 'todos'
      ? orcamentos
      : orcamentos.filter(o => `${o.ano}-${String(o.mes).padStart(2, '0')}` === mesFiltro)

    const realFiltrados = mesFiltro === 'todos'
      ? realizados
      : realizados.filter(r => `${r.ano}-${String(r.mes).padStart(2, '0')}` === mesFiltro)

    orcFiltrados.forEach(o => orcMap.set(o.categoria_id, (orcMap.get(o.categoria_id) ?? 0) + Number(o.valor_previsto)))
    realFiltrados.forEach(r => realMap.set(r.categoria_id, (realMap.get(r.categoria_id) ?? 0) + Number(r.valor_realizado)))

    return flattenTree(categorias, orcMap, realMap, 0)
  }, [categorias, orcamentos, realizados, mesFiltro])

  // Determine visible rows (respecting collapsed state)
  const visibleRows = useMemo(() => {
    const visible: RowData[] = []
    const skipDepthAbove: number[] = []

    for (const row of rows) {
      // Remove skip markers for depths deeper than current
      while (skipDepthAbove.length > 0 && skipDepthAbove[skipDepthAbove.length - 1] >= row.depth) {
        skipDepthAbove.pop()
      }
      if (skipDepthAbove.length > 0) continue

      visible.push(row)
      if (collapsed.has(row.cat.id) && row.cat.children && row.cat.children.length > 0) {
        skipDepthAbove.push(row.depth)
      }
    }
    return visible
  }, [rows, collapsed])

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Matriz Analítica</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Comparativo hierárquico por conta</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Mês:</span>
          <select
            value={mesFiltro}
            onChange={e => setMesFiltro(e.target.value)}
            className="bg-white/5 border border-white/10 text-neutral-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
          >
            <option value="todos" className="bg-neutral-900">Todos os meses</option>
            {meses.map(m => (
              <option key={m.value} value={m.value} className="bg-neutral-900">{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 pr-4">Categoria</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-4 whitespace-nowrap">Orçado</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-4 whitespace-nowrap">Realizado</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-4 whitespace-nowrap">Saldo (R$)</th>
              <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 pl-4 whitespace-nowrap">Saldo (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map(({ cat, previsto, realizado, depth }) => {
              const variacao = previsto - realizado // positive = under budget (money left)
              const pct = previsto !== 0 ? (variacao / Math.abs(previsto)) * 100 : 0
              const hasChildren = cat.children && cat.children.length > 0
              const isCollapsed = collapsed.has(cat.id)
              const isDespesa = cat.tipo === 'DESPESA'
              // For despesas: negative saldo = over budget (bad). For receitas: negative saldo = under budget (bad).
              const isOver = isDespesa ? variacao < 0 : variacao > 0
              const varColor = variacao === 0 ? 'text-neutral-400' : isOver ? 'text-red-400' : 'text-emerald-400'

              return (
                <tr key={cat.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="py-2.5 pr-4" style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => hasChildren && toggle(cat.id)}
                        className={`p-0.5 rounded text-neutral-600 w-5 shrink-0 ${hasChildren ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}
                      >
                        {hasChildren
                          ? isCollapsed
                            ? <ChevronRight size={14} />
                            : <ChevronDown size={14} />
                          : <span className="w-3.5 h-3.5 block" />}
                      </button>
                      <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">{cat.codigo_reduzido}</span>
                      <span className={depth === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-300'}>
                        {cat.nome_conta}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-neutral-300 tabular-nums whitespace-nowrap">
                    {BRL.format(previsto)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-neutral-300 tabular-nums whitespace-nowrap">
                    {BRL.format(realizado)}
                  </td>
                  <td className={`py-2.5 px-4 text-right tabular-nums font-medium whitespace-nowrap ${varColor}`}>
                    {BRL.format(variacao)}
                  </td>
                  <td className={`py-2.5 pl-4 text-right tabular-nums font-medium whitespace-nowrap ${varColor}`}>
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visibleRows.length === 0 && (
          <div className="text-center py-10 text-neutral-500 text-sm">
            Nenhum dado para o período selecionado.
          </div>
        )}
      </div>
    </div>
  )
}
