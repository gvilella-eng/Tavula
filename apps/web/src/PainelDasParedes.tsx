import {
  ESTADOS_DE_PORTA,
  type Parede,
  TIPOS_DE_PAREDE,
  type TipoDeParede,
} from "@tabletop/shared";
import { Trash2, X } from "lucide-react";

export const ROTULO_DO_TIPO: Record<TipoDeParede, string> = {
  parede: "Parede",
  porta: "Porta",
  janela: "Janela",
  secreta: "Secreta",
  invisivel: "Invisível",
};

const ROTULO_DO_ESTADO = { aberta: "Aberta", fechada: "Fechada", trancada: "Trancada" } as const;

type Props = {
  /** Tipo das paredes que a ferramenta desenha. */
  tipoNovo: TipoDeParede;
  aoEscolherTipoNovo: (t: TipoDeParede) => void;
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
    <section className="painel-token" data-testid="painel-paredes" aria-label="Paredes e portas">
      <header>
        <strong>Paredes e portas</strong>
        <button
          type="button"
          className="botao-icone pequeno"
          title="Fechar a ferramenta"
          aria-label="Fechar a ferramenta"
          data-testid="paredes-fechar"
          onClick={p.aoFechar}
        >
          <X size={16} />
        </button>
      </header>
      <p className="nota">
        Clique para desenhar em sequência (duplo clique ou Esc encerra; Alt solta do grid). Clique
        numa parede para editar; Delete apaga.
      </p>
      <fieldset className="quem-controla">
        <legend>Desenhar como</legend>
        <div className="chips">
          {TIPOS_DE_PAREDE.map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              data-testid={`parede-novo-${t}`}
              aria-pressed={p.tipoNovo === t}
              onClick={() => p.aoEscolherTipoNovo(t)}
            >
              {ROTULO_DO_TIPO[t]}
            </button>
          ))}
        </div>
      </fieldset>
      {s && (
        <fieldset className="quem-controla" data-testid="parede-selecionada">
          <legend>Parede selecionada</legend>
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
    </section>
  );
}
