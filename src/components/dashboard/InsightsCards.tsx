'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados } from '@/types'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function buildTypeAndNameMap(cats: Categoria[], typeMap: Map<string, 'RECEITA' | 'DESPESA'>, nameMap: Map<string, string>) {
  cats.forEach(c => {
    typeMap.set(c.id, c.tipo)
    nameMap.set(c.id, c.nome_conta)
    if (c.children) buildTypeAndNameMap(c.children, typeMap, nameMap)
  })
}

export function InsightsCards({
  categorias,
  orcamentos,
  realizados,
}: {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
}) {
  const { topPiores, topEconomia } = useMemo(() => {
    const typeMap = new Map<string, 'RECEITA' | 'DESPESA'>()
    const nameMap = new Map<string, string>()
    buildTypeAndNameMap(categorias, typeMap, nameMap)

    // Aggregate per categoria_id (only DESPESA)
    const prevMap = new Map<string, number>()
    const realMap = new Map<string, number>()

    orcamentos.forEach(o => {
      if (typeMap.get(o.categoria_id) === 'DESPESA') {
        prevMap.set(o.categoria_id, (prevMap.get(o.categoria_id) ?? 0) + Number(o.valor_previsto))
      }
    })
    realizados.forEach(r => {
      if (typeMap.get(r.categoria_id) === 'DESPESA') {
        realMap.set(r.categoria_id, (realMap.get(r.categoria_id) ?? 0) + Number(r.valor_realizado))
      }
    })

    // Union of all category ids that appear in either map
    const ids = new Set([...prevMap.keys(), ...realMap.keys()])

    const entries = Array.from(ids).map(id => {
      const previsto = prevMap.get(id) ?? 0
      const realizado = realMap.get(id) ?? 0
      const variacao = realizado - previsto // positive = over budget (bad)
      return { id, nome: nameMap.get(id) ?? id, previsto, realizado, variacao }
    })

    // Top 5 piores: highest positive variação (most over budget)
    const topPiores = [...entries]
      .filter(e => e.variacao > 0)
      .sort((a, b) => b.variacao - a.variacao)
      .slice(0, 5)

    // Top 5 economia: most negative variação (most under budget)
    const topEconomia = [...entries]
      .filter(e => e.variacao < 0)
      .sort((a, b) => a.variacao - b.variacao)
      .slice(0, 5)

    return { topPiores, topEconomia }
  }, [categorias, orcamentos, realizados])

  if (topPiores.length === 0 && topEconomia.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Rank Negativo - Piores */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/10">
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Top 5 — Acima do Orçamento</h3>
            <p className="text-xs text-neutral-500">Despesas que mais extrapolaram o previsto</p>
          </div>
        </div>

        {topPiores.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">Nenhuma despesa acima do orçamento no período.</p>
        ) : (
          <div className="space-y-3">
            {topPiores.map((entry, i) => {
              const pct = entry.previsto > 0 ? (entry.realizado / entry.previsto - 1) * 100 : 0
              const barPct = Math.min((entry.variacao / Math.max(...topPiores.map(e => e.variacao))) * 100, 100)
              return (
                <div key={entry.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-300 truncate flex-1 mr-3">
                      <span className="text-neutral-500 font-mono text-xs mr-2">#{i + 1}</span>
                      {entry.nome}
                    </span>
                    <span className="text-sm font-semibold text-red-400 shrink-0">+{BRL.format(entry.variacao)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-xs text-red-400/70 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rank Positivo - Economia */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/10">
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Top 5 — Maior Economia</h3>
            <p className="text-xs text-neutral-500">Despesas que mais pouparam em relação ao previsto</p>
          </div>
        </div>

        {topEconomia.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">Nenhuma economia registrada no período.</p>
        ) : (
          <div className="space-y-3">
            {topEconomia.map((entry, i) => {
              const pct = entry.previsto > 0 ? (1 - entry.realizado / entry.previsto) * 100 : 0
              const absVar = Math.abs(entry.variacao)
              const barPct = Math.min((absVar / Math.max(...topEconomia.map(e => Math.abs(e.variacao)))) * 100, 100)
              return (
                <div key={entry.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-300 truncate flex-1 mr-3">
                      <span className="text-neutral-500 font-mono text-xs mr-2">#{i + 1}</span>
                      {entry.nome}
                    </span>
                    <span className="text-sm font-semibold text-emerald-400 shrink-0">{BRL.format(entry.variacao)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/60 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-xs text-emerald-400/70 w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
