import type { Cena, EstadoDePorta, Parede, Personagem, Ponto, Token } from "./estado.ts";

/** Alcance padrão para abrir uma porta (o mesmo `alcanceInteracaoM` da tocha), em metros. */
export const ALCANCE_INTERACAO_PADRAO_M = 1.5;

/** A porta (ou porta secreta) está aberta? Aberta não bloqueia nada. */
function estaAberta(p: Pick<Parede, "tipo" | "estado">): boolean {
  return (p.tipo === "porta" || p.tipo === "secreta") && p.estado === "aberta";
}

/**
 * Bloqueia a visão: parede, porta fechada ou trancada, secreta fechada. Janela e invisível não
 * bloqueiam; porta e secreta abertas também não.
 */
export function bloqueiaVisao(p: Pick<Parede, "tipo" | "estado">): boolean {
  if (p.tipo === "janela" || p.tipo === "invisivel") return false;
  return !estaAberta(p);
}

/** Bloqueia a passagem: tudo o que bloqueia a visão, mais a janela e a parede invisível. */
export function bloqueiaPassagem(p: Pick<Parede, "tipo" | "estado">): boolean {
  return !estaAberta(p);
}

/** Estado de uma porta (ou secreta) sem estado gravado: fechada. */
export function estadoDaPorta(p: Pick<Parede, "estado">): EstadoDePorta {
  return p.estado ?? "fechada";
}

/**
 * O que o jogador recebe no lugar da parede: a secreta fechada (ou trancada) é uma parede comum, sem
 * estado; a secreta aberta é uma porta aberta (ele a descobriu). As demais seguem como estão.
 * Nunca devolve `secreta`.
 */
export function paredeParaJogador(p: Parede): Parede {
  if (p.tipo !== "secreta") return p;
  const { estado: _estado, ...base } = p;
  return p.estado === "aberta"
    ? { ...base, tipo: "porta", estado: "aberta" }
    : { ...base, tipo: "parede" };
}

/** Ponto médio do segmento (onde fica o ícone da porta). */
export function meioDaParede(p: Pick<Parede, "a" | "b">): Ponto {
  return { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 };
}

const EPS = 1e-9;

function cruzamento(o: Ponto, a: Ponto, b: Ponto): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function noSegmento(p: Ponto, a: Ponto, b: Ponto): boolean {
  if (Math.abs(cruzamento(a, b, p)) > 1e-7) return false;
  return (
    p.x >= Math.min(a.x, b.x) - 1e-7 &&
    p.x <= Math.max(a.x, b.x) + 1e-7 &&
    p.y >= Math.min(a.y, b.y) - 1e-7 &&
    p.y <= Math.max(a.y, b.y) + 1e-7
  );
}

/** Dois segmentos fechados se tocam ou se cruzam? */
export function segmentosSeCruzam(p1: Ponto, p2: Ponto, q1: Ponto, q2: Ponto): boolean {
  const d1 = cruzamento(q1, q2, p1);
  const d2 = cruzamento(q1, q2, p2);
  const d3 = cruzamento(p1, p2, q1);
  const d4 = cruzamento(p1, p2, q2);
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  ) {
    return true;
  }
  return (
    noSegmento(p1, q1, q2) ||
    noSegmento(p2, q1, q2) ||
    noSegmento(q1, p1, p2) ||
    noSegmento(q2, p1, p2)
  );
}

/**
 * O trajeto em linha reta de `de` até `para` cruza (ou termina em) algo que bloqueia a passagem?
 * Só olha as paredes que a lista traz (a sala passa as da cena do token). Parede sobre a qual o
 * token já está não conta: assim ele não fica preso.
 */
export function trajetoBloqueado(
  de: Ponto,
  para: Ponto,
  paredes: readonly Pick<Parede, "a" | "b" | "tipo" | "estado">[],
): boolean {
  if (de.x === para.x && de.y === para.y) return false;
  for (const p of paredes) {
    if (!bloqueiaPassagem(p)) continue;
    if (noSegmento(de, p.a, p.b)) continue;
    if (segmentosSeCruzam(de, para, p.a, p.b)) return true;
  }
  return false;
}

/** Alcance de visão do token: o do personagem; sem personagem, o do próprio token. `null` = sem limite. */
export function alcanceDeVisao(
  token: Pick<Token, "personagemId" | "alcanceVisaoM">,
  personagens: readonly Pick<Personagem, "id" | "visao">[],
): number | null {
  if (token.personagemId !== undefined) {
    const p = personagens.find((x) => x.id === token.personagemId);
    if (p) return p.visao.alcanceM;
  }
  return token.alcanceVisaoM ?? null;
}

/** Iluminação dinâmica da cena (sem o campo: ligada). */
export function iluminacaoDinamicaLigada(cena: Pick<Cena, "iluminacaoDinamica">): boolean {
  return cena.iluminacaoDinamica !== false;
}

export type ResultadoDaPorta =
  | { ok: true; estado: "aberta" | "fechada" }
  | { ok: false; motivo: "inexistente" | "trancada" | "longe" };

/**
 * O jogador pode alternar esta porta? Só `porta` (a secreta responde como parede: não existe porta
 * ali para ele), destrancada e com algum token dele a no máximo `alcanceM` do meio. A secreta é só do
 * mestre (que passa por `alternarPorta` sem a conferência de alcance).
 */
export function alternarPortaDoJogador(
  porta: Parede | undefined,
  tokensDele: readonly Pick<Token, "x" | "y" | "cenaId">[],
  alcanceM: number,
): ResultadoDaPorta {
  if (porta?.tipo !== "porta") return { ok: false, motivo: "inexistente" };
  if (porta.estado === "trancada") return { ok: false, motivo: "trancada" };
  const meio = meioDaParede(porta);
  const perto = tokensDele.some(
    (t) => t.cenaId === porta.cenaId && Math.hypot(t.x - meio.x, t.y - meio.y) <= alcanceM + 1e-9,
  );
  if (!perto) return { ok: false, motivo: "longe" };
  return { ok: true, estado: porta.estado === "aberta" ? "fechada" : "aberta" };
}

/** O mestre alterna: aberta vira fechada; fechada ou trancada vira aberta. */
export function alternarPortaDoMestre(porta: Pick<Parede, "estado">): "aberta" | "fechada" {
  return porta.estado === "aberta" ? "fechada" : "aberta";
}
