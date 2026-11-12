import {
  type Estado,
  type Handout,
  jogadoresDaMesa,
  PASTA_HANDOUTS_ID,
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
  Lock,
  Plus,
  ScrollText,
  User,
  Users,
} from "lucide-react";
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { lerItemArrastado, TIPO_DE_ARRASTO_DA_FICHA } from "./arrasto";
import { BotaoComDica } from "./BotaoComDica";
import type { AbaDaFicha } from "./ficha/janelas";
import { MiniaturaDoHandout } from "./JanelaDoHandout";
import { type ItemDoMenu, MenuDeContexto, pontoDoElemento } from "./MenuDeContexto";
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
  /** Abre a janela de um handout. */
  aoAbrirHandout: (handoutId: string) => void;
};

/** O que o menu de botão direito está mostrando agora: o alvo e o ponto da página. */
type MenuAberto = {
  alvo: { tipo: "personagem" | "handout" | "pasta"; id: string };
  x: number;
  y: number;
  teclado: boolean;
};

const ATALHO_DO_MENU = (e: KeyboardEvent) =>
  e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey && !e.ctrlKey && !e.altKey);

function iconeDaVisibilidade(v: Visibilidade) {
  if (v.tipo === "todos") return <Eye size={14} />;
  if (v.tipo === "mestre") return <Lock size={14} />;
  return <Users size={14} />;
}

function rotuloDaVisibilidade(v: Visibilidade, jogadores: Usuario[]): string {
  if (v.tipo === "todos") return "Todos os jogadores";
  if (v.tipo === "mestre") return "Só o mestre";
  const nomes = v.ids.map((id) => jogadores.find((u) => u.id === id)?.nome ?? id);
  return nomes.length > 0 ? nomes.join(", ") : "Só o mestre";
}

type PropsItem = {
  p: Personagem;
  eu: Usuario;
  imagens: ImagensDoMapa | null;
  versao: number;
  aoAbrir: () => void;
  aoMenu: (x: number, y: number, teclado: boolean) => void;
};

/** Um personagem ou NPC na árvore: o retrato, o nome e, à direita, os PV. */
function Item({ p, eu, imagens, versao, aoAbrir, aoMenu }: PropsItem) {
  const euMestre = eu.papel === "mestre";
  const linha = useRef<HTMLLIElement>(null);
  // O mestre arrasta o item inteiro para outra pasta ou para o mapa.
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
      onContextMenu={(e) => {
        e.preventDefault();
        aoMenu(e.clientX, e.clientY, false);
      }}
      onKeyDown={(e) => {
        if (!ATALHO_DO_MENU(e)) return;
        e.preventDefault();
        const ponto = pontoDoElemento(e.currentTarget);
        aoMenu(ponto.x, ponto.y, true);
      }}
    >
      <BotaoComDica
        className="ficha-abrir"
        testid={`ficha-abrir-${p.id}`}
        nomeVisivel
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
        {!euMestre && podeEditarPersonagem(p, eu) && <span className="selo">seu</span>}
        {p.ficha && (
          <span className="ficha-pv">
            {p.ficha.pvAtual}/{p.ficha.pvMax}
          </span>
        )}
      </BotaoComDica>
    </li>
  );
}

type PropsHandout = {
  h: Handout;
  eu: Usuario;
  jogadores: Usuario[];
  imagens: ImagensDoMapa | null;
  versao: number;
  aoAbrir: () => void;
  aoMenu: (x: number, y: number, teclado: boolean) => void;
};

/** Um handout na árvore: a imagem pequena (ou o pergaminho) à esquerda e o título. */
function ItemDeHandout({ h, eu, jogadores, imagens, versao, aoAbrir, aoMenu }: PropsHandout) {
  const euMestre = eu.papel === "mestre";
  const linha = useRef<HTMLLIElement>(null);
  const iniciarArrasto = (e: DragEvent) => {
    e.dataTransfer.setData(TIPO_DE_ARRASTO_DA_FICHA, JSON.stringify({ tipo: "handout", id: h.id }));
    e.dataTransfer.effectAllowed = "move";
    if (linha.current) e.dataTransfer.setDragImage(linha.current, 12, 12);
  };
  return (
    <li
      ref={linha}
      className="ficha-item ficha-handout"
      data-testid={`handout-item-${h.id}`}
      data-handout-id={h.id}
      onContextMenu={(e) => {
        if (!euMestre) return;
        e.preventDefault();
        aoMenu(e.clientX, e.clientY, false);
      }}
      onKeyDown={(e) => {
        if (!euMestre || !ATALHO_DO_MENU(e)) return;
        e.preventDefault();
        const ponto = pontoDoElemento(e.currentTarget);
        aoMenu(ponto.x, ponto.y, true);
      }}
    >
      <BotaoComDica
        className="ficha-abrir"
        testid={`handout-abrir-${h.id}`}
        nomeVisivel
        draggable={euMestre || undefined}
        onDragStart={euMestre ? iniciarArrasto : undefined}
        onClick={aoAbrir}
      >
        <MiniaturaDoHandout handout={h} imagens={imagens} versao={versao} />
        <span className="ficha-nome" data-testid={`handout-nome-${h.id}`}>
          {h.titulo}
        </span>
        {euMestre && (
          <span
            className="handout-quem-ve"
            data-testid={`handout-quem-ve-${h.id}`}
            data-visivel={h.visivel.tipo}
            role="img"
            aria-label={`Quem vê: ${rotuloDaVisibilidade(h.visivel, jogadores)}`}
            title={`Quem vê: ${rotuloDaVisibilidade(h.visivel, jogadores)}`}
          >
            {iconeDaVisibilidade(h.visivel)}
          </span>
        )}
      </BotaoComDica>
    </li>
  );
}

type PropsPasta = {
  pasta: Pasta;
  personagens: Personagem[];
  handouts: Handout[];
  eu: Usuario;
  jogadores: Usuario[];
  aberta: boolean;
  imagens: ImagensDoMapa | null;
  versao: number;
  enviar: Enviar;
  aoAlternar: () => void;
  aoAbrirItem: (id: string) => void;
  aoAbrirHandout: (id: string) => void;
  aoSoltar: (item: { tipo: "personagem" | "handout"; id: string }, pastaId: string) => void;
  aoMenu: (alvo: MenuAberto["alvo"], x: number, y: number, teclado: boolean) => void;
  /** O pedido de renomear (menu da pasta): muda a cada pedido, para repetir. */
  renomear: number;
};

/**
 * Uma pasta da árvore: a linha dela (seta de recolher, nome e quantos itens) e, embaixo, os itens com um recuo
 * à esquerda e uma linha-guia. Sem caixa em volta. O mestre renomeia clicando no nome (ou F2 com ele em foco).
 */
function SecaoDaPasta({
  pasta,
  personagens,
  handouts,
  eu,
  jogadores,
  aberta,
  imagens,
  versao,
  enviar,
  aoAlternar,
  aoAbrirItem,
  aoAbrirHandout,
  aoSoltar,
  aoMenu,
  renomear,
}: PropsPasta) {
  const euMestre = eu.papel === "mestre";
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(pasta.nome);
  const [sobre, setSobre] = useState(false);
  const botaoDoNome = useRef<HTMLButtonElement>(null);
  useEffect(() => setNome(pasta.nome), [pasta.nome]);
  // O menu da pasta pediu para renomear.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o gatilho é o contador do pedido
  useEffect(() => {
    if (renomear > 0 && euMestre) setEditando(true);
  }, [renomear]);

  function confirmar() {
    setEditando(false);
    const limpo = nome.trim();
    if (limpo && limpo !== pasta.nome) enviar("pasta.editar", { id: pasta.id, nome: limpo });
    else setNome(pasta.nome);
    // O foco volta ao nome (o campo some ao confirmar).
    requestAnimationFrame(() => botaoDoNome.current?.focus({ preventScroll: true }));
  }

  const total = personagens.length + handouts.length;
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
        aoSoltar(item, pasta.id);
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: o menu também abre pelo teclado, nos botões da linha (Shift+F10) */}
      <header
        className="ficha-pasta-cabecalho"
        data-testid={`ficha-pasta-linha-${pasta.id}`}
        onContextMenu={(e) => {
          if (!euMestre) return;
          e.preventDefault();
          aoMenu({ tipo: "pasta", id: pasta.id }, e.clientX, e.clientY, false);
        }}
        onKeyDown={(e) => {
          if (!euMestre || editando || !ATALHO_DO_MENU(e)) return;
          e.preventDefault();
          const ponto = pontoDoElemento(e.currentTarget);
          aoMenu({ tipo: "pasta", id: pasta.id }, ponto.x, ponto.y, true);
        }}
      >
        <BotaoComDica
          className="botao-icone pequeno"
          testid={`ficha-pasta-alternar-${pasta.id}`}
          nome={aberta ? "Recolher a pasta" : "Abrir a pasta"}
          aria-expanded={aberta}
          aria-label={aberta ? "Recolher a pasta" : "Abrir a pasta"}
          onClick={aoAlternar}
        >
          {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </BotaoComDica>
        {editando ? (
          <input
            className="cena-nome-campo ficha-pasta-campo"
            aria-label={`Nome da pasta ${pasta.nome}`}
            data-testid={`ficha-pasta-nome-editar-${pasta.id}`}
            value={nome}
            maxLength={64}
            // biome-ignore lint/a11y/noAutofocus: o campo nasce do clique no nome
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setNome(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setNome(pasta.nome);
                setEditando(false);
                requestAnimationFrame(() => botaoDoNome.current?.focus({ preventScroll: true }));
              }
            }}
          />
        ) : euMestre ? (
          <button
            ref={botaoDoNome}
            type="button"
            className="ficha-pasta-nome editavel"
            data-testid={`ficha-pasta-nome-${pasta.id}`}
            aria-keyshortcuts="F2"
            onClick={() => setEditando(true)}
            onKeyDown={(e) => {
              if (e.key === "F2") {
                e.preventDefault();
                setEditando(true);
              }
            }}
          >
            {pasta.nome}
          </button>
        ) : (
          <button
            ref={botaoDoNome}
            type="button"
            className="ficha-pasta-nome"
            data-testid={`ficha-pasta-nome-${pasta.id}`}
            onClick={aoAlternar}
          >
            {pasta.nome}
          </button>
        )}
        <span className="ficha-pasta-total" data-testid={`ficha-pasta-total-${pasta.id}`}>
          {total}
        </span>
      </header>
      {aberta && (
        <ul className="lista-simples ficha-lista">
          {personagens.map((p) => (
            <Item
              key={p.id}
              p={p}
              eu={eu}
              imagens={imagens}
              versao={versao}
              aoAbrir={() => aoAbrirItem(p.id)}
              aoMenu={(x, y, teclado) => aoMenu({ tipo: "personagem", id: p.id }, x, y, teclado)}
            />
          ))}
          {handouts.map((h) => (
            <ItemDeHandout
              key={h.id}
              h={h}
              eu={eu}
              jogadores={jogadores}
              imagens={imagens}
              versao={versao}
              aoAbrir={() => aoAbrirHandout(h.id)}
              aoMenu={(x, y, teclado) => aoMenu({ tipo: "handout", id: h.id }, x, y, teclado)}
            />
          ))}
          {total === 0 && <li className="nota ficha-vazia">Pasta vazia.</li>}
        </ul>
      )}
    </section>
  );
}

/**
 * Aba Fichas (o "diário"), em árvore (V3): cada pasta é uma linha e os itens dela (personagens, NPCs e handouts)
 * vêm embaixo com um recuo, sem subpastas. Um botão só, "+ Novo" (Personagem, NPC, Handout e Pasta). Clique abre;
 * o botão direito (ou Shift+F10) abre o menu do item e da pasta; o mestre arrasta o item para outra pasta e o
 * personagem para o mapa.
 */
export function AbaFichas({
  estado,
  eu,
  enviar,
  imagens,
  versaoDasImagens,
  aoAbrirFicha,
  aoAbrirHandout,
}: Props) {
  const euMestre = eu.papel === "mestre";
  const jogadores = jogadoresDaMesa(estado);
  const [recolhidas, setRecolhidas] = useState<Set<string>>(new Set());
  const [novoAberto, setNovoAberto] = useState(false);
  const [paraAbrir, setParaAbrir] = useState<string | null>(null);
  const [handoutParaAbrir, setHandoutParaAbrir] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const abriuNoTeclado = useRef(0);
  const [apagando, setApagando] = useState<string | null>(null);
  const [pedidoDeRenomear, setPedidoDeRenomear] = useState<{ id: string; n: number }>({
    id: "",
    n: 0,
  });

  // O item recém-criado abre na janela (aba Configurar, com o "Importar PDF" à vista) assim que a sala o devolve.
  useEffect(() => {
    if (paraAbrir && estado.personagens.some((p) => p.id === paraAbrir)) {
      aoAbrirFicha(paraAbrir, "configurar");
      setParaAbrir(null);
    }
  }, [paraAbrir, estado.personagens, aoAbrirFicha]);
  useEffect(() => {
    if (handoutParaAbrir && estado.handouts.some((h) => h.id === handoutParaAbrir)) {
      aoAbrirHandout(handoutParaAbrir);
      setHandoutParaAbrir(null);
    }
  }, [handoutParaAbrir, estado.handouts, aoAbrirHandout]);

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
        // V4b: a ficha já nasce com a apresentação escolhida (o bloco de monstro ou a ficha de personagem).
        ficha: { pvAtual: 10, pvMax: 10, apresentacao: npc ? "npc" : "personagem" },
      },
    });
    if (enviado) setParaAbrir(id);
  }

  function proximaOrdem(): number {
    return pastas.reduce((m, p) => Math.max(m, p.ordem), -1) + 1;
  }

  function criarPasta() {
    setNovoAberto(false);
    enviar("pasta.criar", {
      pasta: {
        id: `pasta-${crypto.randomUUID().slice(0, 8)}`,
        nome: "Nova pasta",
        ordem: proximaOrdem(),
        visivel: { tipo: "mestre" },
      },
    });
  }

  /** Um handout novo vai para a pasta "Handouts" (criada na hora, se ainda não existe), só do mestre e em "Livro". */
  function criarHandout() {
    setNovoAberto(false);
    let pastaId = PASTA_HANDOUTS_ID;
    if (!idsDePastas.has(PASTA_HANDOUTS_ID)) {
      pastaId = PASTA_HANDOUTS_ID;
      enviar("pasta.criar", {
        pasta: {
          id: PASTA_HANDOUTS_ID,
          nome: "Handouts",
          ordem: proximaOrdem(),
          visivel: { tipo: "mestre" },
        },
      });
    }
    const id = `handout-${crypto.randomUUID().slice(0, 8)}`;
    const enviado = enviar("handout.criar", {
      handout: {
        id,
        pastaId,
        titulo: "Novo handout",
        texto: "",
        fonte: "livro",
        visivel: { tipo: "mestre" },
      },
    });
    if (enviado) setHandoutParaAbrir(id);
  }

  function moverParaPasta(item: { tipo: "personagem" | "handout"; id: string }, pastaId: string) {
    if (item.tipo === "personagem") {
      const p = estado.personagens.find((x) => x.id === item.id);
      if (p && p.pastaId !== pastaId) {
        enviar("personagem.editar", { id: item.id, mudancas: { pastaId } });
      }
      return;
    }
    const h = estado.handouts.find((x) => x.id === item.id);
    if (h && h.pastaId !== pastaId)
      enviar("handout.editar", { id: item.id, mudancas: { pastaId } });
  }

  function abrirMenu(alvo: MenuAberto["alvo"], x: number, y: number, teclado: boolean) {
    // A tecla de menu também dispara o "contextmenu" do navegador: some quando fomos nós a abrir o menu (como no token).
    if (teclado) abriuNoTeclado.current = performance.now();
    else if (performance.now() - abriuNoTeclado.current < 700) return;
    setNovoAberto(false);
    setApagando(null);
    setMenu({ alvo, x, y, teclado });
  }

  /** As linhas do menu de botão direito do alvo aberto: o que o mestre e quem edita podem fazer com ele. */
  function itensDoMenu(m: MenuAberto): { titulo: string; itens: ItemDoMenu[] } | null {
    const fechar = () => setMenu(null);
    const outrasPastas = (atualId: string): ItemDoMenu[] => [
      { tipo: "titulo", chave: "t-mover", rotulo: "Mover para a pasta" },
      ...pastas
        .filter((x) => x.id !== atualId)
        .map(
          (x): ItemDoMenu => ({
            id: `mover-${x.id}`,
            rotulo: x.nome,
            aoClicar: () => {
              if (m.alvo.tipo === "personagem" || m.alvo.tipo === "handout") {
                moverParaPasta({ tipo: m.alvo.tipo, id: m.alvo.id }, x.id);
              }
            },
          }),
        ),
    ];
    const confirmarApagar = (chave: string, rotulo: string, apagar: () => void): ItemDoMenu =>
      apagando === chave
        ? {
            id: "apagar-confirmar",
            rotulo: `Confirmar: ${rotulo}`,
            perigo: true,
            manterAberto: false,
            aoClicar: apagar,
          }
        : {
            id: "apagar",
            rotulo: "Apagar…",
            perigo: true,
            manterAberto: true,
            aoClicar: () => setApagando(chave),
          };

    if (m.alvo.tipo === "personagem") {
      const p = estado.personagens.find((x) => x.id === m.alvo.id);
      if (!p) return null;
      const editor = podeEditarPersonagem(p, eu);
      const itens: ItemDoMenu[] = [
        { id: "abrir", rotulo: "Abrir a ficha", aoClicar: () => aoAbrirFicha(p.id) },
      ];
      if (editor) {
        itens.push({
          id: "configurar",
          rotulo: "Configurar…",
          aoClicar: () => aoAbrirFicha(p.id, "configurar"),
        });
      }
      if (euMestre) {
        const ids = p.editores.tipo === "jogadores" ? p.editores.ids : [];
        itens.push(
          { tipo: "separador", chave: "s1" },
          ...outrasPastas(p.pastaId),
          { tipo: "separador", chave: "s2" },
          { tipo: "titulo", chave: "t-controla", rotulo: "Quem controla" },
          {
            id: "controla-todos",
            rotulo: "Todos os jogadores",
            marcado: p.editores.tipo === "todos",
            aoClicar: () =>
              enviar("personagem.editar", {
                id: p.id,
                mudancas: {
                  editores:
                    p.editores.tipo === "todos"
                      ? { tipo: "jogadores", ids: [] }
                      : { tipo: "todos" },
                },
              }),
          },
          ...jogadores.map(
            (u): ItemDoMenu => ({
              id: `controla-${u.id}`,
              rotulo: u.nome,
              marcado: p.editores.tipo === "jogadores" && ids.includes(u.id),
              aoClicar: () =>
                enviar("personagem.editar", {
                  id: p.id,
                  mudancas: {
                    editores: {
                      tipo: "jogadores",
                      ids:
                        p.editores.tipo === "jogadores" && ids.includes(u.id)
                          ? ids.filter((x) => x !== u.id)
                          : p.editores.tipo === "jogadores"
                            ? [...ids, u.id]
                            : [u.id],
                    },
                  },
                }),
            }),
          ),
          { tipo: "separador", chave: "s3" },
          confirmarApagar(`p:${p.id}`, "apagar o item e os tokens", () => {
            enviar("personagem.apagar", { id: p.id });
            fechar();
          }),
        );
      }
      return { titulo: p.nome, itens };
    }

    if (m.alvo.tipo === "handout") {
      const h = estado.handouts.find((x) => x.id === m.alvo.id);
      if (!h) return null;
      const ids = h.visivel.tipo === "jogadores" ? h.visivel.ids : [];
      const definirVisivel = (visivel: Visibilidade) =>
        enviar("handout.editar", { id: h.id, mudancas: { visivel } });
      return {
        titulo: h.titulo,
        itens: [
          { id: "abrir", rotulo: "Abrir o handout", aoClicar: () => aoAbrirHandout(h.id) },
          {
            id: "mostrar",
            rotulo: "Mostrar agora",
            ...(h.visivel.tipo === "mestre"
              ? { motivo: "Só você vê este handout: escolha quem vê antes de mostrar." }
              : {}),
            aoClicar: () => enviar("handout.mostrar", { id: h.id }),
          },
          { tipo: "separador", chave: "s1" },
          { tipo: "titulo", chave: "t-quem", rotulo: "Quem vê" },
          {
            id: "visib-mestre",
            rotulo: "Só o mestre",
            marcado: h.visivel.tipo === "mestre",
            aoClicar: () => definirVisivel({ tipo: "mestre" }),
          },
          {
            id: "visib-todos",
            rotulo: "Todos os jogadores",
            marcado: h.visivel.tipo === "todos",
            aoClicar: () => definirVisivel({ tipo: "todos" }),
          },
          ...jogadores.map(
            (u): ItemDoMenu => ({
              id: `visib-${u.id}`,
              rotulo: u.nome,
              marcado: h.visivel.tipo === "jogadores" && ids.includes(u.id),
              aoClicar: () => {
                const novos =
                  h.visivel.tipo === "jogadores" && ids.includes(u.id)
                    ? ids.filter((x) => x !== u.id)
                    : h.visivel.tipo === "jogadores"
                      ? [...ids, u.id]
                      : [u.id];
                definirVisivel(
                  novos.length === 0 ? { tipo: "mestre" } : { tipo: "jogadores", ids: novos },
                );
              },
            }),
          ),
          { tipo: "separador", chave: "s2" },
          ...outrasPastas(h.pastaId),
          { tipo: "separador", chave: "s3" },
          confirmarApagar(`h:${h.id}`, "apagar o handout", () => {
            enviar("handout.apagar", { id: h.id });
            fechar();
          }),
        ],
      };
    }

    const pasta = pastas.find((x) => x.id === m.alvo.id);
    if (!pasta) return null;
    const v = pasta.visivel;
    const ids = v.tipo === "jogadores" ? v.ids : [];
    const vazia =
      !estado.personagens.some((p) => p.pastaId === pasta.id) &&
      !estado.handouts.some((h) => h.pastaId === pasta.id);
    const definirVisivel = (visivel: Visibilidade) =>
      enviar("pasta.editar", { id: pasta.id, visivel });
    return {
      titulo: pasta.nome,
      itens: [
        {
          id: "renomear",
          rotulo: "Renomear",
          aoClicar: () => setPedidoDeRenomear((a) => ({ id: pasta.id, n: a.n + 1 })),
        },
        { tipo: "separador", chave: "s1" },
        { tipo: "titulo", chave: "t-quem", rotulo: "Quem vê a pasta" },
        {
          id: "visib-mestre",
          rotulo: "Só o mestre",
          marcado: v.tipo === "mestre",
          aoClicar: () => definirVisivel({ tipo: "mestre" }),
        },
        {
          id: "visib-todos",
          rotulo: "Todos os jogadores",
          marcado: v.tipo === "todos",
          aoClicar: () => definirVisivel({ tipo: "todos" }),
        },
        ...jogadores.map(
          (u): ItemDoMenu => ({
            id: `visib-${u.id}`,
            rotulo: u.nome,
            marcado: v.tipo === "jogadores" && ids.includes(u.id),
            aoClicar: () => {
              const novos =
                v.tipo === "jogadores" && ids.includes(u.id)
                  ? ids.filter((x) => x !== u.id)
                  : v.tipo === "jogadores"
                    ? [...ids, u.id]
                    : [u.id];
              definirVisivel(
                novos.length === 0 ? { tipo: "mestre" } : { tipo: "jogadores", ids: novos },
              );
            },
          }),
        ),
        { tipo: "separador", chave: "s2" },
        vazia
          ? confirmarApagar(`d:${pasta.id}`, "apagar a pasta", () => {
              enviar("pasta.apagar", { id: pasta.id });
              fechar();
            })
          : {
              id: "apagar",
              rotulo: "Apagar…",
              perigo: true,
              motivo: "Só uma pasta vazia pode ser apagada.",
              aoClicar: () => {},
            },
      ],
    };
  }

  const menuAtual = menu ? itensDoMenu(menu) : null;

  return (
    <div
      className="aba-fichas"
      data-testid="aba-fichas-conteudo"
      onPointerDownCapture={() => {
        abriuNoTeclado.current = 0;
      }}
    >
      <section className="fichas-pastas">
        {euMestre && (
          <div className="fichas-barra">
            <span className="novo-area">
              <button
                type="button"
                data-popover-gatilho=""
                data-testid="ficha-novo"
                aria-expanded={novoAberto}
                aria-haspopup="menu"
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
                    <User size={14} /> Personagem
                  </button>
                  <button
                    type="button"
                    className="item-menu"
                    data-testid="ficha-novo-npc"
                    onClick={() => criarItem(true)}
                  >
                    <Users size={14} /> NPC
                  </button>
                  <button
                    type="button"
                    className="item-menu"
                    data-testid="ficha-novo-handout"
                    onClick={criarHandout}
                  >
                    <ScrollText size={14} /> Handout
                  </button>
                  <button
                    type="button"
                    className="item-menu"
                    data-testid="ficha-nova-pasta"
                    onClick={criarPasta}
                  >
                    <FolderPlus size={14} /> Pasta
                  </button>
                </Popover>
              )}
            </span>
          </div>
        )}

        {pastas.map((pasta) => (
          <SecaoDaPasta
            key={pasta.id}
            pasta={pasta}
            personagens={estado.personagens.filter((p) => p.pastaId === pasta.id)}
            handouts={estado.handouts.filter((h) => h.pastaId === pasta.id)}
            eu={eu}
            jogadores={jogadores}
            aberta={!recolhidas.has(pasta.id)}
            imagens={imagens}
            versao={versaoDasImagens}
            enviar={enviar}
            aoAlternar={() => alternar(pasta.id)}
            aoAbrirItem={(id) => aoAbrirFicha(id)}
            aoAbrirHandout={aoAbrirHandout}
            aoSoltar={moverParaPasta}
            aoMenu={abrirMenu}
            renomear={pedidoDeRenomear.id === pasta.id ? pedidoDeRenomear.n : 0}
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
                  aoMenu={(x, y, teclado) =>
                    abrirMenu({ tipo: "personagem", id: p.id }, x, y, teclado)
                  }
                />
              ))}
            </ul>
          </section>
        )}
        {pastas.length === 0 && avulsos.length === 0 && (
          <p className="nota">Nada para você aqui ainda.</p>
        )}
      </section>
      {menu && menuAtual && (
        <MenuDeContexto
          testid="menu-ficha"
          titulo={menuAtual.titulo}
          x={menu.x}
          y={menu.y}
          teclado={menu.teclado}
          itens={menuAtual.itens}
          aoFechar={() => {
            setMenu(null);
            setApagando(null);
          }}
        />
      )}
    </div>
  );
}
