import {
  agruparItensMagicosPorRaridade,
  agruparMonstrosPorND,
  aplicarEntradaNaFicha,
  apresentacaoDoPersonagem,
  buscarItensMagicos,
  buscarMonstros,
  type EntradaDoCompendio,
  type Estado,
  fichaNova,
  type ItemMagicoDoCompendio,
  type MagiaDoCompendio,
  type MonstroDoCompendio,
  magiasDoMonstro,
  NIVEIS_DE_DESAFIO,
  opcoesDeItensMagicos,
  opcoesDeMonstros,
  PASTA_NPCS_ID,
  type Personagem,
  personagemDoMonstro,
  podeEditarPersonagem,
  ROTULO_DA_RARIDADE,
  ROTULO_DO_ATRIBUTO,
  resumoDoItemMagico,
  TAMANHOS_DE_MONSTRO,
  type Usuario,
  xpDoND,
} from "@tabletop/shared";
import { ArrowLeft, BookPlus, GripVertical, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BlocosDoCompendio, NomeOriginal } from "./CompendioBlocos";
import { comecarArrastoDoCompendio } from "./ficha/ordem";
import { useAlvoDaFicha } from "./useAlvoDaFicha";

type Enviar = (tipo: string, dados: object) => string | null;
type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

const modificador = (valor: number): string => {
  const m = Math.floor((valor - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
};
const comSinal = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);
const xpDoMonstro = (m: MonstroDoCompendio): number | undefined => m.xp ?? xpDoND(m.nd);

/**
 * Criar o NPC de um monstro (N3a): a ficha nasce na pasta NPCs com tudo o que o livro tem e abre assim que a sala a
 * confirma. Só o mestre cria NPCs.
 */
function useCriarNpc(
  estado: Estado,
  eu: Usuario,
  enviar: Enviar,
  aoAbrirFicha: ((id: string) => void) | undefined,
) {
  const [paraAbrir, setParaAbrir] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => {
    if (paraAbrir && estado.personagens.some((p) => p.id === paraAbrir)) {
      aoAbrirFicha?.(paraAbrir);
      setParaAbrir(null);
    }
  }, [paraAbrir, estado.personagens, aoAbrirFicha]);
  function criar(monstro: MonstroDoCompendio, magias: readonly MagiaDoCompendio[]) {
    const pastaId = estado.pastas.some((p) => p.id === PASTA_NPCS_ID)
      ? PASTA_NPCS_ID
      : estado.pastas[0]?.id;
    if (!pastaId) {
      setAviso({ tipo: "erro", texto: "A mesa não tem uma pasta para o NPC." });
      return;
    }
    const id = `pers-${crypto.randomUUID().slice(0, 8)}`;
    const { personagem, avisos } = personagemDoMonstro(monstro, { id, pastaId, magias });
    const enviado = enviar("personagem.criar", { personagem });
    if (enviado === null) {
      setAviso({ tipo: "erro", texto: "Sem conexão com a sala." });
      return;
    }
    setParaAbrir(id);
    setAviso({
      tipo: "ok",
      texto: `${monstro.nome} entrou na pasta NPCs.${avisos.length > 0 ? " Magias ou perícias que o compêndio ou a ficha não conhecem entraram só com o nome ou nas notas." : ""}`,
    });
  }
  return { podeCriar: eu.papel === "mestre", criar, aviso, limparAviso: () => setAviso(null) };
}

function MensagemDeAviso({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <p
      className={aviso.tipo === "ok" ? "aviso-da-magia" : "aviso-da-magia erro"}
      role="status"
      data-testid="compendio-aviso-acao"
    >
      {aviso.texto}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// Monstros
// ---------------------------------------------------------------------------------------------

function metaDoMonstro(m: MonstroDoCompendio): string {
  return `ND ${m.nd} · ${m.tamanho} · ${m.tipo.toLowerCase()}`;
}

type PropsDosMonstros = {
  monstros: readonly MonstroDoCompendio[];
  /** As magias do compêndio: o NPC criado leva o texto das que o monstro conhece. */
  magias: readonly MagiaDoCompendio[];
  texto: string;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  aoAbrirFicha?: (id: string) => void;
  /** Q2: dentro do "Todas": sem filtros nem contagem (a aba mostra a seção como um bloco). */
  modoTodas?: boolean;
};

function entradaDoMonstro(m: MonstroDoCompendio, magias: readonly MagiaDoCompendio[]) {
  return {
    tipo: "monstro",
    monstro: m,
    magias: magiasDoMonstro(m, magias),
  } satisfies EntradaDoCompendio;
}

/** Os monstros do compêndio: filtros de tipo, tamanho e ND; cada linha abre o cartão, se arrasta para o mapa e cria o NPC. */
export function ListaDeMonstros({
  monstros,
  magias,
  texto,
  estado,
  eu,
  enviar,
  aoAbrirFicha,
  modoTodas = false,
}: PropsDosMonstros) {
  const [tipo, setTipo] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [ndDe, setNdDe] = useState("");
  const [ndAte, setNdAte] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const npc = useCriarNpc(estado, eu, enviar, aoAbrirFicha);
  const opcoes = useMemo(() => opcoesDeMonstros(monstros), [monstros]);
  const achados = useMemo(
    () =>
      buscarMonstros(monstros, {
        texto,
        tipo: tipo || undefined,
        tamanho: tamanho || undefined,
        ndDe: ndDe || undefined,
        ndAte: ndAte || undefined,
      }),
    [monstros, texto, tipo, tamanho, ndDe, ndAte],
  );
  const temFiltro = tipo !== "" || tamanho !== "" || ndDe !== "" || ndAte !== "" || texto !== "";
  const selecionado = aberto === null ? undefined : monstros.find((m) => m.nome === aberto);

  if (selecionado) {
    return (
      <CartaoDoMonstro
        monstro={selecionado}
        magias={magias}
        npc={npc}
        aoVoltar={() => {
          setAberto(null);
          npc.limparAviso();
        }}
      />
    );
  }
  return (
    <div data-testid="compendio-monstros">
      {!modoTodas && (
        <>
          <div className="filtros-do-monstro" data-testid="compendio-filtros-monstros">
            <select
              data-testid="compendio-monstro-tipo"
              aria-label="Tipo de criatura"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {opcoes.tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              data-testid="compendio-monstro-tamanho"
              aria-label="Tamanho"
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
            >
              <option value="">Todos os tamanhos</option>
              {TAMANHOS_DE_MONSTRO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              data-testid="compendio-monstro-nd-de"
              aria-label="ND a partir de"
              value={ndDe}
              onChange={(e) => setNdDe(e.target.value)}
            >
              <option value="">ND de qualquer</option>
              {NIVEIS_DE_DESAFIO.map((n) => (
                <option key={n} value={n}>
                  ND de {n}
                </option>
              ))}
            </select>
            <select
              data-testid="compendio-monstro-nd-ate"
              aria-label="ND até"
              value={ndAte}
              onChange={(e) => setNdAte(e.target.value)}
            >
              <option value="">ND até qualquer</option>
              {NIVEIS_DE_DESAFIO.map((n) => (
                <option key={n} value={n}>
                  ND até {n}
                </option>
              ))}
            </select>
          </div>
          <div className="barra-do-compendio">
            <span className="nota contagem-do-compendio" data-testid="compendio-contagem">
              {temFiltro ? `${achados.length} de ${monstros.length}` : `${monstros.length}`}{" "}
              {monstros.length === 1 ? "monstro" : "monstros"}
            </span>
            {temFiltro && (
              <button
                type="button"
                className="link"
                data-testid="compendio-limpar"
                onClick={() => {
                  setTipo("");
                  setTamanho("");
                  setNdDe("");
                  setNdAte("");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
          <p className="nota">
            {npc.podeCriar
              ? "Arraste para o mapa ou use Criar NPC."
              : "Só o mestre cria NPCs a partir dos monstros."}
          </p>
        </>
      )}
      {achados.length === 0 ? (
        <p className="nota" data-testid="compendio-nenhuma">
          Nenhum monstro encontrado.
        </p>
      ) : (
        <BlocosDoCompendio
          escopo="monstros"
          grupos={agruparMonstrosPorND(achados)}
          forcar={temFiltro}
          total={monstros.length}
          testid="compendio-lista-monstros"
          renderEntrada={(m) => (
            <li key={m.nome}>
              <div className="entrada-do-compendio">
                <button
                  type="button"
                  className="entrada-arrastavel"
                  draggable={npc.podeCriar}
                  data-testid="compendio-monstro"
                  data-nome={m.nome}
                  title={npc.podeCriar ? "Abrir (ou arraste para o mapa)" : "Abrir"}
                  onClick={() => setAberto(m.nome)}
                  onDragStart={(e) => comecarArrastoDoCompendio(e, entradaDoMonstro(m, magias))}
                >
                  {npc.podeCriar && (
                    <GripVertical size={14} className="alca-da-entrada" aria-hidden />
                  )}
                  <span className="textos-da-entrada">
                    <span className="nome-da-magia">
                      {m.nome} <NomeOriginal nome={m.nomeOriginal} />
                    </span>
                    <span className="nivel-e-escola">{metaDoMonstro(m)}</span>
                  </span>
                </button>
                {npc.podeCriar && (
                  <button
                    type="button"
                    data-testid="compendio-monstro-criar"
                    aria-label={`Criar NPC de ${m.nome}`}
                    onClick={() => npc.criar(m, entradaDoMonstro(m, magias).magias)}
                  >
                    <UserPlus size={14} /> Criar NPC
                  </button>
                )}
              </div>
            </li>
          )}
        />
      )}
      <MensagemDeAviso aviso={npc.aviso} />
    </div>
  );
}

function LinhaDoBloco({ rotulo, valor }: { rotulo: string; valor: string | undefined }) {
  if (!valor) return null;
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

function Secao({
  titulo,
  linhas,
  testid,
}: {
  titulo: string;
  linhas: readonly { nome: string; texto: string }[] | undefined;
  testid: string;
}) {
  if (!linhas || linhas.length === 0) return null;
  return (
    <section className="secao-do-monstro" data-testid={testid}>
      <h4>{titulo}</h4>
      {linhas.map((l) => (
        <p key={l.nome}>
          <strong>{l.nome}.</strong> {l.texto}
        </p>
      ))}
    </section>
  );
}

/** O monstro aberto: o bloco inteiro como o livro o traz, e o botão de criar o NPC. */
function CartaoDoMonstro({
  monstro: m,
  magias,
  npc,
  aoVoltar,
}: {
  monstro: MonstroDoCompendio;
  magias: readonly MagiaDoCompendio[];
  npc: ReturnType<typeof useCriarNpc>;
  aoVoltar: () => void;
}) {
  const xp = xpDoMonstro(m);
  const salvaguardas = Object.entries(m.salvaguardas ?? {})
    .map(([a, v]) => `${ROTULO_DO_ATRIBUTO[a as keyof typeof ROTULO_DO_ATRIBUTO]} ${comSinal(v)}`)
    .join(", ");
  const pericias = Object.entries(m.pericias ?? {})
    .map(([n, v]) => `${n} ${comSinal(v)}`)
    .join(", ");
  const inata = m.conjuracaoInata;
  const espacos = m.conjuracaoPorEspacos;
  return (
    <article className="cartao-magia cartao-monstro" data-testid="compendio-monstro-cartao">
      <button type="button" className="voltar" data-testid="compendio-voltar" onClick={aoVoltar}>
        <ArrowLeft size={14} /> Voltar à lista
      </button>
      <header>
        <h3 data-testid="compendio-cartao-nome">{m.nome}</h3>
        {m.nomeOriginal && <em className="nome-original">{m.nomeOriginal}</em>}
      </header>
      <p className="nivel-e-escola">
        {m.tamanho} {m.tipo.toLowerCase()}
        {m.tendencia ? `, ${m.tendencia.toLowerCase()}` : ""}
      </p>
      <dl className="campos-da-magia">
        <LinhaDoBloco
          rotulo="Classe de Armadura"
          valor={`${m.ca.valor}${m.ca.fonte ? ` (${m.ca.fonte})` : ""}`}
        />
        <LinhaDoBloco
          rotulo="Pontos de vida"
          valor={`${m.pv.media}${m.pv.formula ? ` (${m.pv.formula})` : ""}`}
        />
        <LinhaDoBloco rotulo="Deslocamento" valor={m.deslocamento} />
      </dl>
      <div className="atributos-do-monstro" data-testid="compendio-monstro-atributos">
        {(["for", "des", "con", "int", "sab", "car"] as const).map((a) => (
          <div key={a} className="celula-de-atributo">
            <span>{a.toUpperCase()}</span>
            <strong>{m.atributos[a]}</strong>
            <span>({modificador(m.atributos[a])})</span>
          </div>
        ))}
      </div>
      <dl className="campos-da-magia">
        <LinhaDoBloco rotulo="Testes de resistência" valor={salvaguardas} />
        <LinhaDoBloco rotulo="Perícias" valor={pericias} />
        <LinhaDoBloco rotulo="Vulnerabilidades" valor={m.vulnerabilidades} />
        <LinhaDoBloco rotulo="Resistências" valor={m.resistencias} />
        <LinhaDoBloco rotulo="Imunidades" valor={m.imunidades} />
        <LinhaDoBloco rotulo="Imunidade a condições" valor={m.imunidadesCondicoes} />
        <LinhaDoBloco rotulo="Sentidos" valor={m.sentidos} />
        <LinhaDoBloco rotulo="Idiomas" valor={m.idiomas} />
        <LinhaDoBloco
          rotulo="Nível de desafio"
          valor={`${m.nd}${xp !== undefined ? ` (${xp.toLocaleString("pt-BR")} XP)` : ""}`}
        />
      </dl>
      <Secao titulo="Traços" linhas={m.tracos} testid="compendio-monstro-tracos" />
      <Secao titulo="Ações" linhas={m.acoes} testid="compendio-monstro-acoes" />
      <Secao titulo="Reações" linhas={m.reacoes} testid="compendio-monstro-reacoes" />
      {m.acoesLendarias && m.acoesLendarias.length > 0 && (
        <section className="secao-do-monstro" data-testid="compendio-monstro-lendarias">
          <h4>Ações lendárias</h4>
          {m.textoDasAcoesLendarias && <p>{m.textoDasAcoesLendarias}</p>}
          {m.acoesLendarias.map((l) => (
            <p key={l.nome}>
              <strong>{l.nome}.</strong> {l.texto}
            </p>
          ))}
        </section>
      )}
      {(inata || espacos) && (
        <section className="secao-do-monstro" data-testid="compendio-monstro-conjuracao">
          <h4>Conjuração</h4>
          {inata && (
            <p>
              <strong>Inata.</strong>{" "}
              {inata.magias
                .map(
                  (x) =>
                    `${x.nome} (${
                      x.frequencia === "vontade"
                        ? "à vontade"
                        : x.frequencia === "cada"
                          ? `${x.max ?? 1}/dia cada`
                          : "do grupo"
                    })`,
                )
                .join(", ")}
              {inata.grupoMax ? `. Grupo: ${inata.grupoMax}/dia.` : ""}
            </p>
          )}
          {espacos && (
            <p>
              <strong>Por espaços.</strong>{" "}
              {Object.entries(espacos.espacos)
                .map(([n, t]) => `${n}º nível: ${t} espaços`)
                .join(", ")}
              . {espacos.magias.length} magias
              {magias.length > 0 ? "." : " (nenhuma no compêndio)."}
            </p>
          )}
        </section>
      )}
      <div className="acoes-da-magia">
        {npc.podeCriar ? (
          <button
            type="button"
            className="primario"
            data-testid="compendio-monstro-criar"
            onClick={() => npc.criar(m, entradaDoMonstro(m, magias).magias)}
          >
            <UserPlus size={14} /> Criar NPC
          </button>
        ) : (
          <p className="nota">Só o mestre cria NPCs a partir dos monstros.</p>
        )}
        <MensagemDeAviso aviso={npc.aviso} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------------------------
// Itens mágicos
// ---------------------------------------------------------------------------------------------

/**
 * Os itens mágicos do compêndio: busca, tipo e raridade. Cada linha abre a descrição, se arrasta para a ficha aberta
 * (equipamento no personagem, traço no NPC) e o botão Adicionar faz o mesmo pelo teclado. A arma mágica com bônus entra
 * também nos ataques.
 */
export function ListaDeItensMagicos({
  itens,
  texto,
  estado,
  eu,
  enviar,
  modoTodas = false,
}: {
  itens: readonly ItemMagicoDoCompendio[];
  texto: string;
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  /** Q2: dentro do "Todas": sem filtros nem contagem. */
  modoTodas?: boolean;
}) {
  const meus = estado.personagens.filter((p: Personagem) => podeEditarPersonagem(p, eu));
  const [alvo, escolherAlvo] = useAlvoDaFicha(meus);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [tipo, setTipo] = useState("");
  const [raridade, setRaridade] = useState("");
  const [sintonizacao, setSintonizacao] = useState("");
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const opcoes = useMemo(() => opcoesDeItensMagicos(itens), [itens]);
  const achados = useMemo(
    () =>
      buscarItensMagicos(itens, {
        texto,
        tipo: tipo || undefined,
        raridade: (raridade || undefined) as ItemMagicoDoCompendio["raridade"] | undefined,
        sintonizacao: sintonizacao === "" ? undefined : sintonizacao === "sim",
      }),
    [itens, texto, tipo, raridade, sintonizacao],
  );
  const temFiltro = tipo !== "" || raridade !== "" || sintonizacao !== "" || texto !== "";

  function alternar(nome: string) {
    setAbertos((a) => {
      const novo = new Set(a);
      if (novo.has(nome)) novo.delete(nome);
      else novo.add(nome);
      return novo;
    });
  }
  function adicionar(i: ItemMagicoDoCompendio) {
    if (!alvo) return;
    const r = aplicarEntradaNaFicha(
      alvo.ficha ?? fichaNova(0),
      { tipo: "itemMagico", itemMagico: i },
      apresentacaoDoPersonagem(alvo),
    );
    if (!r.ok) return setAviso({ tipo: "erro", texto: r.motivo });
    const ok = enviar("ficha.alterar", { personagemId: alvo.id, operacoes: r.operacoes });
    setAviso(
      ok === null
        ? { tipo: "erro", texto: "Sem conexão com a sala." }
        : { tipo: "ok", texto: `${i.nome} entrou na ficha de ${alvo.nome}.` },
    );
  }

  return (
    <div data-testid="compendio-itensMagicos">
      {!modoTodas && (
        <>
          <div className="filtros-do-monstro" data-testid="compendio-filtros-itens-magicos">
            <select
              data-testid="compendio-item-magico-tipo"
              aria-label="Tipo de item"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {opcoes.tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              data-testid="compendio-item-magico-raridade"
              aria-label="Raridade"
              value={raridade}
              onChange={(e) => setRaridade(e.target.value)}
            >
              <option value="">Todas as raridades</option>
              {opcoes.raridades.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_DA_RARIDADE[r]}
                </option>
              ))}
            </select>
            <select
              data-testid="compendio-item-magico-sintonizacao"
              aria-label="Sintonização"
              value={sintonizacao}
              onChange={(e) => setSintonizacao(e.target.value)}
            >
              <option value="">Com ou sem sintonização</option>
              <option value="sim">Exige sintonização</option>
              <option value="nao">Não exige sintonização</option>
            </select>
          </div>
          <div className="barra-do-compendio">
            <span className="nota contagem-do-compendio" data-testid="compendio-contagem">
              {temFiltro ? `${achados.length} de ${itens.length}` : `${itens.length}`}{" "}
              {itens.length === 1 ? "item mágico" : "itens mágicos"}
            </span>
            {temFiltro && (
              <button
                type="button"
                className="link"
                data-testid="compendio-limpar"
                onClick={() => {
                  setTipo("");
                  setRaridade("");
                  setSintonizacao("");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
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
        </>
      )}
      {achados.length === 0 ? (
        <p className="nota" data-testid="compendio-nenhuma">
          Nenhum item mágico encontrado.
        </p>
      ) : (
        <BlocosDoCompendio
          escopo="itensMagicos"
          grupos={agruparItensMagicosPorRaridade(achados)}
          forcar={temFiltro}
          total={itens.length}
          testid="compendio-lista-entradas"
          renderEntrada={(i) => {
            const aberto = abertos.has(i.nome);
            return (
              <li key={i.nome}>
                <div className="entrada-do-compendio">
                  <button
                    type="button"
                    className="entrada-arrastavel"
                    draggable
                    data-testid="compendio-entrada-itemMagico"
                    data-nome={i.nome}
                    aria-expanded={aberto}
                    title="Mostrar a descrição (ou arraste para a ficha aberta)"
                    onClick={() => alternar(i.nome)}
                    onDragStart={(e) =>
                      comecarArrastoDoCompendio(e, { tipo: "itemMagico", itemMagico: i })
                    }
                  >
                    <GripVertical size={14} className="alca-da-entrada" aria-hidden />
                    <span className="textos-da-entrada">
                      <span className="nome-da-magia">
                        {i.nome} <NomeOriginal nome={i.nomeOriginal} />
                      </span>
                      <span className="nivel-e-escola">
                        <span
                          className="raridade-do-item"
                          data-raridade={i.raridade}
                          data-testid="compendio-item-raridade"
                        >
                          {ROTULO_DA_RARIDADE[i.raridade]}
                        </span>
                        {i.tipo}
                        {i.sintonizacao?.necessaria ? " · sintonização" : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="compendio-itemMagico-adicionar"
                    aria-label={`Adicionar ${i.nome} à ficha`}
                    disabled={!alvo}
                    onClick={() => adicionar(i)}
                  >
                    <BookPlus size={14} /> Adicionar
                  </button>
                </div>
                {aberto && (
                  <div className="descricao-do-item" data-testid="compendio-item-descricao">
                    <p className="nota">{resumoDoItemMagico(i)}</p>
                    <p>{i.descricao}</p>
                  </div>
                )}
              </li>
            );
          }}
        />
      )}
      <MensagemDeAviso aviso={aviso} />
    </div>
  );
}
