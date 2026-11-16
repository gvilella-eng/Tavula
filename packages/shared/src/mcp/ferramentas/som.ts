import { z } from "zod";
import {
  CORES_DO_SOM,
  type Estado,
  type GrupoDeSom,
  ICONES_DO_SOM,
  LUGARES_POR_GRUPO,
  lugarDe,
  lugaresDe,
  MAXIMO_DO_NOME_DO_LUGAR,
  pode,
  tocandoAgora,
  usosDoSom,
  volumeGeralDe,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { acharExato } from "../nomes.ts";
import { cenaPorNome, somPorNome, sonsDaMesa } from "./achados.ts";
import { definir, passo, Relatorio } from "./base.ts";

/** O volume que a mesa de som usa por padrão num lugar novo. */
const VOLUME_PADRAO = 0.8;

/** Um lugar: o número de 1 a 8 (como a tela mostra) ou o nome do botão. */
const LugarPedidoSchema = z.union([z.number().int().min(1).max(LUGARES_POR_GRUPO), z.string()]);

/** O índice (0 a 7) de um lugar ocupado do grupo, pelo número (1 a 8) ou pelo nome do botão. */
function indiceDoLugar(estado: Estado, grupo: GrupoDeSom, pedido: number | string): number {
  if (typeof pedido === "number") {
    if (!lugarDe(estado.mesaDeSom, grupo, pedido - 1)) {
      throw new ErroDoMcp(`O lugar ${pedido} de ${rotuloDoGrupo(grupo)} está vazio.`);
    }
    return pedido - 1;
  }
  const l = lugaresDe(estado.mesaDeSom);
  const lista = (grupo === "efeito" ? l.efeitos : l.ambientes).flatMap((x, indice) =>
    x ? [{ indice, nome: x.nome }] : [],
  );
  const achado = acharExato(lista, pedido, (x) => x.nome);
  if (!achado) {
    throw new ErroDoMcp(
      `Não existe "${pedido}" entre ${rotuloDoGrupo(grupo)}. Há: ${lista.map((x) => `${x.indice + 1} ${x.nome}`).join(", ") || "nada"}.`,
    );
  }
  return achado.indice;
}

const rotuloDoGrupo = (g: GrupoDeSom) => (g === "efeito" ? "os efeitos" : "os ambientes");

export const som = definir({
  nome: "som",
  descricao: [
    "Só do mestre (ou de quem tem 'controlar o som'). A MESA DE SOM tem 8 efeitos (um toque toca uma vez, para todos) e 8 ambientes (vários ao mesmo tempo, em laço, cada um com o próprio volume). Os arquivos sobem com `arquivos` (uso `som`); aqui se usa o nome do arquivo. `listar` mostra os sons, os 16 lugares e o que toca.",
    `\`lugares\`: [{grupo:"efeito"|"ambiente", lugar:1-8, som, nome (até ${MAXIMO_DO_NOME_DO_LUGAR} letras), icone (${ICONES_DO_SOM.join("|")}), cor (${CORES_DO_SOM.join("|")}), volume}] configura um lugar (\`som: null\` o esvazia; o que não vier fica como está). \`efeito\`: {lugar (número ou nome do botão) ou som, volume} toca um efeito; \`pararEfeito\`: true corta todos, ou um lugar. \`ambientes\`: [{lugar, ligado, volume}] MARCA ou desmarca ambientes (e o volume de cada um): eles só tocam enquanto o TRANSPORTE toca. \`transporte\`: "tocar" toca os ambientes marcados (precisa de um) e "parar" os cala e corta os efeitos, deixando-os marcados. \`volumeGeral\`: 0 a 1, vale para tudo. \`pararTudo\`: corta efeitos e ambientes. \`apagar\`: [nome do arquivo] tira o som da mesa, dos lugares, das zonas e das automações. \`ambientesDaCena\`: [{cena, lugares: [1-8 ou nomes] | null}] define quais ambientes ligam quando o grupo vai para a cena (\`null\` não mexe). \`zonas\`: [{cena, zona, som, laco}] põe o som de uma zona (\`som: null\` tira).`,
    'Exemplo: {"lugares":[{"grupo":"ambiente","lugar":1,"som":"floresta.mp3","nome":"Floresta","icone":"vento","cor":"verde"}],"ambientes":[{"lugar":"Floresta","ligado":true,"volume":0.5}],"efeito":{"lugar":1}}',
  ].join(" "),
  entrada: z
    .object({
      listar: z.boolean().optional(),
      lugares: z
        .array(
          z
            .object({
              grupo: z.enum(["efeito", "ambiente"]),
              lugar: z.number().int().min(1).max(LUGARES_POR_GRUPO),
              som: z.string().nullable().optional(),
              nome: z.string().min(1).max(MAXIMO_DO_NOME_DO_LUGAR).optional(),
              icone: z.enum(ICONES_DO_SOM).optional(),
              cor: z.enum(CORES_DO_SOM).optional(),
              volume: z.number().min(0).max(1).optional(),
            })
            .strict(),
        )
        .max(16)
        .optional(),
      efeito: z
        .object({
          lugar: LugarPedidoSchema.optional(),
          som: z.string().optional(),
          volume: z.number().min(0).max(1).optional(),
        })
        .strict()
        .optional(),
      pararEfeito: z.union([z.boolean(), LugarPedidoSchema]).optional(),
      ambientes: z
        .array(
          z
            .object({
              lugar: LugarPedidoSchema,
              ligado: z.boolean(),
              volume: z.number().min(0).max(1).optional(),
            })
            .strict(),
        )
        .max(16)
        .optional(),
      transporte: z.enum(["tocar", "parar"]).optional(),
      volumeGeral: z.number().min(0).max(1).optional(),
      pararTudo: z.boolean().optional(),
      apagar: z.array(z.string()).max(20).optional(),
      ambientesDaCena: z
        .array(
          z
            .object({
              cena: z.string(),
              lugares: z.array(LugarPedidoSchema).max(LUGARES_POR_GRUPO).nullable(),
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
      const l = lugaresDe(estado.mesaDeSom);
      const linha = (grupo: GrupoDeSom, lista: typeof l.efeitos) =>
        lista
          .map((x, i) =>
            x
              ? `${i + 1} "${x.nome}" (${x.icone}, ${x.cor}, volume ${x.volume}${
                  grupo === "ambiente" && estado.somLigado?.ambientes.some((a) => a.indice === i)
                    ? tocandoAgora(estado)
                      ? ", TOCANDO"
                      : ", marcado (transporte parado)"
                    : ""
                })`
              : `${i + 1} vazio`,
          )
          .join("; ");
      r.ok(
        [
          sons.length === 0
            ? "A mesa não tem sons."
            : `Sons da mesa: ${sons.map((s) => `${s.nomeOriginal} [${s.hash.slice(0, 8)}]`).join(", ")}.`,
          `Efeitos: ${linha("efeito", l.efeitos)}.`,
          `Ambientes: ${linha("ambiente", l.ambientes)}.`,
          `Volume geral ${volumeGeralDe(estado)}.`,
          `Transporte: ${tocandoAgora(estado) ? "tocando" : "parado"}.`,
        ].join(" "),
      );
    }
    for (const p of e.lugares ?? []) {
      await tente(`lugar ${p.lugar} de ${rotuloDoGrupo(p.grupo)}`, async () => {
        const estado = ctx.sala.estado();
        const indice = p.lugar - 1;
        if (p.som === null) {
          await passo(ctx, lote, "som.lugar", { grupo: p.grupo, indice, lugar: null });
          return `Esvaziou o lugar ${p.lugar} de ${rotuloDoGrupo(p.grupo)}.`;
        }
        const atual = lugarDe(estado.mesaDeSom, p.grupo, indice);
        const arquivo = p.som === undefined ? null : somPorNome(estado, p.som);
        const hash = arquivo?.hash ?? atual?.hash;
        if (hash === undefined) {
          throw new ErroDoMcp("Diga o `som` (o arquivo) para preencher um lugar vazio.");
        }
        const nomePadrao = (arquivo?.nomeOriginal ?? "Som")
          .replace(/\.[^.]+$/, "")
          .slice(0, MAXIMO_DO_NOME_DO_LUGAR);
        const lugar = {
          hash,
          nome: p.nome ?? atual?.nome ?? (nomePadrao || "Som"),
          icone: p.icone ?? atual?.icone ?? (p.grupo === "efeito" ? "espadas" : "musica"),
          cor: p.cor ?? atual?.cor ?? "ambar",
          volume: p.volume ?? atual?.volume ?? VOLUME_PADRAO,
        } as const;
        await passo(ctx, lote, "som.lugar", { grupo: p.grupo, indice, lugar });
        return `Lugar ${p.lugar} de ${rotuloDoGrupo(p.grupo)}: "${lugar.nome}".`;
      });
    }
    if (e.efeito) {
      const t = e.efeito;
      await tente("efeito", async () => {
        const estado = ctx.sala.estado();
        if (t.lugar !== undefined) {
          const indice = indiceDoLugar(estado, "efeito", t.lugar);
          await passo(ctx, lote, "som.efeito", {
            lugar: indice,
            ...(t.volume === undefined ? {} : { volume: t.volume }),
          });
          return `Tocou o efeito do lugar ${indice + 1}.`;
        }
        if (t.som === undefined) throw new ErroDoMcp("Diga o `lugar` ou o `som` do efeito.");
        const s = somPorNome(estado, t.som);
        await passo(ctx, lote, "som.efeito", { hash: s.hash, volume: t.volume ?? VOLUME_PADRAO });
        return `Tocou o efeito "${s.nomeOriginal}".`;
      });
    }
    if (e.pararEfeito !== undefined && e.pararEfeito !== false) {
      await tente("parar o efeito", async () => {
        if (e.pararEfeito === true) {
          await passo(ctx, lote, "som.efeitoParar", {});
          return "Cortou os efeitos.";
        }
        const indice = indiceDoLugar(ctx.sala.estado(), "efeito", e.pararEfeito as number | string);
        await passo(ctx, lote, "som.efeitoParar", { lugar: indice });
        return `Cortou o efeito do lugar ${indice + 1}.`;
      });
    }
    for (const a of e.ambientes ?? []) {
      await tente(`ambiente "${a.lugar}"`, async () => {
        const indice = indiceDoLugar(ctx.sala.estado(), "ambiente", a.lugar);
        await passo(ctx, lote, "som.ambiente", {
          indice,
          ligado: a.ligado,
          ...(a.volume === undefined ? {} : { volume: a.volume }),
        });
        const parado = !tocandoAgora(ctx.sala.estado());
        return a.ligado
          ? `Marcou o ambiente do lugar ${indice + 1}${parado ? " (o transporte está parado: use o transporte tocar para ouvir)" : ""}.`
          : `Desmarcou o ambiente do lugar ${indice + 1}.`;
      });
    }
    if (e.transporte !== undefined) {
      const quer = e.transporte;
      await tente("transporte", async () => {
        await passo(ctx, lote, "som.transporte", { tocando: quer === "tocar" });
        return quer === "tocar"
          ? "Tocando os ambientes marcados."
          : "Parou o som (os ambientes seguem marcados).";
      });
    }
    if (e.volumeGeral !== undefined) {
      const v = e.volumeGeral;
      await tente("volume geral", async () => {
        await passo(ctx, lote, "som.volumeGeral", { volume: v });
        return `Volume geral ${v}.`;
      });
    }
    if (e.pararTudo) {
      await tente("parar tudo", async () => {
        await passo(ctx, lote, "som.pararTudo", {});
        return "Parou tudo.";
      });
    }
    for (const nome of e.apagar ?? []) {
      await tente(`apagar "${nome}"`, async () => {
        const estado = ctx.sala.estado();
        const s = somPorNome(estado, nome);
        const usos = usosDoSom(estado, s.hash);
        await passo(ctx, lote, "som.apagar", { hash: s.hash });
        const onde = [
          ...usos.lugares.map((u) => `${rotuloDoGrupo(u.grupo)} ${u.indice + 1}`),
          ...usos.zonas.map((z) => `zona ${z}`),
          ...usos.automacoes.map((x) => `automação ${x}`),
        ];
        return `Apagou o som "${s.nomeOriginal}" da mesa${onde.length > 0 ? ` (estava em: ${onde.join(", ")})` : ""}. O arquivo continua na pasta de sons do computador.`;
      });
    }
    for (const c of e.ambientesDaCena ?? []) {
      await tente(`ambientes da cena "${c.cena}"`, async () => {
        const estado = ctx.sala.estado();
        const cena = cenaPorNome(estado, c.cena);
        if (c.lugares === null) {
          await passo(ctx, lote, "cena.editar", { cenaId: cena.id, ambientes: null });
          return `A cena "${cena.nome}" não mexe nos ambientes.`;
        }
        const indices = c.lugares.map((l) => indiceDoLugar(estado, "ambiente", l));
        await passo(ctx, lote, "cena.editar", { cenaId: cena.id, ambientes: indices });
        return `A cena "${cena.nome}" liga os ambientes ${indices.map((i) => i + 1).join(", ") || "(nenhum)"}.`;
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
    return r.saida(
      "Nada a fazer: diga `listar`, `lugares`, `efeito`, `pararEfeito`, `ambientes`, `transporte`, `volumeGeral`, `pararTudo`, `apagar`, `ambientesDaCena` ou `zonas`.",
    );
  },
});
