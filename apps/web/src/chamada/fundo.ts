import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { mascaraEstaInvertida, RAIO_DO_DESFOQUE, VigiaDeFps } from "./puras";

// CH1: o fundo desfocado. A câmera passa pelo segmentador de pessoas do MediaPipe (modelo `selfie_segmenter`, empacotado
// em `modelos/`, e o wasm do pacote: nada é buscado da internet), o fundo é redesenhado com desfoque e a pessoa fica
// nítida por cima. O resultado sai de um canvas (`captureStream`) e substitui a faixa de vídeo enviada. Os outros recebem
// a imagem já desfocada. Roda no computador de quem desfoca.

export type ModoDeDesfoque = "desfocar" | "forte";

export const LARGURA_DO_QUADRO = 640;
export const ALTURA_DO_QUADRO = 360;
const FPS = 24;

/** O módulo do MediaPipe e os arquivos dele só são baixados quando alguém liga o desfoque. */
async function criarSegmentador(): Promise<ImageSegmenter> {
  const [{ ImageSegmenter }, loader, binario, modelo] = await Promise.all([
    import("@mediapipe/tasks-vision"),
    import("@mediapipe/tasks-vision/vision_wasm_internal.js?url"),
    import("@mediapipe/tasks-vision/vision_wasm_internal.wasm?url"),
    import("./modelos/selfie_segmenter.tflite?url"),
  ]);
  const wasm = { wasmLoaderPath: loader.default, wasmBinaryPath: binario.default };
  const opcoes = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: modelo.default, delegate },
    runningMode: "VIDEO" as const,
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  try {
    return await ImageSegmenter.createFromOptions(wasm, opcoes("GPU"));
  } catch {
    return await ImageSegmenter.createFromOptions(wasm, opcoes("CPU"));
  }
}

/** Só nos testes e2e: o computador do teste (vários navegadores, sem placa de vídeo) não precisa dar 12 quadros por segundo. */
function semVigiaNoTeste(): boolean {
  return (
    import.meta.env.MODE === "e2e" &&
    (window as unknown as { __tabletopE2E?: { semVigiaDoDesfoque?: boolean } }).__tabletopE2E
      ?.semVigiaDoDesfoque === true
  );
}

function novoCanvas(l: number, a: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  return c;
}

export class FundoDesfocado {
  private segmentador: ImageSegmenter | null = null;
  private readonly video = document.createElement("video");
  private readonly saida = novoCanvas(LARGURA_DO_QUADRO, ALTURA_DO_QUADRO);
  private readonly pessoa = novoCanvas(LARGURA_DO_QUADRO, ALTURA_DO_QUADRO);
  private readonly mascara = novoCanvas(256, 256);
  private readonly ctx = this.saida.getContext("2d", { alpha: false });
  private readonly ctxPessoa = this.pessoa.getContext("2d");
  private readonly ctxMascara = this.mascara.getContext("2d");
  private readonly pequeno = novoCanvas(LARGURA_DO_QUADRO / 8, ALTURA_DO_QUADRO / 8);
  private readonly medio = novoCanvas(
    Math.round(LARGURA_DO_QUADRO / 3),
    Math.round(ALTURA_DO_QUADRO / 3),
  );
  private readonly vigia = new VigiaDeFps();
  private readonly temFiltro =
    typeof CanvasRenderingContext2D !== "undefined" &&
    "filter" in CanvasRenderingContext2D.prototype;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private ativo = false;
  private invertida = false;
  private quadros = 0;
  private ultimoTempoDoVideo = -1;
  private ultimoTimestamp = 0;
  private imagemDaMascara: ImageData | null = null;
  faixa: MediaStreamTrack | null = null;

  constructor(
    private readonly entrada: MediaStreamTrack,
    private modo: ModoDeDesfoque,
    /** O desfoque desistiu (devagar demais, ou a câmera acabou): quem usa volta para a imagem sem efeito. */
    private readonly aoDesistir: (motivo: "lento" | "erro") => void,
  ) {
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([entrada]);
  }

  definirModo(modo: ModoDeDesfoque): void {
    this.modo = modo;
  }

  /** Carrega o modelo e começa. Devolve a faixa do canvas (rejeita se o modelo não carregar). */
  async iniciar(): Promise<MediaStreamTrack> {
    this.segmentador = await criarSegmentador();
    await this.video.play();
    const fluxo = this.saida.captureStream(FPS);
    const faixa = fluxo.getVideoTracks()[0];
    if (!faixa) throw new Error("O canvas não deu uma faixa de vídeo.");
    this.faixa = faixa;
    this.ativo = true;
    this.entrada.addEventListener("ended", this.aoAcabarAEntrada);
    this.agendar();
    return faixa;
  }

  private readonly aoAcabarAEntrada = () => {
    if (this.ativo) this.desistir("erro");
  };

  private agendar(): void {
    if (!this.ativo) return;
    this.temporizador = setTimeout(() => this.passo(), 1000 / FPS);
  }

  private passo(): void {
    if (!this.ativo) return;
    try {
      this.processarUmQuadro();
    } catch {
      this.desistir("erro");
      return;
    }
    this.agendar();
  }

  private desistir(motivo: "lento" | "erro"): void {
    if (!this.ativo) return;
    this.parar();
    this.aoDesistir(motivo);
  }

  private processarUmQuadro(): void {
    const { video, ctx, ctxPessoa, ctxMascara, segmentador } = this;
    if (!ctx || !ctxPessoa || !ctxMascara || !segmentador) return;
    if (video.readyState < 2 || video.currentTime === this.ultimoTempoDoVideo) return;
    this.ultimoTempoDoVideo = video.currentTime;
    const agora = performance.now();
    // O segmentador pede tempos crescentes.
    const t = Math.max(agora, this.ultimoTimestamp + 1);
    this.ultimoTimestamp = t;
    segmentador.segmentForVideo(video, t, (resultado) => {
      const m = resultado.confidenceMasks?.[0];
      if (!m) return;
      const dados = m.getAsFloat32Array();
      if (this.quadros % 60 === 0) this.invertida = mascaraEstaInvertida(dados, m.width, m.height);
      this.compor(dados, m.width, m.height);
    });
    this.quadros++;
    if (!semVigiaNoTeste() && this.vigia.quadro(agora)) this.desistir("lento");
  }

  private compor(dados: Float32Array, l: number, a: number): void {
    const { ctx, ctxPessoa, ctxMascara } = this;
    if (!ctx || !ctxPessoa || !ctxMascara) return;
    if (this.mascara.width !== l || this.mascara.height !== a) {
      this.mascara.width = l;
      this.mascara.height = a;
      this.imagemDaMascara = null;
    }
    const img = this.imagemDaMascara ?? ctxMascara.createImageData(l, a);
    this.imagemDaMascara = img;
    const px = img.data;
    for (let i = 0; i < dados.length; i++) {
      const p = this.invertida ? 1 - (dados[i] ?? 0) : (dados[i] ?? 0);
      // Um contraste suave: abaixo de 0,35 é fundo, acima de 0,65 é pessoa.
      const a255 = Math.max(0, Math.min(1, (p - 0.35) / 0.3)) * 255;
      px[i * 4 + 3] = a255;
    }
    ctxMascara.putImageData(img, 0, 0);

    const W = LARGURA_DO_QUADRO;
    const H = ALTURA_DO_QUADRO;
    // A pessoa: o quadro inteiro recortado pela máscara.
    ctxPessoa.globalCompositeOperation = "source-over";
    ctxPessoa.clearRect(0, 0, W, H);
    ctxPessoa.drawImage(this.video, 0, 0, W, H);
    ctxPessoa.globalCompositeOperation = "destination-in";
    if (this.temFiltro) ctxPessoa.filter = "blur(1.5px)";
    ctxPessoa.drawImage(this.mascara, 0, 0, W, H);
    if (this.temFiltro) ctxPessoa.filter = "none";
    ctxPessoa.globalCompositeOperation = "source-over";

    // O fundo desfocado (um pouco maior, para a borda do desfoque não escurecer) e a pessoa por cima.
    const raio = RAIO_DO_DESFOQUE[this.modo];
    if (this.temFiltro) {
      ctx.filter = `blur(${raio}px)`;
      ctx.drawImage(this.video, -raio, -raio, W + raio * 2, H + raio * 2);
      ctx.filter = "none";
    } else {
      // Sem `filter` no canvas (Safari): encolhe e estica, que também borra.
      // CH3: o Leve encolhe só até 1/3 do quadro (ainda reconhecível); o Forte, até 1/8.
      const leve = this.modo === "desfocar";
      const alvo = leve ? this.medio : this.pequeno;
      alvo.getContext("2d")?.drawImage(this.video, 0, 0, alvo.width, alvo.height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(alvo, 0, 0, alvo.width, alvo.height, 0, 0, W, H);
    }
    ctx.drawImage(this.pessoa, 0, 0);
  }

  parar(): void {
    this.ativo = false;
    clearTimeout(this.temporizador);
    this.entrada.removeEventListener("ended", this.aoAcabarAEntrada);
    this.faixa?.stop();
    this.faixa = null;
    this.video.pause();
    this.video.srcObject = null;
    try {
      this.segmentador?.close();
    } catch {
      // já fechado
    }
    this.segmentador = null;
  }
}
