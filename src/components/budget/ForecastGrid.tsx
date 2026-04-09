'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ChevronDown, ChevronRight, Folder, FolderOpen, FileText,
  Save, Loader2, CheckCircle2, TrendingUp, TrendingDown,
} from 'lucide-react'
import { Categoria, OrcamentoPrevisto, DadosRealizados, FluxoProjetado, OrcamentoSimulacao } from '@/types'
import { bulkUpsertProjetado } from '@/actions/projetado'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const MESES_NOME = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function isPast(ano: number, mes: number, cutoffAno: number, cutoffMes: number) {
  return ano < cutoffAno || (ano === cutoffAno && mes <= cutoffMes)
}

function extractLeaves(cats: Categoria[]): Categoria[] {
  let arr: Categoria[] = []
  cats.forEach(c => {
    if (c.children && c.children.length > 0) arr = arr.concat(extractLeaves(c.children))
    else arr.push(c)
  })
  return arr
}

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

// ─── Main Component ───────────────────────────────────────────────────────────
export function ForecastGrid({
  categorias,
  simulacao,
  orcamentos,
  realizados,
  projetados,
  cutoffAno,
  cutoffMes,
  canEdit,
}: Props) {
  // Build period months
  const periodMonths = useMemo(() => {
    const months: { ano: number; mes: number }[] = []
    let cur = { ano: simulacao.ano_inicio, mes: simulacao.mes_inicio }
    let guard = 0
    while (
      (cur.ano < simulacao.ano_fim || (cur.ano === simulacao.ano_fim && cur.mes <= simulacao.mes_fim)) &&
      guard < 60
    ) {
      months.push({ ...cur })
      cur = { ...cur, mes: cur.mes + 1 }
      if (cur.mes > 12) { cur.mes = 1; cur.ano++ }
      guard++
    }
    return months
  }, [simulacao])

  // Build lookup maps from props
  const realizadoMap = useMemo(() => {
    const map: Record<string, number> = {}
    realizados.forEach(r => { map[`${r.categoria_id}_${r.ano}_${r.mes}`] = Number(r.valor_realizado) })
    return map
  }, [realizados])

  const orcadoMap = useMemo(() => {
    const map: Record<string, number> = {}
    orcamentos.forEach(o => { map[`${o.categoria_id}_${o.ano}_${o.mes}`] = Number(o.valor_previsto) })
    return map
  }, [orcamentos])

  // Local state for future months — init from projetados, fallback to orcados
  const [localState, setLocalState] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    const projetadoMap: Record<string, number> = {}
    projetados.forEach(p => { projetadoMap[`${p.categoria_id}_${p.ano}_${p.mes}`] = Number(p.valor_projetado) })
    // Pre-fill all future months from orcados; override with saved projetados
    orcamentos.forEach(o => {
      if (!isPast(o.ano, o.mes, cutoffAno, cutoffMes)) {
        map[`${o.categoria_id}_${o.ano}_${o.mes}`] = Number(o.valor_previsto)
      }
    })
    projetados.forEach(p => {
      map[`${p.categoria_id}_${p.ano}_${p.mes}`] = Number(p.valor_projetado)
    })
    return map
  })

  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Re-sync when projetados prop changes (after save / reload)
  useEffect(() => {
    setLocalState(prev => {
      const next = { ...prev }
      // Reset future months to orcados, then overlay projetados
      orcamentos.forEach(o => {
        if (!isPast(o.ano, o.mes, cutoffAno, cutoffMes)) {
          const key = `${o.categoria_id}_${o.ano}_${o.mes}`
          if (!(key in next)) next[key] = Number(o.valor_previsto)
        }
      })
      projetados.forEach(p => {
        next[`${p.categoria_id}_${p.ano}_${p.mes}`] = Number(p.valor_projetado)
      })
      return next
    })
    setIsDirty(false)
  }, [projetados]) // eslint-disable-line react-hooks/exhaustive-deps

  const leaves = useMemo(() => extractLeaves(categorias), [categorias])

  // Get hybrid value for a leaf: past = realizado, future = localState
  const getHybridValue = (catId: string, ano: number, mes: number): number => {
    if (isPast(ano, mes, cutoffAno, cutoffMes)) {
      return realizadoMap[`${catId}_${ano}_${mes}`] ?? 0
    }
    return localState[`${catId}_${ano}_${mes}`] ?? orcadoMap[`${catId}_${ano}_${mes}`] ?? 0
  }

  // Per-column totals for RESULTADO and VARIAÇÃO rows
  const columnMetrics = useMemo(() => {
    return periodMonths.map(({ ano, mes }) => {
      let hybridReceita = 0, hybridDespesa = 0, orcadoReceita = 0, orcadoDespesa = 0
      leaves.forEach(cat => {
        const hybrid = getHybridValue(cat.id, ano, mes)
        const orcado = orcadoMap[`${cat.id}_${ano}_${mes}`] ?? 0
        if (cat.tipo === 'RECEITA') { hybridReceita += hybrid; orcadoReceita += orcado }
        else { hybridDespesa += hybrid; orcadoDespesa += orcado }
      })
      const resultado = hybridReceita - hybridDespesa
      const resultadoOrcado = orcadoReceita - orcadoDespesa
      const variacao = resultado - resultadoOrcado
      return { resultado, resultadoOrcado, variacao }
    })
  }, [periodMonths, leaves, realizadoMap, localState, orcadoMap, cutoffAno, cutoffMes]) // eslint-disable-line react-hooks/exhaustive-deps

  const grandResultado = columnMetrics.reduce((s, m) => s + m.resultado, 0)
  const grandVariacao = columnMetrics.reduce((s, m) => s + m.variacao, 0)

  const handleUpdate = (catId: string, ano: number, mes: number, valor: number) => {
    setLocalState(prev => ({ ...prev, [`${catId}_${ano}_${mes}`]: valor }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const entries: { categoria_id: string; mes: number; ano: number; valor_projetado: number }[] = []
    for (const key in localState) {
      const parts = key.split('_')
      const catId = parts[0]
      const ano = parseInt(parts[1])
      const mes = parseInt(parts[2])
      if (!isPast(ano, mes, cutoffAno, cutoffMes)) {
        entries.push({ categoria_id: catId, ano, mes, valor_projetado: localState[key] })
      }
    }
    const res = await bulkUpsertProjetado(simulacao.id, entries)
    if ('error' in res) {
      alert('Erro ao salvar projeção: ' + res.error)
    } else {
      setIsDirty(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
    setIsSaving(false)
  }

  return (
    <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl h-full flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-white/10 flex justify-between items-center flex-wrap gap-3 shrink-0">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
          Fluxo Projetado — {simulacao.ano_inicio}
        </h2>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-800 hover:bg-sky-900 text-white font-medium rounded-lg transition-all border border-sky-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvando...' : 'Salvar Projeção'}
          </button>
        )}
        {showSuccess && (
          <div className="absolute top-16 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-700 text-white rounded-xl shadow-2xl border border-emerald-600 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">Projeção Salva!</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-[#121212] border-b border-neutral-200 dark:border-white/10 border-r sticky left-0 z-30 w-80">
                Categoria
              </th>
              {periodMonths.map(({ ano, mes }) => {
                const past = isPast(ano, mes, cutoffAno, cutoffMes)
                return (
                  <th
                    key={`${ano}-${mes}`}
                    className={`px-3 py-3 font-medium text-center border-b border-r border-neutral-200 dark:border-white/10 min-w-[7rem] ${
                      past
                        ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20'
                        : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    }`}
                  >
                    {MESES_NOME[mes - 1]}/{String(ano).slice(-2)}
                  </th>
                )
              })}
              <th className="px-4 py-3 font-bold text-neutral-900 dark:text-white text-center bg-neutral-100 dark:bg-[#1a1a1a] border-b border-neutral-200 dark:border-white/10 min-w-32 sticky right-0 z-20">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
            {categorias.map(cat => (
              <ForecastRow
                key={cat.id}
                categoria={cat}
                periodMonths={periodMonths}
                cutoffAno={cutoffAno}
                cutoffMes={cutoffMes}
                realizadoMap={realizadoMap}
                orcadoMap={orcadoMap}
                localState={localState}
                onUpdate={handleUpdate}
                level={0}
                canEdit={canEdit}
              />
            ))}

            {/* RESULTADO row */}
            <tr className="bg-violet-500/10 font-bold border-t-2 border-violet-500/30">
              <td className="px-4 py-4 sticky left-0 z-10 bg-violet-50 dark:bg-[#120d1e] border-r border-neutral-200 dark:border-white/10 text-violet-500 dark:text-violet-400">
                <div className="flex items-center gap-2">
                  <span className="w-5" />
                  <CheckCircle2 className="w-4 h-4" />
                  RESULTADO (Receitas − Despesas)
                </div>
              </td>
              {columnMetrics.map((m, i) => (
                <td key={i} suppressHydrationWarning className={`px-3 py-4 text-right font-mono border-r border-neutral-200 dark:border-white/10 ${m.resultado >= 0 ? 'text-violet-500 dark:text-violet-400' : 'text-red-500 dark:text-red-400'}`}>
                  {BRL.format(m.resultado)}
                </td>
              ))}
              <td suppressHydrationWarning className={`px-4 py-4 text-right font-mono font-bold sticky right-0 z-10 bg-violet-50 dark:bg-[#120d1e] ${grandResultado >= 0 ? 'text-violet-500 dark:text-violet-400' : 'text-red-500 dark:text-red-400'}`}>
                {BRL.format(grandResultado)}
              </td>
            </tr>

            {/* VARIAÇÃO row */}
            <tr className="bg-amber-500/5 font-semibold border-t border-amber-500/20">
              <td className="px-4 py-3 sticky left-0 z-10 bg-amber-50 dark:bg-[#1a1200] border-r border-neutral-200 dark:border-white/10 text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  <span className="w-5" />
                  {grandVariacao >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  Variação vs Orçado
                </div>
              </td>
              {columnMetrics.map((m, i) => (
                <td key={i} suppressHydrationWarning className={`px-3 py-3 text-right font-mono text-xs border-r border-neutral-200 dark:border-white/10 ${m.variacao >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {m.variacao > 0 ? '+' : ''}{BRL.format(m.variacao)}
                </td>
              ))}
              <td suppressHydrationWarning className={`px-4 py-3 text-right font-mono text-xs font-bold sticky right-0 z-10 bg-amber-50 dark:bg-[#1a1200] ${grandVariacao >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {grandVariacao > 0 ? '+' : ''}{BRL.format(grandVariacao)}
              </td>
            </tr>

            {/* Surplus/Deficit indicator row */}
            <tr className="border-t border-neutral-100 dark:border-white/5">
              <td className="px-4 py-2 sticky left-0 z-10 bg-neutral-50 dark:bg-[#111] border-r border-neutral-200 dark:border-white/10 text-xs text-neutral-500" />
              {columnMetrics.map((m, i) => (
                <td key={i} className="py-2 text-center border-r border-neutral-200 dark:border-white/10 text-base">
                  {m.resultado >= 0 ? '🟢' : '🔴'}
                </td>
              ))}
              <td className="py-2 text-center sticky right-0 z-10 bg-neutral-50 dark:bg-[#111] text-base">
                {grandResultado >= 0 ? '🟢' : '🔴'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Row Component ────────────────────────────────────────────────────────────
function ForecastRow({
  categoria,
  periodMonths,
  cutoffAno,
  cutoffMes,
  realizadoMap,
  orcadoMap,
  localState,
  onUpdate,
  level,
  canEdit,
}: {
  categoria: Categoria
  periodMonths: { ano: number; mes: number }[]
  cutoffAno: number
  cutoffMes: number
  realizadoMap: Record<string, number>
  orcadoMap: Record<string, number>
  localState: Record<string, number>
  onUpdate: (catId: string, ano: number, mes: number, valor: number) => void
  level: number
  canEdit: boolean
}) {
  const isParent = !!(categoria.children && categoria.children.length > 0)
  const [isExpanded, setIsExpanded] = useState(false)

  const computeSum = (cat: Categoria, ano: number, mes: number): number => {
    if (cat.children && cat.children.length > 0) {
      return cat.children.reduce((s, c) => s + computeSum(c, ano, mes), 0)
    }
    if (isPast(ano, mes, cutoffAno, cutoffMes)) {
      return realizadoMap[`${cat.id}_${ano}_${mes}`] ?? 0
    }
    return localState[`${cat.id}_${ano}_${mes}`] ?? orcadoMap[`${cat.id}_${ano}_${mes}`] ?? 0
  }

  const rowTotal = periodMonths.reduce((s, { ano, mes }) => s + computeSum(categoria, ano, mes), 0)

  return (
    <>
      <tr className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors group">
        <td
          className="px-4 py-2.5 font-medium sticky left-0 z-10 bg-neutral-100 dark:bg-[#121212] group-hover:bg-neutral-200 dark:group-hover:bg-[#1a1c23] transition-colors border-r border-neutral-200 dark:border-white/10"
          style={{ paddingLeft: `${level * 1.5 + 1}rem` }}
        >
          <div className="flex items-center gap-2">
            <button
              className="p-0.5 rounded text-neutral-500 hover:text-neutral-900 dark:text-white transition-colors w-5 shrink-0"
              onClick={() => isParent && setIsExpanded(!isExpanded)}
            >
              {isParent ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : <span className="w-4 h-4 block" />}
            </button>
            <div className="text-neutral-500 shrink-0">
              {isParent
                ? isExpanded ? <FolderOpen className="w-4 h-4 text-violet-400" /> : <Folder className="w-4 h-4 text-violet-500" />
                : <FileText className="w-4 h-4 text-neutral-400" />}
            </div>
            <span className="text-neutral-500 font-mono text-xs w-10 shrink-0">{categoria.codigo_reduzido}</span>
            <span className={level === 0 ? 'text-violet-300 font-semibold truncate' : 'text-neutral-700 dark:text-neutral-300 truncate'}>
              {categoria.nome_conta}
            </span>
          </div>
        </td>

        {periodMonths.map(({ ano, mes }) => {
          const past = isPast(ano, mes, cutoffAno, cutoffMes)
          const val = computeSum(categoria, ano, mes)
          const key = `${categoria.id}_${ano}_${mes}`

          if (isParent) {
            return (
              <td
                key={key}
                suppressHydrationWarning
                className={`px-3 py-2.5 text-right font-mono text-xs border-r border-neutral-200 dark:border-white/10 opacity-60 ${
                  past ? 'bg-sky-50/50 dark:bg-sky-900/10' : 'bg-emerald-50/50 dark:bg-emerald-900/10'
                }`}
              >
                {BRL.format(val)}
              </td>
            )
          }

          if (past) {
            return (
              <td
                key={key}
                suppressHydrationWarning
                className="px-3 py-2.5 text-right font-mono text-xs border-r border-neutral-200 dark:border-white/10 bg-sky-50/70 dark:bg-sky-900/15 text-sky-700 dark:text-sky-300"
              >
                {BRL.format(val)}
              </td>
            )
          }

          // Future month — editable
          return (
            <td
              key={key}
              className="px-1 py-1 border-r border-neutral-200 dark:border-white/10 bg-emerald-50/50 dark:bg-emerald-900/10"
            >
              {canEdit ? (
                <EditableCell
                  valor={localState[key] ?? orcadoMap[key] ?? 0}
                  onChange={v => onUpdate(categoria.id, ano, mes, v)}
                />
              ) : (
                <span suppressHydrationWarning className="block text-right px-2 py-1.5 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                  {BRL.format(localState[key] ?? orcadoMap[key] ?? 0)}
                </span>
              )}
            </td>
          )
        })}

        <td suppressHydrationWarning className="px-4 py-2.5 text-right font-mono font-bold text-neutral-900 dark:text-white text-xs sticky right-0 z-10 bg-neutral-100 dark:bg-[#121212] group-hover:bg-neutral-200 dark:group-hover:bg-[#1a1c23] transition-colors border-l border-neutral-200 dark:border-white/10">
          {BRL.format(rowTotal)}
        </td>
      </tr>

      {isExpanded && categoria.children?.map(child => (
        <ForecastRow
          key={child.id}
          categoria={child}
          periodMonths={periodMonths}
          cutoffAno={cutoffAno}
          cutoffMes={cutoffMes}
          realizadoMap={realizadoMap}
          orcadoMap={orcadoMap}
          localState={localState}
          onUpdate={onUpdate}
          level={level + 1}
          canEdit={canEdit}
        />
      ))}
    </>
  )
}

// ─── Editable Cell ────────────────────────────────────────────────────────────
function EditableCell({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(valor || 0))
  const [isEditing, setIsEditing] = useState(false)

  // Resync when prop changes
  useEffect(() => {
    if (!isEditing) setVal(String(valor || 0))
  }, [valor, isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    const num = Number(val)
    if (!isNaN(num)) onChange(num)
  }

  return isEditing ? (
    <input
      type="number"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.key === 'Enter' && handleBlur()}
      autoFocus
      className="w-full bg-black/60 border border-emerald-500 rounded px-2 py-1.5 text-right text-xs font-mono text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
    />
  ) : (
    <div
      onClick={() => setIsEditing(true)}
      suppressHydrationWarning
      className={`w-full cursor-pointer rounded px-2 py-1.5 text-right text-xs font-mono transition-colors ${
        valor > 0
          ? 'text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
          : 'text-neutral-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
      }`}
    >
      {BRL.format(Number(val) || 0)}
    </div>
  )
}
