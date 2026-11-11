import { MapPin } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { noTopoAoCentro } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";

/** As cores que o formulário oferece (a primeira é sorteada para cada token novo). */
export const CORES_DE_TOKEN = ["#3cb44b", "#4363d8", "#f58231", "#911eb4", "#e6194b", "#42d4f4"];
export const NOMES_DAS_CORES = ["Verde", "Azul", "Laranja", "Roxo", "Vermelho", "Ciano"];

export type NovoTokenPedido = { nome: string; cor: string; tamanhoQuadrados: number };

type Props = {
  /** Enter ou "Pôr no mapa": o formulário fecha e a mesa entra no modo de clicar no mapa. */
  aoConfirmar: (token: NovoTokenPedido) => void;
  aoCancelar: () => void;
};

/**
 * "Novo token" (R5a): pergunta o nome, a cor e o tamanho antes de criar. Nada é criado aqui: o token só
 * nasce quando a pessoa clica no mapa (modo "pôr token", com uma prévia sob o cursor).
 */
export function NovoToken({ aoConfirmar, aoCancelar }: Props) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(
    () => CORES_DE_TOKEN[Math.floor(Math.random() * CORES_DE_TOKEN.length)] ?? "#3cb44b",
  );
  const [tamanho, setTamanho] = useState(1);
  const limpo = nome.trim();
  // O formulário abre por um clique: o foco já vai para o nome. A janela só fica visível depois de medida
  // (elemento invisível não recebe foco), então o foco espera o próximo quadro.
  const focarNoNome = useCallback((el: HTMLInputElement | null) => {
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (limpo) aoConfirmar({ nome: limpo, cor, tamanhoQuadrados: tamanho });
  }

  return (
    <Janela
      id="novo-token"
      titulo="Novo token"
      cabecalho={<strong>Novo token</strong>}
      testid="novo-token-janela"
      classeDoCorpo="novo-token"
      padrao={noTopoAoCentro()}
      largura={272}
      aoFechar={aoCancelar}
      rotuloDoFechar="Cancelar"
      testidDoFechar="novo-token-fechar"
    >
      <form
        onSubmit={enviar}
        onKeyDown={(e) => {
          if (e.key === "Escape") aoCancelar();
        }}
      >
        <label>
          Nome
          <input
            ref={focarNoNome}
            data-testid="novo-token-nome"
            value={nome}
            maxLength={64}
            placeholder="Ex.: Goblin 1"
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <fieldset className="novo-token-cores">
          <legend>Cor</legend>
          <div className="chips">
            {CORES_DE_TOKEN.map((c, i) => (
              <label key={c} className="novo-token-cor-rotulo">
                <input
                  type="radio"
                  name="novo-token-cor"
                  className="so-leitor"
                  checked={cor === c}
                  aria-label={NOMES_DAS_CORES[i]}
                  data-testid={`novo-token-cor-${i}`}
                  onChange={() => setCor(c)}
                />
                <span className="novo-token-cor" style={{ background: c }} aria-hidden />
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Tamanho (quadrados)
          <select
            data-testid="novo-token-tamanho"
            value={tamanho}
            onChange={(e) => setTamanho(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="nota novo-token-nota">
          Depois você clica no mapa para pôr o token. Para um personagem que já tem ficha, arraste-o
          da aba Fichas para o mapa.
        </p>
        <div className="linha-botoes">
          <button type="button" data-testid="novo-token-cancelar" onClick={aoCancelar}>
            Cancelar
          </button>
          <button type="submit" className="primario" data-testid="novo-token-por" disabled={!limpo}>
            <MapPin size={16} /> Pôr no mapa
          </button>
        </div>
      </form>
    </Janela>
  );
}
