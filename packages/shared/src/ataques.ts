import { dobrarDados, formatarExpressao, lerExpressao } from "./dados.ts";
import {
  bonusDeAcerto,
  bonusDeProficiencia,
  type Ficha,
  modDoAtributo,
  type Rolavel,
} from "./ficha.ts";
import { ROTULO_DO_ATRIBUTO } from "./srd/index.ts";

// ---------------------------------------------------------------------------------------------
// Ataques e magias na ficha (V4a): o que o editor da engrenagem guarda vira a expressão, a CD e a prévia.
// Tudo puro. A sala rola; aqui só se monta o que vai no pedido.
// ---------------------------------------------------------------------------------------------

const comSinal = (n: number): string => (n === 0 ? "" : n > 0 ? `+${n}` : `${n}`);

/** "1d8+7" de uma soma: os dados e o que o atributo e os bônus acrescentam (nada, se a conta der zero). */
function somar(dados: string, fixo: number): string {
  const limpo = dados.trim();
  if (limpo === "") return "";
  return `${limpo}${comSinal(fixo)}`;
}

/**
 * A expressão do dano do ataque: os dados (ou a expressão que o import trouxe), mais o modificador do atributo do
 * dano, o bônus do dano e o bônus mágico, mais o segundo dano, se houver. `undefined` sem dano.
 */
export function expressaoDeDano(f: Ficha, a: Rolavel): string | undefined {
  const base = somar(
    a.dano ?? "",
    (a.atributoDano ? modDoAtributo(f, a.atributoDano) : 0) +
      (a.bonusDano ?? 0) +
      (a.bonusMagico ?? 0),
  );
  if (base === "") return undefined;
  const d2 = a.dano2;
  if (d2 && d2.dados.trim() !== "") {
    const segundo = somar(
      d2.dados,
      (d2.atributo ? modDoAtributo(f, d2.atributo) : 0) + (d2.bonus ?? 0),
    );
    return `${base}+${segundo}`;
  }
  return base;
}

/** O(s) tipo(s) do dano: "Radiante" ou "Radiante + Fogo". */
export function tipoDeDano(a: Rolavel): string | undefined {
  const tipos = [a.tipo, a.dano2 && a.dano2.dados.trim() !== "" ? a.dano2.tipo : undefined]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t);
  return tipos.length === 0 ? undefined : tipos.join(" + ");
}

/** A CD da salvaguarda: 8 + proficiência + modificador + bônus (com `salvaguarda`), ou a CD escrita à mão. */
export function cdDaRolagem(f: Ficha, a: Rolavel): number | undefined {
  const s = a.salvaguarda;
  if (!s) return a.cd;
  return 8 + bonusDeProficiencia(f) + modDoAtributo(f, s.cdAtributo) + (s.cdBonus ?? 0);
}

/** Do 20 natural para baixo: 20 (padrão), 19 ou 18. */
export function margemDeCritico(a: Rolavel): number {
  return a.margemCritico ?? 20;
}

/** A expressão do dano no crítico: os dados dobrados (os modificadores não), mais os dados extras do crítico. */
export function expressaoDeDanoCritico(f: Ficha, a: Rolavel): string | undefined {
  const normal = expressaoDeDano(f, a);
  if (normal === undefined) return undefined;
  const lida = lerExpressao(normal);
  if (!lida.ok) return normal;
  const dobrada = formatarExpressao(dobrarDados(lida.expressao));
  const extra = a.danoCritico?.trim();
  return extra ? `${dobrada}+${extra}` : dobrada;
}

export type PreviaDoAtaque = {
  /** "+13 para acertar". */
  acerto?: string;
  /** "1d8+9 radiante". */
  dano?: string;
  /** "crítico 2d8+9". */
  critico?: string;
  /** "CD 15 Destreza (metade se passar)". */
  salvaguarda?: string;
};

const SINAL = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

/** A prévia do editor: o que o ataque vai rolar, com os números já somados. */
export function previaDoAtaque(f: Ficha, a: Rolavel): PreviaDoAtaque {
  const p: PreviaDoAtaque = {};
  const acerto = bonusDeAcerto(f, a);
  if (acerto !== undefined) p.acerto = `${SINAL(acerto)} para acertar`;
  const dano = expressaoDeDano(f, a);
  if (dano !== undefined) {
    const tipo = tipoDeDano(a);
    p.dano = tipo ? `${dano} ${tipo.toLowerCase()}` : dano;
    const crit = expressaoDeDanoCritico(f, a);
    if (crit !== undefined && acerto !== undefined) p.critico = `crítico ${crit}`;
  }
  const cd = cdDaRolagem(f, a);
  if (cd !== undefined) {
    const s = a.salvaguarda;
    p.salvaguarda = s
      ? `CD ${cd} de ${ROTULO_DO_ATRIBUTO[s.alvo]}${s.sucesso === "metade" ? " (metade se passar)" : ""}`
      : `CD ${cd}`;
  }
  return p;
}
