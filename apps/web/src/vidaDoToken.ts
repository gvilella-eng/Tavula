import { type Ficha, type OperacaoDeFicha, receberDano } from "@tabletop/shared";

/**
 * N1: o que o campo de vida do token faz com o texto digitado. "12" é o valor novo, "-7" tira 7 (o dano consome o
 * PV temporário primeiro, como na ficha) e "+3" soma 3 (até o máximo). O resultado fica sempre entre 0 e o PV
 * máximo. Texto que não é número devolve `null` (o campo não grava). Sem mudança, lista vazia.
 */
export function operacoesDaVida(
  texto: string,
  ficha: Pick<Ficha, "pvAtual" | "pvMax" | "pvTemp">,
): OperacaoDeFicha[] | null {
  const lido = /^([+\-−])?\s*(\d{1,4})$/.exec(texto.trim());
  if (!lido) return null;
  const sinal = lido[1];
  const n = Number(lido[2]);
  const ops: OperacaoDeFicha[] = [];
  if (sinal === "-" || sinal === "−") {
    const novo = receberDano(ficha, n);
    if (novo.pvAtual !== ficha.pvAtual) ops.push({ caminho: "pvAtual", valor: novo.pvAtual });
    if (novo.pvTemp !== (ficha.pvTemp ?? 0)) {
      ops.push({ caminho: "pvTemp", valor: novo.pvTemp === 0 ? null : novo.pvTemp });
    }
    return ops;
  }
  const alvo = Math.min(ficha.pvMax, Math.max(0, sinal === "+" ? ficha.pvAtual + n : n));
  if (alvo !== ficha.pvAtual) ops.push({ caminho: "pvAtual", valor: alvo });
  return ops;
}

/**
 * Q10: o mesmo texto do campo de vida, para o token de NPC com vida própria (`token.vida`): o que muda em valores
 * absolutos (`atual` e, se o dano comeu o temporário, `temp`). `null` = texto inválido; objeto vazio = sem mudança.
 */
export function mudancasDaVidaDoToken(
  texto: string,
  vida: { atual: number; max: number; temp: number },
): { atual?: number; temp?: number | null } | null {
  const ops = operacoesDaVida(texto, { pvAtual: vida.atual, pvMax: vida.max, pvTemp: vida.temp });
  if (ops === null) return null;
  const m: { atual?: number; temp?: number | null } = {};
  for (const op of ops) {
    if (op.caminho === "pvAtual") m.atual = op.valor as number;
    if (op.caminho === "pvTemp") m.temp = op.valor as number | null;
  }
  return m;
}
