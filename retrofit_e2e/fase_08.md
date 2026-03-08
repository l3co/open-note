# Fase 08 - Busca & Indexação

## Feature: Tantivy Full-Text Search

**Descrição**: Validar a busca full-text via Tantivy (Rust), os componentes QuickOpen (Cmd+P) e SearchPanel (Cmd+Shift+F), indexação via IPC, e snippets com highlight.

**Componentes envolvidos:** `QuickOpen` (Cmd+P), `SearchPanel` (Cmd+Shift+F), `StatusBar`

**IPC commands:** `search_pages`, `quick_open`, `reindex_page`, `rebuild_index`, `get_index_status`

**Backend:** `SearchEngine` (crates/search) — Tantivy 0.22, schema com boost em title (2.0) e tags (1.5)

### Caminho Feliz (Happy Path)
```gherkin
Feature: Busca full-text local
  Scenario: Busca via SearchPanel (Cmd+Shift+F)
    Given o workspace tem páginas indexadas
    When o usuário pressiona Cmd+Shift+F
    Then o SearchPanel abre como sidebar lateral
    When o usuário digita "Faturamento 2026" no campo de busca
    Then o IPC search_pages é invocado com debounce
    And os resultados exibem título da página, snippet com termos destacados, e "time ago"
    When o usuário clica em um resultado
    Then a página correspondente é aberta no editor

  Scenario: QuickOpen por título (Cmd+P)
    Given o workspace tem páginas indexadas
    When o usuário pressiona Cmd+P
    Then o QuickOpen dialog aparece com campo de busca
    When o usuário digita "Reunião"
    Then o IPC quick_open retorna páginas com "Reunião" no título (fuzzy, boost 2.0)
    And o usuário pode navegar com setas e Enter para abrir

  Scenario: Reindexação após salvar página
    Given o usuário editou e salvou uma página
    When o auto-save completa o IPC update_page_blocks
    Then o IPC reindex_page é chamado para atualizar o índice Tantivy
    And buscas subsequentes refletem o conteúdo atualizado
```

> **Nota:** A indexação é **manual via IPC** — não há file watcher. O frontend chama `reindex_page` após cada save. O `rebuild_index` reconstrói todo o índice (usado em recovery).

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência da busca
  Scenario: Busca com query vazia ou caracteres especiais
    Given o SearchPanel está aberto
    When o usuário busca por "" (vazio), "()", ou "!@#$%"
    Then a busca retorna 0 resultados sem erro
    And nenhum crash ou panic ocorre no QueryParser do Tantivy

  Scenario: Índice corrompido — recovery via rebuild
    Given os arquivos do índice Tantivy em .opennote/index/ foram corrompidos ou deletados
    When o SearchEngine tenta abrir o índice
    Then open_or_create recria o índice vazio
    And get_index_status retorna total_documents: 0
    And o frontend pode invocar rebuild_index para reindexar todas as páginas

  Scenario: Busca antes de abrir workspace
    Given o app acabou de inicializar sem workspace aberto
    When algum código tenta chamar search_pages
    Then o backend retorna erro legível ("No workspace open")
    And não ocorre panic por unwrap em None (SearchEngine é Mutex<Option<T>>)
```

> **⚠️ Bugs conhecidos do backend (ver retrofit_test_rust/phase_3_search_engine.md):**
> - O tokenizer `"default"` do Tantivy **não faz folding de acentos** — buscar "educacao" não encontra "Educação". Requer tokenizer custom com `ASCIIFoldingFilter`.
> - `index_page()` cria novo `IndexWriter` a cada chamada — chamadas concorrentes falham. Requer refatoração para `Mutex<IndexWriter>` persistente.
