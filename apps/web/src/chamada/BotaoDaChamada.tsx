import { Video } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";

/**
 * "Chamada" no topo da mesa (CH1): abre a janela da chamada (ou a traz para a frente) e mostra quantas pessoas estão
 * nela. A chamada em si mora na janela própria; esta janela só mostra quem está.
 */
export function BotaoDaChamada({
  pessoas,
  euEstou,
  aoClicar,
}: {
  pessoas: number;
  euEstou: boolean;
  aoClicar: () => void;
}) {
  const texto =
    pessoas === 0
      ? "Chamada"
      : `Chamada · ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}${euEstou ? " (você está)" : ""}`;
  return (
    <BotaoComDica
      testid="topo-chamada"
      className="botao-chamada-topo"
      nome={texto}
      aria-label={texto}
      data-na-chamada={pessoas > 0 ? "sim" : "nao"}
      onClick={aoClicar}
    >
      <Video size={17} aria-hidden="true" />
      {pessoas > 0 && (
        <span className="botao-chamada-contagem" data-testid="topo-chamada-contagem">
          {pessoas}
        </span>
      )}
    </BotaoComDica>
  );
}
