import type { ResumoDaMesa } from "@tabletop/shared";
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

/** A mesa não existe (id que ninguém criou). */
export class MesaInexistente extends Error {
  constructor() {
    super("Essa mesa não existe.");
  }
}

/** Tudo o que é da sala fica sob `/api/m/<id>` (C1). */
const daMesa = (mesaId: string, rota: string) => `/api/m/${mesaId}/${rota}`;

export async function listarUsuarios(mesaId: string): Promise<UsuarioDaEntrada[]> {
  const r = await pedir(daMesa(mesaId, "usuarios"));
  if (r.status === 404) throw new MesaInexistente();
  if (!r.ok) throw new Error("Não foi possível listar os usuários.");
  return (await r.json()) as UsuarioDaEntrada[];
}

/** Usuário da sessão atual nesta mesa, ou `null` se ninguém entrou. */
export async function usuarioDaSessao(mesaId: string): Promise<UsuarioDaEntrada | null> {
  const r = await pedir(daMesa(mesaId, "eu"));
  if (r.status === 401) return null;
  if (r.status === 404) throw new MesaInexistente();
  if (!r.ok) throw new Error("A sala não respondeu.");
  return (await r.json()) as UsuarioDaEntrada;
}

export async function entrar(mesaId: string, usuarioId: string): Promise<void> {
  const r = await pedir(daMesa(mesaId, "entrar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId }),
  });
  if (!r.ok) throw new Error("Não foi possível entrar.");
}

export async function sair(mesaId: string): Promise<void> {
  await fetch(daMesa(mesaId, "sair"), { method: "POST" });
}

/** O que a tela sabe de uma mesa. `legada`: é a campanha de sempre (a pasta de imagens já escolhida vale). */
export type DadosDaMesa = ResumoDaMesa & { legada: boolean };

/** A mesa pelo id (já na forma canônica), ou `null` se não existe. */
export async function consultarMesa(id: string): Promise<DadosDaMesa | null> {
  const r = await pedir(`/api/mesas/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Não foi possível consultar a mesa.");
  return (await r.json()) as DadosDaMesa;
}

/** Cria uma mesa e devolve o id dela. Erros com mensagem pronta para a tela. */
export async function criarMesa(nome: string): Promise<ResumoDaMesa> {
  const r = await pedir("/api/mesas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
  if (r.status === 429) {
    throw new Error("Você criou mesas demais por agora. Tente de novo daqui a uma hora.");
  }
  if (r.status === 400) throw new Error("O nome da mesa precisa ter de 1 a 60 caracteres.");
  if (!r.ok) throw new Error("Não foi possível criar a mesa.");
  return (await r.json()) as ResumoDaMesa;
}

/** A lista de mesas do servidor, ou `null` se ele não lista (na internet não lista: ninguém descobre as mesas dos outros). */
export async function listarMesasDoServidor(): Promise<DadosDaMesa[] | null> {
  const r = await pedir("/api/mesas");
  if (!r.ok) return null;
  return (await r.json()) as DadosDaMesa[];
}

/** Muda o nome da mesa (só o mestre; a sala confere). */
export async function renomearMesa(mesaId: string, nome: string): Promise<string> {
  const r = await pedir(daMesa(mesaId, "renomear"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
  if (r.status === 403) throw new Error("Só o mestre muda o nome da mesa.");
  if (r.status === 400) throw new Error("O nome da mesa precisa ter de 1 a 60 caracteres.");
  if (!r.ok) throw new Error("Não foi possível mudar o nome.");
  return ((await r.json()) as ResumoDaMesa).nome;
}
