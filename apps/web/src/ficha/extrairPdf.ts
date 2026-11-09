import { type Pedaco, pedacosDoTextoDoPdf } from "@tabletop/shared";

/** Limites de bom senso: a ficha impressa tem umas 8 páginas e poucas centenas de KB. */
const MAXIMO_DE_BYTES = 25 * 1024 * 1024;
const MAXIMO_DE_PAGINAS = 40;

/**
 * Lê o texto com posição de um PDF, no navegador (o arquivo não sai do PC: nada é enviado). O pdf.js vem do
 * npm e o worker dele é empacotado pelo Vite (arquivo local, nada de CDN); o parser da ficha é puro e roda
 * depois, em `@tabletop/shared`.
 */
export async function extrairPedacosDoPdf(arquivo: File): Promise<Pedaco[]> {
  if (arquivo.size > MAXIMO_DE_BYTES) throw new Error("O PDF passa de 25 MB.");
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data: dados });
  const doc = await tarefa.promise;
  try {
    if (doc.numPages > MAXIMO_DE_PAGINAS) throw new Error("O PDF tem páginas demais.");
    const pedacos: Pedaco[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const texto = await pagina.getTextContent();
      pedacos.push(...pedacosDoTextoDoPdf(n, texto.items));
    }
    return pedacos;
  } finally {
    await tarefa.destroy();
  }
}
