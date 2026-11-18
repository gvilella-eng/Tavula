import { z } from "zod";
import {
  type Acao,
  AcaoSchema,
  automacoesDe,
  type CondicaoDeReacao,
  CondicaoDeReacaoSchema,
  EfeitosDaZonaSchema,
  type Estado,
  FaseSchema,
  type Fica,
  NomeDeEventoSchema,
  ParaQuemOSomSchema,
  pode,
  VolumeSchema,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { somPorNome } from "./achados.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";
import { emMetros, ParSchema } from "./cenasUtil.ts";

// Q16: o som de uma zona ou de uma reação, pelo NOME do arquivo (ou o começo do hash), como o resto do MCP.
const SomPorNomeSchema = z
  .object({
    hash: z
      .string()
      .min(1)
      .max(200)
      .describe(
        'O arquivo de som: o nome ("vento.mp3") ou o começo do hash (veja `arquivos` listar).',
      ),
    nome: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Rótulo; padrão: o nome do arquivo."),
    volume: VolumeSchema.default(0.8),
    laco: z.boolean().default(true),
  })
  .strict();

const EfeitosDoMcpSchema = EfeitosDaZonaSchema.extend({ som: SomPorNomeSchema.optional() });

const SomTocarDoMcpSchema = z.object({
  acao: z.literal("som.tocar"),
  hash: SomPorNomeSchema.shape.hash,
  nome: SomPorNomeSchema.shape.nome,
  volume: VolumeSchema.default(0.8),
  para: ParaQuemOSomSchema.default("todos"),
});

/** As ações das reações, com o som por nome no lugar do hash. */
const AcaoDoMcpSchema = z.discriminatedUnion(
  "acao",
  AcaoSchema.options.map((o) =>
    o.shape.acao.value === "som.tocar" ? SomTocarDoMcpSchema : o,
  ) as unknown as [typeof SomTocarDoMcpSchema, ...(typeof AcaoSchema.options)[number][]],
);
type AcaoPedida = z.infer<typeof AcaoDoMcpSchema>;

const CicloPedidoSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe ciclo com o nome, ele é editado; senão, criado."),
    periodoS: z
      .number()
      .positive()
      .max(7 * 86400)
      .optional()
      .describe("Duração do ciclo, em segundos."),
    cenas: z.array(z.string()).optional().describe("Nomes das cenas onde vale. Vazio = todas."),
    fases: z
      .array(FaseSchema)
      .min(1)
      .max(20)
      .optional()
      .describe(
        '[{"emS":0,"evento":"vento.sopra","duracaoS":30}]: no segundo `emS` dispara o evento. `emS` precisa ser menor que `periodoS`.',
      ),
    liberadoParaJogadores: z.boolean().optional(),
    fixado: z.boolean().optional(),
    pausado: z.boolean().optional().describe("Só criação: nasce parado."),
    apagar: z.boolean().optional(),
  })
  .strict();

const FicaPedidoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("mesa") }).strict(),
  z.object({ tipo: z.literal("cena"), nome: z.string() }).strict(),
  z.object({ tipo: z.literal("modelo"), nome: z.string() }).strict(),
  z.object({ tipo: z.literal("zona"), nome: z.string() }).strict(),
]);

const ReacaoPedidoSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe reação com o nome, ela é editada; senão, criada."),
    ativa: z.boolean().optional(),
    fica: FicaPedidoSchema.optional().describe(
      'A quem está presa: {"tipo":"mesa"} ou {"tipo":"cena","nome":"Eclusa"} (também modelo e zona).',
    ),
    ao: NomeDeEventoSchema.optional().describe(
      'O evento que dispara, ex.: "objeto.apagou", "token.entrouNaZona", "vento.sopra".',
    ),
    se: z
      .array(CondicaoDeReacaoSchema)
      .max(8)
      .optional()
      .describe(
        'Condições. Nomes no lugar de ids: {"condicao":"cena","cenas":["Eclusa"]}, {"condicao":"dentroDaZona","zona":"Poça"}.',
      ),
    fazer: z
      .array(AcaoDoMcpSchema)
      .min(1)
      .max(20)
      .optional()
      .describe(
        "Ações. Nomes no lugar de ids: alvo.modeloId = nome do modelo; zona = nome da zona; alvo.ids = nomes de tokens; som.tocar: hash = nome do arquivo de som.",
      ),
    apagar: z.boolean().optional(),
  })
  .strict();

const ZonaPedidaSchema = z
  .object({
    cena: z.string().describe("Nome da cena."),
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe zona com o nome nessa cena, ela é editada."),
    pontos: z
      .array(ParSchema)
      .min(3)
      .max(64)
      .optional()
      .describe("O polígono em células: [[2,2],[6,2],[6,5]]."),
    ativa: z.boolean().optional(),
    efeitos: EfeitosDoMcpSchema.optional().describe(
      "Valem enquanto algo está dentro: luzRaioX, luzSomaM, visaoMaxM e som ({hash: nome do arquivo, volume, laco}). Em edição, os efeitos mandados trocam os anteriores: mande todos.",
    ),
    apagar: z.boolean().optional(),
  })
  .strict();

const BotaoPedidoSchema = z
  .object({
    nome: z.string().min(1).max(40),
    evento: NomeDeEventoSchema.optional(),
    cena: z.string().nullable().optional().describe("Só nesta cena (nome); null = todas."),
    fixado: z.boolean().optional(),
    liberadoParaJogadores: z.boolean().optional(),
    apagar: z.boolean().optional(),
  })
  .strict();

type CicloPedido = z.infer<typeof CicloPedidoSchema>;
type ReacaoPedido = z.infer<typeof ReacaoPedidoSchema>;
type ZonaPedida = z.infer<typeof ZonaPedidaSchema>;
type BotaoPedido = z.infer<typeof BotaoPedidoSchema>;

const cenaDe = (estado: Estado, nome: string) =>
  achar(estado.cenas, nome, { rotulo: "cena", nomeDe: (c) => c.nome, idDe: (c) => c.id });
const zonaDe = (estado: Estado, nome: string) =>
  achar(estado.zonas ?? [], nome, { rotulo: "zona", nomeDe: (z2) => z2.nome, idDe: (z2) => z2.id });
const modeloDe = (estado: Estado, nome: string) =>
  achar(estado.modelos, nome, {
    rotulo: "modelo de objeto",
    nomeDe: (m) => m.nome,
    idDe: (m) => m.id,
  });

/** Troca nomes por ids dentro de uma ação (modelo, zona e tokens). */
export function traduzirAcao(a: AcaoPedida, estado: Estado): Acao {
  const copia = JSON.parse(JSON.stringify(a)) as Record<string, unknown>;
  if (a.acao === "som.tocar") {
    const s = somPorNome(estado, a.hash);
    copia.hash = s.hash;
    copia.nome = a.nome ?? s.nomeOriginal;
  }
  const alvo = copia.alvo as Record<string, unknown> | undefined;
  if (alvo && typeof alvo.modeloId === "string") alvo.modeloId = modeloDe(estado, alvo.modeloId).id;
  if (alvo && Array.isArray(alvo.ids)) {
    alvo.ids = (alvo.ids as string[]).map(
      (n) =>
        achar(estado.tokens, n, { rotulo: "token", nomeDe: (t) => t.nome, idDe: (t) => t.id }).id,
    );
  }
  if (typeof copia.zona === "string") copia.zona = zonaDe(estado, copia.zona).id;
  return copia as Acao;
}

/** Troca nomes por ids dentro de uma condição (cenas e zona). */
export function traduzirCondicao(c: CondicaoDeReacao, estado: Estado): CondicaoDeReacao {
  const copia = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
  if (Array.isArray(copia.cenas)) {
    copia.cenas = (copia.cenas as string[]).map((n) => cenaDe(estado, n).id);
  }
  if (typeof copia.zona === "string") copia.zona = zonaDe(estado, copia.zona).id;
  return copia as CondicaoDeReacao;
}

function traduzirFica(f: z.infer<typeof FicaPedidoSchema>, estado: Estado): Fica {
  if (f.tipo === "mesa") return { tipo: "mesa" };
  if (f.tipo === "cena") return { tipo: "cena", id: cenaDe(estado, f.nome).id };
  if (f.tipo === "modelo") return { tipo: "modelo", id: modeloDe(estado, f.nome).id };
  return { tipo: "zona", id: zonaDe(estado, f.nome).id };
}

async function ciclo(p: CicloPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(automacoesDe(estado).ciclos, p.nome, (c) => c.nome);
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe o ciclo "${p.nome}".`);
    await passo(ctx, lote, "ciclo.apagar", { id: existente.id });
    return `Apagou o ciclo "${existente.nome}".`;
  }
  const cenas = p.cenas?.map((n) => cenaDe(estado, n).id);
  if (!existente) {
    if (p.periodoS === undefined || p.fases === undefined) {
      throw new ErroDoMcp("Para criar um ciclo, diga `periodoS` (segundos) e `fases`.");
    }
    const novo = {
      id: novoId("ciclo"),
      nome: p.nome,
      periodoS: p.periodoS,
      cenas: cenas ?? [],
      fases: p.fases,
      ...(p.liberadoParaJogadores !== undefined
        ? { liberadoParaJogadores: p.liberadoParaJogadores }
        : {}),
      ...(p.fixado !== undefined ? { fixado: p.fixado } : {}),
    };
    await passo(ctx, lote, "ciclo.criar", {
      ciclo: novo,
      ...(p.pausado !== undefined ? { pausado: p.pausado } : {}),
    });
    return `Criou o ciclo "${p.nome}" (${p.fases.length} fases em ${p.periodoS} s) (rascunho: não roda até o mestre publicar).`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.periodoS !== undefined) mudancas.periodoS = p.periodoS;
  if (cenas !== undefined) mudancas.cenas = cenas;
  if (p.fases !== undefined) mudancas.fases = p.fases;
  if (p.liberadoParaJogadores !== undefined)
    mudancas.liberadoParaJogadores = p.liberadoParaJogadores;
  if (p.fixado !== undefined) mudancas.fixado = p.fixado;
  if (Object.keys(mudancas).length === 0) return `O ciclo "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "ciclo.editar", { id: existente.id, mudancas });
  return `Editou o ciclo "${existente.nome}" (${Object.keys(mudancas).join(", ")}).`;
}

async function reacao(p: ReacaoPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(automacoesDe(estado).reacoes, p.nome, (r) => r.nome ?? "");
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe a reação "${p.nome}".`);
    await passo(ctx, lote, "reacao.apagar", { id: existente.id });
    return `Apagou a reação "${p.nome}".`;
  }
  const fica = p.fica ? traduzirFica(p.fica, estado) : undefined;
  const se = p.se?.map((c) => traduzirCondicao(c, estado));
  const fazer = p.fazer?.map((a) => traduzirAcao(a, estado));
  if (!existente) {
    if (p.ao === undefined || fazer === undefined) {
      throw new ErroDoMcp("Para criar uma reação, diga `ao` (o evento) e `fazer` (as ações).");
    }
    const nova = {
      id: novoId("reacao"),
      nome: p.nome,
      ativa: p.ativa ?? true,
      fica: fica ?? { tipo: "mesa" as const },
      ao: p.ao,
      se: se ?? [],
      fazer,
    };
    await passo(ctx, lote, "reacao.criar", { reacao: nova });
    return `Criou a reação "${p.nome}" (ao evento ${p.ao}) (rascunho: não roda até o mestre publicar).`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.ativa !== undefined) mudancas.ativa = p.ativa;
  if (fica) mudancas.fica = fica;
  if (p.ao !== undefined) mudancas.ao = p.ao;
  if (se) mudancas.se = se;
  if (fazer) mudancas.fazer = fazer;
  if (Object.keys(mudancas).length === 0) return `A reação "${p.nome}" não mudou.`;
  await passo(ctx, lote, "reacao.editar", { id: existente.id, mudancas });
  return `Editou a reação "${p.nome}" (${Object.keys(mudancas).join(", ")}).`;
}

/** Os efeitos da zona com o som resolvido: o nome do arquivo vira o hash. */
function efeitosDaZona(e: ZonaPedida["efeitos"], estado: Estado): Record<string, unknown> {
  if (!e) return {};
  const { som, ...resto } = e;
  if (!som) return resto;
  const s = somPorNome(estado, som.hash);
  return {
    ...resto,
    som: { hash: s.hash, nome: som.nome ?? s.nomeOriginal, volume: som.volume, laco: som.laco },
  };
}

async function zona(p: ZonaPedida, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const cena = cenaDe(estado, p.cena);
  const q = cena.grid.quadradoM;
  const existente = acharExato(
    (estado.zonas ?? []).filter((z2) => z2.cenaId === cena.id),
    p.nome,
    (z2) => z2.nome,
  );
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe a zona "${p.nome}" na cena "${cena.nome}".`);
    await passo(ctx, lote, "zona.apagar", { id: existente.id });
    return `Apagou a zona "${existente.nome}".`;
  }
  const pontos = p.pontos?.map((par) => emMetros(par, q));
  if (!existente) {
    if (!pontos) throw new ErroDoMcp("Para criar uma zona, diga `pontos`: o polígono em células.");
    const nova = {
      id: novoId("zona"),
      cenaId: cena.id,
      nome: p.nome,
      pontos,
      ativa: p.ativa ?? true,
      efeitos: efeitosDaZona(p.efeitos, estado),
    };
    await passo(ctx, lote, "zona.criar", { zona: nova });
    return `Criou a zona "${p.nome}" em "${cena.nome}" (rascunho).`;
  }
  const mudancas: Record<string, unknown> = {};
  if (pontos) mudancas.pontos = pontos;
  if (p.ativa !== undefined) mudancas.ativa = p.ativa;
  if (p.efeitos) mudancas.efeitos = efeitosDaZona(p.efeitos, estado);
  if (Object.keys(mudancas).length === 0) return `A zona "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "zona.editar", { id: existente.id, mudancas });
  return `Editou a zona "${existente.nome}" (${Object.keys(mudancas).join(", ")}).`;
}

async function botao(p: BotaoPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(automacoesDe(estado).botoes, p.nome, (b) => b.nome);
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe o botão "${p.nome}".`);
    await passo(ctx, lote, "botao.apagar", { id: existente.id });
    return `Apagou o botão "${existente.nome}".`;
  }
  const cenaId =
    p.cena === undefined ? undefined : p.cena === null ? null : cenaDe(estado, p.cena).id;
  if (!existente) {
    if (p.evento === undefined)
      throw new ErroDoMcp("Para criar um botão, diga o `evento` que ele dispara.");
    const novo = {
      id: novoId("botao"),
      nome: p.nome,
      evento: p.evento,
      ...(cenaId ? { cenaId } : {}),
      ...(p.fixado !== undefined ? { fixado: p.fixado } : {}),
      ...(p.liberadoParaJogadores !== undefined
        ? { liberadoParaJogadores: p.liberadoParaJogadores }
        : {}),
    };
    await passo(ctx, lote, "botao.criar", { botao: novo });
    return `Criou o botão "${p.nome}" (dispara ${p.evento}) (rascunho).`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.evento !== undefined) mudancas.evento = p.evento;
  if (cenaId !== undefined) mudancas.cenaId = cenaId;
  if (p.fixado !== undefined) mudancas.fixado = p.fixado;
  if (p.liberadoParaJogadores !== undefined)
    mudancas.liberadoParaJogadores = p.liberadoParaJogadores;
  if (Object.keys(mudancas).length === 0) return `O botão "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "botao.editar", { id: existente.id, mudancas });
  return `Editou o botão "${existente.nome}".`;
}

// M2: o que o mestre faz com as automações DURANTE a sessão (disparar um ciclo, pausar, soltar um evento, apertar um botão).
const AcionarSchema = z
  .object({
    ciclo: z.string().describe("Nome do ciclo."),
    acao: z
      .enum(["disparar", "pausar", "retomar"])
      .describe(
        "disparar pula para a fase seguinte agora; pausar/retomar só o ciclo (as tochas seguem).",
      ),
  })
  .strict();

const EventoPedidoSchema = z
  .object({
    evento: NomeDeEventoSchema.describe("O nome do evento, como as reações o escutam."),
    cena: z.string().optional().describe("Só nesta cena (nome); sem isso, em todas."),
  })
  .strict();

const UsarBotaoSchema = z
  .object({
    botao: z.string().describe("Nome do botão de evento ou do ciclo fixado."),
    acao: z
      .enum(["disparar", "pausar", "retomar"])
      .optional()
      .describe("Só em ciclo (padrão: disparar)."),
  })
  .strict();

async function acionar(
  p: z.infer<typeof AcionarSchema>,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const c = achar(automacoesDe(ctx.sala.estado()).ciclos, p.ciclo, {
    rotulo: "ciclo",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  const tipo = { disparar: "ciclo.disparar", pausar: "ciclo.pausar", retomar: "ciclo.retomar" }[
    p.acao
  ];
  await passo(ctx, lote, tipo, { id: c.id });
  return `Ciclo "${c.nome}": ${p.acao}.`;
}

async function soltarEvento(
  p: z.infer<typeof EventoPedidoSchema>,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const estado = ctx.sala.estado();
  const cena = p.cena === undefined ? undefined : cenaDe(estado, p.cena);
  await passo(ctx, lote, "evento.disparar", {
    evento: p.evento,
    ...(cena ? { cenaId: cena.id } : {}),
  });
  return `Disparou o evento "${p.evento}"${cena ? ` na cena "${cena.nome}"` : " em todas as cenas"}.`;
}

async function usarBotao(
  p: z.infer<typeof UsarBotaoSchema>,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const a = automacoesDe(ctx.sala.estado());
  const alvos = [
    ...a.botoes.map((b) => ({ id: `evento:${b.id}`, nome: b.nome, ciclo: false })),
    ...a.ciclos.map((c) => ({ id: `ciclo:${c.id}`, nome: c.nome, ciclo: true })),
  ];
  const b = achar(alvos, p.botao, { rotulo: "botão", nomeDe: (x) => x.nome, idDe: (x) => x.id });
  if (p.acao && !b.ciclo) throw new ErroDoMcp("`acao` só vale para um botão de ciclo.");
  await passo(ctx, lote, "botao.usar", { botaoId: b.id, ...(p.acao ? { acao: p.acao } : {}) });
  return `Apertou o botão "${b.nome}"${p.acao ? ` (${p.acao})` : ""}.`;
}

export const automacoes = definir({
  nome: "automacoes",
  descricao:
    'Só do mestre. Cria e edita automações em lote: ciclos (fases que disparam eventos), reações ("ao evento X, faça Y"), zonas (polígonos com efeitos) e botões de evento. Se já existe um com o nome, edita. Tudo entra como rascunho e não roda até o mestre publicar. Nomes no lugar de ids. Ordem: zonas, depois ciclos e reações que as usam. Durante a sessão: `acionar` ([{ciclo, acao: disparar|pausar|retomar}]), `eventos` ([{evento, cena}] dispara agora) e `usarBotoes` ([{botao}] aperta um botão de evento ou de ciclo); o que ainda é rascunho não roda. Exemplo: {"zonas":[{"cena":"Eclusa","nome":"Poça","pontos":[[4,4],[8,4],[8,7]],"efeitos":{"visaoMaxM":3}}],"ciclos":[{"nome":"Vento","periodoS":600,"fases":[{"emS":0,"evento":"vento.sopra","duracaoS":60}]}]}',
  entrada: z
    .object({
      zonas: z.array(ZonaPedidaSchema).max(30).optional(),
      ciclos: z.array(CicloPedidoSchema).max(20).optional(),
      reacoes: z.array(ReacaoPedidoSchema).max(40).optional(),
      botoes: z.array(BotaoPedidoSchema).max(20).optional(),
      acionar: z.array(AcionarSchema).max(20).optional(),
      eventos: z.array(EventoPedidoSchema).max(20).optional(),
      usarBotoes: z.array(UsarBotaoSchema).max(20).optional(),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "automacao.editar", estado.permissoes),
  async executar(e, ctx) {
    const total =
      (e.zonas?.length ?? 0) +
      (e.ciclos?.length ?? 0) +
      (e.reacoes?.length ?? 0) +
      (e.botoes?.length ?? 0) +
      (e.acionar?.length ?? 0) +
      (e.eventos?.length ?? 0) +
      (e.usarBotoes?.length ?? 0);
    if (total === 0) {
      return "Nada a fazer: diga `zonas`, `ciclos`, `reacoes`, `botoes`, `acionar`, `eventos` ou `usarBotoes`.";
    }
    const r = new Relatorio();
    const lote = ctx.novoLote(
      `automações: ${e.zonas?.length ?? 0} zonas, ${e.ciclos?.length ?? 0} ciclos, ${e.reacoes?.length ?? 0} reações, ${e.botoes?.length ?? 0} botões`,
    );
    await cadaItem(
      e.zonas ?? [],
      (z2) => `zona "${z2.nome}"`,
      (z2) => zona(z2, ctx, lote),
      r,
    );
    await cadaItem(
      e.ciclos ?? [],
      (c) => `ciclo "${c.nome}"`,
      (c) => ciclo(c, ctx, lote),
      r,
    );
    await cadaItem(
      e.reacoes ?? [],
      (x) => `reação "${x.nome}"`,
      (x) => reacao(x, ctx, lote),
      r,
    );
    await cadaItem(
      e.botoes ?? [],
      (b) => `botão "${b.nome}"`,
      (b) => botao(b, ctx, lote),
      r,
    );
    await cadaItem(
      e.acionar ?? [],
      (a) => `ciclo "${a.ciclo}"`,
      (a) => acionar(a, ctx, lote),
      r,
    );
    await cadaItem(
      e.eventos ?? [],
      (x) => `evento "${x.evento}"`,
      (x) => soltarEvento(x, ctx, lote),
      r,
    );
    await cadaItem(
      e.usarBotoes ?? [],
      (b) => `botão "${b.botao}"`,
      (b) => usarBotao(b, ctx, lote),
      r,
    );
    return r.saida();
  },
});
