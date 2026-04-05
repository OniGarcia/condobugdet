'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { validateMasterAccess } from '@/lib/supabase/validateAccess'
import type { MemberRole } from '@/types/tenant'

export interface GlobalUser {
  id: string
  email: string
  nome: string | null
  cargo: string | null
  is_master: boolean
  created_at: string
  memberships: {
    id: string
    condo_id: string
    condo_nome: string
    role: MemberRole
  }[]
}

export async function getGlobalUsers(): Promise<GlobalUser[]> {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const [usersResult, profilesResult, membershipsResult] = await Promise.all([
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
    adminClient.from('profiles').select('id, nome, cargo, is_master'),
    adminClient.from('memberships').select('id, user_id, condo_id, role, condos(id, nome)'),
  ])

  const profiles = profilesResult.data ?? []
  const memberships = membershipsResult.data ?? []

  return (usersResult.data?.users ?? []).map((authUser) => {
    const profile = profiles.find((p) => p.id === authUser.id)
    const userMemberships = memberships
      .filter((m) => m.user_id === authUser.id)
      .map((m) => ({
        id: m.id,
        condo_id: m.condo_id,
        condo_nome: (m.condos as any)?.nome ?? 'Desconhecido',
        role: m.role as MemberRole,
      }))

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      nome: profile?.nome ?? null,
      cargo: profile?.cargo ?? null,
      is_master: profile?.is_master ?? false,
      created_at: authUser.created_at,
      memberships: userMemberships,
    }
  })
}

export async function updateUserProfile(userId: string, data: { nome?: string; cargo?: string }) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .upsert({ id: userId, ...data }, { onConflict: 'id' })

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function assignCondoToUser(userId: string, condoId: string, role: MemberRole) {
  const { userId: masterId } = await validateMasterAccess()
  const adminClient = createAdminClient()

  // Verifica se já tem membership
  const { data: existing } = await adminClient
    .from('memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('condo_id', condoId)
    .single()

  if (existing) {
    // Atualiza o role
    const { error } = await adminClient
      .from('memberships')
      .update({ role })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    // Cria nova membership
    const { error } = await adminClient
      .from('memberships')
      .insert({ user_id: userId, condo_id: condoId, role, invited_by: masterId })

    if (error) return { error: error.message }
  }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function removeMembershipFromUser(userId: string, condoId: string) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('memberships')
    .delete()
    .eq('user_id', userId)
    .eq('condo_id', condoId)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function toggleUserMaster(userId: string, isMaster: boolean) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_master: isMaster })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}

export async function createUser(data: { email: string; nome: string; senha: string; is_master?: boolean }) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.senha,
    email_confirm: true,
  })
  if (error) return { error: error.message }

  await adminClient
    .from('profiles')
    .upsert({ id: created.user.id, nome: data.nome.trim(), is_master: data.is_master ?? false }, { onConflict: 'id' })

  revalidatePath('/settings/users')
  return { success: true }
}

export async function deactivateUser(userId: string) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '87600h',
  })
  if (error) return { error: error.message }

  revalidatePath('/settings/users')
  return { success: true }
}
