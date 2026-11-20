import { LIMITES_DA_GRAVACAO, TAXA_DA_GRAVACAO } from "@tabletop/shared";
import { LIMIAR_DE_FALA_DESLIGA, LIMIAR_DE_FALA_LIGA } from "../puras";

// CH3: o detector de fala por energia que corta **só os trechos com fala** de uma voz. Usa os mesmos limiares do anel verde
// de "quem fala" (`LIMIAR_DE_FALA_LIGA` e `LIMIAR_DE_FALA_DESLIGA`, o nível RMS de 0 a 1), em quadros de 20 ms. Cada
// trecho leva 300 ms de folga antes e depois da fala, tem no mínimo 0,5 s de fala e no máximo 30 s (o corte é forçado).
// Puro: recebe amostras de 16 kHz e entrega os trechos; quem grava no disco é o gravador.

export type Trecho = {
  /** O início do trecho em ms desde o começo da gravação (o nome do arquivo). */
  inicioMs: number;
  amostras: Float32Array;
};

export type OpcoesDoDetector = {
  taxa: number;
  quadroMs: number;
  limiarLiga: number;
  limiarDesliga: number;
  folgaMs: number;
  falaMinimaMs: number;
  trechoMaximoMs: number;
  /** Quanto silêncio seguido encerra o trecho (a folga de antes e de depois não se sobrepõem). */
  fimDeFalaMs: number;
};

export const OPCOES_PADRAO_DO_DETECTOR: OpcoesDoDetector = {
  taxa: TAXA_DA_GRAVACAO,
  quadroMs: 20,
  limiarLiga: LIMIAR_DE_FALA_LIGA,
  limiarDesliga: LIMIAR_DE_FALA_DESLIGA,
  folgaMs: LIMITES_DA_GRAVACAO.folgaMs,
  falaMinimaMs: LIMITES_DA_GRAVACAO.falaMinimaMs,
  trechoMaximoMs: LIMITES_DA_GRAVACAO.trechoMaximoMs,
  fimDeFalaMs: LIMITES_DA_GRAVACAO.folgaMs * 2 + 100,
};

/** O nível RMS (0 a 1) de um quadro de amostras de ponto flutuante. */
export function rmsDoQuadro(q: Float32Array): number {
  if (q.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < q.length; i++) {
    const x = q[i] ?? 0;
    soma += x * x;
  }
  return Math.sqrt(soma / q.length);
}

type TrechoAberto = {
  primeiro: number;
  quadros: Float32Array[];
  primeiraFala: number;
  ultimaFala: number;
  ultimoIndice: number;
};

export class DetectorDeFala {
  private readonly o: OpcoesDoDetector;
  private readonly tamanhoDoQuadro: number;
  private readonly quadrosDeFolga: number;
  private readonly quadrosDeFim: number;
  private readonly quadrosMaximos: number;
  private readonly quadrosDeFalaMinima: number;
  /** Amostras que sobraram do último bloco (menos que um quadro). */
  private resto: Float32Array = new Float32Array(0);
  private proximoQuadro = 0;
  /** Os últimos quadros em silêncio (a folga de antes do próximo trecho). */
  private anteriores: { indice: number; q: Float32Array }[] = [];
  private atual: TrechoAberto | null = null;

  constructor(
    private readonly aoTrecho: (t: Trecho) => void,
    opcoes: Partial<OpcoesDoDetector> = {},
    /** O instante (ms desde o começo da gravação) da primeira amostra que for entregue. */
    private readonly origemMs = 0,
  ) {
    this.o = { ...OPCOES_PADRAO_DO_DETECTOR, ...opcoes };
    this.tamanhoDoQuadro = Math.round((this.o.taxa * this.o.quadroMs) / 1000);
    this.quadrosDeFolga = Math.round(this.o.folgaMs / this.o.quadroMs);
    this.quadrosDeFim = Math.round(this.o.fimDeFalaMs / this.o.quadroMs);
    this.quadrosMaximos = Math.round(this.o.trechoMaximoMs / this.o.quadroMs);
    this.quadrosDeFalaMinima = Math.max(1, Math.round(this.o.falaMinimaMs / this.o.quadroMs));
  }

  /** Entrega amostras de 16 kHz (de qualquer tamanho); os trechos prontos saem por `aoTrecho`. */
  alimentar(amostras: Float32Array): void {
    let dados = amostras;
    if (this.resto.length > 0) {
      dados = new Float32Array(this.resto.length + amostras.length);
      dados.set(this.resto, 0);
      dados.set(amostras, this.resto.length);
    }
    let pos = 0;
    while (pos + this.tamanhoDoQuadro <= dados.length) {
      this.quadro(dados.slice(pos, pos + this.tamanhoDoQuadro));
      pos += this.tamanhoDoQuadro;
    }
    this.resto = dados.slice(pos);
  }

  /** O fim da gravação: fecha o trecho que estava aberto (se tiver fala suficiente). */
  encerrar(): void {
    if (this.atual) this.fechar();
    this.anteriores = [];
    this.resto = new Float32Array(0);
  }

  /** Descarta o que estava em curso sem entregar (a pessoa ficou de fora da gravação). */
  descartar(): void {
    this.atual = null;
    this.anteriores = [];
    this.resto = new Float32Array(0);
  }

  private quadro(q: Float32Array): void {
    const indice = this.proximoQuadro++;
    const rms = rmsDoQuadro(q);
    const atual = this.atual;
    if (!atual) {
      if (rms >= this.o.limiarLiga) {
        const folga = this.anteriores.slice(-this.quadrosDeFolga);
        this.atual = {
          primeiro: folga[0]?.indice ?? indice,
          quadros: [...folga.map((x) => x.q), q],
          primeiraFala: indice,
          ultimaFala: indice,
          ultimoIndice: indice,
        };
        this.anteriores = [];
      } else {
        this.anteriores.push({ indice, q });
        if (this.anteriores.length > this.quadrosDeFolga) this.anteriores.shift();
      }
      return;
    }
    atual.quadros.push(q);
    atual.ultimoIndice = indice;
    if (rms >= this.o.limiarDesliga) atual.ultimaFala = indice;
    const emSilencio = indice - atual.ultimaFala;
    if (emSilencio >= this.quadrosDeFim || atual.quadros.length >= this.quadrosMaximos) {
      this.fechar();
    }
  }

  private fechar(): void {
    const t = this.atual;
    this.atual = null;
    this.anteriores = [];
    if (!t) return;
    const falaQuadros = t.ultimaFala - t.primeiraFala + 1;
    if (falaQuadros < this.quadrosDeFalaMinima) return;
    // Depois da última fala só fica a folga: o resto do silêncio que encerrou o trecho é cortado.
    const ultimoQuadroQueFica = Math.min(t.ultimoIndice, t.ultimaFala + this.quadrosDeFolga);
    const quantos = ultimoQuadroQueFica - t.primeiro + 1;
    const quadros = t.quadros.slice(0, quantos);
    const amostras = new Float32Array(quadros.length * this.tamanhoDoQuadro);
    quadros.forEach((q, i) => {
      amostras.set(q, i * this.tamanhoDoQuadro);
    });
    this.aoTrecho({
      inicioMs: Math.round(this.origemMs + t.primeiro * this.o.quadroMs),
      amostras,
    });
  }
}
