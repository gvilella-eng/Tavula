import { formatarRestante } from "@tabletop/shared";
import { Pause, Play } from "lucide-react";
import { useRef } from "react";
import { Dica, useDica } from "./Dica";
import { useTic } from "./tempo";

type Props = {
  pausada: boolean;
  euMestre: boolean;
  /** Pausa ou retoma (só o mestre vê o botão). */
  aoAlternarPausa: () => void;
  /** O relógio da sala (ms), que só o mestre recebe. */
  salaMs: () => number | undefined;
  /** Algum mestre está online (presença). Pausada sem mestre = a pausa automática do R2b. */
  mestreOnline: boolean;
};

/** A dica da pílula do jogador: a pausa manual e a automática (o mestre saiu da mesa) são diferentes. */
export const DICA_PAUSA_MANUAL = "O mestre pausou a mesa: o tempo das tochas está parado";
export const DICA_PAUSA_SEM_MESTRE =
  "Pausada: o mestre saiu da mesa; ela volta quando o mestre retomar";

/** O relógio da sala: conta sozinho entre os envios da sala (e para na pausa). */
function RelogioDaSala({
  pausada,
  salaMs,
}: {
  pausada: boolean;
  salaMs: () => number | undefined;
}) {
  useTic(!pausada);
  const ms = salaMs();
  return (
    <span className="relogio-sala" data-testid="relogio-sala" data-pausada={pausada}>
      {ms === undefined ? "--:--" : formatarRestante(ms)}
    </span>
  );
}

/**
 * No topo, à direita: o estado da mesa, num controle só. Mestre, rodando: botão com Pausar e o relógio da
 * sala dentro dele. Mestre, pausada: pílula de aviso "▶ relógio" (o clique retoma). Jogador, pausada:
 * só o ícone de pausa na pílula, sem clique. A palavra "Pausada" fica no aria-label. O relógio é o tempo da sala, que só o mestre recebe.
 */
export function EstadoDaMesa({ pausada, euMestre, aoAlternarPausa, salaMs, mestreOnline }: Props) {
  const selo = useRef<HTMLSpanElement>(null);
  const dica = useDica();
  if (!euMestre) {
    return (
      <div
        className="estado-mesa estado-mesa-jogador"
        data-testid="estado-mesa"
        data-pausada={pausada}
        data-sem-mestre={pausada && !mestreOnline}
      >
        {pausada && (
          <>
            {/* A dica comum (R6b): no mouse e no foco do teclado, como nos botões. */}
            <span
              ref={selo}
              className="estado-mesa-selo"
              data-testid="estado-mesa-selo"
              role="status"
              aria-label="Mesa pausada"
              aria-describedby={dica.id}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: o selo é só informação, mas a dica tem de valer no foco do teclado
              tabIndex={0}
              onMouseEnter={dica.mostrar}
              onMouseLeave={dica.esconder}
              onFocus={dica.mostrar}
              onBlur={dica.esconder}
              onKeyDown={dica.aoTeclar}
            >
              <Pause size={14} aria-hidden="true" />
            </span>
            <Dica
              alvo={selo}
              id={dica.id}
              visivel={dica.visivel}
              testid="dica-estado-mesa-selo"
              texto={mestreOnline ? DICA_PAUSA_MANUAL : DICA_PAUSA_SEM_MESTRE}
            />
          </>
        )}
      </div>
    );
  }
  return (
    <div className="estado-mesa" data-testid="estado-mesa" data-pausada={pausada}>
      <button
        type="button"
        className={pausada ? "estado-mesa-botao pausada" : "estado-mesa-botao"}
        data-testid="menu-pausa"
        title={
          pausada
            ? "Retomar a mesa (o tempo volta a correr)"
            : "Pausar a mesa (congela o tempo das tochas)"
        }
        aria-label={pausada ? "Retomar a mesa" : "Pausar a mesa"}
        aria-pressed={pausada}
        onClick={aoAlternarPausa}
      >
        {pausada ? (
          <span
            className="estado-mesa-selo-icone"
            data-testid="estado-mesa-selo"
            role="status"
            aria-label="Mesa pausada"
          >
            <Play size={16} aria-hidden="true" />
          </span>
        ) : (
          <Pause size={16} aria-hidden="true" />
        )}
        <RelogioDaSala pausada={pausada} salaMs={salaMs} />
      </button>
    </div>
  );
}
