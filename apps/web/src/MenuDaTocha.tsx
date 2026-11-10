import type { Estado } from "@tabletop/shared";
import { Backpack, Flame, FlameKindling, HandGrab } from "lucide-react";
import { useRef } from "react";
import { dentroDaArea } from "./area";
import { useFecharFora } from "./Popover";

type Props = {
  estado: Estado;
  luzId: string;
  /** Posição do clique na página. */
  x: number;
  y: number;
  /** O personagem que mexe (para pegar do suporte). */
  personagemId: string | undefined;
  enviar: (tipo: string, dados: object) => string | null;
  aoFechar: () => void;
};

/**
 * Menu do botão direito na alça da tocha (ou no objeto de um ponto): guardar na mochila, apagar ou
 * reacender, pegar do suporte. Quem decide se pode é a sala (capacidade, alcance, mãos).
 */
export function MenuDaTocha({ estado, luzId, x, y, personagemId, enviar, aoFechar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const luz = estado.luzes.find((l) => l.id === luzId);
  if (!luz) return null;
  const acesa = luz.estado === "acesa";
  const noPonto = luz.portador.tipo === "ponto" ? luz.portador.pontoId : null;
  const suporte = noPonto
    ? estado.pontos.find((p) => p.id === noPonto && p.tipo === "suporte")
    : undefined;
  const { left: esquerda, top: topo } = dentroDaArea(x, y, 212, 132);

  const item = (
    id: string,
    rotulo: string,
    icone: React.ReactNode,
    acao: () => void,
    desabilitado = false,
  ) => (
    <button
      key={id}
      type="button"
      role="menuitem"
      className="item-menu"
      data-testid={`menu-tocha-${id}`}
      disabled={desabilitado}
      onClick={() => {
        aoFechar();
        acao();
      }}
    >
      {icone}
      <span>{rotulo}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      className="menu-contexto"
      role="menu"
      aria-label={`Tocha: ${luz.nome}`}
      data-testid="menu-tocha"
      style={{ left: esquerda, top: topo }}
    >
      <div className="nota menu-titulo">{luz.nome}</div>
      {luz.portador.tipo === "mao" &&
        item("guardar", "Guardar na mochila", <Backpack size={16} />, () =>
          enviar("tocha.guardar", { id: luz.id }),
        )}
      {suporte &&
        item(
          "pegar",
          "Pegar do suporte",
          <HandGrab size={16} />,
          () => personagemId && enviar("ponto.pegar", { id: luz.id, personagemId }),
          personagemId === undefined,
        )}
      {item(
        "alternar",
        acesa ? "Apagar" : "Reacender",
        acesa ? <FlameKindling size={16} /> : <Flame size={16} />,
        () => enviar("tocha.alternar", { id: luz.id }),
      )}
    </div>
  );
}
