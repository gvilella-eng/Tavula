import { nivelDasAmostras } from "./puras";

// CH1: o áudio da chamada no WebAudio. Cada pessoa que chega vira uma fonte -> ganho (volume 0 a 200% só para mim) ->
// saída; cada fluxo (o meu microfone e os recebidos) tem também um analisador, para o anel de quem fala. Os sons de
// entrar e sair são gerados aqui (sem arquivo). A saída de som vem do `setSinkId` do contexto, onde o navegador tem.

type ContextoComSaida = AudioContext & { setSinkId?: (id: string) => Promise<void> };

type DaPessoa = {
  fonte: MediaStreamAudioSourceNode;
  ganho: GainNode;
  analisador: AnalyserNode;
  /** Um <audio> mudo preso ao mesmo fluxo: o Chrome só entrega o som de um fluxo remoto ao WebAudio se ele toca em algum lugar. */
  elemento: HTMLAudioElement;
  fluxo: MediaStream;
};

export class AudioDaChamada {
  readonly ctx: AudioContext;
  private readonly pessoas = new Map<string, DaPessoa>();
  private local: { fonte: MediaStreamAudioSourceNode; analisador: AnalyserNode } | null = null;
  private readonly amostras = new Uint8Array(512);
  /** O ganho que vale agora para cada pessoa (lembrado, para aplicar quando a pessoa chega depois). */
  private readonly ganhos = new Map<string, number>();

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    void this.ctx.resume().catch(() => {});
  }

  /** O navegador deixa escolher a saída de som? (Chrome e Edge sim; onde não, a opção some.) */
  get suportaSaida(): boolean {
    return typeof (this.ctx as ContextoComSaida).setSinkId === "function";
  }

  async definirSaida(id: string): Promise<boolean> {
    const ctx = this.ctx as ContextoComSaida;
    if (!ctx.setSinkId) return false;
    try {
      await ctx.setSinkId(id);
      return true;
    } catch {
      return false;
    }
  }

  /** Põe (ou troca) o áudio recebido de uma pessoa. */
  adicionarPessoa(id: string, fluxo: MediaStream, ganhoInicial: number): void {
    const antes = this.pessoas.get(id);
    if (antes?.fluxo === fluxo) return;
    this.removerPessoa(id);
    if (fluxo.getAudioTracks().length === 0) return;
    try {
      const fonte = this.ctx.createMediaStreamSource(fluxo);
      const ganho = this.ctx.createGain();
      const analisador = this.ctx.createAnalyser();
      analisador.fftSize = 512;
      const g = this.ganhos.get(id) ?? ganhoInicial;
      ganho.gain.value = g;
      fonte.connect(analisador);
      fonte.connect(ganho);
      ganho.connect(this.ctx.destination);
      const elemento = document.createElement("audio");
      elemento.muted = true;
      elemento.autoplay = true;
      elemento.srcObject = fluxo;
      void elemento.play().catch(() => {});
      this.pessoas.set(id, { fonte, ganho, analisador, elemento, fluxo });
      this.ganhos.set(id, g);
    } catch {
      // sem áudio utilizável desta pessoa: a chamada segue sem ele
    }
  }

  removerPessoa(id: string): void {
    const p = this.pessoas.get(id);
    if (!p) return;
    try {
      p.fonte.disconnect();
      p.ganho.disconnect();
      p.analisador.disconnect();
    } catch {
      // já solto
    }
    p.elemento.srcObject = null;
    this.pessoas.delete(id);
  }

  /** O ganho (0 a 2) de uma pessoa. Vale também para quem ainda não chegou. */
  ajustar(id: string, ganho: number): void {
    this.ganhos.set(id, ganho);
    const p = this.pessoas.get(id);
    if (p) p.ganho.gain.setTargetAtTime(ganho, this.ctx.currentTime, 0.015);
  }

  /** O nível (0 a 1) do que chega desta pessoa, antes do volume dela (quem fala é quem fala, não o quanto eu a ouço). */
  nivelDe(id: string): number {
    const p = this.pessoas.get(id);
    if (!p) return 0;
    p.analisador.getByteTimeDomainData(this.amostras);
    return nivelDasAmostras(this.amostras);
  }

  /** O fluxo do meu microfone, só para medir (nunca vai à saída). */
  definirLocal(fluxo: MediaStream | null): void {
    if (this.local) {
      try {
        this.local.fonte.disconnect();
        this.local.analisador.disconnect();
      } catch {
        // já solto
      }
      this.local = null;
    }
    if (!fluxo || fluxo.getAudioTracks().length === 0) return;
    try {
      const fonte = this.ctx.createMediaStreamSource(fluxo);
      const analisador = this.ctx.createAnalyser();
      analisador.fftSize = 512;
      fonte.connect(analisador);
      this.local = { fonte, analisador };
    } catch {
      // sem medidor
    }
  }

  nivelLocal(): number {
    if (!this.local) return 0;
    this.local.analisador.getByteTimeDomainData(this.amostras);
    return nivelDasAmostras(this.amostras);
  }

  /** Dois toques curtos: sobe quando alguém entra, desce quando sai. */
  bipe(tipo: "entrou" | "saiu"): void {
    try {
      const t0 = this.ctx.currentTime;
      const notas = tipo === "entrou" ? [660, 880] : [660, 440];
      notas.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const ini = t0 + i * 0.11;
        g.gain.setValueAtTime(0.0001, ini);
        g.gain.exponentialRampToValueAtTime(0.12, ini + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.1);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(ini);
        osc.stop(ini + 0.12);
      });
    } catch {
      // sem som: não atrapalha
    }
  }

  fechar(): void {
    for (const id of [...this.pessoas.keys()]) this.removerPessoa(id);
    this.definirLocal(null);
    void this.ctx.close().catch(() => {});
  }
}
