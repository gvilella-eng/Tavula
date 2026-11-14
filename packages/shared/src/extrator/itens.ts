import type { ItemMagicoDoCompendio, RaridadeDeItemMagico } from "../compendio.ts";
import { LIMITES_DO_COMPENDIO } from "../compendio.ts";
import { type Linha, semAcentos } from "./linhas.ts";
import { juntarLinha, margensDasColunas, paragrafosDe } from "./magias.ts";

// ---------------------------------------------------------------------------------------------
// Itens mágicos do Guia do Mestre (N3b). Cada item: o nome (versalete, corpo 11), a linha em itálico "Tipo (detalhe),
// raridade (requer sintonização por ...)" (que pode quebrar em duas linhas) e a descrição em parágrafos.
// ---------------------------------------------------------------------------------------------

export type ItemLido = {
  item: Partial<ItemMagicoDoCompendio> & { nome: string };
  pagina: number;
  faltando: string[];
  /** A descrição passou do limite e foi cortada. */
  cortado: boolean;
};

/** A linha do tipo começa por uma destas palavras (afasta títulos de seção e cabeçalhos de tabela). */
const COMECO_DO_TIPO =
  /^(?:Arma|Armadura|Anel|Cajado|Item|Po[çc][ãa]o|Bast[ãa]o|Varinha|Pergaminho|Artefato|Escudo|Muni[çc][ãa]o)\b/i;

/** "raridade variável" e "raridade depende da estátua" (o livro tem erros: "muito ara") também valem. */
const RARIDADE =
  /,\s*(comum|incomum|rar[oa]|muit[oa]\s+(?:rar[oa]|ara)|lend[áa]ri[oa]|artefato|raridade\s+(?:varia|vari[áa]vel|depende))\b/i;

function raridadeDoTexto(t: string): RaridadeDeItemMagico | null {
  if (!COMECO_DO_TIPO.test(t)) return null;
  const x = RARIDADE.exec(t);
  if (!x?.[1]) return null;
  const r = semAcentos(x[1]).replace(/\s+/g, " ");
  if (r.startsWith("raridade")) return "varia";
  if (r.startsWith("muit")) return "muito raro";
  if (r.startsWith("rar")) return "raro";
  if (r.startsWith("lendari")) return "lendário";
  if (r === "comum" || r === "incomum" || r === "artefato") return r;
  return null;
}

/** Vírgula fora dos parênteses (o tipo acaba nela). */
function primeiraVirgulaFora(s: string): number {
  let prof = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") prof++;
    else if (c === ")") prof--;
    else if (c === "," && prof === 0) return i;
  }
  return -1;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A linha do tipo pode ocupar até três linhas (mesma fonte, em itálico). Retorna o texto e quantas linhas ela tem, ou
 * null se não houver raridade.
 */
function linhaDoTipo(linhas: readonly Linha[], i: number): { texto: string; n: number } | null {
  const primeira = linhas[i];
  if (!primeira) return null;
  const fonte = primeira.trechos[0]?.f;
  let texto = "";
  let achou = false;
  for (let k = 0; k < 4; k++) {
    const l = linhas[i + k];
    if (!l || l.trechos[0]?.f !== fonte || l.tam > 10) break;
    texto = juntarLinha(texto, l.texto);
    if (raridadeDoTexto(texto)) achou = true;
    // A sintonização entre parênteses pode quebrar para a linha seguinte: vai até fechar o parêntese.
    const abertos = (texto.match(/\(/g) ?? []).length - (texto.match(/\)/g) ?? []).length;
    if (achou && abertos <= 0) return { texto, n: k + 1 };
  }
  return achou ? { texto, n: 4 } : null;
}

export function lerItensMagicos(linhas: readonly Linha[]): ItemLido[] {
  const margens = margensDasColunas(linhas);
  type Ancora = { nome: number; inicio: number; corpo: number; tipo: string };
  const ancoras: Ancora[] = [];
  for (let i = 0; i < linhas.length - 1; i++) {
    const nome = linhas[i];
    if (!nome || nome.tam > 12.5) continue;
    // Nome que quebra em duas linhas: a de cima tem o corpo do título (11) e a de baixo, às vezes, 10 (versalete).
    const anterior = ancoras.at(-1);
    const deTitulo = (l: Linha | undefined) => l !== undefined && l.tam >= 10.5 && l.tam <= 12.5;
    const mesmaFonte = (a: Linha | undefined) =>
      a !== undefined && a.col === nome.col && a.trechos[0]?.f === nome.trechos[0]?.f;
    const continuacao = nome.tam >= 9.9 && deTitulo(linhas[i - 1]) && mesmaFonte(linhas[i - 1]);
    if (!deTitulo(nome) && !continuacao) continue;
    const t = linhaDoTipo(linhas, i + 1);
    if (!t) continue;
    let inicio = i;
    while (
      inicio > 0 &&
      deTitulo(linhas[inicio - 1]) &&
      mesmaFonte(linhas[inicio - 1]) &&
      inicio - 1 >= (anterior?.corpo ?? 0)
    ) {
      inicio--;
    }
    ancoras.push({ nome: i, inicio, corpo: i + 1 + t.n, tipo: t.texto });
  }
  const saida: ItemLido[] = [];
  ancoras.forEach((a, k) => {
    const nomeLinha = linhas[a.nome];
    if (!nomeLinha) return;
    const proximo = ancoras[k + 1];
    let fim = proximo === undefined ? linhas.length : proximo.inicio;
    // Título de seção maior que o nome do item (corpo 12 ou mais) encerra a descrição.
    const titulo = linhas.findIndex((l, i) => i >= a.corpo && i < fim && l.tam >= 11.8);
    if (titulo !== -1) fim = titulo;
    const raridade = raridadeDoTexto(a.tipo);
    const virgula = primeiraVirgulaFora(a.tipo);
    const tipo = (virgula === -1 ? a.tipo : a.tipo.slice(0, virgula)).trim();
    const sint = /\(\s*requer\s+sintoniza[çc][ãa]o(?:\s+(?:por|de|com)\s+([^)]+))?\)/i.exec(a.tipo);
    const nome = linhas
      .slice(a.inicio, a.nome + 1)
      .map((l) => l.texto)
      .reduce((acc, t) => juntarLinha(acc, t), "");
    const paragrafos = paragrafosDe(linhas.slice(a.corpo, fim), margens);
    let descricao = paragrafos.join("\n").trim();
    const cortado = descricao.length > LIMITES_DO_COMPENDIO.descricao;
    if (cortado) descricao = `${descricao.slice(0, LIMITES_DO_COMPENDIO.descricao - 1).trimEnd()}…`;
    const item: ItemLido["item"] = { nome };
    if (tipo) item.tipo = capitalizar(tipo).slice(0, 100);
    if (raridade) item.raridade = raridade;
    if (sint) item.sintonizacao = { necessaria: true, ...(sint[1] ? { por: sint[1].trim() } : {}) };
    if (descricao) item.descricao = descricao;
    const bonus = /^Arma/i.test(tipo)
      ? /\+([123]) de b[ôo]nus nas jogadas de ataque e dano/i.exec(descricao)
      : null;
    if (bonus?.[1]) item.bonus = Number(bonus[1]);
    const faltando = (["tipo", "raridade", "descricao"] as const).filter((c) => !item[c]);
    saida.push({ item, pagina: nomeLinha.pagina, faltando, cortado });
  });
  return saida;
}
