import { Check } from "lucide-react";
import { useState } from "react";
import {
  escolherTema,
  IDS_DOS_TEMAS,
  type IdDoTema,
  lerTema,
  NOMES_DOS_TEMAS,
  TEMAS,
} from "./tema/temas";

/**
 * Escolha do tema de cor, em bolinhas como os temas do Chrome: a metade de cima na cor da barra, embaixo
 * à esquerda o destaque e à direita o corpo das janelas; o escolhido leva um selo de check. São botões de
 * rádio de verdade (mesmo `name`), então o grupo se anda com as setas. É preferência deste navegador:
 * nada vai para a sala.
 */
export function SeletorDeTema() {
  const [atual, setAtual] = useState<IdDoTema>(() => lerTema());
  function escolher(id: IdDoTema) {
    escolherTema(id);
    setAtual(id);
  }
  return (
    <div
      className="seletor-de-tema"
      data-testid="seletor-de-tema"
      role="radiogroup"
      aria-label="Tema de cor"
    >
      <span className="seletor-de-tema-titulo" aria-hidden="true">
        Tema de cor
      </span>
      <div className="seletor-de-tema-grade">
        {IDS_DOS_TEMAS.map((id) => {
          const t = TEMAS[id];
          const nome = NOMES_DOS_TEMAS[id];
          return (
            <label
              key={id}
              className="opcao-de-tema"
              data-atual={atual === id}
              title={`Tema ${nome}`}
            >
              <input
                type="radio"
                name="tema"
                data-testid={`tema-${id}`}
                aria-label={nome}
                checked={atual === id}
                onChange={() => escolher(id)}
              />
              <span className="bolinha-caixa" aria-hidden="true">
                <span className="bolinha-de-tema" style={{ borderColor: t.borda }}>
                  <span className="bolinha-barra" style={{ background: t.barra }} />
                  <span style={{ background: t.acento }} />
                  <span style={{ background: t.painel }} />
                </span>
                {atual === id && (
                  <span className="bolinha-selo" data-testid={`tema-selo-${id}`}>
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                )}
              </span>
              <span className="nome-do-tema">{nome}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
