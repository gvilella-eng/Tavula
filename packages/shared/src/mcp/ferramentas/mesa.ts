import { z } from "zod";
import {
  type Estado,
  normalizarBusca,
  type Pasta,
  pode,
  TEMPOS_PARA_JOGADORES,
  type Visibilidade,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar, acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../tipos.ts";
import { type Contexto, cadaItem, definir, passo, Relatorio } from "./base.ts";

const Cor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const PastaPedidaSchema = z
  .object({
    nome: z
      .string()
      .min(1)
      .max(64)
      .describe("Se já existe pasta com o nome, ela é editada; senão, criada."),
    novoNome: z.string().min(1).max(64).optional(),
    visivel: z
      .union([z.enum(["todos", "mestre"]), z.array(z.string()).max(32)])
      .optional()
      .describe(
        '"todos", "mestre" (padrão ao criar) ou a lista de jogadores (nomes) que veem a pasta.',
      ),
    apagar: z.boolean().optional().describe("Só pasta vazia."),
  })
  .strict();

const MoverSchema = z
  .object({
    ficha: z.string().optional(),
    nota: z.string().optional().describe("Título do handout."),
    para: z.string().describe("Nome da pasta de destino."),
  })
  .strict();

type PastaPedida = z.infer<typeof PastaPedidaSchema>;
type MoverPedido = z.infer<typeof MoverSchema>;

function visibilidadeDe(estado: Estado, v: NonNullable<PastaPedida["visivel"]>): Visibilidade {
  if (v === "todos") return { tipo: "todos" };
  if (v === "mestre") return { tipo: "mestre" };
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const ids = v.map((n) => {
    const alvo = normalizarBusca(n);
    const u = jogadores.find((x) => x.id === n || normalizarBusca(x.nome) === alvo);
    if (!u) {
      throw new ErroDoMcp(
        `Não achei o jogador "${n}". Jogadores da mesa: ${jogadores.map((x) => x.nome).join(", ") || "nenhum"}.`,
      );
    }
    return u.id;
  });
  return { tipo: "jogadores", ids };
}

async function pasta(p: PastaPedida, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  const existente = acharExato(estado.pastas, p.nome, (x) => x.nome);
  if (p.apagar) {
    if (!existente) throw new ErroDoMcp(`Não existe a pasta "${p.nome}".`);
    await passo(ctx, lote, "pasta.apagar", { id: existente.id });
    return `Apagou a pasta "${existente.nome}".`;
  }
  const visivel = p.visivel === undefined ? undefined : visibilidadeDe(estado, p.visivel);
  if (!existente) {
    const ordem = Math.min(estado.pastas.reduce((m, x) => Math.max(m, x.ordem), -1) + 1, 10_000);
    const nova: Pasta = {
      id: novoId("pasta"),
      nome: p.novoNome ?? p.nome,
      ordem,
      visivel: visivel ?? { tipo: "mestre" },
    };
    await passo(ctx, lote, "pasta.criar", { pasta: nova });
    return `Criou a pasta "${nova.nome}" (${nova.visivel.tipo === "mestre" ? "só o mestre vê" : nova.visivel.tipo === "todos" ? "todos veem" : "alguns jogadores veem"}).`;
  }
  const mud: Record<string, unknown> = {};
  if (p.novoNome !== undefined && p.novoNome !== existente.nome) mud.nome = p.novoNome;
  if (visivel !== undefined) mud.visivel = visivel;
  if (Object.keys(mud).length === 0) return `A pasta "${existente.nome}" não mudou.`;
  await passo(ctx, lote, "pasta.editar", { id: existente.id, ...mud });
  return `Editou a pasta "${existente.nome}" (${Object.keys(mud).join(", ")}).`;
}

async function mover(p: MoverPedido, ctx: Contexto, lote: Lote): Promise<string> {
  const estado = ctx.sala.estado();
  if ((p.ficha === undefined) === (p.nota === undefined)) {
    throw new ErroDoMcp("Diga `ficha` ou `nota` (um dos dois).");
  }
  const destino = achar(estado.pastas, p.para, {
    rotulo: "pasta",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  if (p.ficha !== undefined) {
    const f = achar(estado.personagens, p.ficha, {
      rotulo: "ficha",
      nomeDe: (x) => x.nome,
      idDe: (x) => x.id,
    });
    await passo(ctx, lote, "personagem.editar", { id: f.id, mudancas: { pastaId: destino.id } });
    return `Moveu a ficha "${f.nome}" para a pasta "${destino.nome}".`;
  }
  const h = achar(estado.handouts, p.nota as string, {
    rotulo: "nota",
    nomeDe: (x) => x.titulo,
    idDe: (x) => x.id,
  });
  await passo(ctx, lote, "handout.editar", { id: h.id, mudancas: { pastaId: destino.id } });
  return `Moveu a nota "${h.titulo}" para a pasta "${destino.nome}".`;
}

export const mesa = definir({
  nome: "mesa",
  descricao: [
    "Só do mestre. Configura a MESA toda.",
    "`configuracao`: maosPorPersonagem (1-6), penalidadeAoApagarS, alcanceInteracaoM (metros), tempoParaJogadores (exato, estagio, oculto), estagios {fraca, morrendo} (0 a 1). `iluminacao`: memoriaLigada, memoriaModo (inteligencia ou fixo), memoriaBaseM, memoriaPorModM, memoriaFixaM, tomDaMemoria (#rrggbb): a memória do mapa que os jogadores guardam do que já viram.",
    "`pastas`: cria, renomeia, muda quem vê ou apaga (só vazia) as pastas das fichas e notas; `mover` leva uma ficha ou nota para outra pasta.",
    '`relogio`: pausar, retomar (o tempo da sala, tochas e ciclos) ou zerar (o marco da pílula do topo). `compendio: "tirar"` tira o compêndio da mesa (para pôr um, use `arquivos`). `esquecerMemoria` fica em `mapa`; o som em `som`; o combate em `combate`.',
    'Exemplo: {"configuracao":{"maosPorPersonagem":2,"tempoParaJogadores":"estagio"},"iluminacao":{"memoriaLigada":true},"pastas":[{"nome":"Vilarejo","visivel":"todos"}],"relogio":"retomar"}',
  ].join(" "),
  entrada: z
    .object({
      configuracao: z
        .object({
          maosPorPersonagem: z.number().int().min(1).max(6).optional(),
          penalidadeAoApagarS: z.number().min(0).max(3600).optional(),
          alcanceInteracaoM: z.number().min(0).max(30).optional(),
          tempoParaJogadores: z.enum(TEMPOS_PARA_JOGADORES).optional(),
          estagios: z
            .object({
              fraca: z.number().min(0).max(1).optional(),
              morrendo: z.number().min(0).max(1).optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .optional(),
      iluminacao: z
        .object({
          memoriaLigada: z.boolean().optional(),
          memoriaModo: z.enum(["inteligencia", "fixo"]).optional(),
          memoriaBaseM: z.number().min(0).max(1000).optional(),
          memoriaPorModM: z.number().min(0).max(100).optional(),
          memoriaFixaM: z.number().min(0).max(1000).optional(),
          tomDaMemoria: Cor.optional(),
        })
        .strict()
        .optional(),
      pastas: z.array(PastaPedidaSchema).max(20).optional(),
      mover: z.array(MoverSchema).max(60).optional(),
      relogio: z.enum(["pausar", "retomar", "zerar"]).optional(),
      compendio: z.literal("tirar").optional(),
    })
    .strict(),
  visivel: (estado, eu) => pode(eu, "mesa.configurar", estado.permissoes),
  async executar(e, ctx) {
    const r = new Relatorio();
    const lote = ctx.novoLote("configurou a mesa");
    const tente = async (nome: string, fazer: () => Promise<string>) => {
      try {
        r.ok(await fazer());
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        r.falha(`${nome}: ${erro.message}`);
      }
    };
    if (e.configuracao && Object.keys(e.configuracao).length > 0) {
      await tente("configuração", async () => {
        await passo(ctx, lote, "config.mesa", { mudancas: e.configuracao });
        return `Configuração da mesa: ${Object.keys(e.configuracao ?? {}).join(", ")}.`;
      });
    }
    if (e.iluminacao && Object.keys(e.iluminacao).length > 0) {
      await tente("iluminação", async () => {
        await passo(ctx, lote, "config.iluminacao", { mudancas: e.iluminacao });
        return `Iluminação e memória do mapa: ${Object.keys(e.iluminacao ?? {}).join(", ")}.`;
      });
    }
    await cadaItem(
      e.pastas ?? [],
      (p) => `pasta "${p.nome}"`,
      (p) => pasta(p, ctx, lote),
      r,
    );
    await cadaItem(
      e.mover ?? [],
      (m) => `mover "${m.ficha ?? m.nota}"`,
      (m) => mover(m, ctx, lote),
      r,
    );
    if (e.relogio) {
      const tipo = { pausar: "mesa.pausar", retomar: "mesa.retomar", zerar: "mesa.zerarRelogio" }[
        e.relogio
      ];
      await tente("relógio", async () => {
        await passo(ctx, lote, tipo, {});
        return `Relógio: ${e.relogio === "zerar" ? "zerado" : e.relogio === "pausar" ? "mesa pausada" : "mesa correndo"}.`;
      });
    }
    if (e.compendio === "tirar") {
      await tente("compêndio", async () => {
        await passo(ctx, lote, "compendio.definir", { compendio: null });
        return "Tirou o compêndio da mesa.";
      });
    }
    return r.saida(
      "Nada a fazer: diga `configuracao`, `iluminacao`, `pastas`, `mover`, `relogio` ou `compendio`.",
    );
  },
});
