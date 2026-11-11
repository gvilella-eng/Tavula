// Texto legível sobre uma cor qualquer (R6a): a cor de um usuário ou de um token é escolha de quem a deu, não do
// tema, então o texto das iniciais sobre ela não pode ser sempre branco (o amarelo do mestre fica ilegível).
// Escolhe entre branco e preto pelo maior contraste (WCAG); o pior caso entre os dois passa de 4,5:1 (AA).

export const TEXTO_CLARO = "#FFFFFF";
export const TEXTO_ESCURO = "#000000";

function canais(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] as string;
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminância relativa (WCAG 2) de uma cor `#rgb` ou `#rrggbb`; cor inválida conta como cinza médio. */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex) ?? [128, 128, 128];
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razão de contraste (WCAG 2) entre duas cores, de 1 a 21. */
export function contrasteEntre(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
}

/** A cor do texto (branco ou preto) com mais contraste sobre `fundo`. */
export function corDoTextoSobre(fundo: string): string {
  return contrasteEntre(TEXTO_CLARO, fundo) >= contrasteEntre(TEXTO_ESCURO, fundo)
    ? TEXTO_CLARO
    : TEXTO_ESCURO;
}

/** Quando o texto é preto, o halo em volta é branco, e o contrário (para o texto desenhado no mapa). */
export function haloDoTexto(texto: string): string {
  return texto === TEXTO_ESCURO ? TEXTO_CLARO : TEXTO_ESCURO;
}
