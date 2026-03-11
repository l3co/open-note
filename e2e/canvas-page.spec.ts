import { test, expect } from "@playwright/test";
import {
  setupWithWorkspace,
  skipOnboarding,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
} from "./helpers/workspace";
import { APP, TREE } from "./helpers/selectors";

const CANVAS_PAGE_ID = "page-canvas-001";
const CANVAS_PAGE = {
  ...DEFAULT_PAGE,
  id: CANVAS_PAGE_ID,
  title: "Canvas sem título",
  canvas_state: null,
  pdf_asset: null,
  pdf_total_pages: null,
  editor_preferences: { mode: "canvas", split_view: false },
};
const CANVAS_PAGE_SUMMARY = {
  id: CANVAS_PAGE_ID,
  title: "Canvas sem título",
  tags: [],
  mode: "canvas",
  block_count: 0,
  created_at: CANVAS_PAGE.created_at,
  updated_at: CANVAS_PAGE.updated_at,
};

test.describe("Canvas Page (Excalidraw Integration)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    let canvasCreated = false;
    await setupWithWorkspace(page, {
      create_canvas_page: () => {
        canvasCreated = true;
        return CANVAS_PAGE;
      },
      list_pages: () =>
        canvasCreated
          ? [DEFAULT_PAGE_SUMMARY, CANVAS_PAGE_SUMMARY]
          : [DEFAULT_PAGE_SUMMARY],
      load_page: (args: unknown) => {
        const id = (args as { pageId?: string }).pageId ?? "";
        return id === CANVAS_PAGE_ID ? CANVAS_PAGE : DEFAULT_PAGE;
      },
    });
    await expect(page.locator(APP.main)).toBeVisible({ timeout: 15000 });
  });

  test("criar página canvas e verificar que abre o Excalidraw", async ({ page }) => {
    // Aguardar notebook carregar na árvore e expandir
    await expect(page.locator(TREE.notebookItem).first()).toBeVisible({ timeout: 10000 });
    await page.locator(TREE.notebookItem).first().locator('[role="button"]').first().click();
    await expect(page.locator(TREE.sectionItem).first()).toBeVisible({ timeout: 5000 });
    await page.locator(TREE.sectionItem).first().locator('[role="button"]').first().click();

    // Clicar no botão "Nova Página Canvas" na SectionOverview
    const newCanvasBtn = page.locator('[data-testid="new-canvas-page-btn"]');
    await expect(newCanvasBtn).toBeVisible({ timeout: 10000 });
    await newCanvasBtn.click();

    // Verificar que o Excalidraw foi carregado (lazy load)
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });

    // Verificar título padrão
    await expect(page.getByTestId("title-editor")).toHaveText(
      /canvas sem título|untitled canvas/i,
    );
  });

  test("estado do canvas persiste após auto-save", async ({ page }) => {
    // Criar página canvas
    await expect(page.locator(TREE.notebookItem).first()).toBeVisible({ timeout: 10000 });
    await page.locator(TREE.notebookItem).first().locator('[role="button"]').first().click();
    await expect(page.locator(TREE.sectionItem).first()).toBeVisible({ timeout: 5000 });
    await page.locator(TREE.sectionItem).first().locator('[role="button"]').first().click();
    await page.locator('[data-testid="new-canvas-page-btn"]').click();
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });

    // Interagir com o canvas (desenhar um retângulo via atalho 'r')
    await page.locator(".excalidraw").click();
    await page.keyboard.press("r");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(600, 550);
    await page.mouse.up();

    // Aguardar auto-save (1.5s + margem)
    await page.waitForTimeout(3000);

    // Navegar para a página richtext e verificar que Excalidraw sumiu
    await page.locator(TREE.pageItem).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator(".excalidraw")).not.toBeVisible();

    // Voltar para a página canvas
    await page.locator(TREE.pageItem).nth(1).click();

    // Verificar que o Excalidraw carregou
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });
    const canvasElements = page.locator(".excalidraw canvas");
    await expect(canvasElements.first()).toBeVisible();
  });
});
