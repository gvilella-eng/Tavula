import { z } from "zod";

// ---------------------------------------------------------------------------------------------
// Dados (Lote 8): notação, aleatoriedade e rolagem. Tudo puro: quem rola é a sala, que passa a fonte
// de aleatoriedade (os testes passam uma com semente fixa).
// ---------------------------------------------------------------------------------------------

/** Limites contra abuso (PROJETO.md, Lote 8). */
export const LIMITES_DE_DADOS = {
  /** Dados por termo na expressão que alguém digita. */
  dadosPorTermo: 100,
  /** Dados por termo depois de o crítico dobrar (o resultado nunca passa disto). */
  dadosPorTermoRolado: 200,
  faces: 1000,
  termos: 20,
  /** Valor de uma constante (o bônus de um teste, a soma fixa do dano). */
  constante: 100_000,
  caracteres: 200,
} as const;

export type ManterDados = { modo: "kh" | "kl"; n: number };
export type TermoDeDados = {
  tipo: "dados";
  sinal: 1 | -1;
  quantidade: number;
  faces: number;
  /** `kh1`/`kl1`...: mantém só os N maiores (kh) ou menores (kl); os outros ficam riscados. */
  manter?: ManterDados;
};
export type TermoConstante = { tipo: "constante"; sinal: 1 | -1; valor: number };
export type TermoDaExpressao = TermoDeDados | TermoConstante;

/** O que o parser entende: só a expressão, ainda sem nenhum dado rolado. */
export type Expressao = { termos: TermoDaExpressao[] };

export type ResultadoDaLeitura = { ok: true; expressao: Expressao } | { ok: false; motivo: string };

const UM_TERMO =
  /\s*([+\-−])?\s*(?:(\d*)[dD](%|\d+)(?:[kK]([hHlL])(\d+))?(?![\dA-Za-z])|(\d+)(?![\dA-Za-z%]))\s*/y;

/**
 * Lê uma notação de dados: `NdM`, `dM` (= 1dM), `d%` (= d100), constantes, `+` e `−`, `khN`/`klN`
 * (`2d20kh1` = vantagem, `2d20kl1` = desvantagem) e espaços. Recusa o que passa dos limites com o
 * motivo, em português. Não rola nada.
 */
export function lerExpressao(texto: string): ResultadoDaLeitura {
  if (texto.length > LIMITES_DE_DADOS.caracteres) {
    return { ok: false, motivo: `A expressão passa de ${LIMITES_DE_DADOS.caracteres} caracteres.` };
  }
  if (texto.trim() === "") return { ok: false, motivo: "A expressão está vazia." };
  const termos: TermoDaExpressao[] = [];
  let posicao = 0;
  UM_TERMO.lastIndex = 0;
  while (posicao < texto.length) {
    UM_TERMO.lastIndex = posicao;
    const m = UM_TERMO.exec(texto);
    if (!m) {
      const trecho = texto.slice(posicao).trim().slice(0, 20);
      return { ok: false, motivo: `Não entendi "${trecho}".` };
    }
    posicao = UM_TERMO.lastIndex;
    const [, operador, quantidadeTexto, facesTexto, modoTexto, mantemTexto, constanteTexto] = m;
    if (termos.length > 0 && operador === undefined) {
      return { ok: false, motivo: "Falta um + ou − entre os termos." };
    }
    const sinal: 1 | -1 = operador === "-" || operador === "−" ? -1 : 1;
    if (termos.length >= LIMITES_DE_DADOS.termos) {
      return { ok: false, motivo: `No máximo ${LIMITES_DE_DADOS.termos} termos.` };
    }
    if (constanteTexto !== undefined) {
      const valor = Number(constanteTexto);
      if (valor > LIMITES_DE_DADOS.constante) {
        return {
          ok: false,
          motivo: `Número grande demais (máximo ${LIMITES_DE_DADOS.constante}).`,
        };
      }
      termos.push({ tipo: "constante", sinal, valor });
      continue;
    }
    const quantidade =
      quantidadeTexto === "" || quantidadeTexto === undefined ? 1 : Number(quantidadeTexto);
    const faces = facesTexto === "%" ? 100 : Number(facesTexto);
    if (quantidade < 1) return { ok: false, motivo: "Precisa rolar pelo menos 1 dado." };
    if (quantidade > LIMITES_DE_DADOS.dadosPorTermo) {
      return { ok: false, motivo: `No máximo ${LIMITES_DE_DADOS.dadosPorTermo} dados por termo.` };
    }
    if (faces < 2) return { ok: false, motivo: "O dado precisa de pelo menos 2 faces." };
    if (faces > LIMITES_DE_DADOS.faces) {
      return { ok: false, motivo: `No máximo ${LIMITES_DE_DADOS.faces} faces.` };
    }
    let manter: ManterDados | undefined;
    if (modoTexto !== undefined && mantemTexto !== undefined) {
      const n = Number(mantemTexto);
      if (n < 1) return { ok: false, motivo: "Manter 0 dados não faz sentido." };
      if (n > quantidade) {
        return { ok: false, motivo: `Não dá para manter ${n} de ${quantidade} dados.` };
      }
      manter = { modo: modoTexto.toLowerCase() === "h" ? "kh" : "kl", n };
    }
    termos.push({ tipo: "dados", sinal, quantidade, faces, ...(manter ? { manter } : {}) });
  }
  if (termos.length === 0) return { ok: false, motivo: "A expressão está vazia." };
  if (!termos.some((t) => t.tipo === "dados")) {
    return { ok: false, motivo: "Falta pelo menos um dado (ex.: 1d20+5)." };
  }
  return { ok: true, expressao: { termos } };
}

function textoDoTermo(t: TermoDaExpressao): string {
  if (t.tipo === "constante") return String(t.valor);
  const manter = t.manter ? `${t.manter.modo}${t.manter.n}` : "";
  return `${t.quantidade}d${t.faces}${manter}`;
}

/** Forma compacta e canônica: `1d20+5-1d4`, `2d20kh1+3`. */
export function formatarExpressao(e: Expressao): string {
  return e.termos
    .map((t, i) => `${t.sinal === -1 ? "-" : i === 0 ? "" : "+"}${textoDoTermo(t)}`)
    .join("");
}

/** Dobra a quantidade de dados de cada termo (o crítico); os modificadores não mudam. */
export function dobrarDados(e: Expressao): Expressao {
  return {
    termos: e.termos.map((t) =>
      t.tipo === "dados"
        ? {
            ...t,
            quantidade: Math.min(t.quantidade * 2, LIMITES_DE_DADOS.dadosPorTermoRolado),
            ...(t.manter
              ? {
                  manter: {
                    ...t.manter,
                    n: Math.min(t.manter.n * 2, LIMITES_DE_DADOS.dadosPorTermoRolado),
                  },
                }
              : {}),
          }
        : t,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// Aleatoriedade
// ---------------------------------------------------------------------------------------------

/** Devolve um inteiro uniforme em `0..maximoExclusivo-1`. */
export type FonteDeAleatoriedade = (maximoExclusivo: number) => number;

/**
 * A fonte de verdade: `crypto.getRandomValues` com rejeição, para não haver viés de módulo (com um
 * `% faces` direto, as faces baixas sairiam um pouco mais). `preencher` só existe para o teste
 * provar a rejeição.
 */
export function fonteCrypto(
  preencher: (b: Uint32Array) => void = (b) => {
    (
      globalThis as unknown as { crypto: { getRandomValues(b: Uint32Array): void } }
    ).crypto.getRandomValues(b);
  },
): FonteDeAleatoriedade {
  const buffer = new Uint32Array(1);
  return (maximoExclusivo) => {
    if (
      !Number.isInteger(maximoExclusivo) ||
      maximoExclusivo < 1 ||
      maximoExclusivo > 0x1_0000_0000
    ) {
      throw new RangeError("máximo inválido");
    }
    // O maior múltiplo de `maximoExclusivo` que cabe em 32 bits: acima dele os valores sobram e são descartados.
    const limite = Math.floor(0x1_0000_0000 / maximoExclusivo) * maximoExclusivo;
    for (;;) {
      preencher(buffer);
      const v = buffer[0] as number;
      if (v < limite) return v % maximoExclusivo;
    }
  };
}

/** Fonte reproduzível (mulberry32), só para testes e ganchos de teste: nunca para a mesa de verdade. */
export function fonteComSemente(semente: number): FonteDeAleatoriedade {
  let s = semente >>> 0;
  return (maximoExclusivo) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
    return Math.floor(r * maximoExclusivo);
  };
}

// ---------------------------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------------------------

const SinalSchema = z.union([z.literal(1), z.literal(-1)]);
const DadoRoladoSchema = z.object({
  valor: z.number().int(),
  /** Riscado: o `kh`/`kl` o descartou. */
  descartado: z.boolean().optional(),
});
export type DadoRolado = z.infer<typeof DadoRoladoSchema>;

const TermoRoladoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("dados"),
    sinal: SinalSchema,
    quantidade: z.number().int().min(1).max(LIMITES_DE_DADOS.dadosPorTermoRolado),
    faces: z.number().int().min(2).max(LIMITES_DE_DADOS.faces),
    manter: z
      .object({
        modo: z.enum(["kh", "kl"]),
        n: z.number().int().min(1).max(LIMITES_DE_DADOS.dadosPorTermoRolado),
      })
      .optional(),
    dados: z.array(DadoRoladoSchema).max(LIMITES_DE_DADOS.dadosPorTermoRolado),
    /** Soma dos dados mantidos, já com o sinal. */
    subtotal: z.number().int(),
  }),
  z.object({
    tipo: z.literal("constante"),
    sinal: SinalSchema,
    valor: z.number().int(),
    subtotal: z.number().int(),
  }),
]);
export type TermoRolado = z.infer<typeof TermoRoladoSchema>;

/**
 * O resultado de uma rolagem. É só o que a SALA produz: o schema do protocolo nunca o aceita de um
 * cliente (`dado.rolar` e `chat.enviar` carregam só a notação).
 */
export const RolagemSchema = z.object({
  /** O que foi rolado, na forma canônica (com o crítico, os dados já dobrados). */
  expressao: z.string().max(LIMITES_DE_DADOS.caracteres * 2),
  termos: z.array(TermoRoladoSchema).min(1).max(LIMITES_DE_DADOS.termos),
  total: z.number().int(),
});
export type Rolagem = z.infer<typeof RolagemSchema>;

/** Rola a expressão: cada dado (inclusive os descartados), o total e a notação. */
export function rolar(expressao: Expressao, fonte: FonteDeAleatoriedade): Rolagem {
  let total = 0;
  const termos: TermoRolado[] = expressao.termos.map((t) => {
    if (t.tipo === "constante") {
      const subtotal = t.sinal * t.valor;
      total += subtotal;
      return { tipo: "constante", sinal: t.sinal, valor: t.valor, subtotal };
    }
    const valores = Array.from({ length: t.quantidade }, () => fonte(t.faces) + 1);
    const descartados = new Set<number>();
    if (t.manter) {
      // Índices ordenados pelo valor; os que não ficam vão para o descarte (empate: o primeiro fica).
      const ordem = valores
        .map((valor, i) => ({ valor, i }))
        .sort(
          (a, b) => (t.manter?.modo === "kh" ? b.valor - a.valor : a.valor - b.valor) || a.i - b.i,
        );
      for (const { i } of ordem.slice(t.manter.n)) descartados.add(i);
    }
    const dados: DadoRolado[] = valores.map((valor, i) =>
      descartados.has(i) ? { valor, descartado: true } : { valor },
    );
    const soma = dados.reduce((s, d) => (d.descartado ? s : s + d.valor), 0);
    const subtotal = t.sinal * soma;
    total += subtotal;
    return {
      tipo: "dados",
      sinal: t.sinal,
      quantidade: t.quantidade,
      faces: t.faces,
      ...(t.manter ? { manter: t.manter } : {}),
      dados,
      subtotal,
    };
  });
  return { expressao: formatarExpressao(expressao), termos, total };
}

/**
 * O d20 que decide um teste ou ataque: o primeiro termo de dados de 20 faces, somando, e o dado que
 * ficou (com vantagem ou desvantagem, o maior ou o menor). `null` se não há d20 na rolagem.
 */
export function d20Natural(rolagem: Rolagem): number | null {
  for (const t of rolagem.termos) {
    if (t.tipo === "dados" && t.faces === 20 && t.sinal === 1) {
      return t.dados.find((d) => !d.descartado)?.valor ?? null;
    }
  }
  return null;
}
