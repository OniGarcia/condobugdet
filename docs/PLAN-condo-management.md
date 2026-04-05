# Plano: Gestão de Condomínios e Usuários (Admin)

Este plano detalha a implementação do CRUD de condomínios e a expansão da gestão de usuários para permitir a atribuição de múltiplos condomínios, tudo acessível via menu de Configurações para usuários administradores.

## User Review Required

> [!IMPORTANT]
> **Papel de Admin Master:** Atualmente, o papel de `admin` é local a cada condomínio. Proponho adicionar uma flag `is_master` na tabela `public.profiles` para identificar usuários com permissão total de gerenciamento (Super Admin).

> [!WARNING]
> **Exclusão Lógica:** A exclusão de condomínios será apenas uma alteração de status (`ativo: true/false`). Isso preserva o histórico de lançamentos.

## Proposed Changes

### 1. Banco de Dados (Supabase)

#### [NEW] `supabase/migrations/20260404000000_condo_status_and_user_mgmt.sql`
- Adicionar coluna `ativo` (boolean, default true) na tabela `public.condos`.
- Adicionar coluna `is_master` (boolean, default false) na tabela `public.profiles`.

---

### 2. Gestão de Condomínios (CRUD)

#### [NEW] `src/actions/condos.ts`
- `getCondos()`: Lista todos os condomínios (considerando permissão de master).
- `createCondo(nome, cnpj)`: Cria novo condomínio e gera `membership` de admin para o criador.
- `updateCondo(id, data)`: Atualiza nome/cnpj.
- `toggleCondoStatus(id, active)`: Ativa/Desativa o condomínio via coluna `ativo`.

#### [NEW] `src/app/(dashboard)/settings/condos/page.tsx`
- Servidor: Busca lista de condomínios e valida permissão.
- Layout: Tabela com filtros (Ativo/Inativo) e botão "Novo Condomínio".

#### [NEW] `src/app/(dashboard)/settings/condos/CondosClient.tsx`
- Componente cliente para modais de criação/edição e interações de status.

---

### 3. Gestão de Usuários (Global)

#### [NEW] `src/actions/users_mgmt.ts`
- `getGlobalUsers()`: Lista todos os usuários e seus condomínios vinculados.
- `createUser(email, nome, password)`: Cria usuário no Auth via Admin SDK e perfil.
- `assignCondoToUser(userId, condoId, role)`: Gerencia memberships.

#### [NEW] `src/app/(dashboard)/settings/users/page.tsx`
- Rota para gestão abrangente de usuários.

#### [NEW] `src/app/(dashboard)/settings/users/UsersClient.tsx`
- Lista de usuários com busca e modal para atribuir novos condomínios aos usuários existentes.

---

### 4. Navegação e UI

#### [MODIFY] `src/app/(dashboard)/settings/layout.tsx`
- Adicionar abas dinâmicas para permitir navegação entre Membros, Condomínios e Usuários Globais.

## Open Questions

1. **Senha Inicial:** Deseja que o admin defina uma senha manual ou o sistema gere uma temporária padrão (como 'Mudar@123')?
2. **Identificação Master:** Você já possui um usuário Master? Posso definir o primeiro usuário criado (ou o seu atual) como `is_master = true` na migração?

## Verification Plan

### Automated Tests
- Testar a criação de condomínios via script de teste.
- Validar se o filtro `ativo=true` é respeitado na tela de seleção de condomínios.

### Manual Verification
- Acessar `/settings/condos`, criar um condomínio e confirmar o vínculo automático do criador.
- Abrir `/settings/users`, selecionar um usuário e adicionar um novo condomínio ao seu perfil.
- Verificar se o status "Inativo" impede que o condomínio apareça nos lançamentos e relatórios.
