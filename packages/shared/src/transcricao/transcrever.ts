import { spawn } from "node:child_process";
import { mkdir, open, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  ARQUIVOS_DA_GRAVACAO,
  cabecalhoWav,
  estimarTempoQueFalta,
  type FalaDaSessao,
  formatarDuracao,
  type GravacaoJson,
  GravacaoJsonSchema,
  horaLocalDe,
  inicioDoNomeDoTrecho,
  instanteNaSessao,
  LIMITES_DA_GRAVACAO,
  lerCabecalhoWav,
  lerEventosGravados,
  lerJsonDoWhisper,
  misturarLinhaDoTempo,
  montarMarkdownDaTranscricao,
  type PessoaGravada,
  planejarEmenda,
  promptDosNomes,
  TAXA_DA_GRAVACAO,
  tituloDaTranscricao,
  trechoDoInstante,
} from "../gravacao.ts";
import { trechoDeCaminhoSeguro } from "../seguranca.ts";

// CH3: `pnpm transcrever "<pasta da gravação>"`. Para cada pessoa junta os trechos num WAV só (1 s de silêncio entre eles,
// guardando o mapa de deslocamentos), roda o `whisper-cli` do whisper.cpp (sem shell, com os argumentos numa lista), leva
// os horários de volta à hora da sessão e mistura com o que a mesa registrou (`eventos.jsonl`). Só lê e escreve dentro da
// pasta da gravação. Sem dependência nativa: só o Node.

export type ConfigDoWhisper = {
  /** O `whisper-cli` (ou `whisper-cli.exe`). */
  exe: string;
  /** Argumentos que vão antes dos de sempre (vazio no uso real; os testes põem o script do whisper falso aqui). */
  argsAntes: string[];
  modelo: string;
  idioma: string;
  /** `true`: roda na CPU (`-ng`). */
  semGpu: boolean;
};

export const TEXTO_SEM_CONFIGURACAO = [
  "O whisper.cpp ainda não está configurado.",
  "",
  "1. Instale o whisper.cpp e baixe um modelo (passo a passo em docs/WHISPER.md).",
  "2. Diga onde estão, de um destes dois jeitos:",
  "   a) variáveis de ambiente: WHISPER_EXE (o whisper-cli.exe) e WHISPER_MODELO (o arquivo .bin do modelo);",
  "   b) um arquivo transcrever.config.json na raiz do repositório (fica fora do git):",
  '      { "whisperExe": "C:\\\\whisper\\\\whisper-cli.exe", "modelo": "C:\\\\whisper\\\\ggml-large-v3-turbo.bin" }',
].join("\n");

type Env = Record<string, string | undefined>;

/** A configuração: as variáveis de ambiente valem mais que o `transcrever.config.json`. Devolve o que falta, com clareza. */
export function lerConfiguracao(
  env: Env,
  arquivo: unknown,
): { ok: true; config: ConfigDoWhisper } | { ok: false; motivo: string } {
  const a = (typeof arquivo === "object" && arquivo !== null ? arquivo : {}) as Record<
    string,
    unknown
  >;
  const texto = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
  const exe = texto(env.WHISPER_EXE) || texto(a.whisperExe);
  const modelo = texto(env.WHISPER_MODELO) || texto(a.modelo);
  let argsAntes: string[] = [];
  const brutoArgs = texto(env.WHISPER_ARGS);
  if (brutoArgs !== "") {
    try {
      const v: unknown = JSON.parse(brutoArgs);
      if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) throw new Error();
      argsAntes = v as string[];
    } catch {
      return { ok: false, motivo: "WHISPER_ARGS precisa ser uma lista JSON de textos." };
    }
  } else if (Array.isArray(a.whisperArgs) && a.whisperArgs.every((x) => typeof x === "string")) {
    argsAntes = a.whisperArgs as string[];
  }
  if (exe === "" || modelo === "") {
    const falta = [
      exe === "" ? "WHISPER_EXE (o whisper-cli)" : "",
      modelo === "" ? "WHISPER_MODELO (o modelo .bin)" : "",
    ]
      .filter((x) => x !== "")
      .join(" e ");
    return { ok: false, motivo: `Falta configurar: ${falta}.\n\n${TEXTO_SEM_CONFIGURACAO}` };
  }
  return {
    ok: true,
    config: {
      exe,
      argsAntes,
      modelo,
      idioma: texto(env.WHISPER_IDIOMA) || texto(a.idioma) || "pt",
      semGpu: texto(env.WHISPER_SEM_GPU) === "1" || a.semGpu === true,
    },
  };
}

/** `true` se `alvo` está dentro de `base` (ou é ela). Tudo o que o script lê ou escreve passa por aqui. */
export function estaDentroDe(base: string, alvo: string): boolean {
  const r = relative(resolve(base), resolve(alvo));
  if (r === "") return true;
  // `relative` devolve um caminho absoluto quando as pastas estão em discos diferentes (Windows).
  return !isAbsolute(r) && r.split(sep)[0] !== "..";
}

function dentro(base: string, ...partes: string[]): string {
  const alvo = resolve(base, ...partes);
  if (!estaDentroDe(base, alvo)) throw new Error("Caminho fora da pasta da gravação.");
  return alvo;
}

/** Defesa a mais: um trecho que começa quando a pessoa tinha ficado de fora não entra, mesmo que o arquivo exista. */
export function trechoEstaForaDaGravacao(
  pessoaId: string,
  inicioMs: number,
  fora: GravacaoJson["foraDaGravacao"],
): boolean {
  let estaFora = false;
  for (const e of [...fora]
    .filter((x) => x.pessoaId === pessoaId)
    .sort((a, b) => a.emMs - b.emMs)) {
    if (e.emMs <= inicioMs) estaFora = e.fora;
  }
  return estaFora;
}

export type Passo = {
  pessoa: string;
  indiceDaPessoa: number;
  totalDePessoas: number;
  trecho: number;
  totalDeTrechos: number;
  percentual: number;
  faltaMs: number | null;
};

export type ResultadoDoWhisper = { codigo: number | null; erro?: string };

export type PedidoAoWhisper = {
  exe: string;
  args: string[];
  /** Chamado a cada porcentagem de progresso que o whisper escreve (0 a 100). */
  aoProgresso: (percentual: number) => void;
};

/** Roda o whisper-cli SEM shell, com os argumentos numa lista (nada passa por interpretador de comandos). */
export function rodarWhisper(p: PedidoAoWhisper): Promise<ResultadoDoWhisper> {
  return new Promise((ok) => {
    let filho: ReturnType<typeof spawn>;
    try {
      filho = spawn(p.exe, p.args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      ok({ codigo: null, erro: (e as Error).message });
      return;
    }
    let cauda = "";
    const ler = (pedaco: Buffer) => {
      const texto = pedaco.toString("utf8");
      cauda = (cauda + texto).slice(-2000);
      for (const m of texto.matchAll(/progress\s*=\s*(\d{1,3})\s*%/g)) p.aoProgresso(Number(m[1]));
    };
    filho.stdout?.on("data", ler);
    filho.stderr?.on("data", ler);
    filho.on("error", (e) => ok({ codigo: null, erro: e.message }));
    filho.on("close", (codigo) =>
      ok({
        codigo,
        ...(codigo === 0 ? {} : { erro: cauda.trim().split("\n").slice(-4).join(" | ") }),
      }),
    );
  });
}

export type OpcoesDaTranscricao = {
  pasta: string;
  config: ConfigDoWhisper;
  /** O terminal: uma linha de aviso. */
  escrever: (linha: string) => void;
  /** O progresso (a pessoa, o trecho em andamento, o tempo que falta). */
  aoPasso?: (p: Passo) => void;
  rodar?: (p: PedidoAoWhisper) => Promise<ResultadoDoWhisper>;
  agora?: () => number;
  /** Para os testes: não apaga a pasta de trabalho. */
  manterTrabalho?: boolean;
};

export type ResultadoDaTranscricao = {
  falas: number;
  falhas: { pessoa: string; motivo: string }[];
  /** Pessoas sem nenhum trecho (ficaram de fora ou não falaram). */
  semFala: string[];
};

type TrechoLido = { inicioMs: number; duracaoMs: number; arquivo: string; dados: [number, number] };

async function lerTrechos(
  base: string,
  pessoa: PessoaGravada,
  fora: GravacaoJson["foraDaGravacao"],
  avisar: (t: string) => void,
): Promise<TrechoLido[]> {
  const pasta = dentro(base, pessoa.pasta);
  let nomes: string[];
  try {
    nomes = await readdir(pasta);
  } catch {
    return [];
  }
  const achados: TrechoLido[] = [];
  for (const nome of nomes) {
    const inicioMs = inicioDoNomeDoTrecho(nome);
    if (inicioMs === null) continue;
    if (trechoEstaForaDaGravacao(pessoa.id, inicioMs, fora)) continue;
    const arquivo = dentro(pasta, nome);
    const bytes = new Uint8Array(await readFile(arquivo));
    const w = lerCabecalhoWav(bytes);
    if (
      !w ||
      w.taxa !== TAXA_DA_GRAVACAO ||
      w.canais !== 1 ||
      w.bits !== 16 ||
      w.bytesDeDados === 0
    ) {
      avisar(`  ignorei ${pessoa.pasta}/${nome}: não é um WAV de 16 kHz, mono, 16 bits.`);
      continue;
    }
    achados.push({
      inicioMs,
      duracaoMs: w.duracaoMs,
      arquivo,
      dados: [w.inicioDosDados, w.bytesDeDados],
    });
  }
  return achados.sort((a, b) => a.inicioMs - b.inicioMs);
}

/** Escreve o WAV emendado: o cabeçalho, cada trecho e 1 s de silêncio entre eles. Lê um trecho por vez. */
async function escreverEmenda(
  destino: string,
  trechos: TrechoLido[],
  silencioMs: number,
): Promise<void> {
  const silencio = new Uint8Array(Math.round((silencioMs / 1000) * TAXA_DA_GRAVACAO) * 2);
  let bytesDePcm = 0;
  trechos.forEach((t, i) => {
    bytesDePcm += t.dados[1] + (i < trechos.length - 1 ? silencio.length : 0);
  });
  const saida = await open(destino, "w");
  try {
    await saida.write(cabecalhoWav(bytesDePcm, TAXA_DA_GRAVACAO));
    for (let i = 0; i < trechos.length; i++) {
      const t = trechos[i];
      if (!t) continue;
      const bytes = await readFile(t.arquivo);
      await saida.write(bytes.subarray(t.dados[0], t.dados[0] + t.dados[1]));
      if (i < trechos.length - 1) await saida.write(silencio);
    }
  } finally {
    await saida.close();
  }
}

/**
 * Transcreve a gravação. Se o whisper falhar numa pessoa, segue com as outras e devolve a falha no fim (as outras vozes
 * saem no texto mesmo assim). Grava `transcricao.json` e `transcricao.md` dentro da pasta.
 */
export async function transcrever(o: OpcoesDaTranscricao): Promise<ResultadoDaTranscricao> {
  const agora = o.agora ?? Date.now;
  const base = resolve(o.pasta);
  let bruto: string;
  try {
    bruto = await readFile(dentro(base, ARQUIVOS_DA_GRAVACAO.dados), "utf8");
  } catch {
    throw new Error(
      `Não achei ${ARQUIVOS_DA_GRAVACAO.dados} em "${base}". Essa é a pasta de uma gravação?`,
    );
  }
  const lida = GravacaoJsonSchema.safeParse(JSON.parse(bruto));
  if (!lida.success) throw new Error(`${ARQUIVOS_DA_GRAVACAO.dados} não está no formato esperado.`);
  const gravacao = lida.data;

  const nomesTxt = await readFile(dentro(base, ARQUIVOS_DA_GRAVACAO.nomes), "utf8").catch(() => "");
  const prompt = promptDosNomes(nomesTxt);
  const eventos = lerEventosGravados(
    await readFile(dentro(base, ARQUIVOS_DA_GRAVACAO.eventos), "utf8").catch(() => ""),
  );

  // O que há para fazer, pessoa por pessoa (só pastas que o próprio Távola nomeia: passam por `trechoDeCaminhoSeguro`).
  const trabalho = dentro(base, ARQUIVOS_DA_GRAVACAO.trabalho);
  await rm(trabalho, { recursive: true, force: true });
  await mkdir(trabalho, { recursive: true });
  const tarefas: { pessoa: PessoaGravada; trechos: TrechoLido[] }[] = [];
  const falhas: ResultadoDaTranscricao["falhas"] = [];
  const semFala: string[] = [];
  for (const pessoa of gravacao.pessoas) {
    if (pessoa.pasta !== trechoDeCaminhoSeguro(pessoa.pasta)) {
      falhas.push({ pessoa: pessoa.nome, motivo: "o nome da pasta dela não é seguro; ignorei." });
      continue;
    }
    const trechos = await lerTrechos(base, pessoa, gravacao.foraDaGravacao, o.escrever);
    if (trechos.length === 0) semFala.push(pessoa.nome);
    else tarefas.push({ pessoa, trechos });
  }

  const falas: FalaDaSessao[] = [];
  const duracaoTotal = tarefas.reduce(
    (s, t) => s + planejarEmenda(t.trechos.map((x) => x.duracaoMs)).totalMs,
    0,
  );
  let feitoMs = 0;
  const comecou = agora();
  const rodar = o.rodar ?? rodarWhisper;

  for (let i = 0; i < tarefas.length; i++) {
    const tarefa = tarefas[i];
    if (!tarefa) continue;
    const { pessoa, trechos } = tarefa;
    const plano = planejarEmenda(trechos.map((t) => t.duracaoMs));
    const emenda = dentro(trabalho, `${i + 1}.wav`);
    const saidaBase = dentro(trabalho, `${i + 1}`);
    o.escrever(
      `${pessoa.nome}: ${trechos.length} ${trechos.length === 1 ? "trecho" : "trechos"}, ${formatarDuracao(plano.totalMs)} de fala.`,
    );
    try {
      await escreverEmenda(emenda, trechos, LIMITES_DA_GRAVACAO.silencioDaEmendaMs);
      const args = [
        ...o.config.argsAntes,
        "-m",
        o.config.modelo,
        "-f",
        emenda,
        "-l",
        o.config.idioma,
        "-oj",
        "-of",
        saidaBase,
        "-pp",
        ...(o.config.semGpu ? ["-ng"] : []),
        ...(prompt !== "" ? ["--prompt", prompt] : []),
      ];
      const r = await rodar({
        exe: o.config.exe,
        args,
        aoProgresso: (pct) => {
          const noInstante = (plano.totalMs * Math.min(100, pct)) / 100;
          const gasto = agora() - comecou;
          const feito = feitoMs + noInstante;
          o.aoPasso?.({
            pessoa: pessoa.nome,
            indiceDaPessoa: i + 1,
            totalDePessoas: tarefas.length,
            trecho: trechoDoInstante(plano, noInstante) + 1,
            totalDeTrechos: trechos.length,
            percentual: pct,
            faltaMs: estimarTempoQueFalta(gasto, feito, Math.max(0, duracaoTotal - feito)),
          });
        },
      });
      if (r.codigo !== 0) {
        falhas.push({
          pessoa: pessoa.nome,
          motivo: `o whisper terminou com erro${r.codigo === null ? "" : ` (código ${r.codigo})`}${r.erro ? `: ${r.erro}` : ""}`,
        });
        continue;
      }
      const json = await readFile(`${saidaBase}.json`, "utf8").catch(() => null);
      if (json === null) {
        falhas.push({ pessoa: pessoa.nome, motivo: "o whisper não escreveu o JSON." });
        continue;
      }
      const dele = lerJsonDoWhisper(json);
      const inicios = trechos.map((t) => t.inicioMs);
      for (const f of dele) {
        const { sessaoMs } = instanteNaSessao(plano, inicios, f.inicioMs);
        falas.push({
          t: gravacao.inicioEpochMs + sessaoMs,
          pessoa: pessoa.nome,
          ...(pessoa.personagem ? { personagem: pessoa.personagem } : {}),
          texto: f.texto,
        });
      }
    } catch (e) {
      falhas.push({ pessoa: pessoa.nome, motivo: (e as Error).message });
    } finally {
      feitoMs += plano.totalMs;
    }
  }

  falas.sort((a, b) => a.t - b.t);
  const titulo = tituloDaTranscricao(gravacao.inicioEpochMs, gravacao.fusoMin);
  const linhas = misturarLinhaDoTempo(falas, eventos, gravacao.fusoMin);
  await writeFile(
    dentro(base, ARQUIVOS_DA_GRAVACAO.transcricaoJson),
    `${JSON.stringify(
      {
        versao: 1,
        titulo,
        inicioEpochMs: gravacao.inicioEpochMs,
        fusoMin: gravacao.fusoMin,
        geradaEmMs: agora(),
        falhas,
        linhas: falas.map((f) => ({
          hora: horaLocalDe(f.t, gravacao.fusoMin),
          pessoa: f.pessoa,
          personagem: f.personagem ?? null,
          texto: f.texto,
          t: f.t,
        })),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    dentro(base, ARQUIVOS_DA_GRAVACAO.transcricaoMd),
    montarMarkdownDaTranscricao(titulo, linhas),
  );
  if (!o.manterTrabalho) await rm(trabalho, { recursive: true, force: true });
  return { falas: falas.length, falhas, semFala };
}
