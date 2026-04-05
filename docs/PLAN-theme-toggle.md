# Plano: Implantação de Modo Claro e Escuro (Tema)

Este plano detalha as etapas necessárias para introduzir um sistema dinâmico de temas (Claro / Escuro / Sistema) na aplicação atual, que hoje está fixada em modo escuro usando classes físicas do Tailwind ou estilos globais (ex: `bg-neutral-900`, `text-white`).

A abordagem escolhida utilizará `next-themes` em conjunto com os novos recursos do Tailwind V4 para uma transição elegante, sem flash of unstyled content (FOUC).

## User Review Required

> [!IMPORTANT]
> **Refatoração Mássica de Classes:** Atualmente, a base de código usa classes literais de cor escura na maioria dos arquivos (ex: `bg-neutral-900`, `border-white/10`). 
> Será necessário fazer uma refatoração em toda a interface. 
> 
> **Pergunta:** Você prefere...
> 1.  Adicionar prefixos (ex: `bg-white dark:bg-neutral-900`) garantindo 100% de controle utilitário?
> 2.  **OU** Criar um sistema semântico (`bg-background`, `bg-card`, `text-primary`) injetado via `globals.css` (estilo Shadcn UI)? A opção 2 é mais limpa e moderna para o Tailwind V4.

## Proposed Changes

### 1. Dependências e Provedores

#### [NEW] `src/components/theme-provider.tsx`
- Criação de um Client Component que faz o wrap de `<NextThemesProvider>` com os atributos `attribute="class"` e `defaultTheme="system"`.
- O pacote `next-themes` será adicionado via dependências (`npm i next-themes`).

#### [MODIFY] `src/app/layout.tsx`
- Envolver todo o `children` com o `<ThemeProvider>`.
- Ajustar propriedades da tag `<html>` para suprimir `suppressHydrationWarning`, necessário para o `next-themes` não reclamar da diferença entre o server e reidratação do DOM.

---

### 2. Ajuste do Tailwind V4 (Global CSS)

#### [MODIFY] `src/app/globals.css`
- Atualizar a estrutura de temas base:
  ```css
  /* Definição de design tokens */
  @theme {
    --color-background: var(--bg-default);
    --color-foreground: var(--root-text);
    /* ... outras cores semânticas como surface, border, etc */
  }

  @layer base {
    :root {
      /* Cores LIGHT MODE */
      --bg-default: #ffffff;
      --root-text: #171717; /* neutral-900 */
    }

    .dark {
      /* Cores DARK MODE (Atuais) */
      --bg-default: #0a0a0a;
      --root-text: #f5f5f5;
    }

    body {
      background-color: var(--color-background);
      color: var(--color-foreground);
    }
  }
  ```
- Isso garante que o fundo mude automaticamente sem tocarmos em 100% das páginas.

---

### 3. Componente de Toggle (UI)

#### [NEW] `src/components/ThemeToggle.tsx`
- Um botão de ação (ícone de Sol e Lua que animam durante a rotação ou fade), permitindo ao usuário clicar para alternar.
- Pode usar um "Dropdown" para opções explícitas: *Light*, *Dark* ou *System*.

#### [MODIFY] `src/app/(dashboard)/SidebarClient.tsx`
- Adicionar o botão de Tema (ThemeToggle) no rodapé da Sidebar ou no cabeçalho superior (Header), garantindo fácil acesso ao longo de toda a aplicação usando os princípios do UX (visibilidade).

---

### 4. Refatoração de Cores e Componentes Existentes

#### [MODIFY] `src/components/**/*.tsx` & `src/app/**/*.tsx` (Múltiplos Arquivos)
- Identificar e substituir hardcodes visuais que forçam o dark mode.
- Exemplos de mudanças necessárias que faremos gradativamente ou via script (Search/Replace inteligente):
  - `bg-neutral-900` ➡️ `bg-neutral-50 dark:bg-neutral-900` (ou token semântico `bg-surface`)
  - `text-white` / `text-neutral-400` ➡️ usar as classes de modo claro como base, seguidas pelo modo escuro.
  - Ajuste de bordas `border-white/10` ➡️ `border-black/5 dark:border-white/10` (muito importante para Glassmorphism).

## Open Questions

> [!WARNING]
> Dado o `frontend-design` e nossas regras: 
> Qual paleta/base de cores você deseja no Modo Claro? Deixamos um visual minimalista (branco puro e cinzas neutros de alto contraste) ou injetamos algum tom morno quente / background levemente cinza (ex: Tailwind `slate` ou `zinc`) no modo light? O sistema de UX recomenda Neutral estrito para apps financeiros (para fácil leitura de tabelas).

## Verification Plan

### Testes Automáticos
- Verificar ausência de Flash de Conteúdo (FOUC).
- Testar a gravação no `localStorage` do `next-themes`.

### Manual Verification
1. Ao abrir a página inicial pela primeira vez com o SO configurado para Claro, o site deve renderizar fundo claro.
2. Ao clicar no Toggle no lado da Sidebar, altero para Escuro e ele atualiza instantaneamente.
3. Testar a matriz de dados financeiros e checar a visibilidade de linhas listradas (`zebra`) sob ambas as configurações de cores.
