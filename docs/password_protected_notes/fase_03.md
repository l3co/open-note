# Fase 03 — Frontend: Diálogos, Sidebar & Stores

**Esforço estimado:** ~14 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Fase 2
**Branch:** `feat/password-protected-notes-phase-3`

---

## Objetivo

Implementar toda a camada de UI para a feature de proteção por senha:
- Ícone de cadeado na sidebar para pages protegidas
- Context menu com opções "Proteger com senha", "Remover proteção", "Trocar senha"
- `PasswordUnlockDialog` — exibido ao abrir uma page protegida
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

```tsx
import { Lock } from 'lucide-react';

// Dentro do componente PageItem, após o título:
{summary.isProtected && (
  <Lock
    className="h-3 w-3 text-muted-foreground shrink-0"
    aria-label={t('page.protected')}
  />
)}
```

O campo `isProtected` vem de `PageSummary` (adicionado na Fase 1).

**Critérios:**
- [ ] Ícone `Lock` da lucide-react visível ao lado do título de pages protegidas
- [ ] Ícone não aparece em pages sem proteção
- [ ] Ícone tem `aria-label` adequado

---

### 3.3 — Context menu com opções de senha

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

### 3.4 — `PasswordUnlockDialog` — diálogo de desbloqueio

**Arquivo:** `src/components/modals/PasswordUnlockDialog.tsx` (arquivo novo)

```tsx
interface PasswordUnlockDialogProps {
  pageId: string;
  pageTitle: string;
  open: boolean;
  onSuccess: () => void;   // chamado após unlock bem-sucedido
  onCancel: () => void;
}

export function PasswordUnlockDialog({
  pageId, pageTitle, open, onSuccess, onCancel
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
      await unlockPage(pageId, password);
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

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <DialogTitle>{t('page.password.unlockTitle')}</DialogTitle>
          <DialogDescription>
            {t('page.password.unlockDescription', { title: pageTitle })}
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

---

### 3.5 — `SetPasswordDialog` — definir / remover / trocar senha

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

### 3.6 — Integrar diálogos no `PageEditor`

**Arquivo:** `src/components/editor/PageEditor.tsx`

```tsx
const { currentPage, lockState, unlockPage } = usePageStore();

// Quando a page está bloqueada, renderizar o diálogo em vez do editor
if (lockState === 'locked' && currentPage) {
  return (
    <PasswordUnlockDialog
      pageId={currentPage.id}
      pageTitle={currentPage.title}
      open={true}
      onSuccess={() => {/* store já foi atualizado pelo unlockPage */}}
      onCancel={() => navigationStore.clearCurrentPage()}
    />
  );
}

// Caso normal: renderizar editor
```

**Critérios:**
- [ ] Page bloqueada exibe diálogo de senha em vez do editor
- [ ] Após unlock, o editor é exibido normalmente com o conteúdo
- [ ] Cancelar o unlock desfoca a page (volta para Welcome ou mantém navegação)

---

### 3.7 — Strings i18n

**Arquivo:** `src/locales/pt-BR.json`

```json
{
  "page": {
    "protected": "Página protegida",
    "contextMenu": {
      "protectWithPassword": "Proteger com senha",
      "changePassword": "Trocar senha",
      "removePassword": "Remover proteção"
    },
    "password": {
      "unlockTitle": "Página protegida",
      "unlockDescription": "Digite a senha para abrir \"{{title}}\"",
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

**Arquivo:** `src/locales/en.json`

```json
{
  "page": {
    "protected": "Protected page",
    "contextMenu": {
      "protectWithPassword": "Protect with password",
      "changePassword": "Change password",
      "removePassword": "Remove protection"
    },
    "password": {
      "unlockTitle": "Protected page",
      "unlockDescription": "Enter the password to open \"{{title}}\"",
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
- [ ] Interpolação `{{title}}` no `unlockDescription`
- [ ] Nenhuma string hardcoded nos componentes

---

### 3.8 — Testes de componente

**Arquivo:** `src/components/modals/__tests__/PasswordUnlockDialog.test.tsx`

| Teste | Descrição |
|-------|-----------|
| `renders_with_page_title` | Diálogo exibe título da page no texto |
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

**Critérios:**
- [ ] `npm test` passa com ≥ 80% de cobertura nos novos componentes
- [ ] Testes usam MSW para mock dos IPC calls

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/stores/usePageStore.ts` | Alteração — `lockState`, novos actions para senha |
| `src/components/layout/NotebookTree/PageItem.tsx` | Alteração — ícone `Lock` + context menu |
| `src/components/editor/PageEditor.tsx` | Alteração — lógica de `locked` state |
| `src/components/modals/PasswordUnlockDialog.tsx` | **Novo** |
| `src/components/modals/SetPasswordDialog.tsx` | **Novo** |
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
- [ ] Fluxo completo manual testado: definir senha → fechar page → reabrir → digitar senha → ver conteúdo
- [ ] Fluxo de senha errada: aviso inline sem fechar o diálogo
- [ ] Fluxo de remoção de proteção: conteúdo visível em plaintext após remoção
- [ ] PR review aprovado
