'use client'

import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { createSimulacao } from '@/actions/orcamento'
import { useRouter } from 'next/navigation'

export function CreateSimulationModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [mesInicio, setMesInicio] = useState(1)
  const [anoInicio, setAnoInicio] = useState(new Date().getFullYear())
  const [duracao, setDuracao] = useState(12) // em meses

  const mesesOptions = [
    {val: 1, label: 'Janeiro'}, {val: 2, label: 'Fevereiro'},
    {val: 3, label: 'Março'}, {val: 4, label: 'Abril'},
    {val: 5, label: 'Maio'}, {val: 6, label: 'Junho'},
    {val: 7, label: 'Julho'}, {val: 8, label: 'Agosto'},
    {val: 9, label: 'Setembro'}, {val: 10, label: 'Outubro'},
    {val: 11, label: 'Novembro'}, {val: 12, label: 'Dezembro'},
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const res = await createSimulacao(nome, mesInicio, anoInicio, duracao)
    setIsLoading(false)

    if (res.success && res.simulacao) {
      setIsOpen(false)
      // reset form
      setNome('')
      setMesInicio(1)
      setDuracao(12)
      // Navigate to new simulation
      router.push(`/orcamento?simulacao=${res.simulacao.id}`)
    } else {
      alert("Erro ao criar simulação: " + res.error)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 text-white hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors border border-white/10 shadow-sm"
      >
        <Plus className="w-4 h-4 text-emerald-400" />
        Nova Simulação
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && setIsOpen(false)} />
          <div className="relative bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nova Simulação</h3>
              <button 
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Nome do Período/Cenário</label>
                <input 
                  type="text" 
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Orçamento Base 2026"
                  className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-neutral-600"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Mês Inicial</label>
                  <select 
                    value={mesInicio}
                    onChange={e => setMesInicio(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    {mesesOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Ano Inicial</label>
                  <input 
                    type="number" 
                    required
                    value={anoInicio}
                    onChange={e => setAnoInicio(Number(e.target.value))}
                    min={2020}
                    max={2050}
                    className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Duração (Meses)</label>
                <input 
                  type="number" 
                  required
                  value={duracao}
                  onChange={e => setDuracao(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={120}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-transparent border border-white/10 hover:bg-white/5 text-white font-medium rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/20 transition-all border border-emerald-400 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Período'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
