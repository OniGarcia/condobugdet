'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Wallet, Settings, FileText, Boxes,
  TrendingUp, LogOut, Building2, User, UserCog,
  Crown, ChevronDown, ChevronRight
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { CondoWithRole } from '@/types/tenant'
import { cn } from '@/lib/utils'

interface SidebarClientProps {
  currentCondo: CondoWithRole | null
  currentUser: SupabaseUser | null
  isMaster: boolean
  logoutAction: () => Promise<void>
}

export default function SidebarClient({ 
  currentCondo, 
  currentUser, 
  isMaster,
  logoutAction 
}: SidebarClientProps) {
  const pathname = usePathname()
  
  // Estados dos menus colapsáveis (todos iniciam FECHADOS por padrão)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    config: false,
    admin: false
  })

  const toggleSection = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const NavLink = ({ href, icon: Icon, children }: { href: string, icon: any, children: React.ReactNode }) => {
    const isActive = pathname === href
    return (
      <Link 
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all outline-none",
          isActive 
            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/60 dark:bg-white/5"
        )}
      >
        <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500 dark:text-neutral-400")} />
        {children}
      </Link>
    )
  }

  const SectionHeader = ({ id, label, icon: Icon }: { id: string, label: string, icon?: any }) => {
    const isExpanded = expanded[id]
    return (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-3 py-2 mt-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-800 dark:hover:text-neutral-700 dark:text-neutral-300 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 transition-transform" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 transition-transform" />
        )}
      </button>
    )
  }

  return (
    <aside className="w-64 border-r border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-50">
      {/* Header / Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-neutral-200 dark:border-white/10 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Wallet className="w-4 h-4 text-neutral-900 dark:text-white" />
        </div>
        <h1 className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-800 to-neutral-500 dark:from-white dark:to-white/60">
          CondoBudget
        </h1>
      </div>

      {/* Condomínio Ativo */}
      <div className="shrink-0">
        {currentCondo && (
          <Link
            href="/select-condo"
            className="mx-4 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500/15 transition-all group"
          >
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">{currentCondo.nome}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 capitalize">{currentCondo.role}</p>
            </div>
          </Link>
        )}
      </div>
      
      {/* Navigation - Scrollable Area */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
        <NavLink href="/orcamento" icon={Wallet}>Orçamento Previsto</NavLink>
        <NavLink href="/realizado" icon={Wallet}>Fluxo Realizado</NavLink>
        
        {/* CONFIGURAÇÕES */}
        <SectionHeader id="config" label="Configurações" />
        {expanded.config && (
          <div className="ml-2 pl-2 border-l border-neutral-200 dark:border-white/5 space-y-1 mt-1">
            <NavLink href="/categorias" icon={Settings}>Plano de Contas</NavLink>
            <NavLink href="/centros-custo" icon={Boxes}>Centros de Custo</NavLink>
          </div>
        )}

        {/* ADMINISTRAÇÃO */}
        {isMaster && (
          <>
            <SectionHeader id="admin" label="Administração" />
            {expanded.admin && (
              <div className="ml-2 pl-2 border-l border-neutral-200 dark:border-white/5 space-y-1 mt-1">
                <NavLink href="/settings/condos" icon={Building2}>Condomínios</NavLink>
                <NavLink href="/settings/users" icon={UserCog}>Usuários</NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer - User Info & Logout (Sempre Visível) */}
      <div className="p-4 border-t border-neutral-200 dark:border-white/10 space-y-3 shrink-0 bg-neutral-50 dark:bg-neutral-950/20">
        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none">
            <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate pr-1">
                  {currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                </p>
                {isMaster && <Crown className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />}
              </div>
              <p className="text-[10px] text-neutral-500 truncate">{currentUser.email}</p>
            </div>
          </div>
        )}
        <ThemeToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-900 dark:text-white dark:hover:bg-white/60 dark:bg-white/5 transition-all group"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
