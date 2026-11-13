import { pode } from "./capacidades.ts";
import type { Cena, Estado, Usuario } from "./estado.ts";
import type { CodigoDeErro } from "./protocolo.ts";

// V12: o ping no mapa. Mensagem efêmera: a sala valida, repassa a quem vê a cena e esquece. Não vai ao
// estado, ao banco, ao histórico nem à exportação.

/** No máximo 1 ping a cada 0,5 s por usuário; o excesso é ignorado em silêncio. */
export const INTERVALO_MINIMO_DO_PING_MS = 500;
/** No máximo 1 centralização a cada 3 s por usuário; o ping que passou do limite sai sem centralizar. */
export const INTERVALO_MINIMO_DA_CENTRALIZACAO_MS = 3_000;

/** Quando cada usuário pingou e centralizou pela última vez (memória da sala). */
export type UltimoPing = { pingMs?: number | undefined; centroMs?: number | undefined };

/**
 * Pura. Decide o que vale de um ping: `null` se veio cedo demais (ignorado); senão `centralizar` só se o pedido
 * pedia e o intervalo da centralização passou. `proximo` é o que a sala guarda se o ping valer.
 */
export function limitarPing(
  ultimo: UltimoPing | undefined,
  agoraMs: number,
  quer: boolean,
): { centralizar: boolean; proximo: UltimoPing } | null {
  if (ultimo?.pingMs !== undefined && agoraMs - ultimo.pingMs < INTERVALO_MINIMO_DO_PING_MS) {
    return null;
  }
  const centralizar =
    quer &&
    (ultimo?.centroMs === undefined ||
      agoraMs - ultimo.centroMs >= INTERVALO_MINIMO_DA_CENTRALIZACAO_MS);
  return {
    centralizar,
    proximo: { pingMs: agoraMs, centroMs: centralizar ? agoraMs : ultimo?.centroMs },
  };
}

/** O que a sala repassa de um ping já validado (a cor e o autor são resolvidos na sala, nunca pelo cliente). */
export type PingRepassado = {
  cenaId: string;
  x: number;
  y: number;
  centralizar: boolean;
  usuarioId: string;
  cor: string;
};

/** Quem recebe o ping: o mestre (que escolhe a cena que olha; o cliente filtra) e os jogadores da cena do grupo. */
export function pingVisivelPara(
  cenaId: string,
  usuario: Pick<Usuario, "papel">,
  cenaAtivaId: string | undefined,
): boolean {
  return usuario.papel === "mestre" || (usuario.papel === "jogador" && cenaId === cenaAtivaId);
}

export type SaidaDePing =
  | { erro: { codigo: CodigoDeErro; mensagem: string } }
  | { ping: PingRepassado };

/** Valida o ping: capacidade, cena que existe e que quem pinga vê, ponto dentro da cena. */
export function pingar(
  estado: Estado,
  usuario: Usuario,
  dados: { cenaId: string; x: number; y: number; centralizar?: boolean | undefined },
): SaidaDePing {
  if (!pode(usuario, "mapa.pingar", estado.permissoes)) {
    return { erro: { codigo: "sem_permissao", mensagem: "Sem permissão (mapa.pingar)." } };
  }
  const cena: Cena | undefined = estado.cenas.find((c) => c.id === dados.cenaId);
  if (!cena) return { erro: { codigo: "cena_inexistente", mensagem: "Cena não encontrada." } };
  if (!pingVisivelPara(cena.id, usuario, estado.cenaAtivaId)) {
    return { erro: { codigo: "sem_permissao", mensagem: "Você só pinga na cena que está vendo." } };
  }
  if (!(dados.x >= 0 && dados.x <= cena.larguraM && dados.y >= 0 && dados.y <= cena.alturaM)) {
    return { erro: { codigo: "dados_invalidos", mensagem: "O ponto está fora da cena." } };
  }
  return {
    ping: {
      cenaId: cena.id,
      x: dados.x,
      y: dados.y,
      centralizar: dados.centralizar === true,
      usuarioId: usuario.id,
      cor: usuario.cor,
    },
  };
}
