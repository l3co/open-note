---
description: Error fixing workflow — diagnose, fix, validate and commit
---

Workflow completo para corrigir erros no Open Note. Identifica a causa raiz, corrige, valida qualidade e commita.

## Passos

### Fase 1 — Diagnóstico

1. **Identificar o erro** — Leia a mensagem de erro completa (stack trace, arquivo, linha). Classifique o tipo:
   - Erro de compilação Rust → clippy / cargo build
   - Erro de tipo TypeScript → typecheck
   - Falha de teste (Rust) → cargo test
   - Falha de teste (Vitest) → npm run test
   - Falha de teste E2E (Playwright) → npx playwright test
   - Erro de lint/format → eslint / prettier / rustfmt
   - Erro de runtime → logs da aplicação / console do browser

2. **Reproduzir o erro localmente** — Execute o comando correspondente ao tipo de erro para confirmar que você consegue reproduzi-lo antes de corrigir.
// turbo
```bash
git status
```

3. **Analisar a causa raiz** — Leia os arquivos envolvidos no erro. Identifique a causa raiz, não apenas o sintoma. Perguntas a responder:
   - Qual arquivo e linha causou o erro?
   - A mudança que introduziu o erro foi intencional?
   - O erro está no código novo ou em testes desatualizados?
   - Existe alguma dependência entre módulos que explica o erro?

### Fase 2 — Correção

4. **Corrigir a causa raiz** — Aplique a correção mínima necessária. Prefira:
   - Correção upstream (no código que causa o problema) em vez de workaround downstream
   - Mudança de uma linha quando suficiente — não over-engineer
   - Manter o estilo de código existente

5. **Verificar que a correção resolve o erro** — Execute o comando específico que reproduzia o erro:
   - Rust: `cargo build --workspace` ou `cargo test --workspace`
   - Frontend: `npm run typecheck` ou `npm run test`
   - E2E: `npx playwright test <arquivo-específico>`

### Fase 3 — Validação Completa (igual ao commit workflow)

6. **Formatar código Rust**
```bash
cargo fmt --all
```

7. **Lint Rust (Clippy)**
// turbo
```bash
cargo clippy --workspace -- -D warnings
```

8. **Rodar testes Rust**
// turbo
```bash
cargo test --workspace
```

9. **Verificar TypeScript bindings**
// turbo
```bash
git diff --name-only src/types/bindings/
```
Se houver arquivos modificados, incluí-los no commit.

10. **Lint Frontend (ESLint)**
// turbo
```bash
npm run lint
```

11. **Formatar Frontend (Prettier)**
```bash
npm run format
```

12. **TypeScript check**
// turbo
```bash
npm run typecheck
```

13. **Rodar testes Frontend**
// turbo
```bash
npm run test
```

### Fase 4 — Commit

14. **Revisar diff final**
// turbo
```bash
git diff --stat
```

15. **Stage dos arquivos**
```bash
git add -A
```

16. **Commit com Conventional Commits** — Use `fix:` para correções de bug:
```bash
git commit -m "fix: <descrição curta da correção>

<explicação da causa raiz e o que foi corrigido>"
```

## Notas

- **Nunca aplique um workaround** sem entender a causa raiz.
- Se a validação completa (passos 6–13) revelar **novos erros** introduzidos pela correção, volte ao passo 4.
- Se o erro estiver em um **teste desatualizado** (não no código de produção), corrija o teste — mas verifique primeiro se o comportamento do código realmente mudou intencionalmente.
- Commits de correção devem ser **atômicos** — um bug por commit.
- Nunca commite com testes falhando ou warnings de clippy.
