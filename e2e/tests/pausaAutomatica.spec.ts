import { expect, test } from "./ajudas";

// Redesign R2b: quando a última conexão de um mestre cai, a sala pausa a mesa sozinha (o mesmo evento da
// pausa manual). Retomar continua sendo só do mestre.

// A sala espera 5 s depois que o último mestre sai (ESPERA_DA_PAUSA_MS em sala.ts) antes de pausar; para provar
// que NÃO pausou, passa-se essa espera inteira.
const ESPERA_NEGATIVA_MS = 6500;

test("o mestre fecha a página: o jogador vê a mesa pausar e o mestre, ao voltar, retoma", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  const j = await mesa.entrar("jogador-1");
  await expect(j.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await expect(j.pagina.getByTestId("estado-mesa-selo")).toHaveCount(0);

  await m.pagina.close();

  await expect(j.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "true");
  await expect(j.pagina.getByTestId("estado-mesa-selo")).toBeVisible();
  // o jogador não consegue retomar: não há botão
  await expect(j.pagina.getByTestId("menu-pausa")).toHaveCount(0);

  // o mestre volta e encontra a mesa pausada; retomar é com ele
  const m2 = await mesa.entrar("mestre");
  await expect(m2.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Retomar/);
  await expect(m2.pagina.getByTestId("relogio-sala")).toHaveAttribute("data-pausada", "true");
  await m2.pagina.getByTestId("menu-pausa").click();
  await expect(m2.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Pausar/);
  await expect(j.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await expect(j.pagina.getByTestId("estado-mesa-selo")).toHaveCount(0);
});

test("com o mestre conectado em duas abas, uma saindo não pausa; a última pausa", async ({
  mesa,
}) => {
  const a = await mesa.entrar("mestre");
  const b = await mesa.entrar("mestre");
  const j = await mesa.entrar("jogador-1");
  await a.pagina.close();
  // dá tempo da sala processar a saída: segue rodando, para o mestre que ficou e para o jogador
  await b.pagina.waitForTimeout(ESPERA_NEGATIVA_MS); // prova negativa: passou a espera e nada pausou
  await expect(b.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Pausar/);
  await expect(j.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
  await b.pagina.close();
  await expect(j.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "true");
});

test("um jogador saindo não pausa a mesa", async ({ mesa }) => {
  const m = await mesa.entrar("mestre");
  const j = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  await j.pagina.close();
  await m.pagina.waitForTimeout(ESPERA_NEGATIVA_MS); // prova negativa: passou a espera e nada pausou
  await expect(m.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Pausar/);
  await expect(j2.pagina.getByTestId("estado-mesa")).toHaveAttribute("data-pausada", "false");
});

test("a mesa pausa sozinha mesmo com o relógio do mestre já pausado antes: o tempo não muda", async ({
  mesa,
}) => {
  const m = await mesa.entrar("mestre");
  await m.pagina.getByTestId("menu-pausa").click();
  await expect(m.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Retomar/);
  const antes = (await m.pagina.getByTestId("relogio-sala").textContent()) ?? "";
  await m.pagina.close();
  const m2 = await mesa.entrar("mestre");
  await expect(m2.pagina.getByTestId("menu-pausa")).toHaveAttribute("title", /^Retomar/);
  await expect(m2.pagina.getByTestId("relogio-sala")).toHaveText(antes.trim());
});
