import { test, expect } from "@playwright/test";
import { setupFreshApp, setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { APP, WORKSPACE_PICKER } from "./helpers/selectors";
import { APP_STATE_WITH_RECENTS } from "./fixtures";

test.describe("Fase 01 — Inicialização do App", () => {
  test.describe("Happy Path", () => {
    test("HP-01: exibe loading e depois WorkspacePicker quando não há workspace", async ({ page }) => {
      await skipOnboarding(page);
      await setupFreshApp(page);

      // WorkspacePicker deve estar visível
      await expect(page.locator(WORKSPACE_PICKER.root)).toBeVisible();
      await expect(page.locator(WORKSPACE_PICKER.title)).toHaveText("Open Note");
    });

    test("HP-02: restaura último workspace ao iniciar", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page);

      // App principal deve estar visível (não o WorkspacePicker)
      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
      await expect(page.locator(WORKSPACE_PICKER.root)).not.toBeVisible();
    });

    test("HP-03: exibe workspaces recentes no WorkspacePicker", async ({ page }) => {
      await skipOnboarding(page);
      await setupFreshApp(page);

      // Simula estado com recentes — precisamos de um mock com recentes
      await page.addInitScript((state) => {
        const tauriMock = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as Record<string, unknown>;
        if (tauriMock) {
          const originalInvoke = tauriMock.invoke as (...args: unknown[]) => unknown;
          tauriMock.invoke = (cmd: string, args?: Record<string, unknown>) => {
            if (cmd === "get_app_state") return Promise.resolve(structuredClone(state));
            return (originalInvoke as (cmd: string, args?: Record<string, unknown>) => unknown)(cmd, args);
          };
        }
      }, APP_STATE_WITH_RECENTS);

      await page.reload();
      await page.waitForLoadState("networkidle");

      await expect(page.locator(WORKSPACE_PICKER.root)).toBeVisible();
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: exibe WorkspacePicker quando get_app_state falha", async ({ page }) => {
      await skipOnboarding(page);

      // Mock get_app_state para rejeitar
      const { setupIpcMock } = await import("./helpers/ipc-mock");
      await setupIpcMock(page, {
        get_app_state: () => { throw new Error("Corrupted state"); },
      });

      await page.goto("http://localhost:1420");
      await page.waitForLoadState("networkidle");

      // App deve fallback para WorkspacePicker
      await expect(page.locator(WORKSPACE_PICKER.root)).toBeVisible({ timeout: 10000 });
    });

    test("CP-02: exibe WorkspacePicker quando last_opened_workspace falha ao abrir", async ({ page }) => {
      await skipOnboarding(page);

      const { setupIpcMock, DEFAULT_APP_STATE } = await import("./helpers/ipc-mock");
      await setupIpcMock(page, {
        get_app_state: () => ({
          ...DEFAULT_APP_STATE,
          last_opened_workspace: "/tmp/nonexistent-workspace",
        }),
        open_workspace: () => { throw new Error("Workspace not found"); },
      });

      await page.goto("http://localhost:1420");
      await page.waitForLoadState("networkidle");

      // App deve fallback para WorkspacePicker
      await expect(page.locator(WORKSPACE_PICKER.root)).toBeVisible({ timeout: 10000 });
    });
  });
});
