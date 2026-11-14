import exemploSrd from "../../../../fixtures/compendio/exemplo-srd.json";
import {
  type ArmaDoCompendio,
  buscarMagias,
  type Compendio,
  type EntradaDoCompendio,
  type ItemDoCompendio,
  lerCompendio,
  type MagiaDoCompendio,
  normalizarBusca,
} from "../index.ts";
import { ErroDoMcp } from "./erros.ts";

export type FiltroDoCompendio = {
  busca?: string | undefined;
  tipo?: "magia" | "arma" | "item" | "todos" | undefined;
  nivel?: number | undefined;
  escola?: string | undefined;
  classe?: string | undefined;
};

export type AchadoDoCompendio =
  | { tipo: "magia"; magia: MagiaDoCompendio }
  | { tipo: "arma"; arma: ArmaDoCompendio }
  | { tipo: "item"; item: ItemDoCompendio };

function nomeDe(a: AchadoDoCompendio): string {
  return a.tipo === "magia" ? a.magia.nome : a.tipo === "arma" ? a.arma.nome : a.item.nome;
}

function nomesParaBusca(a: AchadoDoCompendio): string[] {
  const o = a.tipo === "magia" ? a.magia : a.tipo === "arma" ? a.arma : a.item;
  return [o.nome, o.nomeOriginal ?? ""].map(normalizarBusca).filter(Boolean);
}

/**
 * O compêndio que o MCP consulta. No `apps/mcp` (stdio) é o `magias.json` do usuário, lido do computador; na sala (HTTP)
 * é o exemplo do SRD que vai dentro do Worker. Nada vem da internet.
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
    ];
  }

  /** O exemplo do SRD que vai dentro do programa (nada é lido de disco nem da internet). */
  static doExemplo(): CompendioLocal {
    const exemplo = lerCompendio(JSON.stringify(exemploSrd));
    if (!exemplo.ok) throw new ErroDoMcp("O compêndio de exemplo do programa está quebrado.");
    return new CompendioLocal(exemplo.compendio, "exemplo do SRD (dentro do programa)");
  }

  resumo(): { magias: number; armas: number; itens: number } {
    return {
      magias: this.dados.magias.length,
      armas: this.dados.armas?.length ?? 0,
      itens: this.dados.itens?.length ?? 0,
    };
  }

  /** A entrada pelo nome (magia, arma ou item), no formato que a ficha aplica. Nome ambíguo ou ausente: erro claro. */
  achar(nome: string): EntradaDoCompendio {
    const achado = this.acharPeloNome(nome);
    if (achado.tipo === "magia") return { tipo: "magia", magia: achado.magia };
    if (achado.tipo === "arma") return { tipo: "arma", arma: achado.arma };
    return { tipo: "item", item: achado.item };
  }

  /** O nome pode levar o tipo na frente ("magia:Luz", "arma:Adaga", "item:Corda") para desfazer um empate. */
  acharPeloNome(nomePedido: string): AchadoDoCompendio {
    const prefixo = /^(magia|arma|item)\s*:\s*(.+)$/i.exec(nomePedido.trim());
    const tipoPedido = prefixo ? (prefixo[1] as string).toLowerCase() : null;
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
    if (tipo === "todos" || tipo === "magia") {
      for (const magia of buscarMagias(this.dados.magias, {
        texto: f.busca,
        nivel: f.nivel,
        escola: f.escola,
        classe: f.classe,
      })) {
        saida.push({ tipo: "magia", magia });
      }
    }
    const semFiltroDeMagia =
      f.nivel === undefined && f.escola === undefined && f.classe === undefined;
    if (semFiltroDeMagia) {
      const palavras = normalizarBusca(f.busca ?? "")
        .split(/\s+/)
        .filter(Boolean);
      const passa = (a: AchadoDoCompendio) => {
        const alvo = nomesParaBusca(a).join(" ");
        return palavras.every((p) => alvo.includes(p));
      };
      const outros = this.todos.filter(
        (a) => a.tipo !== "magia" && (tipo === "todos" || tipo === a.tipo) && passa(a),
      );
      saida.push(...outros.sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR")));
    }
    return saida;
  }
}
