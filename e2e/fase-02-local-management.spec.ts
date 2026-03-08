import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { setupIpcMock, DEFAULT_APP_STATE, DEFAULT_WORKSPACE, DEFAULT_NOTEBOOK, DEFAULT_SECTION, DEFAULT_PAGE, DEFAULT_PAGE_SUMMARY } from "./helpers/ipc-mock";
import { SIDEBAR, TREE, CREATE_DIALOG, DELETE_DIALOG, TRASH_PANEL, APP } from "./helpers/selectors";
import { TRASH_ITEMS } from "./fixtures";

test.describe("Fase 02 — Gerenciamento Local", () => {
  test.describe("Happy Path", () => {
    test("HP-01: criar notebook via sidebar footer", async ({ page }) => {
      await skipOnboarding(page);

      let notebookCreated = false;
      await setupIpcMock(page, {
        get_app_state: () => ({
          ...DEFAULT_APP_STATE,
          last_opened_workspace: DEFAULT_WORKSPACE.root_path,
        }),
        open_workspace: () => DEFAULT_WORKSPACE,
        list_notebooks: () => notebookCreated
          ? [DEFAULT_NOTEBOOK, { ...DEFAULT_NOTEBOOK, id: "nb-novo", name: "Novo Notebook", sort_order: 1 }]
          : [DEFAULT_NOTEBOOK],
        list_sections: () => [DEFAULT_SECTION],
        list_pages: () => [DEFAULT_PAGE_SUMMARY],
        load_page: () => DEFAULT_PAGE,
        list_all_tags: () => [],
        create_notebook: () => {
          notebookCreated = true;
          return { ...DEFAULT_NOTEBOOK, id: "nb-novo", name: "Novo Notebook", sort_order: 1 };
        },
      });

      await page.goto("http://localhost:1420");
      await page.waitForLoadState("networkidle");

      // Espera o layout principal carregar
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Clica no botão de novo notebook no footer
      await page.locator(SIDEBAR.newNotebookBtn).click();

      // Dialog de criação deve aparecer
      await expect(page.locator(CREATE_DIALOG.input)).toBeVisible();

      // Preenche o nome e confirma
      await page.locator(CREATE_DIALOG.input).fill("Novo Notebook");
      await page.locator(CREATE_DIALOG.confirmBtn).click();

      // Dialog deve fechar
      await expect(page.locator(CREATE_DIALOG.input)).not.toBeVisible({ timeout: 5000 });
    });

    test("HP-02: sidebar exibe notebooks e seções", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Tree deve ter itens
      await expect(page.locator(TREE.root)).toBeVisible();
    });

    test("HP-03: abrir lixeira e ver itens", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        list_trash_items: () => [TRASH_ITEMS.deletedPage],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Clica no botão de lixeira
      await page.locator(SIDEBAR.trashBtn).click();

      // Trash panel deve aparecer com itens
      await expect(page.locator('[role="dialog"]').filter({ hasText: "Lixeira" })).toBeVisible();
    });

    test("HP-04: lixeira vazia exibe estado vazio", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        list_trash_items: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Clica no botão de lixeira
      await page.locator(SIDEBAR.trashBtn).click();

      // Deve exibir mensagem de lixeira vazia
      await expect(page.getByText("Nenhum item na lixeira")).toBeVisible();
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: campo vazio no create dialog exibe erro", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre dialog de criação
      await page.locator(SIDEBAR.newNotebookBtn).click();
      await expect(page.locator(CREATE_DIALOG.input)).toBeVisible();

      // Tenta criar sem nome
      await page.locator(CREATE_DIALOG.confirmBtn).click();

      // Erro deve aparecer
      await expect(page.locator(CREATE_DIALOG.error)).toBeVisible();
    });

    test("CP-02: cancelar create dialog fecha sem criar", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre dialog de criação
      await page.locator(SIDEBAR.newNotebookBtn).click();
      await expect(page.locator(CREATE_DIALOG.input)).toBeVisible();

      // Cancela
      await page.locator(CREATE_DIALOG.cancelBtn).click();

      // Dialog deve fechar
      await expect(page.locator(CREATE_DIALOG.input)).not.toBeVisible();
    });
  });
});
