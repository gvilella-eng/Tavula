import { z } from "zod";
import type { Estado, ObjetoDeLuz, Ponto, Token } from "./estado.ts";

// ---------------------------------------------------------------------------------------------
// Zonas (Lote 7b-2, seção 4.11, regra 6): polígonos de uma cena, só do mestre, com efeitos "enquanto
// dentro" e reações. Este arquivo tem os DADOS e a geometria pura; o que as zonas fazem na mesa (efeitos
// que entram e saem, eventos) fica em `automacoesnucleo.ts`.
//
// Sigilo (regra 7): a zona inteira (forma, nome, efeitos, reações) NUNCA chega ao jogador, nem no
// snapshot nem em evento. Ele só vê o resultado: a luz menor e a visão limitada.
// ---------------------------------------------------------------------------------------------

const Id = z.string().min(1).max(64);
const Coordenada = z.number().finite().min(-1_000_000).max(1_000_000);

export const MINIMO_DE_PONTOS_DA_ZONA = 3;
export const MAXIMO_DE_PONTOS_DA_ZONA = 64;
export const MAXIMO_DE_ZONAS = 200;

/** Os efeitos de uma zona enquanto algo está dentro: valem ao entrar e saem ao sair (sem prazo). */
export const EfeitosDaZonaSchema = z.object({
  /** Multiplica os dois raios das luzes dentro (1 = não muda). */
  luzRaioX: z.number().min(0.1).max(5).optional(),
  /** Soma metros aos dois raios das luzes dentro, depois do fator. */
  luzSomaM: z.number().min(-100).max(100).optional(),
  /** Limita o alcance de visão dos tokens dentro. */
  visaoMaxM: z.number().min(0.5).max(1000).optional(),
});
export type EfeitosDaZona = z.infer<typeof EfeitosDaZonaSchema>;

const NomeDaZona = z.string().trim().min(1).max(64);
/** O polígono, em metros (3 a 64 pontos). */
const PontosDaZona = z
  .array(z.object({ x: Coordenada, y: Coordenada }))
  .min(MINIMO_DE_PONTOS_DA_ZONA)
  .max(MAXIMO_DE_PONTOS_DA_ZONA);

export const ZonaSchema = z.object({
  id: Id,
  cenaId: Id,
  nome: NomeDaZona,
  pontos: PontosDaZona,
  /** Desligada: não tem ninguém dentro, não gera evento nem efeito. */
  ativa: z.boolean().default(true),
  efeitos: EfeitosDaZonaSchema.default({}),
});
export type Zona = z.infer<typeof ZonaSchema>;

/** `zona.criar`: a zona nova (sem `ativa` e `efeitos` vale ligada e sem efeitos). */
export const ZonaNovaSchema = ZonaSchema;

/** `zona.editar`: só o que vier muda; a sala junta e confere a zona inteira de novo. */
export const MudancasDaZonaSchema = z
  .object({
    nome: NomeDaZona,
    pontos: PontosDaZona,
    ativa: z.boolean(),
    efeitos: EfeitosDaZonaSchema,
  })
  .partial();

/** Prefixo do id dos modificadores e efeitos que as zonas põem (a sala os reconcilia sozinha). */
export const PREFIXO_DE_ZONA = "zona:";

export function zonasDe(estado: Pick<Estado, "zonas">): readonly Zona[] {
  return estado.zonas ?? [];
}

// --- Geometria -------------------------------------------------------------------------------

const EPS = 1e-9;

function naBorda(p: Ponto, a: Ponto, b: Ponto): boolean {
  const cruz = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
  if (Math.abs(cruz) > EPS * Math.max(1, comprimento)) return false;
  const dentroX = p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS;
  const dentroY = p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
  return dentroX && dentroY;
}

/** O ponto está dentro do polígono (côncavo também)? A borda e os vértices contam como dentro. */
export function pontoNaZona(p: Ponto, poligono: readonly Ponto[]): boolean {
  const n = poligono.length;
  if (n < 3) return false;
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poligono[i] as Ponto;
    const b = poligono[j] as Ponto;
    if (naBorda(p, a, b)) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro;
    }
  }
  return dentro;
}

/** O centro do token está dentro da zona (e na cena dela)? Zona desligada não tem ninguém. */
export function tokenNaZona(token: Pick<Token, "cenaId" | "x" | "y">, zona: Zona): boolean {
  return zona.ativa && token.cenaId === zona.cenaId && pontoNaZona(token, zona.pontos);
}

/**
 * Onde o objeto de luz está: na luz fixa, o ponto dela; presa a um token ou na mão, o centro do token
 * (a luz acompanha quem a carrega); num ponto, o ponto. Na mochila, ou sem o token: lugar nenhum.
 */
export function posicaoDoObjeto(
  o: Pick<ObjetoDeLuz, "cenaId" | "portador">,
  e: Pick<Estado, "tokens" | "pontos">,
): { cenaId: string; x: number; y: number } | undefined {
  const p = o.portador;
  switch (p.tipo) {
    case "cena":
      return o.cenaId === undefined ? undefined : { cenaId: o.cenaId, x: p.x, y: p.y };
    case "token": {
      const t = e.tokens.find((x) => x.id === p.tokenId);
      return t ? { cenaId: t.cenaId, x: t.x, y: t.y } : undefined;
    }
    case "mao": {
      const t = e.tokens.find((x) => x.personagemId === p.personagemId);
      return t ? { cenaId: t.cenaId, x: t.x, y: t.y } : undefined;
    }
    case "ponto": {
      const pt = e.pontos.find((x) => x.id === p.pontoId);
      return pt ? { cenaId: pt.cenaId, x: pt.x, y: pt.y } : undefined;
    }
    case "mochila":
      return undefined;
  }
}

export function objetoNaZona(
  o: Pick<ObjetoDeLuz, "cenaId" | "portador">,
  zona: Zona,
  e: Pick<Estado, "tokens" | "pontos">,
): boolean {
  if (!zona.ativa) return false;
  const pos = posicaoDoObjeto(o, e);
  return pos !== undefined && pos.cenaId === zona.cenaId && pontoNaZona(pos, zona.pontos);
}

/** Os pares `zona|token` que valem agora (zona ligada, centro do token dentro). */
export function paresNasZonas(e: Pick<Estado, "zonas" | "tokens">): Set<string> {
  const pares = new Set<string>();
  for (const z of zonasDe(e)) {
    if (!z.ativa) continue;
    for (const t of e.tokens) if (tokenNaZona(t, z)) pares.add(`${z.id}|${t.id}`);
  }
  return pares;
}

/**
 * Quem entrou e quem saiu entre dois estados: pares `zona|token`. A zona só conta se existe e está ligada
 * nos dois estados (criar, apagar, ligar ou desligar uma zona muda os efeitos, mas não é "entrar" nem
 * "sair"); o token que nasce dentro entra, e o que é apagado ou muda de cena sai.
 */
export function entradasESaidas(
  antes: Pick<Estado, "zonas" | "tokens">,
  depois: Pick<Estado, "zonas" | "tokens">,
): { entrou: { zona: Zona; tokenId: string }[]; saiu: { zona: Zona; tokenId: string }[] } {
  const saida = {
    entrou: [] as { zona: Zona; tokenId: string }[],
    saiu: [] as { zona: Zona; tokenId: string }[],
  };
  const zonasDepois = zonasDe(depois);
  if (zonasDepois.length === 0) return saida;
  const antesPares = paresNasZonas(antes);
  const depoisPares = paresNasZonas(depois);
  for (const z of zonasDepois) {
    if (!z.ativa) continue;
    if (!zonasDe(antes).some((x) => x.id === z.id && x.ativa)) continue;
    for (const t of depois.tokens) {
      const chave = `${z.id}|${t.id}`;
      if (depoisPares.has(chave) && !antesPares.has(chave)) {
        saida.entrou.push({ zona: z, tokenId: t.id });
      }
    }
    for (const t of antes.tokens) {
      const chave = `${z.id}|${t.id}`;
      if (antesPares.has(chave) && !depoisPares.has(chave)) {
        saida.saiu.push({ zona: z, tokenId: t.id });
      }
    }
  }
  return saida;
}
