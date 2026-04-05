'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { CondoWithRole } from '@/types/tenant'

export async function login(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/select-condo')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('condo_id')

  redirect('/login')
}

export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUserCondos(): Promise<CondoWithRole[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('memberships')
    .select('role, condos(id, nome, cnpj, ativo, created_at, updated_at)')
    .eq('user_id', user.id)

  if (error || !data) return []

  return data
    .filter((m) => (m.condos as any)?.ativo !== false)
    .map((m) => ({
      ...(m.condos as unknown as Omit<CondoWithRole, 'role'>),
      role: m.role as CondoWithRole['role'],
    }))
}

export async function selectCondo(condoId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Valida que o usuário tem membership neste condo
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('condo_id', condoId)
    .single()

  if (!membership) {
    redirect('/select-condo')
  }

  const cookieStore = await cookies()
  cookieStore.set('condo_id', condoId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  })

  redirect('/dashboard')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentCondo() {
  const cookieStore = await cookies()
  const condoId = cookieStore.get('condo_id')?.value
  if (!condoId) return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('memberships')
    .select('role, condos(id, nome, cnpj, ativo, created_at, updated_at)')
    .eq('user_id', user.id)
    .eq('condo_id', condoId)
    .single()

  if (!data) return null

  return {
    ...(data.condos as unknown as Omit<CondoWithRole, 'role'>),
    role: data.role as CondoWithRole['role'],
  }
}
