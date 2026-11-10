import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useState } from "react";

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

type Props = {
  abas: Aba[];
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
  aoMudarAberta,
  aoMudarVisivel,
  largura,
  limites,
  aoAjustar,
}: Props) {
  const [aberta, setAberta] = useState(true);
  const [ativa, setAtiva] = useState("chat");
  const [arrastando, setArrastando] = useState(false);
  const ativaValida = abas.some((a) => a.id === ativa) ? ativa : (abas[0]?.id ?? "");

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
    <button
      type="button"
      className="botao-icone lateral-recolher"
      data-testid="lateral-recolher"
      title={aberta ? "Recolher o painel" : "Abrir o painel"}
      aria-label={aberta ? "Recolher o painel" : "Abrir o painel"}
      aria-expanded={aberta}
      onClick={() => definirAberta(!aberta)}
    >
      {aberta ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
    </button>
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
          data-testid="alca-do-painel"
          title="Arraste para ajustar a largura (ou use as setas)"
          onPointerDown={aoApertarAlca}
          onPointerMove={aoMoverAlca}
          onPointerUp={aoSoltarAlca}
          onPointerCancel={aoSoltarAlca}
          onKeyDown={aoTeclarAlca}
        />
      )}
      <nav className="abas" aria-label="Abas">
        <div className="abas-lista" role="tablist">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className="aba-lateral"
              data-testid={`aba-${a.id}`}
              title={a.titulo}
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
            </button>
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
