import { BORDAS, type Borda, CORES_DA_BORDA, ROTULO_DA_BORDA } from "@tabletop/shared";
import { Ban } from "lucide-react";
import { BotaoComDica } from "./BotaoComDica";

type Props = {
  /** A borda de agora (sem ela, "sem borda" fica marcado). */
  valor: Borda | undefined;
  /** Escolheu uma cor, ou `null` para tirar a borda. */
  aoEscolher: (borda: Borda | null) => void;
  /** Prefixo dos `data-testid`: `<prefixo>-<cor>` e `<prefixo>-nenhuma`. */
  prefixo: string;
  /** No menu do botão direito os itens são `menuitemradio`; no painel, `radio`. */
  papel: "menuitemradio" | "radio";
};

/**
 * Q11: as 8 cores fixas da borda do token e "sem borda" (sem seletor de cor livre). Cada amostra tem nome acessível
 * (aria-label e dica) e se usa pelo teclado como qualquer botão; a escolhida fica marcada.
 */
export function SeletorDeBorda({ valor, aoEscolher, prefixo, papel }: Props) {
  return (
    <fieldset className="seletor-borda" aria-label="Borda do token">
      {BORDAS.map((b) => (
        <BotaoComDica
          key={b}
          testid={`${prefixo}-${b}`}
          className="borda-amostra"
          nome={`Borda ${ROTULO_DA_BORDA[b].toLowerCase()}`}
          role={papel}
          aria-checked={valor === b}
          aria-label={`Borda ${ROTULO_DA_BORDA[b].toLowerCase()}`}
          style={{ background: CORES_DA_BORDA[b] }}
          onClick={() => aoEscolher(b)}
        />
      ))}
      <BotaoComDica
        testid={`${prefixo}-nenhuma`}
        className="borda-amostra borda-nenhuma"
        nome="Sem borda"
        role={papel}
        aria-checked={valor === undefined}
        aria-label="Sem borda"
        onClick={() => aoEscolher(null)}
      >
        <Ban size={14} aria-hidden />
      </BotaoComDica>
    </fieldset>
  );
}
