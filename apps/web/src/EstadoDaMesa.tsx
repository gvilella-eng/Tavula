import { formatarRestante } from "@tabletop/shared";
import { Pause, Play } from "lucide-react";
import { useTic } from "./tempo";

type Props = {
  pausada: boolean;
  euMestre: boolean;
  /** Pausa ou retoma (só o mestre vê o botão). */
  aoAlternarPausa: () => void;
  /** O relógio da sala (ms), que só o mestre recebe. */
  salaMs: () => number | undefined;
};

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
export function EstadoDaMesa({ pausada, euMestre, aoAlternarPausa, salaMs }: Props) {
  if (!euMestre) {
    return (
      <div className="estado-mesa" data-testid="estado-mesa" data-pausada={pausada}>
        {pausada && (
          <span
            className="estado-mesa-selo"
            data-testid="estado-mesa-selo"
            role="status"
            aria-label="Mesa pausada"
            title="O mestre pausou a mesa: o tempo das tochas está parado"
          >
            <Pause size={14} aria-hidden="true" />
          </span>
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
