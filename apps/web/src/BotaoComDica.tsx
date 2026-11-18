import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";
import { ATALHOS, type IdDoAtalho, teclasParaAria } from "./atalhos";
import { Dica, useDica } from "./Dica";
import { useDicasLigadas } from "./dicasLigadas";

/** Quanto tempo o balão do motivo (clique no botão desabilitado, dicas desligadas) fica à vista. */
const DURACAO_DO_AVISO = 2800;

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "disabled"> & {
  /** O `data-testid` do botão (a dica leva o mesmo com o prefixo `dica-`). */
  testid: string;
  /** O nome do botão: a dica de uma linha ("Régua · R"). */
  nome?: string | undefined;
  /**
   * Só para botões que não têm outro nome: vale como `nome`. A explicação do que o botão faz não é mais dica,
   * mora em `textosDoTour.ts`.
   */
  dica?: string | undefined;
  /** O atalho do teclado (da tabela `atalhos.ts`): aparece na dica, com `<kbd>`, e em `aria-keyshortcuts`. */
  atalho?: IdDoAtalho | undefined;
  /**
   * Por que o botão não age agora. Com motivo o botão fica desabilitado (`aria-disabled`, o clique é ignorado)
   * e a dica vira "Nome — motivo". O `disabled` nativo não deixa a dica aparecer.
   */
  motivo?: string | null;
  /** O botão já mostra o nome (texto à vista): não há dica, só o motivo quando estiver desabilitado. */
  nomeVisivel?: boolean | undefined;
  /** Decide, na hora de mostrar, se a dica cabe (uma aba cuja nome está cortado, por exemplo). */
  dicaSe?: ((botao: HTMLButtonElement) => boolean) | undefined;
  /** Esconde a dica (por exemplo, a lista ou o painel do botão está aberto). */
  semDica?: boolean | undefined;
  /** Onde a dica aparece em relação ao botão. */
  lado?: "baixo" | "direita" | "esquerda" | undefined;
  children?: ReactNode;
};

/**
 * O botão com dica da interface toda (R5b, R6a; enxuto no V3b): a dica de uma linha só aparece onde o botão não
 * tem nome à vista, 700 ms depois de o mouse parar em cima (na hora no foco do teclado), sai ao clicar, ao
 * perder o foco e com Esc e é ligada ao botão por `aria-describedby`. Desabilitado, mostra "Nome — motivo"; com
 * as dicas desligadas, o clique no desabilitado mostra o motivo num balão curto.
 */
export function BotaoComDica({
  testid,
  nome,
  dica,
  atalho,
  motivo,
  nomeVisivel,
  dicaSe,
  semDica,
  lado,
  onClick,
  onKeyDown,
  onDragStart,
  children,
  "aria-disabled": ariaDesabilitado,
  ...resto
}: Props) {
  const botao = useRef<HTMLButtonElement>(null);
  const d = useDica();
  const ligadas = useDicasLigadas();
  const [aviso, setAviso] = useState(false);
  const desabilitado = typeof motivo === "string" && motivo !== "";
  const rotulo = nome ?? dica ?? "";
  const temDica = rotulo !== "" && (desabilitado || !nomeVisivel);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), DURACAO_DO_AVISO);
    return () => clearTimeout(t);
  }, [aviso]);
  useEffect(() => {
    if (!desabilitado) setAviso(false);
  }, [desabilitado]);

  const podeMostrar = () => temDica && (!dicaSe || !botao.current || dicaSe(botao.current));
  // Q14: o balão (um portal no body) só existe enquanto está à vista; escondido não custa nada a cada render.
  const balaoVisivel = (d.visivel && !semDica && temDica) || (aviso && desabilitado);

  return (
    <>
      <button
        // Sem o balão no DOM o `aria-describedby` não leria nada: o nome do controle fica no `aria-label` (quando o
        // botão não traz o seu) e o balão, quando aparece, volta a ser a descrição.
        aria-label={temDica && !nomeVisivel ? rotulo : undefined}
        {...resto}
        ref={botao}
        type={resto.type ?? "button"}
        data-testid={testid}
        aria-disabled={desabilitado || ariaDesabilitado || undefined}
        aria-describedby={temDica && balaoVisivel ? d.id : undefined}
        // O motivo do botão desabilitado continua sendo lido sem o balão: "Nome — motivo"
        aria-description={
          temDica && desabilitado && !balaoVisivel ? `${rotulo} — ${motivo}` : undefined
        }
        aria-keyshortcuts={atalho ? teclasParaAria(ATALHOS[atalho].teclas) : undefined}
        onClick={(e) => {
          d.esconder();
          if (desabilitado) {
            e.preventDefault();
            // Dicas desligadas: o motivo aparece por um instante, para o botão parado não ficar mudo.
            if (!ligadas) setAviso(true);
            return;
          }
          onClick?.(e);
        }}
        onMouseEnter={() => {
          if (podeMostrar()) d.aoEntrarMouse();
        }}
        // O botão pode ficar desabilitado com o mouse já em cima (acabou de ser clicado): mexer o mouse mostra o motivo.
        onMouseMove={
          desabilitado && !d.visivel
            ? () => {
                if (podeMostrar()) d.aoEntrarMouse();
              }
            : undefined
        }
        onMouseLeave={d.esconder}
        onFocus={(e) => {
          if (podeMostrar()) d.aoFocar(e);
        }}
        onBlur={d.esconder}
        onDragStart={(e) => {
          d.esconder();
          onDragStart?.(e);
        }}
        onKeyDown={(e) => {
          d.aoTeclar(e);
          onKeyDown?.(e);
        }}
      >
        {children}
      </button>
      {balaoVisivel && (
        <Dica
          alvo={botao}
          id={d.id}
          visivel
          testid={`dica-${testid}`}
          nome={rotulo}
          motivo={desabilitado ? motivo : undefined}
          atalho={atalho}
          aviso={aviso}
          lado={lado}
        />
      )}
    </>
  );
}
