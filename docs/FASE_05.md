# Fase 05 — Blocos Avançados

## Objetivo

Expandir o editor com **blocos de conteúdo avançados**: código com syntax highlighting, tabelas editáveis, checklists, imagens, callouts, embeds e dividers. Ao final desta fase, o editor cobre todos os tipos de bloco estruturado.

**Nota:** InkBlock, PdfBlock e o Ink Overlay são tratados na **Fase 07** (Handwriting, Ink & Anotação), que depende desta fase.

---

## Dependências

- Fase 04 concluída (editor TipTap com blocos básicos)

---

## Entregáveis

1. CodeBlock — bloco de código com syntax highlighting e seleção de linguagem
2. TableBlock — tabela editável (adicionar/remover linhas e colunas)
3. ChecklistBlock — lista de tarefas com checkboxes
4. ImageBlock — inserção de imagem (local file, paste, drag & drop)
5. CalloutBlock — bloco de destaque (info, warning, error, success)
6. EmbedBlock — embed de URL (YouTube, links com preview)
7. DividerBlock — separador visual (já iniciado na Fase 04, polir)
8. Drag & drop de blocos para reordenar
9. Slash commands atualizados com todos os novos tipos
10. Conversão entre tipos de bloco (quando aplicável)

---

## Blocos Detalhados

### CodeBlock

Bloco de código com syntax highlighting.

**Aparência:**
```
┌─────────────────────────────────────┐
│ [JavaScript ▾]            [Copiar]  │
├─────────────────────────────────────┤
│ function hello() {                  │
│   console.log("world");            │
│ }                                   │
└─────────────────────────────────────┘
```

**Funcionalidades:**
- Dropdown de linguagem (JavaScript, TypeScript, Python, Rust, Go, Java, C#, HTML, CSS, SQL, JSON, YAML, Markdown, Bash, Plain Text)
- Syntax highlighting via `lowlight` (baseado em highlight.js, compatível com TipTap)
- Botão de copiar código
- Tab → insere 2 espaços (não move foco)
- Shift+Enter → nova linha dentro do bloco
- Enter em linha vazia no final → sai do code block
- Preservação de indentação

**Extension TipTap:**
- `@tiptap/extension-code-block-lowlight`

**Formato no `.opn.json`:**
```json
{
  "type": "code",
  "attrs": { "language": "javascript" },
  "content": [{ "type": "text", "text": "function hello() {\n  console.log(\"world\");\n}" }]
}
```

---

### TableBlock

Tabela editável com operações de linha/coluna.

**Aparência:**
```
┌──────────┬──────────┬──────────┐
│ Header 1 │ Header 2 │ Header 3 │
├──────────┼──────────┼──────────┤
│ Cell 1   │ Cell 2   │ Cell 3   │
├──────────┼──────────┼──────────┤
│ Cell 4   │ Cell 5   │ Cell 6   │
└──────────┴──────────┴──────────┘
     [+ Linha]  [+ Coluna]
```

**Funcionalidades:**
- Criar tabela com dimensões iniciais (padrão 3x3)
- Adicionar/remover linhas e colunas
- Header row (primeira linha com estilo diferente)
- Tab → próxima célula, Shift+Tab → célula anterior
- Merge cells (futuro — não nesta fase)
- Redimensionar colunas via drag na borda
- Context menu na célula: inserir/remover linha/coluna, toggle header

**Extensions TipTap:**
- `@tiptap/extension-table`
- `@tiptap/extension-table-row`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-table-header`

**Formato no `.opn.json`:**
```json
{
  "type": "table",
  "content": [
    {
      "type": "tableRow",
      "content": [
        { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Header 1" }] }] },
        { "type": "tableHeader", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Header 2" }] }] }
      ]
    },
    {
      "type": "tableRow",
      "content": [
        { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Cell 1" }] }] },
        { "type": "tableCell", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Cell 2" }] }] }
      ]
    }
  ]
}
```

---

### ChecklistBlock

Lista de tarefas com checkboxes interativos.

**Aparência:**
```
☑ Tarefa concluída (texto riscado)
☐ Tarefa pendente
☐ Outra tarefa
```

**Funcionalidades:**
- Click no checkbox → toggle estado
- Texto riscado + opacidade reduzida quando checked
- Enter → novo item de checklist
- Backspace em item vazio → remover item
- Drag para reordenar itens
- Indentação com Tab (sub-itens)

**Extension TipTap:**
- `@tiptap/extension-task-list`
- `@tiptap/extension-task-item`

---

### ImageBlock

Bloco de imagem com suporte a inserção por múltiplos meios.

**Aparência:**
```
┌─────────────────────────────────────┐
│                                     │
│          [imagem renderizada]       │
│                                     │
├─────────────────────────────────────┤
│  Legenda opcional (editável)        │
└─────────────────────────────────────┘
```

**Meios de inserção:**
1. Slash command `/image` → abre file picker nativo (Tauri `dialog::open`)
2. Drag & drop de arquivo de imagem na área do editor
3. Paste de imagem do clipboard (`Cmd+V`)
4. Paste de URL de imagem

**Fluxo de armazenamento (✅ implementado):**

```
1. Usuário digita /image → abre file picker nativo (Tauri dialog::open)
2. Frontend obtém sectionId do useNavigationStore
3. Frontend chama importAsset(sectionId, filePath) via IPC
4. Rust copia arquivo para {section}/assets/{uuid}.{ext}
5. Retorna asset_path (relativo) + absolute_path (absoluto)
6. Frontend chama readAssetBase64(absolutePath) via IPC
7. Rust lê o arquivo e retorna data:image/{mime};base64,{encoded}
8. Frontend exibe imagem via base64 data URL no <img> tag
9. JSON armazena referência relativa
```

**Nota sobre exibição:** O `convertFileSrc` do Tauri (asset protocol) tem restrições de scope que impedem servir arquivos de diretórios arbitrários. A solução adotada é ler o arquivo como base64 via IPC (`read_asset_base64`), que funciona independentemente de configuração de scope.

**Formatos suportados:** PNG, JPEG, GIF, WebP, SVG

**Funcionalidades:**
- Redimensionar imagem via handles nos cantos
- Legenda (caption) editável abaixo da imagem
- Alt text para acessibilidade
- Click → seleciona o bloco (borda de seleção)
- Delete com bloco selecionado → remove imagem

**Formato no `.opn.json`:**
```json
{
  "type": "image",
  "attrs": {
    "src": "assets/img-abc123.png",
    "alt": "Diagrama de arquitetura",
    "title": "Figura 1",
    "width": 600,
    "height": null
  }
}
```

**Comando IPC:** Usar os comandos centralizados de assets definidos na Fase 02 (`import_asset`, `import_asset_from_bytes`, `delete_asset`).

---

### CalloutBlock

Bloco de destaque para informações importantes.

**Aparência:**
```
┌─ ℹ️ ──────────────────────────────┐
│  Este é um bloco de informação.   │
│  Pode conter múltiplas linhas.    │
└───────────────────────────────────┘
```

**Variantes:**

| Variante | Ícone | Cor de fundo |
|---|---|---|
| Info | ℹ️ | Azul claro |
| Warning | ⚠️ | Amarelo claro |
| Error | ❌ | Vermelho claro |
| Success | ✅ | Verde claro |
| Tip | 💡 | Roxo claro |

**Funcionalidades:**
- Click no ícone → dropdown para trocar variante
- Conteúdo editável dentro do callout (rich text)
- Enter → nova linha dentro do callout
- Backspace no início vazio → converter de volta para parágrafo

**Implementação:** Custom TipTap node extension.

**Formato no `.opn.json`:**
```json
{
  "type": "callout",
  "attrs": { "variant": "info" },
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Informação importante" }] }
  ]
}
```

---

### EmbedBlock

Bloco para conteúdo embarcado de URLs externas.

**Aparência (YouTube):**
```
┌─────────────────────────────────────┐
│                                     │
│    [Player de vídeo embarcado]      │
│                                     │
├─────────────────────────────────────┤
│  youtube.com • Título do vídeo      │
└─────────────────────────────────────┘
```

**Aparência (link genérico):**
```
┌─────────────────────────────────────┐
│ 🔗 Título da Página                │
│ Descrição extraída do meta...      │
│ example.com                         │
└─────────────────────────────────────┘
```

**Suporte inicial:**
- YouTube → iframe embed
- Links genéricos → Open Graph preview card (título, descrição, imagem)

**Fluxo:**
1. Slash command `/embed` ou paste de URL
2. Detectar tipo de URL (YouTube? Link genérico?)
3. Para YouTube: extrair video ID, gerar iframe
4. Para links: fetch Open Graph tags via Rust (HTTP request) para montar preview

**Comportamento offline / fallback:**

O app é local-first e funciona 100% offline. EmbedBlocks dependem de rede para fetch de OG tags e renderização de iframes.

| Situação | Comportamento |
|---|---|
| Criar embed **online** | Fetch OG tags → cache metadata no bloco JSON. Iframe carrega normalmente. |
| Criar embed **offline** | Exibir card simplificado: URL clicável + ícone de link. Metadata vazio. Badge "Sem preview — conecte à internet para carregar". |
| Abrir embed **offline** (já cacheado) | Exibir card com metadata cacheada (título, descrição). Iframe do YouTube não carrega → placeholder "Vídeo indisponível offline". |
| Abrir embed **offline** (sem cache) | Card simplificado com URL apenas. |

**Cache de metadata no JSON:**

```json
{
  "type": "embed",
  "attrs": {
    "url": "https://example.com/article",
    "embed_type": "link",
    "cached_metadata": {
      "title": "Título da Página",
      "description": "Descrição extraída...",
      "image": "assets/og-img-uuid.png",
      "favicon": "assets/favicon-uuid.ico",
      "fetched_at": "2026-03-07T14:00:00Z"
    }
  }
}
```

**Regras de cache:**
- Imagem OG e favicon são baixados e salvos em `{section}/assets/` (referência local)
- Metadata é refreshed ao clicar "Atualizar preview" (manual, nunca automático)
- Se o fetch falhar (timeout, 404), manter cache anterior + exibir badge de erro

**Segurança:**
- iframes apenas para domínios allowlisted (youtube.com, vimeo.com)
- CSP do Tauri precisa permitir iframes para esses domínios
- Fetch de OG tags acontece no Rust (não no frontend — CORS)

**Comando IPC:**

| Comando | Input | Output |
|---|---|---|
| `fetch_url_metadata` | `url: String` | `{ title, description, image, favicon }` |

---

## Asset Lifecycle

Assets (imagens, PDFs, SVGs de ink) ficam em `{section}/assets/`. É crítico que o ciclo de vida dos assets seja gerenciado corretamente.

### Move Page entre Sections

Ao mover uma page da Section A para a Section B:

```
1. Identificar todos os assets referenciados pela page (blocks + annotations)
2. Copiar assets de {section_a}/assets/ para {section_b}/assets/
3. Atualizar referências relativas nos blocos da page (src: "assets/img-xxx.png" não muda pois é relativo à section)
4. Mover o arquivo .opn.json
5. Remover assets antigos de {section_a}/assets/ (se nenhuma outra page os referencia)
```

**Regra:** `move_page` no backend (Rust) **sempre** invoca `move_assets_with_page` internamente. O frontend não precisa gerenciar assets manualmente.

### Delete Page

Ao deletar (soft-delete) uma page:
- Assets **acompanham** a page para `.trash/`
- Se a page for restaurada, assets voltam para `{section}/assets/`
- Se o trash expirar, assets são deletados permanentemente

### Delete Section/Notebook

Soft-delete move o diretório inteiro (incluindo `assets/`) para `.trash/`.

### Assets Órfãos

Arquivos em `{section}/assets/` que não são referenciados por nenhuma page. Podem surgir por bugs ou edits manuais.

**Estratégia:** Comando `cleanup_orphan_assets` (futuro, Fase 10) que escaneia assets não referenciados e oferece deleção.

---

## Drag & Drop de Blocos

### Comportamento

- Cada bloco exibe um handle de drag (`⠿`) ao hover no lado esquerdo
- Arrastar o handle → bloco entra em estado "dragging" (visual: opacidade reduzida, borda tracejada)
- Drop zone entre blocos (linha azul indicando posição)
- Soltar → reordenar no JSON e re-renderizar
- Animação suave de reposicionamento

### Implementação

- Usar `@tiptap/extension-draggable` ou implementação custom com `prosemirror-dropcursor`
- Plugin ProseMirror para gerenciar o drag state

---

## Slash Commands Atualizados

| Comando | Ícone | Descrição | Fase |
|---|---|---|---|
| Heading 1 | `H1` | Título grande | 04 |
| Heading 2 | `H2` | Subtítulo | 04 |
| Heading 3 | `H3` | Subtítulo menor | 04 |
| Bullet List | `•` | Lista com marcadores | 04 |
| Numbered List | `1.` | Lista numerada | 04 |
| Checklist | `☑` | Lista de tarefas | **05** |
| Blockquote | `"` | Citação | 04 |
| Code | `</>` | Bloco de código | **05** |
| Table | `⊞` | Tabela | **05** |
| Image | `🖼` | Imagem | **05** |
| Callout | `ℹ` | Bloco de destaque | **05** |
| Embed | `🔗` | Conteúdo embarcado | **05** |
| Divider | `—` | Linha separadora | 04 |

Comandos agrupados por categoria no menu:
- **Texto**: Heading 1–3, Bullet List, Numbered List, Checklist, Blockquote
- **Mídia**: Image, Embed
- **Estrutura**: Code, Table, Callout, Divider

---

## Testes

### Unitários

- CodeBlock: linguagem default, troca de linguagem, preservação de indentação
- TableBlock: criar 3x3, adicionar linha, remover coluna, toggle header
- ChecklistBlock: toggle checkbox, novo item, remover item
- ImageBlock: import path, resize, delete asset
- CalloutBlock: variantes, troca de variante
- EmbedBlock: detecção de YouTube, fallback para link genérico
- Drag & drop: reorder blocos, atualização de order no JSON

### Integração

- Inserir cada tipo de bloco via slash command → salvar → reabrir → bloco preservado
- Importar imagem → verificar que asset foi copiado para diretório correto
- Deletar page com imagens → verificar que assets são removidos
- Fetch URL metadata → verificar retorno de OG tags

### E2E

- Criar page → inserir código JavaScript → copiar → verificar texto copiado
- Criar tabela 3x3 → editar células → adicionar linha → salvar → reabrir
- Criar checklist → marcar itens → salvar → reabrir → estado preservado
- Drag & drop imagem na page → imagem renderizada → redimensionar
- Inserir URL do YouTube → embed renderizado
- Drag & drop bloco para reordenar → ordem preservada após save

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Performance com muitas imagens | Médio | Lazy loading, thumbnail para preview |
| Tabelas grandes (muitas células) | Médio | Limitar tamanho máximo inicial (20x20) |
| Fetch de URL metadata bloqueado (CORS/timeout) | Baixo | Timeout de 5s, fallback para URL simples |
| CSP do Tauri bloqueando iframes | Médio | Configurar CSP corretamente na Fase 01 |
| Drag & drop com TipTap pode ter bugs | Médio | Testar extensivamente, fallback para reorder manual |

---

## Definition of Done

- [ ] CodeBlock com syntax highlighting e seleção de linguagem
- [ ] TableBlock editável (CRUD de linhas/colunas, header)
- [ ] ChecklistBlock com toggle e indentação
- [x] ImageBlock (file picker via slash command `/image` — ✅ importa asset + exibe via base64 data URL)
- [ ] CalloutBlock com variantes
- [ ] EmbedBlock (YouTube iframe, link preview)
- [ ] DividerBlock polido
- [ ] Drag & drop de blocos para reordenar
- [x] Slash commands atualizados com todos os blocos
- [x] Assets armazenados em `{section}/assets/`
- [ ] Cleanup de assets ao deletar page
- [ ] Todos os blocos serializam/deserializam corretamente
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Testes E2E passando
- [ ] CI verde
