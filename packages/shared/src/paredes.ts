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

/** Ponto médio da parede (onde fica o ícone da porta): o do segmento, ou o meio do arco. */
export function meioDaParede(p: Pick<Parede, "a" | "b" | "meio">): Ponto {
  const arco = arcoDaParede(p);
  if (arco) {
    const ang = arco.angulo0 + arco.varredura / 2;
    return {
      x: arco.centro.x + Math.cos(ang) * arco.raio,
      y: arco.centro.y + Math.sin(ang) * arco.raio,
    };
  }
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
  paredes: readonly Pick<Parede, "a" | "b" | "meio" | "tipo" | "estado">[],
): boolean {
  if (de.x === para.x && de.y === para.y) return false;
  for (const p of paredes) {
    if (!bloqueiaPassagem(p)) continue;
    const partes = segmentosDaParede(p);
    if (partes.some((s) => noSegmento(de, s.a, s.b))) continue;
    if (partes.some((s) => segmentosSeCruzam(de, para, s.a, s.b))) return true;
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

/** V10c: a cena é um cartão (sem o campo: é mapa). */
export function cenaEhCartao(cena: Pick<Cena, "cartao"> | undefined): boolean {
  return cena?.cartao === true;
}

/**
 * V10c: a visão dos jogadores está limitada pela luz e pelas paredes? Só num mapa com a iluminação
 * dinâmica ligada: a cena-cartão nunca limita, qualquer que seja a configuração guardada.
 */
export function visaoLimitadaNaCena(cena: Pick<Cena, "iluminacaoDinamica" | "cartao">): boolean {
  return iluminacaoDinamicaLigada(cena) && !cenaEhCartao(cena);
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

// ---------------------------------------------------------------------------------------------
// V5: paredes em arco e encaixe em meia célula
// ---------------------------------------------------------------------------------------------

/** Passo do arco ao virar segmentos, em graus (erro de corda de ~0,4% do raio). */
export const PASSO_DO_ARCO_GRAUS = 10;

const ARREDONDAR = 10000;
const arredondar = (v: number): number => Math.round(v * ARREDONDAR) / ARREDONDAR;

/** Círculo do arco: centro, raio, ângulo de `a` e varredura (radianos, com sinal) até `b` passando por `meio`. */
export type ArcoDaParede = { centro: Ponto; raio: number; angulo0: number; varredura: number };

/**
 * O arco que passa por `a`, `meio` e `b`, nessa ordem. `null` quando os três pontos são colineares (ou
 * repetidos): a parede é reta.
 */
export function arcoPorTresPontos(a: Ponto, meio: Ponto, b: Ponto): ArcoDaParede | null {
  const d = 2 * (a.x * (meio.y - b.y) + meio.x * (b.y - a.y) + b.x * (a.y - meio.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const m2 = meio.x * meio.x + meio.y * meio.y;
  const b2 = b.x * b.x + b.y * b.y;
  const cx = (a2 * (meio.y - b.y) + m2 * (b.y - a.y) + b2 * (a.y - meio.y)) / d;
  const cy = (a2 * (b.x - meio.x) + m2 * (a.x - b.x) + b2 * (meio.x - a.x)) / d;
  const raio = Math.hypot(a.x - cx, a.y - cy);
  if (!Number.isFinite(raio) || raio < 1e-6) return null;
  const volta = Math.PI * 2;
  const norm = (v: number) => ((v % volta) + volta) % volta;
  const ang0 = Math.atan2(a.y - cy, a.x - cx);
  const dm = norm(Math.atan2(meio.y - cy, meio.x - cx) - ang0);
  const db = norm(Math.atan2(b.y - cy, b.x - cx) - ang0);
  // `meio` está entre `a` e `b`: no sentido positivo se vem antes de `b`; senão dá a volta no outro.
  const varredura = dm < db ? db : db - volta;
  return { centro: { x: cx, y: cy }, raio, angulo0: ang0, varredura };
}

/** O arco da parede, ou `null` se ela é reta (sem `meio`, ou com os três pontos alinhados). */
export function arcoDaParede(p: Pick<Parede, "a" | "b" | "meio">): ArcoDaParede | null {
  return p.meio ? arcoPorTresPontos(p.a, p.meio, p.b) : null;
}

/** A parede é um arco? */
export function ehArco(p: Pick<Parede, "a" | "b" | "meio">): boolean {
  return arcoDaParede(p) !== null;
}

/** Os pontos da linha quebrada que substitui a parede (reta: `a` e `b`; arco: um a cada ~10°). */
export function pontosDaParede(p: Pick<Parede, "a" | "b" | "meio">): Ponto[] {
  const arco = arcoDaParede(p);
  if (!arco) return [p.a, p.b];
  const n = Math.max(
    2,
    Math.ceil(Math.abs(arco.varredura) / ((PASSO_DO_ARCO_GRAUS * Math.PI) / 180)),
  );
  const pontos: Ponto[] = [p.a];
  for (let i = 1; i < n; i++) {
    const ang = arco.angulo0 + (arco.varredura * i) / n;
    pontos.push({
      x: arco.centro.x + Math.cos(ang) * arco.raio,
      y: arco.centro.y + Math.sin(ang) * arco.raio,
    });
  }
  pontos.push(p.b);
  return pontos;
}

/**
 * A parede como segmentos retos curtos: é o que a visão, a luz e a passagem leem no lugar de `a`/`b`.
 * Parede reta (toda parede antiga) devolve um segmento só, igual ao de sempre.
 */
export function segmentosDaParede(p: Pick<Parede, "a" | "b" | "meio">): { a: Ponto; b: Ponto }[] {
  const pontos = pontosDaParede(p);
  const segmentos: { a: Ponto; b: Ponto }[] = [];
  for (let i = 1; i < pontos.length; i++) {
    segmentos.push({ a: pontos[i - 1] as Ponto, b: pontos[i] as Ponto });
  }
  return segmentos;
}

/** Direção (unitária) com que a parede chega em `b`: é a tangente de onde um arco tangente continua. */
export function tangenteNoFim(p: Pick<Parede, "a" | "b" | "meio">): Ponto {
  const arco = arcoDaParede(p);
  if (!arco) {
    const n = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) || 1;
    return { x: (p.b.x - p.a.x) / n, y: (p.b.y - p.a.y) / n };
  }
  const ux = (p.b.x - arco.centro.x) / arco.raio;
  const uy = (p.b.y - arco.centro.y) / arco.raio;
  const s = arco.varredura >= 0 ? 1 : -1;
  return { x: -uy * s, y: ux * s };
}

/**
 * Arco tangente (como no SolidWorks): sai de `inicio` na direção `tangente` e termina em `fim`. Devolve
 * o ponto `meio` (um ponto do arco, a meio caminho) para guardar na parede; `null` quando `fim` está
 * sobre a tangente (vira reta) ou os pontos coincidem.
 */
export function meioDoArcoTangente(inicio: Ponto, tangente: Ponto, fim: Ponto): Ponto | null {
  const tn = Math.hypot(tangente.x, tangente.y);
  if (tn < 1e-9) return null;
  const t = { x: tangente.x / tn, y: tangente.y / tn };
  const nx = -t.y;
  const ny = t.x;
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const dn = dx * nx + dy * ny;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12 || Math.abs(dn) < 1e-9 * Math.sqrt(d2)) return null;
  const r = d2 / (2 * dn);
  const cx = inicio.x + nx * r;
  const cy = inicio.y + ny * r;
  const raio = Math.abs(r);
  const ux = inicio.x - cx;
  const uy = inicio.y - cy;
  // Sentido de giro: o que leva `inicio` na direção de `tangente`.
  const s = t.x * -uy + t.y * ux >= 0 ? 1 : -1;
  const volta = Math.PI * 2;
  let varredura = s * (Math.atan2(fim.y - cy, fim.x - cx) - Math.atan2(uy, ux));
  varredura = ((varredura % volta) + volta) % volta;
  if (varredura < 1e-9) return null;
  const ang = Math.atan2(uy, ux) + (s * varredura) / 2;
  return { x: arredondar(cx + Math.cos(ang) * raio), y: arredondar(cy + Math.sin(ang) * raio) };
}

/**
 * Encaixe da parede: a rede de meia célula (cantos, meios das arestas e centro de cada quadrado: 9
 * pontos por quadrado). Qualquer direção entre esses pontos vale; o menor segmento é meia célula.
 */
export function encaixarMeiaCelula(ponto: Ponto, quadradoM: number): Ponto {
  const passo = quadradoM / 2;
  const eixo = (v: number) => arredondar(Math.round(v / passo) * passo);
  return { x: eixo(ponto.x), y: eixo(ponto.y) };
}
