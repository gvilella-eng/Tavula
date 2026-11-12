// As mesas que este navegador já abriu (C1): o que a tela inicial lista quando o servidor não lista as
// mesas (na internet ele não deixa). Fica no localStorage, sempre em try/catch.

const CHAVE = "tabletop:mesas";
const MAXIMO = 30;

export type MesaLembrada = { id: string; nome: string; ultimaVez: number };

function valida(x: unknown): x is MesaLembrada {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return typeof m.id === "string" && typeof m.nome === "string" && typeof m.ultimaVez === "number";
}

/** As mesas lembradas, da aberta mais recentemente para a mais antiga. */
export function lerMesasLembradas(): MesaLembrada[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as unknown;
    if (!Array.isArray(bruto)) return [];
    return bruto.filter(valida).sort((a, b) => b.ultimaVez - a.ultimaVez);
  } catch {
    return [];
  }
}

/** Anota que a mesa foi aberta agora (e guarda o nome atual dela). */
export function lembrarMesa(id: string, nome: string, agora = Date.now()): void {
  try {
    const outras = lerMesasLembradas().filter((m) => m.id !== id);
    const lista = [{ id, nome, ultimaVez: agora }, ...outras].slice(0, MAXIMO);
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // sem localStorage: a lista só não aparece
  }
}

/** Tira uma mesa da lista deste navegador (não apaga nada no servidor). */
export function esquecerMesa(id: string): void {
  try {
    const lista = lerMesasLembradas().filter((m) => m.id !== id);
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // idem
  }
}
