import { useEffect, useSyncExternalStore } from "react";
import { caminhoDaFicha } from "../rotas";

/**
 * A ficha numa janela própria do navegador (V9). A mesa (janela principal) e as janelas das fichas se falam só por
 * este arquivo, na mesma origem, sem passar pela sala:
 *
 * - `BroadcastChannel` por mesa: a janela da ficha avisa "aberta" e "fechada"; a principal pergunta "quais" ao
 *   carregar.
 * - Web Locks: a janela da ficha segura um lock com o nome dela enquanto existe. O navegador solta o lock até
 *   quando a janela morre sem avisar, então a principal confere `navigator.locks.query()` de tempos em tempos e
 *   nunca fica com uma ficha "fora" que já fechou. Sem Web Locks (endereço sem HTTPS), vale só o aviso do canal.
 *
 * Nada disso vai para a sala, e a janela da ficha não conta como presença: a sala junta as conexões por usuário.
 */

const PREFIXO_DO_LOCK = "tabletop:ficha-fora:";
const PREFIXO_DA_PREFERENCIA = "tabletop:pref:janela-ficha:";
/** Depois de pedir a janela, a ficha já conta como "fora" por este tempo, até a janela avisar que abriu. */
const GRACA_MS = 6_000;
const CONFERIR_A_CADA_MS = 1_000;

export const nomeDoLock = (mesaId: string, fichaId: string) =>
  `${PREFIXO_DO_LOCK}${mesaId}:${fichaId}`;

/** O nome da janela do navegador: fixo por mesa e ficha (abrir de novo reaproveita a mesma janela). */
export const nomeDaJanela = (mesaId: string, fichaId: string) =>
  `tabletop-ficha-${mesaId}-${fichaId}`.replace(/[^A-Za-z0-9_-]/g, "_");

const nomeDoCanal = (mesaId: string) => `tabletop:fichas-fora:${mesaId}`;

type Mensagem = { t: "aberta" | "fechada"; fichaId: string } | { t: "quais" };

function criarCanal(mesaId: string): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(nomeDoCanal(mesaId));
  } catch {
    return null;
  }
}

// --- a lista das fichas que estão fora (um repositório só, lido pela mesa) ---------------------------

let fora: ReadonlySet<string> = new Set();
const ouvintes = new Set<() => void>();

function definir(novo: ReadonlySet<string>): void {
  if (novo.size === fora.size && [...novo].every((id) => fora.has(id))) return;
  fora = novo;
  for (const o of ouvintes) o();
}

/** Os ids das fichas que estão numa janela própria agora. Muda só quando a lista muda. */
export function useFichasFora(): ReadonlySet<string> {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar);
      return () => ouvintes.delete(aoMudar);
    },
    () => fora,
  );
}

const graca = new Map<string, number>();

/** A mesa acompanha as fichas fora enquanto está montada (chame uma vez, na `Mesa`). */
export function useAcompanharFichasFora(mesaId: string): void {
  useEffect(() => {
    let vivo = true;
    const pelosAvisos = new Set<string>();
    let pelosLocks: Set<string> | null = null;
    const temLocks = typeof navigator !== "undefined" && "locks" in navigator;

    const recalcular = () => {
      const agora = Date.now();
      const lista = new Set<string>(pelosLocks ?? pelosAvisos);
      for (const [id, ate] of graca) {
        if (ate > agora) lista.add(id);
        else graca.delete(id);
      }
      definir(lista);
    };

    const canal = criarCanal(mesaId);
    if (canal) {
      canal.onmessage = (e: MessageEvent<Mensagem>) => {
        const m = e.data;
        if (m.t === "aberta") {
          pelosAvisos.add(m.fichaId);
          pelosLocks?.add(m.fichaId);
          graca.delete(m.fichaId);
        } else if (m.t === "fechada") {
          pelosAvisos.delete(m.fichaId);
          pelosLocks?.delete(m.fichaId);
          graca.delete(m.fichaId);
        } else return;
        recalcular();
      };
      canal.postMessage({ t: "quais" } satisfies Mensagem);
    }

    const prefixo = nomeDoLock(mesaId, "");
    const conferir = async () => {
      if (temLocks) {
        try {
          const q = await navigator.locks.query();
          if (!vivo) return;
          pelosLocks = new Set(
            (q.held ?? [])
              .map((l) => l.name ?? "")
              .filter((n) => n.startsWith(prefixo))
              .map((n) => n.slice(prefixo.length)),
          );
        } catch {
          pelosLocks = null;
        }
      }
      recalcular();
    };
    void conferir();
    const relogio = setInterval(() => void conferir(), CONFERIR_A_CADA_MS);

    return () => {
      vivo = false;
      clearInterval(relogio);
      canal?.close();
      graca.clear();
      definir(new Set());
    };
  }, [mesaId]);
}

// --- a janela principal: abrir e trazer para a frente ---------------------------------------------

export type MedidaDaJanela = { largura: number; altura: number; x?: number; y?: number };

/** O que a janela da ficha lembrou (tamanho de dentro e posição na tela), por mesa e ficha. */
export function lerMedidaGuardada(mesaId: string, fichaId: string): MedidaDaJanela | null {
  try {
    const bruto = localStorage.getItem(`${PREFIXO_DA_PREFERENCIA}${mesaId}:${fichaId}`);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as Record<string, unknown> | null;
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : null);
    const largura = n(v?.largura);
    const altura = n(v?.altura);
    if (largura === null || altura === null) return null;
    const x = n(v?.x);
    const y = n(v?.y);
    return { largura, altura, ...(x !== null && y !== null ? { x, y } : {}) };
  } catch {
    return null;
  }
}

export function guardarMedida(mesaId: string, fichaId: string, m: MedidaDaJanela): void {
  try {
    localStorage.setItem(`${PREFIXO_DA_PREFERENCIA}${mesaId}:${fichaId}`, JSON.stringify(m));
  } catch {
    // sem localStorage: a próxima abertura usa o tamanho da ficha
  }
}

export const TEXTO_DO_POPUP_BLOQUEADO =
  "O navegador bloqueou a janela. Libere as janelas pop-up para este endereço.";

/**
 * Abre a ficha numa janela do navegador (`popup`), do tamanho da ficha ou do que a própria janela lembrou. Devolve
 * `false` se o navegador bloqueou. Se a janela já existe, só a traz para a frente (mesmo nome).
 */
export function abrirFichaEmJanela(
  mesaId: string,
  fichaId: string,
  medidaDaFicha: MedidaDaJanela,
): boolean {
  const medida = lerMedidaGuardada(mesaId, fichaId) ?? medidaDaFicha;
  const partes = [
    "popup=yes",
    `width=${Math.max(360, Math.round(medida.largura))}`,
    `height=${Math.max(300, Math.round(medida.altura))}`,
  ];
  if (medida.x !== undefined && medida.y !== undefined) {
    partes.push(`left=${medida.x}`, `top=${medida.y}`);
  }
  const janela = window.open(
    caminhoDaFicha(mesaId, fichaId),
    nomeDaJanela(mesaId, fichaId),
    partes.join(","),
  );
  if (!janela) return false;
  graca.set(fichaId, Date.now() + GRACA_MS);
  definir(new Set([...fora, fichaId]));
  try {
    janela.focus();
  } catch {
    // o navegador pode negar o foco
  }
  return true;
}

/**
 * Traz a janela de uma ficha que está fora para a frente. `false` se ela não existe mais (a marca estava velha):
 * quem chama tira a ficha da lista e abre na mesa.
 */
export function trazerFichaDeFora(mesaId: string, fichaId: string): boolean {
  const janela = window.open("", nomeDaJanela(mesaId, fichaId));
  if (!janela) return false;
  try {
    if (janela.location.href === "about:blank") {
      janela.close();
      graca.delete(fichaId);
      definir(new Set([...fora].filter((id) => id !== fichaId)));
      return false;
    }
  } catch {
    // outra origem: a janela existe, só não dá para olhar dentro dela
  }
  janela.focus();
  return true;
}

// --- a janela da ficha: segurar o lock e avisar ----------------------------------------------------

/**
 * Chamado pela janela da ficha enquanto ela existe: segura o lock, avisa "aberta" (depois de o ter), responde ao
 * "quais" da mesa e avisa "fechada" ao sair. Devolve a função que encerra.
 */
export function anunciarFichaFora(mesaId: string, fichaId: string): () => void {
  let encerrado = false;
  let soltar: (() => void) | null = null;
  const canal = criarCanal(mesaId);
  const avisarAberta = () => canal?.postMessage({ t: "aberta", fichaId } satisfies Mensagem);
  let seguro = false;
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    void navigator.locks
      .request(nomeDoLock(mesaId, fichaId), () => {
        if (encerrado) return undefined;
        seguro = true;
        avisarAberta();
        return new Promise<void>((resolve) => {
          soltar = resolve;
        });
      })
      .catch(() => {});
  } else {
    seguro = true;
    avisarAberta();
  }
  if (canal) {
    canal.onmessage = (e: MessageEvent<Mensagem>) => {
      if (e.data.t === "quais" && seguro) avisarAberta();
    };
  }
  const avisarFechada = () => canal?.postMessage({ t: "fechada", fichaId } satisfies Mensagem);
  window.addEventListener("pagehide", avisarFechada);
  return () => {
    encerrado = true;
    window.removeEventListener("pagehide", avisarFechada);
    avisarFechada();
    soltar?.();
    canal?.close();
  };
}
