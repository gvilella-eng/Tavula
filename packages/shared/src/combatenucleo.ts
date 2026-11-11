import type { Mensagem } from "./chat.ts";
import {
  type Combate,
  combateDe,
  type EntradaDeCombate,
  entradaVisivelPara,
  LIMITES_DO_COMBATE,
  moverEntrada,
  ordenarCombate,
  ordenarEntradas,
  proximoTurno,
  tirarEntrada,
  turnoAnterior,
} from "./combate.ts";
import type { FonteDeAleatoriedade } from "./dados.ts";
import type { Estado, Personagem, Token, Usuario } from "./estado.ts";
import { iniciativa as iniciativaDaFicha, valorDoAtributo } from "./ficha.ts";
import { controlaToken, ehPersonagemDeJogador, tokenVisivelPara } from "./mapa.ts";
import type { CodigoDeErro, Intencao } from "./protocolo.ts";
import { tempoDaSala } from "./relogio.ts";
import { rolarTeste } from "./rolagens.ts";
import type { NovoEvento } from "./tochas.ts";

// Intenções do Lote 11 (ordem de turno e condições). Fica separado do `nucleo.ts` como o `tochas.ts`:
// recebe o estado vivo e uma função para emitir eventos.

type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };
export type SaidaDeCombate = { erro: ErroDaSala } | { snapshotPara?: "todos" | string[] };

export type ContextoDeCombate = {
  usuario: Usuario;
  agoraMs: number;
  aleatorio: FonteDeAleatoriedade;
  atual: () => Estado;
  emitir: (evento: NovoEvento) => void;
};

const erro = (codigo: CodigoDeErro, mensagem: string): { erro: ErroDaSala } => ({
  erro: { codigo, mensagem },
});

const SEM_TOKEN = "Token não encontrado.";
const SEM_ENTRADA = "Entrada não encontrada.";

type De<T extends Intencao["tipo"]> = Extract<Intencao, { tipo: T }>["dados"];

// ---------------------------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------------------------

function personagemDoToken(estado: Estado, token: Token | undefined): Personagem | undefined {
  if (token?.personagemId === undefined) return undefined;
  return estado.personagens.find((p) => p.id === token.personagemId);
}

function personagemDaEntrada(estado: Estado, e: EntradaDeCombate): Personagem | undefined {
  return personagemDoToken(
    estado,
    e.tokenId === undefined ? undefined : estado.tokens.find((t) => t.id === e.tokenId),
  );
}

/** Destreza (valor do atributo) da ficha, só se o atributo foi preenchido. */
function destrezaDe(p: Personagem | undefined): number | undefined {
  return p?.ficha?.atributos?.des === undefined ? undefined : valorDoAtributo(p.ficha, "des");
}

function emitirCombate(c: ContextoDeCombate, combate: Combate): void {
  c.emitir({ tipo: "combate.alterado", dados: { combate } });
}

const ehMestre = (c: ContextoDeCombate) => c.usuario.papel === "mestre";

/**
 * Quem pode agir pela entrada: o mestre ou quem controla o token dela (quem edita o personagem ou está
 * em `controladoPor`, como o familiar entregue a um jogador), desde que a veja.
 */
function agePelaEntrada(c: ContextoDeCombate, e: EntradaDeCombate): boolean {
  if (ehMestre(c)) return true;
  const estado = c.atual();
  if (!entradaVisivelPara(e, c.usuario, estado)) return false;
  const token = e.tokenId === undefined ? undefined : estado.tokens.find((t) => t.id === e.tokenId);
  return token !== undefined && controlaToken(token, c.usuario, estado.personagens);
}

/**
 * Tira do combate as entradas dos tokens apagados. Devolve o combate novo, ou `undefined` se nada
 * mudou (a sala emite o evento só quando houver o que mudar).
 */
export function semEntradasDosTokens(
  estado: Pick<Estado, "combate">,
  tokenIds: ReadonlySet<string>,
): Combate | undefined {
  let combate = estado.combate;
  if (!combate) return undefined;
  const alvo = combate.entradas.filter((e) => e.tokenId !== undefined && tokenIds.has(e.tokenId));
  if (alvo.length === 0) return undefined;
  for (const e of alvo) combate = tirarEntrada(combate, e.id);
  return combate;
}

/** O token tem entrada no combate? (esconder ou mostrar o token muda o que o jogador recebe dela) */
export function tokenTemEntrada(estado: Pick<Estado, "combate">, tokenId: string): boolean {
  return estado.combate?.entradas.some((e) => e.tokenId === tokenId) ?? false;
}

// ---------------------------------------------------------------------------------------------
// Gestão (mestre)
// ---------------------------------------------------------------------------------------------

export function combateAdicionar(
  c: ContextoDeCombate,
  dados: De<"combate.adicionar">,
): SaidaDeCombate {
  const estado = c.atual();
  const combate = combateDe(estado);
  const entradas = [...combate.entradas];
  const ids = new Set(entradas.map((e) => e.id));
  for (const nova of dados.entradas) {
    if (ids.has(nova.id)) return erro("dados_invalidos", "Já existe uma entrada com esse id.");
    const token =
      nova.tokenId === undefined ? undefined : estado.tokens.find((t) => t.id === nova.tokenId);
    if (nova.tokenId !== undefined) {
      if (!token) return erro("token_inexistente", SEM_TOKEN);
      // O mesmo token não entra duas vezes: quem já está na lista fica como está.
      if (entradas.some((e) => e.tokenId === nova.tokenId)) continue;
    }
    const p = personagemDoToken(estado, token);
    const nome = token?.nome ?? nova.nome;
    if (nome === undefined) return erro("dados_invalidos", "Entrada solta precisa de nome.");
    const destreza = destrezaDe(p);
    ids.add(nova.id);
    entradas.push({
      id: nova.id,
      ...(nova.tokenId === undefined ? {} : { tokenId: nova.tokenId }),
      nome,
      ...(nova.iniciativa === undefined ? {} : { iniciativa: nova.iniciativa }),
      ...(destreza === undefined ? {} : { destreza }),
      ...(p !== undefined && ehPersonagemDeJogador(p) ? { jogador: true } : {}),
      ...(nova.valorOculto === true ? { valorOculto: true } : {}),
      ...(nova.oculta === true ? { oculta: true } : {}),
    });
  }
  if (entradas.length > LIMITES_DO_COMBATE.entradas) {
    return erro("dados_invalidos", `No máximo ${LIMITES_DO_COMBATE.entradas} entradas.`);
  }
  if (entradas.length === combate.entradas.length) return {};
  emitirCombate(c, ordenarCombate({ ...combate, entradas }));
  return {};
}

export function combateTirar(c: ContextoDeCombate, dados: De<"combate.tirar">): SaidaDeCombate {
  const combate = combateDe(c.atual());
  if (!combate.entradas.some((e) => e.id === dados.id)) return erro("dados_invalidos", SEM_ENTRADA);
  emitirCombate(c, tirarEntrada(combate, dados.id));
  return {};
}

export function combateEditar(c: ContextoDeCombate, dados: De<"combate.editar">): SaidaDeCombate {
  const combate = combateDe(c.atual());
  const atual = combate.entradas.find((e) => e.id === dados.id);
  if (!atual) return erro("dados_invalidos", SEM_ENTRADA);
  const { iniciativa, nome, valorOculto, oculta } = dados.mudancas;
  const nova: EntradaDeCombate = { ...atual };
  if (nome !== undefined) nova.nome = nome;
  if (iniciativa === null) delete nova.iniciativa;
  else if (iniciativa !== undefined) nova.iniciativa = iniciativa;
  if (valorOculto !== undefined) {
    if (valorOculto) nova.valorOculto = true;
    else delete nova.valorOculto;
  }
  if (oculta !== undefined) {
    if (oculta) nova.oculta = true;
    else delete nova.oculta;
  }
  if (JSON.stringify(nova) === JSON.stringify(atual)) return {};
  const entradas = combate.entradas.map((e) => (e.id === nova.id ? nova : e));
  // Mudar o valor reordena a lista; mudar só o nome ou o sigilo não mexe na posição.
  const reordenar = iniciativa !== undefined;
  emitirCombate(c, {
    ...combate,
    entradas: reordenar ? ordenarEntradas(entradas) : entradas,
  });
  return {};
}

export function combateMover(c: ContextoDeCombate, dados: De<"combate.mover">): SaidaDeCombate {
  const combate = combateDe(c.atual());
  if (!combate.entradas.some((e) => e.id === dados.id)) return erro("dados_invalidos", SEM_ENTRADA);
  const novo = moverEntrada(combate, dados.id, dados.indice);
  if (JSON.stringify(novo) !== JSON.stringify(combate)) emitirCombate(c, novo);
  return {};
}

export function combateOrdenar(c: ContextoDeCombate): SaidaDeCombate {
  const combate = combateDe(c.atual());
  const novo = ordenarCombate(combate);
  if (JSON.stringify(novo) !== JSON.stringify(combate)) emitirCombate(c, novo);
  return {};
}

export function combateProximo(c: ContextoDeCombate): SaidaDeCombate {
  const combate = combateDe(c.atual());
  const novo = proximoTurno(combate);
  if (novo !== combate) emitirCombate(c, novo);
  return {};
}

export function combateAnterior(c: ContextoDeCombate): SaidaDeCombate {
  const combate = combateDe(c.atual());
  const novo = turnoAnterior(combate);
  if (novo !== combate) emitirCombate(c, novo);
  return {};
}

export function combateEncerrar(c: ContextoDeCombate): SaidaDeCombate {
  if (!c.atual().combate) return {};
  c.emitir({ tipo: "combate.alterado", dados: { combate: null } });
  return {};
}

/** O jogador (ou o mestre) da vez passa o turno. */
export function combatePassar(c: ContextoDeCombate): SaidaDeCombate {
  const combate = combateDe(c.atual());
  const vez = combate.entradas.find((e) => e.id === combate.atualId);
  if (!vez || !agePelaEntrada(c, vez)) return erro("sem_permissao", "Não é o seu turno.");
  emitirCombate(c, proximoTurno(combate));
  return {};
}

/** V2: o mestre escreve a rodada. 0 = ainda não começou (e ninguém fica na vez). */
export function combateRodada(c: ContextoDeCombate, dados: De<"combate.rodada">): SaidaDeCombate {
  const combate = combateDe(c.atual());
  if (combate.rodada === dados.rodada) return {};
  const { atualId, ...resto } = combate;
  emitirCombate(c, {
    ...resto,
    ...(atualId === undefined || dados.rodada === 0 ? {} : { atualId }),
    rodada: dados.rodada,
  });
  return {};
}

/** V2: o mestre dá a vez a uma entrada. A rodada continua; se o combate não tinha começado, abre a 1. */
export function combateDarVez(c: ContextoDeCombate, dados: De<"combate.darVez">): SaidaDeCombate {
  const combate = combateDe(c.atual());
  if (!combate.entradas.some((e) => e.id === dados.id)) return erro("dados_invalidos", SEM_ENTRADA);
  const rodada = Math.max(combate.rodada, 1);
  if (combate.atualId === dados.id && combate.rodada === rodada) return {};
  emitirCombate(c, { ...combate, atualId: dados.id, rodada });
  return {};
}

/**
 * V2: entra na ordem de turno com um token. A sala confere que a ordem está aberta, que o usuário controla o
 * token (o mestre, qualquer um), que o token está na cena ativa e que ainda não está na lista; rola 1d20 + a
 * iniciativa da ficha (o jogador não manda o número) e manda a rolagem ao chat.
 */
export function combateEntrar(c: ContextoDeCombate, dados: De<"combate.entrar">): SaidaDeCombate {
  const estado = c.atual();
  if (!estado.ordemDeTurnoVisivel) {
    return erro("dados_invalidos", "A ordem de turno está fechada.");
  }
  const token = estado.tokens.find((t) => t.id === dados.tokenId);
  // Token que o usuário não vê responde igual a token inexistente.
  if (!token || !tokenVisivelPara(token, c.usuario, estado.cenaAtivaId)) {
    return erro("token_inexistente", SEM_TOKEN);
  }
  if (!ehMestre(c) && !controlaToken(token, c.usuario, estado.personagens)) {
    return erro("sem_permissao", "Você não controla este token.");
  }
  if (token.cenaId !== estado.cenaAtivaId) {
    return erro("dados_invalidos", "O token não está na cena ativa.");
  }
  const combate = combateDe(estado);
  if (combate.entradas.some((e) => e.tokenId === token.id)) {
    return erro("dados_invalidos", "Já está na ordem de turno.");
  }
  if (combate.entradas.length >= LIMITES_DO_COMBATE.entradas) {
    return erro("dados_invalidos", `No máximo ${LIMITES_DO_COMBATE.entradas} entradas.`);
  }
  const p = personagemDoToken(estado, token);
  const destreza = destrezaDe(p);
  const ids = new Set(combate.entradas.map((e) => e.id));
  let n = estado.seq + 1;
  while (ids.has(`ent-${n}`)) n += 1;
  const base: EntradaDeCombate = {
    id: `ent-${n}`,
    tokenId: token.id,
    nome: token.nome,
    ...(destreza === undefined ? {} : { destreza }),
    ...(p !== undefined && ehPersonagemDeJogador(p) ? { jogador: true } : {}),
  };
  const r = rolarDaEntrada(c, base);
  if ("erro" in r) return r;
  emitirCombate(c, ordenarCombate({ ...combate, entradas: [...combate.entradas, r.entrada] }));
  return {};
}

// ---------------------------------------------------------------------------------------------
// Rolagem de iniciativa
// ---------------------------------------------------------------------------------------------

/**
 * Rola a iniciativa de uma entrada (d20 + bônus da ficha, ou 0) pelo modelo de teste do Lote 8, manda o
 * resultado ao chat e devolve a entrada com o valor. A rolagem de NPC (e de entrada com valor oculto ou
 * escondida) vai OCULTA: só o mestre a vê. A de personagem de jogador vai pública.
 */
function rolarDaEntrada(
  c: ContextoDeCombate,
  e: EntradaDeCombate,
): { erro: ErroDaSala } | { entrada: EntradaDeCombate } {
  const estado = c.atual();
  const p = personagemDaEntrada(estado, e);
  const bonus = p?.ficha ? iniciativaDaFicha(p.ficha) : 0;
  const r = rolarTeste({ nome: "Iniciativa", bonus }, c.aleatorio);
  if (!r.ok) return erro("dados_invalidos", r.motivo);
  const total = Math.min(
    Math.max(r.resultado.rolagem.total, LIMITES_DO_COMBATE.iniciativaMin),
    LIMITES_DO_COMBATE.iniciativaMax,
  );
  const destreza = destrezaDe(p);
  const entrada: EntradaDeCombate = { ...e, iniciativa: total };
  if (destreza !== undefined) entrada.destreza = destreza;
  const publica = e.jogador === true && e.valorOculto !== true && e.oculta !== true;
  const seq = estado.seq + 1;
  const mensagem: Mensagem = {
    id: `m${seq}`,
    seq,
    emSala: tempoDaSala(estado.relogio, c.agoraMs),
    emReal: c.agoraMs,
    autorId: c.usuario.id,
    ...(p
      ? {
          como: {
            personagemId: p.id,
            nome: p.nome,
            ...(p.retratoHash === undefined ? {} : { retratoHash: p.retratoHash }),
          },
        }
      : { texto: e.nome }),
    tipo: "modelo",
    modelo: r.resultado,
    visivelPara: publica ? "todos" : { ids: [] },
    ...(publica ? {} : { oculta: true }),
  };
  c.emitir({ tipo: "chat.mensagem", dados: { mensagem } });
  return { entrada };
}

/**
 * Rola a iniciativa (d20 + bônus da ficha, ou 0) pelo modelo de teste do Lote 8 e manda cada resultado
 * para o chat. A rolagem de NPC (e de entrada com valor oculto ou escondida) vai OCULTA: só o mestre a
 * vê. A de personagem de jogador vai pública.
 */
export function combateRolar(c: ContextoDeCombate, dados: De<"combate.rolar">): SaidaDeCombate {
  const estado = c.atual();
  const combate = combateDe(estado);
  let alvos: EntradaDeCombate[];
  if (ehMestre(c)) {
    if (dados.ids === undefined) alvos = combate.entradas.filter((e) => e.iniciativa === undefined);
    else {
      const achadas: EntradaDeCombate[] = [];
      for (const id of dados.ids) {
        const e = combate.entradas.find((x) => x.id === id);
        if (!e) return erro("dados_invalidos", SEM_ENTRADA);
        achadas.push(e);
      }
      alvos = achadas;
    }
  } else {
    if (dados.ids === undefined) return erro("sem_permissao", "Escolha a sua entrada.");
    alvos = [];
    for (const id of dados.ids) {
      const e = combate.entradas.find((x) => x.id === id);
      // Entrada que o jogador não vê responde igual a entrada inexistente.
      if (!e || !entradaVisivelPara(e, c.usuario, estado)) {
        return erro("dados_invalidos", SEM_ENTRADA);
      }
      if (!agePelaEntrada(c, e)) return erro("sem_permissao", "Você só rola a sua iniciativa.");
      if (e.iniciativa !== undefined) {
        return erro("dados_invalidos", "A iniciativa já foi rolada; peça ao mestre para mudar.");
      }
      alvos.push(e);
    }
  }
  if (alvos.length === 0) return {};

  const rolados = new Map<string, EntradaDeCombate>();
  for (const e of alvos) {
    const r = rolarDaEntrada(c, e);
    if ("erro" in r) return r;
    rolados.set(e.id, r.entrada);
  }
  const entradas = combate.entradas.map((e) => rolados.get(e.id) ?? e);
  emitirCombate(c, { ...combate, entradas: ordenarEntradas(entradas) });
  return {};
}

// ---------------------------------------------------------------------------------------------
// Condições, exaustão e concentração
// ---------------------------------------------------------------------------------------------

export function tokenCondicoes(c: ContextoDeCombate, dados: De<"token.condicoes">): SaidaDeCombate {
  const estado = c.atual();
  const token = estado.tokens.find((t) => t.id === dados.id);
  // Token invisível responde igual a token inexistente.
  if (!token || !tokenVisivelPara(token, c.usuario, estado.cenaAtivaId)) {
    return erro("token_inexistente", SEM_TOKEN);
  }
  if (!ehMestre(c) && !controlaToken(token, c.usuario, estado.personagens)) {
    return erro("sem_permissao", "Você não controla este token.");
  }
  const { condicoes, exaustao, concentracao } = dados;
  const novo: Token = { ...token };
  if (condicoes !== undefined) {
    const unicas = [...new Set(condicoes)];
    if (unicas.length > 0) novo.condicoes = unicas;
    else delete novo.condicoes;
  }
  if (exaustao !== undefined) {
    if (exaustao > 0) novo.exaustao = exaustao;
    else delete novo.exaustao;
  }
  if (concentracao !== undefined) {
    if (concentracao === null) delete novo.concentracao;
    else novo.concentracao = concentracao;
  }
  if (JSON.stringify(novo) === JSON.stringify(token)) return {};
  c.emitir({ tipo: "token.editado", dados: { token: novo } });
  return {};
}
