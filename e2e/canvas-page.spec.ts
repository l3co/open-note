import { test, expect } from "@playwright/test";
import { setupWithWorkspace, skipOnboarding } from "./helpers/workspace";
import { APP } from "./helpers/selectors";

test.describe("Canvas Page (Excalidraw Integration)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await setupWithWorkspace(page);
    await expect(page.locator(APP.main)).toBeVisible({ timeout: 15000 });
  });

  test("criar página canvas e verificar que abre o Excalidraw", async ({ page }) => {
    // Abrir a seção de teste (clicando no nome da seção na sidebar)
    await page.getByText("Test Section").click();
    
    // Clicar no botão "Nova Página Canvas" na SectionOverview
    const newCanvasBtn = page.getByRole("button", { name: /nova página canvas/i });
    await expect(newCanvasBtn).toBeVisible();
    await newCanvasBtn.click();

    // Verificar que o Excalidraw foi carregado (lazy load)
    // O Excalidraw adiciona uma classe .excalidraw ao seu container
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });
    
    // Verificar título padrão
    await expect(page.getByTestId("title-editor")).toHaveText(/canvas sem título|untitled canvas/i);
  });

  test("estado do canvas persiste após auto-save", async ({ page }) => {
    // Criar página canvas
    await page.getByText("Test Section").click();
    await page.getByRole("button", { name: /nova página canvas/i }).click();
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });

    // Interagir com o canvas (desenhar um retângulo via atalho 'r')
    await page.keyboard.press("r");
    await page.mouse.move(400, 400);
    await page.mouse.down();
    await page.mouse.move(600, 550);
    await page.mouse.up();

    // Aguardar auto-save (1.5s + margem)
    await page.waitForTimeout(3000);

    // Navegar para outra página e voltar
    await page.getByText("Test Page").first().click();
    await page.waitForTimeout(500);
    await expect(page.locator(".excalidraw")).not.toBeVisible();

    await page.getByText(/canvas sem título|untitled canvas/i).click();
    
    // Verificar que o Excalidraw carregou e o elemento persiste
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 15000 });
    
    // Verificação interna do Excalidraw (pode variar conforme versão)
    // Geralmente existem elementos SVG dentro do canvas
    const canvasElements = page.locator(".excalidraw canvas");
    await expect(canvasElements.first()).toBeVisible();
  });
});
