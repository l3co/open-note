import { test, expect } from "@playwright/test";
import { setupMockWorkspace, createNotebook, createSection } from "./helpers/workspace";
import { mockIpcRequests } from "./helpers/ipc-mock";

test.describe("Password-Protected Notes", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockWorkspace(page);
    await mockIpcRequests(page);
  });

  test("should protect a page with password and unlock it", async ({ page }) => {
    // 1. Criar notebook e seção
    await createNotebook(page, "Personal");
    await createSection(page, "Journal");

    // 2. Criar uma página e adicionar conteúdo
    await page.getByTestId("tree-section").click();
    await page.getByRole("button", { name: /Nova Página/i }).click();
    
    // Esperar editor carregar e digitar título
    const titleInput = page.getByPlaceholder(/Sem título/i);
    await titleInput.fill("My Secret Diary");
    await titleInput.press("Enter");

    // 3. Proteger com senha via menu de contexto
    await page.getByText("My Secret Diary").click({ button: "right" });
    await page.getByText(/Proteger com senha/i).click();

    // Preencher diálogo de senha
    await page.getByPlaceholder(/Nova senha/i).fill("password123");
    await page.getByPlaceholder(/Confirmar senha/i).fill("password123");
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // 4. Verificar que na sidebar o título virou placeholder e tem cadeado
    // (O store deve atualizar e a sidebar refletir o is_protected: true)
    await expect(page.getByText("[Página protegida]")).toBeVisible();
    
    // 5. Tentar abrir a página (deve mostrar diálogo de unlock)
    // Primeiro vamos limpar a seleção para forçar um re-load se necessário ou apenas clicar
    await page.getByText("[Página protegida]").click();
    
    // Verificar diálogo de unlock
    await expect(page.getByText(/Esta página está protegida por senha/i)).toBeVisible();

    // 6. Digitar senha errada
    await page.getByPlaceholder(/Digite a senha/i).fill("wrong_pass");
    await page.getByRole("button", { name: /Desbloquear/i }).click();
    await expect(page.getByText(/Senha incorreta/i)).toBeVisible();

    // 7. Digitar senha correta
    await page.getByPlaceholder(/Digite a senha/i).fill("password123");
    await page.getByRole("button", { name: /Desbloquear/i }).click();

    // 8. Verificar que o título real foi restaurado no editor
    await expect(page.getByDisplayValue("My Secret Diary")).toBeVisible();
  });

  test("should remove protection from a page", async ({ page }) => {
    // Setup: página já protegida (mockamos isso ou fazemos o fluxo)
    // Para simplificar o E2E, faremos o fluxo de set e depois remove
    await createNotebook(page, "Work");
    await createSection(page, "Projects");
    await page.getByTestId("tree-section").click();
    await page.getByRole("button", { name: /Nova Página/i }).click();
    await page.getByPlaceholder(/Sem título/i).fill("Hidden Project");
    await page.getByPlaceholder(/Sem título/i).press("Enter");

    // Set password
    await page.getByText("Hidden Project").click({ button: "right" });
    await page.getByText(/Proteger com senha/i).click();
    await page.getByPlaceholder(/Nova senha/i).fill("secret123");
    await page.getByPlaceholder(/Confirmar senha/i).fill("secret123");
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // Agora remover
    await page.getByText("[Página protegida]").click({ button: "right" });
    await page.getByText(/Remover proteção/i).click();

    await page.getByPlaceholder(/Digite a senha/i).fill("secret123");
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // Deve voltar ao título real na sidebar
    await expect(page.getByText("Hidden Project")).toBeVisible();
    await expect(page.getByText("[Página protegida]")).not.toBeVisible();
  });
});
