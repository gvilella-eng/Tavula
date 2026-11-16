import { normalizarIdDeMesa } from "@tabletop/shared";
import { useEffect, useState } from "react";

/**
 * Roteador mínimo (C1, sem biblioteca): `/` é a tela inicial e `/m/<id>` é uma mesa. Qualquer outro
 * caminho cai na tela inicial. O `id` é `null` quando o que veio depois de `/m/` não é um id de mesa.
 */
export type Rota =
  | { tipo: "inicio" }
  /** `fichaId` (V9): `/m/<id>/ficha/<fichaId>` mostra só a ficha, na janela própria do navegador. */
  | { tipo: "mesa"; id: string | null; bruto: string; fichaId?: string; painel?: "som" };

const decodificar = (texto: string): string => {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto; // fica o texto como veio
  }
};

export function lerRota(caminho: string): Rota {
  const m = /^\/m\/([^/]+)(?:\/ficha\/([^/]+)|\/(som))?\/?$/.exec(caminho);
  if (!m) return { tipo: "inicio" };
  const bruto = decodificar(m[1] ?? "");
  const fichaId = m[2] === undefined ? undefined : decodificar(m[2]);
  return {
    tipo: "mesa",
    id: normalizarIdDeMesa(bruto),
    bruto,
    ...(fichaId ? { fichaId } : {}),
    ...(m[3] === "som" ? { painel: "som" as const } : {}),
  };
}

export const caminhoDaMesa = (id: string) => `/m/${id}`;

/** A rota da ficha na janela própria (V9). */
export const caminhoDaFicha = (mesaId: string, fichaId: string) =>
  `/m/${mesaId}/ficha/${encodeURIComponent(fichaId)}`;

/** A rota da mesa de som na janela própria (Q4b). */
export const caminhoDoSom = (mesaId: string) => `/m/${mesaId}/som`;

/** O link completo de uma mesa, para copiar e mandar. */
export const linkDaMesa = (id: string) => `${location.origin}${caminhoDaMesa(id)}`;

const EVENTO = "tabletop:rota";

/** Vai para outro caminho sem recarregar a página. */
export function irPara(caminho: string, substituir = false): void {
  if (substituir) history.replaceState(null, "", caminho);
  else history.pushState(null, "", caminho);
  window.dispatchEvent(new Event(EVENTO));
}

/** A rota atual; atualiza com `irPara` e com os botões de voltar e avançar do navegador. */
export function useRota(): Rota {
  const [caminho, setCaminho] = useState(() => location.pathname);
  useEffect(() => {
    const atualizar = () => setCaminho(location.pathname);
    window.addEventListener("popstate", atualizar);
    window.addEventListener(EVENTO, atualizar);
    return () => {
      window.removeEventListener("popstate", atualizar);
      window.removeEventListener(EVENTO, atualizar);
    };
  }, []);
  return lerRota(caminho);
}

/** O título da aba do navegador: "Távola" ou "Távola · nome da mesa". */
export const tituloDaMesa = (nome?: string) => (nome ? `Távola · ${nome}` : "Távola");
