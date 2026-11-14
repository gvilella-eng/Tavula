import { z } from "zod";
import { CONDICOES, type Estado, pode } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { novoId } from "../nomes.ts";
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
      .describe("Pontos de vida atuais da ficha do token."),
    pvMax: z.number().int().min(0).max(9999).optional(),
    ca: z
      .number()
      .int()
      .min(0)
      .max(50)
      .optional()
      .describe("Classe de armadura da ficha do token."),
  })
  .strict();

const ColocarSchema = z
  .object({
    ficha: z.string().describe("Nome da ficha."),
    cena: z.string().optional().describe("Padrão: a cena do grupo."),
    em: ParSchema.optional().describe("[coluna, linha] em células (sem isso, a chegada da cena)."),
  })
  .strict();

type TokenPedido = z.infer<typeof TokenPedidoSchema>;
type ColocarPedido = z.infer<typeof ColocarSchema>;

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

  const operacoes: { caminho: string; valor: unknown }[] = [];
  if (p.pv !== undefined) operacoes.push({ caminho: "pvAtual", valor: p.pv });
  if (p.pvMax !== undefined) operacoes.push({ caminho: "pvMax", valor: p.pvMax });
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

export const tokens = definir({
  nome: "tokens",
  descricao: [
    "Mexe nos TOKENS do mapa, em lote. `tokens`: para cada um, pelo nome, mover (`mover`: [coluna, linha] em células), renomear, tamanho, camada, oculto, cor, visão, condições (`condicoes`, `exaustao`, `concentracao`, `morto`) e a vida e a CA da ficha do token (`pv`, `pvMax`, `ca`).",
    "`colocar`: pôr o token de uma ficha no mapa (o jogador, o da ficha dele na área da bandeira). `restaurar`: traz de volta um token apagado há pouco (ids que a resposta de `cenas`, ao tirar o token, mostra).",
    "Criar tokens avulsos e tirá-los da cena é na ferramenta `cenas`; a imagem do token, em `arquivos`; luz do token, em `objetos`. O mestre mexe em qualquer um; o jogador, nos que controla.",
    'Exemplo: {"tokens":[{"token":"Goblin 1","mover":[12.5,8.5],"condicoes":["amedrontado"],"pv":3},{"token":"Goblin 2","morto":true}],"colocar":[{"ficha":"Brisa","em":[2.5,2.5]}]}',
  ].join(" "),
  entrada: z
    .object({
      tokens: z.array(TokenPedidoSchema).max(40).optional(),
      colocar: z.array(ColocarSchema).max(12).optional(),
      restaurar: z.array(z.string()).max(40).optional(),
    })
    .strict(),
  visivel: (estado, eu) =>
    pode(eu, "cena.editar", estado.permissoes) ||
    pode(eu, "token.moverProprio", estado.permissoes) ||
    pode(eu, "token.colocarProprio", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const total = (e.tokens?.length ?? 0) + (e.colocar?.length ?? 0) + (e.restaurar?.length ?? 0);
    if (total === 0) return "Nada a fazer: diga `tokens`, `colocar` ou `restaurar`.";
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
