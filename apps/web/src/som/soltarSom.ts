import { ehArquivoDeSom } from "@tabletop/shared";

// FG2: o que acontece com o som que se solta na mesa. Um arquivo mp3, ogg ou wav solto em qualquer lugar da mesa pelo
// mestre entra nos assets e na biblioteca de música (com o nome do arquivo e sem etiquetas); o jogador que solta recebe o
// aviso de que só o mestre põe música. Vários arquivos de uma vez entram todos (até `MAXIMO_POR_SOLTAR`).

export const MAXIMO_POR_SOLTAR = 50;

export type DecisaoDoSomSolto =
  /** O mestre soltou: estes arquivos entram na biblioteca; `sobraram` passaram do máximo de uma vez. */
  | { acao: "biblioteca"; sons: File[]; sobraram: number }
  /** Um jogador soltou som: nada entra, e ele recebe o aviso. */
  | { acao: "recusar"; sons: File[]; sobraram: 0 }
  /** Não havia som entre os arquivos: o soltar segue o caminho das imagens. */
  | { acao: "nenhuma"; sons: File[]; sobraram: 0 };

/** Separa os sons dos arquivos soltos e decide o que fazer com eles. */
export function decidirSomSolto(
  papel: "mestre" | "jogador" | "espectador",
  arquivos: readonly File[],
): DecisaoDoSomSolto {
  const sons = arquivos.filter((a) => ehArquivoDeSom(a.name));
  if (sons.length === 0) return { acao: "nenhuma", sons, sobraram: 0 };
  if (papel !== "mestre") return { acao: "recusar", sons, sobraram: 0 };
  return {
    acao: "biblioteca",
    sons: sons.slice(0, MAXIMO_POR_SOLTAR),
    sobraram: Math.max(0, sons.length - MAXIMO_POR_SOLTAR),
  };
}

/** Os arquivos que não são som (as imagens e o resto seguem o caminho de sempre). */
export const semOsSons = (arquivos: readonly File[]): File[] =>
  arquivos.filter((a) => !ehArquivoDeSom(a.name));

/** O nome da faixa: o do arquivo, sem a extensão. */
export const nomeDaFaixa = (nome: string): string =>
  (nome.replace(/\.[^.]+$/, "").trim() || "Música").slice(0, 120);

export const AVISO_SO_O_MESTRE_PONHA_MUSICA = "Só o mestre põe música na mesa.";

/** O aviso depois de soltar: quantas entraram e quantas não. */
export function textoDoAvisoDaBiblioteca(entraram: number, falhas: number, sobraram = 0): string {
  const partes: string[] = [];
  if (entraram > 0) {
    partes.push(
      entraram === 1
        ? "Adicionada à biblioteca de música."
        : `${entraram} músicas adicionadas à biblioteca de música.`,
    );
  }
  if (falhas > 0) {
    partes.push(
      `${falhas} ${falhas === 1 ? "não entrou" : "não entraram"} (formato, tamanho de até 20 MB ou arquivo que o navegador não abre).`,
    );
  }
  if (sobraram > 0) {
    partes.push(`Só as ${MAXIMO_POR_SOLTAR} primeiras entraram; solte o resto de novo.`);
  }
  return partes.join(" ");
}
