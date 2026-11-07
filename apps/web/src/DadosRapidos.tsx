import { Circle, Diamond, Hexagon, Octagon, Pentagon, Square, Triangle } from "lucide-react";
import type { ReactNode } from "react";
import { Popover } from "./Popover";

export const DADOS: { faces: number; nome: string; icone: ReactNode }[] = [
  { faces: 4, nome: "D4", icone: <Triangle size={16} /> },
  { faces: 6, nome: "D6", icone: <Square size={16} /> },
  { faces: 8, nome: "D8", icone: <Diamond size={16} /> },
  { faces: 10, nome: "D10", icone: <Pentagon size={16} /> },
  { faces: 12, nome: "D12", icone: <Octagon size={16} /> },
  { faces: 20, nome: "D20", icone: <Hexagon size={16} /> },
  { faces: 100, nome: "D100", icone: <Circle size={16} /> },
];
export const QUANTIDADES = [2, 3, 4, 5, 6];

type Props = {
  /** `oculta`: Shift+clique (só se a pessoa pode rolar oculto). */
  aoRolar: (quantidade: number, faces: number, oculta: boolean) => void;
  podeOculta: boolean;
  aoFechar: () => void;
};

/**
 * Grade de dados rápidos: a linha é o dado, a coluna é a quantidade. Clicar no nome rola 1; no
 * número, aquela quantidade. A sala rola e o resultado vai para o chat de todos; com Shift a
 * rolagem é oculta (só você e o mestre), se você puder.
 */
export function DadosRapidos({ aoRolar, podeOculta, aoFechar }: Props) {
  return (
    <Popover
      testid="dados-rapidos"
      titulo="Dados rápidos"
      className="popover-dados"
      aoFechar={aoFechar}
    >
      <table className="grade-dados">
        <tbody>
          {DADOS.map((d) => (
            <tr key={d.faces}>
              <th scope="row">
                <button
                  type="button"
                  className="botao-dado"
                  data-testid={`dado-${d.nome}`}
                  title={`Rolar 1${d.nome.toLowerCase()}`}
                  onClick={(e) => aoRolar(1, d.faces, e.shiftKey && podeOculta)}
                >
                  {d.icone} {d.nome}
                </button>
              </th>
              {QUANTIDADES.map((q) => (
                <td key={q}>
                  <button
                    type="button"
                    className="botao-dado numero"
                    data-testid={`dado-${d.nome}-${q}`}
                    title={`Rolar ${q}${d.nome.toLowerCase()}`}
                    onClick={(e) => aoRolar(q, d.faces, e.shiftKey && podeOculta)}
                  >
                    {q}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">
        O resultado vai para o chat.{podeOculta ? " Shift+clique rola oculto." : ""}
      </p>
    </Popover>
  );
}
