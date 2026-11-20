import {
  conteudoDaCaixa,
  type Fio,
  type Fluxo,
  MAXIMO_DE_ESPACOS,
  MINIMO_DE_ESPACOS,
  NIVEIS_DE_CAIXA,
  type No,
  numeroDeEspacos,
  type PortaLogica,
  pecaDoEspaco,
  pecasDaCaixa,
  portasDoNo,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU3: as portas lógicas viram CAIXAS na grade, como os blocos "e", "ou" e "não" do Scratch, na vertical: a caixa E ou OU tem
// DOIS espaços (ou mais: o "+" acrescenta, arrastar para entre dois espaços abre um novo), um em cima do outro, com o rótulo
// "E" ou "OU" entre cada par (clicar troca a caixa inteira); a NÃO tem um espaço. Cada espaço guarda UMA peça: um gatilho, uma
// condição, uma ação ou outra caixa. A saída da caixa vem do que está dentro (ver `conteudoDaCaixa`). O motor continua o mesmo
// por baixo: a caixa é a porta lógica. Aqui moram as regras do que cabe onde, as operações do editor e a conversão do AU2
// (portas com fios) em caixas. Puro.
// ---------------------------------------------------------------------------------------------

export const NOMES_DAS_CAIXAS: Record<PortaLogica, string> = {
  ou: "OU",
  e: "E",
  nao: "NÃO",
};

const ehCaixa = (n: Pick<No, "tipo">): boolean => n.tipo === "caixa";

/** O que uma peça é, para a regra do que cabe: um acontecimento, uma condição, uma ação, ou nada ainda (caixa vazia). */
type Natureza = "gatilho" | "valor" | "acao" | "vazia";
function naturezaDaPeca(nos: readonly No[], n: No): Natureza {
  if (n.tipo === "gatilho") return "gatilho";
  if (n.tipo === "condicao") return "valor";
  if (n.tipo === "acao" || n.tipo === "sinal") return "acao";
  if (n.tipo === "caixa") return conteudoDaCaixa(nos, n.id);
  return "vazia";
}

/** Quantos níveis de caixa há de fora até esta peça (uma peça solta na grade tem 0). */
export function nivelDaPeca(nos: readonly No[], id: string): number {
  let nivel = 0;
  let atual = nos.find((n) => n.id === id);
  while (atual?.em !== undefined && nivel <= NIVEIS_DE_CAIXA + 2) {
    nivel++;
    const pai: string = atual.em;
    atual = nos.find((n) => n.id === pai);
  }
  return nivel;
}

/** Quantos níveis de caixa há de fundo dentro desta peça (uma peça que não é caixa tem 0). */
function profundidadeDeDentro(
  nos: readonly No[],
  id: string,
  visto: ReadonlySet<string> = new Set(),
): number {
  if (visto.has(id)) return 0;
  const v = new Set([...visto, id]);
  const filhas = nos.filter((n) => n.em === id && ehCaixa(n));
  const dela = nos.find((n) => n.id === id);
  const eu = dela !== undefined && ehCaixa(dela) ? 1 : 0;
  return eu + Math.max(0, ...filhas.map((f) => profundidadeDeDentro(nos, f.id, v)));
}

/**
 * A caixa tem peças que não combinam entre si? Diz o porquê (uma dica curta); `null` se está bem. As regras, pelo que cada peça
 * dá de saída: gatilho OU gatilho (qualquer um dispara) e gatilho E condição (segue se a condição vale) valem; condição com
 * condição e NÃO condição são valores; ação E ação (as duas acontecem) e ação OU ação (sorteia uma) valem. Não vale: gatilho
 * E gatilho, gatilho OU condição, NÃO com gatilho ou ação, e ação misturada com gatilho ou condição.
 */
export function conflitoDaCaixa(nos: readonly No[], id: string): string | null {
  const caixa = nos.find((n) => n.id === id);
  if (caixa === undefined || caixa.tipo !== "caixa") return null;
  const logica = caixa.config.porta;
  const pecas = pecasDaCaixa(nos, id);
  const naturezas = pecas.map((p) => naturezaDaPeca(nos, p));
  if (logica === "nao") {
    if (pecas.some((p) => (p.espaco ?? 0) > 0))
      return "O NÃO tem um espaço só: ponha uma caixa nele para negar várias peças.";
    if (naturezas.includes("gatilho") || naturezas.includes("acao"))
      return "NÃO nega uma condição: um gatilho ou uma ação não é verdadeiro nem falso.";
    return null;
  }
  const g = naturezas.filter((x) => x === "gatilho").length;
  const v = naturezas.filter((x) => x === "valor").length;
  const a = naturezas.filter((x) => x === "acao").length;
  if (a > 0 && (g > 0 || v > 0))
    return "Uma ação não se mistura com um gatilho ou uma condição na mesma caixa.";
  if (logica === "e" && g >= 2)
    return "Dois acontecimentos não chegam no mesmo instante: para gatilhos, use OU.";
  if (logica === "ou" && g >= 1 && v >= 1)
    return "Um gatilho com uma condição precisa do E: acontece o gatilho e a condição vale.";
  return null;
}

/** Todas as caixas do fluxo que estão em conflito, com o motivo. */
export function conflitosDasCaixas(nos: readonly No[]): { id: string; motivo: string }[] {
  const r: { id: string; motivo: string }[] = [];
  for (const n of nos) {
    const m = conflitoDaCaixa(nos, n.id);
    if (m !== null) r.push({ id: n.id, motivo: m });
  }
  return r;
}

/** Para onde a peça vai: um espaço que já existe, ou um espaço novo aberto na posição `inserirEm` (empurra os de baixo). */
export type DestinoNaCaixa = { espaco: number } | { inserirEm: number };

/**
 * Põe a peça na caixa (ou a tira dela, com `caixaId` nulo). Abrir um espaço novo empurra as peças de baixo; tirar a peça de um
 * espaço de uma caixa com mais de dois remove o espaço, e as de baixo sobem. Pura: devolve os nós novos, sem conferir regras.
 */
function colocar(
  nos: readonly No[],
  pecaId: string,
  caixaId: string | null,
  destino: DestinoNaCaixa,
  xy?: { x: number; y: number },
): No[] {
  const lista = nos.map((n) => ({ ...n })) as No[];
  const peca = lista.find((n) => n.id === pecaId);
  if (peca === undefined) return lista;
  const velha = peca.em;
  const velhoIdx = peca.espaco ?? 0;
  delete peca.em;
  delete peca.espaco;
  if (xy) {
    peca.x = xy.x;
    peca.y = xy.y;
  }
  let idxVelho = velhoIdx;
  if (caixaId !== null) {
    const caixa = lista.find((n) => n.id === caixaId);
    if (caixa?.tipo === "caixa") {
      if ("inserirEm" in destino) {
        const antes = numeroDeEspacos(lista, caixaId);
        for (const n of lista) {
          if (n.em === caixaId && (n.espaco ?? 0) >= destino.inserirEm)
            n.espaco = (n.espaco ?? 0) + 1;
        }
        caixa.config = { ...caixa.config, espacos: Math.min(MAXIMO_DE_ESPACOS, antes + 1) };
        peca.em = caixaId;
        peca.espaco = destino.inserirEm;
        if (velha === caixaId && destino.inserirEm <= velhoIdx) idxVelho = velhoIdx + 1;
      } else {
        peca.em = caixaId;
        peca.espaco = destino.espaco;
      }
    }
  }
  if (velha !== undefined) {
    const caixaVelha = lista.find((n) => n.id === velha);
    if (
      caixaVelha?.tipo === "caixa" &&
      caixaVelha.config.porta !== "nao" &&
      numeroDeEspacos(lista, velha) > MINIMO_DE_ESPACOS &&
      pecaDoEspaco(lista, velha, idxVelho) === undefined
    ) {
      const n = numeroDeEspacos(lista, velha);
      for (const x of lista) {
        if (x.em === velha && (x.espaco ?? 0) > idxVelho) x.espaco = (x.espaco ?? 0) - 1;
      }
      caixaVelha.config = { ...caixaVelha.config, espacos: n - 1 };
    }
  }
  return lista;
}

const SO_PECAS_DE_CAIXA =
  "Em um espaço entram só um gatilho, uma condição, uma ação ou outra caixa; os outros blocos ficam na grade, ligados por fios.";

/**
 * Pode soltar esta peça neste espaço (ou abrindo um espaço novo) da caixa? `null` se pode; senão, a dica curta do porquê.
 * Confere o tipo da peça, o espaço livre, o limite de espaços e de níveis, a caixa dentro dela mesma e o que combina com o que
 * já está lá dentro (e nas caixas de fora).
 */
export function motivoDaRecusa(
  nos: readonly No[],
  pecaId: string,
  caixaId: string,
  destino: DestinoNaCaixa = { espaco: 0 },
): string | null {
  const peca = nos.find((n) => n.id === pecaId);
  const caixa = nos.find((n) => n.id === caixaId);
  if (peca === undefined || caixa === undefined || caixa.tipo !== "caixa")
    return "A caixa não existe.";
  if (
    peca.tipo !== "gatilho" &&
    peca.tipo !== "condicao" &&
    peca.tipo !== "acao" &&
    peca.tipo !== "sinal" &&
    peca.tipo !== "caixa"
  )
    return SO_PECAS_DE_CAIXA;
  if (peca.id === caixa.id) return "Uma caixa não cabe dentro dela mesma.";
  const tem = numeroDeEspacos(nos, caixaId);
  if ("inserirEm" in destino) {
    if (caixa.config.porta === "nao") return "O NÃO tem um espaço só.";
    if (tem >= MAXIMO_DE_ESPACOS) return `Uma caixa tem no máximo ${MAXIMO_DE_ESPACOS} espaços.`;
  } else {
    if (destino.espaco >= tem) return "Este espaço não existe.";
    const ocupante = pecaDoEspaco(nos, caixaId, destino.espaco);
    if (ocupante !== undefined && ocupante.id !== peca.id)
      return "Este espaço já tem uma peça. Solte entre dois espaços para abrir um novo, ou ponha uma caixa no lugar.";
  }
  if (peca.tipo === "caixa") {
    // A caixa de destino não pode estar dentro da peça.
    let acima: No | undefined = caixa;
    for (let i = 0; i <= NIVEIS_DE_CAIXA + 2 && acima !== undefined; i++) {
      if (acima.id === peca.id) return "Uma caixa não cabe dentro dela mesma.";
      const pai: string | undefined = acima.em;
      acima = pai === undefined ? undefined : nos.find((n) => n.id === pai);
    }
  }
  const niveis = nivelDaPeca(nos, caixa.id) + 1 + profundidadeDeDentro(nos, peca.id);
  if (niveis > NIVEIS_DE_CAIXA) return `No máximo ${NIVEIS_DE_CAIXA} caixas uma dentro da outra.`;
  const depois = colocar(nos, pecaId, caixaId, destino);
  let alvo: string | undefined = caixaId;
  for (let i = 0; i <= NIVEIS_DE_CAIXA + 2 && alvo !== undefined; i++) {
    const m = conflitoDaCaixa(depois, alvo);
    if (m !== null) return m;
    alvo = depois.find((n) => n.id === alvo)?.em;
  }
  return null;
}

/** Os fios que ainda valem (as duas pontas existem e as portas são as do tipo certo). */
export function fiosValidos(nos: readonly No[], fios: readonly Fio[]): Fio[] {
  const porId = new Map(nos.map((n) => [n.id, n]));
  return fios.filter((f) => {
    const de = porId.get(f.de.no);
    const para = porId.get(f.para.no);
    if (de === undefined || para === undefined) return false;
    const s = portasDoNo(de, nos).saidas.find((p) => p.id === f.de.saida);
    const e = portasDoNo(para, nos).entradas.find((p) => p.id === f.para.entrada);
    return s !== undefined && e !== undefined && s.tipo === e.tipo;
  });
}

type Grafo = Pick<Fluxo, "nos" | "fios">;

/**
 * Põe a peça num espaço da caixa (ou abrindo um novo), ou a tira da caixa (`caixaId` nulo; fica em `x`,`y` na grade). Os fios
 * da peça guardada somem (ela só se liga pela caixa); se a caixa de gatilho ainda não tinha fio de saída, ela herda os do
 * gatilho. Os fios da caixa que deixaram de valer (a saída mudou de tipo) saem junto. Tirar a peça de uma caixa com mais de
 * dois espaços remove o espaço.
 */
export function moverPeca<T extends Grafo>(
  f: T,
  pecaId: string,
  caixaId: string | null,
  opcoes: { espaco?: number; inserirEm?: number; x?: number; y?: number } = {},
): { ok: true; fluxo: T } | { ok: false; motivo: string } {
  const peca = f.nos.find((n) => n.id === pecaId);
  if (peca === undefined) return { ok: false, motivo: "A peça não existe." };
  const destino: DestinoNaCaixa =
    opcoes.inserirEm !== undefined
      ? { inserirEm: opcoes.inserirEm }
      : { espaco: opcoes.espaco ?? 0 };
  if (caixaId !== null) {
    const m = motivoDaRecusa(f.nos, pecaId, caixaId, destino);
    if (m !== null) return { ok: false, motivo: m };
  }
  const xy = caixaId === null ? { x: opcoes.x ?? peca.x, y: opcoes.y ?? peca.y } : undefined;
  const nos = colocar(f.nos, pecaId, caixaId, destino, xy);
  let fios = [...f.fios];
  if (caixaId !== null) {
    const caixa = f.nos.find((n) => n.id === caixaId) as No;
    const dele = fios.filter((x) => x.de.no === pecaId);
    const caixaTemFio = fios.some((x) => x.de.no === caixaId);
    fios = fios.filter((x) => x.de.no !== pecaId && x.para.no !== pecaId);
    if (peca.tipo === "gatilho" && caixa.em === undefined && !caixaTemFio) {
      for (const x of dele) fios.push({ de: { no: caixaId, saida: "saida" }, para: x.para });
    }
  }
  return { ok: true, fluxo: { ...f, nos, fios: fiosValidos(nos, fios) } };
}

/** Sobe (-1) ou desce (+1) a peça um espaço: troca com a peça de lá, ou vai para o espaço vazio. */
export function reordenarPeca<T extends Grafo>(f: T, pecaId: string, delta: -1 | 1): T {
  const peca = f.nos.find((n) => n.id === pecaId);
  if (peca?.em === undefined) return f;
  const daqui = peca.espaco ?? 0;
  const para = daqui + delta;
  if (para < 0 || para >= numeroDeEspacos(f.nos, peca.em)) return f;
  const outro = pecaDoEspaco(f.nos, peca.em, para);
  const nos = f.nos.map((n) => {
    if (n.id === peca.id) return { ...n, espaco: para } as No;
    if (outro && n.id === outro.id) return { ...n, espaco: daqui } as No;
    return n;
  });
  return { ...f, nos };
}

/** Acrescenta um espaço vazio no pé da caixa E ou OU (o "+"). */
export function adicionarEspaco<T extends Grafo>(
  f: T,
  caixaId: string,
): { ok: true; fluxo: T } | { ok: false; motivo: string } {
  const caixa = f.nos.find((n) => n.id === caixaId);
  if (caixa?.tipo !== "caixa") return { ok: false, motivo: "A caixa não existe." };
  if (caixa.config.porta === "nao") return { ok: false, motivo: "O NÃO tem um espaço só." };
  const n = numeroDeEspacos(f.nos, caixaId);
  if (n >= MAXIMO_DE_ESPACOS)
    return { ok: false, motivo: `Uma caixa tem no máximo ${MAXIMO_DE_ESPACOS} espaços.` };
  const nos = f.nos.map((x) =>
    x.id === caixaId && x.tipo === "caixa"
      ? ({ ...x, config: { ...x.config, espacos: n + 1 } } as No)
      : x,
  );
  return { ok: true, fluxo: { ...f, nos } };
}

/** Tira um espaço vazio a mais (o "×"): o mínimo é dois, e um espaço com peça não sai (tire a peça antes). */
export function removerEspaco<T extends Grafo>(
  f: T,
  caixaId: string,
  espaco: number,
): { ok: true; fluxo: T } | { ok: false; motivo: string } {
  const caixa = f.nos.find((n) => n.id === caixaId);
  if (caixa?.tipo !== "caixa") return { ok: false, motivo: "A caixa não existe." };
  const n = numeroDeEspacos(f.nos, caixaId);
  if (caixa.config.porta === "nao" || n <= MINIMO_DE_ESPACOS)
    return { ok: false, motivo: `A caixa precisa de pelo menos ${MINIMO_DE_ESPACOS} espaços.` };
  if (pecaDoEspaco(f.nos, caixaId, espaco) !== undefined)
    return { ok: false, motivo: "Tire a peça deste espaço antes de remover o espaço." };
  const nos = f.nos.map((x) => {
    if (x.id === caixaId && x.tipo === "caixa")
      return { ...x, config: { ...x.config, espacos: n - 1 } } as No;
    if (x.em === caixaId && (x.espaco ?? 0) > espaco)
      return { ...x, espaco: (x.espaco ?? 0) - 1 } as No;
    return x;
  });
  return { ok: true, fluxo: { ...f, nos } };
}

/** Um id de nó que ainda não existe (`n1`, `n2`...). */
function idLivre(nos: readonly Pick<No, "id">[]): string {
  const todos = new Set(nos.map((n) => n.id));
  let i = nos.length + 1;
  while (todos.has(`n${i}`)) i++;
  return `n${i}`;
}

/** Muda a caixa de E para OU (ou o contrário), se as peças de dentro combinam com a nova. */
export function alternarCaixa<T extends Grafo>(
  f: T,
  caixaId: string,
): { ok: true; fluxo: T } | { ok: false; motivo: string } {
  const caixa = f.nos.find((n) => n.id === caixaId);
  if (caixa?.tipo !== "caixa" || caixa.config.porta === "nao")
    return { ok: false, motivo: "Só as caixas E e OU trocam." };
  const nova: No = {
    ...caixa,
    config: { ...caixa.config, porta: caixa.config.porta === "e" ? "ou" : "e" },
  };
  const nos = f.nos.map((n) => (n.id === caixaId ? nova : n));
  const m = conflitoDaCaixa(nos, caixaId);
  if (m !== null) return { ok: false, motivo: m };
  return { ok: true, fluxo: { ...f, nos } };
}

/**
 * O atalho do editor: soltar um gatilho em cima de outro cria uma caixa OU com os dois (um em cada espaço). A caixa fica onde
 * estava o de baixo e herda os fios dos dois.
 */
export function agruparGatilhos<T extends Grafo>(
  f: T,
  idDoQueFoiSolto: string,
  idDoAlvo: string,
): { ok: true; fluxo: T; caixa: string } | { ok: false; motivo: string } {
  const a = f.nos.find((n) => n.id === idDoQueFoiSolto);
  const b = f.nos.find((n) => n.id === idDoAlvo);
  if (a?.tipo !== "gatilho" || b?.tipo !== "gatilho" || a.id === b.id)
    return { ok: false, motivo: "O atalho junta dois gatilhos." };
  if (a.em !== undefined || b.em !== undefined)
    return { ok: false, motivo: "Tire os gatilhos de dentro das caixas antes de juntar." };
  const id = idLivre(f.nos);
  const caixa: No = { id, tipo: "caixa", config: { porta: "ou" }, x: b.x, y: b.y };
  const nos: No[] = f.nos.flatMap((n): No[] => {
    if (n.id === a.id) return [];
    if (n.id === b.id) return [caixa, { ...b, em: id, espaco: 0 }, { ...a, em: id, espaco: 1 }];
    return [n];
  });
  const herdados = f.fios.filter((x) => x.de.no === a.id || x.de.no === b.id);
  const fios: Fio[] = f.fios.filter((x) => x.de.no !== a.id && x.de.no !== b.id);
  const vistos = new Set<string>();
  for (const x of herdados) {
    const chave = `${x.para.no}.${x.para.entrada}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    fios.push({ de: { no: id, saida: "saida" }, para: x.para });
  }
  return { ok: true, fluxo: { ...f, nos, fios: fiosValidos(nos, fios) }, caixa: id };
}

// --- A conversão do AU2 -------------------------------------------------------------------------

type Cru = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Cru => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Lê uma automação do AU2 (portas lógicas ligadas por fios, vários gatilhos ligados ao mesmo bloco) e a devolve com caixas:
 * - cada porta E/OU/NÃO vira uma caixa com as peças que entravam nela dentro, uma por espaço (A ou B ou C é uma caixa OU
 *   com três espaços); a peça que serve a mais de um lugar é copiada;
 * - os gatilhos que chamam exatamente os mesmos blocos viram uma caixa OU, um por espaço.
 * Também põe num espaço a peça guardada que veio sem `espaco`. Marca o fluxo (`caixas: true`) para o agrupamento de gatilhos
 * valer só uma vez. O motor chega ao mesmo resultado. Trabalha no valor cru (antes do esquema), para ler o que veio do disco,
 * de um arquivo ou de uma intenção.
 */
export function portasParaCaixas(bruto: unknown): unknown {
  if (!ehObjeto(bruto) || !Array.isArray(bruto.nos)) return bruto;
  const nosCrus = bruto.nos.filter(ehObjeto);
  const temPorta = nosCrus.some((n) => n.tipo === "porta");
  const semEspaco = nosCrus.some((n) => n.em !== undefined && n.espaco === undefined);
  if (!temPorta && !semEspaco && bruto.caixas === true) return bruto;
  const fiosCrus = (Array.isArray(bruto.fios) ? bruto.fios : []).filter(ehObjeto) as Cru[];

  let nos: Cru[] = nosCrus.map((n) => ({ ...n }));
  let fios: Cru[] = fiosCrus.map((x) => ({ ...x }));
  const usados = new Set<string>(nos.map((n) => String(n.id)));
  const novoId = (): string => {
    let i = usados.size + 1;
    while (usados.has(`n${i}`)) i++;
    usados.add(`n${i}`);
    return `n${i}`;
  };
  const de = (x: Cru) => (ehObjeto(x.de) ? x.de : {});
  const para = (x: Cru) => (ehObjeto(x.para) ? x.para : {});

  /** Põe cada entrada num espaço da caixa (a de um NÃO, só a primeira); passando de 12, o resto vai numa caixa dentro do último. */
  const guardar = (caixa: string, logica: unknown, entradas: string[]) => {
    const no = nos.find((n) => n.id === caixa);
    if (!no) return;
    const limite = logica === "nao" ? 1 : MAXIMO_DE_ESPACOS;
    const diretas =
      entradas.length > limite ? entradas.slice(0, limite - 1) : entradas.slice(0, limite);
    const resto = entradas.length > limite ? entradas.slice(limite - 1) : [];
    diretas.forEach((id, i) => {
      const n = nos.find((x) => x.id === id);
      if (n) {
        n.em = caixa;
        n.espaco = i;
      }
    });
    if (resto.length > 0) {
      const aninhada = novoId();
      nos.push({
        id: aninhada,
        tipo: "caixa",
        x: 0,
        y: 0,
        config: { porta: logica },
        em: caixa,
        espaco: diretas.length,
      });
      guardar(aninhada, logica, resto);
    }
    const config = ehObjeto(no.config) ? no.config : {};
    const total = Math.max(MINIMO_DE_ESPACOS, diretas.length + (resto.length > 0 ? 1 : 0));
    no.config = logica === "nao" ? { ...config } : { ...config, espacos: total };
  };

  if (temPorta) {
    for (const n of nos) if (n.tipo === "porta") n.tipo = "caixa";
    const ehCaixaCrua = (id: unknown) => nos.some((n) => n.id === id && n.tipo === "caixa");
    // As entradas de cada caixa, na ordem dos fios, e quantas vezes cada peça é usada.
    const entradas = new Map<string, string[]>();
    const restantes = new Map<string, number>();
    for (const x of fios) {
      const d = String(de(x).no);
      restantes.set(d, (restantes.get(d) ?? 0) + 1);
    }
    for (const x of fios) {
      const p = String(para(x).no);
      if (!ehCaixaCrua(p)) continue;
      entradas.set(p, [...(entradas.get(p) ?? []), String(de(x).no)]);
    }
    fios = fios.filter((x) => !ehCaixaCrua(para(x).no));
    for (const x of fios) {
      const d = de(x);
      if (ehCaixaCrua(d.no) && d.saida === "valor") d.saida = "saida";
    }
    // Cada uso de uma peça vira a própria peça (o último uso) ou uma cópia dela (com o que ela tinha dentro).
    const copiar = (origem: string, fundo: number): string => {
      const o = nos.find((n) => n.id === origem);
      if (o === undefined || fundo > 8) return origem;
      const id = novoId();
      const copia: Cru = { ...structuredClone(o), id };
      delete copia.em;
      delete copia.espaco;
      nos.push(copia);
      if (copia.tipo === "caixa") {
        const filhas = (entradas.get(origem) ?? []).map((f) => copiar(f, fundo + 1));
        guardar(id, ehObjeto(copia.config) ? copia.config.porta : undefined, filhas);
      }
      return id;
    };
    for (const caixa of [...entradas.keys()]) {
      const c = nos.find((n) => n.id === caixa);
      const lista = (entradas.get(caixa) ?? []).map((origem) => {
        const falta = (restantes.get(origem) ?? 0) - 1;
        restantes.set(origem, falta);
        return falta <= 0 ? origem : copiar(origem, 0);
      });
      guardar(caixa, ehObjeto(c?.config) ? c.config.porta : undefined, lista);
    }
    // Uma peça guardada não tem fios próprios.
    const guardado = new Set(nos.filter((n) => n.em !== undefined).map((n) => String(n.id)));
    fios = fios.filter((x) => !guardado.has(String(de(x).no)) && !guardado.has(String(para(x).no)));
  }

  // Gatilhos que chamam exatamente os mesmos blocos: uma caixa OU.
  if (bruto.caixas !== true) {
    const grupos = new Map<string, Cru[]>();
    for (const n of nos) {
      if (n.tipo !== "gatilho" || n.em !== undefined) continue;
      const alvos = fios
        .filter((x) => de(x).no === n.id)
        .map((x) => `${para(x).no}.${para(x).entrada}`);
      if (alvos.length === 0) continue;
      const chave = alvos.join("|");
      grupos.set(chave, [...(grupos.get(chave) ?? []), n]);
    }
    for (const grupo of grupos.values()) {
      const primeiro = grupo[0];
      if (grupo.length < 2 || primeiro === undefined) continue;
      const id = novoId();
      const ids = grupo.map((g) => String(g.id));
      const caixa: Cru = {
        id,
        tipo: "caixa",
        config: { porta: "ou" },
        x: primeiro.x ?? 0,
        y: primeiro.y ?? 0,
      };
      nos = nos.flatMap((n) => (n === primeiro ? [caixa, n] : [n]));
      guardar(id, "ou", ids);
      const herdados = fios.filter((x) => de(x).no === primeiro.id);
      fios = [
        ...fios.filter((x) => !ids.includes(String(de(x).no))),
        ...herdados.map((x) => ({ ...x, de: { no: id, saida: "saida" } })),
      ];
    }
  }

  // Quem ficou guardado sem espaço: vai no primeiro espaço livre da caixa.
  const usadoPor = new Map<string, Set<number>>();
  for (const n of nos) {
    if (n.em === undefined || typeof n.espaco !== "number") continue;
    const s = usadoPor.get(String(n.em)) ?? new Set<number>();
    s.add(n.espaco);
    usadoPor.set(String(n.em), s);
  }
  for (const n of nos) {
    if (n.em === undefined || typeof n.espaco === "number") continue;
    const s = usadoPor.get(String(n.em)) ?? new Set<number>();
    let livre = 0;
    while (s.has(livre)) livre++;
    n.espaco = livre;
    s.add(livre);
    usadoPor.set(String(n.em), s);
    const caixa = nos.find((x) => x.id === n.em);
    if (caixa && ehObjeto(caixa.config) && caixa.config.porta !== "nao") {
      const atual =
        typeof caixa.config.espacos === "number" ? caixa.config.espacos : MINIMO_DE_ESPACOS;
      if (livre + 1 > atual)
        caixa.config = { ...caixa.config, espacos: Math.min(MAXIMO_DE_ESPACOS, livre + 1) };
    }
  }
  return { ...bruto, nos, fios, caixas: true };
}
