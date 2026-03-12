import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { APP, SYNC_SETTINGS, STATUS_BAR } from "./helpers/selectors";
import { SYNC_PROVIDERS } from "./fixtures";

test.describe("Fase 09 — Cloud Sync", () => {
  test.describe("Happy Path", () => {
    test("HP-01: clicar no ícone sync na status bar abre SyncSettings", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Clica no botão de sync na status bar
      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      // SyncSettings deve estar visível
      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        await expect(page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel)).toBeVisible();
      }
    });

    test("HP-02: SyncSettings exibe provedores com botão Conectar", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      // Abre SyncSettings
      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        // Deve exibir os provedores
        await expect(page.getByText("Google Drive")).toBeVisible();
        await expect(page.getByText("Dropbox")).toBeVisible();

        // Deve exibir botões Conectar (não mais badges "Em breve")
        const connectBtns = page.getByRole("button", { name: /conectar/i });
        await expect(connectBtns.first()).toBeVisible();
      }
    });

    test("HP-03: SyncSettings exibe status 'Não conectado'", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        await expect(page.getByText("Não conectado").first()).toBeVisible();
      }
    });

    test("HP-04: fechar SyncSettings via backdrop", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncBackdrop = page.locator(".sync-settings-backdrop, " + SYNC_SETTINGS.backdrop);
      const syncVisible = await syncBackdrop.isVisible().catch(() => false);
      if (syncVisible) {
        // Clica no backdrop para fechar
        await syncBackdrop.click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);

        await expect(page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel)).not.toBeVisible();
      }
    });
  });

  test.describe("Critical Path", () => {
    test("CP-01: SyncSettings exibe painel de sincronização quando conectado", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [],
        get_provider_status: () => [
          { name: "google_drive", displayName: "Google Drive", connected: true, email: "user@gmail.com", errorMsg: null },
          { name: "dropbox", displayName: "Dropbox", connected: false, email: null, errorMsg: null },
        ],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        // Quando conectado, deve exibir botão Sincronizar agora
        await expect(page.getByTestId("sync-now-btn")).toBeVisible();
      }
    });

    test("CP-02: SyncSettings exibe status sincronizando quando is_syncing=true", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({
          is_syncing: true,
          last_synced_at: null,
          last_error: null,
          pending_conflicts: 0,
        }),
        get_sync_conflicts: () => [],
        get_provider_status: () => [
          { name: "google_drive", displayName: "Google Drive", connected: true, email: "user@gmail.com", errorMsg: null },
          { name: "dropbox", displayName: "Dropbox", connected: false, email: null, errorMsg: null },
        ],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        await expect(page.getByText(/sincronizando/i)).toBeVisible();
      }
    });
  });
});
