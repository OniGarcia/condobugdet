'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { createSimulacao } from '@/actions/orcamento'
import { getCentrosCusto } from '@/actions/centrosCusto'
import { CentroCusto } from '@/types'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export function CreateSimulationModal({ highlight = false }: { highlight?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [mesInicio, setMesInicio] = useState(1)
  const [anoInicio, setAnoInicio] = useState(new Date().getFullYear())
  const [duracao, setDuracao] = useState(12)
  const [centroCustoId, setCentroCustoId] = useState('')
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([])
  const [loadingCC, setLoadingCC] = useState(false)

  const mesesOptions = [
    {val: 1, label: 'Janeiro'}, {val: 2, label: 'Fevereiro'},
    {val: 3, label: 'Março'}, {val: 4, label: 'Abril'},
    {val: 5, label: 'Maio'}, {val: 6, label: 'Junho'},
    {val: 7, label: 'Julho'}, {val: 8, label: 'Agosto'},
    {val: 9, label: 'Setembro'}, {val: 10, label: 'Outubro'},
    {val: 11, label: 'Novembro'}, {val: 12, label: 'Dezembro'},
  ]

  useEffect(() => {
    if (!isOpen) return
    setLoadingCC(true)
    getCentrosCusto()
      .then(data => {
        setCentrosCusto(data)
        if (data.length === 1) setCentroCustoId(data[0].id)
      })
      .catch(() => setCentrosCusto([]))
      .finally(() => setLoadingCC(false))
  }, [isOpen])

  const handleClose = () => {
    if (isLoading) return
    setIsOpen(false)
    setNome('')
    setMesInicio(1)
    setDuracao(12)
    setCentroCustoId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!centroCustoId) return
    setIsLoading(true)
    const res = await createSimulacao(nome, mesInicio, anoInicio, duracao, centroCustoId)
    setIsLoading(false)

    if (res.success && res.simulacao) {
      handleClose()
      router.push(`/orcamento?simulacao=${res.simulacao.id}`)
    } else {
      alert("Erro ao criar simulação: " + res.error)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm",
          highlight 
            ? "bg-sky-600 hover:bg-sky-500 text-white border border-sky-400 shadow-sky-500/20"
            : "bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10"
        )}
      >
        <Plus className={cn("w-4 h-4", highlight ? "text-white" : "text-sky-400")} />
        Nova Simulação
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Nova Simulação</h3>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white hover:bg-white/60 dark:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Nome do Período/Cenário</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Orçamento Base 2026"
                  className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-all placeholder:text-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Centro de Custo <span className="text-red-400">*</span>
                </label>
                {loadingCC ? (
                  <div className="flex items-center gap-2 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando centros de custo...
                  </div>
                ) : centrosCusto.length === 0 ? (
                  <p className="text-sm text-amber-500 py-1">
                    Nenhum centro de custo cadastrado. Cadastre um antes de criar uma simulação.
                  </p>
                ) : (
                  <select
                    required
                    value={centroCustoId}
                    onChange={e => setCentroCustoId(e.target.value)}
                    className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                  >
                    <option value="" disabled>Selecione o centro de custo...</option>
                    {centrosCusto.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.nome}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Mês Inicial</label>
                  <select
                    value={mesInicio}
                    onChange={e => setMesInicio(Number(e.target.value))}
                    className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                  >
                    {mesesOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Ano Inicial</label>
                  <input
                    type="number"
                    required
                    value={anoInicio}
                    onChange={e => setAnoInicio(Number(e.target.value))}
                    min={2020}
                    max={2050}
                    className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Duração (Meses)</label>
                <input
                  type="number"
                  required
                  value={duracao}
                  onChange={e => setDuracao(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={120}
                  className="w-full bg-black/40 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-sky-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-transparent border border-neutral-200 dark:border-white/10 hover:bg-white/60 dark:bg-white/5 text-neutral-900 dark:text-white font-medium rounded-lg transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !centroCustoId || centrosCusto.length === 0}
                  className="flex-1 px-4 py-2.5 flex justify-center items-center gap-2 bg-sky-500 hover:bg-sky-600 text-neutral-900 dark:text-white font-medium rounded-lg shadow-lg shadow-sky-500/20 transition-all border border-sky-400 disabled:opacity-50"
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
