import type { Page } from "@playwright/test";
import {
  abrirAbaInicial,
  continuarParaAPasta,
  expect,
  Mesa,
  preencherMesaEConta,
  test,
} from "./ajudas";

// C4: a tela inicial no modelo B (um cartão com abas): a página não rola, as abas pelo teclado, a aba inicial
// e o passo a passo de "Criar mesa". O fluxo completo de criar fica em mesas, contas e recuperacao.

const TAMANHOS = [
  { width: 1600, height: 900 },
  { width: 1280, height: 720 },
] as const;

/** A página inteira (e a tela inicial) cabem na janela: nada rola. */
async function naoRola(p: Page) {
  const medidas = await p.evaluate(() => {
    const raiz = document.documentElement;
    const tela = document.querySelector('[data-testid="tela-inicial"]') as HTMLElement;
    return {
      raiz: raiz.scrollHeight - raiz.clientHeight,
      tela: tela.scrollHeight - tela.clientHeight,
    };
  });
  expect(medidas.raiz).toBeLessThanOrEqual(0);
  expect(medidas.tela).toBeLessThanOrEqual(0);
}

for (const t of TAMANHOS) {
  test(`a página não rola em ${t.width}x${t.height}, em nenhuma aba nem passo`, async ({
    browser,
  }) => {
    const mesa = new Mesa(browser, { viewport: { width: t.width, height: t.height } });
    try {
      const p = (await mesa.abrir()).pagina;
      await p.goto("/");
      await expect(p.getByTestId("inicio-mesas-lista")).toBeVisible();
      await naoRola(p);
      await abrirAbaInicial(p, "entrar");
      await naoRola(p);
      await preencherMesaEConta(p, {
        mesa: "Mesa de medir",
        login: "medidor",
        nome: "Medidor",
        senha: "senha-boa-1",
      });
      await naoRola(p);
      await continuarParaAPasta(p);
      await naoRola(p);
      // o cartão inteiro está dentro da janela
      const caixa = await p.locator(".inicio-cartao").boundingBox();
      expect(caixa).not.toBeNull();
      expect((caixa?.y ?? 0) + (caixa?.height ?? 0)).toBeLessThanOrEqual(t.height);
    } finally {
      await mesa.fechar();
    }
  });
}

test("as abas se movem com as setas, Home e End, e só a aberta entra na ordem do Tab", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tablist")).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveCount(3);

  await page.getByTestId("inicio-aba-mesas").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("inicio-aba-entrar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-entrar")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("inicio-aba-criar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-criar")).toBeFocused();
  // dá a volta
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("inicio-aba-criar")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByTestId("inicio-aba-criar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("tabindex", "-1");
  await expect(page.getByTestId("inicio-aba-entrar")).toHaveAttribute("tabindex", "-1");
});

test("a aba inicial é 'Minhas mesas' com mesas e 'Entrar com código' sem; a lista vazia leva às outras abas", async ({
  page,
}) => {
  // com mesas (o servidor de teste lista a campanha): "Minhas mesas (N)" no rótulo
  await page.goto("/");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveText(/^Minhas mesas \([1-9]\d*\)$/);

  // sem mesas: nem o servidor lista nem este navegador abriu alguma
  await page.route("**/api/mesas", (rota) =>
    rota.request().method() === "GET"
      ? rota.fulfill({ status: 404, body: "Não encontrado" })
      : rota.fallback(),
  );
  await page.evaluate(() => localStorage.removeItem("tabletop:mesas"));
  await page.goto("/");
  await expect(page.getByTestId("inicio-aba-entrar")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inicio-aba-mesas")).toHaveText("Minhas mesas (0)");
  await abrirAbaInicial(page, "mesas");
  await expect(page.getByTestId("inicio-mesas-vazio")).toHaveText(
    "Nenhuma mesa neste computador ainda.",
  );
  await page.getByTestId("inicio-mesas-ir-criar").click();
  await expect(page.getByTestId("inicio-aba-criar")).toHaveAttribute("aria-selected", "true");
  await abrirAbaInicial(page, "mesas");
  await page.getByTestId("inicio-mesas-ir-entrar").click();
  await expect(page.getByTestId("inicio-aba-entrar")).toHaveAttribute("aria-selected", "true");
});

test("criar mesa: o passo 1 não avança com senha curta ou diferente, e trocar de aba volta ao passo 1 sem perder o que foi digitado", async ({
  page,
}) => {
  await page.goto("/");
  await preencherMesaEConta(page, {
    mesa: "Mesa em dois passos",
    login: "passo",
    nome: "Passo",
    senha: "curta",
  });
  await expect(page.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");

  // senha curta (4 caracteres)
  await page.getByTestId("inicio-criar-senha").fill("abcd");
  await page.getByTestId("inicio-criar-confirmar").fill("abcd");
  await page.getByTestId("inicio-criar-continuar").click();
  await expect(page.getByTestId("inicio-criar-erro")).toBeVisible();
  await expect(page.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");

  // confirmação diferente
  await page.getByTestId("inicio-criar-senha").fill("senha-boa-1");
  await page.getByTestId("inicio-criar-confirmar").fill("senha-boa-2");
  await page.getByTestId("inicio-criar-continuar").click();
  await expect(page.getByTestId("inicio-criar-erro")).toHaveText(
    "A confirmação não é igual à senha.",
  );
  await expect(page.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");

  // certo: avança, e "Voltar" devolve com os campos como estavam
  await page.getByTestId("inicio-criar-confirmar").fill("senha-boa-1");
  await continuarParaAPasta(page);
  await expect(page.getByTestId("inicio-criar-pasta-bloco")).toBeVisible();
  await page.getByTestId("inicio-criar-voltar").click();
  await expect(page.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");
  await expect(page.getByTestId("inicio-criar-nome")).toHaveValue("Mesa em dois passos");

  // trocar de aba no passo 2: volta ao passo 1 e mantém o digitado
  await continuarParaAPasta(page);
  await abrirAbaInicial(page, "entrar");
  await abrirAbaInicial(page, "criar");
  await expect(page.getByTestId("inicio-criar-passo")).toHaveText("Passo 1 de 2");
  await expect(page.getByTestId("inicio-criar-login")).toHaveValue("passo");
  await expect(page.getByTestId("inicio-criar-senha")).toHaveValue("senha-boa-1");
});

test("depois de criar, em 1280x720, o id, o código e o 'Anotei o código' aparecem inteiros, sem rolar", async ({
  browser,
}) => {
  const mesa = new Mesa(browser, { viewport: { width: 1280, height: 720 } });
  try {
    const p = (await mesa.abrir()).pagina;
    await p.goto("/");
    await preencherMesaEConta(p, {
      mesa: "Mesa criada e visível",
      login: "visivel",
      nome: "Visível",
      senha: "senha-boa-1",
    });
    await continuarParaAPasta(p);
    await p.getByTestId("inicio-criar-botao").click();
    await expect(p.getByTestId("codigo-valor")).toBeVisible();
    await naoRola(p);

    const corpo = p.locator(".inicio-cartao .inicio-painel-corpo");
    const area = await corpo.boundingBox();
    expect(area).not.toBeNull();
    // nada rola dentro do cartão
    const sobra = await corpo.evaluate((e) => e.scrollHeight - e.clientHeight);
    expect(sobra).toBeLessThanOrEqual(0);
    for (const id of [
      "inicio-criada-id",
      "inicio-criada-copiar-id",
      "codigo-valor",
      "codigo-copiar",
      "codigo-baixar",
      "codigo-anotei",
      "inicio-abrir-mesa",
      "inicio-criar-outra",
    ]) {
      const caixa = await p.getByTestId(id).boundingBox();
      expect(caixa, id).not.toBeNull();
      expect(caixa?.y ?? -1, id).toBeGreaterThanOrEqual(0);
      expect((caixa?.y ?? 0) + (caixa?.height ?? 0), id).toBeLessThanOrEqual(720);
      if (id !== "inicio-abrir-mesa" && id !== "inicio-criar-outra") {
        expect(caixa?.y ?? -1, id).toBeGreaterThanOrEqual(area?.y ?? 0);
        expect((caixa?.y ?? 0) + (caixa?.height ?? 0), id).toBeLessThanOrEqual(
          (area?.y ?? 0) + (area?.height ?? 0),
        );
      }
    }
  } finally {
    await mesa.fechar();
  }
});
