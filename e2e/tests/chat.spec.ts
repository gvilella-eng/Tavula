import type { Page } from "@playwright/test";
import { abrirAba, enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";

// Lote 8: dados e chat. Os testes de sigilo olham os FRAMES de WebSocket de um terceiro jogador.

/** Envia uma intenção por um socket novo e devolve o primeiro `evento` ou `erro` que a sala mandar. */
async function falarCru(pagina: Page, tipo: string, dados: object) {
  return enviarCru(pagina, intencaoCrua(tipo, dados));
}

/** Pede `chat.anteriores` num socket novo e devolve o texto da resposta (ou null). */
async function anteriores(pagina: Page, antesDoSeq: number): Promise<string | null> {
  return pagina.evaluate(
    (antes) =>
      new Promise<string | null>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        const fim = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 4000);
        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              v: 1,
              id: "ant",
              tipo: "chat.anteriores",
              dados: { antesDoSeq: antes },
            }),
          );
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          if (m.tipo === "chat.anteriores") {
            clearTimeout(fim);
            ws.close();
            resolve(e.data as string);
          }
        };
      }),
    antesDoSeq,
  );
}

/** Manda muitas mensagens de chat por vários sockets (10 por socket, para não bater no limite). */
async function encher(pagina: Page, quantidade: number, prefixo: string) {
  await pagina.evaluate(
    async ([n, p]) => {
      const sockets = Math.ceil((n as number) / 10);
      await Promise.all(
        Array.from(
          { length: sockets },
          (_, s) =>
            new Promise<void>((resolve) => {
              const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
              ws.onopen = () => {
                for (let i = 0; i < 10 && s * 10 + i < (n as number); i++) {
                  const numero = s * 10 + i + 1;
                  ws.send(
                    JSON.stringify({
                      v: 1,
                      id: `e${s}-${i}`,
                      tipo: "chat.enviar",
                      dados: { texto: `${p} ${String(numero).padStart(3, "0")}` },
                    }),
                  );
                }
                setTimeout(() => {
                  ws.close();
                  resolve();
                }, 800);
              };
            }),
        ),
      );
    },
    [quantidade, prefixo] as [number, string],
  );
}

const textoDosFrames = (s: Sessao) => s.frames.join("\n");

async function digitar(pagina: Page, texto: string) {
  await pagina.getByTestId("chat-texto").fill(texto);
  await pagina.getByTestId("chat-texto").press("Enter");
}

test("um 'resultado' mandado pelo cliente é ignorado: a sala rola de novo", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const falso = { total: 999, termos: [], expressao: "1d20" };

  const comum = {
    resultado: 999,
    total: 999,
    rolagens: [falso],
    dados: [999],
  };
  const r1 = await falarCru(j1.pagina, "dado.rolar", { expressao: "2d6+3", ...comum });
  const r2 = await falarCru(j1.pagina, "chat.enviar", { texto: "/r 1d20+5", ...comum });
  const r3 = await falarCru(j1.pagina, "chat.modelo", {
    modelo: "ataque",
    nome: "Espada",
    bonus: 5,
    dano: "1d8+3",
    ...comum,
    acerto: falso,
    critico: true,
  });
  for (const r of [r1, r2, r3]) expect(r?.tipo).toBe("evento");

  await expect(mestre.pagina.getByTestId("chat-mensagem")).toHaveCount(3);
  const quadros = textoDosFrames(mestre);
  expect(quadros).not.toContain('"total":999');
  expect(quadros).not.toContain("[999]");
  // o resultado que chegou é o da sala: total = soma dos dados mantidos + constantes
  const mensagens = mestre.frames
    .map(
      (f) =>
        JSON.parse(f) as {
          tipo: string;
          dados: {
            tipo?: string;
            dados?: {
              mensagem?: {
                rolagens?: {
                  total: number;
                  termos: { tipo: string; dados?: { valor: number }[]; subtotal: number }[];
                }[];
              };
            };
          };
        },
    )
    .filter((m) => m.tipo === "evento" && m.dados.tipo === "chat.mensagem")
    .map((m) => m.dados.dados?.mensagem);
  expect(mensagens.length).toBe(3);
  for (const m of mensagens.slice(0, 2)) {
    const rol = m?.rolagens?.[0];
    expect(rol).toBeDefined();
    const soma = (rol?.termos ?? []).reduce((s, t) => s + t.subtotal, 0);
    expect(rol?.total).toBe(soma);
    expect(rol?.total).toBeLessThan(30);
  }
});

test("sigilo: rolagem oculta do mestre e sussurro entre dois jogadores não chegam a um terceiro", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");
  const j3 = await mesa.entrar("jogador-3");

  expect(
    (await falarCru(mestre.pagina, "chat.enviar", { texto: "/gr 1d20+7 segredomestre" }))?.tipo,
  ).toBe("evento");
  expect(
    (await falarCru(j1.pagina, "chat.enviar", { texto: "/w Jogador 2 sussurrosecreto" }))?.tipo,
  ).toBe("evento");
  expect((await falarCru(j2.pagina, "chat.enviar", { texto: "publicaparatodos" }))?.tipo).toBe(
    "evento",
  );
  expect(
    (await falarCru(mestre.pagina, "dado.rolar", { expressao: "1d100", oculta: true }))?.tipo,
  ).toBe("evento");

  // quem pode ver, vê (na tela)
  await expect(j2.pagina.getByText("sussurrosecreto")).toBeVisible();
  await expect(j3.pagina.getByText("publicaparatodos")).toBeVisible();
  await expect(mestre.pagina.getByText("sussurrosecreto")).toBeVisible();
  await expect(mestre.pagina.getByTestId("etiqueta-oculta")).toHaveCount(2);
  await expect(j1.pagina.getByTestId("etiqueta-oculta")).toHaveCount(0);

  // o terceiro jogador: nenhum frame traz o segredo (eventos)
  for (const segredo of ["segredomestre", "sussurrosecreto", "1d100", "1d20+7"]) {
    expect(textoDosFrames(j3), segredo).not.toContain(segredo);
  }
  expect(textoDosFrames(j3)).toContain("publicaparatodos");

  // nem no snapshot de uma reconexão, nem no chat.anteriores
  await j3.pagina.reload();
  await expect(j3.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(j3.pagina.getByText("publicaparatodos")).toBeVisible();
  for (const segredo of ["segredomestre", "sussurrosecreto", "1d100", "1d20+7"]) {
    expect(textoDosFrames(j3), `depois do refresh: ${segredo}`).not.toContain(segredo);
  }
  const resposta = await anteriores(j3.pagina, 1000);
  expect(resposta).not.toBeNull();
  expect(resposta).toContain("publicaparatodos");
  for (const segredo of ["segredomestre", "sussurrosecreto", "1d100", "1d20+7"]) {
    expect(resposta, `anteriores: ${segredo}`).not.toContain(segredo);
  }
  // o destinatário vê o sussurro no histórico; o mestre vê tudo
  expect(await anteriores(j2.pagina, 1000)).toContain("sussurrosecreto");
  const doMestre = (await anteriores(mestre.pagina, 1000)) ?? "";
  for (const visto of ["segredomestre", "sussurrosecreto", "publicaparatodos"]) {
    expect(doMestre).toContain(visto);
  }
});

test("rolagem oculta: o jogador sem permissão é recusado; com permissão, só ele e o mestre veem", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");

  const negado = await falarCru(j1.pagina, "chat.enviar", { texto: "/gr 1d20" });
  expect(negado?.tipo).toBe("erro");
  expect(negado?.dados.codigo).toBe("sem_permissao");
  const negadoRapido = await falarCru(j1.pagina, "dado.rolar", { expressao: "1d20", oculta: true });
  expect(negadoRapido?.dados.codigo).toBe("sem_permissao");

  expect(
    (
      await falarCru(mestre.pagina, "permissao.alterar", {
        capacidade: "dado.rolarOculto",
        valor: true,
        usuarioId: "jogador-1",
      })
    )?.tipo,
  ).toBe("evento");
  expect((await falarCru(j1.pagina, "chat.enviar", { texto: "/gr 1d20 escondido" }))?.tipo).toBe(
    "evento",
  );
  await expect(j1.pagina.getByTestId("etiqueta-oculta")).toHaveCount(1);
  await expect(mestre.pagina.getByTestId("etiqueta-oculta")).toHaveCount(1);
  expect(textoDosFrames(j2)).not.toContain("escondido");
  await expect(j2.pagina.getByTestId("chat-mensagem")).toHaveCount(0);
});

test("dados rápidos rolam de verdade e o resultado vai para o chat de todos; Shift+clique é oculto", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");

  await j1.pagina.getByTestId("ferramenta-dados").click();
  await j1.pagina.getByTestId("dado-D20-3").click();
  for (const s of [mestre, j1, j2]) {
    await expect(s.pagina.getByTestId("chat-mensagem")).toHaveCount(1);
    await expect(s.pagina.getByTestId("rolagem-expressao")).toHaveText("3d20");
    const total = Number(await s.pagina.getByTestId("rolagem-total").textContent());
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(60);
  }
  expect(j1.enviados.filter((f) => f.includes('"tipo":"dado.rolar"')).length).toBe(1);

  // o jogador sem permissão: Shift+clique não vira oculta (rola pública)
  await j1.pagina.getByTestId("ferramenta-dados").click();
  await j1.pagina.getByTestId("dado-D6").click({ modifiers: ["Shift"] });
  await expect(j2.pagina.getByTestId("chat-mensagem")).toHaveCount(2);

  // o mestre: Shift+clique é oculto; o jogador nunca recebe
  await mestre.pagina.getByTestId("ferramenta-dados").click();
  await mestre.pagina.getByTestId("dado-D100").click({ modifiers: ["Shift"] });
  await expect(mestre.pagina.getByTestId("etiqueta-oculta")).toHaveCount(1);
  await mestre.pagina.waitForTimeout(500);
  await expect(j1.pagina.getByTestId("chat-mensagem")).toHaveCount(2);
  expect(textoDosFrames(j1)).not.toContain("1d100");
  expect(textoDosFrames(j2)).not.toContain("1d100");
});

test("histórico: sobrevive ao refresh e ao reinício da sala; o mestre limpa com confirmação", async ({
  mesa,
  request,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  await digitar(j1.pagina, "mensagem que fica");
  await digitar(j1.pagina, "/r 2d6 rolagem que fica");
  await expect(mestre.pagina.getByTestId("chat-mensagem")).toHaveCount(2);
  const total = await mestre.pagina.getByTestId("rolagem-total").textContent();

  await j1.pagina.reload();
  await expect(j1.pagina.getByText("mensagem que fica")).toBeVisible();
  await expect(j1.pagina.getByTestId("rolagem-total")).toHaveText(total ?? "");

  const quedas = [mestre, j1].map((s) => s.pagina.waitForEvent("websocket"));
  await request.post("/teste/reiniciar-sala").catch(() => {});
  await Promise.all(quedas);
  for (const s of [mestre, j1]) {
    await expect(s.pagina.getByTestId("status-conexao")).toHaveText("conectado");
    await expect(s.pagina.getByText("mensagem que fica")).toBeVisible();
    await expect(s.pagina.getByTestId("rolagem-total")).toHaveText(total ?? "");
  }

  // limpar: só o mestre tem o botão; pede confirmação; cancelar não apaga
  await expect(j1.pagina.getByTestId("chat-limpar")).toHaveCount(0);
  await mestre.pagina.getByTestId("chat-limpar").click();
  await expect(mestre.pagina.getByTestId("chat-limpar-confirmacao")).toBeVisible();
  await mestre.pagina.getByTestId("chat-limpar-cancelar").click();
  await expect(mestre.pagina.getByTestId("chat-mensagem")).toHaveCount(2);
  await mestre.pagina.getByTestId("chat-limpar").click();
  await mestre.pagina.getByTestId("chat-limpar-confirmar").click();
  for (const s of [mestre, j1]) await expect(s.pagina.getByTestId("chat-mensagem")).toHaveCount(0);
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("chat-mensagens")).toContainText("Nenhuma mensagem");
  // jogador não limpa por conta própria
  const negado = await falarCru(j1.pagina, "chat.limpar", {});
  expect(negado?.dados.codigo).toBe("sem_permissao");
});

test("'Como:' mostra o personagem; jogador só vê os que edita e o mestre, todos", async ({
  mesa,
}) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const j2 = await mesa.entrar("jogador-2");

  const opcoesJ1 = await j1.pagina.getByTestId("chat-como").locator("option").allInnerTexts();
  expect(opcoesJ1).toEqual(["Jogador 1 (eu mesmo)", "Aldric"]);
  const opcoesMestre = await mestre.pagina
    .getByTestId("chat-como")
    .locator("option")
    .allInnerTexts();
  expect(opcoesMestre).toEqual(["Mestre (eu mesmo)", "Aldric", "Brisa", "Cael", "Ogro"]);

  await j1.pagina.getByTestId("chat-como").selectOption({ label: "Aldric" });
  await digitar(j1.pagina, "Eu sou o Aldric");
  await mestre.pagina.getByTestId("chat-como").selectOption({ label: "Ogro" });
  await digitar(mestre.pagina, "/em ruge");
  for (const s of [mestre, j1, j2]) {
    await expect(s.pagina.getByTestId("chat-mensagem")).toHaveCount(2);
    await expect(s.pagina.getByTestId("chat-autor").first()).toHaveText("Aldric");
    await expect(s.pagina.getByTestId("chat-autor").nth(1)).toHaveText("Ogro");
  }
  await expect(j2.pagina.getByText("Ogro ruge")).toBeVisible();

  // a escolha vale depois do refresh
  await j1.pagina.reload();
  await expect(j1.pagina.getByTestId("chat-como")).toHaveValue("pers-aldric");
  // e quem não edita o personagem é recusado, mesmo falando direto com a sala
  const r = await falarCru(j2.pagina, "chat.enviar", { texto: "x", como: "pers-aldric" });
  expect(r?.dados.codigo).toBe("personagem_inexistente");
  const r2 = await falarCru(j1.pagina, "chat.enviar", { texto: "x", como: "pers-ogro" });
  expect(r2?.dados.codigo).toBe("personagem_inexistente");
});

test("a caixa: Enter envia, Shift+Enter quebra a linha, seta para cima volta a última, /? e erros", async ({
  mesa,
}) => {
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  const caixa = p.getByTestId("chat-texto");

  await caixa.fill("primeira linha");
  await caixa.press("Shift+Enter");
  await caixa.pressSequentially("segunda linha");
  await expect(caixa).toHaveValue("primeira linha\nsegunda linha");
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(0);
  await caixa.press("Enter");
  await expect(p.getByTestId("chat-mensagem")).toHaveCount(1);
  await expect(caixa).toHaveValue("");
  await expect(p.getByTestId("chat-mensagem").locator(".texto-chat")).toHaveText(
    "primeira linha\nsegunda linha",
  );

  await digitar(p, "outra mensagem");
  await caixa.press("ArrowUp");
  await expect(caixa).toHaveValue("outra mensagem");
  await caixa.press("ArrowUp");
  await expect(caixa).toHaveValue("primeira linha\nsegunda linha");
  await caixa.press("ArrowDown");
  await expect(caixa).toHaveValue("outra mensagem");
  await caixa.fill("");

  // /? mostra os comandos só na tela (nada vai para a sala)
  const enviadosAntes = j1.enviados.length;
  await digitar(p, "/?");
  await expect(p.getByTestId("chat-ajuda")).toContainText("/w Nome texto");
  expect(j1.enviados.length).toBe(enviadosAntes);

  // erro de comando: avisa e mantém o texto
  await digitar(p, "/r abc");
  await expect(p.getByTestId("chat-erro")).toBeVisible();
  await expect(caixa).toHaveValue("/r abc");
  await caixa.fill("/w ninguem oi");
  await caixa.press("Enter");
  await expect(p.getByTestId("chat-erro")).toContainText("ninguem");

  // 2000 caracteres: o campo limita e a sala recusa 2001 (mesmo pelo socket cru)
  await expect(caixa).toHaveAttribute("maxlength", "2000");
  const longo = await falarCru(p, "chat.enviar", { texto: "a".repeat(2001) });
  expect(longo?.tipo).toBe("erro");
  expect(longo?.dados.codigo).toBe("mensagem_invalida");
  const justo = await falarCru(p, "chat.enviar", { texto: "b".repeat(2000) });
  expect(justo?.tipo).toBe("evento");
});

test("limite de 10 mensagens por segundo por conexão: o resto é recusado com aviso", async ({
  mesa,
}) => {
  const j1 = await mesa.entrar("jogador-1");
  const resultado = await j1.pagina.evaluate(
    () =>
      new Promise<{ erros: string[]; eventos: number }>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        const erros: string[] = [];
        let eventos = 0;
        ws.onopen = () => {
          for (let i = 0; i < 15; i++) {
            ws.send(
              JSON.stringify({
                v: 1,
                id: `r${i}`,
                tipo: "chat.enviar",
                dados: { texto: `rajada ${i}` },
              }),
            );
          }
          setTimeout(() => {
            ws.close();
            resolve({ erros, eventos });
          }, 1500);
        };
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          if (m.tipo === "erro") erros.push(m.dados.codigo);
          if (m.tipo === "evento" && m.dados.tipo === "chat.mensagem") eventos++;
        };
      }),
  );
  expect(resultado.erros.filter((c) => c === "muitas_mensagens").length).toBe(5);
  expect(resultado.eventos).toBe(10);
});

test("modelos: ataque, teste com CD e vantagem pelo formulário", async ({ mesa }) => {
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await p.getByTestId("chat-modelos-abrir").click();
  await p.getByTestId("modelo-nome").fill("Espada longa");
  await p.getByTestId("modelo-bonus").fill("5");
  await p.getByTestId("modelo-dano").fill("1d8+3");
  await p.getByTestId("modelo-vantagem").selectOption("vantagem");
  await p.getByTestId("modelo-rolar").click();
  const ataque = p.getByTestId("modelo-ataque");
  await expect(ataque).toContainText("Espada longa");
  await expect(ataque.getByTestId("rolagem-vantagem")).toHaveText("vantagem");
  // Q5: acerto e dano lado a lado; a vantagem mostra os DOIS totais (o descartado pequeno), os dados só no balão
  await expect(ataque.getByTestId("rolagem-total")).toHaveCount(2);
  await expect(ataque.getByTestId("rolagem-total-descartado")).toHaveCount(1);
  await expect(ataque.getByTestId("rolagem-balao")).toHaveCount(0);
  await ataque.hover();
  await expect(ataque.getByTestId("rolagem-balao")).toBeVisible();
  // os dois d20, o descartado esmaecido, e o jogador comum não tem a opção "oculta"
  await expect(ataque.getByTestId("d20-chip")).toHaveCount(2);
  await expect(ataque.locator('[data-testid="d20-chip"][data-descartado="true"]')).toHaveCount(1);
  await expect(ataque.getByTestId("dado-rolado").first()).toBeVisible();
  await expect(p.getByTestId("modelo-oculta")).toHaveCount(0);

  await p.getByTestId("modelo-tipo").selectOption("teste");
  await p.getByTestId("modelo-nome").fill("Furtividade");
  await p.getByTestId("modelo-vantagem").selectOption("normal");
  await p.getByTestId("modelo-cd").fill("1");
  await p.getByTestId("modelo-rolar").click();
  const teste = p.getByTestId("modelo-teste");
  await expect(teste).toContainText("CD 1");
  await expect(teste.getByTestId("modelo-veredito")).toHaveText("Sucesso"); // d20 + 5 >= 1
  await p.getByTestId("modelo-cd").fill("");
  await p.getByTestId("modelo-rolar").click();
  await expect(p.getByTestId("modelo-teste")).toHaveCount(2);
  await expect(p.getByTestId("modelo-teste").last().getByTestId("modelo-veredito")).toHaveCount(0);
});

test("selo de não lidas no ícone do Chat; abrir o chat zera", async ({ mesa }) => {
  const mestre = await mesa.entrar("mestre");
  const j1 = await mesa.entrar("jogador-1");
  const p = j1.pagina;
  await abrirAba(p, "fichas");
  await expect(p.getByTestId("selo-chat")).toHaveCount(0);
  await digitar(mestre.pagina, "uma");
  await expect(p.getByTestId("selo-chat")).toHaveText("1");
  await digitar(mestre.pagina, "duas");
  await expect(p.getByTestId("selo-chat")).toHaveText("2");
  // a minha própria mensagem não conta
  await mestre.pagina.getByTestId("chat-texto").fill("");
  await abrirAba(p, "chat");
  await expect(p.getByTestId("selo-chat")).toHaveCount(0);
  // com a barra recolhida também conta
  await p.getByTestId("lateral-recolher").click();
  await digitar(mestre.pagina, "tres");
  await expect(p.getByTestId("selo-chat")).toHaveText("1");
  // o que já estava no chat ao abrir a página não é "não lida"
  await p.reload();
  await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
  await p.getByTestId("lateral-recolher").click();
  await expect(p.getByTestId("selo-chat")).toHaveCount(0);
});

test("histórico longo: o snapshot traz 200 e 'carregar anteriores' traz o resto", async ({
  mesa,
}) => {
  test.setTimeout(90_000);
  const mestre = await mesa.entrar("mestre");
  await encher(mestre.pagina, 230, "linha");
  await mestre.pagina.reload();
  await expect(mestre.pagina.getByTestId("status-conexao")).toHaveText("conectado");
  await expect(mestre.pagina.getByTestId("chat-mensagem")).toHaveCount(200);
  await expect(mestre.pagina.getByTestId("chat-anteriores")).toBeVisible();
  await mestre.pagina.getByTestId("chat-anteriores").click();
  await expect(mestre.pagina.getByTestId("chat-mensagem")).toHaveCount(230);
  await expect(mestre.pagina.getByTestId("chat-anteriores")).toHaveCount(0);
});
