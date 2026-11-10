/** Marca Távola: a mesa redonda vista de cima, com seis lugares e uma chama no centro. */
export function SimboloTavola({ tamanho = 24, traco }: { tamanho?: number; traco?: number }) {
  // Em tamanho pequeno o traço fica mais grosso, para não sumir.
  const espessura = traco ?? (tamanho <= 24 ? 1.7 : tamanho <= 48 ? 1.5 : 1.2);
  return (
    <svg
      className="simbolo-tavola"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--acento)"
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6.2" />
      <circle cx="12" cy="2.6" r="1.4" />
      <circle cx="20.1" cy="7.3" r="1.4" />
      <circle cx="20.1" cy="16.7" r="1.4" />
      <circle cx="12" cy="21.4" r="1.4" />
      <circle cx="3.9" cy="16.7" r="1.4" />
      <circle cx="3.9" cy="7.3" r="1.4" />
      <path d="M12 8.6c.5 1.7 2.3 2.3 2.3 4.6a2.3 2.3 0 0 1-4.6 0c0-1.3.8-1.8.8-2.7.8.5 1.3 1.3 1.3 2.2.5-.5.7-1.7.2-4.1z" />
    </svg>
  );
}

/** O símbolo e o nome "Távola" (Space Grotesk 700). */
export function Logo({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span className="logo" data-testid="logo" style={{ fontSize: Math.round(tamanho * 0.95) }}>
      <SimboloTavola tamanho={tamanho} />
      <span className="logo-nome">Távola</span>
    </span>
  );
}
