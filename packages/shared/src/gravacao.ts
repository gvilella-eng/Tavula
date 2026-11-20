import { z } from "zod";
import { trechoDeCaminhoSeguro } from "./seguranca.ts";

// CH3: gravar a sessão para a transcrição. Tudo puro (sem navegador nem Node), para o navegador do mestre (que grava só a
// fala, em trechos WAV de 16 kHz, mono, 16 bits) e o script `pnpm transcrever` (que junta os trechos, chama o whisper.cpp e
// monta o texto) usarem as mesmas regras: nomes de pasta e de arquivo, o cabeçalho do WAV, o mapa de deslocamentos, a volta
// à hora da sessão, a leitura do JSON do whisper e a mistura com o que a mesa registrou.

/** Na pasta da mesa: `gravacoes/<AAAA-MM-DD_HHhMM>/<pessoa>/<inicio-em-ms>.wav`. */
export const PASTA_DAS_GRAVACOES = "gravacoes";
/** O formato que o whisper.cpp lê sem ffmpeg: 16 kHz, mono, 16 bits. */
export const TAXA_DA_GRAVACAO = 16_000;
export const LIMITES_DA_GRAVACAO = {
  /** Folga antes e depois da fala em cada trecho. */
  folgaMs: 300,
  /** Fala mais curta que isto não vira trecho (um estalo, uma tosse). */
  falaMinimaMs: 500,
  /** Um trecho nunca passa disto (o corte é forçado). */
  trechoMaximoMs: 30_000,
  /** Silêncio entre os trechos ao juntá-los num WAV só para o whisper. */
  silencioDaEmendaMs: 1_000,
  /** O prompt do whisper tem pouco espaço (cerca de 224 tokens): passa dos caracteres, corta nos nomes. */
  promptMaximo: 500,
} as const;

export const ARQUIVOS_DA_GRAVACAO = {
  dados: "gravacao.json",
  nomes: "nomes.txt",
  eventos: "eventos.jsonl",
  transcricaoJson: "transcricao.json",
  transcricaoMd: "transcricao.md",
  /** Marca que a transcrição já foi trazida para a mesa (e se o áudio foi apagado). */
  trazida: "trazida.json",
  /** Pasta de trabalho do script (o WAV emendado e o JSON do whisper); some ao terminar. */
  trabalho: "_trabalho",
} as const;

// --- nomes e caminhos ---------------------------------------------------------------------------------------------

const dois = (n: number) => String(n).padStart(2, "0");

/** `2026-11-20_21h14`, na hora local do computador do mestre. */
export function nomeDaPastaDaGravacao(inicio: Date): string {
  return `${inicio.getFullYear()}-${dois(inicio.getMonth() + 1)}-${dois(inicio.getDate())}_${dois(inicio.getHours())}h${dois(inicio.getMinutes())}`;
}

/** A pasta de uma gravação tem este formato (e nada além dele): o script e a lista da mesa só aceitam nomes assim. */
export const PASTA_DA_GRAVACAO_VALIDA = /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}(?:-\d{1,3})?$/;

/**
 * A pasta de uma pessoa: o nome passa por `trechoDeCaminhoSeguro` (sem barra, sem `..`, sem nome reservado do Windows).
 * Dois nomes que dão a mesma pasta ganham um sufixo (`Ana`, `Ana-2`), para nunca misturar duas vozes.
 */
export function pastaDaPessoa(nome: string, usadas: ReadonlySet<string>): string {
  const base = trechoDeCaminhoSeguro(nome);
  let candidata = base;
  for (let n = 2; usadas.has(candidata.toLowerCase()); n++) candidata = `${base}-${n}`;
  return candidata;
}

/** `<inicio-em-ms>.wav`: o início do trecho em ms desde que a gravação começou (só dígitos: nunca um nome livre). */
export function nomeDoArquivoDoTrecho(inicioMs: number): string {
  return `${Math.max(0, Math.round(inicioMs))}.wav`;
}

/** O início em ms de um nome `123456.wav`, ou `null` para qualquer outro nome (o script ignora o que não for trecho). */
export function inicioDoNomeDoTrecho(nome: string): number | null {
  const m = /^(\d{1,12})\.wav$/.exec(nome);
  return m ? Number(m[1]) : null;
}

// --- o WAV (16 kHz, mono, 16 bits) --------------------------------------------------------------------------------

const BYTES_DO_CABECALHO = 44;

/** O cabeçalho de 44 bytes de um WAV PCM mono de 16 bits com `bytesDePcm` bytes de dados. */
export function cabecalhoWav(bytesDePcm: number, taxa: number = TAXA_DA_GRAVACAO): Uint8Array {
  const b = new Uint8Array(BYTES_DO_CABECALHO);
  const v = new DataView(b.buffer);
  const texto = (de: number, s: string) => {
    for (let i = 0; i < s.length; i++) b[de + i] = s.charCodeAt(i);
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + bytesDePcm, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por amostra (mono, 16 bits)
  v.setUint16(34, 16, true);
  texto(36, "data");
  v.setUint32(40, bytesDePcm, true);
  return b;
}

/** Amostras de ponto flutuante (-1 a 1) para inteiros de 16 bits (com corte, sem estourar). */
export function pcm16DeFloat(amostras: Float32Array): Int16Array {
  const saida = new Int16Array(amostras.length);
  for (let i = 0; i < amostras.length; i++) {
    const x = Math.max(-1, Math.min(1, amostras[i] ?? 0));
    saida[i] = x < 0 ? Math.round(x * 0x8000) : Math.round(x * 0x7fff);
  }
  return saida;
}

/** O arquivo WAV inteiro (cabeçalho e amostras). */
export function escreverWav(pcm: Int16Array, taxa: number = TAXA_DA_GRAVACAO): Uint8Array {
  const bytes = pcm.length * 2;
  const saida = new Uint8Array(BYTES_DO_CABECALHO + bytes);
  saida.set(cabecalhoWav(bytes, taxa), 0);
  const v = new DataView(saida.buffer);
  for (let i = 0; i < pcm.length; i++) v.setInt16(BYTES_DO_CABECALHO + i * 2, pcm[i] ?? 0, true);
  return saida;
}

export type WavLido = {
  taxa: number;
  canais: number;
  bits: number;
  /** Onde começam os dados e quantos bytes eles têm (o script copia daí, sem ler o arquivo todo na memória). */
  inicioDosDados: number;
  bytesDeDados: number;
  duracaoMs: number;
};

/** Lê o cabeçalho de um WAV PCM: procura `fmt ` e `data` (aceita blocos extras, como `LIST`). `null` se não for um WAV PCM. */
export function lerCabecalhoWav(bytes: Uint8Array): WavLido | null {
  if (bytes.length < 12) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const quatro = (de: number) => String.fromCharCode(...bytes.subarray(de, de + 4));
  if (quatro(0) !== "RIFF" || quatro(8) !== "WAVE") return null;
  let taxa = 0;
  let canais = 0;
  let bits = 0;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = quatro(pos);
    const tamanho = v.getUint32(pos + 4, true);
    if (id === "fmt " && pos + 8 + 16 <= bytes.length) {
      if (v.getUint16(pos + 8, true) !== 1) return null; // só PCM
      canais = v.getUint16(pos + 10, true);
      taxa = v.getUint32(pos + 12, true);
      bits = v.getUint16(pos + 22, true);
    } else if (id === "data") {
      if (taxa === 0 || canais === 0 || bits === 0) return null;
      const disponiveis = Math.max(0, Math.min(tamanho, bytes.length - (pos + 8)));
      const bytesPorQuadro = canais * (bits / 8);
      return {
        taxa,
        canais,
        bits,
        inicioDosDados: pos + 8,
        bytesDeDados: disponiveis,
        duracaoMs: Math.round((disponiveis / bytesPorQuadro / taxa) * 1000),
      };
    }
    pos += 8 + tamanho + (tamanho % 2);
  }
  return null;
}

// --- o que a gravação guarda (gravacao.json e eventos.jsonl) -------------------------------------------------------

const Id = z.string().min(1).max(64);

export const PessoaGravadaSchema = z.object({
  id: Id,
  nome: z.string().min(1).max(64),
  /** O personagem que a pessoa joga (o mestre não tem). */
  personagem: z.string().min(1).max(64).optional(),
  /** A pasta dela dentro da gravação (já passou por `trechoDeCaminhoSeguro`). */
  pasta: z.string().min(1).max(60),
});
export type PessoaGravada = z.infer<typeof PessoaGravadaSchema>;

export const GravacaoJsonSchema = z.object({
  versao: z.literal(1),
  /** O início da gravação (ms desde 1970): os nomes dos trechos contam a partir daqui. */
  inicioEpochMs: z.number().int().nonnegative(),
  /** O início em hora local, legível ("2026-11-20 21:14"). */
  inicioLocal: z.string().max(40),
  /** `Date.getTimezoneOffset()` do computador do mestre (positivo a oeste de Greenwich): as horas do texto são locais. */
  fusoMin: z.number().int().min(-840).max(840),
  mesaNome: z.string().max(120).optional(),
  pessoas: z.array(PessoaGravadaSchema).max(16),
  /** Quem ficou de fora da gravação ("Não gravar a minha voz") e quando (ms desde o início). */
  foraDaGravacao: z
    .array(z.object({ pessoaId: Id, emMs: z.number().nonnegative(), fora: z.boolean() }))
    .max(500),
  /** Entradas e saídas da chamada (ms desde o início). */
  entradas: z
    .array(
      z.object({ pessoaId: Id, emMs: z.number().nonnegative(), tipo: z.enum(["entrou", "saiu"]) }),
    )
    .max(2000),
  /** Quando a gravação parou (ms desde 1970). Sem ele, a gravação foi interrompida (a janela fechou). */
  fimEpochMs: z.number().int().nonnegative().optional(),
});
export type GravacaoJson = z.infer<typeof GravacaoJsonSchema>;

export const TIPOS_DE_EVENTO_GRAVADO = ["chat", "rolagem", "cena", "combate"] as const;
/** Uma linha do `eventos.jsonl`: o que a mesa registrou enquanto gravava. */
export const EventoGravadoSchema = z.object({
  /** Quando aconteceu (ms desde 1970). */
  t: z.number().int().nonnegative(),
  tipo: z.enum(TIPOS_DE_EVENTO_GRAVADO),
  texto: z.string().max(2200),
});
export type EventoGravado = z.infer<typeof EventoGravadoSchema>;

/** Lê o `eventos.jsonl`: linha a linha, ignorando a que está quebrada (uma queda no meio da escrita) ou fora do formato. */
export function lerEventosGravados(texto: string): EventoGravado[] {
  const saida: EventoGravado[] = [];
  for (const linha of texto.split("\n")) {
    if (linha.trim() === "") continue;
    try {
      const r = EventoGravadoSchema.safeParse(JSON.parse(linha));
      if (r.success) saida.push(r.data);
    } catch {
      // linha cortada
    }
  }
  return saida;
}

// --- juntar os trechos num WAV só e voltar à hora da sessão ----------------------------------------------------------

export type PlanoDaEmenda = {
  /** Onde cada trecho começa dentro do WAV emendado (ms). */
  iniciosNaEmendaMs: number[];
  duracoesMs: number[];
  totalMs: number;
};

/** O mapa de deslocamentos: cada trecho depois do anterior, com `silencioMs` entre eles. */
export function planejarEmenda(
  duracoesMs: readonly number[],
  silencioMs: number = LIMITES_DA_GRAVACAO.silencioDaEmendaMs,
): PlanoDaEmenda {
  const iniciosNaEmendaMs: number[] = [];
  let pos = 0;
  duracoesMs.forEach((d, i) => {
    iniciosNaEmendaMs.push(pos);
    pos += d + (i < duracoesMs.length - 1 ? silencioMs : 0);
  });
  return { iniciosNaEmendaMs, duracoesMs: [...duracoesMs], totalMs: pos };
}

/** Em que trecho cai um instante do WAV emendado (o último que começou antes dele; no silêncio, o anterior). */
export function trechoDoInstante(plano: PlanoDaEmenda, instanteMs: number): number {
  let achado = 0;
  for (let i = 0; i < plano.iniciosNaEmendaMs.length; i++) {
    if ((plano.iniciosNaEmendaMs[i] ?? 0) <= instanteMs) achado = i;
    else break;
  }
  return achado;
}

/**
 * Leva um instante do WAV emendado de volta ao tempo da gravação: o início do trecho (`iniciosDosTrechosMs`, os nomes dos
 * arquivos) mais o quanto se andou dentro dele. O instante no silêncio da emenda fica preso ao fim do trecho.
 */
export function instanteNaSessao(
  plano: PlanoDaEmenda,
  iniciosDosTrechosMs: readonly number[],
  instanteMs: number,
): { trecho: number; sessaoMs: number } {
  const trecho = trechoDoInstante(plano, instanteMs);
  const dentro = Math.max(
    0,
    Math.min(plano.duracoesMs[trecho] ?? 0, instanteMs - (plano.iniciosNaEmendaMs[trecho] ?? 0)),
  );
  return { trecho, sessaoMs: (iniciosDosTrechosMs[trecho] ?? 0) + dentro };
}

// --- o JSON do whisper.cpp ---------------------------------------------------------------------------------------------

export type FalaDoWhisper = { inicioMs: number; fimMs: number; texto: string };

/** "00:01:02,500" (ou com ponto) em ms; `null` se não for um tempo. */
export function tempoDoWhisperEmMs(texto: string): number | null {
  const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(texto.trim());
  if (!m) return null;
  const ms = Number(m[4]?.padEnd(3, "0"));
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + ms;
}

/** O que o whisper escreve quando não ouve fala: não entra na transcrição. */
export function ehRuidoDoWhisper(texto: string): boolean {
  const t = texto.trim();
  if (t === "") return true;
  if (/^[\p{P}\p{S}\s]+$/u.test(t)) return true; // só pontuação, notas musicais
  return /^[[(*][^\])*]*[\])*]$/.test(t) && !/\s{2}/.test(t); // [BLANK_AUDIO], (música), *risos*
}

/**
 * O JSON que o `whisper-cli -oj` escreve: `{ transcription: [{ offsets: { from, to }, timestamps: { from, to }, text }] }`
 * (os tempos em ms em `offsets`; `timestamps` é o texto "HH:MM:SS,mmm", usado se `offsets` faltar). Lança `Error` com
 * a razão se o arquivo não tiver essa forma. Ruído ("[BLANK_AUDIO]") é descartado.
 */
export function lerJsonDoWhisper(texto: string): FalaDoWhisper[] {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("O whisper não escreveu um JSON válido.");
  }
  const lista = (bruto as { transcription?: unknown } | null)?.transcription;
  if (!Array.isArray(lista)) throw new Error('O JSON do whisper não tem a lista "transcription".');
  const saida: FalaDoWhisper[] = [];
  for (const item of lista) {
    const o = item as {
      text?: unknown;
      offsets?: { from?: unknown; to?: unknown };
      timestamps?: { from?: unknown; to?: unknown };
    } | null;
    if (!o || typeof o.text !== "string") continue;
    const de =
      typeof o.offsets?.from === "number"
        ? o.offsets.from
        : typeof o.timestamps?.from === "string"
          ? tempoDoWhisperEmMs(o.timestamps.from)
          : null;
    const ate =
      typeof o.offsets?.to === "number"
        ? o.offsets.to
        : typeof o.timestamps?.to === "string"
          ? tempoDoWhisperEmMs(o.timestamps.to)
          : null;
    if (de === null) continue;
    const limpo = o.text.replace(/\s+/g, " ").trim();
    if (ehRuidoDoWhisper(limpo)) continue;
    saida.push({ inicioMs: de, fimMs: ate ?? de, texto: limpo });
  }
  return saida;
}

/**
 * Os nomes (`nomes.txt`, um por linha) viram o `--prompt` do whisper: "Nomes: Thorin, Gandalf, ...", sem repetir e cortado
 * no último nome inteiro que cabe em `max` caracteres.
 */
export function promptDosNomes(
  nomesTxt: string,
  max: number = LIMITES_DA_GRAVACAO.promptMaximo,
): string {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const linha of nomesTxt.split("\n")) {
    const n = linha.trim();
    if (n === "" || vistos.has(n.toLowerCase())) continue;
    vistos.add(n.toLowerCase());
    nomes.push(n);
  }
  let saida = "Nomes:";
  let ficou = false;
  for (const n of nomes) {
    const proximo = `${saida}${ficou ? "," : ""} ${n}`;
    if (proximo.length > max) break;
    saida = proximo;
    ficou = true;
  }
  return ficou ? `${saida}.` : "";
}

// --- a linha do tempo (fala + o que a mesa registrou) -----------------------------------------------------------------

export type FalaDaSessao = {
  /** Quando foi dita (ms desde 1970). */
  t: number;
  pessoa: string;
  personagem?: string | undefined;
  texto: string;
};

export type LinhaDoTempo = {
  t: number;
  /** "21:14", na hora local do mestre. */
  hora: string;
  texto: string;
  tipo: "fala" | EventoGravado["tipo"];
};

/** "21:14" a partir de ms desde 1970 e do `fusoMin` (`getTimezoneOffset`: positivo a oeste). */
export function horaLocalDe(epochMs: number, fusoMin: number): string {
  const d = new Date(epochMs - fusoMin * 60_000);
  return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
}

/** "20/11", na hora local do mestre. */
export function diaMesLocalDe(epochMs: number, fusoMin: number): string {
  const d = new Date(epochMs - fusoMin * 60_000);
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}`;
}

export function tituloDaTranscricao(inicioEpochMs: number, fusoMin: number): string {
  return `Sessão de ${diaMesLocalDe(inicioEpochMs, fusoMin)} — transcrição`;
}

/** "Ana (Thorin)" ou "Ana". */
export function quemFala(pessoa: string, personagem?: string): string {
  return personagem ? `${pessoa} (${personagem})` : pessoa;
}

/** Mistura as falas e os eventos numa linha do tempo só, por horário (empate: a fala antes do evento). */
export function misturarLinhaDoTempo(
  falas: readonly FalaDaSessao[],
  eventos: readonly EventoGravado[],
  fusoMin: number,
): LinhaDoTempo[] {
  const linhas: (LinhaDoTempo & { ordem: number })[] = [];
  falas.forEach((f, i) => {
    linhas.push({
      t: f.t,
      hora: horaLocalDe(f.t, fusoMin),
      texto: `${quemFala(f.pessoa, f.personagem)}: ${f.texto}`,
      tipo: "fala",
      ordem: i,
    });
  });
  eventos.forEach((e, i) => {
    linhas.push({
      t: e.t,
      hora: horaLocalDe(e.t, fusoMin),
      texto: `[${e.tipo}] ${e.texto}`,
      tipo: e.tipo,
      ordem: 1_000_000 + i,
    });
  });
  return linhas.sort((a, b) => a.t - b.t || a.ordem - b.ordem).map(({ ordem: _o, ...l }) => l);
}

/** O `transcricao.md`: o título e uma linha por fala ou evento (`21:14  Ana (Thorin): Eu abro a porta devagar.`). */
export function montarMarkdownDaTranscricao(
  titulo: string,
  linhas: readonly LinhaDoTempo[],
): string {
  return `# ${titulo}\n\n${linhas.map((l) => `${l.hora}  ${l.texto}`).join("\n")}\n`;
}

// --- tempo que falta (progresso do script) ---------------------------------------------------------------------------

/**
 * O que falta, em ms, pela velocidade até agora: `gastoMs` é o tempo de relógio já gasto e `feitoMs` o quanto do áudio ele
 * transcreveu; `faltaMs` é o áudio que sobra. `null` enquanto não há base para estimar.
 */
export function estimarTempoQueFalta(
  gastoMs: number,
  feitoMs: number,
  faltaMs: number,
): number | null {
  if (feitoMs <= 0 || gastoMs < 500) return null;
  return Math.max(0, Math.round((gastoMs / feitoMs) * faltaMs));
}

/** "2 min 05 s", "45 s", "1 h 03 min". */
export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${dois(m)} min`;
  if (m > 0) return `${m} min ${dois(s)} s`;
  return `${s} s`;
}

// --- trazer para a mesa ---------------------------------------------------------------------------------------------

export type EstadoDaGravacao = "gravada" | "transcrita" | "trazida";

/** O estado de uma gravação pelos arquivos que há na pasta dela. */
export function estadoDaGravacao(arquivos: readonly string[]): EstadoDaGravacao {
  if (arquivos.includes(ARQUIVOS_DA_GRAVACAO.trazida)) return "trazida";
  if (arquivos.includes(ARQUIVOS_DA_GRAVACAO.transcricaoMd)) return "transcrita";
  return "gravada";
}

/**
 * Parte o texto da transcrição em notas de até `max` caracteres (o limite de uma nota), sempre entre linhas. Uma sessão
 * curta cabe numa nota só; a longa vira "parte 1", "parte 2"...
 */
export function dividirEmNotas(texto: string, max: number): string[] {
  if (texto.length <= max) return [texto];
  const partes: string[] = [];
  let atual = "";
  for (const linha of texto.split("\n")) {
    const pedaco = linha.length > max ? linha.slice(0, max) : linha;
    if (atual.length + pedaco.length + 1 > max && atual !== "") {
      partes.push(atual.trimEnd());
      atual = "";
    }
    atual += `${pedaco}\n`;
  }
  if (atual.trim() !== "") partes.push(atual.trimEnd());
  return partes;
}
