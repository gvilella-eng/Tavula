import { z } from "zod";
import {
  type Cena,
  type Estado,
  EstadoDePortaSchema,
  meioDoArcoTangente,
  normalizarBusca,
  type Parede,
  type Personagem,
  pode,
  TipoDeParedeSchema,
  type Token,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { emCelulas, num } from "../formato.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";
import { emMetros, type Par, ParSchema, paredeEmMetros } from "./cenasUtil.ts";

const ParedeDoPedidoSchema = z
  .object({
    de: ParSchema.describe("Ponto de início [coluna, linha], em células (aceita .5)."),
    ate: ParSchema.describe("Ponto final [coluna, linha]."),
    por: ParSchema.optional().describe("Faz um ARCO de `de` até `ate` passando por este ponto."),
    tangente: ParSchema.optional().describe(
      "Faz um arco que sai de `de` nesta direção [dx, dy] e termina em `ate` (alternativa a `por`).",
    ),
    tipo: TipoDeParedeSchema.optional().describe(
      "parede (padrão), porta, janela, secreta ou invisivel.",
    ),
    estado: EstadoDePortaSchema.optional().describe(
      "Só porta e secreta: aberta, fechada (padrão) ou trancada.",
    ),
  })
  .strict();

const TokenDoPedidoSchema = z
  .object({
    ficha: z.string().optional().describe("Nome da ficha (NPC) que este token representa."),
    nome: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe("Nome do token (padrão: o da ficha). Com `quantidade`, vira Nome 1, Nome 2..."),
    quantidade: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Quantos tokens iguais (padrão 1); ficam em fila para a direita."),
    em: ParSchema.optional().describe(
      "Centro do token [coluna, linha] em células: a célula da coluna 3, linha 2 tem centro [3.5, 2.5]. Padrão: a chegada da cena.",
    ),
    oculto: z.boolean().optional().describe("Escondido dos jogadores."),
    camada: z.enum(["tokens", "mestre"]).optional(),
    cor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    tamanho: z.number().int().min(1).max(4).optional().describe("Quadrados (1 a 4)."),
  })
  .strict();

const PedidoDeCenaSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Nome da cena. Se já existe, ela é editada; senão, criada."),
    novoNome: z.string().min(1).max(64).optional(),
    apagar: z.boolean().optional().describe("Apaga a cena (nunca a que está com o grupo)."),
    grid: z
      .object({
        quadradoM: z
          .number()
          .min(0.3)
          .max(10)
          .optional()
          .describe("Metros por célula (padrão 1,5)."),
        visivel: z.boolean().optional(),
      })
      .strict()
      .optional(),
    chegada: ParSchema.nullable()
      .optional()
      .describe("Onde o grupo chega [coluna, linha]; null volta ao centro."),
    cartao: z.boolean().optional().describe("Cena de cartão: só uma imagem, sem paredes nem luz."),
    mostrarParedesAosJogadores: z.boolean().optional(),
    iluminacao: z
      .object({
        dinamica: z.boolean().optional(),
        luzAmbiente: z.number().min(0).max(1).optional().describe("0 = escuridão, 1 = dia."),
        fatorDeLuz: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
    paredes: z
      .array(ParedeDoPedidoSchema)
      .max(400)
      .optional()
      .describe("Paredes, portas e janelas novas."),
    apagarParedes: z
      .union([z.literal("todas"), z.array(z.string())])
      .optional()
      .describe('"todas" ou ids de paredes (a ferramenta `ler` mostra os ids).'),
    tokens: z
      .array(TokenDoPedidoSchema)
      .max(40)
      .optional()
      .describe("Tokens de NPC (ou avulsos) na cena."),
    apagarTokens: z.array(z.string()).optional().describe("Nomes de tokens a tirar da cena."),
  })
  .strict();
type PedidoDeCena = z.infer<typeof PedidoDeCenaSchema>;

const MAX_PAREDES_POR_PEDIDO = 200;

function tangenteEmMetros(par: Par): { x: number; y: number } {
  return { x: par[0], y: par[1] };
}

function montarParedes(p: PedidoDeCena["paredes"], cena: Cena): Omit<Parede, "cenaId">[] {
  const q = cena.grid.quadradoM;
  return (p ?? []).map((w, i) => {
    const a = paredeEmMetros(w.de, q);
    const b = paredeEmMetros(w.ate, q);
    if (a.x === b.x && a.y === b.y) {
      throw new ErroDoMcp(`Parede ${i + 1}: \`de\` e \`ate\` caem no mesmo ponto da grade.`);
    }
    if (w.por !== undefined && w.tangente !== undefined) {
      throw new ErroDoMcp(`Parede ${i + 1}: use \`por\` ou \`tangente\`, não os dois.`);
    }
    let meio: { x: number; y: number } | null | undefined;
    if (w.por !== undefined) meio = paredeEmMetros(w.por, q);
    else if (w.tangente !== undefined) {
      meio = meioDoArcoTangente(a, tangenteEmMetros(w.tangente), b);
      if (meio === null) {
        throw new ErroDoMcp(
          `Parede ${i + 1}: \`ate\` está na mesma linha da \`tangente\`: isso é uma reta, tire a tangente.`,
        );
      }
    }
    const tipo = w.tipo ?? "parede";
    if (w.estado !== undefined && tipo !== "porta" && tipo !== "secreta") {
      throw new ErroDoMcp(`Parede ${i + 1}: \`estado\` só vale para porta e secreta.`);
    }
    return {
      id: novoId("parede"),
      a,
      b,
      tipo,
      ...(w.estado ? { estado: w.estado } : {}),
      ...(meio ? { meio } : {}),
    };
  });
}

function fichaDoToken(estado: Estado, nome: string): Personagem {
  return achar(estado.personagens, nome, {
    rotulo: "ficha",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
}

async function mexerNaCena(p: PedidoDeCena, ctx: Contexto, lote: Lote): Promise<string> {
  let estado = ctx.sala.estado();
  const feito: string[] = [];
  let cena = acharExato(estado.cenas, p.nome, (c) => c.nome);

  if (!cena) {
    if (p.apagar) throw new ErroDoMcp(`Não existe a cena "${p.nome}" para apagar.`);
    const id = novoId("cena");
    await passo(ctx, lote, "cena.criar", { id, nome: p.nome });
    feito.push("criou");
    estado = ctx.sala.estado();
    cena = estado.cenas.find((c) => c.id === id);
    if (!cena)
      throw new ErroDoMcp("A mesa criou a cena, mas ela não apareceu no estado. Tente ler a cena.");
  } else if (p.apagar) {
    await passo(ctx, lote, "cena.apagar", { cenaId: cena.id });
    return `Apagou a cena "${cena.nome}".`;
  }

  // Dados da própria cena: nome, chegada, cartão, paredes visíveis, grid e luz. O grid vem primeiro (as coordenadas dependem dele).
  const g = p.grid;
  if (g && (g.quadradoM !== undefined || g.visivel !== undefined)) {
    await passo(ctx, lote, "cena.configurarGrid", {
      cenaId: cena.id,
      ...(g.quadradoM !== undefined ? { quadradoM: g.quadradoM } : {}),
      ...(g.visivel !== undefined ? { visivel: g.visivel } : {}),
    });
    feito.push("grid");
    estado = ctx.sala.estado();
    cena = estado.cenas.find((c) => c.id === (cena as Cena).id) ?? cena;
  }
  const q = cena.grid.quadradoM;
  const dados: Record<string, unknown> = {};
  if (p.novoNome !== undefined && p.novoNome !== cena.nome) dados.nome = p.novoNome;
  if (p.chegada !== undefined) dados.chegada = p.chegada === null ? null : emMetros(p.chegada, q);
  if (p.cartao !== undefined && p.cartao !== (cena.cartao ?? false)) dados.cartao = p.cartao;
  if (p.mostrarParedesAosJogadores !== undefined) {
    dados.mostrarParedesAosJogadores = p.mostrarParedesAosJogadores;
  }
  if (Object.keys(dados).length > 0) {
    await passo(ctx, lote, "cena.editar", { cenaId: cena.id, ...dados });
    feito.push(Object.keys(dados).join(", "));
  }
  if (p.iluminacao && Object.keys(p.iluminacao).length > 0) {
    await passo(ctx, lote, "cena.configurarIluminacao", { cenaId: cena.id, ...p.iluminacao });
    feito.push("iluminação");
  }
  estado = ctx.sala.estado();
  const cenaId = cena.id;

  // Paredes: apagar as pedidas e criar as novas (cada mensagem leva até 200).
  if (p.apagarParedes !== undefined) {
    const dela = estado.paredes.filter((w) => w.cenaId === cenaId);
    const ids = p.apagarParedes === "todas" ? dela.map((w) => w.id) : p.apagarParedes;
    for (const id of ids) {
      if (!dela.some((w) => w.id === id)) {
        throw new ErroDoMcp(
          `A parede "${id}" não é desta cena. Use a ferramenta \`ler\` para ver os ids.`,
        );
      }
    }
    for (const id of ids) await passo(ctx, lote, "parede.apagar", { id });
    if (ids.length > 0) feito.push(`apagou ${ids.length} paredes`);
  }
  const novas = montarParedes(p.paredes, cena);
  for (let i = 0; i < novas.length; i += MAX_PAREDES_POR_PEDIDO) {
    await passo(ctx, lote, "parede.criar", {
      cenaId,
      paredes: novas.slice(i, i + MAX_PAREDES_POR_PEDIDO),
    });
  }
  if (novas.length > 0) feito.push(`${novas.length} paredes`);

  // Tokens.
  if (p.apagarTokens) {
    for (const nome of p.apagarTokens) {
      const t = achar(
        estado.tokens.filter((x) => x.cenaId === cenaId),
        nome,
        { rotulo: "token", nomeDe: (x) => x.nome, idDe: (x) => x.id },
      );
      await passo(ctx, lote, "token.apagar", { id: t.id });
    }
    if (p.apagarTokens.length > 0) feito.push(`tirou ${p.apagarTokens.length} tokens`);
  }
  let criados = 0;
  for (const t of p.tokens ?? []) {
    const ficha = t.ficha ? fichaDoToken(ctx.sala.estado(), t.ficha) : undefined;
    const base = t.nome ?? ficha?.nome;
    if (!base) throw new ErroDoMcp("Cada token precisa de `ficha` ou de `nome`.");
    const n = t.quantidade ?? 1;
    const chegada = cena.chegada ?? { x: cena.larguraM / 2, y: cena.alturaM / 2 };
    const inicio = t.em ? emMetros(t.em, q) : chegada;
    const existentes = ctx.sala
      .estado()
      .tokens.filter((x) => x.cenaId === cenaId)
      .map((x) => x.nome);
    for (let i = 0; i < n; i++) {
      let nome = n === 1 ? base : `${base} ${i + 1}`;
      if (existentes.some((x) => normalizarBusca(x) === normalizarBusca(nome))) {
        nome = `${nome} (${existentes.length + 1})`;
      }
      const token: Omit<Token, "cenaId"> = {
        id: novoId("token"),
        nome: nome.slice(0, 64),
        cor: t.cor ?? ficha?.tokenPadrao.cor ?? "#c0392b",
        tamanhoQuadrados: t.tamanho ?? ficha?.tokenPadrao.tamanhoQuadrados ?? 1,
        x: Math.round((inicio.x + i * q) * 100) / 100,
        y: inicio.y,
        camada: t.camada ?? "tokens",
        oculto: t.oculto ?? false,
        controladoPor: [],
        ...(ficha ? { personagemId: ficha.id } : {}),
        ...(ficha?.tokenPadrao.assetHash ? { assetHash: ficha.tokenPadrao.assetHash } : {}),
      };
      await passo(ctx, lote, "token.criar", { cenaId, token });
      criados++;
      existentes.push(token.nome);
    }
  }
  if (criados > 0) feito.push(`${criados} tokens`);

  const final = ctx.sala.estado().cenas.find((c) => c.id === cenaId) ?? cena;
  const t = emCelulas(final);
  const sobre = `${t.largura}x${t.altura} células de ${num(final.grid.quadradoM)} m`;
  const rascunho = final.rascunho ? " (rascunho: o mestre revisa e publica)" : "";
  return `Cena "${p.novoNome ?? final.nome}"${rascunho}, ${sobre}: ${feito.join("; ") || "nada mudou"}.`;
}

export const cenas = definir({
  nome: "cenas",
  descricao:
    'Só do mestre. Cria e edita cenas em lote: nome, grid, chegada, cartão, luz ambiente, paredes, portas e tokens de NPC. Coordenadas em CÉLULAS a partir do canto de cima à esquerda [0,0], com meias células (1.5). Parede de `de` até `ate`; arco "de a até b passando por c" usa `por`. O tamanho da cena é 60x45 m (40x30 células de 1,5 m). Exemplo: {"cenas":[{"nome":"Eclusa","paredes":[{"de":[2,2],"ate":[12,2]},{"de":[12,2],"ate":[12,8],"tipo":"porta"}],"tokens":[{"ficha":"Goblin","quantidade":4,"em":[6.5,5.5],"oculto":true}]}]}',
  entrada: z.object({ cenas: z.array(PedidoDeCenaSchema).min(1).max(10) }).strict(),
  visivel: (estado, eu) => pode(eu, "cena.editar", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const nomes = e.cenas.map((c) => c.nome);
    const lote = ctx.novoLote(
      `cenas: ${nomes.slice(0, 5).join(", ")}${nomes.length > 5 ? ` e mais ${nomes.length - 5}` : ""}`,
    );
    await cadaItem(
      e.cenas,
      (c) => `"${c.nome}"`,
      (c) => mexerNaCena(c, ctx, lote),
      r,
    );
    return r.saida();
  },
});
