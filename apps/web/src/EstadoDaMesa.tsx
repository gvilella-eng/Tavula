import { formatarRestante } from "@tabletop/shared";
import { ChevronDown, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import { Dica, useDica } from "./Dica";
import { useFecharFora } from "./Popover";
import { useTic } from "./tempo";

type Props = {
  pausada: boolean;
  euMestre: boolean;
  /** Pausa ou retoma (só o mestre vê o botão). */
  aoAlternarPausa: () => void;
  /** O relógio da sala (ms), que só o mestre recebe. */
  salaMs: () => number | undefined;
  /** O marco do último "zerar" (V1, tempo da sala): a pílula mostra o relógio menos ele. */
  marcoMs: number;
  /** Zera o número da pílula (as tochas não mudam). Só o mestre. */
  aoZerarRelogio: () => void;
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
  marcoMs,
}: {
  pausada: boolean;
  salaMs: () => number | undefined;
  marcoMs: number;
}) {
  useTic(!pausada);
  const ms = salaMs();
  return (
    <span className="relogio-sala" data-testid="relogio-sala" data-pausada={pausada}>
      {ms === undefined ? "--:--" : formatarRestante(Math.max(0, ms - marcoMs))}
    </span>
  );
}

/**
 * O menu da pílula do mestre (V1): hoje só o item "Zerar o relógio", com a confirmação ali mesmo. Zerar muda só o
 * número da pílula; o tempo das tochas não é tocado (o marco é da sala, ver `tempoDaPilula`).
 */
function MenuDoRelogio({ aoZerar }: { aoZerar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLSpanElement>(null);
  const fechar = () => {
    setAberto(false);
    setConfirmando(false);
  };
  useFecharFora(caixa, fechar);
  // Ao abrir (e ao passar para a confirmação), o foco vai ao primeiro botão: o menu se usa só pelo teclado.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocar quando o menu abre e quando troca de tela
  useEffect(() => {
    if (aberto) caixa.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, [aberto, confirmando]);
  return (
    <span className="menu-relogio" ref={gatilho}>
      <BotaoComDica
        testid="menu-relogio"
        className="botao-icone menu-relogio-gatilho"
        nome="Opções do relógio"
        dica="Zerar o relógio da mesa"
        semDica={aberto}
        aria-label="Opções do relógio"
        aria-haspopup="menu"
        aria-expanded={aberto}
        data-popover-gatilho=""
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </BotaoComDica>
      {aberto && (
        <div
          ref={caixa}
          className="menu-contexto menu-relogio-lista"
          role="menu"
          aria-label="Opções do relógio"
          data-testid="menu-relogio-lista"
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            fechar();
            gatilho.current?.querySelector<HTMLElement>("button")?.focus();
          }}
        >
          {confirmando ? (
            <div
              className="confirmar-limpar"
              role="alertdialog"
              data-testid="zerar-relogio-confirmacao"
            >
              <p>Zerar o relógio da mesa? As tochas não mudam.</p>
              <div className="acoes-confirmar">
                <button
                  type="button"
                  className="perigo"
                  data-testid="zerar-relogio-confirmar"
                  onClick={() => {
                    aoZerar();
                    fechar();
                  }}
                >
                  Zerar
                </button>
                <button
                  type="button"
                  data-testid="zerar-relogio-cancelar"
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="item-menu"
              data-testid="zerar-relogio"
              onClick={() => setConfirmando(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>Zerar o relógio</span>
            </button>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * No topo, à direita: o estado da mesa, num controle só. Mestre, rodando: botão com Pausar e o relógio da
 * sala dentro dele. Mestre, pausada: pílula de aviso "▶ relógio" (o clique retoma). Jogador, pausada:
 * só o ícone de pausa na pílula, sem clique. A palavra "Pausada" fica no aria-label. O relógio é o tempo da sala, que só o mestre recebe.
 */
export function EstadoDaMesa({
  pausada,
  euMestre,
  aoAlternarPausa,
  salaMs,
  marcoMs,
  aoZerarRelogio,
  mestreOnline,
}: Props) {
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
        <RelogioDaSala pausada={pausada} salaMs={salaMs} marcoMs={marcoMs} />
      </button>
      <MenuDoRelogio aoZerar={aoZerarRelogio} />
    </div>
  );
}
