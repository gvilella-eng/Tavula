import {
  CirclePlus,
  Clapperboard,
  Crown,
  Eraser,
  Flashlight,
  Map as IconeMapa,
  Layers,
  ListOrdered,
  Moon,
  Pencil,
  Users,
  Zap,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { CAMADAS_DE_TRABALHO, type CamadaDeTrabalho, ROTULO_DA_CAMADA } from "./camadas";
import { Popover } from "./Popover";

type Props = {
  faixaAberta: boolean;
  aoAlternarFaixa: () => void;
  camadaTrabalho: CamadaDeTrabalho;
  aoEscolherCamada: (c: CamadaDeTrabalho) => void;
  visaoNoturna: boolean;
  aoAlternarVisaoNoturna: () => void;
  aoNovoToken: () => void;
  ordemVisivel: boolean;
  aoAlternarOrdem: () => void;
};

const ICONE_DA_CAMADA: Record<CamadaDeTrabalho, ReactNode> = {
  mapa: <IconeMapa size={16} />,
  tokens: <Users size={16} />,
  mestre: <Crown size={16} />,
  desenho: <Pencil size={16} />,
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

type PainelAberto = "camadas" | "eventos" | "iluminacao" | null;

/** Menu rápido do mestre: horizontal, centralizado no topo (PROJETO.md 4.13.1). */
export function MenuSuperior(p: Props) {
  const [aberto, setAberto] = useState<PainelAberto>(null);
  const alternar = (qual: Exclude<PainelAberto, null>) => setAberto(aberto === qual ? null : qual);

  return (
    <div className="menu-superior-area">
      <nav className="barra-horizontal" aria-label="Menu do mestre" data-testid="menu-superior">
        <Botao
          testid="menu-cenas"
          titulo="Cenas"
          ativo={p.faixaAberta}
          aoClicar={p.aoAlternarFaixa}
        >
          <Clapperboard size={20} />
        </Botao>
        <Botao
          testid="menu-camadas"
          titulo="Camadas"
          ativo={aberto === "camadas"}
          gatilho
          aoClicar={() => alternar("camadas")}
        >
          <Layers size={20} />
        </Botao>
        <Botao
          testid="menu-visao-noturna"
          titulo="Visão noturna (ainda sem efeito)"
          ativo={p.visaoNoturna}
          aoClicar={p.aoAlternarVisaoNoturna}
        >
          <Moon size={20} />
        </Botao>
        <Botao testid="novo-token" titulo="Novo token" aoClicar={p.aoNovoToken}>
          <CirclePlus size={20} />
        </Botao>
        <Botao
          testid="menu-eventos"
          titulo="Eventos (em breve)"
          ativo={aberto === "eventos"}
          gatilho
          aoClicar={() => alternar("eventos")}
        >
          <Zap size={20} />
        </Botao>
        <Botao
          testid="menu-iluminacao"
          titulo="Iluminação (em breve)"
          ativo={aberto === "iluminacao"}
          gatilho
          aoClicar={() => alternar("iluminacao")}
        >
          <Flashlight size={20} />
        </Botao>
        <Botao
          testid="menu-ordem-turno"
          titulo="Ordem de turno: mostrar ou esconder para todos"
          ativo={p.ordemVisivel}
          aoClicar={p.aoAlternarOrdem}
        >
          <ListOrdered size={20} />
        </Botao>
      </nav>

      {aberto === "camadas" && (
        <Popover
          testid="popover-camadas"
          titulo="Camada de trabalho"
          className="popover-camadas"
          aoFechar={() => setAberto(null)}
        >
          <ul className="lista-simples">
            {CAMADAS_DE_TRABALHO.map((c) => (
              <li key={c} className="linha-camada">
                <button
                  type="button"
                  className="botao-camada"
                  data-testid={`camada-${c}`}
                  aria-pressed={p.camadaTrabalho === c}
                  onClick={() => {
                    p.aoEscolherCamada(c);
                    setAberto(null);
                  }}
                >
                  {ICONE_DA_CAMADA[c]} {ROTULO_DA_CAMADA[c]}
                </button>
                {c === "desenho" && (
                  <button
                    type="button"
                    className="botao-camada fraco"
                    data-testid="limpar-desenhos"
                    disabled
                    title="Em breve"
                  >
                    <Eraser size={14} /> Limpar desenhos
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="nota">A camada vale por cena. Desenho: em breve.</p>
        </Popover>
      )}
      {aberto === "eventos" && (
        <Popover
          testid="painel-eventos"
          titulo="Eventos"
          className="popover-menu"
          aoFechar={() => setAberto(null)}
        >
          <p className="nota">Em breve: as automações da mesa (tocha apagando, porta rangendo…).</p>
        </Popover>
      )}
      {aberto === "iluminacao" && (
        <Popover
          testid="painel-iluminacao"
          titulo="Iluminação"
          className="popover-menu"
          aoFechar={() => setAberto(null)}
        >
          <p className="nota">Em breve: luz ambiente, tochas e objetos de luz.</p>
        </Popover>
      )}
    </div>
  );
}
