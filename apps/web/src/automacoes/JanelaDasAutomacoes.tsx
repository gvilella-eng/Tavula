import type { Estado } from "@tabletop/shared";
import { Workflow } from "lucide-react";
import { MARGEM, noTopoAoCentro } from "../janelas/geometria";
import { Janela } from "../janelas/Janela";
import { ListaDeAutomacoes } from "./ListaDeAutomacoes";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  enviar: Enviar;
  salaMs: () => number | undefined;
  aoFechar: () => void;
  /** Abre o editor numa janela própria do navegador, na hora (`null`: uma automação nova). O editor nunca vive aqui. */
  aoEditar: (fluxoId: string | null) => void;
  /** AU3: abre o editor de uma automação nova já com o tour. */
  aoEditarComTour: () => void;
  /** AU3: o tour abre sozinho (a primeira vez que o mestre abre o centro de automações). */
  tourAutomatico: boolean;
  /** Abre a mesa de eventos (os botões das automações), como a mesa de som. */
  aoAbrirMesaDeEventos: () => void;
};

/**
 * As automações do mestre: uma janela flutuante, aberta pelo botão Automações, com a lista (cada uma com a frase em
 * português gerada do grafo). "Editar" e "Nova automação" abrem o editor numa janela própria do navegador (AU2): a
 * janela principal nunca mostra o editor. Daqui também se abre a mesa de eventos. Só o mestre a vê.
 */
export function JanelaDasAutomacoes(p: Props) {
  return (
    <Janela
      id="automacoes"
      titulo="Automações"
      icone={<Workflow size={16} />}
      testid="automacoes-janela"
      classeDoCorpo="janela-automacoes"
      padrao={noTopoAoCentro(MARGEM)}
      largura={(area) => Math.min(1100, Math.max(420, area.largura - 2 * MARGEM))}
      altura={(area) => Math.min(680, Math.max(360, area.altura - 2 * MARGEM))}
      minLargura={420}
      redimensionar="ambos"
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar as automações"
      testidDoFechar="automacoes-fechar"
    >
      <ListaDeAutomacoes
        estado={p.estado}
        enviar={p.enviar}
        salaMs={p.salaMs}
        aoEditar={p.aoEditar}
        aoEditarComTour={p.aoEditarComTour}
        tourAutomatico={p.tourAutomatico}
        aoAbrirMesaDeEventos={p.aoAbrirMesaDeEventos}
      />
    </Janela>
  );
}
