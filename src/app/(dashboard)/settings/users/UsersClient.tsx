'use client'

import { useState, useMemo } from 'react'
import { User, Building2, X, Search, Plus, Trash2, Crown, UserPlus, Ban } from 'lucide-react'
import {
  assignCondoToUser,
  removeMembershipFromUser,
  updateUserProfile,
  toggleUserMaster,
  createUser,
  deactivateUser,
} from '@/actions/users_mgmt'
import type { GlobalUser } from '@/actions/users_mgmt'
import type { Condo, MemberRole } from '@/types/tenant'

const roleLabels: Record<MemberRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Visualizador',
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createUser({ email, nome, senha })
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="text-base font-semibold mb-3 text-emerald-400">Usuário criado!</h3>
          <div className="space-y-3 text-sm mb-4">
            <div>
              <p className="text-neutral-600 dark:text-neutral-400">Nome</p>
              <p className="text-neutral-800 dark:text-neutral-100">{nome}</p>
            </div>
            <div>
              <p className="text-neutral-600 dark:text-neutral-400">E-mail</p>
              <p className="text-neutral-800 dark:text-neutral-100 font-mono">{email}</p>
            </div>
            <div>
              <p className="text-neutral-600 dark:text-neutral-400">Senha inicial</p>
              <p className="text-neutral-800 dark:text-neutral-100 font-mono bg-white/60 dark:bg-white/5 px-3 py-2 rounded-lg">{senha}</p>
              <p className="text-xs text-amber-400 mt-1">Informe ao usuário. Ele pode alterar após o primeiro acesso.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Novo Usuário</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Nome *</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">E-mail *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="nome@email.com"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Senha inicial *</label>
            <input
              type="text"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Mínimo 6 caracteres"
            />
            <p className="text-xs text-neutral-500 mt-1">Anote para entregar ao usuário</p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignCondoModal({
  user,
  condos,
  onClose,
}: {
  user: GlobalUser
  condos: Condo[]
  onClose: () => void
}) {
  const [condoId, setCondoId] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableCondos = condos.filter(
    (c) => c.ativo && !user.memberships.some((m) => m.condo_id === c.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!condoId) return
    setLoading(true)
    setError(null)
    const result = await assignCondoToUser(user.id, condoId, role)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Atribuir Condomínio</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Usuário: <span className="text-neutral-800 dark:text-neutral-200 font-medium">{user.nome ?? user.email}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Condomínio</label>
            <select
              required
              value={condoId}
              onChange={(e) => setCondoId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Selecione...</option>
              {availableCondos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {availableCondos.length === 0 && (
              <p className="text-xs text-neutral-500 mt-1">Usuário já tem acesso a todos os condomínios ativos.</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Papel</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !condoId || availableCondos.length === 0}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Atribuir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UserDetailModal({
  user,
  condos,
  onClose,
}: {
  user: GlobalUser
  condos: Condo[]
  onClose: () => void
}) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [loadingRemove, setLoadingRemove] = useState<string | null>(null)
  const [loadingMaster, setLoadingMaster] = useState(false)
  const [loadingDeactivate, setLoadingDeactivate] = useState(false)
  const [nome, setNome] = useState(user.nome ?? '')
  const [cargo, setCargo] = useState(user.cargo ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  async function handleRemoveMembership(condoId: string) {
    if (!confirm('Remover acesso a este condomínio?')) return
    setLoadingRemove(condoId)
    await removeMembershipFromUser(user.id, condoId)
    setLoadingRemove(null)
  }

  async function handleToggleMaster() {
    setLoadingMaster(true)
    await toggleUserMaster(user.id, !user.is_master)
    setLoadingMaster(false)
    onClose()
  }

  async function handleDeactivate() {
    if (!confirm(`Desativar o usuário "${user.nome ?? user.email}"? Ele perderá o acesso ao sistema.`)) return
    setLoadingDeactivate(true)
    const result = await deactivateUser(user.id)
    setLoadingDeactivate(false)
    if (result?.error) {
      alert(result.error)
    } else {
      onClose()
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const result = await updateUserProfile(user.id, { nome, cargo })
    setSavingProfile(false)
    setProfileMsg(result?.error ? result.error : 'Salvo!')
    setTimeout(() => setProfileMsg(null), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">{user.nome ?? user.email}</h3>
              <p className="text-xs text-neutral-500">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {user.is_master && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                  <Crown className="w-3 h-3" /> Master
                </span>
              )}
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Perfil */}
          <form onSubmit={handleSaveProfile} className="space-y-3 mb-6 pb-6 border-b border-neutral-200 dark:border-white/10">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Perfil</p>
            <div>
              <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex: Síndico, Administrador..."
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-neutral-900 dark:text-white text-xs font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </button>
              {profileMsg && <p className="text-xs text-emerald-400">{profileMsg}</p>}
            </div>
          </form>

          {/* Condomínios */}
          <div className="mb-6 pb-6 border-b border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Condomínios</p>
              <button
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Atribuir
              </button>
            </div>
            {user.memberships.length === 0 ? (
              <p className="text-sm text-neutral-500">Sem acesso a condomínios.</p>
            ) : (
              <ul className="space-y-2">
                {user.memberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 bg-white/60 dark:bg-white/5 rounded-xl px-3 py-2.5">
                    <Building2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{m.condo_nome}</p>
                      <p className="text-xs text-neutral-500">{roleLabels[m.role]}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveMembership(m.condo_id)}
                      disabled={loadingRemove === m.condo_id}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      title="Remover acesso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Super Admin */}
          <div className="mb-6 pb-6 border-b border-neutral-200 dark:border-white/10">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Super Admin</p>
            <button
              onClick={handleToggleMaster}
              disabled={loadingMaster}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${user.is_master ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20' : 'bg-white/60 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20'}`}
            >
              <Crown className="w-4 h-4" />
              {user.is_master ? 'Remover Master' : 'Tornar Master'}
            </button>
          </div>

          {/* Desativar */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Zona de Perigo</p>
            <button
              onClick={handleDeactivate}
              disabled={loadingDeactivate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              {loadingDeactivate ? 'Desativando...' : 'Desativar Usuário'}
            </button>
            <p className="text-xs text-neutral-600 mt-2">O usuário perderá acesso ao sistema.</p>
          </div>
        </div>
      </div>

      {assignOpen && (
        <AssignCondoModal user={user} condos={condos} onClose={() => setAssignOpen(false)} />
      )}
    </>
  )
}

export function UsersClient({ users, condos }: { users: GlobalUser[]; condos: Condo[] }) {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.nome ?? '').toLowerCase().includes(q)
    )
  }, [users, search])

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center gap-2">
          <User className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {filtered.length} usuário{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-white/5">
            {filtered.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/60 dark:bg-white/5 cursor-pointer transition-colors"
                onClick={() => setSelectedUser(user)}
              >
                <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  {(user.nome ?? user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">
                      {user.nome ?? user.email}
                    </p>
                    {user.is_master && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" title="Super Admin" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-xs text-neutral-500">{user.memberships.length}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          condos={condos}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  )
}
