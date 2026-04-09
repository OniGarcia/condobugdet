'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Categoria, OrcamentoPrevisto, OrcamentoSimulacao } from '@/types'
import {
  Copy, ChevronDown, ChevronUp, ChevronRight,
  Folder, FolderOpen, FileText, Save, Loader2,
  Upload, ListChecks, CheckCircle2, Download, Plus
} from 'lucide-react'
import { bulkUpsertOrcamentos } from '@/actions/orcamento'
import { parseBudgetExcel } from '@/actions/parseBudgetExcel'
import { cn } from '@/lib/utils'
import { SimulationSelector } from '@/components/budget/SimulationSelector'
import { SimulationActionsDropdown } from '@/components/budget/SimulationActionsDropdown'
import { CreateSimulationModal } from '@/components/budget/CreateSimulationModal'
import { Building2 } from 'lucide-react'

const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function BudgetPageClient({
  categorias,
  orcamentos,
  simulacao,
  simulacoes,
  selectedSimId,
  canEdit,
}: {
  categorias: Categoria[]
  orcamentos: OrcamentoPrevisto[]
  simulacao: OrcamentoSimulacao
  simulacoes: OrcamentoSimulacao[]
  selectedSimId: string
  canEdit: boolean
}) {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)
  const [localState, setLocalState] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    orcamentos.forEach(o => {
      map[`${o.categoria_id}_${o.ano}_${o.mes}`] = o.valor_previsto
    })
    return map
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const columns = useMemo(() => {
    const cols = []
    let curMes = simulacao.mes_inicio
    let curAno = simulacao.ano_inicio
    let length = 0
    while (curAno < simulacao.ano_fim || (curAno === simulacao.ano_fim && curMes <= simulacao.mes_fim)) {
      cols.push({ mes: curMes, ano: curAno })
      curMes++
      if (curMes > 12) { curMes = 1; curAno++ }
      length++
      if (length > 60) break
    }
    return cols
  }, [simulacao])

  const leaves = useMemo(() => {
    const extract = (cats: Categoria[]): Categoria[] => {
      let arr: Categoria[] = []
      cats.forEach(c => {
        if (c.children && c.children.length > 0) arr = arr.concat(extract(c.children))
        else arr.push(c)
      })
      return arr
    }
    return extract(categorias)
  }, [categorias])

  const columnResults = useMemo(() =>
    columns.map(col => {
      let rev = 0, exp = 0
      leaves.forEach(cat => {
        const val = localState[`${cat.id}_${col.ano}_${col.mes}`] || 0
        if (cat.tipo === 'RECEITA') rev += val
        else if (cat.tipo === 'DESPESA') exp += val
      })
      return rev - exp
    }),
    [columns, localState, leaves]
  )

  const grandTotalResult = useMemo(() => columnResults.reduce((a, v) => a + v, 0), [columnResults])

  useEffect(() => {
    const map: Record<string, number> = {}
    orcamentos.forEach(o => { map[`${o.categoria_id}_${o.ano}_${o.mes}`] = o.valor_previsto })
    setLocalState(map)
    setIsDirty(false)
  }, [simulacao.id, orcamentos])

  const handleUpdate = (catId: string, ano: number, mes: number, valor: number) => {
    setLocalState(prev => ({ ...prev, [`${catId}_${ano}_${mes}`]: valor }))
    setIsDirty(true)
  }

  const handleReplicate = (catId: string, valor: number) => {
    setLocalState(prev => {
      const next = { ...prev }
      columns.forEach(col => { next[`${catId}_${col.ano}_${col.mes}`] = valor })
      return next
    })
    setIsDirty(true)
  }

  const extractLeaves = (cats: Categoria[]): Categoria[] => {
    let arr: Categoria[] = []
    cats.forEach(c => {
      if (c.children && c.children.length > 0) arr = arr.concat(extractLeaves(c.children))
      else arr.push(c)
    })
    return arr
  }

  const handleMasterReplicate = () => {
    if (!columns.length) return
    if (!confirm("Isso irá copiar TODOS os valores do primeiro mês para os demais. Deseja continuar?")) return
    const firstCol = columns[0]
    setLocalState(prev => {
      const next = { ...prev }
      extractLeaves(categorias).forEach(cat => {
        const firstVal = next[`${cat.id}_${firstCol.ano}_${firstCol.mes}`] || 0
        if (firstVal > 0) columns.forEach(col => { next[`${cat.id}_${col.ano}_${col.mes}`] = firstVal })
      })
      return next
    })
    setIsDirty(true)
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !columns.length) return
    setIsImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await parseBudgetExcel(formData)
    if (res.error) {
      alert(res.error)
    } else if (res.success && res.data) {
      const firstCol = columns[0]
      setLocalState(prev => {
        const next = { ...prev }
        res.data.forEach((imported: any) => {
          next[`${imported.categoria_id}_${firstCol.ano}_${firstCol.mes}`] = imported.valor
        })
        return next
      })
      setIsDirty(true)
    }
    setIsImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setIsSaving(true)
    const entries = []
    for (const key in localState) {
      const [catId, anoStr, mesStr] = key.split('_')
      if (localState[key] !== undefined) {
        entries.push({ categoria_id: catId, ano: parseInt(anoStr), mes: parseInt(mesStr), valor_previsto: localState[key] })
      }
    }
    const res = await bulkUpsertOrcamentos(simulacao.id, entries)
    if (res.success) {
      setIsDirty(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
    setIsSaving(false)
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* ─── HEADER AREA ─── */}
      <div className="shrink-0">
        {/* Title row + action buttons */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Previsão Orçamentária
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Configure simulações de orçamento condominal para exercícios dinâmicos.
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <CreateSimulationModal highlight />}

            <input type="file" accept=".xlsx" onChange={handleImportExcel} ref={fileInputRef} className="hidden" />

            {canEdit && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting || isSaving}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-sky-500" />}
                  Importar XLS
                </button>

                <button
                  onClick={handleMasterReplicate}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                >
                  <ListChecks className="w-3.5 h-3.5 text-sky-500" />
                  Replicar Tudo
                </button>

                <button
                  disabled={!simulacao}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-sky-500" />
                  Exportar XLS
                </button>

                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-sm"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
                </button>
              </>
            )}
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
              Configurações da Simulação
            </span>
            <span className="text-xs text-neutral-400 font-normal">
              {simulacao.nome} · {simulacao.centro_custo_nome || 'Todos os centros de custo'}
            </span>
          </button>

          {isFilterExpanded && (
            <div className="px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-white/5">
              <div className="flex flex-wrap items-end gap-6">
                <div className="flex-1 min-w-60">
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Selecione a Simulação</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <SimulationSelector simulacoes={simulacoes} selectedId={selectedSimId} />
                    </div>
                    <SimulationActionsDropdown simulacao={simulacao} />
                  </div>
                </div>
                {simulacao.centro_custo_nome && (
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Centro de Custo</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs text-sky-400 font-medium">{simulacao.centro_custo_nome}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── TABLE AREA (scrollable) ─── */}
      <div className="flex-1 bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-scroll overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#60a5fa #f1f5f9' }}>
          <table className="text-left text-sm whitespace-nowrap border-collapse" style={{ minWidth: `${Math.max(900, 384 + 128 + columns.length * 176 + 176)}px` }}>
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="px-6 py-4 font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-[#141414] border-b border-r border-neutral-200 dark:border-white/10 sticky left-0 z-40 w-96 min-w-[384px]">Categoria</th>
                <th className="px-4 py-4 font-bold text-sky-400 bg-sky-50 dark:bg-[#061824] border-b border-r border-neutral-200 dark:border-white/10 text-center w-32 min-w-[128px]">Ações</th>
                {columns.map(m => (
                  <th key={`${m.mes}-${m.ano}`} className="px-6 py-4 font-bold text-neutral-500 dark:text-neutral-400 text-center bg-neutral-50 dark:bg-[#141414] border-b border-r border-neutral-200 dark:border-white/10 min-w-44">
                    {nomeMeses[m.mes - 1]}/{String(m.ano).slice(-2)}
                  </th>
                ))}
                <th className="px-6 py-4 font-black text-neutral-900 dark:text-white text-center bg-neutral-100 dark:bg-[#1c1c1c] border-b border-neutral-200 dark:border-white/10 min-w-44 sticky right-0 z-30">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(cat => (
                <BudgetRow
                  key={cat.id}
                  categoria={cat}
                  columns={columns}
                  localState={localState}
                  onUpdate={handleUpdate}
                  onReplicate={handleReplicate}
                  level={0}
                  canEdit={canEdit}
                />
              ))}
              {/* Result row */}
              <tr className="bg-sky-50/60 dark:bg-sky-500/10 font-bold border-t-2 border-sky-200 dark:border-sky-500/20">
                <td className="px-6 py-4 sticky left-0 z-10 bg-sky-50 dark:bg-[#061824] border-r border-sky-200 dark:border-sky-500/20 text-sky-600 dark:text-sky-400">
                  <div className="flex gap-3 items-center">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-tight">RESULTADO (Receitas - Despesas)</span>
                  </div>
                </td>
                <td className="bg-sky-50 dark:bg-[#0d1318] border-r border-sky-200 dark:border-sky-500/20" />
                {columnResults.map((res, i) => (
                  <td key={`result-${i}`} suppressHydrationWarning className={cn(
                    'px-6 py-4 text-right font-mono border-r border-neutral-200 dark:border-white/5',
                    res >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res)}
                  </td>
                ))}
                <td suppressHydrationWarning className={cn(
                  'px-6 py-4 text-right font-mono sticky right-0 z-10 bg-sky-50 dark:bg-[#061824] text-base font-black',
                  grandTotalResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalResult)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl animate-in fade-in slide-in-from-bottom-6 duration-500 border border-emerald-500/20 shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-bold">Orçamento atualizado com sucesso!</span>
        </div>
      )}
    </div>
  )
}

// ─── BudgetRow ───────────────────────────────────────────────────────────────

function BudgetRow({
  categoria, columns, localState, onUpdate, onReplicate, level = 0, canEdit = true,
}: {
  categoria: Categoria
  columns: { mes: number; ano: number }[]
  localState: Record<string, number>
  onUpdate: (catId: string, ano: number, mes: number, valor: number) => void
  onReplicate: (catId: string, valor: number) => void
  level?: number
  canEdit?: boolean
}) {
  const isParent = !!(categoria.children && categoria.children.length > 0)
  const [isExpanded, setIsExpanded] = useState(level < 1)

  const computeSum = (cat: Categoria, ano: number, mes: number): number => {
    if (cat.children && cat.children.length > 0)
      return cat.children.reduce((acc, c) => acc + computeSum(c, ano, mes), 0)
    return localState[`${cat.id}_${ano}_${mes}`] || 0
  }

  return (
    <>
      <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group border-b border-neutral-100 dark:border-white/5">
        <td
          className="px-6 py-3 font-medium sticky left-0 z-10 bg-white dark:bg-[#141414] group-hover:bg-neutral-50 dark:group-hover:bg-[#1a1c23] transition-colors border-r border-neutral-200 dark:border-white/10"
          style={{ paddingLeft: `${level * 1.5 + 1.5}rem` }}
        >
          <div className="flex gap-2 items-center">
            <button
              className="p-0.5 rounded text-neutral-400 hover:text-sky-500 transition-colors w-5 shrink-0 flex justify-center"
              onClick={() => isParent && setIsExpanded(!isExpanded)}
            >
              {isParent ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : <span className="w-4 h-4 block" />}
            </button>
            <div className="shrink-0">
              {isParent
                ? isExpanded ? <FolderOpen className="w-4 h-4 text-sky-400" /> : <Folder className="w-4 h-4 text-sky-400/70" />
                : <FileText className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />}
            </div>
            <span className="text-neutral-400 font-mono text-[10px] w-10 shrink-0">{categoria.codigo_reduzido}</span>
            <span className={cn(
              'truncate transition-colors text-sm',
              level === 0 ? 'text-sky-600 dark:text-sky-400 font-bold uppercase text-xs' : 'text-neutral-700 dark:text-neutral-300',
              'group-hover:text-sky-500'
            )}>
              {categoria.nome_conta}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-center bg-sky-50/30 dark:bg-[#0d1318] border-r border-neutral-200 dark:border-white/10 group-hover:bg-sky-50 dark:group-hover:bg-[#111824] transition-colors">
          {canEdit && !isParent && columns.length > 0 && (
            <button
              onClick={() => onReplicate(categoria.id, localState[`${categoria.id}_${columns[0].ano}_${columns[0].mes}`] || 0)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all border border-sky-200 dark:border-sky-500/20 mx-auto shadow-sm"
              title="Replicar valor do 1º mês"
            >
              <Copy className="w-3 h-3" />Replicar
            </button>
          )}
        </td>
        {columns.map(col => {
          const key = `${categoria.id}_${col.ano}_${col.mes}`
          const val = isParent ? computeSum(categoria, col.ano, col.mes) : (localState[key] || 0)
          return (
            <td key={key} suppressHydrationWarning className="px-3 py-3 text-center border-r border-neutral-100 dark:border-white/5 min-w-44">
              {isParent || !canEdit ? (
                <span className="text-neutral-400 dark:text-neutral-500 text-sm font-mono block text-right">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                </span>
              ) : (
                <EditableCell valor={val} onChange={(v) => onUpdate(categoria.id, col.ano, col.mes, v)} />
              )}
            </td>
          )
        })}
        <td suppressHydrationWarning className="px-6 py-3 text-right sticky right-0 z-10 bg-neutral-50 dark:bg-[#141414] group-hover:bg-neutral-100 dark:group-hover:bg-[#1a1c23] transition-colors font-bold text-neutral-900 dark:text-white font-mono text-sm border-l border-neutral-200 dark:border-white/10">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            columns.reduce((acc, col) => acc + (isParent ? computeSum(categoria, col.ano, col.mes) : (localState[`${categoria.id}_${col.ano}_${col.mes}`] || 0)), 0)
          )}
        </td>
      </tr>
      {isExpanded && categoria.children?.map(child => (
        <BudgetRow key={child.id} categoria={child} columns={columns} localState={localState} onUpdate={onUpdate} onReplicate={onReplicate} level={level + 1} canEdit={canEdit} />
      ))}
    </>
  )
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

function EditableCell({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(valor || 0))
  const [isEditing, setIsEditing] = useState(false)

  useMemo(() => { if (!isEditing) setVal(String(valor || 0)) }, [valor, isEditing])

  const commit = () => {
    setIsEditing(false)
    const num = Number(val)
    if (!isNaN(num)) onChange(num)
  }

  return isEditing ? (
    <input
      type="number" value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      autoFocus
      className="w-full bg-white dark:bg-black border-2 border-sky-500 rounded-lg px-3 py-1.5 text-right text-sm font-mono text-sky-600 focus:outline-none shadow-lg"
    />
  ) : (
    <div
      onClick={() => setIsEditing(true)}
      suppressHydrationWarning
      className={cn(
        'w-full cursor-pointer rounded-lg px-3 py-2 text-right text-sm font-mono transition-all border border-transparent',
        valor > 0
          ? 'text-neutral-900 dark:text-white font-bold bg-sky-500/5 hover:bg-sky-500/15 border-sky-500/10'
          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
      )}
    >
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0)}
    </div>
  )
}
