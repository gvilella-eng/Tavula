import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";

export type ItemDoSeletor<Id extends string> = {
  id: Id;
  nome: string;
  testid?: string;
  /** O rótulo acessível, quando precisa dizer mais que o nome. */
  rotulo?: string;
  /** Um ponto discreto ao lado do nome (ex.: a aba escondida que tem algo tocando). */
  ponto?: { testid?: string } | undefined;
  /** O id do painel que a aba controla (só no modo "abas"). */
  controla?: string;
  elementoId?: string;
  desabilitado?: boolean;
};

type Props<Id extends string> = {
  itens: readonly ItemDoSeletor<Id>[];
  valor: Id;
  aoMudar: (id: Id) => void;
  rotulo: string;
  /** "escolha" são botões com `aria-pressed` (como "Personagem | NPC" da ficha); "abas" é um `tablist` com setas, Home e End. */
  modo: "escolha" | "abas";
  testid?: string;
  desabilitado?: boolean;
  /** Classes a mais no grupo e em cada botão (a ficha usa as dela para ficar idêntica). */
  classeDoGrupo?: string;
  classeDoItem?: string;
  /** O conteúdo de dentro do botão, no lugar do nome. */
  filho?: (item: ItemDoSeletor<Id>) => ReactNode;
};

/**
 * MU3: o seletor segmentado único do app, no desenho do "Personagem | NPC" da ficha: grupo com borda e cantos
 * arredondados, o escolhido cheio na cor de destaque e os outros em texto suave. Serve de escolha (ficha) e de abas
 * (mesa de som e a configuração dela).
 */
export function SeletorSegmentado<Id extends string>({
  itens,
  valor,
  aoMudar,
  rotulo,
  modo,
  testid,
  desabilitado,
  classeDoGrupo,
  classeDoItem,
  filho,
}: Props<Id>) {
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const abas = modo === "abas";

  function aoTeclar(e: KeyboardEvent<HTMLElement>) {
    if (!abas) return;
    const i = itens.findIndex((x) => x.id === valor);
    let destino: ItemDoSeletor<Id> | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") destino = itens[(i + 1) % itens.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      destino = itens[(i - 1 + itens.length) % itens.length];
    else if (e.key === "Home") destino = itens[0];
    else if (e.key === "End") destino = itens[itens.length - 1];
    if (!destino) return;
    e.preventDefault();
    aoMudar(destino.id);
    botoes.current.get(destino.id)?.focus();
  }

  const botoesDoGrupo = itens.map((item) => (
    <button
      key={item.id}
      type="button"
      ref={(el) => {
        if (el) botoes.current.set(item.id, el);
        else botoes.current.delete(item.id);
      }}
      className={`seg-item${classeDoItem ? ` ${classeDoItem}` : ""}`}
      data-testid={item.testid}
      id={item.elementoId}
      disabled={item.desabilitado || (modo === "escolha" && desabilitado)}
      aria-label={item.rotulo}
      {...(abas
        ? {
            role: "tab" as const,
            "aria-selected": valor === item.id,
            "aria-controls": item.controla,
            tabIndex: valor === item.id ? 0 : -1,
          }
        : { "aria-pressed": valor === item.id })}
      onClick={() => aoMudar(item.id)}
    >
      {filho ? (
        filho(item)
      ) : (
        <span className="seg-nome">
          {item.nome}
          {item.ponto && (
            <span className="seg-ponto" data-testid={item.ponto.testid} aria-hidden="true" />
          )}
        </span>
      )}
    </button>
  ));
  const classe = `seg-grupo${classeDoGrupo ? ` ${classeDoGrupo}` : ""}`;
  return abas ? (
    <div
      className={classe}
      role="tablist"
      aria-label={rotulo}
      data-testid={testid}
      onKeyDown={aoTeclar}
    >
      {botoesDoGrupo}
    </div>
  ) : (
    <fieldset className={classe} aria-label={rotulo} data-testid={testid} disabled={desabilitado}>
      {botoesDoGrupo}
    </fieldset>
  );
}
