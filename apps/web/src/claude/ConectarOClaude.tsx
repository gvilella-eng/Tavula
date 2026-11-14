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
  ARQUIVO_DO_SERVIDOR_MCP,
  CAMINHO_DO_SERVIDOR_NO_DESKTOP,
  COMANDO_PARA_GERAR_O_SERVIDOR_MCP,
  comandoDoClaudeCode,
  comandoParaRemover,
  configDoClaudeDesktop,
  dataCurta,
  haQuanto,
  origemDaMesa,
} from "./textosDoClaude";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  mesaId: string;
  lotes: readonly LoteDoClaude[];
  enviar: Enviar;
  /** P1: avisa quantos tokens a pessoa tem (para o resumo da seção). */
  aoContarTokens?: (n: number, ultimoUso: number | null) => void;
  /** 12-3: o Claude desta pessoa está conectado agora (conexão aberta, ou uma chamada nos últimos 2 minutos). */
  conectado?: boolean;
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
  const origem = origemDaMesa();
  const codigo = comandoDoClaudeCode(origem, mesaId, novo.token);
  const desktop = configDoClaudeDesktop(origem, mesaId, novo.token);
  const remover = comandoParaRemover(mesaId);
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
      <div className="claude-passos" data-testid="claude-passos">
        <h4 className="claude-subtitulo">Conectar o Claude Code</h4>
        <ol className="claude-passos-lista">
          <li>Copie o comando abaixo.</li>
          <li>Cole em qualquer terminal (PowerShell, cmd ou terminal do Mac) e aperte Enter.</li>
          <li>
            Abra o Claude Code e peça <q>mostre o panorama da mesa</q>.
          </li>
        </ol>
        <pre className="claude-trecho" data-testid="claude-trecho-code">
          {codigo}
        </pre>
        <BotaoCopiar texto={codigo} testid="claude-copiar-code" rotulo="Copiar o comando" />
        <p className="nota">
          Funciona em qualquer pasta e em outro computador: não precisa do Távola instalado. O
          comando tem o seu token: não o mostre a ninguém.
        </p>
      </div>
      <details className="avancado" data-testid="claude-remover">
        <summary>Já tinha conectado esta mesa?</summary>
        <p className="nota">Rode esta linha antes, para tirar a conexão antiga:</p>
        <pre className="claude-trecho" data-testid="claude-trecho-remover">
          {remover}
        </pre>
        <BotaoCopiar texto={remover} testid="claude-copiar-remover" rotulo="Copiar a linha" />
      </details>
      <details className="avancado" data-testid="claude-desktop">
        <summary>Claude Desktop</summary>
        <p className="nota">
          O Claude Desktop só liga a servidores locais pelo arquivo de configuração (os remotos
          exigem conta e endereço público), então ele precisa do Távola baixado: uma vez, na pasta
          do Távola, <code>{COMANDO_PARA_GERAR_O_SERVIDOR_MCP}</code> (precisa do Node). Depois cole
          o trecho no arquivo, troque <code>{CAMINHO_DO_SERVIDOR_NO_DESKTOP}</code> pelo caminho
          completo de <code>{ARQUIVO_DO_SERVIDOR_MCP}</code> e reinicie o Claude Desktop.
        </p>
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
  agora,
}: {
  t: TokenDoClaudePublico;
  aoRevogar: (id: string) => void;
  /** 12-3: este token é o que está conectado agora. */
  agora: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <li className="claude-token" data-testid="claude-token" data-token-id={t.id}>
      <div className="claude-token-info">
        <strong className="claude-token-nome">{t.nome}</strong>
        <span className="nota">
          criado em {dataCurta(t.criadoEm)} ·{" "}
          {t.ultimoUso === null
            ? "nunca usado"
            : agora
              ? "conectado agora"
              : `usado ${haQuanto(t.ultimoUso)}`}
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
export function ConectarOClaude({ mesaId, lotes, enviar, aoContarTokens, conectado }: Props) {
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
  // 12-3: quando o Claude conecta ou sai (a sala avisa pela presença), o "último uso" da lista é lido de novo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `conectado` só dispara a releitura
  useEffect(() => {
    void recarregar();
  }, [recarregar, conectado]);
  useEffect(() => {
    if (tokens !== null) {
      const usos = tokens.flatMap((t) => (t.ultimoUso === null ? [] : [t.ultimoUso]));
      aoContarTokens?.(tokens.length, usos.length > 0 ? Math.max(...usos) : null);
    }
  }, [tokens, aoContarTokens]);

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
  // (assumido) A presença é da pessoa, não do token: "conectado agora" vai no token usado há menos tempo.
  const maisRecente = [...(tokens ?? [])]
    .filter((t) => t.ultimoUso !== null)
    .sort((a, b) => (b.ultimoUso ?? 0) - (a.ultimoUso ?? 0))[0]?.id;
  return (
    <section
      className="claude-conectar"
      data-testid="conectar-claude"
      aria-label="Conectar o Claude"
    >
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
            <LinhaDoToken
              key={t.id}
              t={t}
              aoRevogar={aoRevogar}
              agora={conectado === true && t.id === maisRecente}
            />
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
