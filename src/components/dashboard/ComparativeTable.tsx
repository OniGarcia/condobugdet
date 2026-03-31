'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Info } from 'lucide-react'
import { RelatorioCategoriaAno, StatusSemaforo } from '@/types'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type ViewMode = 'mes' | 'acumulado'

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

function resultadoColor(value: number): string {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-amber-400'
}

function resultadoBg(value: number): string {
  if (value > 0) return 'bg-emerald-500/10'
  if (value < 0) return 'bg-red-500/10'
  return 'bg-amber-500/10'
}

export function ComparativeTable({
  rows,
  mesAlvo,
  anoAlvo,
}: {
  rows: RelatorioCategoriaAno[]
  mesAlvo: number
  anoAlvo: number
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [view, setView] = useState<ViewMode>('acumulado')

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Determine visible rows by skipping children of collapsed parents
  const visibleRows: RelatorioCategoriaAno[] = []
  const skipAboveDepth: number[] = []

  for (const row of rows) {
    while (skipAboveDepth.length > 0 && skipAboveDepth[skipAboveDepth.length - 1] >= row.depth) {
      skipAboveDepth.pop()
    }
    if (skipAboveDepth.length > 0) continue

    visibleRows.push(row)
    if (collapsed.has(row.categoriaId) && row.hasChildren) {
      skipAboveDepth.push(row.depth)
    }
  }

  // Compute Resultado = Receitas - Despesas (aggregating depth=0 roots)
  const depth0 = rows.filter(r => r.depth === 0)
  const sumTipo = (tipo: 'RECEITA' | 'DESPESA') => {
    const f = depth0.filter(r => r.tipo === tipo)
    return {
      previstoMes:   f.reduce((s, r) => s + r.previstoMes, 0),
      realizadoMes:  f.reduce((s, r) => s + r.realizadoMes, 0),
      previstoYTD:   f.reduce((s, r) => s + r.previstoAcumuladoYTD, 0),
      realizadoYTD:  f.reduce((s, r) => s + r.realizadoAcumuladoYTD, 0),
      orcAnual:      f.reduce((s, r) => s + r.orcamentoAnualTotal, 0),
      saldoAno:      f.reduce((s, r) => s + r.saldoDisponivelAno, 0),
    }
  }
  const rec = sumTipo('RECEITA')
  const des = sumTipo('DESPESA')
  const res = {
    previstoMes:  rec.previstoMes  - des.previstoMes,
    realizadoMes: rec.realizadoMes - des.realizadoMes,
    previstoYTD:  rec.previstoYTD  - des.previstoYTD,
    realizadoYTD: rec.realizadoYTD - des.realizadoYTD,
    orcAnual:     rec.orcAnual     - des.orcAnual,
    saldoAno:     rec.saldoAno     - des.saldoAno,
  }
  const hasResultado = depth0.some(r => r.tipo === 'RECEITA') && depth0.some(r => r.tipo === 'DESPESA')

  const mesLabel = mesAlvo >= 1 && mesAlvo <= 12
    ? `${NOMES_MESES[mesAlvo - 1]}/${anoAlvo}`
    : `${mesAlvo}/${anoAlvo}`

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Matriz Analítica</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Mês de referência: <span className="text-neutral-300 font-medium">{mesLabel}</span>
            {view === 'acumulado' && <> · YTD: Janeiro até {mesLabel}</>}
          </p>
        </div>

        {/* Toggle Mês / Acumulado */}
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView('mes')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'mes'
                ? 'bg-emerald-500 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Mês
          </button>
          <button
            onClick={() => setView('acumulado')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'acumulado'
                ? 'bg-emerald-500 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Acumulado
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 pr-4 min-w-[200px]">
                Categoria
              </th>

              {view === 'mes' ? (
                <>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-3 whitespace-nowrap">
                    Mês Previsto
                  </th>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-3 whitespace-nowrap">
                    Mês Realizado
                  </th>
                </>
              ) : (
                <>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-3 whitespace-nowrap">
                    YTD Previsto
                  </th>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-3 whitespace-nowrap">
                    YTD Realizado
                  </th>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 px-3 whitespace-nowrap">
                    Orç. Anual
                  </th>
                  <th className="text-right text-xs font-medium text-neutral-400 uppercase tracking-wider pb-3 pl-3 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">
                      Saldo Ano
                      <span
                        title="Mostra o quanto ainda podemos gastar nesta categoria até o fim do ano"
                        className="cursor-help"
                      >
                        <Info className="w-3.5 h-3.5 text-neutral-500" />
                      </span>
                    </span>
                  </th>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {visibleRows.map(row => {
              const isCollapsed = collapsed.has(row.categoriaId)
              const colorClass = saldoColorClass(row.statusSemaforoAno)
              const bgClass = saldoBgClass(row.statusSemaforoAno)
              const pct = row.orcamentoAnualTotal !== 0
                ? row.saldoDisponivelAno / row.orcamentoAnualTotal
                : null

              return (
                <tr key={row.categoriaId} className="hover:bg-white/[0.03] transition-colors">
                  {/* Categoria */}
                  <td className="py-2.5 pr-4" style={{ paddingLeft: `${row.depth * 1.5 + 0.5}rem` }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => row.hasChildren && toggle(row.categoriaId)}
                        className={`p-0.5 rounded text-neutral-600 w-5 shrink-0 ${row.hasChildren ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}
                      >
                        {row.hasChildren
                          ? isCollapsed
                            ? <ChevronRight size={14} />
                            : <ChevronDown size={14} />
                          : <span className="w-3.5 h-3.5 block" />}
                      </button>
                      <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">{row.codigoReduzido}</span>
                      <span className={row.depth === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-300'}>
                        {row.categoriaNome}
                      </span>
                    </div>
                  </td>

                  {view === 'mes' ? (
                    <>
                      <td className="py-2.5 px-3 text-right text-neutral-400 tabular-nums whitespace-nowrap">
                        {BRL.format(row.previstoMes)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-300 tabular-nums whitespace-nowrap">
                        {BRL.format(row.realizadoMes)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right text-neutral-400 tabular-nums whitespace-nowrap">
                        {BRL.format(row.previstoAcumuladoYTD)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-300 tabular-nums whitespace-nowrap">
                        {BRL.format(row.realizadoAcumuladoYTD)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-300 tabular-nums whitespace-nowrap">
                        {BRL.format(row.orcamentoAnualTotal)}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-2 px-2 py-0.5 rounded font-bold ${colorClass} ${bgClass}`}
                          title="Mostra o quanto ainda podemos gastar nesta categoria até o fim do ano"
                        >
                          {BRL.format(row.saldoDisponivelAno)}
                          {pct !== null && (
                            <span className="text-xs font-normal opacity-60">
                              {PCT.format(pct)}
                            </span>
                          )}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}

            {/* Linha de Resultado = Receitas - Despesas */}
            {hasResultado && (
              <tr className="border-t-2 border-white/20 bg-white/[0.04]">
                <td className="py-3 pr-4 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0" />
                    <span className="font-mono text-xs text-neutral-500 w-12 shrink-0">---</span>
                    <span className="text-white font-bold text-xs uppercase tracking-widest">
                      Resultado
                    </span>
                  </div>
                </td>

                {view === 'mes' ? (
                  <>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap font-bold ${resultadoColor(res.previstoMes)}`}>
                      {BRL.format(res.previstoMes)}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap font-bold ${resultadoColor(res.realizadoMes)}`}>
                      {BRL.format(res.realizadoMes)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap font-bold ${resultadoColor(res.previstoYTD)}`}>
                      {BRL.format(res.previstoYTD)}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap font-bold ${resultadoColor(res.realizadoYTD)}`}>
                      {BRL.format(res.realizadoYTD)}
                    </td>
                    <td className={`py-3 px-3 text-right tabular-nums whitespace-nowrap font-bold ${resultadoColor(res.orcAnual)}`}>
                      {BRL.format(res.orcAnual)}
                    </td>
                    <td className="py-3 pl-3 text-right tabular-nums whitespace-nowrap">
                      <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded font-bold ${resultadoColor(res.saldoAno)} ${resultadoBg(res.saldoAno)}`}>
                        {BRL.format(res.saldoAno)}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            )}
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
