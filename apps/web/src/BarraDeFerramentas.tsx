import {
  BrickWall,
  Brush,
  CloudFog,
  Dices,
  Hand,
  MousePointer2,
  Ruler,
  SquareDashed,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { IdDoAtalho } from "./atalhos";
import { BotaoComDica } from "./BotaoComDica";
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
  /** Paredes e portas (só do mestre, fora do "ver como"): liga e desliga o modo. */
  podeParedes: boolean;
  aoAlternarParedes: () => void;
  /** Zonas (7b-2, só do mestre, fora do "ver como"): liga e desliga a ferramenta. */
  podeZonas: boolean;
  aoAlternarZonas: () => void;
  /** Névoa (N4, só do mestre, fora do "ver como"): liga e desliga a ferramenta. */
  aoAlternarNevoa: () => void;
};

const MOTIVO_SEM_PINCEL = "Pincel desligado: o mestre tirou de você a permissão de desenhar.";

function Botao(props: {
  testid: string;
  nome: string;
  atalho?: IdDoAtalho | undefined;
  ativo?: boolean;
  gatilho?: boolean;
  /** Sem permissão: continua visível (com o motivo no clique), mas apagado. */
  indisponivel?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <BotaoComDica
      testid={props.testid}
      className="botao-icone"
      nome={props.nome}
      atalho={props.atalho}
      lado="direita"
      aria-label={props.nome}
      aria-pressed={props.ativo}
      aria-disabled={props.indisponivel || undefined}
      data-popover-gatilho={props.gatilho ? "" : undefined}
      onClick={props.aoClicar}
    >
      {props.children}
    </BotaoComDica>
  );
}

/**
 * Barra fixa à esquerda (52 px): selecionar, mão, régua, dados rápidos e pincel (todos) e paredes, portas e zonas (só o mestre). As sub-barras
 * (o pincel) e a grade de dados abrem ao lado dela, sobre o mapa.
 */
export function BarraDeFerramentas(p: Props) {
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);

  const ferramentas: {
    id: "selecionar" | "mao" | "regua";
    nome: string;
    icone: ReactNode;
  }[] = [
    {
      id: "selecionar",
      nome: "Selecionar e mover",
      icone: <MousePointer2 size={20} />,
    },
    {
      id: "mao",
      nome: "Mão",
      icone: <Hand size={20} />,
    },
    {
      id: "regua",
      nome: "Régua",
      icone: <Ruler size={20} />,
    },
  ];
  return (
    <div className="barra-esquerda-area" data-testid="barra-esquerda">
      <nav className="barra-ferramentas" aria-label="Ferramentas" data-testid="barra-ferramentas">
        {ferramentas.map((f) => (
          <Botao
            key={f.id}
            testid={`ferramenta-${f.id}`}
            nome={f.nome}
            atalho={f.id}
            ativo={p.ferramenta === f.id}
            aoClicar={() => p.aoEscolher(f.id)}
          >
            {f.icone}
          </Botao>
        ))}
        <hr />
        <Botao
          testid="ferramenta-dados"
          nome="Dados rápidos"
          ativo={dadosAbertos}
          gatilho
          aoClicar={() => setDadosAbertos(!dadosAbertos)}
        >
          <Dices size={20} />
        </Botao>
        <Botao
          testid="ferramenta-pincel"
          nome={p.podeDesenhar ? "Pincel" : `Pincel — ${MOTIVO_SEM_PINCEL}`}
          ativo={p.ferramenta === "pincel"}
          indisponivel={!p.podeDesenhar}
          aoClicar={() => {
            setDadosAbertos(false);
            if (p.podeDesenhar) p.aoEscolher(p.ferramenta === "pincel" ? "selecionar" : "pincel");
            else setSemPermissao(true);
          }}
        >
          <Brush size={20} />
        </Botao>
        {p.podeParedes && (
          <>
            <hr />
            <Botao
              testid="ferramenta-paredes"
              nome="Paredes e portas"
              ativo={p.ferramenta === "paredes"}
              aoClicar={() => {
                setDadosAbertos(false);
                p.aoAlternarParedes();
              }}
            >
              <BrickWall size={20} />
            </Botao>
            {p.podeZonas && (
              <Botao
                testid="ferramenta-zonas"
                nome="Zonas"
                atalho="zonas"
                ativo={p.ferramenta === "zonas"}
                aoClicar={() => {
                  setDadosAbertos(false);
                  p.aoAlternarZonas();
                }}
              >
                <SquareDashed size={20} />
              </Botao>
            )}
            <Botao
              testid="ferramenta-nevoa"
              nome="Névoa"
              atalho="nevoa"
              ativo={p.ferramenta === "nevoa"}
              aoClicar={() => {
                setDadosAbertos(false);
                p.aoAlternarNevoa();
              }}
            >
              <CloudFog size={20} />
            </Botao>
          </>
        )}
      </nav>
      {p.ferramenta === "pincel" && (
        <SubBarraPincel
          config={p.pincel}
          aoMudar={p.aoMudarPincel}
          aoFechar={() => p.aoEscolher("selecionar")}
          aoDesfazer={p.aoVoltarDesenho}
        />
      )}
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
