import {
  type Acao,
  type Automacoes,
  automacoesDe,
  BotaoDeEventoSchema,
  type Ciclo,
  CicloSchema,
  cicloRodando,
  DURACAO_PADRAO_S,
  type Efeito,
  type EventoDeAutomacao,
  idDoBotaoDeCiclo,
  idDoBotaoDeEvento,
  MAXIMO_DE_BOTOES,
  MAXIMO_DE_EFEITOS,
  MAXIMO_DE_FASES_ATRASADAS,
  MAXIMO_DO_REGISTRO,
  PROFUNDIDADE_MAXIMA,
  proximaFaseDoCiclo,
  type Reacao,
  ReacaoSchema,
  TETO_DE_ACOES,
  tauDoCiclo,
} from "./automacoes.ts";
import type { FonteDeAleatoriedade } from "./dados.ts";
import type { Estado, Modificador, ObjetoDeLuz, Token } from "./estado.ts";
import { cenaDoObjeto, tokenDoPersonagem } from "./luz.ts";
import { cenaEhCartao } from "./paredes.ts";
import type { CodigoDeErro, Intencao } from "./protocolo.ts";
import { formatarDuracaoCurta, restanteDoObjeto, tempoDaSala } from "./relogio.ts";
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
// O motor das automações (Lote 7b-1, seção 4.11). Puro: não grava nem envia nada. Recebe o estado vivo e
// uma forma de emitir eventos (como as tochas), e tudo o que sorteia usa a fonte de aleatoriedade que
// quem chama passa (a sala usa `crypto`; os testes, uma semente fixa).
//
// Regras: ações de uma lista fechada (`AcaoSchema`); efeito temporário é MODIFICADOR com prazo no tempo da
// sala, nunca o valor base; escopo por cena; encadeamento com limite (`PROFUNDIDADE_MAXIMA`) e teto de ações.
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

/** O objeto de luz da automação: a cena que ele ocupa, ou `null` (guardado na mochila). */
type Escopo = readonly string[] | null;
/**
 * De quem a reação trata: o objeto do evento ou da instância (`id`); `null`: não há objeto. Reação de zona
 * (7b-2) traz a zona (as ações só atingem o que está dentro dela) e, nos eventos `token.entrouNaZona` e
 * `token.saiuDaZona`, o token do evento.
 */
type AlvoDaReacao = { objetoId: string | null; zonaId?: string; tokenId?: string };

function zonaDe(m: Motor, id: string | undefined): Zona | undefined {
  return id === undefined ? undefined : zonasDe(m.ctx.atual()).find((z) => z.id === id);
}

const arred = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

// ---------------------------------------------------------------------------------------------
// O motor
// ---------------------------------------------------------------------------------------------

/**
 * Uma rodada do motor: guarda a fatia de automações e os efeitos num rascunho e só emite o evento
 * `automacoes.alterado` e `efeitos.alterados` no `fechar()`, se mudaram.
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
    this.slice.botoes ??= [];
    this.efeitos = structuredClone(e.efeitos ?? []);
  }

  get sala(): number {
    return tempoDaSala(this.ctx.atual().relogio, this.ctx.agoraMs);
  }

  /** Uma frase para o mestre (só as últimas ficam). */
  anotar(texto: string): void {
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

  /** Um id novo e estável o bastante para um evento pendente. */
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
 * O escopo de cenas em que a reação vale para este evento (regra 4), ou `"nunca"` quando a reação, presa
 * a uma cena, não está entre as do evento.
 */
function escopoDaReacao(m: Motor, r: Reacao, ev: EventoDeAutomacao): Escopo | "nunca" {
  let id: string;
  if (r.fica.tipo === "cena") id = r.fica.id;
  else if (r.fica.tipo === "zona") {
    // A reação de uma zona não responde ao evento de outra zona (o nome do evento é o mesmo).
    if (ev.zonaId !== undefined && ev.zonaId !== r.fica.id) return "nunca";
    const zona = zonaDe(m, r.fica.id);
    if (!zona?.ativa) return "nunca";
    id = zona.cenaId;
  } else return ev.cenas;
  return ev.cenas === null || ev.cenas.includes(id) ? [id] : "nunca";
}

/**
 * De quem a reação trata. Reação de modelo: cada objeto do modelo nas cenas do evento (ou só o objeto do
 * evento, se ele é desse modelo). Reação de cena ou da mesa: o objeto do evento, se houver; senão, ninguém
 * em especial (as ações dizem o alvo).
 */
function alvosDaReacao(m: Motor, r: Reacao, ev: EventoDeAutomacao, cenas: Escopo): AlvoDaReacao[] {
  const luzes = m.ctx.atual().luzes;
  if (r.fica.tipo === "modelo") {
    const modeloId = r.fica.id;
    return luzes
      .filter(
        (l) =>
          l.modeloId === modeloId &&
          (ev.objetoId === undefined || l.id === ev.objetoId) &&
          naEscopo(m, l, cenas),
      )
      .map((l) => ({ objetoId: l.id }));
  }
  const doEvento = {
    objetoId: ev.objetoId ?? null,
    ...(ev.tokenId !== undefined && ev.zonaId !== undefined ? { tokenId: ev.tokenId } : {}),
  };
  if (r.fica.tipo === "zona") return [{ ...doEvento, zonaId: r.fica.id }];
  return [doEvento];
}

function condicoesValem(
  m: Motor,
  r: Reacao,
  alvo: AlvoDaReacao,
  cenas: Escopo,
  ev: EventoDeAutomacao,
): boolean {
  const e = m.ctx.atual();
  const objeto = alvo.objetoId === null ? undefined : e.luzes.find((l) => l.id === alvo.objetoId);
  for (const c of r.se) {
    if (c.condicao === "chance") {
      if (!m.sortear(c.valor)) return false;
    } else if (c.condicao === "tag") {
      if (!objeto || !tagsDe(m, objeto).includes(c.tag)) return false;
    } else if (c.condicao === "dentroDaZona") {
      const zona = zonaDe(m, c.zona ?? (r.fica.tipo === "zona" ? r.fica.id : undefined));
      if (!zona?.ativa) return false;
      if (objeto) {
        if (!objetoNaZona(objeto, zona, e)) return false;
      } else {
        const tokenId = alvo.tokenId ?? ev.tokenId;
        const token = tokenId === undefined ? undefined : e.tokens.find((t) => t.id === tokenId);
        if (!token || !tokenNaZona(token, zona)) return false;
      }
    } else {
      const cena = objeto ? cenaDe(m, objeto) : cenas?.length === 1 ? cenas[0] : undefined;
      if (cena === undefined || !c.cenas.includes(cena)) return false;
    }
  }
  return true;
}

function objetosAlvo(
  m: Motor,
  alvo: { modeloId?: string | undefined; tag?: string | undefined } | undefined,
  ctx: AlvoDaReacao,
  cenas: Escopo,
): ObjetoDeLuz[] {
  const e = m.ctx.atual();
  const luzes = e.luzes;
  // Reação de zona: só o que está dentro dela.
  const zona = zonaDe(m, ctx.zonaId);
  const dentro = (l: ObjetoDeLuz) => zona === undefined || objetoNaZona(l, zona, e);
  if (alvo !== undefined) {
    return luzes.filter(
      (l) =>
        naEscopo(m, l, cenas) &&
        dentro(l) &&
        (alvo.modeloId === undefined || l.modeloId === alvo.modeloId) &&
        (alvo.tag === undefined || tagsDe(m, l).includes(alvo.tag)),
    );
  }
  if (ctx.objetoId !== null) {
    const o = luzes.find((l) => l.id === ctx.objetoId);
    return o ? [o] : [];
  }
  return luzes.filter((l) => naEscopo(m, l, cenas) && dentro(l));
}

function tokensAlvo(
  m: Motor,
  alvo: { ids?: string[] | undefined } | undefined,
  ctx: AlvoDaReacao,
  cenas: Escopo,
): Token[] {
  const e = m.ctx.atual();
  const zona = zonaDe(m, ctx.zonaId);
  const nasCenas = (t: Token) =>
    (cenas === null || cenas.includes(t.cenaId)) && (zona === undefined || tokenNaZona(t, zona));
  if (alvo?.ids !== undefined) {
    const ids = alvo.ids;
    return e.tokens.filter((t) => ids.includes(t.id) && nasCenas(t));
  }
  if (ctx.tokenId !== undefined) {
    // O token do evento (entrou ou saiu): para quem saiu, a zona já não o tem dentro; vale mesmo assim.
    const id = ctx.tokenId;
    return e.tokens.filter((t) => t.id === id && (cenas === null || cenas.includes(t.cenaId)));
  }
  if (ctx.objetoId !== null) {
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
    return [];
  }
  return e.tokens.filter(nasCenas);
}

// --- Aplicar as ações ------------------------------------------------------------------------

type Encadeado = { evento: EventoDeAutomacao; atrasoS: number };

function semDesde(o: ObjetoDeLuz): ObjetoDeLuz {
  const { acesaDesdeSala: _desde, ...resto } = o;
  return resto;
}

function gravarObjeto(m: Motor, o: ObjetoDeLuz): void {
  m.ctx.emitir({ tipo: "fonte.editada", dados: { fonte: o } });
}

function aplicarAcao(
  m: Motor,
  r: Reacao,
  indice: number,
  acao: Acao,
  alvo: AlvoDaReacao,
  ev: EventoDeAutomacao,
  cenas: Escopo,
  encadeados: Encadeado[],
): void {
  const sala = m.sala;
  switch (acao.acao) {
    case "luz.modificar": {
      const prazoMs = (acao.porS ?? ev.duracaoS ?? DURACAO_PADRAO_S) * 1000;
      const id = `auto:${r.id}:${indice}`;
      for (const o of objetosAlvo(m, acao.alvo, alvo, cenas)) {
        if (!m.contar()) return;
        // O mesmo efeito de novo renova o prazo (não empilha): o refresh nunca deixa nada preso.
        const outros = o.modificadores.filter((x) => x.id !== id);
        if (outros.length >= MAXIMO_DE_MODIFICADORES) {
          m.anotar(`Modificadores demais em "${o.nome}": ${r.nome ?? r.id} não entrou.`);
          continue;
        }
        const novo: Modificador = {
          id,
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
      }
      return;
    }
    case "objeto.apagar": {
      for (const o of objetosAlvo(m, acao.alvo, alvo, cenas)) {
        if (o.estado !== "acesa") continue;
        if (!m.contar()) return;
        if (!m.sortear(acao.chance ?? 1)) continue;
        const restante = restanteDoObjeto(o, sala);
        if (restante === null) {
          gravarObjeto(
            m,
            comHistorico(semDesde({ ...o, estado: "apagada" }), sala, "Apagada (automação)"),
          );
          continue;
        }
        const penalidade = (acao.penalidadeS ?? 0) * 1000;
        const novo = restante - penalidade;
        if (novo <= TOLERANCIA_DO_FIM_MS) {
          m.ctx.emitir({ tipo: "fonte.apagada", dados: { id: o.id } });
          continue;
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
      }
      return;
    }
    case "objeto.ajustarTempo": {
      const deltaMs = acao.deltaS * 1000;
      for (const o of objetosAlvo(m, acao.alvo, alvo, cenas)) {
        const restante = restanteDoObjeto(o, sala);
        if (restante === null) continue;
        if (!m.contar()) return;
        const novo = Math.min(restante + deltaMs, MAXIMO_DO_SALDO_MS);
        if (novo <= TOLERANCIA_DO_FIM_MS) {
          m.ctx.emitir({ tipo: "fonte.apagada", dados: { id: o.id } });
          continue;
        }
        const sinal = deltaMs < 0 ? "−" : "+";
        const base: ObjetoDeLuz = { ...o, saldoMs: novo };
        // Acesa: a contagem recomeça agora, do que sobrou mais o ajuste (como o ajuste do mestre).
        const rebase: ObjetoDeLuz = o.estado === "acesa" ? { ...base, acesaDesdeSala: sala } : base;
        gravarObjeto(
          m,
          comHistorico(
            rebase,
            sala,
            `${sinal}${formatarDuracaoCurta(deltaMs)} (automação)`,
            deltaMs,
          ),
        );
      }
      return;
    }
    case "visao.limitar": {
      const prazoMs = (acao.porS ?? ev.duracaoS ?? DURACAO_PADRAO_S) * 1000;
      for (const t of tokensAlvo(m, acao.alvo, alvo, cenas)) {
        if (!m.contar()) return;
        const id = `auto:${r.id}:${indice}:${t.id}`;
        const novo: Efeito = {
          id,
          alvo: { tipo: "token", id: t.id },
          efeito: { visaoMaxM: acao.alcanceM },
          ateSala: sala + prazoMs,
          origem: (r.nome ?? r.id).slice(0, 80),
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
    case "token.mostrar":
    case "token.ocultar": {
      const oculto = acao.acao === "token.ocultar";
      for (const t of tokensAlvo(m, acao.alvo, alvo, cenas)) {
        if (t.oculto === oculto) continue;
        if (!m.contar()) return;
        m.ctx.emitir({ tipo: "token.editado", dados: { token: { ...t, oculto } } });
      }
      return;
    }
    case "zona.ativar": {
      const zona = zonaDe(m, acao.zona ?? alvo.zonaId);
      if (!zona) {
        m.anotar(`${r.nome ?? r.id}: a zona da ação não existe mais.`);
        return;
      }
      if (zona.ativa === acao.ativa) return;
      if (!m.contar()) return;
      m.ctx.emitir({ tipo: "zona.alterada", dados: { zona: { ...zona, ativa: acao.ativa } } });
      return;
    }
    case "evento.disparar": {
      if (!m.contar()) return;
      encadeados.push({
        atrasoS: acao.atrasoS ?? 0,
        evento: {
          nome: acao.evento,
          cenas: cenas === null ? null : [...cenas],
          origem: "reacao",
          ...(alvo.objetoId === null ? {} : { objetoId: alvo.objetoId }),
        },
      });
      return;
    }
  }
}

// --- Rodar um evento -------------------------------------------------------------------------

function executar(m: Motor, ev: EventoDeAutomacao, profundidade: number): void {
  if (m.cortado) return;
  if (profundidade > PROFUNDIDADE_MAXIMA) {
    m.anotar(
      `Encadeamento cortado: "${ev.nome}" passou de ${PROFUNDIDADE_MAXIMA} níveis de reação.`,
    );
    return;
  }
  const antes = m.ctx.atual();
  const encadeados: Encadeado[] = [];
  for (const r of m.slice.reacoes) {
    if (!r.ativa || r.rascunho || r.ao !== ev.nome) continue;
    const cenas = escopoDaReacao(m, r, ev);
    if (cenas === "nunca") continue;
    for (const alvo of alvosDaReacao(m, r, ev, cenas)) {
      if (m.cortado) return;
      if (!condicoesValem(m, r, alvo, cenas, ev)) continue;
      for (const [i, acao] of r.fazer.entries()) {
        aplicarAcao(m, r, i, acao, alvo, ev, cenas, encadeados);
      }
    }
  }
  for (const c of encadeados) {
    if (c.atrasoS > 0) {
      m.slice.pendentes = [
        ...m.slice.pendentes,
        {
          id: m.novoId("pend"),
          ateSala: m.sala + c.atrasoS * 1000,
          evento: c.evento,
          profundidade: profundidade + 1,
        },
      ].slice(-200);
    } else executar(m, c.evento, profundidade + 1);
  }
  // O que as ações mudaram no jogo (uma tocha que apagou) também é evento, um nível abaixo.
  for (const s of eventosDoSistema(antes, m.ctx.atual())) executar(m, s, profundidade + 1);
}

// ---------------------------------------------------------------------------------------------
// Eventos do sistema (por diferença entre dois estados)
// ---------------------------------------------------------------------------------------------

/**
 * Os eventos que a própria sala produz, achados pela diferença entre o estado de antes e o de depois
 * (assim valem para qualquer intenção, para o tempo que passa e para as ações das próprias reações):
 * - `objeto.acendeu`: o objeto passou a estar aceso (inclusive o que nasceu aceso);
 * - `objeto.apagou`: o objeto aceso apagou, foi consumido ou sumiu;
 * - `cena.ativada`: o grupo foi para outra cena;
 * - `turno.inicio`: a vez passou para outra entrada (ou a rodada virou);
 * - `token.entrouNaZona` e `token.saiuDaZona` (7b-2): o centro do token passou a estar (ou deixou de estar) dentro
 *   de uma zona ligada; vale para mover, colocar, apagar, trocar de cena e tudo o mais, uma vez só por mudança.
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
 * Põe o estado em dia com as zonas: cada luz dentro de uma zona ligada leva o modificador dela
 * (`zona:<zona>`, sem prazo), cada token dentro leva o limite de visão (`zona:<zona>:<token>`). Quem saiu, ou
 * cuja zona foi desligada, apagada ou de outra cena, perde o efeito. É uma RECONCILIAÇÃO (compara o que deve
 * valer com o que está lá), então rodar duas vezes não muda nada e nada fica preso. Cena-cartão não leva
 * os efeitos de visão (não há visão limitada nela).
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

/** Roda um evento (e tudo o que ele encadeia) e emite o que mudou. */
export function rodarEvento(
  ctx: ContextoDoMotor,
  evento: EventoDeAutomacao,
  profundidade = 0,
): void {
  const m = new Motor(ctx);
  executar(m, evento, profundidade);
  m.fechar();
}

/**
 * O tempo passou ou algo aconteceu (chamada pelo `processar` e pelo alarme): reage aos eventos do sistema
 * achados entre `antes` e agora (se `antes` vier) e, com a mesa rodando, avança os ciclos, tira os efeitos
 * vencidos e dispara os eventos pendentes que chegaram na hora. Mesa pausada: só os eventos do sistema.
 */
export function rodarAutomacoes(ctx: ContextoDoMotor, antes?: Estado): void {
  const inicial = ctx.atual();
  if (antes === undefined && inicial.relogio.pausada) return;
  const m = new Motor(ctx);
  if (antes !== undefined) {
    for (const s of eventosDoSistema(antes, inicial)) executar(m, s, 0);
  }
  if (!ctx.atual().relogio.pausada) avancar(m);
  sincronizarZonas(m);
  m.fechar();
}

/** Só avança o tempo (ciclos, pendentes, efeitos vencidos): o que o alarme faz. Mesa pausada: nada. */
export function avancarAutomacoes(ctx: ContextoDoMotor): void {
  rodarAutomacoes(ctx);
}

/** Só reage ao que mudou entre `antes` e agora (os eventos do sistema), sem avançar o tempo. */
export function reagirAoSistema(ctx: ContextoDoMotor, antes: Estado): void {
  const m = new Motor(ctx);
  for (const s of eventosDoSistema(antes, ctx.atual())) executar(m, s, 0);
  sincronizarZonas(m);
  m.fechar();
}

function avancar(m: Motor): void {
  const sala = m.sala;
  // 1. Os efeitos que venceram saem (o agendador acorda a sala no instante do primeiro).
  m.efeitos = m.efeitos.filter((e) => e.ateSala === undefined || e.ateSala > sala);
  // 2. Os eventos marcados para esta hora.
  const vencidos = m.slice.pendentes
    .filter((p) => p.ateSala <= sala)
    .sort((a, b) => a.ateSala - b.ateSala);
  if (vencidos.length > 0) {
    m.slice.pendentes = m.slice.pendentes.filter((p) => p.ateSala > sala);
    for (const p of vencidos) executar(m, p.evento, p.profundidade);
  }
  // 3. As fases dos ciclos que rodam.
  for (const c of m.slice.ciclos) {
    // 12-1: o ciclo em rascunho não roda (e nem ganha execução: ao publicar, ele começa dali).
    if (c.rascunho) continue;
    let exec = m.slice.execucao[c.id];
    if (exec === undefined) {
      // Ciclo que ainda não começou (veio de um arquivo, ou foi criado com a mesa pausada): começa agora.
      exec = { baseSala: sala, disparadoAteTau: -1 };
      m.slice.execucao[c.id] = exec;
    }
    if (!cicloRodando(exec)) continue;
    const tau = tauDoCiclo(exec, sala);
    let disparadas = 0;
    for (;;) {
      const proxima = proximaFaseDoCiclo(c, exec.disparadoAteTau);
      if (!proxima || proxima.tauMs > tau) break;
      if (++disparadas > MAXIMO_DE_FASES_ATRASADAS) {
        exec.disparadoAteTau = tau;
        m.anotar(`Ciclo "${c.nome}": fases demais atrasadas, o resto foi pulado.`);
        break;
      }
      exec.disparadoAteTau = proxima.tauMs;
      executar(m, eventoDaFase(c, proxima.fase), 0);
      if (m.cortado) return;
    }
  }
}

function eventoDaFase(c: Ciclo, fase: Ciclo["fases"][number]): EventoDeAutomacao {
  return {
    nome: fase.evento,
    cenas: c.cenas.length === 0 ? null : [...c.cenas],
    origem: "ciclo",
    ...(fase.duracaoS === undefined ? {} : { duracaoS: fase.duracaoS }),
  };
}

// ---------------------------------------------------------------------------------------------
// As intenções de automação (CRUD, controle dos ciclos e o evento manual)
// ---------------------------------------------------------------------------------------------

const SEM_CICLO = "Ciclo não encontrado.";
const SEM_REACAO = "Reação não encontrada.";
const SEM_BOTAO = "Botão não encontrado.";

/**
 * `botao.usar` vira a intenção de verdade (`ciclo.disparar`, `ciclo.pausar`, `ciclo.retomar` ou `evento.disparar`). O
 * mestre usa qualquer botão; o jogador só os liberados, e a conferência é feita aqui, a cada clique. Botão que não existe
 * ou não está liberado dá o mesmo erro (o jogador não descobre o que há por trás).
 */
export function intencaoDoBotao(
  e: Estado,
  intencao: Extract<Intencao, { tipo: "botao.usar" }>,
  mestre: boolean,
): { intencao: Intencao } | { erro: ErroDaSala } {
  const recusa = erro("sem_permissao", "Este botão não está liberado.");
  const { botaoId, acao } = intencao.dados;
  const a = automacoesDe(e);
  const ciclo = a.ciclos.find((c) => idDoBotaoDeCiclo(c.id) === botaoId);
  if (ciclo) {
    if (!mestre && (ciclo.liberadoParaJogadores !== true || ciclo.rascunho === true)) return recusa;
    const tipo = { disparar: "ciclo.disparar", pausar: "ciclo.pausar", retomar: "ciclo.retomar" }[
      acao ?? "disparar"
    ] as "ciclo.disparar";
    return { intencao: { ...intencao, tipo, dados: { id: ciclo.id } } as Intencao };
  }
  const botao = (a.botoes ?? []).find((b) => idDoBotaoDeEvento(b.id) === botaoId);
  if (botao) {
    if (!mestre && (botao.liberadoParaJogadores !== true || botao.rascunho === true)) return recusa;
    return {
      intencao: {
        ...intencao,
        tipo: "evento.disparar",
        dados: {
          evento: botao.evento,
          ...(botao.cenaId === undefined ? {} : { cenaId: botao.cenaId }),
        },
      } as Intencao,
    };
  }
  return recusa;
}

function cenasExistem(e: Estado, ids: readonly string[]): boolean {
  return ids.every((id) => e.cenas.some((c) => c.id === id));
}

/** O ciclo mudou de período ou de fases: a execução recomeça (mantendo o ciclo pausado, se estava). */
function reiniciar(m: Motor, id: string): void {
  const antiga = m.slice.execucao[id];
  delete m.slice.execucao[id];
  if (antiga !== undefined && !cicloRodando(antiga)) {
    m.slice.execucao[id] = { baseSala: m.sala, pausadoEmTau: 0, disparadoAteTau: -1 };
  }
}

export function tratarAutomacao(ctx: ContextoDoMotor, intencao: Intencao): SaidaDeAutomacao {
  const e = ctx.atual();
  const m = new Motor(ctx);
  const sala = m.sala;
  const cicloDe = (id: string) => m.slice.ciclos.find((c) => c.id === id);

  switch (intencao.tipo) {
    case "ciclo.criar": {
      const { ciclo, pausado } = intencao.dados;
      if (cicloDe(ciclo.id)) return erro("dados_invalidos", "Já existe um ciclo com esse id.");
      if (m.slice.ciclos.length >= 50) return erro("dados_invalidos", "Ciclos demais.");
      if (!cenasExistem(e, ciclo.cenas)) return erro("cena_inexistente", "Cena não encontrada.");
      m.slice.ciclos = [...m.slice.ciclos, ciclo];
      if (pausado) {
        m.slice.execucao[ciclo.id] = { baseSala: sala, pausadoEmTau: 0, disparadoAteTau: -1 };
      }
      break;
    }
    case "ciclo.editar": {
      const { id, mudancas } = intencao.dados;
      const atual = cicloDe(id);
      if (!atual) return erro("ciclo_inexistente", SEM_CICLO);
      const juntado = CicloSchema.safeParse({ ...atual, ...mudancas, id });
      if (!juntado.success) {
        return erro("dados_invalidos", juntado.error.issues[0]?.message ?? "Ciclo inválido.");
      }
      const novo = juntado.data;
      if (!cenasExistem(e, novo.cenas)) return erro("cena_inexistente", "Cena não encontrada.");
      m.slice.ciclos = m.slice.ciclos.map((c) => (c.id === id ? novo : c));
      if (
        novo.periodoS !== atual.periodoS ||
        JSON.stringify(novo.fases) !== JSON.stringify(atual.fases)
      ) {
        reiniciar(m, id);
      }
      break;
    }
    case "ciclo.apagar": {
      const { id } = intencao.dados;
      if (!cicloDe(id)) return erro("ciclo_inexistente", SEM_CICLO);
      m.slice.ciclos = m.slice.ciclos.filter((c) => c.id !== id);
      delete m.slice.execucao[id];
      break;
    }
    case "ciclo.pausar": {
      const { id } = intencao.dados;
      if (!cicloDe(id)) return erro("ciclo_inexistente", SEM_CICLO);
      const exec = m.slice.execucao[id] ?? { baseSala: sala, disparadoAteTau: -1 };
      if (cicloRodando(exec)) {
        m.slice.execucao[id] = { ...exec, pausadoEmTau: tauDoCiclo(exec, sala) };
      }
      break;
    }
    case "ciclo.retomar": {
      const { id } = intencao.dados;
      if (!cicloDe(id)) return erro("ciclo_inexistente", SEM_CICLO);
      const exec = m.slice.execucao[id];
      if (exec?.pausadoEmTau !== undefined) {
        // O ciclo volta de onde parou: o tempo dele não andou enquanto esteve pausado.
        m.slice.execucao[id] = {
          baseSala: sala - exec.pausadoEmTau,
          disparadoAteTau: exec.disparadoAteTau,
        };
      }
      break;
    }
    case "ciclo.disparar": {
      const { id } = intencao.dados;
      const ciclo = cicloDe(id);
      if (!ciclo) return erro("ciclo_inexistente", SEM_CICLO);
      const exec = m.slice.execucao[id] ?? { baseSala: sala, disparadoAteTau: -1 };
      const proxima = proximaFaseDoCiclo(ciclo, exec.disparadoAteTau);
      if (!proxima) return {};
      // O ciclo pula para o começo da fase (ou fica onde está, se já passou dele) e a dispara agora.
      const tau = Math.max(tauDoCiclo(exec, sala), proxima.tauMs);
      m.slice.execucao[id] =
        exec.pausadoEmTau === undefined
          ? { baseSala: sala - tau, disparadoAteTau: proxima.tauMs }
          : { ...exec, pausadoEmTau: tau, disparadoAteTau: proxima.tauMs };
      executar(m, eventoDaFase(ciclo, proxima.fase), 0);
      break;
    }
    case "reacao.criar": {
      const { reacao } = intencao.dados;
      if (m.slice.reacoes.some((r) => r.id === reacao.id)) {
        return erro("dados_invalidos", "Já existe uma reação com esse id.");
      }
      if (m.slice.reacoes.length >= 300) return erro("dados_invalidos", "Reações demais.");
      const problema = problemaDaFica(e, reacao);
      if (problema) return problema;
      m.slice.reacoes = [...m.slice.reacoes, reacao];
      break;
    }
    case "reacao.editar": {
      const { id, mudancas } = intencao.dados;
      const atual = m.slice.reacoes.find((r) => r.id === id);
      if (!atual) return erro("reacao_inexistente", SEM_REACAO);
      const juntada = ReacaoSchema.safeParse({ ...atual, ...semIndefinidos(mudancas), id });
      if (!juntada.success) {
        return erro("dados_invalidos", juntada.error.issues[0]?.message ?? "Reação inválida.");
      }
      const novo = juntada.data;
      const problema = problemaDaFica(e, novo);
      if (problema) return problema;
      m.slice.reacoes = m.slice.reacoes.map((r) => (r.id === id ? novo : r));
      break;
    }
    case "reacao.apagar": {
      const { id } = intencao.dados;
      if (!m.slice.reacoes.some((r) => r.id === id)) return erro("reacao_inexistente", SEM_REACAO);
      m.slice.reacoes = m.slice.reacoes.filter((r) => r.id !== id);
      break;
    }
    case "botao.criar": {
      const { botao } = intencao.dados;
      if (m.slice.botoes.some((b) => b.id === botao.id)) {
        return erro("dados_invalidos", "Já existe um botão com esse id.");
      }
      if (m.slice.botoes.length >= MAXIMO_DE_BOTOES)
        return erro("dados_invalidos", "Botões demais.");
      if (botao.cenaId !== undefined && !e.cenas.some((c) => c.id === botao.cenaId)) {
        return erro("cena_inexistente", "Cena não encontrada.");
      }
      m.slice.botoes = [...m.slice.botoes, botao];
      break;
    }
    case "botao.editar": {
      const { id, mudancas } = intencao.dados;
      const atual = m.slice.botoes.find((b) => b.id === id);
      if (!atual) return erro("dados_invalidos", SEM_BOTAO);
      const { cenaId, ...resto } = semIndefinidos(mudancas);
      const { cenaId: cenaAntiga, ...base } = atual;
      // `cenaId: null` tira a cena do botão (volta a valer em todas); sem o campo, ela fica como estava.
      const cenaNova = mudancas.cenaId === null ? undefined : (cenaId ?? cenaAntiga);
      const juntado = BotaoDeEventoSchema.safeParse({
        ...base,
        ...resto,
        ...(cenaNova === undefined ? {} : { cenaId: cenaNova }),
        id,
      });
      if (!juntado.success) {
        return erro("dados_invalidos", juntado.error.issues[0]?.message ?? "Botão inválido.");
      }
      const novo = juntado.data;
      if (novo.cenaId !== undefined && !e.cenas.some((c) => c.id === novo.cenaId)) {
        return erro("cena_inexistente", "Cena não encontrada.");
      }
      m.slice.botoes = m.slice.botoes.map((b) => (b.id === id ? novo : b));
      break;
    }
    case "botao.apagar": {
      const { id } = intencao.dados;
      if (!m.slice.botoes.some((b) => b.id === id)) return erro("dados_invalidos", SEM_BOTAO);
      m.slice.botoes = m.slice.botoes.filter((b) => b.id !== id);
      break;
    }
    case "evento.disparar": {
      const { evento, cenaId } = intencao.dados;
      if (cenaId !== undefined && !e.cenas.some((c) => c.id === cenaId)) {
        return erro("cena_inexistente", "Cena não encontrada.");
      }
      executar(
        m,
        { nome: evento, cenas: cenaId === undefined ? null : [cenaId], origem: "manual" },
        0,
      );
      break;
    }
    default:
      return erro("dados_invalidos", "Intenção de automação desconhecida.");
  }
  m.fechar();
  return {};
}

function semIndefinidos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** A reação aponta para um modelo ou uma cena que existe? */
function problemaDaFica(e: Estado, r: Reacao): { erro: ErroDaSala } | null {
  if (r.fica.tipo === "modelo") {
    const id = r.fica.id;
    if (!e.modelos.some((x) => x.id === id)) {
      return erro("modelo_inexistente", "Modelo de objeto não encontrado.");
    }
  } else if (r.fica.tipo === "cena") {
    const id = r.fica.id;
    if (!e.cenas.some((x) => x.id === id)) return erro("cena_inexistente", "Cena não encontrada.");
  } else if (r.fica.tipo === "zona") {
    const id = r.fica.id;
    if (!zonasDe(e).some((x) => x.id === id)) {
      return erro("zona_inexistente", "Zona não encontrada.");
    }
  }
  return null;
}
