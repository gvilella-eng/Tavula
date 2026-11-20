import type { AcaoDeFluxo, Bloco, Fluxo } from "./fluxos.ts";

// --- Leitura ---------------------------------------------------------------------------------

/** Percorre todos os blocos de uma trilha (e os de dentro), com o caminho de cada um (`"0.2.sim.1"`, sem a trilha). */
export function paraCadaBloco(
  lista: readonly Bloco[],
  f: (b: Bloco, caminho: (number | string)[], profundidade: number) => void,
  prefixo: (number | string)[] = [],
  profundidade = 1,
): void {
  for (const [i, b] of lista.entries()) {
    const caminho = [...prefixo, i];
    f(b, caminho, profundidade);
    if (b.bloco === "se" || b.bloco === "sortear") {
      paraCadaBloco(b.sim, f, [...caminho, "sim"], profundidade + 1);
      paraCadaBloco(b.nao, f, [...caminho, "nao"], profundidade + 1);
    } else if (b.bloco === "paraCada") {
      paraCadaBloco(b.corpo, f, [...caminho, "corpo"], profundidade + 1);
    }
  }
}

/** Todos os blocos do fluxo, em ordem, com o caminho completo (`[trilha, i, "sim", j]`). */
export function blocosDoFluxo(
  fluxo: Pick<Fluxo, "trilhas">,
): { bloco: Bloco; caminho: (number | string)[]; profundidade: number }[] {
  const saida: { bloco: Bloco; caminho: (number | string)[]; profundidade: number }[] = [];
  for (const [t, trilha] of fluxo.trilhas.entries()) {
    paraCadaBloco(
      trilha,
      (bloco, caminho, profundidade) => saida.push({ bloco, caminho, profundidade }),
      [t],
    );
  }
  return saida;
}

/** Todas as ações do fluxo, em ordem (as de dentro de "se", "sortear" e "para cada" também). */
export function acoesDoFluxo(fluxo: Pick<Fluxo, "trilhas">): AcaoDeFluxo[] {
  return blocosDoFluxo(fluxo).flatMap(({ bloco }) => (bloco.bloco === "acao" ? [bloco.acao] : []));
}

/**
 * As trilhas sem as ações que `tirar` aponta. "Se", "sortear" e "para cada" que ficam sem nada dentro saem junto (o "sim"
 * vazio não faz sentido); o "não" vazio é normal e fica.
 */
export function trilhasSem(
  trilhas: readonly (readonly Bloco[])[],
  tirar: (a: AcaoDeFluxo) => boolean,
): Bloco[][] {
  const lista = (blocos: readonly Bloco[]): Bloco[] =>
    blocos.flatMap((b): Bloco[] => {
      if (b.bloco === "acao") return tirar(b.acao) ? [] : [b];
      if (b.bloco === "se" || b.bloco === "sortear") {
        const sim = lista(b.sim);
        return sim.length === 0 ? [] : [{ ...b, sim, nao: lista(b.nao) }];
      }
      if (b.bloco === "paraCada") {
        const corpo = lista(b.corpo);
        return corpo.length === 0 ? [] : [{ ...b, corpo }];
      }
      return [b];
    });
  return trilhas.map(lista);
}

/**
 * O fluxo usa esta zona ou este modelo de objeto (no gatilho, numa condição, num "para cada" ou numa ação)? Serve ao painel
 * da zona ("automações que usam esta zona") e ao editor de modelo.
 */
export function fluxoUsa(
  fluxo: Pick<Fluxo, "gatilho" | "trilhas">,
  tipo: "zona" | "modelo",
  id: string,
): boolean {
  const chaves = tipo === "zona" ? ["zona", "naZona"] : ["modelo"];
  const anda = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(anda);
    if (typeof v !== "object" || v === null) return false;
    return Object.entries(v).some(([k, x]) => (chaves.includes(k) && x === id) || anda(x));
  };
  return anda({ gatilho: fluxo.gatilho, trilhas: fluxo.trilhas });
}

/** O fluxo com os ids de zona trocados (`zona`, `naZona`), para a cópia de uma cena levar as automações das zonas. */
export function comZonasTrocadas<T extends object>(valor: T, mapa: ReadonlyMap<string, string>): T {
  const anda = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(anda);
    if (typeof v !== "object" || v === null) return v;
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [
        k,
        (k === "zona" || k === "naZona") && typeof x === "string" ? (mapa.get(x) ?? x) : anda(x),
      ]),
    );
  };
  return anda(valor) as T;
}
