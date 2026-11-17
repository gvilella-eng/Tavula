import type { AvisoDeContas, ContaParaMestre, ListaDeContas } from "@tabletop/shared";
import { useCallback, useEffect, useState } from "react";
import { aceitarConta, liberarRedefinicao, listarContas, recusarConta, removerConta } from "../api";
import { ProtecaoDoMestre } from "./ProtecaoDoMestre";

const ROTULO_DO_STATUS = { pendente: "Pendente", ativa: "Ativa", recusada: "Recusada" } as const;

function quando(ms: number | null): string {
  if (ms === null) return "nunca";
  return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type Ficha = { id: string; nome: string };

/** Um pedido de entrada: nome e login, a "Ficha dele" (opcional) e Aceitar ou Recusar. */
function PedidoDeEntrada({
  mesaId,
  conta,
  fichas,
  aoAgir,
}: {
  mesaId: string;
  conta: ContaParaMestre;
  fichas: Ficha[];
  aoAgir: (acao: () => Promise<void>) => void;
}) {
  const [ficha, setFicha] = useState<string>("");
  const escolhida = fichas.some((f) => f.id === ficha) ? ficha : "";
  return (
    <li className="pedido-de-conta" data-testid={`conta-pedido-${conta.login}`}>
      <div className="pedido-de-conta-quem">
        <strong>{conta.nome}</strong>
        <span className="nota">login: {conta.login}</span>
      </div>
      <div className="pedido-de-conta-vaga">
        <span className="nota">Ficha dele</span>
        <select
          aria-label={`Ficha de ${conta.nome}`}
          data-testid={`conta-ficha-${conta.login}`}
          value={escolhida}
          onChange={(e) => setFicha(e.target.value)}
        >
          <option value="">Nenhuma</option>
          {fichas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="linha-botoes">
        <button
          type="button"
          className="primario"
          data-testid={`conta-aceitar-${conta.login}`}
          onClick={() => aoAgir(() => aceitarConta(mesaId, conta.id, escolhida || undefined))}
        >
          Aceitar
        </button>
        <button
          type="button"
          data-testid={`conta-recusar-${conta.login}`}
          onClick={() => aoAgir(() => recusarConta(mesaId, conta.id))}
        >
          Recusar
        </button>
      </div>
    </li>
  );
}

/** Uma conta: status, último acesso e as ações (a ficha de cada jogador se decide na própria ficha). */
function LinhaDeConta({
  mesaId,
  conta,
  aoAgir,
}: {
  mesaId: string;
  conta: ContaParaMestre;
  aoAgir: (acao: () => Promise<void>) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const ehMestre = conta.papel === "mestre";
  return (
    <li className="linha-de-conta" data-testid={`conta-linha-${conta.login}`}>
      <div className="linha-de-conta-quem">
        <strong>{conta.nome}</strong>
        {ehMestre && <span className="selo-mestre">Mestre</span>}
        <span className="nota">login: {conta.login}</span>
      </div>
      <div className="linha-de-conta-dados nota">
        <span data-testid={`conta-status-${conta.login}`}>{ROTULO_DO_STATUS[conta.status]}</span>
        <span>último acesso: {quando(conta.ultimoAcesso)}</span>
        {conta.redefinicaoAte !== null && conta.redefinicaoAte > Date.now() && (
          <span data-testid={`conta-liberada-${conta.login}`}>
            redefinição liberada até {quando(conta.redefinicaoAte)}
          </span>
        )}
      </div>
      {!ehMestre && (
        <div className="linha-botoes">
          {confirmando ? (
            <>
              <span className="nota">
                Remover a conta de {conta.nome}? As fichas e os tokens dele ficam na mesa.
              </span>
              <button
                type="button"
                className="perigo"
                data-testid={`conta-remover-confirmar-${conta.login}`}
                onClick={() => aoAgir(() => removerConta(mesaId, conta.id))}
              >
                Remover
              </button>
              <button
                type="button"
                data-testid={`conta-remover-cancelar-${conta.login}`}
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid={`conta-remover-${conta.login}`}
              onClick={() => setConfirmando(true)}
            >
              Remover
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Seção "Contas" da aba Mesa (só o mestre): os pedidos de entrada (Aceitar, com a ficha dele se houver, ou
 * Recusar), os pedidos de redefinição de senha e a lista de contas (nome, login, status, último
 * acesso e remover). Tudo vem de uma rota própria; nunca há sal, hash nem token aqui.
 */
export function SecaoDeContas({
  mesaId,
  mesaNome,
  aviso,
  fichas,
}: {
  mesaId: string;
  mesaNome: string;
  aviso: AvisoDeContas | null;
  /** As fichas de personagem que nenhum jogador controla (a "Ficha dele" de quem pede para entrar). */
  fichas: Ficha[];
}) {
  const [lista, setLista] = useState<ListaDeContas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    listarContas(mesaId)
      .then(setLista)
      .catch((e: Error) => setErro(e.message));
  }, [mesaId]);

  // Ao abrir e a cada aviso da sala (pedido novo, conta que mudou).
  // biome-ignore lint/correctness/useExhaustiveDependencies: o aviso é o gatilho
  useEffect(recarregar, [recarregar, aviso]);

  /** Executa uma ação do mestre (as funções da api recebem a mesa aqui) e recarrega. */
  function agir(acao: () => Promise<void>) {
    setErro(null);
    acao()
      .then(recarregar)
      .catch((e: Error) => {
        setErro(e.message);
        recarregar();
      });
  }

  const pendentes = lista?.contas.filter((c) => c.status === "pendente") ?? [];
  const redefinicoes = lista?.contas.filter((c) => c.redefinicaoPedida) ?? [];
  const outras = lista?.contas.filter((c) => c.status !== "pendente") ?? [];
  const loginDoMestre = lista?.contas.find((c) => c.papel === "mestre")?.login;

  return (
    <section className="secao-de-contas" data-testid="contas">
      <h4 className="pref-sub-titulo">Contas</h4>
      {erro && (
        <p className="nota erro" role="alert" data-testid="contas-erro">
          {erro}
        </p>
      )}
      {lista === null && !erro && <p className="nota">Carregando as contas…</p>}
      {lista && (
        <>
          <h4 className="contas-subtitulo">Pedidos de entrada</h4>
          {pendentes.length === 0 ? (
            <p className="nota" data-testid="contas-sem-pedidos">
              Nenhum pedido esperando.
            </p>
          ) : (
            <ul className="lista-simples" data-testid="contas-pedidos">
              {pendentes.map((c) => (
                <PedidoDeEntrada
                  key={c.id}
                  mesaId={mesaId}
                  conta={c}
                  fichas={fichas}
                  aoAgir={agir}
                />
              ))}
            </ul>
          )}

          {redefinicoes.length > 0 && (
            <>
              <h4 className="contas-subtitulo">Pedidos de redefinição de senha</h4>
              <p className="nota" data-testid="contas-aviso-redefinicao">
                Confirme por voz ou mensagem que é a própria pessoa.
              </p>
              <ul className="lista-simples" data-testid="contas-redefinicoes">
                {redefinicoes.map((c) => (
                  <li
                    key={c.id}
                    className="pedido-de-conta"
                    data-testid={`conta-redefinicao-${c.login}`}
                  >
                    <div className="pedido-de-conta-quem">
                      <strong>{c.nome}</strong>
                      <span className="nota">login: {c.login}</span>
                    </div>
                    <div className="linha-botoes">
                      <button
                        type="button"
                        className="primario"
                        data-testid={`conta-liberar-${c.login}`}
                        onClick={() => agir(() => liberarRedefinicao(mesaId, c.id))}
                      >
                        Aprovar redefinição
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4 className="contas-subtitulo">Contas da mesa</h4>
          <ul className="lista-simples" data-testid="contas-lista">
            {outras.map((c) => (
              <LinhaDeConta key={c.id} mesaId={mesaId} conta={c} aoAgir={agir} />
            ))}
          </ul>

          {loginDoMestre && (
            <ProtecaoDoMestre
              mesaId={mesaId}
              mesaNome={mesaNome}
              login={loginDoMestre}
              temChave={lista.protecao.temChave}
              temCodigo={lista.protecao.temCodigo}
              aoMudar={recarregar}
            />
          )}
        </>
      )}
    </section>
  );
}
