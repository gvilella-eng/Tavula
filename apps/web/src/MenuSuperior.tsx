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
  Workflow,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import { CAMADAS_DE_TRABALHO, type CamadaDeTrabalho, ROTULO_DA_CAMADA } from "./camadas";
import { Popover, useFecharFora } from "./Popover";

type Props = {
  faixaAberta: boolean;
  aoAlternarFaixa: () => void;
  camadaTrabalho: CamadaDeTrabalho;
  aoEscolherCamada: (c: CamadaDeTrabalho) => void;
  visaoDoMestre: boolean;
  aoAlternarVisaoDoMestre: () => void;
  aoNovoToken: () => void;
  /** Apaga todos os desenhos da cena que o mestre está vendo (a tela pede a confirmação). */
  aoLimparDesenhos: () => void;
  desenhosNaCena: number;
  ordemVisivel: boolean;
  aoAlternarOrdem: () => void;
  /** Iluminação dinâmica da cena que o mestre olha (liga/desliga a visão por paredes dos jogadores). */
  iluminacaoDinamica: boolean;
  /** V10c: a cena é um cartão: sem luz nem visão, qualquer que seja a configuração guardada. */
  cenaCartao?: boolean;
  aoAlternarIluminacao: () => void;
  /** O painel de fontes de luz e o de configurações estão abertos? */
  fontesAbertas: boolean;
  aoAlternarFontes: () => void;
  configAberta: boolean;
  aoAlternarConfig: () => void;
  /** Q8: a janela das automações está aberta? */
  automacoesAbertas: boolean;
  aoAlternarAutomacoes: () => void;
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
 * Botão do menu do mestre: o nome vai no `aria-label` e na dica de uma linha ("Grupo · Nome"), que aparece ao parar o
 * mouse em cima (700 ms) e ao receber o foco do teclado. Com a lista do botão aberta, a dica sai da frente.
 */
function Botao(props: {
  testid: string;
  /** O nome do botão (`aria-label`). */
  nome: string;
  /** O grupo do botão: a dica diz "Grupo · Nome" (os grupos não têm rótulo na barra, V3). */
  grupo: string;
  ativo?: boolean;
  /** Mostra um pontinho de alerta no ícone (algo importante está desligado). */
  alerta?: boolean;
  gatilho?: boolean;
  /** A lista ou painel deste botão está aberta: a dica não aparece. */
  aberto?: boolean;
  aoClicar: () => void;
  children: ReactNode;
}) {
  return (
    <span className="menu-botao">
      <BotaoComDica
        testid={props.testid}
        className={props.alerta ? "botao-icone com-alerta" : "botao-icone"}
        nome={props.grupo === props.nome ? props.nome : `${props.grupo} · ${props.nome}`}
        semDica={props.aberto}
        aria-label={props.nome}
        aria-pressed={props.ativo}
        data-popover-gatilho={props.gatilho ? "" : undefined}
        onClick={props.aoClicar}
      >
        {props.children}
      </BotaoComDica>
    </span>
  );
}

/** Um grupo do menu: os botões, num conjunto com nome só para leitor de tela (a dica de cada botão diz o grupo). */
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
 * Grupos com nome: Cena (cenas, camadas), Mapa (novo token), Luz (visão do mestre, iluminação), Combate
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
            grupo="Cena"
            nome="Cenas"
            ativo={p.faixaAberta}
            aoClicar={p.aoAlternarFaixa}
          >
            <Clapperboard size={20} />
          </Botao>
          <Botao
            testid="menu-camadas"
            grupo="Cena"
            nome="Camadas"
            ativo={aberto === "camadas"}
            aberto={aberto === "camadas"}
            gatilho
            aoClicar={() => alternar("camadas")}
          >
            <Layers size={20} />
          </Botao>
        </Grupo>
        <Grupo id="mapa" nome="Mapa">
          <Botao testid="novo-token" grupo="Mapa" nome="Novo token" aoClicar={p.aoNovoToken}>
            <CirclePlus size={20} />
          </Botao>
        </Grupo>
        <Grupo id="luz" nome="Luz">
          <Botao
            testid="menu-visao-noturna"
            grupo="Luz"
            nome="Visão do mestre"
            ativo={p.visaoDoMestre}
            aoClicar={p.aoAlternarVisaoDoMestre}
          >
            <Moon size={20} />
          </Botao>
          <span className="botao-com-lista">
            <Botao
              testid="menu-iluminacao"
              grupo="Luz"
              nome={
                p.cenaCartao
                  ? "Iluminação (sem efeito: cena como cartão)"
                  : p.iluminacaoDinamica
                    ? "Iluminação"
                    : "Iluminação (desligada nesta cena)"
              }
              ativo={aberto === "iluminacao"}
              aberto={aberto === "iluminacao"}
              alerta={!p.iluminacaoDinamica || p.cenaCartao === true}
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
            grupo="Combate"
            nome="Ordem de turno"
            ativo={p.ordemVisivel}
            aoClicar={p.aoAlternarOrdem}
          >
            <ListOrdered size={20} />
          </Botao>
        </Grupo>
        <Grupo id="automacoes" nome="Automações">
          <Botao
            testid="menu-automacoes"
            grupo="Automações"
            nome="Automações"
            ativo={p.automacoesAbertas}
            aoClicar={p.aoAlternarAutomacoes}
          >
            <Workflow size={20} />
          </Botao>
        </Grupo>
        <Grupo id="ver-como" nome="Ver como">
          <span className="botao-com-lista">
            <Botao
              testid="menu-ver-como"
              grupo="Ver como"
              nome={vendoComo ? `Ver como (agora: ${vendoComo.nome})` : "Ver como"}
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
                        ? "Limpar desenhos — Não há desenhos nesta cena"
                        : undefined
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
