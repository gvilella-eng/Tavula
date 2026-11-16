import { d20Natural, type Rolagem } from "@tabletop/shared";
import { type TipoDeDano, tiposDeDanoDoTexto } from "./danos";

/** O d20 que decide um teste ou ataque: o primeiro termo de dados de 20 faces, somando. */
function termoDoD20(rolagem: Rolagem) {
  for (const t of rolagem.termos) {
    if (t.tipo === "dados" && t.faces === 20 && t.sinal === 1) return t;
  }
  return null;
}

export type TotaisDaVantagem = {
  /** O que vale: o d20 que ficou mais o resto (o bônus). É o `total` da rolagem. */
  vale: number;
  /** O que não valeu: o d20 descartado mais o mesmo resto. */
  descartado: number;
  /** Os dois d20, na ordem em que foram rolados (para o balão). */
  dados: { valor: number; descartado: boolean }[];
};

/**
 * Vantagem e desvantagem (`2d20kh1`, `2d20kl1`): os DOIS totais, "13 e 19, +3 → 16 | 22". Sai só do que a mensagem já
 * traz (os dados e o total da rolagem), sem mudar o protocolo. `null` quando não houve descarte de d20.
 */
export function totaisDaVantagem(rolagem: Rolagem): TotaisDaVantagem | null {
  const termo = termoDoD20(rolagem);
  if (!termo?.manter) return null;
  const mantido = termo.dados.find((d) => !d.descartado);
  const descartado = termo.dados.find((d) => d.descartado);
  if (!mantido || !descartado) return null;
  const resto = rolagem.total - mantido.valor;
  return {
    vale: mantido.valor + resto,
    descartado: descartado.valor + resto,
    dados: termo.dados.map((d) => ({ valor: d.valor, descartado: !!d.descartado })),
  };
}

/** O que o d20 que decidiu foi: 20 natural, 1 natural ou nada de especial. */
export function naturalDoD20(rolagem: Rolagem): "20" | "1" | "" {
  const n = d20Natural(rolagem);
  return n === 20 ? "20" : n === 1 ? "1" : "";
}

/** "1d20+5" vira "1d20 + 5" (só para ler melhor na tela). */
export function expressaoLegivel(expressao: string): string {
  return expressao.replace(/([+-])/g, " $1 ").trim();
}

export type RotuloDeDano = {
  /** O nome, sem o "(nível 5)" nem o resto. */
  nome: string;
  nivelDoTruque?: number;
  cd?: number;
  tipos: TipoDeDano[];
  /** O texto dos tipos como veio ("Cortante + Fogo"), para o balão. */
  tipoTexto?: string;
};

/**
 * O dano de uma magia ou ataque rolado como `/r` (sem acerto) chega como comentário: "Chama Sagrada (nível 5), CD 14,
 * radiante". Daqui saem o nome, a CD e o tipo, para o cartão mostrar "CD | dano" com o ícone. `null` quando o comentário
 * não tem CD nem tipo de dano (um `/r 2d6 espadada` qualquer fica como rolagem livre).
 */
export function lerRotuloDeDano(texto: string | undefined): RotuloDeDano | null {
  if (!texto) return null;
  const partes = texto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length < 2) return null;
  let cd: number | undefined;
  const tipos: TipoDeDano[] = [];
  const tiposTexto: string[] = [];
  const resto: string[] = [];
  for (const [i, parte] of partes.entries()) {
    const m = /^CD\s*(\d{1,3})$/i.exec(parte);
    if (i > 0 && m?.[1] && cd === undefined) {
      cd = Number(m[1]);
      continue;
    }
    if (i > 0) {
      const achados = tiposDeDanoDoTexto(parte);
      // só vale como tipo o trecho feito só de tipos ("Cortante + Fogo"), não uma frase que cita "fogo"
      if (
        achados.length > 0 &&
        /^[\p{L}\s+/&-]{1,60}$/u.test(parte) &&
        parte.split(/[^\p{L}]+/u).length <= 5
      ) {
        for (const t of achados) if (!tipos.includes(t)) tipos.push(t);
        tiposTexto.push(parte);
        continue;
      }
    }
    resto.push(parte);
  }
  if (cd === undefined && tipos.length === 0) return null;
  const nomeCompleto = resto.join(", ");
  const nivel = /\(nível\s+(\d{1,2})\)\s*$/i.exec(nomeCompleto);
  const nome = nivel ? nomeCompleto.slice(0, nivel.index).trim() : nomeCompleto;
  return {
    nome,
    ...(nivel?.[1] ? { nivelDoTruque: Number(nivel[1]) } : {}),
    ...(cd !== undefined ? { cd } : {}),
    tipos,
    ...(tiposTexto.length > 0 ? { tipoTexto: tiposTexto.join(" · ") } : {}),
  };
}
