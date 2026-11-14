import { formatarExpressao, LIMITES_DE_DADOS, lerExpressao } from "./dados.ts";
import {
  bonusDeProficiencia,
  conjuradoras,
  type EspacoDeMagia,
  type Ficha,
  type Magia,
  modDoAtributo,
  type PactoDaFicha,
} from "./ficha.ts";
import type { Atributo } from "./srd/index.ts";

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

const NUMEROS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
};
const numeroDoTexto = (t: string | undefined): number | null => {
  if (t === undefined) return null;
  const n = /^\d+$/.test(t) ? Number(t) : NUMEROS[t];
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : null;
};

// "a magia cria um dardo adicional para cada nível" / "mais um raio para cada nível" / "uma criatura adicional para cada nível"
const PADRAO_DE_QUANTIDADE = new RegExp(
  String.raw`(?:mais\s+)?(um|uma|dois|duas|\d+)\s+(dardo|raio|alvo|criatura)s?(?:\s+(?:adicion(?:al|ais)|extras?|a mais))?[^.;]*?\b${CADA}`,
);

/** O "por nível acima" lido: dados a mais, ou uma quantidade a mais (N2: "1 dardo", "2 raios"). */
export type PorNivelLido =
  | { tipo: "dados"; expressao: string }
  | { tipo: "quantidade"; por: number; unidade: string };

/** Lê o campo "Por nível acima" da magia: "1d6" (dados) ou "1 dardo" (quantidade). `null` se não entende. */
export function lerPorNivelAcima(texto: string | undefined): PorNivelLido | null {
  const limpo = semAcento(texto ?? "")
    .trim()
    .replace(/^\+/, "")
    .trim();
  if (limpo === "") return null;
  if (/d/.test(limpo) && lerExpressao(limpo).ok) return { tipo: "dados", expressao: limpo };
  const q = /^(um|uma|dois|duas|\d+)\s+(dardo|raio|alvo|criatura)s?$/.exec(limpo);
  const por = numeroDoTexto(q?.[1]);
  if (q?.[2] && por !== null) return { tipo: "quantidade", por, unidade: q[2] };
  return null;
}

/**
 * Lê o "Em níveis superiores" do compêndio e devolve o que sobe por nível de espaço acima: o dado a mais ("1d6") ou,
 * desde o N2, a quantidade a mais ("1 dardo", "1 raio", "1 alvo", "1 criatura"). Vazio se o texto não traz nenhum
 * (a duração e o resto ficam à mão).
 */
export function porNivelAcimaDoTexto(texto: string | undefined): string {
  if (!texto) return "";
  const limpo = semAcento(texto);
  for (const padrao of PADROES) {
    const achado = padrao.exec(limpo);
    const dados = achado?.[1]?.replace(/\s+/g, "");
    if (dados && lerExpressao(dados).ok) return dados;
  }
  const q = PADRAO_DE_QUANTIDADE.exec(limpo);
  const n = numeroDoTexto(q?.[1]);
  if (q?.[2] && n !== null) return `${n} ${q[2]}`;
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

// ---------------------------------------------------------------------------------------------
// N2: mais dardos, raios e alvos por nível; truques que sobem pelo nível do personagem; ritual; magia inata.
// ---------------------------------------------------------------------------------------------

const PLURAL_DA_UNIDADE: Record<string, string> = {
  dardo: "dardos",
  raio: "raios",
  alvo: "alvos",
  criatura: "criaturas",
};

/** "4 dardos", "1 raio": a quantidade com a unidade no plural certo. */
export function textoDaQuantidade(total: number, unidade: string): string {
  return `${total} ${total === 1 ? unidade : (PLURAL_DA_UNIDADE[unidade] ?? `${unidade}s`)}`;
}

/** Quantos dardos, raios ou alvos a magia tem no nível dela, lendo o texto ("Você cria três dardos"); `null` sem achar. */
export function quantidadeBaseDoTexto(texto: string | undefined, unidade: string): number | null {
  if (!texto) return null;
  const achado = new RegExp(
    String.raw`\b(um|uma|dois|duas|tres|quatro|cinco|seis|\d+)\s+${unidade}s?\b`,
  ).exec(semAcento(texto));
  return numeroDoTexto(achado?.[1]);
}

export type QuantidadeDaConjuracao = { total: number; unidade: string };

/**
 * A quantidade de dardos, raios ou alvos ao conjurar num espaço acima do nível da magia: a base (o campo
 * `quantidadeBase`, o texto da magia ou 1) mais o "por nível acima" vezes os níveis acima. `null` se a magia sobe
 * dados, não sobe nada ou está no nível dela.
 */
export function quantidadeDaConjuracao(
  m: Pick<Magia, "descricao" | "quantidadeBase">,
  porNivelAcima: string,
  nivelDaMagia: number,
  nivelDoEspaco: number,
  textoDoCompendio?: string,
): QuantidadeDaConjuracao | null {
  const lido = lerPorNivelAcima(porNivelAcima);
  const acima = niveisAcima(nivelDaMagia, nivelDoEspaco);
  if (lido?.tipo !== "quantidade" || acima === 0) return null;
  const base =
    m.quantidadeBase ??
    quantidadeBaseDoTexto(textoDoCompendio, lido.unidade) ??
    quantidadeBaseDoTexto(m.descricao, lido.unidade) ??
    1;
  return { total: Math.min(30, base + lido.por * acima), unidade: lido.unidade };
}

/** Soma duas expressões de dados juntando os dados do mesmo tipo ("1d10" + "1d10" = "2d10"). `null` se alguma não vale. */
export function somarExpressoes(base: string, extra: string): string | null {
  const a = lerExpressao(base);
  const b = lerExpressao(extra);
  if (!a.ok || !b.ok) return null;
  const termos = [...a.expressao.termos];
  for (const t of b.expressao.termos) {
    const i = termos.findIndex(
      (x) =>
        x.tipo === "dados" &&
        t.tipo === "dados" &&
        x.faces === t.faces &&
        x.sinal === t.sinal &&
        !x.manter &&
        !t.manter,
    );
    const par = termos[i];
    if (par && par.tipo === "dados" && t.tipo === "dados") {
      termos[i] = {
        ...par,
        quantidade: Math.min(par.quantidade + t.quantidade, LIMITES_DE_DADOS.dadosPorTermoRolado),
      };
    } else {
      termos.push(t);
    }
  }
  return formatarExpressao({ termos });
}

export type DadosPorNivel = NonNullable<Magia["dadosPorNivel"]>;

/**
 * O dado a mais que o truque ganha no nível do personagem: o do maior nível alcançado (os itens não se somam). `null`
 * abaixo do primeiro nível da lista ou sem lista.
 */
export function extraDoTruque(
  dadosPorNivel: DadosPorNivel | undefined,
  nivelDoPersonagem: number,
): { nivel: number; expressao: string } | null {
  let melhor: { nivel: number; expressao: string } | null = null;
  for (const item of dadosPorNivel ?? []) {
    if (item.nivel > nivelDoPersonagem || !lerExpressao(item.expressao).ok) continue;
    if (!melhor || item.nivel > melhor.nivel) melhor = item;
  }
  return melhor;
}

const PALAVRA_DE_NIVEL = String.raw`(\d{1,2})\s*[ºo°ª]?\s*nivel`;

/**
 * Lê, no texto da magia, os dados que um truque ganha pelo nível do personagem. Entende "o dano aumenta em 1d10
 * quando você alcança o 5º nível (2d10), 11º nível (3d10) e 17º nível (4d10)" (cada passo soma o mesmo dado) e, para
 * o raio, "dois raios no 5º nível, três no 11º e quatro no 17º" (cada raio a mais soma o dado do dano do texto).
 * Lista vazia se o texto não diz nada disso.
 */
export function dadosPorNivelDoTexto(texto: string | undefined): DadosPorNivel {
  if (!texto) return [];
  const limpo = semAcento(texto);
  const aumento = /aument(?:a|am)(?:\s+em)?\s+(\d+d\d+)([^.]*)/.exec(limpo);
  if (aumento?.[1]) {
    const niveis = [...(aumento[2] ?? "").matchAll(new RegExp(PALAVRA_DE_NIVEL, "g"))]
      .map((x) => Number(x[1]))
      .filter((n) => n >= 2 && n <= 20);
    const unicos = [...new Set(niveis)].sort((a, b) => a - b).slice(0, 6);
    const itens: DadosPorNivel = [];
    unicos.forEach((nivel, k) => {
      const expressao = multiplicarExpressao(aumento[1] as string, k + 1);
      if (expressao) itens.push({ nivel, expressao });
    });
    if (itens.length > 0) return itens;
  }
  const dano = /(\d+d\d+)/.exec(limpo)?.[1];
  if (/\braios?\b/.test(limpo) && dano) {
    const itens: DadosPorNivel = [];
    for (const x of limpo.matchAll(
      new RegExp(
        String.raw`\b(dois|duas|tres|quatro|cinco|\d+)\s+(?:raios?\s+)?no\s+${PALAVRA_DE_NIVEL}`,
        "g",
      ),
    )) {
      const quantos = numeroDoTexto(x[1]);
      const nivel = Number(x[2]);
      if (quantos === null || quantos < 2 || nivel < 2 || nivel > 20) continue;
      const expressao = multiplicarExpressao(dano, quantos - 1);
      if (expressao) itens.push({ nivel, expressao });
    }
    return itens.sort((a, b) => a.nivel - b.nivel).slice(0, 6);
  }
  return [];
}

/**
 * Os dados por nível do personagem valendo para a magia: o campo da ficha; se vazio, o texto do compêndio (a magia
 * com o mesmo nome) e, por último, a própria descrição. Só vale para truque (nível 0).
 */
export function dadosPorNivelDaMagia(
  m: Pick<Magia, "nivel" | "dadosPorNivel" | "descricao">,
  textoDoCompendio?: string,
): DadosPorNivel {
  if (m.nivel !== 0) return [];
  if (m.dadosPorNivel && m.dadosPorNivel.length > 0) return m.dadosPorNivel;
  const doCompendio = dadosPorNivelDoTexto(textoDoCompendio);
  return doCompendio.length > 0 ? doCompendio : dadosPorNivelDoTexto(m.descricao);
}

/**
 * O nível que vale para os truques: a soma dos níveis das classes; sem classe (NPC), o ND como aproximação
 * (frações contam 1); sem nada, 1.
 */
export function nivelParaTruque(f: Ficha): number {
  const soma = (f.classes ?? []).reduce((t, c) => t + c.nivel, 0);
  if (soma > 0) return Math.min(20, soma);
  const nd = f.npc?.nd?.trim();
  if (nd) {
    const n = nd.includes("/") ? 1 : Number(nd);
    if (Number.isFinite(n) && n >= 1) return Math.min(30, Math.floor(n));
  }
  return 1;
}

// ---------- magia inata ----------

/** O atributo da Conjuração inata: o escolhido nela, senão o da classe, senão o escolhido à mão na ficha. */
export function habilidadeDaInata(f: Ficha): Atributo | undefined {
  return f.inata?.habilidade ?? conjuradoras(f)[0]?.habilidade ?? f.habilidadeDeConjuracao;
}

/** A CD da Conjuração inata: a escrita à mão ou 8 + proficiência + modificador; `undefined` sem os dois. */
export function cdDaInata(f: Ficha): number | undefined {
  if (f.inata?.cd !== undefined) return f.inata.cd;
  const hab = habilidadeDaInata(f);
  return hab === undefined ? undefined : 8 + bonusDeProficiencia(f) + modDoAtributo(f, hab);
}

/** O bônus de ataque de magia da Conjuração inata (a CD menos 8); `undefined` sem CD. */
export function ataqueDaInata(f: Ficha): number | undefined {
  const cd = cdDaInata(f);
  return cd === undefined ? undefined : cd - 8;
}

/**
 * A magia inata como o rolador a lê: a CD e o ataque saem do atributo e da CD da Conjuração inata, não dos da classe
 * (o monstro: "atributo de conjuração inata é Carisma, CD 13"). Sem nada escolhido, a magia fica como está.
 */
export function magiaInataParaRolar(f: Ficha, m: Magia): Magia {
  const hab = habilidadeDaInata(f);
  const cd = cdDaInata(f);
  if (hab === undefined || cd === undefined) return m;
  const natural = 8 + bonusDeProficiencia(f) + modDoAtributo(f, hab);
  const saida: Magia = { ...m };
  if (m.salvaguarda) {
    saida.salvaguarda = { ...m.salvaguarda, cdAtributo: hab, cdBonus: cd - natural };
  }
  if (m.acerto?.tipo === "formula") {
    saida.acerto = {
      tipo: "formula",
      atributo: hab,
      proficiente: true,
      bonus: cd - natural + (m.acerto.bonus ?? 0),
    };
  }
  return saida;
}

/** Quantos usos a magia inata ainda tem: `null` = sem limite (à vontade); o grupo vale o do contador dele. */
export function usosRestantesDaInata(
  f: Ficha,
  m: Pick<Magia, "inata">,
): { restantes: number; max: number } | null {
  const i = m.inata;
  if (!i || i.frequencia === "vontade") return null;
  if (i.frequencia === "cada") {
    const max = i.max ?? 1;
    return { restantes: Math.max(0, max - (i.gastos ?? 0)), max };
  }
  const g = f.inata?.grupo;
  return g ? { restantes: Math.max(0, g.max - g.gastos), max: g.max } : { restantes: 0, max: 0 };
}

/** O texto da frequência: "À vontade", "3/dia cada" ou "2/dia". */
export function rotuloDaFrequenciaInata(
  frequencia: "vontade" | "cada" | "grupo",
  max: number | undefined,
): string {
  if (frequencia === "vontade") return "À vontade";
  return frequencia === "cada" ? `${max ?? 1}/dia cada` : `${max ?? 1}/dia`;
}

/**
 * Lê o rótulo de frequência de um bloco de monstro ("À vontade", "1/dia cada", "3/dia"). Devolve a frequência e o
 * máximo, ou `null` se o rótulo não é um deles.
 */
export function lerFrequenciaInata(
  rotulo: string,
): { frequencia: "vontade" | "cada" | "grupo"; max?: number } | null {
  const t = semAcento(rotulo).trim().replace(/:$/, "").trim();
  if (t === "a vontade") return { frequencia: "vontade" };
  const cada = /^(\d+)\s*\/\s*dia\s+cada$/.exec(t);
  if (cada?.[1]) return { frequencia: "cada", max: Number(cada[1]) };
  const grupo = /^(\d+)\s*\/\s*dia$/.exec(t);
  if (grupo?.[1]) return { frequencia: "grupo", max: Number(grupo[1]) };
  return null;
}
