---
description: Pre-commit workflow — lint, format, test e commit com Conventional Commits
---

Workflow completo para preparar e executar um commit no Open Note. Garante qualidade do código antes de commitar.

## Passos

1. **Verificar arquivos modificados** — Identifique o que mudou para contextualizar o commit.
// turbo
```bash
git status
```

2. **Formatar código Rust** — Aplica `rustfmt` em todos os crates.
```bash
cargo fmt --all
```

3. **Lint Rust (Clippy)** — Verifica warnings e erros no backend.
// turbo
```bash
cargo clippy --workspace -- -D warnings
```

4. **Rodar testes Rust** — Executa todos os testes do workspace (também regenera TypeScript bindings via ts-rs).
// turbo
```bash
cargo test --workspace
```

5. **Verificar TypeScript bindings** — Confirma que os bindings gerados em `src/types/bindings/` estão atualizados.
// turbo
```bash
git diff --name-only src/types/bindings/
```
Se houver arquivos modificados, incluí-los no commit.

6. **Lint Frontend (ESLint)** — Verifica regras de lint no código TypeScript/React.
// turbo
```bash
npm run lint
```

7. **Formatar Frontend (Prettier)** — Aplica formatação automática.
```bash
npm run format
```

8. **TypeScript check** — Verifica erros de tipo.
// turbo
```bash
npm run typecheck
```

9. **Rodar testes Frontend** — Executa testes unitários com Vitest.
// turbo
```bash
npm run test
```

10. **Atualizar documentação** — Se houve mudanças estruturais (novo IPC command, novo block type, nova entidade, mudança de arquitetura), atualizar os documentos relevantes:
    - Novo IPC command → `docs/IPC_REFERENCE.md`
    - Nova entidade/block → `docs/DATA_MODEL.md`
    - Mudança de arquitetura → `docs/ARCHITECTURE.md`, `docs/SYSTEM_DESIGN.md`
    - Nova decisão → `docs/adr/` (criar ADR)
    - Novo troubleshooting → `docs/TROUBLESHOOTING.md`
    - Mudança no `.windsurf/memories.md` se houver alteração significativa no projeto

11. **Revisar diff final** — Revise todas as mudanças que serão commitadas.
// turbo
```bash
git diff --stat
```

12. **Stage dos arquivos** — Adicione os arquivos ao staging.
```bash
git add -A
```

13. **Commit com Conventional Commits** — Crie o commit seguindo a convenção:
    - `feat:` — Nova funcionalidade
    - `fix:` — Correção de bug
    - `docs:` — Documentação
    - `refactor:` — Refatoração sem mudança de comportamento
    - `test:` — Adição/alteração de testes
    - `chore:` — Manutenção, deps, CI
    - `style:` — Formatação (sem mudança de lógica)
    - `perf:` — Melhoria de performance

```bash
git commit -m "<type>: <description>"
```

## Notas

- Se qualquer passo de lint ou teste **falhar**, corrija antes de prosseguir.
- Commits devem ser **pequenos e atômicos** — uma responsabilidade por commit.
- Se o commit inclui múltiplas mudanças independentes, considere dividir em commits separados.
- Nunca commite com testes falhando ou warnings de clippy.
