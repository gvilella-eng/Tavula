import {
  ACOES_DE_OBJETO,
  ACOES_DE_TOKEN,
  type Bloco,
  type Fluxo,
  MAXIMO_DE_BLOCOS_POR_FLUXO,
  PROFUNDIDADE_DA_ARVORE,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU1: a conferência de um fluxo, em português, apontando o bloco com problema. O editor mostra a mensagem no bloco (com
// contorno), a sala recusa o que tem erro e o MCP devolve o mesmo texto. Pura: quem chama diz o que existe na mesa.
// ---------------------------------------------------------------------------------------------

export type ReferenciasDaMesa = {
  cenas: ReadonlySet<string>;
  modelos: ReadonlySet<string>;
  zonas: ReadonlySet<string>;
  /** O `hash` dos sons registrados. */
  sons: ReadonlySet<string>;
};

/** `caminho`: `"nome"`, `"gatilho"`, `"cenas"` ou o do bloco (`"trilhas.0.2.sim.1"`: trilha, bloco, ramo, bloco). */
export type ProblemaDoFluxo = { caminho: string; mensagem: string };

type QuemEstaNaVez = "objeto" | "token" | "nada" | "qualquer";

export function problemasDoFluxo(fluxo: Fluxo, ref: ReferenciasDaMesa): ProblemaDoFluxo[] {
  const p: ProblemaDoFluxo[] = [];
  const add = (caminho: string, mensagem: string) => p.push({ caminho, mensagem });
  const cena = (id: string, onde: string) => {
    if (!ref.cenas.has(id)) add(onde, "Essa cena não existe mais.");
  };
  const zona = (id: string, onde: string) => {
    if (!ref.zonas.has(id)) add(onde, "Essa zona não existe mais.");
  };
  const modelo = (id: string, onde: string) => {
    if (!ref.modelos.has(id)) add(onde, "Esse modelo de objeto não existe mais.");
  };

  for (const c of fluxo.cenas ?? []) cena(c, "cenas");

  const g = fluxo.gatilho;
  switch (g.tipo) {
    case "botao":
      if (g.cena !== undefined) cena(g.cena, "gatilho");
      break;
    case "tocha":
      if (g.modelo !== undefined) modelo(g.modelo, "gatilho");
      break;
    case "zona":
      if (g.zona !== undefined) zona(g.zona, "gatilho");
      break;
    case "cena":
      if (g.cena !== undefined) cena(g.cena, "gatilho");
      break;
    default:
      break;
  }

  let total = 0;
  const quemDoGatilho: QuemEstaNaVez =
    g.tipo === "tocha"
      ? "objeto"
      : g.tipo === "zona" || g.tipo === "turno"
        ? "token"
        : g.tipo === "sinal"
          ? "qualquer"
          : "nada";

  const lista = (
    blocos: Bloco[],
    caminho: string,
    profundidade: number,
    quem: QuemEstaNaVez,
    vazia: string | null,
  ) => {
    if (profundidade > PROFUNDIDADE_DA_ARVORE) {
      add(caminho, "Blocos aninhados demais: simplifique o fluxo.");
      return;
    }
    if (blocos.length === 0 && vazia !== null) add(caminho, vazia);
    for (const [i, b] of blocos.entries()) {
      total++;
      const aqui = `${caminho}.${i}`;
      switch (b.bloco) {
        case "esperar":
          break;
        case "se": {
          const c = b.condicao;
          if (c.condicao === "dentroDaZona" || c.condicao === "zonaLigada") zona(c.zona, aqui);
          if (c.condicao === "cena") for (const id of c.cenas) cena(id, aqui);
          lista(b.sim, `${aqui}.sim`, profundidade + 1, quem, 'Ponha algo no "sim".');
          lista(b.nao, `${aqui}.nao`, profundidade + 1, quem, null);
          break;
        }
        case "sortear":
          lista(b.sim, `${aqui}.sim`, profundidade + 1, quem, 'Ponha algo no "sim".');
          lista(b.nao, `${aqui}.nao`, profundidade + 1, quem, null);
          break;
        case "paraCada": {
          const a = b.alvo;
          if (a.naZona !== undefined) zona(a.naZona, aqui);
          if (a.tipo === "objetos" && a.modelo !== undefined) modelo(a.modelo, aqui);
          if (a.tipo === "tokens" && a.naCena !== undefined) cena(a.naCena, aqui);
          lista(
            b.corpo,
            `${aqui}.corpo`,
            profundidade + 1,
            a.tipo === "objetos" ? "objeto" : "token",
            'Ponha algo no "para cada".',
          );
          break;
        }
        case "acao": {
          const a = b.acao;
          if (a.acao === "zona.ativar") zona(a.zona, aqui);
          if (a.acao === "som.tocar" && !ref.sons.has(a.hash))
            add(aqui, "Esse som não está mais na mesa.");
          if (quem !== "qualquer") {
            if (ACOES_DE_OBJETO.includes(a.acao) && quem !== "objeto") {
              add(aqui, 'Esta ação mexe numa luz: ponha-a dentro de um "para cada" de objetos.');
            } else if (ACOES_DE_TOKEN.includes(a.acao) && quem === "nada") {
              add(aqui, 'Esta ação mexe num token: ponha-a dentro de um "para cada" de tokens.');
            }
          }
          break;
        }
        case "sinal":
          break;
      }
    }
  };

  if (fluxo.trilhas.every((t) => t.length === 0)) {
    add("trilhas.0", "Ponha pelo menos um bloco no fluxo.");
  }
  for (const [t, trilha] of fluxo.trilhas.entries()) {
    lista(
      trilha,
      `trilhas.${t}`,
      1,
      quemDoGatilho,
      fluxo.trilhas.length > 1 ? "Esta trilha está vazia." : null,
    );
  }
  if (total > MAXIMO_DE_BLOCOS_POR_FLUXO) {
    add("trilhas.0", `Blocos demais (o máximo é ${MAXIMO_DE_BLOCOS_POR_FLUXO}).`);
  }
  return p;
}
