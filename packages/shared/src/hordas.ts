// Q10: hordas. Vida própria por token de NPC ou monstro, numeração automática ("Goblin", "Goblin 2"...) e a cópia
// de um token. Tudo puro: a sala (`nucleo.ts`) usa estas funções para decidir, a tela para mostrar.

import type { Estado, Personagem, Token, TokenPv, Usuario } from "./estado.ts";
import { ehPersonagemDeJogador, fichaVisivelPara, personagemVisivelPara } from "./mapa.ts";

type Quem = Pick<Usuario, "id" | "papel">;

/** O mais que uma vez pode pôr, colar ou duplicar de uma vez (limite da intenção). */
export const MAXIMO_DE_TOKENS_POR_VEZ = 20;

/**
 * Os tokens deste personagem têm cada um a sua vida? Só NPC e monstro (personagem de jogador sempre lê a ficha), com a
 * ficha preenchida e sem o `vidaPorToken` desligado na ficha. Ligado é o padrão.
 */
export function usaVidaPorToken(
  p: Pick<Personagem, "editores" | "vidaPorToken" | "ficha"> | undefined,
): boolean {
  return (
    p !== undefined &&
    p.ficha !== undefined &&
    !ehPersonagemDeJogador(p) &&
    p.vidaPorToken !== false
  );
}

/** A vida que vale para um token: os números e se ela é do token (`propria`) ou da ficha. */
export type VidaDoToken = { atual: number; max: number; temp: number; propria: boolean };

/**
 * A vida de um token. Token de NPC com vida por token: a do token (ou, se o token é anterior ao Q10 e ainda não tem,
 * a da ficha, já tratada como dele: a primeira edição grava no token). Os demais leem a ficha. Sem ficha, `undefined`.
 */
export function vidaDoToken(
  token: Pick<Token, "pv">,
  personagem: Pick<Personagem, "editores" | "vidaPorToken" | "ficha"> | undefined,
): VidaDoToken | undefined {
  const ficha = personagem?.ficha;
  if (usaVidaPorToken(personagem) && token.pv) {
    return { atual: token.pv.atual, max: token.pv.max, temp: token.pv.temp ?? 0, propria: true };
  }
  if (!ficha) return undefined;
  return {
    atual: ficha.pvAtual,
    max: ficha.pvMax,
    temp: ficha.pvTemp ?? 0,
    propria: usaVidaPorToken(personagem),
  };
}

/** A vida que o token nasce com: uma cópia dos PV da ficha naquele momento (o modelo), se o personagem pede. */
export function pvInicialDoToken(
  p: Pick<Personagem, "editores" | "vidaPorToken" | "ficha"> | undefined,
): TokenPv | undefined {
  if (!usaVidaPorToken(p) || !p?.ficha) return undefined;
  const f = p.ficha;
  return {
    atual: Math.min(f.pvAtual, f.pvMax),
    max: f.pvMax,
    ...(f.pvTemp ? { temp: f.pvTemp } : {}),
  };
}

/** Aplica valores absolutos à vida (o atual nunca passa do máximo; temporário 0 ou `null` tira). */
export function aplicarNaVida(
  vida: { atual: number; max: number; temp: number },
  m: { atual?: number | undefined; max?: number | undefined; temp?: number | null | undefined },
): TokenPv {
  const max = m.max ?? vida.max;
  const atual = Math.min(max, m.atual ?? vida.atual);
  const temp = m.temp === undefined ? vida.temp : (m.temp ?? 0);
  return { atual, max, ...(temp > 0 ? { temp } : {}) };
}

/** O nome do token sem o número do selo ("Goblin 3" com número 3 vira "Goblin"). */
export function nomeBaseDoToken(token: Pick<Token, "nome" | "numero">): string {
  const n = token.numero;
  if (n === undefined) return token.nome;
  const sufixo = ` ${n}`;
  return token.nome.endsWith(sufixo) && token.nome.length > sufixo.length
    ? token.nome.slice(0, -sufixo.length)
    : token.nome;
}

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * O nome e o número do token novo de um NPC. Sem outro token do mesmo personagem na cena, o nome é o próprio (sem
 * número). Com algum, "Nome N" com o menor N livre a partir de 2 (o nome sozinho conta como 1). Ninguém é renomeado;
 * nomes que o mestre mudou não contam. `noDestino` deve incluir os tokens já criados no mesmo pedido.
 */
export function nomeNumerado(
  noDestino: readonly Pick<Token, "cenaId" | "personagemId" | "nome">[],
  cenaId: string,
  personagemId: string,
  base: string,
): { nome: string; numero?: number } {
  const irmaos = noDestino.filter((t) => t.cenaId === cenaId && t.personagemId === personagemId);
  if (irmaos.length === 0) return { nome: base };
  const usados = new Set<number>();
  const padrao = new RegExp(`^${escaparRegex(base)} (\\d+)$`);
  for (const t of irmaos) {
    if (t.nome === base) usados.add(1);
    else {
      const m = padrao.exec(t.nome);
      if (m) usados.add(Number(m[1]));
    }
  }
  let n = 2;
  while (usados.has(n)) n++;
  const sufixo = ` ${n}`;
  return { nome: `${base.slice(0, 64 - sufixo.length)}${sufixo}`, numero: n };
}

/**
 * A cópia de um token: igual ao original (tamanho, camada, oculto, condições, vida própria de agora, imagem, quem
 * controla...), com id, cena e lugar novos e o nome e o número que a numeração deu.
 */
export function copiaDoToken(
  origem: Token,
  novo: { id: string; cenaId: string; x: number; y: number },
  nome: { nome: string; numero?: number } | undefined,
): Token {
  const { numero: _numero, ...resto } = origem;
  return {
    ...resto,
    id: novo.id,
    cenaId: novo.cenaId,
    x: novo.x,
    y: novo.y,
    ...(nome
      ? { nome: nome.nome, ...(nome.numero === undefined ? {} : { numero: nome.numero }) }
      : {}),
    ...(nome === undefined && origem.numero !== undefined ? { numero: origem.numero } : {}),
  };
}

/**
 * O token como este usuário o recebe: a vida própria do token de NPC só vai a quem hoje receberia a vida da ficha
 * (vê o personagem e a ficha dele). Os demais recebem o token sem o `pv`. O mestre recebe inteiro.
 */
export function tokenParaUsuario(
  token: Token,
  usuario: Quem,
  estado: Pick<Estado, "personagens" | "pastas" | "permissoes">,
): Token {
  if (token.pv === undefined || usuario.papel === "mestre") return token;
  const p =
    token.personagemId === undefined
      ? undefined
      : estado.personagens.find((x) => x.id === token.personagemId);
  if (
    p &&
    personagemVisivelPara(p, usuario, estado.pastas) &&
    fichaVisivelPara(p, usuario, estado.permissoes)
  ) {
    return token;
  }
  const { pv: _pv, ...semVida } = token;
  return semVida;
}
