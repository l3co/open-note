import { test, expect } from "@playwright/test";
import {
  setupIpcMock,
  DEFAULT_APP_STATE,
  DEFAULT_WORKSPACE,
  DEFAULT_NOTEBOOK,
  DEFAULT_SECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
} from "./helpers/ipc-mock";
import { APP, SIDEBAR } from "./helpers/selectors";

const WS_A = {
  id: "ws-a",
  name: "Workspace A",
  root_path: "/tmp/ws-a",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const WS_B = {
  id: "ws-b",
  name: "Workspace B",
  root_path: "/tmp/ws-b",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const APP_STATE_WITH_WS_A = {
  ...DEFAULT_APP_STATE,
  schema_version: 2,
  last_opened_workspace: WS_A.root_path,
  active_workspaces: [
    { id: WS_A.id, path: WS_A.root_path, name: WS_A.name, opened_at: new Date().toISOString() },
  ],
  focused_workspace_id: WS_A.id,
};

const APP_STATE_TWO_WORKSPACES = {
  ...DEFAULT_APP_STATE,
  schema_version: 2,
  last_opened_workspace: WS_A.root_path,
  active_workspaces: [
    { id: WS_A.id, path: WS_A.root_path, name: WS_A.name, opened_at: new Date().toISOString() },
    { id: WS_B.id, path: WS_B.root_path, name: WS_B.name, opened_at: new Date().toISOString() },
  ],
  focused_workspace_id: WS_A.id,
};

async function gotoApp(page: Parameters<typeof setupIpcMock>[0]) {
  await page.goto("http://localhost:1420");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(APP.main)).toBeVisible({ timeout: 10000 });
}

test.describe("Multi-Workspace — Fluxos Básicos", () => {
  test("MW-01: workspace switcher mostra nome do workspace focused", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_WITH_WS_A,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [{ id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path }],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    const switcher = page.getByTestId("workspace-switcher-name");
    await expect(switcher).toBeVisible({ timeout: 5000 });
    await expect(switcher).toHaveText(/Workspace A/i);
  });

  test("MW-02: switcher exibe todos os workspaces abertos no popover", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_TWO_WORKSPACES,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [
        { id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path },
        { id: WS_B.id, name: WS_B.name, root_path: WS_B.root_path },
      ],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    await page.getByTestId("workspace-switcher-trigger").click();

    await expect(page.getByTestId("workspace-item-ws-a")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("workspace-item-ws-b")).toBeVisible();
    await expect(page.getByTestId("workspace-item-ws-a")).toHaveText(/Workspace A/i);
    await expect(page.getByTestId("workspace-item-ws-b")).toHaveText(/Workspace B/i);
  });

  test("MW-03: clicar no workspace B no switcher dispara focus_workspace", async ({ page }) => {
    const focused: string[] = [];

    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_TWO_WORKSPACES,
      open_workspace: () => WS_A,
      focus_workspace: (id: unknown) => {
        focused.push(id as string);
        return null;
      },
      list_open_workspaces: () => [
        { id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path },
        { id: WS_B.id, name: WS_B.name, root_path: WS_B.root_path },
      ],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    await page.getByTestId("workspace-switcher-trigger").click();
    await page.getByTestId("workspace-item-ws-b").click();

    // IPC must have been called
    await expect.poll(() => focused.length, { timeout: 3000 }).toBeGreaterThan(0);
    expect(focused).toContain(WS_B.id);
  });

  test("MW-04: status bar mostra nome do workspace focused", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_WITH_WS_A,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [{ id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path }],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    const statusPath = page.getByTestId("status-workspace-path");
    await expect(statusPath).toBeVisible({ timeout: 5000 });
    await expect(statusPath).toHaveText(/Workspace A/i);
  });

  test("MW-05: status bar com 2 workspaces mostra contagem", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_TWO_WORKSPACES,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [
        { id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path },
        { id: WS_B.id, name: WS_B.name, root_path: WS_B.root_path },
      ],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    const count = page.getByTestId("status-workspace-count");
    await expect(count).toBeVisible({ timeout: 5000 });
    await expect(count).toHaveText(/2/);
  });

  test("MW-06: workspace picker abre como modal quando há workspace aberto", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_WITH_WS_A,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [{ id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path }],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    // Open switcher popover and click "Open another"
    await page.getByTestId("workspace-switcher-trigger").click();
    await page.getByTestId("workspace-open-another").click();

    // WorkspacePicker should open as modal overlay (has close button)
    await expect(page.getByTestId("workspace-picker")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("workspace-picker-close")).toBeVisible();
  });

  test("MW-07: escape fecha popover do switcher", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_TWO_WORKSPACES,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [
        { id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path },
        { id: WS_B.id, name: WS_B.name, root_path: WS_B.root_path },
      ],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    await page.getByTestId("workspace-switcher-trigger").click();
    await expect(page.getByTestId("workspace-switcher-popover")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("workspace-switcher-popover")).not.toBeVisible({ timeout: 2000 });
  });

  test("MW-08: sidebar mostra workspace switcher", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => APP_STATE_WITH_WS_A,
      open_workspace: () => WS_A,
      list_open_workspaces: () => [{ id: WS_A.id, name: WS_A.name, root_path: WS_A.root_path }],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    await expect(page.getByTestId("workspace-switcher-trigger")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Multi-Workspace — Regressões", () => {
  test("REG-01: fluxo single-workspace inalterado (criar notebook)", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => ({
        ...DEFAULT_APP_STATE,
        last_opened_workspace: DEFAULT_WORKSPACE.root_path,
      }),
      open_workspace: () => DEFAULT_WORKSPACE,
      list_open_workspaces: () => [{ id: DEFAULT_WORKSPACE.id, name: DEFAULT_WORKSPACE.name, root_path: DEFAULT_WORKSPACE.root_path }],
      list_notebooks: () => [DEFAULT_NOTEBOOK],
      list_sections: () => [DEFAULT_SECTION],
      list_pages: () => [DEFAULT_PAGE_SUMMARY],
      load_page: () => DEFAULT_PAGE,
      list_all_tags: () => [],
    });

    await gotoApp(page);

    await expect(page.locator(SIDEBAR.nav)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("workspace-switcher-trigger")).toBeVisible();
  });

  test("REG-02: workspace picker tela cheia sem workspace aberto", async ({ page }) => {
    await setupIpcMock(page, {
      get_app_state: () => DEFAULT_APP_STATE,
      list_open_workspaces: () => [],
    });

    await gotoApp(page);

    await expect(page.getByTestId("workspace-picker")).toBeVisible({ timeout: 5000 });
    // No close button in fullscreen mode
    await expect(page.getByTestId("workspace-picker-close")).not.toBeVisible();
  });
});
