import { ATALHOS, atalhosDoGrupo, GRUPOS_DE_ATALHOS } from "./atalhos";
import { Teclas } from "./Dica";

/** "Atalhos do teclado" da aba Preferências: a tabela única de `atalhos.ts`, por grupo. */
export function ListaDeAtalhos() {
  return (
    <section className="lista-de-atalhos" data-testid="atalhos" aria-labelledby="atalhos-titulo">
      <h3 id="atalhos-titulo">Atalhos do teclado</h3>
      <p className="nota">
        Os mesmos que aparecem nas dicas dos botões. Não valem enquanto você escreve num campo.
      </p>
      {GRUPOS_DE_ATALHOS.map((grupo) => (
        <div key={grupo} className="atalhos-grupo" data-testid={`atalhos-grupo-${grupo}`}>
          <h4>{grupo}</h4>
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
        </div>
      ))}
    </section>
  );
}
