# Fase 06 - Modo Markdown

## Feature: Troca de Modo e Conversão RichText ↔ Markdown

**Descrição**: Validar o toggle entre modo RichText (TipTap) e modo Markdown (CodeMirror 6), a conversão bidirecional via `tiptapToMarkdown` / `markdownToTiptap`, e a persistência da preferência do editor.

**Componentes envolvidos:** `EditorModeToggle`, `PageEditor`, `BlockEditor` (TipTap), `MarkdownEditor` (CodeMirror 6)

**Funções de conversão:** `tiptapToMarkdown()` e `markdownToTiptap()` em `src/lib/markdown.ts`

### Caminho Feliz (Happy Path)
```gherkin
Feature: Toggle de Visão entre Modos de Editor
  Scenario: Troca de RichText para Markdown sem perda de conteúdo
    Given a página está no modo "richtext" com texto formatado (headings, bold, listas)
    When o usuário clica no toggle "Markdown" no EditorModeToggle
    Then o BlockEditor (TipTap) é substituído pelo MarkdownEditor (CodeMirror)
    And o conteúdo é convertido para sintaxe Markdown via tiptapToMarkdown()
    And headings aparecem como "# Título", bold como "**texto**", etc.

  Scenario: Troca de Markdown para RichText preserva estrutura
    Given o usuário editou Markdown raw no CodeMirror
    When o usuário clica no toggle "Rich Text" no EditorModeToggle
    Then o MarkdownEditor é substituído pelo BlockEditor (TipTap)
    And o conteúdo é convertido de volta via markdownToTiptap()
    And a formatação visual (headings, bold, listas) é restaurada
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Edge cases de conversão (RichText ↔ MD)
  Scenario: Callout e blocos complexos no modo Markdown
    Given a página contém CalloutBlocks e CodeBlocks no modo RichText
    When o usuário troca para modo Markdown
    Then Callouts são representados como HTML comments (<!-- opn:callout variant="warning" -->)
    And CodeBlocks usam fenced code blocks com linguagem (```javascript)
    When o usuário volta para RichText
    Then os Callouts e CodeBlocks são reconvertidos para nós TipTap corretos

  Scenario: Markdown malformado no CodeMirror
    Given o usuário digita Markdown com sintaxe inválida no CodeMirror (ex: "# " sem texto, tabelas incompletas)
    When o usuário troca para modo RichText
    Then o parser markdownToTiptap() trata graciosamente o input
    And nenhum crash ou tela branca ocorre
    And conteúdo não reconhecido é preservado como parágrafo plain text
```

> **⚠️ Não implementado:**
> - **Export .md para disco:** A função `tiptapToMarkdown()` existe e converte em memória, mas não há UI nem IPC para salvar o arquivo `.md` no filesystem. Requer: IPC `save_file_content` + dialog Tauri `save` para escolher destino.
> - **Import .md de arquivo:** A função `markdownToTiptap()` existe e faz parse em memória, mas não há UI nem IPC de importação. Requer: IPC `read_file_content` + dialog Tauri `open` para selecionar arquivo + conversão + criação de page.
> - Cenários de export/import serão adicionados quando essas features forem implementadas.
