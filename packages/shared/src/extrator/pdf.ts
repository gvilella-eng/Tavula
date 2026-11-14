/// <reference types="node" />
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PaginaDoPdf } from "./linhas.ts";

/**
 * Lê o texto com posição de um PDF no Node (pdf.js, o mesmo do importador de ficha impressa, pelo build legado). Só
 * lê o arquivo: nada é enviado a lugar nenhum. PDF escaneado (sem texto) volta com páginas vazias; quem chama avisa.
 */
export async function lerPdf(caminho: string): Promise<PaginaDoPdf[]> {
  const tarefa = getDocument({ data: new Uint8Array(readFileSync(caminho)), verbosity: 0 });
  const doc = await tarefa.promise;
  try {
    const paginas: PaginaDoPdf[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: 1 });
      const texto = await pagina.getTextContent();
      const items: PaginaDoPdf["items"] = [];
      for (const it of texto.items) {
        if (!("str" in it) || typeof it.str !== "string") continue;
        const t = it.transform as number[];
        const [a = 0, b = 0, , , x = 0, y = 0] = t;
        items.push({
          s: it.str,
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          fs: Math.round(Math.hypot(a, b) * 10) / 10,
          f: it.fontName,
        });
      }
      paginas.push({ w: vista.width, h: vista.height, items });
    }
    return paginas;
  } finally {
    await tarefa.destroy();
  }
}

/** Quantas letras há no PDF todo (zero = escaneado, sem texto: o extrator não faz OCR). */
export function letrasDoLivro(paginas: readonly PaginaDoPdf[]): number {
  let n = 0;
  for (const p of paginas) for (const it of p.items) n += it.s.replace(/[^\p{L}]/gu, "").length;
  return n;
}
