import { Brush, Dices, Hand, MousePointer2, Ruler } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DadosRapidos } from "./DadosRapidos";
import type { Ferramenta } from "./mapa/mapaPixi";
import { SubBarraPincel } from "./SubBarraPincel";

type Props = {
  ferramenta: Ferramenta;
  aoEscolher: (f: Ferramenta) => void;
  /** Pede a rolagem à sala; o resultado aparece no chat. */
  aoRolar: (quantidade: number, faces: number, oculta: boolean) => void;
  podeOculta: boolean;
};

function Botao(props: {
  testid: string;
  titulo: string;
  ativo?: boolean;
  gatilho?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="botao-icone"
      data-testid={props.testid}
      title={props.titulo}
      aria-label={props.titulo}
      aria-pressed={props.ativo}
      data-popover-gatilho={props.gatilho ? "" : undefined}
      onClick={props.aoClicar}
    >
      {props.children}
    </button>
  );
}

/** Barra vertical à esquerda (todos): selecionar, mão, régua, dados rápidos e pincel. */
export function BarraDeFerramentas(p: Props) {
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const [pincelAberto, setPincelAberto] = useState(false);

  if (pincelAberto) {
    return (
      <div className="barra-esquerda-area">
        <SubBarraPincel aoVoltar={() => setPincelAberto(false)} />
      </div>
    );
  }

  const ferramentas: { id: Ferramenta; titulo: string; icone: ReactNode }[] = [
    { id: "selecionar", titulo: "Selecionar e mover (V)", icone: <MousePointer2 size={20} /> },
    { id: "mao", titulo: "Mão: arrastar o mapa (H)", icone: <Hand size={20} /> },
    { id: "regua", titulo: "Régua (R)", icone: <Ruler size={20} /> },
  ];
  return (
    <div className="barra-esquerda-area">
      <nav className="barra-ferramentas" aria-label="Ferramentas" data-testid="barra-ferramentas">
        {ferramentas.map((f) => (
          <Botao
            key={f.id}
            testid={`ferramenta-${f.id}`}
            titulo={f.titulo}
            ativo={p.ferramenta === f.id}
            aoClicar={() => p.aoEscolher(f.id)}
          >
            {f.icone}
          </Botao>
        ))}
        <hr />
        <Botao
          testid="ferramenta-dados"
          titulo="Dados rápidos"
          ativo={dadosAbertos}
          gatilho
          aoClicar={() => setDadosAbertos(!dadosAbertos)}
        >
          <Dices size={20} />
        </Botao>
        <Botao
          testid="ferramenta-pincel"
          titulo="Pincel (em breve)"
          aoClicar={() => {
            setDadosAbertos(false);
            setPincelAberto(true);
          }}
        >
          <Brush size={20} />
        </Botao>
      </nav>
      {dadosAbertos && (
        <DadosRapidos
          podeOculta={p.podeOculta}
          aoRolar={(q, f, oculta) => {
            p.aoRolar(q, f, oculta);
            setDadosAbertos(false);
          }}
          aoFechar={() => setDadosAbertos(false)}
        />
      )}
    </div>
  );
}
