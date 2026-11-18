import { z } from "zod";
import {
  arrumarNoGrid,
  BordaSchema,
  CONDICOES,
  chegadaDaCena,
  type Estado,
  encaixarNoGrid,
  MAXIMO_DE_TOKENS_EM_LOTE,
  MAXIMO_DE_TOKENS_POR_VEZ,
  pode,
  usaVidaPorToken,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { cenaPorNome, fichaPorNome, tokenPorNome } from "./achados.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";
import { emMetros, ParSchema } from "./cenasUtil.ts";

const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const TokenPedidoSchema = z
  .object({
    token: z.string().describe("Nome do token."),
    cena: z.string().optional().describe("Nome da cena do token (padrão: a do grupo)."),
    mover: ParSchema.optional().describe("Leva o centro do token para [coluna, linha] em células."),
    nome: z.string().min(1).max(64).optional().describe("Novo nome."),
    tamanho: z.number().int().min(1).max(4).optional().describe("Quadrados (1 a 4)."),
    camada: z.enum(["tokens", "mestre"]).optional(),
    oculto: z.boolean().optional(),
    cor: Cor.optional(),
    controladoPor: z
      .array(z.string())
      .max(12)
      .optional()
      .describe(
        'Só mestre: nomes dos jogadores que movem este token (a lista inteira; [] deixa só o mestre). Ex.: ["Ana","Bia"].',
      ),
    borda: BordaSchema.nullable()
      .optional()
      .describe(
        "O anel colorido na borda do token (para separar grupos): vermelho, laranja, amarelo, verde, ciano, azul, rosa ou branco; null tira.",
      ),
    barraDeVida: z
      .boolean()
      .optional()
      .describe(
        "Liga (padrão) ou desliga a barra de vida embaixo do token; só quem controla a vê.",
      ),
    visaoM: z
      .number()
      .min(0)
      .max(1000)
      .nullable()
      .optional()
      .describe("Alcance de visão em metros; null = sem limite."),
    visaoNoEscuroM: z.number().min(0).max(1000).nullable().optional(),
    condicoes: z
      .array(z.enum(CONDICOES))
      .max(14)
      .optional()
      .describe("A lista inteira de condições (troca a atual; [] tira todas)."),
    exaustao: z.number().int().min(0).max(6).optional(),
    concentracao: z.string().min(1).max(64).nullable().optional().describe("A magia; null tira."),
    morto: z.boolean().optional(),
    pv: z
      .number()
      .int()
      .min(0)
      .max(9999)
      .optional()
      .describe(
        "Pontos de vida atuais do token. Token de NPC com vida própria (horda): só a vida dele; os demais: a da ficha.",
      ),
    pvMax: z.number().int().min(0).max(9999).optional(),
    pvTemp: z
      .number()
      .int()
      .min(0)
      .max(9999)
      .optional()
      .describe("PV temporários do token (0 tira). Só para token de NPC com vida própria."),
    ca: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe("Classe de armadura da ficha do token."),
  })
  .strict();

/** Q11: o mesmo gesto em vários tokens de uma vez (mover juntos, dano ou cura, borda, barra de vida). */
const GrupoSchema = z
  .object({
    tokens: z
      .array(z.string())
      .min(1)
      .max(MAXIMO_DE_TOKENS_EM_LOTE)
      .describe("Nomes dos tokens ('Goblin', 'Goblin 2'...)."),
    cena: z.string().optional().describe("Nome da cena dos tokens (padrão: a do grupo)."),
    deslocar: ParSchema.optional().describe(
      "Move todos juntos, mantendo o arranjo: [colunas, linhas] em células (negativo vai para a esquerda e para cima).",
    ),
    vida: z
      .number()
      .int()
      .min(-9999)
      .max(9999)
      .optional()
      .describe(
        "Dano (negativo, ex.: -5) ou cura (positivo) igual para todos. Os temporários absorvem o dano primeiro; vida de ficha conta uma vez por personagem.",
      ),
    borda: BordaSchema.nullable()
      .optional()
      .describe("A mesma borda colorida para todos; null tira."),
    barraDeVida: z.boolean().optional().describe("Liga ou desliga a barra de vida de todos."),
  })
  .strict();
type GrupoPedido = z.infer<typeof GrupoSchema>;

async function agirNoGrupo(p: GrupoPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado0 = ctx.sala.estado();
  const cena = cenaPorNome(estado0, p.cena);
  const q = cena.grid.quadradoM;
  const alvos = p.tokens.map((nome) => tokenPorNome(estado0, nome, cena.id));
  const ids = alvos.map((t) => t.id);
  const feitos: string[] = [];
  if (p.deslocar) {
    const [dc, dl] = p.deslocar;
    await passo(ctx, lote, "tokens.mover", {
      itens: alvos.map((t) => ({
        id: t.id,
        ...encaixarNoGrid({ x: t.x + dc * q, y: t.y + dl * q }, t.tamanhoQuadrados, q),
      })),
    });
    feitos.push("moveu juntos");
  }
  if (p.vida !== undefined && p.vida !== 0) {
    await passo(ctx, lote, "tokens.vidaDelta", { ids, delta: p.vida });
    feitos.push(p.vida < 0 ? `dano ${-p.vida}` : `cura ${p.vida}`);
  }
  const mud: Record<string, unknown> = {};
  if (p.borda !== undefined) mud.borda = p.borda;
  if (p.barraDeVida !== undefined) mud.barraDeVida = p.barraDeVida;
  if (Object.keys(mud).length > 0) {
    await passo(ctx, lote, "tokens.editar", { ids, mudancas: mud });
    feitos.push(Object.keys(mud).join(", "));
  }
  return feitos.length > 0
    ? `${alvos.length} tokens: ${feitos.join("; ")}.`
    : `${alvos.length} tokens: nada a fazer (diga \`deslocar\`, \`vida\`, \`borda\` ou \`barraDeVida\`).`;
}

const ColocarSchema = z
  .object({
    ficha: z.string().describe("Nome da ficha."),
    cena: z.string().optional().describe("Padrão: a cena do grupo."),
    em: ParSchema.optional().describe("[coluna, linha] em células (sem isso, a chegada da cena)."),
    quantidade: z
      .number()
      .int()
      .min(1)
      .max(MAXIMO_DE_TOKENS_POR_VEZ)
      .optional()
      .describe(
        'Só mestre, só NPC: quantos tokens da ficha pôr de uma vez (horda), arrumados no grid e numerados ("Goblin", "Goblin 2"...), cada um com a sua vida.',
      ),
  })
  .strict();

const CopiarSchema = z
  .object({
    token: z.string().describe("Nome do token a copiar."),
    cena: z.string().optional().describe("Cena do token de origem (padrão: a do grupo)."),
    paraCena: z.string().optional().describe("Cena onde as cópias nascem (padrão: a da origem)."),
    quantidade: z.number().int().min(1).max(MAXIMO_DE_TOKENS_POR_VEZ).optional(),
    em: ParSchema.optional().describe(
      "[coluna, linha] onde a primeira cópia nasce (sem isso, ao lado do original; em outra cena, na chegada).",
    ),
  })
  .strict();

type TokenPedido = z.infer<typeof TokenPedidoSchema>;
type ColocarPedido = z.infer<typeof ColocarSchema>;
type CopiarPedido = z.infer<typeof CopiarSchema>;

async function editarToken(p: TokenPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado0 = ctx.sala.estado();
  const cena = cenaPorNome(estado0, p.cena);
  const t = tokenPorNome(estado0, p.token, cena.id);
  const q = cena.grid.quadradoM;
  const feitos: string[] = [];

  if (p.mover) {
    const pos = emMetros(p.mover, q);
    await passo(ctx, lote, "token.soltar", { id: t.id, x: pos.x, y: pos.y });
    feitos.push("moveu");
  }
  const mud: Record<string, unknown> = {};
  if (p.nome !== undefined) mud.nome = p.nome;
  if (p.tamanho !== undefined) mud.tamanhoQuadrados = p.tamanho;
  if (p.camada !== undefined) mud.camada = p.camada;
  if (p.oculto !== undefined) mud.oculto = p.oculto;
  if (p.cor !== undefined) mud.cor = p.cor;
  if (p.controladoPor !== undefined) {
    mud.controladoPor = p.controladoPor.map(
      (n) =>
        achar(estado0.usuarios, n, { rotulo: "pessoa", nomeDe: (u) => u.nome, idDe: (u) => u.id })
          .id,
    );
  }
  if (p.borda !== undefined) mud.borda = p.borda;
  if (p.barraDeVida !== undefined) mud.barraDeVida = p.barraDeVida;
  if (p.visaoM !== undefined) mud.alcanceVisaoM = p.visaoM;
  if (p.visaoNoEscuroM !== undefined) mud.visaoNoEscuroM = p.visaoNoEscuroM;
  if (Object.keys(mud).length > 0) {
    await passo(ctx, lote, "token.editar", { id: t.id, mudancas: mud });
    feitos.push(Object.keys(mud).join(", "));
  }
  const cond: Record<string, unknown> = {};
  if (p.condicoes !== undefined) cond.condicoes = p.condicoes;
  if (p.exaustao !== undefined) cond.exaustao = p.exaustao;
  if (p.concentracao !== undefined) cond.concentracao = p.concentracao;
  if (p.morto !== undefined) cond.morto = p.morto;
  if (Object.keys(cond).length > 0) {
    await passo(ctx, lote, "token.condicoes", { id: t.id, ...cond });
    feitos.push(Object.keys(cond).join(", "));
  }

  // Q10: token de NPC com vida própria: PV, máximo e temporários são do token, não da ficha.
  const dono = t.personagemId
    ? estado0.personagens.find((x) => x.id === t.personagemId)
    : undefined;
  const vidaDoToken = usaVidaPorToken(dono);
  if (vidaDoToken && (p.pv !== undefined || p.pvMax !== undefined || p.pvTemp !== undefined)) {
    await passo(ctx, lote, "token.vida", {
      id: t.id,
      ...(p.pv === undefined ? {} : { atual: p.pv }),
      ...(p.pvMax === undefined ? {} : { max: p.pvMax }),
      ...(p.pvTemp === undefined ? {} : { temp: p.pvTemp }),
    });
    feitos.push("vida do token");
  } else if (p.pvTemp !== undefined) {
    throw new ErroDoMcp(
      `O token "${t.nome}" usa a vida da ficha: PV temporários só em token de NPC com vida própria.`,
    );
  }
  const operacoes: { caminho: string; valor: unknown }[] = [];
  if (!vidaDoToken && p.pv !== undefined) operacoes.push({ caminho: "pvAtual", valor: p.pv });
  if (!vidaDoToken && p.pvMax !== undefined) operacoes.push({ caminho: "pvMax", valor: p.pvMax });
  if (p.ca !== undefined) operacoes.push({ caminho: "ca", valor: { valor: p.ca } });
  if (operacoes.length > 0) {
    if (!t.personagemId) {
      throw new ErroDoMcp(`O token "${t.nome}" não tem ficha: vida e CA ficam na ficha.`);
    }
    await passo(ctx, lote, "ficha.alterar", { personagemId: t.personagemId, operacoes });
    feitos.push("ficha (vida/CA)");
  }
  return feitos.length > 0
    ? `Token "${t.nome}": ${feitos.join("; ")}.`
    : `Token "${t.nome}" não mudou.`;
}

async function colocar(p: ColocarPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado: Estado = ctx.sala.estado();
  const ficha = fichaPorNome(estado, p.ficha);
  const cena = cenaPorNome(estado, p.cena);
  const eu = ctx.sala.eu();
  const tokenId = novoId("token");
  const pos = p.em ? emMetros(p.em, cena.grid.quadradoM) : undefined;
  const xy = pos ? { x: pos.x, y: pos.y } : {};
  if (p.quantidade !== undefined && p.quantidade > 1) {
    if (eu.papel !== "mestre") throw new ErroDoMcp("Só o mestre põe vários tokens de uma vez.");
    await passo(ctx, lote, "personagem.colocarVarios", {
      personagemId: ficha.id,
      cenaId: cena.id,
      tokenIds: Array.from({ length: p.quantidade }, () => novoId("token")),
      ...xy,
    });
    return `Pôs ${p.quantidade} tokens de "${ficha.nome}" na cena "${cena.nome}" (numerados, cada um com a sua vida).`;
  }
  if (eu.papel === "mestre") {
    await passo(ctx, lote, "personagem.colocar", {
      personagemId: ficha.id,
      cenaId: cena.id,
      tokenId,
      ...xy,
    });
  } else {
    await passo(ctx, lote, "token.colocarMeu", { personagemId: ficha.id, tokenId, ...xy });
  }
  return `Pôs "${ficha.nome}" na cena "${cena.nome}".`;
}

/** Q10: copia um token (uma ou mais vezes), na mesma cena ou em outra: igual ao original, numerado se é NPC. */
async function copiar(p: CopiarPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado: Estado = ctx.sala.estado();
  if (ctx.sala.eu().papel !== "mestre") throw new ErroDoMcp("Só o mestre copia tokens.");
  const cenaOrigem = cenaPorNome(estado, p.cena);
  const origem = tokenPorNome(estado, p.token, cenaOrigem.id);
  const destino = p.paraCena ? cenaPorNome(estado, p.paraCena) : cenaOrigem;
  const n = p.quantidade ?? 1;
  const q = destino.grid.quadradoM;
  const centro = p.em
    ? emMetros(p.em, q)
    : destino.id === origem.cenaId
      ? { x: origem.x + q, y: origem.y }
      : chegadaDaCena(destino);
  const lugares = arrumarNoGrid(
    centro,
    destino,
    Array.from({ length: n }, () => origem.tamanhoQuadrados),
    estado.tokens.filter((t) => t.cenaId === destino.id && t.camada === "tokens"),
  );
  await passo(ctx, lote, "token.copiar", {
    cenaId: destino.id,
    itens: lugares.map((l) => ({ origemId: origem.id, id: novoId("token"), x: l.x, y: l.y })),
  });
  return `Copiou "${origem.nome}" ${n === 1 ? "uma vez" : `${n} vezes`} na cena "${destino.nome}".`;
}

export const tokens = definir({
  nome: "tokens",
  descricao: [
    "Mexe nos TOKENS do mapa, em lote. `tokens`: para cada um, pelo nome, mover (`mover`: [coluna, linha] em células), renomear, tamanho, camada, oculto, cor, visão, condições (`condicoes`, `exaustao`, `concentracao`, `morto`) e a vida e a CA da ficha do token (`pv`, `pvMax`, `ca`).",
    "`colocar`: põe o token de uma ficha no mapa (o jogador, na área da bandeira); `quantidade` (só mestre, NPC) põe uma horda numerada (Goblin, Goblin 2...), cada um com a sua vida (`pv`, `pvMax`, `pvTemp` são do token; `fichas` com `vidaPorToken: false` usa a da ficha). `copiar`: duplica um token (`quantidade`, `paraCena`). `restaurar`: traz de volta um token apagado há pouco. Todo token tem `borda` (anel colorido que separa grupos: vermelho, laranja, amarelo, verde, ciano, azul, rosa, branco; null tira) e `barraDeVida` (ligada por padrão; só quem controla o token a vê). `grupo`: o MESMO gesto em vários tokens num pedido só: `deslocar` ([colunas, linhas]), `vida` (dano negativo ou cura; temporários absorvem primeiro), `borda`, `barraDeVida`.",
    "Criar tokens avulsos e tirá-los da cena é na ferramenta `cenas`; a imagem do token, em `arquivos`; luz do token, em `objetos`. O mestre mexe em qualquer um; o jogador, nos que controla.",
    'Exemplo: {"tokens":[{"token":"Goblin 1","mover":[12.5,8.5],"condicoes":["amedrontado"],"pv":3},{"token":"Goblin 2","morto":true}],"colocar":[{"ficha":"Brisa","em":[2.5,2.5]}]}',
  ].join(" "),
  entrada: z
    .object({
      tokens: z.array(TokenPedidoSchema).max(40).optional(),
      colocar: z.array(ColocarSchema).max(12).optional(),
      copiar: z.array(CopiarSchema).max(12).optional(),
      grupo: z.array(GrupoSchema).max(12).optional(),
      restaurar: z.array(z.string()).max(40).optional(),
    })
    .strict(),
  visivel: (estado, eu) =>
    pode(eu, "cena.editar", estado.permissoes) ||
    pode(eu, "token.moverProprio", estado.permissoes) ||
    pode(eu, "token.colocarProprio", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const total =
      (e.tokens?.length ?? 0) +
      (e.colocar?.length ?? 0) +
      (e.copiar?.length ?? 0) +
      (e.grupo?.length ?? 0) +
      (e.restaurar?.length ?? 0);
    if (total === 0) {
      return "Nada a fazer: diga `tokens`, `colocar`, `copiar`, `grupo` ou `restaurar`.";
    }
    const lote = ctx.novoLote(
      `tokens: ${e.tokens?.length ?? 0} editados, ${e.colocar?.length ?? 0} colocados`,
    );
    await cadaItem(
      e.tokens ?? [],
      (t) => `token "${t.token}"`,
      (t) => editarToken(t, ctx, lote),
      r,
    );
    await cadaItem(
      e.colocar ?? [],
      (c) => `colocar "${c.ficha}"`,
      (c) => colocar(c, ctx, lote),
      r,
    );
    await cadaItem(
      e.copiar ?? [],
      (c) => `copiar "${c.token}"`,
      (c) => copiar(c, ctx, lote),
      r,
    );
    await cadaItem(
      e.grupo ?? [],
      (g) => `grupo de ${g.tokens.length}`,
      (g) => agirNoGrupo(g, ctx, lote),
      r,
    );
    await cadaItem(
      e.restaurar ?? [],
      (id) => `restaurar "${id}"`,
      async (id) => {
        await passo(ctx, lote, "token.restaurar", { id });
        return `Restaurou o token ${id}.`;
      },
      r,
    );
    return r.saida();
  },
});
