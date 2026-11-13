import {
  type AvisoDeContas,
  CAPACIDADES_DELEGAVEIS,
  type Estado,
  fichasSemMembro,
  jogadoresDaMesa,
  membrosDaMesa,
  type Papel,
  ROTULO_DA_CAPACIDADE,
  TAMANHO_MAXIMO_DO_NOME_DA_MESA,
  type Uso,
} from "@tabletop/shared";
import { Download, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { type DadosDaMesa, renomearMesa } from "./api";
import { SecaoDeContas } from "./contas/SecaoDeContas";
import { IdDaMesa } from "./IdDaMesa";
import { SecaoMesa, SecaoObjetosDeLuz } from "./PainelDaMesa";
import { type ResumoDaCampanha, resumoDaCampanha, textoDoResumo } from "./resumoDaCampanha";

type Props = {
  mesa: DadosDaMesa;
  aoRenomear: (nome: string) => void;
  estado: Estado;
  uso: Uso | null;
  /** C2: o resumo dos pedidos de entrada (chega pelo WebSocket, só ao mestre). */
  avisoDeContas: AvisoDeContas | null;
  enviar: (tipo: string, dados: object) => string | null;
};

/** As seções da aba, na ordem em que aparecem; o índice do alto leva a cada uma (`data-testid` da seção). */
export const SECOES_DA_MESA = [
  { id: "regras", rotulo: "Regras" },
  { id: "luz", rotulo: "Luz" },
  { id: "papeis", rotulo: "Papéis" },
  { id: "contas", rotulo: "Contas" },
  { id: "permissoes", rotulo: "Permissões" },
  { id: "campanha", rotulo: "Campanha" },
  { id: "diagnostico", rotulo: "Diagnóstico" },
] as const;

export const testidDaSecaoDaMesa = (id: string) => `mesa-secao-${id}`;

function irParaSecao(id: string) {
  document
    .querySelector(`[data-testid="${testidDaSecaoDaMesa(id)}"]`)
    ?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
}

type Excecao = "herdar" | "sim" | "nao";

/** `ficha.verOutras` continua no tipo (importação antiga), mas quem vê a ficha agora é a pasta. */
const CAPACIDADES_NA_TELA = CAPACIDADES_DELEGAVEIS.filter((c) => c !== "ficha.verOutras");

/** O nome e o id desta mesa: o id para ditar ou mandar, e o nome que o mestre pode mudar. */
function SecaoDaIdentificacao({
  mesa,
  aoRenomear,
}: {
  mesa: DadosDaMesa;
  aoRenomear: (nome: string) => void;
}) {
  const [nome, setNome] = useState(mesa.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== "" && nome.trim() !== mesa.nome;
  // O nome mudou na sala (por outro mestre, ou o frame `mesa.renomeada`): o campo acompanha.
  useEffect(() => setNome(mesa.nome), [mesa.nome]);

  async function salvar() {
    if (!mudou || salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      const salvo = await renomearMesa(mesa.id, nome);
      setNome(salvo);
      aoRenomear(salvo);
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="secao-da-mesa secao-da-identificacao" data-testid="mesa-identificacao">
      <h3>Esta mesa</h3>
      <form
        className="linha-botoes"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <input
          type="text"
          aria-label="Nome da mesa"
          maxLength={TAMANHO_MAXIMO_DO_NOME_DA_MESA}
          value={nome}
          data-testid="mesa-nome"
          onChange={(e) => setNome(e.target.value)}
        />
        <button type="submit" disabled={!mudou || salvando} data-testid="mesa-nome-salvar">
          Salvar nome
        </button>
      </form>
      {erro && (
        <p className="nota erro" role="alert" data-testid="mesa-nome-erro">
          {erro}
        </p>
      )}
      <p className="nota">Quem tem este id ou o link entra na mesa.</p>
      <IdDaMesa id={mesa.id} prefixo="mesa" />
    </section>
  );
}

/**
 * Aba Mesa (só o mestre): tudo o que vale para a sala. Regras, modelos de luz, papéis dos usuários,
 * capacidades dos jogadores, campanha (exportar e importar) e, recolhido no fim, o diagnóstico.
 */
export function AbaMesa({ mesa, aoRenomear, estado, uso, avisoDeContas, enviar }: Props) {
  const jogadores = jogadoresDaMesa(estado);
  const [alvo, setAlvo] = useState<string>("");
  const alvoValido = jogadores.some((u) => u.id === alvo) ? alvo : (jogadores[0]?.id ?? "");

  function mudarPapel(usuarioId: string, papel: Papel) {
    if (papel === "mestre" || papel === "jogador") enviar("papel.alterar", { usuarioId, papel });
  }

  function mudarPadrao(capacidade: string, valor: boolean) {
    enviar("permissao.alterar", { capacidade, valor });
  }

  function mudarExcecao(capacidade: string, valor: Excecao) {
    enviar("permissao.alterar", {
      capacidade,
      valor: valor === "herdar" ? null : valor === "sim",
      usuarioId: alvoValido,
    });
  }

  // V14: o arquivo escolhido espera aqui, com o nome e o resumo, até o mestre confirmar (ou cancelar).
  const [escolhido, setEscolhido] = useState<{
    nome: string;
    dados: unknown;
    resumo: ResumoDaCampanha | null;
  } | null>(null);
  const campoDoArquivo = useRef<HTMLInputElement>(null);

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    let dados: unknown;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      dados = null; // a sala recusa e o aviso aparece
    }
    setEscolhido({ nome: arquivo.name, dados, resumo: resumoDaCampanha(dados) });
  }

  function importarEscolhido() {
    if (!escolhido) return;
    enviar("campanha.importar", { dados: escolhido.dados });
    setEscolhido(null);
  }

  const excecoes = estado.permissoes.porUsuario[alvoValido] ?? {};

  return (
    <div className="painel-mestre aba-mesa" data-testid="painel-mestre">
      <SecaoDaIdentificacao mesa={mesa} aoRenomear={aoRenomear} />

      <nav className="indice-da-mesa" aria-label="Seções da mesa" data-testid="mesa-indice">
        {SECOES_DA_MESA.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            data-testid={`mesa-ir-${s.id}`}
            onClick={() => irParaSecao(s.id)}
          >
            {s.rotulo}
          </button>
        ))}
      </nav>

      <div data-testid={testidDaSecaoDaMesa("regras")} className="secao-da-mesa">
        <SecaoMesa config={estado.config} enviar={enviar} />
      </div>

      <div data-testid={testidDaSecaoDaMesa("luz")} className="secao-da-mesa">
        <SecaoObjetosDeLuz estado={estado} enviar={enviar} />
      </div>

      <section data-testid={testidDaSecaoDaMesa("papeis")} className="secao-da-mesa">
        <h3>Papéis dos usuários</h3>
        <ul className="lista-simples" data-testid="papeis">
          {membrosDaMesa(estado).map((u) => (
            <li key={u.id} className="linha-jogador" data-testid={`papel-linha-${u.id}`}>
              <span className="bolinha" style={{ background: u.cor }} />
              <span className="nome-jogador">{u.nome}</span>
              <select
                aria-label={`Papel de ${u.nome}`}
                data-testid={`papel-${u.id}`}
                value={u.papel === "mestre" ? "mestre" : "jogador"}
                onChange={(e) => mudarPapel(u.id, e.target.value as Papel)}
              >
                <option value="mestre">mestre</option>
                <option value="jogador">jogador</option>
              </select>
            </li>
          ))}
        </ul>
      </section>

      <div data-testid={testidDaSecaoDaMesa("contas")} className="secao-da-mesa">
        <SecaoDeContas
          mesaId={mesa.id}
          mesaNome={mesa.nome}
          aviso={avisoDeContas}
          fichas={fichasSemMembro(estado).map((p) => ({ id: p.id, nome: p.nome }))}
        />
      </div>

      <section data-testid={testidDaSecaoDaMesa("permissoes")} className="secao-da-mesa">
        <h3>Capacidades dos jogadores</h3>
        {jogadores.length === 0 ? (
          <p className="nota" data-testid="excecao-sem-jogadores">
            Nenhum jogador na mesa ainda. As exceções aparecem quando alguém entrar.
          </p>
        ) : (
          <label>
            Exceções para:{" "}
            <select
              data-testid="excecao-usuario"
              value={alvoValido}
              onChange={(e) => setAlvo(e.target.value)}
            >
              {jogadores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <table>
          <thead>
            <tr>
              <th>Capacidade</th>
              <th>Padrão da mesa</th>
              <th>Exceção</th>
            </tr>
          </thead>
          <tbody>
            {CAPACIDADES_NA_TELA.map((c) => {
              const excecao = excecoes[c];
              const valor: Excecao = excecao === undefined ? "herdar" : excecao ? "sim" : "nao";
              return (
                <tr key={c}>
                  <td>{ROTULO_DA_CAPACIDADE[c]}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${ROTULO_DA_CAPACIDADE[c]}: padrão da mesa`}
                      data-testid={`perm-padrao-${c}`}
                      checked={estado.permissoes.jogadores[c] === true}
                      onChange={(e) => mudarPadrao(c, e.target.checked)}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${ROTULO_DA_CAPACIDADE[c]}: exceção`}
                      data-testid={`perm-excecao-${c}`}
                      value={valor}
                      disabled={!alvoValido}
                      onChange={(e) => mudarExcecao(c, e.target.value as Excecao)}
                    >
                      <option value="herdar">herdar</option>
                      <option value="sim">sim</option>
                      <option value="nao">não</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section data-testid={testidDaSecaoDaMesa("campanha")} className="secao-da-mesa">
        <h3>Campanha</h3>
        <div className="bloco-da-campanha" data-testid="campanha-exportar-bloco">
          <h4>Exportar</h4>
          <p>Baixa um arquivo com a mesa inteira para guardar ou levar para outro computador.</p>
          <p className="nota">
            Vão: cenas, tokens, fichas, handouts, luzes, paredes, desenhos, regras e quem é mestre
            ou jogador. Não vão: o chat, as senhas e as sessões, nem as imagens em si (elas ficam na
            pasta de imagens de cada computador).
          </p>
          <button
            type="button"
            className="botao-do-bloco"
            data-testid="exportar"
            onClick={() => enviar("campanha.exportar", {})}
          >
            <Download size={16} /> Exportar campanha
          </button>
        </div>
        <div className="bloco-da-campanha" data-testid="campanha-importar-bloco">
          <h4>Importar</h4>
          <p>Troca a mesa atual pelo conteúdo de um arquivo exportado.</p>
          <input
            ref={campoDoArquivo}
            type="file"
            hidden
            accept="application/json,.json"
            aria-label="Arquivo da campanha para importar"
            data-testid="importar-arquivo"
            onChange={aoEscolherArquivo}
          />
          <button
            type="button"
            className="botao-do-bloco"
            data-testid="importar-escolher"
            onClick={() => campoDoArquivo.current?.click()}
          >
            <Upload size={16} /> Escolher arquivo…
          </button>
          {escolhido && (
            <div className="importar-escolhido" data-testid="importar-escolhido">
              <p>
                <strong data-testid="importar-nome">{escolhido.nome}</strong>
                <br />
                <span className="nota" data-testid="importar-resumo">
                  {escolhido.resumo
                    ? textoDoResumo(escolhido.resumo)
                    : "Não parece uma campanha exportada: a sala vai recusar."}
                </span>
              </p>
              <p className="nota" data-testid="importar-aviso">
                Isto troca a mesa atual. Exporte antes, se quiser guardar.
              </p>
              <div className="linha-botoes">
                <button
                  type="button"
                  className="perigo"
                  data-testid="importar-confirmar"
                  onClick={importarEscolhido}
                >
                  Importar e substituir
                </button>
                <button
                  type="button"
                  data-testid="importar-cancelar"
                  onClick={() => setEscolhido(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <details
        className="secao-da-mesa diagnostico"
        data-testid={testidDaSecaoDaMesa("diagnostico")}
      >
        <summary data-testid="mesa-diagnostico-resumo">Diagnóstico</summary>
        <p className="nota">Para quem está de olho no consumo da sala. Não muda nada no jogo.</p>
        <p>
          <span data-testid="uso-hoje">
            uso de hoje: {uso ? formatarPercentual(uso.percentual) : "—"}
          </span>
        </p>
      </details>
    </div>
  );
}
