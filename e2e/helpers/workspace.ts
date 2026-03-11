import type { Page } from "@playwright/test";
import {
  setupIpcMock,
  type MockOverrides,
  DEFAULT_APP_STATE,
  DEFAULT_WORKSPACE,
  DEFAULT_NOTEBOOK,
  DEFAULT_SECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
} from "./ipc-mock";

const BASE_URL = "http://localhost:1420";

/**
 * Sets up a clean app instance with IPC mocks and navigates to the app.
 * Returns the page ready for interaction.
 */
export async function setupApp(
  page: Page,
  overrides: MockOverrides = {},
): Promise<void> {
  await setupIpcMock(page, overrides);
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
}

/**
 * Sets up an app with NO workspace (first-time user experience).
 * Shows the WorkspacePicker.
 */
export async function setupFreshApp(page: Page): Promise<void> {
  await setupApp(page, {
    get_app_state: () => DEFAULT_APP_STATE,
  });
}

/**
 * Sets up an app with a workspace already open.
 * Skips WorkspacePicker and shows the main layout.
 */
export async function setupWithWorkspace(
  page: Page,
  overrides: MockOverrides = {},
): Promise<void> {
  await setupApp(page, {
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
    ...overrides,
  });
}

/**
 * Sets up an app with workspace, notebook, section and navigates to a page.
 */
export async function setupWithPage(
  page: Page,
  overrides: MockOverrides = {},
): Promise<void> {
  await setupWithWorkspace(page, overrides);

  // Wait for sidebar to load and click through to page
  await page.waitForSelector('[role="tree"]', { timeout: 5000 });

  // Click notebook to expand (wait for it to appear first)
  const notebookNode = page.locator('[data-testid="tree-notebook"]').first();
  try {
    await notebookNode.waitFor({ state: "visible", timeout: 5000 });
    await notebookNode.click();
    // Wait for sections to load after async loadSections IPC call
    const sectionNode = page.locator('[data-testid="tree-section"]').first();
    await sectionNode.waitFor({ state: "visible", timeout: 5000 });
    await sectionNode.click();
    // Wait for pages to load after async loadPages IPC call
    const pageNode = page.locator('[data-testid="tree-page"]').first();
    await pageNode.waitFor({ state: "visible", timeout: 5000 });
    await pageNode.click();
  } catch {
    // Tree navigation is best-effort — some tests may not need a loaded page
  }
}

/**
 * Clears localStorage onboarding flag so OnboardingDialog shows.
 */
export async function clearOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem("opennote_onboarding_done");
  });
}

/**
 * Marks onboarding as done so it doesn't interfere with other tests.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("opennote_onboarding_done", "1");
  });
}

// Re-export defaults for convenience
export {
  DEFAULT_APP_STATE,
  DEFAULT_WORKSPACE,
  DEFAULT_NOTEBOOK,
  DEFAULT_SECTION,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SUMMARY,
};
