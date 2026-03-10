# Fase 02 — Quick Notes: Auto-criação no Workspace + Botão "Nova Página" Conectado

**Esforço estimado:** ~10 horas  
**Prioridade:** 🟡 Alta  
**Dependências:** Fase 1  
**Branch:** `feat/quick-notes-phase-2`

---

## Objetivo

Garantir que todo workspace novo seja criado com um notebook **"Quick Notes"** e uma section **"Quick Notes"** prontos para uso. Conectar o botão "Nova Página" da `HomePage` para criar páginas diretamente nessa area. Workspaces existentes não são migrados forçosamente, mas o usuário pode "adotar" o Quick Notes via settings.

---

## Contexto Atual

### Criação de workspace (backend) — `commands/workspace.rs:44`

```rust
let workspace = FsStorageEngine::create_workspace(&root, &name).map_err(CommandError::from)?;
// ← após esta linha, o workspace está vazio. Nenhum notebook/section é criado.
```

### WorkspaceSettings — `crates/core/src/workspace.rs`

```rust
pub struct WorkspaceSettings {
    pub default_section_id: Option<SectionId>,
    // ... outros campos
}
```

Não existe campo para identificar o Quick Notes notebook/section.

### Frontend — `useMultiWorkspaceStore.createWorkspace`

```ts
createWorkspace: async (path, name) => {
  const workspace = await ipc.createWorkspace(path, name);
  set((s) => {
    const workspaces = new Map(s.workspaces);
    workspaces.set(workspace.id, {
      workspace,
      notebooks: [],         // ← sempre vazio após criação
      sections: new Map(),
      navigation: defaultNavigation(),
    });
    return { workspaces, focusedWorkspaceId: workspace.id };
  });
  // ...
}
```

---

## Tarefas

### 2.1 — Adicionar campos Quick Notes em `WorkspaceSettings`

**Arquivo:** `crates/core/src/workspace.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct WorkspaceSettings {
    pub default_section_id: Option<SectionId>,
    pub quick_notes_notebook_id: Option<NotebookId>,   // NOVO
    pub quick_notes_section_id: Option<SectionId>,     // NOVO
    // ... campos existentes mantidos
}
```

**Critérios:**
- [ ] Campos `Option<>` — backward compatible (workspaces antigos deserializam com `None`)
- [ ] `ts-rs` gera bindings atualizados em `src/types/bindings/WorkspaceSettings.ts`
- [ ] `Default::default()` inicializa ambos como `None`
- [ ] Snapshot test (insta) verifica que JSON antigo sem os campos deserializa corretamente

---

### 2.2 — Criar Quick Notes após `create_workspace` no backend

**Arquivo:** `src-tauri/src/commands/workspace.rs`

Após criar o workspace, criar o notebook e a section de Quick Notes, e persistir os IDs em `workspace.settings`:

```rust
pub fn create_workspace(
    state: State<AppManagedState>,
    path: String,
    name: String,
) -> Result<Workspace, CommandError> {
    // ... código existente ...
    let workspace = FsStorageEngine::create_workspace(&root, &name).map_err(CommandError::from)?;

    // NOVO: criar Quick Notes
    let quick_notebook = FsStorageEngine::create_notebook(&root, "Quick Notes")
        .map_err(CommandError::from)?;
    let quick_section = FsStorageEngine::create_section(&root, quick_notebook.id, "Quick Notes")
        .map_err(CommandError::from)?;

    // Persistir IDs no workspace.settings
    let mut ws = FsStorageEngine::load_workspace(&root).map_err(CommandError::from)?;
    ws.settings.quick_notes_notebook_id = Some(quick_notebook.id);
    ws.settings.quick_notes_section_id = Some(quick_section.id);
    FsStorageEngine::save_workspace(&ws).map_err(CommandError::from)?;

    // ... código existente (app_state, ctx, register) ...
    Ok(ws)  // retorna workspace com settings atualizados
}
```

**Critérios:**
- [ ] Workspace novo sempre tem notebook "Quick Notes" + section "Quick Notes"
- [ ] `workspace.settings.quick_notes_notebook_id` e `quick_notes_section_id` preenchidos
- [ ] Falha na criação do Quick Notes **não impede** a criação do workspace (use `warn!` em vez de `?` se preferir degradação graciosa)
- [ ] `cargo test -p opennote-storage` passa

---

### 2.3 — Retornar workspace com settings atualizados no IPC

**Arquivo:** `src-tauri/src/commands/workspace.rs`

Garantir que o comando retorna o `Workspace` com os `settings` já preenchidos (com `quick_notes_*`), para que o frontend possa ler os IDs diretamente.

**Critérios:**
- [ ] `create_workspace` retorna `Workspace` com `settings.quick_notes_section_id` preenchido
- [ ] `open_workspace` retorna `Workspace` com `settings` lidos do disco (incluindo `quick_notes_*` se presentes)

---

### 2.4 — Expor `quickNotesSectionId` no `WorkspaceSlice` do frontend

**Arquivo:** `src/stores/useMultiWorkspaceStore.ts`

O `WorkspaceSlice` já armazena o objeto `Workspace` completo, que inclui `settings`. Não é necessária mudança na store — o `settings.quick_notes_section_id` estará acessível via `focusedSlice()?.workspace.settings.quick_notes_section_id`.

**Arquivo:** `src/stores/useWorkspaceStore.ts` (se existir facade relevante)

Adicionar selector de conveniência se necessário:

```ts
// Em useMultiWorkspaceStore ou hook dedicado
export function useQuickNotesSectionId(): string | null {
  return useMultiWorkspaceStore(
    (s) => s.focusedSlice()?.workspace.settings.quick_notes_section_id ?? null
  );
}
```

**Critérios:**
- [ ] `quickNotesSectionId` acessível nos componentes sem acessar o objeto inteiro de settings
- [ ] Retorna `null` para workspaces legados (sem Quick Notes)

---

### 2.5 — Conectar botão "Nova Página" ao Quick Notes em `HomePage.tsx`

**Arquivo:** `src/components/pages/HomePage.tsx`

Substituir o handler de fallback da Fase 1 pela versão definitiva:

```tsx
const quickNotesSectionId = useMultiWorkspaceStore(
  (s) => s.focusedSlice()?.workspace.settings.quick_notes_section_id ?? null
);

const handleNewPage = async () => {
  if (quickNotesSectionId) {
    try {
      const page = await createPage(quickNotesSectionId, t("page.new"));
      selectPage(page.id);
      await loadPage(page.id);
    } catch {
      /* erro tratado pela store */
    }
    return;
  }
  // Fallback: workspace legado sem Quick Notes — abre QuickOpen
  openQuickOpen();
};
```

**Critérios:**
- [ ] Em workspace novo: clique cria página no Quick Notes e navega para ela
- [ ] Em workspace legado (sem `quick_notes_section_id`): abre QuickOpen como fallback
- [ ] A página criada fica visível na sidebar sob "Quick Notes"

---

### 2.6 — Atualizar `WorkspacePicker` para expandir Quick Notes após criação

**Arquivo:** `src/components/workspace/WorkspacePicker.tsx`

Após `createWorkspace`, expandir automaticamente o notebook Quick Notes na sidebar para que o usuário veja o resultado imediatamente:

```tsx
const workspace = await createWorkspace(path, name);
if (workspace) {
  // Carregar notebooks para que Quick Notes apareça na sidebar
  await loadNotebooks(workspace.id);
  // Expandir notebook Quick Notes se o ID estiver em settings
  const qnNotebookId = workspace.settings.quick_notes_notebook_id;
  if (qnNotebookId) {
    toggleNotebook(qnNotebookId);
    await loadSections(qnNotebookId);
  }
}
```

**Critérios:**
- [ ] Após criar workspace, sidebar mostra "Quick Notes" expandido
- [ ] Usuário não precisa clicar para ver a estrutura inicial

---

### 2.7 — Testes

**Arquivo:** `src/components/workspace/__tests__/WorkspacePicker.test.tsx`  
**Arquivo:** `src/components/pages/__tests__/HomePage.test.tsx`

| Teste | Descrição |
|-------|-----------|
| `new_workspace_has_quick_notes_section` | Mock IPC, verifica que `createWorkspace` retorna workspace com `quick_notes_section_id` |
| `new_page_uses_quick_notes_section` | Mock store com `quickNotesSectionId`, verifica que `createPage` usa esse ID |
| `new_page_fallback_when_no_quick_notes` | `quickNotesSectionId = null`, verifica que `openQuickOpen` é chamado |
| `workspace_picker_expands_quick_notes_after_create` | Verifica que notebook Quick Notes é expandido na sidebar |

**Arquivo:** `src-tauri/src/commands/workspace.rs` (mod tests no Rust)

| Teste | Descrição |
|-------|-----------|
| `create_workspace_generates_quick_notes` | Cria workspace em tempdir, verifica que notebook e section "Quick Notes" existem no filesystem |
| `create_workspace_settings_have_quick_notes_ids` | Verifica que `workspace.settings.quick_notes_*` estão preenchidos |

**Critérios:**
- [ ] Todos os testes Rust e TypeScript passando
- [ ] `cargo test --workspace` e `npm run test` sem falhas

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/workspace.rs` | Adição de 2 campos em `WorkspaceSettings` |
| `src/types/bindings/WorkspaceSettings.ts` | Atualizado (gerado por ts-rs) |
| `src-tauri/src/commands/workspace.rs` | `create_workspace` cria Quick Notes |
| `src/stores/useMultiWorkspaceStore.ts` | Selector `useQuickNotesSectionId` (opcional) |
| `src/components/pages/HomePage.tsx` | Handler `handleNewPage` definitivo |
| `src/components/workspace/WorkspacePicker.tsx` | Expansão auto após criação |
| `src/components/pages/__tests__/HomePage.test.tsx` | Novos testes |
| `src/components/workspace/__tests__/WorkspacePicker.test.tsx` | Novos testes |

## Arquivos NÃO Modificados

- `crates/storage/` — `create_notebook` e `create_section` são reutilizados sem mudança
- `src/stores/usePageStore.ts` — `createPage` já funciona, sem mudança
- `src/components/sidebar/NotebookTree.tsx` — sem mudança

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa incluindo testes de `create_workspace`
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run test` passa com todos os novos testes
- [ ] `npm run typecheck` sem erros
- [ ] Workspace novo tem "Quick Notes" visível imediatamente após criação
- [ ] Botão "Nova Página" cria página no Quick Notes e navega para ela
- [ ] Workspaces existentes continuam funcionando (sem regressão)
- [ ] PR review aprovado
