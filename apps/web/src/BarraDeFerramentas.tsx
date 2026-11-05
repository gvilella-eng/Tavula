import type { Camada } from "@tabletop/shared";
import { CirclePlus, Crown, Hand, Layers, MousePointer2, Ruler } from "lucide-react";
import type { ReactNode } from "react";
import type { Ferramenta } from "./mapa/mapaPixi";

type Props = {
  ferramenta: Ferramenta;
  aoEscolher: (f: Ferramenta) => void;
  euMestre: boolean;
  camadaTrabalho: Camada;
  aoEscolherCamada: (c: Camada) => void;
  aoNovoToken: () => void;
};

function Botao(props: {
  testid: string;
  titulo: string;
  ativo?: boolean;
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
      onClick={props.aoClicar}
    >
      {props.children}
    </button>
  );
}

/** Barra vertical à esquerda. "Novo token" e o seletor de camada só aparecem para o mestre. */
export function BarraDeFerramentas(p: Props) {
  const ferramentas: { id: Ferramenta; titulo: string; icone: ReactNode }[] = [
    { id: "selecionar", titulo: "Selecionar e mover (V)", icone: <MousePointer2 size={20} /> },
    { id: "mao", titulo: "Mão: arrastar o mapa (H)", icone: <Hand size={20} /> },
    { id: "regua", titulo: "Régua (R)", icone: <Ruler size={20} /> },
  ];
  return (
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
      {p.euMestre && (
        <>
          <hr />
          <Botao testid="novo-token" titulo="Novo token" aoClicar={p.aoNovoToken}>
            <CirclePlus size={20} />
          </Botao>
          <div className="camadas">
            <Botao
              testid="camada-tokens"
              titulo="Trabalhar na camada de tokens"
              ativo={p.camadaTrabalho === "tokens"}
              aoClicar={() => p.aoEscolherCamada("tokens")}
            >
              <Layers size={20} />
            </Botao>
            <Botao
              testid="camada-mestre"
              titulo="Trabalhar na camada do mestre"
              ativo={p.camadaTrabalho === "mestre"}
              aoClicar={() => p.aoEscolherCamada("mestre")}
            >
              <Crown size={20} />
            </Botao>
          </div>
        </>
      )}
    </nav>
  );
}
