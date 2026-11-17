import { type Cena, cenaEhCartao, type Estado } from "@tabletop/shared";
import {
  Copy,
  Eye,
  FileDown,
  Flag,
  Map as IconeMapa,
  PackageCheck,
  Plus,
  RectangleHorizontal,
  Search,
  Settings2,
  Trash2,
  UsersRound,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { dentroDaArea } from "./area";
import { ConfigurarCena } from "./ConfigurarCena";
import { SeloDeRascunho } from "./claude/RascunhosDoClaude";
import { filtrarCenas } from "./filtroDeCenas";
import type { ImagensDoMapa } from "./mapa/mapaPixi";
import { useFecharFora } from "./Popover";
import { previaDoMapa } from "./previaDaCena";
import { useDialogo } from "./useDialogo";
import type { ProgressoDePreparo } from "./useSala";

type Enviar = (tipo: string, dados: object) => string | null;
export type PedirImagem = (
  titulo: string,
  tipo: "mapa" | "token" | "retrato",
  aoUsar: (hash: string) => void,
) => void;

type Props = {
  estado: Estado;
  /** A cena que o mestre está olhando (estado local da tela dele). */
  cenaVistaId: string;
  preparos: ProgressoDePreparo[];
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  enviar: Enviar;
  /** O mestre passa a ver a cena (não move ninguém). */
  aoIrPara: (cenaId: string) => void;
  aoLevarGrupo: (cenaId: string) => void;
  /** Cifra e envia o preparo; devolve uma mensagem de erro, ou `null` se deu certo. */
  aoPreparar: (cenaId: string) => Promise<string | null>;
  /** Q3: importa um mapa do Dungeondraft (Universal VTT) como cena nova. */
  aoImportarMapa: (arquivo: File) => void;
  pedirImagem: PedirImagem;
  /** Q7: clicar fora do painel (ou Esc na busca vazia) fecha o painel. */
  aoFechar: () => void;
  /** Q7: cliques fora do painel que NÃO o fecham (por exemplo, agarrar a bandeira de chegada no mapa). */
  naoFechaEm?: (e: PointerEvent) => boolean;
};

/** Q7: o que, fora do painel, não conta como "clicar fora": o botão da barra, menus e diálogos. */
const FORA_QUE_NAO_FECHA =
  '[data-testid="menu-cenas"], [role="menu"], [role="dialog"], [role="alertdialog"], .fundo-modal';

/** Prévia do mapa em baixa resolução; sem mapa (ou enquanto não chega), um padrão de grid. */
function Previa({
  cena,
  imagens,
  versao,
}: {
  cena: Cena;
  imagens: ImagensDoMapa | null;
  versao: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const hash = cena.mapa?.assetHash;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a versão avisa que o cache mudou
  useEffect(() => {
    if (!hash || !imagens) {
      setUrl(null);
      return;
    }
    let cancelado = false;
    previaDoMapa(imagens, hash).then((u) => !cancelado && setUrl(u));
    return () => {
      cancelado = true;
    };
  }, [hash, imagens, versao]);
  return url ? (
    <img className="previa-mapa" src={url} alt="" data-testid={`cena-previa-${cena.id}`} />
  ) : (
    <div className="previa-grid" data-testid={`cena-previa-grid-${cena.id}`} />
  );
}

type ItemDeMenu = {
  id: string;
  rotulo: string;
  icone: ReactNode;
  desabilitado?: boolean;
  dica?: string | undefined;
  perigo?: boolean;
  aoClicar: () => void;
};

/** Menu de contexto: painel escuro arredondado, uma linha por opção (ícone e rótulo). */
function MenuDeContexto({
  x,
  y,
  itens,
  aoFechar,
}: {
  x: number;
  y: number;
  itens: ItemDeMenu[];
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  return (
    <div
      ref={ref}
      className="menu-contexto"
      role="menu"
      data-testid="menu-cena"
      style={{ left: x, top: y }}
    >
      {itens.map((i) => (
        <button
          key={i.id}
          type="button"
          role="menuitem"
          className={i.perigo ? "item-menu perigo" : "item-menu"}
          data-testid={`menu-cena-${i.id}`}
          disabled={i.desabilitado}
          title={i.dica ? `${i.rotulo} — ${i.dica}` : undefined}
          onClick={() => {
            aoFechar();
            i.aoClicar();
          }}
        >
          {i.icone}
          <span>{i.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

function Confirmacao({
  cena,
  aoConfirmar,
  aoCancelar,
}: {
  cena: Cena;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const nivel = useDialogo(caixa, aoCancelar);
  return (
    <div className="fundo-modal" style={{ zIndex: 80 + nivel }}>
      <div
        ref={caixa}
        className="modal modal-pequeno"
        role="alertdialog"
        aria-label="Apagar cena"
        data-testid="confirmar-apagar-cena"
      >
        <strong>Apagar a cena “{cena.nome}”?</strong>
        <p className="nota">Os tokens dela também serão apagados. Isso não pode ser desfeito.</p>
        <div className="linha-botoes fim">
          <button type="button" data-testid="confirmar-apagar-cena-nao" onClick={aoCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="perigo"
            data-testid="confirmar-apagar-cena-sim"
            onClick={aoConfirmar}
          >
            <Trash2 size={16} /> Apagar
          </button>
        </div>
      </div>
    </div>
  );
}

type PropsCard = {
  cena: Cena;
  numero: number;
  doGrupo: boolean;
  vista: boolean;
  preparo: ProgressoDePreparo | undefined;
  mensagem: string | null;
  imagens: ImagensDoMapa | null;
  versaoDasImagens: number;
  aoClicar: () => void;
  aoRenomear: (nome: string) => void;
  aoMenu: (x: number, y: number) => void;
};

function Card({
  cena,
  numero,
  doGrupo,
  vista,
  preparo,
  mensagem,
  imagens,
  versaoDasImagens,
  aoClicar,
  aoRenomear,
  aoMenu,
}: PropsCard) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(cena.nome);
  useEffect(() => setNome(cena.nome), [cena.nome]);

  function confirmar() {
    setEditando(false);
    const limpo = nome.trim();
    if (limpo && limpo !== cena.nome) aoRenomear(limpo);
    else setNome(cena.nome);
  }

  const textoDoPreparo = preparo
    ? `Preparada: ${preparo.hashesOriginais.length} ${preparo.hashesOriginais.length === 1 ? "arquivo" : "arquivos"} · ${preparo.completos} de ${preparo.jogadores} jogadores já têm tudo`
    : "";

  return (
    <li
      className="cena-card"
      data-testid="cena-card"
      data-cena-id={cena.id}
      data-do-grupo={doGrupo}
      data-vista={vista}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        aoMenu(r.right + 6, r.top);
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: o cartão inteiro é o alvo; o menu de contexto dá as ações */}
      <div
        className="cena-card-corpo"
        role="button"
        tabIndex={0}
        aria-label={`Cena ${numero}: ${cena.nome}`}
        onClick={aoClicar}
        onKeyDown={(e) => e.key === "Enter" && !editando && aoClicar()}
      >
        <div className="cena-card-titulo">
          <span className="cena-numero" data-testid={`cena-numero-${cena.id}`}>
            {numero}
          </span>
          {editando ? (
            <input
              className="cena-nome-campo"
              aria-label={`Nome da cena ${cena.nome}`}
              data-testid={`cena-nome-editar-${cena.id}`}
              value={nome}
              maxLength={64}
              // biome-ignore lint/a11y/noAutofocus: o campo nasce do duplo clique
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNome(e.target.value)}
              onBlur={confirmar}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setNome(cena.nome);
                  setEditando(false);
                }
              }}
            />
          ) : (
            // biome-ignore lint/a11y/noStaticElementInteractions: o duplo clique é um atalho; o menu tem Configurar…
            <span
              className="cena-nome"
              title={cena.nome}
              data-testid={`cena-nome-${cena.id}`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditando(true);
              }}
            >
              {cena.nome}
            </span>
          )}
          {cena.rascunho && <SeloDeRascunho testid={`cena-rascunho-${cena.id}`} />}
          {doGrupo && (
            <span
              className="marca-grupo"
              data-testid={`cena-grupo-${cena.id}`}
              title="O grupo está aqui"
              role="img"
              aria-label="O grupo está aqui"
            >
              <Flag size={14} />
            </span>
          )}
          {vista && (
            <span
              className="marca-vista"
              data-testid={`cena-vista-${cena.id}`}
              title="Você está vendo esta cena"
              role="img"
              aria-label="Você está vendo esta cena"
            >
              <Eye size={14} />
            </span>
          )}
        </div>
        <div className="cena-card-previa">
          <Previa cena={cena} imagens={imagens} versao={versaoDasImagens} />
          {cenaEhCartao(cena) && (
            <span
              className="marca-cartao"
              data-testid={`cena-cartao-${cena.id}`}
              title="Cena como cartão"
              role="img"
              aria-label="Cena como cartão"
            >
              <RectangleHorizontal size={14} />
            </span>
          )}
          {preparo && (
            <div
              className="cena-progresso"
              data-testid={`cena-progresso-${cena.id}`}
              title={textoDoPreparo}
            >
              <progress value={preparo.completos} max={Math.max(1, preparo.jogadores)} />
              <span>
                {preparo.completos}/{preparo.jogadores} · {preparo.hashesOriginais.length}{" "}
                {preparo.hashesOriginais.length === 1 ? "arquivo" : "arquivos"}
              </span>
            </div>
          )}
          {mensagem && (
            <p className="cena-mensagem" role="status" data-testid={`cena-mensagem-${cena.id}`}>
              {mensagem}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Faixa de cenas (menu superior → Cenas): um card por cena, na ordem, com número, nome e prévia do
 * mapa. Botão direito abre o menu da cena; duplo clique no nome renomeia.
 */
export function FaixaDeCenas({
  estado,
  cenaVistaId,
  preparos,
  imagens,
  versaoDasImagens,
  enviar,
  aoIrPara,
  aoLevarGrupo,
  aoPreparar,
  aoImportarMapa,
  pedirImagem,
  aoFechar,
  naoFechaEm,
}: Props) {
  const raiz = useRef<HTMLElement>(null);
  const [busca, setBusca] = useState("");
  const entradaUvtt = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<{ cenaId: string | null; x: number; y: number } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Record<string, string | null>>({});
  const [preparando, setPreparando] = useState<Set<string>>(new Set());

  const cenaDoMenu = estado.cenas.find((c) => c.id === menu?.cenaId);
  const aoFecharRef = useRef(aoFechar);
  aoFecharRef.current = aoFechar;
  const naoFechaEmRef = useRef(naoFechaEm);
  naoFechaEmRef.current = naoFechaEm;
  const algoAbertoRef = useRef(false);
  algoAbertoRef.current = apagando !== null || configurando !== null;

  // Q7: clicar fora do painel fecha. Não conta: o botão da barra que o abre (ele alterna), menus e diálogos
  // (os do painel e o seletor de arquivo que a configuração abre).
  useEffect(() => {
    function aoApertar(e: PointerEvent) {
      const alvo = e.target;
      if (!(alvo instanceof Element) || !raiz.current || raiz.current.contains(alvo)) return;
      if (algoAbertoRef.current) return;
      if (alvo.closest(FORA_QUE_NAO_FECHA)) return;
      if (naoFechaEmRef.current?.(e)) return;
      aoFecharRef.current();
    }
    document.addEventListener("pointerdown", aoApertar, true);
    return () => document.removeEventListener("pointerdown", aoApertar, true);
  }, []);

  const cenasVisiveis = filtrarCenas(estado.cenas, busca);
  const cenaApagando = estado.cenas.find((c) => c.id === apagando);
  const cenaConfigurando = estado.cenas.find((c) => c.id === configurando);

  async function preparar(cenaId: string) {
    setPreparando((s) => new Set(s).add(cenaId));
    setMensagens((m) => ({ ...m, [cenaId]: "Preparando…" }));
    const erro = await aoPreparar(cenaId);
    setMensagens((m) => ({ ...m, [cenaId]: erro }));
    setPreparando((s) => {
      const novo = new Set(s);
      novo.delete(cenaId);
      return novo;
    });
  }

  function itensDe(cena: Cena): ItemDeMenu[] {
    const doGrupo = cena.id === estado.cenaAtivaId;
    return [
      {
        id: "ir",
        rotulo: "Ir para",
        icone: <Eye size={16} />,
        desabilitado: cena.id === cenaVistaId,
        dica: cena.id === cenaVistaId ? "Você já está vendo esta cena" : undefined,
        aoClicar: () => aoIrPara(cena.id),
      },
      {
        id: "levar",
        rotulo: "Levar grupo",
        icone: <UsersRound size={16} />,
        desabilitado: doGrupo,
        dica: doGrupo ? "O grupo já está aqui" : undefined,
        aoClicar: () => aoLevarGrupo(cena.id),
      },
      {
        id: "duplicar",
        rotulo: "Duplicar",
        icone: <Copy size={16} />,
        aoClicar: () =>
          enviar("cena.duplicar", {
            cenaId: cena.id,
            novoId: `cena-${crypto.randomUUID().slice(0, 8)}`,
          }),
      },
      {
        id: "preparar",
        rotulo: "Preparar",
        icone: <PackageCheck size={16} />,
        desabilitado: doGrupo || preparando.has(cena.id),
        dica: doGrupo
          ? "O grupo já está aqui"
          : "Envia os arquivos da cena, cifrados, aos jogadores antes de levar o grupo",
        aoClicar: () => void preparar(cena.id),
      },
      {
        id: "cartao",
        rotulo: cenaEhCartao(cena) ? "Voltar a ser mapa" : "Transformar em cartão",
        icone: cenaEhCartao(cena) ? <IconeMapa size={16} /> : <RectangleHorizontal size={16} />,
        dica: cenaEhCartao(cena)
          ? "Volta a valer a luz, a visão e as paredes"
          : "Mostra a imagem inteira, sem luz nem visão",
        aoClicar: () => enviar("cena.editar", { cenaId: cena.id, cartao: !cenaEhCartao(cena) }),
      },
      {
        id: "configurar",
        rotulo: "Configurar…",
        icone: <Settings2 size={16} />,
        aoClicar: () => setConfigurando(cena.id),
      },
      {
        id: "apagar",
        rotulo: "Apagar",
        icone: <Trash2 size={16} />,
        perigo: true,
        desabilitado: doGrupo,
        dica: doGrupo ? "A cena onde está o grupo não pode ser apagada" : undefined,
        aoClicar: () => setApagando(cena.id),
      },
    ];
  }

  function criarCena() {
    enviar("cena.criar", {
      id: `cena-${crypto.randomUUID().slice(0, 8)}`,
      nome: `Cena ${estado.cenas.length + 1}`,
    });
  }

  /** Q7: o menu do espaço vazio da grade: criar ou importar (o que os dois últimos cards fazem). */
  const itensDoVazio: ItemDeMenu[] = [
    { id: "nova", rotulo: "Nova cena", icone: <Plus size={16} />, aoClicar: criarCena },
    {
      id: "importar",
      rotulo: "Importar mapa — Dungeondraft / Universal VTT…",
      icone: <FileDown size={16} />,
      aoClicar: () => entradaUvtt.current?.click(),
    },
  ];

  function menuPorTeclado(e: KeyboardEvent) {
    if (!(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return;
    if (e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    const alvo = e.target instanceof Element ? e.target : null;
    const card = alvo?.closest<HTMLElement>(".cena-card[data-cena-id]");
    if (card) {
      const r = card.getBoundingClientRect();
      setMenu({
        cenaId: card.dataset.cenaId ?? null,
        x: dentroDaArea(r.right + 6, r.top, 192, 0).left,
        y: r.top,
      });
      return;
    }
    const r = (alvo ?? e.currentTarget).getBoundingClientRect();
    const p = dentroDaArea(r.left + 12, r.top + 12, 340, 90);
    setMenu({ cenaId: null, x: p.left, y: p.top });
  }

  return (
    <section
      ref={raiz}
      className="faixa-cenas"
      data-testid="faixa-cenas"
      aria-label="Cenas"
      onKeyDown={menuPorTeclado}
    >
      <label className="faixa-busca">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          data-testid="cenas-busca"
          placeholder="Buscar cena…"
          aria-label="Buscar cena"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            if (busca !== "") setBusca("");
            else aoFechar();
          }}
        />
      </label>
      <ul
        className="faixa-lista"
        data-testid="faixa-lista"
        onContextMenu={(e) => {
          if (e.target instanceof HTMLInputElement) return;
          e.preventDefault();
          const p = dentroDaArea(e.clientX, e.clientY, 340, 90);
          setMenu({ cenaId: null, x: p.left, y: p.top });
        }}
      >
        {cenasVisiveis.length === 0 && (
          <li className="faixa-sem-resultado" data-testid="cenas-sem-resultado" role="status">
            Nenhuma cena com esse nome
          </li>
        )}
        {cenasVisiveis.map((c) => {
          const i = estado.cenas.indexOf(c);
          return (
            <Card
              key={c.id}
              cena={c}
              numero={i + 1}
              doGrupo={c.id === estado.cenaAtivaId}
              vista={c.id === cenaVistaId}
              preparo={preparos.find((p) => p.cenaId === c.id)}
              mensagem={mensagens[c.id] ?? null}
              imagens={imagens}
              versaoDasImagens={versaoDasImagens}
              aoClicar={() => aoIrPara(c.id)}
              aoRenomear={(nome) => enviar("cena.editar", { cenaId: c.id, nome })}
              aoMenu={(x, y) => setMenu({ cenaId: c.id, x: dentroDaArea(x, y, 192, 0).left, y })}
            />
          );
        })}
        <li className="cena-card nova">
          <button
            type="button"
            className="cena-card-nova"
            data-testid="cena-nova"
            onClick={criarCena}
          >
            <Plus size={22} />
            <span>Nova cena</span>
          </button>
        </li>
        <li className="cena-card nova">
          <button
            type="button"
            className="cena-card-nova"
            data-testid="cena-importar-uvtt"
            aria-label="Importar mapa (Dungeondraft / Universal VTT)…"
            title="Importar mapa (Dungeondraft / Universal VTT)…"
            onClick={() => entradaUvtt.current?.click()}
          >
            <FileDown size={22} />
            <span>Importar mapa</span>
            <small>Dungeondraft / Universal VTT…</small>
          </button>
          <input
            ref={entradaUvtt}
            type="file"
            hidden
            accept=".dd2vtt,.uvtt,.df2vtt,.json"
            data-testid="cena-importar-uvtt-arquivo"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) aoImportarMapa(arquivo);
            }}
          />
        </li>
      </ul>
      {menu && (menu.cenaId === null || cenaDoMenu) && (
        <MenuDeContexto
          x={menu.x}
          y={menu.y}
          itens={cenaDoMenu ? itensDe(cenaDoMenu) : itensDoVazio}
          aoFechar={() => setMenu(null)}
        />
      )}
      {cenaApagando && (
        <Confirmacao
          cena={cenaApagando}
          aoCancelar={() => setApagando(null)}
          aoConfirmar={() => {
            enviar("cena.apagar", { cenaId: cenaApagando.id });
            setApagando(null);
          }}
        />
      )}
      {cenaConfigurando && (
        <ConfigurarCena
          cena={cenaConfigurando}
          enviar={enviar}
          pedirImagem={pedirImagem}
          aoFechar={() => setConfigurando(null)}
        />
      )}
    </section>
  );
}
