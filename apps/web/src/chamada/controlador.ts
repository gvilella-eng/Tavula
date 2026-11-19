import type { FundoDaChamada, ParticipanteDaChamada } from "@tabletop/shared";
import { AudioDaChamada } from "./audio";
import { FundoDesfocado } from "./fundo";
import { MalhaDaChamada, type SinalDaChamada } from "./malha";
import {
  AvaliadorDeFala,
  ganhoDaPessoa,
  gravarPreferenciaDePessoa,
  gravarPreferenciasDaChamada,
  iceServersDoTexto,
  lerPreferenciaDePessoa,
  lerPreferenciasDaChamada,
  limitarVolume,
  type PreferenciaDePessoa,
  type PreferenciasDaChamada,
} from "./puras";

// CH1: o controlador da janela da chamada. Dono de tudo o que não é desenho: a câmera e o microfone (e o fundo
// desfocado), o áudio (volumes, quem fala, sons), a malha de conexões e a conversa com a sala (entrar, estado, sinais).
// A tela só lê o `estado` (um objeto novo a cada mudança) e chama os métodos.

export type Aparelhos = {
  cameras: { id: string; nome: string }[];
  microfones: { id: string; nome: string }[];
  saidas: { id: string; nome: string }[];
};

export type Fase = "antes" | "dentro" | "substituida";

export type EstadoDoControle = {
  fase: Fase;
  /** Eu: o que escolhi (o que os outros veem de mim). */
  microfone: boolean;
  camera: boolean;
  fundo: FundoDaChamada;
  surdo: boolean;
  soOuvindo: boolean;
  /** O navegador deu o aparelho (ou ainda não pediu). */
  temMicrofone: boolean;
  temCamera: boolean;
  erroDeMidia: string | null;
  /** Por que o desfoque não está disponível agora (botão desabilitado com a dica), ou `null`. */
  fundoIndisponivel: string | null;
  fundoCarregando: boolean;
  aparelhos: Aparelhos;
  prefs: PreferenciasDaChamada;
  /** O que a janela mostra de mim (a câmera crua ou o canvas desfocado). */
  fluxoLocal: MediaStream | null;
  nivelMicrofone: number;
  /** Os outros: fluxo recebido e o estado da conexão. */
  fluxos: Record<string, MediaStream | null>;
  conexoes: Record<string, string>;
  falando: ReadonlySet<string>;
  pessoas: Record<string, PreferenciaDePessoa>;
  participantes: ParticipanteDaChamada[];
  entrouEmMs: number | null;
  /** Mensagem para a tela de "antes de entrar" (chamada cheia etc.). */
  aviso: string | null;
  suportaSaida: boolean;
};

type Envio = (tipo: string, dados: object) => string | null;

type Opcoes = {
  mesaId: string;
  meuId: string;
  enviar: Envio;
};

function pararFluxo(fluxo: MediaStream | null): void {
  if (!fluxo) return;
  for (const t of fluxo.getTracks()) t.stop();
}

const SEM_APARELHOS: Aparelhos = { cameras: [], microfones: [], saidas: [] };

const TEXTO_SEM_PERMISSAO =
  "O navegador não deu acesso à câmera ou ao microfone. Libere nas permissões deste endereço, ou entre só ouvindo.";

/** O JSON dos servidores STUN/TURN para a internet (opcional; vazio por padrão: nada é buscado fora). */
const ICE_DO_AMBIENTE = (import.meta.env as Record<string, string | undefined>)
  .VITE_CHAMADA_ICE_SERVERS;

export class ControleDaChamada {
  estado: EstadoDoControle;
  private readonly ouvintes = new Set<() => void>();
  private audio: AudioDaChamada | null = null;
  private malha: MalhaDaChamada | null = null;
  private fundoPipeline: FundoDesfocado | null = null;
  private streamMic: MediaStream | null = null;
  private faixaMic: MediaStreamTrack | null = null;
  private faixaCamera: MediaStreamTrack | null = null;
  private fluxoCamera: MediaStream | null = null;
  private fluxoExibido: MediaStream | null = null;
  private entrei = false;
  private confirmado = false;
  private encerrado = false;
  private relogio: ReturnType<typeof setInterval> | undefined;
  private readonly avaliadores = new Map<string, AvaliadorDeFala>();
  private participantesAnteriores: string[] | null = null;
  private pedidoDeCamera = 0;
  private readonly aoMudarDeAparelho = () => void this.atualizarAparelhos();

  constructor(private readonly o: Opcoes) {
    const prefs = lerPreferenciasDaChamada();
    this.estado = {
      fase: "antes",
      microfone: !prefs.entrarMudo,
      camera: true,
      fundo: prefs.fundo,
      surdo: false,
      soOuvindo: false,
      temMicrofone: false,
      temCamera: false,
      erroDeMidia: null,
      fundoIndisponivel: null,
      fundoCarregando: false,
      aparelhos: SEM_APARELHOS,
      prefs,
      fluxoLocal: null,
      nivelMicrofone: 0,
      fluxos: {},
      conexoes: {},
      falando: new Set(),
      pessoas: {},
      participantes: [],
      entrouEmMs: null,
      aviso: null,
      suportaSaida: false,
    };
  }

  // --- a tela assina ---------------------------------------------------------------------------------------------

  assinar = (fn: () => void): (() => void) => {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  };

  lerEstado = (): EstadoDoControle => this.estado;

  private mudar(parcial: Partial<EstadoDoControle>): void {
    if (this.encerrado) return;
    this.estado = { ...this.estado, ...parcial };
    for (const f of this.ouvintes) f();
  }

  // --- ciclo de vida ---------------------------------------------------------------------------------------------

  /** Abre a janela: pede a câmera e o microfone para a prévia e começa a medir o nível. */
  async iniciar(): Promise<void> {
    navigator.mediaDevices?.addEventListener?.("devicechange", this.aoMudarDeAparelho);
    this.relogio = setInterval(() => this.medir(), 100);
    await this.adquirirPrevia();
  }

  encerrar(): void {
    this.encerrado = true;
    clearInterval(this.relogio);
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.aoMudarDeAparelho);
    this.malha?.fechar();
    this.malha = null;
    this.fundoPipeline?.parar();
    this.fundoPipeline = null;
    this.pararMidia();
    this.audio?.fechar();
    this.audio = null;
    this.ouvintes.clear();
  }

  // --- mídia local -----------------------------------------------------------------------------------------------

  private async adquirirPrevia(): Promise<void> {
    const antes = this.estado;
    let erro: string | null = null;
    if (!(await this.pedirMicrofone())) erro = TEXTO_SEM_PERMISSAO;
    if (antes.camera) {
      if (!(await this.pedirCamera())) erro = TEXTO_SEM_PERMISSAO;
    }
    this.mudar({ erroDeMidia: erro });
    await this.atualizarAparelhos();
    this.mudar({ suportaSaida: this.garantirAudio().suportaSaida });
  }

  private async pedirMicrofone(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const { prefs } = this.estado;
    const ruido = prefs.reduzirRuido;
    const base = { echoCancellation: ruido, noiseSuppression: ruido, autoGainControl: ruido };
    try {
      let fluxo: MediaStream;
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          audio: prefs.microfoneId ? { ...base, deviceId: { ideal: prefs.microfoneId } } : base,
        });
      } catch (e) {
        if ((e as DOMException).name === "NotAllowedError") throw e;
        fluxo = await navigator.mediaDevices.getUserMedia({ audio: base });
      }
      pararFluxo(this.streamMic);
      this.streamMic = fluxo;
      this.faixaMic = fluxo.getAudioTracks()[0] ?? null;
      this.aplicarMudoDoMicrofone();
      this.garantirAudio().definirLocal(fluxo);
      this.malha?.definirLocais(this.faixaMic, this.faixaDeVideoParaEnviar());
      this.mudar({ temMicrofone: this.faixaMic !== null });
      return this.faixaMic !== null;
    } catch {
      this.mudar({ temMicrofone: false });
      return false;
    }
  }

  private async pedirCamera(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const pedido = ++this.pedidoDeCamera;
    const { prefs } = this.estado;
    const video = {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 30 },
    };
    try {
      let fluxo: MediaStream;
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: prefs.cameraId ? { ...video, deviceId: { ideal: prefs.cameraId } } : video,
        });
      } catch (e) {
        if ((e as DOMException).name === "NotAllowedError") throw e;
        fluxo = await navigator.mediaDevices.getUserMedia({ video });
      }
      if (pedido !== this.pedidoDeCamera || this.encerrado || !this.estado.camera) {
        pararFluxo(fluxo);
        return true;
      }
      this.pararCameraCrua();
      this.fluxoCamera = fluxo;
      this.faixaCamera = fluxo.getVideoTracks()[0] ?? null;
      this.faixaCamera?.addEventListener("ended", () => {
        if (this.faixaCamera && this.faixaCamera.readyState === "ended") void this.desligarCamera();
      });
      this.mudar({ temCamera: this.faixaCamera !== null });
      await this.aplicarFundo(this.estado.fundo, true);
      this.atualizarFluxoLocal();
      return this.faixaCamera !== null;
    } catch {
      this.mudar({ temCamera: false });
      return false;
    }
  }

  private pararCameraCrua(): void {
    pararFluxo(this.fluxoCamera);
    this.fluxoCamera = null;
    this.faixaCamera = null;
  }

  private pararMidia(): void {
    this.pedidoDeCamera++;
    this.pararCameraCrua();
    pararFluxo(this.streamMic);
    this.streamMic = null;
    this.faixaMic = null;
    this.audio?.definirLocal(null);
    this.fluxoExibido = null;
    this.mudar({ fluxoLocal: null, temCamera: false, temMicrofone: false, nivelMicrofone: 0 });
  }

  private garantirAudio(): AudioDaChamada {
    if (!this.audio) {
      this.audio = new AudioDaChamada();
      if (this.estado.prefs.saidaId) void this.audio.definirSaida(this.estado.prefs.saidaId);
      for (const [id, pref] of Object.entries(this.estado.pessoas)) {
        this.audio.ajustar(id, ganhoDaPessoa(pref, this.estado.surdo));
      }
    }
    return this.audio;
  }

  /** A faixa que vai aos outros: o canvas desfocado, a câmera crua ou nada. */
  private faixaDeVideoParaEnviar(): MediaStreamTrack | null {
    if (!this.estado.camera || this.estado.soOuvindo) return null;
    return this.fundoPipeline?.faixa ?? this.faixaCamera;
  }

  private aplicarMudoDoMicrofone(): void {
    if (this.faixaMic) {
      this.faixaMic.enabled = this.estado.microfone && !this.estado.surdo && !this.estado.soOuvindo;
    }
  }

  private atualizarFluxoLocal(): void {
    const faixa = this.fundoPipeline?.faixa ?? this.faixaCamera;
    const atual = this.fluxoExibido;
    if (!faixa) {
      this.fluxoExibido = null;
    } else if (!atual || atual.getVideoTracks()[0] !== faixa) {
      this.fluxoExibido = new MediaStream([faixa]);
    }
    this.mudar({ fluxoLocal: this.fluxoExibido });
    this.malha?.definirLocais(
      this.estado.soOuvindo ? null : this.faixaMic,
      this.faixaDeVideoParaEnviar(),
    );
  }

  private async atualizarAparelhos(): Promise<void> {
    if (this.encerrado || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const todos = await navigator.mediaDevices.enumerateDevices();
      const lista = (tipo: MediaDeviceKind, rotulo: string) =>
        todos
          .filter((d) => d.kind === tipo && d.deviceId !== "")
          .map((d, i) => ({ id: d.deviceId, nome: d.label || `${rotulo} ${i + 1}` }));
      this.mudar({
        aparelhos: {
          cameras: lista("videoinput", "Câmera"),
          microfones: lista("audioinput", "Microfone"),
          saidas: lista("audiooutput", "Saída de som"),
        },
      });
    } catch {
      // sem lista de aparelhos
    }
  }

  // --- o que a pessoa escolhe ---------------------------------------------------------------------------------------

  alternarMicrofone = async (): Promise<void> => {
    if (this.estado.soOuvindo) return;
    if (!this.estado.microfone && !this.faixaMic) {
      this.mudar({ microfone: true });
      if (!(await this.pedirMicrofone())) {
        this.mudar({ microfone: false, erroDeMidia: TEXTO_SEM_PERMISSAO });
        return;
      }
    } else {
      this.mudar({ microfone: !this.estado.microfone });
    }
    this.aplicarMudoDoMicrofone();
    this.enviarEstado();
  };

  alternarCamera = async (): Promise<void> => {
    if (this.estado.soOuvindo) return;
    if (this.estado.camera) await this.desligarCamera();
    else {
      this.mudar({ camera: true });
      if (!(await this.pedirCamera())) {
        this.mudar({ camera: false, erroDeMidia: TEXTO_SEM_PERMISSAO });
      }
      this.enviarEstado();
    }
  };

  private async desligarCamera(): Promise<void> {
    this.pedidoDeCamera++;
    this.fundoPipeline?.parar();
    this.fundoPipeline = null;
    this.pararCameraCrua();
    this.mudar({ camera: false, temCamera: false, fundoCarregando: false });
    this.atualizarFluxoLocal();
    this.enviarEstado();
  }

  alternarSurdo = (): void => {
    const surdo = !this.estado.surdo;
    this.mudar({ surdo });
    this.aplicarMudoDoMicrofone();
    for (const p of this.estado.participantes) {
      this.audio?.ajustar(p.usuarioId, ganhoDaPessoa(this.preferenciaDe(p.usuarioId), surdo));
    }
    this.enviarEstado();
  };

  /** "Desfocar o fundo" no botão de baixo: liga no modo escolhido (ou no leve) ou desliga. */
  alternarFundo = (): void => {
    void this.definirFundo(this.estado.fundo === "nenhum" ? "desfocar" : "nenhum");
  };

  definirFundo = async (modo: FundoDaChamada): Promise<void> => {
    if (this.estado.soOuvindo) return;
    this.guardarPreferencias({ fundo: modo });
    this.mudar({ fundo: modo, fundoIndisponivel: null });
    if (this.faixaCamera) await this.aplicarFundo(modo, false);
    this.atualizarFluxoLocal();
    this.enviarEstado();
  };

  /** Liga, troca ou desliga o fundo desfocado. Se o modelo não carregar, volta ao "sem efeito" e diz por quê. */
  private async aplicarFundo(modo: FundoDaChamada, silencioso: boolean): Promise<void> {
    const camera = this.faixaCamera;
    if (modo === "nenhum" || !camera) {
      this.fundoPipeline?.parar();
      this.fundoPipeline = null;
      this.mudar({ fundoCarregando: false });
      return;
    }
    if (this.fundoPipeline) {
      this.fundoPipeline.definirModo(modo);
      return;
    }
    this.mudar({ fundoCarregando: true });
    const pipeline = new FundoDesfocado(camera, modo, (motivo) => {
      if (this.fundoPipeline !== pipeline) return;
      this.fundoPipeline = null;
      this.mudar({
        fundo: "nenhum",
        fundoIndisponivel:
          motivo === "lento"
            ? "O computador não deu conta do desfoque, então ele foi desligado."
            : "O desfoque parou (a câmera foi desligada ou trocada).",
      });
      this.atualizarFluxoLocal();
      this.enviarEstado();
    });
    try {
      this.fundoPipeline = pipeline;
      await pipeline.iniciar();
      this.mudar({ fundoCarregando: false });
    } catch {
      pipeline.parar();
      if (this.fundoPipeline === pipeline) this.fundoPipeline = null;
      this.mudar({
        fundo: "nenhum",
        fundoCarregando: false,
        fundoIndisponivel: "O desfoque não carregou neste navegador.",
      });
      if (!silencioso) this.atualizarFluxoLocal();
    }
  }

  guardarPreferencias(parcial: Partial<PreferenciasDaChamada>): void {
    const prefs = { ...this.estado.prefs, ...parcial };
    gravarPreferenciasDaChamada(prefs);
    this.mudar({ prefs });
  }

  /** Troca de aparelho: câmera e microfone pedem de novo e usam `replaceTrack`; a saída vai ao contexto de áudio. */
  trocarAparelho = async (tipo: "camera" | "microfone" | "saida", id: string): Promise<void> => {
    if (tipo === "saida") {
      this.guardarPreferencias({ saidaId: id });
      await this.garantirAudio().definirSaida(id);
    } else if (tipo === "microfone") {
      this.guardarPreferencias({ microfoneId: id });
      if (this.faixaMic) await this.pedirMicrofone();
    } else {
      this.guardarPreferencias({ cameraId: id });
      if (this.estado.camera) {
        this.fundoPipeline?.parar();
        this.fundoPipeline = null;
        await this.pedirCamera();
        this.atualizarFluxoLocal();
      }
    }
  };

  /** "Reduzir ruído e eco": vale para o microfone que vier (e refaz o atual). */
  definirReduzirRuido = async (ligado: boolean): Promise<void> => {
    this.guardarPreferencias({ reduzirRuido: ligado });
    if (this.faixaMic) await this.pedirMicrofone();
  };

  definirEntrarMudo = (ligado: boolean): void => {
    this.guardarPreferencias({ entrarMudo: ligado });
    this.mudar({ microfone: !ligado });
    this.aplicarMudoDoMicrofone();
  };

  definirSons = (ligado: boolean): void => this.guardarPreferencias({ sons: ligado });

  // --- volume por pessoa ---------------------------------------------------------------------------------------------

  preferenciaDe(usuarioId: string): PreferenciaDePessoa {
    return this.estado.pessoas[usuarioId] ?? lerPreferenciaDePessoa(this.o.mesaId, usuarioId);
  }

  definirVolume = (usuarioId: string, volume: number): void => {
    this.mudarPessoa(usuarioId, {
      ...this.preferenciaDe(usuarioId),
      volume: limitarVolume(volume),
    });
  };

  silenciar = (usuarioId: string, silenciado: boolean): void => {
    this.mudarPessoa(usuarioId, { ...this.preferenciaDe(usuarioId), silenciado });
  };

  private mudarPessoa(usuarioId: string, pref: PreferenciaDePessoa): void {
    gravarPreferenciaDePessoa(this.o.mesaId, usuarioId, pref);
    this.audio?.ajustar(usuarioId, ganhoDaPessoa(pref, this.estado.surdo));
    this.mudar({ pessoas: { ...this.estado.pessoas, [usuarioId]: pref } });
  }

  // --- entrar, estado e sair ------------------------------------------------------------------------------------------

  entrar = async (soOuvindo: boolean): Promise<void> => {
    if (this.estado.fase === "dentro") return;
    this.garantirAudio();
    if (soOuvindo) {
      this.fundoPipeline?.parar();
      this.fundoPipeline = null;
      this.pararMidia();
      this.mudar({ soOuvindo: true, microfone: false, camera: false, fundo: "nenhum" });
    } else {
      this.mudar({ soOuvindo: false });
    }
    this.entrei = true;
    this.confirmado = false;
    this.mudar({ fase: "dentro", aviso: null, entrouEmMs: Date.now() });
    this.criarMalha();
    this.enviarEntrar();
    this.malha?.definirLocais(
      this.estado.soOuvindo ? null : this.faixaMic,
      this.faixaDeVideoParaEnviar(),
    );
  };

  private enviarEntrar(): void {
    const e = this.estado;
    this.o.enviar("chamada.entrar", {
      microfone: e.microfone && !e.soOuvindo,
      camera: e.camera && !e.soOuvindo,
      soOuvindo: e.soOuvindo,
    });
    if (!e.soOuvindo && (e.fundo !== "nenhum" || e.surdo)) this.enviarEstado();
  }

  private enviarEstado(): void {
    if (!this.entrei) return;
    const e = this.estado;
    if (e.soOuvindo) {
      this.o.enviar("chamada.estado", {
        microfone: false,
        camera: false,
        fundo: "nenhum",
        surdo: e.surdo,
      });
      return;
    }
    this.o.enviar("chamada.estado", {
      microfone: e.microfone,
      camera: e.camera && this.faixaCamera !== null,
      fundo: e.fundo === "nenhum" || !this.fundoPipeline ? "nenhum" : e.fundo,
      surdo: e.surdo,
    });
  }

  sair = async (): Promise<void> => {
    if (!this.entrei) return;
    this.o.enviar("chamada.sair", {});
    await this.voltarParaAntes(null);
  };

  /** Saiu (ou foi substituída): desfaz a malha e volta a "antes de entrar", com a prévia de novo. */
  private async voltarParaAntes(aviso: string | null, fase: Fase = "antes"): Promise<void> {
    this.entrei = false;
    this.confirmado = false;
    this.malha?.fechar();
    this.malha = null;
    this.participantesAnteriores = null;
    for (const id of Object.keys(this.estado.fluxos)) this.audio?.removerPessoa(id);
    this.avaliadores.clear();
    this.fundoPipeline?.parar();
    this.fundoPipeline = null;
    this.pararMidia();
    this.mudar({
      fase,
      aviso,
      soOuvindo: false,
      fluxos: {},
      conexoes: {},
      falando: new Set(),
      entrouEmMs: null,
      surdo: false,
      microfone: !this.estado.prefs.entrarMudo,
      camera: true,
    });
    if (fase === "antes") await this.adquirirPrevia();
  }

  /** "Entrar de novo" depois de ser substituída por outra janela. */
  recomecar = async (): Promise<void> => {
    this.mudar({ fase: "antes", aviso: null });
    await this.adquirirPrevia();
  };

  // --- o que vem da sala -----------------------------------------------------------------------------------------------

  private criarMalha(): void {
    this.malha?.fechar();
    this.malha = new MalhaDaChamada({
      meuId: this.o.meuId,
      iceServers: iceServersDoTexto(ICE_DO_AMBIENTE),
      enviarSinal: (para, sinal) => {
        this.o.enviar("chamada.sinal", { para, ...sinal });
      },
      aoReceber: (id, tipo, fluxo) => {
        if (tipo === "audio") {
          const pref = this.preferenciaDe(id);
          this.garantirAudio().adicionarPessoa(id, fluxo, ganhoDaPessoa(pref, this.estado.surdo));
        }
        this.atualizarPares();
      },
      aoMudar: () => this.atualizarPares(),
    });
    this.malha.definirLocais(this.faixaMic, this.faixaDeVideoParaEnviar());
  }

  private atualizarPares(): void {
    const malha = this.malha;
    if (!malha) return;
    const fluxos: Record<string, MediaStream | null> = {};
    const conexoes: Record<string, string> = {};
    for (const id of malha.ids()) {
      fluxos[id] = malha.fluxoDe(id);
      conexoes[id] = malha.estadoDe(id) ?? "new";
    }
    const iguais =
      Object.keys(fluxos).length === Object.keys(this.estado.fluxos).length &&
      Object.entries(fluxos).every(
        ([id, f]) => this.estado.fluxos[id] === f && this.estado.conexoes[id] === conexoes[id],
      );
    if (!iguais) this.mudar({ fluxos, conexoes });
  }

  /** A lista de quem está na chamada mudou (a sala manda a todos a cada mudança). */
  definirParticipantes(lista: ParticipanteDaChamada[]): void {
    const ids = lista.map((p) => p.usuarioId);
    const anteriores = this.participantesAnteriores;
    if (this.entrei) {
      if (ids.includes(this.o.meuId)) this.confirmado = true;
      if (anteriores && this.estado.prefs.sons && this.audio) {
        const chegou = ids.some((i) => !anteriores.includes(i) && i !== this.o.meuId);
        const saiu = anteriores.some((i) => !ids.includes(i) && i !== this.o.meuId);
        if (chegou) this.audio.bipe("entrou");
        else if (saiu) this.audio.bipe("saiu");
      }
      this.participantesAnteriores = ids;
      for (const id of anteriores ?? []) {
        if (!ids.includes(id)) this.audio?.removerPessoa(id);
      }
      this.malha?.definirPares(ids, Math.max(ids.length, 1));
      // Sem o balde de mim mesma: a lista da sala é quem está para os outros.
    }
    this.mudar({ participantes: lista });
  }

  receberSinal(de: string, sinal: SinalDaChamada): void {
    this.malha?.receberSinal(de, sinal);
  }

  /** O socket (re)abriu: se eu estava na chamada, entro de novo (a sala me tirou quando o socket caiu). */
  aoConectar(): void {
    if (this.entrei) this.enviarEntrar();
  }

  /** A sala recusou (chamada cheia, não é da mesa): se eu ainda não tinha entrado de fato, volto para "antes". */
  aoRecusar(codigo: string, mensagem: string): void {
    if (!this.entrei || this.confirmado) return;
    if (codigo === "chamada_cheia" || codigo === "sem_permissao") {
      void this.voltarParaAntes(mensagem);
    }
  }

  /** A mesma pessoa entrou por outra janela: esta sai. */
  aoSerSubstituida(): void {
    if (!this.entrei) return;
    void this.voltarParaAntes("Você entrou na chamada por outra janela.", "substituida");
  }

  // --- quem fala e o nível do microfone ----------------------------------------------------------------------------------

  private medir(): void {
    if (this.encerrado) return;
    const agora = performance.now();
    const falando = new Set<string>();
    const meu = this.audio?.nivelLocal() ?? 0;
    const meuNivel =
      this.estado.microfone && !this.estado.surdo && !this.estado.soOuvindo ? meu : 0;
    if (this.entrei && this.avaliar(this.o.meuId, meuNivel, agora)) falando.add(this.o.meuId);
    if (this.entrei) {
      for (const id of Object.keys(this.estado.fluxos)) {
        const p = this.estado.participantes.find((x) => x.usuarioId === id);
        const nivel = p?.microfone && this.audio ? this.audio.nivelDe(id) : 0;
        if (this.avaliar(id, nivel, agora)) falando.add(id);
      }
    }
    const mudouFala =
      falando.size !== this.estado.falando.size ||
      [...falando].some((i) => !this.estado.falando.has(i));
    const nivelAntes = this.estado.nivelMicrofone;
    const nivelNovo = Math.round(Math.min(1, meu * 4) * 12) / 12;
    if (mudouFala || (!this.entrei && nivelNovo !== nivelAntes)) {
      this.mudar({
        ...(mudouFala ? { falando } : {}),
        ...(!this.entrei ? { nivelMicrofone: nivelNovo } : {}),
      });
    }
  }

  private avaliar(id: string, nivel: number, agora: number): boolean {
    let a = this.avaliadores.get(id);
    if (!a) {
      a = new AvaliadorDeFala();
      this.avaliadores.set(id, a);
    }
    return a.atualizar(nivel, agora);
  }

  // --- para os testes (modo e2e) --------------------------------------------------------------------------------------------

  /** O que o teste confere: a faixa enviada é a do canvas? quantas conexões? o bitrate? */
  diagnostico() {
    const enviada = this.faixaDeVideoParaEnviar();
    return {
      fase: this.estado.fase,
      fundo: this.estado.fundo,
      fundoAtivo: this.fundoPipeline !== null && this.fundoPipeline.faixa !== null,
      enviaTrilhaDoCanvas: enviada !== null && enviada === (this.fundoPipeline?.faixa ?? null),
      enviaCameraCrua: enviada !== null && enviada === this.faixaCamera,
      pares: this.malha?.ids() ?? [],
      detalhes: this.malha?.detalhes() ?? {},
      conexoes: { ...this.estado.conexoes },
      bitrate: this.malha?.bitrateAplicado() ?? null,
      falando: [...this.estado.falando],
    };
  }
}
