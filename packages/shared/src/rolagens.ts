import { z } from "zod";
import {
  d20Natural,
  dobrarDados,
  type FonteDeAleatoriedade,
  LIMITES_DE_DADOS,
  lerExpressao,
  type Rolagem,
  RolagemSchema,
  rolar,
} from "./dados.ts";

// ---------------------------------------------------------------------------------------------
// Modelos de rolagem (Lote 8): ataque (acerto + dano), teste com CD e teste simples. A ficha do
// Lote 9 chama `pedidoDeAtaque`/`pedidoDeTeste` e manda o resultado pelo chat (`chat.modelo`); a
// SALA rola, com `rolarAtaque`/`rolarTeste`.
// ---------------------------------------------------------------------------------------------

export const VANTAGENS = ["normal", "vantagem", "desvantagem"] as const;
export const VantagemSchema = z.enum(VANTAGENS);
export type Vantagem = z.infer<typeof VantagemSchema>;

export const ROTULO_DA_VANTAGEM: Record<Vantagem, string> = {
  normal: "Normal",
  vantagem: "Vantagem",
  desvantagem: "Desvantagem",
};

/** O d20 de um teste: `1d20`, `2d20kh1` (vantagem) ou `2d20kl1` (desvantagem), com o bônus. */
export function expressaoDoD20(bonus: number, vantagem: Vantagem = "normal"): string {
  const dado =
    vantagem === "vantagem" ? "2d20kh1" : vantagem === "desvantagem" ? "2d20kl1" : "1d20";
  const b = Math.trunc(bonus);
  return b === 0 ? dado : `${dado}${b > 0 ? "+" : "-"}${Math.abs(b)}`;
}

const Nome = z.string().trim().min(1).max(64);
const Bonus = z.number().int().min(-50).max(50);

/** A salvaguarda do alvo mostrada no chat: "CD 15 de Destreza, metade se passar". */
export const SalvaguardaNoChatSchema = z.object({
  cd: z.number().int().min(0).max(100),
  atributo: z.string().trim().min(1).max(24),
  sucesso: z.enum(["metade", "nenhum"]),
});
export type SalvaguardaNoChat = z.infer<typeof SalvaguardaNoChatSchema>;

/**
 * O espaço de magia usado ao conjurar acima do nível (V6), como o cliente o pede: o nível do espaço, o dado a mais
 * (já multiplicado pelos níveis acima: `2d6`) e se a salvaguarda dá metade (só para mostrar a metade no bloco).
 */
export const EspacoDoPedidoSchema = z.object({
  nivel: z.number().int().min(1).max(9),
  extra: z.string().max(LIMITES_DE_DADOS.caracteres).optional(),
  metade: z.boolean().optional(),
  /** N2: conjurada como ritual (sem gastar espaço): o cartão diz "como ritual". */
  ritual: z.boolean().optional(),
  /** N2: conjuração inata (sem gastar espaço): o cartão diz "conjuração inata". */
  inata: z.boolean().optional(),
  /** N2: quantos dardos, raios ou alvos a magia tem neste espaço. Com `cada` (o dano de um), a sala rola um por um. */
  quantidade: z
    .object({
      total: z.number().int().min(1).max(30),
      unidade: z.string().trim().min(1).max(16),
      cada: z.string().max(LIMITES_DE_DADOS.caracteres).optional(),
    })
    .optional(),
});
export type EspacoDoPedido = z.infer<typeof EspacoDoPedidoSchema>;

/** O espaço usado como a mensagem o guarda: o nível e, havendo dado a mais, o que rolou e os totais. */
export const EspacoNoChatSchema = z.object({
  nivel: z.number().int().min(1).max(9),
  extra: z
    .object({
      /** O que foi rolado (no crítico, os dados já dobrados). */
      expressao: z.string().max(LIMITES_DE_DADOS.caracteres * 2),
      rolagem: RolagemSchema,
      /** O dano principal mais o dado a mais. */
      total: z.number().int(),
      /** Metade do total (arredondada para baixo), quando a salvaguarda dá metade. */
      metade: z.number().int().optional(),
    })
    .optional(),
  ritual: z.boolean().optional(),
  inata: z.boolean().optional(),
  /** N2: a quantidade de dardos, raios ou alvos; `rolagens` (uma por dardo ou raio) e `soma` só com dano por unidade. */
  quantidade: z
    .object({
      total: z.number().int().min(1).max(30),
      unidade: z.string().max(16),
      rolagens: z.array(RolagemSchema).min(1).max(30).optional(),
      soma: z.number().int().optional(),
    })
    .optional(),
});
export type EspacoNoChat = z.infer<typeof EspacoNoChatSchema>;

/** O que o cliente pede (nunca traz resultado). */
export const PedidoDeModeloSchema = z.discriminatedUnion("modelo", [
  z.object({
    modelo: z.literal("ataque"),
    nome: Nome,
    /** Bônus de ataque somado ao d20. */
    bonus: Bonus,
    /** Dano em notação (`1d8+3`). No crítico os dados dobram, o modificador não. */
    dano: z.string().max(LIMITES_DE_DADOS.caracteres),
    danoTipo: z.string().trim().max(80).optional(),
    /** Crítico a partir deste natural (20 padrão; 19 ou 18). */
    margemCritico: z.number().int().min(18).max(20).optional(),
    /** Dados a mais no crítico (`1d6`), depois de dobrar os do dano. */
    danoCritico: z.string().max(60).optional(),
    /** A salvaguarda do alvo, só para mostrar no chat. */
    salvaguarda: SalvaguardaNoChatSchema.optional(),
    /** Magia conjurada acima do nível (V6): o dado a mais é rolado à parte e vai no bloco colado do chat. */
    espaco: EspacoDoPedidoSchema.optional(),
    /** N2: o nível do personagem que deu dados a mais ao truque (só para mostrar: "nível 5"). */
    nivelDoTruque: z.number().int().min(1).max(30).optional(),
    vantagem: VantagemSchema.optional(),
    oculta: z.boolean().optional(),
    /** Fala como este personagem (id). */
    como: z.string().min(1).max(64).optional(),
  }),
  z.object({
    modelo: z.literal("teste"),
    nome: Nome,
    bonus: Bonus,
    /** Com CD mostra sucesso ou falha; sem CD é um teste simples. */
    cd: z.number().int().min(0).max(100).optional(),
    vantagem: VantagemSchema.optional(),
    oculta: z.boolean().optional(),
    como: z.string().min(1).max(64).optional(),
  }),
]);
export type PedidoDeModelo = z.infer<typeof PedidoDeModeloSchema>;

/** O resultado (só a sala produz; vai dentro da mensagem do chat). */
export const ResultadoDeModeloSchema = z.discriminatedUnion("modelo", [
  z.object({
    modelo: z.literal("ataque"),
    nome: Nome,
    vantagem: VantagemSchema,
    acerto: RolagemSchema,
    dano: RolagemSchema,
    danoTipo: z.string().max(80).optional(),
    salvaguarda: SalvaguardaNoChatSchema.optional(),
    nivelDoTruque: z.number().int().min(1).max(30).optional(),
    /** Crítico (20 natural ou a margem do ataque): os dados do dano foram dobrados. */
    critico: z.boolean(),
    /** 1 natural. */
    falhaCritica: z.boolean(),
  }),
  z.object({
    modelo: z.literal("teste"),
    nome: Nome,
    vantagem: VantagemSchema,
    rolagem: RolagemSchema,
    cd: z.number().int().optional(),
    /** Só com CD: total >= CD. */
    sucesso: z.boolean().optional(),
    critico: z.boolean(),
    falhaCritica: z.boolean(),
  }),
  /** Dado de vida gasto (V4a2): a cura somada ao PV, com o PV de depois. */
  z.object({
    modelo: z.literal("vida"),
    nome: Nome,
    rolagem: RolagemSchema,
    curou: z.number().int().min(0),
    pvAtual: z.number().int().min(0),
    pvMax: z.number().int().min(0),
  }),
]);
export type ResultadoDeModelo = z.infer<typeof ResultadoDeModeloSchema>;

export type PedidoDeAtaque = Extract<PedidoDeModelo, { modelo: "ataque" }>;
export type PedidoDeTeste = Extract<PedidoDeModelo, { modelo: "teste" }>;

/** Monta o pedido de ataque (a ficha usa). */
export function pedidoDeAtaque(p: Omit<PedidoDeAtaque, "modelo">): PedidoDeAtaque {
  return { modelo: "ataque", ...p };
}

/** Monta o pedido de teste, com ou sem CD (a ficha usa). */
export function pedidoDeTeste(p: Omit<PedidoDeTeste, "modelo">): PedidoDeTeste {
  return { modelo: "teste", ...p };
}

export type ResultadoOuErro<T> = { ok: true; resultado: T } | { ok: false; motivo: string };

/**
 * Rola o ataque: o acerto (d20 + bônus, com vantagem ou desvantagem) e o dano. Com 20 natural no d20
 * que ficou, os DADOS do dano dobram (os modificadores não). Rola o dano sempre, também no erro.
 */
export function rolarAtaque(
  pedido: Omit<PedidoDeAtaque, "modelo" | "como" | "oculta">,
  fonte: FonteDeAleatoriedade,
): ResultadoOuErro<Extract<ResultadoDeModelo, { modelo: "ataque" }>> {
  const vantagem = pedido.vantagem ?? "normal";
  const dano = lerExpressao(pedido.dano);
  if (!dano.ok) return { ok: false, motivo: `Dano inválido: ${dano.motivo}` };
  const acertoLido = lerExpressao(expressaoDoD20(pedido.bonus, vantagem));
  if (!acertoLido.ok) return { ok: false, motivo: acertoLido.motivo };
  const acerto = rolar(acertoLido.expressao, fonte);
  const natural = d20Natural(acerto);
  const critico = natural !== null && natural >= (pedido.margemCritico ?? 20);
  let expressaoDoDano = critico ? dobrarDados(dano.expressao) : dano.expressao;
  const extra = critico ? (pedido.danoCritico?.trim() ?? "") : "";
  if (extra !== "") {
    const lida = lerExpressao(extra);
    if (!lida.ok) return { ok: false, motivo: `Dano do crítico inválido: ${lida.motivo}` };
    expressaoDoDano = { termos: [...expressaoDoDano.termos, ...lida.expressao.termos] };
  }
  const rolado = rolar(expressaoDoDano, fonte);
  return {
    ok: true,
    resultado: {
      modelo: "ataque",
      nome: pedido.nome,
      vantagem,
      acerto,
      dano: rolado,
      ...(pedido.danoTipo ? { danoTipo: pedido.danoTipo } : {}),
      ...(pedido.salvaguarda ? { salvaguarda: pedido.salvaguarda } : {}),
      ...(pedido.nivelDoTruque ? { nivelDoTruque: pedido.nivelDoTruque } : {}),
      critico,
      falhaCritica: natural === 1,
    },
  };
}

/**
 * Rola o dado a mais do espaço (V6). `danoPrincipal` é o total do dano já rolado; no crítico os dados do extra
 * dobram, como os do dano. Sem `extra`, só guarda o nível do espaço.
 */
export function rolarEspaco(
  pedido: EspacoDoPedido,
  danoPrincipal: number,
  critico: boolean,
  fonte: FonteDeAleatoriedade,
): ResultadoOuErro<EspacoNoChat> {
  const marcas = {
    ...(pedido.ritual ? { ritual: true } : {}),
    ...(pedido.inata ? { inata: true } : {}),
  };
  let quantidade: EspacoNoChat["quantidade"];
  if (pedido.quantidade) {
    const { total, unidade, cada } = pedido.quantidade;
    quantidade = { total, unidade };
    if (cada?.trim()) {
      const um = lerExpressao(cada);
      if (!um.ok) return { ok: false, motivo: `Dano por ${unidade} inválido: ${um.motivo}` };
      const rolagens = Array.from({ length: total }, () => rolar(um.expressao, fonte));
      quantidade = { total, unidade, rolagens, soma: rolagens.reduce((t, r) => t + r.total, 0) };
    }
  }
  const extra = pedido.extra?.trim() ?? "";
  if (extra === "") {
    return {
      ok: true,
      resultado: { nivel: pedido.nivel, ...marcas, ...(quantidade ? { quantidade } : {}) },
    };
  }
  const lida = lerExpressao(extra);
  if (!lida.ok) return { ok: false, motivo: `Dano por nível inválido: ${lida.motivo}` };
  const rolagem = rolar(critico ? dobrarDados(lida.expressao) : lida.expressao, fonte);
  const total = danoPrincipal + rolagem.total;
  return {
    ok: true,
    resultado: {
      nivel: pedido.nivel,
      ...marcas,
      ...(quantidade ? { quantidade } : {}),
      extra: {
        expressao: rolagem.expressao,
        rolagem,
        total,
        ...(pedido.metade ? { metade: Math.floor(total / 2) } : {}),
      },
    },
  };
}

/** Rola um teste: d20 + bônus (com vantagem ou desvantagem) e, havendo CD, o sucesso (total >= CD). */
export function rolarTeste(
  pedido: Omit<PedidoDeTeste, "modelo" | "como" | "oculta">,
  fonte: FonteDeAleatoriedade,
): ResultadoOuErro<Extract<ResultadoDeModelo, { modelo: "teste" }>> {
  const vantagem = pedido.vantagem ?? "normal";
  const lido = lerExpressao(expressaoDoD20(pedido.bonus, vantagem));
  if (!lido.ok) return { ok: false, motivo: lido.motivo };
  const rolagem: Rolagem = rolar(lido.expressao, fonte);
  const natural = d20Natural(rolagem);
  return {
    ok: true,
    resultado: {
      modelo: "teste",
      nome: pedido.nome,
      vantagem,
      rolagem,
      ...(pedido.cd === undefined ? {} : { cd: pedido.cd, sucesso: rolagem.total >= pedido.cd }),
      critico: natural === 20,
      falhaCritica: natural === 1,
    },
  };
}
