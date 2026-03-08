# Fase 02 - Modelo de Domínio & Storage

## Feature: Gerenciamento Local de Arquivos

**Descrição**: Validar o armazenamento no Filesystem via Rust Backend (IPC commands), lixeira (soft-delete), e metadados.

**Componentes envolvidos:** `NotebookTree`, `CreateDialog`, `DeleteDialog`, `TrashPanel`, IPC (`createNotebook`, `createPage`, `deletePage`, `listTrashItems`, `restoreFromTrash`)

### Caminho Feliz (Happy Path)
```gherkin
Feature: Criando Notebooks e Pages
  Scenario: Criar uma nova Page via UI
    Given o usuário está em um Notebook com uma Section selecionada
    When ele clica com botão direito na Section e seleciona "Nova Página"
    And informa o título "Reunião de Vendas"
    Then o aplicativo abre a página para edição no ContentArea
    And a página aparece na árvore da Sidebar (NotebookTree)
    And o StatusBar exibe o save status

  Scenario: Exclusão lógica movendo para a lixeira
    Given o usuário seleciona a página "Reunião de Vendas" na Sidebar
    When o usuário clica com botão direito e seleciona "Mover para Lixeira"
    And confirma no DeleteDialog
    Then a página desaparece da lista do Notebook na Sidebar
    And ao abrir o TrashPanel (botão lixeira no SidebarFooter), a página aparece na lista
    And o TrashPanel oferece opções de "Restaurar" e "Excluir Permanentemente"
```

**Nota:** O storage usa slug generation com normalização Unicode (via `unicode-normalization` crate). O nome do arquivo físico é um slug derivado do título + UUID para evitar colisões (ex: `reuniao-de-vendas-a1b2c3.opn.json`).

### Caminho Crítico (Critical Path)
```gherkin
Feature: Tratamento de arquivos corrompidos e colisões
  Scenario: Tentativa de carregamento de Notebook corrompido
    Given um arquivo "notebook.json" existente foi corrompido manualmente no filesystem
    When o aplicativo tenta montar o Workspace via open_workspace IPC
    Then o backend Rust não deve panic
    And o frontend recebe um erro via catch no IPC
    And a UI exibe mensagem de erro legível, sem tela branca

  Scenario: Criação de Notebook com nome duplicado
    Given que já existe um Notebook chamado "Projetos de Design"
    When o usuário tenta criar outro Notebook com o mesmo nome via CreateDialog
    Then o backend retorna erro (StorageError) pois o diretório/slug colide
    And a UI exibe Toast de erro informando a duplicação
    And nenhum dado existente é corrompido ou sobrescrito
```
