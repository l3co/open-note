# Guia de Contribuição — Open Note

Obrigado por considerar contribuir com o Open Note! Este guia explica como participar do projeto.

---

## Pré-requisitos

Antes de começar, garanta que tem o ambiente configurado conforme o [Guia de Desenvolvimento](docs/DEVELOPMENT.md):

- **Rust** 1.94+ (stable)
- **Node.js** 23.x (ver `.nvmrc`)
- **npm** 10.x

```bash
git clone https://github.com/l3co/open-note.git
cd open-note
npm ci
cargo build --workspace
```

---

## Workflow de Contribuição

### 1. Criar branch

```bash
git checkout -b feat/minha-feature   # Para features
git checkout -b fix/meu-bug          # Para bug fixes
```

### 2. Desenvolver

- Escreva testes **antes** da implementação (TDD quando possível)
- Siga as [convenções de código](docs/DEVELOPMENT.md#5-convenções-de-código)
- Mantenha commits pequenos e atômicos

### 3. Verificar qualidade

```bash
# Rust
cargo fmt --check --all
cargo clippy --workspace -- -D warnings
cargo test --workspace

# Frontend
npm run lint
npm run format:check
npm run typecheck
npm run test
```

### 4. Commit

Usamos **Conventional Commits**:

| Prefixo | Uso |
|---|---|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Documentação |
| `refactor:` | Refatoração (sem mudança de comportamento) |
| `test:` | Adição/alteração de testes |
| `chore:` | Manutenção, deps, CI |
| `style:` | Formatação (sem mudança de lógica) |
| `perf:` | Melhoria de performance |

Exemplos:
```
feat: add export to PDF
fix: prevent crash when closing empty workspace
docs: add sequence diagram for sync flow
refactor: extract page validation into separate module
test: add integration tests for trash lifecycle
```

### 5. Pull Request

- Título claro seguindo Conventional Commits
- Descrição do que mudou e por quê
- Link para issue relacionada (se existir)
- Screenshots (para mudanças visuais)

---

## Princípios Arquiteturais

Toda contribuição deve respeitar:

### Clean Architecture
- Dependências apontam para dentro: `src-tauri → storage → core`
- **`crates/core`** nunca importa Tauri, filesystem ou frameworks
- IPC commands são finos — delegam para crates

### Domain-Driven Design
- Linguagem ubíqua (ver [GLOSSARY.md](docs/GLOSSARY.md))
- Regras de negócio no domínio, nunca em controllers
- Modelos ricos com comportamento

### SOLID
- Funções pequenas (~10–20 linhas)
- Uma responsabilidade por função/struct
- Composição sobre herança

---

## Checklist de PR

Antes de submeter, verifique:

- [ ] Testes passam (`cargo test --workspace && npm run test`)
- [ ] Lint passa (`cargo fmt && cargo clippy && npm run lint`)
- [ ] TypeScript compila (`npm run typecheck`)
- [ ] Bindings TS atualizados (se structs Rust mudaram)
- [ ] Strings visíveis traduzidas (`t('key')` em ambos locales)
- [ ] Commits seguem Conventional Commits
- [ ] Documentação atualizada (se API/comportamento mudou)

---

## Guias Específicos

### Adicionar novo IPC Command

Ver [DEVELOPMENT.md — Como Adicionar um Novo IPC Command](docs/DEVELOPMENT.md#6-como-adicionar-um-novo-ipc-command).

### Adicionar novo tipo de Block

Ver [DEVELOPMENT.md — Como Adicionar um Novo Tipo de Block](docs/DEVELOPMENT.md#7-como-adicionar-um-novo-tipo-de-block).

### Adicionar nova tradução

Ver [DEVELOPMENT.md — Como Adicionar uma Nova Tradução](docs/DEVELOPMENT.md#8-como-adicionar-uma-nova-tradução).

### Adicionar um ADR

Architecture Decision Records são documentados em `docs/adr/`:

```markdown
# ADR-NNN: Título da Decisão

## Status
Aceito

## Contexto
[Descrever o problema ou necessidade]

## Decisão
[Descrever a decisão tomada]

## Justificativa
[Explicar o porquê]

## Consequências
### Positivas
- ...
### Negativas
- ...
### Riscos
- ...
```

---

## Estrutura de Testes

Toda contribuição deve incluir testes:

| Tipo de mudança | Testes esperados |
|---|---|
| Nova entidade/VO (core) | Unit tests de criação, validação, serde roundtrip |
| Novo método storage | Integration test com filesystem real |
| Novo IPC command | Teste do handler + teste no store (frontend) |
| Novo componente React | Teste de renderização + interação |
| Bug fix | Teste de regressão que falha sem o fix |

Ver [TESTING.md](docs/TESTING.md) para detalhes completos.

---

## Código de Conduta

- Seja respeitoso e construtivo
- Foque no código, não na pessoa
- Aceite feedback como oportunidade de aprendizado
- Documente decisões não-óbvias

---

## Dúvidas?

- Abra uma **Issue** para perguntas ou discussões
- Consulte a [documentação completa](docs/README.md)
- Leia os [ADRs](docs/adr/) para entender decisões anteriores
