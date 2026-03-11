import { test, expect } from "@playwright/test";
import {
  setupWithPage,
  setupWithExpandedTree,
  skipOnboarding,
  DEFAULT_PAGE_SUMMARY,
  DEFAULT_PAGE,
} from "./helpers/workspace";

test.describe("Password-Protected Notes", () => {
  test("should show protect option in page context menu", async ({ page }) => {
    await skipOnboarding(page);
    await setupWithPage(page);

    const pageNode = page.locator('[data-testid="tree-page"]').first();
    await pageNode.waitFor({ state: "visible", timeout: 5000 });
    await pageNode.click({ button: "right" });

    await expect(
      page.getByRole("menuitem", { name: /Proteger com senha/i }),
    ).toBeVisible();
  });

  test("should open set-password dialog from context menu", async ({
    page,
  }) => {
    await skipOnboarding(page);
    await setupWithPage(page);

    const pageNode = page.locator('[data-testid="tree-page"]').first();
    await pageNode.waitFor({ state: "visible", timeout: 5000 });
    await pageNode.click({ button: "right" });

    await page.getByRole("menuitem", { name: /Proteger com senha/i }).click();

    await expect(
      page.getByRole("dialog", { name: /Proteger página/i }),
    ).toBeVisible();
  });

  test("should show protected page placeholder in sidebar after protection", async ({
    page,
  }) => {
    const protectedSummary = {
      ...DEFAULT_PAGE_SUMMARY,
      title: "[Página protegida]",
      is_protected: true,
    };
    const protectedPage = {
      ...DEFAULT_PAGE,
      title: "[Página protegida]",
      protection: {
        salt: "aabbcc",
        nonce: "ddeeff",
        encrypted_title: "enc_title",
        algorithm: "AesGcm256",
        kdf: { Argon2id: { m_cost: 65536, t_cost: 3, p_cost: 1 } },
      },
    };

    await skipOnboarding(page);
    await setupWithExpandedTree(page, {
      protect_page: () => null,
      list_pages: () => [protectedSummary],
      load_page: () => protectedPage,
    });

    await expect(
      page.locator('[data-testid="tree-page"]').filter({ hasText: "[Página protegida]" }),
    ).toBeVisible();
  });

  test("should show unlock dialog when clicking a protected page", async ({
    page,
  }) => {
    const protectedSummary = {
      ...DEFAULT_PAGE_SUMMARY,
      title: "[Página protegida]",
      is_protected: true,
    };
    const protectedPage = {
      ...DEFAULT_PAGE,
      title: "[Página protegida]",
      encrypted_content: "encrypted_data",
      protection: {
        salt: "aabbcc",
        nonce: "ddeeff",
        encrypted_title: "enc_title",
        algorithm: "AesGcm256",
        kdf: { Argon2id: { m_cost: 65536, t_cost: 3, p_cost: 1 } },
      },
    };

    await skipOnboarding(page);
    await setupWithExpandedTree(page, {
      list_pages: () => [protectedSummary],
      load_page: () => protectedPage,
    });

    const pageNode = page.locator('[data-testid="tree-page"]').first();
    await pageNode.waitFor({ state: "visible", timeout: 5000 });
    await pageNode.locator('[role="button"]').first().click();

    await expect(
      page.getByRole("dialog", { name: /Desbloquear página/i }),
    ).toBeVisible();
  });

  test("should show remove-protection option for protected pages", async ({
    page,
  }) => {
    const protectedSummary = {
      ...DEFAULT_PAGE_SUMMARY,
      title: "[Página protegida]",
      is_protected: true,
    };

    await skipOnboarding(page);
    await setupWithExpandedTree(page, {
      list_pages: () => [protectedSummary],
    });

    const pageNode = page.locator('[data-testid="tree-page"]').first();
    await pageNode.waitFor({ state: "visible", timeout: 5000 });
    await pageNode.click({ button: "right" });

    await expect(
      page.getByRole("menuitem", { name: /Remover proteção/i }),
    ).toBeVisible();
  });
});
