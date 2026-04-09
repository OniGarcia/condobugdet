'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Categoria, OrcamentoPrevisto, OrcamentoSimulacao } from '@/types'
import { Copy, ChevronDown, ChevronUp, ChevronRight, Folder, FolderOpen, FileText, Save, Loader2, Upload, ListChecks, CheckCircle2, PanelLeftClose, PanelLeftOpen, Download } from 'lucide-react'
import { bulkUpsertOrcamentos } from '@/actions/orcamento'
import { parseBudgetExcel } from '@/actions/parseBudgetExcel'
import { cn } from '@/lib/utils'

export function BudgetGrid({
  categorias,
  orcamentos,
  simulacao,
  onUpdateParentSum,
  canEdit = true,
  topControls,
  metadata,
  createModal,
}: {
  categorias: Categoria[],
  orcamentos: OrcamentoPrevisto[],
  simulacao: OrcamentoSimulacao,
  onUpdateParentSum?: () => void,
  canEdit?: boolean,
  topControls?: React.ReactNode,
  metadata?: React.ReactNode,
  createModal?: React.ReactNode,
}) {
  const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)

  // Calculate columns based on simulation bounds
  const columns = useMemo(() => {
    const cols = []
    let curMes = simulacao.mes_inicio
    let curAno = simulacao.ano_inicio
    
    let length = 0
    while (curAno < simulacao.ano_fim || (curAno === simulacao.ano_fim && curMes <= simulacao.mes_fim)) {
      cols.push({ mes: curMes, ano: curAno })
      curMes++
      if (curMes > 12) {
        curMes = 1
        curAno++
      }
      length++
      if (length > 60) break; // Infinite loop safety net
    }
    return cols
  }, [simulacao])

  // Local State map
  const [localState, setLocalState] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    orcamentos.forEach(o => {
      map[`${o.categoria_id}_${o.ano}_${o.mes}`] = o.valor_previsto
    })
    return map
  })

  // Memoized leaves for calculations
  const leaves = useMemo(() => {
    const extract = (cats: Categoria[]): Categoria[] => {
      let arr: Categoria[] = [];
      cats.forEach(c => {
        if (c.children && c.children.length > 0) {
          arr = arr.concat(extract(c.children))
        } else {
          arr.push(c)
        }
      })
      return arr;
    }
    return extract(categorias);
  }, [categorias]);

  // Monthly results (Revenue - Expenses)
  const columnResults = useMemo(() => {
    return columns.map(col => {
      let rev = 0;
      let exp = 0;
      leaves.forEach(cat => {
        const val = localState[`${cat.id}_${col.ano}_${col.mes}`] || 0;
        if (cat.tipo === 'RECEITA') rev += val;
        else if (cat.tipo === 'DESPESA') exp += val;
      });
      return rev - exp;
    });
  }, [columns, localState, leaves]);

  const grandTotalResult = useMemo(() => {
    return columnResults.reduce((acc, val) => acc + val, 0);
  }, [columnResults]);
  
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync state when props change
  useEffect(() => {
    const map: Record<string, number> = {}
    orcamentos.forEach(o => {
      map[`${o.categoria_id}_${o.ano}_${o.mes}`] = o.valor_previsto
    })
    setLocalState(map)
    setIsDirty(false)
  }, [simulacao.id, orcamentos])

  // Handlers
  const handleUpdate = (categoriaId: string, ano: number, mes: number, valor: number) => {
    setLocalState(prev => ({
      ...prev,
      [`${categoriaId}_${ano}_${mes}`]: valor
    }))
    setIsDirty(true)
  }

  const handleReplicate = (categoriaId: string, valor: number) => {
    setLocalState(prev => {
      const next = { ...prev }
      columns.forEach(col => {
        next[`${categoriaId}_${col.ano}_${col.mes}`] = valor
      })
      return next
    })
    setIsDirty(true)
  }

  const handleMasterReplicate = () => {
    if (!columns.length) return;
    if (!confirm("Isso irá copiar TODOS os valores do primeiro mês visível para os demais meses de cada conta. Deseja continuar?")) return;
    
    const firstCol = columns[0]
    setLocalState(prev => {
      const next = { ...prev }
      const flatCats = extractLeaves(categorias)
      flatCats.forEach(cat => {
         const firstVal = next[`${cat.id}_${firstCol.ano}_${firstCol.mes}`] || 0
         if (firstVal > 0) {
           columns.forEach(col => {
              next[`${cat.id}_${col.ano}_${col.mes}`] = firstVal
           })
         }
      })
      return next
    })
    setIsDirty(true)
  }

  const extractLeaves = (cats: Categoria[]): Categoria[] => {
     let arr: Categoria[] = [];
     cats.forEach(c => {
       if (c.children && c.children.length > 0) {
         arr = arr.concat(extractLeaves(c.children))
       } else {
         arr.push(c)
       }
     })
     return arr;
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return;
    if (!columns.length) return;

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
      const valor = localState[key]
      if (valor !== undefined) {
        entries.push({
          categoria_id: catId,
          ano: parseInt(anoStr),
          mes: parseInt(mesStr),
          valor_previsto: valor
        })
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
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background w-full overflow-hidden">
      {/* Dynamic Header Section */}
      <header className="px-8 py-6 border-b border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-xl shrink-0">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
            <div className="flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mb-1.5 font-sans">
                    Previsão Orçamentária
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
                    Configure simulações de orçamento condominal para exercícios dinâmicos.
                </p>
                
                {/* Collapse Toggle */}
                <button 
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sky-500 hover:text-sky-400 transition-colors bg-sky-500/5 px-2 py-1 rounded"
                >
                    {isFilterExpanded ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Ocultar Configurações</>
                    ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Mostrar Configurações</>
                    )}
                </button>
            </div>

            {/* Action Buttons Area */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
                {createModal}
                
                <input type="file" accept=".xlsx" onChange={handleImportExcel} ref={fileInputRef} className="hidden" />
                
                {canEdit && (
                    <>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting || isSaving}
                            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                        >
                            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-sky-500" />}
                            Importar XLS
                        </button>

                        <button
                            onClick={handleMasterReplicate}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                        >
                            <ListChecks className="w-3.5 h-3.5 text-sky-500" />
                            Replicar Tudo
                        </button>

                        <button
                            disabled={!simulacao}
                            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 font-medium rounded-lg transition-all border border-neutral-200 dark:border-white/10 disabled:opacity-50 text-xs shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5 text-sky-500" />
                            Exportar XLS
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-sm"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {isSaving ? "Salvando..." : "Salvar Orçamento"}
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* Collapsible Section */}
        {isFilterExpanded && (
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-end gap-6">
                    <div className="w-80">
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">Selecione a Simulação</label>
                        {topControls}
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 px-1">Centro de Custo</label>
                        {metadata}
                    </div>
                </div>
            </div>
        )}
      </header>

      {/* Main Table Content */}
      <main className="flex-1 p-8 min-h-0 overflow-hidden relative">
        <div className="h-full bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl shadow-black/5 flex flex-col overflow-hidden relative group/table">
            <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0 min-w-full lg:min-w-[1500px]">
                    <thead className="sticky top-0 z-30 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-50/95 dark:bg-[#121212]/95 border-b border-neutral-200 dark:border-white/10 border-r sticky left-0 z-40 w-96 backdrop-blur-md">
                                Categoria
                            </th>
                            <th className="px-4 py-4 font-bold text-sky-400 bg-sky-500/5 dark:bg-[#061824]/95 border-b border-neutral-200 dark:border-white/10 border-r text-center w-32 backdrop-blur-md sticky left-[384px] z-40">
                                Ações
                            </th>
                            {columns.map((m, i) => (
                                <th key={`${m.mes}-${m.ano}`} className="px-6 py-4 font-bold text-neutral-500 dark:text-neutral-400 text-center bg-neutral-50/95 dark:bg-[#121212]/95 border-b border-neutral-200 dark:border-white/10 border-r last:border-r-0 min-w-44 backdrop-blur-md">
                                    {nomeMeses[m.mes - 1]}/{String(m.ano).slice(-2)}
                                </th>
                            ))}
                            <th suppressHydrationWarning className="px-6 py-4 font-black text-neutral-900 dark:text-white text-center bg-neutral-100/95 dark:bg-[#1a1a1a]/95 border-b border-neutral-200 dark:border-white/10 min-w-44 sticky right-0 z-30 backdrop-blur-md">
                                TOTAL
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
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

                        {/* Resultado Row */}
                        <tr className="bg-sky-500/5 dark:bg-sky-500/10 font-bold border-t-2 border-sky-500/20">
                            <td className="px-6 py-5 sticky left-0 z-10 bg-sky-50/95 dark:bg-[#061824]/95 border-r border-sky-200 dark:border-sky-500/20 text-sky-500 backdrop-blur-sm">
                                <div className="flex gap-3 items-center">
                                    <CheckCircle2 className="w-5 h-5 text-sky-500" />
                                    <span className="tracking-tight uppercase text-xs font-black">RESULTADO (Receitas - Despesas)</span>
                                </div>
                            </td>
                            <td className="px-4 py-5 text-center bg-sky-50 dark:bg-[#0d1318]/95 border-r border-sky-200 dark:border-sky-500/20 sticky left-[384px] z-10 backdrop-blur-sm" />
                            {columnResults.map((res, i) => (
                                <td key={`result-${i}`} suppressHydrationWarning className={cn(
                                    "px-6 py-5 text-right font-mono border-r border-neutral-200 dark:border-white/5 text-base",
                                    res >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                                )}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res)}
                                </td>
                            ))}
                            <td suppressHydrationWarning className={cn(
                                "px-6 py-5 text-right font-mono sticky right-0 z-10 bg-sky-50/95 dark:bg-[#061824]/95 backdrop-blur-sm text-lg",
                                grandTotalResult >= 0 ? 'text-emerald-500 font-black' : 'text-red-500 font-black'
                            )}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalResult)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
      </main>

      {/* Floating Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl animate-in fade-in slide-in-from-bottom-6 duration-500 border border-emerald-500/20 shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-bold tracking-tight">Orçamento atualizado com sucesso!</span>
        </div>
      )}
    </div>
  )
}

function BudgetRow({
  categoria,
  columns,
  localState,
  onUpdate,
  onReplicate,
  level = 0,
  canEdit = true,
}: {
  categoria: Categoria,
  columns: {mes: number, ano: number}[],
  localState: Record<string, number>,
  onUpdate: (catId: string, ano: number, mes: number, valor: number) => void,
  onReplicate: (catId: string, valor: number) => void,
  level?: number,
  canEdit?: boolean,
}) {
  const isParent = !!(categoria.children && categoria.children.length > 0)
  const [isExpanded, setIsExpanded] = useState(level < 1) // Expand root level by default

  const computeParentSum = (catId: string, ano: number, mes: number, cat: Categoria): number => {
    let sum = 0
    if (cat.children && cat.children.length > 0) {
      cat.children.forEach(child => sum += computeParentSum(child.id, ano, mes, child))
    } else {
      sum += localState[`${cat.id}_${ano}_${mes}`] || 0
    }
    return sum
  }

  return (
    <>
      <tr className="hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group">
        <td 
          className="px-6 py-4 font-medium sticky left-0 z-10 bg-white dark:bg-[#121212] group-hover:bg-neutral-50 dark:group-hover:bg-[#1a1c23] transition-colors border-r border-neutral-200 dark:border-white/10"
          style={{ paddingLeft: `${(level * 1.5) + 1.5}rem` }}
        >
          <div className="flex gap-3 items-center">
            <button
              className="p-1 rounded text-neutral-400 hover:text-sky-500 transition-colors w-6 shrink-0 flex justify-center"
              onClick={() => isParent && setIsExpanded(!isExpanded)}
            >
              {isParent ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 block" />
              )}
            </button>

            <div className="shrink-0">
              {isParent
                ? isExpanded
                  ? <FolderOpen className="w-4 h-4 text-sky-400" />
                  : <Folder className="w-4 h-4 text-sky-500/80" />
                : <FileText className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
              }
            </div>

            <span className="text-neutral-400 font-mono text-[10px] w-12 shrink-0">{categoria.codigo_reduzido}</span>
            <span className={cn(
                "truncate transition-colors",
                level === 0 ? "text-sky-500 font-bold uppercase text-xs" : "text-neutral-700 dark:text-neutral-300 text-sm",
                "group-hover:text-sky-500"
            )}>
              {categoria.nome_conta}
            </span>
          </div>
        </td>
        
        <td className="px-4 py-4 text-center bg-sky-50/30 dark:bg-[#0d1318]/95 border-r border-neutral-200 dark:border-white/10 sticky left-[384px] z-10 group-hover:bg-sky-50 dark:group-hover:bg-[#111824] transition-colors backdrop-blur-sm">
          {canEdit && !isParent && columns.length > 0 && (
            <button
              onClick={() => onReplicate(categoria.id, localState[`${categoria.id}_${columns[0].ano}_${columns[0].mes}`] || 0)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:bg-sky-600 hover:text-white rounded-lg text-[10px] uppercase font-bold tracking-widest transition-all border border-sky-300 dark:border-sky-500/20 mx-auto disabled:opacity-30 shadow-sm"
              title="Replicar valor do 1º mês para os demais"
            >
              <Copy className="w-3.5 h-3.5" />
              Replicar
            </button>
          )}
        </td>

        {columns.map(col => {
          const key = `${categoria.id}_${col.ano}_${col.mes}`
          const valorFormatado = isParent ? computeParentSum(categoria.id, col.ano, col.mes, categoria) : (localState[key] || 0)
          
          return (
            <td key={key} suppressHydrationWarning className="px-6 py-4 text-center border-r border-neutral-100 dark:border-white/5 last:border-r-0">
              {isParent || !canEdit ? (
                <span className="text-neutral-400 dark:text-neutral-500 text-sm font-mono block w-full text-right opacity-60">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFormatado)}
                </span>
              ) : (
                <EditableCell
                  valor={valorFormatado}
                  onChange={(v) => onUpdate(categoria.id, col.ano, col.mes, v)}
                />
              )}
            </td>
          )
        })}

        <td suppressHydrationWarning className="px-6 py-4 text-right border-l border-neutral-200 dark:border-white/10 sticky right-0 z-10 bg-neutral-50 dark:bg-[#121212] group-hover:bg-neutral-100 dark:group-hover:bg-[#1a1c23] transition-colors font-black text-neutral-900 dark:text-white font-mono text-sm border-shadow-left">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
             columns.reduce((acc, col) => {
               const val = isParent ? computeParentSum(categoria.id, col.ano, col.mes, categoria) : (localState[`${categoria.id}_${col.ano}_${col.mes}`] || 0)
               return acc + val
             }, 0)
          )}
        </td>
      </tr>
      
      {isExpanded && categoria.children?.map(child => (
        <BudgetRow
          key={child.id}
          categoria={child}
          columns={columns}
          localState={localState}
          onUpdate={onUpdate}
          onReplicate={onReplicate}
          level={level + 1}
          canEdit={canEdit}
        />
      ))}
    </>
  )
}

function EditableCell({ valor, onChange }: { valor: number, onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(valor || 0))
  const [isEditing, setIsEditing] = useState(false)

  useMemo(() => {
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
      className="w-full bg-white dark:bg-black border-2 border-sky-500 rounded-lg px-3 py-1.5 text-right text-sm font-mono text-sky-600 focus:outline-none shadow-lg z-50 relative animate-in zoom-in-95 duration-75"
    />
  ) : (
    <div 
      onClick={() => setIsEditing(true)}
      suppressHydrationWarning
      className={cn(
        "w-full cursor-pointer rounded-lg px-3 py-2 text-right text-sm font-mono transition-all border border-transparent",
         valor > 0 
           ? "text-neutral-900 dark:text-white font-bold bg-sky-500/5 hover:bg-sky-500/15 border-sky-500/10" 
           : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5"
      )}
    >
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0)}
    </div>
  )
}
