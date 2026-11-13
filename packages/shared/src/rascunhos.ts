import { z } from "zod";
import type { Automacoes } from "./automacoes.ts";
import type {
  Cena,
  Estado,
  Handout,
  ModeloDeObjeto,
  ObjetoDeLuz,
  Pasta,
  Personagem,
  PontoDeLuz,
  Token,
} from "./estado.ts";
import type { Zona } from "./zonas.ts";

// 12-1: rascunhos do Claude do mestre. O que o Claude do mestre cria entra com `rascunho: true`: o jogador não o
// recebe (nem em snapshot, nem em evento), ciclo e reação em rascunho não rodam, a cena em rascunho não vira a cena
// do grupo. O mestre vê o selo "Rascunho", publica ou descarta. O que o mestre cria pela mesa nunca é rascunho.

/** Os tipos de item que podem ser rascunho. */
export const TIPOS_DE_RASCUNHO = [
  "cena",
  "personagem",
  "handout",
  "pasta",
  "modelo",
  "ponto",
  "luz",
  "token",
  "zona",
  "ciclo",
  "reacao",
  "botao",
] as const;
export type TipoDeRascunho = (typeof TIPOS_DE_RASCUNHO)[number];

export const ItemDeRascunhoSchema = z.object({
  tipo: z.enum(TIPOS_DE_RASCUNHO),
  id: z.string().min(1).max(64),
});
export type ItemDeRascunho = z.infer<typeof ItemDeRascunhoSchema>;
export const MAXIMO_DE_ITENS_POR_PEDIDO = 500;

export const ROTULO_DO_TIPO_DE_RASCUNHO: Record<TipoDeRascunho, string> = {
  cena: "Cena",
  personagem: "Ficha",
  handout: "Handout",
  pasta: "Pasta",
  modelo: "Modelo",
  ponto: "Ponto",
  luz: "Luz",
  token: "Token",
  zona: "Zona",
  ciclo: "Ciclo",
  reacao: "Reação",
  botao: "Botão",
};

export type RascunhoListado = ItemDeRascunho & { nome: string };

type ComMarca = { id: string; rascunho?: boolean | undefined };

/** Todos os itens em rascunho da mesa (o que o chip "Rascunhos do Claude" lista), na ordem dos tipos. */
export function listarRascunhos(e: Estado): RascunhoListado[] {
  const saida: RascunhoListado[] = [];
  const pegar = <T extends ComMarca>(
    tipo: TipoDeRascunho,
    itens: readonly T[],
    nome: (i: T) => string,
  ) => {
    for (const i of itens) if (i.rascunho === true) saida.push({ tipo, id: i.id, nome: nome(i) });
  };
  const a = e.automacoes;
  pegar("cena", e.cenas, (i) => i.nome);
  pegar("pasta", e.pastas, (i) => i.nome);
  pegar("modelo", e.modelos, (i) => i.nome);
  pegar("personagem", e.personagens, (i) => i.nome);
  pegar("handout", e.handouts, (i) => i.titulo);
  pegar("token", e.tokens, (i) => i.nome);
  pegar("ponto", e.pontos, (i) => i.nome);
  pegar("luz", e.luzes, (i) => i.nome);
  pegar("zona", e.zonas ?? [], (i) => i.nome);
  pegar("ciclo", a?.ciclos ?? [], (i) => i.nome);
  pegar("reacao", a?.reacoes ?? [], (i) => i.nome ?? `Reação ao evento ${i.ao}`);
  pegar("botao", a?.botoes ?? [], (i) => i.nome);
  return saida;
}

export function ehRascunho(e: Estado, item: ItemDeRascunho): boolean {
  return listarRascunhos(e).some((r) => r.tipo === item.tipo && r.id === item.id);
}

function semMarca<T extends { rascunho?: boolean | undefined }>(o: T): T {
  const { rascunho: _r, ...resto } = o;
  return resto as T;
}

/** Evento sem `seq` nem `origem` (o que as regras emitem). */
export type EventoDeRascunho = { tipo: string; dados: unknown };

/**
 * Os eventos que publicam os itens (sem os `itens`: todos os rascunhos). Cada item vira o mesmo evento de edição de
 * sempre, já sem a marca; ciclos, reações e botões saem num `automacoes.alterado` só. Item que não está em
 * rascunho é ignorado.
 */
export function eventosDePublicacao(
  e: Estado,
  itens?: readonly ItemDeRascunho[],
): EventoDeRascunho[] {
  const alvo = new Set((itens ?? listarRascunhos(e)).map((i) => `${i.tipo}:${i.id}`));
  const quer = (tipo: TipoDeRascunho, id: string) => alvo.has(`${tipo}:${id}`);
  const saida: EventoDeRascunho[] = [];
  for (const i of e.cenas) {
    if (i.rascunho && quer("cena", i.id)) {
      saida.push({ tipo: "cena.editada", dados: { cena: semMarca(i) } });
    }
  }
  for (const i of e.pastas) {
    if (i.rascunho && quer("pasta", i.id)) {
      saida.push({ tipo: "pasta.alterada", dados: { pasta: semMarca(i) } });
    }
  }
  for (const i of e.modelos) {
    if (i.rascunho && quer("modelo", i.id)) {
      saida.push({ tipo: "modelo.alterado", dados: { modelo: semMarca(i) } });
    }
  }
  for (const i of e.personagens) {
    if (i.rascunho && quer("personagem", i.id)) {
      saida.push({ tipo: "personagem.alterado", dados: { personagem: semMarca(i) } });
    }
  }
  for (const i of e.handouts) {
    if (i.rascunho && quer("handout", i.id)) {
      saida.push({ tipo: "handout.alterado", dados: { handout: semMarca(i) } });
    }
  }
  for (const i of e.tokens) {
    if (i.rascunho && quer("token", i.id)) {
      saida.push({ tipo: "token.editado", dados: { token: semMarca(i) } });
    }
  }
  for (const i of e.pontos) {
    if (i.rascunho && quer("ponto", i.id)) {
      saida.push({ tipo: "ponto.alterado", dados: { ponto: semMarca(i) } });
    }
  }
  for (const i of e.luzes) {
    if (i.rascunho && quer("luz", i.id)) {
      saida.push({ tipo: "fonte.editada", dados: { fonte: semMarca(i) } });
    }
  }
  for (const i of e.zonas ?? []) {
    if (i.rascunho && quer("zona", i.id)) {
      saida.push({ tipo: "zona.alterada", dados: { zona: semMarca(i) } });
    }
  }
  const a = e.automacoes;
  if (a) {
    const tira = <T extends ComMarca>(tipo: TipoDeRascunho, lista: readonly T[]) =>
      lista.map((i) => (i.rascunho && quer(tipo, i.id) ? semMarca(i) : i));
    const novo = {
      ...a,
      ciclos: tira("ciclo", a.ciclos),
      reacoes: tira("reacao", a.reacoes),
      botoes: tira("botao", a.botoes),
    };
    if (JSON.stringify(novo) !== JSON.stringify(a)) {
      saida.push({ tipo: "automacoes.alterado", dados: { automacoes: novo } });
    }
  }
  return saida;
}

/** A intenção que apaga cada tipo de item (o descarte reaproveita as regras de apagar). */
export function intencaoDeDescarte(item: ItemDeRascunho): {
  tipo: string;
  dados: Record<string, string>;
} {
  switch (item.tipo) {
    case "cena":
      return { tipo: "cena.apagar", dados: { cenaId: item.id } };
    case "personagem":
      return { tipo: "personagem.apagar", dados: { id: item.id } };
    case "handout":
      return { tipo: "handout.apagar", dados: { id: item.id } };
    case "pasta":
      return { tipo: "pasta.apagar", dados: { id: item.id } };
    case "modelo":
      return { tipo: "modelo.apagar", dados: { id: item.id } };
    case "ponto":
      return { tipo: "ponto.apagar", dados: { id: item.id } };
    case "luz":
      return { tipo: "fonte.apagar", dados: { id: item.id } };
    case "token":
      return { tipo: "token.apagar", dados: { id: item.id } };
    case "zona":
      return { tipo: "zona.apagar", dados: { id: item.id } };
    case "ciclo":
      return { tipo: "ciclo.apagar", dados: { id: item.id } };
    case "reacao":
      return { tipo: "reacao.apagar", dados: { id: item.id } };
    case "botao":
      return { tipo: "botao.apagar", dados: { id: item.id } };
  }
}

// ---------------------------------------------------------------------------------------------
// A marca na hora de criar
// ---------------------------------------------------------------------------------------------

function cenaEhRascunho(e: Estado, cenaId: string | undefined): boolean {
  return cenaId !== undefined && e.cenas.some((c) => c.id === cenaId && c.rascunho === true);
}

/**
 * Põe (ou tira) a marca de rascunho numa entidade que um evento traz. Entidade nova: rascunho só se `ativo` (o Claude do
 * mestre criando) e se não está numa cena em rascunho (publicar a cena publica o que está nela). Entidade que já
 * existe: a marca de antes continua (editar nunca publica; quem publica é a publicação).
 */
function marcar<T extends { rascunho?: boolean | undefined }>(
  novo: T,
  antes: { rascunho?: boolean | undefined } | undefined,
  ativo: boolean,
  filhoDeRascunho: boolean,
): T {
  const marca = antes ? antes.rascunho === true : ativo && !filhoDeRascunho;
  // Já está como deve ficar: devolve o mesmo objeto (a ordem das chaves não muda).
  if (marca ? novo.rascunho === true : novo.rascunho === undefined) return novo;
  const sem = semMarca(novo);
  return (marca ? { ...sem, rascunho: true } : sem) as T;
}

/**
 * Passa o evento pelo carimbo de rascunho (chamada pela regra, antes de o evento entrar no estado). O cliente nunca
 * escolhe a marca: ela vem de `ativo` (a conexão do Claude de um mestre) e do que já existe.
 */
export function carimbarRascunho<E extends { tipo: string; dados: unknown }>(
  evento: E,
  e: Estado,
  ativo: boolean,
): E {
  const d = evento.dados as Record<string, unknown>;
  const trocar = (dados: unknown): E => ({ ...evento, dados }) as E;
  switch (evento.tipo) {
    case "cena.criada":
    case "cena.editada": {
      const cena = d.cena as Cena;
      return trocar({
        cena: marcar(
          cena,
          e.cenas.find((x) => x.id === cena.id),
          ativo,
          false,
        ),
      });
    }
    case "token.criado":
    case "token.editado": {
      const t = d.token as Token;
      const antes = e.tokens.find((x) => x.id === t.id);
      return trocar({ token: marcar(t, antes, ativo, cenaEhRascunho(e, t.cenaId)) });
    }
    case "personagem.alterado": {
      const p = d.personagem as Personagem;
      return trocar({
        personagem: marcar(
          p,
          e.personagens.find((x) => x.id === p.id),
          ativo,
          false,
        ),
      });
    }
    case "pasta.alterada": {
      const p = d.pasta as Pasta;
      return trocar({
        pasta: marcar(
          p,
          e.pastas.find((x) => x.id === p.id),
          ativo,
          false,
        ),
      });
    }
    case "handout.alterado": {
      const h = d.handout as Handout;
      return trocar({
        handout: marcar(
          h,
          e.handouts.find((x) => x.id === h.id),
          ativo,
          false,
        ),
      });
    }
    case "modelo.alterado": {
      const m = d.modelo as ModeloDeObjeto;
      return trocar({
        modelo: marcar(
          m,
          e.modelos.find((x) => x.id === m.id),
          ativo,
          false,
        ),
      });
    }
    case "ponto.alterado": {
      const p = d.ponto as PontoDeLuz;
      const antes = e.pontos.find((x) => x.id === p.id);
      return trocar({ ponto: marcar(p, antes, ativo, cenaEhRascunho(e, p.cenaId)) });
    }
    case "fonte.criada":
    case "fonte.editada": {
      const f = d.fonte as ObjetoDeLuz;
      const antes = e.luzes.find((x) => x.id === f.id);
      return trocar({ fonte: marcar(f, antes, ativo, cenaEhRascunho(e, f.cenaId)) });
    }
    case "zona.alterada": {
      const z = d.zona as Zona;
      const antes = (e.zonas ?? []).find((x) => x.id === z.id);
      return trocar({ zona: marcar(z, antes, ativo, cenaEhRascunho(e, z.cenaId)) });
    }
    case "automacoes.alterado": {
      const a = d.automacoes as Automacoes;
      const antes = e.automacoes;
      const por = <T extends { id: string; rascunho?: boolean | undefined }>(
        lista: readonly T[],
        existentes: readonly T[] | undefined,
      ): T[] =>
        lista.map((i) =>
          marcar(
            i,
            existentes?.find((x) => x.id === i.id),
            ativo,
            false,
          ),
        );
      return trocar({
        automacoes: {
          ...a,
          ciclos: por(a.ciclos, antes?.ciclos),
          reacoes: por(a.reacoes, antes?.reacoes),
          botoes: por(a.botoes, antes?.botoes),
        },
      });
    }
    default:
      return evento;
  }
}
