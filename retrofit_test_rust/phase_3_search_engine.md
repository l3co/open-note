# Fase 3: Motor de Busca e Acurácia (`crates/search`)

Busca (*Search*) é fortemente dependente da tokenização e análises do analisador semântico (Tantivy). Precisamos ir além do caminho feliz para cobrir a experiência de busca dos usuários finais (incluindo buscas acentuadas e cases).

**Testes existentes:** ~15 (7 unit + 8 integration)

## ⚠️ Pré-requisitos (Fixes Necessários Antes dos Testes)

### Fix 1: Tokenizer com ASCII Folding (PT-BR)

O schema atual (`crates/search/src/schema.rs`) usa o tokenizer `"default"` do Tantivy, que **não faz folding de acentos**. Buscar `"educacao"` **não encontra** `"Educação"`. Para o público PT-BR, isso é um bug crítico de usabilidade.

**Implementação necessária:**
1. Registrar um tokenizer custom no `Index` com pipeline: `SimpleTokenizer` → `RemoveLongFilter` → `LowerCaser` → `ASCIIFoldingFilter`
2. Usar esse tokenizer nos campos `title`, `content`, `tags` (substituir `"default"`)
3. Dependência: `tantivy` já inclui `ASCIIFoldingFilter` nativamente (desde v0.21)

**Só após o fix**, o teste `test_search_case_and_diacritic_insensitivity` poderá passar.

### Fix 2: IndexWriter Persistente (Concorrência)

O `index_page()` em `engine.rs` cria um **novo `IndexWriter` a cada chamada** (`self.index.writer(15_000_000)`). Tantivy permite **apenas um writer por index**. Duas chamadas simultâneas a `index_page()` resultam em erro.

**Implementação necessária:**
1. Mover `IndexWriter` para um campo `Mutex<IndexWriter>` no `SearchEngine`
2. Reutilizar o writer em `index_page`, `remove_page`, `rebuild`
3. Commit continua no mesmo writer

**Só após o fix**, o teste `test_concurrent_read_and_index_operations` poderá funcionar.

---

## 🧪 Cenários de Teste a Serem Implementados

### 1. Robustez do Analisador de Texto

- [ ] **`test_search_case_and_diacritic_insensitivity`** *(depende do Fix 1)*:
  - *Contexto*: Usuários brasileiros buscam por "conclusao" esperando "Conclusão".
  - *Cenário*: Indexar `make_page("Educação", "Análise de currículo")`. Buscar por:
    - `"educacao"` → deve encontrar (folding de `ç` → `c`, `ã` → `a`)
    - `"curriculo"` → deve encontrar (folding de `í` → `i`)
    - `"EDUCAÇÃO"` → deve encontrar (case insensitive)
  - *Expectativa*: Todas as buscas retornam 1 resultado.

- [ ] **`test_search_special_characters_handling`**:
  - *Cenário*: Buscas com caracteres que são especiais no QueryParser do Tantivy:
    - `"fn main()"` — parênteses
    - `"!!Atenção!!"` — exclamações
    - `"user@email.com"` — arroba
    - `""aspas duplas"` — aspas
    - `"()"` — operadores booleanos vazios
  - *Expectativa*: Nenhuma busca deve causar panic ou erro não tratado. Resultados podem ser vazios, mas a query deve ser processada graciosamente.
  - *Implementação*: Pode requerer escape ou `parse_query_lenient` no QueryParser.

### 2. Filtros por Notebook e Section

- [ ] **`test_search_with_notebook_filter`**:
  - *Cenário*: Indexar 3 páginas: 2 no notebook `"nb-1"`, 1 no `"nb-2"`. Buscar com `notebook_id: Some("nb-1")`.
  - *Expectativa*: Retorna apenas as 2 páginas do notebook filtrado.

- [ ] **`test_search_with_section_filter`**:
  - *Cenário*: Similar ao anterior, mas filtrando por `section_id`.
  - *Nota*: Esses filtros já existem na API (`SearchQuery.notebook_id`, `SearchQuery.section_id`) mas não têm testes de integração.

### 3. Paginação e Offsets (`limit` e `offset`)

- [ ] **`test_search_pagination_boundaries`**:
  - *Cenário*: Inserir 15 páginas contendo a palavra "Rust" no título.
  - Buscar com `limit: 10, offset: 0` → Retorna 10 itens.
  - Buscar com `limit: 10, offset: 10` → Retorna 5 restantes.
  - Buscar com `limit: 10, offset: 50` → Retorna 0.
  - *Nota*: `SearchResults.total` pode não refletir o total real — `TopDocs::with_limit().and_offset()` do Tantivy não retorna contagem total facilmente. Verificar se `total` está correto ou se precisa de `count()` separado.

### 4. Indexação Concorrente *(depende do Fix 2)*

- [ ] **`test_concurrent_read_and_index_operations`**:
  - *Cenário*: Thread A dispara N operações `engine.index_page(...)`. Thread B entra num loop disparando `engine.search(...)` via `Arc<SearchEngine>`.
  - *Expectativa*: Sem deadlock. Buscas de B refletem estado consistente (eventual consistency é aceitável — o reader usa `ReloadPolicy::OnCommitWithDelay`).
  - *Nota*: Após o Fix 2, o writer estará protegido por `Mutex`, permitindo acesso concorrente seguro.

### 5. Recriação e Indexação Total

- [ ] **`test_engine_recovery_from_corrupt_index`**:
  - *Cenário*: Criar engine → indexar 1 página → fechar → deletar `meta.json` do diretório Tantivy → reabrir com `open_or_create`.
  - *Expectativa*: A engine se recria com índice vazio. `get_status()` retorna `total_documents: 0`. O frontend pode então invocar `rebuild()`.

- [ ] **`test_rebuild_is_idempotent`**:
  - *Cenário*: Chamar `rebuild(&pages)` duas vezes com os mesmos dados. `get_status().total_documents` deve ser igual em ambas as chamadas, sem duplicação.

## 🧰 Técnicas

- Mass data inserts via helper `make_page()` em loop para testes de paginação.
- `Arc<SearchEngine>` + `std::thread::spawn` para testes de concorrência.
- Assertions em `results.items[..].snippet` verificando presença de termos matched.
- QueryParser lenient mode para caracteres especiais.
