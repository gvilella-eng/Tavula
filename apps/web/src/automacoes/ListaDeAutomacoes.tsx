import {
  automacoesDe,
  type Estado,
  type Fluxo,
  fraseDoFluxo,
  nomesDaMesa,
  situacaoDoFluxo,
} from "@tabletop/shared";
import { Copy, MoreHorizontal, Pin, Play, Plus, Trash2, Undo2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { SeloDeRascunho } from "../claude/RascunhosDoClaude";
import { useTic } from "../tempo";
import { rotuloDoGatilho } from "./blocos";
import { duracaoCurta, idDoNome } from "./rascunho";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  enviar: Enviar;
  salaMs: () => number | undefined;
  aoEditar: (fluxoId: string | null) => void;
};

type Filtro = "todas" | "ligadas" | "desligadas" | "cena";

const FILTROS: readonly { id: Filtro; nome: string }[] = [
  { id: "todas", nome: "Todas" },
  { id: "ligadas", nome: "Ligadas" },
  { id: "desligadas", nome: "Desligadas" },
  { id: "cena", nome: "Desta cena" },
];

/** "rodou há 4 min" / "nunca rodou" / "próxima em 1:12". */
function situacaoEmTexto(
  f: Fluxo,
  a: ReturnType<typeof automacoesDe>,
  sala: number | undefined,
): string {
  if (f.rascunho) return "rascunho";
  const ultima = a.ultimaVez[f.id];
  const s = situacaoDoFluxo(f, a.execucao[f.id], sala ?? 0);
  if (f.gatilho.tipo === "relogio") {
    if (!f.ligado) return "desligada";
    if (sala === undefined || s.proximaEmMs === null) return "ainda não começou";
    return `próxima em ${duracaoCurta(s.proximaEmMs)}`;
  }
  if (ultima === undefined) return "nunca rodou";
  if (sala === undefined) return "já rodou";
  return `rodou há ${duracaoCurta(Math.max(0, sala - ultima))}`;
}

/**
 * A lista das automações (AU1): chave de ligar e desligar, nome, o gatilho, a frase em português gerada dos blocos, a
 * situação, "Disparar agora" e "Editar"; o menu de cada uma (duplicar, apagar com desfazer, fixar, liberar) e os avisos
 * do motor no rodapé.
 */
export function ListaDeAutomacoes({ estado, enviar, salaMs, aoEditar }: Props) {
  useTic(true);
  const a = automacoesDe(estado);
  const nomes = useMemo(() => nomesDaMesa(estado), [estado]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [apagada, setApagada] = useState<Fluxo | null>(null);
  const sala = salaMs();

  const visiveis = a.fluxos.filter((f) => {
    if (filtro === "ligadas" && !f.ligado) return false;
    if (filtro === "desligadas" && f.ligado) return false;
    if (filtro === "cena") {
      const ativa = estado.cenaAtivaId;
      const daCena =
        (f.cenas ?? []).includes(ativa) || ("cena" in f.gatilho && f.gatilho.cena === ativa);
      if (!daCena) return false;
    }
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return (
      q === "" ||
      f.nome.toLocaleLowerCase("pt-BR").includes(q) ||
      fraseDoFluxo(f, nomes).toLocaleLowerCase("pt-BR").includes(q)
    );
  });
  const ligadas = a.fluxos.filter((f) => f.ligado).length;

  function duplicar(f: Fluxo) {
    const id = idDoNome(`${f.nome} copia`, new Set(a.fluxos.map((x) => x.id)), "automacao");
    const { rascunho: _r, fixado: _fx, liberadoParaJogadores: _l, ...resto } = f;
    enviar("fluxo.criar", {
      fluxo: { ...resto, id, nome: `${f.nome} (cópia)`.slice(0, 64), ligado: false },
    });
    setMenu(null);
  }
  function apagar(f: Fluxo) {
    enviar("fluxo.apagar", { id: f.id });
    setApagada(f);
    setMenu(null);
  }
  function desfazerApagar() {
    if (apagada === null) return;
    enviar("fluxo.criar", { fluxo: apagada });
    setApagada(null);
  }

  return (
    <div className="auto-lista" data-testid="automacoes-lista">
      <header className="auto-lista-topo">
        <h3 className="auto-lista-titulo">Automações</h3>
        <span className="nota auto-lista-contagem" data-testid="auto-contagem">
          {a.fluxos.length === 1 ? "1 automação" : `${a.fluxos.length} automações`} ·{" "}
          {ligadas === 1 ? "1 ligada" : `${ligadas} ligadas`}
        </span>
        <div className="ed-espaco" />
        <button
          type="button"
          className="primario"
          data-testid="auto-nova"
          onClick={() => aoEditar(null)}
        >
          <Plus size={14} aria-hidden /> Nova automação
        </button>
      </header>
      <div className="auto-lista-filtros">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="auto-filtro"
            data-testid={`auto-filtro-${f.id}`}
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.nome}
          </button>
        ))}
        <div className="ed-espaco" />
        <input
          type="search"
          data-testid="auto-busca"
          aria-label="Buscar automação"
          placeholder="Buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="auto-lista-corpo">
        {a.fluxos.length === 0 && (
          <p className="nota" data-testid="auto-vazia">
            Nenhuma automação ainda. Crie uma: escolha o gatilho (quando) e encaixe os blocos do que
            acontece.
          </p>
        )}
        {a.fluxos.length > 0 && visiveis.length === 0 && (
          <p className="nota">Nenhuma automação com este filtro.</p>
        )}
        {visiveis.map((f) => {
          const g = rotuloDoGatilho(f.gatilho, nomes);
          const frase = fraseDoFluxo(f, nomes);
          return (
            <article
              key={f.id}
              className="auto-item"
              data-testid={`auto-item-${f.id}`}
              data-ligada={f.ligado}
            >
              <button
                type="button"
                role="switch"
                aria-checked={f.ligado}
                aria-label={`Ligar ou desligar ${f.nome}`}
                className="auto-chave"
                data-testid={`auto-chave-${f.id}`}
                onClick={() => enviar("fluxo.ligar", { id: f.id, ligado: !f.ligado })}
              >
                <span className="auto-chave-bolinha" />
              </button>
              <div className="auto-item-texto">
                <div className="auto-item-linha">
                  <span className="auto-item-nome" data-testid={`auto-nome-${f.id}`}>
                    {f.nome}
                  </span>
                  <span className="auto-gatilho" data-testid={`auto-gatilho-${f.id}`}>
                    {g.titulo} · {g.detalhe}
                  </span>
                  {f.fixado === true && <span className="nota">fixada na barra</span>}
                  {f.liberadoParaJogadores === true && (
                    <span className="nota">liberada aos jogadores</span>
                  )}
                  {f.rascunho === true && <SeloDeRascunho />}
                </div>
                <span className="auto-frase" data-testid={`auto-frase-${f.id}`}>
                  {frase}
                </span>
              </div>
              <span className="auto-situacao" data-testid={`auto-situacao-${f.id}`}>
                {situacaoEmTexto(f, a, sala)}
              </span>
              <button
                type="button"
                data-testid={`auto-disparar-${f.id}`}
                onClick={() => enviar("fluxo.disparar", { id: f.id })}
              >
                <Play size={13} aria-hidden /> Disparar agora
              </button>
              <button
                type="button"
                data-testid={`auto-editar-${f.id}`}
                onClick={() => aoEditar(f.id)}
              >
                Editar
              </button>
              <div className="auto-menu-caixa">
                <button
                  type="button"
                  className="botao-icone"
                  aria-label={`Mais opções de ${f.nome}`}
                  aria-expanded={menu === f.id}
                  data-testid={`auto-menu-${f.id}`}
                  onClick={() => setMenu(menu === f.id ? null : f.id)}
                >
                  <MoreHorizontal size={16} aria-hidden />
                </button>
                {menu === f.id && (
                  <div className="auto-menu" role="menu">
                    <button
                      type="button"
                      className="auto-menu-item"
                      role="menuitem"
                      data-testid={`auto-duplicar-${f.id}`}
                      onClick={() => duplicar(f)}
                    >
                      <Copy size={13} aria-hidden /> Duplicar
                    </button>
                    {(f.gatilho.tipo === "relogio" || f.gatilho.tipo === "botao") && (
                      <>
                        <button
                          type="button"
                          className="auto-menu-item"
                          role="menuitem"
                          data-testid={`auto-fixar-${f.id}`}
                          onClick={() => {
                            enviar("fluxo.editar", {
                              id: f.id,
                              mudancas: { fixado: f.fixado !== true },
                            });
                            setMenu(null);
                          }}
                        >
                          <Pin size={13} aria-hidden />{" "}
                          {f.fixado === true ? "Tirar da barra" : "Fixar na barra"}
                        </button>
                        <button
                          type="button"
                          className="auto-menu-item"
                          role="menuitem"
                          data-testid={`auto-liberar-${f.id}`}
                          onClick={() => {
                            enviar("fluxo.editar", {
                              id: f.id,
                              mudancas: { liberadoParaJogadores: f.liberadoParaJogadores !== true },
                            });
                            setMenu(null);
                          }}
                        >
                          <Users size={13} aria-hidden />{" "}
                          {f.liberadoParaJogadores === true
                            ? "Não liberar aos jogadores"
                            : "Liberar aos jogadores"}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="auto-menu-item perigo"
                      role="menuitem"
                      data-testid={`auto-apagar-${f.id}`}
                      onClick={() => apagar(f)}
                    >
                      <Trash2 size={13} aria-hidden /> Apagar
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {apagada !== null && (
        <div className="auto-desfazer" role="status" data-testid="auto-desfazer-aviso">
          <span>Apagou “{apagada.nome}”.</span>
          <button type="button" data-testid="auto-desfazer" onClick={desfazerApagar}>
            <Undo2 size={13} aria-hidden /> Desfazer
          </button>
          <button
            type="button"
            className="botao-icone pequeno"
            aria-label="Dispensar"
            onClick={() => setApagada(null)}
          >
            ×
          </button>
        </div>
      )}

      <footer className="auto-lista-rodape" data-testid="auto-avisos">
        {a.registro.length === 0 ? (
          <span className="nota">
            A frase de cada automação sai dos blocos: não precisa escrever. Sem avisos do motor.
          </span>
        ) : (
          <ul>
            {a.registro.slice(-3).map((r) => (
              <li key={`${r.emSala}-${r.texto}`}>{r.texto}</li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}
