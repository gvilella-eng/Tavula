import { noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";

type Props = {
  /** A régua encaixa no grid (preferência desta pessoa); Alt inverte na hora. */
  grudar: boolean;
  aoMudarGrudar: (v: boolean) => void;
  aoFechar: () => void;
};

/**
 * V13: painel pequeno da ferramenta Régua (de todos), no desenho do painel das Paredes: grudar no grid
 * ou medir livre, mais as dicas do Shift (fixar), do clique direito (ponto de virada) e do Backspace.
 */
export function PainelDaRegua({ grudar, aoMudarGrudar, aoFechar }: Props) {
  return (
    <Janela
      id="regua"
      titulo="Régua"
      testid="painel-regua"
      classeDoCorpo="painel-token"
      padrao={noCanto("topo-esquerda", 316)}
      largura={250}
      aoFechar={aoFechar}
      rotuloDoFechar="Fechar a ferramenta"
      testidDoFechar="regua-fechar"
    >
      <label className="linha-opcao">
        <input
          type="checkbox"
          data-testid="regua-grudar"
          checked={grudar}
          onChange={(e) => aoMudarGrudar(e.target.checked)}
        />
        Grudar no grid
      </label>
      <p className="nota">
        <kbd>Alt</kbd> inverte na hora. <kbd>Shift</kbd> ao soltar fixa.
      </p>
      <p className="nota">Segurando o botão esquerdo, o clique direito marca um ponto de virada.</p>
    </Janela>
  );
}
