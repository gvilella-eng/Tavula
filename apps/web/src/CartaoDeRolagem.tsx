import { d20Natural, type Rolagem } from "@tabletop/shared";

/** "1d20+5" vira "1d20 + 5" (só para ler melhor na tela). */
function expressaoLegivel(expressao: string): string {
  return expressao.replace(/([+-])/g, " $1 ").trim();
}

/** 20 e 1 naturais do d20 que decide a rolagem: o cartão e o dado ganham destaque. */
export function naturalDe(rolagem: Rolagem): "20" | "1" | "" {
  const n = d20Natural(rolagem);
  return n === 20 ? "20" : n === 1 ? "1" : "";
}

/** Os dados rolados, termo a termo; os descartados (kh/kl) riscados; 20 e 1 do d20 destacados. */
function Detalhe({ rolagem }: { rolagem: Rolagem }) {
  return (
    <div className="rolagem-detalhe" data-testid="rolagem-detalhe" role="tooltip">
      {rolagem.termos.map((t, i) => {
        const chave = i;
        if (t.tipo === "constante") {
          return (
            <span key={chave} className="termo constante">
              {t.sinal === -1 ? "−" : "+"} {t.valor}
            </span>
          );
        }
        return (
          <span key={chave} className="termo">
            <span className="termo-nome">
              {t.sinal === -1 ? "−" : i > 0 ? "+" : ""}
              {t.quantidade}d{t.faces}
              {t.manter ? t.manter.modo : ""}
              {t.manter ? t.manter.n : ""}
            </span>
            {t.dados.map((d, j) => {
              const natural = t.faces === 20 && !d.descartado;
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: idem
                  key={j}
                  className={[
                    "dado-rolado",
                    d.descartado ? "descartado" : "",
                    natural && d.valor === 20 ? "nat20" : "",
                    natural && d.valor === 1 ? "nat1" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid="dado-rolado"
                  data-valor={d.valor}
                  data-descartado={d.descartado ? "true" : undefined}
                >
                  {d.valor}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

type Props = {
  rolagem: Rolagem;
  /** Texto acima do total (ex.: "Acerto", "Dano"). */
  rotulo?: string;
  /** Tamanho pequeno, para o meio de uma frase (`[[1d20+5]]`). */
  embutido?: boolean;
};

/**
 * O resultado de uma rolagem: o total grande, a expressão pequena e, ao passar o mouse (ou focar),
 * os dados um a um. 20 natural em dourado, 1 natural em vermelho.
 */
export function CartaoDeRolagem({ rolagem, rotulo, embutido }: Props) {
  const natural = naturalDe(rolagem);
  return (
    <span
      className={`cartao-rolagem ${embutido ? "embutido" : ""}`}
      data-testid="cartao-rolagem"
      data-natural={natural || undefined}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: o foco mostra os dados, como o mouse
      tabIndex={0}
    >
      {rotulo && <span className="rolagem-rotulo">{rotulo}</span>}
      <span className="rolagem-total" data-testid="rolagem-total">
        {rolagem.total}
      </span>
      <span className="rolagem-expressao" data-testid="rolagem-expressao">
        {expressaoLegivel(rolagem.expressao)}
      </span>
      <Detalhe rolagem={rolagem} />
    </span>
  );
}
