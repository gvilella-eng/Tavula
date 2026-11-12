import {
  type Ataque,
  bonusDeProficiencia,
  type ClasseDaFicha,
  conjuradoras,
  espacosDeMagia,
  type Ficha,
  FichaSchema,
  type ItemDaFicha,
  type Magia,
  modificador,
  nivelDeConjurador,
  type Recurso,
} from "./ficha.ts";
import {
  antecedenteEmPortugues,
  idiomaEmPortugues,
  racaEmPortugues,
  tendenciaEmPortugues,
} from "./importarTraducoes.ts";
import {
  ATRIBUTOS,
  type Atributo,
  CLASSES,
  classeSrd,
  PERICIAS,
  ROTULO_DO_ATRIBUTO,
  semAcento,
} from "./srd/index.ts";

// ---------------------------------------------------------------------------------------------
// Importação da ficha em PDF (Lote 10, seção 4.10). Este arquivo é PURO: recebe os pedaços de
// texto que o pdf.js extraiu (com posição) e devolve a ficha mais a lista de campos incertos. Nada de
// coordenada absoluta: tudo é procurado em relação a um rótulo (acima, abaixo, na mesma linha) e as
// distâncias são medidas na "escala" do documento, para o PDF A4 e o de Carta darem o mesmo resultado.
// ---------------------------------------------------------------------------------------------

/** Um pedaço de texto do PDF. `y` cresce para cima (como no pdf.js); a unidade é o ponto do PDF. */
export type Pedaco = {
  pagina: number;
  str: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
};

export type Incerto = {
  /** Caminho do campo na ficha (`ataques.1.nome`, `pvAtual`...); vazio quando é do PDF todo. */
  caminho: string;
  motivo: string;
  /** O que o PDF mostra naquele ponto, para o jogador conferir. */
  trecho: string;
};

export type ImportacaoDoPdf = {
  /** Falso quando o PDF não parece uma ficha impressa (nada foi lido). */
  reconhecido: boolean;
  /** Nome do personagem, se lido (a ficha não guarda o nome; ele é do item). */
  nome?: string;
  ficha: Ficha;
  incertos: Incerto[];
  /** O texto cru do PDF por seção (`cabecalho`, `atributos`, `ataques`...), para a tela de revisão. */
  trechos: Record<string, string>;
};

/** Converte os itens de `getTextContent()` do pdf.js em pedaços (sem depender dos tipos dele). */
export function pedacosDoTextoDoPdf(pagina: number, itens: readonly unknown[]): Pedaco[] {
  const saida: Pedaco[] = [];
  for (const bruto of itens) {
    // `getTextContent()` mistura pedaços de texto com marcadores de conteúdo (sem `str`): estes saem.
    const it = bruto as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown };
    if (typeof it.str !== "string" || it.str === "") continue;
    const t = it.transform;
    if (!Array.isArray(t) || typeof t[4] !== "number" || typeof t[5] !== "number") continue;
    saida.push({
      pagina,
      str: it.str,
      x: t[4],
      y: t[5],
      largura: typeof it.width === "number" ? it.width : 0,
      altura: typeof it.height === "number" ? it.height : 0,
    });
  }
  return saida;
}

// ---------------------------------------------------------------------------------------------
// Estrutura interna
// ---------------------------------------------------------------------------------------------

type Item = Pedaco & { fim: number; t: string; n: string; rotulo: boolean };
type Linha = { y: number; itens: Item[]; texto: string; x: number; fim: number; altura: number };
type Pag = { numero: number; itens: Item[]; linhas: Linha[]; rotulos: Item[]; largura: number };
type Caixa = { x: number; fim: number; y: number };

/** Normaliza para comparar: sem acento, minúsculas, aspas retas, espaços únicos. */
function norm(s: string): string {
  return semAcento(s.replace(/[‘’]/g, "'")).replace(/\s+/g, " ").trim();
}

const ALTURA_DE_ROTULO_DE_REFERENCIA = 7.1;

/**
 * Escala do documento: a altura mais comum do texto da PRIMEIRA página (a ficha principal; nas outras o
 * corpo das descrições é maior), contra a do PDF de referência (A4, 100%).
 */
function escalaDoDocumento(pedacos: readonly Pedaco[]): number {
  const primeira = Math.min(...pedacos.map((p) => p.pagina));
  const alturas = pedacos
    .filter((p) => p.pagina === primeira && p.altura > 0 && /\p{L}/u.test(p.str))
    .map((p) => p.altura)
    .sort((a, b) => a - b);
  if (alturas.length === 0) return 1;
  const mediana = alturas[Math.floor(alturas.length / 2)] ?? ALTURA_DE_ROTULO_DE_REFERENCIA;
  return mediana / ALTURA_DE_ROTULO_DE_REFERENCIA;
}

function montarItem(p: Pedaco, u: number): Item {
  const t = p.str.trim();
  const rotulo =
    p.altura > 0 &&
    p.altura <= 7.0 * u &&
    t.length >= 2 &&
    /^[A-ZÀ-ÝÇ0-9&:()/.,' -]+$/u.test(t) &&
    /[A-ZÀ-ÝÇ]{2}/u.test(t);
  return { ...p, fim: p.x + p.largura, t, n: norm(t), rotulo };
}

function juntar(itens: readonly Item[], u: number): string {
  const ordenados = [...itens].sort((a, b) => a.x - b.x);
  let saida = "";
  let anterior: Item | undefined;
  for (const it of ordenados) {
    if (it.t === "") continue;
    if (anterior) {
      const folga = it.x - anterior.fim;
      const maiuscula = /[a-zà-ÿ]$/u.test(anterior.t) && /^[A-ZÀ-Ý]/u.test(it.t);
      const precisa =
        folga > 0.8 * u || /\s$/.test(anterior.str) || /^\s/.test(it.str) || maiuscula;
      if (precisa) saida += " ";
    }
    saida += it.t;
    anterior = it;
  }
  return saida;
}

/** Os itens da linha que seguem colados no primeiro (o resto é de outra coluna na mesma altura). */
function trechoContiguo(itens: readonly Item[], u: number): Item[] {
  const saida: Item[] = [];
  for (const it of itens) {
    const anterior = saida[saida.length - 1];
    if (anterior && it.x - anterior.fim > 14 * u) break;
    saida.push(it);
  }
  return saida;
}

function agruparEmLinhas(itens: readonly Item[], u: number): Linha[] {
  const uteis = itens.filter((i) => i.t !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Linha[] = [];
  for (const it of uteis) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(ultima.y - it.y) <= 3 * u) ultima.itens.push(it);
    else
      linhas.push({
        y: it.y,
        itens: [it],
        texto: "",
        x: it.x,
        fim: it.fim,
        altura: it.altura,
      });
  }
  for (const l of linhas) {
    l.itens.sort((a, b) => a.x - b.x);
    l.texto = juntar(l.itens, u);
    l.x = Math.min(...l.itens.map((i) => i.x));
    l.fim = Math.max(...l.itens.map((i) => i.fim));
    l.altura = Math.max(...l.itens.map((i) => i.altura));
  }
  return linhas;
}

function montarPaginas(pedacos: readonly Pedaco[], u: number): Pag[] {
  const porPagina = new Map<number, Item[]>();
  for (const p of pedacos) {
    if (p.str.trim() === "") continue;
    const lista = porPagina.get(p.pagina) ?? [];
    lista.push(montarItem(p, u));
    porPagina.set(p.pagina, lista);
  }
  return [...porPagina.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, itens]) => ({
      numero,
      itens,
      linhas: agruparEmLinhas(itens, u),
      rotulos: itens.filter((i) => i.rotulo),
      largura: Math.max(...itens.map((i) => i.fim)),
    }));
}

// ---------------------------------------------------------------------------------------------
// Consultas relativas a um rótulo
// ---------------------------------------------------------------------------------------------

function sobrepoe(i: Caixa, r: Caixa, folga: number): boolean {
  return i.x < r.fim + folga && i.fim > r.x - folga;
}

/** Itens acima do rótulo, até `dyMax`, parando no próximo rótulo acima (as caixas se encadeiam). */
function acima(pag: Pag, r: Item, dyMax: number, folga: number, u: number): Item[] {
  let teto = r.y + dyMax * u;
  for (const o of pag.rotulos) {
    if (o !== r && o.y > r.y + u && sobrepoe(o, r, folga * u)) teto = Math.min(teto, o.y);
  }
  return pag.itens.filter(
    (i) =>
      !i.rotulo &&
      i.altura > 0 &&
      i.y > r.y + 0.5 * u &&
      i.y < teto - 0.5 * u &&
      sobrepoe(i, r, folga * u),
  );
}

function abaixo(pag: Pag, r: Item, dyMax: number, folga: number, u: number): Item[] {
  let piso = r.y - dyMax * u;
  for (const o of pag.rotulos) {
    if (o !== r && o.y < r.y - u && sobrepoe(o, r, folga * u)) piso = Math.max(piso, o.y);
  }
  return pag.itens.filter(
    (i) =>
      !i.rotulo &&
      i.altura > 0 &&
      i.y < r.y - 0.5 * u &&
      i.y > piso + 0.5 * u &&
      sobrepoe(i, r, folga * u),
  );
}

/** A linha mais próxima (do rótulo) entre os itens, como texto. */
function linhaMaisProxima(itens: readonly Item[], u: number, ordem: "acima" | "abaixo"): string {
  const linhas = agruparEmLinhas(itens, u);
  const alvo = ordem === "acima" ? linhas[linhas.length - 1] : linhas[0];
  return alvo?.texto ?? "";
}

/** Todas as linhas dos itens (de cima para baixo), como um texto só (linhas viram espaço). */
function textoDosItens(itens: readonly Item[], u: number): string {
  return agruparEmLinhas(itens, u)
    .map((l) => l.texto)
    .join(" ");
}

function acharItens(pag: Pag, regex: RegExp): Item[] {
  return pag.itens.filter((i) => regex.test(i.n));
}

function primeiroEmTodas(
  paginas: readonly Pag[],
  regex: RegExp,
): { pag: Pag; item: Item } | undefined {
  for (const pag of paginas) {
    const item = acharItens(pag, regex)[0];
    if (item) return { pag, item };
  }
  return undefined;
}

const EH_NUMERO = /^[+-]?\d+$/;

/** Número que está na mesma linha do rótulo, do lado pedido (o mais próximo). */
function numeroNaLinha(
  pag: Pag,
  r: Item,
  lado: "direita" | "esquerda",
  u: number,
): Item | undefined {
  const candidatos = pag.itens
    .filter(
      (i) =>
        i !== r &&
        EH_NUMERO.test(i.t) &&
        Math.abs(i.y - r.y) <= 4 * u &&
        (lado === "direita" ? i.x >= r.fim - u : i.fim <= r.x + u),
    )
    .sort((a, b) => (lado === "direita" ? a.x - b.x : b.x - a.x));
  return candidatos[0];
}

// ---------------------------------------------------------------------------------------------
// Texto: parágrafos, títulos
// ---------------------------------------------------------------------------------------------

/**
 * Junta linhas quebradas pelo PDF em parágrafos: a linha que termina em pontuação e é bem mais curta que
 * as outras fecha o parágrafo.
 */
function paragrafos(linhas: readonly Linha[]): string {
  if (linhas.length === 0) return "";
  const largura = Math.max(...linhas.map((l) => l.fim - l.x));
  let saida = "";
  linhas.forEach((l, i) => {
    saida += l.texto;
    if (i === linhas.length - 1) return;
    const curta = l.fim - l.x < 0.72 * largura;
    saida += curta && /[.!?:)]$/.test(l.texto) ? "\n" : " ";
  });
  return saida.trim();
}

const PALAVRAS_PEQUENAS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "em",
  "no",
  "na",
  "a",
  "o",
  "of",
  "the",
]);

/** "CANALIZAR DIVINDADE: RADIAÇÃO DO AMANHECER" vira "Canalizar Divindade: Radiação do Amanhecer". */
function tituloBonito(texto: string): string {
  return texto
    .split(" ")
    .map((palavra, i) => {
      const letras = palavra.replace(/[^\p{L}]/gu, "");
      if (letras.length < 2 || letras !== letras.toUpperCase()) return palavra;
      const minuscula = palavra.toLowerCase();
      if (i > 0 && PALAVRAS_PEQUENAS.has(minuscula)) return minuscula;
      return minuscula.replace(/\p{L}/u, (c) => c.toUpperCase());
    })
    .join(" ");
}

function cortado(texto: string): boolean {
  return /…$|\.\.\.$/.test(texto.trim());
}

// ---------------------------------------------------------------------------------------------
// Âncoras (PT e EN)
// ---------------------------------------------------------------------------------------------

const A = {
  nome: /^(nome do personagem|character name)$/,
  classe: /^(classe & nivel|classe e nivel|class & level|class and level)$/,
  antecedente: /^(antecedente|background)$/,
  raca: /^(raca|race)$/,
  alinhamento: /^(alinhamento|alignment)$/,
  bonusProficiencia: /^(bonus de proficiencia|proficiency bonus)$/,
  percepcaoPassiva: /^(sabedoria passiva \(percepcao\)|passive wisdom \(perception\))$/,
  pvMax:
    /^(pontos de vida maximo|pontos de vida maximos|hit point maximum|max(imum)? hit points|pv maximo)$/,
  pvAtual: /^(pontos de vida atuais|current hit points)$/,
  pvTemp: /^(pontos de vida temporarios|temporary hit points)$/,
  ca: /^(classe de armadura|armor class|ca|ac)$/,
  iniciativa: /^(iniciativa|initiative)$/,
  deslocamento: /^(deslocamento|speed)$/,
  outrasProf:
    /^(outras proficiencias & idiomas|outras proficiencias e idiomas|other proficiencies & languages|proficiencies & languages)$/,
  caracteristicas:
    /^(caracteristicas & tracos|caracteristicas e tracos|features & traits|features and traits)$/,
  equipamento: /^(equipamento|equipment)$/,
  ataquesRotulo:
    /^(ataques & conjuracao|ataques e conjuracao|attacks & spellcasting|attacks and spellcasting)$/,
  habilidadeConj:
    /^(spellcasting ability|habilidade de conjuracao|habilidade de conjuracao de magias)$/,
  cdConj:
    /^(spell save dc|cd de magia|cd das magias|cd de salvaguarda de magia|cd de resistencia de magia)$/,
  ataqueConj: /^(spell attack bonus|bonus de ataque de magia|bonus de ataque das magias)$/,
  total: /^total$/,
  tempoDeConjuracao: /^(tempo de conjuracao|casting time)\s*:/,
  cabNome: /^(nome|name)$/,
  cabAtaque: /^(atq|atq\.|atk|atk bonus|atq bonus|bonus de ataque|ataque)$/,
  cabDano: /^(dano\/tipo|damage\/type|dano|damage)$/,
};

const ROTULOS_DE_ATRIBUTO: { id: Atributo; regex: RegExp }[] = [
  { id: "for", regex: /^(forca|strength)$/ },
  { id: "des", regex: /^(destreza|dexterity)$/ },
  { id: "con", regex: /^(constituicao|constitution)$/ },
  { id: "int", regex: /^(inteligencia|intelligence)$/ },
  { id: "sab", regex: /^(sabedoria|wisdom)$/ },
  { id: "car", regex: /^(carisma|charisma)$/ },
];

const NOMES_EN_DAS_PERICIAS: Record<string, string> = {
  acrobacia: "acrobatics",
  adestrarAnimais: "animal handling",
  arcanismo: "arcana",
  atletismo: "athletics",
  atuacao: "performance",
  enganacao: "deception",
  furtividade: "stealth",
  historia: "history",
  intimidacao: "intimidation",
  intuicao: "insight",
  investigacao: "investigation",
  medicina: "medicine",
  natureza: "nature",
  percepcao: "perception",
  persuasao: "persuasion",
  prestidigitacao: "sleight of hand",
  religiao: "religion",
  sobrevivencia: "survival",
};

/**
 * O campo "Classe & nível" cortado na impressão ("Domínio da Sepultura Cl…"): a última palavra é o começo
 * do nome da classe (em português ou inglês) e o que vem antes é a subclasse. Só vale se o começo bate com
 * UMA classe do SRD; se for ambíguo ("B…"), devolve `undefined`.
 */
function classeDeTextoCortado(texto: string): { classe: string; subclasse?: string } | undefined {
  const palavras = texto
    .replace(/(…|\.\.\.)\s*$/, "")
    .split(/\s+/)
    .filter(Boolean);
  const ultima = semAcento(palavras[palavras.length - 1] ?? "");
  if (ultima.length < 2) return undefined;
  const achadas = CLASSES.filter((c) =>
    [c.nome, ...c.apelidos].some((n) => semAcento(n).startsWith(ultima)),
  );
  if (achadas.length !== 1 || !achadas[0]) return undefined;
  const subclasse = palavras.slice(0, -1).join(" ");
  return { classe: achadas[0].nome, ...(subclasse ? { subclasse } : {}) };
}

function atributoPeloNome(texto: string): Atributo | undefined {
  const n = norm(texto);
  for (const a of ATRIBUTOS) {
    if (n === norm(ROTULO_DO_ATRIBUTO[a]) || n === a || n === a.slice(0, 3)) return a;
  }
  return ROTULOS_DE_ATRIBUTO.find((r) => r.regex.test(n))?.id;
}

function periciaPeloTexto(texto: string): (typeof PERICIAS)[number] | undefined {
  const limpo = norm(texto.replace(/\(.*$/, "").replace(/…|\.\.\./g, ""));
  if (limpo.length < 3) return undefined;
  return PERICIAS.find((p) => {
    const pt = norm(p.nome);
    const en = NOMES_EN_DAS_PERICIAS[p.id] ?? "";
    return [pt, en].some(
      (n) => n !== "" && (n === limpo || n.startsWith(limpo) || limpo.startsWith(n)),
    );
  });
}

// ---------------------------------------------------------------------------------------------
// O parser
// ---------------------------------------------------------------------------------------------

type MagiaBloco = { titulo: string; nivel?: number; escola?: string; descricao: string };

export function importarFichaDoPdf(pedacos: readonly Pedaco[]): ImportacaoDoPdf {
  const u = escalaDoDocumento(pedacos);
  const paginas = montarPaginas(pedacos, u);
  const incertos: Incerto[] = [];
  const trechos: Record<string, string> = {};
  const incerto = (caminho: string, motivo: string, trecho: string) =>
    incertos.push({ caminho, motivo, trecho });
  const reg = (secao: string, texto: string) => {
    if (texto.trim() === "") return;
    trechos[secao] = trechos[secao] ? `${trechos[secao]}\n${texto}` : texto;
  };

  const achouNome = primeiroEmTodas(paginas, A.nome);
  const paginaDaClasse = primeiroEmTodas(paginas, A.classe);
  const principal = achouNome?.pag ?? paginaDaClasse?.pag;
  if (!principal) {
    return {
      reconhecido: false,
      ficha: { pvAtual: 1, pvMax: 1 },
      incertos: [
        {
          caminho: "",
          motivo:
            "Este PDF não parece uma ficha que eu saiba ler (não achei nome, classe nem atributos).",
          trecho: "",
        },
      ],
      trechos,
    };
  }

  const ficha: Ficha = { pvAtual: 0, pvMax: 0 };

  // --- cabeçalho ----------------------------------------------------------------------------
  // `daColuna`: só os itens que começam na coluna do rótulo. O texto da classe é largo e invade a coluna do
  // antecedente (o domínio do Rendan vinha colado no antecedente).
  const valorDe = (regex: RegExp, dyMax = 30, folga = 4, daColuna = false): string => {
    const r = acharItens(principal, regex)[0];
    if (!r) return "";
    const itens = acima(principal, r, dyMax, folga, u).filter(
      (i) => !daColuna || i.x >= r.x - 3 * u,
    );
    return linhaMaisProxima(itens, u, "acima");
  };
  const nome = valorDe(A.nome, 40, 25);
  const textoDaClasse = valorDe(A.classe, 20);
  const antecedente = valorDe(A.antecedente, 20, 4, true);
  const raca = valorDe(A.raca, 20, 4, true);
  const alinhamento = valorDe(A.alinhamento, 20, 4, true);
  reg(
    "cabecalho",
    [
      `NOME: ${nome}`,
      `CLASSE & NÍVEL: ${textoDaClasse}`,
      `ANTECEDENTE: ${antecedente}`,
      `RAÇA: ${raca}`,
      `ALINHAMENTO: ${alinhamento}`,
    ].join("\n"),
  );
  if (raca) ficha.raca = racaEmPortugues(raca).slice(0, 64);
  if (antecedente) ficha.antecedente = antecedenteEmPortugues(antecedente).slice(0, 64);
  if (alinhamento) ficha.alinhamento = tendenciaEmPortugues(alinhamento).slice(0, 64);

  const classes: ClasseDaFicha[] = [];
  // A impressão corta o campo com "…" quando o texto não cabe ("Domínio da Sepultura Cl…") e o nível se
  // perde. A classe sai do começo da palavra; o nível, de outro lugar do PDF (mais abaixo).
  const cortada = /(…|\.\.\.)\s*$/.test(textoDaClasse)
    ? classeDeTextoCortado(textoDaClasse)
    : undefined;
  for (const parte of (cortada ? "" : textoDaClasse)
    .split(/[,/;]|\se\s/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const m = /^(.*?)[\s-]*(\d+)$/.exec(parte);
    if (!m) {
      incerto("classes", "Não consegui separar a classe e o nível.", parte);
      continue;
    }
    const palavras = (m[1] ?? "").split(" ").filter(Boolean);
    const nivel = Math.min(20, Math.max(1, Number(m[2])));
    let achada: { nome: string; subclasse?: string } | undefined;
    // O sufixo mais curto primeiro: "Hunter Ranger" => subclasse "Hunter", classe "Ranger".
    for (let k = palavras.length - 1; k >= 0 && !achada; k--) {
      const srd = classeSrd(palavras.slice(k).join(" "));
      if (srd) {
        const sub = palavras.slice(0, k).join(" ");
        achada = { nome: srd.nome, ...(sub ? { subclasse: sub } : {}) };
      }
    }
    const indice = classes.length;
    if (achada) {
      classes.push({
        classe: achada.nome,
        nivel,
        ...(achada.subclasse ? { subclasse: achada.subclasse.slice(0, 48) } : {}),
      });
      if (achada.subclasse)
        incerto(
          `classes.${indice}.subclasse`,
          "Subclasse lida do texto da classe (no PDF vem junto: confira o nome).",
          parte,
        );
    } else {
      classes.push({ classe: palavras.join(" ").slice(0, 48) || parte.slice(0, 48), nivel });
      incerto(`classes.${indice}.classe`, "Classe que não está na lista do SRD.", parte);
    }
  }
  if (cortada) {
    // Nível: o número solto abaixo dos PV temporários é o total de dados de vida (= nível, numa classe só);
    // sem ele, o menor nível que dá o bônus de proficiência impresso (assumido).
    const rTemp = acharItens(principal, A.pvTemp)[0];
    const solto = rTemp ? linhaMaisProxima(abaixo(principal, rTemp, 35, 20, u), u, "abaixo") : "";
    const rProf = acharItens(principal, A.bonusProficiencia)[0];
    const nProf = rProf ? numeroNaLinha(principal, rProf, "esquerda", u) : undefined;
    let nivel = 1;
    let origem = "não achei o nível em outro lugar: entrou 1";
    if (/^\d{1,2}$/.test(solto) && Number(solto) >= 1 && Number(solto) <= 20) {
      nivel = Number(solto);
      origem = `o nível ${nivel} veio do total de dados de vida do PDF`;
    } else if (nProf && /^\d$/.test(nProf.t)) {
      nivel = Math.min(20, (Number(nProf.t) - 2) * 4 + 1);
      origem = `o nível ${nivel} foi deduzido do bônus de proficiência`;
    }
    classes.push({
      classe: cortada.classe,
      nivel,
      ...(cortada.subclasse ? { subclasse: cortada.subclasse.slice(0, 48) } : {}),
    });
    incerto(
      "classes.0.nivel",
      `O campo "Classe & nível" vem cortado no PDF; ${origem}. Confira a classe e o nível.`,
      textoDaClasse,
    );
  }
  if (classes.length > 0) ficha.classes = classes;

  // --- atributos ----------------------------------------------------------------------------
  const atributos: NonNullable<Ficha["atributos"]> = {};
  const linhasDeAtributo: string[] = [];
  for (const { id, regex } of ROTULOS_DE_ATRIBUTO) {
    const r = principal.rotulos.find((i) => regex.test(i.n));
    if (!r) {
      incerto(`atributos.${id}`, "Rótulo do atributo não encontrado no PDF.", "");
      continue;
    }
    const numeros = abaixo(principal, r, 65, 6, u)
      .filter((i) => EH_NUMERO.test(i.t))
      .sort((a, b) => b.y - a.y)
      .slice(0, 2);
    const grande = [...numeros].sort((a, b) => b.altura - a.altura)[0];
    const pequeno = numeros.find((i) => i !== grande);
    const lido = numeros.map((i) => i.t).join(" / ");
    linhasDeAtributo.push(`${r.t}: ${lido}`);
    if (!pequeno || !grande) {
      incerto(
        `atributos.${id}`,
        "Não achei os dois números (modificador e valor) do atributo.",
        `${r.t} ${lido}`,
      );
      continue;
    }
    const valor = Number(pequeno.t);
    atributos[id] = Math.min(30, Math.max(1, valor));
    // Modificador conferido: o PDF imprime o grande como modificador (pode vir sem sinal).
    if (modificador(valor) !== Number(grande.t))
      incerto(
        `atributos.${id}`,
        "O modificador do PDF não bate com o valor do atributo.",
        `${r.t}: ${grande.t} / ${pequeno.t}`,
      );
  }
  reg("atributos", linhasDeAtributo.join("\n"));
  if (Object.keys(atributos).length > 0) ficha.atributos = atributos;
  const modDe = (a: Atributo) => modificador(atributos[a] ?? 10);

  // --- gerais: proficiência, PV, CA, iniciativa, deslocamento -----------------------------------
  const nivelDaFicha = classes.reduce((t, c) => t + c.nivel, 0);
  const derivada = nivelDaFicha > 0 ? bonusDeProficiencia({ ...ficha, classes }) : 2;
  const rotuloProf = acharItens(principal, A.bonusProficiencia)[0];
  const numProf = rotuloProf ? numeroNaLinha(principal, rotuloProf, "esquerda", u) : undefined;
  const prof = numProf ? Number(numProf.t) : derivada;
  reg("gerais", `BÔNUS DE PROFICIÊNCIA: ${numProf?.t ?? "(não achei)"}`);
  if (numProf && prof !== derivada)
    incerto(
      "classes",
      `O bônus de proficiência do PDF (${prof}) não bate com o do nível total (${derivada}).`,
      `BÔNUS DE PROFICIÊNCIA ${numProf.t}`,
    );

  const rotuloPvMax = acharItens(principal, A.pvMax)[0];
  const numPvMax = rotuloPvMax ? numeroNaLinha(principal, rotuloPvMax, "direita", u) : undefined;
  if (numPvMax) ficha.pvMax = Math.min(9999, Number(numPvMax.t));
  else incerto("pvMax", "PV máximo não encontrado.", "");
  reg("gerais", `PONTOS DE VIDA MÁXIMO: ${numPvMax?.t ?? "(não achei)"}`);

  const numeroAcima = (regex: RegExp): string => {
    const r = acharItens(principal, regex)[0];
    if (!r) return "";
    const t = linhaMaisProxima(acima(principal, r, 22, 20, u), u, "acima");
    return /^\d+$/.test(t) ? t : "";
  };
  const atual = numeroAcima(A.pvAtual);
  if (atual) ficha.pvAtual = Math.min(9999, Number(atual));
  else {
    ficha.pvAtual = ficha.pvMax;
    incerto("pvAtual", "Vazio no PDF: entrou o PV máximo.", "PONTOS DE VIDA ATUAIS: (vazio)");
  }
  const temp = numeroAcima(A.pvTemp);
  if (temp) ficha.pvTemp = Math.min(9999, Number(temp));
  else
    incerto(
      "pvTemp",
      "Vazio no PDF: ficou sem PV temporários.",
      "PONTOS DE VIDA TEMPORÁRIOS: (vazio)",
    );
  reg(
    "gerais",
    `PONTOS DE VIDA ATUAIS: ${atual || "(vazio)"}\nPONTOS DE VIDA TEMPORÁRIOS: ${temp || "(vazio)"}`,
  );
  const rotuloTemp = acharItens(principal, A.pvTemp)[0];
  if (rotuloTemp) {
    const solto = linhaMaisProxima(abaixo(principal, rotuloTemp, 35, 20, u), u, "abaixo");
    if (/^\d+$/.test(solto) && !cortada)
      incerto(
        "dadosDeVida",
        "Há um número sem rótulo logo abaixo dos PV temporários (provavelmente o total de dados de vida); a ficha calcula os dados pelas classes e não o guardou.",
        solto,
      );
  }

  // CA, iniciativa e deslocamento: na ficha impressa os rótulos não saem; os três números ficam numa
  // linha acima do PV máximo (nessa ordem). Se houver rótulos, eles mandam.
  let ca: number | undefined;
  let inicLida: number | undefined;
  let deslLida: string | undefined;
  const lerRotulado = (regex: RegExp) => {
    const r = principal.rotulos.find((i) => regex.test(i.n));
    return r ? linhaMaisProxima(acima(principal, r, 30, 15, u), u, "acima") : "";
  };
  const rCa = lerRotulado(A.ca);
  const rIn = lerRotulado(A.iniciativa);
  const rDe = lerRotulado(A.deslocamento);
  if (rCa || rIn || rDe) {
    if (/\d/.test(rCa)) ca = Number(rCa.match(/\d+/)?.[0]);
    if (/\d/.test(rIn)) inicLida = Number(rIn.match(/[+-]?\d+/)?.[0]);
    if (rDe) deslLida = rDe;
  } else if (rotuloPvMax) {
    const faixa = principal.itens.filter(
      (i) =>
        !i.rotulo &&
        i.altura > 0 &&
        i.x >= rotuloPvMax.x - 20 * u &&
        i.x <= rotuloPvMax.x + 130 * u &&
        i.y > rotuloPvMax.y + 10 * u &&
        i.y < rotuloPvMax.y + 90 * u,
    );
    const linha = agruparEmLinhas(faixa, u).filter((l) => l.itens.length >= 3);
    const mais = linha[linha.length - 1];
    if (mais) {
      const [a, b, c] = mais.itens;
      reg("gerais", `CA / INICIATIVA / DESLOCAMENTO: ${mais.itens.map((i) => i.t).join(" | ")}`);
      if (a && EH_NUMERO.test(a.t)) ca = Number(a.t);
      if (b && EH_NUMERO.test(b.t)) inicLida = Number(b.t);
      if (c) deslLida = c.t;
    }
  }
  if (ca !== undefined) ficha.ca = { valor: Math.min(50, Math.max(0, ca)) };
  else incerto("ca", "Não achei a classe de armadura.", "");
  if (inicLida !== undefined) {
    const extra = inicLida - modDe("des");
    if (extra !== 0 && Math.abs(extra) <= 50) {
      ficha.iniciativaBonus = extra;
      incerto(
        "iniciativaBonus",
        "A iniciativa do PDF difere do modificador de Destreza; a diferença entrou como bônus.",
        String(inicLida),
      );
    }
  } else incerto("iniciativaBonus", "Não achei a iniciativa.", "");
  if (deslLida) {
    const m = /(\d+(?:[.,]\d+)?)\s*(ft|pes|pés|m|metros)?/i.exec(deslLida);
    if (m) {
      const valor = Number((m[1] ?? "0").replace(",", "."));
      const metros = /^(m|metros)$/i.test(m[2] ?? "");
      ficha.deslocamentoFt = Math.min(500, Math.round(metros ? valor / 0.3 : valor));
    } else incerto("deslocamentoFt", "Não entendi o deslocamento.", deslLida);
  } else incerto("deslocamentoFt", "Não achei o deslocamento.", "");

  // --- salvaguardas e perícias (proficiência deduzida pela conta) -----------------------------
  const salvaguardas: NonNullable<Ficha["salvaguardas"]> = {};
  const pericias: NonNullable<Ficha["pericias"]> = {};
  const linhasDeSalvaguarda: string[] = [];
  const linhasDePericia: string[] = [];
  const vistas = new Set<string>();
  const avaliar = (trecho: string, valor: number, nomeNaLinha: string, rotuloNaLinha: boolean) => {
    const atributo = atributoPeloNome(nomeNaLinha);
    if (atributo && !rotuloNaLinha) {
      if (vistas.has(`s${atributo}`)) return;
      vistas.add(`s${atributo}`);
      linhasDeSalvaguarda.push(trecho);
      const dif = valor - modDe(atributo);
      if (dif === 0) return;
      if (dif === prof) salvaguardas[atributo] = { nivel: "proficiente" };
      else {
        salvaguardas[atributo] = { nivel: "nenhuma", bonus: Math.max(-50, Math.min(50, dif)) };
        incerto(
          `salvaguardas.${atributo}`,
          `O valor ${valor} não fecha a conta (modificador ${modDe(atributo)}, proficiência ${prof}): ficou como bônus extra.`,
          trecho,
        );
      }
      return;
    }
    const pericia = periciaPeloTexto(nomeNaLinha);
    if (!pericia || vistas.has(pericia.id)) return;
    vistas.add(pericia.id);
    linhasDePericia.push(trecho);
    const dif = valor - modDe(pericia.atributo);
    if (dif === 0) return;
    if (dif === prof) pericias[pericia.id] = { nivel: "proficiente" };
    else if (dif === 2 * prof) pericias[pericia.id] = { nivel: "especialista" };
    else {
      pericias[pericia.id] = { nivel: "nenhuma", bonus: Math.max(-50, Math.min(50, dif)) };
      incerto(
        `pericias.${pericia.id}`,
        `O valor ${valor} não fecha a conta (modificador ${modDe(pericia.atributo)}, proficiência ${prof}): ficou como bônus extra.`,
        trecho,
      );
    }
  };
  for (const linha of principal.linhas) {
    // Outras colunas ficam na mesma altura: cada número da linha pode ser o valor de uma salvaguarda ou
    // perícia, e o nome é o que vem colado depois dele.
    for (let k = 0; k < linha.itens.length; k++) {
      const primeiro = linha.itens[k];
      if (!primeiro || !EH_NUMERO.test(primeiro.t)) continue;
      const colados = trechoContiguo(linha.itens.slice(k), u).slice(1);
      if (colados.length === 0) continue;
      const nomeColado = juntar(colados, u);
      avaliar(
        `${primeiro.t} ${nomeColado}`,
        Number(primeiro.t),
        nomeColado,
        colados.some((i) => i.rotulo),
      );
    }
  }
  reg("salvaguardas", linhasDeSalvaguarda.join("\n"));
  reg("pericias", linhasDePericia.join("\n"));
  if (Object.keys(salvaguardas).length > 0) ficha.salvaguardas = salvaguardas;
  if (Object.keys(pericias).length > 0) ficha.pericias = pericias;
  if (vistas.size === 0) incerto("pericias", "Não achei a lista de salvaguardas e perícias.", "");

  // Percepção passiva: confere com a conta.
  const rotuloPassiva = acharItens(principal, A.percepcaoPassiva)[0];
  const numPassiva = rotuloPassiva
    ? numeroNaLinha(principal, rotuloPassiva, "esquerda", u)
    : undefined;
  if (numPassiva) {
    const esperada =
      10 +
      modDe("sab") +
      (ficha.pericias?.percepcao?.nivel === "proficiente" ? prof : 0) +
      (ficha.pericias?.percepcao?.nivel === "especialista" ? 2 * prof : 0) +
      (ficha.pericias?.percepcao?.bonus ?? 0);
    reg("gerais", `SABEDORIA PASSIVA (PERCEPÇÃO): ${numPassiva.t}`);
    if (Number(numPassiva.t) !== esperada)
      incerto(
        "pericias.percepcao",
        `A percepção passiva do PDF (${numPassiva.t}) não bate com a conta (${esperada}).`,
        `SABEDORIA PASSIVA (PERCEPÇÃO) ${numPassiva.t}`,
      );
  }

  // Outras proficiências e idiomas.
  {
    const r = principal.rotulos.find((i) => A.outrasProf.test(i.n));
    const texto = r ? textoDosItens(acima(principal, r, 120, 8, u), u) : "";
    reg("idiomas", `OUTRAS PROFICIÊNCIAS & IDIOMAS: ${texto || "(vazio)"}`);
    if (texto) {
      // A ficha impressa traz "IDIOMA: Common ARMADURA: Light Armor ARMA: Simple Weapons": separa pelos rótulos.
      const secoes = texto.split(/\b([A-ZÀ-Ý]{4,})\s*:\s*/u);
      const rotulado = secoes.length > 2 && /^(idiomas?|languages?)$/i.test(secoes[1] ?? "");
      const separar = (t: string) =>
        t
          .split(/[,;\n]/)
          .map((x) => x.trim().slice(0, 40))
          .filter(Boolean);
      if (rotulado) {
        const idiomas: string[] = [];
        const outras: string[] = [];
        for (let k = 1; k + 1 < secoes.length; k += 2) {
          const rotulo = secoes[k] ?? "";
          const conteudo = (secoes[k + 1] ?? "").trim();
          if (/^(idiomas?|languages?)$/i.test(rotulo))
            idiomas.push(...separar(conteudo).map(idiomaEmPortugues));
          else if (conteudo) outras.push(`${tituloBonito(rotulo)}: ${conteudo}`);
        }
        if (outras.length > 0) ficha.outrasProficiencias = outras.join("\n").slice(0, 4000);
        ficha.idiomas = idiomas.slice(0, 30);
      } else {
        ficha.outrasProficiencias = texto.slice(0, 4000);
        ficha.idiomas = separar(texto).slice(0, 30);
      }
    } else
      incerto(
        "idiomas",
        "Vazio no PDF: nenhum idioma foi importado.",
        "OUTRAS PROFICIÊNCIAS & IDIOMAS: (vazio)",
      );
  }

  // --- personalidade e moedas (V4a: campos próprios da ficha de papel; antes iam para as notas) ----
  for (const [titulo, campo, regex] of [
    ["Traços de personalidade", "personalidade", /^(tracos de personalidade|personality traits)$/],
    ["Ideais", "ideais", /^(ideais|ideals)$/],
    ["Vínculos", "ligacoes", /^(vinculos|ligacoes|bonds)$/],
    ["Defeitos", "defeitos", /^(defeitos|flaws)$/],
  ] as const) {
    const r = principal.rotulos.find((i) => regex.test(i.n));
    if (!r) continue;
    // Abaixo da faixa do cabeçalho (os rótulos "ALINHAMENTO" e "PONTOS DE EXPERIÊNCIA" vazavam no texto).
    const teto = acharItens(principal, A.alinhamento)[0]?.y ?? Number.POSITIVE_INFINITY;
    const texto = textoDosItens(
      acima(principal, r, 130, 45, u).filter((i) => i.y < teto - u),
      u,
    );
    reg("notas", `${titulo.toUpperCase()}: ${texto || "(vazio)"}`);
    if (texto) ficha[campo] = texto.slice(0, 2000);
  }
  // Moedas: CP/SP/EP/GP/PP da ficha impressa são PC/PP/PE/PO/PL da ficha em português.
  const CAMPO_DA_MOEDA: Record<string, keyof NonNullable<Ficha["moedas"]>> = {
    cp: "pc",
    sp: "pp",
    ep: "pe",
    gp: "po",
    pp: "pl",
  };
  const moedas: NonNullable<Ficha["moedas"]> = {};
  for (const pag of paginas) {
    for (const r of pag.rotulos.filter((i) => /^(cp|sp|ep|gp|pp)$/.test(i.n))) {
      const n = linhaMaisProxima(
        pag.itens.filter(
          (i) =>
            EH_NUMERO.test(i.t) &&
            i.y > r.y &&
            i.y < r.y + 20 * u &&
            i.fim <= r.x + 2 * u &&
            i.x > r.x - 20 * u,
        ),
        u,
        "acima",
      );
      const campo = CAMPO_DA_MOEDA[r.n];
      if (campo && /^\d+$/.test(n) && n !== "0" && moedas[campo] === undefined) {
        moedas[campo] = Math.min(9_999_999, Number(n));
      }
    }
  }
  if (Object.keys(moedas).length > 0) {
    ficha.moedas = moedas;
    reg(
      "notas",
      `MOEDAS: ${Object.entries(moedas)
        .map(([k, v]) => `${v} ${k.toUpperCase()}`)
        .join(", ")}`,
    );
  }
  // Pontos de experiência: o número acima do rótulo, quando há.
  {
    const r = principal.rotulos.find((i) =>
      /^(pontos de experiencia|experience points)$/.test(i.n),
    );
    const valor = r ? linhaMaisProxima(acima(principal, r, 20, 4, u), u, "acima") : "";
    if (/^\d+$/.test(valor)) ficha.xp = Math.min(99_999_999, Number(valor));
  }
  // Página dos detalhes (idade, aparência, história...): só lê o que o PDF tiver; o que falta fica vazio.
  for (const [campo, regex, max] of [
    ["idade", /^(idade|age)$/, 40],
    ["altura", /^(altura|height)$/, 40],
    ["peso", /^(peso|weight)$/, 40],
    ["olhos", /^(olhos|eyes)$/, 40],
    ["pele", /^(pele|skin)$/, 40],
    ["cabelos", /^(cabelos?|hair)$/, 40],
    ["aparencia", /^(aparencia do personagem|aparencia|character appearance|appearance)$/, 4000],
    ["aliados", /^(aliados & organizacoes|aliados e organizacoes|allies & organizations)$/, 8000],
    ["historia", /^(historia do personagem|character backstory|backstory)$/, 20_000],
    ["tesouro", /^(tesouro|treasure)$/, 8000],
  ] as const) {
    // Só rótulos em maiúsculas pequenas: "História" é também o nome de uma perícia.
    let achado: { pag: Pag; item: Item } | undefined;
    for (const pag of paginas) {
      const item = pag.rotulos.find((i) => regex.test(i.n));
      if (item) {
        achado = { pag, item };
        break;
      }
    }
    if (!achado) continue;
    const { pag, item } = achado;
    const texto = textoDosItens(acima(pag, item, campo.length > 8 ? 300 : 20, 30, u), u);
    reg("notas", `${campo.toUpperCase()}: ${texto || "(vazio)"}`);
    if (texto) ficha[campo] = texto.slice(0, max);
  }

  // --- conjuração: cabeçalho e lista por nível -------------------------------------------------
  const paginaDaConjuracao = paginas.find((p) => p.itens.some((i) => A.cdConj.test(i.n)));
  const listas: { nome: string; nivel: number }[] = [];
  if (paginaDaConjuracao) {
    const pag = paginaDaConjuracao;
    const valorDaConj = (regex: RegExp) => {
      const r =
        pag.itens.find((i) => regex.test(i.n)) ??
        pag.itens.find((i) => i.rotulo && regex.test(i.n));
      return r ? linhaMaisProxima(acima(pag, r, 30, 15, u), u, "acima") : "";
    };
    // Os rótulos têm duas linhas ("SPELLCASTING" / "ABILITY"): junta as linhas de rótulo vizinhas.
    const compostos = rotulosCompostos(pag, u);
    const valorComposto = (regex: RegExp): string => {
      const c = compostos.find((x) => regex.test(norm(x.texto)));
      return c ? linhaMaisProxima(acima(pag, c.topo, 30, 15, u), u, "acima") : valorDaConj(regex);
    };
    const hab = valorComposto(A.habilidadeConj);
    const cd = valorComposto(A.cdConj);
    const atq = valorComposto(A.ataqueConj);
    reg(
      "conjuracao",
      `HABILIDADE DE CONJURAÇÃO: ${hab}\nCD DE MAGIA: ${cd}\nBÔNUS DE ATAQUE DE MAGIA: ${atq}`,
    );
    const habilidade = hab ? atributoPeloNome(hab) : undefined;
    if (hab && !habilidade) incerto("conjuracao", "Não entendi a habilidade de conjuração.", hab);
    if (habilidade) {
      const diferentes = classes.filter((c) => {
        const srd = classeSrd(c.classe);
        return srd && srd.conjurador !== "nenhum" && srd.habilidade !== habilidade;
      });
      if (diferentes.length > 0)
        ficha.conjuracao = diferentes.map((c) => ({ classe: c.classe, habilidade }));
    }
    const comoFicha: Ficha = { ...ficha, classes };
    const lidoCd = /\d+/.test(cd) ? Number(cd.match(/\d+/)?.[0]) : undefined;
    const lidoAtq = /\d+/.test(atq) ? Number(atq.match(/[+-]?\d+/)?.[0]) : undefined;
    const conj = conjuradoras(comoFicha);
    if (lidoCd !== undefined && !conj.some((c) => c.cd === lidoCd))
      incerto(
        "conjuracao",
        `A CD do PDF (${lidoCd}) não bate com a calculada pela ficha.`,
        `CD ${cd}`,
      );
    if (lidoAtq !== undefined && !conj.some((c) => c.ataque === lidoAtq))
      incerto(
        "conjuracao",
        `O ataque de magia do PDF (${lidoAtq}) não bate com o calculado pela ficha.`,
        `ATAQUE ${atq}`,
      );

    // Cabeçalhos de nível: um dígito (o nível), com o total de espaços logo à direita na mesma linha.
    const topoY = Math.min(
      ...compostos
        .filter((c) => A.cdConj.test(norm(c.texto)) || A.habilidadeConj.test(norm(c.texto)))
        .map((c) => c.topo.y),
      Infinity,
    );
    const digitos = pag.itens.filter(
      (i) => /^\d$/.test(i.t) && i.altura > 0 && i.y < topoY - 2 * u,
    );
    const ehTotal = (d: Item) =>
      digitos.some(
        (e) => e !== d && Math.abs(e.y - d.y) <= 2 * u && e.x < d.x && d.x - e.x < 60 * u,
      );
    const cabecalhos = digitos.filter((d) => !ehTotal(d));
    const totais = new Map<number, number>();
    for (const c of cabecalhos) {
      const t = digitos.find(
        (d) =>
          d !== c && ehTotal(d) && Math.abs(d.y - c.y) <= 2 * u && d.x > c.x && d.x - c.x < 60 * u,
      );
      if (t) totais.set(Number(c.t), Number(t.t));
    }
    const colunas = [...new Set(cabecalhos.map((c) => Math.round(c.x)))].sort((a, b) => a - b);
    const colunaDe = (x: number) => {
      let achada = colunas[0] ?? 0;
      for (const c of colunas) if (c <= x + 12 * u) achada = c;
      return achada;
    };
    const lidas: string[] = [];
    for (const c of cabecalhos) {
      const col = Math.round(c.x);
      const proximo = cabecalhos
        .filter((o) => Math.round(o.x) === col && o.y < c.y - u)
        .sort((a, b) => b.y - a.y)[0];
      const nivel = Number(c.t);
      const itensDaSecao = pag.itens.filter(
        (i) =>
          !/^\d$/.test(i.t) &&
          colunaDe(i.x) === col &&
          i.y < c.y - 3 * u &&
          (!proximo || i.y > proximo.y + 3 * u) &&
          !(Math.abs(i.y - c.y) <= 3 * u),
      );
      for (const l of agruparEmLinhas(itensDaSecao, u)) {
        listas.push({ nome: l.texto, nivel });
        lidas.push(`${nivel === 0 ? "Truque" : `${nivel}º`}: ${l.texto}`);
      }
    }
    reg("magias", lidas.join("\n"));
    // Espaços do PDF contra a tabela de multiclasse.
    const tabela = espacosDeMagia(nivelDeConjurador(classes));
    const divergentes: string[] = [];
    for (let n = 1; n <= 9; n++) {
      const lido = totais.get(n);
      if (lido !== undefined && lido !== (tabela[n - 1] ?? 0))
        divergentes.push(`${n}º: PDF ${lido}, tabela ${tabela[n - 1] ?? 0}`);
    }
    reg(
      "conjuracao",
      `ESPAÇOS (PDF): ${
        [...totais.entries()]
          .filter(([, v]) => v > 0)
          .map(([n, v]) => `${n}º=${v}`)
          .join(", ") || "nenhum"
      }`,
    );
    if (divergentes.length > 0)
      incerto(
        "espacos",
        `Os espaços de magia do PDF não batem com a tabela das classes (${divergentes.join("; ")}).`,
        divergentes.join("; "),
      );
  }

  // --- descrições das magias (colunas, blocos) --------------------------------------------------
  const paginasDeMagia = paginas.filter((p) =>
    p.linhas.some((l) => A.tempoDeConjuracao.test(norm(l.texto))),
  );
  const blocos = blocosDeMagia(paginasDeMagia, u);
  const porNome = new Map(blocos.map((b) => [norm(b.titulo), b]));
  const magias: Magia[] = [];
  listas.forEach((l, i) => {
    const bloco = porNome.get(norm(l.nome));
    const magia: Magia = {
      nome: l.nome.slice(0, 80),
      nivel: l.nivel,
      preparada: true,
      descricao: (bloco?.descricao ?? "").slice(0, 20_000),
    };
    if (bloco?.escola) magia.escola = bloco.escola.slice(0, 32);
    magias.push(magia);
    if (!bloco)
      incerto(
        `magias.${i}.descricao`,
        "A descrição desta magia não apareceu nas páginas de magias do PDF.",
        l.nome,
      );
    else if (bloco.nivel !== undefined && bloco.nivel !== l.nivel)
      incerto(
        `magias.${i}.nivel`,
        `O nível da descrição (${bloco.nivel}) difere do da lista (${l.nivel}).`,
        bloco.titulo,
      );
  });
  if (magias.length > 0) {
    ficha.magias = magias;
    incerto(
      "magias",
      "O PDF não mostra quais magias estão preparadas: todas entraram como preparadas.",
      `${magias.length} magias`,
    );
  }
  for (const b of blocos) {
    if (!listas.some((l) => norm(l.nome) === norm(b.titulo)))
      incerto(
        "magias",
        "Há descrição de uma magia que não está na lista de conjuração; ela não foi importada.",
        b.titulo,
      );
  }

  // --- ataques (valor fixo; nome e tipo cortados vão para revisão) ------------------------------
  const nomesDeMagia = magias.map((m) => m.nome);
  const equipamentoLido: ItemDaFicha[] = [];
  const itens: ItemDaFicha[] = [];
  const ataques: Ataque[] = [];
  const linhasDeAtaque: string[] = [];
  const linhasDeEquipamento: string[] = [];
  // Equipamento primeiro (as sugestões dos nomes cortados usam esta lista).
  for (const pag of paginas) {
    const r = pag.rotulos.find((i) => A.equipamento.test(i.n));
    if (!r) continue;
    const dentro = acima(pag, r, 260, 60, u).filter(
      (i) => i.x >= r.x - 60 * u && i.x <= r.fim + 60 * u,
    );
    for (const l of agruparEmLinhas(dentro, u)) {
      const [primeiro, ...resto] = l.itens;
      if (!primeiro) continue;
      linhasDeEquipamento.push(l.texto);
      if (/^\d+$/.test(primeiro.t) && resto.length > 0) {
        itens.push({
          nome: juntar(resto, u).slice(0, 80),
          quantidade: Math.min(9999, Number(primeiro.t)),
        });
      } else itens.push({ nome: l.texto.slice(0, 80), quantidade: 1 });
    }
  }
  equipamentoLido.push(...itens);
  reg("equipamento", linhasDeEquipamento.join("\n"));
  if (itens.length > 0) ficha.itens = itens;

  for (const pag of paginas) {
    const cabNome = pag.itens.find((i) => A.cabNome.test(i.n));
    if (!cabNome) continue;
    const mesma = pag.itens.filter((i) => Math.abs(i.y - cabNome.y) <= 3 * u);
    const cabAtq = mesma.find((i) => A.cabAtaque.test(i.n));
    const cabDano = mesma.find((i) => A.cabDano.test(i.n));
    if (!cabAtq || !cabDano) continue;
    const rotuloDaCaixa = pag.rotulos.find((i) => A.ataquesRotulo.test(i.n) && i.y < cabNome.y);
    const piso = rotuloDaCaixa ? rotuloDaCaixa.y + u : cabNome.y - 400 * u;
    const direita = cabNome.x + 1.6 * (cabDano.x - cabNome.x);
    const area = pag.itens.filter(
      (i) =>
        i.altura > 0 &&
        !i.rotulo &&
        i.y < cabNome.y - 2 * u &&
        i.y > piso &&
        i.x >= cabNome.x - 2 * u &&
        i.x < direita,
    );
    for (const l of agruparEmLinhas(area, u)) {
      const nomeDoAtaque = juntar(
        l.itens.filter((i) => i.x < cabAtq.x - 0.5 * u),
        u,
      );
      const atq = juntar(
        l.itens.filter((i) => i.x >= cabAtq.x - 0.5 * u && i.x < cabDano.x - 0.5 * u),
        u,
      );
      const dano = juntar(
        l.itens.filter((i) => i.x >= cabDano.x - 0.5 * u),
        u,
      );
      if (nomeDoAtaque === "") continue;
      linhasDeAtaque.push(`${nomeDoAtaque} | ${atq || "-"} | ${dano || "-"}`);
      const idx = ataques.length;
      const trecho = `${nomeDoAtaque} | ${atq || "-"} | ${dano || "-"}`;
      const ataque: Ataque = { nome: nomeDoAtaque.slice(0, 80) };
      // Nome cortado: recupera com as magias do próprio PDF quando só há uma candidata.
      if (cortado(nomeDoAtaque)) {
        const prefixo = norm(nomeDoAtaque.replace(/…|\.\.\./g, ""));
        const candidatas =
          prefixo.length >= 3 ? nomesDeMagia.filter((m) => norm(m).startsWith(prefixo)) : [];
        const unicas = [...new Set(candidatas)];
        if (unicas.length === 1 && unicas[0]) {
          ataque.nome = unicas[0].slice(0, 80);
          incerto(
            `ataques.${idx}.nome`,
            `recuperado: o nome estava cortado no PDF ("${nomeDoAtaque}") e foi completado pela lista de magias.`,
            trecho,
          );
        } else {
          const sugestoes = [
            ...new Set(
              equipamentoLido.filter((e) => norm(e.nome).startsWith(prefixo)).map((e) => e.nome),
            ),
          ];
          incerto(
            `ataques.${idx}.nome`,
            `Nome cortado no PDF${sugestoes.length > 0 ? `; no equipamento há: ${sugestoes.join(", ")}` : ""}. Digite o nome certo.`,
            trecho,
          );
        }
      }
      const cdM = /^(?:cd|dc)\s*:?\s*(\d+)$/i.exec(atq);
      const fixoM = /^([+-]?\d+)$/.exec(atq);
      if (cdM?.[1]) ataque.cd = Number(cdM[1]);
      else if (fixoM?.[1]) ataque.acerto = { tipo: "fixo", valor: Number(fixoM[1]) };
      else if (atq !== "" && atq !== "-" && atq !== "—")
        incerto(`ataques.${idx}.acerto`, "Não entendi o bônus de ataque.", trecho);
      if (dano !== "" && dano !== "-") {
        const palavras = dano.split(" ");
        const expressao: string[] = [];
        while (palavras.length > 0 && /^[\dDd+\-*/()x]+$/.test(palavras[0] ?? ""))
          expressao.push(palavras.shift() ?? "");
        const tipo = palavras.join(" ");
        if (expressao.length > 0) {
          ataque.dano = expressao.join("").slice(0, 100);
          if (tipo) ataque.tipo = tipo.slice(0, 32);
        } else ataque.tipo = dano.slice(0, 32);
        if (cortado(dano))
          incerto(`ataques.${idx}.tipo`, "O dano estava cortado no PDF; confira o tipo.", trecho);
      }
      ataques.push(ataque);
    }
  }
  reg("ataques", linhasDeAtaque.join("\n"));
  if (ataques.length > 0) ficha.ataques = ataques;

  // --- recursos (sempre incertos) ----------------------------------------------------------------
  const recursos: Recurso[] = [];
  const repeticoes = new Map<string, number>();
  const linhasDeRecurso: string[] = [];
  for (const pag of paginas) {
    for (const total of acharItens(pag, A.total)) {
      const colunaX = { x: total.x - 3 * u, fim: total.x + 75 * u, y: total.y };
      const grande = pag.itens
        .filter(
          (i) =>
            /^\d+$/.test(i.t) &&
            i.y < total.y - 3 * u &&
            i.y > total.y - 40 * u &&
            i.x >= colunaX.x &&
            i.x < colunaX.fim &&
            i.altura > total.altura,
        )
        .sort((a, b) => b.y - a.y)[0];
      if (!grande) continue;
      const valorTotal = numeroNaLinha(pag, total, "direita", u);
      const dentroDoTotal = valorTotal && valorTotal.x < total.x + 75 * u ? valorTotal : undefined;
      const rotulosDaCaixa = pag.rotulos
        .filter(
          (i) =>
            i.y < grande.y - 3 * u &&
            i.y > grande.y - 35 * u &&
            i.x >= colunaX.x &&
            i.x < colunaX.fim,
        )
        .sort((a, b) => b.y - a.y);
      const nomeLinhas: Item[] = [];
      for (const r of rotulosDaCaixa) {
        const anterior = nomeLinhas[nomeLinhas.length - 1];
        if (!anterior || anterior.y - r.y <= 14 * u) nomeLinhas.push(r);
        else break;
      }
      if (nomeLinhas.length === 0) continue;
      const nomeBruto = nomeLinhas.map((r) => r.t).join(" ");
      const maxDoNome = /\(\s*(?:max|máx|máximo)\.?\s*(\d+)\s*\)/i.exec(nomeBruto);
      const nomeLimpo = tituloBonito(
        nomeBruto
          .replace(/\(\s*(?:max|máx|máximo)\.?\s*\d+\s*\)/i, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      const chave = norm(nomeLimpo);
      const trecho = `${nomeBruto} | atual ${grande.t} | Total ${dentroDoTotal?.t ?? "(vazio)"}`;
      const anteriorIgual = repeticoes.get(chave);
      repeticoes.set(chave, (anteriorIgual ?? 0) + 1);
      if (anteriorIgual !== undefined) continue;
      const atualR = Number(grande.t);
      const maxR = maxDoNome?.[1]
        ? Number(maxDoNome[1])
        : dentroDoTotal
          ? Number(dentroDoTotal.t)
          : atualR;
      recursos.push({
        nome: nomeLimpo.slice(0, 80),
        atual: Math.min(atualR, 9999),
        max: Math.min(Math.max(maxR, atualR), 9999),
        recarga: "nenhuma",
      });
      linhasDeRecurso.push(trecho);
    }
  }
  recursos.forEach((r, i) => {
    const vezes = repeticoes.get(norm(r.nome)) ?? 1;
    incerto(
      `recursos.${i}`,
      `Caixa de recurso lida do PDF${vezes > 1 ? ` (a caixa aparece ${vezes} vezes)` : ""}: confira o atual, o máximo e quando recarrega.`,
      linhasDeRecurso[i] ?? r.nome,
    );
  });
  reg("recursos", linhasDeRecurso.join("\n"));
  if (recursos.length > 0) ficha.recursos = recursos;

  // --- características -----------------------------------------------------------------------------
  const rotuloDeCaracteristicas = principal.rotulos.find((i) => A.caracteristicas.test(i.n));
  const nomesDasCaracteristicas: string[] = [];
  if (rotuloDeCaracteristicas) {
    const linhas = agruparEmLinhas(acima(principal, rotuloDeCaracteristicas, 400, 40, u), u);
    const passos = linhas
      .slice(1)
      .map((l, i) => (linhas[i]?.y ?? 0) - l.y)
      .sort((a, b) => a - b);
    const mediana = passos[Math.floor(passos.length / 2)] ?? 15 * u;
    let atualNome = "";
    let anterior: Linha | undefined;
    for (const l of linhas) {
      if (anterior && anterior.y - l.y < 0.75 * mediana) atualNome += ` ${l.texto}`;
      else {
        if (atualNome) nomesDasCaracteristicas.push(atualNome);
        atualNome = l.texto;
      }
      anterior = l;
    }
    if (atualNome) nomesDasCaracteristicas.push(atualNome);
  }
  const paginasDeTexto = paginas.filter(
    (p) =>
      p !== principal &&
      p !== paginaDaConjuracao &&
      !paginasDeMagia.includes(p) &&
      !p.itens.some((i) => A.cabAtaque.test(i.n)),
  );
  const fluxoDeCaracteristicas = fluxoPorColunas(paginasDeTexto, u);
  const caracteristicas: { nome: string; descricao: string }[] = [];
  {
    let cursor = 0;
    const achados: { nome: string; ini: number; fimTitulo: number }[] = [];
    for (const nomeLido of nomesDasCaracteristicas) {
      const alvo = norm(nomeLido);
      let pos = -1;
      let tam = 1;
      for (let i = cursor; i < fluxoDeCaracteristicas.length && pos < 0; i++) {
        let texto = "";
        for (let k = 0; k < 3 && i + k < fluxoDeCaracteristicas.length; k++) {
          texto = `${texto} ${fluxoDeCaracteristicas[i + k]?.texto ?? ""}`.trim();
          if (norm(texto) === alvo) {
            pos = i;
            tam = k + 1;
            break;
          }
          if (norm(texto).length > alvo.length) break;
        }
      }
      if (pos >= 0) {
        achados.push({ nome: nomeLido, ini: pos, fimTitulo: pos + tam });
        cursor = pos + tam;
      } else achados.push({ nome: nomeLido, ini: -1, fimTitulo: -1 });
    }
    achados.forEach((a, i) => {
      const nomeBonito = tituloBonito(a.nome).slice(0, 80);
      if (a.ini < 0) {
        caracteristicas.push({ nome: nomeBonito, descricao: "" });
        incerto(
          `caracteristicas.${i}.descricao`,
          "A descrição desta característica não apareceu nas páginas do PDF.",
          a.nome,
        );
        return;
      }
      const proximo = achados.slice(i + 1).find((x) => x.ini >= 0);
      const fim = proximo ? proximo.ini : fluxoDeCaracteristicas.length;
      caracteristicas.push({
        nome: nomeBonito,
        descricao: paragrafos(fluxoDeCaracteristicas.slice(a.fimTitulo, fim)).slice(0, 20_000),
      });
    });
  }
  reg("caracteristicas", nomesDasCaracteristicas.join("\n"));
  if (caracteristicas.length > 0) ficha.caracteristicas = caracteristicas;

  // --- fecho --------------------------------------------------------------------------------------
  const valida = FichaSchema.safeParse(ficha);
  if (!valida.success) {
    incerto(
      "",
      `A ficha lida não passou na validação: ${valida.error.issues[0]?.message ?? "erro"}.`,
      "",
    );
  }
  return {
    reconhecido: true,
    ...(nome ? { nome: nome.slice(0, 80) } : {}),
    ficha,
    incertos,
    trechos,
  };
}

// ---------------------------------------------------------------------------------------------
// Colunas, rótulos de duas linhas e blocos de magia
// ---------------------------------------------------------------------------------------------

type Composto = { texto: string; topo: Item };

/** Rótulos em caixa-alta que ocupam duas linhas viram um só ("SPELLCASTING" + "ABILITY"). */
function rotulosCompostos(pag: Pag, u: number): Composto[] {
  const ordenados = [...pag.rotulos].sort((a, b) => b.y - a.y || a.x - b.x);
  const usados = new Set<Item>();
  const saida: Composto[] = [];
  for (const r of ordenados) {
    if (usados.has(r)) continue;
    usados.add(r);
    let texto = r.t;
    let ultimo = r;
    for (;;) {
      const proximo = ordenados.find(
        (o) =>
          !usados.has(o) &&
          o.y < ultimo.y &&
          ultimo.y - o.y <= 1.8 * Math.max(o.altura, ultimo.altura) + 2 * u &&
          Math.abs(o.x - ultimo.x) <= 12 * u,
      );
      if (!proximo) break;
      usados.add(proximo);
      texto = `${texto} ${proximo.t}`;
      ultimo = proximo;
    }
    saida.push({ texto, topo: r });
  }
  return saida;
}

/** Início de cada coluna de texto da página (picos de x do começo das linhas, bem separados). */
function colunasDa(pag: Pag): number[] {
  const baldes = new Map<number, { soma: number; n: number }>();
  for (const i of pag.itens) {
    if (i.altura <= 0) continue;
    const k = Math.round(i.x / 1.5);
    const b = baldes.get(k) ?? { soma: 0, n: 0 };
    b.soma += i.x;
    b.n += 1;
    baldes.set(k, b);
  }
  const candidatos = [...baldes.values()].filter((b) => b.n >= 6).sort((a, b) => b.n - a.n);
  const aceitos: number[] = [];
  for (const c of candidatos) {
    const x = c.soma / c.n;
    if (aceitos.every((a) => Math.abs(a - x) >= 0.2 * pag.largura)) aceitos.push(x);
  }
  return aceitos.sort((a, b) => a - b);
}

/** Linhas das páginas na ordem de leitura: página, coluna (da esquerda para a direita), de cima para baixo. */
function fluxoPorColunas(paginas: readonly Pag[], u: number): Linha[] {
  const saida: Linha[] = [];
  for (const pag of paginas) {
    const colunas = colunasDa(pag);
    const colunaDe = (x: number) => {
      let c = 0;
      colunas.forEach((inicio, i) => {
        if (inicio <= x + 0.02 * pag.largura) c = i;
      });
      return c;
    };
    const porColuna = new Map<number, Item[]>();
    for (const i of pag.itens) {
      const c = colunaDe(i.x);
      porColuna.set(c, [...(porColuna.get(c) ?? []), i]);
    }
    for (const c of [...porColuna.keys()].sort((a, b) => a - b)) {
      saida.push(...agruparEmLinhas(porColuna.get(c) ?? [], u));
    }
  }
  return saida;
}

const CAMPOS_DE_MAGIA =
  /^(tempo de conjuracao|alcance|alvo|componentes|duracao|casting time|range|target|components|duration)\s*:/;

/** Quebra o fluxo das páginas de magia em blocos (título, escola e nível, campos, descrição). */
function blocosDeMagia(paginas: readonly Pag[], u: number): MagiaBloco[] {
  const fluxo = fluxoPorColunas(paginas, u);
  const inicios: number[] = [];
  fluxo.forEach((l, i) => {
    if (A.tempoDeConjuracao.test(norm(l.texto))) inicios.push(i);
  });
  const blocos: { tituloIdx: number; escolaIdx: number; campoIdx: number }[] = inicios.map((k) => {
    const anterior = fluxo[k - 1]?.texto ?? "";
    const temNivel = /\b(cantrip|truque|\d+)\b/i.test(anterior) && k >= 2;
    return temNivel
      ? { tituloIdx: k - 2, escolaIdx: k - 1, campoIdx: k }
      : { tituloIdx: k - 1, escolaIdx: -1, campoIdx: k };
  });
  return blocos.map((b, i) => {
    const fim = blocos[i + 1]?.tituloIdx ?? fluxo.length;
    const titulo = fluxo[b.tituloIdx]?.texto ?? "";
    const escolaTexto = b.escolaIdx >= 0 ? (fluxo[b.escolaIdx]?.texto ?? "") : "";
    const nivelM = /\b(cantrip|truque|\d+)\b/i.exec(escolaTexto);
    const nivel = nivelM ? (/^\d+$/.test(nivelM[1] ?? "") ? Number(nivelM[1]) : 0) : undefined;
    const escola = escolaTexto.replace(/\b(cantrip|truque|\d+)\b/gi, "").trim();
    const corpo = fluxo.slice(b.campoIdx, fim);
    const idxDescricao = corpo.findIndex((l) => /^(descricao|description)\s*:/.test(norm(l.texto)));
    const camposLinhas = idxDescricao >= 0 ? corpo.slice(0, idxDescricao) : corpo;
    const campos: string[] = [];
    for (const l of camposLinhas) {
      if (CAMPOS_DE_MAGIA.test(norm(l.texto)) || campos.length === 0) campos.push(l.texto);
      else campos[campos.length - 1] = `${campos[campos.length - 1]} ${l.texto}`;
    }
    let descricaoLinhas: Linha[] = [];
    if (idxDescricao >= 0) descricaoLinhas = corpo.slice(idxDescricao + 1);
    const resto =
      idxDescricao >= 0 ? (corpo[idxDescricao]?.texto ?? "").replace(/^[^:]*:\s*/, "") : "";
    const texto = paragrafos(descricaoLinhas);
    const descricao = [campos.join("\n"), [resto, texto].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    return {
      titulo,
      ...(nivel !== undefined ? { nivel } : {}),
      ...(escola ? { escola } : {}),
      descricao,
    };
  });
}
