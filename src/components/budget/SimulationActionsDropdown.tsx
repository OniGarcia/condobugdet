'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Edit2, Copy, Trash2, Loader2 } from 'lucide-react'
import { OrcamentoSimulacao } from '@/types'
import { deleteSimulacao } from '@/actions/orcamento'
import { RenameSimulationModal } from './RenameSimulationModal'
import { CloneSimulationModal } from './CloneSimulationModal'
import { useRouter } from 'next/navigation'

export function SimulationActionsDropdown({ simulacao }: { simulacao: OrcamentoSimulacao }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir a simulação "${simulacao.nome}"? TODOS os dados vinculados a ela serão apagados permanentemente.`)) return

    setIsDeleting(true)
    const res = await deleteSimulacao(simulacao.id)
    if (res.success) {
      router.push('/orcamento')
      router.refresh()
    } else {
      alert("Erro ao excluir: " + res.error)
    }
    setIsDeleting(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDeleting}
        className="p-2 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:text-white rounded-lg transition-all"
        title="Opções da Simulação"
      >
        {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MoreVertical className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1">
            <button 
              onClick={() => { setIsOpen(false); setShowRename(true); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:text-white hover:bg-white/60 dark:bg-white/5 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4 text-emerald-400" />
              Renomear Cenário
            </button>
            <button 
              onClick={() => { setIsOpen(false); setShowClone(true); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:text-white hover:bg-white/60 dark:bg-white/5 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4 text-indigo-400" />
              Clonar como Novo
            </button>
            
            <div className="h-px bg-white/60 dark:bg-white/5 my-1" />
            
            <button 
              onClick={handleDelete}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Excluir Simulação
            </button>
          </div>
        </div>
      )}

      {showRename && (
        <RenameSimulationModal 
          simulacao={simulacao} 
          onClose={() => setShowRename(false)} 
          onSuccess={() => router.refresh()} 
        />
      )}

      {showClone && (
        <CloneSimulationModal 
          simulacao={simulacao} 
          onClose={() => setShowClone(false)} 
        />
      )}
    </div>
  )
}
