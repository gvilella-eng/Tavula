import exemploSrd from "../../../../fixtures/compendio/exemplo-srd.json";
import {
  type ArmaDoCompendio,
  buscarItensMagicos,
  buscarMagias,
  buscarMonstros,
  type Compendio,
  type EntradaDoCompendio,
  type ItemDoCompendio,
  type ItemMagicoDoCompendio,
  lerCompendio,
  type MagiaDoCompendio,
  type MonstroDoCompendio,
  magiasDoMonstro,
  normalizarBusca,
  type RaridadeDeItemMagico,
} from "../index.ts";
import { ErroDoMcp } from "./erros.ts";

export type FiltroDoCompendio = {
  busca?: string | undefined;
  tipo?: "magia" | "arma" | "item" | "monstro" | "itemMagico" | "todos" | undefined;
  nivel?: number | undefined;
  escola?: string | undefined;
  classe?: string | undefined;
  /** Monstros (N3a): o nível de desafio exato ("1/4") ou a faixa. */
  nd?: string | undefined;
  ndMin?: string | undefined;
  ndMax?: string | undefined;
  tamanho?: string | undefined;
  tipoDeCriatura?: string | undefined;
  /** Itens mágicos (N3a). */
  raridade?: RaridadeDeItemMagico | undefined;
  tipoDeItem?: string | undefined;
};

export type AchadoDoCompendio =
  | { tipo: "magia"; magia: MagiaDoCompendio }
  | { tipo: "arma"; arma: ArmaDoCompendio }
  | { tipo: "item"; item: ItemDoCompendio }
  | { tipo: "monstro"; monstro: MonstroDoCompendio }
  | { tipo: "itemMagico"; itemMagico: ItemMagicoDoCompendio };

function entradaDe(a: AchadoDoCompendio) {
  switch (a.tipo) {
    case "magia":
      return a.magia;
    case "arma":
      return a.arma;
    case "item":
      return a.item;
    case "monstro":
      return a.monstro;
    case "itemMagico":
      return a.itemMagico;
  }
}

function nomeDe(a: AchadoDoCompendio): string {
  return entradaDe(a).nome;
}

function nomesParaBusca(a: AchadoDoCompendio): string[] {
  const o = entradaDe(a);
  return [o.nome, o.nomeOriginal ?? ""].map(normalizarBusca).filter(Boolean);
}

/**
 * O compêndio que o MCP consulta. No `apps/mcp` (stdio) são os arquivos de `compendio/` do usuário, lidos do computador;
 * na sala (HTTP) é o exemplo do SRD que vai dentro do Worker. Nada vem da internet.
 */
export class CompendioLocal {
  readonly origem: string;
  private readonly dados: Compendio;
  private readonly todos: AchadoDoCompendio[];

  constructor(dados: Compendio, origem: string) {
    this.dados = dados;
    this.origem = origem;
    this.todos = [
      ...dados.magias.map((magia): AchadoDoCompendio => ({ tipo: "magia", magia })),
      ...(dados.armas ?? []).map((arma): AchadoDoCompendio => ({ tipo: "arma", arma })),
      ...(dados.itens ?? []).map((item): AchadoDoCompendio => ({ tipo: "item", item })),
      ...(dados.monstros ?? []).map((monstro): AchadoDoCompendio => ({ tipo: "monstro", monstro })),
      ...(dados.itensMagicos ?? []).map(
        (itemMagico): AchadoDoCompendio => ({ tipo: "itemMagico", itemMagico }),
      ),
    ];
  }

  /** O exemplo do SRD que vai dentro do programa (nada é lido de disco nem da internet). */
  static doExemplo(): CompendioLocal {
    const exemplo = lerCompendio(JSON.stringify(exemploSrd));
    if (!exemplo.ok) throw new ErroDoMcp("O compêndio de exemplo do programa está quebrado.");
    return new CompendioLocal(exemplo.compendio, "exemplo do SRD (dentro do programa)");
  }

  resumo(): {
    magias: number;
    armas: number;
    itens: number;
    monstros: number;
    itensMagicos: number;
  } {
    return {
      magias: this.dados.magias.length,
      armas: this.dados.armas?.length ?? 0,
      itens: this.dados.itens?.length ?? 0,
      monstros: this.dados.monstros?.length ?? 0,
      itensMagicos: this.dados.itensMagicos?.length ?? 0,
    };
  }

  /** As magias do compêndio (o monstro com conjuração leva as dele para a ficha). */
  magias(): readonly MagiaDoCompendio[] {
    return this.dados.magias;
  }

  /** A entrada pelo nome (magia, arma, item, monstro ou item mágico), no formato que a ficha aplica. Nome ambíguo ou ausente: erro claro. */
  achar(nome: string): EntradaDoCompendio {
    const achado = this.acharPeloNome(nome);
    switch (achado.tipo) {
      case "magia":
        return { tipo: "magia", magia: achado.magia };
      case "arma":
        return { tipo: "arma", arma: achado.arma };
      case "monstro":
        return {
          tipo: "monstro",
          monstro: achado.monstro,
          magias: magiasDoMonstro(achado.monstro, this.dados.magias),
        };
      case "itemMagico":
        return { tipo: "itemMagico", itemMagico: achado.itemMagico };
      default:
        return { tipo: "item", item: achado.item };
    }
  }

  /** N3a: o monstro pelo nome (com as magias dele que o compêndio tem); o resto do compêndio nem entra na conta. */
  acharMonstro(nome: string): { monstro: MonstroDoCompendio; magias: MagiaDoCompendio[] } {
    const achado = this.acharPeloNome(`monstro:${nome.replace(/^monstro\s*:\s*/i, "")}`);
    if (achado.tipo !== "monstro") throw new ErroDoMcp(`"${nome}" não é um monstro.`);
    return {
      monstro: achado.monstro,
      magias: magiasDoMonstro(achado.monstro, this.dados.magias),
    };
  }

  /** O nome pode levar o tipo na frente ("magia:Luz", "arma:Adaga", "item:Corda", "monstro:Goblin", "itemMagico:Anel") para desfazer um empate. */
  acharPeloNome(nomePedido: string): AchadoDoCompendio {
    const prefixo = /^(magia|arma|item|monstro|itemmagico)\s*:\s*(.+)$/i.exec(nomePedido.trim());
    const bruto = prefixo ? (prefixo[1] as string).toLowerCase() : null;
    const tipoPedido = bruto === "itemmagico" ? "itemMagico" : bruto;
    const nome = prefixo ? (prefixo[2] as string) : nomePedido;
    const alvo = normalizarBusca(nome);
    if (alvo === "") throw new ErroDoMcp("Diga o nome da entrada do compêndio.");
    const rotulo = (a: AchadoDoCompendio) => `${nomeDe(a)} (${a.tipo})`;
    const candidatos = tipoPedido ? this.todos.filter((a) => a.tipo === tipoPedido) : this.todos;
    const iguais = candidatos.filter((a) => nomesParaBusca(a).includes(alvo));
    if (iguais.length === 1) return iguais[0] as AchadoDoCompendio;
    if (iguais.length > 1) {
      throw new ErroDoMcp(
        `"${nome}" existe como ${iguais.map(rotulo).join(" e ")}. Escreva o tipo na frente: ${iguais.map((a) => `"${a.tipo}:${nomeDe(a)}"`).join(" ou ")}.`,
      );
    }
    const parecidos = candidatos.filter((a) => nomesParaBusca(a).some((n) => n.includes(alvo)));
    if (parecidos.length === 1) return parecidos[0] as AchadoDoCompendio;
    if (parecidos.length > 1) {
      throw new ErroDoMcp(
        `"${nome}" serve para várias entradas: ${parecidos
          .slice(0, 8)
          .map(rotulo)
          .join(", ")}. Escreva o nome inteiro.`,
      );
    }
    throw new ErroDoMcp(
      `Não achei "${nome}" no compêndio (${this.origem}). Procure com a ferramenta compendio, ou escreva a magia, o ataque ou o item à mão na ficha.`,
    );
  }

  buscar(f: FiltroDoCompendio): AchadoDoCompendio[] {
    const tipo = f.tipo ?? "todos";
    const saida: AchadoDoCompendio[] = [];
    const filtroDeMagia = f.nivel !== undefined || f.escola !== undefined || f.classe !== undefined;
    const filtroDeMonstro =
      f.nd !== undefined ||
      f.ndMin !== undefined ||
      f.ndMax !== undefined ||
      f.tamanho !== undefined ||
      f.tipoDeCriatura !== undefined;
    const filtroDeItemMagico = f.raridade !== undefined || f.tipoDeItem !== undefined;
    // Sem tipo pedido, um filtro próprio de uma categoria deixa de fora as outras.
    const vale = (cat: NonNullable<FiltroDoCompendio["tipo"]>, meu: boolean): boolean => {
      if (tipo === cat) return true;
      if (tipo !== "todos") return false;
      const algumFiltro = filtroDeMagia || filtroDeMonstro || filtroDeItemMagico;
      return !algumFiltro || meu;
    };
    if (vale("magia", filtroDeMagia)) {
      for (const magia of buscarMagias(this.dados.magias, {
        texto: f.busca,
        nivel: f.nivel,
        escola: f.escola,
        classe: f.classe,
      })) {
        saida.push({ tipo: "magia", magia });
      }
    }
    if (vale("monstro", filtroDeMonstro)) {
      for (const monstro of buscarMonstros(this.dados.monstros ?? [], {
        texto: f.busca,
        tipo: f.tipoDeCriatura,
        tamanho: f.tamanho,
        ndDe: f.nd ?? f.ndMin,
        ndAte: f.nd ?? f.ndMax,
      })) {
        saida.push({ tipo: "monstro", monstro });
      }
    }
    if (vale("itemMagico", filtroDeItemMagico)) {
      for (const itemMagico of buscarItensMagicos(this.dados.itensMagicos ?? [], {
        texto: f.busca,
        tipo: f.tipoDeItem,
        raridade: f.raridade,
      })) {
        saida.push({ tipo: "itemMagico", itemMagico });
      }
    }
    const palavras = normalizarBusca(f.busca ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const passa = (a: AchadoDoCompendio) => {
      const alvo = nomesParaBusca(a).join(" ");
      return palavras.every((p) => alvo.includes(p));
    };
    for (const cat of ["arma", "item"] as const) {
      if (!vale(cat, false)) continue;
      saida.push(
        ...this.todos
          .filter((a) => a.tipo === cat && passa(a))
          .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR")),
      );
    }
    return saida;
  }
}
