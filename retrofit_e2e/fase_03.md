# Fase 03 - UI Shell & Navegação

## Feature: Navegação e Interface do Usuário

**Descrição**: Validar o WorkspacePicker, Sidebar (NotebookTree), navegação entre notebooks/sections/pages, atalhos de teclado, e Onboarding.

**Componentes envolvidos:** `WorkspacePicker`, `Sidebar`, `NotebookTree`, `SidebarFooter`, `OnboardingDialog`, `Toolbar`, `Breadcrumb`, `StatusBar`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Navegando entre Workspaces e Notebooks
  Scenario: Expandindo Notebook na Sidebar
    Given o usuário tem dois notebooks criados no workspace
    When ele clica no notebook "Pessoal" na NotebookTree (Sidebar)
    Then as Sections do notebook são exibidas como nós filhos na árvore
    And ao clicar em uma Section, as Pages são listadas

  Scenario: Navegando para uma Page
    Given o notebook "Pessoal" está expandido com uma Section "Geral"
    When o usuário clica na page "Notas do dia" na árvore
    Then o ContentArea carrega o PageEditor com o conteúdo da página
    And o Breadcrumb exibe "Pessoal > Geral > Notas do dia"

  Scenario: Trocando de Workspace pelo WorkspacePicker
    Given o usuário está no workspace "Casa"
    When o usuário clica no botão FolderSync no SidebarFooter
    Then o WorkspacePicker é exibido (overlay sobre toda a tela)
    And a lista de workspaces recentes é carregada
    When o usuário clica no workspace "Trabalho"
    Then o workspace "Trabalho" é aberto via IPC open_workspace
    And a Sidebar é atualizada com os notebooks do novo workspace

  Scenario: Onboarding na primeira abertura
    Given é a primeira vez que o usuário abre o app (localStorage sem flag opennote_onboarding_done)
    Then o OnboardingDialog é exibido com a tela de boas-vindas
    When o usuário clica "Começar Tour"
    Then o dialog navega pelos 4 passos do tour (Sidebar, Slash Commands, Modo Markdown, Cloud)
    When o usuário completa o tour
    Then o dialog fecha e localStorage salva "opennote_onboarding_done" = "1"
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Robustez da UI contra falhas
  Scenario: Workspace recente com path inexistente
    Given o app_state.json lista um workspace recente cujo diretório foi deletado
    When o usuário clica nesse workspace no WorkspacePicker
    Then o IPC open_workspace retorna erro
    And a UI exibe Toast de erro e permanece no WorkspacePicker
    And o botão de remover (X) permite limpar o workspace inválido da lista

  Scenario: Prevenção de múltiplas instâncias no mesmo Workspace
    Given o Workspace "Trabalho" está aberto e tem um .lock com PID ativo
    When outra instância tenta abrir o mesmo workspace via open_workspace
    Then o backend retorna StorageError::WorkspaceLocked { pid }
    And a UI exibe mensagem "Workspace em uso por outro processo"
    And o carregamento é impedido para evitar corrupção de dados

  Scenario: Sidebar resize respects limits
    Given a Sidebar está visível com largura 260px (padrão)
    When o usuário arrasta o resize handle além do limite mínimo (200px)
    Then a largura é clamped para 200px
    When o usuário arrasta além do limite máximo (400px)
    Then a largura é clamped para 400px
```
