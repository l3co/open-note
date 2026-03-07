# Fase 10 — Distribuição & Polish

## Objetivo

Preparar o Open Note para **distribuição pública**: packaging multi-OS, auto-update, settings completos, temas, performance tuning, acessibilidade final, e polish geral da experiência do usuário. Esta é a fase de maturidade do produto.

---

## Dependências

- Todas as fases anteriores (01–09) concluídas

---

## Entregáveis

1. Packaging para macOS, Windows e Linux
2. Auto-update (Tauri updater)
3. Instaladores nativos (.dmg, .msi, .deb/.AppImage)
4. Tela de Settings completa
5. Sistema de temas premium (Light, Paper, Dark, System + accent colors + chrome tint)
6. Internacionalização (i18n) — PT-BR e EN
7. Performance tuning e profiling
8. Acessibilidade (WCAG AA)
9. Onboarding (primeiro uso)
10. Documentação de usuário
11. Landing page do projeto
12. CI/CD completo com release automatizada

---

## Packaging Multi-OS

### macOS

- **Formato:** `.dmg` (disk image com drag-to-Applications)
- **Assinatura:** Apple Developer Certificate (code signing)
- **Notarização:** Apple Notary Service (obrigatório para Gatekeeper)
- **Arquiteturas:** Universal Binary (x86_64 + aarch64)
- **Tauri config:**
  ```json
  {
    "bundle": {
      "macOS": {
        "minimumSystemVersion": "10.15",
        "frameworks": [],
        "signingIdentity": "Developer ID Application: ...",
        "entitlements": "entitlements.plist"
      }
    }
  }
  ```

### Windows

- **Formato:** `.msi` (MSI installer) + `.exe` (NSIS)
- **Assinatura:** Code signing certificate (opcional mas recomendado)
- **Arquiteturas:** x86_64 (ARM64 futuro)
- **Requisitos:** WebView2 Runtime (incluso no Windows 11, installer para Windows 10)

### Linux

- **Formatos:** `.deb` (Debian/Ubuntu), `.AppImage` (universal), `.rpm` (Fedora)
- **Arquiteturas:** x86_64
- **Dependências:** WebKitGTK (declarar no pacote)

### Tauri Bundle Config

```json
{
  "bundle": {
    "active": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "identifier": "com.opennote.app",
    "targets": ["dmg", "msi", "nsis", "deb", "appimage"],
    "category": "Productivity",
    "shortDescription": "Local-first note-taking with rich text, markdown, and handwriting",
    "longDescription": "..."
  }
}
```

---

## Auto-Update

### Tauri Updater

Tauri v2 tem sistema de auto-update integrado.

**Fluxo:**
1. App verifica endpoint de update ao iniciar (e periodicamente)
2. Se nova versão disponível, notifica usuário
3. Usuário aceita → download em background
4. Reiniciar para aplicar

**Endpoint:** JSON estático hospedado (GitHub Releases ou servidor próprio)

```json
{
  "version": "1.2.0",
  "notes": "Correções de bugs e melhorias de performance",
  "pub_date": "2026-06-15T12:00:00Z",
  "platforms": {
    "darwin-x86_64": { "url": "https://...", "signature": "..." },
    "darwin-aarch64": { "url": "https://...", "signature": "..." },
    "windows-x86_64": { "url": "https://...", "signature": "..." },
    "linux-x86_64": { "url": "https://...", "signature": "..." }
  }
}
```

**Segurança:** Updates assinados com chave privada. App verifica assinatura antes de aplicar.

### UI de Update

```
┌─────────────────────────────────────────┐
│  🆕 Nova versão disponível: v1.2.0     │
│                                         │
│  Novidades:                             │
│  • Correções de bugs                    │
│  • Melhorias de performance             │
│                                         │
│  [Atualizar agora]  [Depois]            │
└─────────────────────────────────────────┘
```

---

## Tela de Settings

### Estrutura

```
Settings
├── Geral
│    ├── Idioma (PT-BR, EN)
│    ├── Workspace padrão
│    ├── Abrir no último notebook ao iniciar
│    └── Auto-save interval
├── Aparência
│    ├── Tema base (Light, Paper, Dark, Sistema)
│    ├── Cor de destaque (10 paletas)
│    ├── Estilo do chrome (Neutro, Colorido)
│    ├── Fonte do editor (família, tamanho)
│    ├── Largura do conteúdo (estreito, médio, largo)
│    └── Densidade (compacta, confortável)
├── Editor
│    ├── Modo padrão (Rich Text, Markdown)
│    ├── Spell check (on/off)
│    ├── Autocorrect
│    └── Tab size (2, 4 espaços)
├── Ink / Handwriting
│    ├── Cor padrão da caneta
│    ├── Espessura padrão
│    ├── Suavização do traço
│    └── Pressure sensitivity (on/off)
├── Sincronização
│    ├── (conteúdo da Fase 09)
│    └── ...
├── Atalhos de Teclado
│    ├── Lista de todos os atalhos
│    └── Customização (futuro)
├── Backup
│    ├── Backup automático local
│    ├── Intervalo de backup
│    └── Local de backup
├── Sobre
│    ├── Versão do app
│    ├── Verificar atualizações
│    ├── Licença
│    └── Links (GitHub, docs, feedback)
└── Avançado
     ├── Pasta de dados
     ├── Pasta de índice
     ├── Limpar cache
     ├── Reconstruir índice
     ├── Exportar todos os dados
     └── Reset configurações
```

### Persistência — Split Global vs Workspace

Conforme definido na Fase 02, settings são divididos em dois níveis:

**Global** (`~/.opennote/app_state.json` → `global_settings`):

| Setting | Motivo |
|---|---|
| Tema (Claro, Escuro, Sistema) | Mesmo visual em todos os workspaces |
| Idioma (PT-BR, EN) | Preferência do usuário, não do projeto |
| Window bounds (posição, tamanho) | Preferência de janela |
| Atalhos de teclado customizados | Preferência do usuário |

**Por workspace** (`workspace.json` → `settings`):

| Setting | Motivo |
|---|---|
| Notebook padrão | Específico do workspace |
| Auto-save interval | Pode variar por projeto |
| Sidebar width/open | Layout específico |
| Última page aberta | Sessão do workspace |
| Backup interval e local | Dados específicos |
| Fonte do editor, largura do conteúdo | Pode variar (ex: código vs notas) |

**Por page** (`.opn.json` → `editor_preferences`):

| Setting | Motivo |
|---|---|
| Modo de edição (RichText/Markdown) | Cada page pode ter modo diferente |
| Split view | Preferência por page |

**Regra:** A tela de Settings exibe tudo junto para o usuário (sem separação visível). O frontend decide onde persistir cada setting transparentemente.

---

## Sistema de Temas

Arquitetura de 3 camadas definida na Fase 03. Nesta fase: polir, criar UI de configuração, e garantir visual premium.

### UI de Aparência (Settings → Aparência)

```
┌─────────────────────────────────────────────┐
│  Aparência                                  │
│                                             │
│  Tema                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │      │ │░░░░░░│ │      │ │ AUTO │      │
│  │ Aa   │ │ Aa   │ │ Aa   │ │  ☼☽  │      │
│  │      │ │░░░░░░│ │      │ │      │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│   Light     Dark     Paper    Sistema      │
│                                             │
│  Cor de destaque                            │
│  ● ● ● ● ● ● ● ● ● ●                     │
│  🔵 Azul (selecionado)                     │
│                                             │
│  Estilo do Chrome             [Neutro ▾]   │
│  (sidebar e toolbar)          [Colorido]   │
│                                             │
│  ── Preview ──────────────────────────────  │
│  │ ┌────┐  │                             │  │
│  │ │Side│  │  Preview ao vivo do tema    │  │
│  │ │bar │  │  com texto de exemplo       │  │
│  │ └────┘  │                             │  │
│  └─────────────────────────────────────┘   │
│                                             │
│  Fonte do editor                            │
│  Família: [Inter ▾]                        │
│  Tamanho: [16px ▾]                         │
│                                             │
│  Largura do conteúdo   [Médio ▾]           │
│  Densidade              [Confortável ▾]    │
└─────────────────────────────────────────────┘
```

### Seletores visuais

**Tema base:** Cards clicáveis com preview miniatura. O card selecionado tem borda da accent color. Cada card mostra uma mini-preview do layout (sidebar + content) nas cores do tema.

**Accent color:** Círculos coloridos (36px) dispostos em linha. Click seleciona. O selecionado tem anel externo + check. Mudança aplicada instantaneamente (live preview).

**Chrome tint:** Dropdown com "Neutro" e "Colorido". Preview ao lado mostra sidebar com/sem tint.

### Paleta de accent colors

Cada cor define 4 variantes geradas automaticamente:

```typescript
interface AccentPalette {
  name: string;
  base: string;           // cor principal
  hover: string;          // interação
  subtle: string;         // backgrounds (10% opacity)
  onAccent: string;       // texto sobre a cor (branco ou escuro)
}

const ACCENT_PALETTES: AccentPalette[] = [
  { name: 'Blue',     base: '#3b82f6', hover: '#2563eb', subtle: 'rgba(59,130,246,0.10)',  onAccent: '#fff' },
  { name: 'Indigo',   base: '#6366f1', hover: '#4f46e5', subtle: 'rgba(99,102,241,0.10)',  onAccent: '#fff' },
  { name: 'Purple',   base: '#8b5cf6', hover: '#7c3aed', subtle: 'rgba(139,92,246,0.10)',  onAccent: '#fff' },
  { name: 'Berry',    base: '#ec4899', hover: '#db2777', subtle: 'rgba(236,72,153,0.10)',  onAccent: '#fff' },
  { name: 'Red',      base: '#ef4444', hover: '#dc2626', subtle: 'rgba(239,68,68,0.10)',   onAccent: '#fff' },
  { name: 'Orange',   base: '#f97316', hover: '#ea580c', subtle: 'rgba(249,115,22,0.10)',  onAccent: '#fff' },
  { name: 'Amber',    base: '#f59e0b', hover: '#d97706', subtle: 'rgba(245,158,11,0.10)',  onAccent: '#1a1a1a' },
  { name: 'Green',    base: '#22c55e', hover: '#16a34a', subtle: 'rgba(34,197,94,0.10)',   onAccent: '#fff' },
  { name: 'Teal',     base: '#14b8a6', hover: '#0d9488', subtle: 'rgba(20,184,166,0.10)',  onAccent: '#fff' },
  { name: 'Graphite', base: '#64748b', hover: '#475569', subtle: 'rgba(100,116,139,0.10)', onAccent: '#fff' },
];
```

### Persistência

Armazenado em `GlobalSettings` (transversal a workspaces):

```typescript
interface ThemeConfig {
  baseTheme: 'light' | 'dark' | 'paper' | 'system';
  accentColor: string;      // nome da paleta ('Blue', 'Berry', etc.)
  chromeTint: 'neutral' | 'tinted';
}
```

### Polimento nesta fase

- [ ] Garantir contraste WCAG AA em **todas** as combinações (3 temas × 10 accent colors)
- [ ] Transição suave de 200ms ao trocar tema
- [ ] Todos os componentes usam variáveis CSS (nenhum hardcoded)
- [ ] Ink canvas adapta cor de fundo ao tema
- [ ] Code blocks (syntax highlighting) com scheme alinhado ao base theme
- [ ] PDF viewer background adapta ao base theme
- [ ] Scrollbars customizadas por tema
- [ ] Focus rings usam accent color
- [ ] Selection highlight usa accent-subtle

### Temas custom (futuro pós v1)

- Editor visual completo de cores (color picker para cada variável)
- Import/export de temas como JSON
- Galeria de temas da comunidade

---

## Internacionalização (i18n)

### Idiomas

- **PT-BR** (padrão para o desenvolvedor)
- **EN** (inglês — para adoção global)

### Implementação

**Frontend:** `react-i18next`

```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: { 'pt-BR': ptBR, en },
  lng: 'pt-BR',
  fallbackLng: 'en',
});
```

**Estrutura de locales:**
```
src/locales/
  ├── pt-BR.json
  └── en.json
```

**Exemplo:**
```json
{
  "sidebar": {
    "new_notebook": "Novo Notebook",
    "search": "Buscar...",
    "settings": "Configurações"
  },
  "editor": {
    "placeholder": "Comece a escrever...",
    "untitled": "Sem título"
  },
  "sync": {
    "synced": "Sincronizado",
    "syncing": "Sincronizando...",
    "error": "Erro na sincronização"
  }
}
```

**Regra:** Nenhuma string visível ao usuário é hardcoded. Todas passam pelo i18n.

### Backend (Rust)

Mensagens de erro do Rust também precisam ser localizadas para exibição no frontend. Opções:
1. Erros com código (`NOTEBOOK_ALREADY_EXISTS`) → frontend traduz
2. Backend envia chave de tradução → frontend resolve

**Decisão:** Opção 1 — erros com código. Frontend mapeia código → mensagem traduzida.

---

## Performance Tuning

### Métricas Alvo

| Métrica | Alvo |
|---|---|
| Tempo de abertura do app | < 2s (cold start) |
| Tempo de abertura de page | < 200ms |
| Latência do editor (keystroke → render) | < 16ms (60fps) |
| Latência de ink (pointer → render) | < 8ms |
| Busca (1000 pages) | < 50ms |
| Uso de memória (idle) | < 100MB |
| Tamanho do binário | < 15MB |

### Otimizações

1. **Lazy loading de features**
   - CodeMirror: carregado apenas quando Markdown mode ativado
   - Ink Canvas: carregado apenas quando InkBlock focado
   - Syntax highlighting: linguagens carregadas sob demanda

2. **Virtualização**
   - Sidebar com muitos itens → virtualizada (react-window)
   - Pages com muitos blocos → lazy render (intersection observer)

3. **Cache**
   - Páginas recentes em memória (LRU cache, últimas 10)
   - Índice Tantivy com mmap (já otimizado nativamente)
   - SVG cache para InkBlocks

4. **Bundle size**
   - Tree shaking agressivo
   - Code splitting por rota/feature
   - Análise com `vite-bundle-analyzer`

5. **Profiling**
   - React DevTools Profiler para render performance
   - Chrome DevTools Performance para paint/layout
   - `cargo flamegraph` para profiling do Rust

---

## Acessibilidade (WCAG AA)

### Checklist Final

- [ ] Toda navegação funciona por teclado
- [ ] Focus visible em todos os elementos interativos
- [ ] Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
- [ ] ARIA labels em todos os botões sem texto
- [ ] Tree view segue WAI-ARIA Treeview Pattern
- [ ] Dialogs com focus trap e Esc para fechar
- [ ] Skip link para conteúdo principal
- [ ] Screen reader anuncia mudanças dinâmicas (aria-live)
- [ ] Editor acessível (TipTap tem suporte a11y built-in)
- [ ] Redimensionamento de texto funciona (até 200%)
- [ ] Animações respeitam `prefers-reduced-motion`

### Ferramentas de Teste

- axe DevTools (extensão Chrome)
- VoiceOver (macOS) / NVDA (Windows) para teste manual
- Lighthouse accessibility audit

---

## Onboarding (Primeiro Uso)

### Fluxo

```
Welcome Screen
  │
  ├─ Logo + "Bem-vindo ao Open Note"
  │  "Suas notas, organizadas e sempre acessíveis."
  │
  ├─ [Começar com workspace local]       ← ação principal (destaque)
  │    │
  │    ├─ File picker → escolher pasta
  │    ├─ Nome do workspace (sugestão: "Minhas Notas")
  │    ├─ Criar primeiro notebook ("Meu Notebook")
  │    └─ Abrir page vazia → Tour guiado
  │
  └─ [☁️ Conectar à nuvem]              ← secundário
       │
       ├─ Antes da Fase 09: badge "Em breve", desabilitado
       └─ Após Fase 09: escolher provider → OAuth → criar workspace cloud
```

**Princípios do onboarding:**
- **Local-first:** A ação principal é sempre criar workspace local. Funciona 100% offline, sem cadastro, sem dependência externa.
- **Cloud-aware:** O botão de nuvem está visível desde o primeiro uso, sinalizando que a funcionalidade existe (ou existirá). Não é escondido — é apresentado como opção natural.
- **Zero fricção:** Do welcome à primeira page em no máximo 3 cliques.

### Tour Guiado

Tooltips com destaque passo a passo:
1. "Esta é a sidebar. Aqui você organiza seus notebooks e pages."
2. "Use `/` para inserir blocos especiais como código, tabelas e imagens."
3. "Alterne entre Rich Text e Markdown com `Cmd+Shift+M`."
4. "Suas notas ficam salvas localmente. Quando quiser, conecte à nuvem nas Configurações."

Implementar com biblioteca tipo `react-joyride` ou custom.

---

## Backup Local

### Auto-Backup

- Cópia completa do workspace em intervalo configurável
- Local: pasta configurável (padrão: `~/OpenNote-Backups/`)
- Retenção: últimos N backups (padrão: 5)
- Formato: zip do workspace inteiro

### Implementação

```rust
fn create_backup(workspace_path: &Path, backup_dir: &Path) -> Result<PathBuf> {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("opennote_backup_{}.zip", timestamp);
    let backup_path = backup_dir.join(backup_name);
    
    // Zip workspace (excluindo .opennote/index/)
    zip_directory(workspace_path, &backup_path, &[".opennote/index"])?;
    
    // Limpar backups antigos
    cleanup_old_backups(backup_dir, max_backups)?;
    
    Ok(backup_path)
}
```

---

## CI/CD — Release Pipeline

### GitHub Actions: Release

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: universal-apple-darwin
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
    
    steps:
      - checkout
      - setup Node.js + Rust
      - npm ci
      - cargo tauri build
      - upload artifacts
  
  release:
    needs: build
    steps:
      - create GitHub Release
      - attach build artifacts (.dmg, .msi, .deb, .AppImage)
      - update update endpoint JSON
```

### Versionamento

- Semantic Versioning (MAJOR.MINOR.PATCH)
- Changelog gerado automaticamente (conventional commits)
- Tags: `v1.0.0`, `v1.1.0`, etc.

---

## Documentação

### Para Usuários

- **Landing page** (site simples com features, screenshots, download)
- **Guia de início rápido** (dentro do app + online)
- **FAQ** (online)
- **Atalhos de teclado** (referência rápida dentro do app)

### Para Desenvolvedores

- **README.md** — Setup, contribuição
- **CONTRIBUTING.md** — Guidelines de contribuição
- **ARCHITECTURE.md** — Visão geral da arquitetura
- **ADRs** — Architecture Decision Records
- **API Docs** — Documentação dos comandos IPC

---

## Testes Finais

### Smoke Tests (por plataforma)

Para cada OS (macOS, Windows, Linux):
- [ ] App abre sem erros
- [ ] Criar workspace → notebook → section → page
- [ ] Editar com rich text → salvar → reabrir
- [ ] Editar com markdown → salvar → reabrir
- [ ] Inserir imagem → renderizada
- [ ] Desenhar ink → salvar → reabrir
- [ ] Buscar por conteúdo → resultado correto
- [ ] Conectar Google Drive → sync → desconectar
- [ ] Auto-update → notificação → instalar
- [ ] Trocar tema → visual correto
- [ ] Trocar idioma → textos atualizados

### Performance Tests

- App com 100 notebooks, 1000 pages → abertura < 3s
- Page com 500 blocos → scroll suave (60fps)
- Page com 50 InkBlocks → abertura < 1s
- Busca em 5000 pages → < 100ms

### Security Audit

- [ ] Nenhum token em plain text no filesystem
- [ ] CSP configurado corretamente (sem unsafe-inline desnecessário)
- [ ] Nenhum `eval()` no frontend
- [ ] Dependências sem vulnerabilidades conhecidas (`npm audit`, `cargo audit`)
- [ ] File access restrito ao workspace (Tauri scope)

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Code signing custa dinheiro (Apple, Microsoft) | Médio | Avaliar custo. Open source pode ter programas gratuitos. |
| Build cross-platform falha no CI | Médio | Testar localmente antes. Cache agressivo no CI. |
| Auto-update quebra app | Alto | Teste exaustivo do update flow. Rollback manual documentado. |
| Performance degradada em hardware antigo | Médio | Testar em máquinas low-end. Otimizar lazy loading. |
| Traduções incompletas/incorretas | Baixo | Review por falantes nativos. Ferramentas de i18n coverage. |

---

## Definition of Done

- [ ] Binários gerados para macOS (.dmg), Windows (.msi), Linux (.deb, .AppImage)
- [ ] Auto-update funcional com endpoint de update
- [ ] Code signing (pelo menos macOS)
- [ ] Settings completo com todas as seções
- [ ] Temas polidos: 4 base themes × 10 accent colors × 2 chrome tints (WCAG AA)
- [ ] i18n: PT-BR e EN completos
- [ ] Onboarding funcional (primeiro uso)
- [ ] Backup local automático
- [ ] Performance dentro dos alvos
- [ ] Acessibilidade validada (keyboard, screen reader, contraste)
- [ ] Smoke tests passando em todos os OS
- [ ] Security audit limpo
- [ ] CI/CD com release automatizada
- [ ] Documentação de usuário publicada
- [ ] Landing page publicada
- [ ] Changelog e versão semântica
- [ ] README completo e atualizado
