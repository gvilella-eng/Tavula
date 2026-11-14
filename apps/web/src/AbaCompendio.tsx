import {
  type ArmaDoCompendio,
  aplicarEntradaNaFicha,
  apresentacaoDoPersonagem,
  buscarMagias,
  CAMINHO_DO_COMPENDIO,
  type EntradaDoCompendio,
  type Estado,
  type FiltroDeMagias,
  fichaNova,
  fichaTemMagia,
  type ItemDoCompendio,
  type MagiaDoCompendio,
  normalizarBusca,
  opcoesDeFiltro,
  podeEditarPersonagem,
  ROTULO_DO_NIVEL_DE_MAGIA,
  sha256Hex,
  type Usuario,
} from "@tabletop/shared";
import {
  ArrowLeft,
  BookPlus,
  FileUp,
  GripVertical,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Fontes } from "./assets/fontes";
import type { GerenteDeAssets } from "./assets/gerente";
import {
  CamposDaMagia,
  LinhaDeAcao,
  linhaDeNivelEEscola,
  MarcasDaMagia,
  TextoDaMagia,
} from "./CartaoDaMagia";
import { ListaDeItensMagicos, ListaDeMonstros } from "./CompendioMonstros";
import { TEXTO_DO_EXEMPLO_SRD } from "./exemploSrd";
import { comecarArrastoDoCompendio } from "./ficha/ordem";
import { useAlvoDaFicha } from "./useAlvoDaFicha";
import { type ResultadoDoExemplo, type ResultadoDosArquivos, useCompendio } from "./useCompendio";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  eu: Usuario;
  conectado: boolean;
  gerente: GerenteDeAssets | null;
  fontes: Fontes;
  enviar: Enviar;
  /** O personagem de quem estou falando no chat ("" = eu mesmo): vale também aqui. */
  comoId: string;
  aoMudarComo: (id: string) => void;
  /** N3a: abre a ficha do NPC recém-criado a partir de um monstro. */
  aoAbrirFicha?: (personagemId: string) => void;
};

/** Um exemplo curto do formato, para o mestre montar o arquivo (uma magia só, escrita aqui de propósito). */
const EXEMPLO_DO_FORMATO = `{
  "formato": "tabletop-compendio",
  "versao": 1,
  "magias": [
    {
      "nome": "Luz do Candeeiro",
      "nomeOriginal": "Lamp Light",
      "nivel": 0,
      "escola": "Evocação",
      "tempo": "1 ação",
      "alcance": "Toque",
      "componentes": "V, M (um pavio)",
      "duracao": "1 hora",
      "concentracao": false,
      "ritual": false,
      "classes": ["Mago"],
      "descricao": "O objeto tocado emite luz."
    }
  ]
}`;

const NIVEIS = Array.from({ length: 10 }, (_, n) => n);

/**
 * Compêndio vazio (ou com o arquivo da pasta errado), visto pelo mestre: a ação principal é usar o exemplo
 * do SRD; escolher o próprio arquivo fica ao lado e a ajuda do formato JSON fica recolhida.
 */
/** O botão "Carregar arquivos do compêndio…" (N3a): escolhe um ou vários `.json` e os grava em `compendio/`. */
function CarregarArquivos({
  aoCarregar,
  testid = "compendio-carregar-arquivos",
}: {
  aoCarregar: (arquivos: File[]) => void;
  testid?: string;
}) {
  return (
    <label className="botao-arquivo">
      <FileUp size={14} /> Carregar arquivos do compêndio…
      <input
        type="file"
        multiple
        accept=".json,application/json"
        data-testid={testid}
        hidden
        onChange={(e) => {
          const arquivos = [...(e.target.files ?? [])];
          if (arquivos.length > 0) aoCarregar(arquivos);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** O que a carga de arquivos fez: o que foi gravado e os avisos, ou o motivo de nada ter sido gravado. */
function ResultadoDaCarga({ resultado }: { resultado: ResultadoDosArquivos | null }) {
  if (!resultado) return null;
  if (!resultado.ok) {
    return (
      <p className="erro-do-arquivo" role="alert" data-testid="compendio-carregar-erro">
        <strong>Nada foi carregado.</strong>
        <br />
        <span data-testid="compendio-carregar-erro-motivo">{resultado.motivo}</span>
      </p>
    );
  }
  return (
    <div className="aviso-da-magia" role="status" data-testid="compendio-carregar-resultado">
      <p>
        {resultado.naPasta
          ? `Gravado em ${CAMINHO_DO_COMPENDIO[0]}/: ${resultado.gravados.join(", ")}.`
          : `Carregado (vale até recarregar a página; escolha uma pasta nas Preferências para guardar): ${resultado.gravados.join(", ")}.`}
      </p>
      {resultado.avisos.length > 0 && (
        <ul data-testid="compendio-carregar-avisos">
          {resultado.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComoMontar({
  erro,
  semArquivo,
  aoRecarregar,
  aoUsarExemplo,
  aoCarregarArquivos,
  resultadoDaCarga,
}: {
  erro: string | null;
  semArquivo: boolean;
  aoRecarregar: () => void;
  aoUsarExemplo: (substituir: boolean) => Promise<ResultadoDoExemplo>;
  aoCarregarArquivos: (arquivos: File[]) => void;
  resultadoDaCarga: ResultadoDosArquivos | null;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  async function usar(substituir: boolean) {
    setFalhou(false);
    const r = await aoUsarExemplo(substituir);
    setConfirmando(r === "existe");
    setFalhou(r === "falhou");
  }
  return (
    <div className="compendio-vazio" data-testid="compendio-como-montar">
      {erro && (
        <p className="erro-do-arquivo" role="alert" data-testid="compendio-erro">
          <strong>O arquivo magias.json tem um erro e não foi enviado à mesa.</strong>
          <br />
          <span data-testid="compendio-erro-motivo">{erro}</span>
        </p>
      )}
      <p>
        <strong>O compêndio desta mesa está vazio.</strong> Comece pelo exemplo ou carregue os seus
        arquivos (magias, monstros e itens mágicos).
      </p>
      <div className="linha-botoes">
        <button
          type="button"
          className="primario"
          data-testid="compendio-usar-exemplo"
          onClick={() => void usar(false)}
        >
          <Sparkles size={14} /> Usar o exemplo do SRD (3 magias, 3 monstros, 4 itens mágicos)
        </button>
        <CarregarArquivos aoCarregar={aoCarregarArquivos} testid="compendio-arquivo" />
        <button type="button" data-testid="compendio-recarregar" onClick={aoRecarregar}>
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>
      <ResultadoDaCarga resultado={resultadoDaCarga} />
      {confirmando && (
        <div className="ot-confirmar" role="alertdialog" data-testid="compendio-exemplo-confirmar">
          <p>
            Já existe <code>{CAMINHO_DO_COMPENDIO.join("/")}</code> na sua pasta. Substituir pelo
            exemplo?
          </p>
          <div className="linha-botoes">
            <button
              type="button"
              className="perigo"
              data-testid="compendio-exemplo-substituir"
              onClick={() => void usar(true)}
            >
              Substituir
            </button>
            <button
              type="button"
              data-testid="compendio-exemplo-cancelar"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {falhou && (
        <p className="erro-do-arquivo" role="alert" data-testid="compendio-exemplo-falhou">
          Não consegui gravar o exemplo na sua pasta. Confira a permissão da pasta nas Preferências.
        </p>
      )}
      {semArquivo && !erro && (
        <p className="nota" data-testid="compendio-sem-arquivo">
          Ainda não achei <code>{CAMINHO_DO_COMPENDIO.join("/")}</code> na sua pasta.
        </p>
      )}
      <p className="nota">
        Com a pasta local escolhida (Preferências), o exemplo é gravado nela e fica entre visitas.
        Sem pasta, vale até você recarregar a página.
      </p>
      <details className="avancado" data-testid="compendio-ajuda-formato">
        <summary>Como montar o seu arquivo</summary>
        <p>
          O compêndio é um arquivo seu: ele fica no seu computador, fora do repositório, e a mesa só
          o recebe quando você o usa. Para montar:
        </p>
        <ol className="passos">
          <li>
            Escolha a pasta local em <strong>Preferências</strong> (a mesma das imagens).
          </li>
          <li>
            Dentro dela crie a pasta <code>{CAMINHO_DO_COMPENDIO[0]}</code> e o arquivo{" "}
            <code>{CAMINHO_DO_COMPENDIO[1]}</code> neste formato:
          </li>
        </ol>
        <pre className="exemplo-json" data-testid="compendio-exemplo">
          {EXEMPLO_DO_FORMATO}
        </pre>
        <p className="nota">
          <code>nivel</code> vai de 0 (truque) a 9. <code>classes</code> e <code>nomeOriginal</code>{" "}
          ajudam a achar a magia.
        </p>
      </details>
    </div>
  );
}

type PropsDoCartao = {
  magia: MagiaDoCompendio;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  comoId: string;
  aoMudarComo: (id: string) => void;
  aoVoltar: () => void;
};

/** A magia aberta: todos os campos, a descrição inteira e as ações (chat e ficha). */
function CartaoDaMagia({
  magia,
  estado,
  eu,
  enviar,
  comoId,
  aoMudarComo,
  aoVoltar,
}: PropsDoCartao) {
  const meus = estado.personagens.filter((p) => podeEditarPersonagem(p, eu));
  const comoValido = meus.some((p) => p.id === comoId) ? comoId : "";
  const [alvo, escolherAlvo] = useAlvoDaFicha(meus);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  function mandarParaOChat() {
    const ok = enviar("chat.magia", { magia, ...(comoValido ? { como: comoValido } : {}) });
    setAviso(
      ok === null
        ? { tipo: "erro", texto: "Sem conexão com a sala." }
        : { tipo: "ok", texto: "Enviada ao chat." },
    );
  }

  function adicionarAFicha() {
    if (!alvo) return;
    const modo = apresentacaoDoPersonagem(alvo);
    if (modo === "personagem" && fichaTemMagia(alvo.ficha?.magias ?? [], magia.nome)) {
      setAviso({ tipo: "erro", texto: `${alvo.nome} já tem ${magia.nome} na lista de magias.` });
      return;
    }
    // A mesma conversão do arrasto (V4b): no personagem a magia entra em Magias (e em Ataques e magias se rola);
    // no NPC entra no traço Conjuração.
    const r = aplicarEntradaNaFicha(alvo.ficha ?? fichaNova(0), { tipo: "magia", magia }, modo);
    if (!r.ok) {
      setAviso({ tipo: "erro", texto: r.motivo });
      return;
    }
    const ok = enviar("ficha.alterar", { personagemId: alvo.id, operacoes: r.operacoes });
    setAviso(
      ok === null
        ? { tipo: "erro", texto: "Sem conexão com a sala." }
        : { tipo: "ok", texto: `${magia.nome} entrou na ficha de ${alvo.nome}.` },
    );
  }

  return (
    <article className="cartao-magia" data-testid="compendio-cartao">
      <button type="button" className="voltar" data-testid="compendio-voltar" onClick={aoVoltar}>
        <ArrowLeft size={14} /> Voltar à lista
      </button>
      <header>
        <h3 data-testid="compendio-cartao-nome">{magia.nome}</h3>
        {magia.nomeOriginal && <em className="nome-original">{magia.nomeOriginal}</em>}
      </header>
      <p className="nivel-e-escola">
        {linhaDeNivelEEscola(magia)} <MarcasDaMagia magia={magia} />
      </p>
      <CamposDaMagia magia={magia} />
      {magia.classes.length > 0 && (
        <p className="classes-da-magia" data-testid="compendio-cartao-classes">
          <strong>Classes: </strong>
          {magia.classes.join(", ")}
        </p>
      )}
      <TextoDaMagia magia={magia} />

      <div className="acoes-da-magia">
        <LinhaDeAcao rotulo="Como">
          <select
            data-testid="compendio-como"
            aria-label="Falar como"
            value={comoValido}
            onChange={(e) => aoMudarComo(e.target.value)}
          >
            <option value="">{eu.nome} (eu mesmo)</option>
            {meus.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </LinhaDeAcao>
        <button type="button" data-testid="compendio-chat" onClick={mandarParaOChat}>
          <MessageSquarePlus size={14} /> Mandar para o chat
        </button>
        {meus.length > 0 ? (
          <LinhaDeAcao rotulo="Ficha de">
            <select
              data-testid="compendio-personagem"
              aria-label="Personagem que recebe a magia"
              value={alvo?.id ?? ""}
              onChange={(e) => {
                escolherAlvo(e.target.value);
                setAviso(null);
              }}
            >
              {meus.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button type="button" data-testid="compendio-ficha" onClick={adicionarAFicha}>
              <BookPlus size={14} /> Adicionar à ficha
            </button>
          </LinhaDeAcao>
        ) : (
          <p className="nota" data-testid="compendio-sem-personagem">
            Você não edita nenhum personagem: não há ficha para receber a magia.
          </p>
        )}
        {aviso && (
          <p
            className={aviso.tipo === "ok" ? "aviso-da-magia" : "aviso-da-magia erro"}
            role="status"
            data-testid="compendio-aviso-acao"
          >
            {aviso.texto}
          </p>
        )}
      </div>
    </article>
  );
}

type SecaoDoCompendio = "magias" | "armas" | "itens" | "monstros" | "itensMagicos";

const ROTULO_DA_BUSCA: Record<SecaoDoCompendio, { placeholder: string; rotulo: string }> = {
  magias: { placeholder: "Buscar magia (nome ou nome original)…", rotulo: "Buscar magia" },
  armas: { placeholder: "Buscar arma…", rotulo: "Buscar arma" },
  itens: { placeholder: "Buscar item…", rotulo: "Buscar item" },
  monstros: { placeholder: "Buscar monstro (nome ou nome original)…", rotulo: "Buscar monstro" },
  itensMagicos: { placeholder: "Buscar item mágico…", rotulo: "Buscar item mágico" },
};

const comVirgula = (n: number) => String(n).replace(".", ",");

function metaDaArma(a: ArmaDoCompendio): string {
  return [
    `${a.dano} ${a.tipoDeDano.toLowerCase()}`,
    a.categoria === "marcial" ? "marcial" : "simples",
    ...a.propriedades.slice(0, 3),
  ].join(" · ");
}

function metaDoItem(i: ItemDoCompendio): string {
  return [i.peso !== undefined ? `${comVirgula(i.peso)} kg` : "", i.custo ?? ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * As armas ou os itens do compêndio (V4b): cada linha se arrasta para a ficha aberta (as áreas que a aceitam acendem)
 * e o botão "Adicionar" é o caminho do teclado, com a mesma conversão. Quem recebe é a ficha escolhida em "Ficha de".
 */
function ListaDeEntradas({
  tipo,
  armas,
  itens,
  texto,
  estado,
  eu,
  enviar,
}: {
  tipo: "arma" | "item";
  armas: readonly ArmaDoCompendio[];
  itens: readonly ItemDoCompendio[];
  texto: string;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
}) {
  const meus = estado.personagens.filter((p) => podeEditarPersonagem(p, eu));
  const [alvo, escolherAlvo] = useAlvoDaFicha(meus);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const busca = normalizarBusca(texto);
  const linhas: { entrada: EntradaDoCompendio; nome: string; meta: string }[] =
    tipo === "arma"
      ? armas.map((a) => ({
          entrada: { tipo: "arma", arma: a },
          nome: a.nome,
          meta: metaDaArma(a),
        }))
      : itens.map((i) => ({
          entrada: { tipo: "item", item: i },
          nome: i.nome,
          meta: metaDoItem(i),
        }));
  const achadas = linhas
    .filter(
      (l) =>
        busca === "" ||
        normalizarBusca(l.nome)
          .concat(
            " ",
            normalizarBusca(
              l.entrada.tipo === "arma"
                ? (l.entrada.arma.nomeOriginal ?? "")
                : l.entrada.tipo === "item"
                  ? (l.entrada.item.nomeOriginal ?? "")
                  : "",
            ),
          )
          .includes(busca),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  function adicionar(entrada: EntradaDoCompendio, nome: string) {
    if (!alvo) return;
    const r = aplicarEntradaNaFicha(
      alvo.ficha ?? fichaNova(0),
      entrada,
      apresentacaoDoPersonagem(alvo),
    );
    if (!r.ok) return setAviso({ tipo: "erro", texto: r.motivo });
    const ok = enviar("ficha.alterar", { personagemId: alvo.id, operacoes: r.operacoes });
    setAviso(
      ok === null
        ? { tipo: "erro", texto: "Sem conexão com a sala." }
        : { tipo: "ok", texto: `${nome} entrou na ficha de ${alvo.nome}.` },
    );
  }

  return (
    <div data-testid={`compendio-${tipo}s`}>
      {meus.length > 0 ? (
        <label className="linha-opcao ficha-de-quem">
          Ficha de
          <select
            data-testid="compendio-alvo"
            aria-label="Ficha que recebe"
            value={alvo?.id ?? ""}
            onChange={(e) => {
              escolherAlvo(e.target.value);
              setAviso(null);
            }}
          >
            {meus.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="nota" data-testid="compendio-sem-personagem">
          Você não edita nenhum personagem: não há ficha para receber.
        </p>
      )}
      <p className="nota">Arraste para a ficha aberta ou use Adicionar.</p>
      {achadas.length === 0 ? (
        <p className="nota" data-testid="compendio-nenhuma">
          Nada encontrado.
        </p>
      ) : (
        <ul className="lista-de-magias" data-testid="compendio-lista-entradas">
          {achadas.map((l) => (
            <li key={l.nome}>
              <div className="entrada-do-compendio">
                <button
                  type="button"
                  className="entrada-arrastavel"
                  draggable
                  data-testid={`compendio-entrada-${tipo}`}
                  data-nome={l.nome}
                  title="Arraste para a ficha aberta"
                  onDragStart={(e) => comecarArrastoDoCompendio(e, l.entrada)}
                >
                  <GripVertical size={14} className="alca-da-entrada" aria-hidden />
                  <span className="textos-da-entrada">
                    <span className="nome-da-magia">{l.nome}</span>
                    <span className="nivel-e-escola">{l.meta}</span>
                  </span>
                </button>
                <button
                  type="button"
                  data-testid={`compendio-${tipo}-adicionar`}
                  aria-label={`Adicionar ${l.nome} à ficha`}
                  disabled={!alvo}
                  onClick={() => adicionar(l.entrada, l.nome)}
                >
                  <BookPlus size={14} /> Adicionar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p
          className={aviso.tipo === "ok" ? "aviso-da-magia" : "aviso-da-magia erro"}
          role="status"
          data-testid="compendio-aviso-acao"
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

/** Compêndio de magias (Lote 14): busca, filtros, lista e o cartão. O arquivo vem da pasta do mestre. */
export function AbaCompendio({
  estado,
  eu,
  conectado,
  gerente,
  fontes,
  enviar,
  comoId,
  aoMudarComo,
  aoAbrirFicha,
}: Props) {
  const euMestre = eu.papel === "mestre";
  const c = useCompendio({
    referencia: estado.compendio,
    euMestre,
    conectado,
    gerente,
    fontes,
    enviar,
  });
  const [filtro, setFiltro] = useState<FiltroDeMagias>({});
  const [aberta, setAberta] = useState<string | null>(null);
  // V4b: o arquivo pode trazer armas e itens além das magias; cada tipo tem a sua lista.
  const [secao, setSecao] = useState<SecaoDoCompendio>("magias");
  // O mestre usou o exemplo do SRD nesta visita: onde ele ficou (na pasta, ou só até recarregar).
  const [resultadoDaCarga, setResultadoDaCarga] = useState<ResultadoDosArquivos | null>(null);
  async function carregarArquivos(arquivos: File[]) {
    setResultadoDaCarga(null);
    setResultadoDaCarga(await c.carregarArquivos(arquivos));
  }
  const [ondeFicouOExemplo, setOndeFicouOExemplo] = useState<"gravado" | "solto" | null>(null);
  // O compêndio da mesa é o exemplo do SRD? (compara o hash do arquivo empacotado)
  const [hashDoExemplo, setHashDoExemplo] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void sha256Hex(new TextEncoder().encode(TEXTO_DO_EXEMPLO_SRD)).then((h) => {
      if (vivo) setHashDoExemplo(h);
    });
    return () => {
      vivo = false;
    };
  }, []);
  const exemploEmUso = hashDoExemplo !== null && estado.compendio?.hash === hashDoExemplo;
  const magias = c.compendio?.magias;
  const armas = c.compendio?.armas ?? [];
  const itensDoCompendio = c.compendio?.itens ?? [];
  // N3a (assumido): o bloco do monstro é segredo do mestre, então a seção só aparece para ele. O arquivo do compêndio
  // chega a todos (é um asset só); esconder é da tela, não do dado (docs/PASSAGEM.md, frágeis).
  const monstros = euMestre ? (c.compendio?.monstros ?? []) : [];
  const itensMagicos = c.compendio?.itensMagicos ?? [];
  const temExtras =
    armas.length > 0 ||
    itensDoCompendio.length > 0 ||
    monstros.length > 0 ||
    itensMagicos.length > 0;
  const secaoAtual: SecaoDoCompendio = temExtras ? secao : "magias";
  const opcoes = useMemo(() => opcoesDeFiltro(magias ?? []), [magias]);
  const achadas = useMemo(() => buscarMagias(magias ?? [], filtro), [magias, filtro]);
  const selecionada = aberta === null ? undefined : magias?.find((m) => m.nome === aberta);
  const temFiltro = Object.values(filtro).some((v) => v !== undefined && v !== "");

  function mudar(parte: Partial<FiltroDeMagias>) {
    setFiltro((f) => {
      const novo = { ...f, ...parte };
      for (const k of Object.keys(novo) as (keyof FiltroDeMagias)[]) {
        if (novo[k] === undefined || novo[k] === "" || novo[k] === false) delete novo[k];
      }
      return novo;
    });
  }

  if (c.situacao !== "pronto") {
    return (
      <div data-testid="aba-compendio-conteudo" data-situacao={c.situacao}>
        {c.situacao === "sem" || (c.situacao === "erro" && euMestre && !estado.compendio) ? (
          euMestre ? (
            <ComoMontar
              erro={c.erroDoArquivo}
              semArquivo={c.semArquivo}
              aoRecarregar={() => void c.recarregar()}
              aoCarregarArquivos={(a) => void carregarArquivos(a)}
              resultadoDaCarga={resultadoDaCarga}
              aoUsarExemplo={async (substituir) => {
                const r = await c.usarExemplo(substituir);
                if (r === "gravado" || r === "solto") setOndeFicouOExemplo(r);
                return r;
              }}
            />
          ) : (
            <div className="compendio-vazio" data-testid="compendio-vazio-jogador">
              <p>
                <strong>O mestre ainda não montou o compêndio desta mesa.</strong>
              </p>
              <p className="nota">
                Não falta nada do seu lado: quando ele puser as magias, elas aparecem aqui sozinhas
                e você poderá buscá-las e mandá-las para o chat ou para a sua ficha.
              </p>
            </div>
          )
        ) : c.situacao === "baixando" ? (
          <p className="nota" data-testid="compendio-baixando">
            Recebendo o compêndio do mestre
            {c.total > 0 ? ` (${c.recebidos}/${c.total})` : ""}…
          </p>
        ) : c.situacao === "indisponivel" ? (
          <p className="nota" data-testid="compendio-indisponivel">
            O compêndio existe, mas ninguém com o arquivo está online. Assim que o mestre conectar,
            ele chega sozinho.
          </p>
        ) : (
          <p className="erro-do-arquivo" role="alert" data-testid="compendio-erro-mesa">
            Não consegui abrir o compêndio da mesa: {c.erroDaMesa ?? "erro desconhecido"}.
          </p>
        )}
        <p className="nota">Nada é buscado na internet: o compêndio lê só o arquivo do mestre.</p>
      </div>
    );
  }

  const total = magias?.length ?? 0;
  return (
    <div data-testid="aba-compendio-conteudo" data-situacao="pronto">
      {selecionada ? (
        <CartaoDaMagia
          magia={selecionada}
          estado={estado}
          eu={eu}
          enviar={enviar}
          comoId={comoId}
          aoMudarComo={aoMudarComo}
          aoVoltar={() => setAberta(null)}
        />
      ) : (
        <>
          {c.erroDoArquivo && (
            <p className="erro-do-arquivo" role="alert" data-testid="compendio-erro">
              <strong>
                Um arquivo da pasta compendio tem um erro: a mesa continua com o compêndio anterior.
              </strong>
              <br />
              <span data-testid="compendio-erro-motivo">{c.erroDoArquivo}</span>
            </p>
          )}
          {c.avisos.length > 0 && (
            <ul className="avisos-do-compendio" data-testid="compendio-avisos">
              {c.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {temExtras && (
            <fieldset className="secoes-do-compendio" aria-label="O que listar">
              {(
                [
                  ["magias", "Magias", total],
                  ["armas", "Armas", armas.length],
                  ["itens", "Itens", itensDoCompendio.length],
                  ["monstros", "Monstros", monstros.length],
                  ["itensMagicos", "Mágicos", itensMagicos.length],
                ] as const
              )
                .filter(([id, , n]) => id === "magias" || n > 0)
                .map(([id, rotulo, n]) => (
                  <button
                    key={id}
                    type="button"
                    className="secao-do-compendio"
                    data-testid={`compendio-secao-${id}`}
                    aria-pressed={secaoAtual === id}
                    title={`${id === "itensMagicos" ? "Itens mágicos" : rotulo}: ${n}`}
                    onClick={() => setSecao(id)}
                  >
                    {rotulo}
                  </button>
                ))}
            </fieldset>
          )}
          <label className="campo-busca">
            <Search size={16} />
            <input
              data-testid="compendio-busca"
              type="search"
              placeholder={ROTULO_DA_BUSCA[secaoAtual].placeholder}
              aria-label={ROTULO_DA_BUSCA[secaoAtual].rotulo}
              value={filtro.texto ?? ""}
              onChange={(e) => mudar({ texto: e.target.value })}
            />
          </label>
          {secaoAtual === "magias" ? (
            <>
              <div className="filtros-do-compendio" data-testid="compendio-filtros">
                <select
                  data-testid="compendio-nivel"
                  aria-label="Nível"
                  value={filtro.nivel ?? ""}
                  onChange={(e) =>
                    mudar({ nivel: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                >
                  <option value="">Todos os níveis</option>
                  {NIVEIS.map((n) => (
                    <option key={n} value={n}>
                      {ROTULO_DO_NIVEL_DE_MAGIA(n)}
                    </option>
                  ))}
                </select>
                <select
                  data-testid="compendio-escola"
                  aria-label="Escola"
                  value={filtro.escola ?? ""}
                  onChange={(e) => mudar({ escola: e.target.value })}
                >
                  <option value="">Todas as escolas</option>
                  {opcoes.escolas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <select
                  data-testid="compendio-classe"
                  aria-label="Classe"
                  value={filtro.classe ?? ""}
                  onChange={(e) => mudar({ classe: e.target.value })}
                >
                  <option value="">Todas as classes</option>
                  {opcoes.classes.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <label className="linha-opcao">
                  <input
                    type="checkbox"
                    data-testid="compendio-concentracao"
                    checked={filtro.concentracao === true}
                    onChange={(e) => mudar({ concentracao: e.target.checked })}
                  />
                  Concentração
                </label>
                <label className="linha-opcao">
                  <input
                    type="checkbox"
                    data-testid="compendio-ritual"
                    checked={filtro.ritual === true}
                    onChange={(e) => mudar({ ritual: e.target.checked })}
                  />
                  Ritual
                </label>
              </div>
              <div className="barra-do-compendio">
                <span className="nota contagem-do-compendio" data-testid="compendio-contagem">
                  {temFiltro ? `${achadas.length} de ${total}` : `${total}`}{" "}
                  {total === 1 ? "magia" : "magias"}
                </span>
                {temFiltro && (
                  <button
                    type="button"
                    className="link"
                    data-testid="compendio-limpar"
                    onClick={() => setFiltro({})}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              {achadas.length === 0 ? (
                <p className="nota" data-testid="compendio-nenhuma">
                  Nenhuma magia encontrada.
                </p>
              ) : (
                <ul className="lista-de-magias" data-testid="compendio-lista">
                  {achadas.map((m) => (
                    <li key={m.nome}>
                      <button
                        type="button"
                        className="item-de-magia"
                        data-testid="compendio-item"
                        data-nome={m.nome}
                        draggable
                        onDragStart={(e) =>
                          comecarArrastoDoCompendio(e, { tipo: "magia", magia: m })
                        }
                        onClick={() => setAberta(m.nome)}
                      >
                        <span className="nome-da-magia">{m.nome}</span>
                        <span className="nivel-e-escola">
                          {linhaDeNivelEEscola(m)} <MarcasDaMagia magia={m} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : secaoAtual === "monstros" ? (
            <ListaDeMonstros
              monstros={monstros}
              magias={magias ?? []}
              texto={filtro.texto ?? ""}
              estado={estado}
              eu={eu}
              enviar={enviar}
              {...(aoAbrirFicha ? { aoAbrirFicha } : {})}
            />
          ) : secaoAtual === "itensMagicos" ? (
            <ListaDeItensMagicos
              itens={itensMagicos}
              texto={filtro.texto ?? ""}
              estado={estado}
              eu={eu}
              enviar={enviar}
            />
          ) : (
            <ListaDeEntradas
              tipo={secaoAtual === "armas" ? "arma" : "item"}
              armas={armas}
              itens={itensDoCompendio}
              texto={filtro.texto ?? ""}
              estado={estado}
              eu={eu}
              enviar={enviar}
            />
          )}
          {euMestre && (
            <div
              className="barra-do-compendio barra-do-mestre"
              data-testid="compendio-barra-mestre"
            >
              <CarregarArquivos aoCarregar={(a) => void carregarArquivos(a)} />
              <button
                type="button"
                data-testid="compendio-recarregar"
                disabled={c.lendo}
                onClick={() => void c.recarregar()}
              >
                <RefreshCw size={14} /> Recarregar
              </button>
            </div>
          )}
          <ResultadoDaCarga resultado={euMestre ? resultadoDaCarga : null} />
          {exemploEmUso && (
            <p className="nota" data-testid="compendio-exemplo-em-uso">
              Exemplo do SRD 5.1 em uso (3 magias, 3 monstros e 4 itens mágicos).
              {euMestre && ondeFicouOExemplo === "gravado" && (
                <>
                  {" "}
                  Gravado em <code>{CAMINHO_DO_COMPENDIO.join("/")}</code> na sua pasta.
                </>
              )}
              {euMestre && ondeFicouOExemplo === "solto" && (
                <>
                  {" "}
                  Vale até recarregar a página; escolha uma pasta nas Preferências para guardá-lo.
                </>
              )}
            </p>
          )}
          {c.compendio?.creditos && (
            <details
              className="creditos-do-compendio"
              data-testid="compendio-creditos"
              open={exemploEmUso || undefined}
            >
              <summary>Créditos</summary>
              <p className="nota" data-testid="compendio-creditos-texto">
                {c.compendio.creditos}
              </p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
