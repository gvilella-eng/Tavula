import {
  MAXIMO_DE_TOKENS_DO_CLAUDE,
  PROIBIDAS_FORA_DO_PROTOCOLO,
  type TokenDoClaudePublico,
} from "@tabletop/shared";
import { Copy, KeyRound, Undo2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { gerarTokenDoClaude, listarTokensDoClaude, revogarTokenDoClaude } from "../api";
import type { LoteDoClaude } from "../useSala";
import {
  comandoDoClaudeCode,
  configDoClaudeDesktop,
  dataCurta,
  haQuanto,
  urlDoWebSocketDaMesa,
} from "./textosDoClaude";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  mesaId: string;
  lotes: readonly LoteDoClaude[];
  enviar: Enviar;
};

/** Copia para a área de transferência (sem ela, não faz nada: a pessoa seleciona o texto). */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function BotaoCopiar({ texto, testid, rotulo }: { texto: string; testid: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={async () => {
        setCopiado(await copiar(texto));
        setTimeout(() => setCopiado(false), 2000);
      }}
    >
      <Copy size={14} aria-hidden="true" /> {copiado ? "Copiado" : rotulo}
    </button>
  );
}

/**
 * O token que acabou de ser gerado: aparece UMA vez (a sala guarda só o hash), com Copiar e o trecho pronto para o Claude
 * Code e para o Claude Desktop. Some ao dispensar, e nunca é guardado no navegador.
 */
function TokenNovo({
  mesaId,
  novo,
  aoDispensar,
}: {
  mesaId: string;
  novo: TokenDoClaudePublico & { token: string };
  aoDispensar: () => void;
}) {
  const url = urlDoWebSocketDaMesa(mesaId);
  const codigo = comandoDoClaudeCode(url, novo.token);
  const desktop = configDoClaudeDesktop(url, novo.token);
  return (
    <div className="claude-token-novo" role="status" data-testid="claude-token-novo">
      <p className="nota">
        <strong>{novo.nome}</strong>: copie agora. Este token <strong>não aparece de novo</strong>:
        quem o tiver entra na mesa como você, então guarde-o como uma senha.
      </p>
      <code className="claude-token-valor" data-testid="claude-token-valor">
        {novo.token}
      </code>
      <div className="linha-botoes">
        <BotaoCopiar texto={novo.token} testid="claude-copiar-token" rotulo="Copiar o token" />
      </div>
      <details className="avancado" open>
        <summary>Claude Code</summary>
        <pre className="claude-trecho" data-testid="claude-trecho-code">
          {codigo}
        </pre>
        <BotaoCopiar texto={codigo} testid="claude-copiar-code" rotulo="Copiar o comando" />
      </details>
      <details className="avancado">
        <summary>Claude Desktop</summary>
        <pre className="claude-trecho" data-testid="claude-trecho-desktop">
          {desktop}
        </pre>
        <BotaoCopiar texto={desktop} testid="claude-copiar-desktop" rotulo="Copiar o trecho" />
      </details>
      <div className="linha-botoes">
        <button type="button" data-testid="claude-token-guardei" onClick={aoDispensar}>
          Já guardei
        </button>
      </div>
    </div>
  );
}

function LinhaDoToken({
  t,
  aoRevogar,
}: {
  t: TokenDoClaudePublico;
  aoRevogar: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <li className="claude-token" data-testid="claude-token" data-token-id={t.id}>
      <div className="claude-token-info">
        <strong className="claude-token-nome">{t.nome}</strong>
        <span className="nota">
          criado em {dataCurta(t.criadoEm)} ·{" "}
          {t.ultimoUso === null ? "nunca usado" : `último uso ${haQuanto(t.ultimoUso)}`}
        </span>
      </div>
      {confirmando ? (
        <div
          className="confirmar-limpar"
          role="alertdialog"
          data-testid="claude-revogar-confirmacao"
        >
          <p>Revogar este token? A conexão aberta com ele cai na hora.</p>
          <div className="acoes-confirmar">
            <button
              type="button"
              className="perigo"
              data-testid="claude-revogar-confirmar"
              onClick={() => aoRevogar(t.id)}
            >
              Revogar
            </button>
            <button type="button" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" data-testid="claude-revogar" onClick={() => setConfirmando(true)}>
          Revogar
        </button>
      )}
    </li>
  );
}

/** O que o Claude fez: os lotes recentes, cada um com Desfazer, e "Desfazer tudo o que o Claude fez". */
function LotesDoClaude({ lotes, enviar }: { lotes: readonly LoteDoClaude[]; enviar: Enviar }) {
  const [confirmandoTudo, setConfirmandoTudo] = useState(false);
  const desfaziveis = lotes.filter((l) => !l.desfeito && l.desfazivel);
  return (
    <div className="claude-lotes" data-testid="claude-lotes">
      <h4 className="claude-subtitulo">O que o Claude fez</h4>
      {lotes.length === 0 ? (
        <p className="nota" data-testid="claude-lotes-vazio">
          O Claude ainda não mexeu em nada.
        </p>
      ) : (
        <ul className="lista-simples">
          {lotes.slice(0, 10).map((l) => (
            <li
              key={l.loteId}
              className="claude-lote"
              data-testid="claude-lote"
              data-lote-id={l.loteId}
              data-desfeito={l.desfeito}
            >
              <span className="claude-lote-texto">
                Claude: {l.descricao}
                <span className="nota">
                  {" "}
                  · {l.itens} {l.itens === 1 ? "item" : "itens"} · {haQuanto(l.emMs)}
                </span>
              </span>
              {l.desfeito ? (
                <span className="nota">desfeito</span>
              ) : (
                <button
                  type="button"
                  data-testid="claude-desfazer"
                  disabled={!l.desfazivel}
                  title={l.desfazivel ? undefined : "Este lote é grande demais para desfazer"}
                  onClick={() => enviar("claude.desfazer", { loteId: l.loteId })}
                >
                  <Undo2 size={14} aria-hidden="true" /> Desfazer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {desfaziveis.length > 1 &&
        (confirmandoTudo ? (
          <div
            className="confirmar-limpar"
            role="alertdialog"
            data-testid="claude-desfazer-tudo-confirmacao"
          >
            <p>Desfazer tudo o que o Claude fez, do mais novo ao mais velho?</p>
            <div className="acoes-confirmar">
              <button
                type="button"
                className="perigo"
                data-testid="claude-desfazer-tudo-confirmar"
                onClick={() => {
                  for (const l of desfaziveis) enviar("claude.desfazer", { loteId: l.loteId });
                  setConfirmandoTudo(false);
                }}
              >
                Desfazer tudo
              </button>
              <button type="button" onClick={() => setConfirmandoTudo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="linha-botoes">
            <button
              type="button"
              data-testid="claude-desfazer-tudo"
              onClick={() => setConfirmandoTudo(true)}
            >
              Desfazer tudo o que o Claude fez
            </button>
          </div>
        ))}
    </div>
  );
}

/**
 * Preferências, "Conectar o Claude" (12-1): cada pessoa gera o PRÓPRIO token (por mesa) para o Claude entrar na mesa como
 * ela, com as mesmas permissões e a mesma visão. O token aparece uma vez; a sala guarda só o hash; "Revogar" vale na hora.
 */
export function ConectarOClaude({ mesaId, lotes, enviar }: Props) {
  const [tokens, setTokens] = useState<TokenDoClaudePublico[] | null>(null);
  const [novo, setNovo] = useState<(TokenDoClaudePublico & { token: string }) | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setTokens(await listarTokensDoClaude(mesaId));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [mesaId]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function aoGerar(e: FormEvent) {
    e.preventDefault();
    if (gerando) return;
    setGerando(true);
    setErro(null);
    try {
      setNovo(await gerarTokenDoClaude(mesaId, nome));
      setNome("");
      await recarregar();
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function aoRevogar(id: string) {
    setErro(null);
    try {
      await revogarTokenDoClaude(mesaId, id);
      if (novo?.id === id) setNovo(null);
      await recarregar();
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  const cheio = (tokens?.length ?? 0) >= MAXIMO_DE_TOKENS_DO_CLAUDE;
  return (
    <section
      className="claude-conectar"
      data-testid="conectar-claude"
      aria-labelledby="claude-titulo"
    >
      <h3 id="claude-titulo">Conectar o Claude</h3>
      <p className="nota">
        O Claude entra na mesa como você: tem as suas permissões e vê só o que você vê. Tudo o que
        ele diz ou rola leva a marca “pelo Claude”. Ele não muda papéis nem permissões, não mexe em
        contas, não importa nem exporta a campanha e não gera tokens: isso só você faz, pela mesa.
      </p>
      <form className="claude-gerar" onSubmit={aoGerar}>
        <label className="campo-coluna">
          Nome do token (opcional)
          <input
            type="text"
            data-testid="claude-token-nome"
            value={nome}
            maxLength={40}
            placeholder="Claude no meu PC"
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <div className="linha-botoes">
          <button
            type="submit"
            className="primario"
            data-testid="claude-gerar"
            disabled={gerando || cheio}
          >
            <KeyRound size={14} aria-hidden="true" /> Gerar token
          </button>
        </div>
        {cheio && (
          <p className="nota">
            Você já tem {MAXIMO_DE_TOKENS_DO_CLAUDE} tokens nesta mesa: revogue um para gerar outro.
          </p>
        )}
      </form>
      {erro && (
        <p className="nota erro" role="alert" data-testid="claude-erro">
          {erro}
        </p>
      )}
      {novo && <TokenNovo mesaId={mesaId} novo={novo} aoDispensar={() => setNovo(null)} />}
      {tokens !== null && tokens.length > 0 && (
        <ul className="lista-simples claude-tokens" data-testid="claude-tokens">
          {tokens.map((t) => (
            <LinhaDoToken key={t.id} t={t} aoRevogar={aoRevogar} />
          ))}
        </ul>
      )}
      <LotesDoClaude lotes={lotes} enviar={enviar} />
      <p className="nota claude-proibidos" data-testid="claude-proibidos">
        O que só a pessoa faz: {PROIBIDAS_FORA_DO_PROTOCOLO.join("; ")}.
      </p>
    </section>
  );
}
