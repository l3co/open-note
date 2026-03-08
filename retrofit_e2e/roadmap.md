# Roadmap de Testes E2E (Playwright)

## Visão Geral

Este documento define a estratégia de testes End-to-End (E2E) do projeto **Open Note**. Usa **Playwright** para automatizar interações com a WebView do Tauri, garantindo a qualidade da interface React e a integração com o backend Rust (FileSystem local, IPC, etc.).

**Estado atual:** Playwright instalado (`@playwright/test ^1.58`), config em `playwright.config.ts`, diretório `e2e/` vazio — nenhum teste E2E existe ainda.

## Abordagem de Testes

Cada fase define cenários em dois eixos:
1. **Caminho Feliz (Happy Path):** O usuário atingindo seus objetivos com sucesso.
2. **Caminho Crítico (Critical Path / Edge Cases):** Cenários que podem corromper dados, quebrar o FS local, falhas de sync, offline, ou inputs inválidos.

Os cenários são descritos em formato Gherkin para legibilidade, mas a implementação será em **Playwright puro** (TypeScript). Não usamos Cucumber — a dependência não está no projeto.

## Integração Tauri + Playwright

Tauri v2 **não expõe** protocolo CDP nativamente. A estratégia de teste E2E segue uma destas abordagens:

1. **Dev server (recomendado para início):** Rodar `npm run dev` (Vite na porta 1420) e testar a WebView via Playwright apontando para `http://localhost:1420`. Isso testa toda a UI React **mockando os IPC calls** com `vi.mock` ou interceptando no nível do `window.__TAURI__`.
2. **Build + WebDriver:** Usar `tauri-driver` (wrapper WebDriver para Tauri) com Playwright conectando via CDP. Testa o app real com backend Rust. Requer build completo.
3. **Binário + screenshots:** Para smoke tests de distribuição. `cargo tauri build --debug` e verificações visuais.

**Recomendação:** Começar com abordagem 1 (dev server + IPC mock) para velocidade. Migrar para abordagem 2 quando o setup de CI estiver maduro.

## Pré-requisitos de Infraestrutura

Antes de implementar os testes, criar:

- [ ] **`e2e/fixtures/`** — Helpers para criar workspace mock, pages, notebooks via IPC ou FS
- [ ] **`e2e/helpers/ipc-mock.ts`** — Mock de `window.__TAURI_INTERNALS__` para interceptar IPC calls em modo dev server
- [ ] **`e2e/helpers/workspace.ts`** — Setup/teardown de workspace temporário para cada teste
- [ ] **`e2e/helpers/selectors.ts`** — Page Object Model ou seletores centralizados (aria-labels, data-testid)
- [ ] Adicionar `data-testid` nos componentes React críticos (Sidebar, Editor, Dialogs)

## ⚠️ Features Não Implementadas

Alguns cenários referenciam features que **ainda não existem** no código. Estes cenários estão marcados e devem ser implementados apenas após a feature correspondente:

| Feature | Status | Afeta |
|---|---|---|
| Export .md para disco | ❌ Não implementado (só `tiptapToMarkdown` in-memory) | Fase 06 |
| Import .md de arquivo | ❌ Não implementado (só `markdownToTiptap` in-memory) | Fase 06 |
| Image file picker (Tauri dialog) | ❌ Não implementado (usa URL prompt) | Fase 05 |
| Asset cleanup (órfãos) | ❌ Não implementado | Fase 05 |
| File watcher / auto-index | ❌ Não implementado (indexação manual via IPC) | Fase 08 |
| OAuth funcional (providers) | ❌ Stubs — retornam AuthRequired | Fase 09 |
| Sync flow (upload/download) | ❌ Não implementado — só detecção de mudanças | Fase 09 |
| Tauri auto-updater | ❌ Não configurado | Fase 10 |
| Anchor-based stroke reflow | ⚠️ Parcial — InkOverlay existe, anchoring limitado | Fase 07 |

## Diretório de Cenários

- [Fase 01 - Fundação](./fase_01.md)
- [Fase 02 - Modelo de Domínio & Storage](./fase_02.md)
- [Fase 03 - UI Shell & Navegação](./fase_03.md)
- [Fase 04 - Editor Rich Text](./fase_04.md)
- [Fase 05 - Blocos Avançados](./fase_05.md)
- [Fase 06 - Modo Markdown](./fase_06.md)
- [Fase 07 - Handwriting, Ink & Anotação](./fase_07.md)
- [Fase 08 - Busca & Indexação](./fase_08.md)
- [Fase 09 - Cloud Sync](./fase_09.md)
- [Fase 10 - Distribuição & Polish](./fase_10.md)
