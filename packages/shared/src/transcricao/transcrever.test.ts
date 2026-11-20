import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { escreverWav, type GravacaoJson, TAXA_DA_GRAVACAO } from "../gravacao.ts";
import {
  type ConfigDoWhisper,
  estaDentroDe,
  lerConfiguracao,
  type Passo,
  transcrever,
  trechoEstaForaDaGravacao,
} from "./transcrever.ts";

// CH3: o script `pnpm transcrever` com um whisper falso (um script Node que imita o JSON do `whisper-cli`).

const WHISPER_FALSO = resolve(
  fileURLToPath(new URL("../../../../fixtures/whisper-falso.mjs", import.meta.url)),
);
const CONFIG: ConfigDoWhisper = {
  exe: process.execPath,
  argsAntes: [WHISPER_FALSO],
  modelo: "modelo-falso.bin",
  idioma: "pt",
  semGpu: false,
};

/** Um trecho: 300 ms de silêncio, `falaMs` de som e 300 ms de silêncio (como o gravador corta). */
function trechoWav(falaMs: number): Uint8Array {
  const n = (ms: number) => Math.round((ms / 1000) * TAXA_DA_GRAVACAO);
  const pcm = new Int16Array(n(300) + n(falaMs) + n(300));
  for (let i = n(300); i < n(300) + n(falaMs); i++) pcm[i] = i % 2 === 0 ? 3000 : -3000;
  return escreverWav(pcm);
}

// 2026-11-20 21:14:00 em UTC-3
const INICIO = Date.UTC(2026, 10, 21, 0, 14, 0);

let raiz: string;
beforeAll(async () => {
  raiz = await mkdtemp(join(tmpdir(), "tavola-ch3-"));
});
afterAll(async () => {
  await rm(raiz, { recursive: true, force: true });
});

async function montar(nome: string, gravacao: Partial<GravacaoJson> = {}): Promise<string> {
  const pasta = join(raiz, nome);
  await mkdir(join(pasta, "Ana"), { recursive: true });
  await mkdir(join(pasta, "Vilella"), { recursive: true });
  await mkdir(join(pasta, "Beto"), { recursive: true });
  await writeFile(join(pasta, "Ana", "10000.wav"), trechoWav(1000));
  await writeFile(join(pasta, "Ana", "60000.wav"), trechoWav(1500));
  await writeFile(join(pasta, "Ana", "anotacao.txt"), "não é trecho");
  await writeFile(join(pasta, "Vilella", "30000.wav"), trechoWav(2000));
  await writeFile(join(pasta, "Beto", "5000.wav"), trechoWav(800));
  const dados: GravacaoJson = {
    versao: 1,
    inicioEpochMs: INICIO,
    inicioLocal: "2026-11-20 21:14",
    fusoMin: 180,
    pessoas: [
      { id: "mestre", nome: "Vilella", pasta: "Vilella" },
      { id: "ana", nome: "Ana", personagem: "Thorin", pasta: "Ana" },
      { id: "beto", nome: "Beto", pasta: "Beto" },
    ],
    foraDaGravacao: [],
    entradas: [],
    ...gravacao,
  };
  await writeFile(join(pasta, "gravacao.json"), JSON.stringify(dados));
  await writeFile(join(pasta, "nomes.txt"), "Thorin\nTorre Negra\n");
  await writeFile(
    join(pasta, "eventos.jsonl"),
    `${JSON.stringify({ t: INICIO + 10_400, tipo: "rolagem", texto: "Thorin, Percepção: 17" })}\n`,
  );
  return pasta;
}

describe("a configuração do whisper", () => {
  it("sem WHISPER_EXE e WHISPER_MODELO diz o que instalar e onde pôr", () => {
    const r = lerConfiguracao({}, null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("WHISPER_EXE");
    expect(r.motivo).toContain("WHISPER_MODELO");
    expect(r.motivo).toContain("docs/WHISPER.md");
    expect(r.motivo).toContain("transcrever.config.json");
  });

  it("vem do ambiente ou do transcrever.config.json (o ambiente vale mais)", () => {
    const doArquivo = {
      whisperExe: "C:\\w\\whisper-cli.exe",
      modelo: "C:\\w\\ggml.bin",
      semGpu: true,
    };
    const a = lerConfiguracao({}, doArquivo);
    expect(a).toMatchObject({
      ok: true,
      config: {
        exe: "C:\\w\\whisper-cli.exe",
        modelo: "C:\\w\\ggml.bin",
        semGpu: true,
        idioma: "pt",
      },
    });
    const b = lerConfiguracao(
      { WHISPER_EXE: "outro.exe", WHISPER_MODELO: "m.bin", WHISPER_IDIOMA: "en" },
      doArquivo,
    );
    expect(b).toMatchObject({
      ok: true,
      config: { exe: "outro.exe", modelo: "m.bin", idioma: "en" },
    });
    expect(
      lerConfiguracao({ WHISPER_EXE: "a", WHISPER_MODELO: "b", WHISPER_ARGS: "não é lista" }, null)
        .ok,
    ).toBe(false);
    expect(
      lerConfiguracao({ WHISPER_EXE: "a", WHISPER_MODELO: "b", WHISPER_ARGS: '["x.mjs"]' }, null),
    ).toMatchObject({
      ok: true,
      config: { argsAntes: ["x.mjs"] },
    });
  });
});

describe("a segurança do script", () => {
  it("só aceita caminhos dentro da pasta da gravação", () => {
    const base = resolve("C:\\mesa\\gravacoes\\2026-11-20_21h14");
    expect(estaDentroDe(base, join(base, "Ana", "1.wav"))).toBe(true);
    expect(estaDentroDe(base, base)).toBe(true);
    expect(estaDentroDe(base, join(base, "..", "outra"))).toBe(false);
    expect(estaDentroDe(base, join(base, "Ana", "..", "..", "x"))).toBe(false);
    expect(estaDentroDe(base, resolve("D:\\outro\\disco"))).toBe(false);
  });

  it("ignora o que estava fora da gravação, mesmo que o arquivo exista", () => {
    const fora = [
      { pessoaId: "ana", emMs: 5000, fora: true },
      { pessoaId: "ana", emMs: 20_000, fora: false },
    ];
    expect(trechoEstaForaDaGravacao("ana", 1000, fora)).toBe(false);
    expect(trechoEstaForaDaGravacao("ana", 10_000, fora)).toBe(true);
    expect(trechoEstaForaDaGravacao("ana", 60_000, fora)).toBe(false);
    expect(trechoEstaForaDaGravacao("beto", 10_000, fora)).toBe(false);
  });

  it("recusa uma pasta que não é de uma gravação", async () => {
    await expect(transcrever({ pasta: raiz, config: CONFIG, escrever: () => {} })).rejects.toThrow(
      /gravacao\.json/,
    );
  });
});

// Cada teste abre processos Node (o whisper falso): com a bateria inteira rodando junto, passa dos 5 s padrão.
describe("transcrever com o whisper falso", { timeout: 30_000 }, () => {
  it("gera transcricao.json e transcricao.md com a hora da sessão, misturados com os eventos", async () => {
    const pasta = await montar("boa");
    const passos: Passo[] = [];
    const avisos: string[] = [];
    const r = await transcrever({
      pasta,
      config: CONFIG,
      escrever: (l) => avisos.push(l),
      aoPasso: (p) => passos.push(p),
    });
    expect(r.falhas).toEqual([]);
    expect(r.falas).toBe(4);
    const md = await readFile(join(pasta, "transcricao.md"), "utf8");
    const linhas = md.trimEnd().split("\n");
    expect(linhas[0]).toBe("# Sessão de 20/11 — transcrição");
    // Beto fala aos 5 s (+300 ms de folga), Ana aos 10 s, a rolagem do evento aos 10,4 s, o mestre aos 30 s, Ana aos 60 s
    expect(linhas.slice(2)).toEqual([
      "21:14  Beto: 3.wav fala 1",
      "21:14  Ana (Thorin): 2.wav fala 1",
      "21:14  [rolagem] Thorin, Percepção: 17",
      "21:14  Vilella: 1.wav fala 1",
      "21:15  Ana (Thorin): 2.wav fala 2",
    ]);
    const json = JSON.parse(await readFile(join(pasta, "transcricao.json"), "utf8")) as {
      linhas: {
        hora: string;
        pessoa: string;
        personagem: string | null;
        texto: string;
        t: number;
      }[];
    };
    expect(json.linhas).toHaveLength(4);
    expect(json.linhas[1]).toMatchObject({ hora: "21:14", pessoa: "Ana", personagem: "Thorin" });
    // o horário volta à hora da sessão: 10 s + 300 ms de folga depois do início
    expect(Math.abs((json.linhas[1]?.t ?? 0) - (INICIO + 10_300))).toBeLessThan(80);
    expect(Math.abs((json.linhas[3]?.t ?? 0) - (INICIO + 60_300))).toBeLessThan(80);
    expect(Math.abs((json.linhas[2]?.t ?? 0) - (INICIO + 30_300))).toBeLessThan(80);
    // o progresso diz a pessoa, o trecho em andamento e o tempo que falta
    expect(passos.length).toBeGreaterThan(0);
    expect(passos.every((p) => p.totalDePessoas === 3)).toBe(true);
    expect(passos.some((p) => p.pessoa === "Ana" && p.totalDeTrechos === 2)).toBe(true);
    // a pasta de trabalho some e nada foi escrito fora
    expect(await readdir(pasta)).not.toContain("_trabalho");
  });

  it("se o whisper falha numa pessoa, segue com as outras e diz no fim", async () => {
    const pasta = await montar("com-falha");
    const antes = process.env.WHISPER_FALSO_FALHAR;
    process.env.WHISPER_FALSO_FALHAR = "1.wav"; // o WAV emendado do 1º da lista (Vilella é o 1º)
    try {
      const r = await transcrever({ pasta, config: CONFIG, escrever: () => {} });
      expect(r.falhas).toHaveLength(1);
      expect(r.falhas[0]?.pessoa).toBe("Vilella");
      expect(r.falhas[0]?.motivo).toContain("código 3");
      expect(r.falas).toBe(3); // as outras duas pessoas saíram
      const md = await readFile(join(pasta, "transcricao.md"), "utf8");
      expect(md).toContain("Ana (Thorin)");
      expect(md).not.toContain("Vilella: ");
    } finally {
      if (antes === undefined) delete process.env.WHISPER_FALSO_FALHAR;
      else process.env.WHISPER_FALSO_FALHAR = antes;
    }
  });

  it("quem ficou de fora da gravação não entra, mesmo com trecho na pasta", async () => {
    const pasta = await montar("fora", {
      foraDaGravacao: [{ pessoaId: "beto", emMs: 0, fora: true }],
    });
    const r = await transcrever({ pasta, config: CONFIG, escrever: () => {} });
    expect(r.semFala).toEqual(["Beto"]);
    const md = await readFile(join(pasta, "transcricao.md"), "utf8");
    expect(md).not.toContain("Beto");
  });

  it("uma pasta de pessoa que não é segura é ignorada com a razão", async () => {
    const pasta = await montar("insegura");
    const dados = JSON.parse(await readFile(join(pasta, "gravacao.json"), "utf8")) as GravacaoJson;
    dados.pessoas.push({ id: "x", nome: "Xis", pasta: "..\\..\\fora" });
    await writeFile(join(pasta, "gravacao.json"), JSON.stringify(dados));
    const r = await transcrever({ pasta, config: CONFIG, escrever: () => {} });
    expect(r.falhas.some((f) => f.pessoa === "Xis" && f.motivo.includes("não é seguro"))).toBe(
      true,
    );
    expect(r.falas).toBe(4);
  });

  it("o executável que não existe vira falha da pessoa, não queda do script", async () => {
    const pasta = await montar("sem-exe");
    const r = await transcrever({
      pasta,
      config: { ...CONFIG, exe: join(raiz, "nao-existe.exe"), argsAntes: [] },
      escrever: () => {},
    });
    expect(r.falhas).toHaveLength(3);
    expect(r.falas).toBe(0);
  });
});
