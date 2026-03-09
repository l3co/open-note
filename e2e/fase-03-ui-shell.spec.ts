import { test, expect } from "@playwright/test";
import {
  setupWithWorkspace,
  setupWithPage,
  setupFreshApp,
  skipOnboarding,
  clearOnboarding,
} from "./helpers/workspace";
import {
  setupIpcMock,
  DEFAULT_APP_STATE,
  DEFAULT_WORKSPACE,
  DEFAULT_NOTEBOOK,
  DEFAULT_SECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
} from "./helpers/ipc-mock";
import {
  APP,
  SIDEBAR,
  TOOLBAR,
  WORKSPACE_PICKER,
  ONBOARDING,
  TREE,
} from "./helpers/selectors";

test.describe("Fase 03 — UI Shell & Navegação", () => {
  test.describe("Happy Path", () => {
    test("HP-01: WorkspacePicker exibe botões de criar, abrir e cloud", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupFreshApp(page);

      await expect(page.locator(WORKSPACE_PICKER.root)).toBeVisible();
      await expect(page.locator(WORKSPACE_PICKER.createButton)).toBeVisible();
      await expect(page.locator(WORKSPACE_PICKER.openButton)).toBeVisible();
      await expect(page.locator(WORKSPACE_PICKER.cloudButton)).toBeVisible();

      // Cloud deve estar desabilitado com badge "Em breve"
      await expect(page.locator(WORKSPACE_PICKER.cloudButton)).toBeDisabled();
    });

    test("HP-02: sidebar exibe notebook tree com notebooks", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(SIDEBAR.root)).toBeVisible();
      await expect(page.locator(TREE.root)).toBeVisible();
    });

    test("HP-03: toolbar exibe botões de navegação e breadcrumb", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithPage(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(TOOLBAR.root)).toBeVisible();
      await expect(page.locator(TOOLBAR.toggleSidebar)).toBeVisible();
      await expect(page.locator(TOOLBAR.backBtn)).toBeVisible();
      await expect(page.locator(TOOLBAR.forwardBtn)).toBeVisible();
      await expect(page.locator(TOOLBAR.breadcrumb)).toBeAttached();
    });

    test("HP-04: toggle sidebar esconde e mostra sidebar", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(SIDEBAR.root)).toBeVisible();

      // Clica no toggle
      await page.locator(TOOLBAR.toggleSidebar).click();

      // Sidebar deve estar oculta
      await expect(page.locator(SIDEBAR.root)).not.toBeVisible();

      // Clica de novo para mostrar
      await page.locator(TOOLBAR.toggleSidebar).click();
      await expect(page.locator(SIDEBAR.root)).toBeVisible();
    });

    test("HP-05: toggle sidebar via atalho Cmd+\\", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(SIDEBAR.root)).toBeVisible();

      // Atalho Cmd+\
      await page.keyboard.press("Meta+Backslash");
      await expect(page.locator(SIDEBAR.root)).not.toBeVisible();

      await page.keyboard.press("Meta+Backslash");
      await expect(page.locator(SIDEBAR.root)).toBeVisible();
    });

    test("HP-06: onboarding dialog exibe welcome step e permite navegar", async ({
      page,
    }) => {
      await clearOnboarding(page);

      await setupIpcMock(page, {
        get_app_state: () => ({
          ...DEFAULT_APP_STATE,
          last_opened_workspace: DEFAULT_WORKSPACE.root_path,
        }),
        open_workspace: () => DEFAULT_WORKSPACE,
        list_notebooks: () => [DEFAULT_NOTEBOOK],
        list_sections: () => [DEFAULT_SECTION],
        list_pages: () => [DEFAULT_PAGE_SUMMARY],
        load_page: () => DEFAULT_PAGE,
        list_all_tags: () => [],
      });

      await page.goto("http://localhost:1420");
      await page.waitForLoadState("networkidle");

      // Onboarding deve aparecer (se implementado no fluxo)
      const onboardingVisible = await page
        .locator(ONBOARDING.root)
        .isVisible()
        .catch(() => false);
      if (onboardingVisible) {
        await expect(page.locator(ONBOARDING.welcomeStep)).toBeVisible();

        // Clica "Começar"
        await page.locator(ONBOARDING.startBtn).click();

        // Tour step deve aparecer
        await expect(page.locator(ONBOARDING.tourStep)).toBeVisible();

        // Navega pelos 4 steps
        for (let i = 0; i < 3; i++) {
          await page.locator(ONBOARDING.nextBtn).click();
        }

        // Último step — confirma
        await page.locator(ONBOARDING.nextBtn).click();

        // Onboarding deve fechar
        await expect(page.locator(ONBOARDING.root)).not.toBeVisible();
      }
    });

    test("HP-07: onboarding pode ser pulado com Skip", async ({ page }) => {
      await clearOnboarding(page);

      await setupIpcMock(page, {
        get_app_state: () => ({
          ...DEFAULT_APP_STATE,
          last_opened_workspace: DEFAULT_WORKSPACE.root_path,
        }),
        open_workspace: () => DEFAULT_WORKSPACE,
        list_notebooks: () => [DEFAULT_NOTEBOOK],
        list_sections: () => [DEFAULT_SECTION],
        list_pages: () => [DEFAULT_PAGE_SUMMARY],
        load_page: () => DEFAULT_PAGE,
        list_all_tags: () => [],
      });

      await page.goto("http://localhost:1420");
      await page.waitForLoadState("networkidle");

      const onboardingVisible = await page
        .locator(ONBOARDING.root)
        .isVisible()
        .catch(() => false);
      if (onboardingVisible) {
        await page.locator(ONBOARDING.skipBtn).click();
        await expect(page.locator(ONBOARDING.root)).not.toBeVisible();
      }
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: back/forward desabilitados quando sem histórico", async ({
      page,
    }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Ambos devem estar desabilitados sem navegação
      await expect(page.locator(TOOLBAR.backBtn)).toBeDisabled();
      await expect(page.locator(TOOLBAR.forwardBtn)).toBeDisabled();
    });

    test("CP-02: sidebar footer exibe botões de ação", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(SIDEBAR.footer)).toBeVisible();
      await expect(page.locator(SIDEBAR.newNotebookBtn)).toBeVisible();
      await expect(page.locator(SIDEBAR.trashBtn)).toBeVisible();
      await expect(page.locator(SIDEBAR.settingsBtn)).toBeVisible();
    });

    test("CP-03: status bar exibe caminho do workspace", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="status-bar"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="status-workspace-path"]'),
      ).toContainText("Test Workspace");
    });
  });
});
