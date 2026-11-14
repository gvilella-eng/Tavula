import { z } from "zod";
import {
  dadosPorNivelDoTexto,
  NIVEIS_DE_DESAFIO,
  porNivelAcimaDoTexto,
  RARIDADES_DE_ITEM_MAGICO,
  ROTULO_DO_NIVEL_DE_MAGIA,
  resumoDoItemMagico,
  xpDoND,
} from "../../index.ts";
import type { AchadoDoCompendio } from "../compendio.ts";
import { cortar } from "../formato.ts";
import { definir } from "./base.ts";

function linha(a: AchadoDoCompendio, detalhe: boolean): string {
  if (a.tipo === "magia") {
    const m = a.magia;
    const base = `magia: ${m.nome} — ${ROTULO_DO_NIVEL_DE_MAGIA(m.nivel)}, ${m.escola}; classes: ${m.classes.join(", ") || "—"}${m.concentracao ? "; concentração" : ""}${m.ritual ? "; ritual" : ""}`;
    if (!detalhe) return base;
    // N2: o que a ficha vai ler do texto: o que sobe por nível de espaço e os dados do truque pelo nível do personagem.
    const porNivel = porNivelAcimaDoTexto(m.emNiveisSuperiores);
    const dadosPorNivel =
      m.nivel === 0 ? dadosPorNivelDoTexto(`${m.descricao} ${m.emNiveisSuperiores ?? ""}`) : [];
    const sobe = [
      porNivel ? `por nível de espaço acima: +${porNivel}` : "",
      dadosPorNivel.length > 0
        ? `dados a mais por nível do personagem: ${dadosPorNivel.map((d) => `nível ${d.nivel} +${d.expressao}`).join(", ")}`
        : "",
      m.ritual ? "pode ser conjurada como ritual (sem espaço)" : "",
    ].filter(Boolean);
    return `${base}\n  ${m.tempo}; alcance ${m.alcance}; ${m.componentes}; ${m.duracao}${sobe.length > 0 ? `\n  ${sobe.join("; ")}` : ""}\n  ${cortar(m.descricao, 700)}`;
  }
  if (a.tipo === "arma") {
    const w = a.arma;
    const props = w.propriedades.length ? `; ${w.propriedades.join(", ")}` : "";
    return `arma: ${w.nome} — ${w.categoria}, ${w.distancia ? "à distância" : "corpo a corpo"}, ${w.dano} ${w.tipoDeDano}${props}${w.peso !== undefined ? `; ${w.peso} kg` : ""}${w.custo ? `; ${w.custo}` : ""}`;
  }
  if (a.tipo === "monstro") {
    const m = a.monstro;
    const base = `monstro: ${m.nome} — ${m.tamanho} ${m.tipo.toLowerCase()}, ND ${m.nd} (${m.xp ?? xpDoND(m.nd) ?? "?"} XP); CA ${m.ca.valor}, PV ${m.pv.media}`;
    if (!detalhe) return base;
    const nomes = (l: readonly { nome: string }[] | undefined) =>
      l && l.length > 0 ? l.map((x) => x.nome).join(", ") : "—";
    return `${base}\n  ${m.deslocamento ?? ""}; FOR ${m.atributos.for} DES ${m.atributos.des} CON ${m.atributos.con} INT ${m.atributos.int} SAB ${m.atributos.sab} CAR ${m.atributos.car}\n  traços: ${nomes(m.tracos)}\n  ações: ${nomes(m.acoes)}${m.reacoes?.length ? `\n  reações: ${nomes(m.reacoes)}` : ""}${m.acoesLendarias?.length ? `\n  ações lendárias: ${nomes(m.acoesLendarias)}` : ""}`;
  }
  if (a.tipo === "itemMagico") {
    const i = a.itemMagico;
    const base = `item mágico: ${i.nome} — ${i.tipo}; ${resumoDoItemMagico(i)}${i.bonus ? `; +${i.bonus}` : ""}`;
    return detalhe ? `${base}\n  ${cortar(i.descricao, 700)}` : base;
  }
  const i = a.item;
  const descricao = detalhe && i.descricao ? `\n  ${cortar(i.descricao, 400)}` : "";
  return `item: ${i.nome}${i.peso !== undefined ? ` — ${i.peso} kg` : ""}${i.custo ? `; ${i.custo}` : ""}${descricao}`;
}

export const compendio = definir({
  nome: "compendio",
  descricao:
    'Procura magias, armas, itens, monstros e itens mágicos no compêndio local, com resposta curta. Magias: por nome, classe, nível ou escola. Monstros: por nome, tipo de criatura, tamanho e ND (exato em `nd` ou faixa em `ndMin`/`ndMax`, com as frações "1/8", "1/4", "1/2"). Itens mágicos: por nome, tipo e raridade. Para pôr algo numa ficha, escreva o nome em `fichas.compendio`; para criar NPCs de um monstro, use `fichas.monstro`. Exemplos: {"tipo":"magia","classe":"Clérigo","nivel":1}, {"tipo":"monstro","busca":"goblin","ndMax":"1"}.',
  entrada: z
    .object({
      busca: z.string().optional().describe("Parte do nome."),
      tipo: z.enum(["magia", "arma", "item", "monstro", "itemMagico", "todos"]).optional(),
      nivel: z.number().int().min(0).max(9).optional().describe("Só magias. 0 = truque."),
      escola: z.string().optional().describe("Só magias. Ex.: Evocação."),
      classe: z.string().optional().describe("Só magias. Ex.: Mago."),
      nd: z
        .enum(NIVEIS_DE_DESAFIO as [string, ...string[]])
        .optional()
        .describe('Só monstros. ND exato: "0", "1/8", "1/4", "1/2", "1" a "30".'),
      ndMin: z
        .enum(NIVEIS_DE_DESAFIO as [string, ...string[]])
        .optional()
        .describe("Só monstros. ND mínimo."),
      ndMax: z
        .enum(NIVEIS_DE_DESAFIO as [string, ...string[]])
        .optional()
        .describe("Só monstros. ND máximo."),
      tamanho: z.string().optional().describe("Só monstros. Ex.: Grande."),
      tipoDeCriatura: z
        .string()
        .optional()
        .describe("Só monstros. Ex.: Fera, Morto-vivo, Humanoide."),
      raridade: z
        .enum(RARIDADES_DE_ITEM_MAGICO)
        .optional()
        .describe("Só itens mágicos. Ex.: raro, muito raro."),
      tipoDeItem: z.string().optional().describe("Só itens mágicos. Ex.: anel, poção, arma."),
      limite: z.number().int().min(1).max(30).optional().describe("Padrão 10."),
      detalhe: z.boolean().optional().describe("Inclui a descrição (use com poucos resultados)."),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    const achados = ctx.compendio.buscar(e);
    const limite = e.limite ?? 10;
    if (achados.length === 0) {
      return `Nada encontrado no compêndio (${ctx.compendio.origem}). Tente menos filtros ou outra grafia.`;
    }
    const mostrados = achados.slice(0, limite);
    const cab = `${achados.length} resultado(s)${achados.length > limite ? `, mostrando ${limite}` : ""}:`;
    return [cab, ...mostrados.map((a) => linha(a, e.detalhe === true))].join("\n");
  },
});
