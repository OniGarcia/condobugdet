export type MemberRole = 'admin' | 'editor' | 'viewer'

export interface Condo {
  id: string
  nome: string
  cnpj: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  nome: string | null
  avatar_url: string | null
  cargo: string | null
  is_master: boolean
  created_at: string
  updated_at: string
}

export interface Membership {
  id: string
  user_id: string
  condo_id: string
  role: MemberRole
  invited_by: string | null
  created_at: string
}

export interface MembershipWithProfile extends Membership {
  profiles: Pick<Profile, 'id' | 'nome' | 'avatar_url' | 'cargo'>
}

export interface CondoWithRole extends Condo {
  role: MemberRole
}

export interface CondoMember {
  user_id: string
  role: MemberRole
}

export interface CondoWithMembers extends Condo {
  memberships: CondoMember[]
}
