import {
  derivar,
  type Personagem,
  type Token,
  vidaDoToken as vidaDoTokenNaMesa,
} from "@tabletop/shared";
import { Heart, Shield, Skull } from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import type { MapaPixi } from "./mapa/mapaPixi";
import { haDialogoAberto } from "./useDialogo";
import { deltaDaVidaEmLote, mudancasDaVidaDoToken, operacoesDaVida } from "./vidaDoToken";

type Props = {
  mapa: RefObject<MapaPixi | null>;
  token: Token;
  personagem: Personagem;
  enviar: (tipo: string, dados: object) => string | null;
  /** Um clique na CA abre a ficha do personagem. */
  aoAbrirFicha: (personagemId: string, aba?: undefined, tokenId?: string) => void;
  /** Q11: os ids da seleção quando há mais de um token selecionado (mestre): a vida vira dano ou cura em lote. */
  idsEmLote?: string[] | undefined;
};

/** Folga (px) entre a borda do token e as marcas, para não cobrir as tochas dos cantos de cima. */
const FOLGA = 10;

/**
 * N1: vida atual (editável) e CA em cima do token selecionado, com o botão de "morto". Só aparece para quem
 * controla o token e para o mestre (a `Mesa` decide), e só se o token tem ficha. Acompanha o token ao mover, ao
 * dar zoom e ao arrastar o mapa (lê a posição a cada quadro, sem re-renderizar). A vida grava na ficha pelo
 * `ficha.alterar` de sempre; o X de "morto" é a `token.condicoes` com `morto`.
 */
export function MarcasDoToken({ mapa, token, personagem, enviar, aoAbrirFicha, idsEmLote }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const ficha = personagem.ficha;
  // Q10: a vida que vale para ESTE token (a própria, num NPC de horda; senão a da ficha).
  const vida = vidaDoTokenNaMesa(token, personagem);

  // Segue o token a cada quadro: posição direto no estilo, dentro da área do mapa.
  const tokenId = token.id;
  useEffect(() => {
    let quadro = 0;
    // O último valor escrito no estilo: só se escreve quando muda, para o mapa parado não invalidar o layout a cada quadro.
    let elEscrito: HTMLElement | null = null;
    let esq = "";
    let topo = "";
    let visib = "";
    const seguir = () => {
      const el = raiz.current;
      const pai = el?.offsetParent;
      const onde = mapa.current?.tokenNaTela(tokenId) ?? null;
      if (el && pai instanceof HTMLElement) {
        if (el !== elEscrito) {
          elEscrito = el;
          esq = "";
          topo = "";
          visib = "";
        }
        if (!onde) {
          if (visib !== "hidden") el.style.visibility = visib = "hidden";
        } else {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const x = Math.min(Math.max(onde.x, w / 2 + 4), pai.clientWidth - w / 2 - 4);
          const y = Math.max(onde.y - onde.raio - FOLGA, h + 4);
          const novoEsq = `${Math.round(x)}px`;
          const novoTopo = `${Math.round(y)}px`;
          if (novoEsq !== esq) el.style.left = esq = novoEsq;
          if (novoTopo !== topo) el.style.top = topo = novoTopo;
          if (visib !== "visible") el.style.visibility = visib = "visible";
        }
      }
      quadro = requestAnimationFrame(seguir);
    };
    quadro = requestAnimationFrame(seguir);
    return () => cancelAnimationFrame(quadro);
  }, [mapa, tokenId]);

  const emLote = idsEmLote !== undefined && idsEmLote.length > 1;
  const abrirEdicao = () => {
    if (!ficha || !vida) return;
    // Q11: com vários selecionados o campo começa vazio: só vale "-7" ou "+3", igual para todos.
    setTexto(emLote ? "" : String(vida.atual));
    setEditando(true);
  };
  // O campo aberto vem selecionado, pronto para digitar por cima.
  useEffect(() => {
    if (editando) {
      campo.current?.focus();
      campo.current?.select();
    }
  }, [editando]);
  // A tecla E abre a edição (como o V10: com o foco no mapa ou em nada, sem diálogo aberto).
  const abrirPelaTecla = useRef(abrirEdicao);
  abrirPelaTecla.current = abrirEdicao;
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (e.defaultPrevented || e.repeat) return;
      const alvo = e.target;
      const noMapa =
        alvo === document.body ||
        (alvo instanceof HTMLElement && alvo.matches("[data-testid='mapa']"));
      if (!noMapa || haDialogoAberto()) return;
      e.preventDefault();
      abrirPelaTecla.current();
    };
    window.addEventListener("keydown", ouvir);
    return () => window.removeEventListener("keydown", ouvir);
  }, []);

  // Só a CA interessa: a derivação completa da ficha roda quando a ficha muda, não a cada render.
  const ca = useMemo(() => (ficha ? derivar(ficha).ca : undefined), [ficha]);

  if (!ficha || !vida) return null;

  function gravar() {
    if (!ficha || !vida) return;
    if (emLote && idsEmLote) {
      // Q11: o mesmo dano ou cura em todos os selecionados, num pedido só (a sala aplica a regra de cada um).
      const delta = deltaDaVidaEmLote(texto);
      if (delta === null) return; // texto inválido: o campo continua aberto
      enviar("tokens.vidaDelta", { ids: idsEmLote, delta });
      setEditando(false);
      return;
    }
    if (vida.propria) {
      // Q10: a vida é do token (horda): o dano num Goblin não toca nos outros nem na ficha.
      const m = mudancasDaVidaDoToken(texto, vida);
      if (m === null) return;
      if (Object.keys(m).length > 0) enviar("token.vida", { id: token.id, ...m });
      setEditando(false);
      return;
    }
    const ops = operacoesDaVida(texto, ficha);
    if (ops === null) return; // texto inválido: o campo continua aberto
    if (ops.length > 0) enviar("ficha.alterar", { personagemId: personagem.id, operacoes: ops });
    setEditando(false);
  }

  const zerou = vida.atual === 0 && token.morto !== true;
  const temp = vida.temp;
  const rotuloDaVida = `Vida ${vida.atual} de ${vida.max}${temp > 0 ? `, mais ${temp} temporários` : ""}`;

  return (
    <div
      ref={raiz}
      className="mvc-marcas"
      data-testid="marcas-do-token"
      data-token-id={token.id}
      style={{ visibility: "hidden" }}
    >
      {editando ? (
        <input
          ref={campo}
          className="mvc-campo"
          data-testid="marca-vida-campo"
          aria-label={
            emLote
              ? `Vida dos ${idsEmLote?.length} selecionados: -7 ou +3`
              : "Vida: valor, -7 ou +3"
          }
          placeholder={emLote ? "-7 ou +3" : undefined}
          inputMode="text"
          maxLength={5}
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => setEditando(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              gravar();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditando(false);
            }
          }}
        />
      ) : (
        <BotaoComDica
          testid="marca-vida"
          className="mvc-marca mvc-vida"
          nome={emLote ? `Vida dos ${idsEmLote?.length} selecionados` : rotuloDaVida}
          atalho="editarVida"
          aria-label={
            emLote
              ? `Vida dos ${idsEmLote?.length} selecionados. Clique para dar dano ou curar todos`
              : `${rotuloDaVida}. Clique para editar`
          }
          onClick={abrirEdicao}
        >
          <Heart size={14} aria-hidden />
          {emLote ? (
            <span data-testid="marca-vida-lote">{idsEmLote?.length} selecionados</span>
          ) : (
            <>
              <span data-testid="marca-vida-valor">{vida.atual}</span>
              {temp > 0 && <span className="mvc-temp">+{temp}</span>}
            </>
          )}
        </BotaoComDica>
      )}
      <BotaoComDica
        testid="marca-ca"
        className="mvc-marca mvc-ca"
        nome={`Classe de armadura ${ca}. Abre a ficha`}
        aria-label={`Classe de armadura ${ca}. Abre a ficha`}
        onClick={() => aoAbrirFicha(personagem.id, undefined, token.id)}
      >
        <Shield size={14} aria-hidden />
        <span data-testid="marca-ca-valor">{ca}</span>
      </BotaoComDica>
      <BotaoComDica
        testid="marca-morto"
        className={`mvc-marca mvc-morto${zerou ? " mvc-destaque" : ""}`}
        nome={token.morto ? "Tirar a marca de morto" : "Marcar como morto"}
        aria-pressed={token.morto === true}
        onClick={() => enviar("token.condicoes", { id: token.id, morto: token.morto !== true })}
      >
        <Skull size={14} aria-hidden />
      </BotaoComDica>
    </div>
  );
}
