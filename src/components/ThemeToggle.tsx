'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="w-8 h-8" />

  const options = [
    { value: 'light', icon: Sun, label: 'Claro' },
    { value: 'dark', icon: Moon, label: 'Escuro' },
    { value: 'system', icon: Monitor, label: 'Sistema' },
  ] as const

  const current = options.find(o => o.value === theme) ?? options[2]
  const Icon = current.icon

  const cycle = () => {
    const idx = options.findIndex(o => o.value === theme)
    setTheme(options[(idx + 1) % options.length].value)
  }

  return (
    <button
      onClick={cycle}
      title={`Tema: ${current.label}`}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all w-full"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{current.label}</span>
    </button>
  )
}
