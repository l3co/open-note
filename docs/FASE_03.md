# Fase 03 — UI Shell & Navegação

## Objetivo

Construir o **layout principal** da aplicação e a **navegação completa** entre Notebooks, Sections e Pages. Ao final desta fase, o usuário consegue navegar por toda a hierarquia e ver páginas (ainda sem edição).

---

## Dependências

- Fase 01 concluída (scaffold + tooling)
- Fase 02 concluída (domínio + storage + IPC commands)

---

## Entregáveis

1. **Workspace Picker** — Tela de seleção/criação de workspace ao abrir o app
2. Layout principal com sidebar + área de conteúdo
3. Sidebar com árvore de navegação (Notebooks → Sections → Pages)
4. Criação, renomeação e exclusão de Notebooks/Sections/Pages via UI
5. Drag & drop para reordenar itens na sidebar
6. Breadcrumb de localização
7. Tela de boas-vindas (nenhuma page selecionada)
8. Placeholder de conteúdo da page (sem editor ainda)
9. Atalhos de teclado para navegação
10. Sistema de temas (Light, Paper, Dark, System) + accent color + chrome tint
11. Responsividade (sidebar colapsável)
12. Restauração de sessão (última page aberta)

---

## Fluxo de Startup do App

```
App abre
  │
  ├─ Ler AppState (~/.opennote/app_state.json)
  │
  ├─ last_opened_workspace existe e é válido?
  │    ├─ Sim → Abrir workspace → Layout Principal
  │    │                          ├─ last_opened_page_id existe? → Abrir page
  │    │                          └─ Não → WelcomePage
  │    └─ Não → Workspace Picker
  │
  └─ Primeiro uso (sem AppState)? → Onboarding (Fase 10)
```

---

## Workspace Picker

#### `<WorkspacePicker />`

Tela exibida quando nenhum workspace está aberto. Design local-first com cloud-awareness.

```
┌─────────────────────────────────────────┐
│              Open Note                   │
│                                         │
│   Workspaces recentes:                  │
│   ┌─────────────────────────────────┐  │
│   │ 📂 Meus Estudos            [×]  │  │
│   │   ~/Documents/estudos • local   │  │
│   ├─────────────────────────────────┤  │
│   │ ☁️ Trabalho               [×]  │  │
│   │   ~/Documents/trabalho • Drive  │  │
│   └─────────────────────────────────┘  │
│                                         │
│   [+ Novo workspace local]              │
│   [☁️ Conectar workspace na nuvem]     │
│   [  Abrir pasta existente]             │
└─────────────────────────────────────────┘
```

**Badges de status por workspace:**

| Ícone | Significado |
|---|---|
| 📂 | Workspace local (sem sync) |
| ☁️ | Workspace sincronizado com cloud provider |
| ☁️⚠ | Workspace com sync em erro / desconectado |

**Comportamento:**
- Click no workspace recente → abre direto
- `[×]` remove da lista de recentes (não deleta os arquivos)
- Badge (📂/☁️) indica visualmente se o workspace é local ou sincronizado
- Subtexto exibe path local + provider de sync (se houver): `~/Documents/estudos • local` ou `~/Documents/trabalho • Drive`
- "Novo workspace local" → file picker para escolher pasta pai + nome → cria subpasta com `slugify(nome)` dentro da pasta selecionada
- "Abrir pasta existente" → file picker para selecionar pasta com `workspace.json`
- Workspace inválido (pasta não existe) → exibir como desabilitado com tooltip

**Criação de workspace (✅ implementado):**

O comando `create_workspace` recebe o **diretório pai** e o **nome do workspace**. O backend:
1. Gera slug do nome via `slugify()` (ex: "Aulas de Inglês" → `aulas-de-ingles`)
2. Cria subpasta `{diretório_pai}/{slug}/` 
3. Dentro dessa subpasta cria `workspace.json`, `.trash/`, etc.
4. Registra o path completo da subpasta no `app_state.json` como recent workspace

Exemplo: pasta selecionada `/Users/leco/Documents`, nome "Aulas de Inglês" → cria `/Users/leco/Documents/aulas-de-ingles/workspace.json`

**Botão "Conectar workspace na nuvem":**
- **Antes da Fase 09:** Exibido com badge "Em breve" e desabilitado (cursor not-allowed, cor esmaecida). Tooltip: "Sincronização com a nuvem estará disponível em breve."
- **Após Fase 09:** Abre fluxo de criação de workspace cloud:
  1. Escolher provider (Google Drive, OneDrive, Dropbox)
  2. OAuth → autenticar
  3. Criar pasta remota + workspace local espelhado
  4. Sync inicial (download se já existir conteúdo remoto)

**Acesso posterior:** Botão na sidebar footer ou menu "Arquivo → Trocar Workspace" (`Cmd/Ctrl + Shift + O`)

---

## Layout Principal

```
┌──────────────────────────────────────────────────────────┐
│  Toolbar (drag region / window controls)                 │
├────────────────┬─────────────────────────────────────────┤
│                │  Breadcrumb: Notebook > Section > Page   │
│   Sidebar      ├─────────────────────────────────────────┤
│                │                                         │
│  ┌──────────┐  │                                         │
│  │ Notebooks│  │            Content Area                 │
│  │  ├ Sect. │  │                                         │
│  │  │ ├ Pg. │  │        (Page placeholder /              │
│  │  │ ├ Pg. │  │         Welcome screen)                 │
│  │  │ └ Pg. │  │                                         │
│  │  └ Sect. │  │                                         │
│  └──────────┘  │                                         │
│                │                                         │
│  [+ Notebook]  │                                         │
│                │                                         │
├────────────────┴─────────────────────────────────────────┤
│  Status Bar (workspace path, word count, last saved)     │
└──────────────────────────────────────────────────────────┘
```

### Dimensões

- **Sidebar:** largura padrão 260px, mín 200px, máx 400px, redimensionável
- **Sidebar colapsada:** 48px (apenas ícones)
- **Toolbar:** altura 40px (integrada com title bar do Tauri — drag region)
- **Status bar:** altura 28px
- **Content area:** preenche o restante

---

## Componentes

### Sidebar

#### `<Sidebar />`

Container principal da navegação lateral.

**Comportamento:**
- Colapsável via botão ou atalho (`Cmd+\` / `Ctrl+\`)
- Borda direita redimensionável (drag to resize)
- Scroll vertical quando conteúdo excede altura
- Persiste estado (aberta/fechada, largura) no `WorkspaceSettings`

#### `<NotebookTree />`

Árvore hierárquica de navegação.

**Estrutura visual:**
```
📓 Notebook A                    [⋯]
  📑 Section 1                   [⋯]
    📄 Page Alpha
    📄 Page Beta                 ← selecionada (highlight)
    📄 Page Gamma
  📑 Section 2                   [⋯]
📓 Notebook B                    [⋯]
  📑 Section 3                   [⋯]
```

**Interações:**
- Click no Notebook → expande/colapsa suas Sections
- Click na Section → expande/colapsa suas Pages
- Click na Page → carrega conteúdo na área principal
- Botão `[⋯]` → context menu (renomear, excluir, mudar cor)
- Double-click no nome → inline rename
- Drag & drop → reordenar dentro do mesmo nível
- Drag page entre sections → mover page

#### `<SidebarFooter />`

- Botão "+ Novo Notebook"
- Botão de settings (abre painel de configurações)
- Botão de busca (abre search — Fase 08)
- Botão "Lixeira" (abre `<TrashPanel />`, badge com contagem de itens)
- Botão "Trocar Workspace" (abre Workspace Picker)

---

### Toolbar

#### `<Toolbar />`

Barra superior integrada ao title bar do Tauri.

**Elementos:**
- Drag region (permite arrastar a janela)
- Botões de navegação: ← (voltar) → (avançar) — histórico de pages
- Breadcrumb: `Notebook > Section > Page`
- Botões de ação rápida (futuro: modo markdown, modo ink)
- Window controls (minimize, maximize, close) — nativos do Tauri

---

### Content Area

#### `<ContentArea />`

Container principal de conteúdo.

**Estados:**
1. **Nenhuma page selecionada** → exibe `<WelcomePage />`
2. **Page selecionada** → exibe `<PageView />` (placeholder nesta fase)
3. **Loading** → skeleton/spinner durante carregamento

#### `<WelcomePage />`

Tela exibida quando nenhuma page está selecionada.

**Conteúdo:**
- Logo do Open Note
- Atalhos rápidos: "Criar novo notebook", "Abrir page recente"
- Lista de pages recentes (últimas 5 editadas)
- Dica de atalhos de teclado

#### `<PageView />`

Nesta fase, exibe apenas:
- Título da page (editável)
- Tags (via `<TagEditor />`)
- Data de criação/atualização
- Placeholder: "Editor será implementado na Fase 04"

#### `<TagEditor />`

Componente de gerenciamento de tags dentro da `<PageView />`.

```
Tags: [estudo ×] [importante ×] [+ adicionar tag]
```

**Comportamento:**
- Exibe tags existentes como chips/badges com botão `×` para remover
- Campo de input para adicionar nova tag (ativado por click em "+ adicionar tag" ou atalho `Cmd/Ctrl + T`)
- **Autocomplete:** Ao digitar, sugere tags já usadas no workspace (consulta via IPC)
- Enter ou `,` → confirma a tag. Esc → cancela input
- Tags são strings livres (sem hierarquia). Lowercase normalizado, trim de espaços
- Máximo 20 tags por page (soft limit — aviso, não bloqueio)
- Duplicatas ignoradas silenciosamente
- Cores: tags não têm cor individual (simplificação). Estilo visual uniforme.

**Escopo das tags:**
- Tags são **por workspace** — o autocomplete lista todas as tags únicas de todas as pages do workspace
- Não existe CRUD global de tags (tag existe enquanto pelo menos uma page a usa)

**Comando IPC necessário:**

| Comando | Input | Output |
|---|---|---|
| `list_all_tags` | — | `Vec<String>` (tags únicas do workspace, ordenadas) |

**Nota:** `list_all_tags` pode ser implementado de duas formas:
1. Scan de todas as pages (simples, mas lento com muitas pages)
2. Via índice Tantivy (Fase 08) — mais rápido, mas cria dependência

**Decisão:** Implementar scan simples na Fase 03. Na Fase 08, otimizar para usar o índice.

---

### Status Bar

#### `<StatusBar />`

Barra inferior com informações contextuais.

**Elementos:**
- Caminho do workspace (clicável → abre no finder/explorer)
- Contagem de blocos na page atual
- Indicador de salvamento ("Salvo" / "Salvando..." / "Erro ao salvar")
- Indicador de sync (futuro — Fase 09)

---

### Notificações

#### `<ToastProvider />` + `useToast()`

Sistema de notificações toast para feedback ao usuário. Componente transversal usado por todas as fases.

```
┌─────────────────────────────────────────────────┐
│                                      ┌────────┐ │
│                                      │ ✓ Salvo│ │ ← toast (canto superior direito)
│                                      └────────┘ │
│                                                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Tipos de toast:**

| Tipo | Ícone | Cor | Duração | Exemplo |
|---|---|---|---|---|
| `success` | ✓ | Verde | 3s auto-dismiss | "Page salva com sucesso" |
| `error` | ✗ | Vermelho | Persistente (dismiss manual) | "Erro ao salvar: disco cheio" |
| `warning` | ⚠ | Amarelo | 5s auto-dismiss | "Page com mais de 200 blocos" |
| `info` | ℹ | Azul | 4s auto-dismiss | "3 itens expirados removidos da lixeira" |

**API (hook):**

```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;        // ms, 0 = persistente
  action?: {
    label: string;
    onClick: () => void;    // ex: "Desfazer", "Retry"
  };
}

function useToast(): {
  toast: (options: Omit<Toast, 'id'>) => string;  // retorna id
  dismiss: (id: string) => void;
  dismissAll: () => void;
}
```

**Regras:**
- Máximo 3 toasts visíveis simultaneamente (os mais antigos são empilhados)
- Posição: canto superior direito, abaixo da toolbar
- Animação: slide-in da direita, fade-out ao dismiss
- Toasts de erro **sempre** persistem até dismiss manual (dados críticos)
- Toasts com `action` têm botão clicável (ex: "Retry" para erro de save, "Desfazer" para ações reversíveis)
- Implementação: usar `sonner` (lib de toasts para React) ou componente custom com shadcn/ui

**Uso em outras fases:**
- **Fase 04:** "Salvo ✓", "Erro ao salvar"
- **Fase 05:** "Imagem importada", "Erro ao importar"
- **Fase 07:** "Anotações salvas", "SVG exportado"
- **Fase 08:** "Índice reconstruído"
- **Fase 09:** "Sync completo", "Conflito detectado", "Erro de autenticação"

---

### Dialogs

#### `<CreateDialog />`

Modal reutilizável para criar Notebook/Section/Page.

**Campos:**
- Nome (obrigatório, validação inline)
- Cor (picker opcional, para Notebook/Section)
- Ícone (emoji picker opcional, para Notebook)

#### `<DeleteDialog />`

Confirmação de exclusão com aviso. **Toda exclusão é soft-delete** (move para lixeira).

**Regras:**
- Notebook com sections: avisar que todo conteúdo irá para a lixeira
- Section com pages: idem
- Page: confirmação simples + informação "O item ficará na lixeira por 30 dias"
- Não há delete permanente direto na sidebar (apenas via painel da lixeira)

---

### Lixeira

#### `<TrashPanel />`

Painel de visualização dos itens na lixeira. Acessível via sidebar footer ou menu.

```
┌───────────────────────────────────────┐
│  Lixeira                    [Esvaziar]  │
├───────────────────────────────────────┤
│  📄 Aula 01 — Introdução               │
│     Notebook A > Estudos              │
│     Excluído há 3 dias • Expira em 27d  │
│     [Restaurar] [Deletar permanente]  │
├───────────────────────────────────────┤
│  📓 Notebook Antigo (3 pages)         │
│     Excluído há 15 dias • Expira em 15d │
│     [Restaurar] [Deletar permanente]  │
└───────────────────────────────────────┘
```

**Comportamento:**
- Lista todos os itens na lixeira, ordenados por data de exclusão (mais recente primeiro)
- Exibe tipo, nome, caminho original, tempo desde exclusão, dias até expiração
- "Restaurar" → move de volta ao caminho original
- "Deletar permanente" → confirmação extra (irreversível de verdade)
- "Esvaziar" → confirmação + delete permanente de todos
- Lixeira vazia → mensagem "Nenhum item na lixeira"

#### `<RenameInline />`

Edição inline do nome direto na sidebar.

- Ativado por double-click ou F2
- Enter = salvar, Esc = cancelar
- Validação: nome não pode ser vazio, não pode duplicar no mesmo nível

---

## State Management (Zustand)

### Stores

#### `useWorkspaceStore`

```typescript
interface WorkspaceStore {
  workspace: Workspace | null;
  notebooks: Notebook[];
  isLoading: boolean;
  error: string | null;
  
  openWorkspace(path: string): Promise<void>;
  createNotebook(name: string): Promise<void>;
  renameNotebook(id: string, name: string): Promise<void>;
  deleteNotebook(id: string): Promise<void>;
  reorderNotebooks(order: [string, number][]): Promise<void>;
}
```

#### `useNavigationStore`

```typescript
interface NavigationStore {
  selectedNotebookId: string | null;
  selectedSectionId: string | null;
  selectedPageId: string | null;
  expandedNotebooks: Set<string>;
  expandedSections: Set<string>;
  history: string[];           // page IDs visitados
  historyIndex: number;
  
  selectNotebook(id: string): void;
  selectSection(id: string): void;
  selectPage(id: string): void;
  goBack(): void;
  goForward(): void;
  toggleNotebook(id: string): void;
  toggleSection(id: string): void;
}
```

#### `usePageStore`

```typescript
interface PageStore {
  currentPage: Page | null;
  pages: Map<string, PageSummary[]>;  // sectionId → pages
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  
  loadPages(sectionId: string): Promise<void>;
  loadPage(pageId: string): Promise<void>;
  createPage(sectionId: string, title: string): Promise<void>;
  updatePageTitle(pageId: string, title: string): Promise<void>;
  deletePage(pageId: string): Promise<void>;
  movePage(pageId: string, targetSectionId: string): Promise<void>;
}
```

#### `useUIStore`

```typescript
interface ThemeConfig {
  baseTheme: 'light' | 'dark' | 'paper' | 'system';
  accentColor: string;       // nome da paleta ('Blue', 'Berry', etc.)
  chromeTint: 'neutral' | 'tinted';
}

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number;
  theme: ThemeConfig;
  showWorkspacePicker: boolean;
  
  toggleSidebar(): void;
  setSidebarWidth(width: number): void;
  setTheme(theme: ThemeConfig): void;
  openWorkspacePicker(): void;
  closeWorkspacePicker(): void;
}
```

---

## Atalhos de Teclado

**Regra de prioridade:** Quando o editor de conteúdo está focado, atalhos do editor (Fase 04) têm precedência sobre atalhos de navegação. Atalhos de navegação funcionam quando o foco está fora do editor (sidebar, toolbar, etc.) ou quando usam combinações que não conflitam.

| Atalho | Ação |
|---|---|
| `Cmd/Ctrl + \` | Toggle sidebar |
| `Cmd/Ctrl + N` | Nova page na section atual |
| `Cmd/Ctrl + Shift + N` | Novo notebook |
| `Cmd/Ctrl + [` | Navegar para trás |
| `Cmd/Ctrl + ]` | Navegar para frente |
| `Cmd/Ctrl + P` | Quick open (buscar page por nome) |
| `Cmd/Ctrl + Shift + O` | Trocar workspace (abre Workspace Picker) |
| `Cmd/Ctrl + T` | Adicionar tag à page atual |
| `F2` | Renomear item selecionado |
| `Delete/Backspace` | Excluir item selecionado (com confirmação) |
| `↑ / ↓` | Navegar na sidebar |
| `Enter` | Abrir item selecionado |
| `←` | Colapsar nó da árvore |
| `→` | Expandir nó da árvore |

---

## Sistema de Temas

O Open Note usa um sistema de temas em **3 camadas** para oferecer visual premium e personalização rica:

```
┌────────────────────────────────────────────┐
│  Camada 1: Base Theme                       │
│  (controla backgrounds, texto, bordas)      │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │  Camada 2: Accent Color                │ │
│  │  (cor de destaque: botões, links,      │ │
│  │   seleções, ícones ativos)             │ │
│  │                                        │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │  Camada 3: Chrome Tint           │  │ │
│  │  │  (sidebar + toolbar recebem      │  │ │
│  │  │   tonalidade da accent color)    │  │ │
│  │  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

### Camada 1 — Base Themes

| Theme | Visual | Inspiração |
|---|---|---|
| **Light** | Branco limpo, bordas sutis, texto escuro. Moderno e arejado. | Notion, Linear |
| **Paper** | Fundo creme/sépia quente, textura visual de papel. Suave para os olhos. | Kindle, iA Writer |
| **Dark** | Fundo escuro profundo, texto claro, alto contraste. | VS Code Dark, Obsidian |
| **System** | Segue preferência do OS (light ↔ dark) | — |

### Camada 2 — Accent Colors (paleta configurável)

Inspirado no Todoist/TickTick. O usuário escolhe **uma cor de destaque** que se propaga por toda a UI:

| Nome | Hex | Uso |
|---|---|---|
| **Blue** (padrão) | `#3b82f6` | Botões, links, seleção, ícone ativo |
| **Indigo** | `#6366f1` | |
| **Purple** | `#8b5cf6` | |
| **Berry** | `#ec4899` | |
| **Red** | `#ef4444` | |
| **Orange** | `#f97316` | |
| **Amber** | `#f59e0b` | |
| **Green** | `#22c55e` | |
| **Teal** | `#14b8a6` | |
| **Graphite** | `#64748b` | |

Cada accent color gera automaticamente variantes derivadas:
- `--accent`: cor principal
- `--accent-hover`: 10% mais escura (light) ou mais clara (dark)
- `--accent-subtle`: 10% opacity (backgrounds de seleção)
- `--accent-text`: branco ou escuro (contraste automático sobre accent)

### Camada 3 — Chrome Tint

Opção de **colorir sidebar e toolbar** com uma tonalidade suave da accent color:

| Modo | Sidebar/Toolbar | Content Area |
|---|---|---|
| **Neutral** (padrão) | Cinza neutro (sem tint) | Branco/escuro conforme base theme |
| **Tinted** | Tonalidade suave da accent color (5-8% opacity) | Branco/escuro conforme base theme |

Isso dá o efeito visual premium: sidebar com toque de cor, sem ser invasivo.

### Variáveis CSS

```css
/* ===== Camada 1: Base Theme ===== */

:root, [data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #f1f3f5;
  --bg-sidebar: #f6f6f7;
  --bg-toolbar: #fafafa;
  --bg-hover: rgba(0, 0, 0, 0.04);
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --border: #e5e7eb;
  --border-subtle: #f0f0f0;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
}

[data-theme="paper"] {
  --bg-primary: #faf8f5;          /* creme suave */
  --bg-secondary: #f5f0ea;
  --bg-tertiary: #ede6dd;
  --bg-sidebar: #f0ebe4;
  --bg-toolbar: #f5f0ea;
  --bg-hover: rgba(139, 109, 71, 0.06);
  --text-primary: #3d3329;        /* marrom escuro */
  --text-secondary: #7a6e60;
  --text-tertiary: #a89b8c;
  --border: #e0d5c8;
  --border-subtle: #ebe3d8;
  --shadow: 0 1px 3px rgba(100, 70, 30, 0.06);
  --danger: #c0392b;
  --success: #27ae60;
  --warning: #d4a017;
}

[data-theme="dark"] {
  --bg-primary: #121218;           /* escuro profundo */
  --bg-secondary: #1a1a24;
  --bg-tertiary: #22222e;
  --bg-sidebar: #0f0f17;
  --bg-toolbar: #16161f;
  --bg-hover: rgba(255, 255, 255, 0.06);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --border: #2d2d3a;
  --border-subtle: #232330;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --danger: #f87171;
  --success: #4ade80;
  --warning: #fbbf24;
}

/* ===== Camada 2: Accent Color ===== */
/* Aplicada dinamicamente via JS — default: blue */

:root {
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --accent-subtle: rgba(59, 130, 246, 0.1);
  --accent-text: #ffffff;
}

/* ===== Camada 3: Chrome Tint ===== */
/* Quando ativado, sidebar e toolbar recebem tint da accent */

[data-chrome="tinted"] {
  --bg-sidebar: color-mix(in srgb, var(--accent) 6%, var(--bg-sidebar));
  --bg-toolbar: color-mix(in srgb, var(--accent) 4%, var(--bg-toolbar));
}
```

### Aplicação dos temas

```html
<html data-theme="dark" data-chrome="tinted">
```

Tema base e accent color armazenados em `GlobalSettings` (transversal a todos os workspaces).

### Transições

- Troca de tema: transição suave de **200ms** em todas as propriedades de cor
- `* { transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease; }`

### Detecção automática

- Tema "System" detectado via Tauri `window.theme()` e `matchMedia('(prefers-color-scheme: dark)')`
- Listener para mudanças em tempo real (usuário muda tema do OS → app reflete)

---

## Testes

### Unitários (componentes)

- `<Sidebar />` renderiza lista de notebooks
- `<NotebookTree />` expande/colapsa corretamente
- `<CreateDialog />` valida campos obrigatórios
- `<DeleteDialog />` exibe aviso correto por tipo
- `<Breadcrumb />` exibe caminho corretamente
- `<StatusBar />` reflete estado de salvamento

### Integração (stores)

- `useWorkspaceStore` → CRUD de notebooks via IPC mock
- `useNavigationStore` → navegação e histórico
- `usePageStore` → loading e saving de pages
- `useUIStore` → sidebar toggle e tema

### E2E

- Abrir app → sidebar exibe notebooks do workspace
- Criar notebook → aparece na sidebar
- Criar section → aparece sob notebook
- Criar page → aparece sob section, conteúdo carrega
- Renomear notebook inline → nome atualizado
- Deletar page → confirmação → removida da sidebar
- Drag & drop → reordenar notebooks
- Colapsar sidebar → apenas ícones visíveis
- Trocar tema → visual atualizado imediatamente

---

## Acessibilidade (a11y)

- Sidebar como `<nav>` com `aria-label="Navegação de notas"`
- Tree view segue [WAI-ARIA Treeview Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- Todos os botões com `aria-label` descritivo
- Focus visible em todos os elementos interativos
- Navegação completa por teclado
- Dialogs com focus trap
- Contraste mínimo WCAG AA

---

## Limitações Conhecidas (v1)

- **Sem undo estrutural** — ações como renomear notebook, mover page, deletar section **não** possuem undo. A lixeira (soft-delete com retenção de 30 dias) mitiga o caso mais crítico (deleção acidental). Undo estrutural completo (history log de ações) é candidato para versões futuras.
- **Sem multi-window** — o app opera em janela única. Abrir duas janelas para o mesmo workspace não é suportado.

---

## Definition of Done

- [ ] Layout principal renderiza com sidebar + content + toolbar + status bar
- [ ] Sidebar exibe árvore de Notebooks → Sections → Pages
- [ ] CRUD completo de Notebooks/Sections/Pages via UI
- [ ] Inline rename funcionando
- [ ] Drag & drop para reordenar
- [ ] Context menu com opções (renomear, excluir, mudar cor)
- [ ] Breadcrumb reflete localização atual
- [ ] Navegação por histórico (back/forward)
- [ ] Sidebar colapsável com persistência
- [ ] Workspace Picker funcional (lista recentes, criar, abrir existente)
- [ ] Trocar workspace via sidebar ou Cmd+Shift+O
- [ ] Restauração de sessão (última page aberta ao reabrir workspace)
- [ ] Lixeira funcional (soft-delete, listar, restaurar, esvaziar)
- [ ] Delete dialog informa que item vai para lixeira
- [ ] TagEditor funcional (adicionar, remover, autocomplete)
- [ ] Sistema de temas funcionando (4 base themes + 10 accent colors + chrome tint)
- [ ] Welcome page exibida quando nenhuma page selecionada
- [ ] Status bar com indicador de salvamento
- [ ] Atalhos de teclado implementados
- [ ] Testes unitários de componentes passando
- [ ] Testes de stores passando
- [ ] Testes E2E dos fluxos principais passando
- [ ] a11y validada (tree view, focus, contraste)
- [ ] CI verde
