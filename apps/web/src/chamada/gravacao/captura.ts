import { TAXA_DA_GRAVACAO } from "@tabletop/shared";

// CH3: a captura da voz de cada pessoa em amostras de 16 kHz, mono, para o detector de fala. Um AudioContext só (a 16 kHz, o
// navegador reamostra o fluxo de entrada), e para cada pessoa uma fonte -> AudioWorklet que entrega blocos de 100 ms. O
// worklet é um texto (carregado por um Blob local: nada vem da internet). A saída vai a um ganho zero: o gravador só escuta,
// nunca toca nada.

const BLOCO_DO_WORKLET = 1600; // 100 ms a 16 kHz

const CODIGO_DO_WORKLET = `
class CapturaDaGravacao extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bloco = new Float32Array(${BLOCO_DO_WORKLET});
    this.n = 0;
  }
  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (!canal) return true;
    for (let i = 0; i < canal.length; i++) {
      this.bloco[this.n++] = canal[i];
      if (this.n === this.bloco.length) {
        this.port.postMessage(this.bloco.slice(0));
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("captura-da-gravacao", CapturaDaGravacao);
`;

/** O que o gravador precisa da captura (os testes trocam por uma de mentira). */
export interface Captura {
  /** Passa a escutar o fluxo de `id`; `aoBloco` recebe amostras de 16 kHz. */
  adicionar(id: string, fluxo: MediaStream, aoBloco: (amostras: Float32Array) => void): void;
  remover(id: string): void;
  fechar(): void;
}

/**
 * Reamostra para 16 kHz tirando a média de cada janela da taxa original (serve de reserva se o navegador não deixar o
 * contexto a 16 kHz). Guarda o que sobrou entre um bloco e o seguinte.
 */
export class Reamostrador {
  private soma = 0;
  private n = 0;
  private fase = 0;
  private readonly razao: number;
  constructor(taxaDeOrigem: number, taxaDeDestino: number = TAXA_DA_GRAVACAO) {
    this.razao = taxaDeOrigem / taxaDeDestino;
  }

  processar(entrada: Float32Array): Float32Array {
    if (this.razao === 1) return entrada;
    const saida: number[] = [];
    for (let i = 0; i < entrada.length; i++) {
      this.soma += entrada[i] ?? 0;
      this.n++;
      this.fase += 1;
      if (this.fase >= this.razao) {
        saida.push(this.soma / this.n);
        this.soma = 0;
        this.n = 0;
        this.fase -= this.razao;
      }
    }
    return Float32Array.from(saida);
  }
}

type DaPessoa = {
  fonte: MediaStreamAudioSourceNode;
  no: AudioWorkletNode;
  mudo: GainNode;
};

export class CapturaDeVoz implements Captura {
  private ctx: AudioContext | null = null;
  private pronto: Promise<boolean> | null = null;
  private readonly pessoas = new Map<string, DaPessoa>();
  private fechada = false;

  /** Cria o contexto (a 16 kHz) e carrega o worklet. `false` se o navegador não dá (a gravação não começa). */
  iniciar(): Promise<boolean> {
    this.pronto ??= (async () => {
      try {
        let ctx: AudioContext;
        try {
          ctx = new AudioContext({ sampleRate: TAXA_DA_GRAVACAO, latencyHint: "playback" });
        } catch {
          ctx = new AudioContext({ latencyHint: "playback" });
        }
        this.ctx = ctx;
        const url = URL.createObjectURL(
          new Blob([CODIGO_DO_WORKLET], { type: "application/javascript" }),
        );
        try {
          await ctx.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        await ctx.resume().catch(() => {});
        return true;
      } catch {
        return false;
      }
    })();
    return this.pronto;
  }

  adicionar(id: string, fluxo: MediaStream, aoBloco: (amostras: Float32Array) => void): void {
    const ctx = this.ctx;
    if (!ctx || this.fechada || fluxo.getAudioTracks().length === 0) return;
    this.remover(id);
    try {
      const fonte = ctx.createMediaStreamSource(fluxo);
      const no = new AudioWorkletNode(ctx, "captura-da-gravacao", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      const reamostrar = new Reamostrador(ctx.sampleRate);
      no.port.onmessage = (ev: MessageEvent<Float32Array>) =>
        aoBloco(reamostrar.processar(ev.data));
      const mudo = ctx.createGain();
      mudo.gain.value = 0;
      fonte.connect(no);
      no.connect(mudo);
      mudo.connect(ctx.destination);
      this.pessoas.set(id, { fonte, no, mudo });
    } catch {
      // sem captura desta pessoa: a gravação segue com as outras
    }
  }

  remover(id: string): void {
    const p = this.pessoas.get(id);
    if (!p) return;
    try {
      p.no.port.onmessage = null;
      p.fonte.disconnect();
      p.no.disconnect();
      p.mudo.disconnect();
    } catch {
      // já solto
    }
    this.pessoas.delete(id);
  }

  fechar(): void {
    this.fechada = true;
    for (const id of [...this.pessoas.keys()]) this.remover(id);
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
