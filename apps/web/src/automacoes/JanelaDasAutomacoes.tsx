import {
  automacoesDe,
  type BotaoDeEvento,
  type Ciclo,
  type Estado,
  type Fica,
  nomeDoEvento,
  type Reacao,
  situacaoDoCiclo,
} from "@tabletop/shared";
import { Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { MARGEM, noTopoAoCentro } from "../janelas/geometria";
import { Janela } from "../janelas/Janela";
import { useTic } from "../tempo";
import { FormularioDaReacao } from "./FormularioDaReacao";
import { FormularioDoBotao } from "./FormularioDoBotao";
import { FormularioDoCiclo } from "./FormularioDoCiclo";
import { duracaoCurta, eventosDoMestre, eventosEmUso, resumoDaReacao } from "./rascunho";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  enviar: Enviar;
  salaMs: () => number | undefined;
  aoFechar: () => void;
};

type Vista =
  | { tipo: "lista" }
  | { tipo: "ciclo"; id: string | null }
  | { tipo: "reacao"; id: string | null; fica?: Fica }
  | { tipo: "botao"; id: string | null };

/** O texto de onde uma reação fica, para agrupar a lista. */
function tituloDoGrupo(f: Fica, estado: Estado): string {
  if (f.tipo === "mesa") return "A mesa toda";
  if (f.tipo === "modelo") {
    return `Modelo: ${estado.modelos.find((m) => m.id === f.id)?.nome ?? "(apagado)"}`;
  }
  if (f.tipo === "cena")
    return `Cena: ${estado.cenas.find((c) => c.id === f.id)?.nome ?? "(apagada)"}`;
  return `Zona: ${(estado.zonas ?? []).find((z) => z.id === f.id)?.nome ?? "(apagada)"}`;
}

const chaveDoGrupo = (f: Fica) => (f.tipo === "mesa" ? "mesa" : `${f.tipo}:${f.id}`);

/**
 * O editor das automações do mestre (7b-3): uma janela flutuante, aberta pela aba Mesa. Lista os ciclos (com a fase ao
 * vivo), as reações (agrupadas por onde ficam), os eventos em uso e os botões de evento; cada peça tem um formulário
 * com o JSON ao lado. Só o mestre a vê.
 */
export function JanelaDasAutomacoes({ estado, enviar, salaMs, aoFechar }: Props) {
  const [vista, setVista] = useState<Vista>({ tipo: "lista" });
  const a = automacoesDe(estado);
  const opcoesDeCena = estado.cenas.map((c) => ({ id: c.id, nome: c.nome }));
  const eventos = eventosDoMestre(a);

  const voltar = () => setVista({ tipo: "lista" });

  function salvarCiclo(ciclo: Ciclo, novo: boolean) {
    if (novo) {
      enviar("ciclo.criar", { ciclo });
    } else {
      const { id, ...resto } = ciclo;
      enviar("ciclo.editar", {
        id,
        mudancas: {
          ...resto,
          liberadoParaJogadores: ciclo.liberadoParaJogadores ?? false,
          fixado: ciclo.fixado ?? false,
        },
      });
    }
    voltar();
  }
  function salvarReacao(reacao: Reacao, nova: boolean) {
    if (nova) {
      enviar("reacao.criar", { reacao });
    } else {
      const { id, ...resto } = reacao;
      enviar("reacao.editar", { id, mudancas: resto });
    }
    voltar();
  }
  function salvarBotao(botao: BotaoDeEvento, novo: boolean) {
    if (novo) {
      enviar("botao.criar", { botao });
    } else {
      const { id, ...resto } = botao;
      enviar("botao.editar", {
        id,
        mudancas: {
          ...resto,
          cenaId: botao.cenaId ?? null,
          fixado: botao.fixado ?? false,
          liberadoParaJogadores: botao.liberadoParaJogadores ?? false,
        },
      });
    }
    voltar();
  }

  let corpo: ReactNode;
  if (vista.tipo === "ciclo") {
    const inicial = vista.id === null ? null : (a.ciclos.find((c) => c.id === vista.id) ?? null);
    corpo = (
      <FormularioDoCiclo
        key={vista.id ?? "novo"}
        inicial={inicial}
        cenas={opcoesDeCena}
        idsUsados={new Set(a.ciclos.map((c) => c.id))}
        eventos={eventos}
        aoSalvar={salvarCiclo}
        aoCancelar={voltar}
      />
    );
  } else if (vista.tipo === "reacao") {
    const inicial = vista.id === null ? null : (a.reacoes.find((r) => r.id === vista.id) ?? null);
    corpo = (
      <FormularioDaReacao
        key={vista.id ?? "nova"}
        inicial={inicial}
        {...(vista.fica ? { ficaPadrao: vista.fica } : {})}
        modelos={estado.modelos.map((m) => ({ id: m.id, nome: m.nome }))}
        cenas={opcoesDeCena}
        zonas={(estado.zonas ?? []).map((z) => ({ id: z.id, nome: z.nome }))}
        idsUsados={new Set(a.reacoes.map((r) => r.id))}
        eventos={eventos}
        aoSalvar={salvarReacao}
        aoCancelar={voltar}
      />
    );
  } else if (vista.tipo === "botao") {
    const inicial = vista.id === null ? null : (a.botoes.find((b) => b.id === vista.id) ?? null);
    corpo = (
      <FormularioDoBotao
        key={vista.id ?? "novo"}
        inicial={inicial}
        cenas={opcoesDeCena}
        idsUsados={new Set(a.botoes.map((b) => b.id))}
        eventos={eventos}
        aoSalvar={salvarBotao}
        aoCancelar={voltar}
      />
    );
  } else {
    corpo = <Lista estado={estado} enviar={enviar} salaMs={salaMs} aoIr={setVista} />;
  }

  return (
    <Janela
      id="automacoes"
      titulo="Automações"
      icone={<Workflow size={16} />}
      testid="automacoes-janela"
      classeDoCorpo="janela-automacoes"
      padrao={noTopoAoCentro(MARGEM)}
      largura={540}
      altura={(area) => Math.min(660, Math.max(320, area.altura - 2 * MARGEM))}
      minLargura={360}
      redimensionar="ambos"
      aoFechar={aoFechar}
      rotuloDoFechar="Fechar as automações"
      testidDoFechar="automacoes-fechar"
    >
      {corpo}
    </Janela>
  );
}

// --- A lista -----------------------------------------------------------------------------------

function Lista(p: {
  estado: Estado;
  enviar: Enviar;
  salaMs: () => number | undefined;
  aoIr: (v: Vista) => void;
}) {
  const { estado, enviar } = p;
  useTic(true);
  const a = automacoesDe(estado);
  const [apagando, setApagando] = useState<string | null>(null);
  const sala = p.salaMs();

  function apagar(tipo: string, id: string) {
    enviar(tipo, { id });
    setApagando(null);
  }
  const confirmar = (chave: string, tipo: string, id: string, nome: string) => (
    <div className="confirmar-apagar" role="alert" data-testid={`${chave}-confirmacao`}>
      <span>Apagar “{nome}”?</span>
      <button
        type="button"
        className="perigo"
        data-testid={`${chave}-apagar-confirmar`}
        onClick={() => apagar(tipo, id)}
      >
        Apagar
      </button>
      <button
        type="button"
        data-testid={`${chave}-apagar-cancelar`}
        onClick={() => setApagando(null)}
      >
        Cancelar
      </button>
    </div>
  );

  // As reações por onde ficam, na ordem da lista.
  const grupos = new Map<string, { fica: Fica; reacoes: Reacao[] }>();
  for (const r of a.reacoes) {
    const k = chaveDoGrupo(r.fica);
    const g = grupos.get(k) ?? { fica: r.fica, reacoes: [] };
    g.reacoes.push(r);
    grupos.set(k, g);
  }
  const usados = eventosEmUso(a);

  return (
    <div className="lista-das-automacoes" data-testid="automacoes-lista">
      <p className="nota">
        Ciclos, reações e botões da mesa. Só você vê o que está aqui; os jogadores veem apenas o
        efeito e os botões que você liberar.
      </p>

      <section className="secao-das-automacoes" data-testid="auto-ciclos">
        <header>
          <h3 className="titulo-da-automacao">Ciclos</h3>
          <button
            type="button"
            data-testid="auto-novo-ciclo"
            onClick={() => p.aoIr({ tipo: "ciclo", id: null })}
          >
            <Plus size={14} /> Novo ciclo
          </button>
        </header>
        {a.ciclos.length === 0 && <p className="nota">Nenhum ciclo ainda.</p>}
        <ul className="lista-simples">
          {a.ciclos.map((c) => {
            const s = situacaoDoCiclo(c, a.execucao[c.id], sala ?? 0);
            const chave = `auto-ciclo-${c.id}`;
            return (
              <li key={c.id} className="peca-da-lista" data-testid={chave} data-pausado={s.pausado}>
                <div className="peca-topo">
                  <strong className="peca-nome">{c.nome}</strong>
                  <span className="nota">
                    a cada {duracaoCurta(c.periodoS * 1000)} ·{" "}
                    {c.cenas.length === 0
                      ? "todas as cenas"
                      : c.cenas
                          .map((id) => estado.cenas.find((x) => x.id === id)?.nome ?? "(apagada)")
                          .join(", ")}
                  </span>
                </div>
                <p className="nota" data-testid={`${chave}-fase`}>
                  {s.pausado ? "Pausado" : "Rodando"} ·{" "}
                  {s.atual ? `fase “${nomeDoEvento(s.atual.evento)}”` : "no começo"}
                  {!s.pausado &&
                  a.execucao[c.id] !== undefined &&
                  sala !== undefined &&
                  s.proximaEmMs !== null &&
                  s.proxima
                    ? ` · “${nomeDoEvento(s.proxima.evento)}” em ${duracaoCurta(s.proximaEmMs)}`
                    : ""}
                </p>
                {apagando === chave ? (
                  confirmar(chave, "ciclo.apagar", c.id, c.nome)
                ) : (
                  <div className="peca-acoes">
                    <button
                      type="button"
                      className="botao-da-peca"
                      data-testid={`${chave}-disparar`}
                      onClick={() => enviar("ciclo.disparar", { id: c.id })}
                    >
                      Disparar
                    </button>
                    <button
                      type="button"
                      className="botao-da-peca"
                      data-testid={`${chave}-pausa`}
                      onClick={() =>
                        enviar(s.pausado ? "ciclo.retomar" : "ciclo.pausar", { id: c.id })
                      }
                    >
                      {s.pausado ? "Retomar" : "Pausar"}
                    </button>
                    <button
                      type="button"
                      className="chip botao-da-peca"
                      aria-pressed={c.fixado === true}
                      data-testid={`${chave}-fixar`}
                      onClick={() =>
                        enviar("ciclo.editar", {
                          id: c.id,
                          mudancas: { fixado: c.fixado !== true },
                        })
                      }
                    >
                      Fixar na barra
                    </button>
                    <button
                      type="button"
                      className="chip botao-da-peca"
                      aria-pressed={c.liberadoParaJogadores === true}
                      data-testid={`${chave}-liberar`}
                      onClick={() =>
                        enviar("ciclo.editar", {
                          id: c.id,
                          mudancas: { liberadoParaJogadores: c.liberadoParaJogadores !== true },
                        })
                      }
                    >
                      Liberar aos jogadores
                    </button>
                    <span className="peca-icones">
                      <BotaoComDica
                        className="botao-icone pequeno"
                        testid={`${chave}-editar`}
                        nome={`Editar “${c.nome}”`}
                        onClick={() => p.aoIr({ tipo: "ciclo", id: c.id })}
                      >
                        <Pencil size={14} />
                      </BotaoComDica>
                      <BotaoComDica
                        className="botao-icone pequeno"
                        testid={`${chave}-apagar`}
                        nome={`Apagar “${c.nome}”`}
                        onClick={() => setApagando(chave)}
                      >
                        <Trash2 size={14} />
                      </BotaoComDica>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="secao-das-automacoes" data-testid="auto-reacoes">
        <header>
          <h3 className="titulo-da-automacao">Reações</h3>
          <button
            type="button"
            data-testid="auto-nova-reacao"
            onClick={() => p.aoIr({ tipo: "reacao", id: null })}
          >
            <Plus size={14} /> Nova reação
          </button>
        </header>
        {a.reacoes.length === 0 && <p className="nota">Nenhuma reação ainda.</p>}
        {[...grupos.entries()].map(([k, g]) => (
          <div className="grupo-de-reacoes" key={k} data-testid={`auto-grupo-${k}`}>
            <h4>{tituloDoGrupo(g.fica, estado)}</h4>
            <ul className="lista-simples">
              {g.reacoes.map((r) => {
                const chave = `auto-reacao-${r.id}`;
                return (
                  <li key={r.id} className="peca-da-lista" data-testid={chave} data-ativa={r.ativa}>
                    <div className="peca-topo">
                      <strong className="peca-nome">{r.nome ?? "Reação sem nome"}</strong>
                      <span className="peca-acoes">
                        <label className="linha-opcao nota">
                          <input
                            type="checkbox"
                            data-testid={`${chave}-ativa`}
                            checked={r.ativa}
                            onChange={(e) =>
                              enviar("reacao.editar", {
                                id: r.id,
                                mudancas: { ativa: e.target.checked },
                              })
                            }
                          />
                          Ligada
                        </label>
                        <BotaoComDica
                          className="botao-icone pequeno"
                          testid={`${chave}-editar`}
                          nome={`Editar ${r.nome ?? "a reação"}`}
                          onClick={() => p.aoIr({ tipo: "reacao", id: r.id })}
                        >
                          <Pencil size={14} />
                        </BotaoComDica>
                        <BotaoComDica
                          className="botao-icone pequeno"
                          testid={`${chave}-apagar`}
                          nome={`Apagar ${r.nome ?? "a reação"}`}
                          onClick={() => setApagando(chave)}
                        >
                          <Trash2 size={14} />
                        </BotaoComDica>
                      </span>
                    </div>
                    <p className="nota">{resumoDaReacao(r)}</p>
                    {apagando === chave &&
                      confirmar(chave, "reacao.apagar", r.id, r.nome ?? "esta reação")}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section className="secao-das-automacoes" data-testid="auto-botoes">
        <header>
          <h3 className="titulo-da-automacao">Botões de evento</h3>
          <button
            type="button"
            data-testid="auto-novo-botao"
            onClick={() => p.aoIr({ tipo: "botao", id: null })}
          >
            <Plus size={14} /> Novo botão
          </button>
        </header>
        {a.botoes.length === 0 && (
          <p className="nota">Um botão dispara um evento na hora, na barra de cima.</p>
        )}
        <ul className="lista-simples">
          {a.botoes.map((b) => {
            const chave = `auto-botao-${b.id}`;
            return (
              <li key={b.id} className="peca-da-lista" data-testid={chave}>
                <div className="peca-topo">
                  <strong className="peca-nome">{b.nome}</strong>
                  <span className="nota">dispara “{nomeDoEvento(b.evento)}”</span>
                </div>
                {apagando === chave ? (
                  confirmar(chave, "botao.apagar", b.id, b.nome)
                ) : (
                  <div className="peca-acoes">
                    <button
                      type="button"
                      className="botao-da-peca"
                      data-testid={`${chave}-disparar`}
                      onClick={() =>
                        enviar("evento.disparar", {
                          evento: b.evento,
                          ...(b.cenaId === undefined ? {} : { cenaId: b.cenaId }),
                        })
                      }
                    >
                      Disparar
                    </button>
                    <button
                      type="button"
                      className="chip botao-da-peca"
                      aria-pressed={b.fixado === true}
                      data-testid={`${chave}-fixar`}
                      onClick={() =>
                        enviar("botao.editar", {
                          id: b.id,
                          mudancas: { fixado: b.fixado !== true },
                        })
                      }
                    >
                      Fixar na barra
                    </button>
                    <button
                      type="button"
                      className="chip botao-da-peca"
                      aria-pressed={b.liberadoParaJogadores === true}
                      data-testid={`${chave}-liberar`}
                      onClick={() =>
                        enviar("botao.editar", {
                          id: b.id,
                          mudancas: { liberadoParaJogadores: b.liberadoParaJogadores !== true },
                        })
                      }
                    >
                      Liberar aos jogadores
                    </button>
                    <span className="peca-icones">
                      <BotaoComDica
                        className="botao-icone pequeno"
                        testid={`${chave}-editar`}
                        nome={`Editar “${b.nome}”`}
                        onClick={() => p.aoIr({ tipo: "botao", id: b.id })}
                      >
                        <Pencil size={14} />
                      </BotaoComDica>
                      <BotaoComDica
                        className="botao-icone pequeno"
                        testid={`${chave}-apagar`}
                        nome={`Apagar “${b.nome}”`}
                        onClick={() => setApagando(chave)}
                      >
                        <Trash2 size={14} />
                      </BotaoComDica>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="secao-das-automacoes" data-testid="auto-eventos">
        <header>
          <h3 className="titulo-da-automacao">Eventos em uso</h3>
        </header>
        {usados.length === 0 ? (
          <p className="nota">Nenhum evento usado ainda.</p>
        ) : (
          <ul className="lista-simples eventos-em-uso">
            {usados.map((e) => (
              <li key={e.nome} data-testid={`auto-evento-${e.nome}`}>
                <span>{nomeDoEvento(e.nome)}</span>
                <span className="nota">
                  {e.ouvintes === 0
                    ? "sem reação"
                    : e.ouvintes === 1
                      ? "1 reação"
                      : `${e.ouvintes} reações`}
                  {e.disparadoPor > 0 ? ` · disparado por ${e.disparadoPor}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AvisosDoMotor registro={a.registro} sala={sala} />
    </div>
  );
}

/** Uma linha discreta com o que o motor quis dizer (encadeamento cortado, fases puladas); abre para ler. */
function AvisosDoMotor({
  registro,
  sala,
}: {
  registro: { emSala: number; texto: string }[];
  sala: number | undefined;
}) {
  if (registro.length === 0) {
    return (
      <p className="nota avisos-do-motor" data-testid="auto-avisos">
        Avisos do motor: nenhum.
      </p>
    );
  }
  return (
    <details className="avisos-do-motor" data-testid="auto-avisos">
      <summary>Avisos do motor ({registro.length})</summary>
      <ul className="lista-simples">
        {[...registro].reverse().map((r) => (
          <li key={`${r.emSala}|${r.texto}`} className="nota">
            {sala === undefined ? "" : `há ${duracaoCurta(Math.max(0, sala - r.emSala))} · `}
            {r.texto}
          </li>
        ))}
      </ul>
    </details>
  );
}
