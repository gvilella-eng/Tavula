import { z } from "zod";
import {
  CORES_DO_SOM,
  duracaoLegivel,
  ENERGIA_PADRAO,
  EnergiaSchema,
  EtiquetaSchema,
  etiquetasDaBiblioteca,
  faixasDoFiltro,
  ICONES_DO_SOM,
  MAXIMO_DE_BOTOES_DE_MUSICA,
  MAXIMO_DE_ETIQUETAS,
  MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA,
  musicaAgora,
  ORDENS_DA_MUSICA,
  pode,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, definir, passo, Relatorio } from "./base.ts";

const EntradaDaMusica = z
  .object({
    listar: z.boolean().optional(),
    faixas: z
      .array(
        z
          .object({
            musica: z.string(),
            nome: z.string().min(1).max(120).optional(),
            descricao: z.string().min(1).max(200).nullable().optional(),
            energia: EnergiaSchema.nullable().optional(),
            etiquetas: z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS).optional(),
            maisEtiquetas: z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS).optional(),
            menosEtiquetas: z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS).optional(),
            tirar: z.boolean().optional(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    botoes: z
      .array(
        z
          .object({
            nome: z.string().min(1).max(MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA),
            novoNome: z.string().min(1).max(MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA).optional(),
            icone: z.enum(ICONES_DO_SOM).optional(),
            cor: z.enum(CORES_DO_SOM).optional(),
            etiquetas: z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS).optional(),
            energiaMin: EnergiaSchema.optional(),
            energiaMax: EnergiaSchema.optional(),
            ordem: z.enum(ORDENS_DA_MUSICA).optional(),
            apagar: z.boolean().optional(),
          })
          .strict(),
      )
      .max(MAXIMO_DE_BOTOES_DE_MUSICA)
      .optional(),
    tocar: z
      .object({
        botao: z.string().optional(),
        etiquetas: z.array(EtiquetaSchema).max(MAXIMO_DE_ETIQUETAS).optional(),
        energiaMin: EnergiaSchema.optional(),
        energiaMax: EnergiaSchema.optional(),
        ordem: z.enum(ORDENS_DA_MUSICA).optional(),
      })
      .strict()
      .optional(),
    controle: z.enum(["pausar", "retomar", "proxima", "anterior", "voltar"]).optional(),
    volume: z.number().min(0).max(1).optional(),
  })
  .strict();

type PedidoDeMusica = z.infer<typeof EntradaDaMusica>;

/** A parte da música da ferramenta `som`: etiquetar, dar energia, os botões e o que toca (tudo por nome). */
async function executarMusica(
  e: PedidoDeMusica,
  ctx: Contexto,
  lote: Lote,
  r: Relatorio,
  tente: (nome: string, fazer: () => Promise<string>) => Promise<void>,
): Promise<void> {
  const biblioteca = () => ctx.sala.estado().musica ?? { faixas: [], botoes: [] };
  if (e.listar) {
    const estado = ctx.sala.estado();
    const b = biblioteca();
    const tocandoJa = estado.musicaTocando ? musicaAgora(estado.musicaTocando, Date.now()) : null;
    r.ok(
      [
        b.faixas.length === 0
          ? "A biblioteca de música está vazia (o mestre adiciona os mp3 pela mesa de som, aba Música)."
          : `Músicas (${b.faixas.length}): ${b.faixas
              .slice(0, 80)
              .map(
                (f) =>
                  `"${f.nome}" (${duracaoLegivel(f.duracaoMs)}, energia ${f.energia ?? ENERGIA_PADRAO}${f.etiquetas.length > 0 ? `, ${f.etiquetas.join("/")}` : ""})`,
              )
              .join("; ")}${b.faixas.length > 80 ? " e mais" : ""}.`,
        `Etiquetas: ${
          etiquetasDaBiblioteca(b.faixas)
            .map((x) => `${x.nome} (${x.qtd})`)
            .join(", ") || "nenhuma"
        }.`,
        `Botões: ${
          b.botoes
            .map(
              (x) =>
                `"${x.nome}" (${x.etiquetas.join(" + ") || "todas"}, energia ${x.energiaMin}-${x.energiaMax}, ${x.ordem}, ${faixasDoFiltro(b.faixas, x).length} músicas)`,
            )
            .join("; ") || "nenhum"
        }.`,
        estado.musicaTocando
          ? `Tocando: botão "${estado.musicaTocando.botaoNome}"${tocandoJa ? `, "${tocandoJa.peca.nome}"` : ""}${estado.musicaTocando.tocando ? "" : " (pausada)"}, volume ${estado.musicaTocando.volume}${estado.musicaTocando.anterior ? `; dá para voltar a "${estado.musicaTocando.anterior.botaoNome}"` : ""}.`
          : "Nenhuma música tocando.",
      ].join(" "),
    );
  }
  for (const f of e.faixas ?? []) {
    await tente(`música "${f.musica}"`, async () => {
      const faixa = achar(biblioteca().faixas, f.musica, {
        rotulo: "música",
        nomeDe: (x) => x.nome,
        idDe: (x) => x.hash,
      });
      if (f.tirar) {
        await passo(ctx, lote, "musica.tirarFaixas", { hashes: [faixa.hash] });
        return `Tirou "${faixa.nome}" da lista de músicas.`;
      }
      const mudancas = {
        ...(f.nome === undefined ? {} : { nome: f.nome }),
        ...(f.descricao === undefined ? {} : { descricao: f.descricao }),
        ...(f.energia === undefined ? {} : { energia: f.energia }),
        ...(f.etiquetas === undefined ? {} : { etiquetas: f.etiquetas }),
        ...(f.maisEtiquetas === undefined ? {} : { maisEtiquetas: f.maisEtiquetas }),
        ...(f.menosEtiquetas === undefined ? {} : { menosEtiquetas: f.menosEtiquetas }),
      };
      if (Object.keys(mudancas).length === 0) {
        throw new ErroDoMcp("Diga o que mudar: nome, descricao, energia ou etiquetas.");
      }
      await passo(ctx, lote, "musica.editarFaixas", { hashes: [faixa.hash], ...mudancas });
      const nova = biblioteca().faixas.find((x) => x.hash === faixa.hash);
      return `"${nova?.nome ?? faixa.nome}": energia ${nova?.energia ?? ENERGIA_PADRAO}, etiquetas ${nova?.etiquetas.join(", ") || "nenhuma"}.`;
    });
  }
  for (const b of e.botoes ?? []) {
    await tente(`botão de música "${b.nome}"`, async () => {
      const existente = acharExato(biblioteca().botoes, b.nome, (x) => x.nome);
      if (b.apagar) {
        if (!existente) throw new ErroDoMcp(`Não existe o botão de música "${b.nome}".`);
        await passo(ctx, lote, "musica.botaoApagar", { id: existente.id });
        return `Apagou o botão de música "${existente.nome}".`;
      }
      const botao = {
        id: existente?.id ?? novoId("musica"),
        nome: b.novoNome ?? existente?.nome ?? b.nome,
        icone: b.icone ?? existente?.icone ?? "musica",
        cor: b.cor ?? existente?.cor ?? "ambar",
        etiquetas: b.etiquetas ?? existente?.etiquetas ?? [],
        energiaMin: b.energiaMin ?? existente?.energiaMin ?? 1,
        energiaMax: b.energiaMax ?? existente?.energiaMax ?? 5,
        ordem: b.ordem ?? existente?.ordem ?? "aleatoria",
      } as const;
      if (botao.energiaMin > botao.energiaMax) {
        throw new ErroDoMcp("A energia mínima passa da máxima.");
      }
      await passo(ctx, lote, "musica.botao", { botao });
      const n = faixasDoFiltro(biblioteca().faixas, botao).length;
      return `Botão de música "${botao.nome}": ${botao.etiquetas.join(" + ") || "todas"}, energia ${botao.energiaMin} a ${botao.energiaMax}, ${botao.ordem === "crescente" ? "crescente" : "aleatória, sem repetir"} (${n} ${n === 1 ? "música" : "músicas"}).`;
    });
  }
  if (e.tocar) {
    const t = e.tocar;
    await tente("tocar música", async () => {
      if (t.botao !== undefined) {
        const botao = achar(biblioteca().botoes, t.botao, {
          rotulo: "botão de música",
          nomeDe: (x) => x.nome,
          idDe: (x) => x.id,
        });
        await passo(ctx, lote, "musica.tocar", { botaoId: botao.id });
        return `Tocando o botão "${botao.nome}" para todos.`;
      }
      const filtro = {
        etiquetas: t.etiquetas ?? [],
        energiaMin: t.energiaMin ?? 1,
        energiaMax: t.energiaMax ?? 5,
        ordem: t.ordem ?? "aleatoria",
      } as const;
      await passo(ctx, lote, "musica.tocar", { filtro });
      return `Tocando ${filtro.etiquetas.join(" + ") || "todas as músicas"} para todos.`;
    });
  }
  if (e.controle !== undefined) {
    const acao = e.controle;
    await tente("controle da música", async () => {
      await passo(ctx, lote, "musica.controle", { acao });
      const m = ctx.sala.estado().musicaTocando;
      return acao === "voltar"
        ? `Voltou ao botão "${m?.botaoNome ?? ""}".`
        : `Música: ${acao === "proxima" ? "próxima" : acao}.`;
    });
  }
  if (e.volume !== undefined) {
    const v = e.volume;
    await tente("volume da música", async () => {
      await passo(ctx, lote, "musica.volume", { volume: v });
      return `Volume da música ${v}.`;
    });
  }
}

export const musica = definir({
  nome: "musica",
  descricao: [
    "Só do mestre (ou de quem tem 'controlar o som'). A MÚSICA da mesa toca por cima dos ambientes, igual para todos. A biblioteca tem músicas com etiquetas e energia de 1 a 5 (sem nota vale 3; a energia só filtra, não é peso de sorte). As músicas entram pela mesa de som (o mestre adiciona o mp3 ou a pasta; as subpastas viram etiquetas); aqui você etiqueta, dá energia, cria botões e toca. Use sempre os nomes.",
    `\`listar\`: true mostra a biblioteca, as etiquetas, os botões e o que toca. \`faixas\`: [{musica (nome), nome, descricao (null tira), energia (1-5, null tira), etiquetas (troca a lista), maisEtiquetas, menosEtiquetas, tirar: true (tira da lista)}]. \`botoes\`: [{nome, novoNome, icone (${ICONES_DO_SOM.join("|")}), cor (${CORES_DO_SOM.join("|")}), etiquetas (só as músicas que têm todas), energiaMin, energiaMax, ordem (${ORDENS_DA_MUSICA.join("|")}), apagar: true}] cria ou muda um botão (até ${MAXIMO_DE_BOTOES_DE_MUSICA}, nome até ${MAXIMO_DO_NOME_DO_BOTAO_DE_MUSICA} letras). \`tocar\`: {botao (nome)} ou {etiquetas, energiaMin, energiaMax, ordem} toca para todos: aleatória, sem repetir; ou crescente, da energia mais baixa para a mais alta e, no topo, só as mais fortes. \`controle\`: "pausar" | "retomar" | "proxima" | "anterior" | "voltar" ("voltar" retoma o botão que tocava antes, do ponto onde parou). \`volume\`: 0 a 1.`,
    'Exemplo: {"faixas":[{"musica":"Lâminas no Vau","maisEtiquetas":["Combate"],"energia":4}],"botoes":[{"nome":"Combate","etiquetas":["Combate"],"ordem":"crescente"}],"tocar":{"botao":"Combate"}}',
  ].join(" "),
  entrada: EntradaDaMusica,
  visivel: (estado, eu) => pode(eu, "som.controlar", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const lote = ctx.novoLote("música da mesa");
    const tente = async (nome: string, fazer: () => Promise<string>) => {
      try {
        r.ok(await fazer());
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        r.falha(`${nome}: ${erro.message}`);
      }
    };
    await executarMusica(e, ctx, lote, r, tente);
    return r.saida(
      "Nada a fazer: diga `listar`, `faixas`, `botoes`, `tocar`, `controle` ou `volume`.",
    );
  },
});
