import type { MetaNova } from "@tabletop/shared";

/** Resultado do processamento: os arquivos já em WebP (e o manifesto, se o mapa foi fatiado). */
export type Resultado = {
  /** Hash que a cena ou o token vão usar: o do arquivo, ou o do manifesto do mapa fatiado. */
  principal: string;
  itens: { meta: MetaNova; bytes: Uint8Array }[];
  manifesto?: MetaNova;
};

export type PedidoDoWorker =
  | { id: number; tipo: "hash"; arquivo: Blob }
  | { id: number; tipo: "miniatura"; arquivo: Blob; lado: number }
  | {
      id: number;
      tipo: "processar";
      arquivo: Blob;
      tipoAsset: "mapa" | "token" | "retrato";
      limite: number;
      nome: string;
    };

export type RespostaDoWorker =
  | { id: number; ok: true; tipo: "hash"; hash: string }
  | { id: number; ok: true; tipo: "miniatura"; imagem: Blob }
  | { id: number; ok: true; tipo: "processar"; resultado: Resultado }
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
    tipoAsset: "mapa" | "token" | "retrato",
    limite: number,
    nome: string,
  ): Promise<Resultado> {
    const r = await this.chamar({ tipo: "processar", arquivo, tipoAsset, limite, nome });
    if (!r.ok) throw new Error(r.erro);
    if (r.tipo !== "processar") throw new Error("resposta inesperada");
    return r.resultado;
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
