import type { ImportacaoDeMapa, MetaNova } from "@tabletop/shared";

/** Resultado do processamento: os arquivos já em WebP (e o manifesto, se o mapa foi fatiado). */
export type Resultado = {
  /** Hash que a cena ou o token vão usar: o do arquivo, ou o do manifesto do mapa fatiado. */
  principal: string;
  itens: { meta: MetaNova; bytes: Uint8Array }[];
  manifesto?: MetaNova;
};

/** Q3: o que o worker tirou de um Universal VTT: a imagem (como arquivo, na extensão certa) e a cena já convertida. */
export type UvttLido = {
  imagem: Blob;
  extensao: string;
  importacao: ImportacaoDeMapa;
  /** Quanto tempo o worker levou para ler e decodificar (para medir). */
  ms: number;
};

/** Os tipos de imagem que o processador sabe reduzir e converter para WebP (AS1: `imagem` é a solta na cena, até 2048 px). */
export type TipoProcessado = "mapa" | "token" | "retrato" | "imagem";

export type PedidoDoWorker =
  | { id: number; tipo: "hash"; arquivo: Blob }
  | { id: number; tipo: "miniatura"; arquivo: Blob; lado: number }
  | { id: number; tipo: "uvtt"; arquivo: Blob; nome: string; idDaCena: string }
  | {
      id: number;
      tipo: "processar";
      arquivo: Blob;
      tipoAsset: TipoProcessado;
      limite: number;
      nome: string;
    }
  | { id: number; tipo: "regravar"; arquivo: Blob; lado: number }
  | { id: number; tipo: "medir"; arquivo: Blob };

export type RespostaDoWorker =
  | { id: number; ok: true; tipo: "hash"; hash: string }
  | { id: number; ok: true; tipo: "miniatura"; imagem: Blob }
  | { id: number; ok: true; tipo: "uvtt"; lido: UvttLido }
  | { id: number; ok: true; tipo: "processar"; resultado: Resultado }
  | { id: number; ok: true; tipo: "regravar"; bytes: Uint8Array; largura: number; altura: number }
  | { id: number; ok: true; tipo: "medir"; largura: number; altura: number }
  | { id: number; ok: false; erro: string };

type SemId<T> = T extends unknown ? Omit<T, "id"> : never;

/** Ponte para o Web Worker que decodifica, redimensiona, converte para WebP e calcula hashes. */
export class Processador {
  private worker: Worker | null = null;
  private proximo = 1;
  private readonly esperando = new Map<number, (r: RespostaDoWorker) => void>();

  private chamar(pedido: SemId<PedidoDoWorker>): Promise<RespostaDoWorker> {
    if (!this.worker) {
      this.worker = new Worker(new URL("./processador.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent<RespostaDoWorker>) => {
        const retorno = this.esperando.get(e.data.id);
        this.esperando.delete(e.data.id);
        retorno?.(e.data);
      };
    }
    const id = this.proximo++;
    return new Promise((resolve) => {
      this.esperando.set(id, resolve);
      this.worker?.postMessage({ ...pedido, id });
    });
  }

  async hashDoArquivo(arquivo: Blob): Promise<string> {
    const r = await this.chamar({ tipo: "hash", arquivo });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "hash") throw new Error("resposta inesperada");
    return r.hash;
  }

  async processar(
    arquivo: Blob,
    tipoAsset: TipoProcessado,
    limite: number,
    nome: string,
  ): Promise<Resultado> {
    const r = await this.chamar({ tipo: "processar", arquivo, tipoAsset, limite, nome });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "processar") throw new Error("resposta inesperada");
    return r.resultado;
  }

  /**
   * AS1: decodifica uma imagem que veio de outra pessoa e a grava de novo como WebP gerado aqui (no máximo `lado` px). Nada
   * escondido dentro do arquivo original (metadados, bytes depois do fim, script) sobrevive. Lança se não decodifica.
   */
  async regravar(
    arquivo: Blob,
    lado: number,
  ): Promise<{ bytes: Uint8Array; largura: number; altura: number }> {
    const r = await this.chamar({ tipo: "regravar", arquivo, lado });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "regravar") throw new Error("resposta inesperada");
    return { bytes: r.bytes, largura: r.largura, altura: r.altura };
  }

  /** AS1: as dimensões de uma imagem (até de uma animação), sem processá-la. */
  async medir(arquivo: Blob): Promise<{ largura: number; altura: number }> {
    const r = await this.chamar({ tipo: "medir", arquivo });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "medir") throw new Error("resposta inesperada");
    return { largura: r.largura, altura: r.altura };
  }

  /** Lê o Universal VTT fora da thread da página (o JSON e o base64 têm dezenas de MB). Lança com o motivo se não serve. */
  async lerUniversalVtt(arquivo: Blob, nome: string, idDaCena: string): Promise<UvttLido> {
    const r = await this.chamar({ tipo: "uvtt", arquivo, nome, idDaCena });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "uvtt") throw new Error("resposta inesperada");
    return r.lido;
  }

  async miniatura(arquivo: Blob, lado = 96): Promise<Blob> {
    const r = await this.chamar({ tipo: "miniatura", arquivo, lado });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "miniatura") throw new Error("resposta inesperada");
    return r.imagem;
  }
}

let maximoDaTextura: number | null = null;

/** `MAX_TEXTURE_SIZE` da GPU (quando não dá para saber, 4096). */
export function maxTextureSize(): number {
  if (maximoDaTextura !== null) return maximoDaTextura;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    maximoDaTextura = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 4096;
  } catch {
    maximoDaTextura = 4096;
  }
  return maximoDaTextura;
}
