# Plano: Simplificação da Gestão de Condomínios e Usuários

Este plano propõe uma abordagem simplificada para a gestão administrativa do sistema, removendo a complexidade de gerenciar "Membros", "Usuários" e "Condomínios" em lugares diferentes ou de forma redundante. 

O foco agora será em apenas duas entidades principais na interface: **Usuários** (CRUD completo) e **Condomínios** (que inclui a vinculação de usuários).

## User Review Required

> [!IMPORTANT]
> **Criação de Usuários Administradores:** A criação de usuários pelo painel requer o uso de uma **Service Role Key** no lado do servidor para acessar a API de Admin do Supabase (`auth.admin.createUser`). Validaremos isso na execução.
> **Exclusão Lógica vs Física:** A remoção de usuários deve idealmente ser uma "exclusão lógica" (`status: inativo` na tabela `profiles`) ou suspensão no Supabase Auth para não quebrar a integridade referencial dos registros financeiros já criados por eles.

## Proposed Changes

### 1. Novo Fluxo e UI Simplificada

#### [DELETE] `src/app/(dashboard)/settings/members/*`
- Vamos focar em centralizar tudo e não ter uma tela separada de "Membros" local do condomínio.

#### [NEW/MODIFY] `src/app/(dashboard)/settings/users/page.tsx`
- Tela dedicada aos **Usuários do Sistema** com CRUD completo:
  - **Create**: Modal para criar um novo usuário (Nome, Email, Senha Inicial).
  - **Read**: Tabela listando os usuários, email, data de criação e status.
  - **Update**: Modal para editar informações do usuário (Nome, Redefinição de senha).
  - **Delete**: Botão para desativar/excluir o usuário do sistema.

#### [NEW/MODIFY] `src/app/(dashboard)/settings/condos/page.tsx`
- Tela dedicada aos **Condomínios** com CRUD completo e gestão de acessos embutida:
  - **Create/Update**: O formulário ou modal do condomínio terá suporte aos campos:
    - Dados do Condomínio (Nome, CNPJ).
    - **Acessos (Vinculação):** Lista ou select múltiplo listando os usuários criados no sistema (podendo definir que o "Usuário X" e "Usuário Y" possuem acesso a esse condomínio).
  - Dessa forma, o cadastro e edição de condomínio já resolve a parte de "Membros".

---

### 2. Lógica de Servidor Backend (Server Actions)

#### [NEW] `src/actions/users_mgmt.ts`
- `createUser(data)`: Usa Supabase Admin API para criar usuário no Auth e registrar na tabela `profiles`.
- `updateUser(id, data)`: Atualiza `profiles` e `auth.users`.
- `deleteUser(id)`: Desativa ou remove o usuário.

#### [MODIFY] `src/actions/condos.ts`
- Atualizar as funções `createCondo` e `updateCondo` para receber uma lista de `userIds` com seus níveis de permissão.
- Modificar a tabela de relacionamento `memberships` internamente durante a edição do condomínio, garantindo que os usuários marcados tenham os acessos concedidos ou revogados.

---

### 3. Banco de Dados

- As tabelas planejadas `condos`, `profiles` e a tabela N:N `public.memberships` ainda são necessárias nos bastidores (no banco), mas **na interface** isso fica transparente (simplificado para o usuário final).

## Open Questions

> [!WARNING]
> 1. Na tela de condomínios, quando quisermos vincular um usuário a ele, todos esses vínculos terão nível de "Administrador" (perfil default), ou deveríamos deixar o operador escolher, por usuário vinculado, se ele é **Leitor**, **Editor** ou **Admin** do condomínio?
> 2. Podemos ocultar as chaves mestras e APIs Restritas usando server actions do Next.js. Você prefere que a criação da conta exija o envio de um **e-mail de confirmação**, ou a senha deve ser apenas divulgada manualmente para o usuário poder acessar de cara?

## Verification Plan

### Manual Verification
1. Ao navegar para `Configurações > Usuários`, crio um usuário chamado "João Silva".
2. Ao navegar para `Configurações > Condomínios`, clico no Condomínio "Residencial A", abro a edição e vinculo "João Silva".
3. Ao logar como "João Silva", ele verá apenas o "Residencial A".
4. Removo "João Silva" do condomínio editando o mesmo em `Condomínios`, e validamos se ele perde o acesso.
