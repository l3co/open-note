# ADR-002: Cargo Workspace com Crates Compartilhados

## Status

Aceito

## Contexto

A aplicação tem lógica de domínio (entidades, regras), persistência (filesystem),
busca (indexação), e sync (cloud). Precisamos decidir como organizar o código Rust.

Alternativas:
- **Monolito em `src-tauri/`** — todo código Rust dentro do app Tauri
- **Cargo workspace** — crates separados por bounded context

## Decisão

Usar **Cargo workspace** com 4 crates + o app Tauri:

```
crates/core     → domínio puro (zero deps de framework)
crates/storage  → filesystem, atomic writes, lock, trash
crates/search   → Tantivy, indexação full-text
crates/sync     → cloud sync (Google Drive, OneDrive, Dropbox)
src-tauri       → camada fina de IPC (delega para crates)
```

## Justificativa

- **Testabilidade:** `crates/core` pode ser testado sem Tauri, sem filesystem, sem I/O
- **Clean Architecture:** dependências apontam para dentro (`src-tauri → storage → core`)
- **Reuso:** crates podem ser usados em CLI, servidor, ou mobile sem mudanças
- **Compilação incremental:** mudanças em um crate não recompilam os outros
- **Separação de concerns:** cada crate tem responsabilidade clara (DDD bounded contexts)

## Consequências

- Workspace dependencies compartilhadas via `[workspace.dependencies]`
- TypeScript bindings gerados via `ts-rs` a partir de structs nos crates
- `src-tauri` é thin — parse args → call crate → serialize response
- Domínio (`crates/core`) nunca importa frameworks, Tauri, serde_json, ou filesystem
