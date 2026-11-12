import { type Estado, iconesDoToken, type Usuario } from "@tabletop/shared";
import { Minus, Plus, Trash2 } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";
import { corDoTextoSobre } from "../contrasteDeCor";
import { MochilaDoItem } from "../MochilaDoItem";
import type { TempoDaTela } from "../tempo";
import { type PropsDaAba, um } from "./AbaPrincipal";
import { CampoNumero, CampoTexto } from "./campos";

type Props = PropsDaAba & {
  estado: Estado;
  eu: Usuario;
  personagem: Parameters<typeof MochilaDoItem>[0]["personagem"];
  tempo: TempoDaTela;
};

/** Condições, exaustão e concentração do token do personagem na cena ativa (só leitura; o menu do token as muda). */
function Condicoes({ token }: PropsDaAba) {
  const icones = token ? iconesDoToken(token) : [];
  return (
    <section className="fh-condicoes" data-testid="fh-condicoes" aria-label="Condições">
      <h4>Condições</h4>
      {!token ? (
        <p className="nota" data-testid="fh-condicoes-sem-token">
          Sem token na cena atual.
        </p>
      ) : icones.length === 0 ? (
        <p className="nota" data-testid="fh-condicoes-nenhuma">
          Nenhuma condição.
        </p>
      ) : (
        <ul className="fh-condicoes-lista">
          {icones.map((i) => (
            <li key={i.chave} className="fh-condicao" data-testid={`fh-condicao-${i.chave}`}>
              <span
                className="fh-condicao-sigla"
                style={{ background: i.cor, color: corDoTextoSobre(i.cor) }}
                aria-hidden
              >
                {i.sigla}
              </span>
              <span className="fh-condicao-texto">{i.titulo}</span>
            </li>
          ))}
        </ul>
      )}
      {token && (
        <p className="nota">
          Passe o mouse para ler a regra. Para mudar: botão direito no token do mapa,{" "}
          <em>Condições</em>.
        </p>
      )}
    </section>
  );
}

/**
 * Embaixo da página 1 (fora do papel, no tema da janela): o que o PDF não tem e a mesa precisa: condições do
 * token, objetos de luz, objeto de luz de cada item (mestre) e os recursos (flechas, usos de classe...).
 */
export function PainelExtra(props: Props) {
  const { ficha, alterar, editar, estado, eu, personagem, enviar, tempo } = props;
  const euMestre = eu.papel === "mestre";
  const itens = ficha.itens ?? [];
  const recursos = ficha.recursos ?? [];
  return (
    <div className="fh-extra" data-testid="fh-extra">
      <Condicoes {...props} />
      <MochilaDoItem
        personagem={personagem}
        estado={estado}
        eu={eu}
        enviar={enviar}
        tempo={tempo}
      />
      {euMestre && itens.length > 0 && (
        <section className="fh-secao" aria-label="Objeto de luz dos itens">
          <h4>Objeto de luz dos itens</h4>
          {itens.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
            <label key={i} className="fh-item-modelo">
              <span>{it.nome}</span>
              <select
                data-testid={`item-modelo-${i}`}
                aria-label={`Objeto de luz de ${it.nome}`}
                value={it.modeloId ?? ""}
                onChange={(e) =>
                  alterar(um(`itens.${i}.modeloId`, e.target.value === "" ? null : e.target.value))
                }
              >
                <option value="">sem objeto</option>
                {estado.modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}
      <section className="fh-secao" data-testid="fh-recursos" aria-label="Recursos">
        <h4>Recursos</h4>
        {recursos.length === 0 && (
          <p className="nota">Nenhum recurso (flechas, usos de classe...).</p>
        )}
        {recursos.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
          <div key={i} className="fh-recurso" data-testid={`recurso-${i}`}>
            <CampoTexto
              testid={`recurso-nome-${i}`}
              rotulo="Nome do recurso"
              valor={r.nome}
              maxLength={80}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(`recursos.${i}.nome`, t))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`recurso-menos-${i}`}
                aria-label={`Gastar um uso de ${r.nome}`}
                disabled={r.atual <= 0}
                onClick={() => alterar(um(`recursos.${i}.atual`, r.atual - 1))}
              >
                <Minus size={14} />
              </button>
            )}
            <CampoNumero
              testid={`recurso-atual-${i}`}
              rotulo={`${r.nome}: atual`}
              valor={r.atual}
              desabilitado={!editar}
              className="mini"
              aoMudar={(n) => alterar(um(`recursos.${i}.atual`, n))}
            />
            <span>/</span>
            <CampoNumero
              testid={`recurso-max-${i}`}
              rotulo={`${r.nome}: máximo`}
              valor={r.max}
              desabilitado={!editar}
              className="mini"
              aoMudar={(n) => alterar(um(`recursos.${i}.max`, n))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`recurso-mais-${i}`}
                aria-label={`Recuperar um uso de ${r.nome}`}
                disabled={r.atual >= r.max}
                onClick={() => alterar(um(`recursos.${i}.atual`, r.atual + 1))}
              >
                <Plus size={14} />
              </button>
            )}
            <select
              data-testid={`recurso-recarga-${i}`}
              aria-label={`Recarga de ${r.nome}`}
              value={r.recarga}
              disabled={!editar}
              onChange={(e) => alterar(um(`recursos.${i}.recarga`, e.target.value))}
            >
              <option value="curto">descanso curto</option>
              <option value="longo">descanso longo</option>
              <option value="nenhuma">não recarrega</option>
            </select>
            {editar && (
              <BotaoComDica
                className="botao-icone pequeno"
                testid={`recurso-remover-${i}`}
                nome={`Tirar o recurso ${r.nome}`}
                aria-label={`Tirar o recurso ${r.nome}`}
                onClick={() => alterar(um(`recursos.${i}`, null))}
              >
                <Trash2 size={14} />
              </BotaoComDica>
            )}
          </div>
        ))}
        {editar && (
          <button
            type="button"
            data-testid="recurso-adicionar"
            onClick={() =>
              alterar(
                um("recursos", [
                  ...recursos,
                  { nome: "Novo recurso", atual: 1, max: 1, recarga: "longo" },
                ]),
              )
            }
          >
            <Plus size={14} /> Recurso
          </button>
        )}
      </section>
    </div>
  );
}
