# Fase 01 — Rust Core: `EditorMode::Canvas` + `canvas_state`

## Objetivo

Adicionar suporte ao modo Canvas na camada de domínio puro (`crates/core/`),
sem nenhuma dependência de Tauri, filesystem ou frontend.

---

## Contexto

O arquivo relevante é `crates/core/src/page.rs`. O enum `EditorMode` já possui
três variantes. A struct `Page` já tem precedente de campos opcionais por modo
(`pdf_asset`, `pdf_total_pages`). O padrão a seguir é idêntico.

**Estado atual de `EditorMode`:**
```rust
// crates/core/src/page.rs — linha 210–214
#[serde(rename_all = "snake_case")]
pub enum EditorMode {
    RichText,
    Markdown,
    PdfCanvas,
}
```

**Estado atual de `Page`:**
```rust
// crates/core/src/page.rs — linha 16–31
pub struct Page {
    pub id: PageId,
    pub section_id: SectionId,
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
    pub editor_preferences: EditorPreferences,
    #[serde(default)]
    pub pdf_asset: Option<String>,
    #[serde(default)]
    pub pdf_total_pages: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
}
```

---

## Tarefas

### 1.1 — Adicionar `EditorMode::Canvas`

**Arquivo:** `crates/core/src/page.rs`

Adicionar a variante `Canvas` ao enum `EditorMode`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum EditorMode {
    RichText,
    Markdown,
    PdfCanvas,
    Canvas,  // NOVO
}
```

> **Serialização JSON:** `"canvas"` (via `rename_all = "snake_case"`)

---

### 1.2 — Adicionar campo `canvas_state` na `Page`

**Arquivo:** `crates/core/src/page.rs`

Adicionar campo opcional após `pdf_total_pages`:

```rust
pub struct Page {
    // ... campos existentes ...
    #[serde(default)]
    pub pdf_asset: Option<String>,
    #[serde(default)]
    pub pdf_total_pages: Option<u32>,
    #[serde(default)]
    pub canvas_state: Option<serde_json::Value>,  // NOVO
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
}
```

> **`#[serde(default)]`** garante retrocompatibilidade: páginas existentes sem
> este campo desserializam com `canvas_state: None` sem erro.

> **`serde_json::Value`** é opaco ao domínio — o backend não interpreta o
> conteúdo, apenas armazena e devolve. Isso isola o domínio do formato
> proprietário do Excalidraw.

> **Binding TypeScript:** `#[ts(type = "any")]` deve ser adicionado ao campo
> para que o `ts-rs` gere `canvas_state: any | null` no binding.

Campo com anotação completa:
```rust
#[serde(default)]
#[ts(type = "any")]
pub canvas_state: Option<serde_json::Value>,
```

---

### 1.3 — Adicionar construtor `Page::new_canvas()`

**Arquivo:** `crates/core/src/page.rs`

Adicionar método após `new_pdf_canvas()` (linha ~94):

```rust
pub fn new_canvas(section_id: SectionId, title: &str) -> Result<Self, CoreError> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err(CoreError::Validation {
            message: "Page title cannot be empty".to_string(),
        });
    }
    let now = Utc::now();
    Ok(Self {
        id: PageId::new(),
        section_id,
        title,
        tags: Vec::new(),
        blocks: Vec::new(),
        annotations: PageAnnotations::default(),
        editor_preferences: EditorPreferences {
            mode: EditorMode::Canvas,
            split_view: false,
        },
        pdf_asset: None,
        pdf_total_pages: None,
        canvas_state: None,
        created_at: now,
        updated_at: now,
        schema_version: CURRENT_SCHEMA_VERSION,
    })
}
```

---

### 1.4 — Atualizar `Page::new()` e `Page::new_pdf_canvas()`

Os construtores existentes precisam inicializar o novo campo com `None`:

**`Page::new()`** — adicionar `canvas_state: None` no `Ok(Self { ... })`.

**`Page::new_pdf_canvas()`** — adicionar `canvas_state: None` no `Ok(Self { ... })`.

O compilador Rust indicará exatamente onde se `canvas_state` estiver faltando
(erro de struct literal incompleto) — use isso como guia.

---

### 1.5 — Adicionar método `update_canvas_state()`

**Arquivo:** `crates/core/src/page.rs`

Método para atualizar o estado e o timestamp:

```rust
pub fn update_canvas_state(&mut self, state: Option<serde_json::Value>) {
    self.canvas_state = state;
    self.updated_at = Utc::now();
}
```

---

### 1.6 — Testes unitários

**Arquivo:** `crates/core/src/page.rs` — bloco `#[cfg(test)]` existente

Adicionar os seguintes testes ao bloco de testes existente:

```rust
#[test]
fn new_canvas_page_has_canvas_mode() {
    let page = Page::new_canvas(SectionId::new(), "Meu Canvas").unwrap();
    assert_eq!(page.editor_preferences.mode, EditorMode::Canvas);
    assert!(page.canvas_state.is_none());
    assert!(page.blocks.is_empty());
    assert!(page.pdf_asset.is_none());
}

#[test]
fn new_canvas_rejects_empty_title() {
    assert!(Page::new_canvas(SectionId::new(), "").is_err());
    assert!(Page::new_canvas(SectionId::new(), "   ").is_err());
}

#[test]
fn canvas_mode_serializes_as_snake_case() {
    let prefs = EditorPreferences {
        mode: EditorMode::Canvas,
        split_view: false,
    };
    let json = serde_json::to_value(&prefs).unwrap();
    assert_eq!(json["mode"], "canvas");
}

#[test]
fn canvas_state_roundtrip() {
    let mut page = Page::new_canvas(SectionId::new(), "Test").unwrap();
    let state = serde_json::json!({
        "elements": [{ "type": "rectangle", "id": "abc" }],
        "appState": { "viewBackgroundColor": "#ffffff" },
        "files": {}
    });
    page.update_canvas_state(Some(state.clone()));
    let serialized = serde_json::to_string(&page).unwrap();
    let deserialized: Page = serde_json::from_str(&serialized).unwrap();
    assert_eq!(deserialized.canvas_state, Some(state));
}

#[test]
fn existing_page_without_canvas_state_deserializes_ok() {
    // Simula um .opn.json antigo que não tem o campo canvas_state
    let json = serde_json::json!({
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "section_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "title": "Página antiga",
        "tags": [],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "schema_version": 1
    });
    let page: Page = serde_json::from_value(json).unwrap();
    assert!(page.canvas_state.is_none()); // retrocompatibilidade OK
}
```

---

## Verificação

```bash
# Rodar apenas os testes do crate core
cargo test -p opennote-core

# Verificar que os bindings TypeScript foram gerados
cargo test -p opennote-core -- --test-output immediate 2>&1 | grep -E "PASSED|FAILED"

# Gerar bindings e verificar diff
cargo test -p opennote-core
git diff src/types/bindings/EditorMode.ts
git diff src/types/bindings/Page.ts
```

### Bindings esperados após esta fase

**`src/types/bindings/EditorMode.ts`** — gerado pelo `ts-rs`:
```typescript
export type EditorMode = "rich_text" | "markdown" | "pdf_canvas" | "canvas";
```

**`src/types/bindings/Page.ts`** — campo adicional:
```typescript
canvas_state: any | null;
```

---

## Critérios de Aceite

- [ ] `cargo test -p opennote-core` passa sem erros
- [ ] `EditorMode::Canvas` serializa como `"canvas"` no JSON
- [ ] Campo `canvas_state` desserializa como `None` em páginas que não o possuem
- [ ] `Page::new_canvas()` rejeita título vazio
- [ ] Bindings `EditorMode.ts` e `Page.ts` atualizados
- [ ] Nenhuma alteração em `crates/storage/`, `crates/search/` ou `src-tauri/` nesta fase
