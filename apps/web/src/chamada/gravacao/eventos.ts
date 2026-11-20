import {
  type Estado,
  type EventoGravado,
  type EventoSala,
  ehNpc,
  type Mensagem,
  type Personagem,
  quemFala,
  type Usuario,
} from "@tabletop/shared";

// CH3: o que a mesa registra enquanto a gravação está ligada (chat, rolagens, troca de cena, início e fim de combate), em
// linhas do `eventos.jsonl`, e os nomes (`nomes.txt`) que ajudam o whisper a acertar os nomes da campanha.

const LIMITE_DO_TEXTO = 400;

const corta = (s: string): string =>
  s.length > LIMITE_DO_TEXTO ? `${s.slice(0, LIMITE_DO_TEXTO - 1)}…` : s;

function nomeDoAutor(m: Mensagem, usuarios: readonly Usuario[]): string {
  if (m.autorId === "sistema") return "A mesa";
  return usuarios.find((u) => u.id === m.autorId)?.nome ?? "Alguém";
}

/** O texto de uma rolagem do chat no formato do pedido: "Thorin, Percepção: 17". */
function textoDaRolagem(m: Mensagem, autor: string): string {
  const quem = m.como?.nome ?? autor;
  const oculta = m.oculta ? " (oculta)" : "";
  const r = m.modelo;
  if (r?.modelo === "teste") {
    const cd = r.cd !== undefined ? ` (CD ${r.cd}: ${r.sucesso ? "passou" : "falhou"})` : "";
    return `${quem}, ${r.nome}: ${r.rolagem.total}${cd}${oculta}`;
  }
  if (r?.modelo === "ataque") {
    const crit = r.critico ? " crítico" : r.falhaCritica ? " falha crítica" : "";
    return `${quem}, ${r.nome}: acerto ${r.acerto.total}${crit}, dano ${r.dano.total}${oculta}`;
  }
  if (r?.modelo === "vida") return `${quem}, ${r.nome}: curou ${r.curou}${oculta}`;
  const primeira = m.rolagens?.[0];
  if (primeira) return `${quem}, ${primeira.expressao}: ${primeira.total}${oculta}`;
  return `${quem}${oculta}`;
}

/** O que uma mensagem do chat vira no registro, ou `null` se não vale registrar. */
export function eventoDaMensagem(
  m: Mensagem,
  usuarios: readonly Usuario[],
  agoraMs: number,
): EventoGravado | null {
  const autor = nomeDoAutor(m, usuarios);
  const t = Math.round(m.emReal > 0 ? m.emReal : agoraMs);
  if (m.tipo === "rolagem" || m.tipo === "modelo") {
    return { t, tipo: "rolagem", texto: corta(textoDaRolagem(m, autor)) };
  }
  if (m.tipo === "magia" && m.magia) {
    return {
      t,
      tipo: "chat",
      texto: corta(`${quemFala(autor, m.como?.nome)} usou ${m.magia.nome}`),
    };
  }
  if (m.tipo === "caracteristica" && m.caracteristica) {
    return {
      t,
      tipo: "chat",
      texto: corta(`${quemFala(autor, m.como?.nome)} usou ${m.caracteristica.nome}`),
    };
  }
  const texto = m.texto?.trim();
  if (!texto) return null;
  const falou = m.acao
    ? `${m.como?.nome ?? autor} ${texto}`
    : `${quemFala(autor, m.como?.nome)}: ${texto}`;
  return { t, tipo: "chat", texto: corta(falou) };
}

/**
 * Acompanha os eventos da mesa e devolve, para cada um que vale registrar, a linha do `eventos.jsonl`. Guarda o suficiente
 * do estado para saber se um combate começou ou acabou (o `combate.alterado` traz o combate inteiro).
 */
export class ObservadorDaMesa {
  private combateEmCurso = false;
  private ultimaCena: string | null = null;
  private vistas = new Set<string>();

  constructor(
    /** O estado de agora (os nomes de pessoas e cenas vêm daqui). */
    private readonly estado: () => Estado | null,
    private readonly agora: () => number = Date.now,
  ) {
    this.combateEmCurso = (estado()?.combate?.rodada ?? 0) > 0;
    this.ultimaCena = estado()?.cenaAtivaId ?? null;
  }

  observar(ev: EventoSala): EventoGravado[] {
    const e = this.estado();
    const t = this.agora();
    switch (ev.tipo) {
      case "chat.mensagem": {
        const m = ev.dados.mensagem;
        if (this.vistas.has(m.id)) return [];
        this.vistas.add(m.id);
        if (this.vistas.size > 5000) this.vistas = new Set([...this.vistas].slice(-1000));
        const linha = eventoDaMensagem(m, e?.usuarios ?? [], t);
        return linha ? [linha] : [];
      }
      case "grupo.movido": {
        const cena = e?.cenas.find((c) => c.id === ev.dados.cenaId);
        if (this.ultimaCena === ev.dados.cenaId) return [];
        this.ultimaCena = ev.dados.cenaId;
        return [{ t, tipo: "cena", texto: `o grupo foi para "${cena?.nome ?? "outra cena"}"` }];
      }
      case "combate.alterado": {
        const c = ev.dados.combate;
        const emCurso = c !== null && c.rodada > 0;
        const antes = this.combateEmCurso;
        this.combateEmCurso = emCurso;
        if (emCurso && !antes) return [{ t, tipo: "combate", texto: "o combate começou" }];
        if (!emCurso && antes) return [{ t, tipo: "combate", texto: "o combate terminou" }];
        return [];
      }
      default:
        return [];
    }
  }
}

/** O personagem de jogador que esta pessoa joga (o primeiro que ela edita e que não é NPC). */
export function personagemDaPessoa(estado: Estado, usuarioId: string): string | undefined {
  const meu = estado.personagens.find(
    (p: Personagem) =>
      p.editores.tipo === "jogadores" && p.editores.ids.includes(usuarioId) && !ehNpc(p),
  );
  return meu?.nome;
}

const LIMITE_DE_NOMES = 150;

/** `nomes.txt`: personagens, NPCs, cenas e nomes de token da mesa, um por linha, sem repetir. */
export function nomesDaMesa(estado: Estado): string {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  const pôr = (n: string | undefined) => {
    const limpo = (n ?? "").replace(/\s+/g, " ").trim();
    if (limpo === "" || limpo.length > 60 || vistos.has(limpo.toLowerCase())) return;
    vistos.add(limpo.toLowerCase());
    nomes.push(limpo);
  };
  for (const p of estado.personagens) if (!p.rascunho) pôr(p.nome);
  for (const c of estado.cenas) pôr(c.nome);
  for (const t of estado.tokens) pôr(t.nome);
  return `${nomes.slice(0, LIMITE_DE_NOMES).join("\n")}\n`;
}
