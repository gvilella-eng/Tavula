import { z } from "zod";
import {
  CenaSchema,
  LuzSchema,
  MapaDaCenaSchema,
  ObjetoDeLuzSchema,
  ParedeSchema,
  PortadorFixoSchema,
} from "./estado.ts";

// Q3: importar mapas do Dungeondraft (Universal VTT: .dd2vtt, .uvtt, .df2vtt). O arquivo é um JSON com a imagem em base64, as
// paredes, as portas e as luzes, tudo em quadrados. Este arquivo é puro: lê o JSON com tolerância (`lerUniversalVtt`), decodifica
// a imagem aos poucos (`base64ParaBytes`) e converte para o que a Távola guarda (`converterUvtt`): metros, paredes, portas e fontes
// de luz, dentro dos limites da mesa. A intenção `cena.importarMapa` cria a cena inteira de uma vez (um só pedido, um só passo do
// Desfazer); quem põe a imagem como asset é o navegador do mestre, pelo mesmo caminho do botão de subir o mapa.

/** A medida do quadrado das cenas que a importação cria (a mesma de `CENA_PADRAO`). */
export const QUADRADO_DA_IMPORTACAO_M = 1.5;

export const LIMITES_DA_IMPORTACAO = {
  /** Paredes e portas juntas por cena (assumido: um frame da sala tem 1 MiB; 3000 paredes ocupam uns 400 KB). */
  paredes: 3000,
  luzes: 200,
  /** Quantos avisos a importação leva. */
  avisos: 12,
  /** O arquivo inteiro (o JSON com a imagem em base64): o mesmo teto do mapa (64 MB). */
  bytesDoArquivo: 64 * 1024 * 1024,
} as const;

export const EXTENSOES_DO_UNIVERSAL_VTT = [".dd2vtt", ".uvtt", ".df2vtt"] as const;

/** O arquivo parece um Universal VTT pelo nome? */
export function ehArquivoUniversalVtt(nome: string): boolean {
  const n = nome.toLowerCase();
  return EXTENSOES_DO_UNIVERSAL_VTT.some((e) => n.endsWith(e));
}

/** O nome da cena a partir do nome do arquivo: sem a extensão, sem pasta, até 64 letras (assumido). */
export function nomeDaCenaDoArquivo(arquivo: string): string {
  const base = (arquivo.split(/[\\/]/).pop() ?? "").replace(/\.(dd2vtt|uvtt|df2vtt|json)$/i, "");
  const limpo = [...base]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.slice(0, 64) || "Mapa importado";
}

// --- O que vai na intenção ------------------------------------------------------------------

const FonteDaImportacaoSchema = z.object({
  id: ObjetoDeLuzSchema.shape.id,
  nome: ObjetoDeLuzSchema.shape.nome,
  portador: PortadorFixoSchema,
  luz: LuzSchema,
  intensidade: ObjetoDeLuzSchema.shape.intensidade,
  estado: ObjetoDeLuzSchema.shape.estado,
});

/** A cena que a importação cria, sem a imagem (o `assetHash` vem à parte). */
export const ImportacaoDeMapaSchema = z
  .object({
    id: z.string().min(1).max(64),
    nome: CenaSchema.shape.nome,
    pxPorQuadrado: MapaDaCenaSchema.shape.pxPorQuadrado,
    paredes: z.array(ParedeSchema.omit({ cenaId: true })).max(LIMITES_DA_IMPORTACAO.paredes),
    fontes: z.array(FonteDaImportacaoSchema).max(LIMITES_DA_IMPORTACAO.luzes),
    /** Sem o campo a cena fica com a luz ambiente de sempre (dia). */
    luzAmbiente: CenaSchema.shape.luzAmbiente.unwrap().optional(),
    /** O que foi ignorado ou cortado (só para o resumo; a sala não o guarda). */
    avisos: z.array(z.string().max(300)).max(LIMITES_DA_IMPORTACAO.avisos).optional(),
  })
  .strict();
export type ImportacaoDeMapa = z.infer<typeof ImportacaoDeMapaSchema>;

/** Plural simples: 1 parede, 2 paredes. */
function contar(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Quantas paredes, portas e luzes a importação leva. */
export function contagemDaImportacao(i: ImportacaoDeMapa): {
  paredes: number;
  portas: number;
  luzes: number;
} {
  const portas = i.paredes.filter((p) => p.tipo === "porta").length;
  return { paredes: i.paredes.length - portas, portas, luzes: i.fontes.length };
}

/** "Cena criada: 1 mapa, 142 paredes, 6 portas, 9 luzes." e o que foi ignorado. */
export function resumoDaImportacao(i: ImportacaoDeMapa): string {
  const c = contagemDaImportacao(i);
  const base = `Cena criada: 1 mapa, ${contar(c.paredes, "parede", "paredes")}, ${contar(c.portas, "porta", "portas")}, ${contar(c.luzes, "luz", "luzes")}.`;
  const avisos = i.avisos ?? [];
  return avisos.length > 0 ? `${base} ${avisos.join(" ")}` : base;
}

// --- Ler o arquivo --------------------------------------------------------------------------

export type Pt = { x: number; y: number };
export type PortaUvtt = { a: Pt; b: Pt; fechada: boolean };
export type LuzUvtt = { x: number; y: number; alcance: number; intensidade: number; cor: string };

/** O que o arquivo diz, já com a origem descontada e tudo em quadrados. */
export type DadosUvtt = {
  pxPorQuadrado: number;
  quadradosX: number;
  quadradosY: number;
  paredes: Pt[][];
  paredesDeObjetos: Pt[][];
  portas: PortaUvtt[];
  luzes: LuzUvtt[];
  /** `baked_lighting` (assumido: mapa com luz "cozida" é dia). */
  luzCozida: boolean;
  /** Cor do `ambient_light` (`#rrggbb`), se veio. */
  corAmbiente: string | null;
  /** A imagem em base64 puro (sem o prefixo `data:`), ou `null` se o arquivo não a traz. */
  imagemBase64: string | null;
  avisos: string[];
};

export type LeituraUvtt = { ok: true; dados: DadosUvtt } | { ok: false; motivo: string };

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function ponto(v: unknown, origem: Pt): Pt | null {
  if (!ehObjeto(v)) return null;
  const x = numero(v.x);
  const y = numero(v.y);
  return x === null || y === null ? null : { x: x - origem.x, y: y - origem.y };
}

/** `ffeccd8b` (ARGB) ou `eccd8b` ou `#eccd8b` viram `#eccd8b`; o que não for cor, `null`. */
export function corDoUvtt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{8}$/.test(s)) return `#${s.slice(2).toLowerCase()}`;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

/** Linhas de parede: cada polilinha vira uma lista de pontos; o que não é ponto é ignorado. */
function linhasDe(v: unknown, origem: Pt): Pt[][] {
  if (!Array.isArray(v)) return [];
  const linhas: Pt[][] = [];
  for (const l of v) {
    if (!Array.isArray(l)) continue;
    const pontos = l.flatMap((p) => {
      const q = ponto(p, origem);
      return q ? [q] : [];
    });
    if (pontos.length >= 2) linhas.push(pontos);
  }
  return linhas;
}

/**
 * Lê o texto de um Universal VTT. Tolerante: campo ausente vira vazio, `format` de qualquer versão serve, `image` vale com ou sem
 * o prefixo `data:`. Só recusa o que não é JSON, não é um objeto ou tem a grade fora do que a mesa aceita (10 a 1000 px).
 */
export function lerUniversalVtt(texto: string): LeituraUvtt {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "O arquivo não é um Universal VTT válido (o JSON não abre)." };
  }
  if (!ehObjeto(bruto)) {
    return { ok: false, motivo: "O arquivo não é um Universal VTT válido." };
  }
  const avisos: string[] = [];
  const res = ehObjeto(bruto.resolution) ? bruto.resolution : {};
  let px = numero(res.pixels_per_grid);
  if (px === null) {
    px = 70;
    avisos.push("O arquivo não diz os pixels por quadrado; usei 70.");
  }
  if (px < 10 || px > 1000) {
    return {
      ok: false,
      motivo: `A grade do arquivo (${px} px por quadrado) está fora do que a mesa aceita (10 a 1000).`,
    };
  }
  const origem = (ehObjeto(res.map_origin) ? ponto(res.map_origin, { x: 0, y: 0 }) : null) ?? {
    x: 0,
    y: 0,
  };
  const tamanho = ehObjeto(res.map_size) ? ponto(res.map_size, { x: 0, y: 0 }) : null;

  const portas: PortaUvtt[] = [];
  if (Array.isArray(bruto.portals)) {
    for (const p of bruto.portals) {
      if (!ehObjeto(p)) continue;
      let extremos: [Pt, Pt] | null = null;
      if (Array.isArray(p.bounds) && p.bounds.length >= 2) {
        const a = ponto(p.bounds[0], origem);
        const b = ponto(p.bounds[1], origem);
        if (a && b) extremos = [a, b];
      }
      if (!extremos) {
        // Sem `bounds`: meio quadrado de cada lado da posição, na direção da rotação (em radianos).
        const c = ponto(p.position, origem);
        const r = numero(p.rotation) ?? 0;
        if (c) {
          const dx = Math.cos(r) * 0.5;
          const dy = Math.sin(r) * 0.5;
          extremos = [
            { x: c.x - dx, y: c.y - dy },
            { x: c.x + dx, y: c.y + dy },
          ];
        }
      }
      if (!extremos) continue;
      portas.push({ a: extremos[0], b: extremos[1], fechada: p.closed !== false });
    }
  }

  const luzes: LuzUvtt[] = [];
  if (Array.isArray(bruto.lights)) {
    for (const l of bruto.lights) {
      if (!ehObjeto(l)) continue;
      const c = ponto(l.position, origem);
      if (!c) continue;
      luzes.push({
        x: c.x,
        y: c.y,
        alcance: Math.max(0, numero(l.range) ?? 0),
        intensidade: numero(l.intensity) ?? 1,
        cor: corDoUvtt(l.color) ?? "#ffffff",
      });
    }
  }

  const amb = ehObjeto(bruto.environment) ? bruto.environment : {};
  let imagemBase64: string | null = null;
  if (typeof bruto.image === "string" && bruto.image.length > 0) {
    let b = bruto.image;
    if (b.startsWith("data:")) b = b.slice(b.indexOf(",") + 1);
    imagemBase64 = /\s/.test(b.slice(0, 4096)) || b.includes("\n") ? b.replace(/\s+/g, "") : b;
  }

  return {
    ok: true,
    dados: {
      pxPorQuadrado: px,
      quadradosX: tamanho?.x ?? 0,
      quadradosY: tamanho?.y ?? 0,
      paredes: linhasDe(bruto.line_of_sight, origem),
      paredesDeObjetos: linhasDe(bruto.objects_line_of_sight, origem),
      portas,
      luzes,
      luzCozida: amb.baked_lighting !== false,
      corAmbiente: corDoUvtt(amb.ambient_light),
      imagemBase64,
      avisos,
    },
  };
}

/**
 * Decodifica o base64 da imagem em pedaços (a string pode ter dezenas de MB; um `atob` só duplicaria o uso de memória e
 * travaria a aba). Aceita sem os `=` do fim. `null` se não é base64.
 */
export function base64ParaBytes(b64: string): Uint8Array | null {
  let s = b64;
  const resto = s.length % 4;
  if (resto === 1) return null;
  if (resto !== 0) s += "=".repeat(4 - resto);
  const fim = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  const saida = new Uint8Array((s.length / 4) * 3 - fim);
  const PEDACO = 4 * 65536;
  let pos = 0;
  try {
    for (let i = 0; i < s.length; i += PEDACO) {
      const bin = atob(s.slice(i, i + PEDACO));
      for (let j = 0; j < bin.length; j++) saida[pos++] = bin.charCodeAt(j);
    }
  } catch {
    return null;
  }
  return pos === saida.length ? saida : saida.slice(0, pos);
}

// --- Converter para a Távola ----------------------------------------------------------------

const arredondar = (n: number) => Math.round(n * 10_000) / 10_000;

function distanciaAoSegmento(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const quad = dx * dx + dy * dy;
  const t = quad === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / quad));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Os dois extremos do trecho de parede estão sobre a porta? Então a porta já o substitui (assumido). */
function dentroDaPorta(a: Pt, b: Pt, porta: PortaUvtt): boolean {
  return (
    distanciaAoSegmento(a, porta.a, porta.b) <= 0.05 &&
    distanciaAoSegmento(b, porta.a, porta.b) <= 0.05
  );
}

/** O brilho da cor (0 a 1), para a luz ambiente de um mapa sem luz cozida. */
function brilhoDa(cor: string): number {
  const r = Number.parseInt(cor.slice(1, 3), 16);
  const g = Number.parseInt(cor.slice(3, 5), 16);
  const b = Number.parseInt(cor.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * O Universal VTT vira a cena da Távola: quadrados viram metros (1,5 m cada); linhas de parede e de objetos viram paredes (um
 * segmento por par de pontos, sem repetir); portas viram portas (fechadas como no arquivo) e tiram da parede o trecho que
 * cobrem; luzes viram fontes fixas (alcance em quadrados x 1,5 m, metade em luz plena e metade em penumbra; a cor e a
 * intensidade vêm do arquivo, a intensidade limitada a 0..1). Acima dos limites da mesa entra o que cabe e o aviso diz o resto.
 */
export function converterUvtt(
  d: DadosUvtt,
  como: { id: string; nome: string },
): { importacao: ImportacaoDeMapa } {
  const avisos = [...d.avisos];
  const m = (p: Pt): Pt => ({
    x: arredondar(p.x * QUADRADO_DA_IMPORTACAO_M),
    y: arredondar(p.y * QUADRADO_DA_IMPORTACAO_M),
  });
  const iguais = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
  const vistos = new Set<string>();
  const chave = (a: Pt, b: Pt) => {
    const k1 = `${a.x},${a.y}`;
    const k2 = `${b.x},${b.y}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };

  type Seg = { a: Pt; b: Pt; tipo: "parede" | "porta"; estado?: "fechada" | "aberta" };
  const portas: Seg[] = [];
  for (const p of d.portas) {
    const a = m(p.a);
    const b = m(p.b);
    if (iguais(a, b) || vistos.has(chave(a, b))) continue;
    vistos.add(chave(a, b));
    portas.push({ a, b, tipo: "porta", estado: p.fechada ? "fechada" : "aberta" });
  }
  const paredes: Seg[] = [];
  let cobertasPorPorta = 0;
  for (const linha of [...d.paredes, ...d.paredesDeObjetos]) {
    for (let i = 0; i + 1 < linha.length; i++) {
      const pa = linha[i] as Pt;
      const pb = linha[i + 1] as Pt;
      const a = m(pa);
      const b = m(pb);
      if (iguais(a, b) || vistos.has(chave(a, b))) continue;
      if (d.portas.some((p) => dentroDaPorta(pa, pb, p))) {
        cobertasPorPorta++;
        continue;
      }
      vistos.add(chave(a, b));
      paredes.push({ a, b, tipo: "parede" });
    }
  }
  if (cobertasPorPorta > 0) {
    avisos.push(
      `${contar(cobertasPorPorta, "trecho de parede coberto por uma porta foi", "trechos de parede cobertos por portas foram")} ignorado${cobertasPorPorta === 1 ? "" : "s"}.`,
    );
  }

  const todas = [...portas, ...paredes];
  const limite = LIMITES_DA_IMPORTACAO.paredes;
  if (todas.length > limite) {
    avisos.push(
      `O mapa tem ${todas.length} paredes e portas; entraram as primeiras ${limite} (portas primeiro).`,
    );
  }
  const paredesFinais = todas.slice(0, limite).map(
    (s, i) =>
      ({
        id: `${como.id.slice(0, 50)}-p${i + 1}`,
        a: s.a,
        b: s.b,
        tipo: s.tipo,
        ...(s.estado ? { estado: s.estado } : {}),
      }) satisfies ImportacaoDeMapa["paredes"][number],
  );

  if (d.luzes.length > LIMITES_DA_IMPORTACAO.luzes) {
    avisos.push(
      `O mapa tem ${d.luzes.length} luzes; entraram as primeiras ${LIMITES_DA_IMPORTACAO.luzes}.`,
    );
  }
  const fontes = d.luzes.slice(0, LIMITES_DA_IMPORTACAO.luzes).map((l, i) => {
    const alcanceM = Math.min(1000, l.alcance * QUADRADO_DA_IMPORTACAO_M);
    const metade = arredondar(Math.min(500, alcanceM / 2));
    const c = m(l);
    return {
      id: `${como.id.slice(0, 50)}-l${i + 1}`,
      nome: `Luz ${i + 1}`,
      portador: { tipo: "cena" as const, x: c.x, y: c.y },
      luz: { claraM: metade, penumbraM: metade, cor: l.cor, tremula: false },
      intensidade: Math.max(0, Math.min(1, l.intensidade)),
      estado: "acesa" as const,
    };
  });
  if (d.luzes.some((l) => l.alcance === 0)) {
    avisos.push("Há luzes sem alcance no arquivo; elas ficaram na cena, sem iluminar.");
  }

  // Luz ambiente: luz cozida é dia (1); sem ela vale o brilho da cor do ambiente (assumido). Sem a cor, dia.
  const ambiente = d.luzCozida || d.corAmbiente === null ? 1 : arredondar(brilhoDa(d.corAmbiente));

  const cabecalho = { id: como.id, nome: como.nome.slice(0, 64) || "Mapa importado" };
  return {
    importacao: {
      ...cabecalho,
      pxPorQuadrado: d.pxPorQuadrado,
      paredes: paredesFinais,
      fontes,
      ...(ambiente === 1 ? {} : { luzAmbiente: Math.max(0, Math.min(1, ambiente)) }),
      ...(avisos.length > 0 ? { avisos: avisos.slice(0, LIMITES_DA_IMPORTACAO.avisos) } : {}),
    },
  };
}
