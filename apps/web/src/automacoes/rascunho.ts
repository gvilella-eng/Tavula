// Ajudas pequenas do editor das automações.

/** Um id curto a partir do nome ("Respiração da Montanha" vira "respiracao-da-montanha"), sem repetir os usados. */
export function idDoNome(nome: string, usados: ReadonlySet<string>, padrao: string): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || padrao;
  if (!usados.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Os segundos como "3 min 20 s" para a contagem das fases (o chip e a lista). */
export function duracaoCurta(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}
