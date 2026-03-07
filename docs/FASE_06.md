# Fase 06 — Modo Markdown

## Objetivo

Adicionar suporte nativo a **Markdown** no editor, permitindo ao usuário alternar entre visualização rich text e edição Markdown raw. Além disso, implementar import/export de arquivos `.md` para interoperabilidade com outros apps (Obsidian, VS Code, etc.).

---

## Dependências

- Fase 04 concluída (editor TipTap com blocos básicos)
- Fase 05 parcialmente concluída (blocos avançados — pelo menos CodeBlock)

---

## Entregáveis

1. Toggle Rich Text ↔ Markdown no editor
2. Parser Markdown → TipTap JSON (import)
3. Serializer TipTap JSON → Markdown (export)
4. Import de arquivos `.md` como Pages
5. Export de Pages como `.md`
6. Syntax highlighting no modo Markdown raw
7. Preview em tempo real (split view opcional)
8. Atalhos Markdown inline no modo rich text (auto-conversion)

---

## Modos de Edição

### Rich Text Mode (padrão)

- Editor TipTap com WYSIWYG
- Formatação via toolbar e atalhos
- É o modo padrão ao abrir qualquer page

### Markdown Mode

- Editor de texto plano com syntax highlighting
- Conteúdo exibido como Markdown raw
- Mudanças no Markdown são refletidas nos blocos ao voltar para Rich Text

### Split Mode (opcional — nice to have)

- Lado esquerdo: Markdown raw
- Lado direito: Preview renderizado
- Edição no lado esquerdo, preview em tempo real no direito

---

## Toggle entre Modos

### UX

Botão na toolbar: `[Rich Text] [Markdown]` (toggle group)

Atalho: `Cmd/Ctrl + Shift + M`

### Fluxo Técnico

```
Rich Text → Markdown:
  1. Serializar TipTap JSON → Markdown string
  2. Exibir Markdown no editor de texto plano (CodeMirror ou textarea com highlight)

Markdown → Rich Text:
  1. Parsear Markdown string → TipTap JSON
  2. Atualizar instância TipTap com novo conteúdo
```

### Preservação de Conteúdo

**Problema:** A conversão Rich Text ↔ Markdown pode perder informação (ex: callout blocks não existem em Markdown padrão).

**Estratégia:**
- Blocos sem equivalente Markdown são serializados como **comentários HTML** dentro do Markdown:
  ```markdown
  <!-- opn:callout variant="info" -->
  Texto do callout
  <!-- /opn:callout -->
  ```
- O parser reconhece esses comentários e reconstrói os blocos
- Isso garante roundtrip sem perda

**Mapeamento Rich Text → Markdown:**

| Block Type | Markdown |
|---|---|
| Heading 1–6 | `# ` a `###### ` |
| Paragraph | Texto simples |
| Bold | `**texto**` |
| Italic | `*texto*` |
| Underline | `<!-- opn:u -->texto<!-- /opn:u -->` |
| Strikethrough | `~~texto~~` |
| Inline Code | `` `código` `` |
| Link | `[texto](url)` |
| Bullet List | `- item` |
| Ordered List | `1. item` |
| Checklist | `- [x] item` / `- [ ] item` |
| Blockquote | `> texto` |
| Code Block | ` ```lang\ncódigo\n``` ` |
| Table | Pipe table (`\| col \|`) |
| Image | `![alt](path)` |
| Divider | `---` |
| Callout | `<!-- opn:callout -->` wrapper |
| Embed | `<!-- opn:embed url="..." -->` |
| Ink | `<!-- opn:ink ref="assets/ink-xxx.svg" -->` |

---

## Markdown Auto-Conversion (Rich Text Mode)

No modo Rich Text, o editor reconhece atalhos Markdown inline e converte automaticamente:

| Digitação | Resultado |
|---|---|
| `# ` + espaço | Heading 1 |
| `## ` + espaço | Heading 2 |
| `### ` + espaço | Heading 3 |
| `- ` + espaço | Bullet list item |
| `1. ` + espaço | Ordered list item |
| `- [ ] ` | Checklist item |
| `> ` + espaço | Blockquote |
| `` ``` `` + Enter | Code block |
| `---` + Enter | Divider |
| `**texto**` | Bold |
| `*texto*` | Italic |
| `` `código` `` | Inline code |
| `~~texto~~` | Strikethrough |

Isso é implementado via **TipTap Input Rules** (muitos já vêm com o StarterKit).

---

## Import / Export

### Import `.md`

**Fluxo:**
1. Menu: "Arquivo → Importar Markdown" (ou drag & drop de `.md`)
2. Tauri abre file picker nativo (filtro: `*.md`)
3. Rust lê o arquivo
4. Frontend parseia Markdown → TipTap JSON
5. Cria nova Page na section atual com o conteúdo

**Parser:** Usar `markdown-it` (JavaScript) ou `pulldown-cmark` (Rust).

**Decisão:** Parser no **frontend** (JavaScript) usando `markdown-it`, porque:
- O TipTap precisa do JSON no frontend
- `markdown-it` é extensível para custom blocks (nossos comentários HTML)
- Evita conversão extra Rust → frontend

**Comando IPC:**

| Comando | Input | Output |
|---|---|---|
| `read_file_content` | `path: String` | `String` (conteúdo raw) |
| `import_markdown_file` | `section_id, file_path` | `Page` (page criada) |

### Export `.md`

**Fluxo:**
1. Menu: "Arquivo → Exportar como Markdown"
2. Frontend serializa TipTap JSON → Markdown string
3. Tauri abre save dialog (nome padrão: `{page_title}.md`)
4. Rust escreve o arquivo

**Comando IPC:**

| Comando | Input | Output |
|---|---|---|
| `save_file_content` | `path: String, content: String` | `()` |

### Import em lote (pasta)

**Futuro (nice to have):** Importar pasta inteira de `.md` como uma Section, com cada arquivo virando uma Page.

---

## Editor Markdown Raw

### Implementação

Duas opções:

1. **CodeMirror 6** — Editor de código completo, excelente syntax highlighting
2. **Textarea com highlight** — Mais simples, menos funcional

**Decisão:** `CodeMirror 6` — mais robusto, suporta extensões, e tem pacote específico para Markdown (`@codemirror/lang-markdown`).

**Dependências:**
- `@codemirror/view`
- `@codemirror/state`
- `@codemirror/lang-markdown`
- `@codemirror/theme-one-dark` (tema escuro)

### Funcionalidades do Editor Markdown

- Syntax highlighting para Markdown
- Line numbers (opcional, toggle)
- Word wrap
- Matching brackets
- Auto-close de `**`, `*`, `` ` ``, `~~`
- Indent com Tab
- Atalhos: `Cmd+B` insere `**`, `Cmd+I` insere `*`, etc.
- Tema sincronizado com o tema do app (claro/escuro)

---

## Componentes

### `<EditorModeToggle />`

Toggle na toolbar entre Rich Text e Markdown.

```
┌──────────────┬──────────────┐
│  Rich Text   │  Markdown    │
└──────────────┴──────────────┘
```

- Segmented control (shadcn/ui `ToggleGroup`)
- Ícones: `Type` (rich text), `Code` (markdown)
- Estado persiste por page (cada page lembra seu último modo)

### `<MarkdownEditor />`

Wrapper do CodeMirror para edição Markdown.

**Props:**
```typescript
interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  theme: 'light' | 'dark';
}
```

### `<SplitView />`

Layout dividido para preview em tempo real.

```
┌───────────────────┬───────────────────┐
│  Markdown Editor  │  Preview (HTML)   │
│  (CodeMirror)     │  (renderizado)    │
│                   │                   │
└───────────────────┴───────────────────┘
```

- Divisor redimensionável
- Preview atualiza com debounce (300ms)
- Preview usa mesmos estilos do Rich Text mode

---

## Persistência

### Como armazenar o modo?

O formato `.opn.json` sempre armazena o conteúdo como **TipTap JSON** (formato canônico). O Markdown é apenas uma **view** alternativa.

**Fluxo ao salvar no modo Markdown:**
1. Parsear Markdown → TipTap JSON
2. Salvar TipTap JSON no `.opn.json`

**Fluxo ao abrir no modo Markdown:**
1. Ler TipTap JSON do `.opn.json`
2. Serializar TipTap JSON → Markdown string
3. Exibir no CodeMirror

**Vantagem:** Fonte de verdade única (TipTap JSON). Markdown é derivado.

**Metadata na page** para lembrar modo preferido:
```json
{
  "editor_preferences": {
    "mode": "markdown",
    "split_view": false
  }
}
```

---

## Testes

### Unitários

- **Serialização:** TipTap JSON → Markdown para cada tipo de bloco
- **Parsing:** Markdown → TipTap JSON para cada tipo de bloco
- **Roundtrip:** TipTap JSON → Markdown → TipTap JSON (sem perda)
- **Custom blocks:** Callout/Embed/Ink → Markdown (com comentários HTML) → volta
- **Auto-conversion:** Input rules para `# `, `- `, `1. `, `---`, etc.
- **Edge cases:** Markdown mal formado, nested blocks, tabelas complexas

### Integração

- Import arquivo `.md` → page criada com conteúdo correto
- Export page → arquivo `.md` com conteúdo correto
- Toggle modo → conteúdo preservado nos dois sentidos
- Auto-save funciona nos dois modos

### E2E

- Criar page → alternar para Markdown → editar → voltar para Rich Text → conteúdo preservado
- Importar `.md` complexo (headings, listas, código, tabela) → todos os blocos criados
- Exportar page com blocos avançados → abrir `.md` no VS Code → conteúdo legível
- Split view → editar Markdown → preview atualiza em tempo real

---

## Export Adicional (além de Markdown)

### v1 — Escopo atual
- **Import:** `.md`
- **Export:** `.md`

### Futuro (pós v1) — candidatos documentados

| Formato | Direção | Estratégia | Complexidade |
|---|---|---|---|
| **HTML** | Export | Serializar TipTap JSON → HTML via `generateHTML()` do TipTap. Incluir CSS inline para estilo. | Baixa |
| **PDF** | Export | Usar a rota HTML → PDF via `print-to-pdf` do Tauri/WebView (`window.print()` com CSS `@media print`). | Média |
| **ENEX** (Evernote) | Import | Parser XML do formato ENEX → mapear para blocos Open Note. Imagens inline (base64) → assets. | Alta |
| **HTML** | Import | Parser HTML → TipTap `generateJSON()`. Sanitização obrigatória. | Média |

**Decisão:** Na v1, focar em Markdown (já é o formato mais universal para interop). HTML e PDF export são os próximos candidatos por terem complexidade baixa/média e alto valor percebido pelo usuário.

**Nota para implementação futura:**
- Export PDF via `window.print()` é a abordagem mais simples — reutiliza o rendering existente do WebView
- Para PDFs com fidelidade alta (ink, annotations), será necessário renderização custom (e.g. `jspdf` ou `puppeteer` no backend)
- Import de ENEX é complexo mas estratégico para aquisição de usuários vindos do Evernote

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Perda de dados na conversão Rich Text ↔ Markdown | Alto | Comentários HTML para blocos sem equivalente. Testes de roundtrip extensivos. |
| CodeMirror + TipTap = bundle size grande | Médio | Lazy loading do CodeMirror (só carrega quando usuário ativa Markdown mode) |
| Markdown ambíguo (variantes GFM, CommonMark) | Médio | Usar CommonMark como base + extensões GFM (tables, tasklists, strikethrough) |
| Performance com documentos grandes no split view | Baixo | Debounce no preview, virtualização se necessário |

---

## Definition of Done

- [ ] Toggle Rich Text ↔ Markdown funcionando sem perda de dados
- [ ] Markdown auto-conversion no modo Rich Text (input rules)
- [ ] Editor Markdown com syntax highlighting (CodeMirror)
- [ ] Split view (Markdown + Preview) funcionando
- [ ] Import de arquivos `.md` como Pages
- [ ] Export de Pages como `.md`
- [ ] Blocos custom preservados via comentários HTML no Markdown
- [ ] Roundtrip TipTap JSON → Markdown → TipTap JSON testado para todos os blocos
- [ ] Auto-save funciona nos dois modos
- [ ] Modo preferido persiste por page
- [ ] Testes unitários passando (serialização, parsing, roundtrip)
- [ ] Testes de integração passando (import, export)
- [ ] Testes E2E passando
- [ ] CI verde
