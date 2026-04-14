'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Wallet, Settings, FileText, Boxes,
  TrendingUp, LogOut, Building2, User, UserCog, Pickaxe,
  Crown, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
  ClipboardList,
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
  isCollapsed: boolean
  onToggle: () => void
}

export default function SidebarClient({ 
  currentCondo, 
  currentUser, 
  isMaster,
  logoutAction,
  isCollapsed,
  onToggle
}: SidebarClientProps) {
  const pathname = usePathname()
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    config: false,
    admin: false
  })

  const toggleSection = (section: string) => {
    if (isCollapsed) return // Don't expand sections when collapsed
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const NavLink = ({ href, icon: Icon, children }: { href: string, icon: any, children: string }) => {
    const isActive = pathname === href
    return (
      <div className="relative group/link">
        <Link 
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all outline-none",
            isActive 
              ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400"
              : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-white/60 dark:bg-white/5",
            isCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
          )}
        >
          <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-sky-600 dark:text-sky-400" : "text-neutral-500 dark:text-neutral-400")} />
          <span className={cn(
            "transition-all duration-300 whitespace-nowrap overflow-hidden",
            isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}>
            {children}
          </span>
        </Link>
        
        {/* Tooltip */}
        {isCollapsed && (
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded shadow-lg opacity-0 pointer-events-none group-hover/link:opacity-100 transition-opacity z-[100] whitespace-nowrap">
            {children}
          </div>
        )}
      </div>
    )
  }

  const SectionHeader = ({ id, label, icon: Icon }: { id: string, label: string, icon?: any }) => {
    const isExpanded = expanded[id]
    if (isCollapsed) {
      return (
        <div className="relative group/section py-2 flex justify-center border-t border-neutral-200 dark:border-white/5 mt-4">
           <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">...</span>
           <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded shadow-lg opacity-0 pointer-events-none group-hover/section:opacity-100 transition-opacity z-[100] whitespace-nowrap">
            {label}
          </div>
        </div>
      )
    }

    return (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-3 py-2 mt-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-800 dark:hover:text-neutral-700 dark:text-neutral-300 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        {!isCollapsed && (
          isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 transition-transform" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 transition-transform" />
          )
        )}
      </button>
    )
  }

  return (
    <aside 
      className={cn(
        "border-r border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header / Logo */}
      <div className={cn(
        "px-3 py-4 flex items-center gap-1.5 border-b border-neutral-200 dark:border-white/10 shrink-0 h-16 transition-all duration-300",
        isCollapsed ? "justify-center" : "px-4"
      )}>
        <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-lg shrink-0" />
        {!isCollapsed && (
          <h1 className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-800 to-neutral-500 dark:from-white dark:to-white/60 truncate">
            CondoBudget
          </h1>
        )}
        
        <button 
          onClick={onToggle}
          className={cn(
            "p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors ml-auto",
            isCollapsed && "absolute -right-3 top-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 shadow-sm z-[60]"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Condomínio Ativo */}
      <div className="shrink-0 overflow-hidden">
        {currentCondo && (
          <Link
            href="/select-condo"
            className={cn(
              "mx-4 mt-4 flex items-center gap-2 p-2.5 rounded-xl transition-all group overflow-hidden border",
              "bg-sky-50 border-sky-200 hover:bg-sky-100 dark:bg-sky-500/10 dark:border-sky-500/20 dark:hover:bg-sky-500/15",
              isCollapsed && "mx-auto w-10 h-10 justify-center p-0"
            )}
            title={isCollapsed ? currentCondo.nome : ""}
          >
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sky-800 dark:text-sky-300 truncate">{currentCondo.nome}</p>
                <p className="text-xs text-sky-600 dark:text-sky-500 capitalize">{currentCondo.role}</p>
              </div>
            )}
          </Link>
        )}
      </div>
      
      {/* Navigation - Scrollable Area */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
        <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
        <NavLink href="/orcamento" icon={Wallet}>Orçamento Previsto</NavLink>
        <NavLink href="/realizado" icon={Wallet}>Fluxo Realizado</NavLink>
        <NavLink href="/forecast" icon={TrendingUp}>Fluxo Projetado</NavLink>
        <NavLink href="/aportes" icon={Pickaxe}>Aportes e Financiamentos</NavLink>
        <NavLink href="/prestacao-contas" icon={ClipboardList}>Prestação de Contas</NavLink>

        {/* CONFIGURAÇÕES */}
        {(currentCondo?.role === 'admin' || currentCondo?.role === 'gestor') && (
          <>
            <SectionHeader id="config" label="Configurações" />
            {(!isCollapsed && expanded.config) ? (
              <div className="ml-2 pl-2 border-l border-neutral-200 dark:border-white/5 space-y-1 mt-1">
                <NavLink href="/categorias" icon={Settings}>Plano de Contas</NavLink>
                <NavLink href="/centros-custo" icon={Boxes}>Centros de Custo</NavLink>
              </div>
            ) : isCollapsed && (
              <div className="flex flex-col gap-1 mt-1">
                <NavLink href="/categorias" icon={Settings}>Plano de Contas</NavLink>
                <NavLink href="/centros-custo" icon={Boxes}>Centros de Custo</NavLink>
              </div>
            )}
          </>
        )}

        {/* ADMINISTRAÇÃO */}
        {isMaster && (
          <>
            <SectionHeader id="admin" label="Administração" />
            {(!isCollapsed && expanded.admin) ? (
              <div className="ml-2 pl-2 border-l border-neutral-200 dark:border-white/5 space-y-1 mt-1">
                <NavLink href="/settings/condos" icon={Building2}>Condomínios</NavLink>
                <NavLink href="/settings/users" icon={UserCog}>Usuários</NavLink>
              </div>
            ) : isCollapsed && (
              <div className="flex flex-col gap-1 mt-1">
                <NavLink href="/settings/condos" icon={Building2}>Condomínios</NavLink>
                <NavLink href="/settings/users" icon={UserCog}>Usuários</NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer - User Info & Logout (Sempre Visível) */}
      <div className={cn(
        "p-4 border-t border-neutral-200 dark:border-white/10 space-y-3 shrink-0 bg-neutral-50 dark:bg-neutral-950/20",
        isCollapsed && "flex flex-col items-center"
      )}>
        {currentUser && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-none transition-all",
            isCollapsed ? "w-10 h-10 justify-center p-0" : "px-3 py-2.5"
          )}
          title={isCollapsed ? (currentUser.email || "") : ""}
          >
            <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate pr-1">
                    {currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                  </p>
                  {isMaster && <Crown className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-neutral-500 truncate">{currentUser.email}</p>
              </div>
            )}
          </div>
        )}
        <div className={cn(isCollapsed && "w-10 flex justify-center overflow-hidden")}>
           <ThemeToggle />
        </div>
        <form action={logoutAction} className="w-full flex justify-center">
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-900 dark:text-white dark:hover:bg-white/60 dark:bg-white/5 transition-all group w-full",
              isCollapsed && "justify-center px-0 w-10 h-10"
            )}
            title={isCollapsed ? "Sair" : ""}
          >
            <LogOut className="w-4 h-4 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
            <span className={cn(
              "transition-all duration-300 whitespace-nowrap overflow-hidden",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}>
              Sair
            </span>
          </button>
        </form>
      </div>
    </aside>
  )
}
