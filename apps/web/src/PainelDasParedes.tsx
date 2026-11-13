import {
  ESTADOS_DE_PORTA,
  ehArco,
  type Parede,
  TIPOS_DE_PAREDE,
  type TipoDeParede,
} from "@tabletop/shared";
import { Trash2 } from "lucide-react";
import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { ListaDeTiposDeParede, ROTULO_DO_TIPO } from "./ListaDeTiposDeParede";

const ROTULO_DO_ESTADO = { aberta: "Aberta", fechada: "Fechada", trancada: "Trancada" } as const;

type Props = {
  /** Tipo das paredes que a ferramenta desenha. */
  tipoNovo: TipoDeParede;
  aoEscolherTipoNovo: (t: TipoDeParede) => void;
  /** V5: o próximo trecho é um arco (tecla A). */
  arco: boolean;
  /** A parede selecionada, se houver. */
  selecionada: Parede | null;
  enviar: (tipo: string, dados: object) => string | null;
  aoApagar: (id: string) => void;
  aoFechar: () => void;
};

/**
 * Painel pequeno da ferramenta de paredes e portas (só do mestre): o tipo das novas paredes e, com
 * uma parede selecionada, o tipo e o estado dela. Cada mudança vai na hora.
 */
export function PainelDasParedes(p: Props) {
  const s = p.selecionada;
  const temEstado = s !== null && (s.tipo === "porta" || s.tipo === "secreta");
  return (
    <Janela
      id="paredes"
      titulo="Paredes e portas"
      testid="painel-paredes"
      classeDoCorpo="painel-token"
      padrao={noCanto("topo-esquerda", 316)}
      largura={236}
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a ferramenta"
      testidDoFechar="paredes-fechar"
    >
      <p className="nota">
        Clique para desenhar em sequência; Esc ou duplo clique encerra. Alt solta do grid.{" "}
        <kbd>A</kbd> alterna linha e arco.
      </p>
      <fieldset className="quem-controla">
        <legend>
          Desenhar como <span data-testid="parede-modo">({p.arco ? "arco" : "linha"})</span>
        </legend>
        <ListaDeTiposDeParede valor={p.tipoNovo} aoEscolher={p.aoEscolherTipoNovo} />
      </fieldset>
      {s && (
        <fieldset className="quem-controla" data-testid="parede-selecionada">
          <legend>Parede selecionada{ehArco(s) ? " (Arco)" : ""}</legend>
          <label>
            Tipo
            <select
              data-testid="parede-tipo"
              value={s.tipo}
              onChange={(e) => p.enviar("parede.editar", { id: s.id, tipo: e.target.value })}
            >
              {TIPOS_DE_PAREDE.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_DO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          {temEstado && (
            <label>
              Estado
              <select
                data-testid="parede-estado"
                value={s.estado ?? "fechada"}
                onChange={(e) => p.enviar("parede.editar", { id: s.id, estado: e.target.value })}
              >
                {ESTADOS_DE_PORTA.map((estado) => (
                  <option key={estado} value={estado}>
                    {ROTULO_DO_ESTADO[estado]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="perigo"
            data-testid="parede-apagar"
            onClick={() => p.aoApagar(s.id)}
          >
            <Trash2 size={16} /> Apagar
          </button>
        </fieldset>
      )}
    </Janela>
  );
}
