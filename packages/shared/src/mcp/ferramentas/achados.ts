import type { AssetMeta, Cena, Estado, Personagem, Token } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar } from "../nomes.ts";

// Procurar pelo nome (nunca pelo id) o que as ferramentas do M2 precisam: cena, ficha, token e som.

/** A cena pelo nome; sem nome, a cena do grupo. */
export function cenaPorNome(estado: Estado, nome?: string): Cena {
  if (nome === undefined) {
    const ativa = estado.cenas.find((c) => c.id === estado.cenaAtivaId);
    if (!ativa) throw new ErroDoMcp("A mesa não tem cena ativa: diga o nome da cena.");
    return ativa;
  }
  return achar(estado.cenas, nome, { rotulo: "cena", nomeDe: (c) => c.nome, idDe: (c) => c.id });
}

export function fichaPorNome(estado: Estado, nome: string): Personagem {
  return achar(estado.personagens, nome, {
    rotulo: "ficha",
    nomeDe: (p) => p.nome,
    idDe: (p) => p.id,
  });
}

/** O token pelo nome, na cena pedida (ou na do grupo). */
export function tokenPorNome(estado: Estado, nome: string, cenaId?: string): Token {
  const daCena = estado.tokens.filter((t) => t.cenaId === (cenaId ?? estado.cenaAtivaId));
  return achar(daCena, nome, { rotulo: "token", nomeDe: (t) => t.nome, idDe: (t) => t.id });
}

/** Os arquivos de som da mesa (só o mestre os lista). */
export function sonsDaMesa(estado: Estado): AssetMeta[] {
  return (estado.assets ?? []).filter((a) => a.tipo === "som");
}

/** Um som pelo nome do arquivo ou pelo começo do hash. */
export function somPorNome(estado: Estado, pedido: string): AssetMeta {
  const sons = sonsDaMesa(estado);
  if (sons.length === 0) {
    throw new ErroDoMcp(
      "A mesa não tem nenhum som. Suba um com a ferramenta `arquivos` (uso `som`) e tente de novo.",
    );
  }
  const p = pedido.trim();
  if (p.length >= 6) {
    const porHash = sons.filter((s) => s.hash.startsWith(p.toLowerCase()));
    if (porHash.length === 1) return porHash[0] as AssetMeta;
  }
  return achar(sons, p, { rotulo: "som", nomeDe: (s) => s.nomeOriginal, idDe: (s) => s.hash });
}
