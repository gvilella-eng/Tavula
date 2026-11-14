import { z } from "zod";
import { LIMITES_DA_CARACTERISTICA_NO_CHAT, LIMITES_DO_CHAT, pode } from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { achar } from "../nomes.ts";
import { fichaPorNome } from "./achados.ts";
import { definir, passo, Relatorio } from "./base.ts";

export const chat = definir({
  nome: "chat",
  descricao: [
    'Fala no CHAT da mesa; a mensagem sai com a marca "pelo Claude" (como as rolagens). `narrar`: o texto (aceita `[[1d20+3]]` para rolar no meio). `como`: o nome de uma ficha para falar como ela (um NPC, por exemplo). `sussurrar`: o nome de um jogador: só ele e o mestre leem. `emote`: escreve em terceira pessoa (/em).',
    "`handout`: o título de uma nota, que abre na tela de quem a vê, agora (só o mestre). `caracteristica`: {ficha, nome, descricao, origem}: o cartão de uma característica. `magia`: {nome, ficha}: o cartão de uma magia do compêndio. `limpar`: apaga o HISTÓRICO do chat para todos (só o mestre; não volta).",
    "Mensagens, sussurros e rolagens não se desfazem (já foram lidos); o resto da mesa sim.",
    'Exemplos: {"narrar":"Um vento frio sobe do poço.","emote":true}; {"narrar":"Quem entra?","como":"Velho Barqueiro"}; {"sussurrar":"Ana","narrar":"Você ouve passos atrás da porta."}; {"handout":"A Eclusa"}.',
  ].join(" "),
  entrada: z
    .object({
      narrar: z.string().min(1).max(LIMITES_DO_CHAT.caracteres).optional(),
      como: z
        .string()
        .optional()
        .describe("Ficha que fala (o mestre: qualquer uma; o jogador: as dele)."),
      sussurrar: z.string().optional().describe("Nome do jogador que recebe o sussurro."),
      emote: z.boolean().optional(),
      handout: z.string().optional().describe("Título do handout a mostrar agora."),
      caracteristica: z
        .object({
          ficha: z.string(),
          nome: z.string().min(1).max(LIMITES_DA_CARACTERISTICA_NO_CHAT.nome),
          descricao: z.string().max(LIMITES_DA_CARACTERISTICA_NO_CHAT.descricao),
          origem: z.string().max(LIMITES_DA_CARACTERISTICA_NO_CHAT.origem).optional(),
        })
        .strict()
        .optional(),
      magia: z
        .object({ nome: z.string(), ficha: z.string().optional() })
        .strict()
        .optional()
        .describe("Uma magia do compêndio; `ficha` diz quem a conjura."),
      limpar: z.boolean().optional(),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();
    const lote = ctx.novoLote(
      e.narrar ? `chat: ${e.narrar.slice(0, 50)}` : e.handout ? `mostrou ${e.handout}` : "chat",
    );
    const r = new Relatorio();
    const tente = async (nome: string, fazer: () => Promise<string>) => {
      try {
        r.ok(await fazer());
      } catch (erro) {
        if (!(erro instanceof ErroDoMcp)) throw erro;
        r.falha(`${nome}: ${erro.message}`);
      }
    };
    if (e.narrar !== undefined) {
      await tente("mensagem", async () => {
        const como = e.como === undefined ? undefined : fichaPorNome(estado, e.como);
        let texto = e.narrar as string;
        let rotulo = "Disse no chat";
        if (e.sussurrar !== undefined) {
          const jogadores = estado.usuarios.filter((u) => u.id !== eu.id);
          const alvo = achar(jogadores, e.sussurrar, {
            rotulo: "pessoa",
            nomeDe: (u) => u.nome,
            idDe: (u) => u.id,
          });
          texto = `/w "${alvo.nome}" ${texto}`;
          rotulo = `Sussurrou para ${alvo.nome}`;
        } else if (e.emote) {
          texto = `/em ${texto}`;
          rotulo = "Escreveu em terceira pessoa";
        }
        await passo(ctx, lote, "chat.enviar", { texto, ...(como ? { como: como.id } : {}) });
        return `${rotulo}${como ? ` (como ${como.nome})` : ""}: "${(e.narrar as string).slice(0, 80)}".`;
      });
    } else if (e.sussurrar !== undefined || e.emote !== undefined || e.como !== undefined) {
      r.falha("`como`, `sussurrar` e `emote` só valem junto com `narrar`.");
    }
    if (e.handout !== undefined) {
      const titulo = e.handout;
      await tente("handout", async () => {
        const h = achar(estado.handouts, titulo, {
          rotulo: "nota",
          nomeDe: (x) => x.titulo,
          idDe: (x) => x.id,
        });
        await passo(ctx, lote, "handout.mostrar", { id: h.id });
        return `Mostrou o handout "${h.titulo}" na tela de quem o vê.`;
      });
    }
    if (e.caracteristica) {
      const c = e.caracteristica;
      await tente("característica", async () => {
        const f = fichaPorNome(estado, c.ficha);
        await passo(ctx, lote, "chat.caracteristica", {
          como: f.id,
          caracteristica: {
            nome: c.nome,
            descricao: c.descricao,
            ...(c.origem ? { origem: c.origem } : {}),
          },
        });
        return `Mostrou o cartão "${c.nome}" (${f.nome}).`;
      });
    }
    if (e.magia) {
      const m = e.magia;
      await tente(`magia "${m.nome}"`, async () => {
        const entrada = ctx.compendio.achar(m.nome);
        if (entrada.tipo !== "magia") throw new ErroDoMcp(`"${m.nome}" não é uma magia.`);
        const como = m.ficha === undefined ? undefined : fichaPorNome(estado, m.ficha);
        await passo(ctx, lote, "chat.magia", {
          magia: entrada.magia,
          ...(como ? { como: como.id } : {}),
        });
        return `Mostrou o cartão da magia "${entrada.magia.nome}".`;
      });
    }
    if (e.limpar) {
      await tente("limpar o chat", async () => {
        if (!pode(eu, "mesa.configurar", estado.permissoes)) {
          throw new ErroDoMcp("Só o mestre limpa o histórico do chat.");
        }
        await passo(ctx, lote, "chat.limpar", {});
        return "Limpou o histórico do chat.";
      });
    }
    return r.saida(
      "Nada a fazer: diga `narrar`, `handout`, `caracteristica`, `magia` ou `limpar`.",
    );
  },
});
