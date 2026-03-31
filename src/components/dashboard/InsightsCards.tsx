'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados, RelatorioCategoriaAno } from '@/types'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function buildTypeAndNameMap(cats: Categoria[], typeMap: Map<string, 'RECEITA' | 'DESPESA'>, nameMap: Map<string, string>, leafIds: Set<string>) {
  cats.forEach(c => {
    typeMap.set(c.id, c.tipo)
    nameMap.set(c.id, c.nome_conta)
    if (!c.children || c.children.length === 0) {
      leafIds.add(c.id)
    } else {
      buildTypeAndNameMap(c.children, typeMap, nameMap, leafIds)
    }
  })
}

export function InsightsCards({
  categorias,
  orcamentos,
  realizados,
  relatorioRows,
}: {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  realizados: DadosRealizados[]
  relatorioRows?: RelatorioCategoriaAno[]
}) {
  const { topPiores, topSemOrcamento } = useMemo(() => {
    if (relatorioRows && relatorioRows.length > 0) {
      // 1. Items WITH budget (for over-budget ranking)
      const plannedEntries = relatorioRows
        .filter(r => !r.hasChildren && r.tipo === 'DESPESA' && r.categoriaId !== '__nao_categorizado__' && r.orcamentoAnualTotal > 0)
        .map(r => {
          const previsto = r.orcamentoAnualTotal
          const realizado = r.realizadoAcumuladoYTD
          const variacao = realizado - previsto
          const pct = (realizado / previsto - 1) * 100
          
          return {
            id: r.categoriaId,
            nome: r.categoriaNome,
            previsto,
            realizado,
            variacao,
            pct
          }
        })

      // 2. Items WITHOUT budget (unplanned/extra)
      const unplannedEntries = relatorioRows
        .filter(r => !r.hasChildren && r.tipo === 'DESPESA' && r.categoriaId !== '__nao_categorizado__' && r.orcamentoAnualTotal === 0)
        .map(r => ({
          id: r.categoriaId,
          nome: r.categoriaNome,
          previsto: 0,
          realizado: r.realizadoAcumuladoYTD,
          variacao: r.realizadoAcumuladoYTD,
          pct: 0
        }))

      const topPiores = [...plannedEntries]
        .filter(e => e.variacao > 0)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5)

      const topSemOrcamento = [...unplannedEntries]
        .filter(e => e.realizado > 0)
        .sort((a, b) => b.realizado - a.realizado)
        .slice(0, 5)

      return { topPiores, topSemOrcamento }
    }

    // Fallback for non-report views
    const typeMap = new Map<string, 'RECEITA' | 'DESPESA'>()
    const nameMap = new Map<string, string>()
    const leafIds = new Set<string>()
    buildTypeAndNameMap(categorias, typeMap, nameMap, leafIds)

    const prevMap = new Map<string, number>()
    const realMap = new Map<string, number>()

    orcamentos.forEach(o => {
      if (leafIds.has(o.categoria_id) && typeMap.get(o.categoria_id) === 'DESPESA') {
        prevMap.set(o.categoria_id, (prevMap.get(o.categoria_id) ?? 0) + Number(o.valor_previsto))
      }
    })
    realizados.forEach(r => {
      if (leafIds.has(r.categoria_id) && typeMap.get(r.categoria_id) === 'DESPESA') {
        realMap.set(r.categoria_id, (realMap.get(r.categoria_id) ?? 0) + Number(r.valor_realizado))
      }
    })

    const ids = new Set([...prevMap.keys(), ...realMap.keys()])
    const planned: any[] = []
    const unplanned: any[] = []

    ids.forEach(id => {
      const previsto = prevMap.get(id) ?? 0
      const realizado = realMap.get(id) ?? 0
      const entry = { id, nome: nameMap.get(id) ?? id, previsto, realizado, variacao: realizado - previsto }
      
      if (previsto > 0) {
        planned.push({ ...entry, pct: (realizado / previsto - 1) * 100 })
      } else if (realizado > 0) {
        unplanned.push({ ...entry, pct: 0 })
      }
    })

    const topPiores = planned
      .filter(e => e.variacao > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)

    const topSemOrcamento = unplanned
      .sort((a, b) => b.realizado - a.realizado)
      .slice(0, 5)

    return { topPiores, topSemOrcamento }
  }, [categorias, orcamentos, realizados, relatorioRows])

  // Only return if at least one side has content
  if (topPiores.length === 0 && topSemOrcamento.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Rank Negativo - Piores (%) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/10">
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Top 5 — Acima do Orçamento</h3>
            <p className="text-xs text-neutral-500">Despesas planejadas que mais extrapolaram (%)</p>
          </div>
        </div>

        {topPiores.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">Nenhuma despesa planejada acima do orçamento.</p>
        ) : (
          <div className="space-y-3">
            {topPiores.map((entry, i) => {
              const maxPct = Math.max(...topPiores.map(e => e.pct))
              const barPct = maxPct > 0 ? Math.min((entry.pct / maxPct) * 100, 100) : 0
              
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
                    <span className="text-xs text-red-400/70 w-12 text-right">{entry.pct.toFixed(0)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rank Despesas Não Previstas (Extras) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/10">
            <TrendingDown size={16} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Top 5 — Despesas Não Previstas</h3>
            <p className="text-xs text-neutral-500">Gastos em categorias com orçamento zero (Extras)</p>
          </div>
        </div>

        {topSemOrcamento.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">Nenhuma despesa imprevista registrada.</p>
        ) : (
          <div className="space-y-3">
            {topSemOrcamento.map((entry, i) => {
              const maxVal = Math.max(...topSemOrcamento.map(e => e.realizado))
              const barPct = maxVal > 0 ? Math.min((entry.realizado / maxVal) * 100, 100) : 0
              
              return (
                <div key={entry.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-300 truncate flex-1 mr-3">
                      <span className="text-neutral-500 font-mono text-xs mr-2">#{i + 1}</span>
                      {entry.nome}
                    </span>
                    <span className="text-sm font-semibold text-amber-400 shrink-0">+{BRL.format(entry.realizado)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/60 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-xs text-amber-400/70 w-12 text-right">Extra</span>
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
