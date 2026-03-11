# Fase 03 — Frontend: Diálogos, Sidebar & Stores

**Esforço estimado:** ~14 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Fase 2
**Branch:** `feat/password-protected-notes-phase-3`

---

## Objetivo

Implementar toda a camada de UI para a feature de proteção por senha:
- Ícone de cadeado + título italic na sidebar para pages protegidas (placeholder vem do backend)
- Context menu na **Page**: "Proteger com senha", "Remover proteção", "Trocar senha"
- Context menu na **Section**: "Listar páginas protegidas" (visível quando há pages protegidas)
- `ProtectedPagesPanel` — painel que lista pages protegidas de uma section e permite unlock individual para revelar títulos
- `PasswordUnlockDialog` — exibido ao tentar abrir uma page protegida
- `SetPasswordDialog` — para definir, remover ou trocar senha
- Adaptação do `usePageStore` para gerenciar o estado `locked` / `unlocked`
- Strings i18n em `pt-BR.json` e `en.json`

---

## Contexto Atual

```typescript
// src/stores/usePageStore.ts — estado atual (simplificado)
interface PageStore {
  currentPage: Page | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  loadPage: (pageId: string) => Promise<void>;
  updateBlocks: (pageId: string, blocks: Block[]) => Promise<void>;
}

// src/components/editor/PageEditor.tsx (orquestrador atual)
// Renderiza TitleEditor + BlockEditor (ou MarkdownEditor, PdfCanvas)
// Não tem lógica de "page bloqueada"

// src/components/ — estrutura atual
components/
├── canvas/
├── editor/
│   ├── BlockEditor.tsx
│   ├── MarkdownEditor.tsx
│   ├── PageEditor.tsx
│   ├── TitleEditor.tsx
│   └── ...
├── ink/
├── layout/
│   ├── Sidebar.tsx
│   └── NotebookTree/
│       ├── NotebookTree.tsx
│       └── PageItem.tsx        ← renderiza item de page na sidebar
└── modals/
    ├── TrashPanel.tsx
    └── ...
```

---

## Tarefas

### 3.1 — Atualizar `usePageStore` para estado de bloqueio

**Arquivo:** `src/stores/usePageStore.ts`

```typescript
type PageLockState = 'unlocked' | 'locked' | 'loading';

interface PageStore {
  currentPage: Page | null;
  lockState: PageLockState;        // NOVO
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  loadPage: (pageId: string) => Promise<void>;
  unlockPage: (pageId: string, password: string) => Promise<void>;  // NOVO
  setPagePassword: (pageId: string, password: string) => Promise<void>;    // NOVO
  removePagePassword: (pageId: string, password: string) => Promise<void>; // NOVO
  changePagePassword: (pageId: string, oldPw: string, newPw: string) => Promise<void>; // NOVO
  updateBlocks: (pageId: string, blocks: Block[]) => Promise<void>;
}
```

Lógica de `loadPage` adaptada:

```typescript
loadPage: async (pageId) => {
  set({ lockState: 'loading', currentPage: null });
  try {
    const page = await ipc.loadPage(pageId);
    // Backend retorna page com blocks vazio quando está protegida e não desbloqueada
    if (page.protection && page.blocks.length === 0 && page.encryptedContent) {
      set({ currentPage: page, lockState: 'locked' });
    } else {
      set({ currentPage: page, lockState: 'unlocked' });
    }
  } catch (e) {
    set({ lockState: 'unlocked', currentPage: null });
    throw e;
  }
},

unlockPage: async (pageId, password) => {
  const page = await ipc.unlockPage(pageId, password);
  set({ currentPage: page, lockState: 'unlocked' });
},
```

**Critérios:**
- [ ] `lockState` transita corretamente entre `loading`, `locked`, `unlocked`
- [ ] `unlockPage` lança erro identificável como `"WRONG_PASSWORD"` quando a senha é errada
- [ ] `setPagePassword` / `removePagePassword` / `changePagePassword` delegam para IPC e atualizam `currentPage`

---

### 3.2 — Ícone de cadeado no `PageItem` da sidebar

**Arquivo:** `src/components/layout/NotebookTree/PageItem.tsx` (ou caminho equivalente)

O `summary.title` já retorna `"[Página protegida]"` do backend — nenhuma lógica de substituição
de texto necessária no frontend. Apenas adicionar o ícone e o estilo visual:

```tsx
import { Lock } from 'lucide-react';

// Dentro do componente PageItem, ao renderizar o título:
<span className={cn('truncate', summary.isProtected && 'text-muted-foreground italic')}>
  {summary.title}
</span>
{summary.isProtected && (
  <Lock
    className="h-3 w-3 text-muted-foreground shrink-0 ml-1"
    aria-label={t('page.protected')}
  />
)}
```

O campo `isProtected` vem de `PageSummary` (adicionado na Fase 1).

**Critérios:**
- [ ] Ícone `Lock` visível ao lado de `"[Página protegida]"` na sidebar
- [ ] Texto em itálico e muted para pages protegidas
- [ ] Ícone não aparece em pages sem proteção
- [ ] Ícone tem `aria-label` adequado

---

### 3.3 — Context menu na Section: "Listar páginas protegidas"

**Arquivo:** `src/components/layout/NotebookTree/SectionItem.tsx` (ou equivalente)

Adicionada ao context menu do item de Section, visível apenas quando há ao menos uma page
com `isProtected: true` nos summaries já carregados:

```tsx
import { ShieldCheck } from 'lucide-react';

const hasProtectedPages = summaries.some((s) => s.isProtected);

{hasProtectedPages && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => openProtectedPagesPanel(section.id)}>
      <ShieldCheck className="mr-2 h-4 w-4" />
      {t('section.contextMenu.listProtectedPages')}
    </DropdownMenuItem>
  </>
)}
```

**Critérios:**
- [ ] Opção visível apenas quando `summaries.some(s => s.isProtected) === true`
- [ ] Clique abre o `ProtectedPagesPanel` filtrado para a section
- [ ] Ícone `ShieldCheck` da lucide-react

---

### 3.4 — `ProtectedPagesPanel` — listar e desbloquear pages protegidas

**Arquivo:** `src/components/modals/ProtectedPagesPanel.tsx` (arquivo novo)

Painel (Sheet) que lista todas as pages protegidas de uma section. Cada item mostra o
placeholder `"[Página protegida]"` + ícone de cadeado. O usuário clica em uma page,
digita a senha e o título real é revelado na lista.

```tsx
interface ProtectedPagesPanelProps {
  sectionId: string;
  summaries: PageSummary[];
  open: boolean;
  onClose: () => void;
  onNavigate: (pageId: string) => void;
}

export function ProtectedPagesPanel({ summaries, open, onClose, onNavigate }: ProtectedPagesPanelProps) {
  const protectedPages = summaries.filter((s) => s.isProtected);
  const [unlockingPageId, setUnlockingPageId] = useState<string | null>(null);
  const [revealedTitles, setRevealedTitles] = useState<Record<string, string>>({});
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('section.protectedPages.title')}</SheetTitle>
          <SheetDescription>{t('section.protectedPages.description')}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {protectedPages.map((page) => (
            <div key={page.id} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm italic text-muted-foreground">
                  {revealedTitles[page.id] ?? t('page.protected')}
                </span>
              </div>
              <Button size="sm" variant="outline"
                onClick={() => setUnlockingPageId(page.id)}
              >
                {revealedTitles[page.id] ? t('common.open') : t('page.password.unlock')}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>

      {unlockingPageId && (
        <PasswordUnlockDialog
          pageId={unlockingPageId}
          open={true}
          onSuccess={(page) => {
            setRevealedTitles((prev) => ({ ...prev, [unlockingPageId]: page.title }));
            setUnlockingPageId(null);
          }}
          onCancel={() => setUnlockingPageId(null)}
        />
      )}
    </Sheet>
  );
}
```

**Critérios:**
- [ ] Lista apenas pages com `isProtected: true`
- [ ] Título não revelado exibe `"[Página protegida]"` em itálico
- [ ] Após unlock bem-sucedido, título real substitui o placeholder na lista
- [ ] Botão "Abrir" (após revelar título) navega para a page via `onNavigate`

---

### 3.5 — Context menu na Page com opções de senha

**Arquivo:** `src/components/layout/NotebookTree/PageItem.tsx` (context menu existente)

Adicionar ao context menu da page as opções condicionais:

```tsx
// Opção condicional baseada em summary.isProtected
{!summary.isProtected ? (
  <DropdownMenuItem onClick={() => openSetPasswordDialog(summary.id)}>
    <Lock className="mr-2 h-4 w-4" />
    {t('page.contextMenu.protectWithPassword')}
  </DropdownMenuItem>
) : (
  <>
    <DropdownMenuItem onClick={() => openChangePasswordDialog(summary.id)}>
      <Key className="mr-2 h-4 w-4" />
      {t('page.contextMenu.changePassword')}
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => openRemovePasswordDialog(summary.id)}
      className="text-destructive"
    >
      <LockOpen className="mr-2 h-4 w-4" />
      {t('page.contextMenu.removePassword')}
    </DropdownMenuItem>
  </>
)}
```

**Critérios:**
- [ ] "Proteger com senha" visível apenas para pages não protegidas
- [ ] "Trocar senha" e "Remover proteção" visíveis apenas para pages protegidas
- [ ] Ícones Lucide: `Lock`, `Key`, `LockOpen`

---

### 3.6 — `PasswordUnlockDialog` — diálogo de desbloqueio

**Arquivo:** `src/components/modals/PasswordUnlockDialog.tsx` (arquivo novo)

> **Nota:** Sem prop `pageTitle` — o título real só é conhecido após o unlock.
> O diálogo exibe uma descrição genérica. A prop `onSuccess` recebe a `Page` descriptografada.

```tsx
interface PasswordUnlockDialogProps {
  pageId: string;
  open: boolean;
  onSuccess: (page: Page) => void;   // recebe a Page com título real
  onCancel: () => void;
}

export function PasswordUnlockDialog({
  pageId, open, onSuccess, onCancel
}: PasswordUnlockDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { unlockPage } = usePageStore();
  const { t } = useTranslation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const page = await ipc.unlockPage(pageId, password);
      usePageStore.getState().setCurrentPage(page, 'unlocked');
      onSuccess(page);
    } catch (err) {
      const msg = String(err);
      if (msg.includes('WRONG_PASSWORD')) {
        setError(t('page.password.wrongPassword'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <DialogTitle>{t('page.password.unlockTitle')}</DialogTitle>
          <DialogDescription>
            {t('page.password.unlockDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            type="password"
            placeholder={t('page.password.placeholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-destructive text-sm mt-1">{error}</p>}
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!password || loading}>
              {loading ? t('common.loading') : t('page.password.unlock')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Critérios:**
- [ ] Enter submete o formulário
- [ ] Erro de senha errada exibido inline (sem fechar o diálogo)
- [ ] Loading state durante a derivação Argon2 (pode demorar ~500ms)
- [ ] Cancelar fecha o diálogo sem navegar para a page
- [ ] `onSuccess(page)` recebe a `Page` com o título real já descriptografado

---

### 3.7 — `SetPasswordDialog` — definir / remover / trocar senha

**Arquivo:** `src/components/modals/SetPasswordDialog.tsx` (arquivo novo)

```tsx
type Mode = 'set' | 'change' | 'remove';

interface SetPasswordDialogProps {
  pageId: string;
  mode: Mode;
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function SetPasswordDialog({ pageId, mode, open, onSuccess, onCancel }: SetPasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setPagePassword, removePagePassword, changePagePassword } = usePageStore();
  const { t } = useTranslation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode !== 'remove' && newPassword !== confirmPassword) {
      setError(t('page.password.passwordMismatch'));
      return;
    }
    if (mode !== 'remove' && newPassword.length < 6) {
      setError(t('page.password.tooShort'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'set') {
        await setPagePassword(pageId, newPassword);
      } else if (mode === 'remove') {
        await removePagePassword(pageId, oldPassword);
      } else {
        await changePagePassword(pageId, oldPassword, newPassword);
      }
      onSuccess();
    } catch (err) {
      const msg = String(err);
      if (msg.includes('WRONG_PASSWORD')) {
        setError(t('page.password.wrongPassword'));
      } else {
        setError(t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ... renderização com campos condicionais baseados em `mode`
}
```

O diálogo de "remover" deve exibir um aviso de que o conteúdo ficará **desprotegido** e legível
por qualquer um com acesso ao arquivo.

**Critérios:**
- [ ] Modo `set`: apenas campos "nova senha" e "confirmar"
- [ ] Modo `change`: campos "senha atual", "nova senha", "confirmar"
- [ ] Modo `remove`: campo "senha atual" + aviso de risco
- [ ] Validação: senha mínima de 6 caracteres, confirmação obrigatória
- [ ] Aviso de que senha esquecida = perda permanente do conteúdo

---

### 3.8 — Integrar diálogos no `PageEditor`

**Arquivo:** `src/components/editor/PageEditor.tsx`

```tsx
const { currentPage, lockState, unlockPage } = usePageStore();

// Quando a page está bloqueada, renderizar o diálogo em vez do editor
if (lockState === 'locked' && currentPage) {
  return (
    <PasswordUnlockDialog
      pageId={currentPage.id}
      open={true}
      onSuccess={() => {/* store já foi atualizado com título real */}}
      onCancel={() => navigationStore.clearCurrentPage()}
    />
  );
}
// Após unlock, currentPage.title no store passa a ser o título real

// Caso normal: renderizar editor
```

**Critérios:**
- [ ] Page bloqueada exibe diálogo de senha em vez do editor
- [ ] Após unlock, o editor é exibido normalmente com o conteúdo
- [ ] Cancelar o unlock desfoca a page (volta para Welcome ou mantém navegação)

---

### 3.9 — Strings i18n

**Arquivo:** `src/locales/pt-BR.json` (acrescentar as chaves abaixo)

```json
{
  "section": {
    "contextMenu": {
      "listProtectedPages": "Listar páginas protegidas"
    },
    "protectedPages": {
      "title": "Páginas protegidas",
      "description": "Desbloqueie individualmente para revelar os títulos."
    }
  },
  "page": {
    "protected": "Página protegida",
    "contextMenu": {
      "protectWithPassword": "Proteger com senha",
      "changePassword": "Trocar senha",
      "removePassword": "Remover proteção"
    },
    "password": {
      "unlockTitle": "Página protegida",
      "unlockDescription": "Esta página está protegida por senha. Digite a senha para desbloquear.",
      "placeholder": "Digite a senha",
      "unlock": "Desbloquear",
      "setTitle": "Proteger página com senha",
      "changeTitle": "Trocar senha",
      "removeTitle": "Remover proteção",
      "currentPassword": "Senha atual",
      "newPassword": "Nova senha",
      "confirmPassword": "Confirmar senha",
      "wrongPassword": "Senha incorreta. Tente novamente.",
      "passwordMismatch": "As senhas não coincidem.",
      "tooShort": "A senha deve ter pelo menos 6 caracteres.",
      "removeWarning": "⚠️ O conteúdo ficará desprotegido e legível por qualquer pessoa com acesso ao arquivo.",
      "forgotWarning": "Atenção: se você esquecer a senha, o conteúdo desta página não poderá ser recuperado."
    }
  }
}
```

**Arquivo:** `src/locales/en.json` (acrescentar as chaves abaixo)

```json
{
  "section": {
    "contextMenu": {
      "listProtectedPages": "List protected pages"
    },
    "protectedPages": {
      "title": "Protected pages",
      "description": "Unlock each page individually to reveal its title."
    }
  },
  "page": {
    "protected": "Protected page",
    "contextMenu": {
      "protectWithPassword": "Protect with password",
      "changePassword": "Change password",
      "removePassword": "Remove protection"
    },
    "password": {
      "unlockTitle": "Protected page",
      "unlockDescription": "This page is password-protected. Enter the password to unlock.",
      "placeholder": "Enter password",
      "unlock": "Unlock",
      "setTitle": "Protect page with password",
      "changeTitle": "Change password",
      "removeTitle": "Remove protection",
      "currentPassword": "Current password",
      "newPassword": "New password",
      "confirmPassword": "Confirm password",
      "wrongPassword": "Wrong password. Please try again.",
      "passwordMismatch": "Passwords do not match.",
      "tooShort": "Password must be at least 6 characters.",
      "removeWarning": "⚠️ The content will be unprotected and readable by anyone with access to the file.",
      "forgotWarning": "Warning: if you forget the password, the content of this page cannot be recovered."
    }
  }
}
```

**Critérios:**
- [ ] Todas as strings presentes em `pt-BR.json` e `en.json`
- [ ] `unlockDescription` sem interpolação de título (desconhecido antes do unlock)
- [ ] Nenhuma string hardcoded nos componentes

---

### 3.10 — Testes de componente

**Arquivo:** `src/components/modals/__tests__/PasswordUnlockDialog.test.tsx`

| Teste | Descrição |
|-------|-----------|
| `renders_generic_unlock_description` | Diálogo exibe descrição genérica (sem título da page) |
| `submit_calls_unlockPage` | Preencher senha e submeter chama `usePageStore().unlockPage` |
| `wrong_password_shows_error` | Mock `unlockPage` rejeita com `"WRONG_PASSWORD"` → erro visível |
| `cancel_calls_onCancel` | Botão cancelar chama `onCancel` |
| `enter_key_submits` | Pressionar Enter submete o formulário |

**Arquivo:** `src/components/modals/__tests__/SetPasswordDialog.test.tsx`

| Teste | Descrição |
|-------|-----------|
| `mode_set_hides_current_password_field` | Modo `set` não mostra campo "senha atual" |
| `mode_remove_shows_warning` | Modo `remove` mostra aviso de risco |
| `password_mismatch_shows_error` | Confirmação diferente → erro inline |
| `too_short_shows_error` | Menos de 6 caracteres → erro inline |

**Arquivo:** `src/components/modals/__tests__/ProtectedPagesPanel.test.tsx`

| Teste | Descrição |
|-------|-----------|
| `shows_only_protected_pages` | Apenas pages com `isProtected: true` são listadas |
| `unlock_reveals_real_title` | Unlock bem-sucedido substitui placeholder pelo título real |
| `empty_panel_not_shown_in_context_menu` | Se não há pages protegidas, opção da section fica oculta |

**Critérios:**
- [ ] `npm test` passa com ≥ 80% de cobertura nos novos componentes
- [ ] Testes usam MSW para mock dos IPC calls

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/stores/usePageStore.ts` | Alteração — `lockState`, novos actions para senha |
| `src/components/layout/NotebookTree/PageItem.tsx` | Alteração — ícone `Lock` + estilo italic + context menu |
| `src/components/layout/NotebookTree/SectionItem.tsx` | Alteração — context menu "Listar páginas protegidas" |
| `src/components/editor/PageEditor.tsx` | Alteração — lógica de `locked` state |
| `src/components/modals/PasswordUnlockDialog.tsx` | **Novo** |
| `src/components/modals/SetPasswordDialog.tsx` | **Novo** |
| `src/components/modals/ProtectedPagesPanel.tsx` | **Novo** |
| `src/locales/pt-BR.json` | Alteração — novas strings |
| `src/locales/en.json` | Alteração — novas strings |

## Arquivos NÃO Modificados (ainda)

- `crates/search/` — Exclusão de indexação (Fase 4)
- Testes E2E (Fase 4)

---

## Critérios de Aceitação da Fase

- [ ] `npm run typecheck` sem erros
- [ ] `npm test` sem falhas (incluindo novos testes)
- [ ] `cargo test --workspace` sem regressões
- [ ] Fluxo completo manual: definir senha → sidebar mostra placeholder → reabrir → digitar senha → título real exibido
- [ ] Fluxo "Listar páginas protegidas" via context menu da Section: lista placeholder → unlock revela título
- [ ] Fluxo de senha errada: aviso inline sem fechar o diálogo
- [ ] Fluxo de remoção de proteção: título e conteúdo visíveis na sidebar após remoção
- [ ] PR review aprovado
