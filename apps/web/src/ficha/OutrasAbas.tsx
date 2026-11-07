import type { Estado, Usuario } from "@tabletop/shared";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MochilaDoItem } from "../MochilaDoItem";
import type { TempoDaTela } from "../tempo";
import type { PropsDaAba } from "./AbaPrincipal";
import { CampoNumero, CampoTexto } from "./campos";

const um = (caminho: string, valor: unknown) => [{ caminho, valor }];

/** Aba Características: nome e texto de cada característica (de classe, raça, talento...). */
export function AbaCaracteristicas({ ficha, alterar, editar }: PropsDaAba) {
  const lista = ficha.caracteristicas ?? [];
  const [nome, setNome] = useState("");
  return (
    <div className="fh-caracteristicas" data-testid="fh-aba-caracteristicas">
      {lista.length === 0 && <p className="nota">Nenhuma característica.</p>}
      {lista.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
        <article key={i} className="fh-caracteristica" data-testid={`caracteristica-${i}`}>
          <div className="fh-magia-linha">
            <CampoTexto
              testid={`caracteristica-nome-${i}`}
              rotulo="Nome da característica"
              valor={c.nome}
              maxLength={80}
              desabilitado={!editar}
              aoMudar={(t) => alterar(um(`caracteristicas.${i}.nome`, t))}
            />
            {editar && (
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`caracteristica-remover-${i}`}
                title="Tirar a característica"
                aria-label={`Tirar a característica ${c.nome}`}
                onClick={() => alterar(um(`caracteristicas.${i}`, null))}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <CampoTexto
            testid={`caracteristica-descricao-${i}`}
            rotulo={`Texto de ${c.nome}`}
            placeholder="Descrição"
            valor={c.descricao}
            maxLength={20000}
            multilinha
            desabilitado={!editar}
            className="fh-descricao"
            aoMudar={(t) => alterar(um(`caracteristicas.${i}.descricao`, t))}
          />
        </article>
      ))}
      {editar && (
        <form
          className="fh-nova-magia"
          onSubmit={(e) => {
            e.preventDefault();
            const limpo = nome.trim();
            if (
              limpo &&
              alterar(um("caracteristicas", [...lista, { nome: limpo, descricao: "" }]))
            ) {
              setNome("");
            }
          }}
        >
          <input
            type="text"
            data-testid="caracteristica-nova-nome"
            aria-label="Nome da nova característica"
            placeholder="Nome da característica"
            maxLength={80}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button type="submit" data-testid="caracteristica-adicionar">
            <Plus size={14} /> Característica
          </button>
        </form>
      )}
    </div>
  );
}

type PropsEquipamento = PropsDaAba & {
  estado: Estado;
  eu: Usuario;
  personagem: Parameters<typeof MochilaDoItem>[0]["personagem"];
  enviar: (tipo: string, dados: object) => string | null;
  tempo: TempoDaTela;
};

/** Aba Equipamento: objetos de luz (acender), itens, recursos. */
export function AbaEquipamento({
  ficha,
  alterar,
  editar,
  estado,
  eu,
  personagem,
  enviar,
  tempo,
}: PropsEquipamento) {
  const euMestre = eu.papel === "mestre";
  const itens = ficha.itens ?? [];
  const recursos = ficha.recursos ?? [];
  return (
    <div className="fh-equipamento" data-testid="fh-aba-equipamento">
      <MochilaDoItem
        personagem={personagem}
        estado={estado}
        eu={eu}
        enviar={enviar}
        tempo={tempo}
      />

      <section className="fh-secao" data-testid="fh-itens" aria-label="Itens">
        <h4>Itens</h4>
        {itens.length === 0 && <p className="nota">Nenhum item.</p>}
        {itens.map((it, i) => {
          const modelo = it.modeloId ? estado.modelos.find((m) => m.id === it.modeloId) : undefined;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista não tem id e é editada por posição
            <div key={i} className="fh-item" data-testid={`item-${i}`}>
              <CampoTexto
                testid={`item-nome-${i}`}
                rotulo="Nome do item"
                valor={it.nome}
                maxLength={80}
                desabilitado={!editar}
                aoMudar={(t) => alterar(um(`itens.${i}.nome`, t))}
              />
              <CampoNumero
                testid={`item-quantidade-${i}`}
                rotulo={`Quantidade de ${it.nome}`}
                valor={it.quantidade}
                max={it.modeloId && !euMestre ? it.quantidade : 9999}
                desabilitado={!editar}
                className="mini"
                aoMudar={(n) => alterar(um(`itens.${i}.quantidade`, n))}
              />
              <CampoTexto
                testid={`item-nota-${i}`}
                rotulo="Nota do item"
                placeholder="nota"
                valor={it.nota ?? ""}
                maxLength={500}
                desabilitado={!editar}
                aoMudar={(t) => alterar(um(`itens.${i}.nota`, t === "" ? null : t))}
              />
              {euMestre ? (
                <select
                  data-testid={`item-modelo-${i}`}
                  aria-label={`Objeto de luz de ${it.nome}`}
                  title="Objeto de luz (acende da ficha)"
                  value={it.modeloId ?? ""}
                  onChange={(e) =>
                    alterar(
                      um(`itens.${i}.modeloId`, e.target.value === "" ? null : e.target.value),
                    )
                  }
                >
                  <option value="">sem objeto</option>
                  {estado.modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              ) : (
                modelo && <span className="selo">{modelo.nome}</span>
              )}
              {editar && (
                <button
                  type="button"
                  className="botao-icone pequeno"
                  data-testid={`item-remover-${i}`}
                  title="Tirar o item"
                  aria-label={`Tirar ${it.nome}`}
                  onClick={() => alterar(um(`itens.${i}`, null))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
        {editar && (
          <button
            type="button"
            data-testid="item-adicionar"
            onClick={() => alterar(um("itens", [...itens, { nome: "Novo item", quantidade: 1 }]))}
          >
            <Plus size={14} /> Item
          </button>
        )}
      </section>

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
              <button
                type="button"
                className="botao-icone pequeno"
                data-testid={`recurso-remover-${i}`}
                title="Tirar o recurso"
                aria-label={`Tirar o recurso ${r.nome}`}
                onClick={() => alterar(um(`recursos.${i}`, null))}
              >
                <Trash2 size={14} />
              </button>
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

/** Aba Notas: idiomas e o texto livre. */
export function AbaNotas({ ficha, alterar, editar }: PropsDaAba) {
  return (
    <div className="fh-notas" data-testid="fh-aba-notas">
      <div className="fh-campo">
        <span>Idiomas (separados por vírgula)</span>
        <CampoTexto
          testid="ficha-idiomas"
          rotulo="Idiomas"
          valor={(ficha.idiomas ?? []).join(", ")}
          desabilitado={!editar}
          aoMudar={(t) => {
            const lista = t
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            return alterar(um("idiomas", lista.length === 0 ? null : lista));
          }}
        />
      </div>
      <div className="fh-campo">
        <span>Notas</span>
        <CampoTexto
          testid="ficha-notas"
          rotulo="Notas da ficha"
          valor={ficha.notas ?? ""}
          maxLength={50000}
          multilinha
          desabilitado={!editar}
          className="fh-notas-texto"
          aoMudar={(t) => alterar(um("notas", t === "" ? null : t))}
        />
      </div>
    </div>
  );
}
