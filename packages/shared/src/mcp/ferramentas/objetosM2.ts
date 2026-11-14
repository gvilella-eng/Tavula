import { z } from "zod";
import { type Estado, normalizarBusca } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, passo } from "./base.ts";

// M2: o que o mestre faz com a luz durante a sessão: tocha na mão, no suporte, ajustes de tempo e de raio.

export const TochaPedidaSchema = z
  .object({
    acao: z.enum(["acender", "alternar", "guardar", "entregar", "posar", "pegar"]),
    ficha: z
      .string()
      .optional()
      .describe(
        "Quem carrega (nome da ficha): acender, alternar, guardar, entregar, posar e pegar.",
      ),
    modelo: z
      .string()
      .optional()
      .describe(
        "Acender: o modelo (da mochila). Nos outros: escolhe o objeto quando há mais de um.",
      ),
    ponto: z
      .string()
      .optional()
      .describe("Posar: o suporte de destino. Pegar e alternar: o suporte onde o objeto está."),
    para: z.string().optional().describe("Entregar: o nome do token que recebe."),
  })
  .strict();

export const AjusteDeObjetoSchema = z
  .object({
    objeto: z.string().describe("Nome do objeto (ex.: o modelo, 'Tocha 5e') ou o id."),
    ficha: z.string().optional().describe("Quem o carrega, para escolher entre vários iguais."),
    ajuste: z.discriminatedUnion("acao", [
      z
        .object({
          acao: z.literal("tempo"),
          minutos: z
            .number()
            .min(-6000)
            .max(6000)
            .describe("Soma (ou tira, se negativo) minutos do saldo."),
          nota: z.string().max(120).optional(),
        })
        .strict(),
      z
        .object({
          acao: z.literal("modificar"),
          raioX: z.number().min(0.1).max(5).describe("Multiplica o raio da luz (0,5 = metade)."),
          duracaoMin: z
            .number()
            .positive()
            .max(6000)
            .optional()
            .describe("Sem isso, vale até tirar."),
          nota: z.string().max(120).optional(),
        })
        .strict(),
      z.object({ acao: z.literal("tirarModificador"), id: z.string() }).strict(),
      z.object({ acao: z.literal("consumir") }).strict(),
    ]),
  })
  .strict();

type TochaPedida = z.infer<typeof TochaPedidaSchema>;
type AjusteDeObjeto = z.infer<typeof AjusteDeObjetoSchema>;
type Objeto = Estado["luzes"][number];

function nomeDoModelo(estado: Estado, o: Objeto): string {
  return estado.modelos.find((m) => m.id === o.modeloId)?.nome ?? o.nome;
}

function objetosDe(estado: Estado, onde: (o: Objeto) => boolean, modelo?: string): Objeto[] {
  const alvo = modelo === undefined ? undefined : normalizarBusca(modelo);
  return estado.luzes.filter(
    (o) =>
      o.modeloId !== undefined &&
      onde(o) &&
      (alvo === undefined || normalizarBusca(nomeDoModelo(estado, o)).includes(alvo)),
  );
}

function umSo(achados: Objeto[], estado: Estado, onde: string): Objeto {
  const primeiro = achados[0];
  if (!primeiro) throw new ErroDoMcp(`Não há objeto de luz ${onde}.`);
  if (achados.length > 1) {
    throw new ErroDoMcp(
      `Há ${achados.length} objetos ${onde}: ${achados.map((o) => nomeDoModelo(estado, o)).join(", ")}. Diga o \`modelo\`.`,
    );
  }
  return primeiro;
}

export async function tocha(p: TochaPedida, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const ficha = p.ficha
    ? achar(estado.personagens, p.ficha, {
        rotulo: "ficha",
        nomeDe: (x) => x.nome,
        idDe: (x) => x.id,
      })
    : undefined;
  const pontoDe = (nome: string) =>
    achar(
      estado.pontos.filter((x) => x.cenaId === estado.cenaAtivaId),
      nome,
      { rotulo: "ponto", nomeDe: (x) => x.nome, idDe: (x) => x.id },
    );
  const noPonto = (pontoId: string) => (x: Objeto) =>
    x.portador.tipo === "ponto" && x.portador.pontoId === pontoId;

  if (p.acao === "acender") {
    if (!ficha || !p.modelo)
      throw new ErroDoMcp("Acender pede `ficha` e `modelo` (um da mochila).");
    const m = achar(estado.modelos, p.modelo, {
      rotulo: "modelo de objeto",
      nomeDe: (x) => x.nome,
      idDe: (x) => x.id,
    });
    await passo(ctx, lote, "tocha.acender", {
      personagemId: ficha.id,
      modeloId: m.id,
      novoId: novoId("objeto"),
    });
    return `${ficha.nome} acendeu "${m.nome}".`;
  }
  if (p.acao === "pegar") {
    if (!ficha || !p.ponto)
      throw new ErroDoMcp("Pegar pede `ficha` (quem pega) e `ponto` (o suporte).");
    const ponto = pontoDe(p.ponto);
    const o = umSo(
      objetosDe(estado, noPonto(ponto.id), p.modelo),
      estado,
      `no suporte "${ponto.nome}"`,
    );
    await passo(ctx, lote, "ponto.pegar", { id: o.id, personagemId: ficha.id });
    return `${ficha.nome} pegou "${nomeDoModelo(estado, o)}" do suporte "${ponto.nome}".`;
  }
  // Os demais agem num objeto que já existe: na mão da ficha ou num suporte.
  let o: Objeto;
  if (p.ponto && p.acao !== "posar") {
    const ponto = pontoDe(p.ponto);
    o = umSo(objetosDe(estado, noPonto(ponto.id), p.modelo), estado, `no suporte "${ponto.nome}"`);
  } else {
    if (!ficha) throw new ErroDoMcp("Diga `ficha` (quem carrega).");
    o = umSo(
      objetosDe(
        estado,
        (x) => x.portador.tipo === "mao" && x.portador.personagemId === ficha.id,
        p.modelo,
      ),
      estado,
      `na mão de ${ficha.nome}`,
    );
  }
  const nome = nomeDoModelo(estado, o);
  switch (p.acao) {
    case "alternar":
      await passo(ctx, lote, "tocha.alternar", { id: o.id });
      return `"${nome}": ${o.estado === "acesa" ? "apagou" : "acendeu"}.`;
    case "guardar":
      await passo(ctx, lote, "tocha.guardar", { id: o.id });
      return `Guardou "${nome}" na mochila.`;
    case "entregar": {
      if (!p.para) throw new ErroDoMcp("Entregar pede `para` (o token que recebe).");
      const t = achar(
        estado.tokens.filter((x) => x.cenaId === estado.cenaAtivaId),
        p.para,
        { rotulo: "token", nomeDe: (x) => x.nome, idDe: (x) => x.id },
      );
      await passo(ctx, lote, "tocha.entregar", { id: o.id, tokenId: t.id });
      return `Entregou "${nome}" para ${t.nome}.`;
    }
    case "posar": {
      if (!p.ponto) throw new ErroDoMcp("Posar pede `ponto` (o suporte).");
      const ponto = pontoDe(p.ponto);
      await passo(ctx, lote, "tocha.posar", { id: o.id, pontoId: ponto.id });
      return `Pôs "${nome}" no suporte "${ponto.nome}".`;
    }
    default:
      throw new ErroDoMcp("Ação de tocha desconhecida.");
  }
}

export async function ajustar(p: AjusteDeObjeto, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  let o = estado.luzes.find((x) => x.id === p.objeto);
  if (!o) {
    const ficha = p.ficha
      ? achar(estado.personagens, p.ficha, {
          rotulo: "ficha",
          nomeDe: (x) => x.nome,
          idDe: (x) => x.id,
        })
      : undefined;
    o = umSo(
      objetosDe(
        estado,
        (x) => !ficha || (x.portador.tipo === "mao" && x.portador.personagemId === ficha.id),
        p.objeto,
      ),
      estado,
      `chamado "${p.objeto}"`,
    );
  }
  const a = p.ajuste;
  let ajuste: Record<string, unknown>;
  switch (a.acao) {
    case "tempo":
      ajuste = {
        acao: "tempo",
        deltaMs: Math.round(a.minutos * 60_000),
        ...(a.nota ? { nota: a.nota } : {}),
      };
      break;
    case "modificar":
      ajuste = {
        acao: "modificar",
        modificador: {
          id: novoId("mod"),
          raioX: a.raioX,
          ...(a.duracaoMin ? { duracaoMs: Math.round(a.duracaoMin * 60_000) } : {}),
          ...(a.nota ? { nota: a.nota } : {}),
        },
      };
      break;
    case "tirarModificador":
      ajuste = { acao: "tirarModificador", id: a.id };
      break;
    case "consumir":
      ajuste = { acao: "consumir" };
      break;
  }
  await passo(ctx, lote, "objeto.ajustar", { id: o.id, ajuste });
  return `Ajustou "${nomeDoModelo(estado, o)}" (${a.acao}).`;
}
