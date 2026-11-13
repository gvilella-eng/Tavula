import {
  type Estado,
  ehNpc,
  type Ficha,
  idDaPastaDoJogador,
  operacoesDeDiferenca,
  PASTA_NPCS_ID,
  PASTA_PERSONAGENS_ID,
  type Personagem,
  pode,
  podeEditarPersonagem,
  TETO_DE_CRIACAO_DO_JOGADOR,
  type Usuario,
} from "@tabletop/shared";
import { z } from "zod";
import { ErroDoMcp } from "../erros.ts";
import { FichaPartesSchema, montarFicha } from "../fichaPorPartes.ts";
import { linhaDaFicha } from "../formato.ts";
import { acharExato, novoId } from "../nomes.ts";
import type { Lote } from "../sala.ts";
import { type Contexto, cadaItem, definir, ehMestre, passo, Relatorio } from "./base.ts";

const CORES = ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d35400", "#16a085", "#7f8c8d"];

/** Uma cor estável a partir do nome (o token padrão da ficha). */
function corDoNome(nome: string): string {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return CORES[h % CORES.length] as string;
}

const PedidoDeFichaSchema = FichaPartesSchema.extend({
  nome: z
    .string()
    .min(1)
    .max(64)
    .describe("Nome da ficha. Se já existe uma com esse nome, ela é editada; senão, é criada."),
  novoNome: z.string().min(1).max(64).optional().describe("Só edição: renomeia."),
  tipo: z
    .enum(["personagem", "npc"])
    .optional()
    .describe("Só criação. Jogador: sempre personagem. Mestre: npc (padrão) ou personagem."),
  dono: z
    .array(z.string())
    .optional()
    .describe("Só mestre: nomes dos jogadores que editam este personagem."),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .describe("Cor do token, #rrggbb."),
  tamanhoToken: z.number().int().min(1).max(4).optional().describe("Quadrados do token (1 a 4)."),
  visaoNoEscuroM: z.number().min(0).max(1000).optional().describe("Visão no escuro, em metros."),
}).strict();
type PedidoDeFicha = z.infer<typeof PedidoDeFichaSchema>;

function partesDoPedido(p: PedidoDeFicha) {
  const {
    nome: _n,
    novoNome: _nn,
    tipo: _t,
    dono: _d,
    cor: _c,
    tamanhoToken: _tt,
    visaoNoEscuroM: _v,
    ...partes
  } = p;
  return partes;
}

function idsDosDonos(estado: Estado, nomes: readonly string[]): string[] {
  return nomes.map((n) => {
    const alvo = n.trim().toLowerCase();
    const u = estado.usuarios.find(
      (x) => x.papel === "jogador" && (x.nome.toLowerCase() === alvo || x.id === n),
    );
    if (!u) {
      const jogadores = estado.usuarios.filter((x) => x.papel === "jogador").map((x) => x.nome);
      throw new ErroDoMcp(
        `Não achei o jogador "${n}". Jogadores da mesa: ${jogadores.join(", ") || "nenhum"}.`,
      );
    }
    return u.id;
  });
}

function pastaPara(estado: Estado, id: string, rotulo: string): string {
  if (estado.pastas.some((p) => p.id === id)) return id;
  const alguma = estado.pastas.find((p) => p.visivel.tipo === "mestre") ?? estado.pastas[0];
  if (!alguma)
    throw new ErroDoMcp(`A mesa não tem a pasta de ${rotulo}. Crie uma pasta pela mesa.`);
  return alguma.id;
}

async function criar(
  p: PedidoDeFicha,
  ctx: Contexto,
  lote: Lote,
  estado: Estado,
  eu: Usuario,
): Promise<string> {
  const mestre = ehMestre(eu);
  if (!mestre) {
    if (p.tipo === "npc") throw new ErroDoMcp("Só o mestre cria NPCs.");
    if (p.dono !== undefined) throw new ErroDoMcp("Só o mestre escolhe quem edita a ficha.");
    if (!pode(eu, "personagem.criarProprio", estado.permissoes)) {
      throw new ErroDoMcp(
        'O mestre desligou "Criar fichas e notas próprias": peça a ele para ligar em Permissões.',
      );
    }
    const criadas = estado.personagens.filter((x) => x.criadoPor === eu.id).length;
    if (criadas >= TETO_DE_CRIACAO_DO_JOGADOR) {
      throw new ErroDoMcp(
        `Você já criou ${TETO_DE_CRIACAO_DO_JOGADOR} fichas (o teto): apague uma para criar outra.`,
      );
    }
  }
  const donos = p.dono ? idsDosDonos(estado, p.dono) : [];
  const npc = mestre ? (p.tipo ?? (donos.length > 0 ? "personagem" : "npc")) === "npc" : false;
  if (npc && donos.length > 0)
    throw new ErroDoMcp("NPC não tem dono: tire `dono` ou use tipo personagem.");
  const { ficha, avisos } = montarFicha(undefined, partesDoPedido(p), {
    npc,
    criando: true,
    compendio: ctx.compendio,
    modelos: estado.modelos,
  });
  const personagem: Personagem = {
    id: novoId("ficha"),
    // O jogador não vê as pastas do mestre: a sala põe a ficha na pasta própria dele, seja qual for o id mandado aqui.
    pastaId: !mestre
      ? idDaPastaDoJogador(eu.id)
      : npc
        ? pastaPara(estado, PASTA_NPCS_ID, "NPCs")
        : pastaPara(estado, PASTA_PERSONAGENS_ID, "personagens"),
    editores: mestre ? { tipo: "jogadores", ids: donos } : { tipo: "jogadores", ids: [eu.id] },
    nome: p.nome,
    tokenPadrao: { cor: p.cor ?? corDoNome(p.nome), tamanhoQuadrados: p.tamanhoToken ?? 1 },
    visao: { alcanceM: null, visaoNoEscuroM: p.visaoNoEscuroM ?? 0 },
    ficha,
  };
  await passo(ctx, lote, "personagem.criar", { personagem });
  const rascunho = mestre ? " (rascunho: o mestre revisa e publica)" : "";
  return `Criou "${p.nome}" (${npc ? "NPC" : "personagem"})${rascunho}: ${linhaDaFicha(ficha)}${avisos.map((a) => `\n  Aviso: ${a}`).join("")}`;
}

async function editar(
  existente: Personagem,
  p: PedidoDeFicha,
  ctx: Contexto,
  lote: Lote,
  estado: Estado,
  eu: Usuario,
): Promise<string> {
  if (!podeEditarPersonagem(existente, eu)) {
    throw new ErroDoMcp(`Você não edita a ficha "${existente.nome}": só o mestre e os donos dela.`);
  }
  if (p.tipo !== undefined) throw new ErroDoMcp("`tipo` só vale ao criar.");
  const mestre = ehMestre(eu);
  if (p.dono !== undefined && !mestre) throw new ErroDoMcp("Só o mestre muda quem edita a ficha.");
  const antes: Ficha | undefined = existente.ficha;
  if (!antes) {
    throw new ErroDoMcp(`A mesa não mostra a ficha de "${existente.nome}" para você.`);
  }
  const npc = antes.apresentacao === "npc" || ehNpc(existente);
  const { ficha, avisos } = montarFicha(antes, partesDoPedido(p), {
    npc,
    criando: false,
    compendio: ctx.compendio,
    modelos: estado.modelos,
  });
  const operacoes = operacoesDeDiferenca(antes, ficha);
  const feitos: string[] = [];
  if (operacoes.length > 0) {
    await passo(ctx, lote, "ficha.alterar", { personagemId: existente.id, operacoes });
    feitos.push("ficha");
  }
  const mudancas: Record<string, unknown> = {};
  if (p.novoNome !== undefined && p.novoNome !== existente.nome) mudancas.nome = p.novoNome;
  if (p.cor !== undefined && p.cor !== existente.tokenPadrao.cor) mudancas.cor = p.cor;
  if (p.tamanhoToken !== undefined && p.tamanhoToken !== existente.tokenPadrao.tamanhoQuadrados) {
    mudancas.tamanhoQuadrados = p.tamanhoToken;
  }
  if (p.visaoNoEscuroM !== undefined && p.visaoNoEscuroM !== existente.visao.visaoNoEscuroM) {
    mudancas.visaoNoEscuroM = p.visaoNoEscuroM;
  }
  if (p.dono !== undefined)
    mudancas.editores = { tipo: "jogadores", ids: idsDosDonos(estado, p.dono) };
  if (Object.keys(mudancas).length > 0) {
    await passo(ctx, lote, "personagem.editar", { id: existente.id, mudancas });
    feitos.push(Object.keys(mudancas).join(", "));
  }
  if (feitos.length === 0) return `"${existente.nome}" já estava assim: nada mudou.`;
  return `Editou "${p.novoNome ?? existente.nome}" (${feitos.join("; ")}): ${linhaDaFicha(ficha)}${avisos.map((a) => `\n  Aviso: ${a}`).join("")}`;
}

export const fichas = definir({
  nome: "fichas",
  descricao:
    'Cria e edita fichas em lote, por partes (atributos, classes e nível, perícias, ataques, magias, itens e equipamento, história...). A mesa calcula modificadores, proficiência, CA e PV como na ficha. Nomes do compêndio ("Bola de Fogo", "Espada Longa") vão em `compendio`. Se já existe ficha com o nome, edita; senão, cria. O jogador cria e edita as dele (teto de 20); o mestre cria NPCs (entram como rascunho) e edita qualquer ficha. Exemplo: {"fichas":[{"nome":"Brisa","raca":"Anã","classes":[{"classe":"Clérigo","nivel":3}],"atributos":{"for":10,"des":12,"con":14,"int":10,"sab":16,"car":12},"pericias":["Religião","Medicina"],"compendio":["Luz","Espada Longa"]}]}',
  entrada: z.object({ fichas: z.array(PedidoDeFichaSchema).min(1).max(30) }).strict(),
  visivel(estado, eu) {
    if (ehMestre(eu)) return true;
    return (
      pode(eu, "personagem.criarProprio", estado.permissoes) ||
      estado.personagens.some((p) => podeEditarPersonagem(p, eu))
    );
  },
  async executar(e, ctx) {
    const eu = ctx.sala.eu();
    const r = new Relatorio();
    const nomes = e.fichas.map((f) => f.nome);
    const lote = ctx.novoLote(
      `fichas: ${nomes.slice(0, 6).join(", ")}${nomes.length > 6 ? ` e mais ${nomes.length - 6}` : ""}`,
    );
    await cadaItem(
      e.fichas,
      (f) => `"${f.nome}"`,
      async (f) => {
        // O estado muda a cada item (a ficha criada antes aparece), então se lê de novo.
        const atual = ctx.sala.estado();
        const existente = acharExato(atual.personagens, f.nome, (x) => x.nome);
        return existente
          ? editar(existente, f, ctx, lote, atual, eu)
          : criar(f, ctx, lote, atual, eu);
      },
      r,
    );
    return r.saida();
  },
});
