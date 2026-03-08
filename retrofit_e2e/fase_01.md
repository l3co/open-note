# Fase 01 - Fundação

## Feature: Inicialização da Aplicação

**Descrição**: Validar se o bundle React no Tauri está sendo servido corretamente e se o fluxo de startup (loading → WorkspacePicker ou workspace aberto) funciona.

**Componentes envolvidos:** `App.tsx`, `WorkspacePicker`, `OnboardingDialog`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Setup inicial e App running
  Scenario: O App carrega e exibe o WorkspacePicker na primeira vez
    Given o usuário abre o aplicativo Open Note pela primeira vez
    And não existe workspace recente salvo no app_state
    Then a tela de loading "Open Note" aparece brevemente
    And o WorkspacePicker é exibido com opções de criar ou abrir workspace
    And nenhum erro de console é registrado

  Scenario: O App carrega e reabre o último workspace
    Given o usuário já abriu um workspace anteriormente
    And o path do workspace ainda existe no filesystem
    When o aplicativo é inicializado
    Then o workspace é carregado automaticamente
    And a Sidebar exibe os notebooks do workspace
```

**Nota de implementação:** O app carrega `app_state.json` via IPC `get_app_state`. O campo `last_opened_workspace` determina se vai direto para o workspace ou exibe o WorkspacePicker.

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência na inicialização
  Scenario: Último workspace deletado do filesystem
    Given o app_state.json indica last_opened_workspace = "/path/deletado"
    And o diretório físico desse workspace foi removido
    When o aplicativo é inicializado
    Then o aplicativo reverte graciosamente para o WorkspacePicker
    And nenhum crash ou tela branca ocorre

  Scenario: App lançado com IPC get_app_state falhando
    Given o backend Rust falha ao ler/criar o app_state.json (permissão negada, disco cheio)
    When o aplicativo é inicializado
    Then o catch do init() no App.tsx redireciona para o WorkspacePicker
    And um Toast ou mensagem de erro é exibido
    And não deve ocorrer crash silencioso
```

**Nota:** O diretório global de configuração é gerenciado pelo Tauri v2 (não é `~/.opennote` hardcoded). O app não cria diretórios manualmente — o `app_state.json` é lido/escrito pelo backend Rust.
