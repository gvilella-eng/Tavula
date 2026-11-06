import type { Cena, FonteDeLuz, Personagem, Ponto, Token, Usuario } from "./estado.ts";
import { tokenVisivelPara } from "./mapa.ts";

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
 * Raios que valem de fato: os dois raios da luz multiplicados pela intensidade da fonte e pelo fator
 * geral da cena. `claraM` é o raio da luz plena; `totalM`, o da luz plena mais a penumbra.
 */
export function raiosEfetivos(
  fonte: Pick<FonteDeLuz, "luz" | "intensidade">,
  fatorGeral: number,
): { claraM: number; totalM: number } {
  const k = entre01(fonte.intensidade) * entre01(fatorGeral);
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
};

/**
 * As fontes acesas da cena com posição e raios efetivos. A fonte presa a um token sai de onde o token
 * está (`posicaoDoToken` deixa o mapa informar a posição animada na tela); sem o token na cena, some.
 * Fonte sem alcance (intensidade ou fator zero) não entra.
 */
export function resolverLuzes(
  luzes: readonly FonteDeLuz[],
  cena: Pick<Cena, "id" | "fatorDeLuz">,
  tokens: readonly Pick<Token, "id" | "cenaId" | "x" | "y">[],
  posicaoDoToken?: (tokenId: string) => Ponto | undefined,
): LuzResolvida[] {
  const fator = fatorDeLuzDa(cena);
  const resolvidas: LuzResolvida[] = [];
  for (const l of luzes) {
    if (l.cenaId !== cena.id || !l.acesa) continue;
    let posicao: Ponto | undefined;
    if (l.portador.tipo === "cena") posicao = { x: l.portador.x, y: l.portador.y };
    else {
      const id = l.portador.tokenId;
      const token = tokens.find((t) => t.id === id && t.cenaId === cena.id);
      if (token) posicao = posicaoDoToken?.(id) ?? { x: token.x, y: token.y };
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
      tremula: l.luz.tremula,
    });
  }
  return resolvidas;
}

/**
 * A fonte de luz chega a este usuário? O mestre vê todas. Os demais só as da cena ativa, e a de token
 * só se ele vê o token (oculto ou da camada do mestre, não): a luz de um goblin escondido o entregaria.
 */
export function luzVisivelPara(
  luz: Pick<FonteDeLuz, "cenaId" | "portador">,
  usuario: Pick<Usuario, "id" | "papel">,
  tokens: readonly Token[],
  cenaAtivaId: string,
): boolean {
  if (usuario.papel === "mestre") return true;
  if (luz.cenaId !== cenaAtivaId) return false;
  if (luz.portador.tipo === "cena") return true;
  const id = luz.portador.tokenId;
  const token = tokens.find((t) => t.id === id);
  return token !== undefined && tokenVisivelPara(token, usuario, cenaAtivaId);
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
