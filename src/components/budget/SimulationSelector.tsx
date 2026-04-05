'use client'

import { OrcamentoSimulacao } from '@/types'
import { useRouter, useSearchParams } from 'next/navigation'

export function SimulationSelector({ simulacoes, selectedId, targetPath = '/orcamento' }: { simulacoes: OrcamentoSimulacao[], selectedId?: string, targetPath?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (!simulacoes || simulacoes.length === 0) return null

  return (
    <select
      value={selectedId || ''}
      onChange={(e) => {
        if (e.target.value) {
          const params = new URLSearchParams(searchParams.toString())
          params.set('simulacao', e.target.value)
          router.push(`${targetPath}?${params.toString()}`)
        }
      }}
      className="w-full bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
      title="Escolha a Simulação"
    >
      {simulacoes.map(s => (
        <option key={s.id} value={s.id} className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white">
          {s.nome} ({String(s.mes_inicio).padStart(2,'0')}/{s.ano_inicio} a {String(s.mes_fim).padStart(2,'0')}/{s.ano_fim})
        </option>
      ))}
    </select>
  )
}
