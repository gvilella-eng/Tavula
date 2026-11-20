import {
  ACOES_DE_OBJETO,
  ACOES_DE_TOKEN,
  ESPERA_MINIMA_DO_CICLO_S,
  ehNoDeValor,
  type Fluxo,
  type No,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU1/AU2: a conferência de um fluxo, em português, apontando o nó com problema. O editor mostra a mensagem no nó (com
// contorno), a sala recusa o que tem erro e o MCP devolve o mesmo texto. Pura: quem chama diz o que existe na mesa.
// ---------------------------------------------------------------------------------------------

export type ReferenciasDaMesa = {
  cenas: ReadonlySet<string>;
  modelos: ReadonlySet<string>;
  zonas: ReadonlySet<string>;
  /** O `hash` dos sons registrados. */
  sons: ReadonlySet<string>;
};

/** `caminho`: `"nome"`, `"cenas"`, `"grafo"` (o fluxo todo) ou `"nos.<id>"` (um nó). */
export type ProblemaDoFluxo = { caminho: string; mensagem: string };

/** O caminho de um nó nos problemas. */
export const caminhoDoNo = (id: string): string => `nos.${id}`;

type QuemEstaNaVez = "objeto" | "token" | "nada" | "qualquer";

export function problemasDoFluxo(fluxo: Fluxo, ref: ReferenciasDaMesa): ProblemaDoFluxo[] {
  const p: ProblemaDoFluxo[] = [];
  const add = (caminho: string, mensagem: string) => p.push({ caminho, mensagem });
  const noAqui = (n: No, mensagem: string) => add(caminhoDoNo(n.id), mensagem);
  const cena = (n: No | null, id: string) => {
    if (!ref.cenas.has(id)) {
      if (n) noAqui(n, "Essa cena não existe mais.");
      else add("cenas", "Essa cena não existe mais.");
    }
  };
  const zona = (n: No, id: string) => {
    if (!ref.zonas.has(id)) noAqui(n, "Essa zona não existe mais.");
  };
  const modelo = (n: No, id: string) => {
    if (!ref.modelos.has(id)) noAqui(n, "Esse modelo de objeto não existe mais.");
  };

  for (const c of fluxo.cenas ?? []) cena(null, c);

  const porId = new Map(fluxo.nos.map((n) => [n.id, n]));
  const entram = (id: string, porta: string) =>
    fluxo.fios.filter((f) => f.para.no === id && f.para.entrada === porta);
  const saem = (id: string, porta?: string) =>
    fluxo.fios.filter((f) => f.de.no === id && (porta === undefined || f.de.saida === porta));

  const gatilhos = fluxo.nos.filter((n) => n.tipo === "gatilho");
  if (gatilhos.length === 0) add("grafo", "Ponha um gatilho (o Quando) para a automação rodar.");
  if (fluxo.nos.every((n) => n.tipo === "gatilho")) {
    if (gatilhos.length > 0) add("grafo", "Ponha pelo menos um bloco depois do gatilho.");
  }

  // --- O que cada nó guarda ---
  const vistosUnicos = new Set<string>();
  for (const n of fluxo.nos) {
    switch (n.tipo) {
      case "gatilho": {
        const g = n.config;
        if (g.tipo === "botao" && g.cena !== undefined) cena(n, g.cena);
        if (g.tipo === "tocha" && g.modelo !== undefined) modelo(n, g.modelo);
        if (g.tipo === "zona" && g.zona !== undefined) zona(n, g.zona);
        if (g.tipo === "cena" && g.cena !== undefined) cena(n, g.cena);
        if (g.tipo === "relogio" || g.tipo === "botao") {
          if (vistosUnicos.has(g.tipo)) {
            noAqui(
              n,
              g.tipo === "relogio"
                ? "Só pode haver um gatilho de relógio por automação."
                : "Só pode haver um gatilho de botão por automação.",
            );
          }
          vistosUnicos.add(g.tipo);
        }
        if (saem(n.id).length === 0) noAqui(n, "Ligue este gatilho a algum bloco.");
        break;
      }
      case "condicao": {
        const c = n.config;
        if (c.condicao === "dentroDaZona" || c.condicao === "zonaLigada") zona(n, c.zona);
        if (c.condicao === "cena") for (const id of c.cenas) cena(n, id);
        if (saem(n.id).length === 0)
          noAqui(n, "Ligue esta condição à entrada de um “se” ou de uma porta.");
        break;
      }
      case "porta": {
        const ins = fluxo.fios.filter((f) => f.para.no === n.id).length;
        if (ins === 0) noAqui(n, "Esta porta está sem entrada: ligue condições nela.");
        else if (n.config.porta === "nao" && ins !== 1)
          noAqui(n, "A porta NÃO precisa de uma entrada só.");
        if (saem(n.id).length === 0)
          noAqui(n, "Ligue esta porta à entrada de um “se” ou de outra porta.");
        break;
      }
      case "se":
        if (entram(n.id, "condicao").length === 0) {
          noAqui(n, "Este “se” está sem condição: ligue uma condição à entrada dele.");
        }
        if (saem(n.id).length === 0) noAqui(n, "Ligue o “Sim” ou o “Não” a algum bloco.");
        break;
      case "sortear":
        if (saem(n.id).length === 0) noAqui(n, "Ligue o “Sim” ou o “Não” a algum bloco.");
        break;
      case "paraCada": {
        const a = n.config.alvo;
        if (a.naZona !== undefined) zona(n, a.naZona);
        if (a.tipo === "objetos" && a.modelo !== undefined) modelo(n, a.modelo);
        if (a.tipo === "tokens" && a.naCena !== undefined) cena(n, a.naCena);
        if (saem(n.id, "corpo").length === 0) noAqui(n, "Ligue o “Para cada” a algum bloco.");
        break;
      }
      case "acao": {
        const a = n.config.acao;
        if (a.acao === "zona.ativar") zona(n, a.zona);
        if (a.acao === "som.tocar" && !ref.sons.has(a.hash)) {
          noAqui(n, "Esse som não está mais na mesa.");
        }
        break;
      }
      default:
        break;
    }
  }

  // --- Ligações: tudo o que roda tem de chegar de um gatilho ---
  const ehExec = (n: No) => !ehNoDeValor(n);
  const alcancado = new Map<string, Set<QuemEstaNaVez>>();
  const fila: { id: string; quem: QuemEstaNaVez }[] = [];
  const visita = (id: string, quem: QuemEstaNaVez) => {
    const set = alcancado.get(id) ?? new Set<QuemEstaNaVez>();
    if (set.has(quem)) return;
    set.add(quem);
    alcancado.set(id, set);
    fila.push({ id, quem });
  };
  for (const g of gatilhos) {
    if (g.tipo !== "gatilho") continue;
    const t = g.config.tipo;
    visita(
      g.id,
      t === "tocha"
        ? "objeto"
        : t === "zona" || t === "turno"
          ? "token"
          : t === "sinal"
            ? "qualquer"
            : "nada",
    );
  }
  while (fila.length > 0) {
    const atual = fila.shift();
    if (atual === undefined) break;
    const no = porId.get(atual.id);
    if (no === undefined) continue;
    for (const f of saem(no.id)) {
      const alvo = porId.get(f.para.no);
      if (alvo === undefined || !ehExec(alvo)) continue;
      let quem = atual.quem;
      if (no.tipo === "paraCada" && f.de.saida === "corpo") {
        quem = no.config.alvo.tipo === "objetos" ? "objeto" : "token";
      }
      visita(alvo.id, quem);
    }
  }
  for (const n of fluxo.nos) {
    if (n.tipo === "gatilho" || !ehExec(n)) continue;
    const quem = alcancado.get(n.id);
    if (quem === undefined) {
      noAqui(n, "Este bloco não está ligado a nenhum gatilho: ligue um fio até ele.");
      continue;
    }
    if (n.tipo !== "acao" || quem.has("qualquer")) continue;
    const a = n.config.acao;
    if (ACOES_DE_OBJETO.includes(a.acao) && !quem.has("objeto")) {
      noAqui(n, "Esta ação mexe numa luz: ponha-a depois de um “para cada” de objetos.");
    } else if (ACOES_DE_TOKEN.includes(a.acao) && !quem.has("token") && !quem.has("objeto")) {
      noAqui(n, "Esta ação mexe num token: ponha-a depois de um “para cada” de tokens.");
    }
  }

  // --- Ciclos ---
  // Fios de ordem: só vale um ciclo que passe por um "esperar" de pelo menos 1 s.
  const semEspera = new Set(
    fluxo.nos
      .filter((n) => ehExec(n) && !(n.tipo === "esperar" && n.config.s >= ESPERA_MINIMA_DO_CICLO_S))
      .map((n) => n.id),
  );
  const cor = new Map<string, 1 | 2>();
  let achouCiclo = false;
  const dfs = (id: string, ehValor: boolean) => {
    if (achouCiclo) return;
    cor.set(id, 1);
    for (const f of saem(id)) {
      const alvo = porId.get(f.para.no);
      if (alvo === undefined || ehNoDeValor(alvo) !== ehValor) continue;
      if (!ehValor && !semEspera.has(alvo.id)) continue;
      const c = cor.get(alvo.id);
      if (c === 1) {
        achouCiclo = true;
        noAqui(
          alvo,
          ehValor
            ? "Há um ciclo de condições: uma porta depende dela mesma."
            : `Há um ciclo sem pausa: ponha um “esperar” de pelo menos ${ESPERA_MINIMA_DO_CICLO_S} s no caminho de volta.`,
        );
        return;
      }
      if (c === undefined) dfs(alvo.id, ehValor);
    }
    cor.set(id, 2);
  };
  for (const n of fluxo.nos) {
    if (achouCiclo) break;
    if (ehExec(n) && semEspera.has(n.id) && !cor.has(n.id)) dfs(n.id, false);
  }
  cor.clear();
  achouCiclo = false;
  for (const n of fluxo.nos) {
    if (achouCiclo) break;
    if (ehNoDeValor(n) && !cor.has(n.id)) dfs(n.id, true);
  }

  return p;
}
