import { getGlobalUsers } from '@/actions/users_mgmt'
import { getCondos } from '@/actions/condos'
import { validateMasterAccess } from '@/lib/supabase/validateAccess'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  await validateMasterAccess()
  const [users, condos] = await Promise.all([getGlobalUsers(), getCondos()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Gerencie todos os usuários e seus acessos a condomínios
        </p>
      </div>
      <UsersClient users={users} condos={condos} />
    </div>
  )
}
