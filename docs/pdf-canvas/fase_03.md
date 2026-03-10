# Fase 03 — IPC Commands (`src-tauri`)

## Objetivo

Adicionar dois novos comandos Tauri:
1. `create_pdf_canvas_page` — importa o PDF e cria a página num único passo atômico
2. `update_page_annotations` — salva apenas as anotações (strokes) sem enviar a página inteira

## Arquivos modificados

- `src-tauri/src/commands/page.rs`
- `src-tauri/src/lib.rs`

---

## Mudanças detalhadas

### 1. Comando `create_pdf_canvas_page`

**Arquivo:** `src-tauri/src/commands/page.rs`  
**Localização:** após o comando `import_pdf` existente

```rust
#[tauri::command]
pub fn create_pdf_canvas_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    file_path: String,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    use opennote_core::page::Page as CorePage;

    let root = resolve_root(&state, workspace_id)?;
    let source = std::path::Path::new(&file_path);

    if !source.exists() {
        return Err(CommandError::NotFound("PDF file not found".to_string()));
    }

    // 1. Copia PDF para assets/ da seção e conta páginas
    //    (reutiliza a lógica já existente em import_pdf)
    let (_nb_dir, section_path) =
        FsStorageEngine::find_section_dir(&root, section_id).map_err(CommandError::from)?;
    let assets_dir = section_path.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| CommandError::Storage(format!("Failed to create assets dir: {e}")))?;

    let uuid = uuid::Uuid::new_v4();
    let dest_name = format!("{uuid}.pdf");
    let dest_path = assets_dir.join(&dest_name);
    std::fs::copy(source, &dest_path)
        .map_err(|e| CommandError::Storage(format!("Failed to copy PDF: {e}")))?;

    let asset_rel = format!("assets/{dest_name}");
    let total_pages = count_pdf_pages(&dest_path).unwrap_or(0);

    // 2. Constrói a Page no domínio
    let page = CorePage::new_pdf_canvas(section_id, &title, asset_rel, total_pages)
        .map_err(|e| CommandError::Domain(e.to_string()))?;

    // 3. Persiste via novo método do storage
    FsStorageEngine::create_page_from(&root, &page).map_err(CommandError::from)?;

    // 4. Indexa para busca
    try_index_page(&state, &root, &page);

    Ok(page)
}
```

> **Nota:** `count_pdf_pages` já existe no mesmo arquivo — função privada reutilizada.

### 2. Comando `update_page_annotations`

**Arquivo:** `src-tauri/src/commands/page.rs`  
**Localização:** após `update_page_blocks`

Evita enviar a `Page` inteira (com blocks, src base64 do PDF, etc.) a cada stroke salvo.
Usa o `SaveCoordinator` existente para evitar race conditions.

```rust
#[tauri::command]
pub fn update_page_annotations(
    state: State<AppManagedState>,
    page_id: PageId,
    annotations: opennote_core::annotation::PageAnnotations,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;

    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id)
            .map_err(CommandError::from)?;
        page.annotations = annotations;
        page.updated_at = chrono::Utc::now();
        FsStorageEngine::update_page(&root, &page)
            .map_err(CommandError::from)
    })
}
```

### 3. Tratar `CommandError::Domain`

**Arquivo:** `src-tauri/src/error.rs`

Verificar se o variant `Domain` já existe. Se não existir, adicionar:

```rust
#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum CommandError {
    // ... variants existentes ...
    #[error("Domain error: {0}")]
    Domain(String),
}
```

### 4. Registrar os comandos em `lib.rs`

**Arquivo:** `src-tauri/src/lib.rs`  
**Localização:** dentro de `invoke_handler!([...])`

Adicionar os dois novos comandos na lista:

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... comandos existentes ...
        commands::page::create_pdf_canvas_page,   // NOVO
        commands::page::update_page_annotations,  // NOVO
    ])
```

---

## Fluxo completo do comando `create_pdf_canvas_page`

```
Frontend                      src-tauri                    crates/
──────────                    ─────────                    ───────
open() file picker
      │
createPdfCanvasPage(ipc) ──► create_pdf_canvas_page
                                      │
                              source.exists()? ──► Err NotFound
                                      │
                              copy PDF → assets/{uuid}.pdf
                                      │
                              count_pdf_pages() → total_pages
                                      │
                              CorePage::new_pdf_canvas() ──► crates/core
                                      │
                              FsStorageEngine::create_page_from() ──► crates/storage
                                      │
                              try_index_page() ──► crates/search
                                      │
                         ◄────── Ok(Page)
      │
navigate to page
```

---

## Fluxo completo do comando `update_page_annotations`

```
Frontend                      src-tauri                    crates/
──────────                    ─────────                    ───────
stroke complete (debounce)
      │
updatePageAnnotations(ipc) ─► update_page_annotations
                                      │
                              with_page_lock(page_id)
                                      │
                              load_page(page_id) ──► crates/storage
                                      │
                              page.annotations = annotations
                              page.updated_at = now()
                                      │
                              update_page(page) ──► crates/storage
                                      │
                         ◄────── Ok(())
```

---

## Tratamento de erros

| Situação | Erro retornado |
|---|---|
| Arquivo PDF não encontrado | `CommandError::NotFound` |
| Falha ao copiar o arquivo | `CommandError::Storage` |
| Título vazio | `CommandError::Domain` (via `CoreError::Validation`) |
| Falha ao salvar no disco | `CommandError::Storage` |
| `page_id` inexistente em `update_page_annotations` | `CommandError::Storage` (NotFound do storage) |

---

## Testes

Os comandos IPC são testados indiretamente pelos testes de integração frontend (MSW mocks) e pelos testes E2E (Fase 07). Testes unitários diretos de commands Tauri são difíceis de configurar — a cobertura é garantida pelos testes das crates subjacentes.

---

## Critério de conclusão

- [ ] `cargo build` sem erros
- [ ] `create_pdf_canvas_page` aparece no `invoke_handler`
- [ ] `update_page_annotations` aparece no `invoke_handler`
- [ ] `CommandError::Domain` existe e serializa corretamente
- [ ] Chamar `create_pdf_canvas_page` com PDF inexistente retorna erro
