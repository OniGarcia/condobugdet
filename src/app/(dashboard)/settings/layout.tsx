import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCondo } from '@/actions/auth'
import { SettingsTabs } from './SettingsTabs'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isMaster = false
  let isAdmin = false

  if (user) {
    const [profileResult, condo] = await Promise.all([
      supabase.from('profiles').select('is_master').eq('id', user.id).single(),
      getCurrentCondo(),
    ])
    isMaster = profileResult.data?.is_master ?? false
    isAdmin = condo?.role === 'admin'
  }

  return (
    <div className="space-y-6">
      <SettingsTabs isMaster={isMaster} isAdmin={isAdmin} />
      {children}
    </div>
  )
}
