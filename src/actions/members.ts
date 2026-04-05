'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateAccess } from '@/lib/supabase/validateAccess'
import type { MemberRole, MembershipWithProfile } from '@/types/tenant'

export async function getMembers(): Promise<MembershipWithProfile[]> {
  const { condoId } = await validateAccess()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select('*, profiles(id, nome, avatar_url, cargo)')
    .eq('condo_id', condoId)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data as MembershipWithProfile[]
}

export async function inviteMember(email: string, role: MemberRole, tempPassword?: string) {
  const { condoId, userId } = await validateAccess('admin')
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let targetUserId: string

  // 1. Verificar se o usuário já existe no auth
  const { data: listData } = await adminClient.auth.admin.listUsers()
  const existing = listData?.users.find((u) => u.email === email)

  if (existing) {
    targetUserId = existing.id
  } else {
    // 2. Criar usuário com senha temporária (sem depender de email)
    const password = tempPassword || 'Mudar@123'
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // confirma o email automaticamente
    })
    if (createError) return { error: createError.message }
    targetUserId = created.user.id
  }

  // 3. Verificar se já é membro deste condo
  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', targetUserId)
    .eq('condo_id', condoId)
    .single()

  if (existingMembership) {
    return { error: 'Este usuário já é membro deste condomínio.' }
  }

  // 4. Criar membership
  const { error: memberError } = await supabase
    .from('memberships')
    .insert({ user_id: targetUserId, condo_id: condoId, role, invited_by: userId })

  if (memberError) return { error: memberError.message }

  // 5. Garantir que o profile existe
  await adminClient.from('profiles').upsert(
    { id: targetUserId, nome: email.split('@')[0] },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  revalidatePath('/settings/members')
  return { success: true, isNew: !existing, tempPassword: !existing ? (tempPassword || 'Mudar@123') : undefined }
}

export async function updateMemberRole(membershipId: string, role: MemberRole) {
  const { condoId, userId } = await validateAccess('admin')
  const supabase = await createClient()

  // Impedir que o admin remova seu próprio papel de admin
  const { data: self } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('id', membershipId)
    .eq('condo_id', condoId)
    .single()

  if (self?.user_id === userId && role !== 'admin') {
    return { error: 'Você não pode rebaixar seu próprio papel de administrador.' }
  }

  const { error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('id', membershipId)
    .eq('condo_id', condoId)

  if (error) return { error: error.message }

  revalidatePath('/settings/members')
  return { success: true }
}

export async function removeMember(membershipId: string) {
  const { condoId, userId } = await validateAccess('admin')
  const supabase = await createClient()

  // Impedir auto-remoção
  const { data: self } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('id', membershipId)
    .eq('condo_id', condoId)
    .single()

  if (self?.user_id === userId) {
    return { error: 'Você não pode remover a si mesmo do condomínio.' }
  }

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', membershipId)
    .eq('condo_id', condoId)

  if (error) return { error: error.message }

  revalidatePath('/settings/members')
  return { success: true }
}
