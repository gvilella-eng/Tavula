import {
  type AcaoDeFluxo,
  type AlvoDoParaCada,
  type Automacoes,
  automacoesDe,
  type CondicaoDoSe,
  type ContextoDoFluxo,
  condicoesDoGatilho,
  type Efeito,
  type Esperando,
  type EventoDeAutomacao,
  type Fluxo,
  FluxoSchema,
  type Gatilho,
  idDoBotaoDeCiclo,
  idDoBotaoDeEvento,
  MAXIMO_DE_EFEITOS,
  MAXIMO_DE_EXECUCOES_ESPERANDO,
  MAXIMO_DE_FLUXOS,
  MAXIMO_DO_REGISTRO,
  type No,
  type NoDe,
  noDeDisparoManual,
  noDeGatilhoDoTipo,
  noDosFios,
  nosDeGatilho,
  PRAZO_PADRAO_S,
  PROFUNDIDADE_MAXIMA,
  pecasDaCaixa,
  TETO_DE_ACOES,
  tauDoFluxo,
  temGatilho,
} from "./automacoes.ts";
import type { FonteDeAleatoriedade } from "./dados.ts";
import type { Estado, Modificador, ObjetoDeLuz, Token } from "./estado.ts";
import { problemasDoFluxo, type ReferenciasDaMesa } from "./fluxosValidar.ts";
import { cenaDoObjeto, tokenDoPersonagem } from "./luz.ts";
import { volumeGeralDe } from "./mesadesom.ts";
import { cenaEhCartao } from "./paredes.ts";
import type { CodigoDeErro, Intencao } from "./protocolo.ts";
import { formatarDuracaoCurta, restanteDoObjeto, tempoDaSala } from "./relogio.ts";
import type { AlvoDoEfeito } from "./som.ts";
import { comHistorico, type ErroDaSala, type NovoEvento } from "./tochas.ts";
import {
  entradasESaidas,
  objetoNaZona,
  PREFIXO_DE_ZONA,
  tokenNaZona,
  type Zona,
  zonasDe,
} from "./zonas.ts";

// ---------------------------------------------------------------------------------------------
// O motor das automações (seção 4.11; por blocos desde o AU1). Puro: não grava nem envia nada. Recebe o estado vivo e uma
// forma de emitir eventos (como as tochas), e tudo o que sorteia usa a fonte de aleatoriedade que quem chama passa (a
// sala usa `crypto`; os testes, uma semente fixa).
//
// Regras: ações de uma lista fechada (`AcaoDeFluxoSchema`); efeito temporário é MODIFICADOR com prazo no tempo da sala,
// nunca o valor base; escopo por cena; encadeamento de sinais com limite (`PROFUNDIDADE_MAXIMA`) e teto de ações.
//
// Um "esperar" vira uma execução esperando (`Automacoes.esperando`: fluxo, ponto da árvore e contexto), guardada no estado
// para sobreviver à hibernação. O tempo é o da sala: pausar a mesa pausa tudo.
// ---------------------------------------------------------------------------------------------

export type ContextoDoMotor = {
  /** O instante real (ms): com o relógio da sala dá o tempo da sala. */
  agoraMs: number;
  aleatorio: FonteDeAleatoriedade;
  atual: () => Estado;
  emitir: (evento: NovoEvento) => void;
};

export type SaidaDeAutomacao = { erro: ErroDaSala } | { snapshotPara?: "todos" | string[] };

const erro = (codigo: CodigoDeErro, mensagem: string): { erro: ErroDaSala } => ({
  erro: { codigo, mensagem },
});

/** O objeto morre quando sobram menos de 50 ms (a mesma tolerância das tochas). */
const TOLERANCIA_DO_FIM_MS = 50;
const MAXIMO_DO_SALDO_MS = 1000 * 3600_000;
const MAXIMO_DE_MODIFICADORES = 20;
/** Quantos disparos atrasados de um fluxo de relógio o motor recupera de uma vez (o resto é pulado e anotado). */
const MAXIMO_DE_DISPAROS_ATRASADOS = 50;

type Escopo = readonly string[] | null;
type Caminho = (number | string)[];

const arred = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

function zonaDe(m: Motor, id: string | undefined): Zona | undefined {
  return id === undefined ? undefined : zonasDe(m.ctx.atual()).find((z) => z.id === id);
}

/** O que cada rodada junta para depois: os sinais mandados (rodam quando os fluxos do evento terminam, como as reações antigas). */
type Encadeado = { nome: string; atrasoS: number; contexto: ContextoDoFluxo };

/** Uma rodada: de que fluxo, em que nível de encadeamento, e o instante de que os "esperar" contam. */
type Rodada = {
  fluxo: Fluxo;
  profundidade: number;
  referenciaSala: number;
  encadeados: Encadeado[];
  /** Quantos nós esta rodada já percorreu (o teto pega ciclos que não pausam). */
  passos: number;
  porId: Map<string, No>;
  /**
   * LP1: as saídas (caixas de fora, ou o próprio gatilho solto) que este acontecimento já seguiu. Gatilhos guardados na mesma
   * caixa seguem os mesmos fios; se dois casam com o mesmo acontecimento, a cadeia roda uma vez só.
   */
  seguidas: Set<string>;
};

// ---------------------------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------------------------

/**
 * Uma passada do motor: guarda a fatia de automações e os efeitos num rascunho e só emite o evento `automacoes.alterado` e
 * `efeitos.alterados` no `fechar()`, se mudaram.
 */
class Motor {
  acoes = 0;
  cortado = false;
  slice: Automacoes;
  efeitos: Efeito[];
  private n = 0;

  readonly ctx: ContextoDoMotor;

  constructor(ctx: ContextoDoMotor) {
    this.ctx = ctx;
    const e = ctx.atual();
    this.slice = structuredClone(automacoesDe(e));
    this.efeitos = structuredClone(e.efeitos ?? []);
  }

  get sala(): number {
    return tempoDaSala(this.ctx.atual().relogio, this.ctx.agoraMs);
  }

  /** Uma frase para o mestre (só as últimas ficam; a mesma de seguida não se repete). */
  anotar(texto: string): void {
    const ultimo = this.slice.registro.at(-1);
    if (ultimo?.texto === texto) return;
    this.slice.registro = [...this.slice.registro, { emSala: this.sala, texto }].slice(
      -MAXIMO_DO_REGISTRO,
    );
  }

  /** Conta uma ação aplicada; passou do teto, para tudo e anota. */
  contar(): boolean {
    if (this.cortado) return false;
    this.acoes++;
    if (this.acoes > TETO_DE_ACOES) {
      this.cortado = true;
      this.anotar(`Automação cortada: mais de ${TETO_DE_ACOES} ações num disparo só.`);
      return false;
    }
    return true;
  }

  /** Um id novo e estável o bastante para uma execução esperando. */
  novoId(prefixo: string): string {
    this.n++;
    return `${prefixo}-${this.ctx.atual().seq}-${this.n}`;
  }

  sortear(probabilidade: number): boolean {
    if (probabilidade >= 1) return true;
    if (probabilidade <= 0) return false;
    return this.ctx.aleatorio(1_000_000) < probabilidade * 1_000_000;
  }

  /** Emite as fatias que mudaram. */
  fechar(): void {
    const e = this.ctx.atual();
    if (JSON.stringify(this.slice) !== JSON.stringify(automacoesDe(e))) {
      this.ctx.emitir({ tipo: "automacoes.alterado", dados: { automacoes: this.slice } });
    }
    if (JSON.stringify(this.efeitos) !== JSON.stringify(e.efeitos ?? [])) {
      this.ctx.emitir({ tipo: "efeitos.alterados", dados: { efeitos: this.efeitos } });
    }
  }
}

// --- Escopo e alvos --------------------------------------------------------------------------

function contextoDeLuz(e: Estado) {
  return { tokens: e.tokens, pontos: e.pontos };
}

function cenaDe(m: Motor, o: ObjetoDeLuz): string | undefined {
  return cenaDoObjeto(o, contextoDeLuz(m.ctx.atual()));
}

function naEscopo(m: Motor, o: ObjetoDeLuz, cenas: Escopo): boolean {
  const c = cenaDe(m, o);
  return c !== undefined && (cenas === null || cenas.includes(c));
}

function tagsDe(m: Motor, o: Pick<ObjetoDeLuz, "modeloId">): readonly string[] {
  if (o.modeloId === undefined) return [];
  return m.ctx.atual().modelos.find((x) => x.id === o.modeloId)?.tags ?? [];
}

/**
 * O escopo de cenas em que o fluxo vale para este evento (regra 4), ou `"nunca"` quando o fluxo, preso a umas cenas, não
 * está entre as do evento. Fluxo sem cenas (ou com a lista vazia) vale em todas. Com `naCenaAtiva`, a cena ativa entra na lista.
 */
function escopoDoFluxo(f: Fluxo, evCenas: Escopo, cenaAtivaId: string): Escopo | "nunca" {
  const marcadas = f.cenas === null || f.cenas.length === 0 ? null : f.cenas;
  // AU4: "cena ativa" é a cena do grupo agora; soma-se às marcadas.
  const a = f.naCenaAtiva === true ? [...new Set([...(marcadas ?? []), cenaAtivaId])] : marcadas;
  if (a === null) return evCenas;
  if (evCenas === null) return a;
  const comum = a.filter((c) => evCenas.includes(c));
  return comum.length === 0 ? "nunca" : comum;
}

function objetosDoParaCada(
  m: Motor,
  a: Extract<AlvoDoParaCada, { tipo: "objetos" }>,
  cenas: Escopo,
): ObjetoDeLuz[] {
  const e = m.ctx.atual();
  const zona = a.naZona === undefined ? undefined : zonaDe(m, a.naZona);
  if (a.naZona !== undefined && !zona?.ativa) return [];
  return e.luzes.filter(
    (l) =>
      naEscopo(m, l, cenas) &&
      (a.modelo === undefined || l.modeloId === a.modelo) &&
      (a.etiqueta === undefined || tagsDe(m, l).includes(a.etiqueta)) &&
      (a.acesos !== true || l.estado === "acesa") &&
      (zona === undefined || objetoNaZona(l, zona, e)),
  );
}

function tokensDoParaCada(
  m: Motor,
  a: Extract<AlvoDoParaCada, { tipo: "tokens" }>,
  cenas: Escopo,
): Token[] {
  const e = m.ctx.atual();
  const zona = a.naZona === undefined ? undefined : zonaDe(m, a.naZona);
  if (a.naZona !== undefined && !zona?.ativa) return [];
  return e.tokens.filter(
    (t) =>
      (cenas === null || cenas.includes(t.cenaId)) &&
      (zona === undefined || tokenNaZona(t, zona)) &&
      (a.naCena === undefined || t.cenaId === a.naCena) &&
      (a.ids === undefined || a.ids.includes(t.id)),
  );
}

/** Os tokens que uma ação de token atinge: o da vez; sem ele, quem carrega o objeto da vez. */
function tokensDaAcao(m: Motor, ctx: ContextoDoFluxo): Token[] {
  const e = m.ctx.atual();
  if (ctx.tokenId !== undefined) {
    const id = ctx.tokenId;
    return e.tokens.filter(
      (t) => t.id === id && (ctx.cenas === null || ctx.cenas.includes(t.cenaId)),
    );
  }
  if (ctx.objetoId !== undefined) {
    const o = e.luzes.find((l) => l.id === ctx.objetoId);
    if (!o) return [];
    const p = o.portador;
    if (p.tipo === "token") {
      const id = p.tokenId;
      return e.tokens.filter((t) => t.id === id);
    }
    if (p.tipo === "mao") {
      const t = tokenDoPersonagem(e.tokens, p.personagemId, cenaDe(m, o));
      return t ? [t] : [];
    }
  }
  return [];
}

function avaliar(m: Motor, c: CondicaoDoSe, ctx: ContextoDoFluxo): boolean {
  const e = m.ctx.atual();
  const objeto =
    ctx.objetoId === undefined ? undefined : e.luzes.find((l) => l.id === ctx.objetoId);
  switch (c.condicao) {
    case "etiqueta":
      return objeto !== undefined && tagsDe(m, objeto).includes(c.etiqueta);
    case "zonaLigada":
      return zonaDe(m, c.zona)?.ativa === true;
    case "dentroDaZona": {
      const zona = zonaDe(m, c.zona);
      if (!zona?.ativa) return false;
      if (objeto) return objetoNaZona(objeto, zona, e);
      const token =
        ctx.tokenId === undefined ? undefined : e.tokens.find((t) => t.id === ctx.tokenId);
      return token !== undefined && tokenNaZona(token, zona);
    }
    case "cena": {
      if (objeto) {
        const cena = cenaDe(m, objeto);
        return cena !== undefined && c.cenas.includes(cena);
      }
      return ctx.cenas === null || ctx.cenas.some((x) => c.cenas.includes(x));
    }
    case "chance":
      return m.sortear(c.chance);
    case "tokenDeJogador": {
      const token =
        ctx.tokenId === undefined ? undefined : e.tokens.find((t) => t.id === ctx.tokenId);
      return token !== undefined && token.controladoPor.length > 0;
    }
  }
}

/** Dentro do "sim" de um "se na cena X", só X vale. */
function estreitar(ctx: ContextoDoFluxo, c: CondicaoDoSe): ContextoDoFluxo {
  if (c.condicao !== "cena") return ctx;
  return {
    ...ctx,
    cenas: ctx.cenas === null ? [...c.cenas] : ctx.cenas.filter((x) => c.cenas.includes(x)),
  };
}

// --- Aplicar as ações ------------------------------------------------------------------------

function semDesde(o: ObjetoDeLuz): ObjetoDeLuz {
  const { acesaDesdeSala: _desde, ...resto } = o;
  return resto;
}

function gravarObjeto(m: Motor, o: ObjetoDeLuz): void {
  m.ctx.emitir({ tipo: "fonte.editada", dados: { fonte: o } });
}

function semAlvo(m: Motor, rd: Rodada, o: string): void {
  m.anotar(`${rd.fluxo.nome}: a ação "${o}" ficou sem alvo (ponha-a dentro de um "para cada").`);
}

function aplicarAcao(
  m: Motor,
  rd: Rodada,
  caminho: Caminho,
  acao: AcaoDeFluxo,
  ctx: ContextoDoFluxo,
): void {
  const sala = m.sala;
  const f = rd.fluxo;
  const idDaAcao = `auto:${f.id}:${caminho.join(".")}`;
  const objetoDaVez = (): ObjetoDeLuz | undefined =>
    ctx.objetoId === undefined ? undefined : m.ctx.atual().luzes.find((l) => l.id === ctx.objetoId);
  switch (acao.acao) {
    case "luz.modificar": {
      const o = objetoDaVez();
      if (!o) {
        semAlvo(m, rd, "mudar a luz");
        return;
      }
      const prazoMs = (acao.porS ?? PRAZO_PADRAO_S) * 1000;
      if (!m.contar()) return;
      // O mesmo efeito de novo renova o prazo (não empilha): o refresh nunca deixa nada preso.
      const outros = o.modificadores.filter((x) => x.id !== idDaAcao);
      if (outros.length >= MAXIMO_DE_MODIFICADORES) {
        m.anotar(`Modificadores demais em "${o.nome}": ${f.nome} não entrou.`);
        return;
      }
      const novo: Modificador = {
        id: idDaAcao,
        raioX: acao.raioX ?? 1,
        ...(acao.raioSomaM === undefined ? {} : { raioSomaM: acao.raioSomaM }),
        ateSala: sala + prazoMs,
        origem: "automacao",
      };
      const partes = [
        acao.raioX === undefined ? "" : `×${arred(acao.raioX)}`,
        acao.raioSomaM === undefined
          ? ""
          : `${acao.raioSomaM >= 0 ? "+" : "−"}${arred(Math.abs(acao.raioSomaM))} m`,
      ].filter(Boolean);
      gravarObjeto(
        m,
        comHistorico(
          { ...o, modificadores: [...outros, novo] },
          sala,
          `Raio ${partes.join(" ")} por ${formatarDuracaoCurta(prazoMs)} (automação)`,
        ),
      );
      return;
    }
    case "objeto.apagar": {
      const o = objetoDaVez();
      if (!o) {
        semAlvo(m, rd, "apagar a tocha");
        return;
      }
      if (o.estado !== "acesa") return;
      if (!m.contar()) return;
      if (!m.sortear(acao.chance ?? 1)) return;
      const restante = restanteDoObjeto(o, sala);
      if (restante === null) {
        gravarObjeto(
          m,
          comHistorico(semDesde({ ...o, estado: "apagada" }), sala, "Apagada (automação)"),
        );
        return;
      }
      const penalidade = (acao.penalidadeS ?? 0) * 1000;
      const novo = restante - penalidade;
      if (novo <= TOLERANCIA_DO_FIM_MS) {
        m.ctx.emitir({ tipo: "fonte.apagada", dados: { id: o.id } });
        return;
      }
      const base = semDesde({ ...o, estado: "apagada", saldoMs: novo });
      gravarObjeto(
        m,
        penalidade > 0
          ? comHistorico(
              base,
              sala,
              `Apagada (−${formatarDuracaoCurta(penalidade)} de penalidade, automação)`,
              -penalidade,
            )
          : comHistorico(base, sala, "Apagada (automação)"),
      );
      return;
    }
    case "objeto.ajustarTempo": {
      const o = objetoDaVez();
      if (!o) {
        semAlvo(m, rd, "ajustar o tempo da tocha");
        return;
      }
      const deltaMs = acao.deltaS * 1000;
      const restante = restanteDoObjeto(o, sala);
      if (restante === null) return;
      if (!m.contar()) return;
      const novo = Math.min(restante + deltaMs, MAXIMO_DO_SALDO_MS);
      if (novo <= TOLERANCIA_DO_FIM_MS) {
        m.ctx.emitir({ tipo: "fonte.apagada", dados: { id: o.id } });
        return;
      }
      const sinal = deltaMs < 0 ? "−" : "+";
      const base: ObjetoDeLuz = { ...o, saldoMs: novo };
      // Acesa: a contagem recomeça agora, do que sobrou mais o ajuste (como o ajuste do mestre).
      const rebase: ObjetoDeLuz = o.estado === "acesa" ? { ...base, acesaDesdeSala: sala } : base;
      gravarObjeto(
        m,
        comHistorico(rebase, sala, `${sinal}${formatarDuracaoCurta(deltaMs)} (automação)`, deltaMs),
      );
      return;
    }
    case "visao.limitar": {
      const alvos = tokensDaAcao(m, ctx);
      if (alvos.length === 0 && ctx.tokenId === undefined && ctx.objetoId === undefined) {
        semAlvo(m, rd, "limitar a visão");
        return;
      }
      const prazoMs = (acao.porS ?? PRAZO_PADRAO_S) * 1000;
      for (const t of alvos) {
        if (!m.contar()) return;
        const id = `${idDaAcao}:${t.id}`;
        const novo: Efeito = {
          id,
          alvo: { tipo: "token", id: t.id },
          efeito: { visaoMaxM: acao.alcanceM },
          ateSala: sala + prazoMs,
          origem: f.nome.slice(0, 80),
        };
        const outros = m.efeitos.filter((x) => x.id !== id);
        if (outros.length >= MAXIMO_DE_EFEITOS) {
          m.anotar("Efeitos demais: o limite de visão não entrou.");
          continue;
        }
        m.efeitos = [...outros, novo];
      }
      return;
    }
    case "chat.anunciar": {
      if (!m.contar()) return;
      const e = m.ctx.atual();
      const seq = e.seq + 1;
      m.ctx.emitir({
        tipo: "chat.mensagem",
        dados: {
          mensagem: {
            id: `m${seq}`,
            seq,
            emSala: sala,
            emReal: m.ctx.agoraMs,
            autorId: "sistema",
            tipo: "aviso",
            texto: acao.texto,
            visivelPara: acao.para === "mestre" ? { ids: [] } : "todos",
          },
        },
      });
      return;
    }
    case "som.tocar": {
      const e = m.ctx.atual();
      if (e.assets?.find((a) => a.hash === acao.hash)?.tipo !== "som") {
        m.anotar(`${f.nome}: o som "${acao.nome}" não está mais na mesa.`);
        return;
      }
      let destino: AlvoDoEfeito;
      if (acao.para === "token") {
        if (ctx.tokenId === undefined) {
          m.anotar(`${f.nome}: o som é "para o token da vez", e aqui não há token.`);
          return;
        }
        destino = { tipo: "token", tokenId: ctx.tokenId };
      } else if (acao.para === "cena") {
        const cenas = ctx.cenas;
        const cenaId =
          cenas === null || cenas.includes(e.cenaAtivaId)
            ? e.cenaAtivaId
            : (cenas[0] ?? e.cenaAtivaId);
        destino = { tipo: "cena", cenaId };
      } else {
        destino = { tipo: "todos" };
      }
      if (!m.contar()) return;
      m.ctx.emitir({
        tipo: "som.efeitoTocado",
        // Q4: o volume geral da mesa de som vale também para o som das automações.
        dados: { hash: acao.hash, volume: acao.volume * volumeGeralDe(e), alvo: destino },
      });
      return;
    }
    case "token.mostrar":
    case "token.ocultar": {
      const oculto = acao.acao === "token.ocultar";
      const alvos = tokensDaAcao(m, ctx);
      if (alvos.length === 0 && ctx.tokenId === undefined && ctx.objetoId === undefined) {
        semAlvo(m, rd, oculto ? "ocultar o token" : "mostrar o token");
        return;
      }
      for (const t of alvos) {
        if (t.oculto === oculto) continue;
        if (!m.contar()) return;
        m.ctx.emitir({ tipo: "token.editado", dados: { token: { ...t, oculto } } });
      }
      return;
    }
    case "zona.ativar": {
      const zona = zonaDe(m, acao.zona);
      if (!zona) {
        m.anotar(`${f.nome}: a zona da ação não existe mais.`);
        return;
      }
      if (zona.ativa === acao.ativa) return;
      if (!m.contar()) return;
      m.ctx.emitir({ tipo: "zona.alterada", dados: { zona: { ...zona, ativa: acao.ativa } } });
      return;
    }
  }
}

// --- Seguir os fios --------------------------------------------------------------------------

/** Quantos nós um disparo percorre, no máximo (um grafo com ciclo e esperas curtas não trava a sala). */
const MAXIMO_DE_PASSOS_POR_DISPARO = 2000;

function novaRodada(
  f: Fluxo,
  profundidade: number,
  referenciaSala: number,
  encadeados: Encadeado[] = [],
  seguidas: Set<string> = new Set(),
): Rodada {
  return {
    fluxo: f,
    profundidade,
    referenciaSala,
    encadeados,
    passos: 0,
    porId: new Map(f.nos.map((n) => [n.id, n])),
    seguidas,
  };
}

/** O valor de um nó de condição ou de uma porta lógica, para o contexto da vez. `memo`: cada nó vale uma vez por conferência. */
function valorDoNo(
  m: Motor,
  rd: Rodada,
  id: string,
  ctx: ContextoDoFluxo,
  memo: Map<string, boolean>,
  pilha: ReadonlySet<string>,
): boolean {
  const no = rd.porId.get(id);
  if (no === undefined || pilha.has(id)) return false;
  const guardado = memo.get(id);
  if (guardado !== undefined) return guardado;
  let valor = false;
  if (no.tipo === "condicao") {
    valor = avaliar(m, no.config, ctx);
  } else if (no.tipo === "caixa") {
    const depois = new Set([...pilha, id]);
    // AU3: as peças de dentro da caixa, de cima para baixo.
    const entradas = pecasDaCaixa(rd.fluxo.nos, id).map((x) =>
      valorDoNo(m, rd, x.id, ctx, memo, depois),
    );
    if (no.config.porta === "e") valor = entradas.length > 0 && entradas.every(Boolean);
    else if (no.config.porta === "ou") valor = entradas.some(Boolean);
    else valor = entradas.length > 0 && !entradas.some(Boolean);
  }
  memo.set(id, valor);
  return valor;
}

/** Segue todos os fios que saem desta porta, na ordem; cada um é um caminho (os vários rodam um depois do outro, no mesmo instante). */
function seguir(m: Motor, rd: Rodada, no: string, saida: string, ctx: ContextoDoFluxo): void {
  for (const fio of rd.fluxo.fios) {
    if (m.cortado) return;
    if (fio.de.no !== no || fio.de.saida !== saida) continue;
    const alvo = rd.porId.get(fio.para.no);
    if (alvo !== undefined && fio.para.entrada === "entrada") executarNo(m, rd, alvo, ctx);
  }
}

/** Roda uma ação, um sinal ou uma caixa de ação (as peças de uma caixa não têm fios: a caixa as roda). */
function executarPecaDeAcao(m: Motor, rd: Rodada, no: No, ctx: ContextoDoFluxo): void {
  if (m.cortado) return;
  if (no.tipo === "acao") {
    aplicarAcao(m, rd, [no.id], no.config.acao, ctx);
  } else if (no.tipo === "sinal") {
    if (!m.contar()) return;
    rd.encadeados.push({ nome: no.config.nome, atrasoS: no.config.atrasoS ?? 0, contexto: ctx });
  } else if (no.tipo === "caixa") {
    const pecas = pecasDaCaixa(rd.fluxo.nos, no.id);
    if (no.config.porta === "e") {
      for (const x of pecas) executarPecaDeAcao(m, rd, x, ctx);
    } else if (no.config.porta === "ou" && pecas.length > 0) {
      // sorteia uma só, por igual (50/50 com duas)
      let escolhida = pecas.length - 1;
      for (let i = 0; i < pecas.length - 1; i++) {
        if (m.sortear(1 / (pecas.length - i))) {
          escolhida = i;
          break;
        }
      }
      const x = pecas[escolhida];
      if (x) executarPecaDeAcao(m, rd, x, ctx);
    }
  }
}

/** Um nó recebeu a execução (chegou por um fio, ou é o gatilho). Cada chegada roda de novo (como no n8n). */
function executarNo(m: Motor, rd: Rodada, no: No, ctx: ContextoDoFluxo): void {
  if (m.cortado) return;
  if (++rd.passos > MAXIMO_DE_PASSOS_POR_DISPARO) {
    m.cortado = true;
    m.anotar(
      `${rd.fluxo.nome}: automação cortada, passou de ${MAXIMO_DE_PASSOS_POR_DISPARO} passos num disparo só.`,
    );
    return;
  }
  switch (no.tipo) {
    case "gatilho": {
      // AU3: um gatilho dentro de uma caixa segue os fios da caixa de fora; "gatilho E condição" só segue se as condições valem.
      const condicoes = condicoesDoGatilho(rd.fluxo.nos, no.id);
      const memo = new Map<string, boolean>();
      if (!condicoes.every((c) => valorDoNo(m, rd, c, ctx, memo, new Set()))) break;
      const saida = noDosFios(rd.fluxo.nos, no.id);
      if (rd.seguidas.has(saida)) break; // LP1: outro gatilho da mesma caixa já levou este acontecimento adiante
      rd.seguidas.add(saida);
      seguir(m, rd, saida, "saida", ctx);
      break;
    }
    case "caixa":
      // AU3: uma caixa de ação roda as peças de dentro (E: todas, de cima para baixo; OU: sorteia uma) e segue.
      executarPecaDeAcao(m, rd, no, ctx);
      seguir(m, rd, no.id, "saida", ctx);
      break;
    case "esperar": {
      if (m.slice.esperando.length >= MAXIMO_DE_EXECUCOES_ESPERANDO) {
        m.anotar(`${rd.fluxo.nome}: execuções esperando demais, esta foi cortada.`);
        return;
      }
      m.slice.esperando = [
        ...m.slice.esperando,
        {
          id: m.novoId("esp"),
          ateSala: rd.referenciaSala + no.config.s * 1000,
          profundidade: rd.profundidade,
          fluxoId: rd.fluxo.id,
          no: no.id,
          contexto: ctx,
        },
      ];
      break;
    }
    case "acao":
      aplicarAcao(m, rd, [no.id], no.config.acao, ctx);
      seguir(m, rd, no.id, "saida", ctx);
      break;
    case "sinal":
      if (!m.contar()) return;
      rd.encadeados.push({ nome: no.config.nome, atrasoS: no.config.atrasoS ?? 0, contexto: ctx });
      seguir(m, rd, no.id, "saida", ctx);
      break;
    case "se": {
      const ligada = rd.fluxo.fios.find(
        (x) => x.para.no === no.id && x.para.entrada === "condicao",
      );
      const vale =
        ligada !== undefined && valorDoNo(m, rd, ligada.de.no, ctx, new Map(), new Set());
      // Dentro do "sim" de um "se na cena X", só X vale (quando a condição é a própria condição de cena).
      const condicao = ligada === undefined ? undefined : rd.porId.get(ligada.de.no);
      const novoCtx = vale && condicao?.tipo === "condicao" ? estreitar(ctx, condicao.config) : ctx;
      seguir(m, rd, no.id, vale ? "sim" : "nao", novoCtx);
      break;
    }
    case "sortear":
      seguir(m, rd, no.id, m.sortear(no.config.chance) ? "sim" : "nao", ctx);
      break;
    case "paraCada": {
      const alvo = no.config.alvo;
      const alvos =
        alvo.tipo === "objetos"
          ? objetosDoParaCada(m, alvo, ctx.cenas).map(
              (o): ContextoDoFluxo => ({
                cenas: ctx.cenas,
                objetoId: o.id,
                ...(ctx.zonaId === undefined ? {} : { zonaId: ctx.zonaId }),
              }),
            )
          : tokensDoParaCada(m, alvo, ctx.cenas).map(
              (t): ContextoDoFluxo => ({
                cenas: ctx.cenas,
                tokenId: t.id,
                ...(ctx.zonaId === undefined ? {} : { zonaId: ctx.zonaId }),
              }),
            );
      // Um "esperar" no corpo segura só aquele alvo: o que vem em "depois" não espera por ele.
      for (const c of alvos) {
        if (m.cortado) return;
        seguir(m, rd, no.id, "corpo", c);
      }
      seguir(m, rd, no.id, "depois", ctx);
      break;
    }
    default:
      break;
  }
}

// --- Rodar um disparo ------------------------------------------------------------------------

function contextoDoEvento(ev: EventoDeAutomacao, cenas: Escopo): ContextoDoFluxo {
  return {
    cenas: cenas === null ? null : [...cenas],
    ...(ev.objetoId === undefined ? {} : { objetoId: ev.objetoId }),
    ...(ev.tokenId === undefined ? {} : { tokenId: ev.tokenId }),
    ...(ev.zonaId === undefined ? {} : { zonaId: ev.zonaId }),
  };
}

/** Os gatilhos do fluxo que respondem a este evento (o gatilho, não as cenas). Vários gatilhos formam um OU. */
function gatilhosQueCasam(m: Motor, f: Fluxo, ev: EventoDeAutomacao): NoDe<"gatilho">[] {
  return nosDeGatilho(f).filter((n) => gatilhoCasa(m, n.config, ev));
}

function gatilhoCasa(m: Motor, g: Gatilho, ev: EventoDeAutomacao): boolean {
  if (ev.origem === "sistema") {
    switch (ev.nome) {
      case "objeto.acendeu":
      case "objeto.apagou": {
        if (g.tipo !== "tocha" || g.muda !== (ev.nome === "objeto.acendeu" ? "acende" : "apaga"))
          return false;
        if (g.modelo !== undefined && ev.modeloId !== g.modelo) return false;
        if (g.etiqueta !== undefined) {
          const tags =
            ev.modeloId === undefined
              ? []
              : (m.ctx.atual().modelos.find((x) => x.id === ev.modeloId)?.tags ?? []);
          if (!tags.includes(g.etiqueta)) return false;
        }
        return true;
      }
      case "token.entrouNaZona":
      case "token.saiuDaZona":
        return (
          g.tipo === "zona" &&
          g.quando === (ev.nome === "token.entrouNaZona" ? "entra" : "sai") &&
          (g.zona === undefined || g.zona === ev.zonaId)
        );
      case "turno.inicio":
        return g.tipo === "turno";
      case "cena.ativada":
        return g.tipo === "cena" && (g.cena === undefined || ev.cenas?.includes(g.cena) === true);
      default:
        return false;
    }
  }
  return g.tipo === "sinal" && g.nome === ev.nome;
}

/** Roda um fluxo a partir deste gatilho, seguindo os fios, com este contexto. */
function dispararFluxo(
  m: Motor,
  f: Fluxo,
  inicio: NoDe<"gatilho">,
  ctx: ContextoDoFluxo,
  profundidade: number,
  referenciaSala: number,
  seguidas?: Set<string>,
): Encadeado[] {
  const rd = novaRodada(f, profundidade, referenciaSala, [], seguidas);
  m.slice.ultimaVez[f.id] = m.sala;
  executarNo(m, rd, inicio, ctx);
  return rd.encadeados;
}

/**
 * Depois de rodar o que o evento chamou: os sinais mandados (já, ou marcados para depois) e o que as ações mudaram no jogo
 * (uma tocha que apagou), que também é evento, um nível abaixo.
 */
function fecharDisparo(
  m: Motor,
  antes: Estado,
  encadeados: Encadeado[],
  profundidade: number,
  de: Fluxo[],
): void {
  for (const c of encadeados) {
    if (c.atrasoS > 0) {
      if (m.slice.esperando.length >= MAXIMO_DE_EXECUCOES_ESPERANDO) {
        m.anotar(`Sinal "${c.nome}": execuções esperando demais, este foi cortado.`);
        continue;
      }
      m.slice.esperando = [
        ...m.slice.esperando,
        {
          id: m.novoId("sin"),
          ateSala: m.sala + c.atrasoS * 1000,
          profundidade: profundidade + 1,
          sinal: c.nome,
          ...(de[0] === undefined ? {} : { fluxoId: de[0].id }),
          contexto: c.contexto,
        },
      ];
    } else {
      executarEvento(
        m,
        { nome: c.nome, cenas: c.contexto.cenas, origem: "reacao", ...ctxParaEvento(c.contexto) },
        profundidade + 1,
      );
    }
  }
  for (const s of eventosDoSistema(antes, m.ctx.atual())) executarEvento(m, s, profundidade + 1);
}

function ctxParaEvento(c: ContextoDoFluxo): Partial<EventoDeAutomacao> {
  return {
    ...(c.objetoId === undefined ? {} : { objetoId: c.objetoId }),
    ...(c.tokenId === undefined ? {} : { tokenId: c.tokenId }),
    ...(c.zonaId === undefined ? {} : { zonaId: c.zonaId }),
  };
}

/** Um evento aconteceu (do sistema, ou um sinal): roda os fluxos que o esperam e o que eles encadeiam. */
function executarEvento(m: Motor, ev: EventoDeAutomacao, profundidade: number): void {
  if (m.cortado) return;
  if (profundidade > PROFUNDIDADE_MAXIMA) {
    m.anotar(
      `Encadeamento cortado: "${ev.nome}" passou de ${PROFUNDIDADE_MAXIMA} níveis de sinais.`,
    );
    return;
  }
  const antes = m.ctx.atual();
  const encadeados: Encadeado[] = [];
  const rodados: Fluxo[] = [];
  for (const f of m.slice.fluxos) {
    if (!f.ligado || f.rascunho) continue;
    const inicios = gatilhosQueCasam(m, f, ev);
    if (inicios.length === 0) continue;
    const cenas = escopoDoFluxo(f, ev.cenas, m.ctx.atual().cenaAtivaId);
    if (cenas === "nunca") continue;
    if (m.cortado) return;
    rodados.push(f);
    const seguidas = new Set<string>(); // LP1: uma vez por acontecimento e por caixa de saída
    for (const inicio of inicios) {
      encadeados.push(
        ...dispararFluxo(m, f, inicio, contextoDoEvento(ev, cenas), profundidade, m.sala, seguidas),
      );
    }
  }
  fecharDisparo(m, antes, encadeados, profundidade, rodados);
}

/** Roda um fluxo já, sem esperar o gatilho (o relógio, o botão, o "Testar agora"). */
function executarFluxoDireto(
  m: Motor,
  f: Fluxo,
  ev: EventoDeAutomacao,
  profundidade: number,
  referenciaSala: number,
  inicio: NoDe<"gatilho"> | undefined = noDeDisparoManual(f),
): void {
  if (m.cortado || inicio === undefined) return;
  const antes = m.ctx.atual();
  const cenas = escopoDoFluxo(f, ev.cenas, m.ctx.atual().cenaAtivaId);
  if (cenas === "nunca") return;
  const encadeados = dispararFluxo(
    m,
    f,
    inicio,
    contextoDoEvento(ev, cenas),
    profundidade,
    referenciaSala,
  );
  fecharDisparo(m, antes, encadeados, profundidade, [f]);
}

// ---------------------------------------------------------------------------------------------
// Eventos do sistema (por diferença entre dois estados)
// ---------------------------------------------------------------------------------------------

/**
 * Os eventos que a própria sala produz, achados pela diferença entre o estado de antes e o de depois (assim valem para
 * qualquer intenção, para o tempo que passa e para as ações dos próprios fluxos):
 * - `objeto.acendeu`: o objeto passou a estar aceso (inclusive o que nasceu aceso);
 * - `objeto.apagou`: o objeto aceso apagou, foi consumido ou sumiu;
 * - `cena.ativada`: o grupo foi para outra cena;
 * - `turno.inicio`: a vez passou para outra entrada (ou a rodada virou);
 * - `token.entrouNaZona` e `token.saiuDaZona` (7b-2): o centro do token passou a estar (ou deixou de estar) dentro de uma
 *   zona ligada; vale para mover, colocar, apagar, trocar de cena e tudo o mais, uma vez só por mudança.
 * O escopo é a cena do objeto, da cena nova ou do token da vez.
 */
export function eventosDoSistema(antes: Estado, depois: Estado): EventoDeAutomacao[] {
  const saida: EventoDeAutomacao[] = [];
  const cenaDeObjeto = (o: ObjetoDeLuz, e: Estado) => cenaDoObjeto(o, contextoDeLuz(e));
  for (const l of depois.luzes) {
    const a = antes.luzes.find((x) => x.id === l.id);
    if (l.estado === "acesa" && a?.estado !== "acesa") {
      const cena = cenaDeObjeto(l, depois);
      saida.push({
        nome: "objeto.acendeu",
        cenas: cena === undefined ? [] : [cena],
        origem: "sistema",
        objetoId: l.id,
        ...(l.modeloId === undefined ? {} : { modeloId: l.modeloId }),
      });
    }
  }
  for (const a of antes.luzes) {
    if (a.estado !== "acesa") continue;
    const l = depois.luzes.find((x) => x.id === a.id);
    if (l?.estado === "acesa") continue;
    const cena = cenaDeObjeto(a, antes);
    saida.push({
      nome: "objeto.apagou",
      cenas: cena === undefined ? [] : [cena],
      origem: "sistema",
      objetoId: a.id,
      ...(a.modeloId === undefined ? {} : { modeloId: a.modeloId }),
    });
  }
  if (depois.cenaAtivaId !== antes.cenaAtivaId) {
    saida.push({ nome: "cena.ativada", cenas: [depois.cenaAtivaId], origem: "sistema" });
  }
  const { entrou, saiu } = entradasESaidas(antes, depois);
  for (const [nome, lista] of [
    ["token.entrouNaZona", entrou],
    ["token.saiuDaZona", saiu],
  ] as const) {
    for (const { zona, tokenId } of lista) {
      saida.push({ nome, cenas: [zona.cenaId], origem: "sistema", tokenId, zonaId: zona.id });
    }
  }
  const c = depois.combate;
  if (
    c?.atualId !== undefined &&
    (c.atualId !== antes.combate?.atualId || c.rodada !== antes.combate?.rodada)
  ) {
    const entrada = c.entradas.find((x) => x.id === c.atualId);
    const token =
      entrada?.tokenId === undefined
        ? undefined
        : depois.tokens.find((t) => t.id === entrada.tokenId);
    saida.push({
      nome: "turno.inicio",
      cenas: token ? [token.cenaId] : null,
      origem: "sistema",
      ...(token ? { tokenId: token.id } : {}),
    });
  }
  return saida;
}

// ---------------------------------------------------------------------------------------------
// Os efeitos "enquanto dentro" das zonas (7b-2)
// ---------------------------------------------------------------------------------------------

const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Põe o estado em dia com as zonas: cada luz dentro de uma zona ligada leva o modificador dela (`zona:<zona>`, sem prazo),
 * cada token dentro leva o limite de visão (`zona:<zona>:<token>`). Quem saiu, ou cuja zona foi desligada, apagada ou de
 * outra cena, perde o efeito. É uma RECONCILIAÇÃO (compara o que deve valer com o que está lá), então rodar duas vezes não
 * muda nada e nada fica preso. Cena-cartão não leva os efeitos de visão (não há visão limitada nela).
 */
function sincronizarZonas(m: Motor): void {
  const e = m.ctx.atual();
  const zonas = zonasDe(e);
  const sala = m.sala;
  const comEfeito = (z: Zona) =>
    z.ativa && !z.rascunho && Object.values(z.efeitos).some((v) => v !== undefined);
  // 1. As luzes.
  for (const l of e.luzes) {
    const atuais = l.modificadores.filter((x) => x.id.startsWith(PREFIXO_DE_ZONA));
    const desejados: Modificador[] = [];
    const nomes: string[] = [];
    for (const z of zonas) {
      const { luzRaioX, luzSomaM } = z.efeitos;
      if (!comEfeito(z) || (luzRaioX === undefined && luzSomaM === undefined)) continue;
      if (!objetoNaZona(l, z, e)) continue;
      desejados.push({
        id: `${PREFIXO_DE_ZONA}${z.id}`,
        raioX: luzRaioX ?? 1,
        ...(luzSomaM === undefined ? {} : { raioSomaM: luzSomaM }),
        origem: "automacao",
      });
      nomes.push(z.nome);
    }
    if (atuais.length === 0 && desejados.length === 0) continue;
    const outros = l.modificadores.filter((x) => !x.id.startsWith(PREFIXO_DE_ZONA));
    const cabem = desejados.slice(0, Math.max(0, MAXIMO_DE_MODIFICADORES - outros.length));
    if (JSON.stringify([...atuais].sort(porId)) === JSON.stringify([...cabem].sort(porId)))
      continue;
    const tinha = new Set(atuais.map((x) => x.id));
    const entrou = cabem.some((x) => !tinha.has(x.id));
    const texto = entrou
      ? `Entrou em zona: raio da luz mudou (${nomes.join(", ")})`
      : "Saiu da zona: raio da luz voltou";
    gravarObjeto(
      m,
      comHistorico({ ...l, modificadores: [...outros, ...cabem] }, sala, texto.slice(0, 200)),
    );
  }
  // 2. A visão dos tokens.
  const desejados: Efeito[] = [];
  for (const z of zonas) {
    if (!comEfeito(z) || z.efeitos.visaoMaxM === undefined) continue;
    const cena = e.cenas.find((c) => c.id === z.cenaId);
    if (cena === undefined || cenaEhCartao(cena)) continue;
    for (const t of e.tokens) {
      if (!tokenNaZona(t, z)) continue;
      desejados.push({
        id: `${PREFIXO_DE_ZONA}${z.id}:${t.id}`,
        alvo: { tipo: "token", id: t.id },
        efeito: { visaoMaxM: z.efeitos.visaoMaxM },
        origem: `Zona ${z.nome}`.slice(0, 80),
      });
    }
  }
  const atuais = m.efeitos.filter((x) => x.id.startsWith(PREFIXO_DE_ZONA));
  if (JSON.stringify([...atuais].sort(porId)) === JSON.stringify([...desejados].sort(porId)))
    return;
  const outros = m.efeitos.filter((x) => !x.id.startsWith(PREFIXO_DE_ZONA));
  m.efeitos = [...outros, ...desejados.slice(0, Math.max(0, MAXIMO_DE_EFEITOS - outros.length))];
}

// ---------------------------------------------------------------------------------------------
// O que quem chama usa
// ---------------------------------------------------------------------------------------------

/** Roda um evento (um sinal, ou um do sistema) e tudo o que ele encadeia, e emite o que mudou. */
export function rodarEvento(
  ctx: ContextoDoMotor,
  evento: EventoDeAutomacao,
  profundidade = 0,
): void {
  const m = new Motor(ctx);
  executarEvento(m, evento, profundidade);
  m.fechar();
}

/**
 * O tempo passou ou algo aconteceu (chamada pelo `processar` e pelo alarme): reage aos eventos do sistema achados entre
 * `antes` e agora (se `antes` vier) e, com a mesa rodando, avança os relógios dos fluxos, tira os efeitos vencidos e
 * retoma as execuções esperando que chegaram na hora. Mesa pausada: só os eventos do sistema.
 */
export function rodarAutomacoes(ctx: ContextoDoMotor, antes?: Estado): void {
  const inicial = ctx.atual();
  if (antes === undefined && inicial.relogio.pausada) return;
  const m = new Motor(ctx);
  if (antes !== undefined) {
    for (const s of eventosDoSistema(antes, inicial)) executarEvento(m, s, 0);
  }
  if (!ctx.atual().relogio.pausada) avancar(m);
  sincronizarZonas(m);
  m.fechar();
}

/** Só avança o tempo (relógios, execuções esperando, efeitos vencidos): o que o alarme faz. Mesa pausada: nada. */
export function avancarAutomacoes(ctx: ContextoDoMotor): void {
  rodarAutomacoes(ctx);
}

/** Só reage ao que mudou entre `antes` e agora (os eventos do sistema), sem avançar o tempo. */
export function reagirAoSistema(ctx: ContextoDoMotor, antes: Estado): void {
  const m = new Motor(ctx);
  for (const s of eventosDoSistema(antes, ctx.atual())) executarEvento(m, s, 0);
  sincronizarZonas(m);
  m.fechar();
}

function retomar(m: Motor, p: Esperando): void {
  if (p.sinal !== undefined) {
    const c = p.contexto;
    executarEvento(
      m,
      { nome: p.sinal, cenas: c.cenas, origem: "reacao", ...ctxParaEvento(c) },
      p.profundidade,
    );
    return;
  }
  const f = m.slice.fluxos.find((x) => x.id === p.fluxoId);
  if (!f?.ligado || f.rascunho || p.no === undefined) return;
  const parado = f.nos.find((n) => n.id === p.no);
  if (parado === undefined) return;
  const antes = m.ctx.atual();
  const rd = novaRodada(f, p.profundidade, p.ateSala);
  seguir(m, rd, parado.id, "saida", p.contexto);
  fecharDisparo(m, antes, rd.encadeados, p.profundidade, [f]);
}

function avancar(m: Motor): void {
  const sala = m.sala;
  // 1. Os efeitos que venceram saem (o agendador acorda a sala no instante do primeiro).
  m.efeitos = m.efeitos.filter((e) => e.ateSala === undefined || e.ateSala > sala);
  // 2. As execuções esperando que chegaram na hora.
  const vencidos = m.slice.esperando
    .filter((p) => p.ateSala <= sala)
    .sort((a, b) => a.ateSala - b.ateSala);
  if (vencidos.length > 0) {
    m.slice.esperando = m.slice.esperando.filter((p) => p.ateSala > sala);
    for (const p of vencidos) {
      retomar(m, p);
      if (m.cortado) return;
    }
  }
  // 3. Os fluxos de relógio que rodam.
  for (const f of m.slice.fluxos) {
    const noRelogio = noDeGatilhoDoTipo(f, "relogio");
    if (f.rascunho || !f.ligado || noRelogio?.config.tipo !== "relogio") continue;
    const g = noRelogio.config;
    let exec = m.slice.execucao[f.id];
    if (exec === undefined) {
      // Fluxo que ainda não começou (veio de um arquivo, ou foi criado com a mesa pausada): começa agora.
      exec = { baseSala: sala, proximoTau: (g.primeiroS ?? 0) * 1000 };
      m.slice.execucao[f.id] = exec;
    }
    if (exec.pausadoEmTau !== undefined) continue;
    const tau = tauDoFluxo(exec, sala);
    let disparos = 0;
    while (exec.proximoTau <= tau) {
      const planejado = exec.baseSala + exec.proximoTau;
      exec.proximoTau += g.cadaS * 1000;
      if (++disparos > MAXIMO_DE_DISPAROS_ATRASADOS) {
        exec.proximoTau = (Math.floor(tau / (g.cadaS * 1000)) + 1) * g.cadaS * 1000;
        m.anotar(`${f.nome}: disparos demais atrasados, o resto foi pulado.`);
        break;
      }
      executarFluxoDireto(
        m,
        f,
        { nome: f.id, cenas: null, origem: "ciclo" },
        0,
        planejado,
        noRelogio,
      );
      if (m.cortado) return;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// As intenções de automação (CRUD dos fluxos, ligar e desligar, disparar)
// ---------------------------------------------------------------------------------------------

const SEM_FLUXO = "Automação não encontrada.";

/**
 * `botao.usar` vira a intenção de verdade (`fluxo.disparar` ou `fluxo.ligar`). O mestre usa qualquer botão; o jogador só os
 * liberados, e a conferência é feita aqui, a cada clique. Botão que não existe ou não está liberado dá o mesmo erro (o
 * jogador não descobre o que há por trás).
 */
export function intencaoDoBotao(
  e: Estado,
  intencao: Extract<Intencao, { tipo: "botao.usar" }>,
  mestre: boolean,
): { intencao: Intencao } | { erro: ErroDaSala } {
  const recusa = erro("sem_permissao", "Este botão não está liberado.");
  const { botaoId, acao } = intencao.dados;
  const a = automacoesDe(e);
  const naoLibera = (f: Fluxo) =>
    !mestre && (f.liberadoParaJogadores !== true || f.rascunho === true);
  const relogio = a.fluxos.find(
    (f) => temGatilho(f, "relogio") && idDoBotaoDeCiclo(f.id) === botaoId,
  );
  if (relogio) {
    if (naoLibera(relogio)) return recusa;
    const quer = acao ?? "disparar";
    if (quer === "disparar") {
      return {
        intencao: { ...intencao, tipo: "fluxo.disparar", dados: { id: relogio.id } } as Intencao,
      };
    }
    return {
      intencao: {
        ...intencao,
        tipo: "fluxo.ligar",
        dados: { id: relogio.id, ligado: quer === "retomar" },
      } as Intencao,
    };
  }
  const botao = a.fluxos.find((f) => temGatilho(f, "botao") && idDoBotaoDeEvento(f.id) === botaoId);
  if (botao) {
    if (naoLibera(botao) || (!mestre && !botao.ligado)) return recusa;
    return {
      intencao: { ...intencao, tipo: "fluxo.disparar", dados: { id: botao.id } } as Intencao,
    };
  }
  return recusa;
}

/** O que existe na mesa, para conferir as referências de um fluxo. */
export function referenciasDaMesa(e: Estado): ReferenciasDaMesa {
  return {
    cenas: new Set(e.cenas.map((c) => c.id)),
    modelos: new Set(e.modelos.map((x) => x.id)),
    zonas: new Set(zonasDe(e).map((z) => z.id)),
    sons: new Set((e.assets ?? []).filter((x) => x.tipo === "som").map((x) => x.hash)),
  };
}

function semIndefinidos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function tratarAutomacao(ctx: ContextoDoMotor, intencao: Intencao): SaidaDeAutomacao {
  const e = ctx.atual();
  const m = new Motor(ctx);
  const sala = m.sala;
  const fluxoDe = (id: string) => m.slice.fluxos.find((f) => f.id === id);
  const conferir = (f: Fluxo): { erro: ErroDaSala } | null => {
    const p = problemasDoFluxo(f, referenciasDaMesa(e))[0];
    return p ? erro("dados_invalidos", p.mensagem) : null;
  };
  const esquecer = (id: string) => {
    delete m.slice.execucao[id];
    m.slice.esperando = m.slice.esperando.filter((x) => x.fluxoId !== id || x.sinal !== undefined);
  };

  switch (intencao.tipo) {
    case "fluxo.criar": {
      const { fluxo } = intencao.dados;
      if (fluxoDe(fluxo.id)) return erro("dados_invalidos", "Já existe uma automação com esse id.");
      if (m.slice.fluxos.length >= MAXIMO_DE_FLUXOS)
        return erro("dados_invalidos", "Automações demais.");
      const problema = conferir(fluxo);
      if (problema) return problema;
      m.slice.fluxos = [...m.slice.fluxos, fluxo];
      break;
    }
    case "fluxo.editar": {
      const { id, mudancas } = intencao.dados;
      const atual = fluxoDe(id);
      if (!atual) return erro("fluxo_inexistente", SEM_FLUXO);
      const juntado = FluxoSchema.safeParse({ ...atual, ...semIndefinidos(mudancas), id });
      if (!juntado.success) {
        return erro("dados_invalidos", juntado.error.issues[0]?.message ?? "Automação inválida.");
      }
      const novo = juntado.data;
      const problema = conferir(novo);
      if (problema) return problema;
      m.slice.fluxos = m.slice.fluxos.map((f) => (f.id === id ? novo : f));
      if (
        JSON.stringify(novo.nos.map((n) => [n.id, n.tipo, n.config, n.em])) !==
          JSON.stringify(atual.nos.map((n) => [n.id, n.tipo, n.config, n.em])) ||
        JSON.stringify(novo.fios) !== JSON.stringify(atual.fios)
      ) {
        esquecer(id);
      } else if (novo.ligado !== atual.ligado) {
        ligarOuDesligar(m, novo, sala);
      }
      break;
    }
    case "fluxo.apagar": {
      const { id } = intencao.dados;
      if (!fluxoDe(id)) return erro("fluxo_inexistente", SEM_FLUXO);
      m.slice.fluxos = m.slice.fluxos.filter((f) => f.id !== id);
      delete m.slice.ultimaVez[id];
      esquecer(id);
      break;
    }
    case "fluxo.ligar": {
      const { id, ligado } = intencao.dados;
      const f = fluxoDe(id);
      if (!f) return erro("fluxo_inexistente", SEM_FLUXO);
      if (f.ligado === ligado) break;
      const novo = { ...f, ligado };
      m.slice.fluxos = m.slice.fluxos.map((x) => (x.id === id ? novo : x));
      ligarOuDesligar(m, novo, sala);
      break;
    }
    case "fluxo.disparar": {
      const { id } = intencao.dados;
      const f = fluxoDe(id);
      if (!f) return erro("fluxo_inexistente", SEM_FLUXO);
      const botao = noDeDisparoManual(f)?.config;
      const cena = botao?.tipo === "botao" ? botao.cena : undefined;
      executarFluxoDireto(
        m,
        f,
        { nome: f.id, cenas: cena === undefined ? null : [cena], origem: "manual" },
        0,
        m.sala,
      );
      break;
    }
    default:
      return erro("dados_invalidos", "Intenção de automação desconhecida.");
  }
  m.fechar();
  return {};
}

/** Desligar congela o relógio e cancela o que estava esperando; ligar volta de onde parou. */
function ligarOuDesligar(m: Motor, f: Fluxo, sala: number): void {
  const exec = m.slice.execucao[f.id];
  if (!f.ligado) {
    m.slice.esperando = m.slice.esperando.filter(
      (x) => x.fluxoId !== f.id || x.sinal !== undefined,
    );
    if (exec !== undefined && exec.pausadoEmTau === undefined) {
      m.slice.execucao[f.id] = { ...exec, pausadoEmTau: tauDoFluxo(exec, sala) };
    }
    return;
  }
  if (exec?.pausadoEmTau !== undefined) {
    m.slice.execucao[f.id] = { baseSala: sala - exec.pausadoEmTau, proximoTau: exec.proximoTau };
  }
}
