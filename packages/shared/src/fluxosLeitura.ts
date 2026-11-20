import type { AcaoDeFluxo, Fluxo } from "./fluxos.ts";

// --- Leitura ---------------------------------------------------------------------------------

/** Todas as ações do fluxo, na ordem dos nós. */
export function acoesDoFluxo(fluxo: Pick<Fluxo, "nos">): AcaoDeFluxo[] {
  return fluxo.nos.flatMap((n) => (n.tipo === "acao" ? [n.config.acao] : []));
}

/**
 * O fluxo usa esta zona ou este modelo de objeto (num gatilho, numa condição, num "para cada" ou numa ação)? Serve ao painel
 * da zona ("automações que usam esta zona") e ao editor de modelo.
 */
export function fluxoUsa(fluxo: Pick<Fluxo, "nos">, tipo: "zona" | "modelo", id: string): boolean {
  const chaves = tipo === "zona" ? ["zona", "naZona"] : ["modelo"];
  const anda = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(anda);
    if (typeof v !== "object" || v === null) return false;
    return Object.entries(v).some(([k, x]) => (chaves.includes(k) && x === id) || anda(x));
  };
  return fluxo.nos.some((n) => anda(n.config));
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
