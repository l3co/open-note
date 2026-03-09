# Multi-Workspace — Guia do Usuário

## Como abrir múltiplos workspaces

1. Clique no nome do workspace na barra lateral (topo)
2. Selecione **"Abrir outro workspace..."** ou **"Criar workspace..."**
3. O novo workspace abrirá ao lado do atual — ambos ficam visíveis no seletor

Ou use o atalho `⌘⇧O` (macOS) / `Ctrl+Shift+O` (Windows/Linux) para abrir o seletor de workspace.

## Como alternar entre workspaces

- **Seletor na sidebar**: clique no botão com o nome do workspace (topo da sidebar) para abrir o popover com todos os workspaces abertos e clique no desejado.
- **Atalho próximo**: `⌘⇧]` (macOS) / `Ctrl+Shift+]` (Windows/Linux)
- **Atalho anterior**: `⌘⇧[` (macOS) / `Ctrl+Shift+[` (Windows/Linux)

## Atalhos de teclado

| Ação | macOS | Windows/Linux |
|------|-------|---------------|
| Abrir seletor de workspace | `⌘⇧W` ou `⌘⇧O` | `Ctrl+Shift+W` ou `Ctrl+Shift+O` |
| Próximo workspace | `⌘⇧]` | `Ctrl+Shift+]` |
| Workspace anterior | `⌘⇧[` | `Ctrl+Shift+[` |

## Como fechar um workspace

1. Abra o seletor clicando no nome do workspace
2. Passe o mouse sobre o workspace a fechar
3. Clique no ícone **✕** que aparece à direita
4. Confirme no diálogo que aparece

> O workspace é apenas removido da sessão atual. Seus dados permanecem no disco.

## Busca cross-workspace

A busca normal (`⌘F` / `Ctrl+F`) está limitada ao workspace em foco.  
Para buscar em todos os workspaces abertos, use a API `searchAllWorkspaces` (disponível para integrações externas).

## Limites

- Máximo de **10 workspaces** abertos simultaneamente
- Cada workspace ocupa ~50–80 MB de RAM (índice Tantivy + cache)
- O índice de busca é isolado por workspace

## FAQ

**"Meus dados são compartilhados entre workspaces?"**  
Não. Notebooks, seções, páginas, lixeira e índice de busca são completamente isolados.

**"Posso abrir o mesmo workspace em duas instâncias do app?"**  
Não. O app usa um lock de arquivo por workspace para evitar corrupção de dados.

**"O que acontece se eu fechar o app com workspaces abertos?"**  
Na próxima abertura, o app restaura o último workspace que estava em foco. Os outros podem ser reabertos manualmente pelo seletor.

**"Quanto de memória os workspaces usam?"**  
Aproximadamente 50–80 MB por workspace aberto com ~100 páginas indexadas.

**"É possível sincronizar workspaces diferentes para provedores diferentes?"**  
Sim. As configurações de sync (Google Drive, OneDrive, Dropbox) são independentes por workspace.
