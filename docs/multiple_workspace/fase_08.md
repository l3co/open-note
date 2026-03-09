# Fase 08 — Testes E2E & Polish

**Esforço estimado:** ~15 horas  
**Prioridade:** 🟢 Média  
**Dependências:** Todas as fases anteriores  
**Branch:** `feat/multi-workspace-phase-8`

---

## Objetivo

Validar o fluxo completo de múltiplos workspaces com testes end-to-end (Playwright), corrigir edge cases, e polir a experiência do usuário.

---

## Tarefas

### 8.1 — Testes E2E: Fluxo básico multi-workspace

**Arquivo:** `e2e/multi-workspace.spec.ts`

| Teste | Descrição |
|-------|-----------|
| `create_two_workspaces_and_switch` | Cria WS-A, cria WS-B, switcher mostra ambos, foca em cada |
| `notebooks_isolated_between_workspaces` | Cria notebook em A, troca para B → notebook não aparece em B |
| `pages_isolated_between_workspaces` | Cria page em A, troca para B → page não aparece em B |
| `close_workspace_preserves_other` | Fecha A → B continua aberto e funcional |
| `close_last_workspace_shows_picker` | Fecha único → WorkspacePicker full-screen aparece |
| `reopen_workspace_restores_state` | Abre A, cria notebook, fecha A, reabre A → notebook presente |
| `search_scoped_to_workspace` | Indexa em A, busca em B → 0 resultados |
| `keyboard_shortcut_switches_workspace` | Ctrl+Shift+] → workspace seguinte |

**Critérios:**
- [ ] Todos os testes passam em CI (Ubuntu + headless Chromium)
- [ ] Timeouts adequados para operações de filesystem
- [ ] Cleanup: cada teste cria workspaces em tempdir

---

### 8.2 — Testes E2E: Edge cases

**Arquivo:** `e2e/multi-workspace-edge.spec.ts`

| Teste | Descrição |
|-------|-----------|
| `open_same_workspace_twice_focuses` | Tentar abrir workspace já aberto → foca nele (não duplica) |
| `open_workspace_with_missing_files` | Workspace com arquivos corrompidos → erro amigável, não crash |
| `maximum_workspaces_reached` | Tentar abrir 11° workspace → mensagem de limite |
| `workspace_picker_modal_with_existing` | Com workspace aberto, picker abre como modal |
| `rapid_switching_no_race_condition` | Trocar rapidamente entre 3 workspaces → estado consistente |
| `trash_scoped_per_workspace` | Deletar page em A → lixeira de B vazia |
| `workspace_name_displayed_correctly` | Nomes com acentos, emojis, espaços → renderizados corretamente |

**Critérios:**
- [ ] Edge cases não causam crash ou estado inconsistente
- [ ] Mensagens de erro traduzidas (i18n)
- [ ] Teste de stress com trocas rápidas

---

### 8.3 — Testes de regressão: funcionalidades existentes

**Arquivo:** `e2e/regression-multi-workspace.spec.ts`

Verificar que funcionalidades existentes não quebraram:

| Teste | Descrição |
|-------|-----------|
| `single_workspace_flow_unchanged` | Fluxo original (create → open → edit) funciona |
| `onboarding_dialog_still_works` | Onboarding aparece para first-time user |
| `settings_dialog_persists` | Mudar tema/idioma → persistido corretamente |
| `drag_and_drop_still_works` | Reordenar notebooks/sections via DnD |
| `quick_open_works_in_focused` | Ctrl+K abre Quick Open para workspace focused |
| `sync_settings_per_workspace` | Config de sync isolada por workspace |

**Critérios:**
- [ ] Nenhum teste existente em `e2e/` quebrado
- [ ] Novos testes de regressão passam

---

### 8.4 — Performance: benchmark multi-workspace

**Arquivo:** `e2e/performance-multi-workspace.spec.ts`

| Métrica | Target | Como medir |
|---------|--------|------------|
| Tempo para abrir 2° workspace | < 2s | `performance.now()` entre click e render |
| Tempo para trocar de workspace | < 300ms | Switch → content visible |
| RAM com 5 workspaces (100 pages cada) | < 400 MB | Leitura do process memory |
| Tamanho do índice Tantivy por workspace | < 5 MB (100 pages) | `du -sh .opennote/index` |

**Critérios:**
- [ ] Benchmarks documentados em CI artifacts
- [ ] Nenhuma degradação > 20% vs single workspace
- [ ] Log de memória disponível para análise

---

### 8.5 — Polish: indicadores visuais

**Melhorias de UX pós-funcional:**

| Item | Descrição |
|------|-----------|
| **Cor do workspace** | Cada workspace com uma cor de acento na sidebar (opcional) |
| **Badge de notificação** | Indicador se workspace tem conflitos de sync |
| **Tooltip no switcher** | Mostra path completo ao hover |
| **Empty state** | Mensagem quando workspace não tem notebooks |
| **Loading skeleton** | Skeleton UI durante carregamento de workspace |
| **Confirmação de close** | Dialog ao fechar workspace com edição não salva |

**Critérios:**
- [ ] Melhorias visuais não introduzem regressões
- [ ] Acessibilidade mantida (aria-labels, roles)
- [ ] Temas light/dark testados

---

### 8.6 — Documentação do usuário

**Arquivo:** `docs/USER_GUIDE_MULTI_WORKSPACE.md`

Guia para o usuário final:

1. **Como abrir múltiplos workspaces**
2. **Como alternar entre workspaces**
3. **Atalhos de teclado**
4. **Como fechar um workspace**
5. **Busca cross-workspace** (se implementado)
6. **Limites** (máximo de 10)
7. **FAQ**
   - "Meus dados são compartilhados entre workspaces?" → Não
   - "Posso ter o mesmo workspace aberto em duas instâncias?" → Não (lock)
   - "Quanto de memória cada workspace usa?" → ~50-80 MB

---

### 8.7 — Atualizar CHANGELOG e release notes

**Arquivo:** `CHANGELOG.md`

```markdown
## [Unreleased]

### Added
- Multiple simultaneous workspaces support
- Workspace switcher in sidebar
- Cross-workspace search
- Keyboard shortcuts for workspace navigation
- Data migration from single-workspace format

### Changed
- AppState schema v2 with active_workspaces tracking
- IPC commands accept optional workspace_id parameter
- Search engine isolated per workspace
```

---

## Arquivos Modificados/Criados

| Arquivo | Tipo |
|---------|------|
| `e2e/multi-workspace.spec.ts` | **Novo** |
| `e2e/multi-workspace-edge.spec.ts` | **Novo** |
| `e2e/regression-multi-workspace.spec.ts` | **Novo** |
| `e2e/performance-multi-workspace.spec.ts` | **Novo** |
| `docs/USER_GUIDE_MULTI_WORKSPACE.md` | **Novo** |
| `CHANGELOG.md` | Atualizado |
| Componentes diversos | Ajustes de polish |

---

## Critérios de Aceitação da Fase

- [ ] Todos os testes E2E passam em CI
- [ ] Testes de regressão confirmam zero breaking changes
- [ ] Performance dentro dos targets
- [ ] Documentação do usuário completa
- [ ] CHANGELOG atualizado
- [ ] `npm run test` passa
- [ ] `cargo test --workspace` passa
- [ ] `npx playwright test` passa
- [ ] PR review aprovado

---

## Checklist Final do Projeto Multi-Workspace

Ao completar esta fase, verificar:

- [ ] **Funcional:** Usuário abre 2+ workspaces, alterna, fecha independente
- [ ] **Isolamento:** Dados, busca, lixeira, sync — tudo scoped por workspace
- [ ] **Migração:** Workspaces v1 migram automaticamente
- [ ] **Performance:** < 400 MB RAM com 5 workspaces
- [ ] **UX:** Switcher intuitivo, atalhos, feedback visual
- [ ] **Testes:** Unit (90%), Integration (85%), E2E cobrindo fluxos principais
- [ ] **i18n:** Todas as strings em pt-BR e en
- [ ] **Docs:** Guia do usuário, ADR, migration guide
- [ ] **CI:** Todos os jobs passam
- [ ] **Backward compat:** App v1 atualiza sem perda de dados
