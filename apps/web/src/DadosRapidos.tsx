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
  aoRolar: (quantidade: number, faces: number) => void;
  aoFechar: () => void;
};

/**
 * Grade de dados rápidos: a linha é o dado, a coluna é a quantidade. Clicar no nome rola 1; no
 * número, aquela quantidade. Por ora só avisa: a rolagem de verdade (no servidor) vem com o chat.
 */
export function DadosRapidos({ aoRolar, aoFechar }: Props) {
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
                  onClick={() => aoRolar(1, d.faces)}
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
                    onClick={() => aoRolar(q, d.faces)}
                  >
                    {q}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">Em breve: o resultado vai para o chat (Lote 8).</p>
    </Popover>
  );
}
