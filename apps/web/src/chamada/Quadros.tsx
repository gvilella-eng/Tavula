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
import { BotaoComDica } from "../BotaoComDica";
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
  medida,
  euMestre,
  aoAbrirSom,
  aoMusica,
}: {
  /** O tamanho que a grade deu ao quadro: quadro pequeno vira botões só com ícone (e a dica) e menos texto. */
  medida?: { largura: number; altura: number } | undefined;
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
  // Quadro pequeno: botões só com ícone (a dica diz o nome) e sem a linha de apoio. Muito baixo: sem o equalizador.
  const compacto =
    pequeno || (medida !== undefined && (medida.largura < 420 || medida.altura < 236));
  const baixo = medida !== undefined && medida.altura < 150;
  const pausar = musica === "tocando";
  return (
    <div
      className="chamada-quadro chamada-trilha"
      data-testid="chamada-trilha"
      data-tocando={tocando ? "sim" : "nao"}
      data-musica={musica ?? "nenhuma"}
      data-compacto={compacto ? "sim" : "nao"}
      data-baixo={baixo ? "sim" : "nao"}
    >
      <div className="chamada-trilha-cab">
        <Music size={compacto ? 13 : 15} aria-hidden="true" />
        {compacto ? "Trilha" : "Trilha da mesa"}
      </div>
      <div className="chamada-trilha-titulo" data-testid="chamada-trilha-titulo">
        {titulo}
      </div>
      {!compacto && (
        <div className="chamada-trilha-sub" data-testid="chamada-trilha-sub">
          {subtitulo ??
            (tocando ? "Da mesa de som · toca para todos" : "A mesa de som está parada")}
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
        {euMestre && (
          <div className="chamada-trilha-musica">
            {musica !== null && (
              <>
                <BotaoComDica
                  testid="chamada-musica-pausar"
                  className="chamada-botao-texto"
                  nome={pausar ? "Pausar a música" : "Tocar a música"}
                  nomeVisivel={!compacto}
                  aria-label={pausar ? "Pausar a música" : "Tocar a música"}
                  onClick={() => aoMusica(pausar ? "pausar" : "retomar")}
                >
                  {pausar ? (
                    <Pause size={14} aria-hidden="true" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  {compacto ? null : pausar ? "Pausar" : "Tocar"}
                </BotaoComDica>
                <BotaoComDica
                  testid="chamada-musica-proxima"
                  className="chamada-botao-texto"
                  nome="Próxima música"
                  nomeVisivel={!compacto}
                  aria-label="Próxima música"
                  onClick={() => aoMusica("proxima")}
                >
                  <SkipForward size={14} aria-hidden="true" />
                  {compacto ? null : "Próxima"}
                </BotaoComDica>
              </>
            )}
            {!pequeno && (
              <BotaoComDica
                testid="chamada-abrir-som"
                className="chamada-botao-texto"
                nome="Abrir a mesa de som"
                nomeVisivel={!compacto}
                aria-label="Abrir a mesa de som"
                onClick={aoAbrirSom}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {compacto ? null : "Abrir a mesa de som"}
              </BotaoComDica>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
