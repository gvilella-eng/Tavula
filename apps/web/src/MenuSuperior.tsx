import type { Usuario } from "@tabletop/shared";
import {
  Check,
  CirclePlus,
  Clapperboard,
  Crown,
  Eraser,
  Eye,
  Flame,
  Flashlight,
  Map as IconeMapa,
  Layers,
  Lightbulb,
  ListOrdered,
  Moon,
  Pencil,
  SlidersHorizontal,
  Sun,
  User,
  Users,
} from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
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
  /** Abre a aba Mesa, já na seção dos modelos de tocha e objetos de luz. */
  aoAbrirModelosDeTocha: () => void;
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

/**
 * Botão do menu do mestre. O nome vai no `aria-label` e a dica (nome e o que faz) aparece ao passar o
 * mouse e ao receber o foco do teclado. Com a lista do botão aberta, a dica sai da frente.
 */
function Botao(props: {
  testid: string;
  /** O nome do botão (`aria-label` e título da dica). */
  nome: string;
  /** O que ele faz, em uma frase (segunda linha da dica). */
  dica: string;
  ativo?: boolean;
  /** Mostra um pontinho de alerta no ícone (algo importante está desligado). */
  alerta?: boolean;
  gatilho?: boolean;
  /** A lista ou painel deste botão está aberta: a dica não aparece. */
  aberto?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  const [dicaVisivel, setDicaVisivel] = useState(false);
  const idDaDica = useId();
  return (
    <span className="menu-botao">
      <button
        type="button"
        className={props.alerta ? "botao-icone com-alerta" : "botao-icone"}
        data-testid={props.testid}
        aria-label={props.nome}
        aria-describedby={idDaDica}
        aria-pressed={props.ativo}
        data-popover-gatilho={props.gatilho ? "" : undefined}
        onClick={() => {
          setDicaVisivel(false);
          props.aoClicar();
        }}
        onMouseEnter={() => setDicaVisivel(true)}
        onMouseLeave={() => setDicaVisivel(false)}
        onFocus={() => setDicaVisivel(true)}
        onBlur={() => setDicaVisivel(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDicaVisivel(false);
        }}
      >
        {props.children}
      </button>
      <span
        id={idDaDica}
        role="tooltip"
        className="dica-do-menu"
        data-testid={`dica-${props.testid}`}
        hidden={!dicaVisivel || props.aberto}
      >
        <strong>{props.nome}</strong>
        <span>{props.dica}</span>
      </span>
    </span>
  );
}

/** Um grupo do menu: os botões e, embaixo, o nome do grupo. */
function Grupo(props: { id: string; nome: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: grupo de botões com nome; o fieldset é de formulário
    <div
      className="menu-grupo"
      role="group"
      aria-label={props.nome}
      data-testid={`menu-grupo-${props.id}`}
    >
      <div className="menu-grupo-botoes">{props.children}</div>
      <span className="menu-grupo-nome" aria-hidden="true">
        {props.nome}
      </span>
    </div>
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

type PainelAberto = "camadas" | "iluminacao" | "verComo" | null;

/**
 * Menu do mestre, no topo da mesa depois do nome da cena (a pausa e o relógio estão em `EstadoDaMesa`).
 * Grupos com nome: Cena (cenas, camadas), Mapa (novo token), Luz (visão noturna, iluminação), Combate
 * (ordem de turno) e Ver como. Paredes e portas é ferramenta da barra da esquerda.
 */
export function MenuSuperior(p: Props) {
  const [aberto, setAberto] = useState<PainelAberto>(null);
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const alternar = (qual: Exclude<PainelAberto, null>) => {
    setConfirmandoLimpar(false);
    setAberto(aberto === qual ? null : qual);
  };
  const vendoComo = p.jogadores.find((j) => j.id === p.verComoId);

  return (
    <div className="menu-superior-area">
      <nav className="barra-horizontal" aria-label="Menu do mestre" data-testid="menu-superior">
        <Grupo id="cena" nome="Cena">
          <Botao
            testid="menu-cenas"
            nome="Cenas"
            dica="Abre a faixa de cenas: trocar de cena, levar o grupo, criar e configurar (nome, mapa e grid)."
            ativo={p.faixaAberta}
            aoClicar={p.aoAlternarFaixa}
          >
            <Clapperboard size={20} />
          </Botao>
          <Botao
            testid="menu-camadas"
            nome="Camadas"
            dica="Escolhe em que camada você trabalha (mapa, tokens, mestre ou desenho) e limpa os desenhos."
            ativo={aberto === "camadas"}
            aberto={aberto === "camadas"}
            gatilho
            aoClicar={() => alternar("camadas")}
          >
            <Layers size={20} />
          </Botao>
        </Grupo>
        <Grupo id="mapa" nome="Mapa">
          <Botao
            testid="novo-token"
            nome="Novo token"
            dica="Pede o nome, a cor e o tamanho; depois você clica no mapa para pôr o token."
            aoClicar={p.aoNovoToken}
          >
            <CirclePlus size={20} />
          </Botao>
        </Grupo>
        <Grupo id="luz" nome="Luz">
          <Botao
            testid="menu-visao-noturna"
            nome="Visão noturna"
            dica={
              p.visaoNoturna
                ? "Ligada: você vê a cena iluminada só pelas fontes de luz. Só na sua tela."
                : "Desligada: você vê a cena toda clara. Só na sua tela."
            }
            ativo={p.visaoNoturna}
            aoClicar={p.aoAlternarVisaoNoturna}
          >
            <Moon size={20} />
          </Botao>
          <span className="botao-com-lista">
            <Botao
              testid="menu-iluminacao"
              nome={p.iluminacaoDinamica ? "Iluminação" : "Iluminação (desligada nesta cena)"}
              dica={
                p.iluminacaoDinamica
                  ? "Liga e desliga a iluminação dinâmica, abre as fontes de luz e os ajustes."
                  : "A iluminação dinâmica está DESLIGADA nesta cena: os jogadores veem tudo. Abra para ligar."
              }
              ativo={aberto === "iluminacao"}
              aberto={aberto === "iluminacao"}
              alerta={!p.iluminacaoDinamica}
              gatilho
              aoClicar={() => alternar("iluminacao")}
            >
              <Lightbulb size={20} />
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
                    icone: <Sun size={16} />,
                    marcado: p.iluminacaoDinamica,
                    estado: {
                      ligado: p.iluminacaoDinamica,
                      ligadoRotulo: "Ligada",
                      desligadoRotulo: "Desligada",
                    },
                    aoClicar: p.aoAlternarIluminacao,
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
                  {
                    id: "modelos",
                    rotulo: "Modelos de tocha…",
                    icone: <Flashlight size={16} />,
                    dica: "Abre a aba Mesa na seção dos modelos de tocha e objetos de luz",
                    aoClicar: p.aoAbrirModelosDeTocha,
                  },
                ]}
              />
            )}
          </span>
        </Grupo>
        <Grupo id="combate" nome="Combate">
          <Botao
            testid="menu-ordem-turno"
            nome="Ordem de turno"
            dica="Mostra ou esconde a ordem de turno para todos."
            ativo={p.ordemVisivel}
            aoClicar={p.aoAlternarOrdem}
          >
            <ListOrdered size={20} />
          </Botao>
        </Grupo>
        <Grupo id="ver-como" nome="Ver como">
          <span className="botao-com-lista">
            <Botao
              testid="menu-ver-como"
              nome="Ver como"
              dica={
                vendoComo
                  ? `Você está vendo a mesa como ${vendoComo.nome}. Escolha outro jogador ou volte a você.`
                  : "Vê a mesa pelos olhos de um jogador (o que ele enxerga e controla). Só na sua tela."
              }
              ativo={p.verComoId !== null}
              aberto={aberto === "verComo"}
              gatilho
              aoClicar={() => alternar("verComo")}
            >
              <Eye size={20} />
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
          </span>
        </Grupo>
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
    </div>
  );
}
