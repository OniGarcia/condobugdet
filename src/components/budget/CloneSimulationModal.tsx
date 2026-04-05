'use client'

import { useState } from 'react'
import { X, Loader2, Copy } from 'lucide-react'
import { cloneSimulacao } from '@/actions/orcamento'
import { OrcamentoSimulacao } from '@/types'
import { useRouter } from 'next/navigation'

export function CloneSimulationModal({ 
  simulacao, 
  onClose 
}: { 
  simulacao: OrcamentoSimulacao, 
  onClose: () => void 
}) {
  const [nome, setNome] = useState(`${simulacao.nome} (Cópia)`)
  const [isCloning, setIsCloning] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setIsCloning(true)
    const res = await cloneSimulacao(simulacao.id, nome)
    if (res.success && res.id) {
      router.push(`/orcamento?simulacao=${res.id}`)
      onClose()
    } else {
      alert("Erro ao clonar: " + res.error)
    }
    setIsCloning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Clonar Simulação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/60 dark:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Isso criará um novo cenário com o mesmo período e **todos os valores** já preenchidos da simulação atual.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Nome da Nova Simulação</label>
            <input 
              type="text" 
              required
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Orçamento Cenário B"
              className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/60 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-900 dark:text-white font-medium rounded-lg transition-all border border-white/5"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isCloning || !nome.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-neutral-900 dark:text-white font-bold rounded-lg shadow-lg shadow-violet-500/20 transition-all border border-violet-400"
            >
              {isCloning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
              {isCloning ? 'Clonando...' : 'Criar Cópia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
