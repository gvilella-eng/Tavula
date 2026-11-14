import type { AcaoDoMonstro, MonstroDoCompendio, TracoDoMonstro } from "../compendio.ts";
import { type Linha, semAcentos } from "./linhas.ts";
import { chaveDeNome, juntarLinha } from "./magias.ts";

// ---------------------------------------------------------------------------------------------
// Monstros do Manual dos Monstros (N3b). O bloco de estatísticas é uma caixa dentro das duas colunas: nome (versalete),
// "Tipo Tamanho (subtipo), tendência", os rótulos (Classe de Armadura... Nível de Desafio), os traços, e as seções
// Ações, Reações e Ações Lendárias. Os traços e as ações começam com o nome em negrito itálico e um ponto.
// ---------------------------------------------------------------------------------------------

export type BlocoDeMonstro = {
  /** As linhas do nome e do tipo, e o resto do bloco, na ordem de leitura. */
  nome: string;
  tipo: string;
  linhas: Linha[];
  pagina: number;
};

export type MonstroLido = {
  monstro: Partial<MonstroDoCompendio> & { nome: string };
  pagina: number;
  /** O que o livro não trouxe ou que não deu para ler (vai para o relatório). */
  faltando: string[];
};

const TAMANHO =
  /\b(Mi[uú]d[oa]s?|Pequen[oa]s?|M[eé]di[oa]s?|Grandes?|Enormes?|Imens[oa]s?|Gargantuesc[oa]s?)\b(?:\s+ou\s+(Mi[uú]d[oa]s?|Pequen[oa]s?|M[eé]di[oa]s?|Grandes?|Enormes?|Imens[oa]s?))?/i;

/** O título de seção do bloco: "Ações", "Reações", "Ações Lendárias" (ou "Ações para o Tipo 1": começa assim). */
function secaoDoTitulo(l: Pick<Linha, "texto" | "tam">): "acoes" | "reacoes" | "lendarias" | null {
  const t = semAcentos(l.texto)
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
  if (t === "acoes lendarias") return "lendarias";
  if (t === "acoes") return "acoes";
  if (t === "reacoes") return "reacoes";
  if (l.tam >= 10.5 && /^acoes (para|de|do|da)\b/.test(t)) return "acoes";
  if (l.tam >= 10.5 && /^reacoes (para|de|do|da)\b/.test(t)) return "reacoes";
  return null;
}

function eTitulo(l: Pick<Linha, "texto" | "tam">): boolean {
  return secaoDoTitulo(l) !== null;
}

/** Âncora do bloco: a linha "Classe de Armadura ..." com o tipo e o nome logo acima. */
export function blocosDeMonstros(linhas: readonly Linha[]): BlocoDeMonstro[] {
  const ancoras: number[] = [];
  linhas.forEach((l, i) => {
    if (
      i >= 2 &&
      /^Classe de Armadura\s+\d/i.test(l.texto) &&
      TAMANHO.test(linhas[i - 1]?.texto ?? "")
    ) {
      ancoras.push(i);
    }
  });
  // O nome pode quebrar em duas linhas (mesmo tamanho e coluna).
  const inicioDoNome = (a: number): number => {
    let i = a - 2;
    const tam = linhas[i]?.tam ?? 0;
    while (
      i > 0 &&
      linhas[i - 1]?.col === linhas[i]?.col &&
      Math.abs((linhas[i - 1]?.tam ?? 0) - tam) < 0.3 &&
      tam >= 10 &&
      i - 1 > (ancoras[ancoras.indexOf(a) - 1] ?? -1) + 8
    ) {
      i--;
    }
    return i;
  };
  const blocos: BlocoDeMonstro[] = [];
  ancoras.forEach((a, k) => {
    const comeco = inicioDoNome(a);
    const proxima = ancoras[k + 1];
    const limite = proxima === undefined ? linhas.length : inicioDoNome(proxima);
    const corpo: Linha[] = [];
    // A caixa tem corpo de 9 pontos; o texto corrido do livro (9,5) encerra o bloco. Exceção: a caixa que acaba no pé
    // de uma coluna continua na seguinte, embaixo do texto corrido que abre essa coluna.
    let fase: "bloco" | "saltando" | "continuacao" = "bloco";
    let ultima: Linha | undefined;
    let salto: { col: number; pagina: number } | undefined;
    for (let j = a; j < limite; j++) {
      const l = linhas[j];
      if (!l) break;
      const deCaixa = j === a || l.tam < 9.3 || eTitulo(l);
      if (deCaixa) {
        if (fase === "saltando") fase = "continuacao";
        corpo.push(l);
        ultima = l;
        continue;
      }
      if (fase === "continuacao") break;
      if (fase === "bloco") {
        const naoEraOFim =
          ultima !== undefined &&
          ultima.y < 120 &&
          (l.col !== ultima.col || l.pagina !== ultima.pagina);
        if (!naoEraOFim) break;
        fase = "saltando";
        salto = { col: l.col, pagina: l.pagina };
      } else if (salto && (l.col !== salto.col || l.pagina !== salto.pagina)) {
        break; // a continuação não veio na coluna seguinte: o bloco acabou
      }
    }
    const nome = linhas
      .slice(comeco, a - 1)
      .map((l) => l.texto)
      .reduce((acc, t) => juntarLinha(acc, t), "");
    blocos.push({
      nome,
      tipo: linhas[a - 1]?.texto ?? "",
      linhas: corpo,
      pagina: linhas[a]?.pagina ?? 0,
    });
  });
  return blocos;
}

// ---- utilitários ----

const NUMERO = (s: string): number => Number(s.replace(/[−–]/g, "-").replace(/[^\d+-]/g, ""));

/** Troca os traços longos por "-" e tira o espaço em volta do sinal: "2d6 + 3" -> "2d6+3". */
function expressao(s: string): string {
  return s.replace(/[−–]/g, "-").replace(/\s+/g, "");
}

const CONECTIVOS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "com",
  "para",
  "em",
  "no",
  "na",
  "ao",
  "contra",
  "por",
  "ou",
  "sem",
  "sobre",
]);

/** "BOLA DE FOGO" ou "bola de fogo" -> "Bola de Fogo" (conectivos em minúscula, exceto no começo). */
export function emTitulo(texto: string): string {
  return texto
    .split(" ")
    .map((p, i) =>
      i > 0 && CONECTIVOS.has(p.toLowerCase())
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** O nome de uma magia citada num bloco. Se o PHB tiver a magia, usa o nome canônico dele. */
export function nomeDeMagia(bruto: string, canonicos?: ReadonlyMap<string, string>): string {
  const limpo = bruto
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]$/, "");
  const canonico = canonicos?.get(chaveDeNome(limpo));
  if (canonico) return canonico;
  return limpo
    .split(" ")
    .map((p, i) =>
      i > 0 && CONECTIVOS.has(p.toLowerCase())
        ? p.toLowerCase()
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(" ");
}

const ABREVIATURAS = {
  for: "for",
  des: "des",
  con: "con",
  int: "int",
  sab: "sab",
  car: "car",
} as const;
type Abreviatura = keyof typeof ABREVIATURAS;
const POR_NOME: Record<string, Abreviatura> = {
  forca: "for",
  destreza: "des",
  constituicao: "con",
  inteligencia: "int",
  sabedoria: "sab",
  carisma: "car",
};

function atributoDoNome(nome: string): Abreviatura | undefined {
  const n = semAcentos(nome).trim();
  return POR_NOME[n] ?? (n in ABREVIATURAS ? (n as Abreviatura) : undefined);
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- cabeçalho do bloco ----

const ROTULOS: [string, RegExp][] = [
  ["ca", /^Classe de Armadura\s+/i],
  ["pv", /^Pontos de Vida\s+/i],
  ["desl", /^Deslocamento\s+/i],
  ["salv", /^Testes? de Resist[êe]ncia\s+/i],
  ["peri", /^Per[ií]cias\s+/i],
  ["vuln", /^Vulnerabilidades? a Dano\s*/i],
  ["resi", /^Resist[êe]ncias? a Dano\s*/i],
  ["imun", /^Imunidades? a Dano\s*/i],
  ["imunc", /^Imunidades? a Condi[çc](?:ão|ões)\s*/i],
  ["sent", /^Sentidos\s+/i],
  ["idi", /^Idiomas\s+/i],
  ["nd", /^N[ií]vel de Desafio\s+/i],
];

function lerTipo(linha: string): {
  tamanho?: string;
  tipo?: string;
  tendencia?: string;
} {
  const t = TAMANHO.exec(linha);
  if (!t) return {};
  const tamanho = capitalizar(
    t[0]
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/([ao])\b/g, (m) => (m === "a" ? "o" : m)),
  );
  const resto = (linha.slice(0, t.index) + linha.slice(t.index + t[0].length))
    .replace(/\s+/g, " ")
    .trim();
  // A tendência vem depois da primeira vírgula fora dos parênteses.
  let prof = 0;
  let virgula = -1;
  for (let i = 0; i < resto.length; i++) {
    const c = resto[i];
    if (c === "(") prof++;
    else if (c === ")") prof--;
    else if (c === "," && prof === 0) {
      virgula = i;
      break;
    }
  }
  const tipo = (virgula === -1 ? resto : resto.slice(0, virgula)).replace(/\s+/g, " ").trim();
  const tendencia = virgula === -1 ? undefined : resto.slice(virgula + 1).trim();
  return {
    tamanho,
    ...(tipo ? { tipo: capitalizar(tipo) } : {}),
    ...(tendencia ? { tendencia: capitalizar(tendencia) } : {}),
  };
}

function lerAtributos(texto: string): MonstroDoCompendio["atributos"] | null {
  // Só o valor importa (o modificador entre parênteses se calcula); o livro tem erros de digitação nele, como "(+))".
  const valores = [...texto.matchAll(/(\d+)\s*\(/g)].map((m) => Number(m[1]));
  if (valores.length !== 6) return null;
  const [f, d, c, i, s, a] = valores as [number, number, number, number, number, number];
  return { for: f, des: d, con: c, int: i, sab: s, car: a };
}

// ---- ações ----

const TIPOS_DE_ATAQUE: [RegExp, NonNullable<AcaoDoMonstro["tipo"]>][] = [
  [/Ataque (?:de )?Magia/i, "magia"],
  [/^(?:Ataque )?Corpo[- ]+a[- ]+Corpo ou (?:à|a) Dist[âa]ncia/i, "cacdist"],
  [/^(?:Ataque )?(?:à|a) Dist[âa]ncia ou Corpo[- ]+a[- ]+Corpo/i, "cacdist"],
  [/^(?:Ataque )?Corpo[- ]+a[- ]+Corpo/i, "cac"],
  [/^(?:Ataque )?(?:à|a) Dist[âa]ncia/i, "dist"],
];

const RECARGA = /\(Recarrega\s+(\d)(?:\s*[–-]\s*\d)?\)/i;
const MEDIDA = String.raw`\d+(?:[,.]\d+)?(?:\s*\/\s*\d+(?:[,.]\d+)?)?\s*m`;
const ALCANCE = new RegExp(
  String.raw`(?:alcance|dist[âa]ncia)\s+(${MEDIDA}(?:\s+ou\s+(?:alcance|dist[âa]ncia)\s+${MEDIDA})?)`,
  "i",
);
const USOS_POR_DIA = /\((\d+)\s*\/\s*Dia\)/i;
const UM_TIPO =
  "(?:[áa]cido|concuss[ãa]o|contundente|cortante|el[ée]trico|energia|for[çc]a|fogo|frio|necr[óo]tico|perfurante|ps[íi]quico|radiante|trovejante|veneno)";
const TIPO_DE_DANO = String.raw`(?:de\s+)?(${UM_TIPO}(?:\s+(?:e|ou)\s+${UM_TIPO})?)`;

/** Lê os números de uma ação do texto ("+4 para atingir, alcance 1,5 m ... Acerto: 5 (1d6 + 2) de dano cortante"). */
export function numerosDaAcao(
  nomeBruto: string,
  texto: string,
): Omit<AcaoDoMonstro, "nome" | "texto"> {
  const extra: Omit<AcaoDoMonstro, "nome" | "texto"> = {};
  const recarga = RECARGA.exec(nomeBruto);
  if (recarga?.[1]) extra.recarga = Number(recarga[1]);
  const usos = USOS_POR_DIA.exec(nomeBruto);
  if (usos?.[1]) extra.usos = Math.min(20, Number(usos[1]));

  const tipo = TIPOS_DE_ATAQUE.find(([re]) => re.test(texto));
  const ataque = /^[^:]{0,80}:\s*([+\-−–]\s*\d+)\s+para atingir/i.exec(texto);
  if (tipo && ataque?.[1]) {
    extra.tipo = tipo[1];
    extra.acerto = NUMERO(ataque[1].replace(/\s+/g, ""));
    // "alcance 1,5 m", "distância 24/96 m", "alcance 1,5 m ou distância 6/18 m": os números levam vírgula decimal.
    const alcance = ALCANCE.exec(texto);
    if (alcance?.[1]) extra.alcance = alcance[1].replace(/\s+/g, " ").trim().slice(0, 100);
  }

  // O primeiro dano: "5 (1d8 + 1) de dano cortante" (ou "1 de dano ..." sem dados). O segundo, depois de "mais".
  const danos = [
    ...texto.matchAll(
      new RegExp(
        String.raw`(\d+)\s*(?:\(\s*([\dd\s+\-−–]+?(?:\s+mais\s+[\dd\s+\-−–]+?)?)\s*\))?\s+de\s+dano\s+${TIPO_DE_DANO}`,
        "gi",
      ),
    ),
  ];
  const primeiro = danos[0];
  if (primeiro) {
    // "14 (1d12 + 4 mais 1d8) de dano cortante": o segundo dado é do mesmo tipo.
    const [dentro, dentro2] = (primeiro[2] ?? primeiro[1] ?? "").split(/\s+mais\s+/i);
    extra.dano = expressao(dentro ?? "");
    if (primeiro[3]) extra.tipoDeDano = capitalizar(primeiro[3].toLowerCase());
    const mais = danos.find(
      (d, i) => i > 0 && /mais\s*$/i.test(texto.slice(Math.max(0, (d.index ?? 0) - 12), d.index)),
    );
    if (dentro2) {
      extra.dano2 = {
        dano: expressao(dentro2),
        ...(primeiro[3] ? { tipoDeDano: capitalizar(primeiro[3].toLowerCase()) } : {}),
      };
    } else if (mais) {
      extra.dano2 = {
        dano: expressao(mais[2] ?? mais[1] ?? ""),
        ...(mais[3] ? { tipoDeDano: capitalizar(mais[3].toLowerCase()) } : {}),
      };
    }
  }

  const sal = /teste de resist[êe]ncia de ([A-Za-zçãáâéêíóôõú]+)(?:\s+CD\s+(\d+))?/i.exec(texto);
  const cd = /CD\s+(\d+)/i.exec(texto);
  const atributo = atributoDoNome(sal?.[1] ?? "");
  if (sal && atributo && (sal[2] ?? cd?.[1])) {
    extra.salvaguarda = {
      atributo,
      cd: Number(sal[2] ?? cd?.[1]),
      ...(extra.dano
        ? { sucesso: /metade/i.test(texto) ? ("metade" as const) : ("nenhum" as const) }
        : {}),
    };
    if (!extra.tipo) extra.tipo = "esp";
  }
  return extra;
}

type Entrada = { nome: string; texto: string; fonteDoNome: string };

/** Linhas que abrem uma lista dentro do texto (as magias da conjuração) e ficam em linha própria. */
const LINHA_DE_LISTA = /^(?:À vontade|\d+\s*\/\s*dia|Truques?\s*\(|\d+°\s*n[ií]vel\s*\(|•)/i;

function textoDasLinhas(linhas: readonly string[]): string {
  let saida = "";
  for (const l of linhas) {
    if (saida !== "" && LINHA_DE_LISTA.test(l)) saida += `\n${l}`;
    else saida = juntarLinha(saida, l);
  }
  return saida.replace(/\s+\n/g, "\n").trim();
}

const NOME_E_RESTO = /^(.{1,100}?)\.(?:\s+(.*))?$/;

// ---- o bloco todo ----

export type OpcoesDoMonstro = {
  /** Nomes canônicos das magias (do Livro do Jogador), por chave de busca. */
  magias?: ReadonlyMap<string, string>;
};

export function lerMonstro(bloco: BlocoDeMonstro, opcoes: OpcoesDoMonstro = {}): MonstroLido {
  const faltando: string[] = [];
  const { linhas } = bloco;
  // Alguns nomes vêm todos em maiúsculas (sem versalete): vão para a caixa de título.
  // (A caixa do resto do nome é a do livro, que não é sempre a mesma; só a inicial é garantida.)
  const nome = capitalizar(
    bloco.nome === bloco.nome.toUpperCase() ? emTitulo(bloco.nome) : bloco.nome,
  );
  const m: MonstroLido["monstro"] = { nome };
  const info = lerTipo(bloco.tipo);
  if (info.tamanho) m.tamanho = info.tamanho;
  if (info.tipo) m.tipo = info.tipo;
  if (info.tendencia) m.tendencia = info.tendencia;

  // Fontes do bloco: o rótulo em negrito e o valor em fonte comum (traços e ações usam outra, em negrito itálico).
  const linhaDosPv = linhas.find((l) => ROTULOS[1]?.[1].test(l.texto));
  const fonteDoRotulo = linhaDosPv?.trechos[0]?.f;
  const fonteDoCorpo = linhaDosPv?.trechos[linhaDosPv.trechos.length - 1]?.f;
  const fonteDoTipo = undefined as string | undefined;
  void fonteDoTipo;

  // Cabeçalho: do início até a linha do ND.
  const fimDoCabecalho = linhas.findIndex((l) => ROTULOS[11]?.[1].test(l.texto));
  const cab: Record<string, string> = {};
  let atual: string | null = null;
  let atributos: MonstroDoCompendio["atributos"] | null = null;
  const limite = fimDoCabecalho === -1 ? 0 : fimDoCabecalho;
  for (let i = 0; i <= limite && i < linhas.length; i++) {
    const l = linhas[i];
    if (!l) continue;
    const rotulo = ROTULOS.find(([, re]) => re.test(l.texto));
    if (rotulo) {
      atual = rotulo[0];
      cab[atual] = l.texto.replace(rotulo[1], "").trim();
    } else if (/^FOR\s*DES/i.test(l.texto.replace(/\s+/g, ""))) {
      atributos = lerAtributos(linhas[i + 1]?.texto ?? "");
      atual = "atributos";
      i++;
    } else if (atual && atual !== "atributos") {
      cab[atual] = juntarLinha(cab[atual] ?? "", l.texto);
    }
  }
  if (atributos) m.atributos = atributos;
  else faltando.push("atributos");

  const ca = /^(\d+)\s*(?:\((.*)\))?/.exec(cab.ca ?? "");
  if (ca?.[1]) m.ca = { valor: Number(ca[1]), ...(ca[2] ? { fonte: ca[2].trim() } : {}) };
  else faltando.push("ca");
  const pv = /^(\d+)\s*(?:\((.*)\))?/.exec(cab.pv ?? "");
  if (pv?.[1]) m.pv = { media: Number(pv[1]), ...(pv[2] ? { formula: pv[2].trim() } : {}) };
  else faltando.push("pv");
  if (cab.desl) {
    m.deslocamento = cab.desl.trim();
    const metros = /(\d+(?:[.,]\d+)?)\s*m\b/.exec(cab.desl);
    if (metros?.[1]) m.deslocamentoM = Number(metros[1].replace(",", "."));
  }
  if (cab.salv) {
    const sv: NonNullable<MonstroDoCompendio["salvaguardas"]> = {};
    for (const parte of cab.salv.split(",")) {
      const x = /^\s*([A-Za-zçãáâéêíóôõú]+)\s*([+\-−–]\s*\d+)\s*$/.exec(parte);
      const a = atributoDoNome(x?.[1] ?? "");
      if (x?.[2] && a) sv[a] = NUMERO(x[2].replace(/\s+/g, ""));
    }
    if (Object.keys(sv).length > 0) m.salvaguardas = sv;
  }
  if (cab.peri) {
    const pe: Record<string, number> = {};
    for (const parte of cab.peri.split(",")) {
      const x = /^\s*(.+?)\s*([+\-−–]\s*\d+)\s*$/.exec(parte);
      if (x?.[1] && x[2]) pe[capitalizar(x[1])] = NUMERO(x[2].replace(/\s+/g, ""));
    }
    if (Object.keys(pe).length > 0) m.pericias = pe;
  }
  if (cab.vuln) m.vulnerabilidades = cab.vuln.trim();
  if (cab.resi) m.resistencias = cab.resi.trim();
  if (cab.imun) m.imunidades = cab.imun.trim();
  if (cab.imunc) m.imunidadesCondicoes = cab.imunc.trim();
  if (cab.sent) m.sentidos = cab.sent.trim();
  if (cab.idi) m.idiomas = cab.idi.trim();
  const nd = /^([\d/]+)\s*(?:\(\s*([\d.\s]+)\s*XP\s*\))?/i.exec(cab.nd ?? "");
  if (nd?.[1]) {
    m.nd = nd[1];
    if (nd[2]) m.xp = Number(nd[2].replace(/[.\s]/g, ""));
  } else faltando.push("nd");

  // Corpo: traços, Ações, Reações e Ações Lendárias.
  const corpo = fimDoCabecalho === -1 ? [] : linhas.slice(fimDoCabecalho + 1);
  type Secao = "tracos" | "acoes" | "reacoes" | "lendarias";
  const secoes: Record<Secao, Entrada[]> = { tracos: [], acoes: [], reacoes: [], lendarias: [] };
  const linhasDe = new Map<Entrada, string[]>();
  let secao: Secao = "tracos";
  let entrada: Entrada | null = null;
  const introLendarias: string[] = [];
  for (const l of corpo) {
    const titulo = secaoDoTitulo(l);
    if (titulo) {
      secao = titulo;
      entrada = null;
      continue;
    }
    const f0 = l.trechos[0]?.f;
    const comeco = NOME_E_RESTO.exec(l.texto);
    const eNome =
      comeco !== null &&
      f0 !== undefined &&
      f0 !== fonteDoCorpo &&
      (f0 !== fonteDoRotulo || secao === "lendarias") && // as ações lendárias vêm em negrito simples
      !(comeco[1] ?? "").includes(":") &&
      /^[\p{Lu}0-9]/u.test(comeco[1] ?? "");
    if (eNome && comeco) {
      entrada = { nome: (comeco[1] ?? "").trim(), texto: "", fonteDoNome: f0 ?? "" };
      linhasDe.set(entrada, comeco[2] ? [comeco[2]] : []);
      secoes[secao].push(entrada);
    } else if (entrada) {
      linhasDe.get(entrada)?.push(l.texto);
    } else if (secao === "lendarias") {
      introLendarias.push(l.texto);
    }
  }
  for (const lista of Object.values(secoes)) {
    for (const e of lista) e.texto = textoDasLinhas(linhasDe.get(e) ?? []);
  }

  const traco = (e: Entrada): TracoDoMonstro | null =>
    e.texto === "" ? null : { nome: e.nome.slice(0, 80), texto: e.texto };
  const tracos = secoes.tracos.map(traco).filter((x): x is TracoDoMonstro => x !== null);
  if (tracos.length > 0) m.tracos = tracos;
  const acao = (e: Entrada): AcaoDoMonstro | null => {
    if (e.texto === "") return null;
    const nums = numerosDaAcao(e.nome, e.texto);
    const nome = e.nome
      .replace(new RegExp(`\\s*${RECARGA.source}`, "i"), "")
      .replace(new RegExp(`\\s*${USOS_POR_DIA.source}`, "i"), "")
      .trim();
    return { nome: (nome || e.nome).slice(0, 80), texto: e.texto, ...nums };
  };
  const acoes = secoes.acoes.map(acao).filter((x): x is AcaoDoMonstro => x !== null);
  if (acoes.length > 0) m.acoes = acoes;
  const reacoes = secoes.reacoes.map(acao).filter((x): x is AcaoDoMonstro => x !== null);
  if (reacoes.length > 0) m.reacoes = reacoes;
  const lendarias = secoes.lendarias.map(acao).filter((x): x is AcaoDoMonstro => x !== null);
  if (lendarias.length > 0) m.acoesLendarias = lendarias;
  const intro = textoDasLinhas(introLendarias);
  if (intro !== "") m.textoDasAcoesLendarias = intro;
  if (!m.acoes) faltando.push("acoes");

  const inata = secoes.tracos.find((e) => /^Conjuração Inata\b/i.test(e.nome));
  if (inata) {
    const lida = lerConjuracaoInata(inata.texto, opcoes.magias, inata.nome);
    if (lida) m.conjuracaoInata = lida;
  }
  const porEspacos = secoes.tracos.find((e) => /^Conjuração(?!\s+Inata)\b/i.test(e.nome));
  if (porEspacos) {
    const lida = lerConjuracaoPorEspacos(porEspacos.texto, opcoes.magias);
    if (lida) m.conjuracaoPorEspacos = lida;
  }
  return { monstro: m, pagina: bloco.pagina, faltando };
}

// ---- conjuração ----

function habilidadeDaConjuracao(texto: string): Abreviatura | undefined {
  const x = /habilidade de conjura[çc][ãa]o (?:\S+ )*?[ée]\s+([A-Za-zçãáâéêíóôõú]+)/i.exec(texto);
  return atributoDoNome(x?.[1] ?? "");
}

function magiasDaLista(bruto: string, canonicos?: ReadonlyMap<string, string>): string[] {
  // Separa por vírgula fora de parênteses.
  const partes: string[] = [];
  let prof = 0;
  let atual = "";
  for (const c of bruto) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if ((c === "," || c === ";") && prof === 0) {
      partes.push(atual);
      atual = "";
    } else atual += c;
  }
  partes.push(atual);
  return partes
    .map((p) => {
      // As magias vêm em minúscula na lista; texto corrido colado no fim (maiúscula ou asterisco) não é nome.
      const sem = p.replace(/\*.*$/, "").trim();
      const corte = /^\p{Ll}/u.test(sem) ? sem.search(/\s\p{Lu}/u) : -1;
      return nomeDeMagia(corte === -1 ? sem : sem.slice(0, corte), canonicos);
    })
    .filter((n) => n !== "" && n.length <= 60);
}

export function lerConjuracaoInata(
  texto: string,
  canonicos?: ReadonlyMap<string, string>,
  nomeDoTraco = "",
): MonstroDoCompendio["conjuracaoInata"] | null {
  const habilidade = habilidadeDaConjuracao(texto);
  const cd = /CD(?: de resist[êe]ncia(?: de magia)?)?\s+(\d+)/i.exec(texto);
  const magias: NonNullable<MonstroDoCompendio["conjuracaoInata"]>["magias"] = [];
  let grupoMax: number | undefined;
  for (const linha of texto.split("\n")) {
    const vontade = /^À vontade\s*:\s*(.+)$/i.exec(linha);
    const dia = /^(\d+)\s*\/\s*dia(\s+cada)?\s*:\s*(.+)$/i.exec(linha);
    if (vontade?.[1]) {
      for (const nome of magiasDaLista(vontade[1], canonicos))
        magias.push({ nome, frequencia: "vontade" });
    } else if (dia?.[1] && dia[3]) {
      const max = Math.min(20, Number(dia[1]));
      for (const nome of magiasDaLista(dia[3], canonicos)) {
        if (dia[2]) magias.push({ nome, frequencia: "cada", max });
        else {
          grupoMax = max;
          magias.push({ nome, frequencia: "grupo" });
        }
      }
    }
  }
  if (magias.length === 0) {
    // Forma curta: "Conjuração Inata (1/Dia). O monstro pode conjurar, inatamente, sono, sem necessidade de ...".
    const usos = USOS_POR_DIA.exec(nomeDoTraco);
    const unica = /conjurar,?\s+inatamente,?\s+(.+?),?\s+(?:sem|necessitando)\b/i.exec(texto);
    if (usos?.[1] && unica?.[1]) {
      for (const nome of magiasDaLista(unica[1], canonicos)) {
        magias.push({ nome, frequencia: "cada", max: Math.min(20, Number(usos[1])) });
      }
    }
  }
  if (magias.length === 0) return null;
  return {
    ...(habilidade ? { habilidade } : {}),
    ...(cd?.[1] ? { cd: Number(cd[1]) } : {}),
    ...(grupoMax ? { grupoMax } : {}),
    magias: magias.slice(0, 40),
  };
}

export function lerConjuracaoPorEspacos(
  texto: string,
  canonicos?: ReadonlyMap<string, string>,
): MonstroDoCompendio["conjuracaoPorEspacos"] | null {
  const habilidade = habilidadeDaConjuracao(texto);
  const espacos: Record<string, number> = {};
  const magias: { nome: string; nivel: number }[] = [];
  for (const linha of texto.split("\n")) {
    const truque = /^Truques?\s*(?:\([^)]*\))?\s*:\s*(.+)$/i.exec(linha);
    const nivel = /^(\d)°\s*n[ií]vel\s*\((\d+)\s*espa[çc]os?\)\s*:\s*(.+)$/i.exec(linha);
    if (truque?.[1]) {
      for (const nome of magiasDaLista(truque[1], canonicos)) magias.push({ nome, nivel: 0 });
    } else if (nivel?.[1] && nivel[2] && nivel[3]) {
      espacos[nivel[1]] = Number(nivel[2]);
      for (const nome of magiasDaLista(nivel[3], canonicos))
        magias.push({ nome, nivel: Number(nivel[1]) });
    }
  }
  if (magias.length === 0) return null;
  return {
    ...(habilidade ? { habilidade } : {}),
    espacos: espacos as NonNullable<MonstroDoCompendio["conjuracaoPorEspacos"]>["espacos"],
    magias: magias.slice(0, 80),
  };
}
