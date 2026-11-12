import { formatarExpressao, LIMITES_DE_DADOS, lerExpressao } from "./dados.ts";
import type { EspacoDeMagia, Magia, PactoDaFicha } from "./ficha.ts";

// ---------------------------------------------------------------------------------------------
// Conjurar com um espaço de nível maior (V6): quais espaços a pessoa pode gastar, o dado a mais por nível acima
// e a leitura do "Em níveis superiores" do compêndio. Tudo puro.
// ---------------------------------------------------------------------------------------------

/** Uma opção do menu "Conjurar com espaço de:". */
export type OpcaoDeEspaco = {
  /** `"4"` (um círculo) ou `"pacto"`. */
  id: string;
  tipo: "comum" | "pacto";
  /** O nível do espaço que seria gasto. */
  nivel: number;
  restantes: number;
  /** "4º · 4 restantes" ou "Pacto 3º · 1 restante". */
  rotulo: string;
};

const restantesTexto = (n: number) => `${n} ${n === 1 ? "restante" : "restantes"}`;

/**
 * Os espaços que dá para gastar numa magia: um por nível, do nível da magia até o 9º, só os que têm espaço
 * restante, em ordem crescente; depois o de pacto (sobe sempre para o nível do pacto), se o nível do pacto serve e
 * há espaço. Truque (nível 0) não gasta espaço: lista vazia.
 */
export function opcoesDeEspaco(
  nivelDaMagia: number,
  espacos: readonly EspacoDeMagia[],
  pacto: PactoDaFicha | null,
): OpcaoDeEspaco[] {
  if (nivelDaMagia <= 0) return [];
  const opcoes: OpcaoDeEspaco[] = espacos
    .filter((e) => e.nivel >= nivelDaMagia && e.nivel <= 9 && e.restantes > 0)
    .sort((a, b) => a.nivel - b.nivel)
    .map((e) => ({
      id: String(e.nivel),
      tipo: "comum" as const,
      nivel: e.nivel,
      restantes: e.restantes,
      rotulo: `${e.nivel}º · ${restantesTexto(e.restantes)}`,
    }));
  if (pacto && pacto.restantes > 0 && pacto.nivel >= nivelDaMagia) {
    opcoes.push({
      id: "pacto",
      tipo: "pacto",
      nivel: pacto.nivel,
      restantes: pacto.restantes,
      rotulo: `Pacto ${pacto.nivel}º · ${restantesTexto(pacto.restantes)}`,
    });
  }
  return opcoes;
}

/** Quantos níveis o espaço está acima do nível da magia (nunca negativo). */
export const niveisAcima = (nivelDaMagia: number, nivelDoEspaco: number): number =>
  Math.max(0, nivelDoEspaco - nivelDaMagia);

/**
 * Multiplica uma expressão de dados pela quantidade de níveis ("1d6" × 2 = "2d6"; "1d4+1" × 2 = "2d4+2").
 * `null` se a expressão não vale ou `vezes` não é positivo.
 */
export function multiplicarExpressao(expressao: string, vezes: number): string | null {
  if (!Number.isInteger(vezes) || vezes < 1) return null;
  const lida = lerExpressao(expressao);
  if (!lida.ok) return null;
  const termos = lida.expressao.termos.map((t) =>
    t.tipo === "dados"
      ? { ...t, quantidade: Math.min(t.quantidade * vezes, LIMITES_DE_DADOS.dadosPorTermoRolado) }
      : { ...t, valor: Math.min(t.valor * vezes, LIMITES_DE_DADOS.constante) },
  );
  return formatarExpressao({ termos });
}

/**
 * O dado a mais de uma conjuração acima do nível: `porNivelAcima` vezes os níveis acima, ou `null` se a magia não
 * sobe nada (nível igual, sem `porNivelAcima` ou expressão inválida).
 */
export function extraDeEspaco(
  porNivelAcima: string | undefined,
  nivelDaMagia: number,
  nivelDoEspaco: number,
): string | null {
  const base = porNivelAcima?.trim();
  if (!base) return null;
  const acima = niveisAcima(nivelDaMagia, nivelDoEspaco);
  return acima === 0 ? null : multiplicarExpressao(base, acima);
}

const semAcento = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const DADOS = String.raw`(\d+d\d+(?:\s*\+\s*\d+)?)`;
const CADA = String.raw`(?:para cada|por cada|por)\s+(?:nivel|circulo|espaco)`;
const PADROES = [
  // "o dano aumenta em 1d6 para cada nível do espaço acima do 3º"
  new RegExp(String.raw`aument(?:a|am)(?:\s+em)?\s+${DADOS}[^.;]*?\b${CADA}`),
  // "1d6 de dano adicional para cada nível acima do 3º"
  new RegExp(
    String.raw`${DADOS}\s+(?:de\s+[a-z]+\s+)?(?:adicion(?:al|ais)|extras?|a mais)[^.;]*?\b${CADA}`,
  ),
  // "dano adicional de 1d6 para cada nível" / "mais 1d6 de dano para cada nível"
  new RegExp(String.raw`(?:adicion(?:al|ais)|extras?|mais)\s+(?:de\s+)?${DADOS}[^.;]*?\b${CADA}`),
];

/**
 * Lê o "Em níveis superiores" do compêndio e devolve o dado a mais por nível de espaço acima ("1d6"), ou vazio se o
 * texto não traz um (mais alvos, mais raios, mais dardos e a duração ficam à mão).
 */
export function porNivelAcimaDoTexto(texto: string | undefined): string {
  if (!texto) return "";
  const limpo = semAcento(texto);
  for (const padrao of PADROES) {
    const achado = padrao.exec(limpo);
    const dados = achado?.[1]?.replace(/\s+/g, "");
    if (dados && lerExpressao(dados).ok) return dados;
  }
  return "";
}

/** O "Em níveis superiores" que a descrição montada para a ficha carrega (`descricaoParaFicha`), se houver. */
function niveisSuperioresDaDescricao(descricao: string): string | undefined {
  const i = descricao.indexOf("Em níveis superiores:");
  return i < 0 ? undefined : descricao.slice(i);
}

/**
 * O "por nível acima" valendo para a magia: o campo da ficha; se vazio, o texto do compêndio (a magia com o mesmo
 * nome) e, por último, o "Em níveis superiores" que a própria descrição já traz. Assim as fichas antigas funcionam
 * sem editar.
 */
export function porNivelAcimaDaMagia(
  m: Pick<Magia, "porNivelAcima" | "descricao">,
  textoDoCompendio?: string,
): string {
  const escrito = m.porNivelAcima?.trim();
  if (escrito) return escrito;
  return (
    porNivelAcimaDoTexto(textoDoCompendio) ||
    porNivelAcimaDoTexto(niveisSuperioresDaDescricao(m.descricao))
  );
}
