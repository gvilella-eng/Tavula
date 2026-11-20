import { z } from "zod";
import {
  automacoesDe,
  type Estado,
  fichaVisivelPara,
  fraseDoFluxo,
  type Handout,
  nomesDaMesa,
  type Usuario,
} from "../../index.ts";
import { ErroDoMcp } from "../erros.ts";
import { cortar, emCelulas, num, resumoDaFicha, textoDaVisibilidade } from "../formato.ts";
import { achar } from "../nomes.ts";
import { definir, ehMestre } from "./base.ts";
import { paraCelulas } from "./cenasUtil.ts";

const LIMITE_DE_LINHAS = 60;

function recortar<T>(itens: readonly T[], f: (i: T) => string, vazio = "nenhum"): string {
  if (itens.length === 0) return vazio;
  const linhas = itens.slice(0, LIMITE_DE_LINHAS).map((i) => `  ${f(i)}`);
  if (itens.length > LIMITE_DE_LINHAS) {
    linhas.push(`  … (mostrando ${LIMITE_DE_LINHAS} de ${itens.length})`);
  }
  return `\n${linhas.join("\n")}`;
}

function nomeDoUsuario(estado: Estado, id: string): string {
  return estado.usuarios.find((u) => u.id === id)?.nome ?? id;
}

function fichaDe(estado: Estado, eu: Usuario, nome: string, completo: boolean): string {
  const p = achar(estado.personagens, nome, {
    rotulo: "ficha",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  const npc = p.editores.tipo === "jogadores" && p.editores.ids.length === 0;
  const pasta = estado.pastas.find((x) => x.id === p.pastaId)?.nome ?? "?";
  const editores =
    p.editores.tipo === "todos"
      ? "todos os jogadores"
      : p.editores.ids.length === 0
        ? "só o mestre"
        : p.editores.ids.map((id) => nomeDoUsuario(estado, id)).join(", ");
  const cabecalho = `Ficha "${p.nome}" (${npc ? "NPC" : "personagem"}, pasta ${pasta}; edita: ${editores}${p.rascunho ? "; RASCUNHO" : ""}; id ${p.id})`;
  if (!p.ficha || !fichaVisivelPara(p, eu, estado.permissoes)) {
    return `${cabecalho}\nVocê só vê o nome e o token desta ficha (o mestre não liberou ver a ficha dos outros).`;
  }
  const linhas = [cabecalho, ...resumoDaFicha(p.ficha)];
  if (completo) linhas.push("", "Ficha completa (JSON):", JSON.stringify(p.ficha));
  else linhas.push("(Para o JSON inteiro, peça `completo: true`.)");
  return linhas.join("\n");
}

function handoutDe(estado: Estado, nome: string, completo: boolean): string {
  const h: Handout = achar(estado.handouts, nome, {
    rotulo: "nota",
    nomeDe: (x) => x.titulo,
    idDe: (x) => x.id,
  });
  const quem = textoDaVisibilidade(h.visivel, (id) => nomeDoUsuario(estado, id));
  const pasta = estado.pastas.find((x) => x.id === h.pastaId)?.nome ?? "?";
  return [
    `Handout "${h.titulo}" (pasta ${pasta}; vê: ${quem}; fonte ${h.fonte}${h.rascunho ? "; RASCUNHO" : ""}; id ${h.id})`,
    completo ? h.texto : cortar(h.texto, 600),
    ...(!completo && h.texto.length > 600
      ? [`(${h.texto.length} caracteres; \`completo: true\` mostra tudo.)`]
      : []),
  ].join("\n");
}

function cenaDe(estado: Estado, nome: string): string {
  const cena = achar(estado.cenas, nome, {
    rotulo: "cena",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  const q = cena.grid.quadradoM;
  const t = emCelulas(cena);
  const c = (p: { x: number; y: number }) => {
    const [x, y] = paraCelulas(p, q);
    return `(${num(x)}, ${num(y)})`;
  };
  const linhas: string[] = [
    `Cena "${cena.nome}" (id ${cena.id}${cena.rascunho ? "; RASCUNHO" : ""}${cena.id === estado.cenaAtivaId ? "; é a do grupo" : ""})`,
    `Tamanho: ${t.largura} x ${t.altura} células (${num(cena.larguraM)} x ${num(cena.alturaM)} m); cada célula tem ${num(q)} m; grid ${cena.grid.visivel ? "visível" : "escondido"}${cena.mapa ? "; tem imagem de mapa" : ""}.`,
    `Chegada do grupo: ${cena.chegada ? c(cena.chegada) : "o centro"}. Cartão: ${cena.cartao ? "sim" : "não"}. Iluminação dinâmica: ${cena.iluminacaoDinamica === false ? "desligada" : "ligada"}; luz ambiente ${cena.luzAmbiente ?? 1}. Jogadores veem as paredes: ${cena.mostrarParedesAosJogadores ? "sim" : "não"}.`,
    "Coordenadas em células, a partir do canto de cima à esquerda (0, 0); meias células valem (1,5).",
  ];
  const paredes = estado.paredes.filter((p) => p.cenaId === cena.id);
  linhas.push(
    `Paredes (${paredes.length}):${recortar(paredes, (p) => `${p.id}: ${c(p.a)} -> ${c(p.b)} ${p.tipo}${p.estado ? ` ${p.estado}` : ""}${p.meio ? ` (arco por ${c(p.meio)})` : ""}`)}`,
  );
  const tokens = estado.tokens.filter((t2) => t2.cenaId === cena.id);
  linhas.push(
    `Tokens (${tokens.length}):${recortar(tokens, (t2) => `"${t2.nome}" ${c(t2)}${t2.oculto ? " oculto" : ""}${t2.camada !== "tokens" ? ` camada ${t2.camada}` : ""}${t2.personagemId ? ` (ficha ${estado.personagens.find((p) => p.id === t2.personagemId)?.nome ?? t2.personagemId})` : ""}${t2.rascunho ? " RASCUNHO" : ""}`)}`,
  );
  const pontos = estado.pontos.filter((p) => p.cenaId === cena.id);
  if (pontos.length > 0) {
    linhas.push(
      `Pontos (${pontos.length}):${recortar(pontos, (p) => `"${p.nome}" ${c(p)} ${p.tipo}`)}`,
    );
  }
  const luzes = estado.luzes.filter((l) => l.cenaId === cena.id);
  if (luzes.length > 0) {
    linhas.push(
      `Luzes fixas (${luzes.length}):${recortar(luzes, (l) => `"${l.nome}" raio ${num(l.luz.claraM)}+${num(l.luz.penumbraM)} m ${l.estado}`)}`,
    );
  }
  const zonas = (estado.zonas ?? []).filter((z2) => z2.cenaId === cena.id);
  if (zonas.length > 0) {
    linhas.push(
      `Zonas (${zonas.length}):${recortar(zonas, (z2) => `"${z2.nome}" ${z2.ativa ? "ativa" : "desligada"} [${z2.pontos.map(c).join(" ")}] efeitos ${JSON.stringify(z2.efeitos)}`)}`,
    );
  }
  return linhas.join("\n");
}

function modeloDe(estado: Estado, nome: string): string {
  const m = achar(estado.modelos, nome, {
    rotulo: "modelo de objeto",
    nomeDe: (x) => x.nome,
    idDe: (x) => x.id,
  });
  return `Modelo "${m.nome}" (id ${m.id}${m.rascunho ? "; RASCUNHO" : ""}): luz plena ${num(m.luz.claraM)} m + penumbra ${num(m.luz.penumbraM)} m, cor ${m.luz.cor}, ${m.luz.tremula ? "tremula" : "firme"}; duração ${m.duracaoS === null ? "infinita" : `${num(m.duracaoS / 60)} min`}; ${m.ocupaMao ? "ocupa uma mão" : "não ocupa mão"}; tags: ${m.tags.join(", ") || "nenhuma"}.`;
}

function automacaoDe(estado: Estado, nome: string): string {
  const a = automacoesDe(estado);
  const cenaNome = (id: string) => estado.cenas.find((c) => c.id === id)?.nome ?? id;
  const alvo = nome.trim().toLowerCase();
  const fluxo = a.fluxos.find((f) => f.nome.toLowerCase() === alvo || f.id === nome);
  if (fluxo) {
    const frase = fraseDoFluxo(fluxo, nomesDaMesa(estado));
    return `Automação "${fluxo.nome}" (id ${fluxo.id}${fluxo.rascunho ? "; RASCUNHO" : ""}; ${fluxo.ligado ? "ligada" : "desligada"}): ${frase} Liberada aos jogadores: ${fluxo.liberadoParaJogadores ? "sim" : "não"}. Para o JSON dos blocos, use a ferramenta \`automacoes\` (explicar).`;
  }
  const zona = (estado.zonas ?? []).find((z2) => z2.nome.toLowerCase() === alvo || z2.id === nome);
  if (zona) {
    return `Zona "${zona.nome}" (id ${zona.id}${zona.rascunho ? "; RASCUNHO" : ""}) na cena "${cenaNome(zona.cenaId)}": ${zona.ativa ? "ativa" : "desligada"}; efeitos ${JSON.stringify(zona.efeitos)}; ${zona.pontos.length} pontos.`;
  }
  const nomes = [...a.fluxos.map((f) => f.nome), ...(estado.zonas ?? []).map((z2) => z2.nome)];
  throw new ErroDoMcp(
    `Não achei a automação "${nome}". Existem: ${nomes.slice(0, 15).join(", ") || "nenhuma"}.`,
  );
}

export const ler = definir({
  nome: "ler",
  descricao:
    'Mostra o detalhe de uma coisa pelo NOME: uma ficha, um handout, uma cena, um modelo de objeto ou (mestre) uma automação. Resumo por padrão; `completo: true` traz o texto ou o JSON inteiro. Exemplo: {"tipo":"ficha","nome":"Brisa"}.',
  entrada: z
    .object({
      tipo: z.enum(["ficha", "handout", "cena", "modelo", "automacao"]),
      nome: z.string().min(1).describe("O nome (ou o id) do que quer ler."),
      completo: z.boolean().optional(),
    })
    .strict(),
  visivel: () => true,
  async executar(e, ctx) {
    const estado = ctx.sala.estado();
    const eu = ctx.sala.eu();
    const completo = e.completo === true;
    switch (e.tipo) {
      case "ficha":
        return fichaDe(estado, eu, e.nome, completo);
      case "handout":
        return handoutDe(estado, e.nome, completo);
      case "cena":
        return cenaDe(estado, e.nome);
      case "modelo":
        return modeloDe(estado, e.nome);
      case "automacao":
        if (!ehMestre(eu)) throw new ErroDoMcp("Só o mestre vê as automações.");
        return automacaoDe(estado, e.nome);
    }
  },
});
