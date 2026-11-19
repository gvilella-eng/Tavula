import { useEffect, useState } from "react";

// CH1: a janela da chamada diz à janela da mesa quem está falando agora (o anel verde na presença do topo). Fica no mesmo
// navegador, por `BroadcastChannel`: não passa pela sala e nada é guardado.

const nomeDoCanal = (mesaId: string) => `tabletop:chamada:${mesaId}`;

type Mensagem = { t: "falando"; ids: string[] };

/** A janela da chamada avisa quem fala (chame a cada mudança). */
export function anunciarFalando(mesaId: string, ids: readonly string[]): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const canal = new BroadcastChannel(nomeDoCanal(mesaId));
    canal.postMessage({ t: "falando", ids: [...ids] } satisfies Mensagem);
    canal.close();
  } catch {
    // sem canal: a mesa só não mostra o anel
  }
}

/** A mesa escuta quem está falando na chamada (vazio quando ninguém fala ou a janela da chamada não está aberta). */
export function useFalandoNaChamada(mesaId: string): ReadonlySet<string> {
  const [falando, setFalando] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    let canal: BroadcastChannel;
    try {
      canal = new BroadcastChannel(nomeDoCanal(mesaId));
    } catch {
      return;
    }
    let ultimaMensagem = Date.now();
    canal.onmessage = (e: MessageEvent<Mensagem>) => {
      if (e.data?.t !== "falando" || !Array.isArray(e.data.ids)) return;
      ultimaMensagem = Date.now();
      setFalando(new Set(e.data.ids.filter((x): x is string => typeof x === "string")));
    };
    // A janela da chamada fechou no meio de uma fala: sem aviso por 3 s, o anel apaga.
    const relogio = setInterval(() => {
      if (Date.now() - ultimaMensagem > 3_000) setFalando((a) => (a.size === 0 ? a : new Set()));
    }, 1_000);
    return () => {
      clearInterval(relogio);
      canal.close();
    };
  }, [mesaId]);
  return falando;
}
