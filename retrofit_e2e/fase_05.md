# Fase 05 - Blocos Avançados

## Feature: Estruturas complexas (Code, Checklist, Table, Image, Callout)

**Descrição**: Validar os blocos avançados do TipTap: CodeBlock (syntax highlighting), TaskList (checklist), Table (resizable), Image (via URL), Callout (5 variantes), e a persistência via auto-save.

**Componentes envolvidos:** `BlockEditor` (TipTap extensions), `SlashCommandMenu` (13 comandos), `InkBlockComponent`, `PdfBlockComponent`

**Extensions TipTap:** `CodeBlockLowlight`, `Table`/`TableRow`/`TableCell`/`TableHeader`, `TaskList`/`TaskItem`, `Image`, `CalloutExtension`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Blocos avançados no Editor
  Scenario: Inserindo imagem via URL
    Given o cursor está em um bloco vazio
    When o usuário digita "/" e seleciona "Imagem"
    Then um prompt solicita a URL da imagem
    When o usuário informa "https://example.com/diagrama.png"
    Then a imagem é renderizada inline no editor
    And o auto-save persiste o bloco com src no TipTap JSON

  Scenario: Ciclo de Checklist (TaskList)
    Given o usuário inseriu uma Checklist via SlashCommand
    When adiciona 3 tarefas e marca 1 como concluída (clicando no checkbox)
    Then a UI atualiza imediatamente — item checked fica com strikethrough e opacity
    And o auto-save persiste o estado checked no TipTap JSON (attrs.checked: true)

  Scenario: CodeBlock com syntax highlighting
    Given o usuário inseriu um bloco de Código via SlashCommand
    When digita código JavaScript no bloco
    Then o syntax highlighting (lowlight) colore tokens (keywords, strings, comments)
    And o idioma padrão é "plaintext"

  Scenario: Tabela com header row
    Given o usuário inseriu uma Tabela via SlashCommand
    Then uma tabela 3x3 com header row é criada
    And as colunas são resizable (drag no column-resize-handle)
    And o conteúdo da tabela é editável célula por célula

  Scenario: Callout com variante info
    Given o usuário inseriu um Callout via SlashCommand
    Then um bloco callout com variante "info" é criado (ícone + background azul)
    And o conteúdo do callout é editável
```

> **⚠️ Não implementado:** Image file picker via Tauri dialog (usa URL prompt). Funcionalidades pendentes: paste/drag image, image resize handles, language selector no CodeBlock, callout variant dropdown.

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência de blocos avançados
  Scenario: Imagem com URL quebrada
    Given um bloco de Imagem aponta para uma URL que retorna 404
    When a página é renderizada
    Then o bloco de imagem exibe o alt text ou placeholder de fallback
    And o editor não quebra — os demais blocos renderizam normalmente

  Scenario: Tabela com conteúdo excessivo
    Given uma tabela com 20 linhas e 10 colunas preenchidas
    When o usuário navega e edita as células
    Then o editor mantém responsividade sem lag perceptível
    And o auto-save persiste toda a estrutura da tabela

  Scenario: Deletando bloco que contém asset
    Given o usuário deleta um ImageBlock
    When a page é salva via auto-save
    Then o bloco é removido do TipTap JSON
    And o auto-save persiste a página sem o bloco
```

> **⚠️ Não implementado:** Rotina de limpeza de assets órfãos (quando imagem é deletada do editor, o arquivo físico em `assets/` não é limpo automaticamente — funcionalidade futura).
