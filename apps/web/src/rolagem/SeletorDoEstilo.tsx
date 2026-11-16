import {
  definirEstiloDasRolagens,
  ESTILOS_DAS_ROLAGENS,
  type EstiloDasRolagens,
  NOMES_DOS_ESTILOS,
  useEstiloDasRolagens,
} from "./estilo";
import { IconeDoDano } from "./IconeDoDano";

/** Uma amostra pequena de um estilo (um ataque: acerto e dano), com o mesmo CSS do cartão do chat. */
function Previa({ estilo }: { estilo: EstiloDasRolagens }) {
  return (
    <span className="rc rc-previa" data-estilo={estilo} data-tom="normal" aria-hidden="true">
      <span className="rc-borda">
        <span className="rc-miolo">
          <span className="rc-fita">
            <span className="rc-fita-texto">Machadinha</span>
          </span>
          <span className="rc-regra">
            <b />
            <i />
            <b />
          </span>
          <span className="rc-corpo">
            <span className="rc-metade">
              <span className="rc-coluna">
                <span className="rc-num" data-tom="normal">
                  17
                </span>
              </span>
            </span>
            <span className="rc-metade">
              <span className="rc-coluna">
                <span className="rc-dano">
                  <span className="rc-num" data-tom="normal">
                    8
                  </span>
                  <IconeDoDano tipo="cortante" tamanho={14} />
                </span>
              </span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Preferências → Aparência: o estilo dos cartões de rolagem no chat (Q5). Dois botões de rádio com uma prévia pequena
 * cada. Preferência deste navegador (`tabletop:pref:estiloDasRolagens`): nada vai para a sala.
 */
export function SeletorDoEstilo() {
  const atual = useEstiloDasRolagens();
  return (
    <div
      className="seletor-de-estilo"
      data-testid="seletor-de-estilo-rolagem"
      role="radiogroup"
      aria-label="Estilo das rolagens no chat"
    >
      <span className="seletor-de-tema-titulo" aria-hidden="true">
        Estilo das rolagens no chat
      </span>
      <div className="seletor-de-estilo-grade">
        {ESTILOS_DAS_ROLAGENS.map((id) => (
          <label key={id} className="opcao-de-estilo" data-atual={atual === id}>
            <input
              type="radio"
              name="estilo-das-rolagens"
              data-testid={`estilo-rolagem-${id}`}
              checked={atual === id}
              onChange={() => definirEstiloDasRolagens(id)}
            />
            <Previa estilo={id} />
            <span className="opcao-de-estilo-nome">{NOMES_DOS_ESTILOS[id]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
