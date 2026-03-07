# Fase 04 — Editor Rich Text

## Objetivo

Implementar o **editor de conteúdo principal** usando TipTap (ProseMirror), com suporte a blocos básicos de texto rico. Ao final desta fase, o usuário consegue criar e editar conteúdo real dentro das pages.

---

## Dependências

- Fase 03 concluída (UI Shell + navegação + PageView)

---

## Entregáveis

1. Integração TipTap no `<PageView />`
2. Schema ProseMirror customizado para o modelo de blocos do Open Note
3. Blocos básicos: heading, parágrafo, lista (ordered/unordered), blockquote
4. Formatação inline: bold, italic, underline, strikethrough, code, link
5. Toolbar flutuante (floating menu) para formatação
6. Slash commands (/) para inserir blocos
7. Auto-save com debounce
8. Serialização TipTap ↔ formato `.opn.json`
9. Undo/Redo
10. Placeholder text em blocos vazios

---

## Arquitetura do Editor

```
┌─────────────────────────────────────────────┐
│               <PageEditor />                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │          <TitleEditor />            │    │
│  │     Título da page (contenteditable)│    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │          <BlockEditor />            │    │
│  │                                     │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ TipTap Editor Instance        │  │    │
│  │  │                               │  │    │
│  │  │  [Heading Block]              │  │    │
│  │  │  [Paragraph Block]           │  │    │
│  │  │  [List Block]                │  │    │
│  │  │  [Blockquote Block]          │  │    │
│  │  │  ...                         │  │    │
│  │  └───────────────────────────────┘  │    │
│  │                                     │    │
│  │  <FloatingToolbar />                │    │
│  │  <SlashCommandMenu />              │    │
│  │  <LinkPopover />                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## TipTap — Configuração

### Extensions Necessárias

| Extension | Pacote | Propósito |
|---|---|---|
| StarterKit | `@tiptap/starter-kit` | Base (heading, paragraph, list, blockquote, etc.) |
| Placeholder | `@tiptap/extension-placeholder` | Texto placeholder em blocos vazios |
| Underline | `@tiptap/extension-underline` | Formatação underline |
| Link | `@tiptap/extension-link` | Links clicáveis com popover |
| Typography | `@tiptap/extension-typography` | Correção tipográfica automática |
| CharacterCount | `@tiptap/extension-character-count` | Contagem de caracteres/palavras |
| History | `@tiptap/extension-history` | Undo/Redo (já no StarterKit) |

### Schema Customizado

O TipTap usa o schema do ProseMirror. Precisamos customizá-lo para alinhar com nosso modelo de blocos.

**Mapeamento Block ↔ ProseMirror Node:**

| Block Type (Open Note) | ProseMirror Node | Atributos |
|---|---|---|
| `TextBlock` (heading) | `heading` | `level: 1\|2\|3\|4\|5\|6` |
| `TextBlock` (paragraph) | `paragraph` | — |
| `TextBlock` (list) | `bulletList` / `orderedList` → `listItem` | — |
| `TextBlock` (blockquote) | `blockquote` | — |

**Marks (formatação inline):**

| Formatação | Mark |
|---|---|
| Bold | `bold` |
| Italic | `italic` |
| Underline | `underline` |
| Strikethrough | `strike` |
| Inline code | `code` |
| Link | `link` (href, target) |

---

## Componentes

### `<PageEditor />`

Container principal do editor de uma page.

**Responsabilidades:**
- Recebe a `Page` do store
- Gerencia instância TipTap
- Coordena auto-save
- Gerencia título separado do conteúdo

**Props:**
```typescript
interface PageEditorProps {
  page: Page;
  onSave: (page: PageUpdate) => Promise<void>;
}
```

---

### `<TitleEditor />`

Editor inline do título da page.

**Comportamento:**
- `contenteditable` simples (não TipTap — overengineering)
- Placeholder: "Sem título"
- Enter → move foco para o BlockEditor
- Auto-save no blur
- Estilo: fonte grande, sem borda, limpo

---

### `<BlockEditor />`

Wrapper do TipTap editor.

**Comportamento:**
- Inicializa TipTap com extensions configuradas
- Recebe conteúdo inicial da Page (JSON → TipTap)
- Emite mudanças via `onUpdate` callback
- Gerencia focus e seleção

---

### `<FloatingToolbar />`

Toolbar que aparece ao selecionar texto.

**Elementos:**
```
[B] [I] [U] [S] [</>] [🔗] [H1 ▾] [" ▾]
```

- **B** — Bold (`Cmd+B`)
- **I** — Italic (`Cmd+I`)
- **U** — Underline (`Cmd+U`)
- **S** — Strikethrough (`Cmd+Shift+S`)
- **</>** — Inline code
- **🔗** — Link (abre `<LinkPopover />`)
- **H1 ▾** — Dropdown de headings (H1–H6)
- **" ▾** — Transformar em blockquote

**Comportamento:**
- Aparece acima da seleção de texto
- Desaparece ao perder seleção
- Posição calculada dinamicamente
- Animação suave de entrada/saída

---

### `<SlashCommandMenu />`

Menu de comandos ativado por `/` no início de um bloco vazio.

**Comandos disponíveis nesta fase:**

| Comando | Ícone | Descrição |
|---|---|---|
| Heading 1 | `H1` | Título grande |
| Heading 2 | `H2` | Subtítulo |
| Heading 3 | `H3` | Subtítulo menor |
| Bullet List | `•` | Lista com marcadores |
| Numbered List | `1.` | Lista numerada |
| Blockquote | `"` | Citação |
| Divider | `—` | Linha separadora |

**Comportamento:**
- Ativado ao digitar `/` em bloco vazio ou início de linha
- Filtro por texto digitado após `/` (fuzzy search)
- Navegação por ↑/↓, seleção por Enter
- Esc para fechar
- Posição relativa ao cursor

---

### `<LinkPopover />`

Popover para inserir/editar links.

**Campos:**
- URL (obrigatório, validação de formato)
- Texto de exibição (opcional)

**Comportamento:**
- Abre ao clicar no botão de link da FloatingToolbar
- Também abre ao clicar em link existente
- Enter → salvar, Esc → cancelar
- Botão para remover link

---

## Serialização

### TipTap → `.opn.json`

O TipTap trabalha internamente com um JSON próprio (ProseMirror JSON). Precisamos converter de/para nosso formato de blocos.

**Estratégia:** Usar o JSON nativo do TipTap como conteúdo do `TextBlock`.

```json
{
  "id": "block-uuid",
  "type": "text",
  "content": {
    "tiptap_json": {
      "type": "doc",
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 2 },
          "content": [{ "type": "text", "text": "Meu título" }]
        },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Texto normal " },
            { "type": "text", "marks": [{ "type": "bold" }], "text": "em negrito" }
          ]
        }
      ]
    }
  },
  "order": 0
}
```

**Alternativa avaliada (descartada):** Converter para HTML. Motivo: HTML é mais difícil de fazer merge/diff e perde informação semântica.

**Decisão:** Armazenar o JSON nativo do TipTap dentro do nosso bloco. Isso:
- Preserva toda a informação semântica
- Facilita deserialização sem conversões
- É determinístico (mesma entrada = mesma saída)
- Pode ser convertido para HTML/Markdown sob demanda (export)

---

## Auto-Save

### Estratégia

```
Usuário edita → debounce 1s → salvar no filesystem
```

**Fluxo detalhado:**

1. TipTap emite `onUpdate` a cada mudança
2. `useAutoSave` hook inicia timer de 1 segundo
3. Se outra mudança ocorrer dentro do 1s, reseta o timer
4. Quando timer dispara:
   a. Serializar conteúdo TipTap → formato `.opn.json`
   b. Chamar comando IPC `update_page`
   c. Atualizar `lastSavedAt` no store
5. Status bar exibe "Salvando..." → "Salvo ✓"

**Proteções:**
- Ao fechar a page ou o app, forçar save imediato (flush)
- Se save falhar, exibir erro no status bar + retry automático
- Guardar dirty state para não perder dados

### Hook

```typescript
function useAutoSave(
  content: JSONContent,
  onSave: (content: JSONContent) => Promise<void>,
  delayMs: number = 1000
): {
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  forceSave: () => Promise<void>;
}
```

### Coordenação de Saves (Text + Annotations)

A page `.opn.json` contém tanto `blocks` (texto/editor) quanto `annotations` (ink overlay, Fase 07). Ambos são auto-saved com debounces diferentes (1s texto, 2s annotations). Para evitar race conditions onde um save sobrescreve as mudanças do outro:

**Abordagem: SaveCoordinator no backend (Rust)**

```
Frontend (texto)       Frontend (annotations)
    │                        │
    ▼                        ▼
  debounce 1s            debounce 2s
    │                        │
    ▼                        ▼
  IPC: update_page_blocks  IPC: update_page_annotations
    │                        │
    └──────────┬─────────────┘
               ▼
     SaveCoordinator (Rust)
      - Mutex por page_id
      - Read current → merge → write
```

**Comandos IPC separados:**

| Comando | Input | Output |
|---|---|---|
| `update_page_blocks` | `page_id, blocks: Vec<Block>` | `Page` |
| `update_page_annotations` | `page_id, annotations: PageAnnotations` | `Page` |
| `update_page` | `PageUpdate` (qualquer campo) | `Page` |

**Regras:**
- O backend usa **Mutex por page_id** — nunca dois writes simultâneos na mesma page
- Cada comando faz **read-modify-write**: lê o arquivo atual, atualiza apenas a seção relevante, escreve de volta
- `update_page_blocks` só modifica `blocks` + `updated_at`
- `update_page_annotations` só modifica `annotations` + `updated_at`
- Flush ao fechar page: ambos os debounces são forçados antes de fechar
- Se um save falhar (IO error), o outro não é afetado — retry independente

---

## Atalhos de Teclado (Editor)

| Atalho | Ação |
|---|---|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Cmd/Ctrl + Shift + S` | Strikethrough |
| `Cmd/Ctrl + E` | Inline code |
| `Cmd/Ctrl + K` | Inserir link |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Shift + 1–6` | Heading 1–6 |
| `Cmd/Ctrl + Shift + 7` | Ordered list |
| `Cmd/Ctrl + Shift + 8` | Bullet list |
| `Cmd/Ctrl + Shift + 9` | Blockquote |
| `/` | Abrir slash command menu |
| `---` + Enter | Inserir divider |
| `Tab` | Indentar item de lista |
| `Shift + Tab` | De-indentar item de lista |

---

## Testes

### Unitários

- TipTap inicializa com conteúdo correto a partir do JSON
- Serialização TipTap JSON → formato `.opn.json` e volta
- `useAutoSave` hook: debounce, save, error handling
- `<FloatingToolbar />` renderiza botões corretos
- `<SlashCommandMenu />` filtra comandos por texto

### Integração

- Criar page → abrir editor → digitar texto → auto-save → reabrir → conteúdo preservado
- Formatação bold/italic → salvar → reabrir → formatação preservada
- Slash commands → inserir heading → conteúdo correto no JSON
- Link → inserir → editar → remover → conteúdo atualizado

### E2E

- Fluxo completo: criar page → editar título → adicionar conteúdo → formatar → salvar → reabrir → tudo preservado
- Slash commands: digitar `/heading` → selecionar → bloco criado
- Undo/Redo: editar → Cmd+Z → conteúdo voltou → Cmd+Shift+Z → conteúdo reaplicado
- Auto-save: editar → esperar 1s → status bar mostra "Salvo"

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Performance com páginas muito longas | Alto | Ver seção "Limites de Page" abaixo |
| TipTap JSON breaking changes entre versões | Médio | Fixar versão, incluir testes de snapshot do JSON |
| Conflito de atalhos: editor vs app | Médio | Atalhos de app só ativos quando editor não tem foco |
| Perda de dados se auto-save falhar | Alto | Dirty flag, retry, backup local em memória |

---

## Limites de Page (performance)

Pages muito grandes degradam a performance do TipTap/ProseMirror. Definir limites e mitigações:

**Thresholds:**

| Métrica | Soft Limit (warning) | Hard Limit (ação) |
|---|---|---|
| Blocos por page | 200 | 500 |
| Tamanho do `.opn.json` | 1 MB | 5 MB |
| Imagens por page | 30 | 100 |

**Comportamento:**

- **Soft limit atingido:** Status bar exibe aviso: "Esta página está grande. Considere dividir o conteúdo." Cor amarela.
- **Hard limit atingido:** Status bar exibe alerta vermelho. Auto-save continua funcionando, mas o editor pode ficar lento. Nenhum bloqueio — o usuário decide.
- **Métricas expostas:** `usePageStore` mantém `blockCount` e `pageSize` atualizados. Status bar pode exibir "X blocos" ao hover.

**Estratégia de mitigação (progressiva):**

1. **Fase 04 (agora):** Monitorar métricas + warnings visuais. Sem virtualização.
2. **Fase 05:** Avaliar lazy rendering de blocos fora do viewport (IntersectionObserver). Blocos pesados (Image, PDF, Code) renderizam placeholder quando fora da view.
3. **Futuro:** Se necessário, virtualização completa de blocos (react-virtuoso ou similar). Requer mudanças no scroll handling do TipTap — avaliar viabilidade.

**Nota:** A virtualização de blocos TipTap é complexa porque o ProseMirror precisa de todos os nós no DOM para manter o schema consistente. A abordagem mais viável é "collapse blocks" — colapsar blocos distantes do cursor em placeholders leves, re-expandindo ao scroll.

---

## Definition of Done

- [ ] TipTap integrado e renderizando dentro de `<PageView />`
- [ ] Título editável com auto-save
- [ ] Blocos básicos funcionando: heading, paragraph, list, blockquote, divider
- [ ] Formatação inline: bold, italic, underline, strikethrough, code, link
- [ ] Floating toolbar aparece ao selecionar texto
- [ ] Slash commands funcionando com filtro
- [ ] Auto-save com debounce e indicador no status bar
- [ ] Undo/Redo funcionando
- [ ] Placeholder text em blocos vazios
- [ ] Serialização bidirecional TipTap ↔ `.opn.json`
- [ ] Atalhos de teclado do editor implementados
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Testes E2E dos fluxos críticos passando
- [ ] CI verde
