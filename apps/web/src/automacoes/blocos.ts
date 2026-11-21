import {
  type AcaoDeFluxo,
  ALTURA_DA_PECA,
  alturaDoNo as alturaDoNoDoGrafo,
  conteudoDaCaixa,
  type DestinoNaCaixa,
  type Estado,
  type Fio,
  type Fluxo,
  FluxoSchema,
  type Gatilho,
  LARGURA_DA_CAIXA,
  LARGURA_DO_NO,
  larguraDaCaixa,
  motivoDaRecusa,
  NOMES_DAS_CAIXAS,
  type No,
  type NomesParaAFrase,
  nomesDaMesa,
  numeroEmPortugues,
  pecasDaCaixa,
  portasDoNo,
  problemasDoFluxo,
  referenciasDaMesa,
  tempoHumano,
} from "@tabletop/shared";
import { errosEmPortugues } from "./erros";

// O que o editor em grade sabe fazer com o grafo (AU2): as peças da paleta, os rótulos dos nós, a geometria das portas e
// os erros por nó. Tudo puro: o editor guarda o `Fluxo` num estado do React e troca por uma cópia a cada edição.

/** O que o editor tem escolhido: nós, e no máximo um fio. */
export type Selecao = { nos: readonly string[]; fio: string | null };
export const SEM_SELECAO: Selecao = { nos: [], fio: null };

// --- As peças ----------------------------------------------------------------------------------

export type GrupoDePeca = "quando" | "fluxo" | "condicao" | "logica" | "faca";

/** Um nó novo, sem o id e a posição (o editor dá). */
export type NoNovo = No extends infer T
  ? T extends No
    ? Omit<T, "id" | "x" | "y">
    : never
  : never;

export type Peca = {
  id: string;
  grupo: GrupoDePeca;
  rotulo: string;
  /** O nó que a peça cria, com valores que já passam no schema. */
  criar: () => NoNovo;
};

const acao = (a: AcaoDeFluxo): NoNovo => ({ tipo: "acao", config: { acao: a } });

export const PECAS: readonly Peca[] = [
  {
    id: "relogio",
    grupo: "quando",
    rotulo: "A cada… (relógio)",
    criar: () => ({ tipo: "gatilho", config: { tipo: "relogio", cadaS: 60 } }),
  },
  {
    id: "botao",
    grupo: "quando",
    rotulo: "Ao apertar um botão",
    criar: () => ({ tipo: "gatilho", config: { tipo: "botao", nome: "Meu botão" } }),
  },
  {
    id: "tocha",
    grupo: "quando",
    rotulo: "Tocha acende ou apaga",
    criar: () => ({ tipo: "gatilho", config: { tipo: "tocha", muda: "acende" } }),
  },
  {
    id: "zona",
    grupo: "quando",
    rotulo: "Token entra ou sai de zona",
    criar: () => ({ tipo: "gatilho", config: { tipo: "zona", quando: "entra" } }),
  },
  {
    id: "turno",
    grupo: "quando",
    rotulo: "Começa um turno",
    criar: () => ({ tipo: "gatilho", config: { tipo: "turno" } }),
  },
  {
    id: "cena",
    grupo: "quando",
    rotulo: "Cena é ativada",
    criar: () => ({ tipo: "gatilho", config: { tipo: "cena" } }),
  },
  {
    id: "sinal",
    grupo: "quando",
    rotulo: "Ao receber um sinal",
    criar: () => ({ tipo: "gatilho", config: { tipo: "sinal", nome: "sinal" } }),
  },

  {
    id: "esperar",
    grupo: "fluxo",
    rotulo: "Esperar",
    criar: () => ({ tipo: "esperar", config: { s: 10 } }),
  },
  {
    id: "se",
    grupo: "fluxo",
    rotulo: "Se… (condição)",
    criar: () => ({ tipo: "se", config: {} }),
  },
  {
    id: "sortear",
    grupo: "fluxo",
    rotulo: "Sortear (chance)",
    criar: () => ({ tipo: "sortear", config: { chance: 0.5 } }),
  },
  {
    id: "paraCada",
    grupo: "fluxo",
    rotulo: "Para cada (tochas, tokens)",
    criar: () => ({
      tipo: "paraCada",
      config: { alvo: { tipo: "objetos", acesos: true } },
    }),
  },

  {
    id: "chance",
    grupo: "condicao",
    rotulo: "Chance",
    criar: () => ({ tipo: "condicao", config: { condicao: "chance", chance: 0.5 } }),
  },
  {
    id: "etiqueta",
    grupo: "condicao",
    rotulo: "Tem a etiqueta",
    criar: () => ({ tipo: "condicao", config: { condicao: "etiqueta", etiqueta: "chama" } }),
  },
  {
    id: "dentroDaZona",
    grupo: "condicao",
    rotulo: "Está dentro da zona",
    criar: () => ({ tipo: "condicao", config: { condicao: "dentroDaZona", zona: "" } }),
  },
  {
    id: "estaNaCena",
    grupo: "condicao",
    rotulo: "Está numa cena",
    criar: () => ({ tipo: "condicao", config: { condicao: "cena", cenas: [] as never } }),
  },
  {
    id: "zonaLigada",
    grupo: "condicao",
    rotulo: "A zona está ligada",
    criar: () => ({ tipo: "condicao", config: { condicao: "zonaLigada", zona: "" } }),
  },
  {
    id: "tokenDeJogador",
    grupo: "condicao",
    rotulo: "Token de jogador",
    criar: () => ({ tipo: "condicao", config: { condicao: "tokenDeJogador" } }),
  },

  // AU3: as portas viraram caixas na grade; as peças entram nelas arrastando.
  {
    id: "ou",
    grupo: "logica",
    rotulo: "OU (qualquer um)",
    criar: () => ({ tipo: "caixa", config: { porta: "ou" } }),
  },
  {
    id: "e",
    grupo: "logica",
    rotulo: "E (todos)",
    criar: () => ({ tipo: "caixa", config: { porta: "e" } }),
  },
  {
    id: "nao",
    grupo: "logica",
    rotulo: "NÃO",
    criar: () => ({ tipo: "caixa", config: { porta: "nao" } }),
  },

  {
    id: "luz",
    grupo: "faca",
    rotulo: "Luz",
    criar: () => acao({ acao: "luz.modificar", raioX: 0.5, porS: 20 }),
  },
  {
    id: "apagar",
    grupo: "faca",
    rotulo: "Apagar a tocha",
    criar: () => acao({ acao: "objeto.apagar", chance: 1 }),
  },
  {
    id: "tempo",
    grupo: "faca",
    rotulo: "Tempo da tocha",
    criar: () => acao({ acao: "objeto.ajustarTempo", deltaS: -60 }),
  },
  {
    id: "visao",
    grupo: "faca",
    rotulo: "Limitar a visão",
    criar: () => acao({ acao: "visao.limitar", alcanceM: 1.5, porS: 30 }),
  },
  {
    id: "chat",
    grupo: "faca",
    rotulo: "Avisar no chat",
    criar: () => acao({ acao: "chat.anunciar", texto: "", para: "todos" }),
  },
  {
    id: "som",
    grupo: "faca",
    rotulo: "Tocar som",
    criar: () => acao({ acao: "som.tocar", hash: "", nome: "", volume: 0.8, para: "todos" }),
  },
  {
    id: "mostrar",
    grupo: "faca",
    rotulo: "Mostrar ou ocultar token",
    criar: () => acao({ acao: "token.ocultar" }),
  },
  {
    id: "zonaLigar",
    grupo: "faca",
    rotulo: "Ligar ou desligar zona",
    criar: () => acao({ acao: "zona.ativar", zona: "", ativa: true }),
  },
  {
    id: "sinalMandar",
    grupo: "faca",
    rotulo: "Mandar um sinal",
    criar: () => ({ tipo: "sinal", config: { nome: "sinal" } }),
  },
];

export const GRUPOS_DE_PECA: readonly GrupoDePeca[] = [
  "quando",
  "fluxo",
  "condicao",
  "logica",
  "faca",
];

export const ROTULO_DO_GRUPO: Record<GrupoDePeca, string> = {
  quando: "Quando",
  fluxo: "Fluxo",
  condicao: "Condições",
  logica: "Lógica",
  faca: "Faça",
};

/** A cor de cada grupo: sempre um token do tema. */
export const COR_DO_GRUPO: Record<GrupoDePeca, string> = {
  quando: "var(--acento-forte)",
  fluxo: "var(--etiqueta-azul)",
  condicao: "var(--aviso)",
  logica: "var(--etiqueta-vermelho)",
  faca: "var(--sucesso)",
};

/** O fluxo novo: um relógio e mais nada (a pessoa escolhe o gatilho trocando-o na grade). */
export function fluxoNovo(id: string, gatilho: Gatilho = { tipo: "relogio", cadaS: 60 }): Fluxo {
  // Sem `parse`: o nome vazio é um erro que o editor mostra, não um motivo para a tela nascer quebrada.
  return {
    id,
    nome: "",
    ligado: true,
    cenas: null,
    nos: [{ id: "n1", tipo: "gatilho", x: 80, y: 80, config: gatilho }],
    fios: [],
    // AU3: o fluxo nasce no formato das caixas (dois gatilhos soltos no mesmo bloco não viram caixa sozinhos).
    caixas: true,
  };
}

/** O grupo (a cor) de um nó. */
export function grupoDoNo(
  no: Pick<No, "tipo"> & { id?: string },
  nos?: readonly No[],
): GrupoDePeca {
  switch (no.tipo) {
    case "gatilho":
      return "quando";
    case "condicao":
      return "condicao";
    case "caixa": {
      // AU3: a cor e a borda da caixa são as do que sai dela.
      const tipo = nos !== undefined && no.id !== undefined ? conteudoDaCaixa(nos, no.id) : "vazia";
      return tipo === "gatilho"
        ? "quando"
        : tipo === "valor"
          ? "condicao"
          : tipo === "acao"
            ? "faca"
            : "logica";
    }
    case "acao":
    case "sinal":
      return "faca";
    default:
      return "fluxo";
  }
}

// --- A geometria (a grade tem tamanho fixo de nó, para os fios saberem onde ficam as portas) -----

// A medida vem da `shared` (fonte única, `fluxosGrafo.ts`); aqui só se reexporta para o editor.
export { LARGURA_DO_NO };

/** A largura do nó na grade: a caixa é mais larga (as peças ficam empilhadas dentro dela). */
export const larguraDoNo = (no: Pick<No, "tipo">, nos?: readonly No[]): number =>
  no.tipo === "caixa"
    ? nos === undefined
      ? LARGURA_DA_CAIXA
      : larguraDaCaixa(nos, no as No)
    : LARGURA_DO_NO;

/**
 * A altura do nó: com duas portas de um lado ele cresce; a caixa cresce com o que tem dentro (`nos` são os nós do fluxo;
 * sem eles a caixa conta como vazia).
 */
export function alturaDoNo(
  no: Pick<No, "tipo"> & { id?: string; config?: unknown; em?: string | undefined },
  nos?: readonly No[],
): number {
  if (no.tipo === "caixa") return nos === undefined ? 64 : alturaDoNoDoGrafo(nos, no as No);
  // A peça guardada numa caixa tem a altura que a caixa conta para ela; com a de bloco solto (60 ou 84), cada peça
  // empurrava o espaço seguinte uns 20 px e, com 3 ou 4 peças, o último espaço e o "+" vazavam pelo pé da caixa.
  if (no.em !== undefined) return ALTURA_DA_PECA;
  const p = portasDoNo(no);
  return Math.max(p.entradas.length, p.saidas.length) > 1 ? 84 : 60;
}

/** Onde fica uma porta, em coordenadas da grade. */
export function pontoDaPorta(
  no: No,
  lado: "entrada" | "saida",
  porta: string,
  nos?: readonly No[],
): { x: number; y: number } {
  const p = portasDoNo(no, nos);
  const lista = lado === "entrada" ? p.entradas : p.saidas;
  const i = Math.max(
    0,
    lista.findIndex((x) => x.id === porta),
  );
  const h = alturaDoNo(no, nos);
  return {
    x: no.x + (lado === "entrada" ? 0 : larguraDoNo(no, nos)),
    y: no.y + (h * (i + 1)) / (lista.length + 1),
  };
}

/** O id do fio, o mesmo que a sala usa para conferir fios iguais. */
export const chaveDoFio = (f: Fio): string =>
  `${f.de.no}.${f.de.saida}>${f.para.no}.${f.para.entrada}`;

/** O caminho em curva de um fio, de (x1, y1) a (x2, y2). */
export function caminhoDoFio(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(48, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** O retângulo que contém todos os nós (para "Ajustar à tela"). */
export function limitesDosNos(
  nos: readonly No[],
): { x: number; y: number; largura: number; altura: number } | null {
  if (nos.length === 0) return null;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const n of nos) {
    if (n.em !== undefined) continue;
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + larguraDoNo(n, nos));
    y1 = Math.max(y1, n.y + alturaDoNo(n, nos));
  }
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 };
}

// --- Os rótulos dos nós ------------------------------------------------------------------------

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

export function rotuloDoNo(no: No, n: NomesParaAFrase): Rotulo {
  switch (no.tipo) {
    case "gatilho":
      return rotuloDoGatilho(no.config, n);
    case "esperar":
      return { titulo: `Esperar ${tempoHumano(no.config.s)}`, detalhe: "depois do bloco anterior" };
    case "se":
      return { titulo: "Se", detalhe: "confere a condição ligada" };
    case "sortear":
      return { titulo: "Sortear", detalhe: `${Math.round(no.config.chance * 100)}% de “sim”` };
    case "paraCada": {
      const a = no.config.alvo;
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
        titulo: `Sinal “${no.config.nome}”`,
        detalhe:
          no.config.atrasoS === undefined || no.config.atrasoS === 0
            ? "agora"
            : `daqui a ${tempoHumano(no.config.atrasoS)}`,
      };
    case "condicao": {
      const c = no.config;
      switch (c.condicao) {
        case "chance":
          return { titulo: `Chance ${Math.round(c.chance * 100)}%`, detalhe: "sorteia a cada vez" };
        case "etiqueta":
          return { titulo: "Tem a etiqueta", detalhe: c.etiqueta };
        case "dentroDaZona":
          return {
            titulo: "Dentro da zona",
            detalhe: c.zona === "" ? "(escolha uma zona)" : (n.zona(c.zona) ?? "(apagada)"),
          };
        case "zonaLigada":
          return {
            titulo: "Zona ligada",
            detalhe: c.zona === "" ? "(escolha uma zona)" : (n.zona(c.zona) ?? "(apagada)"),
          };
        case "cena":
          return {
            titulo: "Numa destas cenas",
            detalhe:
              c.cenas.length === 0
                ? "(escolha cenas)"
                : c.cenas.map((x) => n.cena(x) ?? "(apagada)").join(", "),
          };
        case "tokenDeJogador":
          return { titulo: "Token de jogador", detalhe: "senão é do mestre" };
      }
      return { titulo: "Condição", detalhe: "" };
    }
    case "caixa":
      return {
        titulo: NOMES_DAS_CAIXAS[no.config.porta],
        detalhe:
          no.config.porta === "e"
            ? "todos os espaços"
            : no.config.porta === "ou"
              ? "qualquer um dos espaços"
              : "inverte a peça de dentro",
      };
    case "acao": {
      const a = no.config.acao;
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

// --- Os erros por nó ---------------------------------------------------------------------------

/** O erro e onde ele aparece: o id do nó, ou `nome`, `cenas`, `geral`. */
export type ErroDoEditor = { onde: string; texto: string };

/** Todos os problemas do fluxo, em português, cada um preso ao nó que o tem. Vazio = pode salvar. */
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
      const p = issue.path;
      if (p[0] === "nome") poe("nome", e?.mensagem ?? issue.message);
      else if (p[0] === "cenas") poe("cenas", e?.mensagem ?? issue.message);
      else if (p[0] === "nos" && typeof p[1] === "number") {
        const no = f.nos[p[1]];
        poe(no?.id ?? "geral", e?.mensagem ?? issue.message);
      } else poe("geral", e?.texto ?? issue.message);
    }
  }
  for (const p of problemasDoFluxo(f, referenciasDaMesa(estado))) {
    const partes = p.caminho.split(".");
    if (partes[0] === "nos") poe(partes[1] ?? "geral", p.mensagem);
    else if (partes[0] === "nome" || partes[0] === "cenas") poe(partes[0], p.mensagem);
    else poe("geral", p.mensagem);
  }
  return saida;
}

/** O que a caixa diz (em letra pequena), conforme o que tem dentro. */
export function detalheDaCaixa(nos: readonly No[], caixa: No): string {
  if (caixa.tipo !== "caixa") return "";
  const tipo = conteudoDaCaixa(nos, caixa.id);
  if (tipo === "vazia") return "vazia";
  const logica = caixa.config.porta;
  if (tipo === "gatilho")
    return logica === "ou" ? "quando qualquer um destes acontecer" : "quando acontecer e valer";
  if (tipo === "acao") return logica === "e" ? "faz todas, de cima para baixo" : "sorteia uma";
  return logica === "e"
    ? "vale se todas valem"
    : logica === "ou"
      ? "vale se alguma vale"
      : "inverte";
}

/** Como o menu do teclado chama uma caixa: o nome dela e o que tem dentro, para distinguir duas iguais. */
export function nomeDaCaixaNoMenu(nos: readonly No[], caixa: No, n: NomesParaAFrase): string {
  if (caixa.tipo !== "caixa") return "";
  const dentro = pecasDaCaixa(nos, caixa.id);
  const base = caixa.nome ?? NOMES_DAS_CAIXAS[caixa.config.porta];
  if (dentro.length === 0) return `${base} (vazia)`;
  const nomes = dentro.slice(0, 2).map((x) => rotuloDoNo(x, n).titulo);
  return `${base} com ${nomes.join(", ")}${dentro.length > 2 ? "…" : ""}`;
}

/** AU3: a peça da paleta que está sendo arrastada agora (o navegador não deixa ler o que se arrasta antes de soltar). */
export const arrastandoPeca: { atual: Peca | null } = { atual: null };

/** AU3: a peça nova (da paleta) cabe neste lugar da caixa? `null` se cabe; senão, a dica curta do porquê. */
export function motivoDaNovaPeca(
  nos: readonly No[],
  peca: Peca,
  caixa: string,
  destino: DestinoNaCaixa,
): string | null {
  const temporario = { ...peca.criar(), id: "__nova", x: 0, y: 0 } as No;
  return motivoDaRecusa([...nos, temporario], "__nova", caixa, destino);
}

export { nomesDaMesa };
