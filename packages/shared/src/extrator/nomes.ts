import { normalizarBusca } from "../compendio.ts";

// ---------------------------------------------------------------------------------------------
// Q2: os nomes em inglês. Os PDFs em português não trazem o nome original; quem monta o compêndio escreve uma tabela
// local `nomes-originais.json` ({ "magias": {"Bola de Fogo": "Fireball"}, "monstros": {...}, "itens": {...} }) na pasta
// de saída, e o extrator a aplica. A tabela NUNCA entra no repositório.
// ---------------------------------------------------------------------------------------------

export type TabelaDeNomes = {
  magias: Record<string, string>;
  monstros: Record<string, string>;
  itens: Record<string, string>;
};

export type ResultadoDaTabela = { ok: true; tabela: TabelaDeNomes } | { ok: false; motivo: string };

function lerMapa(v: unknown, chave: string): Record<string, string> | string {
  if (v === undefined) return {};
  if (typeof v !== "object" || v === null || Array.isArray(v))
    return `"${chave}" precisa ser um objeto { "nome em português": "nome em inglês" }`;
  const saida: Record<string, string> = {};
  for (const [pt, en] of Object.entries(v)) {
    if (typeof en !== "string") return `"${chave}": o nome de "${pt}" precisa ser texto`;
    if (en.trim() !== "") saida[pt] = en.trim();
  }
  return saida;
}

/** Lê o texto do `nomes-originais.json`. Seção ausente vale vazia; formato errado diz onde. */
export function lerTabelaDeNomes(texto: string): ResultadoDaTabela {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "o arquivo não é um JSON válido" };
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto))
    return { ok: false, motivo: "o arquivo precisa ser um objeto com magias, monstros e itens" };
  const o = bruto as Record<string, unknown>;
  const tabela: Partial<TabelaDeNomes> = {};
  for (const chave of ["magias", "monstros", "itens"] as const) {
    const m = lerMapa(o[chave], chave);
    if (typeof m === "string") return { ok: false, motivo: m };
    tabela[chave] = m;
  }
  return { ok: true, tabela: tabela as TabelaDeNomes };
}

/**
 * Preenche o `nomeOriginal` de quem a tabela conhece (nome sem acento e sem caixa). Quem já tem `nomeOriginal` do
 * livro fica como está. Devolve as entradas novas e quantas foram preenchidas.
 */
export function aplicarNomesOriginais<
  T extends { nome: string; nomeOriginal?: string | undefined },
>(
  entradas: readonly T[],
  nomes: Readonly<Record<string, string>>,
): { entradas: T[]; preenchidos: number } {
  const porNome = new Map<string, string>();
  for (const [pt, en] of Object.entries(nomes)) porNome.set(normalizarBusca(pt), en);
  let preenchidos = 0;
  const saida = entradas.map((e) => {
    if (e.nomeOriginal) return e;
    const en = porNome.get(normalizarBusca(e.nome));
    if (!en) return e;
    preenchidos++;
    return { ...e, nomeOriginal: en };
  });
  return { entradas: saida, preenchidos };
}
