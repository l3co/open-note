# Fase 01 — Domínio (`crates/core`)

## Objetivo

Adicionar o novo tipo de página `PdfCanvas` ao modelo de domínio, mantendo total backward compatibility com páginas existentes.

## Arquivos modificados

- `crates/core/src/page.rs`

## Mudanças detalhadas

### 1. Novo variant em `EditorMode`

**Arquivo:** `crates/core/src/page.rs`  
**Localização:** enum `EditorMode` (linha ~164)

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum EditorMode {
    RichText,
    Markdown,
    PdfCanvas,  // NOVO
}
```

### 2. Novos campos opcionais em `Page`

**Arquivo:** `crates/core/src/page.rs`  
**Localização:** struct `Page` (linha ~16)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Page {
    pub id: PageId,
    pub section_id: SectionId,
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
    pub editor_preferences: EditorPreferences,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
    // NOVOS campos — #[serde(default)] garante backward compat com pages antigas
    #[serde(default)]
    pub pdf_asset: Option<String>,    // caminho relativo: "assets/{uuid}.pdf"
    #[serde(default)]
    pub pdf_total_pages: u32,         // 0 para páginas não-PDF
}
```

> **Por que `#[serde(default)]`?** Páginas `.opn.json` existentes não possuem esses campos.
> Com `default`, `serde` usa `None` e `0` ao deserializar — sem migration obrigatória.

### 3. Novo construtor `Page::new_pdf_canvas`

**Arquivo:** `crates/core/src/page.rs`  
**Localização:** bloco `impl Page`, após `new()`

```rust
impl Page {
    // ... construtor new() existente ...

    pub fn new_pdf_canvas(
        section_id: SectionId,
        title: &str,
        pdf_asset: String,
        total_pages: u32,
    ) -> Result<Self, CoreError> {
        let mut page = Self::new(section_id, title)?;
        page.editor_preferences.mode = EditorMode::PdfCanvas;
        page.pdf_asset = Some(pdf_asset);
        page.pdf_total_pages = total_pages;
        Ok(page)
    }
}
```

### 4. Atualizar `PageSummary` (opcional, refinamento futuro)

`PageSummary` não inclui `editor_preferences`, portanto a tree do sidebar não consegue distinguir ícones sem mudança adicional. Para o MVP, todos os ícones ficam como `FileText`. Adição de `page_type` ao `PageSummary` fica como **TODO pós-MVP**.

---

## Verificação de impacto

### `reorder_blocks` — sem mudança

O método já funciona com `blocks` vazio (caso de páginas PDF canvas). Nenhuma alteração necessária.

### `add_block` — sem mudança

Páginas PDF canvas tecnicamente podem ter blocks, mas não os usam. O limite de `HARD_BLOCK_LIMIT` não interfere.

### Bindings TypeScript gerados automaticamente

Após compilar, `ts-rs` regenera:
- `src/types/bindings/EditorMode.ts` — incluirá `"pdf_canvas"`
- `src/types/bindings/Page.ts` — incluirá `pdf_asset` e `pdf_total_pages`

---

## Testes a adicionar

**Arquivo:** `crates/core/src/page.rs`, bloco `#[cfg(test)]`

```rust
#[test]
fn new_pdf_canvas_sets_correct_mode() {
    let page = Page::new_pdf_canvas(
        SectionId::new(),
        "Aula 01",
        "assets/abc.pdf".to_string(),
        12,
    ).unwrap();

    assert_eq!(page.editor_preferences.mode, EditorMode::PdfCanvas);
    assert_eq!(page.pdf_asset, Some("assets/abc.pdf".to_string()));
    assert_eq!(page.pdf_total_pages, 12);
    assert!(page.blocks.is_empty());
}

#[test]
fn new_pdf_canvas_rejects_empty_title() {
    let err = Page::new_pdf_canvas(
        SectionId::new(),
        "",
        "assets/abc.pdf".to_string(),
        1,
    ).unwrap_err();
    assert!(matches!(err, CoreError::Validation { .. }));
}

#[test]
fn pdf_canvas_page_serializes_mode_as_snake_case() {
    let page = Page::new_pdf_canvas(
        SectionId::new(),
        "Test",
        "assets/doc.pdf".to_string(),
        3,
    ).unwrap();
    let json = serde_json::to_value(&page).unwrap();
    assert_eq!(json["editor_preferences"]["mode"], "pdf_canvas");
    assert_eq!(json["pdf_total_pages"], 3);
}

#[test]
fn legacy_page_without_pdf_fields_deserializes_with_defaults() {
    // Simula um .opn.json antigo sem os novos campos
    let legacy_json = serde_json::json!({
        "id": "01234567-0000-0000-0000-000000000000",
        "section_id": "01234567-0000-0000-0000-000000000001",
        "title": "Old Page",
        "tags": [],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "schema_version": 1
    });

    let page: Page = serde_json::from_value(legacy_json).unwrap();
    assert_eq!(page.pdf_asset, None);
    assert_eq!(page.pdf_total_pages, 0);
    assert_eq!(page.editor_preferences.mode, EditorMode::RichText);
}
```

---

## Critério de conclusão

- [ ] `cargo test -p opennote-core` passa todos os testes (incluindo os novos)
- [ ] `cargo check` sem warnings
- [ ] Bindings TypeScript regenerados em `src/types/bindings/`
- [ ] Nenhuma página existente quebra ao deserializar
