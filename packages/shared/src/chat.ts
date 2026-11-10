import { z } from "zod";
import { HashSchema } from "./assets.ts";
import { MagiaDoCompendioSchema } from "./compendio.ts";
import { lerExpressao, RolagemSchema } from "./dados.ts";
import type { ConfigDaMesa, Usuario } from "./estado.ts";
import { ResultadoDeModeloSchema } from "./rolagens.ts";

// ---------------------------------------------------------------------------------------------
// Chat (Lote 8): a mensagem, quem pode vê-la e a leitura dos comandos (`/r`, `/gr`, `/w`, `/em`,
// `/?`, `[[...]]`). Puro: a sala monta a mensagem e rola os dados.
// ---------------------------------------------------------------------------------------------

export const LIMITES_DO_CHAT = {
  /** Caracteres de uma mensagem. */
  caracteres: 2000,
  /** Mensagens por segundo, por conexão (o resto é recusado com aviso). */
  porSegundo: 10,
  /** Quantas mensagens visíveis o snapshot traz. */
  noSnapshot: 200,
  /** Quantas vêm a cada "carregar anteriores". */
  porPagina: 100,
  /** Rolagens `[[...]]` numa mensagem só. */
  inline: 10,
} as const;

const Id = z.string().min(1).max(64);

/** `todos` ou só estes usuários (além do autor e do mestre, que sempre veem). */
export const VisibilidadeDaMensagemSchema = z.union([
  z.literal("todos"),
  z.object({ ids: z.array(Id).max(32) }),
]);
export type VisibilidadeDaMensagem = z.infer<typeof VisibilidadeDaMensagemSchema>;

/** Fala "como" um personagem: o nome e o retrato vêm junto, para quem não vê o personagem na ficha. */
export const ComoSchema = z.object({
  personagemId: Id,
  nome: z.string().min(1).max(64),
  retratoHash: HashSchema.optional(),
});
export type Como = z.infer<typeof ComoSchema>;

export const MensagemSchema = z.object({
  id: Id,
  /** O `seq` do evento que a criou: a ordem da conversa. */
  seq: z.number().int().positive(),
  /** O relógio da sala em ms (o jogador só o recebe no modo "exato"). */
  emSala: z.number().nonnegative().optional(),
  /** A hora real (ms desde 1970), só para mostrar HH:MM. */
  emReal: z.number().nonnegative(),
  autorId: Id,
  como: ComoSchema.optional(),
  tipo: z.enum(["texto", "rolagem", "modelo", "magia"]),
  texto: z.string().max(LIMITES_DO_CHAT.caracteres).optional(),
  /** `/em`: ação em terceira pessoa ("Brisa olha em volta"). */
  acao: z.boolean().optional(),
  /** O texto traz `[[...]]` e há uma rolagem para cada um, na ordem. */
  inline: z.boolean().optional(),
  rolagens: z.array(RolagemSchema).max(LIMITES_DO_CHAT.inline).optional(),
  modelo: ResultadoDeModeloSchema.optional(),
  /** Mensagem `magia` (Lote 14): a magia do compêndio, inteira, com os limites do formato. */
  magia: MagiaDoCompendioSchema.optional(),
  visivelPara: VisibilidadeDaMensagemSchema,
  /** Rolagem oculta (`/gr`): só o autor e o mestre. */
  oculta: z.boolean().optional(),
});
export type Mensagem = z.infer<typeof MensagemSchema>;

type Quem = Pick<Usuario, "id" | "papel">;

/** Quem vê: o mestre (tudo), o autor e quem a mensagem cita. Papel desconhecido: só `todos`. */
export function mensagemVisivelPara(m: Mensagem, usuario: Quem): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador") return m.visivelPara === "todos";
  if (m.autorId === usuario.id) return true;
  return m.visivelPara === "todos" || m.visivelPara.ids.includes(usuario.id);
}

/**
 * A mensagem como o usuário a recebe, ou `null` se ele não a vê. O jogador não recebe o relógio da
 * sala (`emSala`) fora do modo "exato" (a mesma regra do tempo das tochas).
 */
export function mensagemParaUsuario(
  m: Mensagem,
  usuario: Quem,
  config: Pick<ConfigDaMesa, "tempoParaJogadores">,
): Mensagem | null {
  if (!mensagemVisivelPara(m, usuario)) return null;
  if (usuario.papel === "mestre" || config.tempoParaJogadores === "exato") return m;
  const { emSala: _oculto, ...semRelogio } = m;
  return semRelogio;
}

/** As últimas `limite` mensagens que o usuário vê, em ordem de `seq` (a visão do snapshot). */
export function chatParaUsuario(
  chat: readonly Mensagem[],
  usuario: Quem,
  config: Pick<ConfigDaMesa, "tempoParaJogadores">,
  limite: number = LIMITES_DO_CHAT.noSnapshot,
): Mensagem[] {
  const vistas: Mensagem[] = [];
  for (const m of chat) {
    const v = mensagemParaUsuario(m, usuario, config);
    if (v) vistas.push(v);
  }
  return vistas.sort((a, b) => a.seq - b.seq).slice(-limite);
}

// ---------------------------------------------------------------------------------------------
// Limite de mensagens por segundo (por conexão)
// ---------------------------------------------------------------------------------------------

/**
 * Janela deslizante: aceita a mensagem se nos últimos `janelaMs` houve menos de `maximo`. Devolve o
 * histórico novo (a recusada não entra nele, senão quem insiste nunca voltaria).
 */
export function registrarMensagem(
  historico: readonly number[],
  agoraMs: number,
  maximo: number = LIMITES_DO_CHAT.porSegundo,
  janelaMs = 1000,
): { ok: boolean; historico: number[] } {
  const recentes = historico.filter((t) => agoraMs - t < janelaMs);
  if (recentes.length >= maximo) return { ok: false, historico: recentes };
  return { ok: true, historico: [...recentes, agoraMs] };
}

// ---------------------------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------------------------

/** A lista que o `/?` mostra (comando, o que faz). */
export const AJUDA_DO_CHAT: readonly (readonly [string, string])[] = [
  ["/r 1d20+5", "rola os dados (2d20kh1 é vantagem, 2d20kl1 é desvantagem)"],
  ["/gr 1d20", "rolagem oculta: só você e o mestre veem (o jogador precisa de permissão)"],
  ["/w Nome texto", "sussurra: só essa pessoa e o mestre veem"],
  ["/em texto", 'ação em terceira pessoa ("Brisa olha em volta")'],
  ["[[1d20+5]]", "no meio do texto, rola na hora"],
  ["/?", "mostra esta lista"],
];

export type ComandoDeChat =
  | { tipo: "texto"; texto: string; inline: string[] }
  | { tipo: "acao"; texto: string; inline: string[] }
  | { tipo: "rolar"; expressao: string; comentario: string; oculta: boolean }
  | { tipo: "sussurro"; destinatarioId: string; texto: string; inline: string[] }
  | { tipo: "ajuda" }
  | { tipo: "erro"; motivo: string };

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** As expressões dos `[[...]]` do texto, em ordem; `null` (com o motivo) se alguma não vale. */
function rolagensInline(
  texto: string,
): { ok: true; expressoes: string[] } | { ok: false; motivo: string } {
  const expressoes: string[] = [];
  for (const m of texto.matchAll(/\[\[(.*?)\]\]/g)) {
    const dentro = m[1] ?? "";
    const lida = lerExpressao(dentro);
    if (!lida.ok) return { ok: false, motivo: `[[${dentro}]]: ${lida.motivo}` };
    expressoes.push(dentro);
  }
  if (expressoes.length > LIMITES_DO_CHAT.inline) {
    return {
      ok: false,
      motivo: `No máximo ${LIMITES_DO_CHAT.inline} rolagens [[...]] por mensagem.`,
    };
  }
  return { ok: true, expressoes };
}

/** `/r` e `/gr`: a expressão é o maior começo válido; o que sobra vira comentário ("1d20+5 furtividade"). */
function lerRolagemComComentario(
  resto: string,
  oculta: boolean,
): Extract<ComandoDeChat, { tipo: "rolar" | "erro" }> {
  const texto = resto.trim();
  if (texto === "") {
    return { tipo: "erro", motivo: `Diga o que rolar: ${oculta ? "/gr" : "/r"} 1d20+5.` };
  }
  const palavras = texto.split(/\s+/);
  for (let n = palavras.length; n >= 1; n--) {
    const expressao = palavras.slice(0, n).join(" ");
    if (lerExpressao(expressao).ok) {
      return { tipo: "rolar", expressao, comentario: palavras.slice(n).join(" "), oculta };
    }
  }
  const erro = lerExpressao(texto);
  return { tipo: "erro", motivo: erro.ok ? "Expressão inválida." : erro.motivo };
}

/** O destinatário de um `/w`: nome entre aspas, o maior nome de usuário que abre o texto, ou um prefixo único. */
function acharDestinatario(
  resto: string,
  usuarios: readonly Pick<Usuario, "id" | "nome">[],
): { ok: true; id: string; texto: string } | { ok: false; motivo: string } {
  const r = resto.trim();
  if (r.startsWith('"')) {
    const fim = r.indexOf('"', 1);
    if (fim > 1) {
      const nome = normalizar(r.slice(1, fim).trim());
      const u = usuarios.find((x) => normalizar(x.nome) === nome || normalizar(x.id) === nome);
      if (u) return { ok: true, id: u.id, texto: r.slice(fim + 1).trim() };
      return { ok: false, motivo: `Não achei "${r.slice(1, fim)}" na mesa.` };
    }
  }
  const compridosPrimeiro = [...usuarios].sort((a, b) => b.nome.length - a.nome.length);
  for (const u of compridosPrimeiro) {
    for (const chave of [u.nome, u.id]) {
      const abre = normalizar(r.slice(0, chave.length)) === normalizar(chave);
      const proximo = r.charAt(chave.length);
      if (abre && (proximo === "" || /\s/.test(proximo))) {
        return { ok: true, id: u.id, texto: r.slice(chave.length).trim() };
      }
    }
  }
  const primeira = r.split(/\s+/)[0] ?? "";
  if (primeira === "") return { ok: false, motivo: "Diga para quem: /w Nome texto." };
  const prefixo = normalizar(primeira);
  const candidatos = usuarios.filter(
    (u) => normalizar(u.nome).startsWith(prefixo) || normalizar(u.id).startsWith(prefixo),
  );
  if (candidatos.length === 1 && candidatos[0]) {
    return { ok: true, id: candidatos[0].id, texto: r.slice(primeira.length).trim() };
  }
  if (candidatos.length > 1) {
    return {
      ok: false,
      motivo: `"${primeira}" serve para mais de uma pessoa: escreva o nome inteiro.`,
    };
  }
  return { ok: false, motivo: `Não achei "${primeira}" na mesa.` };
}

/**
 * Lê o que alguém digitou no chat: texto (com ou sem `[[rolagens]]`), `/r`, `/gr`, `/w`, `/em` e `/?`.
 * Não rola nada: a sala rola. `usuarios` é a lista da mesa (para achar o destinatário do `/w`).
 */
export function interpretarChat(
  bruto: string,
  usuarios: readonly Pick<Usuario, "id" | "nome">[],
): ComandoDeChat {
  const texto = bruto.trim();
  if (texto === "") return { tipo: "erro", motivo: "A mensagem está vazia." };
  if (texto.length > LIMITES_DO_CHAT.caracteres) {
    return {
      tipo: "erro",
      motivo: `A mensagem passa de ${LIMITES_DO_CHAT.caracteres} caracteres.`,
    };
  }

  const comTexto = <T extends "texto" | "acao">(tipo: T, conteudo: string): ComandoDeChat => {
    const inline = rolagensInline(conteudo);
    if (!inline.ok) return { tipo: "erro", motivo: inline.motivo };
    return { tipo, texto: conteudo, inline: inline.expressoes };
  };

  if (!texto.startsWith("/")) return comTexto("texto", texto);

  const corte = texto.search(/\s/);
  const comando = (corte === -1 ? texto : texto.slice(0, corte)).toLowerCase();
  const resto = corte === -1 ? "" : texto.slice(corte).trim();
  switch (comando) {
    case "/?":
    case "/ajuda":
    case "/help":
      return { tipo: "ajuda" };
    case "/r":
    case "/roll":
      return lerRolagemComComentario(resto, false);
    case "/gr":
      return lerRolagemComComentario(resto, true);
    case "/em":
    case "/me":
      return resto === ""
        ? { tipo: "erro", motivo: "Diga o que o personagem faz: /em olha em volta." }
        : comTexto("acao", resto);
    case "/w":
    case "/sussurro": {
      const d = acharDestinatario(resto, usuarios);
      if (!d.ok) return { tipo: "erro", motivo: d.motivo };
      if (d.texto === "") return { tipo: "erro", motivo: "Escreva a mensagem do sussurro." };
      const inline = rolagensInline(d.texto);
      if (!inline.ok) return { tipo: "erro", motivo: inline.motivo };
      return { tipo: "sussurro", destinatarioId: d.id, texto: d.texto, inline: inline.expressoes };
    }
    default:
      return { tipo: "erro", motivo: `Comando desconhecido: ${comando}. Use /? para ver a lista.` };
  }
}

/** Limite de caracteres do campo (o schema usa a mesma mensagem, em português). */
export const TEXTO_DO_CHAT_MAX = `A mensagem passa de ${LIMITES_DO_CHAT.caracteres} caracteres.`;
