import type { Estado, Gatilho } from "@tabletop/shared";
import { Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import type { Fontes } from "../assets/fontes";
import { MARGEM, noTopoAoCentro } from "../janelas/geometria";
import { Janela } from "../janelas/Janela";
import type { SomEscolhido } from "../som/EscolherSom";
import { EditorDeFluxo } from "./EditorDeFluxo";
import { ListaDeAutomacoes } from "./ListaDeAutomacoes";

type Enviar = (tipo: string, dados: object) => string | null;

/** Pede à janela para abrir direto no editor (o painel da zona: "+ automação para esta zona"). */
export type PedidoDeAutomacao = {
  chave: number;
  fluxoId: string | null;
  gatilho?: Gatilho | undefined;
};

type Props = {
  estado: Estado;
  enviar: Enviar;
  salaMs: () => number | undefined;
  /** N5: de onde vêm os sons e como adicionar um (a ação "Tocar um som"). */
  fontes: Fontes;
  registrarSom: (arquivo: File) => Promise<SomEscolhido>;
  aoFechar: () => void;
  pedido?: PedidoDeAutomacao | null;
  /** Abre o editor numa janela própria do navegador (`null`: uma automação nova). */
  aoAbrirEmJanela?: (fluxoId: string | null) => void;
};

type Vista =
  | { tipo: "lista" }
  | { tipo: "editor"; fluxoId: string | null; gatilho?: Gatilho | undefined; chave: number };

/**
 * As automações do mestre (AU1): uma janela flutuante, aberta pelo botão Automações. Mostra a lista (cada uma com a frase em
 * português gerada dos blocos) e, ao criar ou editar, o editor por blocos. Só o mestre a vê.
 */
export function JanelaDasAutomacoes(p: Props) {
  const [vista, setVista] = useState<Vista>(() =>
    p.pedido
      ? {
          tipo: "editor",
          fluxoId: p.pedido.fluxoId,
          gatilho: p.pedido.gatilho,
          chave: p.pedido.chave,
        }
      : { tipo: "lista" },
  );
  const pedidoNovo = p.pedido?.chave;
  // biome-ignore lint/correctness/useExhaustiveDependencies: só quando chega um pedido novo
  useEffect(() => {
    if (p.pedido)
      setVista({
        tipo: "editor",
        fluxoId: p.pedido.fluxoId,
        gatilho: p.pedido.gatilho,
        chave: p.pedido.chave,
      });
  }, [pedidoNovo]);
  const voltar = () => setVista({ tipo: "lista" });

  return (
    <Janela
      id="automacoes"
      titulo="Automações"
      icone={<Workflow size={16} />}
      testid="automacoes-janela"
      classeDoCorpo="janela-automacoes"
      padrao={noTopoAoCentro(MARGEM)}
      largura={(area) => Math.min(1240, Math.max(420, area.largura - 2 * MARGEM))}
      altura={(area) => Math.min(760, Math.max(360, area.altura - 2 * MARGEM))}
      minLargura={420}
      redimensionar="ambos"
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar as automações"
      testidDoFechar="automacoes-fechar"
    >
      {vista.tipo === "editor" ? (
        <EditorDeFluxo
          key={`${vista.fluxoId ?? "novo"}-${vista.chave}`}
          estado={p.estado}
          enviar={p.enviar}
          fluxoId={vista.fluxoId}
          gatilhoInicial={vista.gatilho}
          fontes={p.fontes}
          registrarSom={p.registrarSom}
          aoVoltar={voltar}
          aoAbrirEmJanela={
            p.aoAbrirEmJanela
              ? (id) => {
                  p.aoAbrirEmJanela?.(id);
                  voltar();
                }
              : undefined
          }
        />
      ) : (
        <ListaDeAutomacoes
          estado={p.estado}
          enviar={p.enviar}
          salaMs={p.salaMs}
          aoEditar={(id) => setVista({ tipo: "editor", fluxoId: id, chave: Date.now() })}
        />
      )}
    </Janela>
  );
}
