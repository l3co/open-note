# ADR-004: Tantivy as Local Search Engine

## Status
Accepted

## Context
Open Note needs full-text search across the user's notes. Search must work 100% offline (local-first), support Portuguese and English, be fast, and require no external server.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Tantivy** | Native Rust, Lucene-like, customizable tokenizer, no server | No native fuzzy search, index occupies disk space |
| **SQLite FTS5** | Simple, embedded, mature | Less flexible tokenizer, no per-field boosting |
| **MeiliSearch** | Fuzzy, typo-tolerant, REST API | Requires a separate process, not embeddable |
| **Grep on filesystem** | Zero dependency | Slow on large workspaces, no ranking |

## Decision
Adopt **Tantivy 0.22** as the local full-text search engine.

## Rationale
- **Native Rust:** Compiles into the app, no external process
- **Customizable tokenizer:** `SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter` lets users search "café" by typing "cafe"
- **Per-field boosting:** Title (2.0×) and tags (1.5×) rank higher than body content
- **Snippets:** Generates text excerpts with surrounding context around each match
- **Performance:** On-disk index with separate reader/writer, search in ~1ms
- **Local-first:** Index lives in `.opennote/index/`, derived data (reconstructible anytime)

## Consequences

### Positive
- Instant, offline search
- ASCII folding essential for Portuguese
- Index reconstructible at any time (`rebuild_index`)
- Incremental: each save updates only the changed page

### Negative
- Index occupies disk space (~1–5MB depending on content)
- No native fuzzy/typo-tolerant search (exact match with tokenization)
- `reader.reload()` required after each commit for immediate consistency

### Risks
- Index corruption (mitigated: automatic rebuild, index is derived data)
- Performance on very large workspaces (mitigated: result limits, pagination)
