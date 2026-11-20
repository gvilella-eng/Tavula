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
import {
  Activity,
  Archive,
  Download,
  Flame,
  House,
  Scale,
  Upload,
  Users,
  Workflow,
} from "lucide-react";
import { type ChangeEvent, memo, useEffect, useRef, useState } from "react";
import { type DadosDaMesa, renomearMesa } from "./api";
import { resumoDasAutomacoes } from "./automacoes/resumo";
import { SecaoDeContas } from "./contas/SecaoDeContas";
import { IdDaMesa } from "./IdDaMesa";
import { SecaoMesa, SecaoObjetosDeLuz } from "./PainelDaMesa";
import { type ResumoDaCampanha, resumoDaCampanha, textoDoResumo } from "./resumoDaCampanha";
import { SecaoDePreferencias } from "./SecaoDePreferencias";

/** As chaves do estado que a aba Mesa e os filhos leem (regras, luz, automações, pessoas e permissões). */
export const FATIA_DA_MESA = [
  "usuarios",
  "membros",
  "personagens",
  "permissoes",
  "config",
  "modelos",
  "automacoes",
  "assets",
] as const;
export type EstadoDaMesa = Pick<Estado, (typeof FATIA_DA_MESA)[number]>;

type Props = {
  mesa: DadosDaMesa;
  aoRenomear: (nome: string) => void;
  estado: EstadoDaMesa;
  uso: Uso | null;
  /** C2: o resumo dos pedidos de entrada (chega pelo WebSocket, só ao mestre). */
  avisoDeContas: AvisoDeContas | null;
  enviar: (tipo: string, dados: object) => string | null;
  /** 7b-3: abre o editor das automações (janela sobre o mapa). */
  aoAbrirAutomacoes: () => void;
  /** FG1: envia uma animação de chama (gif, webp animado ou apng) para a mesa. */
  registrarAnimacao?: ((arquivo: File) => Promise<{ hash: string; nome: string }>) | undefined;
};

/**
 * Q8: o `data-testid` de uma parte da aba. Os cartões da aba (esta-mesa, regras, luz, automacoes, pessoas, campanha,
 * diagnostico) e as partes de dentro de "Pessoas" (papeis, contas, permissoes) usam o mesmo padrão.
 */
export const testidDaSecaoDaMesa = (id: string) => `mesa-secao-${id}`;

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
    <div className="secao-da-identificacao" data-testid="mesa-identificacao">
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
    </div>
  );
}

/**
 * Aba Mesa (só o mestre): tudo o que vale para a sala, no mesmo desenho da aba Preferências (Q8): cartões que abrem e
 * fecham, cada um com o resumo embaixo do título. Esta mesa (nome e id), Regras, Luz, Automações, Pessoas (papéis,
 * contas e permissões), Campanha (exportar e importar) e, no fim, o Diagnóstico.
 */
function AbaMesaBase({
  mesa,
  aoRenomear,
  estado,
  uso,
  avisoDeContas,
  enviar,
  aoAbrirAutomacoes,
  registrarAnimacao,
}: Props) {
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
  const membros = membrosDaMesa(estado);
  const maos = estado.config.maosPorPersonagem;
  const modelos = estado.modelos.length;
  const pedidosDeConta = (avisoDeContas?.pendentes ?? 0) + (avisoDeContas?.redefinicoes ?? 0);

  return (
    <div className="painel-mestre aba-mesa pref-lista" data-testid="painel-mestre">
      <SecaoDePreferencias
        prefixo="mesa"
        id="esta-mesa"
        titulo="Esta mesa"
        icone={<House size={16} />}
        resumo={mesa.nome}
        abertaPorPadrao
      >
        <SecaoDaIdentificacao mesa={mesa} aoRenomear={aoRenomear} />
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="regras"
        titulo="Regras"
        icone={<Scale size={16} />}
        resumo={`${maos} ${maos === 1 ? "mão" : "mãos"} por personagem`}
      >
        <SecaoMesa config={estado.config} enviar={enviar} />
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="luz"
        titulo="Luz"
        icone={<Flame size={16} />}
        resumo={`${modelos} ${modelos === 1 ? "modelo" : "modelos"} de tocha e objetos`}
      >
        <SecaoObjetosDeLuz estado={estado} enviar={enviar} registrarAnimacao={registrarAnimacao} />
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="automacoes"
        titulo="Automações"
        icone={<Workflow size={16} />}
        resumo={resumoDasAutomacoes(estado)}
      >
        <p className="nota" data-testid="automacoes-resumo">
          {resumoDasAutomacoes(estado)}
        </p>
        <p>As automações ficam no botão Automações da barra de cima.</p>
        <button
          type="button"
          className="botao-do-bloco"
          data-testid="automacoes-abrir"
          onClick={aoAbrirAutomacoes}
        >
          <Workflow size={16} /> Abrir as automações
        </button>
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="pessoas"
        titulo="Pessoas"
        icone={<Users size={16} />}
        resumo={
          pedidosDeConta > 0
            ? `${pedidosDeConta} ${pedidosDeConta === 1 ? "pedido espera" : "pedidos esperam"} o mestre`
            : `${membros.length} ${membros.length === 1 ? "usuário" : "usuários"} · ${jogadores.length} ${jogadores.length === 1 ? "jogador" : "jogadores"}`
        }
        destaque={pedidosDeConta > 0}
      >
        <div data-testid={testidDaSecaoDaMesa("papeis")}>
          <h4 className="pref-sub-titulo">Papéis dos usuários</h4>
          <ul className="lista-simples" data-testid="papeis">
            {membros.map((u) => (
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
        </div>

        <div className="pref-sub" data-testid={testidDaSecaoDaMesa("contas")}>
          <SecaoDeContas
            mesaId={mesa.id}
            mesaNome={mesa.nome}
            aviso={avisoDeContas}
            fichas={fichasSemMembro(estado).map((p) => ({ id: p.id, nome: p.nome }))}
          />
        </div>

        <div className="pref-sub" data-testid={testidDaSecaoDaMesa("permissoes")}>
          <h4 className="pref-sub-titulo">Capacidades dos jogadores</h4>
          {jogadores.length === 0 ? (
            <p className="nota" data-testid="excecao-sem-jogadores">
              Nenhum jogador na mesa ainda. As exceções aparecem quando alguém entrar.
            </p>
          ) : (
            <label className="campo-coluna">
              Exceções para
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
                <th>Padrão</th>
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
        </div>
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="campanha"
        titulo="Campanha"
        icone={<Archive size={16} />}
        resumo="Exportar e importar a mesa inteira"
      >
        <div data-testid="campanha-exportar-bloco">
          <h4 className="pref-sub-titulo">Exportar</h4>
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
        <div className="pref-sub" data-testid="campanha-importar-bloco">
          <h4 className="pref-sub-titulo">Importar</h4>
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
      </SecaoDePreferencias>

      <SecaoDePreferencias
        prefixo="mesa"
        id="diagnostico"
        titulo="Diagnóstico"
        icone={<Activity size={16} />}
        resumo={uso ? `Uso de hoje: ${formatarPercentual(uso.percentual)}` : "Uso de hoje: —"}
      >
        <p className="nota">Para quem está de olho no consumo da sala. Não muda nada no jogo.</p>
        <p>
          <span data-testid="uso-hoje">
            uso de hoje: {uso ? formatarPercentual(uso.percentual) : "—"}
          </span>
        </p>
      </SecaoDePreferencias>
    </div>
  );
}

// `memo`: a aba (fechada ou não) só re-renderiza quando muda uma chave da fatia ou uma prop (todas estáveis na Mesa).
export const AbaMesa = memo(AbaMesaBase);
