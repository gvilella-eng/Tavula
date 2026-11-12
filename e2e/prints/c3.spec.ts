import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa } from "../tests/ajudas";

// Prints do lote C3 (pasta do mestre com chave, código de recuperação, recuperação do mestre): Grimório em
// 1600×900 e 1280×720 e Pergaminho ("claro") em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints c3

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SENHA = "senha-boa-1";
const NOVA = "senha-nova-2";
const tiradas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

const escolherPasta = (p: Page, nome: string) =>
  p.evaluate(
    (n) =>
      (
        window as unknown as { __tabletopPastas: { escolher(n: string): void } }
      ).__tabletopPastas.escolher(n),
    nome,
  );

const esconderEntradaDeTeste = (p: Page) =>
  p.addStyleTag({ content: '[data-testid="entrada-de-teste"] { display: none !important; }' });

async function criar(p: Page, mesa: string, login: string, pasta?: string) {
  await p.goto("/");
  await p.getByTestId("inicio-criar-nome").fill(mesa);
  await p.getByTestId("inicio-criar-login").fill(login);
  await p.getByTestId("inicio-criar-nome-do-mestre").fill("Vilela");
  await p.getByTestId("inicio-criar-senha").fill(SENHA);
  await p.getByTestId("inicio-criar-confirmar").fill(SENHA);
  if (pasta) {
    await escolherPasta(p, pasta);
    await p.getByTestId("inicio-criar-pasta").click();
    await expect(p.getByTestId("inicio-criar-pasta-nome")).toBeVisible();
  }
}

base.afterAll(() => {
  console.log(`[C3] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

for (const c of COMBINACOES) {
  base(`c3 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const rotulo = `${c.tema}-${c.nome}`;
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      const p = (await mesa.abrir()).pagina;
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);

      // 1. criar mesa com a escolha da pasta
      await criar(p, "A Masmorra dos Ecos", "vilela", "PRINT");
      await foto(p, `${rotulo}-01-criar-mesa-com-a-pasta`);

      // 2. o código de recuperação, mostrado uma vez
      await p.getByTestId("inicio-criar-botao").click();
      await expect(p.getByTestId("codigo-valor")).toBeVisible();
      const id = ((await p.getByTestId("inicio-criada-id").textContent()) ?? "").trim();
      await p.getByTestId("codigo-de-recuperacao").scrollIntoViewIfNeeded();
      await foto(p, `${rotulo}-02-codigo-de-recuperacao`);
      await p.getByTestId("codigo-anotei").check();
      await p.getByTestId("inicio-abrir-mesa").click();
      await expect(p.getByTestId("status-conexao")).toHaveText("conectado");

      // 3. "Sou o mestre e esqueci a senha" com as duas opções
      await abrirAba(p, "preferencias");
      await p.getByTestId("trocar-usuario").click();
      await esconderEntradaDeTeste(p);
      await p.getByTestId("mestre-esqueci-link").click();
      await expect(p.getByTestId("mestre-opcoes")).toBeVisible();
      await foto(p, `${rotulo}-03-esqueci-as-duas-opcoes`);

      // 4. a recuperação pela pasta concluída
      await p.getByTestId("mestre-opcao-pasta").click();
      await p.getByTestId("mestre-pasta-login").fill("vilela");
      await p.getByTestId("mestre-pasta-senha").fill(NOVA);
      await p.getByTestId("mestre-pasta-confirmar").fill(NOVA);
      await foto(p, `${rotulo}-04-recuperar-pela-pasta-formulario`);
      await escolherPasta(p, "PRINT");
      await p.getByTestId("mestre-pasta-enviar").click();
      await expect(p.getByTestId("mestre-recuperado")).toBeVisible();
      await foto(p, `${rotulo}-05-recuperacao-pela-pasta-concluida`);
      await p.getByTestId("mestre-recuperado-entrar").click();
      await expect(p.getByTestId("status-conexao")).toHaveText("conectado");

      // 5. a seção Contas de uma mesa sem chave, com "Proteger com a pasta da mesa" e "Gerar novo código"
      const q = (await mesa.abrir()).pagina;
      await q.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
      await criar(q, "Mesa sem chave", "semchave");
      await q.getByTestId("inicio-criar-botao").click();
      await expect(q.getByTestId("codigo-valor")).toBeVisible();
      await q.getByTestId("codigo-anotei").check();
      await q.getByTestId("inicio-abrir-mesa").click();
      await expect(q.getByTestId("status-conexao")).toHaveText("conectado");
      await abrirAba(q, "mesa");
      await q.getByTestId("mesa-ir-contas").click();
      await q.getByTestId("protecao-do-mestre").scrollIntoViewIfNeeded();
      await q.getByTestId("protecao-senha").fill(SENHA);
      await foto(q, `${rotulo}-06-contas-proteger-e-gerar-novo-codigo`);
      expect(id).not.toBe("");
    } finally {
      await mesa.fechar();
    }
  });
}
