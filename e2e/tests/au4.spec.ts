import type { Page } from "@playwright/test";
import { enviarCru, expect, intencaoCrua, test } from "./ajudas";
import { entrarNoMapa, type GanchoDoMapa } from "./ajudasMapa";
import { enviarEEsperarSnapshot } from "./ajudasSom";

// AU4: "Cena ativa" em "Cenas onde vale": a automação vale na cena onde o grupo está no instante do disparo.

test.describe.configure({ timeout: 120_000 });

const ALDRIC = "pers-aldric";
const TOCHA = "modelo-tocha";

async function ok(p: Page, tipo: string, dados: object) {
  const r = await enviarCru(p, intencaoCrua(tipo, dados));
  expect(r, `${tipo} sem resposta`).not.toBeNull();
  expect(r?.tipo, `${tipo}: ${JSON.stringify(r)}`).toBe("evento");
}

const luzes = (p: Page) =>
  p.evaluate(() => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.luzes());
const idsDeLuz = async (p: Page) => (await luzes(p)).map((l) => l.id);

/** `grupo.moverPara` responde com um snapshot novo, não com um evento. */
async function levarGrupo(p: Page, cenaId: string) {
  const r = await enviarEEsperarSnapshot(p, intencaoCrua("grupo.moverPara", { cenaId }));
  expect(r, "grupo.moverPara").toBe("snapshot");
}

const suporte = (id: string) => ({
  id,
  nome: id,
  x: 12.75,
  y: 9.75,
  tipo: "suporte" as const,
  visivelParaJogadores: true,
});

async function tochaNoSuporte(p: Page, tocha: string, ponto: string) {
  await ok(p, "ponto.criar", { ponto: suporte(ponto) });
  await ok(p, "tocha.acender", { personagemId: ALDRIC, modeloId: TOCHA, novoId: tocha });
  await ok(p, "tocha.posar", { id: tocha, pontoId: ponto });
}

test("marcar 'Cena ativa', salvar e disparar: só apagam as tochas da cena onde o grupo está", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const p = mestre.pagina;
  await ok(p, "mochila.ajustar", { personagemId: ALDRIC, modeloId: TOCHA, delta: 3 });
  await ok(p, "cena.criar", { id: "cena-b", nome: "Taverna" });
  await tochaNoSuporte(p, "tocha-1", "gancho-1");
  await levarGrupo(p, "cena-b");
  await tochaNoSuporte(p, "tocha-b", "gancho-b");
  await levarGrupo(p, "cena-1");
  await expect.poll(() => idsDeLuz(p)).toContain("tocha-1");

  await ok(p, "fluxo.criar", {
    fluxo: {
      id: "apagar",
      nome: "Apagar tochas",
      gatilho: { tipo: "botao", nome: "Apagar" },
      trilhas: [
        [
          {
            bloco: "paraCada",
            alvo: { tipo: "objetos", acesos: true },
            corpo: [{ bloco: "acao", acao: { acao: "objeto.apagar" } }],
          },
        ],
      ],
    },
  });

  await p.getByTestId("menu-automacoes").click();
  await expect(p.getByTestId("automacoes-janela")).toBeVisible();
  const [e] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("auto-editar-apagar").click(),
  ]);
  await expect(e.getByTestId("ed-raiz")).toBeVisible();
  const caixa = e.getByTestId("ed-cena-ativa");
  await expect(caixa).not.toBeChecked();
  await caixa.check();
  await expect(e.getByTestId("ed-frase")).toContainText("na cena ativa");
  await Promise.all([e.waitForEvent("close"), e.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-frase-apagar")).toContainText("na cena ativa");

  // grupo na cena 1: apaga a tocha de lá
  await p.getByTestId("auto-disparar-apagar").click();
  await expect.poll(() => idsDeLuz(p)).not.toContain("tocha-1");

  // leva o grupo para a Taverna: a tocha de lá ainda está acesa, e o mesmo botão agora apaga a dela
  await levarGrupo(p, "cena-b");
  await expect.poll(() => idsDeLuz(p)).toContain("tocha-b");
  await p.getByTestId("auto-disparar-apagar").click();
  await expect.poll(() => idsDeLuz(p)).not.toContain("tocha-b");

  // desmarcar e salvar de novo tira a "Cena ativa" (a sala junta as mudanças com o que já tinha)
  const [e2] = await Promise.all([
    p.waitForEvent("popup"),
    p.getByTestId("auto-editar-apagar").click(),
  ]);
  await expect(e2.getByTestId("ed-cena-ativa")).toBeChecked();
  await e2.getByTestId("ed-cena-ativa").uncheck();
  await Promise.all([e2.waitForEvent("close"), e2.getByTestId("ed-salvar").click()]);
  await expect(p.getByTestId("auto-frase-apagar")).not.toContainText("na cena ativa");
});
