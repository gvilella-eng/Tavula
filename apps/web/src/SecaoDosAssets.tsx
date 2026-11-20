import {
  type AssetMeta,
  CATEGORIAS_DE_ASSET,
  type CategoriaDeAsset,
  filtrarAssets,
  type LinhaDeAsset,
  MAXIMO_DO_NOME_DO_LUGAR,
  type OrdemDosAssets,
  ROTULO_DA_CATEGORIA,
  trechoDeCaminhoSeguro,
} from "@tabletop/shared";
import {
  Clapperboard,
  Download,
  FileJson,
  HardDrive,
  Map as IconeMapa,
  ImagePlus,
  Library,
  Music,
  Pencil,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { TIPO_DE_ARRASTO_DE_ASSET } from "./assets/arrastoDeAsset";
import type { GerenteDeAssets } from "./assets/gerente";
import { BotaoComDica } from "./BotaoComDica";
import { SeletorSegmentado } from "./SeletorSegmentado";
import { lerDuracaoMs } from "./som/duracao";
import type { Aviso } from "./useSala";

// AS1: "Assets da mesa". A lista de TODOS os arquivos que a pessoa pode ver (o mestre vê tudo; o jogador, o que já vê hoje), com
// filtro por tipo e por quem enviou, busca, ordem, miniatura, onde é usado, e as ações: pôr na cena (ou arrastar para o mapa),
// renomear, baixar e apagar (só o mestre; em uso, com aviso do que vai sumir e desfazer).

const LIMITE_DE_LINHAS = 150;
const LIMITE_DA_MINIATURA = 3 * 1024 * 1024;

const ROTULO_DO_TIPO: Record<CategoriaDeAsset, string> = {
  mapa: "Mapa",
  imagem: "Imagem",
  animacao: "Animação",
  token: "Token",
  retrato: "Retrato",
  som: "Som",
  json: "Json",
};

const ICONE_DO_TIPO: Record<CategoriaDeAsset, ReactNode> = {
  mapa: <IconeMapa size={18} aria-hidden="true" />,
  imagem: <ImagePlus size={18} aria-hidden="true" />,
  animacao: <Clapperboard size={18} aria-hidden="true" />,
  token: <UserRound size={18} aria-hidden="true" />,
  retrato: <UserRound size={18} aria-hidden="true" />,
  som: <Music size={18} aria-hidden="true" />,
  json: <FileJson size={18} aria-hidden="true" />,
};

const EXTENSAO_DO_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "application/json": "json",
};

function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const assinarNada = () => () => {};
const zero = () => 0;

type Aviso_ =
  | { hash: string; tipo: "confirmar" }
  | { hash: string; tipo: "emUso"; usos: string[] }
  | { hash: string; tipo: "somEmUso"; usos: string[] }
  | { hash: string; tipo: "bloqueado"; usos: string[] };

type Props = {
  linhas: readonly LinhaDeAsset[];
  /** As metas da mesa (só o mestre as tem): para o desfazer do apagar. */
  metasDaMesa?: readonly AssetMeta[] | undefined;
  euMestre: boolean;
  euId: string;
  gerente: GerenteDeAssets | null;
  enviar: (tipo: string, dados: object) => string | null;
  avisar: (texto: string, acao?: Aviso["acao"]) => void;
  /** Pode pôr imagem solta na cena (o mestre, ou quem tem a capacidade). */
  podeColocar: boolean;
  /** Pôr o arquivo na cena (no centro da tela). */
  aoPorNaCena: (hash: string) => void;
  /** O primeiro lugar livre de ambiente da mesa de som (`null`: cheio). */
  proximoLugarDeSom: number | null;
  /** Só o jogador: pede a lista à sala (ao abrir e de tempos em tempos). */
  aoPrecisarDaLista?: (() => void) | undefined;
};

function Miniatura({
  linha,
  gerente,
  disponivel,
}: {
  linha: LinhaDeAsset;
  gerente: GerenteDeAssets | null;
  disponivel: boolean;
}) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const comImagem =
    gerente !== null &&
    disponivel &&
    ["imagem", "animacao", "token", "retrato", "mapa"].includes(linha.categoria) &&
    linha.bytes > 0 &&
    linha.bytes <= LIMITE_DA_MINIATURA;
  const hash = linha.hash;
  useEffect(() => {
    const el = alvo.current;
    if (!comImagem || !gerente || !el) return;
    let vivo = true;
    let objeto: string | null = null;
    const olho = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      olho.disconnect();
      void gerente.blobDe(hash).then((blob) => {
        if (!blob || !vivo) return;
        objeto = URL.createObjectURL(blob);
        setUrl(objeto);
      });
    });
    olho.observe(el);
    return () => {
      vivo = false;
      olho.disconnect();
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [comImagem, gerente, hash]);
  return (
    <span className="asset-miniatura" ref={alvo} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} /> : ICONE_DO_TIPO[linha.categoria]}
    </span>
  );
}

export function SecaoDosAssets({
  linhas,
  metasDaMesa,
  euMestre,
  euId,
  gerente,
  enviar,
  avisar,
  podeColocar,
  aoPorNaCena,
  proximoLugarDeSom,
  aoPrecisarDaLista,
}: Props) {
  // O gerente avisa quando algo chega ao cache (o "neste computador" acompanha).
  useSyncExternalStore(
    gerente ? gerente.assinar : assinarNada,
    gerente ? gerente.versaoAtual : zero,
  );
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDeAsset | "todas">("todas");
  const [dono, setDono] = useState("todos");
  const [ordem, setOrdem] = useState<OrdemDosAssets>("nome");
  const [renomeando, setRenomeando] = useState<{ hash: string; texto: string } | null>(null);
  const [aviso, setAviso] = useState<Aviso_ | null>(null);

  // O jogador pede a lista ao abrir e a renova de tempos em tempos enquanto a aba está aberta.
  useEffect(() => {
    if (!aoPrecisarDaLista) return;
    aoPrecisarDaLista();
    const relogio = setInterval(aoPrecisarDaLista, 5000);
    return () => clearInterval(relogio);
  }, [aoPrecisarDaLista]);

  const donos = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) m.set(l.donoId, l.donoNome);
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [linhas]);
  const visiveis = useMemo(
    () => filtrarAssets(linhas, { categoria, dono, busca, ordem }),
    [linhas, categoria, dono, busca, ordem],
  );
  const mostradas = visiveis.slice(0, LIMITE_DE_LINHAS);

  function metasPara(hash: string): AssetMeta[] {
    const meta = metasDaMesa?.find((m) => m.hash === hash);
    if (!meta) return [];
    const tiles = (meta.tiles ?? []).flatMap(
      (t) => metasDaMesa?.find((m) => m.hash === t.hash) ?? [],
    );
    return [...tiles, meta];
  }

  function iniciarApagar(l: LinhaDeAsset) {
    if (l.usos.length === 0) setAviso({ hash: l.hash, tipo: "confirmar" });
    else if (l.categoria === "som") setAviso({ hash: l.hash, tipo: "somEmUso", usos: l.usos });
    else if (l.usosRemoviveis) setAviso({ hash: l.hash, tipo: "emUso", usos: l.usos });
    else setAviso({ hash: l.hash, tipo: "bloqueado", usos: l.usos });
  }

  function apagar(l: LinhaDeAsset) {
    const metas = metasPara(l.hash);
    const comoSom = l.categoria === "som";
    const mandou = comoSom
      ? enviar("som.apagar", { hash: l.hash })
      : enviar("asset.apagar", { hash: l.hash, removerUsos: l.usos.length > 0 });
    setAviso(null);
    if (mandou === null) {
      avisar("Sem conexão com a sala.");
      return;
    }
    avisar(
      l.usos.length > 0
        ? `"${l.nome}" saiu da mesa e dos lugares onde era usado. O arquivo continua na pasta do mestre.`
        : `"${l.nome}" saiu da mesa. O arquivo continua na pasta do mestre.`,
      metas.length > 0
        ? {
            rotulo: "Desfazer",
            aoClicar: () => {
              enviar("asset.restaurar", { metas: metas.slice(0, 65) });
            },
          }
        : undefined,
    );
  }

  async function baixar(l: LinhaDeAsset) {
    const blob = await gerente?.blobDe(l.hash);
    if (!blob) {
      avisar("Este arquivo ainda não está neste computador.");
      return;
    }
    const ext = EXTENSAO_DO_MIME[l.mime.toLowerCase()] ?? "bin";
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${trechoDeCaminhoSeguro(l.nome)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function confirmarNome() {
    if (!renomeando) return;
    const limpo = renomeando.texto.trim();
    const atual = linhas.find((x) => x.hash === renomeando.hash);
    setRenomeando(null);
    if (!limpo || !atual || limpo === atual.nome) return;
    enviar("asset.renomear", { hash: renomeando.hash, nome: limpo });
  }

  function porNaMesaDeSom(l: LinhaDeAsset) {
    if (proximoLugarDeSom === null) {
      avisar("A mesa de som está cheia: os 8 ambientes já têm som.");
      return;
    }
    enviar("som.lugar", {
      grupo: "ambiente",
      indice: proximoLugarDeSom,
      lugar: {
        hash: l.hash,
        nome: l.nome.replace(/\.[^.]+$/, "").slice(0, MAXIMO_DO_NOME_DO_LUGAR) || "Som",
        icone: "musica",
        cor: "ambar",
        volume: 0.6,
      },
    });
    avisar(`"${l.nome}" entrou na mesa de som (ambiente ${proximoLugarDeSom + 1}).`);
  }

  async function paraAMusica(l: LinhaDeAsset) {
    const blob = await gerente?.blobDe(l.hash);
    if (!blob) {
      avisar("Este som ainda não está neste computador.");
      return;
    }
    try {
      const duracaoMs = Math.max(1000, await lerDuracaoMs(blob));
      enviar("musica.adicionar", {
        faixas: [
          {
            hash: l.hash,
            nome: l.nome.replace(/\.[^.]+$/, "").slice(0, 120),
            duracaoMs,
            etiquetas: [],
          },
        ],
      });
      avisar(`"${l.nome}" entrou na biblioteca de música.`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não consegui ler este som.");
    }
  }

  return (
    <div className="assets-da-mesa" data-testid="assets-da-mesa">
      <label className="campo-coluna">
        Buscar
        <input
          type="search"
          data-testid="assets-busca"
          placeholder="Nome, quem enviou ou onde é usado"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      <div className="linha-par">
        <label className="campo-coluna">
          Tipo
          <select
            data-testid="assets-tipo"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaDeAsset | "todas")}
          >
            <option value="todas">Todos</option>
            {CATEGORIAS_DE_ASSET.map((c) => (
              <option key={c} value={c}>
                {ROTULO_DA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-coluna">
          Enviado por
          <select data-testid="assets-dono" value={dono} onChange={(e) => setDono(e.target.value)}>
            <option value="todos">Todos</option>
            {donos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id === euId ? `${d.nome} (eu)` : d.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="assets-ordem">
        <span className="nota">Ordem</span>
        <SeletorSegmentado
          modo="escolha"
          rotulo="Ordem dos arquivos"
          testid="assets-ordem"
          valor={ordem}
          aoMudar={setOrdem}
          itens={[
            { id: "nome", nome: "Nome", testid: "assets-ordem-nome" },
            { id: "data", nome: "Mais novos", testid: "assets-ordem-data" },
            { id: "tamanho", nome: "Tamanho", testid: "assets-ordem-tamanho" },
          ]}
        />
      </div>
      <p className="nota" data-testid="assets-contagem" aria-live="polite">
        {visiveis.length === linhas.length
          ? `${linhas.length} ${linhas.length === 1 ? "arquivo" : "arquivos"}`
          : `${visiveis.length} de ${linhas.length} arquivos`}
        {visiveis.length > LIMITE_DE_LINHAS && ` · mostrando os ${LIMITE_DE_LINHAS} primeiros`}
      </p>
      {linhas.length === 0 && (
        <p className="nota" data-testid="assets-vazio">
          {euMestre
            ? "A mesa ainda não tem arquivos. Solte uma imagem no mapa para começar."
            : "Nenhum arquivo para você ver por enquanto."}
        </p>
      )}
      <ul className="lista-de-assets" data-testid="assets-lista">
        {mostradas.map((l) => {
          const h = l.hash.slice(0, 12);
          const disponivel = gerente?.estaNesteComputador(l.hash) ?? false;
          const recusa = gerente?.motivoDaRecusa(l.hash);
          const arrastavel = l.categoria !== "json";
          const imagem = l.categoria === "imagem" || l.categoria === "animacao";
          const meu = l.donoId === euId;
          return (
            <li
              key={l.hash}
              className="asset-linha"
              data-testid={`asset-${h}`}
              data-tipo={l.tipo}
              data-dono={l.donoId}
              draggable={arrastavel}
              onDragStart={(e) => {
                if (!arrastavel) return;
                e.dataTransfer.setData(TIPO_DE_ARRASTO_DE_ASSET, l.hash);
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <Miniatura linha={l} gerente={gerente} disponivel={disponivel} />
              <div className="asset-texto">
                {renomeando?.hash === l.hash ? (
                  <input
                    className="asset-nome-campo"
                    data-testid={`asset-nome-${h}`}
                    aria-label={`Novo nome de ${l.nome}`}
                    maxLength={120}
                    // biome-ignore lint/a11y/noAutofocus: o campo acabou de abrir por um clique do mesmo botão
                    autoFocus
                    value={renomeando.texto}
                    onChange={(e) => setRenomeando({ hash: l.hash, texto: e.target.value })}
                    onBlur={confirmarNome}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      else if (e.key === "Escape") setRenomeando(null);
                    }}
                  />
                ) : (
                  <strong className="asset-nome" title={l.nome}>
                    {l.nome}
                  </strong>
                )}
                <span className="nota asset-detalhe">
                  {ROTULO_DO_TIPO[l.categoria]} · {tamanhoLegivel(l.bytes)} ·{" "}
                  {meu ? "enviado por você" : `enviado por ${l.donoNome}`}
                </span>
                <span className="nota asset-detalhe" data-testid={`asset-local-${h}`}>
                  <HardDrive size={12} aria-hidden="true" />{" "}
                  {disponivel ? "neste computador" : "ainda não neste computador"}
                </span>
                <span className="nota asset-uso" data-testid={`asset-uso-${h}`}>
                  {l.usos.length > 0 ? `Usado em: ${l.usos.join("; ")}` : "Sem uso"}
                </span>
                {recusa && (
                  <span className="nota erro" role="alert">
                    Arquivo recusado: {recusa}
                  </span>
                )}
              </div>
              <div className="asset-acoes">
                {imagem && (
                  <BotaoComDica
                    type="button"
                    className="botao-icone pequeno"
                    testid={`asset-usar-${h}`}
                    nome="Pôr na cena"
                    motivo={
                      podeColocar
                        ? disponivel
                          ? null
                          : "O arquivo ainda não chegou a este computador."
                        : "Você não pode pôr imagens na cena."
                    }
                    onClick={() => aoPorNaCena(l.hash)}
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                  </BotaoComDica>
                )}
                {l.categoria === "som" && euMestre && (
                  <>
                    <BotaoComDica
                      type="button"
                      className="botao-icone pequeno"
                      testid={`asset-som-${h}`}
                      nome="Pôr na mesa de som"
                      onClick={() => porNaMesaDeSom(l)}
                    >
                      <Volume2 size={16} aria-hidden="true" />
                    </BotaoComDica>
                    <BotaoComDica
                      type="button"
                      className="botao-icone pequeno"
                      testid={`asset-musica-${h}`}
                      nome="Adicionar à biblioteca de música"
                      motivo={disponivel ? null : "O som ainda não chegou a este computador."}
                      onClick={() => void paraAMusica(l)}
                    >
                      <Library size={16} aria-hidden="true" />
                    </BotaoComDica>
                  </>
                )}
                {euMestre && (
                  <BotaoComDica
                    type="button"
                    className="botao-icone pequeno"
                    testid={`asset-renomear-${h}`}
                    nome="Renomear"
                    onClick={() => setRenomeando({ hash: l.hash, texto: l.nome })}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </BotaoComDica>
                )}
                <BotaoComDica
                  type="button"
                  className="botao-icone pequeno"
                  testid={`asset-baixar-${h}`}
                  nome="Baixar"
                  motivo={
                    disponivel && l.tipo !== "mapa"
                      ? null
                      : "O arquivo ainda não está neste computador (ou é um mapa em pedaços)."
                  }
                  onClick={() => void baixar(l)}
                >
                  <Download size={16} aria-hidden="true" />
                </BotaoComDica>
                {euMestre && (
                  <BotaoComDica
                    type="button"
                    className="botao-icone pequeno perigo"
                    testid={`asset-apagar-${h}`}
                    nome="Apagar"
                    onClick={() => iniciarApagar(l)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </BotaoComDica>
                )}
              </div>
              {aviso?.hash === l.hash && (
                <div className="asset-aviso" role="alert" data-testid={`asset-aviso-${h}`}>
                  {aviso.tipo === "confirmar" && (
                    <p>
                      Apagar <strong>{l.nome}</strong> da mesa? O arquivo continua na pasta do
                      mestre.
                    </p>
                  )}
                  {aviso.tipo === "emUso" && (
                    <p>
                      <strong>{l.nome}</strong> está em uso em: {aviso.usos.join("; ")}. Se apagar,
                      a imagem sai desses lugares.
                    </p>
                  )}
                  {aviso.tipo === "somEmUso" && (
                    <p>
                      <strong>{l.nome}</strong> está em uso em: {aviso.usos.join("; ")}. Se apagar,
                      o som sai desses lugares (o arquivo volta com o desfazer, os lugares não).
                    </p>
                  )}
                  {aviso.tipo === "bloqueado" && (
                    <p>
                      <strong>{l.nome}</strong> está em uso em: {aviso.usos.join("; ")}. Tire o
                      arquivo de lá antes de apagar.
                    </p>
                  )}
                  <div className="linha-botoes">
                    {aviso.tipo !== "bloqueado" && (
                      <button
                        type="button"
                        className="perigo"
                        data-testid={`asset-apagar-confirmar-${h}`}
                        onClick={() => apagar(l)}
                      >
                        <Trash2 size={14} aria-hidden="true" />{" "}
                        {aviso.tipo === "confirmar" ? "Apagar" : "Apagar mesmo assim"}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid={`asset-apagar-cancelar-${h}`}
                      onClick={() => setAviso(null)}
                    >
                      {aviso.tipo === "bloqueado" ? "Entendi" : "Cancelar"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
