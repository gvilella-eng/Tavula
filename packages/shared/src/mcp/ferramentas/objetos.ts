import { z } from "zod";
import { type Estado, type ModeloDeObjeto, type PontoDeLuz, pode } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { num } from "../formato.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { animacaoPorNome } from "./achados.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";
import { emMetros, ParSchema } from "./cenasUtil.ts";
import { AjusteDeObjetoSchema, ajustar, TochaPedidaSchema, tocha } from "./objetosM2.ts";

const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const ChamaSchema = z
  .object({
    larguraM: z.number().min(0.1).max(30),
    alturaM: z.number().min(0.1).max(30),
  })
  .strict();

const AnimacoesSchema = z
  .object({
    forte: z.string().min(1).max(200).optional(),
    fraca: z.string().min(1).max(200).optional(),
    morrendo: z.string().min(1).max(200).optional(),
  })
  .strict();

const ModeloPedidoSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe modelo com o nome, ele é editado; senão, criado."),
    claraM: z.number().min(0).max(500).optional().describe("Raio da luz plena, em metros."),
    penumbraM: z.number().min(0).max(500).optional().describe("Raio da penumbra, em metros."),
    cor: Cor.optional().describe("#rrggbb (padrão #ffb347)."),
    tremula: z.boolean().optional(),
    duracaoMin: z
      .number()
      .positive()
      .max(6000)
      .nullable()
      .optional()
      .describe("Minutos até apagar; null = não se consome."),
    ocupaMao: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(32)).max(12).optional().describe('Ex.: ["chama"].'),
    chama: ChamaSchema.optional().describe(
      "Tamanho padrão da chama no mapa, em metros (largura e altura, esticada como uma imagem).",
    ),
    animacoes: AnimacoesSchema.optional().describe(
      'Animação da chama por estágio (forte, fraca, morrendo): o nome de um arquivo já enviado (ferramenta `arquivos`, uso `animacao`) ou "padrao" para a animação padrão da mesa. Estágio que você não cita fica como está.',
    ),
    apagar: z.boolean().optional(),
  })
  .strict();

const PontoPedidoSchema = z
  .object({
    cena: z.string().describe("Nome da cena."),
    nome: z.string().min(1).max(64),
    em: ParSchema.optional().describe("[coluna, linha] em células (centro do quadrado)."),
    tipo: z
      .enum(["suporte", "inflamavel"])
      .optional()
      .describe(
        "suporte: onde se solta a tocha. inflamavel: acende o modelo ao segurar uma tocha acesa em cima.",
      ),
    capacidade: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe("Suporte: quantos objetos cabem."),
    modelo: z.string().optional().describe("Inflamável: nome do modelo que ele vira ao queimar."),
    segurarS: z.number().min(0).max(60).optional(),
    chama: ChamaSchema.nullable()
      .optional()
      .describe(
        "Inflamável: tamanho da chama dele, em metros (aceso ou não; esticada como uma imagem). null volta ao tamanho do modelo.",
      ),
    visivelParaJogadores: z.boolean().optional().describe("Padrão sim."),
    apagar: z.boolean().optional(),
  })
  .strict();

const LuzPedidaSchema = z
  .object({
    cena: z.string().describe("Nome da cena."),
    nome: z.string().min(1).max(64),
    em: ParSchema.optional().describe("[coluna, linha] em células."),
    token: z
      .string()
      .optional()
      .describe(
        "Em vez de `em`: nome de um token da cena que carrega a luz (criatura que brilha).",
      ),
    claraM: z.number().min(0).max(500).optional(),
    penumbraM: z.number().min(0).max(500).optional(),
    cor: Cor.optional(),
    tremula: z.boolean().optional(),
    intensidade: z.number().min(0).max(1).optional().describe("0 a 1 (padrão 1)."),
    acesa: z.boolean().optional().describe("Padrão sim."),
    apagar: z.boolean().optional(),
  })
  .strict();

type ModeloPedido = z.infer<typeof ModeloPedidoSchema>;
type PontoPedido = z.infer<typeof PontoPedidoSchema>;
type LuzPedida = z.infer<typeof LuzPedidaSchema>;

function cenaDe(estado: Estado, nome: string) {
  return achar(estado.cenas, nome, { rotulo: "cena", nomeDe: (c) => c.nome, idDe: (c) => c.id });
}

/** FG1: as animações pedidas viram hashes; "padrao" tira a do estágio. Devolve o objeto inteiro que vale depois. */
function animacoesPedidas(
  pedidas: ModeloPedido["animacoes"],
  estado: Estado,
  atuais: ModeloDeObjeto["animacoes"],
): Record<string, string> | undefined {
  if (pedidas === undefined) return undefined;
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(atuais ?? {})) if (v) saida[k] = v;
  for (const [estagio, nome] of Object.entries(pedidas)) {
    if (nome === undefined) continue;
    const n = nome.trim().toLowerCase();
    if (n === "padrao" || n === "padrão") delete saida[estagio];
    else saida[estagio] = animacaoPorNome(estado, nome).hash;
  }
  return saida;
}

async function modelo(p: ModeloPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(estado.modelos, p.nome, (m) => m.nome);
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe o modelo "${p.nome}".`);
    await passo(ctx, lote, "modelo.apagar", { id: existente.id });
    return `Apagou o modelo "${existente.nome}".`;
  }
  const duracaoS =
    p.duracaoMin === undefined
      ? undefined
      : p.duracaoMin === null
        ? null
        : Math.round(p.duracaoMin * 60);
  const animacoes = animacoesPedidas(p.animacoes, estado, existente?.animacoes);
  if (!existente) {
    if (p.claraM === undefined) {
      throw new ErroDoMcp(
        "Para criar um modelo, diga ao menos `claraM` (raio da luz plena, em metros).",
      );
    }
    const novo: ModeloDeObjeto = {
      id: novoId("modelo"),
      nome: p.nome,
      luz: {
        claraM: p.claraM,
        penumbraM: p.penumbraM ?? p.claraM,
        cor: p.cor ?? "#ffb347",
        tremula: p.tremula ?? false,
      },
      duracaoS: duracaoS === undefined ? null : duracaoS,
      ocupaMao: p.ocupaMao ?? false,
      tags: p.tags ?? [],
      ...(p.chama ? { chamaM: p.chama } : {}),
      ...(animacoes && Object.keys(animacoes).length > 0 ? { animacoes } : {}),
    };
    await passo(ctx, lote, "modelo.criar", { modelo: novo });
    return `Criou o modelo "${p.nome}" (luz ${num(novo.luz.claraM)} m + ${num(novo.luz.penumbraM)} m)${" (rascunho: o mestre revisa e publica)"}.`;
  }
  const luz: Record<string, unknown> = {};
  if (p.claraM !== undefined) luz.claraM = p.claraM;
  if (p.penumbraM !== undefined) luz.penumbraM = p.penumbraM;
  if (p.cor !== undefined) luz.cor = p.cor;
  if (p.tremula !== undefined) luz.tremula = p.tremula;
  const mudancas: Record<string, unknown> = {};
  if (Object.keys(luz).length > 0) mudancas.luz = luz;
  if (duracaoS !== undefined) mudancas.duracaoS = duracaoS;
  if (p.ocupaMao !== undefined) mudancas.ocupaMao = p.ocupaMao;
  if (p.tags !== undefined) mudancas.tags = p.tags;
  if (p.chama !== undefined) mudancas.chamaM = p.chama;
  if (p.animacoes !== undefined) mudancas.animacoes = animacoes ?? {};
  if (Object.keys(mudancas).length === 0) return `O modelo "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "modelo.editar", { id: existente.id, mudancas });
  return `Editou o modelo "${existente.nome}" (${Object.keys(mudancas).join(", ")}).`;
}

async function ponto(p: PontoPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const cena = cenaDe(estado, p.cena);
  const q = cena.grid.quadradoM;
  const existente = acharExato(
    estado.pontos.filter((x) => x.cenaId === cena.id),
    p.nome,
    (x) => x.nome,
  );
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe o ponto "${p.nome}" na cena "${cena.nome}".`);
    await passo(ctx, lote, "ponto.apagar", { id: existente.id });
    return `Apagou o ponto "${existente.nome}".`;
  }
  const modeloId =
    p.modelo === undefined
      ? undefined
      : achar(ctx.sala.estado().modelos, p.modelo, {
          rotulo: "modelo de objeto",
          nomeDe: (m) => m.nome,
          idDe: (m) => m.id,
        }).id;
  if (!existente) {
    if (!p.em) throw new ErroDoMcp("Para criar um ponto, diga onde: `em` [coluna, linha].");
    const pos = emMetros(p.em, q);
    const novo: Omit<PontoDeLuz, "cenaId"> = {
      id: novoId("ponto"),
      nome: p.nome,
      x: pos.x,
      y: pos.y,
      tipo: p.tipo ?? "suporte",
      ...(p.capacidade !== undefined ? { capacidade: p.capacidade } : {}),
      ...(modeloId ? { modeloId } : {}),
      ...(p.segurarS !== undefined ? { segurarS: p.segurarS } : {}),
      ...(p.chama ? { chamaM: p.chama } : {}),
      visivelParaJogadores: p.visivelParaJogadores ?? true,
    };
    await passo(ctx, lote, "ponto.criar", { cenaId: cena.id, ponto: novo });
    return `Criou o ponto "${p.nome}" (${novo.tipo}) em "${cena.nome}".`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.em) Object.assign(mudancas, emMetros(p.em, q));
  if (p.capacidade !== undefined) mudancas.capacidade = p.capacidade;
  if (modeloId) mudancas.modeloId = modeloId;
  if (p.segurarS !== undefined) mudancas.segurarS = p.segurarS;
  if (p.chama !== undefined) mudancas.chamaM = p.chama;
  if (p.visivelParaJogadores !== undefined) mudancas.visivelParaJogadores = p.visivelParaJogadores;
  if (Object.keys(mudancas).length === 0) return `O ponto "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "ponto.editar", { id: existente.id, mudancas });
  return `Editou o ponto "${existente.nome}".`;
}

async function luz(p: LuzPedida, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const cena = cenaDe(estado, p.cena);
  const q = cena.grid.quadradoM;
  const existente = acharExato(
    estado.luzes.filter((x) => x.cenaId === cena.id && x.modeloId === undefined),
    p.nome,
    (x) => x.nome,
  );
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe a luz "${p.nome}" na cena "${cena.nome}".`);
    await passo(ctx, lote, "fonte.apagar", { id: existente.id });
    return `Apagou a luz "${existente.nome}".`;
  }
  if (p.em !== undefined && p.token !== undefined) {
    throw new ErroDoMcp("Use `em` ou `token`, não os dois.");
  }
  const portador = p.token
    ? {
        tipo: "token" as const,
        tokenId: achar(
          estado.tokens.filter((t) => t.cenaId === cena.id),
          p.token,
          { rotulo: "token", nomeDe: (t) => t.nome, idDe: (t) => t.id },
        ).id,
      }
    : p.em
      ? { tipo: "cena" as const, ...emMetros(p.em, q) }
      : undefined;
  if (!existente) {
    if (!portador)
      throw new ErroDoMcp("Para criar uma luz, diga onde: `em` [coluna, linha] ou `token`.");
    if (p.claraM === undefined)
      throw new ErroDoMcp("Para criar uma luz, diga `claraM` (raio em metros).");
    const fonte = {
      id: novoId("luz"),
      nome: p.nome,
      portador,
      luz: {
        claraM: p.claraM,
        penumbraM: p.penumbraM ?? p.claraM,
        cor: p.cor ?? "#ffd98a",
        tremula: p.tremula ?? false,
      },
      intensidade: p.intensidade ?? 1,
      estado: p.acesa === false ? ("apagada" as const) : ("acesa" as const),
    };
    await passo(ctx, lote, "fonte.criar", { cenaId: cena.id, fonte });
    return `Criou a luz "${p.nome}" em "${cena.nome}".`;
  }
  const luzMuda: Record<string, unknown> = {};
  if (p.claraM !== undefined) luzMuda.claraM = p.claraM;
  if (p.penumbraM !== undefined) luzMuda.penumbraM = p.penumbraM;
  if (p.cor !== undefined) luzMuda.cor = p.cor;
  if (p.tremula !== undefined) luzMuda.tremula = p.tremula;
  const mudancas: Record<string, unknown> = {};
  if (Object.keys(luzMuda).length > 0) mudancas.luz = luzMuda;
  if (portador) mudancas.portador = portador;
  if (p.intensidade !== undefined) mudancas.intensidade = p.intensidade;
  if (p.acesa !== undefined) mudancas.estado = p.acesa ? "acesa" : "apagada";
  if (Object.keys(mudancas).length === 0) return `A luz "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "fonte.editar", { id: existente.id, mudancas });
  return `Editou a luz "${existente.nome}".`;
}

export const objetos = definir({
  nome: "objetos",
  descricao:
    'Só do mestre. Cria, edita e apaga modelos de objeto de luz (Tocha, Lanterna...), pontos do mapa (suportes e inflamáveis) e luzes fixas, em lote. Se já existe um com o nome, edita. Coordenadas em células. Durante a sessão: `tocha` ([{acao: acender|alternar|guardar|entregar|posar|pegar, ficha, modelo, ponto, para}]) e `ajustes` ([{objeto, ficha, ajuste: {acao: tempo|modificar|tirarModificador|consumir}}]). (Os itens da ficha de um jogador vão em `fichas`.) Exemplo: {"modelos":[{"nome":"Archote","claraM":4.5,"penumbraM":4.5,"duracaoMin":30,"ocupaMao":true,"tags":["chama"]}],"pontos":[{"cena":"Eclusa","nome":"Suporte da entrada","em":[3.5,2.5],"tipo":"suporte"}]}',
  entrada: z
    .object({
      modelos: z.array(ModeloPedidoSchema).max(30).optional(),
      pontos: z.array(PontoPedidoSchema).max(60).optional(),
      luzes: z.array(LuzPedidaSchema).max(60).optional(),
      tocha: z.array(TochaPedidaSchema).max(20).optional(),
      ajustes: z.array(AjusteDeObjetoSchema).max(20).optional(),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "cena.editar", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const total =
      (e.modelos?.length ?? 0) +
      (e.pontos?.length ?? 0) +
      (e.luzes?.length ?? 0) +
      (e.tocha?.length ?? 0) +
      (e.ajustes?.length ?? 0);
    if (total === 0) {
      return "Nada a fazer: diga `modelos`, `pontos`, `luzes`, `tocha` ou `ajustes`.";
    }
    const lote = ctx.novoLote(
      `objetos: ${e.modelos?.length ?? 0} modelos, ${e.pontos?.length ?? 0} pontos, ${e.luzes?.length ?? 0} luzes`,
    );
    await cadaItem(
      e.modelos ?? [],
      (m) => `modelo "${m.nome}"`,
      (m) => modelo(m, ctx, lote),
      r,
    );
    await cadaItem(
      e.pontos ?? [],
      (x) => `ponto "${x.nome}"`,
      (x) => ponto(x, ctx, lote),
      r,
    );
    await cadaItem(
      e.luzes ?? [],
      (l) => `luz "${l.nome}"`,
      (l) => luz(l, ctx, lote),
      r,
    );
    await cadaItem(
      e.tocha ?? [],
      (t) => `tocha (${t.acao})`,
      (t) => tocha(t, ctx, lote),
      r,
    );
    await cadaItem(
      e.ajustes ?? [],
      (a) => `ajuste de "${a.objeto}"`,
      (a) => ajustar(a, ctx, lote),
      r,
    );
    return r.saida();
  },
});
