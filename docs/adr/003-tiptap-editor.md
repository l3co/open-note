# ADR-003: TipTap v3 as Rich Text Editor

## Status
Accepted

## Context
Open Note needs a robust rich text editor that supports headings, lists, tables, syntax-highlighted code blocks, checklists, images, embeds, and custom extensions (callout). The editor must be extensible for new block types without rewriting the base.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **TipTap v3** | Extensible via nodes/marks, ProseMirror-based, active community, native TypeScript, built-in BubbleMenu/FloatingMenu | ProseMirror learning curve, larger bundle |
| **Slate.js** | Flexible, React-native, customizable | Unstable API across versions, fewer ready-made plugins |
| **Lexical (Meta)** | Performance, tree-based, React-native | Smaller ecosystem, fewer extensions |
| **Quill** | Simple, mature | Less extensible, hard to deep-customize |

## Decision
Adopt **TipTap v3** (ProseMirror-based) as the rich text editor engine.

## Rationale
- **Extensibility:** Extension system allows adding new node types (callout, embed) without modifying the editor core
- **Ecosystem:** Official extensions for table, code-block-lowlight, task-list, image, link, placeholder, character-count
- **Serialization:** Native JSON that maps well to the domain's Block[] model
- **BubbleMenu:** Floating toolbar on text selection — modern UX without a fixed toolbar
- **Slash Commands:** Implementable via the suggestion API
- **TypeScript:** Complete types, great DX
- **ProseMirror:** Battle-tested engine used by NYT, Atlassian, GitLab

## Consequences

### Positive
- Extensible and mature editor
- Slash commands and floating toolbar with great UX
- Bidirectional Block[] ↔ TipTap JSON conversion via a serialization layer
- Syntax highlighting via lowlight (code blocks)

### Negative
- Larger bundle size (~150KB gzipped with extensions)
- ProseMirror learning curve for custom extensions
- Table import uses `{ Table }` (named import, no default export in v3)

### Risks
- Breaking changes between TipTap versions (mitigated: version pinning in package.json)
- Performance with many blocks (mitigated: soft limit 200, hard limit 500)
