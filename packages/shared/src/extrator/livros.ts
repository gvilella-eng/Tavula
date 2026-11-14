import {
  type Compendio,
  FORMATO_DO_COMPENDIO,
  type ItemMagicoDoCompendio,
  ItemMagicoDoCompendioSchema,
  type MagiaDoCompendio,
  MagiaDoCompendioSchema,
  type MonstroDoCompendio,
  MonstroDoCompendioSchema,
  VERSAO_DO_COMPENDIO,
} from "../compendio.ts";
import { lerItensMagicos } from "./itens.ts";
import { type Linha, linhasDaPagina, type PaginaDoPdf } from "./linhas.ts";
import { chaveDeNome, lerListasPorClasse, lerMagias, ligarClasses } from "./magias.ts";
import { blocosDeMonstros, lerMonstro } from "./monstros.ts";

// ---------------------------------------------------------------------------------------------
// Extração por livro (N3b): do PDF (páginas com texto e posição) às listas validadas pelo zod, com as estatísticas
// que o relatório mostra. Nada daqui guarda texto dos livros; o que sai vai para a pasta local do mestre.
// ---------------------------------------------------------------------------------------------

export type Falha = { nome: string; pagina: number; motivo: string };

export type ResultadoDoLivro<T> = {
  /** Quantas entradas o extrator achou no livro. */
  lidas: number;
  validas: T[];
  falhas: Falha[];
  /** Quantas entradas ficaram sem cada campo (os mais vazios primeiro, no relatório). */
  vazios: Record<string, number>;
  /** Observações do livro (listas ligadas por nome aproximado, entradas cortadas...). */
  avisos: string[];
  /** Entradas "completas" pelo critério do lote (ver `criterio`). */
  completas: number;
  criterio: string;
  /** A página de cada entrada válida, na mesma ordem de `validas` (para conferir com o PDF). */
  paginas: number[];
};

export const CREDITOS = {
  magias:
    "Livro do Jogador, tradução Biblioteca Élfica, uso pessoal. Conteúdo dos livros: não distribuir.",
  monstros:
    "Manual dos Monstros, tradução Biblioteca Élfica, uso pessoal. Conteúdo dos livros: não distribuir.",
  itens:
    "Guia do Mestre, tradução Biblioteca Élfica, uso pessoal. Conteúdo dos livros: não distribuir.",
} as const;

function motivoDoZod(erro: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return erro.issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".") || "(entrada)"}: ${i.message}`)
    .join("; ");
}

function contar(vazios: Record<string, number>, campo: string): void {
  vazios[campo] = (vazios[campo] ?? 0) + 1;
}

// ---- magias ----

/** As linhas das descrições (de "Descrições das Magias" ao fim do livro) e as das listas por classe (3 colunas). */
export function extrairMagiasDoLivro(
  paginas: readonly PaginaDoPdf[],
): ResultadoDoLivro<MagiaDoCompendio> {
  const avisos: string[] = [];
  const duas = (n: number) => linhasDaPagina(n, paginas[n - 1] as PaginaDoPdf);
  const tres = (n: number) => linhasDaPagina(n, paginas[n - 1] as PaginaDoPdf, [205, 385]);
  let pDescricoes = 0;
  for (let n = 1; n <= paginas.length && pDescricoes === 0; n++) {
    if (duas(n).some((l) => /^Descri[çc][õo]es das Magias$/i.test(l.texto))) pDescricoes = n;
  }
  if (pDescricoes === 0) {
    avisos.push('Não achei o título "Descrições das Magias": o livro não é o Livro do Jogador?');
    return vazioDoLivro(avisos, "magias");
  }
  let pListas = 0;
  for (let n = 1; n < pDescricoes; n++) {
    if (tres(n).some((l) => /^Magias de Bardo$/i.test(l.texto))) pListas = n;
  }
  const corpo: Linha[] = [];
  for (let n = pDescricoes; n <= paginas.length; n++) corpo.push(...duas(n));
  const lidas = lerMagias(corpo);

  const listas = new Map<string, Set<string>>();
  if (pListas === 0)
    avisos.push("Não achei as listas de magias por classe: `classes` ficou vazio.");
  else {
    const linhas: Linha[] = [];
    for (let n = pListas; n < pDescricoes; n++) linhas.push(...tres(n));
    for (const [k, v] of lerListasPorClasse(linhas)) listas.set(k, v);
    const ligacao = ligarClasses(
      lidas.map((m) => m.magia),
      listas,
    );
    for (const a of ligacao.aproximados)
      avisos.push(`Nome da lista ligado por semelhança (erro de digitação no livro): ${a}`);
    for (const s of ligacao.semPar) avisos.push(`Nome da lista sem magia correspondente: ${s}`);
  }

  const validas: MagiaDoCompendio[] = [];
  const paginasValidas: number[] = [];
  const falhas: Falha[] = [];
  const vazios: Record<string, number> = {};
  for (const m of lidas) {
    for (const f of m.faltando) contar(vazios, f);
    if (!m.magia.classes?.length) contar(vazios, "classes");
    const r = MagiaDoCompendioSchema.safeParse(m.magia);
    if (r.success) {
      validas.push(r.data);
      paginasValidas.push(m.pagina);
    } else falhas.push({ nome: m.magia.nome, pagina: m.pagina, motivo: motivoDoZod(r.error) });
  }
  const completas = validas.filter((m) => m.classes.length > 0).length;
  return {
    lidas: lidas.length,
    validas,
    falhas,
    vazios,
    avisos,
    completas,
    criterio:
      "nível, escola, tempo, alcance, componentes, duração, descrição e ao menos uma classe",
    paginas: paginasValidas,
  };
}

function vazioDoLivro<T>(avisos: string[], tipo: string): ResultadoDoLivro<T> {
  return {
    lidas: 0,
    validas: [],
    falhas: [],
    vazios: {},
    avisos: [...avisos, `Nada extraído (${tipo}).`],
    completas: 0,
    criterio: "",
    paginas: [],
  };
}

// ---- monstros ----

export function extrairMonstrosDoLivro(
  paginas: readonly PaginaDoPdf[],
  magias: readonly Pick<MagiaDoCompendio, "nome">[] = [],
): ResultadoDoLivro<MonstroDoCompendio> {
  const linhas = paginas.flatMap((p, i) => linhasDaPagina(i + 1, p));
  const blocos = blocosDeMonstros(linhas);
  const canonicos = new Map(magias.map((m) => [chaveDeNome(m.nome), m.nome] as const));
  const lidos = blocos.map((b) => lerMonstro(b, { magias: canonicos }));
  const validas: MonstroDoCompendio[] = [];
  const paginasValidas: number[] = [];
  const falhas: Falha[] = [];
  const vazios: Record<string, number> = {};
  const avisos: string[] = [];
  for (const m of lidos) {
    for (const f of m.faltando) contar(vazios, f);
    const r = MonstroDoCompendioSchema.safeParse(m.monstro);
    if (r.success) {
      validas.push(r.data);
      paginasValidas.push(m.pagina);
    } else falhas.push({ nome: m.monstro.nome, pagina: m.pagina, motivo: motivoDoZod(r.error) });
  }
  // Campos opcionais que mais ficam vazios (informativo: muitos monstros não têm perícia, por exemplo).
  const opcionais = [
    "salvaguardas",
    "pericias",
    "vulnerabilidades",
    "resistencias",
    "imunidades",
    "imunidadesCondicoes",
    "tracos",
    "reacoes",
    "acoesLendarias",
    "conjuracaoInata",
    "conjuracaoPorEspacos",
  ] as const;
  for (const c of opcionais) {
    const n = validas.filter((m) => m[c] === undefined).length;
    if (n > 0) vazios[`${c} (opcional)`] = n;
  }
  const comNumeros = validas
    .flatMap((m) => m.acoes ?? [])
    .filter((a) => a.acerto !== undefined).length;
  const totalDeAcoes = validas.reduce((s, m) => s + (m.acoes?.length ?? 0), 0);
  avisos.push(`Ações lidas: ${totalDeAcoes}; com bônus de acerto: ${comNumeros}.`);
  const completas = validas.filter((m) => (m.acoes?.length ?? 0) > 0).length;
  return {
    lidas: lidos.length,
    validas,
    falhas,
    vazios,
    avisos,
    completas,
    criterio: "atributos, CA, PV, ND e ao menos uma ação",
    paginas: paginasValidas,
  };
}

// ---- itens mágicos ----

export function extrairItensDoLivro(
  paginas: readonly PaginaDoPdf[],
): ResultadoDoLivro<ItemMagicoDoCompendio> {
  const linhas = paginas.flatMap((p, i) => linhasDaPagina(i + 1, p));
  const lidos = lerItensMagicos(linhas);
  const validas: ItemMagicoDoCompendio[] = [];
  const paginasValidas: number[] = [];
  const falhas: Falha[] = [];
  const vazios: Record<string, number> = {};
  const avisos: string[] = [];
  for (const i of lidos) {
    for (const f of i.faltando) contar(vazios, f);
    if (i.cortado) avisos.push(`Descrição cortada no limite do formato: ${i.item.nome}`);
    const r = ItemMagicoDoCompendioSchema.safeParse(i.item);
    if (r.success) {
      validas.push(r.data);
      paginasValidas.push(i.pagina);
    } else falhas.push({ nome: i.item.nome, pagina: i.pagina, motivo: motivoDoZod(r.error) });
  }
  const semSint = validas.filter((i) => i.sintonizacao === undefined).length;
  avisos.push(`Sem sintonização: ${semSint}; com sintonização: ${validas.length - semSint}.`);
  const completas = validas.filter((i) => i.raridade !== undefined).length;
  return {
    lidas: lidos.length,
    validas,
    falhas,
    vazios,
    avisos,
    completas,
    criterio: "nome, tipo, raridade e descrição",
    paginas: paginasValidas,
  };
}

// ---- arquivos de saída ----

/** O arquivo do compêndio de um tipo, no formato da mesa (`CompendioSchema`). */
export function arquivoDoCompendio(
  tipo: "magias" | "monstros" | "itens",
  dados: {
    magias?: readonly MagiaDoCompendio[];
    monstros?: readonly MonstroDoCompendio[];
    itensMagicos?: readonly ItemMagicoDoCompendio[];
  },
): Compendio {
  return {
    formato: FORMATO_DO_COMPENDIO,
    versao: VERSAO_DO_COMPENDIO,
    creditos: CREDITOS[tipo],
    magias: [...(dados.magias ?? [])],
    ...(dados.monstros ? { monstros: [...dados.monstros] } : {}),
    ...(dados.itensMagicos ? { itensMagicos: [...dados.itensMagicos] } : {}),
  };
}
