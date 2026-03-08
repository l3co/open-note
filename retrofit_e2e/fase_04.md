# Fase 04 - Editor Rich Text

## Feature: TipTap Editor Core Blocks

**Descrição**: Validar o ciclo de escrita estruturada no editor TipTap (formatação, slash commands, auto-save, serialização Block[] ↔ TipTap JSON).

**Componentes envolvidos:** `PageEditor`, `TitleEditor`, `BlockEditor`, `FloatingToolbar` (BubbleMenu), `SlashCommandMenu`, `StatusBar` (save status), `useAutoSave`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Escrevendo no Editor (Rich Text)
  Scenario: Formatando texto com FloatingToolbar
    Given o usuário está editando uma página com texto "Teste de Bold"
    When o usuário seleciona o texto "Teste de Bold"
    Then o FloatingToolbar (BubbleMenu) aparece com opções: Bold, Italic, Underline, Strike, Code, Link, H1-H3, Blockquote
    When o usuário clica no botão Bold (ou usa Cmd+B)
    Then o texto selecionado torna-se visualmente Bold
    And o auto-save é disparado após 1s de debounce

  Scenario: Inserindo bloco via SlashCommandMenu
    Given o cursor está em um bloco de texto vazio
    When o usuário digita "/"
    Then o SlashCommandMenu aparece com 13 opções organizadas por categoria
    When o usuário filtra digitando "tab" e seleciona "Tabela"
    Then uma tabela 3x3 com header é inserida no editor
    And o menu fecha automaticamente

  Scenario: Auto-save persiste alterações
    Given o usuário editou texto na página
    Then o StatusBar mostra status "saving" (accent color)
    And após o debounce de 1s, o IPC update_page_blocks é chamado
    And o StatusBar muda para "saved" (verde)

  Scenario: Editando título da página
    Given o usuário clica no TitleEditor (contenteditable div)
    When o usuário altera o título para "Novo Título"
    And pressiona Enter
    Then o foco move para o BlockEditor
    And o título é salvo via IPC
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Limites e Colisões do Editor
  Scenario: Proteção de limites de blocos (Hard Limit = 500)
    Given uma página com 500 blocos (HARD_BLOCK_LIMIT)
    When o usuário tenta adicionar mais conteúdo via Enter ou SlashCommand
    Then o backend rejeita com CoreError::Validation "Block limit exceeded"
    And o StatusBar mostra warning de tamanho (amarelo, exibido desde 200 blocos — SOFT_BLOCK_LIMIT)

  Scenario: Colagem de HTML pesado (Paste from Word/Web)
    Given o clipboard contém HTML complexo com estilos inline, tabelas aninhadas e imagens base64
    When o usuário cola no editor TipTap
    Then o TipTap faz parse e simplifica para nós suportados (paragraphs, headings, lists, bold, italic)
    And estilos inline não suportados são descartados
    And a UI não trava — o editor mantém responsividade
    And o auto-save persiste o conteúdo sanitizado

  Scenario: Título vazio é rejeitado
    Given o usuário está editando o título da página
    When o usuário apaga todo o texto do título e dá blur
    Then o título reverte para o valor anterior ou exibe placeholder "Sem título"
    And nenhum IPC de save é chamado com título vazio (validação CoreError::Validation)
```
