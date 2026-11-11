import { Check } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useFecharFora } from "./Popover";
import { useMenuPorTeclado } from "./useMenuPorTeclado";

/** Uma linha do menu: ação, título de seção ou separador. */
export type ItemDoMenu =
  | {
      tipo?: "item";
      /** Vira o `data-testid` `<testid do menu>-<id>`. */
      id: string;
      rotulo: string;
      icone?: ReactNode;
      aoClicar: () => void;
      /** Item de marcar (mostra o visto quando `true`); o menu fica aberto depois de clicar. */
      marcado?: boolean;
      /** Ação que apaga: a cor de perigo. */
      perigo?: boolean;
      /** Por que a ação não vale agora (o item fica desabilitado e o motivo vai na dica). */
      motivo?: string;
      /** O menu não fecha ao clicar (itens de marcar, confirmações no próprio menu). */
      manterAberto?: boolean;
    }
  | { tipo: "titulo"; chave: string; rotulo: string }
  | { tipo: "separador"; chave: string };

type Props = {
  testid: string;
  /** O nome do menu para leitor de tela; também aparece como título discreto no alto. */
  titulo: string;
  /** Posição do clique (ou do item em foco) na página. */
  x: number;
  y: number;
  itens: ItemDoMenu[];
  /** Aberto pelo teclado (Shift+F10 ou a tecla de menu): o foco vai para o primeiro item. */
  teclado?: boolean;
  aoFechar: () => void;
};

const MARGEM = 8;

/**
 * Menu de botão direito das listas (V3): abre no ponto do clique ou junto do item em foco (Shift+F10 / tecla de
 * menu), sem sair da janela do navegador; setas, Home, End, Enter e Espaço andam e ativam (`useMenuPorTeclado`,
 * R6a); Esc ou um clique fora fecha e o foco volta ao item. Serve às Fichas (item, pasta e handout).
 */
export function MenuDeContexto({ testid, titulo, x, y, itens, teclado, aoFechar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const aoTeclarNoMenu = useMenuPorTeclado(ref, teclado === true);

  // Mede o menu pronto e o prende dentro da janela do navegador.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const l = el.offsetWidth;
    const a = el.offsetHeight;
    // Direto no elemento (sem estado): o menu nunca fica invisível, e o foco do teclado pode ir ao primeiro item.
    el.style.left = `${Math.max(MARGEM, Math.min(x, window.innerWidth - l - MARGEM))}px`;
    el.style.top = `${Math.max(MARGEM, Math.min(y, window.innerHeight - a - MARGEM))}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="menu-contexto menu-ficha"
      role="menu"
      aria-label={titulo}
      data-testid={testid}
      style={{ left: x, top: y, maxHeight: window.innerHeight - 2 * MARGEM }}
      onKeyDown={aoTeclarNoMenu}
    >
      <div className="nota menu-titulo">{titulo}</div>
      {itens.map((item) => {
        if (item.tipo === "separador") return <hr key={item.chave} className="menu-separador" />;
        if (item.tipo === "titulo") {
          return (
            <div key={item.chave} className="nota menu-secao">
              {item.rotulo}
            </div>
          );
        }
        const desabilitado = item.motivo !== undefined;
        return (
          <button
            key={item.id}
            type="button"
            {...(item.marcado === undefined
              ? { role: "menuitem" }
              : { role: "menuitemcheckbox", "aria-checked": item.marcado })}
            className={item.perigo ? "item-menu perigo" : "item-menu"}
            data-testid={`${testid}-${item.id}`}
            aria-disabled={desabilitado || undefined}
            title={item.motivo}
            onClick={() => {
              if (desabilitado) return;
              if (!item.manterAberto && item.marcado === undefined) aoFechar();
              item.aoClicar();
            }}
          >
            {item.icone}
            <span>{item.rotulo}</span>
            {item.marcado && <Check size={14} className="item-menu-visto" />}
          </button>
        );
      })}
    </div>
  );
}

/** A posição ao lado de um elemento (para o menu aberto pelo teclado). */
export function pontoDoElemento(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width, 40), y: r.bottom - 4 };
}
