import type { Estado, EventoSala, Mensagem } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { eventoDaMensagem, nomesDaMesa, ObservadorDaMesa, personagemDaPessoa } from "./eventos";

// CH3: o que a mesa registra enquanto grava e os nomes que ajudam o whisper.

const USUARIOS = [
  { id: "mestre", nome: "Vilella", papel: "mestre", cor: "#aa0000" },
  { id: "ana", nome: "Ana", papel: "jogador", cor: "#00aa00" },
] as Estado["usuarios"];

const T = 1_700_000_000_000;

function msg(extra: Partial<Mensagem>): Mensagem {
  return {
    id: `m-${Math.random()}`,
    seq: 1,
    emReal: T,
    autorId: "ana",
    tipo: "texto",
    visivelPara: "todos",
    ...extra,
  } as Mensagem;
}

describe("o chat vira linhas do registro", () => {
  it("texto: quem falou (com o personagem)", () => {
    expect(
      eventoDaMensagem(
        msg({ texto: "Vamos entrar", como: { personagemId: "p", nome: "Thorin" } }),
        USUARIOS,
        0,
      ),
    ).toEqual({ t: T, tipo: "chat", texto: "Ana (Thorin): Vamos entrar" });
    expect(eventoDaMensagem(msg({ texto: "oi" }), USUARIOS, 0)?.texto).toBe("Ana: oi");
    expect(eventoDaMensagem(msg({ texto: "   " }), USUARIOS, 0)).toBeNull();
  });

  it("ação em terceira pessoa", () => {
    expect(
      eventoDaMensagem(
        msg({ texto: "olha em volta", acao: true, como: { personagemId: "p", nome: "Brisa" } }),
        USUARIOS,
        0,
      )?.texto,
    ).toBe("Brisa olha em volta");
  });

  it("rolagem de teste no formato do pedido: 'Thorin, Percepção: 17'", () => {
    const rolagem = { expressao: "1d20+5", termos: [], total: 17 };
    const e = eventoDaMensagem(
      msg({
        tipo: "modelo",
        como: { personagemId: "p", nome: "Thorin" },
        modelo: {
          modelo: "teste",
          nome: "Percepção",
          vantagem: "normal",
          rolagem,
          critico: false,
          falhaCritica: false,
        } as unknown as NonNullable<Mensagem["modelo"]>,
      }),
      USUARIOS,
      0,
    );
    expect(e).toEqual({ t: T, tipo: "rolagem", texto: "Thorin, Percepção: 17" });
  });

  it("rolagem simples e oculta", () => {
    const e = eventoDaMensagem(
      msg({
        tipo: "rolagem",
        oculta: true,
        rolagens: [{ expressao: "2d6", termos: [], total: 9 }],
      }),
      USUARIOS,
      0,
    );
    expect(e?.texto).toBe("Ana, 2d6: 9 (oculta)");
  });

  it("o aviso de automação é 'A mesa'", () => {
    expect(
      eventoDaMensagem(
        msg({ autorId: "sistema", tipo: "aviso", texto: "A tocha apagou" }),
        USUARIOS,
        0,
      )?.texto,
    ).toBe("A mesa: A tocha apagou");
  });
});

describe("o observador da mesa", () => {
  const estado = {
    usuarios: USUARIOS,
    cenas: [
      { id: "c1", nome: "Taverna" },
      { id: "c2", nome: "Masmorra" },
    ],
    cenaAtivaId: "c1",
    combate: undefined,
    personagens: [],
    tokens: [],
  } as unknown as Estado;
  const evento = (tipo: string, dados: object) => ({ tipo, dados }) as unknown as EventoSala;

  it("registra o chat uma vez só (a mesma mensagem não entra duas vezes)", () => {
    const o = new ObservadorDaMesa(
      () => estado,
      () => T,
    );
    const m = msg({ texto: "oi" });
    expect(o.observar(evento("chat.mensagem", { mensagem: m }))).toHaveLength(1);
    expect(o.observar(evento("chat.mensagem", { mensagem: m }))).toHaveLength(0);
  });

  it("troca de cena: só quando o grupo vai para outra", () => {
    const o = new ObservadorDaMesa(
      () => estado,
      () => T,
    );
    expect(o.observar(evento("grupo.movido", { cenaId: "c1", tokens: [] }))).toEqual([]);
    expect(o.observar(evento("grupo.movido", { cenaId: "c2", tokens: [] }))).toEqual([
      { t: T, tipo: "cena", texto: 'o grupo foi para "Masmorra"' },
    ]);
    expect(o.observar(evento("grupo.movido", { cenaId: "c2", tokens: [] }))).toEqual([]);
  });

  it("combate: começa na rodada 1 e termina quando some", () => {
    const o = new ObservadorDaMesa(
      () => estado,
      () => T,
    );
    expect(
      o.observar(evento("combate.alterado", { combate: { entradas: [], rodada: 0 } })),
    ).toEqual([]);
    expect(
      o.observar(evento("combate.alterado", { combate: { entradas: [], rodada: 1 } }))[0]?.texto,
    ).toBe("o combate começou");
    expect(
      o.observar(evento("combate.alterado", { combate: { entradas: [], rodada: 2 } })),
    ).toEqual([]);
    expect(o.observar(evento("combate.alterado", { combate: null }))[0]?.texto).toBe(
      "o combate terminou",
    );
    expect(o.observar(evento("combate.alterado", { combate: null }))).toEqual([]);
  });

  it("ignora o resto", () => {
    const o = new ObservadorDaMesa(
      () => estado,
      () => T,
    );
    expect(o.observar(evento("token.movido", { id: "t", x: 1, y: 1 }))).toEqual([]);
  });
});

describe("os nomes da mesa e o personagem de cada pessoa", () => {
  const estado = {
    usuarios: USUARIOS,
    cenas: [{ id: "c1", nome: "Taverna do Javali" }],
    cenaAtivaId: "c1",
    personagens: [
      {
        id: "p1",
        nome: "Thorin",
        pastaId: "pasta-jogador-ana",
        editores: { tipo: "jogadores", ids: ["ana"] },
        ficha: { apresentacao: "personagem" },
      },
      {
        id: "p2",
        nome: "Capitão Orc",
        pastaId: "pasta-npcs",
        editores: { tipo: "jogadores", ids: [] },
        ficha: { apresentacao: "npc" },
      },
      {
        id: "p3",
        nome: "Segredo",
        rascunho: true,
        pastaId: "pasta-npcs",
        editores: { tipo: "jogadores", ids: [] },
      },
    ],
    tokens: [
      { id: "t1", nome: "Thorin" },
      { id: "t2", nome: "Javali" },
    ],
  } as unknown as Estado;

  it("personagens, NPCs, cenas e tokens, sem repetir e sem rascunho", () => {
    expect(nomesDaMesa(estado).trim().split("\n")).toEqual([
      "Thorin",
      "Capitão Orc",
      "Taverna do Javali",
      "Javali",
    ]);
  });

  it("o personagem de uma pessoa é o de jogador que ela edita (nunca NPC); o mestre não tem", () => {
    expect(personagemDaPessoa(estado, "ana")).toBe("Thorin");
    expect(personagemDaPessoa(estado, "mestre")).toBeUndefined();
  });
});
