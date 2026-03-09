# ADR-003: TipTap v3 como Editor Rich Text

## Status
Aceito

## Contexto
O Open Note precisa de um editor rich text robusto que suporte headings, listas, tabelas, blocos de código com syntax highlighting, checklists, imagens, embeds e extensões customizadas (callout). O editor precisa ser extensível para novos tipos de bloco sem reescrever a base.

## Alternativas Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **TipTap v3** | Extensível via nodes/marks, baseado em ProseMirror, comunidade ativa, TypeScript nativo, BubbleMenu/FloatingMenu built-in | Depende de ProseMirror (curva de aprendizado), bundle maior |
| **Slate.js** | Flexível, React-native, customizável | API instável entre versões, menos plugins prontos |
| **Lexical (Meta)** | Performance, tree-based, React-native | Ecossistema menor, menos extensões prontas |
| **Quill** | Simples, maduro | Menos extensível, difícil de customizar profundamente |

## Decisão
Adotar **TipTap v3** (baseado em ProseMirror) como engine do editor rich text.

## Justificativa
- **Extensibilidade:** Sistema de extensões permite adicionar novos node types (callout, embed) sem modificar o core do editor
- **Ecossistema:** Extensões oficiais para table, code-block-lowlight, task-list, image, link, placeholder, character-count
- **Serialização:** JSON nativo que mapeia bem para o modelo de Block[] do domínio
- **BubbleMenu:** Toolbar flutuante ao selecionar texto — UX moderna sem toolbar fixa
- **Slash Commands:** Possível implementar via suggestion API
- **TypeScript:** Tipos completos, boa DX
- **ProseMirror:** Engine battle-tested usado por NYT, Atlassian, GitLab

## Consequências

### Positivas
- Editor extensível e maduro
- Slash commands e floating toolbar com boa UX
- Conversão bidirecional Block[] ↔ TipTap JSON via serialization layer
- Syntax highlighting via lowlight (code blocks)

### Negativas
- Bundle size maior (~150KB gzipped com extensões)
- Curva de aprendizado de ProseMirror para extensões custom
- Table import usa `{ Table }` (named import, sem default export no v3)

### Riscos
- Breaking changes entre versões do TipTap (mitigado: lock de versões no package.json)
- Performance com muitos blocos (mitigado: soft limit 200, hard limit 500)
