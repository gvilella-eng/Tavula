import type { Estado, Token, Usuario } from "./estado.ts";
import { controlaToken } from "./mapa.ts";
import type { AlvoDoEfeito, SomTocando } from "./som.ts";
import { tokenNaZona, zonasDe } from "./zonas.ts";

// N5: quem ouve o quê. Funções puras; a sala as chama para o jogador e o navegador do mestre para ele.

/**
 * Os sons das zonas que têm algum destes tokens dentro (zona ligada, publicada e com som; sem repetir o mesmo
 * som: o de volume maior vale). Devolve só o som: a zona, o nome e as regras nunca saem daqui.
 */
export function sonsDasZonasParaTokens(
  estado: Pick<Estado, "zonas">,
  tokens: readonly Pick<Token, "id" | "cenaId" | "x" | "y">[],
): SomTocando[] {
  const porHash = new Map<string, SomTocando>();
  for (const z of zonasDe(estado)) {
    const som = z.efeitos.som;
    if (!som || !z.ativa || z.rascunho) continue;
    if (!tokens.some((t) => tokenNaZona(t, z))) continue;
    const atual = porHash.get(som.hash);
    if (!atual || som.volume > atual.volume) {
      porHash.set(som.hash, { hash: som.hash, volume: som.volume, laco: som.laco });
    }
  }
  return [...porHash.values()].sort((a, b) => a.hash.localeCompare(b.hash));
}

/** O que o jogador ouve das zonas: as que têm dentro um token que ele controla. */
export function sonsDasZonasParaJogador(
  estado: Pick<Estado, "zonas" | "tokens" | "personagens">,
  usuario: Pick<Usuario, "id" | "papel">,
): SomTocando[] {
  if (usuario.papel !== "jogador" || zonasDe(estado).length === 0) return [];
  const dele = estado.tokens.filter((t) => controlaToken(t, usuario, estado.personagens));
  return sonsDasZonasParaTokens(estado, dele);
}

/**
 * O efeito de som chega a este usuário? O mestre ouve todos (é quem toca); o jogador, os de `todos`, os da cena em
 * que o grupo está e os do token que ele controla.
 */
export function efeitoChegaPara(
  alvo: AlvoDoEfeito,
  usuario: Pick<Usuario, "id" | "papel">,
  estado: Pick<Estado, "tokens" | "personagens" | "cenaAtivaId">,
): boolean {
  if (usuario.papel === "mestre") return true;
  switch (alvo.tipo) {
    case "todos":
      return true;
    case "cena":
      return alvo.cenaId === estado.cenaAtivaId;
    case "token": {
      const t = estado.tokens.find((x) => x.id === alvo.tokenId);
      return t !== undefined && controlaToken(t, usuario, estado.personagens);
    }
  }
}
