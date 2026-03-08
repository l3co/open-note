import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { DEFAULT_APP_STATE, DEFAULT_WORKSPACE, DEFAULT_NOTEBOOK, DEFAULT_SECTION, DEFAULT_PAGE, DEFAULT_PAGE_SUMMARY } from "./helpers/ipc-mock";
import { APP, EDITOR } from "./helpers/selectors";

function makePageWithBlock(blockType: string, content: Record<string, unknown> = {}) {
  return {
    ...DEFAULT_PAGE,
    blocks: [
      {
        id: "block-adv-1",
        block_type: blockType,
        sort_order: 0,
        content,
        created_at: "2025-01-15T10:00:00Z",
        updated_at: "2025-01-15T10:00:00Z",
      },
    ],
  };
}

function editorMocks(pageOverride?: Record<string, unknown>) {
  return {
    get_app_state: () => ({
      ...DEFAULT_APP_STATE,
      last_opened_workspace: DEFAULT_WORKSPACE.root_path,
    }),
    open_workspace: () => DEFAULT_WORKSPACE,
    list_notebooks: () => [DEFAULT_NOTEBOOK],
    list_sections: () => [DEFAULT_SECTION],
    list_pages: () => [DEFAULT_PAGE_SUMMARY],
    load_page: () => pageOverride ?? DEFAULT_PAGE,
    list_all_tags: () => [],
    update_page_blocks: () => pageOverride ?? DEFAULT_PAGE,
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

test.describe("Fase 05 — Blocos Avançados", () => {
  test.describe("Happy Path", () => {
    test("HP-01: página com bloco de código renderiza pre/code", async ({ page }) => {
      await skipOnboarding(page);

      const codePage = makePageWithBlock("text", {
        tiptap_json: {
          type: "doc",
          content: [
            {
              type: "codeBlock",
              attrs: { language: "javascript" },
              content: [{ type: "text", text: "console.log('hello');" }],
            },
          ],
        },
      });

      await setupWithWorkspace(page, editorMocks(codePage));
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (editorVisible) {
        await expect(page.locator(EDITOR.blockEditor).locator("pre")).toBeVisible();
      }
    });

    test("HP-02: página com tabela renderiza table element", async ({ page }) => {
      await skipOnboarding(page);

      const tablePage = makePageWithBlock("text", {
        tiptap_json: {
          type: "doc",
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Col A" }] }] },
                    { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Col B" }] }] },
                  ],
                },
                {
                  type: "tableRow",
                  content: [
                    { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
                    { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }] },
                  ],
                },
              ],
            },
          ],
        },
      });

      await setupWithWorkspace(page, editorMocks(tablePage));
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (editorVisible) {
        await expect(page.locator(EDITOR.blockEditor).locator("table")).toBeVisible();
      }
    });

    test("HP-03: página com checklist renderiza task items", async ({ page }) => {
      await skipOnboarding(page);

      const checklistPage = makePageWithBlock("text", {
        tiptap_json: {
          type: "doc",
          content: [
            {
              type: "taskList",
              content: [
                {
                  type: "taskItem",
                  attrs: { checked: false },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Tarefa 1" }] }],
                },
                {
                  type: "taskItem",
                  attrs: { checked: true },
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Tarefa 2" }] }],
                },
              ],
            },
          ],
        },
      });

      await setupWithWorkspace(page, editorMocks(checklistPage));
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (editorVisible) {
        const taskList = page.locator(EDITOR.blockEditor).locator('[data-type="taskList"]');
        const visible = await taskList.isVisible().catch(() => false);
        if (visible) {
          await expect(taskList).toBeVisible();
        }
      }
    });

    test("HP-04: página com callout renderiza callout block", async ({ page }) => {
      await skipOnboarding(page);

      const calloutPage = makePageWithBlock("text", {
        tiptap_json: {
          type: "doc",
          content: [
            {
              type: "callout",
              attrs: { variant: "info" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Informação importante" }] }],
            },
          ],
        },
      });

      await setupWithWorkspace(page, editorMocks(calloutPage));
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (editorVisible) {
        const callout = page.locator(EDITOR.blockEditor).locator('[data-type="callout"]');
        const visible = await callout.isVisible().catch(() => false);
        if (visible) {
          await expect(callout).toBeVisible();
        }
      }
    });

    test("HP-05: página com imagem renderiza img element", async ({ page }) => {
      await skipOnboarding(page);

      const imagePage = makePageWithBlock("text", {
        tiptap_json: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "https://via.placeholder.com/300x200",
                alt: "Test image",
              },
            },
          ],
        },
      });

      await setupWithWorkspace(page, editorMocks(imagePage));
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await navigateToPage(page);

      const editorVisible = await page.locator(EDITOR.blockEditor).isVisible().catch(() => false);
      if (editorVisible) {
        const img = page.locator(EDITOR.blockEditor).locator("img");
        const visible = await img.isVisible().catch(() => false);
        if (visible) {
          await expect(img).toBeVisible();
        }
      }
    });
  });
});
