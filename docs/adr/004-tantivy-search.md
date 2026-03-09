# ADR-004: Tantivy como Engine de Busca Local

## Status
Aceito

## Contexto
O Open Note precisa de busca full-text nas anotações do usuário. A busca deve funcionar 100% offline (local-first), suportar português e inglês, ser rápida e não exigir servidor externo.

## Alternativas Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Tantivy** | Rust nativo, similar ao Lucene, tokenizer customizável, sem servidor | Não tem fuzzy search nativo, índice ocupa espaço |
| **SQLite FTS5** | Simples, embutido, maduro | Tokenizer menos flexível, sem boost por campo |
| **MeiliSearch** | Fuzzy, typo-tolerant, REST API | Requer processo separado, não é embeddable |
| **Grep no filesystem** | Zero dependência | Lento em workspaces grandes, sem ranking |

## Decisão
Adotar **Tantivy 0.22** como engine de busca full-text local.

## Justificativa
- **Rust nativo:** Compila junto com o app, sem processo externo
- **Tokenizer customizável:** `SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter` permite buscar "café" digitando "cafe"
- **Boost por campo:** Título (2.0x) e tags (1.5x) têm peso maior que conteúdo
- **Snippets:** Geração de trechos com contexto ao redor do match
- **Performance:** Índice em disco com reader/writer separados, busca em ~1ms
- **Local-first:** Índice vive em `.opennote/index/`, dados derivados (reconstruíveis)

## Consequências

### Positivas
- Busca instantânea e offline
- ASCII folding essencial para português
- Índice reconstruível a qualquer momento (`rebuild_index`)
- Incremental: cada save atualiza apenas a page alterada

### Negativas
- Índice ocupa espaço (~1-5MB dependendo do conteúdo)
- Sem fuzzy/typo-tolerant nativo (busca exata com tokenização)
- `reader.reload()` necessário após cada commit para consistência imediata

### Riscos
- Corrupção do índice (mitigado: reconstrução automática, índice é dado derivado)
- Performance com workspaces muito grandes (mitigado: limites de resultados, paginação)
