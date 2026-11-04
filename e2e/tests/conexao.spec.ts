import { expect, test } from "@playwright/test";

test("dois contextos conectam na sala", async ({ browser }) => {
  const contextoA = await browser.newContext();
  const contextoB = await browser.newContext();
  const paginaA = await contextoA.newPage();
  const paginaB = await contextoB.newPage();

  await Promise.all([paginaA.goto("/"), paginaB.goto("/")]);

  await expect(paginaA.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(paginaB.getByTestId("status-conexao")).toHaveText("conectado");

  await contextoA.close();
  await contextoB.close();
});

test("a sala devolve o eco do texto enviado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("status-conexao")).toHaveText("conectado");

  await page.getByLabel("Texto para a sala").fill("olá, mesa");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByTestId("eco")).toHaveText("olá, mesa");
});
