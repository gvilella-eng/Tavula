// Q12: "Seguir meu token": a vista mantém um token no centro da tela. Aqui mora a escolha de qual token seguir
// (pura, para os testes) e a preferência guardada por mesa neste navegador.

import { controlaToken, type Personagem, type Token, type Usuario } from "@tabletop/shared";

type Quem = Pick<Usuario, "id" | "papel">;

/** O que fica guardado por mesa: ligado ou não e quem seguir (o personagem, que vale em qualquer cena, e o token). */
export type PrefDoSeguir = {
  ligado: boolean;
  personagemId: string | null;
  tokenId: string | null;
};

export const SEGUIR_DESLIGADO: PrefDoSeguir = { ligado: false, personagemId: null, tokenId: null };

/**
 * Os tokens que a pessoa pode escolher seguir na cena que vê: o jogador, os que controla; o mestre, todos os da
 * camada dos tokens (assumido: não os objetos nem o que fica sob o mapa).
 */
export function candidatosParaSeguir(
  tokens: readonly Token[],
  cenaId: string | undefined,
  quem: Quem | null,
  personagens: readonly Personagem[],
): Token[] {
  if (cenaId === undefined || quem === null) return [];
  return tokens.filter(
    (t) =>
      t.cenaId === cenaId &&
      t.camada === "tokens" &&
      (quem.papel === "mestre" || controlaToken(t, quem, personagens)),
  );
}

/**
 * O token que a vista segue: o escolhido nesta cena; senão o do mesmo personagem (a cena nova). `null` = espera
 * (o token ainda não está nesta cena).
 */
export function escolherSeguido(candidatos: readonly Token[], pref: PrefDoSeguir): Token | null {
  if (pref.tokenId !== null) {
    const exato = candidatos.find((t) => t.id === pref.tokenId);
    if (exato) return exato;
  }
  if (pref.personagemId !== null) {
    return candidatos.find((t) => t.personagemId === pref.personagemId) ?? null;
  }
  return null;
}

/** A escolha guardada para este token. */
export function prefParaSeguir(token: Token): PrefDoSeguir {
  return { ligado: true, personagemId: token.personagemId ?? null, tokenId: token.id };
}

export type ResultadoDeLigar = { pref: PrefDoSeguir; abrirLista: boolean };

/**
 * Ligou o "seguir". Um token só: segue esse. Vários: o mestre segue o selecionado; o jogador, o que já tinha
 * escolhido; sem escolha, abre a lista (e o seguir só liga quando ele escolhe). Sem token nenhum na cena, fica
 * ligado esperando.
 */
export function aoLigarOSeguir(
  candidatos: readonly Token[],
  pref: PrefDoSeguir,
  selecionadoId: string | null,
  ehMestre: boolean,
): ResultadoDeLigar {
  const unico = candidatos.length === 1 ? candidatos[0] : undefined;
  if (unico) return { pref: prefParaSeguir(unico), abrirLista: false };
  if (ehMestre && selecionadoId !== null) {
    const sel = candidatos.find((t) => t.id === selecionadoId);
    if (sel) return { pref: prefParaSeguir(sel), abrirLista: false };
  }
  const guardado = escolherSeguido(candidatos, pref);
  if (guardado) return { pref: prefParaSeguir(guardado), abrirLista: false };
  if (candidatos.length === 0) return { pref: { ...pref, ligado: true }, abrirLista: false };
  return { pref: { ...pref, ligado: false }, abrirLista: true };
}

const CHAVE_SEGUIR = "tabletop:pref:seguir:";

/** A preferência desta mesa (só deste navegador; nunca vai à sala). */
export function lerSeguir(mesaId: string): PrefDoSeguir {
  try {
    const texto = localStorage.getItem(CHAVE_SEGUIR + mesaId);
    if (!texto) return SEGUIR_DESLIGADO;
    const v = JSON.parse(texto) as Partial<PrefDoSeguir> | null;
    const id = (x: unknown) => (typeof x === "string" && x.length > 0 ? x : null);
    return {
      ligado: v?.ligado === true,
      personagemId: id(v?.personagemId),
      tokenId: id(v?.tokenId),
    };
  } catch {
    return SEGUIR_DESLIGADO;
  }
}

export function gravarSeguir(mesaId: string, pref: PrefDoSeguir): void {
  try {
    localStorage.setItem(CHAVE_SEGUIR + mesaId, JSON.stringify(pref));
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}
