// Rascunhos no localStorage (seção 4.4): o que ainda não foi enviado volta depois do refresh.
// O localStorage pode estar bloqueado ou indisponível: tudo em try/catch, a tela funciona sem ele.

export function chaveDoRascunho(usuarioId: string, campo: string): string {
  return `tabletop:rascunho:${usuarioId}:${campo}`;
}

export function lerRascunho(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarRascunho(chave: string, texto: string): void {
  try {
    localStorage.setItem(chave, texto);
  } catch {
    // sem localStorage: segue sem rascunho
  }
}

export function apagarRascunho(chave: string): void {
  try {
    localStorage.removeItem(chave);
  } catch {
    // idem
  }
}
