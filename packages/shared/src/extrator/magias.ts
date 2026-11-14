import { ESCOLAS_DO_5E, LIMITES_DO_COMPENDIO, type MagiaDoCompendio } from "../compendio.ts";
import { type Linha, semAcentos } from "./linhas.ts";

// ---------------------------------------------------------------------------------------------
// Magias do Livro do Jogador (N3b). Cada magia no livro é: nome (versalete), "N° nível de escola" (ou "Truque de
// escola"; o "(ritual)" vem entre parênteses), os quatro rótulos (Tempo de Conjuração, Alcance, Componentes, Duração)
// e a descrição em parágrafos (o recuo da primeira linha marca o parágrafo novo).
// ---------------------------------------------------------------------------------------------

export type MagiaLida = {
  magia: Partial<MagiaDoCompendio> & { nome: string };
  /** Página e coluna de onde saiu, para o relatório. */
  pagina: number;
  /** Os campos que o livro não trouxe, para o relatório. */
  faltando: string[];
};

const PADRAO_DA_ESCOLA =
  /^(?:(\d)°\s*n[ií]vel|truque)\s+de\s+([a-zçãáâéêíóôõú]+)(?:\s*\(([^)]*)\))?\s*$/i;
const ROTULOS = [
  ["tempo", "Tempo de Conjuração"],
  ["alcance", "Alcance"],
  ["componentes", "Componentes"],
  ["duracao", "Duração"],
] as const;

export function lerLinhaDaEscola(
  texto: string,
): { nivel: number; escola: string; ritual: boolean } | null {
  const achado = PADRAO_DA_ESCOLA.exec(texto.trim());
  if (!achado) return null;
  const nivel = achado[1] === undefined ? 0 : Number(achado[1]);
  const bruta = semAcentos(achado[2] ?? "");
  const escola = ESCOLAS_DO_5E.find((e) => semAcentos(e) === bruta);
  if (!escola) return null;
  return { nivel, escola, ritual: /ritual/i.test(achado[3] ?? "") };
}

/** Onde cada coluna de cada página começa (o recuo de parágrafo é medido contra isso). */
export function margensDasColunas(linhas: readonly Linha[]): Map<string, number> {
  const margens = new Map<string, number>();
  for (const l of linhas) {
    const chave = `${l.pagina}:${l.col}`;
    const atual = margens.get(chave);
    if (atual === undefined || l.x < atual) margens.set(chave, l.x);
  }
  return margens;
}

/**
 * Junta linhas em parágrafos: a linha recuada (mais de 8 pontos além da margem da coluna) abre um parágrafo novo.
 * Retorna os parágrafos como texto corrido.
 */
export function paragrafosDe(
  linhas: readonly Linha[],
  margens: ReadonlyMap<string, number>,
): string[] {
  const paragrafos: string[] = [];
  let atual = "";
  for (const l of linhas) {
    const margem = margens.get(`${l.pagina}:${l.col}`) ?? l.x;
    // O recuo da primeira linha e o marcador de lista abrem um parágrafo novo.
    if (((l.x - margem > 8 && !atual.startsWith("•")) || l.texto.startsWith("•")) && atual !== "") {
      paragrafos.push(atual);
      atual = "";
    }
    atual = juntarLinha(atual, l.texto);
  }
  if (atual !== "") paragrafos.push(atual);
  return paragrafos;
}

/** Junta uma linha ao texto, refazendo a hifenização do fim de linha ("pala-" + "vra"). */
export function juntarLinha(texto: string, linha: string): string {
  if (texto === "") return linha;
  if (/\p{L}-$/u.test(texto)) {
    // "Corpo-a-" + "Corpo", "Meio-" + "Dragão" e "corpo-" + "a-corpo": o hífen é da palavra composta e fica.
    if (/^\p{Lu}/u.test(linha) || /^a-\p{L}/u.test(linha) || /(^|[^\p{L}])\p{L}-$/u.test(texto)) {
      return texto + linha;
    }
    // "pala-" + "vra": hífen de quebra de linha, sai.
    if (/^\p{Ll}/u.test(linha)) return texto.slice(0, -1) + linha;
  }
  return `${texto} ${linha}`;
}

const NIVEIS_SUPERIORES = /^Em\s+N[ií]veis\s+Superiores\.?\s*/i;

/**
 * Lê todas as magias de um trecho do livro (as linhas das descrições, na ordem de leitura). A âncora é a linha da
 * escola, seguida de "Tempo de Conjuração"; a linha de cima é o nome (ou as linhas, se o nome quebrar).
 */
export function lerMagias(linhas: readonly Linha[]): MagiaLida[] {
  const margens = margensDasColunas(linhas);
  const ancoras: number[] = [];
  for (let i = 1; i < linhas.length - 1; i++) {
    const l = linhas[i];
    const seguinte = linhas[i + 1];
    if (!l || !seguinte) continue;
    if (lerLinhaDaEscola(l.texto) && /^Tempo de Conjura/i.test(seguinte.texto)) ancoras.push(i);
  }
  // A última magia vai até o fim do capítulo (o próximo "Apêndice A: ..." depois dela).
  const ultima = ancoras[ancoras.length - 1] ?? 0;
  const apendice = linhas.findIndex(
    (l, i) => i > ultima && /^Ap[êe]ndice\s+[A-Z]\s*:/.test(l.texto),
  );
  const fimDoTrecho = apendice === -1 ? linhas.length : apendice;
  const inicioDoNome = (a: number): number => {
    let i = a - 1;
    const tam = linhas[i]?.tam ?? 0;
    // Nome que quebra em duas linhas: a de cima tem o mesmo tamanho e a mesma coluna.
    while (
      i > 0 &&
      linhas[i - 1]?.col === linhas[i]?.col &&
      Math.abs((linhas[i - 1]?.tam ?? 0) - tam) < 0.3 &&
      !/[.:,;]$/.test(linhas[i - 1]?.texto ?? ".") &&
      i > (ancoras[ancoras.indexOf(a) - 1] ?? -1) + 8
    ) {
      i--;
    }
    return i;
  };
  const saida: MagiaLida[] = [];
  ancoras.forEach((a, k) => {
    const inicio = inicioDoNome(a);
    const proximo = ancoras[k + 1];
    const fim = proximo === undefined ? fimDoTrecho : inicioDoNome(proximo);
    const nome = linhas
      .slice(inicio, a)
      .map((l) => l.texto)
      .reduce((acc, t) => juntarLinha(acc, t), "");
    const escola = lerLinhaDaEscola(linhas[a]?.texto ?? "");
    if (!escola) return;
    // Cabeçalho: os quatro rótulos, cada um podendo quebrar em mais linhas.
    const campos: Record<string, string> = {};
    let i = a + 1;
    let rotuloAtual: string | null = null;
    let continuacoes = 0;
    while (i < fim) {
      const l = linhas[i];
      if (!l) break;
      const rotulo = ROTULOS.find(([, r]) => semAcentos(l.texto).startsWith(`${semAcentos(r)}:`));
      if (rotulo) {
        rotuloAtual = rotulo[0];
        continuacoes = 0;
        campos[rotuloAtual] = l.texto.slice(l.texto.indexOf(":") + 1).trim();
      } else if (rotuloAtual && rotuloAtual !== "duracao" && ++continuacoes <= 12) {
        // O texto de um rótulo (o material de Componentes, sobretudo) pode quebrar em várias linhas, no recuo ou não.
        campos[rotuloAtual] = juntarLinha(campos[rotuloAtual] ?? "", l.texto);
      } else if (
        rotuloAtual === "duracao" &&
        l.x - (margens.get(`${l.pagina}:${l.col}`) ?? l.x) > 8
      ) {
        // A duração só quebra no recuo (a linha seguinte sem recuo já é a descrição).
        campos.duracao = juntarLinha(campos.duracao ?? "", l.texto);
      } else {
        break;
      }
      i++;
    }
    const corpo = paragrafosDe(linhas.slice(i, fim), margens);
    let emNiveis: string | undefined;
    const sem: string[] = [];
    for (const p of corpo) {
      if (NIVEIS_SUPERIORES.test(p)) emNiveis = p.replace(NIVEIS_SUPERIORES, "").trim();
      else if (emNiveis !== undefined) emNiveis = `${emNiveis}\n${p}`;
      else sem.push(p);
    }
    const duracao = campos.duracao ?? "";
    const magia: MagiaLida["magia"] = {
      nome,
      nivel: escola.nivel,
      escola: escola.escola,
      ritual: escola.ritual,
      concentracao: /^concentra/i.test(duracao),
      classes: [],
    };
    if (campos.tempo) magia.tempo = campos.tempo;
    if (campos.alcance) magia.alcance = campos.alcance;
    if (campos.componentes) magia.componentes = campos.componentes;
    if (duracao) magia.duracao = duracao;
    // Campo do cabeçalho maior que o limite do formato (material longo, tempo de reação): fica o começo no campo e o
    // texto inteiro vai para o início da descrição, para não perder nada.
    const movidos: string[] = [];
    if (magia.componentes && magia.componentes.length > LIMITES_DO_COMPENDIO.componentes) {
      movidos.push(`Componentes: ${magia.componentes}`);
      magia.componentes = `${magia.componentes.split("(")[0]?.trim() ?? "V, S, M"} (material na descrição)`;
    }
    if (magia.tempo && magia.tempo.length > LIMITES_DO_COMPENDIO.tempo) {
      movidos.push(`Tempo de Conjuração: ${magia.tempo}`);
      magia.tempo =
        magia.tempo.split(",")[0]?.trim() ?? magia.tempo.slice(0, LIMITES_DO_COMPENDIO.tempo);
    }
    if (magia.alcance && magia.alcance.length > LIMITES_DO_COMPENDIO.alcance) {
      movidos.push(`Alcance: ${magia.alcance}`);
      magia.alcance =
        magia.alcance.split(",")[0]?.trim() ?? magia.alcance.slice(0, LIMITES_DO_COMPENDIO.alcance);
    }
    if (movidos.length > 0 || sem.length > 0) magia.descricao = [...movidos, ...sem].join("\n");
    if (emNiveis) magia.emNiveisSuperiores = emNiveis;
    const faltando = (["tempo", "alcance", "componentes", "duracao", "descricao"] as const).filter(
      (c) => !magia[c],
    );
    saida.push({ magia, pagina: linhas[a]?.pagina ?? 0, faltando });
  });
  return saida;
}

// ---------------------------------------------------------------------------------------------
// As listas por classe (Capítulo 11, antes das descrições): "Magias de Bardo", "Truques (Nível 0)", "1° Nível" e as
// entradas "Nome (escola[, ritual])". A entrada que quebra tem a continuação começando por "(".
// ---------------------------------------------------------------------------------------------

/** Nome sem acento e sem caixa, para ligar a lista à descrição ("Amizade animal" = "Amizade Animal"). */
export function chaveDeNome(nome: string): string {
  return semAcentos(nome)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Distância de edição (Levenshtein), para ligar um nome com erro de digitação na lista ao da descrição. */
function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0] ?? 0;
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j] ?? 0;
      linha[j] = Math.min(
        (linha[j] ?? 0) + 1,
        (linha[j - 1] ?? 0) + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = guardado;
    }
  }
  return linha[b.length] ?? 0;
}

/**
 * Preenche `classes` de cada magia com a lista do livro. O nome da lista que não bate exatamente (o livro tem erros
 * de digitação) liga ao mais parecido, se for um só e perto; o resto volta em `semPar`.
 */
export function ligarClasses(
  magias: readonly { nome: string; classes?: string[] }[],
  listas: ReadonlyMap<string, ReadonlySet<string>>,
): { semPar: string[]; aproximados: string[] } {
  const chaves = new Map(magias.map((m) => [chaveDeNome(m.nome), m] as const));
  const semPar: string[] = [];
  const aproximados: string[] = [];
  for (const [chave, classes] of listas) {
    let alvo = chaves.get(chave);
    if (!alvo) {
      const limite = Math.max(3, Math.floor(chave.length * 0.2));
      const candidatos = [...chaves.entries()]
        .map(([k, m]) => ({ m, d: distancia(chave, k) }))
        .filter((c) => c.d <= limite)
        .sort((a, b) => a.d - b.d);
      const melhor = candidatos[0];
      if (melhor && candidatos[1]?.d !== melhor.d) {
        alvo = melhor.m;
        aproximados.push(`${chave} -> ${melhor.m.nome}`);
      }
    }
    if (!alvo) {
      semPar.push(chave);
      continue;
    }
    const todas = new Set([...(alvo.classes ?? []), ...classes]);
    alvo.classes = [...todas].sort((a, b) => a.localeCompare(b, "pt"));
  }
  return { semPar, aproximados };
}

export function lerListasPorClasse(linhas: readonly Linha[]): Map<string, Set<string>> {
  const porMagia = new Map<string, Set<string>>();
  let classe: string | null = null;
  const anotar = (nome: string) => {
    if (!classe) return;
    const chave = chaveDeNome(nome);
    const set = porMagia.get(chave) ?? new Set<string>();
    set.add(classe);
    porMagia.set(chave, set);
  };
  linhas.forEach((l, i) => {
    const t = l.texto.trim();
    const cab = /^Magias de (.+)$/i.exec(t);
    if (cab?.[1]) {
      const c = cab[1].trim();
      classe = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
      return;
    }
    if (!classe || /^Truques\s*\(/i.test(t) || /^\d°\s*N[ií]vel$/i.test(t) || t.startsWith("(")) {
      return;
    }
    // Entrada comum: "Nome (escola[, ritual])". Entrada que quebra: o nome numa linha e "(escola)" na seguinte.
    const entrada = /^(.+?)\s*\([^)]*\)\s*$/.exec(t);
    if (entrada?.[1]) anotar(entrada[1]);
    else if (linhas[i + 1]?.texto.trim().startsWith("(")) anotar(t);
  });
  return porMagia;
}
