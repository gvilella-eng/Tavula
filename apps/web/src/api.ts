export type UsuarioDaEntrada = { id: string; nome: string; cor: string };

export async function listarUsuarios(): Promise<UsuarioDaEntrada[]> {
  const r = await fetch("/api/usuarios");
  if (!r.ok) throw new Error("Não foi possível listar os usuários.");
  return (await r.json()) as UsuarioDaEntrada[];
}

/** Usuário da sessão atual, ou `null` se ninguém entrou. */
export async function usuarioDaSessao(): Promise<UsuarioDaEntrada | null> {
  const r = await fetch("/api/eu");
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("A sala não respondeu.");
  return (await r.json()) as UsuarioDaEntrada;
}

export async function entrar(usuarioId: string): Promise<void> {
  const r = await fetch("/api/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId }),
  });
  if (!r.ok) throw new Error("Não foi possível entrar.");
}

export async function sair(): Promise<void> {
  await fetch("/api/sair", { method: "POST" });
}
