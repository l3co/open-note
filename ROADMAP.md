# Open Note — Roadmap

## Visão

Aplicação desktop **local-first** para anotações, inspirada no Microsoft OneNote, com suporte a:

- Edição rich text (blocos estruturados, como Notion)
- Modo Markdown nativo
- Handwriting / desenho livre (ink) como **camada de anotação** sobre o conteúdo (Overlay) + blocos dedicados
- Importação e anotação de **documentos PDF**
- Sincronização com provedores de nuvem (Google Drive, OneDrive, Dropbox)

Formato aberto, dados do usuário no filesystem local, sem lock-in.

---

## Princípios do Produto

| Princípio | Descrição |
|---|---|
| **Local-first** | Dados pertencem ao usuário. Ficam no filesystem. App funciona 100% offline. |
| **Formato aberto** | Arquivos legíveis (JSON/Markdown) — nunca formato proprietário. |
| **Extensível** | Arquitetura de blocos permite adicionar novos tipos sem reescrever o editor. |
| **Leve** | Binário pequeno (Tauri). Rápido para abrir, rápido para usar. |
| **Privacidade** | Sem telemetria. Sem conta obrigatória. Sync é opt-in. |

---

## Stack Técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Runtime** | Tauri v2 (desktop + mobile) | Binário leve, Rust nativo, compila para macOS/Win/Linux/Android/iOS |
| **Frontend** | React 18 + TypeScript | Ecossistema maduro para editores complexos |
| **Styling** | TailwindCSS + shadcn/ui | UI moderna, acessível, consistente |
| **Editor Rich Text** | TipTap (ProseMirror) | Extensível, suporta blocos custom, schema tipado |
| **Ink (Overlay + Block)** | Canvas API + perfect-freehand | Anotação sobre conteúdo + desenho dedicado, exportável para SVG |
| **PDF Rendering** | pdf.js (pdfjs-dist) | Renderização de PDF dentro da page, anotação via Ink Overlay |
| **Storage** | Rust (std::fs + serde) | Leitura/escrita rápida, tipagem forte |
| **Busca** | Tantivy | Full-text search local, alta performance |
| **Cloud Sync** | APIs nativas (OAuth2) | Controle fino sobre conflitos e delta sync |

---

## Modelo de Domínio

### Hierarquia

```
Workspace
 └── Notebook
      └── Section
           └── Page
                └── Block
```

### Tipos de Block

| Tipo | Descrição |
|---|---|
| `TextBlock` | Texto rico (headings, bold, italic, links, etc.) |
| `MarkdownBlock` | Conteúdo Markdown raw editável |
| `CodeBlock` | Bloco de código com syntax highlighting |
| `ChecklistBlock` | Lista de tarefas com checkboxes |
| `TableBlock` | Tabela editável |
| `ImageBlock` | Imagem (referência a asset local) |
| `InkBlock` | Desenho livre / handwriting dedicado (canvas isolado) |
| `PdfBlock` | Documento PDF renderizado (via pdf.js) |
| `DividerBlock` | Separador visual |
| `CalloutBlock` | Destaque / aviso |
| `EmbedBlock` | Conteúdo embarcado (vídeo, link preview) |

---

## Estrutura de Armazenamento

```
~/.opennote/                              # App global (fora de qualquer workspace)
  └── app_state.json                    # Workspaces recentes, settings globais (tema, idioma)

~/Documents/                              # Diretório pai selecionado pelo usuário
  └── meus-estudos/                      # Workspace root (subpasta criada via slugify(nome))
       ├── workspace.json                # Metadata + preferências do workspace
       ├── .trash/                       # Lixeira (soft-delete, retenção 30 dias)
       │    ├── trash_manifest.json
       │    └── {uuid}/                   # Itens deletados preservados
       ├── .opennote/                    # Dados derivados (index, cache)
       │    ├── index/                    # Tantivy index
       │    └── index_state.json
       └── meu-notebook/                 # Notebook (diretório)
            ├── notebook.json            # Metadata do notebook (nome, cor, ícone, ordem)
            ├── estudos/                 # Section (diretório)
            │    ├── section.json        # Metadata da section (nome, cor, ordem)
            │    ├── aula-01.opn.json    # Page (arquivo JSON estruturado)
            │    ├── aula-02.opn.json
            │    └── assets/             # Assets da section (imagens, PDFs importados)
            │         ├── a1b2c3d4.png   # Asset UUID-named (importado via import_asset)
            │         └── e5f6g7h8.pdf   # PDF importado (via import_pdf)
            └── projetos/                # Outra section
                 ├── section.json
                 └── ...
```

**Nota:** Ao criar workspace, o usuário seleciona um diretório pai e digita um nome. O backend cria automaticamente uma subpasta com `slugify(nome)` dentro do diretório selecionado (ex: "Meus Estudos" → `meus-estudos/`).

### Formato de Page (`.opn.json`)

```json
{
  "id": "uuid-v4",
  "title": "Aula 01 — Introdução",
  "created_at": "2026-03-07T12:00:00Z",
  "updated_at": "2026-03-07T14:30:00Z",
  "tags": ["estudo", "importante"],
  "blocks": [
    {
      "id": "block-uuid",
      "type": "text",
      "content": { "tiptap_json": { ... } },
      "order": 0
    },
    {
      "id": "block-uuid-2",
      "type": "pdf",
      "content": { "src": "assets/documento.pdf", "total_pages": 15 },
      "order": 1
    }
  ],
  "annotations": {
    "strokes": [
      {
        "id": "stroke-uuid",
        "points": [...],
        "color": "#ef4444",
        "tool": "pen",
        "anchor": { "blockId": "block-uuid", "offsetX": 150, "offsetY": 30 }
      }
    ],
    "highlights": [
      {
        "id": "hl-uuid",
        "blockId": "block-uuid",
        "startOffset": 45,
        "endOffset": 120,
        "color": "#eab308"
      }
    ],
    "svg_cache": "assets/annotations-page-uuid.svg"
  }
}
```

**Nota:** A page possui duas seções de dados:
- `blocks` — conteúdo estrutural (texto, imagens, PDFs, ink blocks)
- `annotations` — camada de anotação (strokes do Ink Overlay, highlights inteligentes)

**Conceitos transversais:**
- **AppState global** (`~/.opennote/app_state.json`) — workspaces recentes, settings globais (tema, idioma)
- **Lixeira** (`.trash/`) — soft-delete com retenção de 30 dias. Toda exclusão é reversível.
- **Asset lifecycle** — assets acompanham pages ao mover entre sections e ao soft-delete
- **Annotations órfãs** — ao deletar bloco, strokes são convertidos para coord. absoluta, highlights removidos
- **TypeScript bindings** — gerados automaticamente via `ts-rs` a partir de structs Rust. CI valida alinhamento.
- **SaveCoordinator** — Mutex por page_id no backend. Saves de blocks e annotations são serializados (read-modify-write) para evitar race conditions.
- **Tags** — strings livres por page, escopo workspace, autocomplete via scan (otimizado por Tantivy na Fase 08)
- **EditorPreferences** — modo de edição (RichText/Markdown) e split_view persistidos por page
- **PDF Text Layer** — pdf.js text layer para seleção/cópia de texto, integrado com Smart Highlighter e busca
- **Workspace Lock** — arquivo `.lock` com PID para prevenir acesso concorrente ao mesmo workspace
- **Page Limits** — soft limit (200 blocos) e hard limit (500 blocos) com warnings no status bar
- **Toast System** — `useToast()` hook transversal para feedback (success, error, warning, info)
- **Block types no JSON** — convenção `snake_case` via `serde(rename_all)` para todos os tipos
- **EmbedBlock offline** — cache de OG metadata no bloco JSON + assets locais para imagens/favicons
- **Sync annotations** — v1: gzip + debounce 30s. Futuro: split `.annotations.json` se necessário
- **Cloud-aware (local-first)** — UI exibe opção cloud desde o onboarding/WorkspacePicker (desabilitada até Fase 09). Migração local → cloud a qualquer momento via Settings. Desconectar nunca deleta dados.
- **Temas premium (3 camadas)** — Base theme (Light, Paper, Dark, System) + Accent color (10 paletas tipo Todoist) + Chrome tint (sidebar/toolbar coloridos). Visual premium e personalizável.

---

## Arquitetura de Alto Nível

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (WebView)                   │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Navigation │  │  Editor    │  │ Ink Overlay   │  │
│  │ (Sidebar)  │  │  (TipTap)  │  │ (Annotation)  │  │
│  └────────────┘  └────────────┘  └───────────────┘  │
│                  ┌────────────────────────────────┐   │
│                  │  InkBlock / PdfBlock (canvas)  │   │
│                  └────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐ │
│  │         State Management (Zustand)              │ │
│  └─────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│               Tauri IPC Bridge                       │
│         (comandos tipados Rust ↔ TS)                 │
├──────────────────────────────────────────────────────┤
│                  Backend (Rust)                       │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Storage  │  │  Search  │  │   Sync Engine     │ │
│  │ Manager  │  │  Index   │  │  (Cloud Providers) │ │
│  └──────────┘  └──────────┘  └────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │          Domain Layer (entities, rules)          ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
         │                              │
    Local Filesystem               Cloud APIs
    (~/OpenNote/)            (GDrive/OneDrive/Dropbox)
```

---

## Fases do Projeto

| Fase | Nome | Descrição | Dependências |
|------|------|-----------|-------------|
| 01 | **Fundação** | Scaffold Tauri + React, estrutura do projeto, CI, tooling | — |
| 02 | **Modelo de Domínio & Storage** | Entidades, formato de arquivo, CRUD, lixeira, assets, ts-rs bindings | Fase 01 |
| 03 | **UI Shell & Navegação** | Workspace Picker (local + cloud-aware), layout principal, sidebar, navegação, lixeira, toasts | Fase 01, 02 |
| 04 | **Editor Rich Text** | Integração TipTap, blocos básicos (text, heading, lista) | Fase 03 |
| 05 | **Blocos Avançados** | Code, tabela, checklist, imagem, callout, divider, embed, asset lifecycle | Fase 04 |
| 06 | **Modo Markdown** | Toggle Markdown/Rich text, import/export `.md`, roadmap de export futuro (PDF/HTML) | Fase 04 |
| 07 | **Handwriting, Ink & Anotação** | Ink Overlay (anotação sobre conteúdo), InkBlock (desenho), PdfBlock, pressure sensitivity | Fase 04, 05 |
| 08 | **Busca & Indexação** | Full-text search com Tantivy, indexação incremental | Fase 02 |
| 09 | **Cloud Sync** | Migração local→cloud, Google Drive, OneDrive, Dropbox, conflict resolution | Fase 02 |
| 10 | **Distribuição & Polish** | Auto-update, packaging multi-OS, settings, temas, performance | Fase 01–09 |

### Grafo de Dependências

```
Fase 01 (Fundação)
  ├── Fase 02 (Domínio & Storage)
  │    ├── Fase 03 (UI Shell) ──→ Fase 04 (Editor) ──┬── Fase 05 (Blocos Avançados)
  │    │                                              ├── Fase 06 (Markdown)
  │    │                                              └── Fase 07 (Ink & Anotação & PDF)
  │    │                                                   ├── 07a: Ink Engine Core
  │    │                                                   ├── 07b: Ink Block
  │    │                                                   ├── 07c: Ink Overlay
  │    │                                                   └── 07d: PDF Block
  │    ├── Fase 08 (Busca)
  │    └── Fase 09 (Cloud Sync)
  └── Fase 10 (Distribuição) ← depende de todas
```

---

## Riscos Identificados

| Risco | Impacto | Mitigação |
|---|---|---|
| Complexidade do editor TipTap | Alto | Investir tempo no estudo da API ProseMirror. Prototipar antes. |
| Performance com páginas grandes (muitos blocos) | Médio | Virtualização de blocos. Lazy loading. |
| Ink Overlay: latência no WebView | Alto | Two-layer canvas, OffscreenCanvas. Avaliar WebGL se necessário. |
| Ancoragem de strokes a blocos DOM | Alto | Testes extensivos. Fallback para coordenadas absolutas. |
| pdf.js bundle size (~1.5MB) | Médio | Lazy loading — carregar apenas quando PdfBlock existir na page. |
| Conflict resolution no sync | Alto | Usar CRDTs ou estratégia last-write-wins com histórico. |
| Formato de arquivo (.opn.json) precisa ser estável | Alto | Versionamento de schema desde a Fase 02. Migrations. |
| Tauri v2 ainda em evolução | Médio | Acompanhar releases. Manter abstração sobre o IPC. |
| Assets desincronizados ao mover pages | Alto | `move_page` sempre move assets junto. Trait unificada no StorageEngine. |
| Annotations órfãs ao deletar blocos | Médio | Dialog de confirmação. Strokes → coord. absoluta. Highlights → removidos. |
| Acesso concorrente ao workspace | Médio | `.lock` file com PID. Detecção de stale lock. |
| Pages muito grandes (500+ blocos) | Médio | Soft/hard limits com warnings. Lazy rendering progressivo. |

---

## Critérios de Qualidade (todas as fases)

**Testes (detalhado na Fase 01):**
- Unit tests: domínio (`crates/core` — 90%), storage, componentes, hooks
- Integração: StorageEngine com filesystem real, stores + IPC mock
- Snapshot: serialização JSON estável via `insta`
- Contrato: ts-rs valida TypeScript ↔ Rust no CI
- E2E: Playwright para fluxos críticos
- Coverage enforced: **PR bloqueado se cair abaixo do threshold (80%+)**

**Ferramentas:** cargo-tarpaulin, Vitest, Testing Library, MSW, Playwright

**Qualidade geral:**
- CI/CD desde a Fase 01 (lint + test + coverage + build)
- Documentação de decisões arquiteturais (ADRs)
- Acessibilidade (a11y) no frontend — WCAG AA
- i18n preparado desde o início (PT-BR + EN)

**Estrutura:** Cargo workspace com crates compartilhados. Domínio em `crates/`, Tauri como camada fina de IPC. Multi-platform via Tauri v2 (desktop v1, mobile futuro).

---

## Documentos Complementares

| Documento | Conteúdo |
|---|---|
| `docs/FASE_01.md` | Detalhamento da Fase 01 — Fundação |
| `docs/FASE_02.md` | Detalhamento da Fase 02 — Domínio & Storage |
| `docs/FASE_03.md` | Detalhamento da Fase 03 — UI Shell & Navegação |
| `docs/FASE_04.md` | Detalhamento da Fase 04 — Editor Rich Text |
| `docs/FASE_05.md` | Detalhamento da Fase 05 — Blocos Avançados |
| `docs/FASE_06.md` | Detalhamento da Fase 06 — Modo Markdown |
| `docs/FASE_07.md` | Detalhamento da Fase 07 — Handwriting, Ink & Anotação (Overlay + Block + PDF) |
| `docs/FASE_08.md` | Detalhamento da Fase 08 — Busca & Indexação |
| `docs/FASE_09.md` | Detalhamento da Fase 09 — Cloud Sync |
| `docs/FASE_10.md` | Detalhamento da Fase 10 — Distribuição & Polish |
