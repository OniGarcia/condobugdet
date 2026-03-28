'use client'

import { useState } from 'react'
import { Categoria, OrcamentoPrevisto } from '@/types'
import { Copy, Save } from 'lucide-react'
import { updateOrcamentoMensal, replicarOrcamento } from '@/actions/orcamento'

export function BudgetGrid({ categorias, orcamentos, ano }: { categorias: Categoria[], orcamentos: OrcamentoPrevisto[], ano: number }) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  // Mapping orcamentos for quick lookup
  const budgetMap = new Map<string, number>()
  orcamentos.forEach(o => {
    budgetMap.set(`${o.categoria_id}-${o.mes}`, o.valor_previsto)
  })

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shrink-0 h-full flex flex-col min-w-0 flex-1">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h2 className="text-lg font-semibold text-white">Configuração de Orçamento {ano}</h2>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-white/5 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 font-medium text-neutral-400 bg-neutral-900 border-b border-white/10 shadow-sm border-r sticky left-0 z-20 w-80">
                Categoria
              </th>
              {meses.map((m, i) => (
                <th key={m} className="px-4 py-3 font-medium text-neutral-400 text-center border-b border-white/10 border-r last:border-r-0 min-w-32">
                  {m}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-emerald-400 border-b border-white/10 bg-emerald-500/5 text-center min-w-32">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {categorias.map(cat => (
              <BudgetRow key={cat.id} categoria={cat} year={ano} budgetMap={budgetMap} level={0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BudgetRow({ 
  categoria, 
  year, 
  budgetMap,
  level = 0
}: { 
  categoria: Categoria, 
  year: number, 
  budgetMap: Map<string, number>,
  level?: number
}) {
  const isParent = categoria.tipo === 'RECEITA' || categoria.children && categoria.children.length > 0
  const [loading, setLoading] = useState(false)

  // A very simple implementation just for demonstration
  return (
    <>
      <tr className="hover:bg-white/5 transition-colors group">
        <td 
          className="px-4 py-3 font-medium sticky left-0 z-10 bg-neutral-900 group-hover:bg-[#1a1c23] transition-colors border-r border-white/10"
          style={{ paddingLeft: `${(level * 1) + 1}rem` }}
        >
          <div className="flex gap-2 items-center">
            <span className="text-neutral-500 font-mono text-xs w-8">{categoria.codigo_reduzido}</span>
            <span className={level === 0 ? "text-emerald-300 font-semibold" : "text-neutral-300"}>
              {categoria.nome_conta}
            </span>
          </div>
        </td>
        
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(mes => {
          const valorFormatado = budgetMap.get(`${categoria.id}-${mes}`) || 0
          return (
            <td key={mes} className="px-4 py-2 text-center border-r border-white/10 last:border-r-0">
              {isParent ? (
                <span className="text-neutral-500 text-sm font-mono block w-full text-right p-1.5 opacity-50">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFormatado)}
                </span>
              ) : (
                <EditableCell 
                  categoriaId={categoria.id} 
                  ano={year} 
                  mes={mes} 
                  initialValue={valorFormatado} 
                />
              )}
            </td>
          )
        })}
        
        <td className="px-4 py-2 text-center bg-emerald-500/5">
          {!isParent && (
            <ReplicateAction 
              categoriaId={categoria.id} 
              ano={year} 
              firstMonthValue={budgetMap.get(`${categoria.id}-1`) || 0} 
            />
          )}
        </td>
      </tr>
      
      {categoria.children?.map(child => (
        <BudgetRow key={child.id} categoria={child} year={year} budgetMap={budgetMap} level={level + 1} />
      ))}
    </>
  )
}

function EditableCell({ categoriaId, ano, mes, initialValue }: { categoriaId: string, ano: number, mes: number, initialValue: number }) {
  const [val, setVal] = useState(initialValue)
  const [isEditing, setIsEditing] = useState(false)

  const handleBlur = async () => {
    setIsEditing(false)
    if (val !== initialValue) {
      await updateOrcamentoMensal(categoriaId, ano, mes, val)
    }
  }

  return isEditing ? (
    <input
      type="number"
      value={val}
      onChange={e => setVal(Number(e.target.value))}
      onBlur={handleBlur}
      autoFocus
      className="w-full bg-white/10 border border-emerald-500/50 rounded px-2 py-1 text-right text-sm font-mono text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
    />
  ) : (
    <div 
      onClick={() => setIsEditing(true)}
      className="w-full cursor-pointer hover:bg-white/10 rounded px-2 py-1 text-right text-sm font-mono text-neutral-300 transition-colors"
    >
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
    </div>
  )
}

function ReplicateAction({ categoriaId, ano, firstMonthValue }: { categoriaId: string, ano: number, firstMonthValue: number }) {
  const [loading, setLoading] = useState(false)

  const handleReplicate = async () => {
    if (confirm(`Deseja replicar o valor de Jan (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(firstMonthValue)}) para o restante do ano? Isso sobrescreverá valores existentes.`)) {
      setLoading(true)
      await replicarOrcamento({
        categoria_id: categoriaId,
        ano,
        mes_inicio: 1,
        mes_fim: 12,
        valor_previsto: firstMonthValue
      })
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleReplicate}
      disabled={loading || firstMonthValue === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-700 rounded-lg text-xs font-medium transition-colors border border-white/5 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
      title="Replicar de Janeiro a Dezembro"
    >
      <Copy className="w-3.5 h-3.5" />
      Replicar
    </button>
  )
}
