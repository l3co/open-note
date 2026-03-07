# Fase 08 — Busca & Indexação

## Objetivo

Implementar **full-text search** local com indexação incremental, permitindo ao usuário encontrar qualquer conteúdo em qualquer page, em qualquer notebook, instantaneamente. A busca deve ser rápida, relevante e funcionar offline.

---

## Dependências

- Fase 02 concluída (modelo de domínio + storage — precisa indexar o conteúdo das pages)

---

## Entregáveis

1. Motor de busca local usando Tantivy (Rust)
2. Indexação incremental (apenas pages modificadas)
3. Indexação em background (não bloqueia a UI)
4. UI de busca: barra de busca global + resultados
5. Quick Open (Cmd+P) — busca por título de page
6. Busca por conteúdo (full-text) com highlights nos resultados
7. Filtros: por notebook, section, tags, data
8. Resultados ranqueados por relevância
9. Re-indexação manual (rebuild index)

---

## Arquitetura

```
┌──────────────────────────────┐
│        Frontend              │
│  ┌────────────────────────┐  │
│  │   <SearchBar />        │  │
│  │   <SearchResults />    │  │
│  │   <QuickOpen />        │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│        Tauri IPC             │
├──────────────────────────────┤
│        Rust Backend          │
│  ┌────────────────────────┐  │
│  │   SearchEngine         │  │
│  │   ├── Indexer           │  │
│  │   │   ├── index_page()  │  │
│  │   │   ├── remove_page() │  │
│  │   │   └── rebuild()     │  │
│  │   └── Searcher          │  │
│  │       ├── search()      │  │
│  │       ├── quick_open()  │  │
│  │       └── suggest()     │  │
│  └────────────────────────┘  │
│             │                │
│       Tantivy Index          │
│    (~/.opennote/index/)      │
└──────────────────────────────┘
```

---

## Tantivy — Motor de Busca

### Por que Tantivy

| Alternativa | Prós | Contras |
|---|---|---|
| **Tantivy** | Rust nativo, rápido, full-text, sem servidor | Precisa gerenciar índice local |
| SQLite FTS5 | Simples, embutido | Menos flexível, ranqueamento básico |
| MeiliSearch | API rica, fuzzy search | Precisa rodar como processo separado |
| Busca bruta (grep) | Zero dependência | Lento com muitos arquivos |

**Decisão:** Tantivy. É Rust nativo (zero overhead de FFI), extremamente rápido, suporta full-text search com relevância, e o índice fica local.

### Dependências Rust

```toml
[dependencies]
tantivy = "0.22"
```

---

## Schema do Índice

### Campos Indexados

| Campo | Tipo Tantivy | Tokenizado | Stored | Propósito |
|---|---|---|---|---|
| `page_id` | `STRING` | Não | Sim | Identificador único |
| `title` | `TEXT` | Sim (boost 2.0) | Sim | Título da page |
| `content` | `TEXT` | Sim | Sim | Conteúdo textual (plain text extraído dos blocos) |
| `tags` | `TEXT` | Sim (boost 1.5) | Sim | Tags da page (separadas por espaço) |
| `notebook_name` | `STRING` | Não | Sim | Nome do notebook (para filtro) |
| `section_name` | `STRING` | Não | Sim | Nome da section (para filtro) |
| `notebook_id` | `STRING` | Não | Sim | ID do notebook (para filtro) |
| `section_id` | `STRING` | Não | Sim | ID da section (para filtro) |
| `updated_at` | `DATE` | Não | Sim | Data de última modificação (para sort) |
| `created_at` | `DATE` | Não | Sim | Data de criação |

### Tokenização

- **Tokenizer:** `default` (Tantivy) — split por whitespace + pontuação, lowercase, remove acentos
- **Stemming:** Avaliar `tantivy-analysis-contrib` para stemming em português e inglês
- **Stop words:** Configurar para PT-BR e EN

---

## Extração de Conteúdo

Para indexar o conteúdo de uma page, precisamos extrair **plain text** de todos os blocos:

```rust
fn extract_text_from_page(page: &Page) -> String {
    page.blocks.iter().map(|block| {
        match block {
            Block::Text(b) => extract_text_from_tiptap_json(&b.content),
            Block::Markdown(b) => b.raw_content.clone(),
            Block::Code(b) => b.code.clone(),
            Block::Checklist(b) => b.items.iter()
                .map(|i| i.text.clone())
                .collect::<Vec<_>>()
                .join(" "),
            Block::Table(b) => extract_text_from_table(b),
            Block::Callout(b) => extract_text_from_tiptap_json(&b.content),
            Block::Image(b) => b.alt.clone().unwrap_or_default(),
            Block::Ink(_) => String::new(), // ink block não é buscável por texto
            Block::Pdf(b) => extract_text_from_pdf(&b.src), // extrai texto do PDF via Rust
            Block::Divider(_) => String::new(),
            Block::Embed(b) => format!("{} {}", b.title.unwrap_or_default(), b.url),
        }
    }).collect::<Vec<_>>().join("\n")
}
```

### Extração de TipTap JSON → Plain Text

```rust
fn extract_text_from_tiptap_json(json: &serde_json::Value) -> String {
    // Percorrer recursivamente o JSON do TipTap
    // Coletar todos os nós "text" → concatenar
    // Preservar quebras de linha entre parágrafos
}
```

### Extração de Texto de PDFs

```rust
fn extract_text_from_pdf(pdf_path: &str) -> String {
    // Usar crate `pdf-extract` ou `lopdf` para extrair texto das páginas
    // Concatenar texto de todas as páginas
    // Fallback: string vazia se PDF não tiver texto (scan/imagem)
}
```

**Dependência Rust:** `pdf-extract` (wrapper sobre `lopdf`).

### Annotations (Ink Overlay)

As annotations da page (`strokes` e `highlights`) **não são indexadas** para busca textual. São dados visuais (coordenadas, cores) sem conteúdo semântico buscável.

---

## Indexação

### Indexação Incremental

Não reindexar tudo a cada mudança. Apenas pages modificadas.

**Estratégia:**

1. Manter arquivo `index_state.json` com hash (ou `updated_at`) de cada page indexada
2. Ao iniciar o app:
   a. Comparar `updated_at` de cada page no filesystem vs `index_state.json`
   b. Re-indexar apenas pages com `updated_at` mais recente
   c. Remover do índice pages deletadas
3. Ao salvar uma page (auto-save):
   a. Re-indexar a page imediatamente (incremental)

```json
// index_state.json
{
  "schema_version": 1,
  "pages": {
    "page-uuid-1": { "updated_at": "2026-03-07T14:30:00Z", "indexed_at": "2026-03-07T14:30:05Z" },
    "page-uuid-2": { "updated_at": "2026-03-07T10:00:00Z", "indexed_at": "2026-03-07T10:00:02Z" }
  }
}
```

### Indexação em Background

A indexação inicial (primeiro uso ou rebuild) pode levar tempo. Rodar em background:

```rust
// Ao iniciar o app
tokio::spawn(async move {
    search_engine.reindex_stale_pages().await;
});
```

- Frontend exibe indicador discreto: "Indexando notas... (42/128)"
- Busca funciona durante indexação (retorna resultados parciais)
- Indexação não bloqueia auto-save nem navegação

### Rebuild Manual

Menu: "Configurações → Reconstruir Índice de Busca"
- Apaga índice completo
- Re-indexa todas as pages do zero
- Útil se o índice ficar corrompido

---

## Comandos Tauri IPC

| Comando | Input | Output |
|---|---|---|
| `search` | `query, filters, limit, offset` | `SearchResults` |
| `quick_open` | `query, limit` | `Vec<PageSummaryWithScore>` |
| `suggest` | `query` | `Vec<String>` (sugestões de termos) |
| `reindex_page` | `page_id` | `()` |
| `rebuild_index` | — | `()` |
| `get_index_status` | — | `IndexStatus` |
| `list_all_tags` | — | `Vec<String>` (tags únicas via índice — substitui scan do filesystem da Fase 03) |

### Tipos

```rust
struct SearchQuery {
    text: String,
    notebook_id: Option<NotebookId>,
    section_id: Option<SectionId>,
    tags: Vec<String>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    limit: u32,       // default: 20
    offset: u32,      // default: 0
}

struct SearchResults {
    total: u64,
    items: Vec<SearchResultItem>,
    query_time_ms: u64,
}

struct SearchResultItem {
    page_id: PageId,
    title: String,
    snippet: String,          // trecho com highlight (HTML)
    notebook_name: String,
    section_name: String,
    score: f32,
    updated_at: DateTime<Utc>,
}

struct IndexStatus {
    total_pages: u64,
    indexed_pages: u64,
    is_indexing: bool,
    last_indexed_at: Option<DateTime<Utc>>,
}
```

---

## UI de Busca

### Quick Open (`Cmd/Ctrl + P`)

Busca rápida por **título** de page.

```
┌─────────────────────────────────────────┐
│ 🔍 Buscar page...                      │
├─────────────────────────────────────────┤
│ 📄 Aula 01 — Introdução                │
│    Notebook A > Estudos                 │
│                                         │
│ 📄 Aula 02 — Fundamentos        ← sel  │
│    Notebook A > Estudos                 │
│                                         │
│ 📄 Anotações da Reunião                │
│    Notebook B > Trabalho                │
└─────────────────────────────────────────┘
```

**Comportamento:**
- Abre como dialog centralizado (similar ao Cmd+P do VS Code)
- Busca enquanto digita (debounce 150ms)
- Fuzzy match no título
- Navegação por ↑/↓, Enter para abrir, Esc para fechar
- Exibe notebook e section como contexto
- Máximo 10 resultados

### Busca Global (`Cmd/Ctrl + Shift + F`)

Busca por **conteúdo** (full-text) em todas as pages.

```
┌─────────────────────────────────────────┐
│ 🔍 Buscar em todas as notas...         │
│                                         │
│ Filtros: [Notebook ▾] [Tags ▾] [Data ▾]│
├─────────────────────────────────────────┤
│ 📄 Aula 01 — Introdução                │
│    ...conceito de **clean architecture**│
│    é fundamental para...                │
│    Notebook A > Estudos • 2h atrás      │
│                                         │
│ 📄 Projeto Backend                      │
│    ...aplicamos **clean architecture**  │
│    no módulo de autenticação...         │
│    Notebook B > Projetos • 3 dias       │
│                                         │
│ Mostrando 2 de 15 resultados  [+]      │
└─────────────────────────────────────────┘
```

**Comportamento:**
- Painel que pode ser sidebar ou overlay
- Busca enquanto digita (debounce 300ms)
- Snippets com termos destacados (bold/highlight)
- Filtros: notebook, tags, data (range)
- Paginação (load more)
- Click no resultado → abre a page e scroll até o trecho

### Highlight no Editor

Ao abrir uma page vinda da busca:
- Highlight dos termos buscados dentro do editor
- Scroll automático até a primeira ocorrência
- Atalho `F3` / `Cmd+G` para próxima ocorrência

---

## Armazenamento do Índice

### Localização

```
{workspace_root}/.opennote/
  ├── index/           # Tantivy index files
  │    ├── meta.json
  │    ├── *.fast
  │    ├── *.idx
  │    ├── *.pos
  │    ├── *.store
  │    └── *.term
  └── index_state.json  # estado da indexação
```

**`.opennote/`** é um diretório oculto na raiz do workspace. Adicionado ao `.gitignore` por padrão (índice não deve ser versionado — é derivado).

### Tamanho Estimado

- ~1-2KB de índice por page (dependendo do conteúdo)
- 1000 pages → ~1-2MB de índice
- Insignificante em disco

---

## Testes

### Unitários

- Extração de texto de cada tipo de bloco
- Extração de texto de TipTap JSON (aninhado, com marks)
- Tokenização: acentos removidos, lowercase
- Search query com filtros aplicados corretamente
- Snippet generation com highlights

### Integração

- Criar pages → indexar → buscar → resultados corretos
- Atualizar page → re-indexar → busca reflete mudança
- Deletar page → remover do índice → não aparece na busca
- Rebuild index → resultados consistentes
- Busca com filtro de notebook → resultados filtrados
- Busca com filtro de tags → resultados filtrados
- Busca com filtro de data → resultados filtrados

### E2E

- Criar pages com conteúdo variado → Cmd+P → buscar por título → resultado correto
- Cmd+Shift+F → buscar por conteúdo → snippet com highlight
- Click no resultado → page abre, conteúdo scrollado
- Filtrar por notebook → resultados reduzidos
- Indexação em background → indicador visível → busca funciona durante indexação

### Performance

- Indexar 1000 pages → tempo aceitável (< 10s)
- Busca em índice de 1000 pages → < 50ms
- Quick open com fuzzy match → < 30ms

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Tantivy index corruption | Médio | Rebuild automático se detectar inconsistência |
| Indexação lenta com muitas pages | Baixo | Background + incremental. Benchmark com 5000 pages. |
| Stemming ruim em PT-BR | Médio | Avaliar stemmer. Fallback: busca por prefixo |
| Busca retorna resultados irrelevantes | Médio | Tunar boost de campos (título 2x, tags 1.5x) |
| Índice ocupa muito espaço | Baixo | Monitorar. Se necessário, comprimir |

---

## Definition of Done

- [ ] Tantivy integrado e configurado com schema definido
- [ ] Indexação incremental funcionando (apenas pages modificadas)
- [ ] Indexação em background (não bloqueia UI)
- [ ] Extração de texto de todos os tipos de bloco
- [ ] Quick Open (Cmd+P) com fuzzy match em títulos
- [ ] Busca global (Cmd+Shift+F) com full-text search
- [ ] Snippets com highlights nos resultados
- [ ] Filtros: notebook, tags, data
- [ ] Highlight no editor ao abrir resultado da busca
- [ ] Rebuild manual do índice
- [ ] Indicador de status da indexação
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Testes E2E passando
- [ ] Performance: busca < 50ms em 1000 pages
- [ ] CI verde
