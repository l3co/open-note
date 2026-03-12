---
description: Validação completa local — espelha todas as etapas do CI (lint, typecheck, tests, E2E)
---

Executa todas as verificações que o CI realiza, na mesma ordem e com os mesmos critérios.
Útil para garantir que nada vai quebrar no GitHub Actions antes de abrir um PR.

## Etapas

### Rust

1. **Checar formatação Rust** — Equivalente ao job `lint-rust` (cargo fmt --check).
// turbo
```bash
cargo fmt --check --all
```

2. **Clippy (lint Rust)** — Trata warnings como erros, igual ao CI.
// turbo
```bash
cargo clippy --workspace -- -D warnings
```

3. **Testes Rust** — Executa todos os testes do workspace (também regenera bindings ts-rs).
// turbo
```bash
cargo test --workspace
```

4. **Verificar TypeScript bindings** — Confirma que `src/types/bindings/` está em sincronia com o código Rust.
// turbo
```bash
git diff --exit-code src/types/bindings/
```
Se houver diff, commite os bindings atualizados antes de continuar.

---

### Frontend

5. **ESLint** — Lint do código TypeScript/React.
// turbo
```bash
npm run lint
```

6. **Prettier check** — Verifica formatação sem alterar arquivos.
// turbo
```bash
npm run format:check
```

7. **TypeScript check** — Verificação de tipos estrita.
// turbo
```bash
npm run typecheck
```

8. **Testes unitários com cobertura** — Vitest, igual ao CI (`test:coverage`).
// turbo
```bash
npm run test:coverage
```

---

### E2E

9. **Instalar browsers Playwright** — Necessário se ainda não instalado ou após atualização de versão.
```bash
npx playwright install --with-deps chromium
```

10. **Rodar testes E2E** — Playwright completo.
// turbo
```bash
npx playwright test
```

---

## Notas

- **Falha em qualquer etapa = pare e corrija** antes de prosseguir.
- Os passos 1–4 espelham os jobs `lint-rust` e `test-rust` do CI.
- Os passos 5–8 espelham os jobs `lint-frontend` e `test-frontend` do CI.
- Os passos 9–10 espelham o job `test-e2e` do CI.
- Para ver o relatório E2E após rodar: `npx playwright show-report`.
- Se quiser pular E2E (mais rápido): execute apenas os passos 1–8.
