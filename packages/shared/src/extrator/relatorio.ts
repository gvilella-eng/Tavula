import type { ResultadoDoLivro } from "./livros.ts";

// ---------------------------------------------------------------------------------------------
// O relatório da extração (N3b): por livro, quantas entradas foram lidas e quantas passaram no zod, as que falharam
// (com o motivo), os campos que mais ficaram vazios e uma amostra de nomes. Só contagens e nomes: nada do texto dos
// livros além dos nomes das entradas.
// ---------------------------------------------------------------------------------------------

export type LivroDoRelatorio = {
  titulo: string;
  arquivo: string;
  /** Nome do arquivo gerado, ou null se o livro faltou. */
  saida: string | null;
  resultado: ResultadoDoLivro<{ nome: string }> | null;
  /** Aviso quando o livro não estava na pasta ou não tinha texto. */
  aviso?: string;
};

/** Gerador pseudo-aleatório simples e repetível (a amostra do relatório não muda a cada rodada). */
function sorteador(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function amostraDeNomes(nomes: readonly string[], quantos: number, semente = 7): string[] {
  const restantes = [...nomes];
  const sorteio = sorteador(semente);
  const saida: string[] = [];
  while (saida.length < quantos && restantes.length > 0) {
    const i = Math.floor(sorteio() * restantes.length);
    const [nome] = restantes.splice(i, 1);
    if (nome) saida.push(nome);
  }
  return saida;
}

const pct = (n: number, total: number): string =>
  total === 0 ? "0%" : `${((n / total) * 100).toFixed(1).replace(".", ",")}%`;

export function montarRelatorio(livros: readonly LivroDoRelatorio[], data: string): string {
  const linhas: string[] = [
    "# Relatório da extração do compêndio",
    "",
    `Gerado em ${data}. Só contagens e nomes: o texto dos livros fica nos arquivos JSON desta pasta, e esta pasta fica só no seu computador.`,
    "",
  ];
  for (const l of livros) {
    linhas.push(`## ${l.titulo}`, "", `Arquivo de origem: \`${l.arquivo}\``);
    if (!l.resultado) {
      linhas.push("", `**Não extraído.** ${l.aviso ?? "O livro não estava na pasta."}`, "");
      continue;
    }
    const r = l.resultado;
    linhas.push(
      `Arquivo gerado: \`${l.saida ?? "(nenhum)"}\``,
      "",
      `- Entradas lidas: ${r.lidas}`,
      `- Passaram na validação: ${r.validas.length} (${pct(r.validas.length, r.lidas)})`,
      `- Falharam: ${r.falhas.length}`,
      `- Completas (${r.criterio}): ${r.completas} de ${r.validas.length} válidas (${pct(r.completas, r.validas.length)}); sobre as lidas, ${pct(r.completas, r.lidas)}`,
      "",
    );
    if (r.falhas.length > 0) {
      linhas.push("### Entradas que falharam", "");
      for (const f of r.falhas.slice(0, 60))
        linhas.push(`- ${f.nome} (p. ${f.pagina}): ${f.motivo}`);
      if (r.falhas.length > 60) linhas.push(`- ... e mais ${r.falhas.length - 60}`);
      linhas.push("");
    }
    const vazios = Object.entries(r.vazios).sort((a, b) => b[1] - a[1]);
    linhas.push("### Campos que mais ficaram vazios", "");
    if (vazios.length === 0) linhas.push("Nenhum.");
    else
      for (const [campo, n] of vazios)
        linhas.push(`- ${campo}: ${n} de ${r.lidas} (${pct(n, r.lidas)})`);
    linhas.push("");
    if (r.avisos.length > 0) {
      linhas.push("### Observações", "");
      for (const a of r.avisos.slice(0, 40)) linhas.push(`- ${a}`);
      if (r.avisos.length > 40) linhas.push(`- ... e mais ${r.avisos.length - 40}`);
      linhas.push("");
    }
    const nomes = r.validas.map((v) => v.nome);
    linhas.push(
      "### Amostra de nomes",
      "",
      `Primeiros: ${nomes.slice(0, 5).join(", ")}`,
      "",
      `Sorteados: ${amostraDeNomes(nomes, 10).join(", ")}`,
      "",
    );
  }
  return `${linhas.join("\n")}\n`;
}
