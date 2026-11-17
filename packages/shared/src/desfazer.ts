import { automacoesDe } from "./automacoes.ts";
import type { Estado } from "./estado.ts";
import { reduzir } from "./nucleo.ts";
import type { EventoSala } from "./protocolo.ts";

// 12-1: "Desfazer o que o Claude fez". A sala anota, a cada intenção aplicada pela conexão do Claude, o que mudou em
// cada coleção da mesa (um `Delta`: o item antes e depois, por id). Desfazer um lote aplica o inverso na ordem
// inversa; o item que mudou depois (por outra pessoa) é pulado e o aviso diz qual. Só as coleções abaixo entram:
// relógio, permissões, configuração, chat, combate, som e arquivos não são desfeitos (assumido; o M2 acrescentou os desenhos).

/** As coleções que o Desfazer cobre, na ordem de dependência (quem vem antes é pai de quem vem depois). */
export const COLECOES_DESFAZIVEIS = [
  "cenas",
  "pastas",
  "modelos",
  "personagens",
  "handouts",
  "tokens",
  "desenhos",
  "pontos",
  "luzes",
  "paredes",
  "zonas",
  "ciclos",
  "reacoes",
  "botoes",
] as const;
export type ColecaoDesfazivel = (typeof COLECOES_DESFAZIVEIS)[number];

const ROTULO_DA_COLECAO: Record<ColecaoDesfazivel, string> = {
  cenas: "cena",
  pastas: "pasta",
  modelos: "modelo",
  personagens: "ficha",
  handouts: "handout",
  tokens: "token",
  desenhos: "desenho",
  pontos: "ponto",
  luzes: "luz",
  paredes: "parede",
  zonas: "zona",
  ciclos: "ciclo",
  reacoes: "reação",
  botoes: "botão",
};

/** O que mudou num item: `antes` nulo = foi criado; `depois` nulo = foi apagado. */
export type Delta = {
  c: ColecaoDesfazivel;
  id: string;
  antes: unknown | null;
  depois: unknown | null;
};
/** O que uma intenção mudou. Um lote é uma lista de passos, na ordem em que aconteceram. */
export type Passo = Delta[];

type ComId = { id: string };

function itensDe(e: Estado, c: ColecaoDesfazivel): readonly ComId[] {
  const a = automacoesDe(e);
  switch (c) {
    case "cenas":
      return e.cenas;
    case "pastas":
      return e.pastas;
    case "modelos":
      return e.modelos;
    case "personagens":
      return e.personagens;
    case "handouts":
      return e.handouts;
    case "tokens":
      return e.tokens;
    case "desenhos":
      return e.desenhos;
    case "pontos":
      return e.pontos;
    case "luzes":
      return e.luzes;
    case "paredes":
      return e.paredes;
    case "zonas":
      return e.zonas ?? [];
    case "ciclos":
      return a.ciclos;
    case "reacoes":
      return a.reacoes;
    case "botoes":
      return a.botoes;
  }
}

/** JSON com as chaves em ordem: dois itens iguais em conteúdo dão o mesmo texto. */
function estavel(v: unknown): string {
  return JSON.stringify(v, (_k, valor: unknown) => {
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    }
    return valor;
  });
}

/** Sem a marca de rascunho: publicar o que o Claude criou não conta como "mudou depois" (o Desfazer ainda o desfaz). */
function semRascunho(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const { rascunho: _r, ...resto } = v as Record<string, unknown>;
    return resto;
  }
  return v;
}

const igual = (a: unknown, b: unknown) => estavel(semRascunho(a)) === estavel(semRascunho(b));

/** O que mudou entre dois estados, por coleção e id (a ordem das coleções segue `COLECOES_DESFAZIVEIS`). */
export function diffDoEstado(antes: Estado, depois: Estado): Delta[] {
  const saida: Delta[] = [];
  for (const c of COLECOES_DESFAZIVEIS) {
    const a = new Map(itensDe(antes, c).map((i) => [i.id, i]));
    const d = new Map(itensDe(depois, c).map((i) => [i.id, i]));
    for (const [id, item] of d) {
      const velho = a.get(id);
      if (velho === undefined) saida.push({ c, id, antes: null, depois: item });
      // o `reduzir` preserva a referência do que não tocou: o mesmo objeto nem chega a ser serializado
      else if (velho !== item && estavel(velho) !== estavel(item))
        saida.push({ c, id, antes: velho, depois: item });
    }
    for (const [id, item] of a) {
      if (!d.has(id)) saida.push({ c, id, antes: item, depois: null });
    }
  }
  return saida;
}

/** Quantos itens o lote mexeu (para o "criou 6 NPCs, há 5 min"). */
export function contarItens(passos: readonly Passo[]): number {
  const vistos = new Set<string>();
  for (const p of passos) for (const d of p) vistos.add(`${d.c}:${d.id}`);
  return vistos.size;
}

type EventoSemSeq = { tipo: string; dados: unknown };

export type ResultadoDoDesfazer = {
  estado: Estado;
  eventos: EventoSala[];
  aplicados: number;
  /** Os itens que mudaram depois (por outra pessoa) e ficaram como estão. */
  pulados: string[];
};

const nomeDoItem = (d: Delta): string => {
  const item = (d.depois ?? d.antes) as { nome?: string; titulo?: string } | null;
  const nome = item?.nome ?? item?.titulo;
  return `${ROTULO_DA_COLECAO[d.c]}${nome ? ` "${nome}"` : ""}`;
};

/**
 * Aplica o inverso dos passos, do último para o primeiro. Em cada passo: primeiro apaga o que foi criado (dos filhos
 * para os pais), depois devolve o que foi editado ou apagado (dos pais para os filhos). Cada item só é revertido se
 * ainda está como o Claude o deixou; senão é pulado. Pura: devolve o estado novo e os eventos (com `seq` e `origem`).
 */
export function desfazerPassos(
  estado: Estado,
  passos: readonly Passo[],
  origem: { usuarioId: string; idPedido: string },
): ResultadoDoDesfazer {
  let proximo = estado;
  const eventos: EventoSala[] = [];
  const pulados: string[] = [];
  let aplicados = 0;
  const emitir = (ev: EventoSemSeq) => {
    const completo = { ...ev, seq: proximo.seq + 1, origem } as EventoSala;
    eventos.push(completo);
    proximo = reduzir(proximo, completo);
  };
  const atual = (c: ColecaoDesfazivel, id: string) => itensDe(proximo, c).find((i) => i.id === id);
  const pular = (d: Delta) => pulados.push(nomeDoItem(d));

  const apagar = (c: ColecaoDesfazivel, id: string): boolean => {
    switch (c) {
      case "cenas": {
        // A cena só sai se está vazia e não é a do grupo: apagá-la levaria o que outra pessoa pôs nela.
        const vazia =
          proximo.cenaAtivaId !== id &&
          proximo.cenas.length > 1 &&
          !proximo.tokens.some((t) => t.cenaId === id) &&
          !proximo.paredes.some((p) => p.cenaId === id) &&
          !proximo.pontos.some((p) => p.cenaId === id) &&
          !(proximo.zonas ?? []).some((z) => z.cenaId === id) &&
          !proximo.luzes.some((l) => l.cenaId === id);
        if (!vazia) return false;
        emitir({ tipo: "cena.apagada", dados: { cenaId: id } });
        return true;
      }
      case "pastas":
        // Pasta com coisa dentro (de outra pessoa) fica.
        if (
          proximo.personagens.some((p) => p.pastaId === id) ||
          proximo.handouts.some((h) => h.pastaId === id)
        ) {
          return false;
        }
        emitir({ tipo: "pasta.apagada", dados: { id } });
        return true;
      case "modelos":
        emitir({ tipo: "modelo.apagado", dados: { id } });
        return true;
      case "personagens":
        emitir({ tipo: "personagem.apagado", dados: { id } });
        return true;
      case "handouts":
        emitir({ tipo: "handout.apagado", dados: { id } });
        return true;
      case "tokens":
        emitir({ tipo: "token.apagado", dados: { id } });
        return true;
      case "desenhos":
        emitir({ tipo: "desenho.apagado", dados: { id } });
        return true;
      case "pontos":
        emitir({ tipo: "ponto.apagado", dados: { id } });
        return true;
      case "luzes":
        emitir({ tipo: "fonte.apagada", dados: { id } });
        return true;
      case "paredes":
        emitir({ tipo: "parede.apagada", dados: { id } });
        return true;
      case "zonas":
        emitir({ tipo: "zona.apagada", dados: { id } });
        return true;
      case "ciclos":
      case "reacoes":
      case "botoes": {
        const a = automacoesDe(proximo);
        const execucao = { ...a.execucao };
        if (c === "ciclos") delete execucao[id];
        emitir({
          tipo: "automacoes.alterado",
          dados: {
            automacoes: {
              ...a,
              execucao,
              ciclos: c === "ciclos" ? a.ciclos.filter((i) => i.id !== id) : a.ciclos,
              reacoes: c === "reacoes" ? a.reacoes.filter((i) => i.id !== id) : a.reacoes,
              botoes: c === "botoes" ? a.botoes.filter((i) => i.id !== id) : a.botoes,
            },
          },
        });
        return true;
      }
    }
  };

  const guardar = (c: ColecaoDesfazivel, item: unknown): void => {
    const id = (item as ComId).id;
    const existe = atual(c, id) !== undefined;
    switch (c) {
      case "cenas":
        emitir({ tipo: existe ? "cena.editada" : "cena.criada", dados: { cena: item } });
        return;
      case "pastas":
        emitir({ tipo: "pasta.alterada", dados: { pasta: item } });
        return;
      case "modelos":
        emitir({ tipo: "modelo.alterado", dados: { modelo: item } });
        return;
      case "personagens":
        emitir({ tipo: "personagem.alterado", dados: { personagem: item } });
        return;
      case "handouts":
        emitir({ tipo: "handout.alterado", dados: { handout: item } });
        return;
      case "tokens":
        emitir({ tipo: existe ? "token.editado" : "token.criado", dados: { token: item } });
        return;
      case "desenhos": {
        // Um desenho editado só mudou de lugar (`desenho.mover`): volta com os pontos de antes.
        const d = item as { id: string; pontos: unknown };
        if (existe) emitir({ tipo: "desenho.movido", dados: { id: d.id, pontos: d.pontos } });
        else emitir({ tipo: "desenho.criado", dados: { desenho: item } });
        return;
      }
      case "pontos":
        emitir({ tipo: "ponto.alterado", dados: { ponto: item } });
        return;
      case "luzes":
        emitir({ tipo: existe ? "fonte.editada" : "fonte.criada", dados: { fonte: item } });
        return;
      case "paredes":
        emitir({ tipo: existe ? "parede.editada" : "parede.criada", dados: { parede: item } });
        return;
      case "zonas":
        emitir({ tipo: "zona.alterada", dados: { zona: item } });
        return;
      case "ciclos":
      case "reacoes":
      case "botoes": {
        const a = automacoesDe(proximo);
        const troca = <T extends ComId>(lista: readonly T[]): T[] =>
          existe ? lista.map((i) => (i.id === id ? (item as T) : i)) : [...lista, item as T];
        emitir({
          tipo: "automacoes.alterado",
          dados: {
            automacoes: {
              ...a,
              ciclos: c === "ciclos" ? troca(a.ciclos) : a.ciclos,
              reacoes: c === "reacoes" ? troca(a.reacoes) : a.reacoes,
              botoes: c === "botoes" ? troca(a.botoes) : a.botoes,
            },
          },
        });
        return;
      }
    }
  };

  for (const passo of [...passos].reverse()) {
    // 1. O que o Claude criou sai, dos filhos para os pais.
    const criados = passo.filter((d) => d.antes === null);
    for (const d of [...criados].sort(
      (x, y) => COLECOES_DESFAZIVEIS.indexOf(y.c) - COLECOES_DESFAZIVEIS.indexOf(x.c),
    )) {
      const agora = atual(d.c, d.id);
      if (agora === undefined) continue; // já não existe: nada a desfazer
      if (!igual(agora, d.depois) || !apagar(d.c, d.id)) pular(d);
      else aplicados++;
    }
    // 2. O que ele editou ou apagou volta, dos pais para os filhos.
    const outros = passo.filter((d) => d.antes !== null);
    for (const d of [...outros].sort(
      (x, y) => COLECOES_DESFAZIVEIS.indexOf(x.c) - COLECOES_DESFAZIVEIS.indexOf(y.c),
    )) {
      const agora = atual(d.c, d.id);
      if (d.depois === null) {
        // Foi apagado: só volta se continua apagado.
        if (agora !== undefined) pular(d);
        else {
          guardar(d.c, d.antes);
          aplicados++;
        }
      } else if (agora === undefined || !igual(agora, d.depois)) pular(d);
      else {
        guardar(d.c, d.antes);
        aplicados++;
      }
    }
  }
  return { estado: proximo, eventos, aplicados, pulados };
}
