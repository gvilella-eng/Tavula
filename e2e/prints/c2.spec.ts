import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { derivarSenha } from "../../packages/shared/src/contas.ts";
import { gerarIdDeMesa } from "../../packages/shared/src/mesas.ts";
import { test as base, expect, ID_DA_MESA, Mesa } from "../tests/ajudas";

// Prints do lote C2 (contas por mesa, pedidos de entrada e redefinição): Grimório em 1600×900 e 1280×720 e
// Pergaminho ("claro") em 1600×900. Fora do `pnpm verify`:
//   PRINTS_DIR=<pasta> pnpm --filter @tabletop/e2e prints c2

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde os prints serão gravados).");
mkdirSync(PASTA, { recursive: true });

const COMBINACOES = [
  { tema: "grimorio", nome: "1600x900", width: 1600, height: 900 },
  { tema: "grimorio", nome: "1280x720", width: 1280, height: 720 },
  { tema: "claro", nome: "1600x900", width: 1600, height: 900 },
] as const;

const SENHA = "senha-boa-1";
const tiradas: string[] = [];

async function foto(p: Page, nome: string, espera = 500) {
  await p.waitForTimeout(espera);
  await p.screenshot({ path: join(PASTA as string, `${nome}.png`) });
  tiradas.push(nome);
}

/** A escolha de usuário de teste só existe em MODO=teste: nos prints a tela de entrada aparece como na internet. */
const esconderEntradaDeTeste = (p: Page) =>
  p.addStyleTag({ content: '[data-testid="entrada-de-teste"] { display: none !important; }' });

base.afterAll(() => {
  console.log(`[C2] ${tiradas.length} prints: ${tiradas.join(", ")}`);
});

for (const c of COMBINACOES) {
  base(`c2 ${c.tema} ${c.nome}`, async ({ browser, request }) => {
    base.setTimeout(240_000);
    const rotulo = `${c.tema}-${c.nome}`;
    const mesa = new Mesa(browser, { viewport: { width: c.width, height: c.height } });
    const preparar = async (p: Page) => {
      await p.addInitScript((t) => localStorage.setItem("tabletop:pref:tema", t), c.tema);
    };
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);

      // 1. criar mesa com conta (formulário preenchido, sem enviar)
      const inicio = (await mesa.abrir()).pagina;
      await preparar(inicio);
      await inicio.goto("/");
      await inicio.getByTestId("inicio-criar-nome").fill("A Masmorra dos Ecos");
      await inicio.getByTestId("inicio-criar-login").fill("vilela");
      await inicio.getByTestId("inicio-criar-nome-do-mestre").fill("Vilela");
      await inicio.getByTestId("inicio-criar-senha").fill(SENHA);
      await inicio.getByTestId("inicio-criar-confirmar").fill(SENHA);
      await foto(inicio, `${rotulo}-01-criar-mesa-com-conta`);

      // a mesa de verdade, criada pela API (mesma rota que a tela usa)
      const id = gerarIdDeMesa();
      const criada = await request.post("/api/mesas", {
        data: {
          id,
          nome: "A Masmorra dos Ecos",
          mestre: {
            login: "vilela",
            nome: "Vilela",
            derivada: await derivarSenha(SENHA, id, "vilela"),
          },
        },
      });
      expect(criada.status()).toBe(201);

      // 2 e 3. a tela de entrada da mesa, nas abas Entrar e Pedir para entrar
      const jogador = (await mesa.abrir()).pagina;
      await preparar(jogador);
      await jogador.goto(`/m/${id}`);
      await esconderEntradaDeTeste(jogador);
      await expect(jogador.getByTestId("entrada-login")).toBeVisible();
      await foto(jogador, `${rotulo}-02-entrada-aba-entrar`);
      await jogador.getByTestId("entrada-aba-pedir").click();
      await jogador.getByTestId("pedir-nome").fill("Ana");
      await jogador.getByTestId("pedir-login").fill("ana");
      await jogador.getByTestId("pedir-senha").fill(SENHA);
      await jogador.getByTestId("pedir-confirmar").fill(SENHA);
      await foto(jogador, `${rotulo}-03-entrada-aba-pedir-para-entrar`);

      // o mestre já está na mesa quando o pedido chega (o aviso vem ao vivo)
      const mestre = (await mesa.abrir()).pagina;
      await preparar(mestre);
      await mestre.goto(`/m/${id}`);
      await esconderEntradaDeTeste(mestre);
      await mestre.getByTestId("entrada-login").fill("vilela");
      await mestre.getByTestId("entrada-senha").fill(SENHA);
      await mestre.getByTestId("entrada-entrar").click();
      await expect(mestre.getByTestId("status-conexao")).toHaveText("conectado");

      // 4. o pedido enviado
      await jogador.getByTestId("pedir-enviar").click();
      await expect(jogador.getByTestId("pedir-enviado")).toBeVisible();
      await foto(jogador, `${rotulo}-04-pedido-enviado`);

      // 5. o aviso de pedido ao mestre, no topo
      await expect(mestre.getByTestId("aviso-de-contas")).toHaveText("1 pedido de entrada");
      await foto(mestre, `${rotulo}-05-aviso-de-pedido-ao-mestre`);

      // 6. a seção Contas com o pedido e a escolha de vaga
      await mestre.getByTestId("aviso-de-contas").click();
      await expect(mestre.getByTestId("conta-pedido-ana")).toBeVisible();
      await foto(mestre, `${rotulo}-06-secao-contas-com-pedido-e-vaga`);

      // 7. o pedido de redefinição (a Ana entra, e depois diz que esqueceu a senha)
      await mestre.getByTestId("conta-aceitar-ana").click();
      await expect(mestre.getByTestId("conta-status-ana")).toHaveText("Ativa");
      const esqueci = await request.post(`/api/m/${id}/conta/esqueci`, { data: { login: "ana" } });
      expect(esqueci.ok()).toBe(true);
      await expect(mestre.getByTestId("conta-redefinicao-ana")).toBeVisible();
      await mestre.getByTestId("conta-redefinicao-ana").scrollIntoViewIfNeeded();
      await foto(mestre, `${rotulo}-07-pedido-de-redefinicao`);

      // 8. a mesa legada sem conta de mestre pede a conta dele
      const legada = (await mesa.abrir()).pagina;
      await preparar(legada);
      await legada.goto(`/m/${ID_DA_MESA}`);
      await esconderEntradaDeTeste(legada);
      await expect(legada.getByTestId("entrada-mestre-inicial")).toBeVisible();
      await legada.getByTestId("mestre-inicial-login").fill("vilela");
      await legada.getByTestId("mestre-inicial-nome").fill("Vilela");
      await legada.getByTestId("mestre-inicial-senha").fill(SENHA);
      await legada.getByTestId("mestre-inicial-confirmar").fill(SENHA);
      await foto(legada, `${rotulo}-08-conta-do-mestre-na-mesa-legada`);
    } finally {
      await mesa.fechar();
    }
  });
}
