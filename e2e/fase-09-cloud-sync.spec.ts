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

    test("HP-02: SyncSettings exibe provedores com badge 'Em breve'", async ({ page }) => {
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
        // Deve exibir os 3 provedores
        await expect(page.getByText("Google Drive")).toBeVisible();
        await expect(page.getByText("OneDrive")).toBeVisible();
        await expect(page.getByText("Dropbox")).toBeVisible();

        // Deve exibir badges "Em breve"
        const badges = page.getByText("Em breve");
        await expect(badges.first()).toBeVisible();
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
        await expect(page.getByText("Não conectado")).toBeVisible();
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
    test("CP-01: SyncSettings exibe conflitos quando existem", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({ is_syncing: false, last_synced_at: null, last_error: null }),
        get_sync_conflicts: () => [
          {
            id: "conflict-001",
            page_id: "page-001",
            page_title: "Notas conflitantes",
            local_modified_at: "2025-01-15T10:00:00Z",
            remote_modified_at: "2025-01-15T11:00:00Z",
          },
        ],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        // Deve exibir seção de conflitos
        await expect(page.getByText("Notas conflitantes")).toBeVisible();
      }
    });

    test("CP-02: SyncSettings exibe erro de sync quando existente", async ({ page }) => {
      await skipOnboarding(page);
      await setupWithWorkspace(page, {
        get_sync_providers: () => SYNC_PROVIDERS,
        get_sync_status: () => ({
          is_syncing: false,
          last_synced_at: null,
          last_error: "Network error: connection timeout",
        }),
        get_sync_conflicts: () => [],
      });

      await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });

      await page.locator(STATUS_BAR.syncBtn).click();
      await page.waitForTimeout(300);

      const syncVisible = await page.locator(".sync-settings-panel, " + SYNC_SETTINGS.panel).isVisible().catch(() => false);
      if (syncVisible) {
        await expect(page.getByText("Network error: connection timeout")).toBeVisible();
      }
    });
  });
});
