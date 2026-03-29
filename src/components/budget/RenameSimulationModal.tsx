'use client'

import { useState } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import { updateSimulacaoNome } from '@/actions/orcamento'
import { OrcamentoSimulacao } from '@/types'

export function RenameSimulationModal({ 
  simulacao, 
  onClose, 
  onSuccess 
}: { 
  simulacao: OrcamentoSimulacao, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [nome, setNome] = useState(simulacao.nome)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setIsSaving(true)
    const res = await updateSimulacaoNome(simulacao.id, nome)
    if (res.success) {
      onSuccess()
      onClose()
    } else {
      alert("Erro ao renomear: " + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-xl font-bold text-white">Renomear Simulação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Novo Nome</label>
            <input 
              type="text" 
              required
              autoFocus
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Orçamento Revisado v2"
              className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-all border border-white/5"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving || !nome.trim() || nome === simulacao.nome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Salvando...' : 'Salvar Nome'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
