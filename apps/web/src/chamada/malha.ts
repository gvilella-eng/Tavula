import { bitrateDoVideo, ehEducado, ignoraOferta } from "./puras";

// CH1: a malha de conexões da chamada: uma `RTCPeerConnection` por par de pessoas, com "perfect negotiation" (o de id
// menor cede quando as duas pontas oferecem ao mesmo tempo). Cada conexão nasce com dois transceptores (áudio e vídeo,
// nos dois sentidos); ligar e desligar câmera, trocar de aparelho e o desfoque usam `replaceTrack`, sem renegociar. O
// aperto de mão passa pela sala (`chamada.sinal`); a voz e o vídeo vão direto entre os navegadores.

export type SinalDaChamada = {
  descricao?: { tipo: "offer" | "answer"; sdp: string };
  candidato?: {
    candidate: string;
    sdpMid?: string | null | undefined;
    sdpMLineIndex?: number | null | undefined;
  };
};

type Opcoes = {
  meuId: string;
  iceServers: RTCIceServer[];
  /** Entrega um sinal à sala (que o repassa a `para`). */
  enviarSinal: (para: string, sinal: SinalDaChamada) => void;
  /** Chegou uma faixa de áudio ou vídeo de `id` (o fluxo é o mesmo de sempre daquela pessoa). */
  aoReceber: (id: string, tipo: "audio" | "video", fluxo: MediaStream) => void;
  /** O estado de alguma conexão mudou (para a tela atualizar). */
  aoMudar: () => void;
};

type Par = {
  id: string;
  pc: RTCPeerConnection;
  educado: boolean;
  fazendoOferta: boolean;
  ignorandoOferta: boolean;
  fila: Promise<void>;
  fluxo: MediaStream;
  /** Quem oferece (o de id maior) cria os dois transceptores; o educado os recebe junto com a primeira oferta. */
  audio: RTCRtpTransceiver | null;
  video: RTCRtpTransceiver | null;
};

const SEGURA_ADIANTADOS_MS = 10_000;
const MAXIMO_DE_ADIANTADOS = 80;

export class MalhaDaChamada {
  private readonly pares = new Map<string, Par>();
  /** Sinais que chegaram de quem ainda não tem conexão aqui (a lista da sala vem logo depois). */
  private readonly adiantados = new Map<string, { sinal: SinalDaChamada; em: number }[]>();
  private audioLocal: MediaStreamTrack | null = null;
  private videoLocal: MediaStreamTrack | null = null;
  private pessoasNaChamada = 1;
  private fechada = false;

  constructor(private readonly o: Opcoes) {}

  /** Os fluxos recebidos, por pessoa (o mesmo objeto enquanto a conexão existir). */
  fluxoDe(id: string): MediaStream | null {
    return this.pares.get(id)?.fluxo ?? null;
  }

  estadoDe(id: string): RTCPeerConnectionState | null {
    return this.pares.get(id)?.pc.connectionState ?? null;
  }

  /** Para os testes e o diagnóstico: o estado da negociação de cada conexão. */
  detalhes(): Record<string, string> {
    const saida: Record<string, string> = {};
    for (const [id, p] of this.pares) {
      saida[id] =
        `${p.pc.signalingState}/${p.pc.iceConnectionState}/${p.pc.connectionState}${p.ignorandoOferta ? "/ignorando" : ""}`;
    }
    return saida;
  }

  ids(): string[] {
    return [...this.pares.keys()];
  }

  /** As faixas que esta pessoa envia agora (ou `null`: não envia). Vale para todas as conexões, sem renegociar. */
  definirLocais(audio: MediaStreamTrack | null, video: MediaStreamTrack | null): void {
    this.audioLocal = audio;
    this.videoLocal = video;
    for (const p of this.pares.values()) this.aplicarLocais(p);
  }

  private aplicarLocais(p: Par): void {
    void p.audio?.sender.replaceTrack(this.audioLocal).catch(() => {});
    void p.video?.sender.replaceTrack(this.videoLocal).catch(() => {});
  }

  /** Quem está na chamada além de mim: abre a conexão de quem chegou e fecha a de quem saiu. */
  definirPares(ids: readonly string[], pessoasNaChamada: number): void {
    if (this.fechada) return;
    this.pessoasNaChamada = pessoasNaChamada;
    const querer = new Set(ids.filter((i) => i !== this.o.meuId));
    for (const id of [...this.pares.keys()]) if (!querer.has(id)) this.fecharPar(id);
    for (const id of querer) if (!this.pares.has(id)) this.abrirPar(id);
    this.aplicarBitrate();
    this.o.aoMudar();
  }

  private abrirPar(id: string): void {
    const pc = new RTCPeerConnection({ iceServers: this.o.iceServers });
    const educado = ehEducado(this.o.meuId, id);
    // Só uma ponta oferece no começo (a de id maior), para as duas não oferecerem juntas e cair na colisão logo de saída;
    // a de id menor (educada) recebe os transceptores com a primeira oferta. Depois, qualquer lado pode renegociar.
    const fluxoDeSaida = new MediaStream();
    const audio = educado
      ? null
      : pc.addTransceiver("audio", { direction: "sendrecv", streams: [fluxoDeSaida] });
    const video = educado
      ? null
      : pc.addTransceiver("video", { direction: "sendrecv", streams: [fluxoDeSaida] });
    const par: Par = {
      id,
      pc,
      educado,
      fazendoOferta: false,
      ignorandoOferta: false,
      fila: Promise.resolve(),
      fluxo: new MediaStream(),
      audio,
      video,
    };
    this.pares.set(id, par);
    this.aplicarLocais(par);
    const antes = this.adiantados.get(id);
    this.adiantados.delete(id);
    const agora = Date.now();
    for (const a of antes ?? []) {
      if (agora - a.em < SEGURA_ADIANTADOS_MS) this.receberSinal(id, a.sinal);
    }

    pc.onnegotiationneeded = () => {
      par.fila = par.fila.then(async () => {
        if (this.fechada || this.pares.get(id) !== par) return;
        try {
          par.fazendoOferta = true;
          await pc.setLocalDescription();
          const d = pc.localDescription;
          if (d && (d.type === "offer" || d.type === "answer")) {
            this.o.enviarSinal(id, { descricao: { tipo: d.type, sdp: d.sdp } });
          }
        } catch (e) {
          console.warn("chamada: falha ao oferecer", id, e);
          // a próxima negociação tenta de novo
        } finally {
          par.fazendoOferta = false;
        }
      });
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate;
      this.o.enviarSinal(id, {
        candidato: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex },
      });
    };
    pc.ontrack = (e) => {
      if (!par.fluxo.getTracks().includes(e.track)) par.fluxo.addTrack(e.track);
      this.o.aoReceber(id, e.track.kind === "audio" ? "audio" : "video", par.fluxo);
      this.o.aoMudar();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") this.aplicarBitrate();
      if (pc.connectionState === "failed") {
        try {
          pc.restartIce();
        } catch {
          // fechada
        }
      }
      this.o.aoMudar();
    };
  }

  private fecharPar(id: string): void {
    const p = this.pares.get(id);
    this.adiantados.delete(id);
    if (!p) return;
    this.pares.delete(id);
    p.pc.onnegotiationneeded = null;
    p.pc.onicecandidate = null;
    p.pc.ontrack = null;
    p.pc.onconnectionstatechange = null;
    try {
      p.pc.close();
    } catch {
      // já fechada
    }
  }

  /** Depois de aceitar a oferta, os transceptores que ela criou passam a ser os desta conexão, nos dois sentidos. */
  private pegarTransceptores(p: Par): void {
    if (p.audio && p.video) return;
    for (const t of p.pc.getTransceivers()) {
      const tipo = t.receiver.track.kind;
      if (tipo === "audio" && !p.audio) p.audio = t;
      else if (tipo === "video" && !p.video) p.video = t;
      else continue;
      t.direction = "sendrecv";
    }
    this.aplicarLocais(p);
  }

  /** Com mais de 3 pessoas cada uma manda vídeo para várias: o teto do bitrate cai (`setParameters`, sem renegociar). */
  private aplicarBitrate(): void {
    const teto = bitrateDoVideo(this.pessoasNaChamada);
    for (const p of this.pares.values()) {
      const sender = p.video?.sender;
      if (!sender) continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) continue;
        const primeira = params.encodings[0];
        if (!primeira || primeira.maxBitrate === teto) continue;
        primeira.maxBitrate = teto;
        void sender.setParameters(params).catch(() => {});
      } catch {
        // ainda sem negociação: aplica quando conectar
      }
    }
  }

  /** O teto atual de cada conexão (para os testes e o diagnóstico). */
  bitrateAplicado(): number | null {
    for (const p of this.pares.values()) {
      const v = p.video?.sender.getParameters().encodings?.[0]?.maxBitrate;
      if (typeof v === "number") return v;
    }
    return null;
  }

  /** Um sinal que chegou de `de`: um de cada vez por conexão, na ordem em que chegaram. */
  receberSinal(de: string, sinal: SinalDaChamada): void {
    if (this.fechada) return;
    const p = this.pares.get(de);
    if (!p) {
      // A oferta de quem já está na chamada pode chegar antes de a lista que me mostra quem chegou: guarda por alguns
      // segundos e entrega quando a conexão com essa pessoa existir (senão as duas pontas esperam uma à outra).
      const agora = Date.now();
      const lista = (this.adiantados.get(de) ?? []).filter(
        (x) => agora - x.em < SEGURA_ADIANTADOS_MS,
      );
      if (lista.length < MAXIMO_DE_ADIANTADOS) lista.push({ sinal, em: agora });
      this.adiantados.set(de, lista);
      return;
    }
    p.fila = p.fila.then(async () => {
      if (this.fechada || this.pares.get(de) !== p) return;
      const { pc } = p;
      try {
        if (sinal.descricao) {
          const d = sinal.descricao;
          const estavel = pc.signalingState === "stable";
          p.ignorandoOferta = ignoraOferta(p.educado, d.tipo, estavel, p.fazendoOferta);
          if (p.ignorandoOferta) return;
          await pc.setRemoteDescription({ type: d.tipo, sdp: d.sdp });
          if (d.tipo === "offer") {
            this.pegarTransceptores(p);
            await pc.setLocalDescription();
            const local = pc.localDescription;
            if (local && (local.type === "offer" || local.type === "answer")) {
              this.o.enviarSinal(de, { descricao: { tipo: local.type, sdp: local.sdp } });
            }
          }
        } else if (sinal.candidato) {
          try {
            const c = sinal.candidato;
            await pc.addIceCandidate({
              candidate: c.candidate,
              sdpMid: c.sdpMid ?? null,
              sdpMLineIndex: c.sdpMLineIndex ?? null,
            });
          } catch (e) {
            if (!p.ignorandoOferta) throw e;
          }
        }
      } catch (e) {
        console.warn("chamada: sinal que falhou", de, sinal.descricao?.tipo ?? "candidato", e);
        // sinal que não vale (a pessoa saiu no meio, oferta velha): a negociação seguinte conserta
      }
    });
  }

  fechar(): void {
    this.fechada = true;
    this.adiantados.clear();
    for (const id of [...this.pares.keys()]) this.fecharPar(id);
  }
}
