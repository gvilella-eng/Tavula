import { useState } from "react";
import {
  escolherTema,
  IDS_DOS_TEMAS,
  type IdDoTema,
  lerTema,
  NOMES_DOS_TEMAS,
  TEMAS,
} from "./tema/temas";

/** Escolha do tema de cor, com amostras. É preferência deste navegador: nada vai para a sala. */
export function SeletorDeTema() {
  const [atual, setAtual] = useState<IdDoTema>(() => lerTema());
  function escolher(id: IdDoTema) {
    escolherTema(id);
    setAtual(id);
  }
  return (
    <fieldset className="seletor-de-tema" data-testid="seletor-de-tema">
      <legend>Tema de cor</legend>
      {IDS_DOS_TEMAS.map((id) => {
        const t = TEMAS[id];
        return (
          <label key={id} className="opcao-de-tema" data-atual={atual === id}>
            <input
              type="radio"
              name="tema"
              data-testid={`tema-${id}`}
              checked={atual === id}
              onChange={() => escolher(id)}
            />
            <span
              className="amostra-de-tema"
              aria-hidden="true"
              style={{ background: t.fundo, borderColor: t.borda }}
            >
              <span style={{ background: t.barra }} />
              <span style={{ background: t.painel }} />
              <span style={{ background: t.acento }} />
            </span>
            {NOMES_DOS_TEMAS[id]}
          </label>
        );
      })}
    </fieldset>
  );
}
