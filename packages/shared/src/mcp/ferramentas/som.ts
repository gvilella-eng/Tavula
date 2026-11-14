import { z } from "zod";
import { pode } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { acharExato } from "../nomes.ts";
import { cenaPorNome, somPorNome, sonsDaMesa } from "./achados.ts";
import { definir, passo, Relatorio } from "./base.ts";

/** O volume que o painel de som da mesa usa por padrão. */
const VOLUME_PADRAO = 0.8;

const SomPedidoSchema = z
  .object({
    som: z.string().describe("Nome do arquivo de som (ou o começo do hash do `arquivos` listar)."),
    volume: z.number().min(0).max(1).optional().describe("0 a 1 (padrão 0,8)."),
  })
  .strict();

export const som = definir({
  nome: "som",
  descricao: [
    "Só do mestre (ou de quem tem 'controlar o som'). Toca e configura o SOM da mesa. Os arquivos de som sobem com `arquivos` (uso `som`); aqui se usa pelo nome do arquivo. `listar` mostra os sons da mesa.",
    '`trilha`: {"som","volume"} toca a trilha (um som por vez, em laço; o mesmo som de novo só muda o volume) ou "parar". `efeito`: toca uma vez para todos. `trilhaDaCena`: [{cena, som}] define a trilha padrão da cena (começa quando o grupo vai para ela; `som: null` tira). `zonas`: [{cena, zona, som, laco}] põe o som de uma zona (toca enquanto há um token dentro; `som: null` tira).',
    'Exemplo: {"trilha":{"som":"floresta.mp3","volume":0.5},"efeito":{"som":"trovao.ogg"},"trilhaDaCena":[{"cena":"Segunda","som":"floresta.mp3"}]}',
  ].join(" "),
  entrada: z
    .object({
      listar: z.boolean().optional(),
      trilha: z.union([SomPedidoSchema, z.literal("parar")]).optional(),
      efeito: SomPedidoSchema.optional(),
      trilhaDaCena: z
        .array(
          z
            .object({
              cena: z.string(),
              som: z.string().nullable(),
              volume: z.number().min(0).max(1).optional(),
            })
            .strict(),
        )
        .max(10)
        .optional(),
      zonas: z
        .array(
          z
            .object({
              cena: z.string(),
              zona: z.string(),
              som: z.string().nullable(),
              volume: z.number().min(0).max(1).optional(),
              laco: z.boolean().optional().describe("Padrão sim."),
            })
            .strict(),
        )
        .max(20)
        .optional(),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "som.controlar", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const lote = ctx.novoLote("som da mesa");
    const tente = async (nome: string, fazer: () => Promise<string>) => {
      try {
        r.ok(await fazer());
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        r.falha(`${nome}: ${erro.message}`);
      }
    };
    if (e.listar) {
      const estado = ctx.sala.estado();
      const sons = sonsDaMesa(estado);
      const tocando = estado.trilha
        ? ` Tocando agora: "${estado.trilha.nome}" (volume ${estado.trilha.volume}).`
        : " Nenhuma trilha tocando.";
      r.ok(
        sons.length === 0
          ? `A mesa não tem sons.${tocando}`
          : `Sons da mesa: ${sons.map((s) => `${s.nomeOriginal} [${s.hash.slice(0, 8)}]`).join(", ")}.${tocando}`,
      );
    }
    if (e.trilha === "parar") {
      await tente("parar a trilha", async () => {
        await passo(ctx, lote, "som.parar", {});
        return "Parou a trilha.";
      });
    } else if (e.trilha) {
      const t = e.trilha;
      await tente("trilha", async () => {
        const s = somPorNome(ctx.sala.estado(), t.som);
        await passo(ctx, lote, "som.trilha", { hash: s.hash, volume: t.volume ?? VOLUME_PADRAO });
        return `Trilha: "${s.nomeOriginal}" (volume ${t.volume ?? VOLUME_PADRAO}).`;
      });
    }
    if (e.efeito) {
      const t = e.efeito;
      await tente("efeito", async () => {
        const s = somPorNome(ctx.sala.estado(), t.som);
        await passo(ctx, lote, "som.efeito", { hash: s.hash, volume: t.volume ?? VOLUME_PADRAO });
        return `Tocou o efeito "${s.nomeOriginal}".`;
      });
    }
    for (const c of e.trilhaDaCena ?? []) {
      await tente(`trilha da cena "${c.cena}"`, async () => {
        const estado = ctx.sala.estado();
        const cena = cenaPorNome(estado, c.cena);
        if (c.som === null) {
          await passo(ctx, lote, "cena.editar", { cenaId: cena.id, trilha: null });
          return `Tirou a trilha da cena "${cena.nome}".`;
        }
        const s = somPorNome(estado, c.som);
        await passo(ctx, lote, "cena.editar", {
          cenaId: cena.id,
          trilha: { hash: s.hash, nome: s.nomeOriginal, volume: c.volume ?? VOLUME_PADRAO },
        });
        return `A cena "${cena.nome}" tem a trilha "${s.nomeOriginal}".`;
      });
    }
    for (const z2 of e.zonas ?? []) {
      await tente(`zona "${z2.zona}"`, async () => {
        const estado = ctx.sala.estado();
        const cena = cenaPorNome(estado, z2.cena);
        const zona = acharExato(
          (estado.zonas ?? []).filter((x) => x.cenaId === cena.id),
          z2.zona,
          (x) => x.nome,
        );
        if (!zona) throw new ErroDoMcp(`Não existe a zona "${z2.zona}" na cena "${cena.nome}".`);
        const efeitos: Record<string, unknown> = { ...zona.efeitos };
        if (z2.som === null) {
          delete efeitos.som;
        } else {
          const s = somPorNome(estado, z2.som);
          efeitos.som = {
            hash: s.hash,
            nome: s.nomeOriginal,
            volume: z2.volume ?? VOLUME_PADRAO,
            laco: z2.laco ?? true,
          };
        }
        await passo(ctx, lote, "zona.editar", { id: zona.id, mudancas: { efeitos } });
        return z2.som === null
          ? `Tirou o som da zona "${zona.nome}".`
          : `A zona "${zona.nome}" toca "${z2.som}" enquanto há alguém dentro.`;
      });
    }
    return r.saida("Nada a fazer: diga `listar`, `trilha`, `efeito`, `trilhaDaCena` ou `zonas`.");
  },
});
