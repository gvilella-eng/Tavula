import {
  type AcaoDeFluxo,
  type Bloco,
  type Estado,
  type Fluxo,
  FluxoSchema,
  type Gatilho,
  type NomesParaAFrase,
  nomesDaMesa,
  numeroEmPortugues,
  problemasDoFluxo,
  referenciasDaMesa,
  tempoHumano,
} from "@tabletop/shared";
import { errosEmPortugues } from "./erros";

// O que o editor por blocos sabe fazer com a árvore do fluxo (AU1): caminhos, inserir, tirar, mover, os rótulos das peças
// e os erros por bloco. Tudo puro: o editor guarda o `Fluxo` num estado do React e troca por uma cópia a cada edição.

/** `[trilha, i, "sim", j, ...]`: o caminho de um bloco. O de uma lista é o mesmo sem o último índice. */
export type Caminho = (number | string)[];

export type Selecao = { tipo: "gatilho" } | { tipo: "bloco"; caminho: Caminho };

/** O id de HTML de um caminho (`t0-b1-sim-b2`): serve de `data-testid` e de chave. */
export function idDoCaminho(c: readonly (number | string)[]): string {
  return c
    .map((p, i) => {
      if (i === 0) return `t${p}`;
      return typeof p === "number" ? `b${p}` : p;
    })
    .join("-");
}

export const caminhoDeLista = (c: readonly (number | string)[]): Caminho => c.slice(0, -1);
const indiceDe = (c: readonly (number | string)[]): number => Number(c.at(-1));

/** A lista de blocos no caminho `[t]` ou `[t, i, "sim"]`. */
export function listaEm(
  f: Pick<Fluxo, "trilhas">,
  lista: readonly (number | string)[],
): Bloco[] | undefined {
  let atual: Bloco[] | undefined = f.trilhas[Number(lista[0])];
  for (let k = 1; k + 1 < lista.length + 1 && atual !== undefined; k += 2) {
    const i = lista[k];
    const ramo = lista[k + 1];
    if (i === undefined || ramo === undefined) break;
    const b: Bloco | undefined = atual[Number(i)];
    if (b === undefined) return undefined;
    if ((b.bloco === "se" || b.bloco === "sortear") && (ramo === "sim" || ramo === "nao")) {
      atual = ramo === "sim" ? b.sim : b.nao;
    } else if (b.bloco === "paraCada" && ramo === "corpo") atual = b.corpo;
    else return undefined;
  }
  return atual;
}

export function blocoEm(
  f: Pick<Fluxo, "trilhas">,
  caminho: readonly (number | string)[],
): Bloco | undefined {
  return listaEm(f, caminhoDeLista(caminho))?.[indiceDe(caminho)];
}

const copia = <T>(v: T): T => structuredClone(v);

export function inserirEm(
  f: Fluxo,
  lista: readonly (number | string)[],
  indice: number,
  bloco: Bloco,
): Fluxo {
  const novo = copia(f);
  const alvo = listaEm(novo, lista);
  if (alvo === undefined) return f;
  alvo.splice(Math.max(0, Math.min(indice, alvo.length)), 0, bloco);
  return novo;
}

export function tirarEm(f: Fluxo, caminho: readonly (number | string)[]): Fluxo {
  const novo = copia(f);
  const alvo = listaEm(novo, caminhoDeLista(caminho));
  if (alvo === undefined) return f;
  alvo.splice(indiceDe(caminho), 1);
  return novo;
}

export function trocarEm(f: Fluxo, caminho: readonly (number | string)[], bloco: Bloco): Fluxo {
  const novo = copia(f);
  const alvo = listaEm(novo, caminhoDeLista(caminho));
  if (alvo === undefined) return f;
  alvo[indiceDe(caminho)] = bloco;
  return novo;
}

const ehPrefixo = (prefixo: readonly (number | string)[], c: readonly (number | string)[]) =>
  prefixo.length <= c.length && prefixo.every((p, i) => p === c[i]);

/**
 * Move o bloco `de` para a lista `para`, na posição `indice` (contada na lista ANTES de tirar o bloco). Não deixa pôr um
 * bloco dentro de si mesmo. Devolve o fluxo novo e o caminho que o bloco passou a ter.
 */
export function moverBloco(
  f: Fluxo,
  de: readonly (number | string)[],
  para: readonly (number | string)[],
  indice: number,
): { fluxo: Fluxo; caminho: Caminho } | null {
  if (ehPrefixo(de, para)) return null;
  const bloco = blocoEm(f, de);
  if (bloco === undefined) return null;
  const listaDe = caminhoDeLista(de);
  const mesmaLista = listaDe.length === para.length && ehPrefixo(listaDe, para);
  // Tirar o bloco desloca os índices de quem vem depois dele, na mesma lista ou numa lista de dentro de um irmão seguinte.
  let paraAjustado: Caminho = [...para];
  let destino = indice;
  if (mesmaLista && indice > indiceDe(de)) destino = indice - 1;
  else if (!mesmaLista && ehPrefixo(listaDe, para) && para.length > listaDe.length) {
    const posicao = listaDe.length;
    const irmao = Number(para[posicao]);
    if (irmao > indiceDe(de)) paraAjustado = para.map((p, k) => (k === posicao ? irmao - 1 : p));
  }
  const semBloco = tirarEm(f, de);
  const comBloco = inserirEm(semBloco, paraAjustado, destino, bloco);
  return { fluxo: comBloco, caminho: [...paraAjustado, destino] };
}

/** Os caminhos de todos os blocos, na ordem em que aparecem (de cima para baixo, da esquerda para a direita). */
export function caminhosDosBlocos(f: Pick<Fluxo, "trilhas">): Caminho[] {
  const saida: Caminho[] = [];
  const anda = (lista: readonly Bloco[], prefixo: Caminho) => {
    for (const [i, b] of lista.entries()) {
      const c = [...prefixo, i];
      saida.push(c);
      if (b.bloco === "se" || b.bloco === "sortear") {
        anda(b.sim, [...c, "sim"]);
        anda(b.nao, [...c, "nao"]);
      } else if (b.bloco === "paraCada") anda(b.corpo, [...c, "corpo"]);
    }
  };
  for (const [t, trilha] of f.trilhas.entries()) anda(trilha, [t]);
  return saida;
}

// --- As peças ----------------------------------------------------------------------------------

export type GrupoDePeca = "quando" | "fluxo" | "faca";

export type Peca = {
  id: string;
  grupo: GrupoDePeca;
  rotulo: string;
  /** O gatilho ou o bloco que a peça cria, com valores que já passam no schema. */
  criar: () => { gatilho: Gatilho } | { bloco: Bloco };
};

const acao = (a: AcaoDeFluxo): Bloco => ({ bloco: "acao", acao: a });

export const PECAS: readonly Peca[] = [
  {
    id: "relogio",
    grupo: "quando",
    rotulo: "A cada… (relógio)",
    criar: () => ({ gatilho: { tipo: "relogio", cadaS: 60 } }),
  },
  {
    id: "botao",
    grupo: "quando",
    rotulo: "Ao apertar um botão",
    criar: () => ({ gatilho: { tipo: "botao", nome: "Meu botão" } }),
  },
  {
    id: "tocha",
    grupo: "quando",
    rotulo: "Tocha acende ou apaga",
    criar: () => ({ gatilho: { tipo: "tocha", muda: "acende" } }),
  },
  {
    id: "zona",
    grupo: "quando",
    rotulo: "Token entra ou sai de zona",
    criar: () => ({ gatilho: { tipo: "zona", quando: "entra" } }),
  },
  {
    id: "turno",
    grupo: "quando",
    rotulo: "Começa um turno",
    criar: () => ({ gatilho: { tipo: "turno" } }),
  },
  {
    id: "cena",
    grupo: "quando",
    rotulo: "Cena é ativada",
    criar: () => ({ gatilho: { tipo: "cena" } }),
  },
  {
    id: "sinal",
    grupo: "quando",
    rotulo: "Ao receber um sinal",
    criar: () => ({ gatilho: { tipo: "sinal", nome: "sinal" } }),
  },

  {
    id: "esperar",
    grupo: "fluxo",
    rotulo: "Esperar",
    criar: () => ({ bloco: { bloco: "esperar", s: 10 } }),
  },
  {
    id: "se",
    grupo: "fluxo",
    rotulo: "Se… (condição)",
    criar: () => ({
      bloco: {
        bloco: "se",
        condicao: { condicao: "etiqueta", etiqueta: "chama" },
        sim: [],
        nao: [],
      },
    }),
  },
  {
    id: "sortear",
    grupo: "fluxo",
    rotulo: "Sortear (chance)",
    criar: () => ({ bloco: { bloco: "sortear", chance: 0.5, sim: [], nao: [] } }),
  },
  {
    id: "paraCada",
    grupo: "fluxo",
    rotulo: "Para cada (tochas, tokens)",
    criar: () => ({
      bloco: { bloco: "paraCada", alvo: { tipo: "objetos", acesos: true }, corpo: [] },
    }),
  },

  {
    id: "luz",
    grupo: "faca",
    rotulo: "Luz",
    criar: () => ({ bloco: acao({ acao: "luz.modificar", raioX: 0.5, porS: 20 }) }),
  },
  {
    id: "apagar",
    grupo: "faca",
    rotulo: "Apagar a tocha",
    criar: () => ({ bloco: acao({ acao: "objeto.apagar", chance: 1 }) }),
  },
  {
    id: "tempo",
    grupo: "faca",
    rotulo: "Tempo da tocha",
    criar: () => ({ bloco: acao({ acao: "objeto.ajustarTempo", deltaS: -60 }) }),
  },
  {
    id: "visao",
    grupo: "faca",
    rotulo: "Limitar a visão",
    criar: () => ({ bloco: acao({ acao: "visao.limitar", alcanceM: 1.5, porS: 30 }) }),
  },
  {
    id: "chat",
    grupo: "faca",
    rotulo: "Avisar no chat",
    criar: () => ({ bloco: acao({ acao: "chat.anunciar", texto: "", para: "todos" }) }),
  },
  {
    id: "som",
    grupo: "faca",
    rotulo: "Tocar som",
    criar: () => ({
      bloco: acao({ acao: "som.tocar", hash: "", nome: "", volume: 0.8, para: "todos" }),
    }),
  },
  {
    id: "mostrar",
    grupo: "faca",
    rotulo: "Mostrar ou ocultar token",
    criar: () => ({ bloco: acao({ acao: "token.ocultar" }) }),
  },
  {
    id: "zonaLigar",
    grupo: "faca",
    rotulo: "Ligar ou desligar zona",
    criar: () => ({ bloco: acao({ acao: "zona.ativar", zona: "", ativa: true }) }),
  },
  {
    id: "sinalMandar",
    grupo: "faca",
    rotulo: "Mandar um sinal",
    criar: () => ({ bloco: { bloco: "sinal", nome: "sinal" } }),
  },
];

export const ROTULO_DO_GRUPO: Record<GrupoDePeca, string> = {
  quando: "Quando",
  fluxo: "Fluxo",
  faca: "Faça",
};

/** O fluxo novo: um relógio com uma trilha vazia. */
export function fluxoNovo(id: string): Fluxo {
  // Sem `parse`: o nome vazio é um erro que o editor mostra, não um motivo para a tela nascer quebrada.
  return {
    id,
    nome: "",
    ligado: true,
    cenas: null,
    gatilho: { tipo: "relogio", cadaS: 60 },
    trilhas: [[]],
  };
}

/** O grupo (a cor) de um bloco. */
export const grupoDoBloco = (b: Bloco): GrupoDePeca =>
  b.bloco === "acao" || b.bloco === "sinal" ? "faca" : "fluxo";

// --- Os rótulos dos blocos ---------------------------------------------------------------------

export type Rotulo = { titulo: string; detalhe: string };

const num = numeroEmPortugues;

export function rotuloDoGatilho(g: Gatilho, n: NomesParaAFrase): Rotulo {
  switch (g.tipo) {
    case "relogio":
      return { titulo: `A cada ${tempoHumano(g.cadaS)}`, detalhe: "relógio da mesa" };
    case "botao":
      return {
        titulo: `Botão “${g.nome}”`,
        detalhe:
          g.cena === undefined ? "em todas as cenas" : `na cena ${n.cena(g.cena) ?? "(apagada)"}`,
      };
    case "sinal":
      return { titulo: `Sinal “${g.nome}”`, detalhe: "ao receber" };
    case "tocha":
      return {
        titulo: `Tocha ${g.muda === "acende" ? "acende" : "apaga"}`,
        detalhe:
          [
            g.modelo === undefined ? "" : (n.modelo(g.modelo) ?? "(apagado)"),
            g.etiqueta === undefined ? "" : `etiqueta ${g.etiqueta}`,
          ]
            .filter(Boolean)
            .join(" · ") || "qualquer uma",
      };
    case "zona":
      return {
        titulo: `Token ${g.quando === "entra" ? "entra" : "sai"}`,
        detalhe:
          g.zona === undefined ? "de qualquer zona" : `zona ${n.zona(g.zona) ?? "(apagada)"}`,
      };
    case "turno":
      return { titulo: "Começa um turno", detalhe: "no combate" };
    case "cena":
      return {
        titulo: "Cena ativada",
        detalhe: g.cena === undefined ? "qualquer cena" : (n.cena(g.cena) ?? "(apagada)"),
      };
  }
}

export function rotuloDoBloco(b: Bloco, n: NomesParaAFrase): Rotulo {
  switch (b.bloco) {
    case "esperar":
      return { titulo: `Esperar ${tempoHumano(b.s)}`, detalhe: "depois do bloco anterior" };
    case "se": {
      const c = b.condicao;
      const detalhe =
        c.condicao === "etiqueta"
          ? `etiqueta ${c.etiqueta}`
          : c.condicao === "dentroDaZona"
            ? `dentro da zona ${n.zona(c.zona) ?? "(apagada)"}`
            : c.condicao === "zonaLigada"
              ? `zona ${n.zona(c.zona) ?? "(apagada)"} ligada`
              : `em ${c.cenas.map((x) => n.cena(x) ?? "(apagada)").join(", ")}`;
      return { titulo: "Se", detalhe };
    }
    case "sortear":
      return { titulo: "Sortear", detalhe: `${Math.round(b.chance * 100)}%` };
    case "paraCada": {
      const a = b.alvo;
      if (a.tipo === "objetos") {
        const partes = [
          a.modelo === undefined ? "objetos" : (n.modelo(a.modelo) ?? "(apagado)"),
          a.acesos === true ? "acesos" : "",
          a.etiqueta === undefined ? "" : `etiqueta ${a.etiqueta}`,
          a.naZona === undefined ? "" : `na zona ${n.zona(a.naZona) ?? "(apagada)"}`,
        ].filter(Boolean);
        return { titulo: "Para cada objeto", detalhe: partes.join(", ") };
      }
      const partes = [
        a.naZona === undefined ? "" : `na zona ${n.zona(a.naZona) ?? "(apagada)"}`,
        a.naCena === undefined ? "" : `na cena ${n.cena(a.naCena) ?? "(apagada)"}`,
        a.ids === undefined ? "" : `${a.ids.length} escolhidos`,
      ].filter(Boolean);
      return { titulo: "Para cada token", detalhe: partes.join(", ") || "nas cenas do fluxo" };
    }
    case "sinal":
      return {
        titulo: `Sinal “${b.nome}”`,
        detalhe:
          b.atrasoS === undefined || b.atrasoS === 0
            ? "agora"
            : `daqui a ${tempoHumano(b.atrasoS)}`,
      };
    case "acao": {
      const a = b.acao;
      switch (a.acao) {
        case "luz.modificar": {
          const partes = [
            a.raioX === undefined ? "" : `×${num(a.raioX)}`,
            a.raioSomaM === undefined
              ? ""
              : `${a.raioSomaM >= 0 ? "+" : "−"}${num(Math.abs(a.raioSomaM))} m`,
          ].filter(Boolean);
          return { titulo: `Luz ${partes.join(" ")}`, detalhe: `por ${tempoHumano(a.porS ?? 30)}` };
        }
        case "objeto.apagar":
          return {
            titulo: "Apagar a tocha",
            detalhe: [
              a.chance !== undefined && a.chance < 1 ? `${Math.round(a.chance * 100)}%` : "sempre",
              a.penalidadeS ? `perde ${tempoHumano(a.penalidadeS)}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          };
        case "objeto.ajustarTempo":
          return {
            titulo: "Tempo da tocha",
            detalhe: `${a.deltaS > 0 ? "+" : "−"}${tempoHumano(Math.abs(a.deltaS))}`,
          };
        case "visao.limitar":
          return {
            titulo: `Visão ${num(a.alcanceM)} m`,
            detalhe: `por ${tempoHumano(a.porS ?? 30)}`,
          };
        case "chat.anunciar":
          return {
            titulo: a.para === "mestre" ? "Avisar o mestre" : "Avisar no chat",
            detalhe: a.texto === "" ? "(sem texto)" : `“${a.texto}”`,
          };
        case "som.tocar":
          return { titulo: "Tocar som", detalhe: a.nome === "" ? "(escolha um som)" : a.nome };
        case "token.mostrar":
          return { titulo: "Mostrar o token", detalhe: "" };
        case "token.ocultar":
          return { titulo: "Ocultar o token", detalhe: "" };
        case "zona.ativar":
          return {
            titulo: `${a.ativa ? "Ligar" : "Desligar"} zona`,
            detalhe: a.zona === "" ? "(escolha uma zona)" : (n.zona(a.zona) ?? "(apagada)"),
          };
      }
    }
  }
}

// --- Os erros por bloco ------------------------------------------------------------------------

/** O erro e onde ele aparece: `caminho` é o do bloco (`t0-b1-sim-b2`), ou `nome`, `gatilho`, `cenas`, `geral`. */
export type ErroDoEditor = { onde: string; texto: string };

/** Todos os problemas do fluxo, em português, cada um preso ao bloco que o tem. Vazio = pode salvar. */
export function errosDoFluxo(f: Fluxo, estado: Estado): ErroDoEditor[] {
  const saida: ErroDoEditor[] = [];
  const visto = new Set<string>();
  const poe = (onde: string, texto: string) => {
    const chave = `${onde}|${texto}`;
    if (visto.has(chave)) return;
    visto.add(chave);
    saida.push({ onde, texto });
  };
  const nova = FluxoSchema.safeParse(f);
  if (!nova.success) {
    for (const issue of nova.error.issues) {
      const e = errosEmPortugues({ issues: [issue] })[0];
      // O bloco é o prefixo do caminho: ["trilhas", t, i, "sim", j, "acao", "raioX"] -> t, i, "sim", j.
      const p = issue.path;
      if (p[0] === "nome") poe("nome", e?.mensagem ?? issue.message);
      else if (p[0] === "gatilho") poe("gatilho", e?.mensagem ?? issue.message);
      else if (p[0] === "cenas") poe("cenas", e?.mensagem ?? issue.message);
      else if (p[0] === "trilhas") {
        const c: Caminho = [];
        for (const parte of p.slice(1)) {
          if (typeof parte === "number" || parte === "sim" || parte === "nao" || parte === "corpo")
            c.push(parte);
          else break;
        }
        // Um erro na lista (o "sim" vazio) é do bloco dono dela.
        if (typeof c.at(-1) === "string") c.pop();
        poe(c.length === 0 ? "geral" : idDoCaminho(c), e?.texto ?? issue.message);
      } else poe("geral", e?.texto ?? issue.message);
    }
  }
  for (const p of problemasDoFluxo(f, referenciasDaMesa(estado))) {
    const partes = p.caminho.split(".");
    if (partes[0] === "trilhas") {
      const c: Caminho = partes.slice(1).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
      if (typeof c.at(-1) === "string") c.pop();
      poe(c.length <= 1 ? (c.length === 0 ? "geral" : `t${c[0]}`) : idDoCaminho(c), p.mensagem);
    } else poe(partes[0] ?? "geral", p.mensagem);
  }
  return saida;
}

export { nomesDaMesa };
