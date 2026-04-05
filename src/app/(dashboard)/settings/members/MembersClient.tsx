'use client'

import { useState } from 'react'
import { UserPlus, Trash2, ChevronDown } from 'lucide-react'
import { inviteMember, removeMember, updateMemberRole } from '@/actions/members'
import type { MemberRole } from '@/types/tenant'

function InviteButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('visualizador')
  const [tempPassword, setTempPassword] = useState('Mudar@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ email: string; password?: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await inviteMember(email, role, tempPassword)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccessInfo({
        email,
        password: result?.tempPassword,
      })
      setEmail('')
      setRole('visualizador')
      setTempPassword('Mudar@123')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Convidar Membro
      </button>

      {successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold mb-3 text-sky-400">Membro adicionado!</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-neutral-600 dark:text-neutral-400">E-mail</p>
                <p className="text-neutral-800 dark:text-neutral-100 font-mono">{successInfo.email}</p>
              </div>
              {successInfo.password && (
                <div>
                  <p className="text-neutral-600 dark:text-neutral-400">Senha temporária</p>
                  <p className="text-neutral-800 dark:text-neutral-100 font-mono bg-white/60 dark:bg-white/5 px-3 py-2 rounded-lg">{successInfo.password}</p>
                  <p className="text-xs text-amber-400 mt-1">Anote e envie ao usuário. Ele deve trocar a senha após o primeiro acesso.</p>
                </div>
              )}
              {!successInfo.password && (
                <p className="text-neutral-600 dark:text-neutral-400">Usuário já existente. Ele pode acessar com a senha atual.</p>
              )}
            </div>
            <button
              onClick={() => { setSuccessInfo(null); setOpen(false) }}
              className="w-full mt-4 px-4 py-2.5 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold mb-4">Convidar Membro</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="nome@email.com"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Papel</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="visualizador">Visualizador — Somente leitura</option>
                  <option value="gestor">Gestor — Edita orçamentos e realizado</option>
                  <option value="admin">Super Admin — Controle total + convites</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">Senha temporária</label>
                <input
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-sm text-neutral-800 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Mudar@123"
                />
                <p className="text-xs text-neutral-500 mt-1">O usuário deve trocar após o primeiro acesso</p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-white/60 dark:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sky-500 text-neutral-900 dark:text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function MemberActions({ membershipId, currentRole }: { membershipId: string; currentRole: MemberRole }) {
  const [loading, setLoading] = useState(false)

  async function handleRoleChange(role: MemberRole) {
    setLoading(true)
    await updateMemberRole(membershipId, role)
    setLoading(false)
  }

  async function handleRemove() {
    if (!confirm('Remover este membro do condomínio?')) return
    setLoading(true)
    await removeMember(membershipId)
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentRole}
        onChange={(e) => handleRoleChange(e.target.value as MemberRole)}
        disabled={loading}
        className="px-2 py-1.5 rounded-lg bg-white/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-xs text-neutral-700 dark:text-neutral-300 outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
      >
        <option value="visualizador">Visualizador</option>
        <option value="gestor">Gestor</option>
        <option value="admin">Super Admin</option>
      </select>
      <button
        onClick={handleRemove}
        disabled={loading}
        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
        title="Remover membro"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export { InviteButton, MemberActions }
