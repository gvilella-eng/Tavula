import { atrasoDaTentativa } from "./useSala";

export type UsuarioDaEntrada = { id: string; nome: string; cor: string };

/**
 * A sala não respondeu: ainda está subindo (no `pnpm dev` o Vite fica pronto antes do wrangler) ou
 * caiu. Vale tentar de novo, ao contrário de um 4xx.
 */
export class SalaIndisponivel extends Error {
  constructor() {
    super("A sala não respondeu.");
  }
}

async function pedir(url: string, init?: RequestInit): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new SalaIndisponivel();
  }
  // O proxy do Vite responde 5xx quando o wrangler ainda não está escutando.
  if (r.status >= 500) throw new SalaIndisponivel();
  return r;
}

const esperarDeVerdade = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Repete `fn` enquanto a sala estiver indisponível, com o mesmo backoff da reconexão. */
export async function comRetentativa<T>(
  fn: () => Promise<T>,
  sinal?: AbortSignal,
  esperar: (ms: number) => Promise<void> = esperarDeVerdade,
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof SalaIndisponivel) || sinal?.aborted) throw e;
      await esperar(atrasoDaTentativa(tentativa));
      if (sinal?.aborted) throw e;
    }
  }
}

export async function listarUsuarios(): Promise<UsuarioDaEntrada[]> {
  const r = await pedir("/api/usuarios");
  if (!r.ok) throw new Error("Não foi possível listar os usuários.");
  return (await r.json()) as UsuarioDaEntrada[];
}

/** Usuário da sessão atual, ou `null` se ninguém entrou. */
export async function usuarioDaSessao(): Promise<UsuarioDaEntrada | null> {
  const r = await pedir("/api/eu");
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("A sala não respondeu.");
  return (await r.json()) as UsuarioDaEntrada;
}

export async function entrar(usuarioId: string): Promise<void> {
  const r = await pedir("/api/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId }),
  });
  if (!r.ok) throw new Error("Não foi possível entrar.");
}

export async function sair(): Promise<void> {
  await fetch("/api/sair", { method: "POST" });
}
