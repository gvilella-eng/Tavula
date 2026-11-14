import { z } from "zod";
import {
  bonusDeAcerto,
  cdDaRolagem,
  expressaoDeDano,
  type Mensagem,
  margemDeCritico,
  normalizarBusca,
  podeEditarPersonagem,
  tipoDeDano,
  VANTAGENS,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { lerAtributo, lerPericia } from "../fichaPorPartes.ts";
import { bonusDoTeste, textoDaRolagem } from "../formato.ts";
import { achar } from "../nomes.ts";
import { definir, passo } from "./base.ts";

const TesteSchema = z
  .object({
    ficha: z.string().describe("Nome da ficha que rola (a sua, ou qualquer uma se for o mestre)."),
    pericia: z.string().optional().describe('Ex.: "Percepção".'),
    atributo: z.string().optional().describe('Teste de atributo. Ex.: "for".'),
    salvaguarda: z.string().optional().describe('Ex.: "sab".'),
    iniciativa: z.boolean().optional(),
    cd: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Com CD, a mesa diz sucesso ou falha."),
    vantagem: z.enum(VANTAGENS).optional(),
  })
  .strict();

const AtaqueSchema = z
  .object({
    ficha: z.string(),
    nome: z.string().describe("O nome do ataque na ficha."),
    vantagem: z.enum(VANTAGENS).optional(),
  })
  .strict();

function mensagemDoEvento(evento: unknown): Mensagem | null {
  const e = evento as { tipo?: string; dados?: { mensagem?: Mensagem } } | undefined;
  return e?.tipo === "chat.mensagem" ? (e.dados?.mensagem ?? null) : null;
}

export const rolar = definir({
  nome: "rolar",
  descricao:
    'Rola dados NA MESA: a sala rola e o chat marca "pelo Claude". Três jeitos: `expressao` ("4d6kh3", "1d20+5"; `vezes` repete, ótimo para os 6 atributos), `teste` (perícia, atributo, salvaguarda ou iniciativa de uma ficha) ou `ataque` (um ataque da ficha). Exemplo: {"expressao":"4d6kh3","vezes":6}.',
  entrada: z
    .object({
      expressao: z.string().min(1).max(100).optional(),
      vezes: z.number().int().min(1).max(12).optional().describe("Só com `expressao`. Padrão 1."),
      teste: TesteSchema.optional(),
      ataque: AtaqueSchema.optional(),
      oculta: z
        .boolean()
        .optional()
        .describe("Rolagem oculta (só o mestre vê; jogador precisa da permissão)."),
      como: z.string().optional().describe("Só com `expressao`: fala como esta ficha."),
    })
    .strict()
    .refine((e) => [e.expressao, e.teste, e.ataque].filter((x) => x !== undefined).length === 1, {
      message: "Diga só um: `expressao`, `teste` ou `ataque`.",
    }),
  visivel: () => true,
  async executar(e, ctx) {
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();
    const lote = ctx.novoLote("rolou dados");
    const fichaDe = (nome: string) => {
      const p = achar(estado.personagens, nome, {
        rotulo: "ficha",
        nomeDe: (x) => x.nome,
        idDe: (x) => x.id,
      });
      if (!podeEditarPersonagem(p, eu)) {
        throw new ErroDoMcp(`Você não rola pela ficha "${p.nome}": só o mestre e os donos dela.`);
      }
      if (!p.ficha) throw new ErroDoMcp(`A mesa não mostra a ficha de "${p.nome}" para você.`);
      return { p, ficha: p.ficha };
    };
    const saidas: string[] = [];

    if (e.expressao !== undefined) {
      const como = e.como === undefined ? undefined : fichaDe(e.como).p.id;
      for (let i = 0; i < (e.vezes ?? 1); i++) {
        const r = await passo(ctx, lote, "dado.rolar", {
          expressao: e.expressao,
          ...(e.oculta ? { oculta: true } : {}),
          ...(como ? { como } : {}),
        });
        const m = mensagemDoEvento(r.evento);
        saidas.push(m ? textoDaRolagem(m) : `${e.expressao}: a mesa não devolveu o resultado.`);
      }
      return saidas.join("\n");
    }

    if (e.teste) {
      const t = e.teste;
      const { p, ficha } = fichaDe(t.ficha);
      const escolhidos = [
        t.pericia,
        t.atributo,
        t.salvaguarda,
        t.iniciativa ? "i" : undefined,
      ].filter((x) => x !== undefined);
      if (escolhidos.length !== 1) {
        throw new ErroDoMcp(
          "No teste, diga só um: `pericia`, `atributo`, `salvaguarda` ou `iniciativa`.",
        );
      }
      const alvo = t.pericia
        ? bonusDoTeste(ficha, "pericia", lerPericia(t.pericia))
        : t.atributo
          ? bonusDoTeste(ficha, "atributo", lerAtributo(t.atributo))
          : t.salvaguarda
            ? bonusDoTeste(ficha, "salvaguarda", lerAtributo(t.salvaguarda))
            : bonusDoTeste(ficha, "iniciativa", "");
      if (!alvo) throw new ErroDoMcp("Não consegui montar esse teste.");
      const r = await passo(ctx, lote, "chat.modelo", {
        modelo: "teste",
        nome: `${alvo.nome} (${p.nome})`,
        bonus: alvo.bonus,
        ...(t.cd !== undefined ? { cd: t.cd } : {}),
        ...(t.vantagem ? { vantagem: t.vantagem } : {}),
        ...(e.oculta ? { oculta: true } : {}),
        como: p.id,
      });
      const m = mensagemDoEvento(r.evento);
      return m ? textoDaRolagem(m) : "A mesa não devolveu o resultado.";
    }

    const a = e.ataque as z.infer<typeof AtaqueSchema>;
    const { p, ficha } = fichaDe(a.ficha);
    const alvo = normalizarBusca(a.nome);
    const lista = [...(ficha.ataques ?? []), ...(ficha.magias ?? [])];
    const ataque = lista.find((x) => normalizarBusca(x.nome) === alvo);
    if (!ataque) {
      throw new ErroDoMcp(
        `A ficha "${p.nome}" não tem o ataque "${a.nome}". Tem: ${lista.map((x) => x.nome).join(", ") || "nenhum"}.`,
      );
    }
    const bonus = bonusDeAcerto(ficha, ataque);
    const dano = expressaoDeDano(ficha, ataque);
    if (bonus === undefined) {
      if (!dano) throw new ErroDoMcp(`O ataque "${a.nome}" não tem acerto nem dano para rolar.`);
      const r = await passo(ctx, lote, "dado.rolar", {
        expressao: dano,
        ...(e.oculta ? { oculta: true } : {}),
        como: p.id,
      });
      const m = mensagemDoEvento(r.evento);
      return m ? `${a.nome} (dano): ${textoDaRolagem(m)}` : "A mesa não devolveu o resultado.";
    }
    const cd = cdDaRolagem(ficha, ataque);
    const r = await passo(ctx, lote, "chat.modelo", {
      modelo: "ataque",
      nome: `${ataque.nome} (${p.nome})`,
      bonus,
      dano: dano ?? "0",
      ...(tipoDeDano(ataque) ? { danoTipo: tipoDeDano(ataque) } : {}),
      margemCritico: margemDeCritico(ataque),
      ...(ataque.danoCritico ? { danoCritico: ataque.danoCritico } : {}),
      ...(a.vantagem ? { vantagem: a.vantagem } : {}),
      ...(e.oculta ? { oculta: true } : {}),
      como: p.id,
    });
    const m = mensagemDoEvento(r.evento);
    return `${m ? textoDaRolagem(m) : "A mesa não devolveu o resultado."}${cd !== undefined ? ` (CD ${cd})` : ""}`;
  },
});
