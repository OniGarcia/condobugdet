'use client'

import { useState, useEffect, useCallback, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import SidebarClient from './SidebarClient'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { CondoWithRole } from '@/types/tenant'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  children: ReactNode
  currentCondo: CondoWithRole | null
  currentUser: SupabaseUser | null
  isMaster: boolean
  logoutAction: () => Promise<void>
}

export default function DashboardShell({
  children,
  currentCondo,
  currentUser,
  isMaster,
  logoutAction
}: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [navState, setNavState] = useState<'idle' | 'loading' | 'done'>('idle')
  const pathname = usePathname()

  // Load initial state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
    setIsLoaded(true)
  }, [])

  // When pathname changes, complete the progress bar
  useEffect(() => {
    setNavState(current => current === 'loading' ? 'done' : current)
  }, [pathname])

  // After completion, reset to idle
  useEffect(() => {
    if (navState !== 'done') return
    const t = setTimeout(() => setNavState('idle'), 400)
    return () => clearTimeout(t)
  }, [navState])

  const handleNavigate = useCallback(() => setNavState('loading'), [])

  // Persist state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  // Prevent layout jump by only rendering after load
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-sky-500/30">
        <div className="w-64 border-r border-neutral-200 dark:border-white/10 shrink-0" />
        <main className="flex-1 min-h-screen p-8" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-background text-foreground flex font-sans selection:bg-sky-500/30 overflow-hidden">
      <SidebarClient
        currentCondo={currentCondo}
        currentUser={currentUser}
        isMaster={isMaster}
        logoutAction={logoutAction}
        isCollapsed={isCollapsed}
        onToggle={toggleCollapsed}
        onNavigate={handleNavigate}
      />

      <main
        className={cn(
          "flex-1 h-screen overflow-y-auto relative transition-all duration-300 ease-in-out",
          isCollapsed ? "ml-20" : "ml-64"
        )}
      >
        {/* Background glow effects - No Print */}
        <div className="no-print fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="no-print fixed bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className={cn(
          "p-8 min-h-full flex flex-col transition-[filter,opacity] duration-200",
          navState === 'loading' && "blur-sm opacity-50 pointer-events-none select-none"
        )}>
          {children}
        </div>

        {/* Shimmer overlay durante navegação */}
        {navState === 'loading' && (
          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
            <div className="absolute inset-0 -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/8 dark:via-white/5 to-transparent" />
          </div>
        )}
      </main>
    </div>
  )
}
