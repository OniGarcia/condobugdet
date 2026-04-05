import { ReactNode } from 'react';
import { getCurrentCondo, logout, getCurrentUser } from '@/actions/auth';
import { createClient } from '@/lib/supabase/server';
import SidebarClient from './SidebarClient';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const [currentCondo, currentUser] = await Promise.all([
    getCurrentCondo(),
    getCurrentUser(),
  ])

  let isMaster = false
  if (authUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_master')
      .eq('id', authUser.id)
      .single()
    isMaster = profile?.is_master ?? false
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans selection:bg-indigo-500/30">
      <SidebarClient 
        currentCondo={currentCondo}
        currentUser={currentUser}
        isMaster={isMaster}
        logoutAction={logout}
      />

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
