import { TIPOS_DE_PAREDE, type TipoDeParede } from "@tabletop/shared";
import { BrickWall, DoorOpen, EyeOff, Ghost, type LucideIcon, PanelTop } from "lucide-react";
import { useRef } from "react";
import { Dica, useDica } from "./Dica";
import { ESTILO_DA_PAREDE } from "./mapa/mapaPixi";

export const ROTULO_DO_TIPO: Record<TipoDeParede, string> = {
  parede: "Parede",
  porta: "Porta",
  janela: "Janela",
  secreta: "Secreta",
  invisivel: "Invisível",
};

const ICONE_DO_TIPO: Record<TipoDeParede, LucideIcon> = {
  parede: BrickWall,
  porta: DoorOpen,
  janela: PanelTop,
  secreta: EyeOff,
  invisivel: Ghost,
};

/** O que cada tipo faz, conferido em `packages/shared/src/paredes.ts` (visão, passagem e o que o jogador vê). */
const DICA_DO_TIPO: Record<TipoDeParede, string> = {
  parede: "Bloqueia visão e passagem.",
  porta: "Bloqueia até abrir; o ícone abre, fecha e tranca.",
  janela: "Deixa ver e a luz passar; bloqueia a passagem.",
  secreta: "Os jogadores a veem como parede; só o mestre a abre.",
  invisivel: "Bloqueia a passagem sem aparecer nem tapar a visão.",
};

function corCss(cor: number): string {
  return `#${cor.toString(16).padStart(6, "0")}`;
}

/** A amostra do traço: a mesma cor e a mesma espessura com que o mapa desenha o tipo. */
function Amostra({ tipo }: { tipo: TipoDeParede }) {
  const estilo = ESTILO_DA_PAREDE[tipo];
  return (
    <svg className="tipo-de-parede-amostra" width="36" height="12" viewBox="0 0 36 12" aria-hidden>
      <title>Amostra do traço</title>
      <line
        x1="3"
        y1="6"
        x2="33"
        y2="6"
        stroke={corCss(estilo.cor)}
        strokeWidth={estilo.largura}
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  valor: TipoDeParede;
  aoEscolher: (t: TipoDeParede) => void;
};

function LinhaDoTipo({
  tipo,
  ativo,
  aoEscolher,
}: {
  tipo: TipoDeParede;
  ativo: boolean;
  aoEscolher: () => void;
}) {
  const Icone = ICONE_DO_TIPO[tipo];
  const linha = useRef<HTMLLabelElement>(null);
  const d = useDica();
  return (
    <>
      <label
        ref={linha}
        className="tipo-de-parede"
        data-ativo={ativo}
        onMouseEnter={d.aoEntrarMouse}
        onMouseLeave={d.esconder}
      >
        <input
          type="radio"
          className="tipo-de-parede-radio"
          name="tipo-de-parede-novo"
          data-testid={`parede-novo-${tipo}`}
          aria-describedby={d.id}
          checked={ativo}
          onChange={aoEscolher}
          onClick={d.esconder}
          onFocus={d.aoFocar}
          onBlur={d.esconder}
          onKeyDown={(e) => d.aoTeclar(e)}
        />
        <Icone size={18} aria-hidden />
        <span className="tipo-de-parede-nome">{ROTULO_DO_TIPO[tipo]}</span>
        <Amostra tipo={tipo} />
      </label>
      <Dica
        alvo={linha}
        id={d.id}
        visivel={d.visivel}
        testid={`dica-parede-novo-${tipo}`}
        nome={DICA_DO_TIPO[tipo]}
        lado="direita"
      />
    </>
  );
}

/**
 * V14: o tipo das paredes novas como lista vertical (radiogroup de verdade, com rádios nativos): ícone, nome e,
 * à direita, a amostra do traço. A dica do que o tipo faz aparece ao lado, no mouse e no foco (a lista é curta
 * para não cobrir o mapa). As setas mudam o tipo; só a linha ativa está na ordem do Tab; a ativa fica
 * destacada como as abas.
 */
export function ListaDeTiposDeParede({ valor, aoEscolher }: Props) {
  return (
    <div
      className="tipos-de-parede"
      role="radiogroup"
      aria-label="Desenhar como"
      data-testid="parede-tipos"
    >
      {TIPOS_DE_PAREDE.map((t) => (
        <LinhaDoTipo key={t} tipo={t} ativo={valor === t} aoEscolher={() => aoEscolher(t)} />
      ))}
    </div>
  );
}
