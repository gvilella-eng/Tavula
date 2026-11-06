import {
  type Estado,
  PASTA_NPCS_ID,
  PASTA_PERSONAGENS_ID,
  type Pasta,
  type Personagem,
  podeEditarPersonagem,
  type Usuario,
  type Visibilidade,
} from "@tabletop/shared";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FolderPlus,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { AbaNotas } from "./abas";
import { lerItemArrastado, TIPO_DE_ARRASTO_DA_FICHA } from "./arrasto";
import { EditorDoItem } from "./EditorDoItem";
import type { PedirImagem } from "./FaixaDeCenas";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { Popover } from "./Popover";
import type { Ocorrencia } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  eu: Usuario;
  pronto: boolean;
  enviar: Enviar;
  ouvir: (fn: (o: Ocorrencia) => void) => () => void;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  pedirImagem: PedirImagem;
  /** A cena que o mestre está vendo (onde "Colocar na cena" põe o token). */
  cenaVista: { id: string; nome: string };
};

const ITENS_EM_BREVE = ["Artefato", "Tesouro", "Handout"];

function IconeDaVisibilidade({ v }: { v: Visibilidade }) {
  if (v.tipo === "todos") return <Eye size={14} />;
  if (v.tipo === "mestre") return <Lock size={14} />;
  return <Users size={14} />;
}

/** Quem vê a pasta: todos, jogadores escolhidos ou só o mestre (aplica na hora). */
function PopoverDeVisibilidade({
  pasta,
  jogadores,
  enviar,
  aoFechar,
}: {
  pasta: Pasta;
  jogadores: Usuario[];
  enviar: Enviar;
  aoFechar: () => void;
}) {
  const v = pasta.visivel;
  const ids = v.tipo === "jogadores" ? v.ids : [];
  const definir = (visivel: Visibilidade) => enviar("pasta.editar", { id: pasta.id, visivel });
  return (
    <Popover
      testid={`ficha-pasta-visibilidade-${pasta.id}`}
      titulo="Quem vê esta pasta"
      className="popover-visibilidade"
      aoFechar={aoFechar}
    >
      <fieldset className="opcoes-visibilidade">
        <legend className="so-leitor">Quem vê</legend>
        <label className="item-menu">
          <input
            type="radio"
            name={`visib-${pasta.id}`}
            data-testid="visib-todos"
            checked={v.tipo === "todos"}
            onChange={() => definir({ tipo: "todos" })}
          />
          <Eye size={14} /> Todos os jogadores
        </label>
        <label className="item-menu">
          <input
            type="radio"
            name={`visib-${pasta.id}`}
            data-testid="visib-jogadores"
            checked={v.tipo === "jogadores"}
            onChange={() => definir({ tipo: "jogadores", ids })}
          />
          <Users size={14} /> Jogadores escolhidos
        </label>
        {v.tipo === "jogadores" && (
          <div className="chips recuado">
            {jogadores.map((u) => (
              <button
                key={u.id}
                type="button"
                className="chip"
                data-testid={`visib-jogador-${u.id}`}
                aria-pressed={ids.includes(u.id)}
                onClick={() =>
                  definir({
                    tipo: "jogadores",
                    ids: ids.includes(u.id) ? ids.filter((x) => x !== u.id) : [...ids, u.id],
                  })
                }
              >
                {u.nome}
              </button>
            ))}
          </div>
        )}
        <label className="item-menu">
          <input
            type="radio"
            name={`visib-${pasta.id}`}
            data-testid="visib-mestre"
            checked={v.tipo === "mestre"}
            onChange={() => definir({ tipo: "mestre" })}
          />
          <Lock size={14} /> Só o mestre
        </label>
      </fieldset>
    </Popover>
  );
}

type PropsItem = {
  p: Personagem;
  eu: Usuario;
  imagens: ImagensDoMapa | null;
  versao: number;
  aoAbrir: () => void;
};

function Item({ p, eu, imagens, versao, aoAbrir }: PropsItem) {
  const euMestre = eu.papel === "mestre";
  const linha = useRef<HTMLLIElement>(null);
  return (
    <li
      ref={linha}
      className="ficha-item"
      data-testid={`ficha-item-${p.id}`}
      data-personagem-id={p.id}
    >
      {euMestre ? (
        // biome-ignore lint/a11y/useSemanticElements: a alça é só o ponto de partida do arrasto (HTML5)
        <span
          className="alca"
          role="button"
          tabIndex={-1}
          draggable
          data-testid={`ficha-alca-${p.id}`}
          title="Arraste para outra pasta ou para o mapa"
          aria-label={`Arrastar ${p.nome}`}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              TIPO_DE_ARRASTO_DA_FICHA,
              JSON.stringify({ tipo: "personagem", id: p.id }),
            );
            e.dataTransfer.effectAllowed = "move";
            if (linha.current) e.dataTransfer.setDragImage(linha.current, 12, 12);
          }}
        >
          <GripVertical size={16} />
        </span>
      ) : (
        <span className="alca desligada" aria-hidden="true" />
      )}
      <button
        type="button"
        className="ficha-abrir"
        data-testid={`ficha-abrir-${p.id}`}
        onClick={aoAbrir}
      >
        <Avatar
          imagens={imagens}
          versao={versao}
          hash={p.retratoHash}
          nome={p.nome}
          cor={p.tokenPadrao.cor}
          className="pequeno"
        />
        <span className="ficha-nome" data-testid={`ficha-nome-${p.id}`}>
          {p.nome}
        </span>
        <span className="ficha-pv" title="Pontos de vida">
          {p.ficha.pvAtual}/{p.ficha.pvMax}
        </span>
        {!euMestre && podeEditarPersonagem(p, eu) && <span className="selo">seu</span>}
      </button>
    </li>
  );
}

type PropsPasta = {
  pasta: Pasta;
  itens: Personagem[];
  eu: Usuario;
  jogadores: Usuario[];
  aberta: boolean;
  imagens: ImagensDoMapa | null;
  versao: number;
  enviar: Enviar;
  aoAlternar: () => void;
  aoAbrirItem: (id: string) => void;
  aoSoltar: (itemId: string, pastaId: string) => void;
};

function SecaoDaPasta({
  pasta,
  itens,
  eu,
  jogadores,
  aberta,
  imagens,
  versao,
  enviar,
  aoAlternar,
  aoAbrirItem,
  aoSoltar,
}: PropsPasta) {
  const euMestre = eu.papel === "mestre";
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(pasta.nome);
  const [visibilidade, setVisibilidade] = useState(false);
  const [sobre, setSobre] = useState(false);
  useEffect(() => setNome(pasta.nome), [pasta.nome]);

  function confirmar() {
    setEditando(false);
    const limpo = nome.trim();
    if (limpo && limpo !== pasta.nome) enviar("pasta.editar", { id: pasta.id, nome: limpo });
    else setNome(pasta.nome);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a pasta é alvo de soltar (HTML5); fieldset estragaria o layout
    <section
      className="ficha-pasta"
      data-testid={`ficha-pasta-${pasta.id}`}
      data-pasta-id={pasta.id}
      data-sobre={sobre}
      role="group"
      aria-label={`Pasta ${pasta.nome}`}
      onDragOver={(e) => {
        if (euMestre && e.dataTransfer.types.includes(TIPO_DE_ARRASTO_DA_FICHA)) {
          e.preventDefault();
          setSobre(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false);
      }}
      onDrop={(e) => {
        setSobre(false);
        const item = lerItemArrastado(e.dataTransfer.getData(TIPO_DE_ARRASTO_DA_FICHA));
        if (!item || !euMestre) return;
        e.preventDefault();
        aoSoltar(item.id, pasta.id);
      }}
    >
      <header className="ficha-pasta-cabecalho">
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid={`ficha-pasta-alternar-${pasta.id}`}
          aria-expanded={aberta}
          title={aberta ? "Recolher a pasta" : "Abrir a pasta"}
          aria-label={aberta ? "Recolher a pasta" : "Abrir a pasta"}
          onClick={aoAlternar}
        >
          {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {editando ? (
          <input
            className="cena-nome-campo"
            aria-label={`Nome da pasta ${pasta.nome}`}
            data-testid={`ficha-pasta-nome-editar-${pasta.id}`}
            value={nome}
            maxLength={64}
            // biome-ignore lint/a11y/noAutofocus: o campo nasce do clique em renomear
            autoFocus
            onChange={(e) => setNome(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setNome(pasta.nome);
                setEditando(false);
              }
            }}
          />
        ) : (
          <span className="ficha-pasta-nome" data-testid={`ficha-pasta-nome-${pasta.id}`}>
            {pasta.nome}
          </span>
        )}
        <span className="ficha-pasta-total">{itens.length}</span>
        {euMestre && (
          <span className="ficha-pasta-acoes">
            <button
              type="button"
              className="botao-icone pequeno"
              data-testid={`ficha-pasta-renomear-${pasta.id}`}
              title="Renomear a pasta"
              aria-label="Renomear a pasta"
              onClick={() => setEditando(true)}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="botao-icone pequeno"
              data-popover-gatilho=""
              data-testid={`ficha-pasta-visib-${pasta.id}`}
              title="Quem vê esta pasta"
              aria-label="Quem vê esta pasta"
              onClick={() => setVisibilidade(!visibilidade)}
            >
              <IconeDaVisibilidade v={pasta.visivel} />
            </button>
            <button
              type="button"
              className="botao-icone pequeno"
              data-testid={`ficha-pasta-apagar-${pasta.id}`}
              disabled={itens.length > 0}
              title={itens.length > 0 ? "Só uma pasta vazia pode ser apagada" : "Apagar a pasta"}
              aria-label="Apagar a pasta"
              onClick={() => enviar("pasta.apagar", { id: pasta.id })}
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </header>
      {visibilidade && euMestre && (
        <PopoverDeVisibilidade
          pasta={pasta}
          jogadores={jogadores}
          enviar={enviar}
          aoFechar={() => setVisibilidade(false)}
        />
      )}
      {aberta && (
        <ul className="lista-simples ficha-lista">
          {itens.map((p) => (
            <Item
              key={p.id}
              p={p}
              eu={eu}
              imagens={imagens}
              versao={versao}
              aoAbrir={() => aoAbrirItem(p.id)}
            />
          ))}
          {itens.length === 0 && <li className="nota">Pasta vazia.</li>}
        </ul>
      )}
    </section>
  );
}

/**
 * Aba Fichas (o "diário"): no topo as notas (da mesa e do mestre), depois as pastas, sem subpastas.
 * A pasta define quem vê (o mestre muda); quem edita é do item. Arrastar pela alça leva o item para
 * outra pasta ou para o mapa (só o mestre).
 */
export function AbaFichas({
  estado,
  eu,
  pronto,
  enviar,
  ouvir,
  imagens,
  versaoDasImagens,
  pedirImagem,
  cenaVista,
}: Props) {
  const euMestre = eu.papel === "mestre";
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [paraAbrir, setParaAbrir] = useState<string | null>(null);

  // O item recém-criado abre no editor assim que a sala o devolve.
  useEffect(() => {
    if (paraAbrir && estado.personagens.some((p) => p.id === paraAbrir)) {
      setItemAberto(paraAbrir);
      setParaAbrir(null);
    }
  }, [paraAbrir, estado.personagens]);

  const pastas = [...estado.pastas].sort((a, b) => a.ordem - b.ordem);
  const idsDePastas = new Set(pastas.map((p) => p.id));
  // Itens que o jogador edita numa pasta que ele não vê: ficam num grupo sem nome de pasta.
  const avulsos = estado.personagens.filter((p) => !idsDePastas.has(p.pastaId));
  const aberto = estado.personagens.find((p) => p.id === itemAberto) ?? null;

  function alternar(id: string) {
    setRecolhidas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function criarItem(npc: boolean) {
    setNovoAberto(false);
    const pastaId = npc
      ? idsDePastas.has(PASTA_NPCS_ID)
        ? PASTA_NPCS_ID
        : pastas[0]?.id
      : idsDePastas.has(PASTA_PERSONAGENS_ID)
        ? PASTA_PERSONAGENS_ID
        : pastas[0]?.id;
    if (!pastaId) return;
    const id = `pers-${crypto.randomUUID().slice(0, 8)}`;
    const enviado = enviar("personagem.criar", {
      personagem: {
        id,
        pastaId,
        editores: { tipo: "jogadores", ids: [] },
        nome: npc ? "Novo NPC" : "Novo personagem",
        tokenPadrao: { cor: npc ? "#c0392b" : "#3cb44b", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 10, pvMax: 10 },
      },
    });
    if (enviado) setParaAbrir(id);
  }

  function criarPasta() {
    const ordem = pastas.reduce((m, p) => Math.max(m, p.ordem), -1) + 1;
    enviar("pasta.criar", {
      pasta: {
        id: `pasta-${crypto.randomUUID().slice(0, 8)}`,
        nome: "Nova pasta",
        ordem,
        visivel: { tipo: "mestre" },
      },
    });
  }

  function moverParaPasta(itemId: string, pastaId: string) {
    const p = estado.personagens.find((x) => x.id === itemId);
    if (p && p.pastaId !== pastaId)
      enviar("personagem.editar", { id: itemId, mudancas: { pastaId } });
  }

  return (
    <div className="aba-fichas" data-testid="aba-fichas-conteudo">
      <section className="fichas-notas" data-testid="fichas-notas">
        <h3>Notas</h3>
        <AbaNotas estado={estado} eu={eu} pronto={pronto} enviar={enviar} ouvir={ouvir} />
      </section>

      <section className="fichas-pastas">
        <div className="fichas-barra">
          <h3>Pastas</h3>
          {euMestre && (
            <span className="linha-botoes">
              <span className="novo-area">
                <button
                  type="button"
                  data-popover-gatilho=""
                  data-testid="ficha-novo"
                  aria-expanded={novoAberto}
                  onClick={() => setNovoAberto(!novoAberto)}
                >
                  <Plus size={14} /> Novo
                </button>
                {novoAberto && (
                  <Popover
                    testid="ficha-novo-menu"
                    className="popover-novo"
                    aoFechar={() => setNovoAberto(false)}
                  >
                    <button
                      type="button"
                      className="item-menu"
                      data-testid="ficha-novo-personagem"
                      onClick={() => criarItem(false)}
                    >
                      Personagem
                    </button>
                    <button
                      type="button"
                      className="item-menu"
                      data-testid="ficha-novo-npc"
                      onClick={() => criarItem(true)}
                    >
                      NPC
                    </button>
                    {ITENS_EM_BREVE.map((nome) => (
                      <button
                        key={nome}
                        type="button"
                        className="item-menu"
                        data-testid={`ficha-novo-${nome.toLowerCase()}`}
                        disabled
                        title="Em breve"
                      >
                        {nome} <span className="nota">em breve</span>
                      </button>
                    ))}
                  </Popover>
                )}
              </span>
              <button type="button" data-testid="ficha-nova-pasta" onClick={criarPasta}>
                <FolderPlus size={14} /> Pasta
              </button>
            </span>
          )}
        </div>

        {pastas.map((pasta) => (
          <SecaoDaPasta
            key={pasta.id}
            pasta={pasta}
            itens={estado.personagens.filter((p) => p.pastaId === pasta.id)}
            eu={eu}
            jogadores={jogadores}
            aberta={!recolhidas.has(pasta.id)}
            imagens={imagens}
            versao={versaoDasImagens}
            enviar={enviar}
            aoAlternar={() => alternar(pasta.id)}
            aoAbrirItem={setItemAberto}
            aoSoltar={moverParaPasta}
          />
        ))}
        {avulsos.length > 0 && (
          <section className="ficha-pasta" data-testid="ficha-pasta-avulsos">
            <header className="ficha-pasta-cabecalho">
              <span className="ficha-pasta-nome">Seus itens</span>
              <span className="ficha-pasta-total">{avulsos.length}</span>
            </header>
            <ul className="lista-simples ficha-lista">
              {avulsos.map((p) => (
                <Item
                  key={p.id}
                  p={p}
                  eu={eu}
                  imagens={imagens}
                  versao={versaoDasImagens}
                  aoAbrir={() => setItemAberto(p.id)}
                />
              ))}
            </ul>
          </section>
        )}
        {pastas.length === 0 && avulsos.length === 0 && (
          <p className="nota">Nenhuma ficha visível para você ainda.</p>
        )}
      </section>

      {aberto && (
        <EditorDoItem
          personagem={aberto}
          estado={estado}
          eu={eu}
          enviar={enviar}
          imagens={imagens}
          versaoDasImagens={versaoDasImagens}
          pedirImagem={pedirImagem}
          cenaVista={cenaVista}
          aoFechar={() => setItemAberto(null)}
        />
      )}
    </div>
  );
}
