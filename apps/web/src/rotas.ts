import { normalizarIdDeMesa } from "@tabletop/shared";
import { useEffect, useState } from "react";

/**
 * Roteador mínimo (C1, sem biblioteca): `/` é a tela inicial e `/m/<id>` é uma mesa. Qualquer outro
 * caminho cai na tela inicial. O `id` é `null` quando o que veio depois de `/m/` não é um id de mesa.
 */
export type Rota = { tipo: "inicio" } | { tipo: "mesa"; id: string | null; bruto: string };

export function lerRota(caminho: string): Rota {
  const m = /^\/m\/([^/]+)\/?$/.exec(caminho);
  if (!m) return { tipo: "inicio" };
  let bruto = m[1] ?? "";
  try {
    bruto = decodeURIComponent(bruto);
  } catch {
    // fica o texto como veio
  }
  return { tipo: "mesa", id: normalizarIdDeMesa(bruto), bruto };
}

export const caminhoDaMesa = (id: string) => `/m/${id}`;

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
