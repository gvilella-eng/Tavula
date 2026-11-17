import type { Token, VidaDoToken } from "@tabletop/shared";
import { CampoNumero } from "./campos";

type Props = {
  token: Token;
  vida: VidaDoToken;
  /** Quem edita o personagem (o mestre, no NPC) muda a vida do token. */
  editar: boolean;
  enviar: (tipo: string, dados: object) => string | null;
};

/**
 * Q10: a faixa no alto da ficha aberta a partir de um token de NPC com vida própria (horda): "Este token: Goblin 3 · PV
 * 5/7", editável. Os PV da ficha embaixo passam a ser os do modelo (o que cada token novo copia).
 */
export function FaixaDoToken({ token, vida, editar, enviar }: Props) {
  const mudar = (campo: "atual" | "max" | "temp", n: number) => {
    enviar("token.vida", { id: token.id, [campo]: n });
  };
  return (
    <fieldset
      className="fl-faixa-token"
      aria-label={`Este token: ${token.nome}, vida ${vida.atual} de ${vida.max}`}
      data-testid="ficha-faixa-token"
      data-token-id={token.id}
    >
      <span className="fl-faixa-token-rotulo">Este token:</span>
      <strong className="fl-faixa-token-nome" data-testid="ficha-faixa-token-nome">
        {token.nome}
      </strong>
      <span className="fl-faixa-token-vida">
        <span className="fl-lbl">PV</span>
        <CampoNumero
          testid="faixa-token-pv"
          rotulo="PV atuais deste token"
          valor={vida.atual}
          desabilitado={!editar}
          className="fl-in fl-fn fl-faixa-token-campo"
          aoMudar={(n) => mudar("atual", n)}
        />
        <span aria-hidden>/</span>
        <CampoNumero
          testid="faixa-token-pv-max"
          rotulo="PV máximos deste token"
          valor={vida.max}
          desabilitado={!editar}
          className="fl-in fl-fn fl-faixa-token-campo"
          aoMudar={(n) => mudar("max", n)}
        />
        <span className="fl-lbl">Temp.</span>
        <CampoNumero
          testid="faixa-token-pv-temp"
          rotulo="PV temporários deste token"
          valor={vida.temp}
          desabilitado={!editar}
          className="fl-in fl-fn fl-faixa-token-campo"
          aoMudar={(n) => mudar("temp", n)}
        />
      </span>
    </fieldset>
  );
}
