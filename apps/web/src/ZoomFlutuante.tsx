import { ChevronUp, Crosshair, LocateFixed, Minus, Plus } from "lucide-react";
import { useRef } from "react";
import { Avatar } from "./Avatar";
import { BotaoComDica } from "./BotaoComDica";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { ZOOM_MAX, ZOOM_MIN } from "./mapa/mapaPixi";
import { useFecharFora } from "./Popover";

/** Um token que se pode escolher seguir (nome, cor e imagem dele). */
export type OpcaoDeSeguir = {
  id: string;
  nome: string;
  cor: string;
  assetHash: string | undefined;
};

type Props = {
  zoom: number;
  aoDefinir: (zoom: number) => void;
  aoPasso: (fator: number) => void;
  aoCentralizar: () => void;
  /** Q12: o "seguir meu token" está ligado. */
  seguindo: boolean;
  aoAlternarSeguir: () => void;
  /** Q12: os tokens da cena que se pode escolher seguir e o escolhido. A setinha só existe com mais de um. */
  opcoesDeSeguir: readonly OpcaoDeSeguir[];
  seguidoId: string | null;
  listaAberta: boolean;
  aoMudarLista: (aberta: boolean) => void;
  aoEscolherSeguido: (id: string) => void;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
};

const PASSOS = 1000;
const LOG_MIN = Math.log(ZOOM_MIN);
const LOG_MAX = Math.log(ZOOM_MAX);

/** Controle de zoom no canto inferior direito da área do mapa: −, trilho, +, nível atual, centralizar e seguir. */
export function ZoomFlutuante({
  zoom,
  aoDefinir,
  aoPasso,
  aoCentralizar,
  seguindo,
  aoAlternarSeguir,
  opcoesDeSeguir,
  seguidoId,
  listaAberta,
  aoMudarLista,
  aoEscolherSeguido,
  imagens,
  versaoDasImagens,
}: Props) {
  const posicao = Math.round(((Math.log(zoom) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * PASSOS);
  const caixa = useRef<HTMLDivElement>(null);
  const temLista = opcoesDeSeguir.length > 1;
  useFecharFora(caixa, () => {
    if (listaAberta) aoMudarLista(false);
  });
  return (
    <div className="zoom-flutuante" data-testid="zoom-flutuante">
      <BotaoComDica
        testid="zoom-menos"
        className="botao-icone"
        nome="Afastar"
        aria-label="Afastar"
        onClick={() => aoPasso(0.8)}
      >
        <Minus size={18} />
      </BotaoComDica>
      <input
        type="range"
        className="trilho-zoom"
        data-testid="zoom-trilho"
        aria-label="Nível de zoom"
        min={0}
        max={PASSOS}
        value={Math.min(PASSOS, Math.max(0, posicao))}
        onChange={(e) =>
          aoDefinir(Math.exp(LOG_MIN + (Number(e.target.value) / PASSOS) * (LOG_MAX - LOG_MIN)))
        }
      />
      <BotaoComDica
        testid="zoom-mais"
        className="botao-icone"
        nome="Aproximar"
        aria-label="Aproximar"
        onClick={() => aoPasso(1.25)}
      >
        <Plus size={18} />
      </BotaoComDica>
      <span className="zoom-nivel" data-testid="zoom-nivel">
        {Math.round(zoom * 100)}%
      </span>
      <BotaoComDica
        testid="zoom-centralizar"
        className="botao-icone"
        nome="Centralizar o mapa"
        aria-label="Centralizar o mapa"
        onClick={aoCentralizar}
      >
        <LocateFixed size={18} />
      </BotaoComDica>
      <span className="zoom-seguir" ref={caixa}>
        <BotaoComDica
          testid="zoom-seguir"
          className="botao-icone"
          nome="Seguir meu token"
          atalho="seguirToken"
          aria-label="Seguir meu token"
          aria-pressed={seguindo}
          data-popover-gatilho=""
          onClick={aoAlternarSeguir}
        >
          <Crosshair size={18} />
        </BotaoComDica>
        {temLista && (
          <BotaoComDica
            testid="zoom-seguir-lista"
            className="botao-icone pequeno zoom-seguir-seta"
            nome="Escolher o token a seguir"
            aria-label="Escolher o token a seguir"
            aria-haspopup="menu"
            aria-expanded={listaAberta}
            semDica={listaAberta}
            data-popover-gatilho=""
            onClick={() => aoMudarLista(!listaAberta)}
          >
            <ChevronUp size={14} aria-hidden="true" />
          </BotaoComDica>
        )}
        {listaAberta && temLista && (
          <div
            className="menu-contexto zoom-seguir-lista"
            role="menu"
            aria-label="Token a seguir"
            data-testid="zoom-seguir-menu"
          >
            {opcoesDeSeguir.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === seguidoId}
                className="item-menu"
                data-testid={`zoom-seguir-${o.id}`}
                onClick={() => aoEscolherSeguido(o.id)}
              >
                <Avatar
                  imagens={imagens}
                  versao={versaoDasImagens}
                  hash={o.assetHash}
                  nome={o.nome}
                  cor={o.cor}
                  redondo
                />
                <span>{o.nome}</span>
              </button>
            ))}
          </div>
        )}
      </span>
    </div>
  );
}
