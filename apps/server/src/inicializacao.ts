import { DO_DA_MESA_LEGADA, type Estado, estadoDeMesaNova, estadoInicial } from "@tabletop/shared";
import type { Armazenamento } from "./armazenamento";

/**
 * O que o Durable Object faz ao acordar (C1), sem nunca reescrever o que já existe:
 * - já há estado → só o carrega (a campanha real de hoje cai aqui);
 * - não há estado e é a mesa legada (`campanha`) → semeia com o exemplo, como sempre foi;
 * - não há estado e é outra mesa → `null`: o DO não foi criado e não se auto-semeia (404 até o diretório
 *   mandar `POST /criar`).
 * `nomeDoDO` vem de `ctx.id.name`.
 */
export function carregarOuSemear(
  banco: Armazenamento,
  nomeDoDO: string | undefined,
  sementeBruta: unknown,
): Estado | null {
  banco.migrar();
  const carregado = banco.carregar();
  if (carregado) return carregado;
  if (nomeDoDO !== DO_DA_MESA_LEGADA) return null;
  const novo = estadoInicial(sementeBruta);
  banco.salvarTudo(novo);
  return novo;
}

/** `POST /criar`: grava o estado vazio de uma mesa nova. Se a mesa já existe, não toca em nada. */
export function criarMesaNova(banco: Armazenamento): { estado: Estado; jaExistia: boolean } {
  const existente = banco.carregar();
  if (existente) return { estado: existente, jaExistia: true };
  const novo = estadoDeMesaNova();
  banco.salvarTudo(novo);
  return { estado: novo, jaExistia: false };
}
