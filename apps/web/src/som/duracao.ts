/**
 * MU1: a duração de um arquivo de som, lida aqui no navegador do mestre (a sala não decodifica áudio). Devolve ms; falha se o
 * navegador não consegue ler o arquivo (formato quebrado) ou demora demais.
 */
export function lerDuracaoMs(arquivo: Blob, esperaMs = 15_000): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const el = new Audio();
    el.preload = "metadata";
    let pronto = false;
    const fim = (erro?: Error, valor?: number) => {
      if (pronto) return;
      pronto = true;
      clearTimeout(limite);
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
      if (erro) rejeitar(erro);
      else resolver(valor ?? 0);
    };
    const limite = setTimeout(() => fim(new Error("Não consegui ler a duração.")), esperaMs);
    el.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(el.duration) && el.duration > 0)
        fim(undefined, Math.round(el.duration * 1000));
      else fim(new Error("Não consegui ler a duração."));
    });
    el.addEventListener("error", () => fim(new Error("O navegador não abriu este arquivo.")));
    el.src = url;
  });
}
