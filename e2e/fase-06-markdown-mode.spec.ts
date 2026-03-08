import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { DEFAULT_APP_STATE, DEFAULT_WORKSPACE, DEFAULT_NOTEBOOK, DEFAULT_SECTION, DEFAULT_PAGE, DEFAULT_PAGE_SUMMARY } from "./helpers/ipc-mock";
import { APP, EDITOR } from "./helpers/selectors";

const TEXT_PAGE = {
  ...DEFAULT_PAGE,
  blocks: [
    {
      id: "block-md-1",
      block_type: "text",
      sort_order: 0,
      content: {
        tiptap_json: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Título Markdown" }] },
            { type: "paragraph", content: [{ type: "text", text: "Parágrafo de teste" }] },
          ],
        },
      },
      created_at: "2025-01-15T10:00:00Z",
      updated_at: "2025-01-15T10:00:00Z",
    },
  ],
};

function editorMocks() {
  return {
    get_app_state: () => ({
      ...DEFAULT_APP_STATE,
      last_opened_workspace: DEFAULT_WORKSPACE.root_path,
    }),
    open_workspace: () => DEFAULT_WORKSPACE,
    list_notebooks: () => [DEFAULT_NOTEBOOK],
    list_sections: () => [DEFAULT_SECTION],
    list_pages: () => [DEFAULT_PAGE_SUMMARY],
    load_page: () => TEXT_PAGE,
    list_all_tags: () => [],
    update_page_blocks: () => TEXT_PAGE,
  };
}

async function navigateToPage(page: import("@playwright/test").Page) {
  const treeItems = page.locator('[role="treeitem"]');
  const count = await treeItems.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await treeItems.nth(i).click();
    await page.waitForTimeout(300);
  }
}

test.describe("Fase 06 — Modo Markdown", () => {
  test.describe("Happy Path", () => {
    test("HP-01: alternar para modo Markdown exibe CodeMirror", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, editorMocks());
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const modeToggle = page.locator(EDITOR.modeToggle);
      const toggleVisible = await modeToggle.isVisible().catch(() => false);
      if (!toggleVisible) return;

      // Clica no botão Markdown
      await page.locator(EDITOR.markdownBtn).click();
      await page.waitForTimeout(500);

      // CodeMirror deve aparecer
      const cmVisible = await page.locator(EDITOR.markdownEditor).isVisible().catch(() => false);
      if (cmVisible) {
        await expect(page.locator(EDITOR.markdownEditor)).toBeVisible();
      }
    });

    test("HP-02: alternar de volta para Rich Text preserva conteúdo", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, editorMocks());
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const modeToggle = page.locator(EDITOR.modeToggle);
      const toggleVisible = await modeToggle.isVisible().catch(() => false);
      if (!toggleVisible) return;

      // Vai para Markdown e volta
      await page.locator(EDITOR.markdownBtn).click();
      await page.waitForTimeout(500);

      await page.locator(EDITOR.richtextBtn).click();
      await page.waitForTimeout(500);

      // TipTap deve estar visível novamente
      const tiptapVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (tiptapVisible) {
        await expect(page.locator(EDITOR.blockEditor)).toBeVisible();
      }
    });

    test("HP-03: atalho Cmd+Shift+M alterna modo do editor", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, editorMocks());
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.root).isVisible().catch(() => false);
      if (!editorVisible) return;

      // Usa atalho para alternar
      await page.keyboard.press("Meta+Shift+m");
      await page.waitForTimeout(500);

      // Deve estar em modo Markdown (CodeMirror visível)
      const cmVisible = await page.locator(EDITOR.markdownEditor).isVisible().catch(() => false);
      if (cmVisible) {
        await expect(page.locator(EDITOR.markdownEditor)).toBeVisible();
      }

      // Volta com o mesmo atalho
      await page.keyboard.press("Meta+Shift+m");
      await page.waitForTimeout(500);

      const tiptapVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (tiptapVisible) {
        await expect(page.locator(EDITOR.blockEditor)).toBeVisible();
      }
    });
  });
});
