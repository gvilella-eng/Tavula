import { Brush, Dices, Hand, MousePointer2, Ruler } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DadosRapidos } from "./DadosRapidos";
import type { Ferramenta } from "./mapa/mapaPixi";
import type { ConfigDoPincel } from "./pincel";
import { SubBarraPincel } from "./SubBarraPincel";

type Props = {
  ferramenta: Ferramenta;
  aoEscolher: (f: Ferramenta) => void;
  /** Pede a rolagem à sala; o resultado aparece no chat. */
  aoRolar: (quantidade: number, faces: number, oculta: boolean) => void;
  podeOculta: boolean;
  /** Pincel (Lote 13): a configuração, se posso desenhar (`desenho.criar`) e o "voltar" (apaga o meu mais recente). */
  pincel: ConfigDoPincel;
  aoMudarPincel: (c: ConfigDoPincel) => void;
  podeDesenhar: boolean;
  aoVoltarDesenho: () => void;
};

const MOTIVO_SEM_PINCEL = "Pincel desligado: o mestre tirou de você a permissão de desenhar.";

function Botao(props: {
  testid: string;
  titulo: string;
  ativo?: boolean;
  gatilho?: boolean;
  /** Sem permissão: continua visível (com o motivo no clique), mas apagado. */
  indisponivel?: boolean;
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
      aria-disabled={props.indisponivel || undefined}
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
  const [semPermissao, setSemPermissao] = useState(false);

  // O pincel é uma ferramenta do mapa: a sub-barra aparece enquanto ele é a ferramenta ativa.
  if (p.ferramenta === "pincel") {
    return (
      <div className="barra-esquerda-area">
        <SubBarraPincel
          config={p.pincel}
          aoMudar={p.aoMudarPincel}
          aoFechar={() => p.aoEscolher("selecionar")}
          aoDesfazer={p.aoVoltarDesenho}
        />
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
          titulo={p.podeDesenhar ? "Pincel" : MOTIVO_SEM_PINCEL}
          indisponivel={!p.podeDesenhar}
          aoClicar={() => {
            setDadosAbertos(false);
            if (p.podeDesenhar) p.aoEscolher("pincel");
            else setSemPermissao(true);
          }}
        >
          <Brush size={20} />
        </Botao>
      </nav>
      {semPermissao && !p.podeDesenhar && (
        <div className="dica-da-barra" role="status" data-testid="pincel-sem-permissao">
          {MOTIVO_SEM_PINCEL}
          <button type="button" className="fechar-dica" onClick={() => setSemPermissao(false)}>
            Entendi
          </button>
        </div>
      )}
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
