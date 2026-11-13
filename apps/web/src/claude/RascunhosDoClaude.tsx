import {
  type Estado,
  type ItemDeRascunho,
  listarRascunhos,
  ROTULO_DO_TIPO_DE_RASCUNHO,
} from "@tabletop/shared";
import { useState } from "react";
import { Popover } from "../Popover";

type Enviar = (tipo: string, dados: object) => string | null;

/** O selo pequeno "Rascunho" que marca, para o mestre, um item que o Claude criou e os jogadores ainda não veem. */
export function SeloDeRascunho({ testid }: { testid?: string }) {
  return (
    <span
      className="selo-rascunho"
      title="Rascunho do Claude: os jogadores não o veem até você publicar"
      {...(testid ? { "data-testid": testid } : {})}
    >
      Rascunho
    </span>
  );
}

/**
 * O chip "Rascunhos do Claude (N)" no topo do mestre: abre a lista com **Publicar** (por item ou tudo) e **Descartar** (apaga,
 * com confirmação na própria página). Só aparece quando há rascunho.
 */
export function RascunhosDoClaude({ estado, enviar }: { estado: Estado; enviar: Enviar }) {
  const [aberta, setAberta] = useState(false);
  const [descartando, setDescartando] = useState<string | null>(null);
  const itens = listarRascunhos(estado);
  if (itens.length === 0) return null;
  const chave = (i: ItemDeRascunho) => `${i.tipo}:${i.id}`;
  return (
    <span className="rascunhos-area">
      <button
        type="button"
        className="chip-rascunhos"
        data-testid="chip-rascunhos"
        data-popover-gatilho=""
        aria-expanded={aberta}
        aria-haspopup="dialog"
        onClick={() => setAberta(!aberta)}
      >
        Rascunhos do Claude ({itens.length})
      </button>
      {aberta && (
        <Popover
          testid="rascunhos-lista"
          className="rascunhos-lista"
          titulo="Rascunhos do Claude"
          aoFechar={() => {
            setAberta(false);
            setDescartando(null);
          }}
        >
          <p className="nota">
            O que o Claude criou fica escondido dos jogadores, sem efeito na mesa, até você
            publicar.
          </p>
          <ul className="lista-simples rascunhos-itens">
            {itens.map((i) => (
              <li
                key={chave(i)}
                className="rascunho-item"
                data-testid="rascunho-item"
                data-tipo={i.tipo}
                data-id={i.id}
              >
                <span className="rascunho-nome">
                  <span className="rascunho-tipo">{ROTULO_DO_TIPO_DE_RASCUNHO[i.tipo]}</span>{" "}
                  {i.nome}
                </span>
                {descartando === chave(i) ? (
                  <span className="rascunho-acoes" role="alertdialog">
                    <button
                      type="button"
                      className="perigo"
                      data-testid="rascunho-descartar-confirmar"
                      onClick={() => {
                        enviar("rascunho.descartar", { itens: [{ tipo: i.tipo, id: i.id }] });
                        setDescartando(null);
                      }}
                    >
                      Apagar mesmo
                    </button>
                    <button type="button" onClick={() => setDescartando(null)}>
                      Não
                    </button>
                  </span>
                ) : (
                  <span className="rascunho-acoes">
                    <button
                      type="button"
                      data-testid="rascunho-publicar"
                      onClick={() =>
                        enviar("rascunho.publicar", { itens: [{ tipo: i.tipo, id: i.id }] })
                      }
                    >
                      Publicar
                    </button>
                    <button
                      type="button"
                      className="perigo"
                      data-testid="rascunho-descartar"
                      onClick={() => setDescartando(chave(i))}
                    >
                      Descartar
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="linha-botoes">
            <button
              type="button"
              className="primario"
              data-testid="rascunho-publicar-tudo"
              onClick={() => enviar("rascunho.publicar", {})}
            >
              Publicar tudo
            </button>
          </div>
        </Popover>
      )}
    </span>
  );
}
