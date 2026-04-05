import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import type { MemberRole } from '@/types/tenant'

/**
 * Valida que o usuário autenticado tem acesso ao condo_id do cookie.
 * Masters (is_master=true) sempre passam com role efetivo de 'admin'.
 *
 * @param requiredRole - Nível mínimo de permissão necessário. Padrão: 'viewer'.
 * @returns condo_id validado e role do usuário.
 */
export async function validateAccess(requiredRole: MemberRole = 'viewer'): Promise<{
  condoId: string
  role: MemberRole
  userId: string
  isMaster: boolean
}> {
  const cookieStore = await cookies()
  const condoId = cookieStore.get('condo_id')?.value

  if (!condoId) {
    redirect('/select-condo')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verifica se é master — masters têm acesso total a qualquer condo
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master')
    .eq('id', user.id)
    .single()

  if (profile?.is_master) {
    return { condoId, role: 'admin', userId: user.id, isMaster: true }
  }

  const { data: membership, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('condo_id', condoId)
    .single()

  if (error || !membership) {
    redirect('/select-condo')
  }

  const roleHierarchy: Record<MemberRole, number> = {
    viewer: 0,
    editor: 1,
    admin: 2,
  }

  if (roleHierarchy[membership.role as MemberRole] < roleHierarchy[requiredRole]) {
    throw new Error('Permissão insuficiente para esta operação.')
  }

  return {
    condoId,
    role: membership.role as MemberRole,
    userId: user.id,
    isMaster: false,
  }
}

/**
 * Valida que o usuário autenticado é um Super Admin (is_master=true).
 * Não requer condo_id. Use para operações globais de gerenciamento.
 *
 * @returns userId do master autenticado.
 */
export async function validateMasterAccess(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master')
    .eq('id', user.id)
    .single()

  if (!profile?.is_master) {
    throw new Error('Acesso restrito a Super Admins.')
  }

  return { userId: user.id }
}
