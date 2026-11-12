import { MAXIMO_DE_VAGAS } from "./contas.ts";
import type { Estado, Personagem, Usuario } from "./estado.ts";
import { ehNpc } from "./pastas.ts";

/**
 * V7: quem faz parte da mesa. O estado guarda "vagas" (usuários); só são membros o mestre e quem tem conta
 * ativa (e, com MODO=teste, quem entrou pelo login solto). A sala manda a lista derivada em `estado.membros`
 * a cada snapshot. Sem o campo (estado de teste, arquivo antigo) todos contam como membros.
 * A vaga escondida continua existindo (fichas, tokens e histórico apontam para ela); só não aparece nas listas.
 */
export function membrosDaMesa(estado: Pick<Estado, "usuarios" | "membros">): Usuario[] {
  const { membros } = estado;
  if (membros === undefined) return estado.usuarios;
  const ids = new Set(membros);
  return estado.usuarios.filter((u) => u.papel === "mestre" || ids.has(u.id));
}

/** Só os jogadores que são membros (o que os seletores de pessoas oferecem). */
export function jogadoresDaMesa(estado: Pick<Estado, "usuarios" | "membros">): Usuario[] {
  return membrosDaMesa(estado).filter((u) => u.papel === "jogador");
}

/**
 * Fichas de personagem que nenhum membro controla: candidatas à "Ficha dele" ao aceitar um pedido. NPC nunca entra
 * (a ficha sem dono e sem apresentação escolhida conta como NPC, como em `apresentacaoDoPersonagem`).
 */
export function fichasSemMembro(
  estado: Pick<Estado, "usuarios" | "membros" | "personagens">,
): Personagem[] {
  const ids = new Set(jogadoresDaMesa(estado).map((u) => u.id));
  return estado.personagens.filter(
    (p) =>
      p.editores.tipo === "jogadores" && !ehNpc(p) && !p.editores.ids.some((id) => ids.has(id)),
  );
}

export type PlanoDeAceite =
  | {
      /** Liga a conta a uma vaga que já existe (escondida) e a renomeia com o nome da pessoa. */
      tipo: "vaga-existente";
      usuarioId: string;
    }
  | {
      /** Cria um usuário novo (ou reaproveita uma vaga escondida que não é dona de nada). */
      tipo: "nova";
      usuarioId: string;
      /** `true` quando o usuário ainda não existe. */
      criar: boolean;
      /** Se a pessoa já nasce dona de uma ficha sem dono. */
      fichaId?: string;
    }
  | { tipo: "erro"; erro: "vaga_invalida" };

/** O que uma vaga escondida ainda tem (dona de ficha, de token ou com exceção de permissão)? */
export function vagaTemDono(estado: Estado, usuarioId: string): boolean {
  return (
    estado.personagens.some(
      (p) => p.editores.tipo === "jogadores" && p.editores.ids.includes(usuarioId),
    ) ||
    estado.tokens.some((t) => t.controladoPor.includes(usuarioId)) ||
    estado.permissoes.porUsuario[usuarioId] !== undefined
  );
}

/**
 * Decide o que fazer ao aceitar um pedido (V7). `membrosOcupados` são os ids das vagas com conta ativa.
 *  - Ficha de uma vaga escondida: a conta fica ligada a ESSA vaga (tokens, permissões e histórico seguem).
 *  - Ficha sem dono: cria o usuário e o torna dono da ficha.
 *  - Nenhuma: cria o usuário; com o limite cheio, reaproveita uma vaga escondida que não é dona de nada.
 */
export function planejarAceite(
  estado: Estado,
  contasAtivas: ReadonlySet<string>,
  fichaId: string | undefined,
  idNovo: string,
  maximo: number = MAXIMO_DE_VAGAS,
): PlanoDeAceite {
  const escondida = (id: string) => {
    const u = estado.usuarios.find((x) => x.id === id);
    return u?.papel === "jogador" && !contasAtivas.has(id);
  };
  if (fichaId !== undefined) {
    const ficha = estado.personagens.find((p) => p.id === fichaId);
    if (ficha?.editores.tipo !== "jogadores" || ehNpc(ficha)) {
      return { tipo: "erro", erro: "vaga_invalida" };
    }
    if (ficha.editores.ids.some((id) => contasAtivas.has(id))) {
      return { tipo: "erro", erro: "vaga_invalida" };
    }
    const dona = ficha.editores.ids.find(escondida);
    if (dona !== undefined) return { tipo: "vaga-existente", usuarioId: dona };
    const nova = planejarNova(estado, contasAtivas, idNovo, maximo);
    return nova.tipo === "nova" ? { ...nova, fichaId } : nova;
  }
  return planejarNova(estado, contasAtivas, idNovo, maximo);
}

function planejarNova(
  estado: Estado,
  contasAtivas: ReadonlySet<string>,
  idNovo: string,
  maximo: number,
): PlanoDeAceite {
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  if (jogadores.length < maximo) {
    return { tipo: "nova", usuarioId: idNovo, criar: true };
  }
  const livre = jogadores.find((u) => !contasAtivas.has(u.id) && !vagaTemDono(estado, u.id));
  if (!livre) return { tipo: "erro", erro: "vaga_invalida" };
  return { tipo: "nova", usuarioId: livre.id, criar: false };
}

/** O próximo id livre `jogador-N` (interno: a pessoa nunca o vê). */
export function proximoIdDeJogador(usuarios: readonly Pick<Usuario, "id">[]): string {
  let n = 1;
  for (const u of usuarios) {
    const m = /^jogador-(\d+)$/.exec(u.id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return `jogador-${n}`;
}

/**
 * Os ids dos membros: o mestre, quem tem conta ativa e, só com MODO=teste, quem entrou pelo login solto
 * (`presentesDeTeste`). Fora do modo de teste `presentesDeTeste` nunca conta.
 */
export function derivarMembros(
  usuarios: readonly Usuario[],
  contasAtivas: ReadonlySet<string>,
  presentesDeTeste: readonly string[],
  ehTeste: boolean,
): string[] {
  const teste = new Set(ehTeste ? presentesDeTeste : []);
  return usuarios
    .filter((u) => u.papel === "mestre" || contasAtivas.has(u.id) || teste.has(u.id))
    .map((u) => u.id);
}
