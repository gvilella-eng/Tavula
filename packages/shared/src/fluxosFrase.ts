import type { Estado } from "./estado.ts";
import {
  type AcaoDeFluxo,
  type AlvoDoParaCada,
  type CondicaoDoSe,
  conteudoDaCaixa,
  ehNoDeValor,
  type Fluxo,
  type Gatilho,
  type No,
  type NoDe,
  noDosFios,
  pecasDaCaixa,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU1: o fluxo em português ("Em português:" do editor, a frase da lista, o `explicar` do MCP). Função PURA: recebe um
// jeito de achar o nome de cada cena, modelo e zona e nunca mostra um id.
//
// Exemplo: "A cada 3 min, no Pulmão: cada tocha acesa fica com metade da luz por 20 s e tem 30% de chance de apagar
// (perde 5 min). 90 s depois, a visão de cada token no Pulmão cai para 1,5 m por 30 s."
// ---------------------------------------------------------------------------------------------

export type NomesParaAFrase = {
  cena: (id: string) => string | undefined;
  modelo: (id: string) => string | undefined;
  zona: (id: string) => string | undefined;
};

/** Os nomes da mesa, para a frase. */
export function nomesDaMesa(e: Pick<Estado, "cenas" | "modelos" | "zonas">): NomesParaAFrase {
  return {
    cena: (id) => e.cenas.find((c) => c.id === id)?.nome,
    modelo: (id) => e.modelos.find((m) => m.id === id)?.nome,
    zona: (id) => (e.zonas ?? []).find((z) => z.id === id)?.nome,
  };
}

const APAGADO = "(apagado)";

/** Um número em português ("1,5"). */
export const numeroEmPortugues = (n: number): string =>
  String(Math.round(n * 100) / 100).replace(".", ",");

/** O tempo em linguagem humana: "20 s", "90 s", "3 min", "1 h". */
export function tempoHumano(s: number): string {
  const total = Math.round(s);
  if (total < 60) return `${numeroEmPortugues(s)} s`;
  if (total % 3600 === 0) return `${total / 3600} h`;
  if (total % 60 === 0) return `${total / 60} min`;
  if (total < 300) return `${total} s`;
  return `${Math.floor(total / 60)} min ${total % 60} s`;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const maiuscula = (t: string) =>
  t.length === 0 ? t : t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
const aspas = (t: string) => `“${t}”`;

function listaDeNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

function nasCenas(f: Pick<Fluxo, "cenas">, n: NomesParaAFrase): string | null {
  if (f.cenas === null || f.cenas.length === 0) return null;
  const nomes = f.cenas.map((c) => n.cena(c) ?? APAGADO);
  return `${nomes.length === 1 ? "na cena" : "nas cenas"} ${listaDeNomes(nomes)}`;
}

/** O "Quando", em português. */
export function fraseDoGatilho(g: Gatilho, n: NomesParaAFrase): string {
  switch (g.tipo) {
    case "relogio":
      return `A cada ${tempoHumano(g.cadaS)}${g.primeiroS !== undefined && g.primeiroS > 0 ? `, começando depois de ${tempoHumano(g.primeiroS)}` : ""}`;
    case "botao":
      return `Ao apertar o botão ${aspas(g.nome)}${g.cena === undefined ? "" : ` (na cena ${n.cena(g.cena) ?? APAGADO})`}`;
    case "sinal":
      return `Ao receber o sinal ${aspas(g.nome)}`;
    case "tocha": {
      const filtros = [
        g.modelo === undefined ? "" : `do modelo ${n.modelo(g.modelo) ?? APAGADO}`,
        g.etiqueta === undefined ? "" : `com a etiqueta ${aspas(g.etiqueta)}`,
      ].filter(Boolean);
      return `Quando uma tocha ${g.muda === "acende" ? "acende" : "apaga"}${filtros.length === 0 ? "" : ` (${filtros.join(" e ")})`}`;
    }
    case "zona":
      return g.zona === undefined
        ? `Quando um token ${g.quando === "entra" ? "entra numa zona" : "sai de uma zona"}`
        : `Quando um token ${g.quando === "entra" ? "entra na" : "sai da"} zona ${n.zona(g.zona) ?? APAGADO}`;
    case "turno":
      return "Quando começa o turno de alguém";
    case "cena":
      return g.cena === undefined
        ? "Quando a cena do grupo muda"
        : `Quando o grupo vai para a cena ${n.cena(g.cena) ?? APAGADO}`;
  }
}

type Quem = string | null;
/** Um pedaço de frase: o sujeito (quando a ação o usa) e o predicado. Sujeitos iguais de seguida se juntam com "e". */
type Pedaco = { sujeito: Quem; predicado: string };

function descreverAlvo(a: AlvoDoParaCada, f: Pick<Fluxo, "cenas">, n: NomesParaAFrase): string {
  if (a.tipo === "objetos") {
    const base =
      a.modelo === undefined
        ? "objeto de luz"
        : (n.modelo(a.modelo) ?? APAGADO).toLocaleLowerCase("pt-BR");
    // "cada tocha acesa": os modelos de luz são femininos (tocha, lanterna, fogueira; assumido).
    const aceso = a.acesos !== true ? "" : a.modelo === undefined ? "aceso" : "acesa";
    const partes = [
      `cada ${base}`,
      aceso,
      a.etiqueta === undefined ? "" : `com a etiqueta ${aspas(a.etiqueta)}`,
      a.naZona === undefined ? "" : `na zona ${n.zona(a.naZona) ?? APAGADO}`,
    ].filter(Boolean);
    return partes.join(" ");
  }
  if (a.ids !== undefined) return `cada um dos ${a.ids.length} tokens escolhidos`;
  const cenas = nasCenas(f, n);
  const partes = [
    "cada token",
    a.naZona === undefined ? "" : `na zona ${n.zona(a.naZona) ?? APAGADO}`,
    a.naCena === undefined ? "" : `na cena ${n.cena(a.naCena) ?? APAGADO}`,
    a.naZona === undefined && a.naCena === undefined && cenas !== null ? cenas : "",
  ].filter(Boolean);
  return partes.join(" ");
}

function pedacoDaAcao(a: AcaoDeFluxo, quem: Quem, n: NomesParaAFrase): Pedaco {
  const sujeito = quem;
  switch (a.acao) {
    case "luz.modificar": {
      const partes: string[] = [];
      if (a.raioX !== undefined) {
        partes.push(
          a.raioX === 0.5
            ? "fica com metade da luz"
            : `fica com a luz ×${numeroEmPortugues(a.raioX)}`,
        );
      }
      if (a.raioSomaM !== undefined) {
        partes.push(
          `${a.raioSomaM >= 0 ? "ganha" : "perde"} ${numeroEmPortugues(Math.abs(a.raioSomaM))} m de luz`,
        );
      }
      return { sujeito, predicado: `${partes.join(" e ")} por ${tempoHumano(a.porS ?? 30)}` };
    }
    case "objeto.apagar": {
      const chance =
        a.chance !== undefined && a.chance < 1
          ? `tem ${pct(a.chance)} de chance de apagar`
          : "apaga";
      const perde =
        a.penalidadeS !== undefined && a.penalidadeS > 0
          ? ` (perde ${tempoHumano(a.penalidadeS)})`
          : "";
      return { sujeito, predicado: `${chance}${perde}` };
    }
    case "objeto.ajustarTempo":
      return {
        sujeito,
        predicado: `${a.deltaS > 0 ? "ganha" : "perde"} ${tempoHumano(Math.abs(a.deltaS))} de tempo`,
      };
    case "visao.limitar":
      return {
        sujeito: null,
        predicado:
          `a visão ${quem === null ? "" : `de ${quem} `}cai para ${numeroEmPortugues(a.alcanceM)} m por ${tempoHumano(a.porS ?? 30)}`.replace(
            "  ",
            " ",
          ),
      };
    case "chat.anunciar":
      return {
        sujeito: null,
        predicado: `avisa ${a.para === "mestre" ? "só o mestre" : "no chat"}: ${aspas(a.texto)}`,
      };
    case "som.tocar":
      return { sujeito: null, predicado: `toca o som ${aspas(a.nome)}` };
    case "token.mostrar":
      return quem === null
        ? { sujeito: null, predicado: "mostra o token" }
        : { sujeito, predicado: "aparece" };
    case "token.ocultar":
      return quem === null
        ? { sujeito: null, predicado: "oculta o token" }
        : { sujeito, predicado: "some" };
    case "zona.ativar":
      return {
        sujeito: null,
        predicado: `${a.ativa ? "liga" : "desliga"} a zona ${n.zona(a.zona) ?? APAGADO}`,
      };
  }
}

function textoDaCondicao(c: CondicaoDoSe, quem: Quem, n: NomesParaAFrase): string {
  const alguem = quem ?? "o objeto";
  switch (c.condicao) {
    case "etiqueta":
      return `${alguem} tiver a etiqueta ${aspas(c.etiqueta)}`;
    case "dentroDaZona":
      return `${quem ?? "o alvo"} estiver na zona ${n.zona(c.zona) ?? APAGADO}`;
    case "cena":
      return `${quem ?? "o alvo"} estiver ${c.cenas.length === 1 ? "na cena" : "nas cenas"} ${listaDeNomes(c.cenas.map((x) => n.cena(x) ?? APAGADO))}`;
    case "zonaLigada":
      return `a zona ${n.zona(c.zona) ?? APAGADO} estiver ligada`;
    case "chance":
      return `o sorteio de ${pct(c.chance)} der certo`;
    case "tokenDeJogador":
      return `${quem ?? "o token"} for de um jogador`;
  }
}

function juntar(pedacos: Pedaco[]): string {
  const saida: Pedaco[] = [];
  for (const p of pedacos) {
    const ultimo = saida.at(-1);
    if (ultimo && p.sujeito !== null && ultimo.sujeito === p.sujeito)
      ultimo.predicado += ` e ${p.predicado}`;
    else saida.push({ ...p });
  }
  return saida
    .map((p) => (p.sujeito === null ? p.predicado : `${p.sujeito} ${p.predicado}`))
    .join(" e ");
}

type Segmento = { espera: number; pedacos: Pedaco[] };

// --- O grafo em português (AU2) --------------------------------------------------------------

type Grafo = {
  f: Pick<Fluxo, "nos" | "fios" | "cenas">;
  n: NomesParaAFrase;
  porId: Map<string, No>;
};

const sucessores = (g: Grafo, id: string, porta?: string): No[] => {
  // AU3: o gatilho dentro de uma caixa segue os fios da caixa.
  const origem = noDosFios(g.f.nos, id);
  return g.f.fios
    .filter((x) => x.de.no === origem && (porta === undefined || x.de.saida === porta))
    .flatMap((x) => {
      const no = g.porId.get(x.para.no);
      return no === undefined || ehNoDeValor(no, g.f.nos) ? [] : [no];
    });
};

/** Uma condição, uma porta lógica ou uma cadeia delas, como texto ("o token for de um jogador E o sorteio de 50% der certo"). */
function textoDoValor(g: Grafo, id: string, quem: Quem, pilha: ReadonlySet<string>): string {
  const no = g.porId.get(id);
  if (no === undefined || pilha.has(id)) return "…";
  if (no.tipo === "condicao") return textoDaCondicao(no.config, quem, g.n);
  if (no.tipo !== "caixa") return "…";
  const entradas = pecasDaCaixa(g.f.nos, id).map((x) => x.id);
  const depois = new Set([...pilha, id]);
  const operando = (e: string): string => {
    const t = textoDoValor(g, e, quem, depois);
    return g.porId.get(e)?.tipo === "caixa" ? `(${t})` : t;
  };
  if (entradas.length === 0) return "…";
  if (no.config.porta === "nao") return `NÃO ${operando(entradas[0] as string)}`;
  // AU3: a caixa E ou OU junta os espaços com "e" ou "ou" ("a e b e c"); a caixa dentro de caixa vai entre parênteses.
  return entradas.map(operando).join(no.config.porta === "e" ? " e " : " ou ");
}

/** Uma peça de ação (ou a caixa de ação) em pedaços de frase: "E" faz as duas coisas, "OU" sorteia uma. */
function pedacosDaPecaDeAcao(g: Grafo, no: No, quem: Quem): Pedaco[] {
  if (no.tipo === "acao") return [pedacoDaAcao(no.config.acao, quem, g.n)];
  if (no.tipo === "sinal")
    return [{ sujeito: null, predicado: `manda o sinal ${aspas(no.config.nome)}` }];
  if (no.tipo !== "caixa") return [];
  const filhas = pecasDaCaixa(g.f.nos, no.id);
  if (no.config.porta === "e") return filhas.flatMap((x) => pedacosDaPecaDeAcao(g, x, quem));
  const opcoes = filhas.map((x) => juntar(pedacosDaPecaDeAcao(g, x, quem)));
  return [
    { sujeito: null, predicado: `sorteia uma destas: ${opcoes.map((t) => `(${t})`).join(" ou ")}` },
  ];
}

/** Os nós de ordem que se alcança a partir de `inicios` (largura primeiro). */
function alcance(g: Grafo, inicios: readonly No[]): string[] {
  const vistos = new Set<string>();
  const ordem: string[] = [];
  const fila = [...inicios];
  while (fila.length > 0) {
    const no = fila.shift();
    if (no === undefined || vistos.has(no.id)) continue;
    vistos.add(no.id);
    ordem.push(no.id);
    fila.push(...sucessores(g, no.id));
  }
  return ordem;
}

/** Onde os dois ramos de um "se" ou "sortear" voltam a se encontrar (o primeiro bloco que os dois alcançam), se voltam. */
function pontoDeEncontro(g: Grafo, no: No): string | undefined {
  const sim = alcance(g, sucessores(g, no.id, "sim"));
  const nao = new Set(alcance(g, sucessores(g, no.id, "nao")));
  return sim.find((id) => nao.has(id));
}

type Passo = { g: Grafo; quem: Quem; parar: ReadonlySet<string>; pilha: ReadonlySet<string> };

/** O que acontece a partir de uma porta de um nó, como texto (vários fios = caminhos ao mesmo tempo). */
function textoDaPorta(p: Passo, no: No, porta: string | undefined): string {
  const textos = sucessores(p.g, no.id, porta)
    .map((s) => textoDaCadeia(p, s.id))
    .filter((t) => t !== "");
  if (textos.length <= 1) return textos[0] ?? "";
  return `ao mesmo tempo, ${textos.map((t) => `(${t})`).join(" e ")}`;
}

/** Segue uma cadeia de blocos a partir de `inicio`, como uma frase ("faz isso; 90 s depois, faz aquilo"). */
function textoDaCadeia(p0: Passo, inicio: string): string {
  const { g } = p0;
  const segs: Segmento[] = [{ espera: 0, pedacos: [] }];
  const atual = () => segs.at(-1) as Segmento;
  let pilha = new Set(p0.pilha);
  let id: string | undefined = inicio;
  while (id !== undefined) {
    const no = g.porId.get(id);
    if (no === undefined || ehNoDeValor(no, g.f.nos) || p0.parar.has(id)) break;
    if (pilha.has(id)) {
      atual().pedacos.push({ sujeito: null, predicado: "volta a repetir" });
      break;
    }
    pilha = new Set([...pilha, id]);
    const p: Passo = { ...p0, pilha };
    let proximo: string | undefined;
    const continuar = (porta: string | undefined) => {
      const sucs = sucessores(g, no.id, porta);
      if (sucs.length === 1) {
        proximo = sucs[0]?.id;
      } else if (sucs.length > 1) {
        const t = textoDaPorta(p, no, porta);
        if (t !== "") atual().pedacos.push({ sujeito: null, predicado: t });
      }
    };
    switch (no.tipo) {
      case "gatilho":
        continuar("saida");
        break;
      case "caixa":
        atual().pedacos.push(...pedacosDaPecaDeAcao(g, no, p0.quem));
        continuar("saida");
        break;
      case "esperar":
        segs.push({ espera: no.config.s, pedacos: [] });
        continuar("saida");
        break;
      case "acao":
        atual().pedacos.push(pedacoDaAcao(no.config.acao, p0.quem, g.n));
        continuar("saida");
        break;
      case "sinal":
        atual().pedacos.push({
          sujeito: null,
          predicado: `manda o sinal ${aspas(no.config.nome)}${no.config.atrasoS === undefined || no.config.atrasoS === 0 ? "" : ` daqui a ${tempoHumano(no.config.atrasoS)}`}`,
        });
        continuar("saida");
        break;
      case "paraCada": {
        const quemNovo = descreverAlvo(no.config.alvo, g.f, g.n);
        const dentro = textoDaPorta({ ...p, quem: quemNovo }, no, "corpo");
        atual().pedacos.push({
          sujeito: null,
          predicado: dentro || `${quemNovo} ainda não faz nada`,
        });
        continuar("depois");
        break;
      }
      case "se":
      case "sortear": {
        const encontro = pontoDeEncontro(g, no);
        const dentro: Passo = {
          ...p,
          parar: encontro === undefined ? p.parar : new Set([...p.parar, encontro]),
        };
        const sim = textoDaPorta(dentro, no, "sim") || "ainda não faz nada";
        const naoTexto = textoDaPorta(dentro, no, "nao");
        const nao = naoTexto === "" ? "" : `; senão, ${naoTexto}`;
        let cabeca: string;
        if (no.tipo === "sortear") {
          cabeca = `com ${pct(no.config.chance)} de chance`;
        } else {
          const cond = g.f.fios.find((x) => x.para.no === no.id && x.para.entrada === "condicao");
          cabeca = `se ${cond === undefined ? "…" : textoDoValor(g, cond.de.no, p0.quem, new Set())}`;
        }
        atual().pedacos.push({ sujeito: null, predicado: `${cabeca}, ${sim}${nao}` });
        proximo = encontro;
        break;
      }
      default:
        break;
    }
    id = proximo;
  }
  const partes = segs.flatMap((s, i) => {
    const corpo = juntar(s.pedacos);
    if (i === 0) return corpo === "" ? [] : [corpo];
    return [
      corpo === ""
        ? `${tempoHumano(s.espera)} depois, nada`
        : `${tempoHumano(s.espera)} depois, ${corpo}`,
    ];
  });
  return partes.join("; ");
}

/** O sujeito de um gatilho que traz alguém: "a tocha", "o token". */
function quemDoGatilho(g: Gatilho): Quem {
  if (g.tipo === "tocha") return "a tocha";
  if (g.tipo === "zona") return "o token";
  return null;
}

const minuscula = (t: string) =>
  t.length === 0 ? t : t.charAt(0).toLocaleLowerCase("pt-BR") + t.slice(1);

/** O fluxo inteiro em português, sem ids. Vários gatilhos juntos são um OU: qualquer um dispara. */
export function fraseDoFluxo(f: Pick<Fluxo, "nos" | "fios" | "cenas">, n: NomesParaAFrase): string {
  const g: Grafo = { f, n, porId: new Map(f.nos.map((x) => [x.id, x])) };
  const gatilhos = f.nos.filter((x): x is NoDe<"gatilho"> => x.tipo === "gatilho");
  if (gatilhos.length === 0) return "Sem gatilho ainda: não roda.";
  // AU3: a caixa de gatilho vira "Quando qualquer um destes acontecer (a, ou b)" (OU) ou "a, mas só se c" (gatilho E condição). Só
  // entram na cabeça as peças de fora (um gatilho solto ou uma caixa solta); o que está dentro de uma caixa aparece nela.
  const ehPecaDeGatilho = (x: No): boolean =>
    x.tipo === "gatilho" || (x.tipo === "caixa" && conteudoDaCaixa(f.nos, x.id) === "gatilho");
  const folhas = (x: No): number =>
    x.tipo === "gatilho"
      ? 1
      : pecasDaCaixa(f.nos, x.id)
          .filter(ehPecaDeGatilho)
          .reduce((t, y) => t + folhas(y), 0);
  const textoDeGatilho = (x: No): string => {
    if (x.tipo === "gatilho") return minuscula(fraseDoGatilho(x.config, n));
    if (x.tipo !== "caixa") return "…";
    const dentro = pecasDaCaixa(f.nos, x.id);
    const gat = dentro.filter(ehPecaDeGatilho).map(textoDeGatilho);
    if (x.config.porta === "ou") return gat.join(", ou ");
    const condicoes = dentro
      .filter((y) => !ehPecaDeGatilho(y))
      .map((y) => textoDoValor(g, y.id, null, new Set()));
    return `${gat.join(", ou ")}, mas só se ${condicoes.join(" e ")}`;
  };
  const deFora = f.nos.filter((x) => x.em === undefined && ehPecaDeGatilho(x));
  const cabeca = deFora
    .map((x, i) => {
      const t =
        x.tipo === "caixa" && x.config.porta === "ou" && folhas(x) > 1
          ? `Quando qualquer um destes acontecer (${textoDeGatilho(x)})`
          : textoDeGatilho(x);
      return i === 0 ? maiuscula(t) : minuscula(t);
    })
    .join(", ou ");
  const cenas = nasCenas(f, n);
  const quens = gatilhos.map((x) => quemDoGatilho(x.config));
  const quem = quens.every((q) => q !== null && q === quens[0]) ? (quens[0] ?? null) : null;
  // Os blocos que os gatilhos chamam (o que dois gatilhos chamam em comum vale uma vez só).
  const primeiros = new Map<string, No>();
  for (const x of gatilhos) for (const s of sucessores(g, x.id)) primeiros.set(s.id, s);
  if (cabeca === "") return "Sem gatilho ainda: não roda.";
  const trilhas = [...primeiros.values()]
    .map((s) => textoDaCadeia({ g, quem, parar: new Set(), pilha: new Set() }, s.id))
    .filter((t) => t !== "");
  const inicio = `${cabeca}${cenas === null ? "" : `, ${cenas}`}`;
  if (trilhas.length === 0) return `${inicio}: não faz nada ainda.`;
  const corpo = trilhas.map((t, i) => (i === 0 ? t : maiuscula(t))).join(". ");
  return `${inicio}: ${corpo}.`;
}
