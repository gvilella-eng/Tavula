import {
  automacoesDe,
  type Estado,
  idDaPastaDoJogador,
  listarRascunhos,
  pode,
  podeEditarPersonagem,
  TETO_DE_CRIACAO_DO_JOGADOR,
  type Usuario,
} from "@tabletop/shared";
import { z } from "zod";
import { emCelulas, textoDaVisibilidade } from "../formato.ts";
import { definir, ehMestre, listar } from "./base.ts";

const MAX = 40;

function nomeDoUsuario(estado: Estado, id: string): string {
  return estado.usuarios.find((u) => u.id === id)?.nome ?? id;
}

/** Quantas fichas e handouts o jogador já criou (para o teto de 20). */
export function criadosPor(estado: Estado, eu: Usuario): { fichas: number; handouts: number } {
  return {
    fichas: estado.personagens.filter((p) => p.criadoPor === eu.id).length,
    handouts: estado.handouts.filter((h) => h.criadoPor === eu.id).length,
  };
}

export const panorama = definir({
  nome: "panorama",
  descricao:
    "Mostra o que existe na mesa e que VOCÊ vê: cenas, fichas, handouts, modelos de objeto e, para o mestre, automações e rascunhos, com contagens e nomes. Comece por aqui. Sem entrada. Para o detalhe de uma coisa, use `ler`.",
  entrada: z.object({}).strict(),
  visivel: () => true,
  async executar(_entrada, ctx) {
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();
    const mestre = ehMestre(eu);
    const linhas: string[] = [];
    const cenaAtiva = estado.cenas.find((c) => c.id === estado.cenaAtivaId);
    linhas.push(
      `Você é ${eu.nome} (${mestre ? "mestre" : "jogador"}). Cena do grupo: ${cenaAtiva?.nome ?? "—"}.`,
    );

    // Cenas
    const cenas = estado.cenas.map((c) => {
      const t = emCelulas(c);
      const dela = {
        tokens: estado.tokens.filter((x) => x.cenaId === c.id).length,
        paredes: estado.paredes.filter((x) => x.cenaId === c.id).length,
        zonas: (estado.zonas ?? []).filter((x) => x.cenaId === c.id).length,
      };
      const marcas = [
        c.id === estado.cenaAtivaId ? "ativa" : "",
        c.rascunho ? "rascunho" : "",
        c.cartao ? "cartão" : "",
      ].filter(Boolean);
      const conteudo = mestre
        ? `: ${t.largura}x${t.altura} células, ${dela.tokens} tokens, ${dela.paredes} paredes${dela.zonas ? `, ${dela.zonas} zonas` : ""}`
        : "";
      return `"${c.nome}"${marcas.length ? ` [${marcas.join(", ")}]` : ""}${conteudo}`;
    });
    linhas.push(`Cenas (${cenas.length}): ${listar(cenas, MAX)}`);

    // Fichas
    const fichas = estado.personagens.map((p) => {
      const npc = p.editores.tipo === "jogadores" && p.editores.ids.length === 0;
      const marcas = [
        npc ? "NPC" : "",
        !mestre && podeEditarPersonagem(p, eu) ? "você edita" : "",
        p.rascunho ? "rascunho" : "",
        p.ficha ? "" : "ficha oculta",
      ].filter(Boolean);
      return `"${p.nome}"${marcas.length ? ` [${marcas.join(", ")}]` : ""}`;
    });
    linhas.push(`Fichas (${fichas.length}): ${listar(fichas, MAX)}`);

    // Handouts
    const handouts = estado.handouts.map((h) => {
      const quem = textoDaVisibilidade(h.visivel, (id) => nomeDoUsuario(estado, id));
      return `"${h.titulo}" (vê: ${quem}${h.rascunho ? ", rascunho" : ""})`;
    });
    linhas.push(`Handouts (${handouts.length}): ${listar(handouts, MAX)}`);

    // Modelos de objeto
    linhas.push(
      `Modelos de objeto (${estado.modelos.length}): ${listar(
        estado.modelos.map((m) => `"${m.nome}"`),
        MAX,
      )}`,
    );

    if (mestre) {
      const a = automacoesDe(estado);
      linhas.push(
        `Automações: ${a.ciclos.length} ciclos (${listar(
          a.ciclos.map((c) => `"${c.nome}"`),
          10,
        )}), ${a.reacoes.length} reações, ${(estado.zonas ?? []).length} zonas, ${a.botoes.length} botões.`,
      );
      const rascunhos = listarRascunhos(estado);
      linhas.push(
        rascunhos.length === 0
          ? "Rascunhos do Claude: nenhum."
          : `Rascunhos do Claude: ${rascunhos.length} (ferramenta \`rascunhos\` para publicar ou descartar).`,
      );
      const pessoas = estado.usuarios.filter((u) => u.papel === "jogador").map((u) => u.nome);
      linhas.push(`Jogadores: ${listar(pessoas)}.`);
    } else {
      const { fichas: f, handouts: h } = criadosPor(estado, eu);
      const pode_ = pode(eu, "personagem.criarProprio", estado.permissoes);
      linhas.push(
        pode_
          ? `Criar fichas e notas próprias: sim (você criou ${f} de ${TETO_DE_CRIACAO_DO_JOGADOR} fichas e ${h} de ${TETO_DE_CRIACAO_DO_JOGADOR} handouts).`
          : "Criar fichas e notas próprias: não (o mestre desligou).",
      );
      const pasta = idDaPastaDoJogador(eu.id);
      if (estado.pastas.some((p) => p.id === pasta))
        linhas.push("Você tem uma pasta própria de fichas.");
    }

    const c = ctx.compendio.resumo();
    linhas.push(
      `Compêndio local (${ctx.compendio.origem}): ${c.magias} magias, ${c.armas} armas, ${c.itens} itens.`,
    );
    return linhas.join("\n");
  },
});
