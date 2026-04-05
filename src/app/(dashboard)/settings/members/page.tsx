import { Users, Shield, Eye, Pencil } from 'lucide-react'
import { getMembers } from '@/actions/members'
import { InviteButton, MemberActions } from './MembersClient'

const roleLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-emerald-400' },
  editor: { label: 'Editor', icon: Pencil, color: 'text-indigo-400' },
  viewer: { label: 'Visualizador', icon: Eye, color: 'text-neutral-600 dark:text-neutral-400' },
}

export default async function MembersPage() {
  const members = await getMembers()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Gerencie quem tem acesso a este condomínio
          </p>
        </div>
        <InviteButton />
      </div>

      <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{members.length} membro{members.length !== 1 ? 's' : ''}</span>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Nenhum membro encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-white/5">
            {members.map((m) => {
              const roleInfo = roleLabels[m.role] ?? roleLabels.viewer
              const RoleIcon = roleInfo.icon
              return (
                <li key={m.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {(m.profiles?.nome ?? 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                      {m.profiles?.nome ?? 'Usuário'}
                    </p>
                    {m.profiles?.cargo && (
                      <p className="text-xs text-neutral-500 truncate">{m.profiles.cargo}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${roleInfo.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {roleInfo.label}
                  </div>
                  <MemberActions membershipId={m.id} currentRole={m.role} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
