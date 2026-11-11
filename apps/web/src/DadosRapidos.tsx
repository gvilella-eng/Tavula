import { Circle, Diamond, Hexagon, Octagon, Pentagon, Square, Triangle } from "lucide-react";
import type { ReactNode } from "react";
import { caixaDaArea } from "./area";
import { BotaoComDica } from "./BotaoComDica";
import { Janela } from "./janelas/Janela";

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

/** Onde fica o botão que abre os dados (na barra fixa), em coordenadas da área do mapa. */
function topoDoBotao(): number {
  const botao = document.querySelector<HTMLElement>('[data-testid="ferramenta-dados"]');
  return botao ? Math.round(botao.getBoundingClientRect().top - caixaDaArea().topo) : 8;
}

/**
 * Grade de dados rápidos: a linha é o dado, a coluna é a quantidade. Clicar no nome rola 1; no
 * número, aquela quantidade. A sala rola e o resultado vai para o chat de todos; com Shift a
 * rolagem é oculta (só você e o mestre), se você puder.
 */
export function DadosRapidos({ aoRolar, podeOculta, aoFechar }: Props) {
  return (
    <Janela
      id="dados"
      titulo="Dados rápidos"
      testid="dados-rapidos"
      classeDoCorpo="janela-dados"
      padrao={() => ({ x: 8, y: topoDoBotao() })}
      aoFechar={aoFechar}
      rotuloDoFechar="Fechar os dados rápidos"
    >
      <table className="grade-dados">
        <tbody>
          {DADOS.map((d) => (
            <tr key={d.faces}>
              <th scope="row">
                <BotaoComDica
                  className="botao-dado"
                  testid={`dado-${d.nome}`}
                  nomeVisivel
                  onClick={(e) => aoRolar(1, d.faces, e.shiftKey && podeOculta)}
                >
                  {d.icone} {d.nome}
                </BotaoComDica>
              </th>
              {QUANTIDADES.map((q) => (
                <td key={q}>
                  <BotaoComDica
                    className="botao-dado numero"
                    testid={`dado-${d.nome}-${q}`}
                    nomeVisivel
                    onClick={(e) => aoRolar(q, d.faces, e.shiftKey && podeOculta)}
                  >
                    {q}
                  </BotaoComDica>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">
        O resultado vai para o chat.{podeOculta ? " Shift+clique rola oculto." : ""}
      </p>
    </Janela>
  );
}
