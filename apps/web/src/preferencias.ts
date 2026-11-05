// Preferências locais (só deste navegador). O localStorage pode estar bloqueado: tudo em try/catch.

const CHAVE_ENCAIXE = "tabletop:pref:encaixe";

/** Encaixe no grid ao arrastar token: ligado por padrão (Alt solta sem encaixe). */
export function lerEncaixePadrao(): boolean {
  try {
    return localStorage.getItem(CHAVE_ENCAIXE) !== "0";
  } catch {
    return true;
  }
}

export function gravarEncaixePadrao(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_ENCAIXE, ligado ? "1" : "0");
  } catch {
    // sem localStorage: vale só nesta sessão
  }
}
