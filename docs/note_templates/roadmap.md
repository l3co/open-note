# Note Templates — Roadmap

## Visão Geral

Templates de notas permitem que o usuário crie novas páginas a partir de estruturas pré-definidas, acelerando workflows repetitivos. A funcionalidade é inspirada no Evernote Templates: um catálogo com templates embutidos (organizados por categoria) e a possibilidade de salvar qualquer página existente como template reutilizável.

O fluxo principal é:
1. Ao criar uma página, o usuário pode escolher "Usar template" → abre o seletor
2. O seletor exibe templates embutidos (agrupados: Reunião, Diário, Estudo, Projeto, etc.) e os templates criados pelo usuário
3. Selecionado, a nova página herda título-template, tags, blocks e `editor_preferences` do template
4. Qualquer página existente pode ser salva como template via menu de contexto

---

## Estado Atual

### Arquitetura Existente

```
Page  { id, section_id, title, tags, blocks[], annotations, editor_preferences, ... }
  └── criada via IPC create_page(section_id, title) → Page::new() → opn.json vazio

FsStorageEngine::create_page_from(workspace_root, section_id, page: Page)
  └── JÁ EXISTE — recebe uma Page completa e persiste; é o primitivo ideal para "apply template"

src-tauri/commands/page.rs
  └── create_page → create_page_internal → FsStorageEngine::create_page
  └── NÃO há nenhum comando de template ainda

EditorMode: RichText | Markdown | PdfCanvas | Canvas
  └── templates se aplicam a RichText e Markdown (Canvas e PdfCanvas têm fluxos próprios)
```

### Pontos de Acoplamento Identificados

| Camada | Arquivo | Acoplamento |
|--------|---------|-------------|
| Domínio | `crates/core/src/page.rs` | `Page`, `Block`, `EditorPreferences`, `EditorMode` |
| Domínio | `crates/core/src/id.rs` | Precisa de `TemplateId` newtype |
| Storage | `crates/storage/src/engine.rs` | `create_page_from` já existe; adicionar CRUD de templates |
| IPC | `src-tauri/src/commands/page.rs` | Adicionar `create_page_from_template` |
| IPC | `src-tauri/src/commands/mod.rs` | Registrar módulo `template` |
| IPC | `src-tauri/src/lib.rs` | Registrar handlers novos no `invoke_handler` |
| Frontend | `src/lib/ipc.ts` | Wrappers TypeScript para os novos commands |
| Frontend | `src/components/sidebar/NotebookTree.tsx` | Menu de contexto de page: "Salvar como template" |
| Frontend | `src/locales/pt-BR.json` e `en.json` | Strings i18n |

---

## Avaliação de Complexidade

### Classificação: 🟡 MÉDIA (Score: 5/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Nova entidade de domínio (`NoteTemplate`) | Baixo — segue exatamente o padrão existente de `Page` | 1/5 |
| Storage (`.templates/` no workspace) | Baixo — `FsStorageEngine` tem o padrão bem estabelecido | 1/5 |
| Templates embutidos (built-ins) | Médio — definição estática em Rust, mas requer curadoria de conteúdo | 2/5 |
| UI (gallery modal, preview, gestão) | Médio-alto — componente novo com mais estados visuais | 3/5 |
| Placeholders dinâmicos no título (ex: `{{date}}`) | Baixo — string replace simples no apply | 1/5 |
| Compatibilidade com `create_page_from` existente | Muito baixo — primitivo já existe | 0/5 |
| Testes (unit Rust + Vitest + E2E) | Médio | 2/5 |

**Estimativa de esforço total: ~18–22 horas de desenvolvimento**

### Riscos Principais

1. **Templates com assets (imagens):** Blocos `ImageBlock` referenciam caminhos relativos a uma section específica. Templates com imagens precisam copiar os assets, ou limitar templates a blocos sem imagens na v1.
2. **Templates entre workspaces:** Na v1, templates são por workspace. Exportar/importar templates entre workspaces fica fora do escopo.
3. **Edição de templates:** Templates de usuário são persistidos como arquivos; editar um template não afeta páginas já criadas a partir dele (comportamento esperado, mas deve ser documentado).

---

## Estratégia de Implementação

### Princípio: Incremental, Backward Compatible

Cada fase pode ser merged em `main` sem quebrar funcionalidade existente. A v1 não suporta templates com `ImageBlock` (restrição explícita). Templates embutidos são definidos como dados estáticos em Rust.

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| 1 | **Domínio + Storage + IPC** — entidade, persistência e commands | ~8h | 🔴 Crítica | — |
| 2 | **Templates Embutidos + Apply** — built-ins, placeholders, criação a partir de template | ~5h | 🔴 Crítica | Fase 1 |
| 3 | **UI — Seletor e Gestão** — modal de seleção, menu de contexto, gerenciador | ~8h | 🟡 Alta | Fase 2 |

---

## Modelo de Domínio Proposto

### Antes
```
create_page(section_id, title) → Page::new() vazia
  └── sem templates, sem estrutura pré-definida
```

### Depois
```
NoteTemplate {
  id: TemplateId,
  name: String,
  description: Option<String>,
  category: TemplateCategory,   // meeting | journal | project | study | custom
  icon: Option<String>,         // emoji
  title_template: String,       // "Reunião {{date}}" ou "Diário {{date}}"
  tags: Vec<String>,
  blocks: Vec<Block>,
  editor_preferences: EditorPreferences,
  is_builtin: bool,
  created_at: DateTime<Utc>,
  updated_at: DateTime<Utc>,
  schema_version: u32,
}

TemplateSummary {
  id: TemplateId,
  name: String,
  description: Option<String>,
  category: TemplateCategory,
  icon: Option<String>,
  title_template: String,
  is_builtin: bool,
  block_count: usize,
  created_at: DateTime<Utc>,
}

Fluxo:
  create_page_from_template(section_id, template_id, custom_title?) → Page
    └── FsStorageEngine::load_template() ou builtin_templates()
    └── resolve_title_template(title_template, placeholders)
    └── Page::new_from_template(section_id, resolved_title, template.blocks, template.tags, template.editor_preferences)
    └── FsStorageEngine::create_page_from(workspace_root, section_id, page)
```

---

## Critérios de Aceitação (Definição de Done)

- [ ] `NoteTemplate` e `TemplateSummary` definidos em `crates/core/src/template.rs` com `#[derive(TS)]`
- [ ] `TemplateId` adicionado em `crates/core/src/id.rs`
- [ ] Templates de usuário persistidos em `{workspace_root}/.templates/{slug}.tpl.json`
- [ ] Templates embutidos disponíveis sem arquivo (definição estática): Reunião, Diário, Projeto, Estudo, Vazio
- [ ] IPC commands: `list_templates`, `create_template_from_page`, `delete_template`, `create_page_from_template`
- [ ] Placeholder `{{date}}` substituído pela data atual ao aplicar template
- [ ] Modal `TemplatePickerModal` com busca, filtro por categoria e preview de blocos
- [ ] Menu de contexto de page inclui "Salvar como template"
- [ ] Menu de criação de page inclui "Usar template"
- [ ] Templates com `ImageBlock` são rejeitados na v1 com erro explícito
- [ ] i18n completo (pt-BR e en)
- [ ] `cargo test --workspace` passa
- [ ] `npm run typecheck` sem erros
- [ ] Testes unitários Rust (≥ 90% coverage nas funções novas)
- [ ] Testes de componente Vitest para `TemplatePickerModal`
- [ ] Todos os testes existentes continuam passando

---

## Referências

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/IPC_REFERENCE.md`
- `crates/core/src/page.rs` — modelo de Page (base para NoteTemplate)
- `crates/core/src/id.rs` — padrão de Newtype IDs
- `crates/storage/src/engine.rs` — `create_page_from` (primitivo reutilizável)
- `src-tauri/src/commands/page.rs` — padrão de IPC commands existentes
- `src/lib/ipc.ts` — wrappers TypeScript existentes
