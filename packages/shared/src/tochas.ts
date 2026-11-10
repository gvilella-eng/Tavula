import type {
  ConfigDaMesa,
  Estado,
  ModeloDeObjeto,
  ObjetoDeLuz,
  Personagem,
  PontoDeLuz,
  Token,
  Usuario,
} from "./estado.ts";
import { SEGURAR_PADRAO_S } from "./estado.ts";
import { ajustarNovas, novasDoModelo } from "./ficha.ts";
import { luzVisivelPara, tokenDoPersonagem } from "./luz.ts";
import { personagemVisivelPara, podeEditarPersonagem, tokenVisivelPara } from "./mapa.ts";
import { dentroDoAlcance, maoLivre, pontoVisivelPara } from "./objetos.ts";
import type { CodigoDeErro, EventoSala, Intencao } from "./protocolo.ts";
import { formatarDuracaoCurta, restanteDoObjeto, tempoDaSala } from "./relogio.ts";

// Este arquivo trata as intenções do Lote 7 que mexem em tochas, pontos e mochila. Fica separado do
// `nucleo.ts` só para não crescer sem fim; é chamado por `processar` e usa as mesmas regras.

export type NovoEvento = EventoSala extends infer E
  ? E extends unknown
    ? Omit<E, "seq" | "origem">
    : never
  : never;

export type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };

/** O que o `processar` passa: o estado vivo (já com os eventos emitidos até agora) e como emitir. */
export type ContextoDeTochas = {
  usuario: Usuario;
  agoraMs: number;
  atual: () => Estado;
  emitir: (evento: NovoEvento) => void;
  /** Troca os acendimentos pendentes (transitórios: sem evento). */
  definirAcendimentos: (acendimentos: Record<string, number>) => void;
};

export type SaidaDeTochas = { erro: ErroDaSala } | { snapshotPara?: "todos" | string[] };

const erro = (codigo: CodigoDeErro, mensagem: string): { erro: ErroDaSala } => ({
  erro: { codigo, mensagem },
});

const SEM_OBJETO = "Objeto de luz não encontrado.";
const SEM_PERSONAGEM = "Personagem não encontrado.";
const SEM_PONTO = "Ponto não encontrado.";

/** O objeto morre quando sobram menos de 50 ms (o alarme pode chegar um instante antes). */
const TOLERANCIA_DO_FIM_MS = 50;
/** Tolerância no "segurar": o cliente conta 3 s no relógio dele e a rede varia. */
const TOLERANCIA_DO_SEGURAR_MS = 300;

// ---------------------------------------------------------------------------------------------
// Peças comuns
// ---------------------------------------------------------------------------------------------

function salaDe(c: ContextoDeTochas): number {
  return tempoDaSala(c.atual().relogio, c.agoraMs);
}

function ehMestre(c: ContextoDeTochas): boolean {
  return c.usuario.papel === "mestre";
}

/** Quem controla o personagem: o mestre, quem o edita ou quem controla um token dele. */
export function controlaPersonagem(estado: Estado, p: Personagem, usuario: Usuario): boolean {
  if (usuario.papel === "mestre") return true;
  return (
    podeEditarPersonagem(p, usuario) ||
    estado.tokens.some((t) => t.personagemId === p.id && t.controladoPor.includes(usuario.id))
  );
}

function personagemVisivelDe(c: ContextoDeTochas, id: string): Personagem | undefined {
  const e = c.atual();
  const p = e.personagens.find((x) => x.id === id);
  return p && personagemVisivelPara(p, c.usuario, e.pastas) ? p : undefined;
}

function ctxDeLuz(e: Estado) {
  return {
    tokens: e.tokens,
    personagens: e.personagens,
    pastas: e.pastas,
    pontos: e.pontos,
    cenaAtivaId: e.cenaAtivaId,
  };
}

/** O objeto, se existe e chega a este usuário (senão responde igual a inexistente). */
function objetoVisivelDe(c: ContextoDeTochas, id: string): ObjetoDeLuz | undefined {
  const e = c.atual();
  const o = e.luzes.find((l) => l.id === id);
  return o && luzVisivelPara(o, c.usuario, ctxDeLuz(e)) ? o : undefined;
}

function pontoVisivelDe(c: ContextoDeTochas, id: string): PontoDeLuz | undefined {
  const e = c.atual();
  const p = e.pontos.find((x) => x.id === id);
  return p && pontoVisivelPara(p, c.usuario, e.cenaAtivaId) ? p : undefined;
}

function quadradoDaCena(e: Estado, cenaId: string): number {
  return e.cenas.find((c) => c.id === cenaId)?.grid.quadradoM ?? 1.5;
}

/** Soma uma linha ao histórico do objeto (guarda só as últimas). */
export function comHistorico(
  o: ObjetoDeLuz,
  salaMs: number,
  texto: string,
  deltaMs?: number,
): ObjetoDeLuz {
  const item = { emSala: salaMs, texto, ...(deltaMs === undefined ? {} : { deltaMs }) };
  return { ...o, historico: [...o.historico, item].slice(-40) };
}

/** O objeto sem o instante de acender (ao apagar). */
function semDesde(o: ObjetoDeLuz): ObjetoDeLuz {
  const { acesaDesdeSala: _desde, ...resto } = o;
  return resto;
}

/** Acende: a contagem começa agora. */
function acender(o: ObjetoDeLuz, salaMs: number, texto: string): ObjetoDeLuz {
  return comHistorico({ ...o, estado: "acesa", acesaDesdeSala: salaMs }, salaMs, texto);
}

/**
 * Apaga e desconta a penalidade do saldo (só objeto com tempo). Devolve `null` se o que sobra acaba:
 * o objeto está consumido.
 */
function apagar(o: ObjetoDeLuz, salaMs: number, config: ConfigDaMesa): ObjetoDeLuz | null {
  const restante = restanteDoObjeto(o, salaMs);
  if (restante === null)
    return comHistorico(semDesde({ ...o, estado: "apagada" }), salaMs, "Apagada");
  const penalidade = config.penalidadeAoApagarS * 1000;
  const novo = restante - penalidade;
  if (novo <= TOLERANCIA_DO_FIM_MS) return null;
  const base = semDesde({ ...o, estado: "apagada", saldoMs: novo });
  return penalidade > 0
    ? comHistorico(
        base,
        salaMs,
        `Apagada (−${formatarDuracaoCurta(penalidade)} de penalidade)`,
        -penalidade,
      )
    : comHistorico(base, salaMs, "Apagada");
}

/** Grava o resultado: o objeto editado ou, se `null`, consumido (sai da coleção). */
function gravar(c: ContextoDeTochas, id: string, objeto: ObjetoDeLuz | null): void {
  if (objeto === null) c.emitir({ tipo: "fonte.apagada", dados: { id } });
  else c.emitir({ tipo: "fonte.editada", dados: { fonte: objeto } });
}

/** O objeto de um modelo, novo e aceso, com o saldo cheio. */
export function objetoDoModelo(
  modelo: ModeloDeObjeto,
  id: string,
  portador: ObjetoDeLuz["portador"],
  salaMs: number,
  texto: string,
): ObjetoDeLuz {
  const duracaoMs = modelo.duracaoS === null ? null : modelo.duracaoS * 1000;
  return {
    id,
    nome: modelo.nome,
    modeloId: modelo.id,
    portador,
    luz: { ...modelo.luz },
    intensidade: 1,
    estado: "acesa",
    saldoMs: duracaoMs,
    acesaDesdeSala: salaMs,
    ...(duracaoMs === null ? {} : { duracaoMs }),
    modificadores: [],
    historico: [{ emSala: salaMs, texto }],
  };
}

/** Onde o personagem está na cena ativa (o token que carrega a luz dele). */
function tokenDoDono(e: Estado, personagemId: string): Token | undefined {
  return tokenDoPersonagem(e.tokens, personagemId, e.cenaAtivaId);
}

type Dono = { personagem: Personagem; token: Token | undefined };

/**
 * O objeto está na mão de um personagem que este usuário pode mexer? Devolve o dono ou o erro.
 */
function objetoNaMao(c: ContextoDeTochas, o: ObjetoDeLuz): { dono: Dono } | { erro: ErroDaSala } {
  const portador = o.portador;
  if (portador.tipo !== "mao") {
    return erro("dados_invalidos", "A tocha precisa estar na mão de alguém.");
  }
  const personagem = c.atual().personagens.find((p) => p.id === portador.personagemId);
  if (!personagem) return erro("personagem_inexistente", SEM_PERSONAGEM);
  if (!controlaPersonagem(c.atual(), personagem, c.usuario)) {
    return erro("sem_permissao", "Você não controla este personagem.");
  }
  return { dono: { personagem, token: tokenDoDono(c.atual(), personagem.id) } };
}

// ---------------------------------------------------------------------------------------------
// Acender, apagar, guardar
// ---------------------------------------------------------------------------------------------

export function tocharAcender(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "tocha.acender" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const p = personagemVisivelDe(c, d.personagemId);
  if (!p) return erro("personagem_inexistente", SEM_PERSONAGEM);
  if (!controlaPersonagem(e, p, c.usuario)) {
    return erro("sem_permissao", "Você não controla este personagem.");
  }
  const modelo = e.modelos.find((m) => m.id === d.modeloId);
  if (!modelo) return erro("modelo_inexistente", "Modelo de objeto não encontrado.");
  if (!modelo.ocupaMao) return erro("dados_invalidos", "Este objeto não se segura na mão.");
  const mao = maoLivre(e.luzes, p.id, e.config.maosPorPersonagem);
  if (mao === undefined) return erro("maos_cheias", "As mãos estão ocupadas.");
  const sala = salaDe(c);
  const portador = { tipo: "mao" as const, personagemId: p.id, mao };
  if (d.objetoId !== undefined) {
    const objetoId = d.objetoId;
    const usado = e.luzes.find(
      (l) =>
        l.id === objetoId &&
        l.modeloId === modelo.id &&
        l.portador.tipo === "mochila" &&
        l.portador.personagemId === p.id,
    );
    if (!usado) return erro("fonte_inexistente", SEM_OBJETO);
    gravar(c, usado.id, acender({ ...usado, portador }, sala, "Acesa na mão"));
    return {};
  }
  if (d.novoId === undefined) return erro("dados_invalidos", "Falta o id do objeto novo.");
  const novoId = d.novoId;
  if (e.luzes.some((l) => l.id === novoId)) {
    return erro("dados_invalidos", "Já existe um objeto de luz com esse id.");
  }
  if (novasDoModelo(p.ficha, modelo.id) <= 0) {
    return erro("dados_invalidos", `Sem ${modelo.nome} nova na mochila.`);
  }
  c.emitir({
    tipo: "personagem.alterado",
    dados: { personagem: { ...p, ficha: ajustarNovas(p.ficha, modelo, -1) } },
  });
  c.emitir({
    tipo: "fonte.criada",
    dados: { fonte: objetoDoModelo(modelo, novoId, portador, sala, "Acesa na mão") },
  });
  return {};
}

/** Apaga (com a penalidade) ou reacende a tocha da mão ou o objeto de um ponto. */
export function tocharAlternar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "tocha.alternar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = objetoVisivelDe(c, d.id);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const sala = salaDe(c);
  const acesa = o.estado === "acesa";
  const pode = (cap: "tocha.acender" | "luz.apagar" | "ponto.usar") => podeCap(e, c.usuario, cap);

  switch (o.portador.tipo) {
    case "mao": {
      const r = objetoNaMao(c, o);
      if ("erro" in r) return r;
      if (!pode("tocha.acender")) return erro("sem_permissao", "Sem permissão (tocha.acender).");
      break;
    }
    case "ponto": {
      const ponto = pontoVisivelDe(c, o.portador.pontoId);
      if (!ponto) return erro("ponto_inexistente", SEM_PONTO);
      if (!pode(acesa ? "luz.apagar" : "ponto.usar")) {
        return erro("sem_permissao", `Sem permissão (${acesa ? "luz.apagar" : "ponto.usar"}).`);
      }
      if (!ehMestre(c) && !algumTokenAoAlcance(c, ponto)) {
        return erro("fora_de_alcance", "Você está longe demais.");
      }
      break;
    }
    case "cena":
    case "token":
      if (!ehMestre(c)) return erro("sem_permissao", "Só o mestre acende e apaga esta luz.");
      break;
    case "mochila":
      return erro("dados_invalidos", "A tocha está guardada na mochila.");
  }

  if (acesa) {
    gravar(c, o.id, apagar(o, sala, e.config));
    return {};
  }
  const restante = restanteDoObjeto(o, sala);
  if (restante !== null && restante <= 0)
    return erro("dados_invalidos", "Não há mais o que queimar.");
  gravar(c, o.id, acender(o, sala, "Reacesa"));
  return {};
}

function podeCap(e: Estado, usuario: Usuario, cap: "tocha.acender" | "luz.apagar" | "ponto.usar") {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador") return false;
  const excecao = e.permissoes.porUsuario[usuario.id]?.[cap];
  return excecao ?? e.permissoes.jogadores[cap] === true;
}

/** Algum token que o usuário controla está ao alcance do ponto, na cena dele? */
function algumTokenAoAlcance(c: ContextoDeTochas, ponto: PontoDeLuz): boolean {
  const e = c.atual();
  const q = quadradoDaCena(e, ponto.cenaId);
  return e.tokens.some(
    (t) =>
      t.cenaId === ponto.cenaId &&
      tokenVisivelPara(t, c.usuario, e.cenaAtivaId) &&
      t.personagemId !== undefined &&
      e.personagens.some((p) => p.id === t.personagemId && controlaPersonagem(e, p, c.usuario)) &&
      dentroDoAlcance(t, ponto, e.config.alcanceInteracaoM, q),
  );
}

export function tocharGuardar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "tocha.guardar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = objetoVisivelDe(c, d.id);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const r = objetoNaMao(c, o);
  if ("erro" in r) return r;
  const sala = salaDe(c);
  const apagada = o.estado === "acesa" ? apagar(o, sala, e.config) : o;
  if (apagada === null) {
    gravar(c, o.id, null);
    return {};
  }
  gravar(
    c,
    o.id,
    comHistorico(
      { ...apagada, portador: { tipo: "mochila", personagemId: r.dono.personagem.id } },
      sala,
      "Guardada na mochila",
    ),
  );
  return {};
}

// ---------------------------------------------------------------------------------------------
// Entregar e pôr em pontos
// ---------------------------------------------------------------------------------------------

export function tocharEntregar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "tocha.entregar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = objetoVisivelDe(c, d.id);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const r = objetoNaMao(c, o);
  if ("erro" in r) return r;
  const { personagem: de, token: tokenDe } = r.dono;
  const alvo = e.tokens.find((t) => t.id === d.tokenId);
  if (!alvo || !tokenVisivelPara(alvo, c.usuario, e.cenaAtivaId)) {
    return erro("token_inexistente", "Token não encontrado.");
  }
  if (alvo.personagemId === undefined) {
    return erro("dados_invalidos", "Esse token não tem mãos para segurar a tocha.");
  }
  const para = e.personagens.find((p) => p.id === alvo.personagemId);
  if (!para) return erro("personagem_inexistente", SEM_PERSONAGEM);
  if (para.id === de.id) return erro("dados_invalidos", "A tocha já está com ele.");
  if (!tokenDe || tokenDe.cenaId !== alvo.cenaId) {
    return erro("fora_de_alcance", "Vocês não estão na mesma cena.");
  }
  // O mestre entrega de longe (2026-11-10, decisão do Vilella); o alcance vale para os jogadores.
  if (
    !ehMestre(c) &&
    !dentroDoAlcance(tokenDe, alvo, e.config.alcanceInteracaoM, quadradoDaCena(e, alvo.cenaId))
  ) {
    return erro("fora_de_alcance", "Está longe demais para entregar.");
  }
  const mao = maoLivre(e.luzes, para.id, e.config.maosPorPersonagem);
  if (mao === undefined) return erro("maos_cheias", `${para.nome} está com as mãos ocupadas.`);
  gravar(
    c,
    o.id,
    comHistorico(
      { ...o, portador: { tipo: "mao", personagemId: para.id, mao } },
      salaDe(c),
      `Entregue a ${para.nome}`,
    ),
  );
  return {};
}

export function tocharPosar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "tocha.posar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = objetoVisivelDe(c, d.id);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const r = objetoNaMao(c, o);
  if ("erro" in r) return r;
  const ponto = pontoVisivelDe(c, d.pontoId);
  if (!ponto) return erro("ponto_inexistente", SEM_PONTO);
  if (ponto.tipo !== "suporte") return erro("dados_invalidos", "Isso não é um suporte.");
  const token = r.dono.token;
  if (!token || token.cenaId !== ponto.cenaId) {
    return erro("fora_de_alcance", "O personagem não está na cena do suporte.");
  }
  // O mestre põe e tira do suporte de longe; o alcance vale para os jogadores.
  if (
    !ehMestre(c) &&
    !dentroDoAlcance(token, ponto, e.config.alcanceInteracaoM, quadradoDaCena(e, ponto.cenaId))
  ) {
    return erro("fora_de_alcance", "Está longe demais do suporte.");
  }
  const ocupados = e.luzes.filter(
    (l) => l.portador.tipo === "ponto" && l.portador.pontoId === ponto.id,
  ).length;
  if (ocupados >= (ponto.capacidade ?? 1)) return erro("suporte_cheio", "O suporte está cheio.");
  gravar(
    c,
    o.id,
    comHistorico(
      { ...o, portador: { tipo: "ponto", pontoId: ponto.id } },
      salaDe(c),
      `Posta em ${ponto.nome}`,
    ),
  );
  return {};
}

export function pontoPegar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "ponto.pegar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = objetoVisivelDe(c, d.id);
  if (o?.portador.tipo !== "ponto") return erro("fonte_inexistente", SEM_OBJETO);
  const ponto = pontoVisivelDe(c, o.portador.pontoId);
  if (!ponto) return erro("ponto_inexistente", SEM_PONTO);
  if (ponto.tipo !== "suporte") return erro("dados_invalidos", "Isso não se tira do lugar.");
  const p = personagemVisivelDe(c, d.personagemId);
  if (!p) return erro("personagem_inexistente", SEM_PERSONAGEM);
  if (!controlaPersonagem(e, p, c.usuario)) {
    return erro("sem_permissao", "Você não controla este personagem.");
  }
  const token = tokenDoDono(e, p.id);
  if (!token || token.cenaId !== ponto.cenaId) {
    return erro("fora_de_alcance", "O personagem não está na cena do suporte.");
  }
  // O mestre põe e tira do suporte de longe; o alcance vale para os jogadores.
  if (
    !ehMestre(c) &&
    !dentroDoAlcance(token, ponto, e.config.alcanceInteracaoM, quadradoDaCena(e, ponto.cenaId))
  ) {
    return erro("fora_de_alcance", "Está longe demais do suporte.");
  }
  const mao = maoLivre(e.luzes, p.id, e.config.maosPorPersonagem);
  if (mao === undefined) return erro("maos_cheias", "As mãos estão ocupadas.");
  gravar(
    c,
    o.id,
    comHistorico(
      { ...o, portador: { tipo: "mao", personagemId: p.id, mao } },
      salaDe(c),
      `Tirada de ${ponto.nome} por ${p.nome}`,
    ),
  );
  return {};
}

// ---------------------------------------------------------------------------------------------
// Acender um inflamável
// ---------------------------------------------------------------------------------------------

const chaveDoAcendimento = (pontoId: string, usuarioId: string) => `${pontoId}|${usuarioId}`;

/** As condições comuns ao começo e ao fim de acender um inflamável. */
function condicoesDoInflamavel(
  c: ContextoDeTochas,
  pontoId: string,
  objetoId: string,
): { ponto: PontoDeLuz; modelo: ModeloDeObjeto } | { erro: ErroDaSala } {
  const e = c.atual();
  const ponto = pontoVisivelDe(c, pontoId);
  if (!ponto) return erro("ponto_inexistente", SEM_PONTO);
  if (ponto.tipo !== "inflamavel") return erro("dados_invalidos", "Isso não pega fogo.");
  const modelo =
    ponto.modeloId === undefined ? undefined : e.modelos.find((m) => m.id === ponto.modeloId);
  if (!modelo) return erro("modelo_inexistente", "Este ponto não sabe no que se transforma.");
  const o = objetoVisivelDe(c, objetoId);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const r = objetoNaMao(c, o);
  if ("erro" in r) return r;
  if (o.estado !== "acesa") return erro("dados_invalidos", "A tocha precisa estar acesa.");
  const token = r.dono.token;
  if (!token || token.cenaId !== ponto.cenaId) {
    return erro("fora_de_alcance", "O personagem não está na cena do ponto.");
  }
  if (!dentroDoAlcance(token, ponto, e.config.alcanceInteracaoM, quadradoDaCena(e, ponto.cenaId))) {
    return erro("fora_de_alcance", "Está longe demais.");
  }
  if (e.luzes.some((l) => l.portador.tipo === "ponto" && l.portador.pontoId === ponto.id)) {
    return erro("dados_invalidos", "Já há fogo aí.");
  }
  return { ponto, modelo };
}

export function pontoAcenderInicio(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "ponto.acenderInicio" }>["dados"],
): SaidaDeTochas {
  const r = condicoesDoInflamavel(c, d.pontoId, d.objetoId);
  if ("erro" in r) return r;
  c.definirAcendimentos({
    ...c.atual().acendimentos,
    [chaveDoAcendimento(d.pontoId, c.usuario.id)]: salaDe(c),
  });
  return {};
}

export function pontoAcenderFim(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "ponto.acenderFim" }>["dados"],
): SaidaDeTochas {
  const r = condicoesDoInflamavel(c, d.pontoId, d.objetoId);
  if ("erro" in r) return r;
  const { ponto, modelo } = r;
  const e = c.atual();
  const chave = chaveDoAcendimento(ponto.id, c.usuario.id);
  const inicio = e.acendimentos?.[chave];
  const sala = salaDe(c);
  const exigidoMs = (ponto.segurarS ?? SEGURAR_PADRAO_S) * 1000;
  if (inicio === undefined || sala - inicio < exigidoMs - TOLERANCIA_DO_SEGURAR_MS) {
    return erro("segurar_incompleto", "Segure a tocha sobre o ponto até o fim da contagem.");
  }
  const { [chave]: _usado, ...resto } = e.acendimentos ?? {};
  c.definirAcendimentos(resto);
  const id = `fogo-${ponto.id.slice(0, 40)}-${e.seq + 1}`;
  if (!ponto.visivelParaJogadores) {
    c.emitir({
      tipo: "ponto.alterado",
      dados: { ponto: { ...ponto, visivelParaJogadores: true } },
    });
  }
  c.emitir({
    tipo: "fonte.criada",
    dados: {
      fonte: objetoDoModelo(modelo, id, { tipo: "ponto", pontoId: ponto.id }, sala, "Acesa"),
    },
  });
  return {};
}

// ---------------------------------------------------------------------------------------------
// Ajustes do mestre
// ---------------------------------------------------------------------------------------------

const MAXIMO_DO_SALDO_MS = 1000 * 3600_000;

export function objetoAjustar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "objeto.ajustar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const o = e.luzes.find((l) => l.id === d.id);
  if (!o) return erro("fonte_inexistente", SEM_OBJETO);
  const sala = salaDe(c);
  const a = d.ajuste;
  switch (a.acao) {
    case "consumir":
      gravar(c, o.id, null);
      return {};
    case "tempo": {
      const restante = restanteDoObjeto(o, sala);
      if (restante === null) return erro("dados_invalidos", "Este objeto não se consome.");
      const novo = Math.min(restante + a.deltaMs, MAXIMO_DO_SALDO_MS);
      if (novo <= TOLERANCIA_DO_FIM_MS) {
        gravar(c, o.id, null);
        return {};
      }
      const sinal = a.deltaMs < 0 ? "−" : "+";
      const texto = `${sinal}${formatarDuracaoCurta(a.deltaMs)} (mestre)${a.nota ? `: ${a.nota}` : ""}`;
      const base: ObjetoDeLuz = { ...o, saldoMs: novo };
      // Acesa: a contagem recomeça agora, do que sobrou mais o ajuste.
      const rebase: ObjetoDeLuz = o.estado === "acesa" ? { ...base, acesaDesdeSala: sala } : base;
      gravar(c, o.id, comHistorico(rebase, sala, texto, a.deltaMs));
      return {};
    }
    case "modificar": {
      const m = a.modificador;
      if (o.modificadores.some((x) => x.id === m.id)) {
        return erro("dados_invalidos", "Já existe um modificador com esse id.");
      }
      if (o.modificadores.length >= 20) return erro("dados_invalidos", "Modificadores demais.");
      const novo = {
        id: m.id,
        raioX: m.raioX,
        origem: "mestre" as const,
        ...(m.duracaoMs === undefined ? {} : { ateSala: sala + m.duracaoMs }),
        ...(m.nota === undefined ? {} : { nota: m.nota }),
      };
      const prazo =
        m.duracaoMs === undefined ? "sem prazo" : `por ${formatarDuracaoCurta(m.duracaoMs)}`;
      gravar(
        c,
        o.id,
        comHistorico(
          { ...o, modificadores: [...o.modificadores, novo] },
          sala,
          `Raio ×${String(m.raioX).replace(".", ",")} ${prazo} (mestre)${m.nota ? `: ${m.nota}` : ""}`,
        ),
      );
      return {};
    }
    case "tirarModificador": {
      const id = a.id;
      const m = o.modificadores.find((x) => x.id === id);
      if (!m) return erro("dados_invalidos", "Modificador não encontrado.");
      gravar(
        c,
        o.id,
        comHistorico(
          { ...o, modificadores: o.modificadores.filter((x) => x.id !== id) },
          sala,
          `Raio ×${String(m.raioX).replace(".", ",")} retirado (mestre)`,
        ),
      );
      return {};
    }
  }
}

export function mochilaAjustar(
  c: ContextoDeTochas,
  d: Extract<Intencao, { tipo: "mochila.ajustar" }>["dados"],
): SaidaDeTochas {
  const e = c.atual();
  const p = e.personagens.find((x) => x.id === d.personagemId);
  if (!p) return erro("personagem_inexistente", SEM_PERSONAGEM);
  const modelo = e.modelos.find((m) => m.id === d.modeloId);
  if (!modelo) return erro("modelo_inexistente", "Modelo de objeto não encontrado.");
  const ficha = ajustarNovas(p.ficha, modelo, d.delta);
  if (JSON.stringify(ficha) === JSON.stringify(p.ficha)) return {};
  c.emitir({ tipo: "personagem.alterado", dados: { personagem: { ...p, ficha } } });
  return {};
}
