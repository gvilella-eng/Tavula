import type { Estado } from "./estado.ts";
import type { AcaoDeFluxo, AlvoDoParaCada, Bloco, CondicaoDoSe, Fluxo, Gatilho } from "./fluxos.ts";

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

function pedacosDaLista(
  lista: readonly Bloco[],
  quem: Quem,
  f: Pick<Fluxo, "cenas">,
  n: NomesParaAFrase,
): Segmento[] {
  const segs: Segmento[] = [{ espera: 0, pedacos: [] }];
  const atual = () => segs.at(-1) as Segmento;
  for (const b of lista) {
    switch (b.bloco) {
      case "esperar":
        segs.push({ espera: b.s, pedacos: [] });
        break;
      case "acao":
        atual().pedacos.push(pedacoDaAcao(b.acao, quem, n));
        break;
      case "sinal":
        atual().pedacos.push({
          sujeito: null,
          predicado: `manda o sinal ${aspas(b.nome)}${b.atrasoS === undefined || b.atrasoS === 0 ? "" : ` daqui a ${tempoHumano(b.atrasoS)}`}`,
        });
        break;
      case "paraCada": {
        const quemNovo = descreverAlvo(b.alvo, f, n);
        atual().pedacos.push({
          sujeito: null,
          predicado:
            textoDaLista(b.corpo, quemNovo, f, n, false) || `${quemNovo} ainda não faz nada`,
        });
        break;
      }
      case "se": {
        const sim = textoDaLista(b.sim, quem, f, n, false) || "ainda não faz nada";
        const nao = b.nao.length === 0 ? "" : `; senão, ${textoDaLista(b.nao, quem, f, n, false)}`;
        atual().pedacos.push({
          sujeito: null,
          predicado: `se ${textoDaCondicao(b.condicao, quem, n)}, ${sim}${nao}`,
        });
        break;
      }
      case "sortear": {
        const sim = textoDaLista(b.sim, quem, f, n, false) || "ainda não faz nada";
        const nao = b.nao.length === 0 ? "" : `; senão, ${textoDaLista(b.nao, quem, f, n, false)}`;
        atual().pedacos.push({
          sujeito: null,
          predicado: `com ${pct(b.chance)} de chance, ${sim}${nao}`,
        });
        break;
      }
    }
  }
  return segs;
}

/** Os blocos de uma lista como texto. `topo`: frases separadas por ponto; senão, por ponto e vírgula. */
function textoDaLista(
  lista: readonly Bloco[],
  quem: Quem,
  f: Pick<Fluxo, "cenas">,
  n: NomesParaAFrase,
  topo: boolean,
): string {
  const segs = pedacosDaLista(lista, quem, f, n);
  const partes = segs.flatMap((s, i) => {
    const corpo = juntar(s.pedacos);
    if (i === 0) return corpo === "" ? [] : [corpo];
    return [
      corpo === ""
        ? `${tempoHumano(s.espera)} depois, nada`
        : `${tempoHumano(s.espera)} depois, ${corpo}`,
    ];
  });
  return partes.join(topo ? ". " : "; ");
}

/** O sujeito de um gatilho que traz alguém: "a tocha", "o token". */
function quemDoGatilho(g: Gatilho): Quem {
  if (g.tipo === "tocha") return "a tocha";
  if (g.tipo === "zona") return "o token";
  return null;
}

/** O fluxo inteiro em português, sem ids. */
export function fraseDoFluxo(
  f: Pick<Fluxo, "gatilho" | "trilhas" | "cenas">,
  n: NomesParaAFrase,
): string {
  const cabeca = fraseDoGatilho(f.gatilho, n);
  const cenas = nasCenas(f, n);
  const quem = quemDoGatilho(f.gatilho);
  const trilhas = f.trilhas.map((t) => textoDaLista(t, quem, f, n, true)).filter((t) => t !== "");
  const inicio = `${cabeca}${cenas === null ? "" : `, ${cenas}`}`;
  if (trilhas.length === 0) return `${inicio}: não faz nada ainda.`;
  const corpo = trilhas.map((t, i) => (i === 0 ? t : maiuscula(t))).join(". ");
  return `${inicio}: ${corpo}.`;
}
