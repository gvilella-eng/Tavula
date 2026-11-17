import { memo } from "react";
import {
  ATALHOS,
  atalhosDoGrupo,
  GRUPOS_MAIS_USADOS,
  GRUPOS_RECOLHIDOS,
  type GrupoDeAtalhos,
} from "./atalhos";
import { Teclas } from "./Dica";

const Grupo = memo(function Grupo({ grupo }: { grupo: GrupoDeAtalhos }) {
  return (
    <dl>
      {atalhosDoGrupo(grupo).map(({ id }) => (
        <div key={id} className="atalho-linha" data-testid={`atalho-${id}`}>
          <dt>
            <Teclas teclas={ATALHOS[id].teclas} juntas={"juntas" in ATALHOS[id]} />
          </dt>
          <dd>{ATALHOS[id].descricao}</dd>
        </div>
      ))}
    </dl>
  );
});

/**
 * "Atalhos do teclado" da aba Preferências: a tabela única de `atalhos.ts`. No alto, aberta, "Os mais usados"
 * (ferramentas e mapa); o resto em seções recolhidas, com os mesmos títulos de sempre (V14).
 */
export const ListaDeAtalhos = memo(function ListaDeAtalhos() {
  return (
    <section className="lista-de-atalhos" data-testid="atalhos" aria-label="Atalhos do teclado">
      <p className="nota">
        Os mesmos que aparecem nas dicas dos botões (se as dicas estiverem ligadas). Não valem
        enquanto você escreve num campo. Os atalhos recolhidos servem para usar tudo pelo teclado.
      </p>
      <details open className="atalhos-secao" data-testid="atalhos-mais-usados">
        <summary>Os mais usados</summary>
        {GRUPOS_MAIS_USADOS.map((grupo) => (
          <div key={grupo} className="atalhos-grupo" data-testid={`atalhos-grupo-${grupo}`}>
            <h4>{grupo}</h4>
            <Grupo grupo={grupo} />
          </div>
        ))}
      </details>
      {GRUPOS_RECOLHIDOS.map((grupo) => (
        <details
          key={grupo}
          className="atalhos-secao atalhos-grupo"
          data-testid={`atalhos-grupo-${grupo}`}
        >
          <summary>{grupo}</summary>
          <Grupo grupo={grupo} />
        </details>
      ))}
    </section>
  );
});
