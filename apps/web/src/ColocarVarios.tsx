import { MAXIMO_DE_TOKENS_POR_VEZ } from "@tabletop/shared";
import { Users } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { noTopoAoCentro } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";

type Props = {
  /** O nome do NPC (a ficha-modelo). */
  nome: string;
  /** Enter ou "Colocar": a quantidade (1 a 20). */
  aoConfirmar: (quantidade: number) => void;
  aoCancelar: () => void;
};

/**
 * Q10: "Colocar vários…" (só o mestre): pergunta quantos tokens do NPC pôr de uma vez. Nasce tudo de um pedido só,
 * arrumado no grid no centro da vista, numerado ("Goblin", "Goblin 2"...) e cada um com a sua vida.
 */
export function ColocarVarios({ nome, aoConfirmar, aoCancelar }: Props) {
  const [texto, setTexto] = useState("4");
  const quantidade = Number(texto);
  const valida =
    /^\d{1,2}$/.test(texto) && quantidade >= 1 && quantidade <= MAXIMO_DE_TOKENS_POR_VEZ;
  const focar = useCallback((el: HTMLInputElement | null) => {
    if (el)
      requestAnimationFrame(() => {
        el.focus();
        el.select();
      });
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (valida) aoConfirmar(quantidade);
  }

  return (
    <Janela
      id="colocar-varios"
      titulo="Colocar vários"
      cabecalho={<strong>Colocar vários</strong>}
      testid="colocar-varios-janela"
      classeDoCorpo="colocar-varios"
      padrao={noTopoAoCentro()}
      largura={272}
      aoFechar={aoCancelar}
      rotuloDoFechar="Cancelar"
      testidDoFechar="colocar-varios-fechar"
    >
      <form
        onSubmit={enviar}
        onKeyDown={(e) => {
          if (e.key === "Escape") aoCancelar();
        }}
      >
        <label>
          Quantos tokens de {nome}
          <input
            ref={focar}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAXIMO_DE_TOKENS_POR_VEZ}
            data-testid="colocar-varios-quantidade"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <p className="nota colocar-varios-nota">
          De 1 a {MAXIMO_DE_TOKENS_POR_VEZ}. Entram arrumados no centro da tela, numerados, cada um
          com a sua vida.
        </p>
        <div className="linha-botoes">
          <button type="button" data-testid="colocar-varios-cancelar" onClick={aoCancelar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="primario"
            data-testid="colocar-varios-confirmar"
            disabled={!valida}
          >
            <Users size={16} /> Colocar
          </button>
        </div>
      </form>
    </Janela>
  );
}
