# Documentação — Open Note

Hub central da documentação do projeto. Use este índice para navegar para o documento adequado.

---

## Visão Geral do Projeto

O **Open Note** é uma aplicação desktop **local-first** para anotações, inspirada no Microsoft OneNote. Dados no filesystem local, formato aberto (JSON), sem telemetria, sem conta obrigatória. Construído com Tauri v2 (Rust) + React + TypeScript.

- **Repositório:** [github.com/l3co/open-note](https://github.com/l3co/open-note)
- **Licença:** MIT
- **Stack:** Tauri v2 · React 19 · TypeScript · Rust · TailwindCSS · TipTap · Tantivy · Zustand

---

## Índice da Documentação

### Design & Arquitetura

| Documento | Descrição |
|---|---|
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Design do sistema — visão, princípios, modelos de concorrência, persistência, busca, sync e segurança |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagramas Mermaid — C4 (contexto, containers, componentes), ER, estados, sequência |
| [DATA_MODEL.md](./DATA_MODEL.md) | Modelo de dados — entidades, block types, schemas JSON, TypeScript bindings |
| [GLOSSARY.md](./GLOSSARY.md) | Glossário DDD — linguagem ubíqua do projeto |

### API & Referência

| Documento | Descrição |
|---|---|
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Referência completa dos 46 IPC commands (Rust ↔ TypeScript) |

### Desenvolvimento

| Documento | Descrição |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup, fluxo diário, estrutura, convenções, guias (novo IPC, novo block, nova tradução) |
| [TESTING.md](./TESTING.md) | Pirâmide de testes, coverage targets, Vitest, Playwright, CI |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build dev/produção, CI/CD, release flow, code signing |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Problemas comuns e soluções |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Guia de contribuição (workflow, commits, PR checklist) |

### Architecture Decision Records (ADRs)

Decisões arquiteturais registradas formalmente:

| ADR | Decisão | Status |
|---|---|---|
| [001 — Tauri v2](./adr/001-tauri-v2.md) | Tauri v2 como runtime desktop | Aceito |
| [002 — Cargo Workspace](./adr/002-cargo-workspace.md) | Cargo workspace com crates por bounded context | Aceito |
| [003 — TipTap Editor](./adr/003-tiptap-editor.md) | TipTap v3 como editor rich text | Aceito |
| [004 — Tantivy Search](./adr/004-tantivy-search.md) | Tantivy como engine de busca local | Aceito |
| [005 — Zustand State](./adr/005-zustand-state.md) | Zustand como state management | Aceito |
| [006 — Theme System](./adr/006-theme-system.md) | Sistema de temas com 3 camadas | Aceito |
| [007 — Local-First](./adr/007-local-first.md) | Estratégia local-first cloud-aware | Aceito |
| [008 — Ink Hybrid](./adr/008-ink-hybrid.md) | Ink híbrido (Overlay + Block) | Aceito |
| [009 — i18n Strategy](./adr/009-i18n-strategy.md) | react-i18next para internacionalização | Aceito |

### Fases do Projeto

Documentação de especificação por fase:

| Fase | Tema | Arquivo |
|---|---|---|
| 01 | Fundação (scaffold, tooling, CI) | [FASE_01.md](./FASE_01.md) |
| 02 | Modelo de Domínio & Storage Local | [FASE_02.md](./FASE_02.md) |
| 03 | UI Shell & Navegação | [FASE_03.md](./FASE_03.md) |
| 04 | Rich Text Editor (TipTap) | [FASE_04.md](./FASE_04.md) |
| 05 | Blocos Avançados | [FASE_05.md](./FASE_05.md) |
| 06 | Export & Import | [FASE_06.md](./FASE_06.md) |
| 07 | Ink & PDF | [FASE_07.md](./FASE_07.md) |
| 08 | Busca Full-Text | [FASE_08.md](./FASE_08.md) |
| 09 | Cloud Sync | [FASE_09.md](./FASE_09.md) |
| 10 | Settings, Onboarding & Polish | [FASE_10.md](./FASE_10.md) |

### Outros

| Documento | Descrição |
|---|---|
| [ROADMAP.md](../ROADMAP.md) | Visão, princípios, fases, riscos, critérios de qualidade |
| [README.md](../README.md) | Visão geral do projeto (raiz) |

---

## Quick Links para Desenvolvedores

### Primeiros passos
1. [Pré-requisitos](./DEVELOPMENT.md#1-pré-requisitos)
2. [Setup inicial](./DEVELOPMENT.md#2-setup-inicial)
3. [Fluxo diário](./DEVELOPMENT.md#3-fluxo-de-desenvolvimento-diário)

### Referência rápida

| Preciso... | Onde encontrar |
|---|---|
| Entender o domínio | [GLOSSARY.md](./GLOSSARY.md) |
| Ver a arquitetura | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Criar um IPC command | [DEVELOPMENT.md § 6](./DEVELOPMENT.md#6-como-adicionar-um-novo-ipc-command) |
| Criar um novo block type | [DEVELOPMENT.md § 7](./DEVELOPMENT.md#7-como-adicionar-um-novo-tipo-de-block) |
| Adicionar tradução | [DEVELOPMENT.md § 8](./DEVELOPMENT.md#8-como-adicionar-uma-nova-tradução) |
| Rodar testes | [TESTING.md](./TESTING.md) |
| Debugar um problema | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Entender uma decisão | [ADRs](./adr/) |
| Consultar um IPC command | [IPC_REFERENCE.md](./IPC_REFERENCE.md) |
| Ver o formato de dados | [DATA_MODEL.md](./DATA_MODEL.md) |
| Fazer build de produção | [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) |
| Contribuir | [CONTRIBUTING.md](../CONTRIBUTING.md) |
