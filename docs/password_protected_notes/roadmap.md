# Password-Protected Notes — Roadmap

## Visão Geral

Permitir que o usuário proteja pages individuais com senha. A page protegida tem seu conteúdo
(`blocks` + `annotations`) **criptografado em repouso** no arquivo `.opn.json`, usando
AES-256-GCM com chave derivada por Argon2id a partir da senha do usuário.

O fluxo de uso é:
1. Clique-direito na page na sidebar → "Proteger com senha"
2. Usuário define uma senha → conteúdo é imediatamente criptografado e salvo
3. Na próxima abertura da page, aparece um diálogo de senha
4. Após unlock correto, o conteúdo é descriptografado em memória e exibido normalmente
5. Auto-save re-criptografa o conteúdo antes de escrever em disco

O título da page permanece visível (não criptografado) para permitir navegação na sidebar.
A chave derivada é mantida em memória apenas durante a sessão de unlock — nunca persiste em disco.

**Inspiração:** Notas seguras no Apple Notes, OneNote com proteção de seção por senha.

---

## Estado Atual

### Arquitetura Existente

```
Page (crates/core/src/page.rs)
├── id: PageId
├── section_id: SectionId
├── title: String              ← visível na sidebar
├── tags: Vec<String>
├── blocks: Vec<Block>         ← conteúdo que precisa ser criptografado
├── annotations: PageAnnotations  ← idem
├── editor_preferences: EditorPreferences
├── pdf_asset: Option<String>
├── pdf_total_pages: Option<u32>
├── canvas_state: Option<Value>
├── created_at / updated_at
└── schema_version: u32        ← atualmente 1

PageSummary (crates/core/src/page.rs)
├── id: PageId
├── title: String
├── tags: Vec<String>
├── mode: EditorMode
├── block_count: usize
├── created_at / updated_at
└── (sem campo de proteção)

FsStorageEngine (crates/storage/src/engine.rs)
├── load_page(root, page_id) → lê .opn.json diretamente com read_json()
└── update_page(root, page)  → escreve com atomic_write_json()

AppManagedState (src-tauri/src/state.rs)
└── (sem cache de chaves de sessão)
```

### Pontos de Acoplamento Identificados

| Camada | Arquivo | Acoplamento |
|--------|---------|-------------|
| **Domínio** | `crates/core/src/page.rs` | `Page` e `PageSummary` precisam de campos de proteção |
| **Storage** | `crates/storage/src/engine.rs` | `load_page` / `update_page` precisam saber sobre criptografia |
| **Migrations** | `crates/storage/src/migrations.rs` | Schema v1 → v2 (adiciona campos opcionais) |
| **Tauri State** | `src-tauri/src/state.rs` | Session key cache: `HashMap<PageId, DerivedKey>` |
| **IPC Commands** | `src-tauri/src/commands/page.rs` | `load_page` deve retornar page bloqueada; novos commands de senha |
| **Search** | `crates/search/src/` | Pages protegidas não devem ser indexadas pelo conteúdo |
| **Frontend Store** | `src/stores/usePageStore.ts` | Estado `locked` / `unlocked` da page atual |
| **Frontend UI** | `src/components/` | Sidebar com ícone de cadeado, diálogos de senha |
| **i18n** | `src/locales/` | Strings para diálogos de senha |

---

## Avaliação de Complexidade

### Classificação: 🟡 MÉDIA (Score: 6/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Mudanças no domínio (`crates/core`) | Baixo — adicionar campos opcionais com `#[serde(default)]` | 2/5 |
| Nova crate de criptografia (`crates/storage`) | Médio — AES-256-GCM + Argon2id, mas crates maduras existem | 3/5 |
| Schema v2 + migration | Baixo — campos novos são opcionais, retrocompatibilidade trivial | 1/5 |
| Session key cache no `AppManagedState` | Baixo — adicionar `Mutex<HashMap<PageId, Vec<u8>>>` | 2/5 |
| Novos IPC commands (4 novos) | Médio — lógica de negócio de criptografia + validação de senha | 3/5 |
| Frontend (diálogos, store, sidebar) | Médio — componentes novos sem mudar lógica existente | 3/5 |
| Search exclusion de pages protegidas | Baixo — skip na indexação quando `protection.is_some()` | 1/5 |
| Interação com Sync | Baixo — arquivos criptografados sincronizam como blobs opacos | 1/5 |
| Testes (unit + E2E) | Médio — criptografia requer testes de roundtrip + cenários de erro | 3/5 |

**Estimativa de esforço total: ~50 horas de desenvolvimento**

### Riscos Principais

1. **Perda de dados por senha esquecida** — sem recuperação possível (design intencional, avisar ao usuário)
2. **Argon2id parâmetros muito agressivos** — pode deixar o unlock lento em hardware fraco (tuneable)
3. **Nonce reutilização em AES-GCM** — crítico; nonce deve ser gerado aleatoriamente a cada save
4. **Schema migration** — pages antigas sem campo `protection` devem deserializar sem problemas (`#[serde(default)]`)
5. **Auto-save com page protegida** — se a chave de sessão for perdida (bug), o save vai gravar blocks vazios

---

## Estratégia de Implementação

### Princípio: Additive, Zero Breaking Change

Todos os campos novos em `Page` são opcionais com `#[serde(default)]`. Pages não protegidas
continuam funcionando exatamente como antes. A criptografia é transparente na camada de storage.

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| 1 | **Domínio & Criptografia** — core + encryption service | ~16h | 🔴 Crítica | — |
| 2 | **IPC Commands** — session cache + 4 novos commands + adaptar `load_page` | ~12h | 🔴 Crítica | Fase 1 |
| 3 | **Frontend** — diálogos, sidebar, stores, i18n | ~14h | 🔴 Crítica | Fase 2 |
| 4 | **Search, Edge Cases & Testes** — exclusão de indexação, testes E2E, polish | ~8h | 🟡 Alta | Fase 3 |

---

## Modelo de Domínio Proposto

### Antes
```
Page {
  id, section_id, title, tags, blocks, annotations,
  editor_preferences, pdf_asset, pdf_total_pages,
  canvas_state, created_at, updated_at,
  schema_version: 1
}

PageSummary {
  id, title, tags, mode, block_count, created_at, updated_at
}
```

### Depois
```
Page {
  id, section_id, title, tags, blocks, annotations,
  editor_preferences, pdf_asset, pdf_total_pages, canvas_state,
  created_at, updated_at,
  schema_version: 2,                                    ← BUMP
  protection: Option<PageProtection>,                   ← NOVO
  encrypted_content: Option<String>,                    ← NOVO (base64 AES-GCM ciphertext)
}

PageProtection {                                        ← NOVO (crates/core)
  algorithm: EncryptionAlgorithm,   // "aes_gcm_256"
  kdf: KeyDerivationFunction,       // "argon2id"
  kdf_params: KdfParams,            // { m_cost, t_cost, p_cost, version }
  salt: String,                     // base64, 16 bytes
  nonce: String,                    // base64, 12 bytes (AES-GCM)
}

PageSummary {
  id, title, tags, mode, block_count, created_at, updated_at,
  is_protected: bool,                                   ← NOVO
}

// Tauri AppManagedState (src-tauri/src/state.rs)
AppManagedState {
  workspace_root: Mutex<Option<PathBuf>>,
  save_coordinator: SaveCoordinator,
  search_engine: Mutex<Option<SearchEngine>>,
  sync_coordinator: Mutex<Option<SyncCoordinator>>,
  session_keys: Mutex<HashMap<PageId, Vec<u8>>>,        ← NOVO (chave derivada em memória)
}
```

### Formato do `.opn.json` de uma page protegida
```json
{
  "id": "550e...",
  "section_id": "...",
  "title": "Diário Pessoal",
  "tags": [],
  "blocks": [],
  "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
  "editor_preferences": { "mode": "rich_text", "split_view": false },
  "created_at": "...",
  "updated_at": "...",
  "schema_version": 2,
  "protection": {
    "algorithm": "aes_gcm_256",
    "kdf": "argon2id",
    "kdf_params": { "m_cost": 65536, "t_cost": 3, "p_cost": 1, "version": 19 },
    "salt": "base64encodedSalt16bytes==",
    "nonce": "base64encodedNonce12bytes="
  },
  "encrypted_content": "base64encodedAesGcmCiphertext..."
}
```

---

## Critérios de Aceitação (Definição de Done)

- [ ] Usuário pode proteger uma page por senha via menu de contexto na sidebar
- [ ] Page protegida exibe cadeado na sidebar e bloqueia o conteúdo ao ser selecionada
- [ ] Diálogo de senha aparece ao tentar abrir uma page protegida
- [ ] Senha incorreta exibe erro sem revelar o conteúdo
- [ ] Unlock bem-sucedido mantém a page desbloqueada na sessão corrente (sem pedir senha de novo)
- [ ] Auto-save re-criptografa blocks antes de escrever em disco
- [ ] Usuário pode remover a proteção (requer senha atual)
- [ ] Usuário pode trocar a senha (requer senha atual)
- [ ] Pages protegidas **não** aparecem nos resultados de busca full-text pelo conteúdo
- [ ] Pages protegidas sincronizam com cloud como arquivos opacos (sem descriptografar no sync)
- [ ] Pages sem proteção (v1 e v2) continuam funcionando sem mudanças de comportamento
- [ ] Fechar o workspace limpa todas as chaves de sessão da memória
- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] Todos os testes existentes continuam passando

---

## Referências

- `docs/ARCHITECTURE.md` — Diagrama C4 e fluxos de sequência
- `docs/DATA_MODEL.md` — Modelo de dados atual (Page, PageSummary, Block)
- `docs/IPC_REFERENCE.md` — Commands existentes de Page
- `crates/core/src/page.rs` — Structs `Page`, `PageSummary`, `EditorPreferences`
- `crates/storage/src/engine.rs` — `load_page`, `update_page`, `list_pages`
- `crates/storage/src/migrations.rs` — Padrão de migration de schema
- `crates/storage/src/atomic.rs` — `atomic_write_json`, `read_json`
- `src-tauri/src/state.rs` — `AppManagedState`, `SaveCoordinator`
- `src-tauri/src/commands/page.rs` — Handlers IPC de Page
