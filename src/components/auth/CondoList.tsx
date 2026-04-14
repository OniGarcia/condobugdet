'use client'

import { useTransition } from 'react'
import { Building2, ChevronRight, Loader2 } from 'lucide-react'
import { selectCondo } from '@/actions/auth'
import type { CondoWithRole } from '@/types/tenant'

interface CondoListProps {
  condos: CondoWithRole[]
}

export function CondoList({ condos }: CondoListProps) {
  const [isPending, startTransition] = useTransition()

  const handleSelect = (condoId: string) => {
    startTransition(async () => {
      await selectCondo(condoId)
    })
  }

  return (
    <div className="relative">
      {isPending && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-950/60 backdrop-blur-sm rounded-xl transition-all duration-300">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mb-3" />
          <p className="text-sm font-medium text-neutral-100 animate-pulse">Carregando dados...</p>
          <p className="text-xs text-neutral-400 mt-1">Preparando seu ambiente</p>
        </div>
      )}

      <div className="space-y-2">
        {condos.map((condo) => (
          <button
            key={condo.id}
            onClick={() => handleSelect(condo.id)}
            disabled={isPending}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-500/20 to-violet-500/20 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-100 truncate">{condo.nome}</p>
              <p className="text-xs text-neutral-500 capitalize">{condo.role}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
