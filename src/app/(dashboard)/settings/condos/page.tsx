import { getCondosWithMembers } from '@/actions/condos'
import { getGlobalUsers } from '@/actions/users_mgmt'
import { validateMasterAccess } from '@/lib/supabase/validateAccess'
import { CondosClient } from './CondosClient'

export default async function CondosPage() {
  await validateMasterAccess()
  const [condos, users] = await Promise.all([getCondosWithMembers(), getGlobalUsers()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Condomínios</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Gerencie os condomínios e os acessos dos usuários
        </p>
      </div>
      <CondosClient condos={condos} users={users} />
    </div>
  )
}
