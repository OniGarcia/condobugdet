'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { validateMasterAccess } from '@/lib/supabase/validateAccess'
import type { Condo, CondoWithMembers, MemberRole } from '@/types/tenant'

export async function getCondos(): Promise<Condo[]> {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('condos')
    .select('*')
    .order('nome', { ascending: true })

  if (error || !data) return []
  return data as Condo[]
}

export async function getCondosWithMembers(): Promise<CondoWithMembers[]> {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('condos')
    .select('*, memberships(user_id, role)')
    .order('nome', { ascending: true })

  if (error || !data) return []
  return data.map((c: any) => ({
    ...c,
    memberships: (c.memberships ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role as MemberRole,
    })),
  })) as CondoWithMembers[]
}

export async function createCondo(
  nome: string,
  cnpj: string | null,
  memberships: { userId: string; role: MemberRole }[] = []
) {
  const { userId } = await validateMasterAccess()
  const adminClient = createAdminClient()

  const { data: condo, error } = await adminClient
    .from('condos')
    .insert({ nome: nome.trim(), cnpj: cnpj?.trim() || null })
    .select()
    .single()

  if (error || !condo) return { error: error?.message ?? 'Erro ao criar condomínio.' }

  const allMemberships = [
    { user_id: userId, condo_id: condo.id, role: 'admin' as MemberRole, invited_by: userId },
    ...memberships
      .filter((m) => m.userId !== userId)
      .map((m) => ({ user_id: m.userId, condo_id: condo.id, role: m.role, invited_by: userId })),
  ]

  await adminClient.from('memberships').insert(allMemberships)

  revalidatePath('/settings/condos')
  return { success: true, condo }
}

export async function updateCondo(
  id: string,
  data: { nome?: string; cnpj?: string | null },
  memberships?: { userId: string; role: MemberRole }[]
) {
  const { userId } = await validateMasterAccess()
  const adminClient = createAdminClient()

  const update: Record<string, unknown> = {}
  if (data.nome !== undefined) update.nome = data.nome.trim()
  if (data.cnpj !== undefined) update.cnpj = data.cnpj?.trim() || null

  if (Object.keys(update).length > 0) {
    const { error } = await adminClient.from('condos').update(update).eq('id', id)
    if (error) return { error: error.message }
  }

  if (memberships !== undefined) {
    const { error: delError } = await adminClient
      .from('memberships')
      .delete()
      .eq('condo_id', id)
    if (delError) return { error: delError.message }

    if (memberships.length > 0) {
      const { error: insError } = await adminClient
        .from('memberships')
        .insert(
          memberships.map((m) => ({
            user_id: m.userId,
            condo_id: id,
            role: m.role,
            invited_by: userId,
          }))
        )
      if (insError) return { error: insError.message }
    }
  }

  revalidatePath('/settings/condos')
  return { success: true }
}

export async function toggleCondoStatus(id: string, ativo: boolean) {
  await validateMasterAccess()
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('condos')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/settings/condos')
  return { success: true }
}
