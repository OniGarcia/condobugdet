'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Categoria, OrcamentoPrevisto, OrcamentoSimulacao } from '@/types'
import { Copy, ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Save, Loader2, Upload, ListChecks, CheckCircle2 } from 'lucide-react'
import { bulkUpsertOrcamentos } from '@/actions/orcamento'
import { parseBudgetExcel } from '@/actions/parseBudgetExcel'

export function BudgetGrid({ 
  categorias, 
  orcamentos, 
  simulacao,
  onUpdateParentSum
}: { 
  categorias: Categoria[], 
  orcamentos: OrcamentoPrevisto[], 
  simulacao: OrcamentoSimulacao,
  onUpdateParentSum?: () => void
}) {
  const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
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

  // Sync state when props change (Simulation switch or after a server save)
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
      // Get all categories that have a value in the first column
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

  // Recursive flat categories (Leaves only)
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

    if (!columns.length) {
      alert("A simulação não possui meses configurados validos.")
      return;
    }

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
        // Aloca os importados na primeira coluna
        res.data.forEach((imported: any) => {
           next[`${imported.categoria_id}_${firstCol.ano}_${firstCol.mes}`] = imported.valor
        })
        return next
      })
      setIsDirty(true)
      alert(`${res.count} contas identificadas com médias e alocadas em ${nomeMeses[firstCol.mes - 1]}/${firstCol.ano}! Use o botão "Replicar Tudo" para preencher o resto dos meses.`)
    }
    
    setIsImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setIsSaving(true)
    const entries = []
    
    // We send everything that is in localState.
    // Ideally we'd only send dirty ones, but bulk upserting current set is safe.
    for (const key in localState) {
      const [catId, anoStr, mesStr] = key.split('_')
      const valor = localState[key]
      
      // We only skip if it's explicitly 0 AND wasn't in the original database (to keep DB clean)
      // But for now, sending all values > 0 or that were modified to 0 is safer.
      if (valor !== undefined) {
        entries.push({
          categoria_id: catId,
          ano: parseInt(anoStr),
          mes: parseInt(mesStr),
          valor_previsto: valor
        })
      }
    }
    
    if (entries.length === 0) {
      setIsSaving(false)
      setIsDirty(false)
      return
    }

    const res = await bulkUpsertOrcamentos(simulacao.id, entries)
    if (res.success) {
      setIsDirty(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } else {
      alert("Erro ao salvar o orçamento: " + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shrink-0 h-full flex flex-col min-w-0 flex-1 relative">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-white">Configuração de {simulacao.nome}</h2>
        
        <div className="flex gap-2">
          {/* Hidden File Input */}
          <input 
            type="file" 
            accept=".xlsx" 
            onChange={handleImportExcel} 
            ref={fileInputRef} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isSaving}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg transition-all border border-white/10 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-emerald-400" />}
            Importar XLS (Média)
          </button>
          
          <div className="w-px bg-white/10 mx-1 self-stretch my-1" />

          <button 
            onClick={handleMasterReplicate}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 font-medium rounded-lg transition-all border border-emerald-500/20 disabled:opacity-50"
            title="Copia os valores do 1º mês para toda a linha para Múltiplas Contas"
          >
            <ListChecks className="w-4 h-4" />
            Replicar Tudo
          </button>

          <button 
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed ml-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Salvando..." : "Salvar Orçamento"}
          </button>
        </div>

        {/* Floating Success Toast */}
        {showSuccess && (
          <div className="absolute top-16 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-500 text-white rounded-xl shadow-2xl shadow-emerald-500/40 animate-in fade-in slide-in-from-top-4 duration-300 border border-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">Orçamento Salvo com Sucesso!</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-400 bg-[#121212] border-b border-white/10 border-r sticky left-0 z-30 w-80">
                Categoria
              </th>
              <th className="px-4 py-3 font-medium text-emerald-400 bg-[#06241a] border-b border-white/10 border-r text-center w-28 backdrop-blur-xl sticky left-80 z-20">
                Ações
              </th>
              {columns.map((m, i) => (
                <th key={`${m.mes}-${m.ano}`} className="px-4 py-3 font-medium text-neutral-400 text-center bg-[#121212] border-b border-white/10 border-r last:border-r-0 min-w-32 backdrop-blur-xl">
                  {nomeMeses[m.mes - 1]}/{String(m.ano).slice(-2)}
                </th>
              ))}
              <th suppressHydrationWarning className="px-4 py-3 font-bold text-white text-center bg-[#1a1a1a] border-b border-white/10 min-w-32 sticky right-0 z-20 backdrop-blur-xl">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {categorias.map(cat => (
              <BudgetRow 
                key={cat.id} 
                categoria={cat} 
                columns={columns} 
                localState={localState} 
                onUpdate={handleUpdate}
                onReplicate={handleReplicate}
                level={0} 
              />
            ))}
            
            {/* Resultado Row */}
            <tr className="bg-emerald-500/10 font-bold border-t-2 border-emerald-500/30">
              <td className="px-4 py-4 sticky left-0 z-10 bg-[#06241a] border-r border-white/10 text-emerald-400">
                <div className="flex gap-2 items-center">
                  <span className="w-5 shrink-0" />
                  <CheckCircle2 className="w-4 h-4" />
                  <span>RESULTADO (Receitas - Despesas)</span>
                </div>
              </td>
              <td className="px-4 py-4 text-center bg-[#0d1613] border-r border-white/10 sticky left-80 z-10" />
              {columnResults.map((res, i) => (
                <td key={`result-${i}`} suppressHydrationWarning className={`px-4 py-4 text-right font-mono border-r border-white/10 ${res >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(res)}
                </td>
              ))}
              <td suppressHydrationWarning className={`px-4 py-4 text-right font-mono sticky right-0 z-10 bg-[#06241a] ${grandTotalResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grandTotalResult)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BudgetRow({ 
  categoria, 
  columns, 
  localState,
  onUpdate,
  onReplicate,
  level = 0
}: { 
  categoria: Categoria, 
  columns: {mes: number, ano: number}[], 
  localState: Record<string, number>,
  onUpdate: (catId: string, ano: number, mes: number, valor: number) => void,
  onReplicate: (catId: string, valor: number) => void,
  level?: number
}) {
  const isParent = !!(categoria.children && categoria.children.length > 0)
  const [isExpanded, setIsExpanded] = useState(level < 2)

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
      <tr className="hover:bg-white/5 transition-colors group">
        <td 
          className="px-4 py-3 font-medium sticky left-0 z-10 bg-[#121212] group-hover:bg-[#1a1c23] transition-colors border-r border-white/10"
          style={{ paddingLeft: `${(level * 1.25) + 0.5}rem` }}
        >
          <div className="flex gap-2 items-center">
            <button
              className="p-0.5 rounded text-neutral-600 hover:text-white transition-colors w-5 shrink-0"
              onClick={() => isParent && setIsExpanded(!isExpanded)}
            >
              {isParent ? (
                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 block" />
              )}
            </button>

            <div className="text-neutral-500 shrink-0">
              {isParent
                ? isExpanded
                  ? <FolderOpen className="w-4 h-4 text-emerald-400" />
                  : <Folder className="w-4 h-4 text-emerald-500" />
                : <FileText className="w-4 h-4 text-neutral-600" />
              }
            </div>

            <span className="text-neutral-500 font-mono text-xs w-10 shrink-0">{categoria.codigo_reduzido}</span>
            <span className={level === 0 ? "text-emerald-300 font-semibold truncate" : "text-neutral-300 truncate"}>
              {categoria.nome_conta}
            </span>
          </div>
        </td>
        
        {/* Acoes: Now the very first column after Categoria */}
        <td className="px-4 py-2 text-center bg-[#0d1613] border-r border-white/10 sticky left-80 z-10 group-hover:bg-[#11241c] transition-colors">
          {!isParent && columns.length > 0 && (
            <button 
              onClick={() => onReplicate(categoria.id, localState[`${categoria.id}_${columns[0].ano}_${columns[0].mes}`] || 0)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800/80 text-emerald-400/80 hover:text-emerald-400 hover:bg-neutral-700/80 rounded block text-[10px] uppercase font-bold tracking-wider transition-colors border border-emerald-500/10 mx-auto disabled:opacity-30 disabled:cursor-not-allowed"
              title="Copiar 1º mês para toda a linha"
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
            <td key={key} suppressHydrationWarning className="px-4 py-2 text-center border-r border-white/10 last:border-r-0 hover:bg-white/5 transition-colors">
              {isParent ? (
                <span className="text-neutral-500 text-sm font-mono block w-full text-right p-1.5 opacity-50">
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

        {/* Total Column Cell */}
        <td suppressHydrationWarning className="px-4 py-2 text-right border-l border-white/10 sticky right-0 z-10 bg-[#121212] group-hover:bg-[#1a1c23] transition-colors font-bold text-white font-mono">
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
        />
      ))}
    </>
  )
}

function EditableCell({ valor, onChange }: { valor: number, onChange: (v: number) => void }) {
  const [val, setVal] = useState(String(valor || 0))
  const [isEditing, setIsEditing] = useState(false)

  // Resync if props change
  useMemo(() => {
    if (!isEditing) setVal(String(valor || 0))
  }, [valor, isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    const num = Number(val)
    if (!isNaN(num)) {
      onChange(num)
    }
  }

  return isEditing ? (
    <input
      type="number"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => e.key === 'Enter' && handleBlur()}
      autoFocus
      className="w-full bg-black/60 border border-emerald-500 rounded px-2 py-1 text-right text-sm font-mono text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner"
    />
  ) : (
    <div 
      onClick={() => setIsEditing(true)}
      suppressHydrationWarning
      className={`w-full cursor-pointer rounded px-2 py-1 text-right text-sm font-mono transition-colors ${valor > 0 ? 'text-white font-medium bg-emerald-500/5 hover:bg-emerald-500/10' : 'text-neutral-500 hover:bg-white/10'}`}
    >
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0)}
    </div>
  )
}

