import { Pause, Play } from "lucide-react";
import type { KeyboardEvent } from "react";
import { ABAS_DO_SOM, type AbaDoSom, abaVizinha } from "./abaDoSom";

type Props = {
  aba: AbaDoSom;
  aoMudar: (aba: AbaDoSom) => void;
  /** O que toca em Efeitos e ambientes ("2 ambientes ligados" ou "nada tocando"). */
  efeitos: { estado: string; toca: boolean };
  /** O que toca em Música: o nome do botão e se está tocando ou pausada; sem nome, "parada". */
  musica: { nome: string | null; tocando: boolean; toca: boolean };
};

export const NOMES_DAS_ABAS: Record<AbaDoSom, string> = {
  efeitos: "Efeitos e ambientes",
  musica: "Música",
};

/**
 * MU2: a barra de abas da mesa de som, logo abaixo do cabeçalho. Cada aba diz o que toca nela, e um ponto marca a aba
 * escondida que tem algo tocando. Setas (e Home e End) trocam de aba.
 */
export function AbasDoSom({ aba, aoMudar, efeitos, musica }: Props) {
  const estadoDaMusica = musica.nome
    ? `${musica.nome}${musica.tocando ? "" : " (pausada)"}`
    : "parada";
  const estados: Record<AbaDoSom, string> = { efeitos: efeitos.estado, musica: estadoDaMusica };
  const tocam: Record<AbaDoSom, boolean> = { efeitos: efeitos.toca, musica: musica.toca };

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    let destino: AbaDoSom | undefined;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") destino = abaVizinha(aba, 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") destino = abaVizinha(aba, -1);
    else if (e.key === "Home") destino = ABAS_DO_SOM[0];
    else if (e.key === "End") destino = ABAS_DO_SOM[ABAS_DO_SOM.length - 1];
    if (!destino) return;
    e.preventDefault();
    aoMudar(destino);
    // o foco acompanha a aba nova (só uma aba fica na ordem do Tab)
    const alvo = destino;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-testid="som-aba-${alvo}"]`)?.focus();
    });
  }

  return (
    <div
      className="som-abas"
      role="tablist"
      aria-label="Partes da mesa de som"
      data-testid="som-abas"
      onKeyDown={aoTeclar}
    >
      {ABAS_DO_SOM.map((id) => {
        const escondidaTocando = aba !== id && tocam[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`som-aba-${id}`}
            className="som-aba"
            data-testid={`som-aba-${id}`}
            data-toca={tocam[id] ? "sim" : "nao"}
            aria-selected={aba === id}
            aria-controls={`som-painel-${id}`}
            aria-label={`${NOMES_DAS_ABAS[id]}: ${estados[id]}${escondidaTocando ? " (tocando)" : ""}`}
            tabIndex={aba === id ? 0 : -1}
            onClick={() => aoMudar(id)}
          >
            <span className="som-aba-nome">
              {NOMES_DAS_ABAS[id]}
              {escondidaTocando && (
                <span
                  className="som-aba-ponto"
                  data-testid={`som-aba-${id}-ponto`}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="som-aba-estado" data-testid={`som-aba-${id}-estado`}>
              {id === "musica" &&
                musica.nome &&
                (musica.tocando ? (
                  <Play size={10} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Pause size={10} fill="currentColor" aria-hidden="true" />
                ))}
              <span className="som-aba-estado-texto">{estados[id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
