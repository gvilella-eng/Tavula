import {
  type Acao,
  type Automacoes,
  type CondicaoDeReacao,
  EVENTOS_DO_SISTEMA,
  ehEventoDoSistema,
  nomeDoEvento,
  type Reacao,
} from "@tabletop/shared";

// Ajudas do editor das automações (7b-3): o rascunho é um objeto no formato do schema, editado por caminho.

export type Caminho = ReadonlyArray<string | number>;

/** Lê um valor do objeto pelo caminho (`undefined` se algum passo não existe). */
export function ler(obj: unknown, caminho: Caminho): unknown {
  let atual: unknown = obj;
  for (const p of caminho) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string | number, unknown>)[p];
  }
  return atual;
}

/** Devolve uma cópia com o valor trocado no caminho; `undefined` tira a chave (ou o item da lista). */
export function definir<T>(obj: T, caminho: Caminho, valor: unknown): T {
  if (caminho.length === 0) return valor as T;
  const [p, ...resto] = caminho as [string | number, ...Array<string | number>];
  const base: Record<string | number, unknown> | unknown[] = Array.isArray(obj)
    ? [...obj]
    : { ...((obj ?? {}) as Record<string, unknown>) };
  const filho = definir((base as Record<string | number, unknown>)[p], resto, valor);
  if (Array.isArray(base)) {
    if (resto.length === 0 && valor === undefined) base.splice(Number(p), 1);
    else base[Number(p)] = filho;
  } else if (filho === undefined && resto.length === 0) {
    delete base[p];
  } else {
    base[p] = filho;
  }
  return base as T;
}

/** Um id curto a partir do nome ("Respiração da Montanha" vira "respiracao-da-montanha"), sem repetir os usados. */
export function idDoNome(nome: string, usados: ReadonlySet<string>, padrao: string): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || padrao;
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Os eventos que o mestre criou (nas fases, nos botões, nas reações e nas ações): a sugestão do campo de evento. */
export function eventosDoMestre(a: Automacoes): string[] {
  const nomes = new Set<string>();
  const ver = (nome: string | undefined) => {
    if (nome && !ehEventoDoSistema(nome)) nomes.add(nome);
  };
  for (const c of a.ciclos) for (const f of c.fases) ver(f.evento);
  for (const b of a.botoes) ver(b.evento);
  for (const r of a.reacoes) {
    ver(r.ao);
    for (const acao of r.fazer) if (acao.acao === "evento.disparar") ver(acao.evento);
  }
  return [...nomes].sort((x, y) => x.localeCompare(y, "pt-BR"));
}

export type EventoEmUso = {
  nome: string;
  /** Quantas reações ouvem este evento. */
  ouvintes: number;
  /** O que o dispara: fases de ciclo, botões e ações de reação. */
  disparadoPor: number;
};

/** Todos os eventos que aparecem em algum lugar, com quem os ouve e quem os dispara; os do sistema primeiro. */
export function eventosEmUso(a: Automacoes): EventoEmUso[] {
  const mapa = new Map<string, EventoEmUso>();
  const pegar = (nome: string) => {
    let e = mapa.get(nome);
    if (!e) {
      e = { nome, ouvintes: 0, disparadoPor: 0 };
      mapa.set(nome, e);
    }
    return e;
  };
  for (const c of a.ciclos) for (const f of c.fases) pegar(f.evento).disparadoPor++;
  for (const b of a.botoes) pegar(b.evento).disparadoPor++;
  for (const r of a.reacoes) {
    pegar(r.ao).ouvintes++;
    for (const acao of r.fazer)
      if (acao.acao === "evento.disparar") pegar(acao.evento).disparadoPor++;
  }
  const ordemDoSistema = (n: string) => (EVENTOS_DO_SISTEMA as readonly string[]).indexOf(n);
  return [...mapa.values()].sort((x, y) => {
    const dx = ordemDoSistema(x.nome);
    const dy = ordemDoSistema(y.nome);
    if (dx >= 0 && dy >= 0) return dx - dy;
    if (dx >= 0) return -1;
    if (dy >= 0) return 1;
    return x.nome.localeCompare(y.nome, "pt-BR");
  });
}

// --- Rótulos das ações e condições (listas fechadas) -----------------------------------------

export const ROTULO_DA_ACAO: Record<Acao["acao"], string> = {
  "luz.modificar": "Mudar o raio da luz",
  "objeto.apagar": "Apagar a luz",
  "objeto.ajustarTempo": "Ajustar o tempo da luz",
  "visao.limitar": "Limitar a visão",
  "chat.anunciar": "Anunciar no chat",
  "token.mostrar": "Mostrar o token",
  "token.ocultar": "Ocultar o token",
  "zona.ativar": "Ligar ou desligar uma zona",
  "evento.disparar": "Disparar outro evento",
};

export const TIPOS_DE_ACAO = Object.keys(ROTULO_DA_ACAO) as Acao["acao"][];

/** A ação nova de cada tipo, com valores que já passam no schema (o mestre ajusta). */
export function acaoPadrao(tipo: Acao["acao"]): Acao {
  switch (tipo) {
    case "luz.modificar":
      return { acao: "luz.modificar", raioX: 0.5, porS: 20 };
    case "objeto.apagar":
      return { acao: "objeto.apagar", chance: 0.3, penalidadeS: 300 };
    case "objeto.ajustarTempo":
      return { acao: "objeto.ajustarTempo", deltaS: -60 };
    case "visao.limitar":
      return { acao: "visao.limitar", alcanceM: 1.5, porS: 30 };
    case "chat.anunciar":
      return { acao: "chat.anunciar", texto: "", para: "todos" };
    case "token.mostrar":
      return { acao: "token.mostrar" };
    case "token.ocultar":
      return { acao: "token.ocultar" };
    case "zona.ativar":
      return { acao: "zona.ativar", ativa: true };
    case "evento.disparar":
      return { acao: "evento.disparar", evento: "" };
  }
}

export const ROTULO_DA_CONDICAO: Record<CondicaoDeReacao["condicao"], string> = {
  chance: "Só com uma chance de",
  tag: "O objeto tem a tag",
  cena: "Está numa destas cenas",
  dentroDaZona: "Está dentro da zona",
};

export const TIPOS_DE_CONDICAO = Object.keys(ROTULO_DA_CONDICAO) as CondicaoDeReacao["condicao"][];

export function condicaoPadrao(tipo: CondicaoDeReacao["condicao"]): CondicaoDeReacao {
  switch (tipo) {
    case "chance":
      return { condicao: "chance", valor: 0.5 };
    case "tag":
      return { condicao: "tag", tag: "chama" };
    case "cena":
      return { condicao: "cena", cenas: [] as unknown as [string] };
    case "dentroDaZona":
      return { condicao: "dentroDaZona" };
  }
}

export const ROTULO_DA_FICA: Record<Reacao["fica"]["tipo"], string> = {
  modelo: "Um modelo de objeto",
  cena: "Uma cena",
  zona: "Uma zona",
  mesa: "A mesa toda",
};

/** A frase curta de uma reação para a lista: "Ao receber Uma luz acendeu: 2 ações". */
export function resumoDaReacao(r: Pick<Reacao, "ao" | "fazer" | "se">): string {
  const acoes = r.fazer.length === 1 ? "1 ação" : `${r.fazer.length} ações`;
  const se =
    r.se.length === 0 ? "" : r.se.length === 1 ? ", 1 condição" : `, ${r.se.length} condições`;
  return `Ao receber "${nomeDoEvento(r.ao)}": ${acoes}${se}`;
}

/** Os segundos como "3 min 20 s" para a contagem das fases (o chip e a lista). */
export function duracaoCurta(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}
