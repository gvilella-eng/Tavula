import type {
  Cena,
  Estado,
  FonteDeLuz,
  Personagem,
  Ponto,
  PontoDeLuz,
  Token,
  Usuario,
} from "./estado.ts";
import { personagemVisivelPara, tokenVisivelPara } from "./mapa.ts";

/** Luz ambiente da cena: sem o campo vale 1 (dia), para não escurecer campanhas antigas. */
export function luzAmbienteDa(cena: Pick<Cena, "luzAmbiente">): number {
  return cena.luzAmbiente ?? 1;
}

/** Fator geral das fontes da cena (o slider do topo do painel): sem o campo vale 1. */
export function fatorDeLuzDa(cena: Pick<Cena, "fatorDeLuz">): number {
  return cena.fatorDeLuz ?? 1;
}

const entre01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Raios que valem de fato: os dois raios da luz multiplicados pela intensidade da fonte, pelo fator
 * geral da cena e pelos modificadores de raio que valem agora (`fatorDeRaio`, calculado pela sala).
 * `claraM` é o raio da luz plena; `totalM`, o da luz plena mais a penumbra.
 */
export function raiosEfetivos(
  fonte: Pick<FonteDeLuz, "luz" | "intensidade"> & { fatorDeRaio?: number | undefined },
  fatorGeral: number,
): { claraM: number; totalM: number } {
  const k = entre01(fonte.intensidade) * entre01(fatorGeral) * (fonte.fatorDeRaio ?? 1);
  return { claraM: fonte.luz.claraM * k, totalM: (fonte.luz.claraM + fonte.luz.penumbraM) * k };
}

/** Uma fonte pronta para desenhar: posição em metros e raios já multiplicados. */
export type LuzResolvida = {
  id: string;
  x: number;
  y: number;
  claraM: number;
  totalM: number;
  cor: string;
  tremula: boolean;
  /** Estágio "morrendo": a luz tremula mais. */
  morrendo: boolean;
};

/** Contexto para saber de onde sai e quem vê cada objeto de luz. */
export type ContextoDeLuz = Pick<Estado, "tokens" | "personagens" | "pastas" | "cenaAtivaId"> & {
  pontos: readonly PontoDeLuz[];
};

/** O token do personagem (na cena `cenaId`, se dada). Personagem de jogador tem um token só. */
export function tokenDoPersonagem<T extends Pick<Token, "personagemId" | "cenaId">>(
  tokens: readonly T[],
  personagemId: string,
  cenaId?: string,
): T | undefined {
  return tokens.find(
    (t) => t.personagemId === personagemId && (cenaId === undefined || t.cenaId === cenaId),
  );
}

/**
 * A cena onde a luz está: a da própria luz (fixa ou presa a token), a do ponto, a do token de quem a
 * segura. Na mochila (ou sem token do dono) não está em cena nenhuma.
 */
export function cenaDoObjeto(
  luz: Pick<FonteDeLuz, "cenaId" | "portador">,
  ctx: Pick<ContextoDeLuz, "tokens" | "pontos">,
): string | undefined {
  const p = luz.portador;
  switch (p.tipo) {
    case "cena":
    case "token":
      return luz.cenaId;
    case "ponto":
      return ctx.pontos.find((x) => x.id === p.pontoId)?.cenaId;
    case "mao":
      return tokenDoPersonagem(ctx.tokens, p.personagemId)?.cenaId;
    case "mochila":
      return undefined;
  }
}

/**
 * As fontes acesas da cena com posição e raios efetivos. A fonte presa a um token (ou na mão de um
 * personagem) sai de onde o token está (`posicaoDoToken` deixa o mapa informar a posição animada na
 * tela); sem o token na cena, some. A de um ponto sai do ponto. Fonte sem alcance não entra.
 */
export function resolverLuzes(
  luzes: readonly FonteDeLuz[],
  cena: Pick<Cena, "id" | "fatorDeLuz">,
  tokens: readonly Pick<Token, "id" | "cenaId" | "x" | "y" | "personagemId">[],
  posicaoDoToken?: (tokenId: string) => Ponto | undefined,
  pontos: readonly Pick<PontoDeLuz, "id" | "cenaId" | "x" | "y">[] = [],
): LuzResolvida[] {
  const fator = fatorDeLuzDa(cena);
  const resolvidas: LuzResolvida[] = [];
  const doToken = (token: (typeof tokens)[number]): Ponto =>
    posicaoDoToken?.(token.id) ?? { x: token.x, y: token.y };
  for (const l of luzes) {
    if (l.estado !== "acesa") continue;
    let posicao: Ponto | undefined;
    const p = l.portador;
    if (p.tipo === "cena") {
      if (l.cenaId === cena.id) posicao = { x: p.x, y: p.y };
    } else if (p.tipo === "token") {
      const token = tokens.find((t) => t.id === p.tokenId && t.cenaId === cena.id);
      if (token && l.cenaId === cena.id) posicao = doToken(token);
    } else if (p.tipo === "mao") {
      const token = tokenDoPersonagem(tokens, p.personagemId, cena.id);
      if (token) posicao = doToken(token);
    } else if (p.tipo === "ponto") {
      const ponto = pontos.find((x) => x.id === p.pontoId && x.cenaId === cena.id);
      if (ponto) posicao = { x: ponto.x, y: ponto.y };
    }
    if (!posicao) continue;
    const { claraM, totalM } = raiosEfetivos(l, fator);
    if (totalM <= 0) continue;
    resolvidas.push({
      id: l.id,
      x: posicao.x,
      y: posicao.y,
      claraM,
      totalM,
      cor: l.luz.cor,
      tremula: l.luz.tremula || l.estagio === "morrendo",
      morrendo: l.estagio === "morrendo",
    });
  }
  return resolvidas;
}

/**
 * O objeto de luz chega a este usuário? O mestre vê todos. Os demais:
 * - fixa: só a da cena ativa;
 * - presa a token: só se ele vê o token (oculto ou da camada do mestre, não: a luz de um goblin
 *   escondido o entregaria);
 * - na mão: a quem vê o token do dono na cena ativa;
 * - na mochila: a quem vê o personagem;
 * - num ponto: se o ponto é visível a ele ou se o objeto está aceso (a luz acesa aparece de qualquer
 *   jeito; ponto escondido nunca chega).
 */
export function luzVisivelPara(
  luz: Pick<FonteDeLuz, "cenaId" | "portador" | "estado">,
  usuario: Pick<Usuario, "id" | "papel">,
  ctx: ContextoDeLuz,
): boolean {
  if (usuario.papel === "mestre") return true;
  const p = luz.portador;
  switch (p.tipo) {
    case "cena":
      return luz.cenaId === ctx.cenaAtivaId;
    case "token": {
      if (luz.cenaId !== ctx.cenaAtivaId) return false;
      const id = p.tokenId;
      const token = ctx.tokens.find((t) => t.id === id);
      return token !== undefined && tokenVisivelPara(token, usuario, ctx.cenaAtivaId);
    }
    case "mao": {
      const token = tokenDoPersonagem(ctx.tokens, p.personagemId, ctx.cenaAtivaId);
      return token !== undefined && tokenVisivelPara(token, usuario, ctx.cenaAtivaId);
    }
    case "mochila": {
      const id = p.personagemId;
      const personagem = ctx.personagens.find((x) => x.id === id);
      return personagem !== undefined && personagemVisivelPara(personagem, usuario, ctx.pastas);
    }
    case "ponto": {
      const id = p.pontoId;
      const ponto = ctx.pontos.find((x) => x.id === id);
      if (!ponto || ponto.cenaId !== ctx.cenaAtivaId) return false;
      return ponto.visivelParaJogadores || luz.estado === "acesa";
    }
  }
}

/** Modificador de Inteligência do token: o do personagem; sem personagem, 0. */
export function modInteligenciaDe(
  token: Pick<Token, "personagemId">,
  personagens: readonly Pick<Personagem, "id" | "modInteligencia">[],
): number {
  if (token.personagemId === undefined) return 0;
  return personagens.find((p) => p.id === token.personagemId)?.modInteligencia ?? 0;
}

/** Visão no escuro do token, em metros: a do personagem; sem personagem, a do próprio token (ou 0). */
export function visaoNoEscuroDe(
  token: Pick<Token, "personagemId" | "visaoNoEscuroM">,
  personagens: readonly Pick<Personagem, "id" | "visao">[],
): number {
  if (token.personagemId !== undefined) {
    const p = personagens.find((x) => x.id === token.personagemId);
    if (p) return p.visao.visaoNoEscuroM;
  }
  return token.visaoNoEscuroM ?? 0;
}
