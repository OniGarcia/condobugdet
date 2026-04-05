import { redirect } from 'next/navigation'
import { Building2, LogOut, ChevronRight, Wallet } from 'lucide-react'
import { getUserCondos, logout, selectCondo } from '@/actions/auth'
import { getSession } from '@/actions/auth'

export default async function SelectCondoPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const condos = await getUserCondos()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center font-sans">
      <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-semibold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CondoBudget
          </h1>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
          <h2 className="text-lg font-semibold mb-1">Selecionar Condomínio</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Escolha qual condomínio você quer acessar
          </p>

          {condos.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-sm">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Você não tem acesso a nenhum condomínio.</p>
              <p className="mt-1">Aguarde um convite de administrador.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {condos.map((condo) => (
                <form key={condo.id} action={selectCondo.bind(null, condo.id)}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-100 truncate">{condo.nome}</p>
                      <p className="text-xs text-neutral-500 capitalize">{condo.role}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-colors flex-shrink-0" />
                  </button>
                </form>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/10">
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair da conta
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
