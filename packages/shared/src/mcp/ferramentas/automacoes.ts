import { z } from "zod";
import {
  AcaoDeFluxoSchema,
  automacoesDe,
  type Bloco,
  BlocoSchema,
  criarBlocoSchema,
  EfeitosDaZonaSchema,
  type Estado,
  type Fluxo,
  FluxoSchema,
  fraseDoFluxo,
  GatilhoSchema,
  MAXIMO_DE_BLOCOS_POR_FLUXO,
  MAXIMO_DE_EXECUCOES_ESPERANDO,
  MAXIMO_DE_FLUXOS,
  MAXIMO_DE_TRILHAS,
  nomesDaMesa,
  ParaQuemOSomSchema,
  PRAZO_PADRAO_S,
  PROFUNDIDADE_DA_ARVORE,
  PROFUNDIDADE_MAXIMA,
  pode,
  problemasDoFluxo,
  referenciasDaMesa,
  TETO_DE_ACOES,
  VolumeSchema,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { somPorNome } from "./achados.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";
import { emMetros, ParSchema } from "./cenasUtil.ts";

// Q16: o som de uma zona ou de uma ação, pelo NOME do arquivo (ou o começo do hash), como o resto do MCP.
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

/** As ações dos blocos, com o som por nome no lugar do hash. */
const AcaoDoMcpSchema = z.discriminatedUnion(
  "acao",
  AcaoDeFluxoSchema.options.map((o) =>
    o.shape.acao.value === "som.tocar" ? SomTocarDoMcpSchema : o,
  ) as unknown as [typeof SomTocarDoMcpSchema, ...(typeof AcaoDeFluxoSchema.options)[number][]],
);

/** O bloco como o Claude o manda: os mesmos tipos, mas com nomes de zona, modelo, cena, token e som no lugar dos ids. */
const BlocoDoMcpSchema = criarBlocoSchema(AcaoDoMcpSchema);

const FluxoPedidoSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe automação com o nome, ela é editada; senão, criada."),
    ligado: z.boolean().optional().describe("Padrão: ligada."),
    cenas: z
      .array(z.string())
      .nullable()
      .optional()
      .describe("Nomes das cenas onde vale. Vazio ou null = todas."),
    fixado: z.boolean().optional().describe("O chip fica na barra de cima do mestre."),
    liberadoParaJogadores: z.boolean().optional(),
    gatilho: GatilhoSchema.optional().describe(
      'O "Quando", com NOMES (modelo, zona, cena): {"tipo":"relogio","cadaS":180}, {"tipo":"botao","nome":"Soprar"}, {"tipo":"sinal","nome":"vento"}, {"tipo":"tocha","muda":"acende","etiqueta":"chama"}, {"tipo":"zona","quando":"entra","zona":"Poça"}, {"tipo":"turno"}, {"tipo":"cena","cena":"Eclusa"}. Chame `guia` para a explicação.',
    ),
    trilhas: z
      .array(z.array(BlocoDoMcpSchema))
      .min(1)
      .max(MAXIMO_DE_TRILHAS)
      .optional()
      .describe(
        'Cada trilha é uma lista de blocos: {"bloco":"esperar","s":90}, {"bloco":"se",...}, {"bloco":"sortear",...}, {"bloco":"paraCada",...}, {"bloco":"acao","acao":{...}}, {"bloco":"sinal","nome":"x"}. Nomes no lugar de ids; som.tocar: hash = nome do arquivo. Chame `guia`.',
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

type FluxoPedido = z.infer<typeof FluxoPedidoSchema>;
type ZonaPedida = z.infer<typeof ZonaPedidaSchema>;

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

// --- Nomes no lugar de ids -------------------------------------------------------------------

type Solto = Record<string, unknown>;

/** Troca os nomes de um gatilho por ids. */
function traduzirGatilho(g: Solto, estado: Estado): Solto {
  const c = { ...g };
  if (typeof c.cena === "string") c.cena = cenaDe(estado, c.cena).id;
  if (typeof c.modelo === "string") c.modelo = modeloDe(estado, c.modelo).id;
  if (typeof c.zona === "string") c.zona = zonaDe(estado, c.zona).id;
  return c;
}

/** Troca os nomes de um bloco (e dos blocos de dentro) por ids. */
export function traduzirBloco(b: Bloco, estado: Estado): Bloco {
  const c = JSON.parse(JSON.stringify(b)) as Solto;
  const lista = (v: unknown): unknown =>
    Array.isArray(v) ? v.map((x) => traduzirBloco(x as Bloco, estado)) : v;
  if (c.bloco === "se") {
    const cond = { ...(c.condicao as Solto) };
    if (typeof cond.zona === "string") cond.zona = zonaDe(estado, cond.zona).id;
    if (Array.isArray(cond.cenas))
      cond.cenas = (cond.cenas as string[]).map((n) => cenaDe(estado, n).id);
    c.condicao = cond;
  }
  if (c.bloco === "se" || c.bloco === "sortear") {
    c.sim = lista(c.sim);
    c.nao = lista(c.nao);
  }
  if (c.bloco === "paraCada") {
    const alvo = { ...(c.alvo as Solto) };
    if (typeof alvo.modelo === "string") alvo.modelo = modeloDe(estado, alvo.modelo).id;
    if (typeof alvo.naZona === "string") alvo.naZona = zonaDe(estado, alvo.naZona).id;
    if (typeof alvo.naCena === "string") alvo.naCena = cenaDe(estado, alvo.naCena).id;
    if (Array.isArray(alvo.ids)) {
      alvo.ids = (alvo.ids as string[]).map(
        (n) =>
          achar(estado.tokens, n, { rotulo: "token", nomeDe: (t) => t.nome, idDe: (t) => t.id }).id,
      );
    }
    c.alvo = alvo;
    c.corpo = lista(c.corpo);
  }
  if (c.bloco === "acao") {
    const a = { ...(c.acao as Solto) };
    if (a.acao === "som.tocar") {
      const s = somPorNome(estado, String(a.hash));
      a.hash = s.hash;
      a.nome = a.nome ?? s.nomeOriginal;
    }
    if (typeof a.zona === "string") a.zona = zonaDe(estado, a.zona).id;
    c.acao = a;
  }
  return c as unknown as Bloco;
}

/** "trilha 2, bloco 3 (dentro de “sim”), bloco 1": o lugar de um problema, como o mestre o contaria. */
function lugarDoProblema(caminho: string): string {
  const partes = caminho.split(".");
  if (partes[0] === "nome" || partes[0] === "gatilho" || partes[0] === "cenas") {
    return { nome: "o nome", gatilho: "o gatilho", cenas: "as cenas" }[partes[0]] as string;
  }
  const saida: string[] = [];
  const rotulo: Record<string, string> = {
    sim: "no “sim”",
    nao: "no “não”",
    corpo: "no “para cada”",
  };
  for (const [i, p] of partes.entries()) {
    if (i === 0) continue;
    if (i === 1) saida.push(`trilha ${Number(p) + 1}`);
    else if (/^\d+$/.test(p)) saida.push(`bloco ${Number(p) + 1}`);
    else saida.push(rotulo[p] ?? p);
  }
  return saida.join(", ");
}

/** Confere o fluxo já traduzido; se houver problema, diz onde e o que fazer (o mesmo texto do editor). */
function conferir(fluxo: Fluxo, estado: Estado): void {
  const problemas = problemasDoFluxo(fluxo, referenciasDaMesa(estado));
  if (problemas.length === 0) return;
  throw new ErroDoMcp(
    `A automação "${fluxo.nome}" tem ${problemas.length === 1 ? "um problema" : `${problemas.length} problemas`}: ${problemas
      .slice(0, 6)
      .map((p) => `${lugarDoProblema(p.caminho)}: ${p.mensagem}`)
      .join(" | ")}`,
  );
}

async function fluxo(p: FluxoPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(automacoesDe(estado).fluxos, p.nome, (f) => f.nome);
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe a automação "${p.nome}".`);
    await passo(ctx, lote, "fluxo.apagar", { id: existente.id });
    return `Apagou a automação "${existente.nome}".`;
  }
  const cenas =
    p.cenas === undefined
      ? undefined
      : p.cenas === null
        ? null
        : p.cenas.map((n) => cenaDe(estado, n).id);
  const gatilho = p.gatilho
    ? (traduzirGatilho(p.gatilho as unknown as Solto, estado) as unknown as Fluxo["gatilho"])
    : undefined;
  const trilhas = p.trilhas?.map((t) => t.map((b) => traduzirBloco(b, estado)));
  const nomes = nomesDaMesa(estado);
  if (!existente) {
    if (gatilho === undefined || trilhas === undefined) {
      throw new ErroDoMcp(
        "Para criar uma automação, diga `gatilho` (o Quando) e `trilhas` (os blocos). Chame `guia` se precisar.",
      );
    }
    const nova = FluxoSchema.safeParse({
      id: novoId("fluxo"),
      nome: p.nome,
      ligado: p.ligado ?? true,
      cenas: cenas ?? null,
      ...(p.fixado === undefined ? {} : { fixado: p.fixado }),
      ...(p.liberadoParaJogadores === undefined
        ? {}
        : { liberadoParaJogadores: p.liberadoParaJogadores }),
      gatilho,
      trilhas,
    });
    if (!nova.success) throw new ErroDoMcp(nova.error.issues[0]?.message ?? "Automação inválida.");
    conferir(nova.data, estado);
    await passo(ctx, lote, "fluxo.criar", { fluxo: nova.data });
    return `Criou a automação "${p.nome}" (rascunho: não roda até o mestre publicar). Em português: ${fraseDoFluxo(nova.data, nomes)}`;
  }
  const mudancas: Record<string, unknown> = {};
  if (p.ligado !== undefined) mudancas.ligado = p.ligado;
  if (cenas !== undefined) mudancas.cenas = cenas;
  if (p.fixado !== undefined) mudancas.fixado = p.fixado;
  if (p.liberadoParaJogadores !== undefined)
    mudancas.liberadoParaJogadores = p.liberadoParaJogadores;
  if (gatilho !== undefined) mudancas.gatilho = gatilho;
  if (trilhas !== undefined) mudancas.trilhas = trilhas;
  if (Object.keys(mudancas).length === 0) return `A automação "${existente.nome}" não mudou.`;
  const juntado = FluxoSchema.safeParse({ ...existente, ...mudancas });
  if (!juntado.success)
    throw new ErroDoMcp(juntado.error.issues[0]?.message ?? "Automação inválida.");
  conferir(juntado.data, estado);
  await passo(ctx, lote, "fluxo.editar", { id: existente.id, mudancas });
  return `Editou a automação "${existente.nome}" (${Object.keys(mudancas).join(", ")}). Em português: ${fraseDoFluxo(juntado.data, nomes)}`;
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

// M2: o que o mestre faz com as automações DURANTE a sessão (disparar agora, ligar, desligar, apertar um botão).
const AcionarSchema = z
  .object({
    fluxo: z.string().describe("Nome da automação."),
    acao: z
      .enum(["disparar", "ligar", "desligar"])
      .describe(
        'disparar roda agora, uma vez (como o "Testar agora"); ligar e desligar (desligada, o relógio para e o que esperava é cancelado).',
      ),
  })
  .strict();

const UsarBotaoSchema = z
  .object({
    botao: z.string().describe("Nome da automação de botão (ou de relógio fixada)."),
    acao: z
      .enum(["disparar", "pausar", "retomar"])
      .optional()
      .describe("Só em automação de relógio (padrão: disparar)."),
  })
  .strict();

async function acionar(
  p: z.infer<typeof AcionarSchema>,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const f = achar(automacoesDe(ctx.sala.estado()).fluxos, p.fluxo, {
    rotulo: "automação",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  if (p.acao === "disparar") await passo(ctx, lote, "fluxo.disparar", { id: f.id });
  else await passo(ctx, lote, "fluxo.ligar", { id: f.id, ligado: p.acao === "ligar" });
  return `Automação "${f.nome}": ${p.acao}.`;
}

async function usarBotao(
  p: z.infer<typeof UsarBotaoSchema>,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const a = automacoesDe(ctx.sala.estado());
  const alvos = a.fluxos
    .filter((f) => f.gatilho.tipo === "botao" || f.gatilho.tipo === "relogio")
    .map((f) => ({
      id: f.gatilho.tipo === "relogio" ? `ciclo:${f.id}` : `evento:${f.id}`,
      nome: f.nome,
      relogio: f.gatilho.tipo === "relogio",
    }));
  const b = achar(alvos, p.botao, { rotulo: "botão", nomeDe: (x) => x.nome, idDe: (x) => x.id });
  if (p.acao && !b.relogio) throw new ErroDoMcp("`acao` só vale para uma automação de relógio.");
  await passo(ctx, lote, "botao.usar", { botaoId: b.id, ...(p.acao ? { acao: p.acao } : {}) });
  return `Apertou o botão "${b.nome}"${p.acao ? ` (${p.acao})` : ""}.`;
}

// --- O guia e o explicar ---------------------------------------------------------------------

/**
 * Como as peças funcionam, em texto curto e fiel ao motor. Um teste confere que todo tipo de bloco, de gatilho, de condição
 * e de ação que existe aparece aqui: peça nova sem guia reprova.
 */
export const GUIA_DAS_AUTOMACOES = [
  "AUTOMAÇÕES POR BLOCOS (como funcionam)",
  'Uma automação tem um GATILHO (o "Quando"), as cenas onde vale (vazio = todas) e uma ou mais TRILHAS. Cada trilha é uma lista de blocos, que roda de cima para baixo. Quando o gatilho dispara, todas as trilhas começam juntas.',
  "GATILHOS (campo `gatilho`): " +
    '{"tipo":"relogio","cadaS":180,"primeiroS":0}: a cada tantos segundos, no tempo da mesa (começa na hora em que a mesa corre; `primeiroS` adia a primeira vez); ' +
    '{"tipo":"botao","nome":"Soprar","cena":"Eclusa"}: um botão do mestre (o `nome` é o rótulo; `cena` opcional); ' +
    '{"tipo":"sinal","nome":"vento"}: ao receber um sinal mandado por outra automação; ' +
    '{"tipo":"tocha","muda":"acende"|"apaga","modelo":"Tocha","etiqueta":"chama"}: uma luz acendeu ou apagou (os filtros são opcionais); ' +
    '{"tipo":"zona","quando":"entra"|"sai","zona":"Poça"}: um token entrou numa zona ou saiu dela; ' +
    '{"tipo":"turno"}: começou o turno de alguém no combate; ' +
    '{"tipo":"cena","cena":"Eclusa"}: o grupo foi para outra cena (qualquer uma, ou só a dita).',
  "BLOCOS (dentro de `trilhas`, que é uma lista de listas): " +
    '{"bloco":"esperar","s":90}: espera 90 s (no tempo da mesa: pausar a mesa pausa a espera) e só então segue; ' +
    '{"bloco":"se","condicao":{...},"sim":[...],"nao":[...]}: roda o "sim" se a condição vale, senão o "não" (opcional); condições: {"condicao":"etiqueta","etiqueta":"chama"}, {"condicao":"dentroDaZona","zona":"Poça"}, {"condicao":"cena","cenas":["Eclusa"]}, {"condicao":"zonaLigada","zona":"Poça"}; ' +
    '{"bloco":"sortear","chance":0.3,"sim":[...],"nao":[...]}: sorteia (0 a 1) a cada vez e roda o "sim" ou o "não"; ' +
    '{"bloco":"paraCada","alvo":{...},"corpo":[...]}: repete o corpo para cada objeto ou token do alvo: {"tipo":"objetos","modelo":"Tocha","etiqueta":"chama","acesos":true,"naZona":"Poça"} ou {"tipo":"tokens","naZona":"Poça","naCena":"Eclusa","ids":["Brisa"]} (todos os filtros são opcionais); ' +
    '{"bloco":"acao","acao":{...}}: faz uma coisa (lista abaixo); ' +
    '{"bloco":"sinal","nome":"vento","atrasoS":10}: manda um sinal; as automações com gatilho "sinal" desse nome rodam (já, ou depois de `atrasoS`).',
  "AÇÕES (dentro de um bloco acao): " +
    '{"acao":"luz.modificar","raioX":0.5,"raioSomaM":2,"porS":20}: muda o raio da luz do objeto (multiplica e/ou soma) por um prazo; ' +
    '{"acao":"objeto.apagar","chance":0.3,"penalidadeS":300}: apaga o objeto aceso (com chance) e tira tempo do que sobra; ' +
    '{"acao":"objeto.ajustarTempo","deltaS":-300}: soma ou tira tempo do objeto; ' +
    '{"acao":"visao.limitar","alcanceM":1.5,"porS":30}: limita a visão do token por um prazo; ' +
    '{"acao":"chat.anunciar","texto":"...","para":"todos"|"mestre"}: uma linha no chat; ' +
    '{"acao":"som.tocar","hash":"vento.mp3","volume":0.8,"para":"todos"|"cena"|"token"}: toca um som uma vez; ' +
    '{"acao":"token.mostrar"} e {"acao":"token.ocultar"}: mostra ou esconde o token; ' +
    '{"acao":"zona.ativar","zona":"Poça","ativa":true}: liga ou desliga uma zona.',
  "QUEM SOFRE A AÇÃO: ações de luz (luz.modificar, objeto.apagar, objeto.ajustarTempo) mexem no OBJETO da vez; ações de token (visao.limitar, token.mostrar, token.ocultar) no TOKEN da vez, e sem token, em quem carrega o objeto da vez. A vez é o objeto ou token do gatilho (gatilho tocha: a tocha; gatilho zona: o token) ou o que o bloco paraCada está percorrendo. Fora disso a ação fica sem alvo (o editor avisa; o motor anota no registro). Por isso, ação de luz num relógio fica dentro de um paraCada de objetos, e ação de token dentro de um paraCada de tokens.",
  `PRAZOS: efeitos com \`porS\` (luz.modificar, visao.limitar) voltam sozinhos quando o prazo acaba; sem \`porS\` valem ${PRAZO_PADRAO_S} s. Rodar de novo renova o prazo, não empilha. Nada fica preso: ao apagar ou desligar uma automação, o que ela já fez termina no prazo; os efeitos de zona ("enquanto dentro") saem quando o token sai, ou a zona é desligada ou apagada.`,
  `LIMITES: ${MAXIMO_DE_FLUXOS} automações; ${MAXIMO_DE_TRILHAS} trilhas e ${MAXIMO_DE_BLOCOS_POR_FLUXO} blocos por automação; blocos aninhados até ${PROFUNDIDADE_DA_ARVORE} níveis; sinais encadeados até ${PROFUNDIDADE_MAXIMA} níveis (o resto é cortado); até ${TETO_DE_ACOES} ações por disparo; até ${MAXIMO_DE_EXECUCOES_ESPERANDO} esperas ao mesmo tempo. Quando o motor corta algo, anota no registro do mestre.`,
  'TEMPO E SORTEIO: tudo corre no tempo da mesa; pausar a mesa pausa relógios e esperas. Desligar uma automação congela o relógio dela e cancela o que esperava. Um "esperar" dentro de um "para cada" segura só aquele alvo.',
  'COMO USAR: `automacoes` com `fluxos` cria ou edita pelo NOME (nomes de zona, modelo, cena, token e som, nunca ids); tudo entra como rascunho até o mestre publicar. Confira com `explicar`. Zonas (`zonas`) têm os efeitos "enquanto dentro"; as automações cuidam do que acontece quando algo ENTRA, SAI ou passa o tempo.',
  'EXEMPLO (a Respiração da Montanha, na cena "Pulmão"): {"nome":"Respiração do Pulmão","cenas":["Pulmão"],"gatilho":{"tipo":"relogio","cadaS":180},"trilhas":[[{"bloco":"paraCada","alvo":{"tipo":"objetos","modelo":"Tocha","acesos":true},"corpo":[{"bloco":"acao","acao":{"acao":"luz.modificar","raioX":0.5,"porS":20}},{"bloco":"acao","acao":{"acao":"objeto.apagar","chance":0.3,"penalidadeS":300}}]}],[{"bloco":"esperar","s":90},{"bloco":"paraCada","alvo":{"tipo":"tokens"},"corpo":[{"bloco":"acao","acao":{"acao":"visao.limitar","alcanceM":1.5,"porS":30}}]}]]}',
].join("\n\n");

function resumoDaLista(estado: Estado): string {
  const a = automacoesDe(estado);
  if (a.fluxos.length === 0) return "A mesa não tem nenhuma automação.";
  const n = nomesDaMesa(estado);
  return a.fluxos
    .map((f) => {
      const exec = a.execucao[f.id];
      const estadoDele = f.rascunho ? "rascunho" : f.ligado ? "ligada" : "desligada";
      const roda =
        f.gatilho.tipo === "relogio" && f.ligado && !f.rascunho && exec === undefined
          ? " (ainda não começou)"
          : "";
      return `- "${f.nome}" (${estadoDele}${roda}): ${fraseDoFluxo(f, n)}`;
    })
    .join("\n");
}

function explicarEsse(p: { fluxo?: string | undefined }, estado: Estado): string {
  const a = automacoesDe(estado);
  const n = nomesDaMesa(estado);
  if (p.fluxo === undefined) {
    if (a.fluxos.length === 0) return "A mesa não tem nenhuma automação.";
    return a.fluxos
      .map(
        (f) =>
          `"${f.nome}" (${f.rascunho ? "rascunho" : f.ligado ? "ligada" : "desligada"}): ${fraseDoFluxo(f, n)}`,
      )
      .join("\n");
  }
  const f = achar(a.fluxos, p.fluxo, {
    rotulo: "automação",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  return `"${f.nome}" (${f.rascunho ? "rascunho" : f.ligado ? "ligada" : "desligada"}): ${fraseDoFluxo(f, n)}`;
}

export const automacoes = definir({
  nome: "automacoes",
  descricao:
    'Só do mestre. Automações por blocos (gatilho + trilhas de blocos: esperar, se, sortear, para cada, ações e sinais) e zonas (polígonos com efeitos). `fluxos` cria e edita pelo nome (nomes no lugar de ids); `zonas` também; tudo entra como rascunho e não roda até o mestre publicar. Ordem: zonas, depois as automações que as usam. Durante a sessão: `acionar` ([{fluxo, acao: disparar|ligar|desligar}]) e `usarBotoes` ([{botao}]). PERGUNTARAM COMO FUNCIONA, O QUE UMA AUTOMAÇÃO FAZ OU COMO MONTAR UMA? Chame `guia: true` (como as peças funcionam) e `explicar` (o que cada automação da mesa faz, em português) ANTES de responder; `listar: true` mostra todas. Exemplo: {"fluxos":[{"nome":"Vento","gatilho":{"tipo":"relogio","cadaS":600},"trilhas":[[{"bloco":"paraCada","alvo":{"tipo":"tokens"},"corpo":[{"bloco":"acao","acao":{"acao":"visao.limitar","alcanceM":3,"porS":60}}]}]]}]}',
  entrada: z
    .object({
      zonas: z.array(ZonaPedidaSchema).max(30).optional(),
      fluxos: z.array(FluxoPedidoSchema).max(20).optional(),
      acionar: z.array(AcionarSchema).max(20).optional(),
      usarBotoes: z.array(UsarBotaoSchema).max(20).optional(),
      listar: z
        .boolean()
        .optional()
        .describe("Lista as automações da mesa, cada uma com a frase em português."),
      explicar: z
        .object({
          fluxo: z.string().optional().describe("Nome da automação; sem isso, explica todas."),
        })
        .strict()
        .optional()
        .describe("O que a automação faz, em português (a mesma frase do editor)."),
      guia: z
        .boolean()
        .optional()
        .describe(
          "Como as peças funcionam: gatilhos, trilhas, blocos, ações, prazos, sinais e limites.",
        ),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "automacao.editar", estado.permissoes),
  async executar(e, ctx) {
    const partes: string[] = [];
    if (e.guia) partes.push(GUIA_DAS_AUTOMACOES);
    if (e.listar) partes.push(resumoDaLista(ctx.sala.estado()));
    if (e.explicar) partes.push(explicarEsse(e.explicar, ctx.sala.estado()));
    const total =
      (e.zonas?.length ?? 0) +
      (e.fluxos?.length ?? 0) +
      (e.acionar?.length ?? 0) +
      (e.usarBotoes?.length ?? 0);
    if (total === 0) {
      return partes.length > 0
        ? partes.join("\n\n")
        : "Nada a fazer: diga `fluxos`, `zonas`, `acionar`, `usarBotoes`, `listar`, `explicar` ou `guia`.";
    }
    const r = new Relatorio();
    const lote = ctx.novoLote(
      `automações: ${e.zonas?.length ?? 0} zonas, ${e.fluxos?.length ?? 0} automações`,
    );
    await cadaItem(
      e.zonas ?? [],
      (z2) => `zona "${z2.nome}"`,
      (z2) => zona(z2, ctx, lote),
      r,
    );
    await cadaItem(
      e.fluxos ?? [],
      (f) => `automação "${f.nome}"`,
      (f) => fluxo(f, ctx, lote),
      r,
    );
    await cadaItem(
      e.acionar ?? [],
      (a) => `automação "${a.fluxo}"`,
      (a) => acionar(a, ctx, lote),
      r,
    );
    await cadaItem(
      e.usarBotoes ?? [],
      (b) => `botão "${b.botao}"`,
      (b) => usarBotao(b, ctx, lote),
      r,
    );
    const saida = r.saida();
    return partes.length === 0
      ? saida
      : { ...saida, texto: `${partes.join("\n\n")}\n\n${saida.texto}` };
  },
});

// Para os testes e a paridade: o esquema dos blocos da automação como o MCP o recebe.
export { BlocoDoMcpSchema, BlocoSchema as BlocoDeFluxoSchema };
