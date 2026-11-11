import { type ButtonHTMLAttributes, type ReactNode, useRef } from "react";
import { ATALHOS, type IdDoAtalho, teclasParaAria } from "./atalhos";
import { Dica, useDica } from "./Dica";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "disabled"> & {
  /** O `data-testid` do botão (a dica leva o mesmo com o prefixo `dica-`). */
  testid: string;
  /** O nome do botão, em negrito na primeira linha da dica. Sem ele, `dica` é a primeira linha. */
  nome?: string | undefined;
  /** O que o botão faz (dica no mouse e no foco do teclado). */
  dica?: string | undefined;
  /** O atalho do teclado (da tabela `atalhos.ts`): aparece na dica, com `<kbd>`, e em `aria-keyshortcuts`. */
  atalho?: IdDoAtalho | undefined;
  /**
   * Por que o botão não age agora. Com motivo o botão fica desabilitado (`aria-disabled`, o clique é ignorado)
   * e o motivo vira a dica e a descrição para leitor de tela. O `disabled` nativo não deixa a dica aparecer.
   */
  motivo?: string | null;
  /** Esconde a dica (por exemplo, a lista ou o painel do botão está aberto). */
  semDica?: boolean | undefined;
  /** Onde a dica aparece em relação ao botão. */
  lado?: "baixo" | "direita" | "esquerda" | undefined;
  children?: ReactNode;
};

/**
 * O botão com dica da interface toda (R5b, unificado no R6a): a dica aparece ao passar o mouse e ao receber o
 * foco do teclado, sai ao clicar, ao perder o foco e com Esc, leva o atalho quando há e é ligada ao botão por
 * `aria-describedby`. Explica também o motivo de estar desabilitado.
 */
export function BotaoComDica({
  testid,
  nome,
  dica,
  atalho,
  motivo,
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
  const desabilitado = typeof motivo === "string" && motivo !== "";
  const texto = desabilitado ? motivo : dica;
  const titulo = desabilitado ? undefined : nome;
  const temDica = Boolean(texto ?? titulo);

  return (
    <>
      <button
        {...resto}
        ref={botao}
        type={resto.type ?? "button"}
        data-testid={testid}
        aria-disabled={desabilitado || ariaDesabilitado || undefined}
        aria-describedby={temDica ? d.id : undefined}
        aria-keyshortcuts={atalho ? teclasParaAria(ATALHOS[atalho].teclas) : undefined}
        onClick={(e) => {
          d.esconder();
          if (desabilitado) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        onMouseEnter={d.mostrar}
        // O botão pode ficar desabilitado com o mouse já em cima (acabou de ser clicado): mexer o mouse mostra o motivo.
        onMouseMove={desabilitado && !d.visivel ? d.mostrar : undefined}
        onMouseLeave={d.esconder}
        onFocus={d.mostrar}
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
      <Dica
        alvo={botao}
        id={d.id}
        visivel={d.visivel && !semDica}
        testid={`dica-${testid}`}
        nome={desabilitado ? undefined : titulo}
        texto={texto ?? undefined}
        atalho={desabilitado ? undefined : atalho}
        motivo={desabilitado}
        lado={lado}
      />
    </>
  );
}
