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
  FileText,
  FolderPlus,
  GripVertical,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { lerItemArrastado, TIPO_DE_ARRASTO_DA_FICHA } from "./arrasto";
import { BotaoComDica } from "./BotaoComDica";
import type { AbaDaFicha } from "./ficha/janelas";
import { useImportadorDePdf } from "./ficha/useImportadorDePdf";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { Popover } from "./Popover";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  eu: Usuario;
  enviar: Enviar;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  /** Abre a janela da ficha (um clique no item; o item recém-criado abre em Configurar). */
  aoAbrirFicha: (personagemId: string, aba?: AbaDaFicha) => void;
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
  /** Importa a ficha de um PDF de ficha por cima deste item (só para quem edita). */
  aoImportarPdf: () => void;
};

function Item({ p, eu, imagens, versao, aoAbrir, aoImportarPdf }: PropsItem) {
  const euMestre = eu.papel === "mestre";
  const linha = useRef<HTMLLIElement>(null);
  const [menu, setMenu] = useState(false);
  // O mestre arrasta o item inteiro (a alça ou o nome) para outra pasta ou para o mapa.
  const iniciarArrasto = (e: DragEvent) => {
    e.dataTransfer.setData(
      TIPO_DE_ARRASTO_DA_FICHA,
      JSON.stringify({ tipo: "personagem", id: p.id }),
    );
    e.dataTransfer.effectAllowed = "move";
    if (linha.current) e.dataTransfer.setDragImage(linha.current, 12, 12);
  };
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
          onDragStart={iniciarArrasto}
        >
          <GripVertical size={16} />
        </span>
      ) : (
        <span className="alca desligada" aria-hidden="true" />
      )}
      <BotaoComDica
        className="ficha-abrir"
        testid={`ficha-abrir-${p.id}`}
        nome="Abrir a ficha"
        dica={euMestre ? "Arraste para o mapa para pôr o token." : undefined}
        draggable={euMestre || undefined}
        onDragStart={euMestre ? iniciarArrasto : undefined}
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
        {p.ficha && (
          <span className="ficha-pv" title="Pontos de vida">
            {p.ficha.pvAtual}/{p.ficha.pvMax}
          </span>
        )}
        {!euMestre && podeEditarPersonagem(p, eu) && <span className="selo">seu</span>}
      </BotaoComDica>
      {podeEditarPersonagem(p, eu) && (
        <span className="ficha-item-menu">
          <BotaoComDica
            className="botao-icone pequeno"
            data-popover-gatilho=""
            testid={`ficha-menu-${p.id}`}
            nome="Mais ações"
            dica="Importar PDF, exportar e outras ações deste item."
            semDica={menu}
            aria-expanded={menu}
            aria-label={`Mais ações de ${p.nome}`}
            onClick={() => setMenu(!menu)}
          >
            <MoreHorizontal size={16} />
          </BotaoComDica>
          {menu && (
            <Popover
              testid={`ficha-menu-itens-${p.id}`}
              className="popover-item"
              aoFechar={() => setMenu(false)}
            >
              <button
                type="button"
                className="item-menu"
                data-testid={`ficha-menu-importar-pdf-${p.id}`}
                onClick={() => {
                  setMenu(false);
                  aoImportarPdf();
                }}
              >
                <FileText size={14} /> Importar PDF…
              </button>
            </Popover>
          )}
        </span>
      )}
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
  aoImportarPdf: (p: Personagem) => void;
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
  aoImportarPdf,
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
              aoImportarPdf={() => aoImportarPdf(p)}
            />
          ))}
          {itens.length === 0 && <li className="nota">Pasta vazia.</li>}
        </ul>
      )}
    </section>
  );
}

/**
 * Aba Fichas (o "diário"): as pastas, sem subpastas (as notas têm aba própria desde o R4).
 * A pasta define quem vê (o mestre muda); quem edita é do item. Arrastar pela alça leva o item para
 * outra pasta ou para o mapa (só o mestre).
 */
export function AbaFichas({ estado, eu, enviar, imagens, versaoDasImagens, aoAbrirFicha }: Props) {
  const euMestre = eu.papel === "mestre";
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [novoAberto, setNovoAberto] = useState(false);
  const [paraAbrir, setParaAbrir] = useState<string | null>(null);
  const importadorDePdf = useImportadorDePdf({
    estado,
    eu,
    enviar,
    aoCriar: (id) => aoAbrirFicha(id, "principal"),
  });

  // O item recém-criado abre na janela (aba Configurar) assim que a sala o devolve.
  useEffect(() => {
    if (paraAbrir && estado.personagens.some((p) => p.id === paraAbrir)) {
      aoAbrirFicha(paraAbrir, "configurar");
      setParaAbrir(null);
    }
  }, [paraAbrir, estado.personagens, aoAbrirFicha]);

  const pastas = [...estado.pastas].sort((a, b) => a.ordem - b.ordem);
  const idsDePastas = new Set(pastas.map((p) => p.id));
  // Itens que o jogador edita numa pasta que ele não vê: ficam num grupo sem nome de pasta.
  const avulsos = estado.personagens.filter((p) => !idsDePastas.has(p.pastaId));

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
      {importadorDePdf.elementos}
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
              <button
                type="button"
                data-testid="ficha-novo-pdf"
                title="Lê o PDF impresso da ficha (no seu navegador) e mostra a revisão: ficha nova ou por cima de um personagem"
                onClick={() => importadorDePdf.escolher(null)}
              >
                <FileText size={14} /> Importar PDF…
              </button>
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
            aoAbrirItem={(id) => aoAbrirFicha(id)}
            aoSoltar={moverParaPasta}
            aoImportarPdf={importadorDePdf.escolher}
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
                  aoAbrir={() => aoAbrirFicha(p.id)}
                  aoImportarPdf={() => importadorDePdf.escolher(p)}
                />
              ))}
            </ul>
          </section>
        )}
        {pastas.length === 0 && avulsos.length === 0 && (
          <p className="nota">Nenhuma ficha visível para você ainda.</p>
        )}
      </section>
    </div>
  );
}
