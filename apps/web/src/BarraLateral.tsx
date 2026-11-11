import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { BotaoComDica } from "./BotaoComDica";
import { Dica, useDica } from "./Dica";

export type Aba = {
  id: string;
  titulo: string;
  icone: ReactNode;
  conteudo: ReactNode;
  /** Bolinha discreta no ícone (ex.: transferência de arquivo em andamento). */
  indicador?: boolean;
  /** Selo com um número no ícone (ex.: mensagens não lidas do chat). Some quando é 0. */
  selo?: number;
  /** O conteúdo ocupa a altura toda (o chat: caixa fixa no rodapé), em vez de rolar com a aba. */
  cheia?: boolean;
};

/** Pedido de fora para abrir uma aba (e rolar até uma seção dela). `n` muda a cada pedido, para repetir o mesmo. */
export type PedidoDeAba = { n: number; abaId: string; secaoTestid?: string };

type Props = {
  abas: Aba[];
  pedido?: PedidoDeAba | null;
  /** Avisa se o painel está aberto, para o mapa ganhar o espaço quando ele recolhe. */
  aoMudarAberta?: (aberta: boolean) => void;
  /** Qual aba está à vista agora (`null`: a barra está recolhida). */
  aoMudarVisivel?: (abaId: string | null) => void;
  /** Largura atual do painel aberto (px) e os limites; `aoAjustar` com `gravar` ao fim do gesto. */
  largura: number;
  limites: { min: number; max: number };
  aoAjustar: (largura: number, gravar: boolean) => void;
};

const PASSO = 16;
const PASSO_GRANDE = 64;

/**
 * Painel direito: uma coluna de cima a baixo, recolhível, com abas de ícone e nome e a largura
 * ajustável pela borda esquerda (mouse e teclado). Todos os painéis ficam montados (só o ativo
 * aparece): campos com rascunho não perdem o estado ao trocar de aba.
 */
export function BarraLateral({
  abas,
  pedido,
  aoMudarAberta,
  aoMudarVisivel,
  largura,
  limites,
  aoAjustar,
}: Props) {
  const [aberta, setAberta] = useState(true);
  const [ativa, setAtiva] = useState("chat");
  const [arrastando, setArrastando] = useState(false);
  const alcaRef = useRef<HTMLDivElement>(null);
  const dicaDaAlca = useDica();
  const ativaValida = abas.some((a) => a.id === ativa) ? ativa : (abas[0]?.id ?? "");

  // Um pedido de fora (ex.: "Modelos de tocha…" no menu de Luz): abre a aba e depois rola até a seção.
  const [secaoPendente, setSecaoPendente] = useState<PedidoDeAba | null>(null);
  const pedidoN = pedido?.n;
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando chega um pedido novo
  useEffect(() => {
    if (!pedido || !abas.some((a) => a.id === pedido.abaId)) return;
    setAtiva(pedido.abaId);
    definirAberta(true);
    setSecaoPendente(pedido);
  }, [pedidoN]);
  useEffect(() => {
    if (!secaoPendente || !aberta || ativaValida !== secaoPendente.abaId) return;
    if (secaoPendente.secaoTestid) {
      document
        .querySelector(`[data-testid="${secaoPendente.secaoTestid}"]`)
        ?.scrollIntoView({ block: "start" });
    }
    setSecaoPendente(null);
  }, [secaoPendente, aberta, ativaValida]);

  const visivelAgora = aberta ? ativaValida : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: só avisa quando a aba à vista muda
  useEffect(() => {
    aoMudarVisivel?.(visivelAgora);
  }, [visivelAgora]);

  function definirAberta(v: boolean) {
    setAberta(v);
    aoMudarAberta?.(v);
  }

  // A borda esquerda do painel acompanha o ponteiro: a largura é a distância até a borda direita da janela.
  function aoApertarAlca(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true);
  }
  function aoMoverAlca(e: PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    aoAjustar(window.innerWidth - e.clientX, false);
  }
  function aoSoltarAlca(e: PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    setArrastando(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    aoAjustar(window.innerWidth - e.clientX, true);
  }
  function aoTeclarAlca(e: KeyboardEvent<HTMLDivElement>) {
    const passo = e.shiftKey ? PASSO_GRANDE : PASSO;
    let nova: number | null = null;
    // A borda é a esquerda: seta para a esquerda alarga, para a direita estreita.
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") nova = largura + passo;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") nova = largura - passo;
    else if (e.key === "Home") nova = limites.min;
    else if (e.key === "End") nova = limites.max;
    if (nova === null) return;
    e.preventDefault();
    aoAjustar(nova, true);
  }

  const botaoRecolher = (
    <BotaoComDica
      className="botao-icone lateral-recolher"
      testid="lateral-recolher"
      nome={aberta ? "Recolher o painel" : "Abrir o painel"}
      lado="esquerda"
      aria-label={aberta ? "Recolher o painel" : "Abrir o painel"}
      aria-expanded={aberta}
      onClick={() => definirAberta(!aberta)}
    >
      {aberta ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
    </BotaoComDica>
  );

  return (
    <aside
      className="lateral"
      data-aberta={aberta}
      data-arrastando={arrastando || undefined}
      data-testid="barra-lateral"
    >
      {aberta && (
        // biome-ignore lint/a11y/useSemanticElements: a alça é um separador que se arrasta e recebe foco (padrão ARIA "window splitter")
        <div
          className="alca-painel"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar a largura do painel"
          aria-valuenow={largura}
          aria-valuemin={limites.min}
          aria-valuemax={limites.max}
          tabIndex={0}
          ref={alcaRef}
          data-testid="alca-do-painel"
          aria-describedby={dicaDaAlca.id}
          onMouseEnter={dicaDaAlca.mostrar}
          onMouseLeave={dicaDaAlca.esconder}
          onFocus={dicaDaAlca.mostrar}
          onBlur={dicaDaAlca.esconder}
          onPointerDown={(e) => {
            dicaDaAlca.esconder();
            aoApertarAlca(e);
          }}
          onPointerMove={aoMoverAlca}
          onPointerUp={aoSoltarAlca}
          onPointerCancel={aoSoltarAlca}
          onKeyDown={(e) => {
            dicaDaAlca.aoTeclar(e);
            aoTeclarAlca(e);
          }}
        />
      )}
      {aberta && (
        <Dica
          alvo={alcaRef}
          id={dicaDaAlca.id}
          visivel={dicaDaAlca.visivel}
          testid="dica-alca-do-painel"
          nome="Ajustar a largura"
          texto="Arraste a borda do painel."
          atalho="painelLargura"
          lado="esquerda"
        />
      )}
      <nav className="abas" aria-label="Abas">
        <div className="abas-lista" role="tablist">
          {abas.map((a) => (
            <BotaoComDica
              key={a.id}
              role="tab"
              className="aba-lateral"
              testid={`aba-${a.id}`}
              nome={a.titulo}
              semDica={aberta}
              lado="esquerda"
              aria-label={a.titulo}
              aria-selected={aberta && ativaValida === a.id}
              onClick={() => {
                setAtiva(a.id);
                definirAberta(true);
              }}
            >
              <span className="aba-icone">{a.icone}</span>
              <span className="aba-nome" data-testid={`aba-nome-${a.id}`}>
                {a.titulo}
              </span>
              {a.indicador && <span className="indicador" data-testid={`indicador-${a.id}`} />}
              {a.selo !== undefined && a.selo > 0 && (
                <span
                  className="selo-aba"
                  data-testid={`selo-${a.id}`}
                  role="status"
                  title={`${a.selo} não lidas`}
                >
                  {a.selo > 99 ? "99+" : a.selo}
                </span>
              )}
            </BotaoComDica>
          ))}
        </div>
      </nav>
      <div
        className="lateral-conteudo"
        hidden={!aberta}
        data-cheia={abas.find((a) => a.id === ativaValida)?.cheia ? "true" : undefined}
      >
        {aberta && botaoRecolher}
        {abas.map((a) => (
          <section
            key={a.id}
            className={`painel-aba ${a.cheia ? "cheia" : ""}`}
            data-testid={`aba-painel-${a.id}`}
            hidden={ativaValida !== a.id}
          >
            <h2>{a.titulo}</h2>
            {a.conteudo}
          </section>
        ))}
      </div>
    </aside>
  );
}
