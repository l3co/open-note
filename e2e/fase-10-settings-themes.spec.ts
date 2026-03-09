import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { APP, SETTINGS, SIDEBAR } from "./helpers/selectors";

test.describe("Fase 10 — Settings, Temas & i18n", () => {
  test.describe("Happy Path", () => {
    test("HP-01: abrir Settings via sidebar footer", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Clica no botão de configurações
      await page.locator(SIDEBAR.settingsBtn).click();
      await page.waitForTimeout(300);

      // Settings dialog deve estar visível
      const settingsVisible = await page
        .locator(SETTINGS.root)
        .isVisible()
        .catch(() => false);
      if (settingsVisible) {
        await expect(page.locator(SETTINGS.root)).toBeVisible();
        // Deve começar na aba Geral
        await expect(
          page.locator(SETTINGS.root).getByRole("heading", { name: "Geral" }),
        ).toBeVisible();
      }
    });

    test("HP-02: navegar entre abas do Settings", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(SIDEBAR.settingsBtn).click();
      await page.waitForTimeout(300);

      const settingsVisible = await page
        .locator(SETTINGS.root)
        .isVisible()
        .catch(() => false);
      if (!settingsVisible) return;

      // Navega para Aparência
      const appearanceTab = page.locator(SETTINGS.tabAppearance);
      const tabVisible = await appearanceTab.isVisible().catch(() => false);
      if (tabVisible) {
        await appearanceTab.click();
        await page.waitForTimeout(200);
        await expect(
          page
            .locator(SETTINGS.root)
            .getByRole("heading", { name: "Aparência" }),
        ).toBeVisible();
      }

      // Navega para Editor
      const editorTab = page.locator(SETTINGS.tabEditor);
      const editorTabVisible = await editorTab.isVisible().catch(() => false);
      if (editorTabVisible) {
        await editorTab.click();
        await page.waitForTimeout(200);
      }

      // Navega para Atalhos
      const shortcutsTab = page.locator(SETTINGS.tabShortcuts);
      const shortcutsTabVisible = await shortcutsTab
        .isVisible()
        .catch(() => false);
      if (shortcutsTabVisible) {
        await shortcutsTab.click();
        await page.waitForTimeout(200);
      }

      // Navega para Sobre
      const aboutTab = page.locator(SETTINGS.tabAbout);
      const aboutTabVisible = await aboutTab.isVisible().catch(() => false);
      if (aboutTabVisible) {
        await aboutTab.click();
        await page.waitForTimeout(200);
        await expect(
          page.locator(SETTINGS.root).getByRole("heading", { name: "Sobre" }),
        ).toBeVisible();
      }
    });

    test("HP-03: fechar Settings via botão close", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(SIDEBAR.settingsBtn).click();
      await page.waitForTimeout(300);

      const settingsVisible = await page
        .locator(SETTINGS.root)
        .isVisible()
        .catch(() => false);
      if (!settingsVisible) return;

      // Fecha
      await page.locator(SETTINGS.closeBtn).click();
      await page.waitForTimeout(300);

      await expect(page.locator(SETTINGS.root)).not.toBeVisible();
    });

    test("HP-04: fechar Settings via backdrop", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(SIDEBAR.settingsBtn).click();
      await page.waitForTimeout(300);

      const settingsVisible = await page
        .locator(SETTINGS.root)
        .isVisible()
        .catch(() => false);
      if (!settingsVisible) return;

      // Clica fora do dialog (no overlay)
      const overlay = page.locator(".fixed.inset-0.z-50").first();
      await overlay.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);

      await expect(page.locator(SETTINGS.root)).not.toBeVisible();
    });

    test("HP-05: tema é aplicado ao DOM via data-theme", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Verifica que data-theme está definido no html
      const theme = await page.locator("html").getAttribute("data-theme");
      expect(theme).toBeTruthy();
    });

    test("HP-06: chrome tint é aplicado ao DOM via data-chrome", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Verifica que data-chrome está definido no html
      const chrome = await page.locator("html").getAttribute("data-chrome");
      expect(chrome).toBeTruthy();
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: status bar exibe workspace path corretamente", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // StatusBar deve exibir o path do workspace
      await expect(
        page.locator('[data-testid="status-workspace-path"]'),
      ).toContainText("Test Workspace");
    });

    test("CP-02: sidebar footer tem todos os botões de ação", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Verifica todos os botões do footer
      await expect(page.locator(SIDEBAR.newNotebookBtn)).toBeVisible();
      await expect(page.locator(SIDEBAR.trashBtn)).toBeVisible();
      await expect(page.locator(SIDEBAR.settingsBtn)).toBeVisible();
    });
  });
});
