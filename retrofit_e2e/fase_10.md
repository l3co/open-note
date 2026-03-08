# Fase 10 - Distribuição & Polish

## Feature: Configurações, Temas, Idioma e Onboarding

**Descrição**: Validar o sistema de temas premium (3 camadas), mudança de idioma, Settings dialog com 6 abas, e o Onboarding flow para novos usuários.

**Componentes envolvidos:** `SettingsDialog` (6 abas), `GeneralSection` (idioma), `AppearanceSection` (tema), `EditorSection`, `SyncSection`, `ShortcutsSection`, `AboutSection`, `OnboardingDialog`

**Sistema de temas (3 camadas):**
1. **Base Theme:** Light, Paper, Dark, System
2. **Accent Color:** Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite
3. **Chrome Tint:** Neutral ou Tinted (sidebar/toolbar com tonalidade do accent)

**Persistência:** `GlobalSettings.theme` → `ThemeConfig { base_theme, accent_color, chrome_tint }` salvo via IPC `update_global_settings`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Temas Premium e Idioma
  Scenario: Trocando Base Theme, Accent Color e Chrome Tint
    Given o usuário abre Settings → Aparência (AppearanceSection)
    When seleciona Base Theme "Dark"
    Then as CSS variables transicionam via data-theme="dark" no <html>
    And toda a UI (Sidebar, Toolbar, Editor) reflete o tema escuro sem flickering
    When seleciona Accent Color "Teal"
    Then botões, links e elementos de destaque mudam para a paleta Teal
    When ativa Chrome Tint "Tinted"
    Then a Sidebar e Toolbar ganham tonalidade suave do accent color (via color-mix)
    And a preferência é persistida via IPC update_global_settings

  Scenario: Mudança de Idioma sem restart
    Given o usuário abre Settings → Geral (GeneralSection)
    When seleciona idioma "English" no dropdown
    Then react-i18next carrega o bundle de tradução en.json
    And toda a UI traduz imediatamente sem reload
    And o app_state.json salva language: "en" via IPC
    When o app é reiniciado, o idioma "English" é carregado automaticamente

  Scenario: Onboarding completo
    Given é a primeira abertura do app (sem localStorage opennote_onboarding_done)
    Then o OnboardingDialog exibe tela de boas-vindas com logo
    When o usuário clica "Começar"
    Then o tour navega por 4 passos (Sidebar, Slash Commands, Modo Markdown, Cloud)
    When o usuário completa o tour clicando "Concluir"
    Then localStorage salva flag e o dialog não reaparece em futuras aberturas

  Scenario: Navegando pelas 6 abas do Settings
    Given o SettingsDialog está aberto
    Then as 6 abas estão acessíveis na sidebar: Geral, Aparência, Editor, Sincronização, Atalhos, Sobre
    When o usuário clica em cada aba
    Then o conteúdo correspondente é exibido sem erro
    And a aba "Sobre" exibe informações da versão do app
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência de configurações
  Scenario: Theme config corrompido no app_state.json
    Given o app_state.json tem theme com valor inválido (ex: base_theme: "inexistente")
    When o app é inicializado
    Then o backend deserializa com defaults (fallback para "system", "Blue", "neutral")
    And a UI renderiza com tema padrão sem crash

  Scenario: Idioma não disponível
    Given o app_state.json indica language: "jp" (não existe locales/jp.json)
    When o app carrega
    Then react-i18next faz fallback para "en" (idioma padrão)
    And nenhum crash ou chaves de tradução raw são exibidas
```

> **⚠️ Não implementado:**
> - **Tauri auto-updater:** O plugin de auto-update do Tauri v2 **não está configurado** no projeto (sem endpoint de release, sem plugin no `tauri.conf.json`). Cenários de auto-update serão adicionados quando o mecanismo for implementado.
> - **Distribuição (CI build + assinatura):** O GitHub Actions CI executa lint/test/build, mas não gera artefatos assinados para distribuição. Testes de instalação/atualização requerem pipeline de release dedicado.
