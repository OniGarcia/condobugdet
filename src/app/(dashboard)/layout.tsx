import { ReactNode } from 'react';
import { getCurrentCondo, logout, getCurrentUser } from '@/actions/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from './DashboardShell';

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
    <DashboardShell
      currentCondo={currentCondo}
      currentUser={currentUser}
      isMaster={isMaster}
      logoutAction={logout}
    >
      {children}
    </DashboardShell>
  );
}
