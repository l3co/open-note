# 🗺️ Roadmap de Qualidade e Testes (Rust)

**Objetivo:** Elevar a resiliência e a previsibilidade do projeto `open-note` implementando um modelo de testes automatizados sistemático (Unitários, Integração e Mutação) com base nos princípios do *TDD* e *Clean Architecture*.

## 🎯 Metas de Cobertura

| Crate | Tipo | Meta |
|---|---|---|
| `core` | Unit | 90% |
| `storage` | Integração | 85% |
| `search` | Integração | 85% |
| `sync` | Unit + Mock | 85% |
| `src-tauri` | Contrato | 70% |

Ferramenta de cobertura: `cargo-tarpaulin`.

## 🔍 Análise do Estado Atual (Diagnóstico)

Após imersão na base de código Rust, constatamos:

1. **Crate `core` (~23 testes):** Bons testes unitários cobrindo o "caminho feliz" e erros de validação (ex: criação de página com título vazio).
    * **O que falta:** Testes de mutação de estado (timestamps `updated_at` em `add_tag`, `remove_tag`, `rename`), validação de tags duplicadas/vazias, e invariantes de `Section`/`Notebook` em relação a timestamps.
2. **Crate `storage` (~95 testes):** Fortemente validado por `integration_test.rs` que garante o CRUD interagindo com o File System real.
    * **O que falta:** Testes de resiliência a JSON corrompido, concorrência multi-thread no lock, `cleanup_expired_trash` completo (com arquivos físicos), permissões read-only, sanitização de paths Unicode/Path Traversal (slugs), e testes de migração de schema.
3. **Crate `search` (~15 testes):** Testes de integração de indexação e buscas simples.
    * **⚠️ Bug conhecido:** O tokenizer `"default"` do Tantivy **não faz folding de acentos** — buscar "educacao" não encontra "Educação". Requer implementação de tokenizer custom com `ASCIIFoldingFilter` antes dos testes.
    * **⚠️ Bug arquitetural:** `index_page()` cria um novo `IndexWriter` a cada chamada. Tantivy permite apenas um writer por index — chamadas concorrentes falham. Requer refatoração para `Mutex<IndexWriter>` persistente.
    * **O que falta:** Paginação (`limit`/`offset`), filtros por `notebook_id`/`section_id`, caracteres especiais na query, recuperação de índice corrompido.
4. **Crate `sync` (~21 testes):** Testes focados no coordenador e manifesto.
    * **Nota:** A resolução de conflitos é **file-level** (KeepLocal/KeepRemote/KeepBoth). Não existe merge CRDT de blocos. O sync flow (upload/download) ainda não está implementado — apenas detecção de mudanças.
    * **O que falta:** MockProvider para simular falhas de rede, testes de resolução de conflito file-level completos, backoff em auth expirado.
5. **Crate `src-tauri` (Borda, ~2 testes):** Camada fina de IPC.
    * **O que falta:** Validar que erros de domínio (`CoreError::Validation`) são propagados como strings legíveis ao frontend, concorrência nos `Mutex<Option<T>>` managed states.

## 🧰 Ferramentas e Técnicas Transversais

- **`insta`** — Snapshot testing para JSON serializado (pages, manifests, configs). Já está nas convenções do projeto.
- **`proptest`** (opcional) — Property-based testing para varrer domínios de input (títulos, tags, paths).
- **`tempfile`** — Diretórios temporários para testes de I/O.
- **`tauri::test`** — API de teste do Tauri para commands IPC.
- **Ciclo TDD:** Red → Green → Refactor em todos os cenários.

## 🏗️ Estratégia de Implementação (Faseada)

O roadmap foi dividido nas seguintes fases a serem resolvidas sequencialmente.
Cada fase lista pré-requisitos quando há necessidade de implementação antes dos testes.

- [ ] **Fase 1: Domínio e Lógica de Negócios (`phase_1_core_domain.md`)**
- [ ] **Fase 2: Motor de Armazenamento e Resiliência I/O (`phase_2_storage_engine.md`)**
- [ ] **Fase 3: Motor de Busca e Acurácia de Texto (`phase_3_search_engine.md`)** ⚠️ requer fixes
- [ ] **Fase 4: Sincronização e Resolução de Conflitos (`phase_4_sync.md`)**
- [ ] **Fase 5: Contratos de Borda (Tauri API) (`phase_5_tauri_api.md`)**

Consulte os arquivos das respectivas fases para os cenários detalhados.
