import { LocateFixed, Minus, Plus } from "lucide-react";
import { ZOOM_MAX, ZOOM_MIN } from "./mapa/mapaPixi";

type Props = {
  zoom: number;
  aoDefinir: (zoom: number) => void;
  aoPasso: (fator: number) => void;
  aoCentralizar: () => void;
};

const PASSOS = 1000;
const LOG_MIN = Math.log(ZOOM_MIN);
const LOG_MAX = Math.log(ZOOM_MAX);

/** Controle de zoom no canto inferior direito da área do mapa: −, trilho, +, nível atual e centralizar. */
export function ZoomFlutuante({ zoom, aoDefinir, aoPasso, aoCentralizar }: Props) {
  const posicao = Math.round(((Math.log(zoom) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * PASSOS);
  return (
    <div className="zoom-flutuante" data-testid="zoom-flutuante">
      <button
        type="button"
        className="botao-icone"
        data-testid="zoom-menos"
        title="Afastar"
        aria-label="Afastar"
        onClick={() => aoPasso(0.8)}
      >
        <Minus size={18} />
      </button>
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
      <button
        type="button"
        className="botao-icone"
        data-testid="zoom-mais"
        title="Aproximar"
        aria-label="Aproximar"
        onClick={() => aoPasso(1.25)}
      >
        <Plus size={18} />
      </button>
      <span className="zoom-nivel" data-testid="zoom-nivel">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="botao-icone"
        data-testid="zoom-centralizar"
        title="Centralizar o mapa"
        aria-label="Centralizar o mapa"
        onClick={aoCentralizar}
      >
        <LocateFixed size={18} />
      </button>
    </div>
  );
}
