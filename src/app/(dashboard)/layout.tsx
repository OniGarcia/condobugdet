import { ReactNode } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Wallet, Settings, FileText, Boxes } from 'lucide-react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar - Glassmorphism */}
      <aside className="w-64 border-r border-white/10 bg-white/5 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CondoBudget
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5">
          <Link 
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link 
            href="/orcamento"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Wallet className="w-4 h-4" />
            Orçamento Previsto
          </Link>
          <Link 
            href="/realizado"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Wallet className="w-4 h-4 text-indigo-400" />
            Fluxo Realizado
          </Link>
          
          <div className="pt-6 pb-2">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Configurações</p>
          </div>
          
          <Link
            href="/categorias"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Settings className="w-4 h-4" />
            Plano de Contas
          </Link>
          <Link
            href="/centros-custo"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Boxes className="w-4 h-4" />
            Centros de Custo
          </Link>

          <div className="pt-6 pb-2">
            <p className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Análises</p>
          </div>

          <Link
            href="/relatorios"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <FileText className="w-4 h-4" />
            Relatórios
          </Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 min-h-screen relative p-8">
        {/* Background glow effects - No Print */}
        <div className="no-print absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="no-print absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        {children}
      </main>
    </div>
  );
}
