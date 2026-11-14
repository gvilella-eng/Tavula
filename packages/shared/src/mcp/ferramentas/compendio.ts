import { z } from "zod";
import {
  dadosPorNivelDoTexto,
  porNivelAcimaDoTexto,
  ROTULO_DO_NIVEL_DE_MAGIA,
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
  const i = a.item;
  const descricao = detalhe && i.descricao ? `\n  ${cortar(i.descricao, 400)}` : "";
  return `item: ${i.nome}${i.peso !== undefined ? ` — ${i.peso} kg` : ""}${i.custo ? `; ${i.custo}` : ""}${descricao}`;
}

export const compendio = definir({
  nome: "compendio",
  descricao:
    'Procura magias, armas e itens no compêndio local por nome, classe, nível ou escola, com resposta curta. Para pôr algo numa ficha, escreva o nome em `fichas.compendio`. Exemplo: {"tipo":"magia","classe":"Clérigo","nivel":1}.',
  entrada: z
    .object({
      busca: z.string().optional().describe("Parte do nome."),
      tipo: z.enum(["magia", "arma", "item", "todos"]).optional(),
      nivel: z.number().int().min(0).max(9).optional().describe("Só magias. 0 = truque."),
      escola: z.string().optional().describe("Só magias. Ex.: Evocação."),
      classe: z.string().optional().describe("Só magias. Ex.: Mago."),
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
