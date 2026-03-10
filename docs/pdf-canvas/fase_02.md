# Fase 02 — Storage (`crates/storage`)

## Objetivo

Garantir que o storage lê e escreve páginas PDF Canvas corretamente, com backward compatibility total para páginas existentes, e adicionar o método `create_page_from` que recebe uma `Page` já construída.

## Arquivos modificados

- `crates/storage/src/engine.rs`
- `crates/storage/src/migrations.rs`

---

## Mudanças detalhadas

### 1. Novo método `FsStorageEngine::create_page_from`

**Arquivo:** `crates/storage/src/engine.rs`  
**Localização:** após o método `create_page` existente

O método `create_page` atual constrói a `Page` internamente. O novo método recebe uma `Page` já construída (necessário para `new_pdf_canvas` que precisa de campos extras).

```rust
/// Persiste uma Page já construída externamente.
/// Usado por create_pdf_canvas_page e outros casos onde o construtor
/// do domínio precisa ser chamado antes do storage.
pub fn create_page_from(root: &Path, page: &Page) -> StorageResult<()> {
    let (_, section_path) = Self::find_section_dir(root, page.section_id)?;
    let slug = unique_slug(&page.title, &section_path, PAGE_EXTENSION)?;
    let file_path = section_path.join(format!("{slug}.{PAGE_EXTENSION}"));
    atomic_write_json(&file_path, page)
}
```

> **Nota:** O método retorna `()` — o caller (IPC command) já possui a `Page` e não precisa
> recarregar do disco. Isso mantém consistência com o padrão do projeto.

### 2. Guard defensivo em `migrations.rs`

**Arquivo:** `crates/storage/src/migrations.rs`  
**Localização:** adicionar função `migrate_page_if_needed` (análoga à `migrate_app_state_if_needed`)

Embora `#[serde(default)]` já resolva o backward compat, um guard explícito é mais seguro e documenta a intenção:

```rust
/// Guard defensivo para páginas .opn.json.
/// Garante presença de campos introduzidos em versões futuras.
/// Chamado por load_page antes da deserialização final.
pub fn migrate_page_if_needed(mut raw: serde_json::Value) -> serde_json::Value {
    // Garante campos pdf_ para páginas criadas antes desta feature
    if let Some(obj) = raw.as_object_mut() {
        obj.entry("pdf_asset").or_insert(serde_json::Value::Null);
        obj.entry("pdf_total_pages").or_insert(serde_json::json!(0));
    }
    raw
}
```

### 3. Integrar a migração em `load_page`

**Arquivo:** `crates/storage/src/engine.rs`  
**Localização:** método `load_page`

Encontrar o método `load_page` e adicionar a chamada ao guard antes de deserializar:

```rust
pub fn load_page(root: &Path, page_id: PageId) -> StorageResult<Page> {
    // ... localiza o arquivo ...
    let raw: serde_json::Value = read_json(&file_path)?;
    let raw = crate::migrations::migrate_page_if_needed(raw);  // NOVO
    let page: Page = serde_json::from_value(raw)?;
    Ok(page)
}
```

> **Por que é seguro?** A função `migrate_page_if_needed` é pura — não muta o arquivo em disco,
> apenas garante que o `Value` em memória tem os campos esperados antes de deserializar.
> Não há risco de corromper dados existentes.

---

## Por que NÃO bumpar `CURRENT_SCHEMA_VERSION`

`CURRENT_SCHEMA_VERSION = 1` permanece inalterado porque:

1. Os novos campos são **opcionais com defaults** — não há breaking change no schema.
2. Um bump de versão implica criar uma migration que persiste de volta ao disco, o que não é necessário aqui.
3. Futuros breaking changes reais (ex: reestruturar `blocks`) é que devem incrementar a versão.

---

## Verificação de impacto

### `list_pages` — sem mudança

Lista apenas `PageSummary`, que não inclui os novos campos.

### `update_page` — sem mudança

Recebe a `Page` inteira e serializa — os novos campos serão incluídos automaticamente.

### `delete_page` — sem mudança

Deleta o arquivo `.opn.json` — não tem conhecimento do conteúdo.

### Assets do PDF

O arquivo PDF em si é gerenciado pelo comando IPC `import_pdf` existente (copia para `assets/`). O storage de páginas não precisa saber sobre ele — apenas armazena o caminho relativo como string.

---

## Testes a adicionar

**Arquivo:** `crates/storage/tests/` (criar `pdf_canvas_storage.rs` ou adicionar em arquivo existente)

```rust
#[test]
fn round_trip_pdf_canvas_page() {
    let dir = tempdir().unwrap();
    // Setup: workspace, notebook, section
    let root = dir.path();
    // ... setup fixtures ...

    let section_id = SectionId::new();
    let page = Page::new_pdf_canvas(
        section_id,
        "Anotações PDF",
        "assets/doc.pdf".to_string(),
        10,
    ).unwrap();

    FsStorageEngine::create_page_from(root, &page).unwrap();

    let loaded = FsStorageEngine::load_page(root, page.id).unwrap();
    assert_eq!(loaded.editor_preferences.mode, EditorMode::PdfCanvas);
    assert_eq!(loaded.pdf_asset, Some("assets/doc.pdf".to_string()));
    assert_eq!(loaded.pdf_total_pages, 10);
}

#[test]
fn load_legacy_page_without_pdf_fields_succeeds() {
    let dir = tempdir().unwrap();
    // Escreve manualmente um .opn.json sem os campos pdf_*
    let legacy = serde_json::json!({
        "id": "01234567-0000-0000-0000-000000000000",
        "section_id": "01234567-0000-0000-0000-000000000001",
        "title": "Legacy Page",
        "tags": [],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "schema_version": 1
    });
    // ... escreve o arquivo ...
    // ... chama load_page ...
    // assert: não panica, pdf_asset == None, pdf_total_pages == 0
}

#[test]
fn migrate_page_if_needed_is_idempotent() {
    let raw = serde_json::json!({
        "pdf_asset": "assets/doc.pdf",
        "pdf_total_pages": 5
    });
    let result = migrate_page_if_needed(raw.clone());
    assert_eq!(result["pdf_asset"], "assets/doc.pdf");
    assert_eq!(result["pdf_total_pages"], 5);
}
```

---

## Critério de conclusão

- [ ] `cargo test -p opennote-storage` passa todos os testes
- [ ] `create_page_from` persiste corretamente a `Page` em disco
- [ ] Páginas legacy (sem campos pdf_*) carregam sem erro
- [ ] `migrate_page_if_needed` é idempotente
