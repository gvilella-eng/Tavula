import {
  type Cena,
  controlaToken,
  type Estado,
  encaixarNoGrid,
  PX_POR_QUADRADO_PADRAO,
  type Token,
  type Usuario,
} from "@tabletop/shared";
import { FolderOpen, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ArquivoDaFonte, temSeletorDePasta } from "./assets/fonte";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets, StatusDeAsset } from "./assets/gerente";
import type { Processador } from "./assets/processador";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  gerente: GerenteDeAssets;
  fontes: Fontes;
  processador: Processador;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  /** Token que o mestre selecionou no mapa. */
  tokenSelecionado: Token | null;
  /** A cena que o mestre está vendo: mapa e tokens novos vão para ela. */
  cena: Cena;
  /** Centro da tela do mapa, em metros (onde nasce o token novo). */
  centroDoMapa: () => { x: number; y: number };
};

const CORES = ["#3cb44b", "#4363d8", "#f58231", "#911eb4", "#e6194b", "#42d4f4"];
const MAX_MINIATURAS = 80;

const semExtensao = (nome: string) => nome.replace(/\.[^.]+$/, "");
const ROTULO_DO_ESTADO: Record<StatusDeAsset["estado"], string> = {
  pedindo: "pedindo",
  baixando: "recebendo",
  pronto: "pronto",
  indisponivel: "indisponível (ninguém com o arquivo está online)",
  erro: "erro",
};

/** Aba Biblioteca: meus arquivos de imagem (pasta ou soltos), o que fazer com eles e as transferências. */
export function Biblioteca({
  gerente,
  fontes,
  processador,
  estado,
  eu,
  enviar,
  tokenSelecionado,
  cena,
  centroDoMapa,
}: Props) {
  useSyncExternalStore(fontes.assinar, fontes.versaoAtual);
  useSyncExternalStore(gerente.assinar, gerente.versaoAtual);
  const euMestre = eu.papel === "mestre";
  const [arquivos, setArquivos] = useState<ArquivoDaFonte[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [pxPorQuadrado, setPxPorQuadrado] = useState(String(PX_POR_QUADRADO_PADRAO));
  const [tokenDoJogador, setTokenDoJogador] = useState("");
  const [personagemPadrao, setPersonagemPadrao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const versaoDasFontes = fontes.versaoAtual();

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando as fontes mudam
  useEffect(() => {
    let cancelado = false;
    fontes
      .listar()
      .then((l) => !cancelado && setArquivos(l))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [fontes, versaoDasFontes]);

  // Miniaturas (uma de cada vez, no worker). Só dos primeiros arquivos.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      for (const a of arquivos.slice(0, MAX_MINIATURAS)) {
        if (cancelado) return;
        if (miniaturas[a.id]) continue;
        try {
          const url = URL.createObjectURL(await processador.miniatura(await a.abrir()));
          if (cancelado) {
            URL.revokeObjectURL(url);
            return;
          }
          setMiniaturas((m) => ({ ...m, [a.id]: url }));
        } catch {
          setMiniaturas((m) => ({ ...m, [a.id]: "" }));
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [arquivos, processador, miniaturas]);

  const meusTokens = estado.tokens.filter((t) => controlaToken(t, eu, estado.personagens));
  const tokenAlvo = meusTokens.find((t) => t.id === tokenDoJogador) ?? meusTokens[0];
  const personagemAlvo =
    estado.personagens.find((p) => p.id === personagemPadrao) ?? estado.personagens[0];
  const arquivo = arquivos.find((a) => a.id === escolhido) ?? null;
  const status = gerente.listarStatus();
  const emAndamento = status.filter((s) => s.estado !== "pronto");
  const prontos = status.length - emAndamento.length;

  async function executar(
    tipo: "mapa" | "token",
    depois: (assetHash: string, arquivo: ArquivoDaFonte) => void,
  ) {
    if (!arquivo || ocupado) return;
    setOcupado(true);
    setMensagem("Processando…");
    try {
      const hash = await gerente.usarArquivo(await arquivo.abrir(), tipo);
      depois(hash, arquivo);
      setMensagem(null);
    } catch (e) {
      setMensagem((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function usarComoMapa() {
    const px = Number(pxPorQuadrado);
    if (!(px >= 10 && px <= 1000)) {
      setMensagem("Pixels por quadrado: entre 10 e 1000.");
      return;
    }
    void executar("mapa", (assetHash) =>
      enviar("cena.definirMapa", { cenaId: cena.id, assetHash, pxPorQuadrado: px }),
    );
  }

  function criarToken() {
    const { x, y } = encaixarNoGrid(centroDoMapa(), 1, cena.grid.quadradoM);
    void executar("token", (assetHash, a) =>
      enviar("token.criar", {
        cenaId: cena.id,
        token: {
          id: `tok-${crypto.randomUUID().slice(0, 8)}`,
          nome: semExtensao(a.nome).slice(0, 64) || "Token",
          cor: CORES[Math.floor(Math.random() * CORES.length)] ?? "#3cb44b",
          tamanhoQuadrados: 1,
          x,
          y,
          camada: "tokens",
          oculto: false,
          controladoPor: [],
          assetHash,
        },
      }),
    );
  }

  function aplicarAoSelecionado() {
    const alvo = tokenSelecionado;
    if (!alvo) return;
    void executar("token", (assetHash) =>
      enviar("token.editar", { id: alvo.id, mudancas: { assetHash } }),
    );
  }

  function usarComoTokenPadrao() {
    const alvo = personagemAlvo;
    if (!alvo) return;
    void executar("token", (assetHash) =>
      enviar("personagem.editar", { id: alvo.id, mudancas: { assetHash } }),
    );
  }

  function usarNoMeuToken() {
    const alvo = tokenAlvo;
    if (!alvo) return;
    void executar("token", (assetHash) =>
      enviar("token.definirImagem", { id: alvo.id, assetHash }),
    );
  }

  return (
    <div className="biblioteca" data-testid="biblioteca">
      <h3>Meus arquivos</h3>
      <p className="nota">
        As imagens ficam no seu computador. A mesa só recebe o que você usa (mapa, token) e o
        servidor não guarda nada.
      </p>

      <div className="linha-botoes">
        {temSeletorDePasta() && (
          <button
            type="button"
            data-testid="biblioteca-pasta"
            onClick={() => void fontes.escolherPasta().catch(() => {})}
          >
            <FolderOpen size={16} /> {fontes.nomeDaPasta ? "Trocar pasta" : "Escolher pasta"}
          </button>
        )}
        <button
          type="button"
          data-testid="biblioteca-adicionar"
          onClick={() => entrada.current?.click()}
        >
          Adicionar arquivos
        </button>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="biblioteca-arquivos"
          onChange={(e) => {
            fontes.adicionarSoltos(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {fontes.nomeDaPasta && (
        <p className="nota" data-testid="biblioteca-pasta-estado">
          Pasta: <strong>{fontes.nomeDaPasta}</strong>
          {fontes.estado === "reautorizar" && (
            <>
              {" "}
              (o navegador pede permissão de novo){" "}
              <button
                type="button"
                data-testid="biblioteca-reautorizar"
                onClick={() => void fontes.reautorizar().then(() => undefined)}
              >
                <ShieldCheck size={14} /> Reautorizar
              </button>
            </>
          )}
          {fontes.estado === "negada" && " (permissão negada)"}
        </p>
      )}

      <section
        className="soltar"
        data-testid="biblioteca-soltar"
        aria-label="Soltar arquivos aqui"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          fontes.adicionarSoltos(Array.from(e.dataTransfer.files));
        }}
      >
        {arquivos.length === 0 ? (
          <p className="nota">Arraste imagens para cá, ou escolha uma pasta ou arquivos.</p>
        ) : (
          <ul className="miniaturas" data-testid="biblioteca-lista">
            {arquivos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="miniatura"
                  data-testid="biblioteca-item"
                  data-nome={a.nome}
                  aria-pressed={escolhido === a.id}
                  title={a.caminho}
                  onClick={() => setEscolhido(a.id)}
                >
                  {miniaturas[a.id] ? (
                    <img src={miniaturas[a.id]} alt="" />
                  ) : (
                    <span className="sem-imagem" />
                  )}
                  <span className="nome">{a.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {arquivo && (
        <div className="acoes" data-testid="biblioteca-acoes">
          <strong>{arquivo.nome}</strong>
          {euMestre ? (
            <>
              <label className="linha-opcao">
                Pixels por quadrado
                <input
                  type="number"
                  min={10}
                  max={1000}
                  data-testid="biblioteca-px"
                  value={pxPorQuadrado}
                  onChange={(e) => setPxPorQuadrado(e.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="acao-mapa"
                disabled={ocupado}
                onClick={usarComoMapa}
              >
                Usar como mapa da cena
              </button>
              <button
                type="button"
                data-testid="acao-criar-token"
                disabled={ocupado}
                onClick={criarToken}
              >
                Criar token com esta imagem
              </button>
              {estado.personagens.length > 0 && (
                <>
                  <select
                    aria-label="Personagem"
                    data-testid="biblioteca-personagem"
                    value={personagemAlvo?.id ?? ""}
                    onChange={(e) => setPersonagemPadrao(e.target.value)}
                  >
                    {estado.personagens.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="acao-token-padrao"
                    disabled={ocupado || !personagemAlvo}
                    onClick={usarComoTokenPadrao}
                  >
                    Usar como imagem do token padrão
                    {personagemAlvo ? ` (${personagemAlvo.nome})` : ""}
                  </button>
                </>
              )}
              <button
                type="button"
                data-testid="acao-aplicar-token"
                disabled={ocupado || !tokenSelecionado}
                title={tokenSelecionado ? "" : "Selecione um token no mapa"}
                onClick={aplicarAoSelecionado}
              >
                Aplicar ao token selecionado{tokenSelecionado ? ` (${tokenSelecionado.nome})` : ""}
              </button>
            </>
          ) : (
            <>
              {meusTokens.length > 1 && (
                <select
                  aria-label="Meu token"
                  data-testid="biblioteca-meu-token"
                  value={tokenAlvo?.id ?? ""}
                  onChange={(e) => setTokenDoJogador(e.target.value)}
                >
                  {meusTokens.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                data-testid="acao-meu-token"
                disabled={ocupado || !tokenAlvo}
                title={tokenAlvo ? "" : "Você não controla nenhum token"}
                onClick={usarNoMeuToken}
              >
                Usar no meu token{tokenAlvo ? ` (${tokenAlvo.nome})` : ""}
              </button>
            </>
          )}
        </div>
      )}
      {mensagem && (
        <p className="nota" role="status" data-testid="biblioteca-mensagem">
          {mensagem}
        </p>
      )}

      <h3>Transferências</h3>
      <ul className="lista-simples transferencias" data-testid="transferencias">
        {emAndamento.map((s) => (
          <li key={s.hash} data-testid="transferencia" data-hash={s.hash} data-estado={s.estado}>
            <span className="nome">{s.nome}</span>
            <span className="estado-presenca">{ROTULO_DO_ESTADO[s.estado]}</span>
            {s.total > 0 && <progress value={s.recebidos} max={s.total} />}
          </li>
        ))}
        {emAndamento.length === 0 && <li className="nota">Nenhuma transferência em andamento.</li>}
      </ul>
      <p className="nota" data-testid="transferencias-prontas">
        {prontos} {prontos === 1 ? "arquivo pronto" : "arquivos prontos"} neste navegador.
      </p>
    </div>
  );
}
