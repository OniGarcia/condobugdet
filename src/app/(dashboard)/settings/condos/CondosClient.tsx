'use client'

import { useState } from 'react'
import { Building2, Plus, Pencil, ToggleLeft, ToggleRight, X, Users } from 'lucide-react'
import { createCondo, updateCondo, toggleCondoStatus } from '@/actions/condos'
import type { CondoWithMembers, MemberRole } from '@/types/tenant'
import type { GlobalUser } from '@/actions/users_mgmt'

const roleLabels: Record<MemberRole, string> = {
  admin: 'Super Admin',
  gestor: 'Gestor',
  visualizador: 'Visualizador',
}

interface MemberEntry {
  userId: string
  role: MemberRole
}

function UserMembershipList({
  users,
  selected,
  onChange,
}: {
  users: GlobalUser[]
  selected: MemberEntry[]
  onChange: (entries: MemberEntry[]) => void
}) {
  function isSelected(userId: string) {
    return selected.some((s) => s.userId === userId)
  }

  function toggle(userId: string) {
    if (isSelected(userId)) {
      onChange(selected.filter((s) => s.userId !== userId))
    } else {
      onChange([...selected, { userId, role: 'visualizador' }])
    }
  }

  function changeRole(userId: string, newRole: MemberRole) {
    onChange(selected.map((s) => s.userId === userId ? { ...s, role: newRole } : s))
  }

  if (users.length === 0) {
    return <p className="text-xs text-neutral-500">Nenhum usuário cadastrado.</p>
  }

  return (
    <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
      {users.map((u) => {
        const checked = isSelected(u.id)
        return (
          <li
            key={u.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer ${checked ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/5 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
            onClick={() => toggle(u.id)}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(u.id)}
              onClick={(e) => e.stopPropagation()}
              className="accent-sky-500 w-4 h-4 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-800 dark:text-neutral-100 truncate">{u.nome ?? u.email}</p>
              {u.nome && <p className="text-xs text-neutral-500 truncate">{u.email}</p>}
            </div>
            {checked && (
              <div onClick={(e) => e.stopPropagation()}>
                <select
                  value={selected.find((s) => s.userId === u.id)?.role}
                  onChange={(e) => changeRole(u.id, e.target.value as MemberRole)}
                  className="px-2 py-1 rounded-lg bg-white/60 dark:bg-white/5 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-700 dark:text-sky-300 outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="visualizador">Visualizador</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CreateCondoModal({
  users,
  onClose,
}: {
  users: GlobalUser[]
  onClose: () => void
}) {
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [memberships, setMemberships] = useState<MemberEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createCondo(nome, cnpj || null, memberships)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Novo Condomínio</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dados</p>
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Nome do condomínio"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Acessos ({memberships.length} selecionado{memberships.length !== 1 ? 's' : ''})
            </p>
            <UserMembershipList users={users} selected={memberships} onChange={setMemberships} />
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditCondoModal({
  condo,
  users,
  onClose,
}: {
  condo: CondoWithMembers
  users: GlobalUser[]
  onClose: () => void
}) {
  const [nome, setNome] = useState(condo.nome)
  const [cnpj, setCnpj] = useState(condo.cnpj ?? '')
  const [memberships, setMemberships] = useState<MemberEntry[]>(
    condo.memberships.map((m) => ({ userId: m.user_id, role: m.role }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await updateCondo(condo.id, { nome, cnpj: cnpj || null }, memberships)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Editar Condomínio</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dados</p>
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">CNPJ</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Acessos ({memberships.length} selecionado{memberships.length !== 1 ? 's' : ''})
            </p>
            <UserMembershipList users={users} selected={memberships} onChange={setMemberships} />
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CondoRow({
  condo,
  users,
}: {
  condo: CondoWithMembers
  users: GlobalUser[]
}) {
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  async function handleToggle() {
    setLoading(true)
    await toggleCondoStatus(condo.id, !condo.ativo)
    setLoading(false)
  }

  return (
    <>
      <li className="flex items-center gap-4 px-6 py-4">
        <div className="w-9 h-9 rounded-lg bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{condo.nome}</p>
          {condo.cnpj && (
            <p className="text-xs text-neutral-500 font-mono">{condo.cnpj}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-neutral-500 flex-shrink-0">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs">{condo.memberships.length}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${condo.ativo ? 'bg-sky-500/10 text-sky-400' : 'bg-neutral-200 dark:bg-neutral-700/50 text-neutral-500'}`}>
          {condo.ativo ? 'Ativo' : 'Inativo'}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditOpen(true)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:bg-white/5 transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${condo.ativo ? 'text-sky-500 hover:text-amber-400 hover:bg-amber-400/10' : 'text-neutral-500 hover:text-sky-400 hover:bg-sky-400/10'}`}
            title={condo.ativo ? 'Desativar' : 'Ativar'}
          >
            {condo.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
        </div>
      </li>
      {editOpen && (
        <EditCondoModal condo={condo} users={users} onClose={() => setEditOpen(false)} />
      )}
    </>
  )
}

export function CondosClient({
  condos,
  users,
}: {
  condos: CondoWithMembers[]
  users: GlobalUser[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'ativo' | 'inativo'>('all')

  const filtered = condos.filter((c) => {
    if (filter === 'ativo') return c.ativo
    if (filter === 'inativo') return !c.ativo
    return true
  })

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Condomínio
        </button>

        <div className="flex gap-2 ml-auto">
          {(['all', 'ativo', 'inativo'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/60 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
            >
              {f === 'all' ? 'Todos' : f === 'ativo' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
          <span className="text-xs text-neutral-500 self-center ml-2">
            {filtered.length} condomínio{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {createOpen && <CreateCondoModal users={users} onClose={() => setCreateOpen(false)} />}

      <div className="bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Nenhum condomínio encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-white/5">
            {filtered.map((condo) => (
              <CondoRow key={condo.id} condo={condo} users={users} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
