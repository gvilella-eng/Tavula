import type { Usuario } from "@tabletop/shared";
import {
  BrickWall,
  Check,
  CirclePlus,
  Clapperboard,
  Crown,
  Eraser,
  Flame,
  Flashlight,
  Map as IconeMapa,
  Layers,
  Lightbulb,
  ListOrdered,
  Moon,
  Pencil,
  SlidersHorizontal,
  User,
  Users,
  Zap,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { CAMADAS_DE_TRABALHO, type CamadaDeTrabalho, ROTULO_DA_CAMADA } from "./camadas";
import { Popover, useFecharFora } from "./Popover";

type Props = {
  faixaAberta: boolean;
  aoAlternarFaixa: () => void;
  camadaTrabalho: CamadaDeTrabalho;
  aoEscolherCamada: (c: CamadaDeTrabalho) => void;
  visaoNoturna: boolean;
  aoAlternarVisaoNoturna: () => void;
  aoNovoToken: () => void;
  /** Apaga todos os desenhos da cena que o mestre está vendo (a tela pede a confirmação). */
  aoLimparDesenhos: () => void;
  desenhosNaCena: number;
  ordemVisivel: boolean;
  aoAlternarOrdem: () => void;
  /** Iluminação dinâmica da cena que o mestre olha (liga/desliga a visão por paredes dos jogadores). */
  iluminacaoDinamica: boolean;
  aoAlternarIluminacao: () => void;
  /** O painel de fontes de luz e o de configurações estão abertos? */
  fontesAbertas: boolean;
  aoAlternarFontes: () => void;
  configAberta: boolean;
  aoAlternarConfig: () => void;
  /** A ferramenta de paredes e portas está ativa? */
  paredesAtivas: boolean;
  aoAlternarParedes: () => void;
  /** Jogadores para o "ver como" e quem o mestre está vendo (`null` = ele mesmo). */
  jogadores: Usuario[];
  verComoId: string | null;
  aoVerComo: (id: string | null) => void;
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
  /** Mostra um pontinho de alerta no ícone (algo importante está desligado). */
  alerta?: boolean;
  gatilho?: boolean;
  aoClicar: () => void;
  /** Clique direito (o menu de contexto do navegador não abre). */
  aoClicarDireito?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={props.alerta ? "botao-icone com-alerta" : "botao-icone"}
      data-testid={props.testid}
      title={props.titulo}
      aria-label={props.titulo}
      aria-pressed={props.ativo}
      data-popover-gatilho={props.gatilho ? "" : undefined}
      onClick={props.aoClicar}
      onContextMenu={(e) => {
        if (!props.aoClicarDireito) return;
        e.preventDefault();
        props.aoClicarDireito();
      }}
    >
      {props.children}
    </button>
  );
}

type ItemDaLista = {
  id: string;
  rotulo: string;
  icone: ReactNode;
  /** `true`/`false`: item de liga/desliga (mostra o visto quando ligado). */
  marcado?: boolean;
  /** Mostra o estado por extenso ("Ligada", "Desligada") em destaque, além do visto. */
  estado?: { ligado: boolean; ligadoRotulo: string; desligadoRotulo: string };
  desabilitado?: boolean;
  dica?: string;
  aoClicar: () => void;
};

/**
 * Lista que abre logo abaixo do ícone, no estilo do menu de contexto da faixa de cenas. Fecha ao
 * clicar fora, com Esc ou ao escolher um item.
 */
function ListaDoMenu(props: {
  testid: string;
  titulo: string;
  itens: ItemDaLista[];
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, props.aoFechar);
  return (
    <div
      ref={ref}
      className="menu-contexto menu-lista"
      role="menu"
      aria-label={props.titulo}
      data-testid={props.testid}
    >
      {props.itens.map((i) => (
        <button
          key={i.id}
          type="button"
          {...(i.marcado === undefined
            ? { role: "menuitem" }
            : { role: "menuitemcheckbox", "aria-checked": i.marcado })}
          className="item-menu"
          data-testid={`${props.testid}-${i.id}`}
          disabled={i.desabilitado}
          title={i.dica}
          onClick={() => {
            props.aoFechar();
            i.aoClicar();
          }}
        >
          {i.icone}
          <span>{i.rotulo}</span>
          {i.estado && (
            <span
              className="item-menu-estado"
              data-testid={`${props.testid}-${i.id}-estado`}
              data-ligado={i.estado.ligado}
            >
              {i.estado.ligado ? i.estado.ligadoRotulo : i.estado.desligadoRotulo}
            </span>
          )}
          {i.marcado && !i.estado && <Check size={14} className="item-menu-visto" />}
        </button>
      ))}
    </div>
  );
}

type PainelAberto = "camadas" | "eventos" | "iluminacao" | "verComo" | null;

/** Menu rápido do mestre: vai no topo da mesa, depois do nome da cena (a pausa e o relógio estão em `EstadoDaMesa`). */
export function MenuSuperior(p: Props) {
  const [aberto, setAberto] = useState<PainelAberto>(null);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const alternar = (qual: Exclude<PainelAberto, null>) => {
    setConfirmandoLimpar(false);
    setAberto(aberto === qual ? null : qual);
  };

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
        <div className="botao-com-lista">
          <Botao
            testid="menu-visao-noturna"
            titulo="Visão noturna (clique direito: ver como um jogador)"
            ativo={p.visaoNoturna}
            gatilho
            aoClicar={p.aoAlternarVisaoNoturna}
            aoClicarDireito={() => alternar("verComo")}
          >
            <Moon size={20} />
          </Botao>
          {aberto === "verComo" && (
            <ListaDoMenu
              testid="ver-como"
              titulo="Ver como"
              aoFechar={() => setAberto(null)}
              itens={[
                {
                  id: "eu",
                  rotulo: "Eu mesmo (mestre)",
                  icone: <Crown size={16} />,
                  marcado: p.verComoId === null,
                  aoClicar: () => p.aoVerComo(null),
                },
                ...p.jogadores.map((j) => ({
                  id: j.id,
                  rotulo: j.nome,
                  icone: <User size={16} />,
                  marcado: p.verComoId === j.id,
                  aoClicar: () => p.aoVerComo(j.id),
                })),
              ]}
            />
          )}
        </div>
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
        <div className="botao-com-lista">
          <Botao
            testid="menu-iluminacao"
            titulo={
              p.iluminacaoDinamica
                ? "Iluminação"
                : "Iluminação (a iluminação dinâmica está DESLIGADA nesta cena)"
            }
            ativo={aberto === "iluminacao" || p.paredesAtivas}
            alerta={!p.iluminacaoDinamica}
            gatilho
            aoClicar={() => alternar("iluminacao")}
          >
            <Flashlight size={20} />
          </Botao>
          {aberto === "iluminacao" && (
            <ListaDoMenu
              testid="lanterna"
              titulo="Iluminação"
              aoFechar={() => setAberto(null)}
              itens={[
                {
                  id: "iluminacao",
                  rotulo: "Iluminação dinâmica",
                  icone: <Lightbulb size={16} />,
                  marcado: p.iluminacaoDinamica,
                  estado: {
                    ligado: p.iluminacaoDinamica,
                    ligadoRotulo: "Ligada",
                    desligadoRotulo: "Desligada",
                  },
                  aoClicar: p.aoAlternarIluminacao,
                },
                {
                  id: "paredes",
                  rotulo: "Paredes e portas",
                  icone: <BrickWall size={16} />,
                  marcado: p.paredesAtivas,
                  aoClicar: p.aoAlternarParedes,
                },
                {
                  id: "fontes",
                  rotulo: "Fontes de luz",
                  icone: <Flame size={16} />,
                  marcado: p.fontesAbertas,
                  aoClicar: p.aoAlternarFontes,
                },
                {
                  id: "config",
                  rotulo: "Configurações de iluminação",
                  icone: <SlidersHorizontal size={16} />,
                  marcado: p.configAberta,
                  aoClicar: p.aoAlternarConfig,
                },
              ]}
            />
          )}
        </div>
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
          aoFechar={() => {
            setAberto(null);
            setConfirmandoLimpar(false);
          }}
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
                    disabled={p.desenhosNaCena === 0}
                    title={
                      p.desenhosNaCena === 0
                        ? "Não há desenhos nesta cena"
                        : "Apagar todos os desenhos desta cena"
                    }
                    onClick={() => setConfirmandoLimpar(true)}
                  >
                    <Eraser size={14} /> Limpar desenhos
                  </button>
                )}
              </li>
            ))}
          </ul>
          {confirmandoLimpar && p.desenhosNaCena > 0 && (
            <div
              className="confirmar-limpar"
              role="alertdialog"
              data-testid="limpar-desenhos-confirmacao"
            >
              <p>
                Apagar {p.desenhosNaCena === 1 ? "o desenho" : `os ${p.desenhosNaCena} desenhos`}{" "}
                desta cena para todos? Não dá para desfazer.
              </p>
              <div className="acoes-confirmar">
                <button
                  type="button"
                  className="perigo"
                  data-testid="limpar-desenhos-confirmar"
                  onClick={() => {
                    p.aoLimparDesenhos();
                    setConfirmandoLimpar(false);
                    setAberto(null);
                  }}
                >
                  Apagar
                </button>
                <button
                  type="button"
                  data-testid="limpar-desenhos-cancelar"
                  onClick={() => setConfirmandoLimpar(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <p className="nota">
            A camada vale por cena. Os desenhos ficam sempre por cima, visíveis para todos (também
            no escuro).
          </p>
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
    </div>
  );
}
