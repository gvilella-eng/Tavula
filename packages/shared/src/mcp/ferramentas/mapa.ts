import { z } from "zod";
import {
  type Cena,
  type Estado,
  EstadoDePortaSchema,
  LIMITES_DO_DESENHO,
  MAXIMO_DE_PONTOS_POR_TRACO,
  meioDoArcoTangente,
  normalizarBusca,
  type Parede,
  pode,
  RAIO_MAXIMO_DO_PINCEL_M,
  RAIO_MINIMO_DO_PINCEL_M,
  TipoDeParedeSchema,
  type TracoDaNevoa,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { tracosDoTexto } from "../fonteDeTracos.ts";
import { novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { cenaPorNome } from "./achados.ts";
import { type Contexto, definir, passo, passoComEspera, Relatorio } from "./base.ts";
import { emMetros, type Par, ParSchema, paredeEmMetros } from "./cenasUtil.ts";

const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const COR_PADRAO_DO_DESENHO = "#f4d35e";

const NevoaSchema = z
  .object({
    modo: z.enum(["cobrir", "revelar"]),
    forma: z
      .enum(["tudo", "retangulo", "poligono", "pincel"])
      .optional()
      .describe(
        "Se omitida: `de`+`ate` = retangulo; `pontos` = poligono; nada = tudo (a cena inteira).",
      ),
    de: ParSchema.optional().describe("Retângulo: um canto [coluna, linha], em células."),
    ate: ParSchema.optional().describe("Retângulo: o canto oposto."),
    pontos: z
      .array(ParSchema)
      .max(MAXIMO_DE_PONTOS_POR_TRACO)
      .optional()
      .describe(
        "Polígono (3 ou mais) ou caminho do pincel, em células. Meia célula vale (1.5). Para a forma de uma ponte, use um polígono.",
      ),
    raioM: z
      .number()
      .min(RAIO_MINIMO_DO_PINCEL_M)
      .max(RAIO_MAXIMO_DO_PINCEL_M)
      .optional()
      .describe("Só do pincel: o raio em metros (padrão 1,5)."),
  })
  .strict();

const DesenhoSchemaDoPedido = z
  .object({
    forma: z.enum(["livre", "linha", "retangulo", "circulo"]),
    pontos: z
      .array(ParSchema)
      .min(1)
      .max(200)
      .describe(
        "Em células. Linha: início e fim. Retângulo: dois cantos. Círculo: o centro e um ponto da borda. Livre: o traço.",
      ),
    cor: Cor.optional(),
    espessura: z
      .number()
      .min(LIMITES_DO_DESENHO.espessuraMin)
      .max(LIMITES_DO_DESENHO.espessuraMax)
      .optional(),
    preenchido: z.boolean().optional().describe("Só retângulo e círculo."),
  })
  .strict();

const TextoSchema = z
  .object({
    texto: z
      .string()
      .min(1)
      .max(40)
      .describe("Sem acento no desenho (as letras acentuadas perdem o acento)."),
    em: ParSchema.describe("Canto de cima à esquerda do texto, [coluna, linha] em células."),
    altura: z
      .number()
      .min(0.25)
      .max(10)
      .optional()
      .describe("Altura da letra, em células (padrão 1)."),
    cor: Cor.optional(),
    espessura: z
      .number()
      .min(LIMITES_DO_DESENHO.espessuraMin)
      .max(LIMITES_DO_DESENHO.espessuraMax)
      .optional(),
  })
  .strict();

const ParedePedidaSchema = z
  .object({
    id: z.string().optional().describe("O id da parede (a ferramenta `ler` mostra)."),
    perto: ParSchema.optional().describe(
      "Em vez do id: a parede mais perto deste ponto [coluna, linha] (até 1 célula).",
    ),
    apagar: z.boolean().optional(),
    de: ParSchema.optional(),
    ate: ParSchema.optional(),
    por: ParSchema.optional().describe("Faz a parede virar um arco passando por este ponto."),
    tangente: ParSchema.optional(),
    reta: z.boolean().optional().describe("Endireita uma parede em arco."),
    tipo: TipoDeParedeSchema.optional(),
    estado: EstadoDePortaSchema.optional(),
  })
  .strict();

const PortaPedidaSchema = z
  .object({
    id: z.string().optional(),
    perto: ParSchema.optional().describe("A porta mais perto deste ponto [coluna, linha]."),
    estado: EstadoDePortaSchema.optional().describe(
      "aberta, fechada ou trancada. Sem isso, alterna aberta/fechada.",
    ),
  })
  .strict();

type NevoaPedida = z.infer<typeof NevoaSchema>;
type ParedePedida = z.infer<typeof ParedePedidaSchema>;
type PortaPedida = z.infer<typeof PortaPedidaSchema>;

function tracoDaNevoa(n: NevoaPedida, q: number): TracoDaNevoa {
  const forma = n.forma ?? (n.de && n.ate ? "retangulo" : n.pontos ? "poligono" : "tudo");
  const pts = (n.pontos ?? []).map((p) => emMetros(p, q));
  switch (forma) {
    case "tudo":
      return { forma, modo: n.modo, pontos: [] };
    case "retangulo": {
      if (!n.de || !n.ate) throw new ErroDoMcp("Retângulo precisa de `de` e `ate`.");
      return { forma, modo: n.modo, pontos: [emMetros(n.de, q), emMetros(n.ate, q)] };
    }
    case "poligono":
      if (pts.length < 3) throw new ErroDoMcp("Polígono precisa de 3 pontos ou mais em `pontos`.");
      return { forma, modo: n.modo, pontos: pts };
    case "pincel":
      if (pts.length < 1) throw new ErroDoMcp("Pincel precisa de ao menos um ponto em `pontos`.");
      return { forma, modo: n.modo, pontos: pts, raio: n.raioM ?? 1.5 };
  }
}

function distanciaAoSegmento(p: Par, a: Par, b: Par): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c2 = dx * dx + dy * dy;
  const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / c2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** A parede pelo id ou pela que está mais perto de um ponto (em células). */
function acharParede(
  estado: Estado,
  cena: Cena,
  p: { id?: string | undefined; perto?: Par | undefined },
  soPortas = false,
): Parede {
  const dela = estado.paredes.filter(
    (w) => w.cenaId === cena.id && (!soPortas || w.tipo === "porta" || w.tipo === "secreta"),
  );
  if (p.id !== undefined) {
    const w = dela.find((x) => x.id === p.id);
    if (!w) {
      throw new ErroDoMcp(
        `A ${soPortas ? "porta" : "parede"} "${p.id}" não é da cena "${cena.nome}". Use a ferramenta \`ler\` para ver os ids.`,
      );
    }
    return w;
  }
  if (p.perto === undefined) throw new ErroDoMcp("Diga `id` ou `perto` ([coluna, linha]).");
  const q = cena.grid.quadradoM;
  let melhor: { w: Parede; d: number } | undefined;
  for (const w of dela) {
    const d = distanciaAoSegmento(p.perto, [w.a.x / q, w.a.y / q], [w.b.x / q, w.b.y / q]);
    if (!melhor || d < melhor.d) melhor = { w, d };
  }
  if (!melhor || melhor.d > 1) {
    throw new ErroDoMcp(
      `Não há ${soPortas ? "porta" : "parede"} a menos de 1 célula de [${p.perto.join(", ")}] na cena "${cena.nome}".`,
    );
  }
  return melhor.w;
}

async function mexerNaParede(
  p: ParedePedida,
  cena: Cena,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const estado = ctx.sala.estado();
  const w = acharParede(estado, cena, p);
  if (p.apagar) {
    await passo(ctx, lote, "parede.apagar", { id: w.id });
    return `Apagou a parede ${w.id}.`;
  }
  const q = cena.grid.quadradoM;
  const mud: Record<string, unknown> = {};
  const a = p.de ? paredeEmMetros(p.de, q) : w.a;
  const b = p.ate ? paredeEmMetros(p.ate, q) : w.b;
  if (p.de) mud.a = a;
  if (p.ate) mud.b = b;
  if (p.por && p.tangente) throw new ErroDoMcp("Use `por` ou `tangente`, não os dois.");
  if (p.por) mud.meio = paredeEmMetros(p.por, q);
  else if (p.tangente) {
    const meio = meioDoArcoTangente(a, { x: p.tangente[0], y: p.tangente[1] }, b);
    if (meio === null) throw new ErroDoMcp("`ate` está na linha da `tangente`: isso é uma reta.");
    mud.meio = meio;
  } else if (p.reta) mud.meio = null;
  if (p.tipo !== undefined) mud.tipo = p.tipo;
  if (p.estado !== undefined) mud.estado = p.estado;
  if (Object.keys(mud).length === 0) return `A parede ${w.id} não mudou.`;
  await passo(ctx, lote, "parede.editar", { id: w.id, ...mud });
  return `Editou a parede ${w.id} (${Object.keys(mud).join(", ")}).`;
}

async function mexerNaPorta(
  p: PortaPedida,
  cena: Cena,
  ctx: Contexto,
  lote: Lote,
): Promise<string> {
  const w = acharParede(ctx.sala.estado(), cena, p, true);
  if (p.estado === undefined) {
    await passo(ctx, lote, "porta.alternar", { id: w.id });
    return `Alternou a porta ${w.id} (estava ${w.estado ?? "fechada"}).`;
  }
  if ((w.estado ?? "fechada") === p.estado) return `A porta ${w.id} já estava ${p.estado}.`;
  await passo(ctx, lote, "parede.editar", { id: w.id, estado: p.estado });
  return `A porta ${w.id} agora está ${p.estado}.`;
}

function slug(texto: string): string {
  return (
    normalizarBusca(texto)
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || "texto"
  );
}

export const mapa = definir({
  nome: "mapa",
  descricao: [
    "Só do mestre. Mexe no MAPA de uma cena (padrão: a cena do grupo): névoa, desenhos e textos, paredes e portas. Tudo em células [coluna, linha] a partir do canto de cima à esquerda.",
    '`nevoa`: lista de traços aplicados em ordem; o último que cobre o ponto decide. Cobrir tudo e revelar uma área: [{"modo":"cobrir"},{"modo":"revelar","de":[10,4],"ate":[14,20]}]. `desfazerNevoa: n` tira os últimos n traços.',
    "`desenhos` (livre, linha, retângulo, círculo) e `textos` ({texto, em, altura}) aparecem para todos os que veem a cena (o texto é feito de traços, sem acento). `moverDesenhos` desloca um texto ou desenho (em células). `apagar`: {todos}, {textos:[trecho]}, {ultimos:n} ou {ids}.",
    "`paredes`: edita ou apaga uma parede pelo `id` ou por `perto` (para criar paredes use `cenas`). `portas`: abre, fecha ou tranca (`estado`) ou alterna. `esquecerMemoria`: os jogadores esquecem o que já viram do mapa.",
    'Exemplo: {"cena":"Ponte","nevoa":[{"modo":"cobrir"},{"modo":"revelar","pontos":[[8,10],[14,10],[14,12],[8,12]]}],"textos":[{"texto":"PONTE","em":[8,8]}],"portas":[{"perto":[3,5],"estado":"trancada"}]}',
  ].join(" "),
  entrada: z
    .object({
      cena: z.string().optional().describe("Nome da cena (padrão: a do grupo)."),
      nevoa: z.array(NevoaSchema).max(60).optional(),
      desfazerNevoa: z.number().int().min(1).max(60).optional(),
      desenhos: z.array(DesenhoSchemaDoPedido).max(60).optional(),
      textos: z.array(TextoSchema).max(10).optional(),
      apagar: z
        .object({
          todos: z.boolean().optional().describe("Apaga todos os desenhos e textos da cena."),
          textos: z
            .array(z.string())
            .optional()
            .describe("Apaga os textos que contêm este trecho (sem acento nem caixa)."),
          ultimos: z.number().int().min(1).max(50).optional().describe("Apaga os n mais recentes."),
          ids: z.array(z.string()).max(200).optional(),
        })
        .strict()
        .optional(),
      moverDesenhos: z
        .array(
          z
            .object({
              texto: z
                .string()
                .optional()
                .describe("Move o texto que contém este trecho (todas as letras juntas)."),
              id: z.string().optional().describe("Ou o id de um desenho."),
              dx: z.number().describe("Células para a direita (negativo: esquerda)."),
              dy: z.number().describe("Células para baixo (negativo: para cima)."),
            })
            .strict(),
        )
        .max(20)
        .optional(),
      paredes: z.array(ParedePedidaSchema).max(100).optional(),
      portas: z.array(PortaPedidaSchema).max(60).optional(),
      esquecerMemoria: z.boolean().optional(),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "cena.editar", estado.permissoes),
  async executar(e, ctx) {
    const cena = cenaPorNome(ctx.sala.estado(), e.cena);
    const q = cena.grid.quadradoM;
    const r = new Relatorio();
    const lote = ctx.novoLote(`mapa de ${cena.nome}`);
    const tente = async (nome: string, fazer: () => Promise<string>) => {
      try {
        r.ok(await fazer());
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        r.falha(`${nome}: ${erro.message}`);
      }
    };

    for (const [i, n] of (e.nevoa ?? []).entries()) {
      await tente(`névoa ${i + 1}`, async () => {
        const traco = tracoDaNevoa(n, q);
        await passoComEspera(ctx, lote, "nevoa.tracar", { cenaId: cena.id, traco });
        return `${n.modo === "cobrir" ? "Cobriu" : "Revelou"} ${traco.forma === "tudo" ? "a cena inteira" : `(${traco.forma})`}.`;
      });
    }
    if (e.desfazerNevoa) {
      await tente("desfazer névoa", async () => {
        for (let i = 0; i < (e.desfazerNevoa ?? 0); i++) {
          await passoComEspera(ctx, lote, "nevoa.desfazer", { cenaId: cena.id });
        }
        return `Tirou os últimos ${e.desfazerNevoa} traços da névoa.`;
      });
    }

    for (const [i, d] of (e.desenhos ?? []).entries()) {
      await tente(`desenho ${i + 1}`, async () => {
        const id = novoId("desenho");
        await passoComEspera(ctx, lote, "desenho.criar", {
          desenho: {
            id,
            cenaId: cena.id,
            forma: d.forma,
            pontos: d.pontos.map((p) => emMetros(p, q)),
            cor: d.cor ?? COR_PADRAO_DO_DESENHO,
            espessura: d.espessura ?? 3,
            ...(d.preenchido !== undefined ? { preenchido: d.preenchido } : {}),
          },
        });
        return `Desenhou ${d.forma}.`;
      });
    }
    for (const [i, t] of (e.textos ?? []).entries()) {
      await tente(`texto ${i + 1} "${t.texto}"`, async () => {
        const pos = emMetros(t.em, q);
        const { tracos, ignorados, larguraM } = tracosDoTexto(
          t.texto,
          pos.x,
          pos.y,
          (t.altura ?? 1) * q,
        );
        if (tracos.length === 0)
          throw new ErroDoMcp("Não há letra que dê para desenhar nesse texto.");
        if (tracos.length > 120)
          throw new ErroDoMcp("Texto longo demais: use até uns 20 caracteres.");
        const grupo = `txt-${slug(t.texto)}-${novoId("t").slice(2, 6)}`;
        for (const [n, tr] of tracos.entries()) {
          await passoComEspera(ctx, lote, "desenho.criar", {
            desenho: {
              id: `${grupo}-${n}`,
              cenaId: cena.id,
              forma: "livre",
              pontos: tr.pontos,
              cor: t.cor ?? COR_PADRAO_DO_DESENHO,
              espessura: t.espessura ?? 3,
            },
          });
        }
        const aviso = ignorados.length > 0 ? ` (sem desenho para: ${ignorados.join(" ")})` : "";
        return `Escreveu "${t.texto}" com ${Math.round((larguraM / q) * 10) / 10} células de largura${aviso}.`;
      });
    }

    for (const [i, m] of (e.moverDesenhos ?? []).entries()) {
      await tente(`mover ${i + 1}`, async () => {
        const dela = ctx.sala.estado().desenhos.filter((d) => d.cenaId === cena.id);
        let alvos: typeof dela;
        if (m.id !== undefined) alvos = dela.filter((d) => d.id === m.id);
        else if (m.texto !== undefined) {
          const chave = slug(m.texto);
          alvos = dela.filter(
            (d) => d.id.startsWith("txt-") && d.id.split("-")[1]?.includes(chave),
          );
        } else throw new ErroDoMcp("Diga `texto` ou `id`.");
        if (alvos.length === 0) throw new ErroDoMcp("Não achei esse desenho na cena.");
        for (const d of alvos) {
          await passoComEspera(ctx, lote, "desenho.mover", {
            id: d.id,
            dx: m.dx * q,
            dy: m.dy * q,
          });
        }
        return `Moveu ${alvos.length} traço(s) (${m.dx}, ${m.dy}) células.`;
      });
    }

    const ap = e.apagar;
    if (ap) {
      await tente("apagar desenhos", async () => {
        const dela = ctx.sala.estado().desenhos.filter((d) => d.cenaId === cena.id);
        const feitos: string[] = [];
        if (ap.todos) {
          await passo(ctx, lote, "desenho.limpar", { cenaId: cena.id });
          feitos.push(`todos (${dela.length})`);
        } else {
          let ids = [...(ap.ids ?? [])];
          for (const trecho of ap.textos ?? []) {
            const alvo = slug(trecho);
            const achados = dela.filter(
              (d) => d.id.startsWith("txt-") && d.id.split("-")[1]?.includes(alvo),
            );
            if (achados.length === 0)
              throw new ErroDoMcp(`Não achei texto com "${trecho}" na cena.`);
            ids = ids.concat(achados.map((d) => d.id));
          }
          for (let i = 0; i < ids.length; i += LIMITES_DO_DESENHO.apagarPorVez) {
            await passo(ctx, lote, "desenho.apagar", {
              ids: ids.slice(i, i + LIMITES_DO_DESENHO.apagarPorVez),
            });
          }
          if (ids.length > 0) feitos.push(`${ids.length} traços`);
          for (let i = 0; i < (ap.ultimos ?? 0); i++) {
            await passoComEspera(ctx, lote, "desenho.voltar", { cenaId: cena.id });
          }
          if (ap.ultimos) feitos.push(`os ${ap.ultimos} últimos`);
        }
        return feitos.length > 0 ? `Apagou ${feitos.join(" e ")}.` : "Nada para apagar.";
      });
    }

    for (const [i, p] of (e.paredes ?? []).entries()) {
      await tente(`parede ${i + 1}`, () => mexerNaParede(p, cena, ctx, lote));
    }
    for (const [i, p] of (e.portas ?? []).entries()) {
      await tente(`porta ${i + 1}`, () => mexerNaPorta(p, cena, ctx, lote));
    }
    if (e.esquecerMemoria) {
      await tente("memória", async () => {
        await passo(ctx, lote, "memoria.esquecer", { cenaId: cena.id });
        return "Os jogadores esqueceram o que já tinham visto desta cena.";
      });
    }
    return r.saida(
      "Nada a fazer: diga `nevoa`, `desenhos`, `textos`, `apagar`, `paredes` ou `portas`.",
    );
  },
});
