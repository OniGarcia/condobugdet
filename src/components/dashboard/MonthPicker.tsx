'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Month {
  ano: number
  mes: number
}

interface MonthPickerProps {
  currentAno: number
  currentMes: number
  availableMonths: Month[]
  onChange: (ano: number, mes: number) => void
}

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function MonthPicker({
  currentAno,
  currentMes,
  availableMonths,
  onChange,
}: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewAno, setViewAno] = useState(currentAno)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sincronizar viewAno com currentAno quando abrir
  useEffect(() => {
    if (isOpen) setViewAno(currentAno)
  }, [isOpen, currentAno])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const availableYears = Array.from(new Set(availableMonths.map(m => m.ano))).sort()
  const isMonthAvailable = (ano: number, mes: number) => 
    availableMonths.some(m => m.ano === ano && m.mes === mes)

  const handleMonthClick = (mes: number) => {
    if (isMonthAvailable(viewAno, mes)) {
      onChange(viewAno, mes)
      setIsOpen(false)
    }
  }

  const label = `${MESES_ABR[currentMes - 1]}/${currentAno}`

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-1.5 transition-all hover:bg-neutral-100 dark:hover:bg-white/10",
          isOpen && "ring-2 ring-sky-500/50 border-sky-500/50"
        )}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-sky-500" />
        <span className="text-sm font-bold text-sky-600 dark:text-sky-400 tabular-nums">
          {label}
        </span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-[100] min-w-[280px] bg-white/90 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 p-4 animate-in fade-in zoom-in duration-200">
          
          {/* Header Popover: Ano */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setViewAno(v => v - 1)}
              disabled={!availableYears.includes(viewAno - 1)}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-neutral-500" />
            </button>
            
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
              {viewAno}
            </span>

            <button
              onClick={() => setViewAno(v => v + 1)}
              disabled={!availableYears.includes(viewAno + 1)}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* Grid de Meses */}
          <div className="grid grid-cols-3 gap-2">
            {MESES_ABR.map((mesNome, index) => {
              const mesNum = index + 1
              const available = isMonthAvailable(viewAno, mesNum)
              const selected = currentAno === viewAno && currentMes === mesNum

              return (
                <button
                  key={mesNome}
                  disabled={!available}
                  onClick={() => handleMonthClick(mesNum)}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-medium transition-all",
                    available 
                      ? selected
                        ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                        : "hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 text-neutral-700 dark:text-neutral-300"
                      : "text-neutral-300 dark:text-neutral-700 cursor-not-allowed"
                  )}
                >
                  {mesNome}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
