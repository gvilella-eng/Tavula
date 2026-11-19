import type { ParticipanteDaChamada, Usuario } from "@tabletop/shared";
import {
  ExternalLink,
  HeadphoneOff,
  MicOff,
  Music,
  Pause,
  Play,
  SkipForward,
  UserRound,
} from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { inicialDe } from "./puras";

// CH1: os quadros da chamada: o vídeo de uma pessoa (ou a inicial dela, na cor dela) com o nome, o microfone desligado, o
// selo do fundo desfocado e o anel verde de quem fala; e o quadro "Trilha da mesa".

/** O vídeo de um fluxo. Sempre mudo: o som da chamada sai pelo WebAudio (volume por pessoa), não por aqui. */
export function VideoDoFluxo({
  fluxo,
  espelhar,
  testid,
}: {
  fluxo: MediaStream | null;
  espelhar?: boolean;
  testid?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== fluxo) el.srcObject = fluxo;
    if (fluxo) void el.play().catch(() => {});
  }, [fluxo]);
  return (
    <video
      ref={ref}
      className="chamada-video"
      data-espelhado={espelhar ? "sim" : undefined}
      data-testid={testid}
      autoPlay
      muted
      playsInline
    />
  );
}

export type DadosDoQuadro = {
  usuario: Usuario;
  participante: ParticipanteDaChamada;
  euSou: boolean;
  /** Mostra o rótulo com o personagem (some nas miniaturas pequenas). */
  papel: string;
  fluxo: MediaStream | null;
  falando: boolean;
  /** A conexão com esta pessoa ainda não está de pé (mostra "Conectando"). */
  conectando: boolean;
};

export function QuadroDaPessoa({
  d,
  pequeno,
  semRotulo,
}: {
  d: DadosDoQuadro;
  pequeno?: boolean;
  /** A miniatura da janela estreita: o nome está na linha ao lado, então o quadro não repete. */
  semRotulo?: boolean;
}) {
  const { usuario: u, participante: p } = d;
  const comVideo = p.camera && d.fluxo !== null;
  const mudo = !p.microfone || p.surdo;
  const estilo = { "--cor-da-pessoa": u.cor } as CSSProperties;
  return (
    <div
      className="chamada-quadro"
      style={estilo}
      data-testid={`chamada-quadro-${u.id}`}
      data-falando={d.falando ? "sim" : "nao"}
      data-camera={comVideo ? "ligada" : "desligada"}
      data-microfone={p.microfone ? "ligado" : "desligado"}
      data-fundo={p.fundo}
    >
      {comVideo ? (
        <VideoDoFluxo fluxo={d.fluxo} espelhar={d.euSou} testid={`chamada-video-${u.id}`} />
      ) : (
        <div className="chamada-sem-video" data-testid={`chamada-inicial-${u.id}`}>
          <span className="chamada-inicial" data-pequena={pequeno ? "sim" : undefined}>
            {inicialDe(u.nome)}
          </span>
        </div>
      )}
      {semRotulo ? (
        <span className="so-leitor">{u.nome}</span>
      ) : (
        <div className="chamada-rotulo">
          {p.surdo ? (
            <HeadphoneOff size={14} role="img" aria-label="Sem ouvir a chamada" />
          ) : mudo ? (
            <MicOff size={14} role="img" aria-label="Microfone desligado" />
          ) : null}
          <span className="chamada-rotulo-nome">
            {u.nome}
            {d.euSou ? " (você)" : ""}
          </span>
          {!pequeno && d.papel !== "" && <span className="chamada-rotulo-papel">{d.papel}</span>}
        </div>
      )}
      {!pequeno && comVideo && p.fundo !== "nenhum" && (
        <div className="chamada-selo" data-testid={`chamada-selo-fundo-${u.id}`}>
          <UserRound size={12} aria-hidden="true" />
          Fundo desfocado
        </div>
      )}
      {!pequeno && d.conectando && !d.euSou && (
        <div className="chamada-conectando" role="status">
          Conectando…
        </div>
      )}
    </div>
  );
}

/** O quadro "Trilha da mesa": só mostra o que a mesa de som toca (nome e equalizador). */
export function QuadroDaTrilha({
  tocando,
  titulo,
  subtitulo,
  musica,
  pequeno,
  euMestre,
  aoAbrirSom,
  aoMusica,
}: {
  tocando: boolean;
  titulo: string;
  /** O botão da música que toca (ou "Música pausada · botão"). */
  subtitulo?: string | undefined;
  musica: "tocando" | "pausada" | null;
  pequeno?: boolean;
  euMestre: boolean;
  aoAbrirSom: () => void;
  /** O mestre pausa, retoma e pula a música daqui. */
  aoMusica: (acao: "pausar" | "retomar" | "proxima") => void;
}) {
  return (
    <div
      className="chamada-quadro chamada-trilha"
      data-testid="chamada-trilha"
      data-tocando={tocando ? "sim" : "nao"}
      data-musica={musica ?? "nenhuma"}
    >
      <div className="chamada-trilha-cab">
        <Music size={pequeno ? 13 : 15} aria-hidden="true" />
        {pequeno ? "Trilha" : "Trilha da mesa"}
      </div>
      <div className="chamada-trilha-titulo" data-testid="chamada-trilha-titulo">
        {titulo}
      </div>
      {!pequeno && (
        <div className="chamada-trilha-sub" data-testid="chamada-trilha-sub">
          {subtitulo ??
            (tocando ? "Da mesa de som · toca para todos" : "A mesa de som está parada")}
        </div>
      )}
      {euMestre && musica !== null && (
        <div className="chamada-trilha-musica">
          <button
            type="button"
            className="chamada-botao-texto"
            data-testid="chamada-musica-pausar"
            aria-label={musica === "tocando" ? "Pausar a música" : "Tocar a música"}
            onClick={() => aoMusica(musica === "tocando" ? "pausar" : "retomar")}
          >
            {musica === "tocando" ? (
              <Pause size={14} aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {pequeno ? null : musica === "tocando" ? "Pausar" : "Tocar"}
          </button>
          <button
            type="button"
            className="chamada-botao-texto"
            data-testid="chamada-musica-proxima"
            aria-label="Próxima música"
            onClick={() => aoMusica("proxima")}
          >
            <SkipForward size={14} aria-hidden="true" />
            {pequeno ? null : "Próxima"}
          </button>
        </div>
      )}
      <div className="chamada-trilha-fim">
        {tocando && (
          <div className="chamada-eq" aria-hidden="true">
            <span className="chamada-eq-barra" />
            <span className="chamada-eq-barra" />
            <span className="chamada-eq-barra" />
            <span className="chamada-eq-barra" />
            <span className="chamada-eq-barra" />
            <span className="chamada-eq-barra" />
          </div>
        )}
        {euMestre && !pequeno && (
          <button
            type="button"
            className="chamada-botao-texto"
            data-testid="chamada-abrir-som"
            onClick={aoAbrirSom}
          >
            <ExternalLink size={14} aria-hidden="true" />
            Abrir a mesa de som
          </button>
        )}
      </div>
    </div>
  );
}
