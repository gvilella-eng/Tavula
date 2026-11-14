import { readFileSync } from "node:fs";
import { enviarCru, expect, intencaoCrua, type Sessao, test } from "./ajudas";
import { assets, imagensDoMapa, pngDeRuido } from "./ajudasAssets";
import { ClaudeWs, gerarToken } from "./ajudasClaude";
import { enviarPor, idDoEnvio, linkDoTexto, pngGrande, wavMudo } from "./ajudasEnvio";
import { criarDarion } from "./ajudasFicha";
import { entrarNoMapa } from "./ajudasMapa";
import { ClienteMcpHttp, URL_PELO_VITE } from "./ajudasMcp";

// M1: o Claude sobe arquivos para a mesa. O cliente do SDK (o mesmo do Claude Code) pede o envio, o teste faz o PUT do link (o
// que o `curl -T` faz) e a mesa do mestre baixa da caixa, processa pelo mesmo caminho do botão de subir e a sala aplica o uso
// como o Claude (no lote dele). Todas as imagens e o som são gerados aqui.

test.describe.configure({ timeout: 180_000 });

const abertos: ClienteMcpHttp[] = [];
test.afterEach(async () => {
  await Promise.all(abertos.splice(0).map((c) => c.fechar()));
});

async function mcpDe(s: Sessao): Promise<{ mcp: ClienteMcpHttp; token: string; id: string }> {
  const { token, id } = await gerarToken(s.pagina);
  const mcp = await ClienteMcpHttp.conectar(token, { url: URL_PELO_VITE });
  abertos.push(mcp);
  return { mcp, token, id };
}

const CENA = "Cena inicial";

const lerCena = async (mcp: ClienteMcpHttp) =>
  (await mcp.chamar("ler", { tipo: "cena", nome: CENA })).texto;

const png700 = () => pngDeRuido(700, 700, 5, 35);

test("o mapa que o Claude manda aparece na cena do mestre e do jogador, no tamanho da imagem, e o Desfazer o tira", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const jogador = await entrarNoMapa(mesa, "jogador-1");
  // A "pasta" do teste vale como a pasta local com escrita: a cópia vai para `mapas/`.
  await assets(mestre.pagina, "usarMemoriaComoPasta", true);
  const { mcp } = await mcpDe(mestre);

  const pedido = await mcp.chamar("arquivos", {
    acao: "enviar",
    uso: "mapa da cena",
    nome: "C:\\Users\\mestre\\Desktop\\cripta.png",
    cena: CENA,
    quadrados: 10,
  });
  expect(pedido.erro, pedido.texto).toBe(false);
  expect(pedido.texto).toContain("curl -sS -T");
  expect(pedido.texto).toContain("O navegador do mestre está aberto");
  // O modelo não vê o token: o texto que ele lê não traz nenhum.
  expect(pedido.texto).not.toMatch(/tvc_/);
  const link = linkDoTexto(pedido.texto);

  // O que o `curl -T` faz: PUT com o arquivo; a resposta já diz o que foi feito.
  const resposta = await enviarPor(link, png700());
  expect(resposta.status, resposta.corpo).toBe(200);
  expect(resposta.json?.estado).toBe("aplicado");
  expect(resposta.json?.mensagem).toMatch(/Pronto: cripta\.png \(mapa da cena\)/);
  expect(resposta.json?.mensagem).toMatch(/70 px por quadrado/);

  // A cena ganhou o tamanho da imagem: 700 px ÷ 70 = 10 quadrados, e tem a imagem.
  await expect.poll(() => lerCena(mcp)).toMatch(/Tamanho: 10 x 10 células.*tem imagem de mapa/);
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tiles.length)
    .toBeGreaterThan(0);
  // O jogador baixa os tiles do navegador do mestre e vê o mesmo mapa.
  await expect
    .poll(async () => (await imagensDoMapa(jogador.pagina)).tiles.length)
    .toBeGreaterThan(0);
  // O nome que a mesa guarda é só o nome (nenhum caminho do computador).
  const metas = await assets(mestre.pagina, "metas");
  expect(metas.some((m) => m.tipo === "mapa" && m.nomeOriginal === "cripta.png")).toBe(true);
  expect(JSON.stringify(mestre.frames)).not.toContain("Desktop");
  // A cópia foi para a subpasta `mapas/` da pasta local.
  await expect
    .poll(async () => (await assets(mestre.pagina, "gravados")).map((g) => g.caminho))
    .toContain("mapas/cripta.png");

  // O que o jogador recebe nunca carrega a caixa de entrada.
  expect(jogador.frames.join("\n")).not.toContain("caixa.pendentes");
  expect(jogador.frames.join("\n")).not.toContain("claude_envios");

  // O envio está no lote do Claude e o Desfazer tira o mapa (o arquivo fica na pasta).
  const lotes = await mcp.chamar("desfazer");
  expect(lotes.texto).toMatch(/Enviou mapa da cena: cripta\.png/);
  const desfez = await mcp.chamar("desfazer", { acao: "desfazer", lote: "1" });
  expect(desfez.erro, desfez.texto).toBe(false);
  await expect.poll(() => lerCena(mcp)).not.toMatch(/tem imagem de mapa/);
  await expect.poll(async () => (await imagensDoMapa(mestre.pagina)).tiles.length).toBe(0);
  expect((await assets(mestre.pagina, "metas")).some((m) => m.nomeOriginal === "cripta.png")).toBe(
    true,
  );
});

test("imagem de token e retrato pelo mesmo caminho, e o `estado` consulta o envio", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  await criarDarion(mestre.pagina);
  const { mcp } = await mcpDe(mestre);

  const token = await mcp.chamar("arquivos", {
    uso: "token",
    nome: "aldric.png",
    token: "Aldric",
  });
  expect(token.erro, token.texto).toBe(false);
  const respostaToken = await enviarPor(linkDoTexto(token.texto), png700());
  expect(respostaToken.json?.estado, respostaToken.corpo).toBe("aplicado");
  expect(respostaToken.json?.mensagem).toMatch(/a imagem entrou no token/i);
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tokensComImagem)
    .toContain("tok-jogador-1");
  // O token e o retrato são reduzidos a no máximo 512 px antes de a mesa registrá-los.
  const metaToken = (await assets(mestre.pagina, "metas")).find(
    (m) => m.nomeOriginal === "aldric.png",
  );
  expect(metaToken?.tipo).toBe("token");
  expect(Math.max(metaToken?.largura ?? 9999, metaToken?.altura ?? 9999)).toBeLessThanOrEqual(512);

  const retrato = await mcp.chamar("arquivos", {
    uso: "retrato da ficha",
    nome: "darion.png",
    ficha: "Darion",
  });
  const idRetrato = idDoEnvio(retrato.texto);
  // Outra imagem: a mesma imagem processada daria o mesmo arquivo (mesmo hash) e a mesa guarda um só.
  const respostaRetrato = await enviarPor(linkDoTexto(retrato.texto), pngDeRuido(700, 700, 9, 35));
  expect(respostaRetrato.json?.estado, respostaRetrato.corpo).toBe("aplicado");
  const hash = /Hash: ([0-9a-f]{12})/.exec(respostaRetrato.json?.mensagem ?? "")?.[1] ?? "";
  expect(hash).toHaveLength(12);
  await expect
    .poll(() => mestre.frames.some((f) => f.includes(`"retratoHash":"${hash}`)))
    .toBe(true);
  expect(
    (await assets(mestre.pagina, "metas")).find((m) => m.nomeOriginal === "darion.png")?.tipo,
  ).toBe("retrato");

  // `estado` consulta o envio já feito.
  const estado = await mcp.chamar("arquivos", { acao: "estado", envio: idRetrato });
  expect(estado.erro).toBe(false);
  expect(estado.texto).toMatch(/Pronto: darion\.png \(retrato da ficha\)/);

  // `listar` mostra o que a mesa tem e onde é usado; `usar` põe um arquivo que já existe, sem reenviar.
  const lista = await mcp.chamar("arquivos", { acao: "listar" });
  expect(lista.texto).toMatch(/aldric\.png \(token.*usado em: imagem do token Aldric/);
  expect(lista.texto).toMatch(/darion\.png \(retrato.*usado em: retrato de Darion/);
  const usar = await mcp.chamar("arquivos", {
    acao: "usar",
    uso: "token",
    hash,
    token: "Ogro",
  });
  expect(usar.erro, usar.texto).toBe(false);
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tokensComImagem)
    .toContain("tok-ogro");
});

test("envio com a mesa do mestre fechada: ao abrir, a mesa avisa 'O Claude enviou 1 arquivo', processa e aplica", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp } = await mcpDe(mestre);
  // O mestre fecha a mesa; o Claude continua (o token vale sem o navegador).
  await mestre.contexto.close();

  const pedido = await mcp.chamar("arquivos", {
    uso: "mapa",
    nome: "cripta.png",
    cena: CENA,
    quadrados: 10,
  });
  expect(pedido.texto).toMatch(/espera na caixa/);
  const resposta = await enviarPor(linkDoTexto(pedido.texto), png700());
  expect(resposta.status, resposta.corpo).toBe(200);
  // Sem navegador do mestre, o PUT não espera: o arquivo está na caixa.
  expect(resposta.json?.estado).toBe("recebido");
  const antes = await mcp.chamar("arquivos", { acao: "estado", envio: idDoEnvio(pedido.texto) });
  expect(antes.texto).toMatch(/espera o navegador do mestre/);
  expect(await lerCena(mcp)).not.toMatch(/tem imagem de mapa/);

  // O mestre volta: a mesa mostra o aviso, processa sozinha e aplica.
  const volta = await entrarNoMapa(mesa, "mestre");
  await expect(volta.pagina.getByTestId("aviso-caixa-claude")).toContainText(
    "O Claude enviou 1 arquivo",
  );
  await expect
    .poll(() => lerCena(mcp), { timeout: 60_000 })
    .toMatch(/Tamanho: 10 x 10 células.*tem imagem de mapa/);
  await expect(volta.pagina.getByTestId("aviso-caixa-claude")).toHaveAttribute(
    "data-estado",
    "pronto",
  );
  const depois = await mcp.chamar("arquivos", { acao: "estado", envio: idDoEnvio(pedido.texto) });
  expect(depois.texto).toMatch(/Pronto: cripta\.png/);
});

test("link de uso único: reusar, link inventado, origem de navegador, arquivo que não é imagem e arquivo grande são recusados", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp, id: tokenId } = await mcpDe(mestre);

  // Arquivo que não é imagem: recusado pelos primeiros bytes (o nome diz .png e o tipo diz image/png, não vale).
  const a = await mcp.chamar("arquivos", { uso: "mapa", nome: "falso.png" });
  const html = await enviarPor(
    linkDoTexto(a.texto),
    Buffer.from("<html><script>alert(1)</script></html>"),
  );
  expect(html.status).toBe(415);
  expect(html.json?.mensagem).toMatch(/Não reconheci o formato/);
  // Um som no lugar de imagem também não passa.
  const b = await mcp.chamar("arquivos", { uso: "mapa", nome: "som.png" });
  const som = await enviarPor(linkDoTexto(b.texto), wavMudo());
  expect(som.status).toBe(415);
  expect(som.json?.mensagem).toMatch(/um som/);
  // O envio recusado aparece como erro, e o link já foi queimado.
  const estadoA = await mcp.chamar("arquivos", { acao: "estado", envio: idDoEnvio(a.texto) });
  expect(estadoA.erro).toBe(true);
  expect(estadoA.texto).toMatch(/NÃO FEITO/);
  const reusoDoRecusado = await enviarPor(linkDoTexto(a.texto), png700());
  expect(reusoDoRecusado.status).toBe(410);

  // Reusar o link depois de um envio certo: recusado, e o primeiro envio continua valendo.
  const c = await mcp.chamar("arquivos", { uso: "token", nome: "x.png", token: "Ogro" });
  const linkC = linkDoTexto(c.texto);
  const primeiro = await enviarPor(linkC, png700());
  expect(primeiro.json?.estado, primeiro.corpo).toBe("aplicado");
  const reuso = await enviarPor(linkC, png700());
  expect(reuso.status).toBe(410);
  expect(reuso.json?.erro).toBe("link_gasto");

  // Um link inventado (formato certo, segredo errado) e um que nem tem o formato.
  const inventado = await enviarPor(linkC.replace(/tve_.+$/, `tve_${"A".repeat(43)}`), png700());
  expect(inventado.status).toBe(404);
  const torto = await enviarPor(linkC.replace(/tve_.+$/, "tve_curto"), png700());
  expect(torto.status).toBe(404);

  // Um navegador (qualquer Origin) nunca usa o link, nem com o segredo certo.
  const d = await mcp.chamar("arquivos", { uso: "token", nome: "y.png", token: "Ogro" });
  const linkD = linkDoTexto(d.texto);
  const deNavegador = await enviarPor(linkD, png700(), { origem: "http://evil.example" });
  expect(deNavegador.status).toBe(403);
  // A recusa por Origin não gasta o link.
  expect((await enviarPor(linkD, png700())).json?.estado).toBe("aplicado");

  // Sem Content-Length (chunked) e com mais bytes do que o limite do uso (20 MB no token): recusados sem ler o corpo.
  const e = await mcp.chamar("arquivos", { uso: "token", nome: "z.png", token: "Ogro" });
  const semTamanho = await enviarPor(linkDoTexto(e.texto), png700(), { semTamanho: true });
  expect(semTamanho.status).toBe(411);
  const f = await mcp.chamar("arquivos", { uso: "token", nome: "grande.png", token: "Ogro" });
  const grande = await enviarPor(linkDoTexto(f.texto), Buffer.alloc(21 * 1024 * 1024));
  expect(grande.status).toBe(413);
  expect(grande.json?.mensagem).toMatch(/grande demais/);

  // Revogar o token do Claude mata o link que ele tinha pedido.
  const g = await mcp.chamar("arquivos", { uso: "token", nome: "w.png", token: "Ogro" });
  const revogou = await mestre.pagina.request.post(`/api/m/t3st-m3sa-e2e7/conta/claude/revogar`, {
    data: { id: tokenId },
  });
  expect(revogou.ok()).toBe(true);
  const depoisDeRevogar = await enviarPor(linkDoTexto(g.texto), png700());
  expect(depoisDeRevogar.status).toBe(401);
});

test("o jogador não põe mapa, som nem compêndio; põe o retrato da própria ficha e não alcança a de outro", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const j1 = await entrarNoMapa(mesa, "jogador-1");
  const j2 = await entrarNoMapa(mesa, "jogador-2");
  await criarDarion(mestre.pagina);
  const { mcp } = await mcpDe(j1);
  const { mcp: mcpDaBia } = await mcpDe(j2);

  for (const uso of ["mapa", "som", "compendio"]) {
    const r = await mcp.chamar("arquivos", { uso, nome: "x.png" });
    expect(r.erro, uso).toBe(true);
    expect(r.texto, uso).toMatch(/Só o mestre põe/);
  }
  // O mestre não recebeu nenhum arquivo do jogador.
  expect(mestre.frames.join("\n")).not.toContain('"tipo":"caixa.pendentes","dados":{"envios":[{');

  // A ficha Darion é do jogador 1: o retrato dela passa (o mestre processa, a sala aplica como o Claude do jogador).
  const certo = await mcp.chamar("arquivos", {
    uso: "retrato",
    nome: "darion-j1.png",
    ficha: "Darion",
  });
  expect(certo.erro, certo.texto).toBe(false);
  const resposta = await enviarPor(linkDoTexto(certo.texto), png700());
  expect(resposta.json?.estado, resposta.corpo).toBe("aplicado");
  const hash = /Hash: ([0-9a-f]{12})/.exec(resposta.json?.mensagem ?? "")?.[1] ?? "";
  await expect.poll(() => j1.frames.some((f) => f.includes(`"retratoHash":"${hash}`))).toBe(true);
  // O jogador 2 não vê a ficha: ela nem existe para o Claude dele.
  const errado = await mcpDaBia.chamar("arquivos", {
    uso: "retrato",
    nome: "x.png",
    ficha: "Darion",
  });
  expect(errado.erro).toBe(true);
  expect(errado.texto).toMatch(/Não achei a ficha|Não existe nenhuma ficha/);
  // Concluir ou falhar um envio é do navegador do mestre: o jogador (pela tela dele) e o Claude (nem do mestre) não alcançam.
  const hashQualquer = "a".repeat(64);
  const doJogador = await enviarCru(
    j1.pagina,
    intencaoCrua("caixa.concluir", { envioId: "env-nenhum", hash: hashQualquer }),
  );
  expect(doJogador?.tipo).toBe("erro");
  expect(doJogador?.dados.codigo).toBe("sem_permissao");
  const { token: tokenDoMestre } = await gerarToken(mestre.pagina);
  const claudeDoMestre = await ClaudeWs.conectar(tokenDoMestre);
  const doClaude = await claudeDoMestre.mandar("caixa.falhar", {
    envioId: "env-nenhum",
    motivo: "x",
  });
  expect(doClaude.tipo).toBe("erro");
  expect(doClaude.dados.codigo).toBe("sem_permissao");
  await claudeDoMestre.fechar();
  // Nem a caixa de entrada nem a lista de arquivos chegam ao jogador.
  expect((await mcp.chamar("arquivos", { acao: "listar" })).erro).toBe(true);
  expect(j1.frames.join("\n")).not.toContain("caixa.pendentes");
  expect(j2.frames.join("\n")).not.toContain("caixa.pendentes");
});

test("sem shell: o arquivo vai em base64 (token) e o som e o compêndio entram pelo mesmo caminho", async ({
  mesa,
}) => {
  const mestre = await entrarNoMapa(mesa, "mestre");
  const { mcp } = await mcpDe(mestre);

  const base64 = await mcp.chamar("arquivos", {
    uso: "token",
    nome: "ogro.png",
    token: "Ogro",
    base64: png700().toString("base64"),
  });
  expect(base64.erro, base64.texto).toBe(false);
  expect(base64.texto).toMatch(/^Pronto: ogro\.png/);
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tokensComImagem)
    .toContain("tok-ogro");
  // Acima de 2 MB o base64 é recusado com o caminho do curl.
  const demais = await mcp.chamar("arquivos", {
    uso: "token",
    nome: "grande.png",
    token: "Ogro",
    base64: "A".repeat(3 * 1024 * 1024),
  });
  expect(demais.erro).toBe(true);
  expect(demais.texto).toMatch(/2 MB/);

  // Som: vira a trilha padrão da cena; o arquivo fica registrado como som.
  const pedidoSom = await mcp.chamar("arquivos", { uso: "som", nome: "taverna.wav", cena: CENA });
  const somEnviado = await enviarPor(linkDoTexto(pedidoSom.texto), wavMudo());
  expect(somEnviado.json?.estado, somEnviado.corpo).toBe("aplicado");
  expect(somEnviado.json?.mensagem).toMatch(/trilha padrão da cena/);
  expect(
    (await assets(mestre.pagina, "metas")).find((m) => m.nomeOriginal === "taverna.wav")?.tipo,
  ).toBe("som");

  // Compêndio (o exemplo do SRD, lido do repositório): validado pelo navegador e definido pela sala.
  const compendio = readFileSync(
    new URL("../../fixtures/compendio/exemplo-srd.json", import.meta.url),
  );
  const pedidoCompendio = await mcp.chamar("arquivos", { uso: "compêndio", nome: "magias.json" });
  const doCompendio = await enviarPor(linkDoTexto(pedidoCompendio.texto), compendio);
  expect(doCompendio.json?.estado, doCompendio.corpo).toBe("aplicado");
  expect(doCompendio.json?.mensagem).toMatch(/compêndio da mesa foi trocado/);
  await expect
    .poll(() => mestre.frames.some((f) => f.includes('"tipo":"compendio.alterado"')))
    .toBe(true);
  expect(
    (await assets(mestre.pagina, "metas")).find((m) => m.nomeOriginal === "magias.json")?.tipo,
  ).toBe("compendio");

  // Um json que não é compêndio: o navegador recusa e o Claude é avisado do motivo.
  const ruim = await mcp.chamar("arquivos", { uso: "compendio", nome: "lixo.json" });
  const recusado = await enviarPor(linkDoTexto(ruim.texto), Buffer.from('{"nada":"aqui"}'));
  expect(recusado.json?.estado, recusado.corpo).toBe("erro");
  expect(recusado.json?.mensagem).toMatch(/NÃO FEITO/);
});

test("um mapa grande (3150 x 3150, o caso real) é cortado em tiles e a cena fica com 45 x 45 quadrados", async ({
  mesa,
}) => {
  test.setTimeout(240_000);
  // O limite de tile menor garante mais de um tile mesmo numa máquina com GPU grande.
  const mestre = await entrarNoMapa(mesa, "mestre", { limiteTile: 2048 });
  const { mcp } = await mcpDe(mestre);
  const grande = pngGrande(3150, 3150, 70);

  const pedido = await mcp.chamar("arquivos", {
    uso: "mapa",
    nome: "masmorra.png",
    cena: CENA,
    quadrados: 45,
  });
  const resposta = await enviarPor(linkDoTexto(pedido.texto), grande);
  expect(resposta.status, resposta.corpo).toBe(200);
  // O PUT espera até 20 s; se o navegador demorar mais, a consulta continua de onde parou.
  if (resposta.json?.estado !== "aplicado") {
    await expect
      .poll(
        async () =>
          (await mcp.chamar("arquivos", { acao: "estado", envio: idDoEnvio(pedido.texto) })).texto,
        {
          timeout: 120_000,
        },
      )
      .toMatch(/^Pronto/);
  }
  await expect.poll(() => lerCena(mcp)).toMatch(/Tamanho: 45 x 45 células.*tem imagem de mapa/);
  const manifesto = (await assets(mestre.pagina, "metas")).find(
    (m) => m.nomeOriginal === "masmorra.png" && m.tipo === "mapa",
  );
  expect(manifesto?.largura).toBe(3150);
  expect(manifesto?.altura).toBe(3150);
  expect(manifesto?.tiles?.length ?? 0).toBeGreaterThan(1);
  await expect
    .poll(async () => (await imagensDoMapa(mestre.pagina)).tiles.length)
    .toBeGreaterThan(1);
});
