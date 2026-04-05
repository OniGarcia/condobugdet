'use client'

import { useActionState } from 'react'
import { login } from '@/actions/auth'
import { Wallet } from 'lucide-react'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
      <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-semibold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CondoBudget
          </h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <h2 className="text-lg font-semibold mb-1">Entrar</h2>
          <p className="text-sm text-neutral-400 mb-6">Acesse sua conta para continuar</p>

          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-sky-500/20 disabled:opacity-50"
            >
              {pending ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
