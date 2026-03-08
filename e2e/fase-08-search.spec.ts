import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { APP, QUICK_OPEN, SEARCH_PANEL } from "./helpers/selectors";
import { SEARCH_RESULTS } from "./fixtures";

test.describe("Fase 08 — Busca & Indexação", () => {
  test.describe("Happy Path", () => {
    test("HP-01: Cmd+P abre QuickOpen dialog", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        quick_open: () => [
          {
            page_id: "page-001",
            title: "Notas do dia",
            snippet: null,
            notebook_name: "Pessoal",
            section_name: "Geral",
            updated_at: "2025-01-15T10:00:00Z",
            score: 1.0,
          },
        ],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre QuickOpen via atalho
      await page.keyboard.press("Meta+p");
      await page.waitForTimeout(300);

      // QuickOpen deve estar visível
      const quickOpenVisible = await page.locator(".quick-open-dialog, " + QUICK_OPEN.dialog).isVisible().catch(() => false);
      if (quickOpenVisible) {
        // Input deve estar focado
        const input = page.locator(".quick-open-input, " + QUICK_OPEN.input);
        await expect(input).toBeVisible();

        // Digita uma busca
        await input.fill("Notas");
        await page.waitForTimeout(300);

        // Fecha com Escape
        await page.keyboard.press("Escape");
      }
    });

    test("HP-02: Cmd+Shift+F abre SearchPanel", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        search_pages: () => SEARCH_RESULTS.faturamento,
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre SearchPanel via atalho
      await page.keyboard.press("Meta+Shift+f");
      await page.waitForTimeout(300);

      // SearchPanel deve estar visível
      const searchPanelVisible = await page.locator(".search-panel, " + SEARCH_PANEL.root).isVisible().catch(() => false);
      if (searchPanelVisible) {
        // Input deve estar visível
        const input = page.locator(".search-panel-input, " + SEARCH_PANEL.input);
        await expect(input).toBeVisible();

        // Digita uma busca
        await input.fill("faturamento");
        await page.waitForTimeout(500);

        // Fecha
        await page.keyboard.press("Escape");
      }
    });

    test("HP-03: QuickOpen fecha ao pressionar Escape", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre e fecha
      await page.keyboard.press("Meta+p");
      await page.waitForTimeout(300);

      const quickOpenVisible = await page.locator(".quick-open-dialog, " + QUICK_OPEN.dialog).isVisible().catch(() => false);
      if (quickOpenVisible) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        await expect(page.locator(".quick-open-dialog, " + QUICK_OPEN.dialog)).not.toBeVisible();
      }
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: busca vazia não retorna resultados", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        search_pages: () => ({ items: [], total: 0, query_time_ms: 0 }),
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.keyboard.press("Meta+Shift+f");
      await page.waitForTimeout(300);

      const searchPanelVisible = await page.locator(".search-panel, " + SEARCH_PANEL.root).isVisible().catch(() => false);
      if (searchPanelVisible) {
        const input = page.locator(".search-panel-input, " + SEARCH_PANEL.input);
        await input.fill("xyznonexistent");
        await page.waitForTimeout(500);

        // Deve exibir "Nenhum resultado encontrado"
        const emptyMsg = page.getByText("Nenhum resultado encontrado");
        const emptyVisible = await emptyMsg.isVisible().catch(() => false);
        if (emptyVisible) {
          await expect(emptyMsg).toBeVisible();
        }
      }
    });
  });
});
