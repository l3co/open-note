# Troubleshooting — Open Note

Problemas comuns encontrados durante desenvolvimento e uso, com soluções.

---

## Ambiente de Desenvolvimento

### Erro: "failed to run custom build command for webkit2gtk-sys"

**Plataforma:** Linux

**Causa:** Dependências de sistema faltando.

**Solução:**
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libayatana-appindicator3-dev
```

---

### Erro: "cargo build" falha com erros de linking

**Plataforma:** macOS

**Causa:** Xcode Command Line Tools não instalado.

**Solução:**
```bash
xcode-select --install
```

---

### Erro: "npm ci" falha com versão de Node incorreta

**Causa:** Versão de Node.js diferente da esperada.

**Solução:**
```bash
nvm use              # Usa versão do .nvmrc
node --version       # Deve ser 23.x
```

---

### Hot reload do Rust não funciona (tauri dev)

**Causa:** O Tauri CLI pode não detectar mudanças em crates.

**Solução:**
1. Salvar novamente o arquivo alterado
2. Se persistir, reiniciar `npm run tauri dev`
3. Verificar que `src-tauri/Cargo.toml` lista o crate como dependência

---

### TypeScript bindings desatualizados

**Sintoma:** Erro de tipo no frontend após alterar struct Rust.

**Causa:** Bindings em `src/types/bindings/` não foram regenerados.

**Solução:**
```bash
cargo test -p opennote-core    # Regenera bindings
# Ou rodar qualquer teste que importe os tipos com #[derive(TS)]
```

CI verifica automaticamente via `git diff --exit-code src/types/bindings/`.

---

### ESLint ou Prettier falham no CI mas passam localmente

**Causa:** Versão diferente de Node ou dependências.

**Solução:**
```bash
rm -rf node_modules
npm ci                  # Instala exatamente o que está no lock file
npm run lint
npm run format:check
```

---

## Runtime

### Erro: "Workspace is locked by another process"

**Causa:** Outra instância do app está usando o mesmo workspace, ou o app crashou sem liberar o `.lock`.

**Solução:**
1. Fechar todas as instâncias do Open Note
2. Se persistir, o `.lock` é stale — o app detecta locks de processos que não existem mais e remove automaticamente
3. Em último caso, deletar manualmente o arquivo `.lock` na raiz do workspace

---

### Erro: "WorkspaceNotFound"

**Causa:** O diretório do workspace foi movido ou deletado externamente.

**Solução:**
1. O app abre o WorkspacePicker automaticamente
2. Remover o workspace da lista de recentes
3. Recriar ou apontar para o novo path

---

### Busca não retorna resultados esperados

**Causa:** Índice Tantivy desatualizado ou corrompido.

**Solução:**
1. Rebuild do índice via Settings ou programaticamente:
```typescript
await ipc.rebuildIndex();
```
2. Se persistir, deletar `.opennote/index/` e reabrir o workspace (recria automaticamente)

---

### Página não salva (status fica em "saving" indefinidamente)

**Causa possíveis:**
- Workspace root não definido (workspace fechado durante save)
- Arquivo `.opn.json` com permissão read-only
- Disco cheio

**Solução:**
1. Verificar se o workspace está aberto (StatusBar mostra o path)
2. Verificar permissões do diretório do workspace
3. Verificar espaço em disco
4. Reiniciar o app (auto-save faz flush on unmount)

---

### Tema não aplica corretamente

**Causa:** `data-theme` ou `data-chrome` não atualizado no DOM.

**Solução:**
1. Ir em Settings → Aparência e reselecionar o tema
2. Se tema "System" não acompanha o OS, verificar que `window.matchMedia('(prefers-color-scheme: dark)')` funciona no browser
3. Reiniciar o app restaura tema do `app_state.json`

---

## Testes

### Testes Rust falham com "Permission denied"

**Causa:** Testes de integração do storage criam arquivos temporários.

**Solução:**
```bash
# Limpar diretórios temporários
cargo clean
cargo test --workspace
```

---

### Testes E2E falham com timeout

**Causa:** Dev server não iniciou a tempo ou porta 1420 ocupada.

**Solução:**
1. Verificar se porta 1420 está livre: `lsof -i :1420`
2. Matar processo se necessário: `kill -9 <PID>`
3. Aumentar timeout no `playwright.config.ts` se necessário
4. Rodar com debug: `npx playwright test --debug`

---

### Testes E2E falham com "Tauri IPC not available"

**Causa:** Mock de IPC não foi injetado corretamente.

**Solução:**
1. Verificar que `setupIpcMock(page)` é chamado antes de `page.goto()`
2. O mock deve ser injetado via `page.addInitScript()` (antes do React carregar)
3. Verificar `e2e/helpers/ipc-mock.ts` para o mock completo

---

### Coverage abaixo do threshold

**Causa:** Código novo sem testes suficientes.

**Solução:**
1. Verificar relatório: `npm run test:coverage` (gera HTML em `coverage/`)
2. Adicionar testes para linhas e branches não cobertos
3. Thresholds: lines 80%, branches 70% (configurável em `vitest.config.ts`)

---

## Build

### Build Tauri falha com "resource not found"

**Causa:** Icons ou assets faltando.

**Solução:**
```bash
# Regenerar icons
npx tauri icon src-tauri/icons/icon.png
```

---

### Build produção muito grande

**Causa:** Debug symbols incluídos.

**Solução:** Verificar que o build usa `--release`:
```bash
npm run tauri build    # Já usa --release por padrão
```

Profile de release em `src-tauri/Cargo.toml`:
```toml
[profile.release]
strip = true
lto = true
```

---

## Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Guia de setup |
| [TESTING.md](./TESTING.md) | Estratégia de testes |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build e distribuição |
