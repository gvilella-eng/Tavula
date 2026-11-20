import { z } from "zod";
import {
  type Bloco,
  type CondicaoDoSe,
  conteudoDaCaixa,
  ehNoDeValor,
  type Fio,
  type Fluxo,
  type FluxoArvore,
  FluxoArvoreSchema,
  FluxoSchema,
  type Gatilho,
  type No,
  type NoDe,
  numeroDeEspacos,
  pecaDoEspaco,
  portasDoNo,
  type TipoDeGatilho,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU2: o que se faz com o grafo de uma automação, sem tocar no estado: achar os gatilhos, ligar os nós, arrumar na grade,
// converter a árvore do AU1 em grafo. Puro.
// ---------------------------------------------------------------------------------------------

// --- Gatilhos --------------------------------------------------------------------------------

/** Os nós de gatilho (o "Quando") do fluxo, na ordem em que estão. */
export function nosDeGatilho(f: Pick<Fluxo, "nos">): NoDe<"gatilho">[] {
  return f.nos.filter((n): n is NoDe<"gatilho"> => n.tipo === "gatilho");
}

/** O nó do gatilho deste tipo (o primeiro). */
export function noDeGatilhoDoTipo(
  f: Pick<Fluxo, "nos">,
  tipo: TipoDeGatilho,
): NoDe<"gatilho"> | undefined {
  return nosDeGatilho(f).find((n) => n.config.tipo === tipo);
}

/** O fluxo tem gatilho deste tipo? */
export const temGatilho = (f: Pick<Fluxo, "nos">, tipo: TipoDeGatilho): boolean =>
  noDeGatilhoDoTipo(f, tipo) !== undefined;

/**
 * O gatilho que dá a cara da automação na lista e nos chips: o botão, depois o relógio, depois o primeiro. `undefined` num
 * fluxo sem gatilho (o editor deixa assim, até a pessoa pôr um).
 */
export function gatilhoPrincipal(f: Pick<Fluxo, "nos">): Gatilho | undefined {
  return (noDeGatilhoDoTipo(f, "botao") ?? noDeGatilhoDoTipo(f, "relogio") ?? nosDeGatilho(f)[0])
    ?.config;
}

/** O nó por onde "Disparar agora" começa: o do botão, senão o do relógio, senão o primeiro gatilho. */
export function noDeDisparoManual(f: Pick<Fluxo, "nos">): NoDe<"gatilho"> | undefined {
  return noDeGatilhoDoTipo(f, "botao") ?? noDeGatilhoDoTipo(f, "relogio") ?? nosDeGatilho(f)[0];
}

// --- Navegar pelos fios ----------------------------------------------------------------------

/** Os fios que saem desta porta, na ordem em que estão (a ordem em que o motor os segue). */
export const fiosDaSaida = (f: Pick<Fluxo, "fios">, no: string, saida: string): Fio[] =>
  f.fios.filter((x) => x.de.no === no && x.de.saida === saida);

/** Os fios que chegam a esta porta. */
export const fiosDaEntrada = (f: Pick<Fluxo, "fios">, no: string, entrada: string): Fio[] =>
  f.fios.filter((x) => x.para.no === no && x.para.entrada === entrada);

/** O fio liga duas portas do mesmo tipo (ordem com ordem, condição com condição)? Diz o motivo quando não. */
export function podeLigar(
  f: Pick<Fluxo, "nos" | "fios">,
  de: { no: string; saida: string },
  para: { no: string; entrada: string },
): { ok: true } | { ok: false; motivo: string } {
  const a = f.nos.find((n) => n.id === de.no);
  const b = f.nos.find((n) => n.id === para.no);
  if (a === undefined || b === undefined) return { ok: false, motivo: "O bloco não existe." };
  if (a.id === b.id) return { ok: false, motivo: "Não dá para ligar um bloco a ele mesmo." };
  const saida = portasDoNo(a, f.nos).saidas.find((p) => p.id === de.saida);
  const entrada = portasDoNo(b, f.nos).entradas.find((p) => p.id === para.entrada);
  if (saida === undefined || entrada === undefined)
    return { ok: false, motivo: "Porta inexistente." };
  if (saida.tipo !== entrada.tipo) {
    return {
      ok: false,
      motivo:
        saida.tipo === "exec"
          ? "Um fio de ordem não liga numa porta de condição."
          : "Um fio de condição não liga numa porta de ordem.",
    };
  }
  if (
    f.fios.some(
      (x) =>
        x.de.no === de.no &&
        x.de.saida === de.saida &&
        x.para.no === para.no &&
        x.para.entrada === para.entrada,
    )
  ) {
    return { ok: false, motivo: "Esses dois já estão ligados." };
  }
  if (!entrada.varias && fiosDaEntrada(f, para.no, para.entrada).length > 0) {
    return { ok: false, motivo: `A porta "${entrada.rotulo}" aceita só um fio.` };
  }
  return { ok: true };
}

/** Um id de nó que ainda não existe no fluxo (`n1`, `n2`...). */
export function idNovoDeNo(nos: readonly Pick<No, "id">[]): string {
  const usados = new Set(nos.map((n) => n.id));
  let i = nos.length + 1;
  while (usados.has(`n${i}`)) i++;
  return `n${i}`;
}

/**
 * O fluxo sem estes nós. Os fios deles saem junto; quando o nó tem uma única saída de ordem (uma ação, um sinal, um esperar),
 * quem chegava nele passa a ligar direto no que vinha depois, para a automação continuar de pé.
 */
export function semOsNos<T extends Pick<Fluxo, "nos" | "fios">>(
  f: T,
  ids0: ReadonlySet<string>,
): T {
  // AU3: apagar uma caixa apaga o que está dentro dela.
  const ids = new Set(ids0);
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const n of f.nos) {
      if (n.em !== undefined && ids.has(n.em) && !ids.has(n.id)) {
        ids.add(n.id);
        mudou = true;
      }
    }
  }
  let fios = f.fios;
  for (const id of ids) {
    const no = f.nos.find((n) => n.id === id);
    if (no === undefined) continue;
    const saidas = portasDoNo(no, f.nos).saidas;
    const unica = saidas.length === 1 && saidas[0]?.tipo === "exec" ? saidas[0].id : undefined;
    if (unica !== undefined) {
      const entram = fios.filter((x) => x.para.no === id && x.para.entrada === "entrada");
      const saem = fios.filter((x) => x.de.no === id && x.de.saida === unica);
      const ponte: Fio[] = [];
      for (const a of entram) {
        for (const b of saem) {
          if (ids.has(a.de.no) || ids.has(b.para.no)) continue;
          ponte.push({ de: a.de, para: b.para });
        }
      }
      fios = [...fios, ...ponte];
    }
    fios = fios.filter((x) => x.de.no !== id && x.para.no !== id);
  }
  const unicos = new Map<string, Fio>();
  for (const x of fios) unicos.set(`${x.de.no}.${x.de.saida}>${x.para.no}.${x.para.entrada}`, x);
  return { ...f, nos: f.nos.filter((n) => !ids.has(n.id)), fios: [...unicos.values()] };
}

// --- Arrumar na grade ------------------------------------------------------------------------

export const LARGURA_DO_NO = 210;
export const ALTURA_DO_NO = 84;
/** AU3: as medidas da caixa na grade (o desenho do editor usa as mesmas, para a arrumação e os fios não desalinharem). */
export const LARGURA_DA_CAIXA = 250;
/** Quanto a caixa de fora fica mais larga por cada nível de caixa dentro dela (a de dentro aparece inteira, com folga). */
export const RECUO_DA_CAIXA = 26;

/** A largura de uma caixa na grade: a base mais um recuo por nível de caixa dentro dela. */
export function larguraDaCaixa(nos: readonly No[], n: No): number {
  const fundo = (id: string, nivel: number): number => {
    if (nivel > 6) return 0;
    const filhas = nos.filter((x) => x.em === id && x.tipo === "caixa");
    return filhas.length === 0 ? 0 : 1 + Math.max(...filhas.map((f) => fundo(f.id, nivel + 1)));
  };
  return LARGURA_DA_CAIXA + RECUO_DA_CAIXA * fundo(n.id, 0);
}
/** A margem de dentro da caixa e o vão entre o rótulo e os espaços. */
export const MARGEM_DA_CAIXA = 6;
export const VAO_DA_CAIXA = 4;
/** O rótulo "E" / "OU" entre dois espaços (e o "NÃO" no alto da caixa NÃO). */
export const ALTURA_DO_ROTULO = 22;
/** Um espaço sem peça. */
export const ALTURA_DO_ESPACO_VAZIO = 44;
/** O pé da caixa E/OU, com o botão "+". */
export const ALTURA_DO_MAIS = 24;
export const ALTURA_DA_PECA = 40;

/** A altura de um nó na grade: a de uma caixa cresce com o que tem dentro e com o número de espaços. */
export function alturaDoNo(nos: readonly No[], n: No, fundo = 0): number {
  if (n.tipo !== "caixa") return n.em === undefined ? ALTURA_DO_NO : ALTURA_DA_PECA;
  const espacos = numeroDeEspacos(nos, n.id);
  const alturas: number[] = [];
  for (let i = 0; i < espacos; i++) {
    const p = pecaDoEspaco(nos, n.id, i);
    alturas.push(
      p === undefined || fundo > 6 ? ALTURA_DO_ESPACO_VAZIO : alturaDoNo(nos, p, fundo + 1),
    );
  }
  const soma = alturas.reduce((t, h) => t + h, 0);
  if (n.config.porta === "nao")
    return MARGEM_DA_CAIXA + ALTURA_DO_ROTULO + VAO_DA_CAIXA + soma + MARGEM_DA_CAIXA;
  return (
    MARGEM_DA_CAIXA +
    soma +
    (espacos - 1) * (ALTURA_DO_ROTULO + 2 * VAO_DA_CAIXA) +
    VAO_DA_CAIXA +
    ALTURA_DO_MAIS +
    MARGEM_DA_CAIXA
  );
}
const PASSO_X = 300;
const PASSO_Y = 120;
const MARGEM = 60;

/**
 * Arruma o grafo na grade, da esquerda para a direita: o gatilho na primeira coluna, cada bloco uma coluna depois do que o
 * chama; as condições e portas lógicas ficam na coluna antes do bloco que as usa. Devolve só as posições novas.
 */
export function organizarGrafo(f: Pick<Fluxo, "nos" | "fios">): No[] {
  const todos = f.nos;
  // AU3: as peças guardadas numa caixa não vão para a grade (a posição delas é da caixa).
  const nosSoltos = todos.filter((n) => n.em === undefined);
  const ehValor = (n: No) => ehNoDeValor(n, todos);
  const exec = f.fios.filter((x) => {
    const de = todos.find((n) => n.id === x.de.no);
    return de !== undefined && !ehValor(de);
  });
  const valor = f.fios.filter((x) => {
    const de = todos.find((n) => n.id === x.de.no);
    return de !== undefined && ehValor(de);
  });
  const ids = nosSoltos.map((n) => n.id);
  const col = new Map<string, number>();
  for (const n of nosSoltos) {
    if (n.tipo === "gatilho" || (n.tipo === "caixa" && conteudoDaCaixa(todos, n.id) === "gatilho"))
      col.set(n.id, 0);
  }
  // A coluna é o caminho mais longo desde um gatilho; o limite de passadas impede o ciclo de rodar para sempre.
  for (let passo = 0; passo < ids.length + 1; passo++) {
    let mudou = false;
    for (const x of exec) {
      const c = col.get(x.de.no);
      if (c === undefined || c + 1 > ids.length) continue;
      if ((col.get(x.para.no) ?? -1) < c + 1) {
        col.set(x.para.no, c + 1);
        mudou = true;
      }
    }
    if (!mudou) break;
  }
  for (const n of nosSoltos) {
    if (!ehValor(n) && !col.has(n.id)) col.set(n.id, 1);
  }
  // Os nós de valor, uma coluna antes de quem os usa (e as portas encadeadas, mais uma antes).
  for (let passo = 0; passo < ids.length + 1; passo++) {
    let mudou = false;
    for (const x of valor) {
      const c = col.get(x.para.no);
      if (c === undefined) continue;
      const atual = col.get(x.de.no);
      if (atual === undefined || atual > c - 1) {
        col.set(x.de.no, c - 1);
        mudou = true;
      }
    }
    if (!mudou) break;
  }
  for (const n of nosSoltos) if (!col.has(n.id)) col.set(n.id, 0);
  const menor = Math.min(0, ...col.values());
  const linhas = new Map<number, number>();
  // Quem é de ordem vem primeiro em cada coluna (na ordem da lista); os de valor, depois.
  const ordem = [...nosSoltos].sort((a, b) => Number(ehValor(a)) - Number(ehValor(b)));
  const posicao = new Map<string, { x: number; y: number }>();
  for (const n of ordem) {
    const c = (col.get(n.id) ?? 0) - menor;
    const y = linhas.get(c) ?? MARGEM;
    linhas.set(c, y + Math.max(PASSO_Y, alturaDoNo(todos, n) + 36));
    posicao.set(n.id, { x: MARGEM + c * PASSO_X, y });
  }
  return f.nos.map((n) => ({ ...n, ...(posicao.get(n.id) ?? { x: n.x, y: n.y }) }) as No);
}

// --- A árvore do AU1 vira grafo --------------------------------------------------------------

type Ponta = { no: string; saida: string };

/** Uma condição do AU1 virou nó de condição; devolve o `config`. */
const condicao = (c: CondicaoDoSe): CondicaoDoSe => c;

/**
 * Converte uma automação do AU1 (um gatilho e trilhas de blocos) em grafo, sem perder nada: cada bloco vira um nó, "se" e
 * "sortear" ligam o fim dos dois ramos no bloco seguinte, "para cada" liga o "depois" no seguinte, e o que vinha em trilhas
 * paralelas sai do gatilho em fios separados. A ordem dos fios é a das trilhas, então o motor sorteia e age na mesma ordem.
 */
export function arvoreParaGrafo(arvore: FluxoArvore): Fluxo {
  const nos: No[] = [];
  const fios: Fio[] = [];
  const novo = <T extends No>(parcial: Omit<T, "id" | "x" | "y">): T => {
    const no = { ...parcial, id: `n${nos.length + 1}`, x: 0, y: 0 } as T;
    nos.push(no);
    return no;
  };
  const ligar = (de: readonly Ponta[], para: string, entrada = "entrada") => {
    for (const d of de) {
      if (
        fios.some(
          (x) =>
            x.de.no === d.no &&
            x.de.saida === d.saida &&
            x.para.no === para &&
            x.para.entrada === entrada,
        )
      )
        continue;
      fios.push({ de: { no: d.no, saida: d.saida }, para: { no: para, entrada } });
    }
  };
  const lista = (blocos: readonly Bloco[], entradas: readonly Ponta[]): Ponta[] => {
    let atual: Ponta[] = [...entradas];
    for (const b of blocos) {
      switch (b.bloco) {
        case "esperar": {
          const n = novo<NoDe<"esperar">>({ tipo: "esperar", config: { s: b.s } });
          ligar(atual, n.id);
          atual = [{ no: n.id, saida: "saida" }];
          break;
        }
        case "acao": {
          const n = novo<NoDe<"acao">>({ tipo: "acao", config: { acao: b.acao } });
          ligar(atual, n.id);
          atual = [{ no: n.id, saida: "saida" }];
          break;
        }
        case "sinal": {
          const n = novo<NoDe<"sinal">>({
            tipo: "sinal",
            config: { nome: b.nome, ...(b.atrasoS === undefined ? {} : { atrasoS: b.atrasoS }) },
          });
          ligar(atual, n.id);
          atual = [{ no: n.id, saida: "saida" }];
          break;
        }
        case "se": {
          const se = novo<NoDe<"se">>({ tipo: "se", config: {} });
          const c = novo<NoDe<"condicao">>({ tipo: "condicao", config: condicao(b.condicao) });
          ligar([{ no: c.id, saida: "valor" }], se.id, "condicao");
          ligar(atual, se.id);
          atual = [
            ...lista(b.sim, [{ no: se.id, saida: "sim" }]),
            ...lista(b.nao, [{ no: se.id, saida: "nao" }]),
          ];
          break;
        }
        case "sortear": {
          const n = novo<NoDe<"sortear">>({ tipo: "sortear", config: { chance: b.chance } });
          ligar(atual, n.id);
          atual = [
            ...lista(b.sim, [{ no: n.id, saida: "sim" }]),
            ...lista(b.nao, [{ no: n.id, saida: "nao" }]),
          ];
          break;
        }
        case "paraCada": {
          const n = novo<NoDe<"paraCada">>({ tipo: "paraCada", config: { alvo: b.alvo } });
          ligar(atual, n.id);
          lista(b.corpo, [{ no: n.id, saida: "corpo" }]);
          atual = [{ no: n.id, saida: "depois" }];
          break;
        }
      }
    }
    return atual;
  };

  const g = novo<NoDe<"gatilho">>({ tipo: "gatilho", config: arvore.gatilho });
  for (const trilha of arvore.trilhas) lista(trilha, [{ no: g.id, saida: "saida" }]);
  const { gatilho: _g, trilhas: _t, ...resto } = arvore;
  const grafo: Fluxo = { ...resto, nos, fios };
  return { ...grafo, nos: organizarGrafo(grafo) };
}

/**
 * Se `bruto` é uma automação do AU1 (tem `gatilho` e `trilhas`, e nenhum `nos`), devolve o grafo; senão devolve o mesmo
 * valor. É o `preprocess` de tudo o que lê uma automação de fora (o disco, um arquivo, uma intenção).
 */
export function lerFluxoDeQualquerForma(bruto: unknown): unknown {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return bruto;
  const o = bruto as Record<string, unknown>;
  if ("nos" in o || !("trilhas" in o) || !("gatilho" in o)) return bruto;
  const r = FluxoArvoreSchema.safeParse(bruto);
  return r.success ? arvoreParaGrafo(r.data) : bruto;
}

/** O esquema que aceita a automação como grafo ou como o AU1 a guardava (convertida na hora). */
export const FluxoDeQualquerFormaSchema = z.preprocess(lerFluxoDeQualquerForma, FluxoSchema);
