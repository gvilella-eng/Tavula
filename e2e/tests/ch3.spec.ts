import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { abrirSecaoDaMesa, CAMINHO_DA_MESA, expect, type Mesa, type Sessao, test } from "./ajudas";
import { entrarNoMapa } from "./ajudasMapa";

// CH3: a tela de entrar na chamada enxuta, o desfoque em três níveis e a gravação para a transcrição. As câmeras e o
// microfone são os falsos do Chromium (só neste arquivo).

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});
test.describe.configure({ timeout: 180_000 });

type Pessoa = { id: string; mesa: Sessao; janela: Page };

/** A pessoa abre a janela da chamada pelo botão do topo e espera a tela de "antes de entrar" (com a prévia tocando). */
async function abrirAntesDeEntrar(mesa: Mesa, usuario: string): Promise<Pessoa> {
  const s = await entrarNoMapa(mesa, usuario);
  // O computador do teste não precisa dar 12 quadros por segundo no desfoque (senão ele se desliga no meio do teste).
  await s.contexto.addInitScript(() => {
    (window as unknown as { __tabletopE2E: object }).__tabletopE2E = {
      ...((window as unknown as { __tabletopE2E?: object }).__tabletopE2E ?? {}),
      semVigiaDoDesfoque: true,
      // o áudio falso do Chromium é um tom contínuo: os trechos são cortados de 3 em 3 s (o limite do corte à força), para aparecerem logo
      gravacao: { falaMinimaMs: 20, fimDeFalaMs: 600, trechoMaximoMs: 3000 },
    };
  });
  const [janela] = await Promise.all([
    s.contexto.waitForEvent("page"),
    s.pagina.getByTestId("topo-chamada").click(),
  ]);
  janela.on("pageerror", (e) => console.log("[erro na janela da chamada]", e.message));
  await expect(janela.getByTestId("chamada-antes")).toBeVisible();
  await expect(janela).toHaveURL(new RegExp(`${CAMINHO_DA_MESA}/chamada$`));
  await expect
    .poll(
      () =>
        janela.evaluate(
          () =>
            document.querySelector<HTMLVideoElement>('[data-testid="chamada-previa-video"]')
              ?.videoWidth ?? 0,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  return { id: usuario, mesa: s, janela };
}

async function entrar(p: Pessoa) {
  await p.janela.getByTestId("chamada-entrar").click();
  await expect(p.janela.getByTestId("chamada-janela")).toBeVisible();
}

const medidas = (j: Page) =>
  j.evaluate(() => {
    const caixa = (id: string) => {
      const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    };
    const corpo = document.querySelector<HTMLElement>(".chamada-antes-corpo");
    return {
      rolagem: corpo ? corpo.scrollHeight - corpo.clientHeight : -1,
      pagina: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      bloco: caixa("chamada-antes-bloco"),
      previa: caixa("chamada-previa"),
      entrar: caixa("chamada-entrar"),
      ouvindo: caixa("chamada-so-ouvindo"),
      camera: caixa("chamada-aparelho-camera"),
      microfone: caixa("chamada-aparelho-microfone"),
      fundo: caixa("chamada-fundo-seletor"),
    };
  });

for (const tela of [
  { nome: "1280x720", width: 1280, height: 720 },
  { nome: "1920x1000", width: 1920, height: 1000 },
]) {
  test(`a tela de entrar a ${tela.nome} não rola, tem a prévia grande e botões com a largura do texto`, async ({
    mesa,
  }) => {
    const p = await abrirAntesDeEntrar(mesa, "mestre");
    await p.janela.setViewportSize({ width: tela.width, height: tela.height });
    await expect(p.janela.getByTestId("chamada-antes-bloco")).toBeVisible();
    await expect.poll(async () => (await medidas(p.janela)).bloco?.w ?? 0).toBeLessThanOrEqual(721);
    const m = await medidas(p.janela);
    expect(m.rolagem).toBeLessThanOrEqual(0);
    expect(m.pagina).toBeLessThanOrEqual(0);
    // o bloco é um só, com largura máxima, e a prévia é o maior elemento: 16:9 e quase a largura do bloco
    expect(m.bloco?.w).toBeLessThanOrEqual(721);
    expect(m.previa).not.toBeNull();
    if (!m.previa || !m.bloco || !m.entrar || !m.ouvindo) throw new Error("faltam elementos");
    expect(Math.abs(m.previa.w / m.previa.h - 16 / 9)).toBeLessThan(0.02);
    expect(m.previa.w).toBeGreaterThan(m.bloco.w * 0.75);
    expect(m.previa.h).toBeGreaterThan(m.entrar.h * 5);
    // os botões têm a largura do texto (nunca a da coluna) e ficam lado a lado
    expect(m.entrar.w).toBeLessThan(m.bloco.w * 0.4);
    expect(m.ouvindo.w).toBeLessThan(m.bloco.w * 0.4);
    expect(Math.abs(m.entrar.y - m.ouvindo.y)).toBeLessThan(2);
    // câmera, microfone e fundo: mesma linha e caixas de mesma altura e base
    if (!m.camera || !m.microfone || !m.fundo) throw new Error("faltam os campos");
    expect(Math.abs(m.camera.y + m.camera.h - (m.microfone.y + m.microfone.h))).toBeLessThan(1.5);
    expect(Math.abs(m.camera.y + m.camera.h - (m.fundo.y + m.fundo.h))).toBeLessThan(1.5);
    expect(Math.abs(m.camera.h - m.fundo.h)).toBeLessThan(1.5);
  });
}

test("na janela estreita a tela de entrar volta à coluna: os botões ficam um embaixo do outro, ainda com a largura do texto", async ({
  mesa,
}) => {
  const p = await abrirAntesDeEntrar(mesa, "mestre");
  await p.janela.setViewportSize({ width: 420, height: 800 });
  await expect(p.janela.getByTestId("chamada-antes")).toHaveAttribute("data-estreita", "true");
  const m = await medidas(p.janela);
  if (!m.entrar || !m.ouvindo || !m.bloco || !m.camera || !m.microfone) {
    throw new Error("faltam elementos");
  }
  expect(m.ouvindo.y).toBeGreaterThan(m.entrar.y + m.entrar.h - 1);
  expect(m.entrar.w).toBeLessThan(m.bloco.w * 0.8);
  expect(m.camera.w).toBeGreaterThan(200);
  expect(m.microfone.y).toBeGreaterThan(m.camera.y);
});

test("o desfoque tem três níveis (Desligado, Leve e Forte) antes de entrar e na chamada; o B passa ao próximo", async ({
  mesa,
}) => {
  const a = await abrirAntesDeEntrar(mesa, "jogador-1");
  const seletor = a.janela.getByTestId("chamada-fundo-seletor");
  await expect(seletor.getByRole("button")).toHaveText(["Desligado", "Leve", "Forte"]);
  await expect(a.janela.getByTestId("chamada-fundo-nenhum")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await a.janela.getByTestId("chamada-fundo-desfocar").click();
  await expect(a.janela.getByTestId("chamada-fundo-desfocar")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(a.janela.getByTestId("chamada-fundo-nota")).not.toContainText("Carregando", {
    timeout: 60_000,
  });
  // entra já com o Leve e a escolha fica nas preferências locais
  await entrar(a);
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveText("L");
  const pref = await a.janela.evaluate(() => localStorage.getItem("tabletop:pref:chamada:geral"));
  expect(JSON.parse(pref ?? "{}").fundo).toBe("desfocar");

  // o menu da barra de baixo mostra os três níveis e o escolhido
  await a.janela.getByTestId("chamada-fundo").click();
  const menu = a.janela.getByTestId("chamada-fundo-menu");
  await expect(menu.getByRole("menuitemradio")).toContainText(["Desligado", "Leve", "Forte"]);
  await expect(a.janela.getByTestId("chamada-fundo-nivel-desfocar")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await a.janela.getByTestId("chamada-fundo-nivel-forte").click();
  await expect(menu).toHaveCount(0);
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveText("F");
  await expect(a.janela.getByTestId("chamada-quadro-jogador-1")).toHaveAttribute(
    "data-fundo",
    "forte",
  );
  // Esc fecha o menu sem mudar
  await a.janela.getByTestId("chamada-fundo").click();
  await expect(menu).toBeVisible();
  await a.janela.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveText("F");
  // o B: Forte -> Desligado -> Leve
  await a.janela.keyboard.press("b");
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveCount(0);
  await a.janela.keyboard.press("b");
  await expect(a.janela.getByTestId("chamada-fundo-letra")).toHaveText("L");
});

// --- B: gravar a sessão, transcrever e trazer para a mesa -------------------------------------------------------------

type ArquivoDaPasta = { caminho: string; base64: string };
type Gancho = {
  simularPasta(e: string | null): void;
  exportarPasta(): ArquivoDaPasta[];
  importarPasta(l: ArquivoDaPasta[]): void;
  gravados(): Promise<{ caminho: string; bytes: number }[]>;
};

/** O que a janela da chamada gravou na "pasta" dos testes (a memória do modo e2e). */
const pastaDaJanela = (j: Page) =>
  j.evaluate(() =>
    (window as unknown as { __tabletopPasta: Gancho }).__tabletopPasta.exportarPasta(),
  );

const wavsDe = (arquivos: ArquivoDaPasta[], pessoa: string) =>
  arquivos.filter((a) => a.caminho.includes(`/${pessoa}/`) && a.caminho.endsWith(".wav"));

/** O mestre liga a gravação pelo botão: confirma o que é gravado, escolhe a pasta (a simulada) e começa. */
async function ligarAGravacao(m: Pessoa) {
  await m.janela.getByTestId("chamada-gravar").click();
  const caixa = m.janela.getByTestId("chamada-confirmar-gravacao");
  await expect(caixa).toBeVisible();
  await expect(caixa).toContainText("Só a fala de cada pessoa");
  await expect(caixa).toContainText("pasta da mesa");
  // sem a pasta da mesa escolhida, a confirmação pede para escolher
  await expect(m.janela.getByTestId("chamada-confirmar-pasta")).toBeVisible();
  await expect(m.janela.getByTestId("chamada-gravacao-comecar")).toBeDisabled();
  await m.janela.getByTestId("chamada-gravacao-pasta").click();
  await expect(m.janela.getByTestId("chamada-confirmar-pasta")).toHaveCount(0);
  await m.janela.getByTestId("chamada-gravacao-comecar").click();
  await expect(caixa).toHaveCount(0);
  await expect(m.janela.getByTestId("chamada-gravar")).toHaveAttribute("aria-pressed", "true");
}

test("o mestre liga a gravação, todos veem o aviso, cada um tira só a própria voz e os trechos WAV aparecem na pasta", async ({
  mesa,
}) => {
  test.setTimeout(240_000);
  const m = await abrirAntesDeEntrar(mesa, "mestre");
  await entrar(m);
  const a = await abrirAntesDeEntrar(mesa, "jogador-1"); // fica na tela de antes de entrar
  const b = await abrirAntesDeEntrar(mesa, "jogador-2");
  await entrar(b);

  // sem a gravação, nada de aviso; o botão é só do mestre
  await expect(b.janela.getByTestId("chamada-aviso-gravacao")).toHaveCount(0);
  await expect(b.janela.getByTestId("chamada-gravar")).toHaveCount(0);
  await expect(m.janela.getByTestId("chamada-gravar")).toBeVisible();

  await ligarAGravacao(m);

  // o aviso aparece para todo mundo: dentro da chamada e também na tela de antes de entrar
  for (const p of [m, b, a]) {
    await expect(p.janela.getByTestId("chamada-aviso-gravacao")).toContainText(
      "Gravando para transcrição",
    );
  }
  await expect(a.janela.getByTestId("chamada-antes")).toBeVisible();
  // quem ainda não entrou marca "Não gravar a minha voz" e entra já de fora: a voz dele nunca começa gravada
  await a.janela.getByTestId("chamada-nao-gravar").check();
  await entrar(a);
  await expect(a.janela.getByTestId("chamada-nao-gravar")).toBeChecked();
  // o mestre vê quem ficou de fora
  await expect(m.janela.getByTestId("chamada-gravando-mestre")).toContainText("Fora da gravação:");
  await expect(m.janela.getByTestId("chamada-gravando-mestre")).toContainText("Jogador 1");
  // e o jogador não vê esse resumo
  await expect(b.janela.getByTestId("chamada-gravando-mestre")).toHaveCount(0);

  // o mestre manda uma mensagem no chat enquanto grava: vai para o eventos.jsonl
  await m.mesa.pagina.getByTestId("aba-chat").click();
  await m.mesa.pagina.getByTestId("chat-texto").fill("Vamos abrir a porta da masmorra");
  await m.mesa.pagina.getByTestId("chat-texto").press("Enter");

  // os trechos aparecem: o mestre e o Jogador 2 (que fala), nunca o Jogador 1 (que ficou de fora)
  await expect
    .poll(
      async () => {
        const pasta = await pastaDaJanela(m.janela);
        return [wavsDe(pasta, "Mestre").length > 0, wavsDe(pasta, "Jogador 2").length > 0];
      },
      { timeout: 60_000, intervals: [1000] },
    )
    .toEqual([true, true]);
  await expect(m.janela.getByTestId("chamada-gravando-trechos")).toContainText(/[1-9]\d* trecho/);

  // o Jogador 2 também tira a própria voz, no meio da gravação: a pasta dele para de crescer
  await b.janela.getByTestId("chamada-nao-gravar").check();
  await expect(m.janela.getByTestId("chamada-gravando-mestre")).toContainText("Jogador 2");
  await b.janela.waitForTimeout(1500);
  const depoisDeTirar = wavsDe(await pastaDaJanela(m.janela), "Jogador 2").length;
  await b.janela.waitForTimeout(6000);
  const bem = await pastaDaJanela(m.janela);
  expect(wavsDe(bem, "Jogador 2").length).toBe(depoisDeTirar);
  expect(wavsDe(bem, "Jogador 1")).toHaveLength(0);
  // o mestre continua sendo gravado
  const mestreAntes = wavsDe(bem, "Mestre").length;
  await expect
    .poll(async () => wavsDe(await pastaDaJanela(m.janela), "Mestre").length, { timeout: 30_000 })
    .toBeGreaterThan(mestreAntes);

  // parar pelo mesmo botão: o aviso some para todos, e fica a dica de como transcrever
  await m.janela.getByTestId("chamada-gravar").click();
  await expect(m.janela.getByTestId("chamada-gravar")).toHaveAttribute("aria-pressed", "false");
  for (const p of [m, a, b]) {
    await expect(p.janela.getByTestId("chamada-aviso-gravacao")).toHaveCount(0);
  }
  await expect(m.janela.getByTestId("chamada-gravacao-pronta")).toContainText("pnpm transcrever");

  // o que ficou na pasta
  const arquivos = await pastaDaJanela(m.janela);
  const caminhos = arquivos.map((x) => x.caminho);
  const raiz = caminhos.find((c) => c.endsWith("/gravacao.json"))?.replace("/gravacao.json", "");
  expect(raiz).toMatch(/^gravacoes\/\d{4}-\d{2}-\d{2}_\d{2}h\d{2}$/);
  expect(caminhos).toContain(`${raiz}/nomes.txt`);
  expect(caminhos).toContain(`${raiz}/eventos.jsonl`);
  const texto = (nome: string) =>
    Buffer.from(
      arquivos.find((x) => x.caminho === `${raiz}/${nome}`)?.base64 ?? "",
      "base64",
    ).toString("utf8");
  const dados = JSON.parse(texto("gravacao.json")) as {
    fimEpochMs?: number;
    foraDaGravacao: { pessoaId: string; fora: boolean }[];
  };
  expect(dados.fimEpochMs).toBeGreaterThan(0);
  expect(dados.foraDaGravacao.map((f) => [f.pessoaId, f.fora]).sort()).toEqual([
    ["jogador-1", true],
    ["jogador-2", true],
  ]);
  expect(texto("eventos.jsonl")).toContain("Vamos abrir a porta da masmorra");
  // o WAV é de 16 kHz, mono, 16 bits, com o nome só de dígitos
  const wav = arquivos.find((x) => x.caminho.includes("/Mestre/"));
  expect(wav?.caminho).toMatch(/\/Mestre\/\d+\.wav$/);
  const bytes = Buffer.from(wav?.base64 ?? "", "base64");
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.readUInt16LE(22)).toBe(1);
  expect(bytes.readUInt32LE(24)).toBe(16_000);
  expect(bytes.readUInt16LE(34)).toBe(16);
  // nada da gravação foi escrito fora de `gravacoes/`
  expect(caminhos.every((c) => c.startsWith("gravacoes/"))).toBe(true);
});

/** Um trecho de teste: 300 ms de silêncio, `falaMs` de tom e 300 ms de silêncio, em WAV de 16 kHz, mono, 16 bits. */
function trechoWav(falaMs: number): Buffer {
  const n = (ms: number) => Math.round((ms / 1000) * 16_000);
  const total = n(300) + n(falaMs) + n(300);
  const b = Buffer.alloc(44 + total * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + total * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16_000, 24);
  b.writeUInt32LE(32_000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(total * 2, 40);
  for (let i = n(300); i < n(300) + n(falaMs); i++) {
    b.writeInt16LE(i % 2 === 0 ? 3000 : -3000, 44 + i * 2);
  }
  return b;
}

const CLI = fileURLToPath(new URL("../../packages/shared/src/transcricao/cli.ts", import.meta.url));
const WHISPER_FALSO = fileURLToPath(new URL("../../fixtures/whisper-falso.mjs", import.meta.url));

test("o script transcreve com o whisper falso e a mesa traz a transcrição como nota só do mestre, apagando o áudio", async ({
  mesa,
}) => {
  test.setTimeout(120_000);
  const pastaDaGravacao = "2026-11-20_21h14";
  // 2026-11-20 21:14 em UTC-3
  const inicio = Date.UTC(2026, 10, 21, 0, 14, 0);
  const tmp = mkdtempSync(join(tmpdir(), "tavola-ch3-e2e-"));
  const raiz = join(tmp, "gravacoes", pastaDaGravacao);
  mkdirSync(join(raiz, "Mestre"), { recursive: true });
  mkdirSync(join(raiz, "Jogador 2"), { recursive: true });
  writeFileSync(join(raiz, "Mestre", "30000.wav"), trechoWav(1500));
  writeFileSync(join(raiz, "Jogador 2", "12000.wav"), trechoWav(1000));
  writeFileSync(
    join(raiz, "gravacao.json"),
    JSON.stringify({
      versao: 1,
      inicioEpochMs: inicio,
      inicioLocal: "2026-11-20 21:14",
      fusoMin: 180,
      pessoas: [
        { id: "mestre", nome: "Mestre", pasta: "Mestre" },
        { id: "jogador-2", nome: "Jogador 2", personagem: "Thorin", pasta: "Jogador 2" },
      ],
      foraDaGravacao: [],
      entradas: [],
    }),
  );
  writeFileSync(join(raiz, "nomes.txt"), "Thorin\nTorre Negra\n");
  writeFileSync(
    join(raiz, "eventos.jsonl"),
    `${JSON.stringify({ t: inicio + 12_400, tipo: "rolagem", texto: "Thorin, Percepção: 17" })}\n`,
  );

  try {
    // sem configuração: uma mensagem clara diz o que instalar e onde pôr
    const sem = spawnSync(process.execPath, [CLI, raiz], {
      env: { ...process.env, WHISPER_EXE: "", WHISPER_MODELO: "" },
      encoding: "utf8",
    });
    expect(sem.status).toBe(2);
    expect(sem.stderr).toContain("WHISPER_EXE");
    expect(sem.stderr).toContain("docs/WHISPER.md");
    // sem a pasta, mostra o uso
    expect(spawnSync(process.execPath, [CLI], { encoding: "utf8" }).status).toBe(2);

    const r = spawnSync(process.execPath, [CLI, raiz], {
      env: {
        ...process.env,
        WHISPER_EXE: process.execPath,
        WHISPER_ARGS: JSON.stringify([WHISPER_FALSO]),
        WHISPER_MODELO: "modelo-falso.bin",
      },
      encoding: "utf8",
    });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Pronto: 2 falas");
    expect(r.stdout).toMatch(/Mestre \(1\/2\) · trecho 1 de 1 · 100%/);
    const md = readFileSync(join(raiz, "transcricao.md"), "utf8");
    expect(md.trimEnd().split("\n")).toEqual([
      "# Sessão de 20/11 — transcrição",
      "",
      "21:14  Jogador 2 (Thorin): 2.wav fala 1",
      "21:14  [rolagem] Thorin, Percepção: 17",
      "21:14  Mestre: 1.wav fala 1",
    ]);
    const json = JSON.parse(readFileSync(join(raiz, "transcricao.json"), "utf8")) as {
      linhas: { hora: string; pessoa: string; personagem: string | null; texto: string }[];
    };
    expect(json.linhas.map((l) => [l.hora, l.pessoa, l.personagem])).toEqual([
      ["21:14", "Jogador 2", "Thorin"],
      ["21:14", "Mestre", null],
    ]);
    // o script não deixou a pasta de trabalho para trás
    expect(existsSync(join(raiz, "_trabalho"))).toBe(false);

    // o jogador está na mesa; a mesa do mestre ganha a gravação na pasta (a "pasta" dos testes é a memória do navegador)
    const j = await entrarNoMapa(mesa, "jogador-2");
    const m = await entrarNoMapa(mesa, "mestre");
    const arquivos = [
      "gravacao.json",
      "nomes.txt",
      "eventos.jsonl",
      "transcricao.md",
      "transcricao.json",
      "Mestre/30000.wav",
      "Jogador 2/12000.wav",
    ].map((n) => ({
      caminho: `gravacoes/${pastaDaGravacao}/${n}`,
      base64: readFileSync(join(raiz, n)).toString("base64"),
    }));
    await m.pagina.evaluate((lista) => {
      const g = (window as unknown as { __tabletopAssets: Gancho }).__tabletopAssets;
      g.simularPasta("autorizada");
      g.importarPasta(lista);
    }, arquivos);
    await m.pagina.getByTestId("aba-mesa").click();
    await abrirSecaoDaMesa(m.pagina, "gravacoes");
    const linha = m.pagina.getByTestId(`gravacao-${pastaDaGravacao}`);
    await expect(linha).toContainText("20/11 21:14");
    await expect(linha).toContainText("Mestre e Jogador 2");
    await expect(m.pagina.getByTestId(`gravacao-estado-${pastaDaGravacao}`)).toHaveText(
      "transcrita",
    );

    // "Trazer a transcrição": vira uma nota só do mestre (visível só a ele: o rascunho dele, não publicado)
    await m.pagina.getByTestId(`gravacao-trazer-${pastaDaGravacao}`).click();
    const frameDaNota = () =>
      m.frames.find((f) => f.includes('"handout.alterado"') && f.includes("Sessão de 20/11")) ?? "";
    await expect.poll(() => frameDaNota() !== "").toBe(true);
    expect(frameDaNota()).toContain("Sessão de 20/11 — transcrição");
    expect(frameDaNota()).toContain("21:14  Jogador 2 (Thorin): 2.wav fala 1");
    expect(frameDaNota()).toContain('"visivel":{"tipo":"mestre"}');
    // o jogador não vê a nota (nem o título chega a ele)
    await j.pagina.waitForTimeout(1500);
    expect(j.frames.join("\n")).not.toContain("Sessão de 20/11");
    expect(j.frames.join("\n")).not.toContain("Percepção: 17");

    // depois de trazer, a mesa pergunta se apaga o áudio; a transcrição sempre fica
    const pergunta = m.pagina.getByTestId("gravacao-apagar-audio");
    await expect(pergunta).toBeVisible();
    await expect(pergunta).toContainText("Apagar o áudio da gravação?");
    await expect(m.pagina.getByTestId(`gravacao-estado-${pastaDaGravacao}`)).toHaveText("trazida");
    await m.pagina.getByTestId("gravacao-apagar-audio-sim").click();
    await expect(pergunta).toHaveCount(0);
    await expect(linha).toContainText("sem áudio");
    const resto = await m.pagina.evaluate(() =>
      (window as unknown as { __tabletopAssets: Gancho }).__tabletopAssets
        .exportarPasta()
        .map((a) => a.caminho),
    );
    expect(resto.filter((c) => c.endsWith(".wav"))).toEqual([]);
    expect(resto).toContain(`gravacoes/${pastaDaGravacao}/transcricao.md`);
    expect(resto).toContain(`gravacoes/${pastaDaGravacao}/gravacao.json`);
    expect(resto).toContain(`gravacoes/${pastaDaGravacao}/trazida.json`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("só o mestre liga a gravação: o pedido de um jogador é recusado pela sala", async ({
  mesa,
}) => {
  const j = await entrarNoMapa(mesa, "jogador-1");
  const respostas = await j.pagina.evaluate(
    () =>
      new Promise<
        { tipo: string; dados: { codigo?: string; participantes?: { gravando: boolean }[] } }[]
      >((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        const vistas: { tipo: string; dados: { codigo?: string } }[] = [];
        const mandar = (tipo: string, dados: object) =>
          ws.send(
            JSON.stringify({ v: 1, id: `t-${Math.random().toString(36).slice(2)}`, tipo, dados }),
          );
        ws.onopen = () => {
          mandar("chamada.gravar", { ligada: true }); // fora da chamada
          mandar("chamada.entrar", { microfone: false, camera: false, soOuvindo: true });
          mandar("chamada.gravar", { ligada: true }); // dentro, mas não é o mestre
          mandar("chamada.naoGravar", { fora: true });
        };
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          if (m.tipo === "erro" || m.tipo === "chamada.quem") vistas.push(m);
        };
        setTimeout(() => {
          ws.close();
          resolve(vistas);
        }, 2500);
      }),
  );
  const erros = respostas.filter((r) => r.tipo === "erro").map((r) => r.dados.codigo);
  expect(erros).toEqual(["fora_da_chamada", "sem_permissao"]);
  // ninguém grava, e a marca de tirar a própria voz vale só para quem pediu
  const ultima = respostas.filter((r) => r.tipo === "chamada.quem").at(-1);
  expect(ultima?.dados.participantes?.some((p) => p.gravando)).toBe(false);
  expect(ultima?.dados.participantes).toEqual([
    expect.objectContaining({ usuarioId: "jogador-1", gravando: false, naoGravar: true }),
  ]);
});
