import {
  buscarMagias,
  CAMINHO_DO_COMPENDIO,
  type Estado,
  type FiltroDeMagias,
  fichaTemMagia,
  type MagiaDoCompendio,
  magiaParaFicha,
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
import { TEXTO_DO_EXEMPLO_SRD } from "./exemploSrd";
import { type ResultadoDoExemplo, useCompendio } from "./useCompendio";

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
function ComoMontar({
  fontes,
  erro,
  semArquivo,
  aoRecarregar,
  aoUsarExemplo,
}: {
  fontes: Fontes;
  erro: string | null;
  semArquivo: boolean;
  aoRecarregar: () => void;
  aoUsarExemplo: (substituir: boolean) => Promise<ResultadoDoExemplo>;
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
        <strong>O compêndio desta mesa está vazio.</strong> Comece pelo exemplo ou escolha o seu
        arquivo de magias.
      </p>
      <div className="linha-botoes">
        <button
          type="button"
          className="primario"
          data-testid="compendio-usar-exemplo"
          onClick={() => void usar(false)}
        >
          <Sparkles size={14} /> Usar o exemplo do SRD (3 magias)
        </button>
        <label className="botao-arquivo">
          <FileUp size={14} /> Escolher o arquivo…
          <input
            type="file"
            accept=".json,application/json"
            data-testid="compendio-arquivo"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) fontes.escolherCompendioSolto(f);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" data-testid="compendio-recarregar" onClick={aoRecarregar}>
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>
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
  const [alvoId, setAlvoId] = useState(meus[0]?.id ?? "");
  const alvo = meus.find((p) => p.id === alvoId) ?? meus[0];
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
    const atuais = alvo.ficha?.magias ?? [];
    if (fichaTemMagia(atuais, magia.nome)) {
      setAviso({ tipo: "erro", texto: `${alvo.nome} já tem ${magia.nome} na lista de magias.` });
      return;
    }
    const ok = enviar("ficha.alterar", {
      personagemId: alvo.id,
      operacoes: [{ caminho: "magias", valor: [...atuais, magiaParaFicha(magia)] }],
    });
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
                setAlvoId(e.target.value);
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
  // O mestre usou o exemplo do SRD nesta visita: onde ele ficou (na pasta, ou só até recarregar).
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
              fontes={fontes}
              erro={c.erroDoArquivo}
              semArquivo={c.semArquivo}
              aoRecarregar={() => void c.recarregar()}
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
          <label className="campo-busca">
            <Search size={16} />
            <input
              data-testid="compendio-busca"
              type="search"
              placeholder="Buscar magia (nome ou nome original)…"
              aria-label="Buscar magia"
              value={filtro.texto ?? ""}
              onChange={(e) => mudar({ texto: e.target.value })}
            />
          </label>
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
            {euMestre && (
              <button
                type="button"
                data-testid="compendio-recarregar"
                disabled={c.lendo}
                onClick={() => void c.recarregar()}
              >
                <RefreshCw size={14} /> Recarregar
              </button>
            )}
          </div>
          {c.erroDoArquivo && (
            <p className="erro-do-arquivo" role="alert" data-testid="compendio-erro">
              <strong>
                O magias.json da pasta tem um erro: a mesa continua com o compêndio anterior.
              </strong>
              <br />
              <span data-testid="compendio-erro-motivo">{c.erroDoArquivo}</span>
            </p>
          )}
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
          {exemploEmUso && (
            <p className="nota" data-testid="compendio-exemplo-em-uso">
              Exemplo do SRD 5.1 em uso (3 magias).
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
