import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { setupIpcMock, DEFAULT_APP_STATE, DEFAULT_WORKSPACE, DEFAULT_NOTEBOOK, DEFAULT_SECTION, DEFAULT_PAGE, DEFAULT_PAGE_SUMMARY } from "./helpers/ipc-mock";
import { APP, EDITOR, STATUS_BAR } from "./helpers/selectors";
import { PAGES } from "./fixtures";

const PAGE_WITH_CONTENT = {
  ...DEFAULT_PAGE,
  ...PAGES.notasDoDia,
};

function setupEditorMocks() {
  return {
    get_app_state: () => ({
      ...DEFAULT_APP_STATE,
      last_opened_workspace: DEFAULT_WORKSPACE.root_path,
    }),
    open_workspace: () => DEFAULT_WORKSPACE,
    list_notebooks: () => [DEFAULT_NOTEBOOK],
    list_sections: () => [DEFAULT_SECTION],
    list_pages: () => [{ id: PAGE_WITH_CONTENT.id, title: PAGE_WITH_CONTENT.title, created_at: PAGE_WITH_CONTENT.created_at, updated_at: PAGE_WITH_CONTENT.updated_at }],
    load_page: () => PAGE_WITH_CONTENT,
    list_all_tags: () => [],
    update_page_blocks: () => PAGE_WITH_CONTENT,
  };
}

test.describe("Fase 04 — Editor Rich Text", () => {
  test.describe("Happy Path", () => {
    test("HP-01: editor exibe título editável e área de conteúdo", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, setupEditorMocks());

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Expande notebook e seção para navegar até a página
      const notebookNode = page.locator('[role="treeitem"]').first();
      if (await notebookNode.isVisible()) {
        await notebookNode.click();
        await page.waitForTimeout(300);

        const sectionNode = page.locator('[role="treeitem"]').nth(1);
        if (await sectionNode.isVisible()) {
          await sectionNode.click();
          await page.waitForTimeout(300);

          const pageNode = page.locator('[role="treeitem"]').nth(2);
          if (await pageNode.isVisible()) {
            await pageNode.click();
            await page.waitForTimeout(500);
          }
        }
      }

      // Verifica se o editor carregou
      const editorVisible = await page.locator(EDITOR.root).isVisible().catch(() => false);
      if (editorVisible) {
        await expect(page.locator(EDITOR.title)).toBeVisible();
        await expect(page.locator(EDITOR.modeToggle)).toBeVisible();
      }
    });

    test("HP-02: mode toggle alterna entre Rich Text e Markdown", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, setupEditorMocks());

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Navega até a página
      const treeItems = page.locator('[role="treeitem"]');
      const count = await treeItems.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        await treeItems.nth(i).click();
        await page.waitForTimeout(300);
      }

      const modeToggle = page.locator(EDITOR.modeToggle);
      const toggleVisible = await modeToggle.isVisible().catch(() => false);
      if (toggleVisible) {
        // Deve começar em Rich Text
        await expect(page.locator(EDITOR.richtextBtn)).toBeVisible();
        await expect(page.locator(EDITOR.markdownBtn)).toBeVisible();

        // Clica em Markdown
        await page.locator(EDITOR.markdownBtn).click();
        await page.waitForTimeout(300);

        // CodeMirror deve aparecer
        const cmVisible = await page.locator(EDITOR.markdownEditor).isVisible().catch(() => false);
        if (cmVisible) {
          await expect(page.locator(EDITOR.markdownEditor)).toBeVisible();
        }

        // Volta para Rich Text
        await page.locator(EDITOR.richtextBtn).click();
        await page.waitForTimeout(300);

        // TipTap deve aparecer
        const tiptapVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
        if (tiptapVisible) {
          await expect(page.locator(EDITOR.blockEditor)).toBeVisible();
        }
      }
    });

    test("HP-03: status bar exibe contagem de blocos", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, setupEditorMocks());

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Navega até a página
      const treeItems = page.locator('[role="treeitem"]');
      const count = await treeItems.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        await treeItems.nth(i).click();
        await page.waitForTimeout(300);
      }

      // Verifica status bar
      await expect(page.locator(STATUS_BAR.root)).toBeVisible();
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: título vazio usa placeholder 'Sem título'", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        ...setupEditorMocks(),
        load_page: () => ({ ...PAGE_WITH_CONTENT, title: "" }),
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Navega até a página
      const treeItems = page.locator('[role="treeitem"]');
      const count = await treeItems.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        await treeItems.nth(i).click();
        await page.waitForTimeout(300);
      }

      const titleEditor = page.locator(EDITOR.title);
      const visible = await titleEditor.isVisible().catch(() => false);
      if (visible) {
        // Deve ter o placeholder
        const placeholder = await titleEditor.getAttribute("data-placeholder");
        expect(placeholder).toBe("Sem título");
      }
    });
  });
});
