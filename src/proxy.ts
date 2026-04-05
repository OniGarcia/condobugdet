import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas — sem autenticação necessária
  const publicPaths = ['/login', '/auth/callback']
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificar sessão ativa (e rotacionar token se necessário)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rotas que não precisam de condo selecionado
  const nondoRequired = ['/select-condo']
  if (nondoRequired.includes(pathname)) {
    return response
  }

  // Todas as demais rotas autenticadas requerem condo_id selecionado
  const condoId = request.cookies.get('condo_id')?.value

  if (!condoId) {
    return NextResponse.redirect(new URL('/select-condo', request.url))
  }

  // Validar membership no banco (defesa em profundidade além do RLS)
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('condo_id', condoId)
    .single()

  if (!membership) {
    // Cookie adulterado ou membership removida — forçar re-seleção
    response = NextResponse.redirect(new URL('/select-condo', request.url))
    response.cookies.delete('condo_id')
    return response
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Aplica middleware em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - arquivos com extensão (ex: .png, .svg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
