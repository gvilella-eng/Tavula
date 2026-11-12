import { describe, expect, it } from "vitest";
import {
  type Estado,
  estadoInicial,
  fonteComSemente,
  IntencaoSchema,
  modeloDoItem,
  modelosAumentados,
  novasDoModelo,
  processar,
} from "./index.ts";

// V4a2: o dado de vida soma a cura direto no PV (pela sala) e o item de luz casa o modelo pelo nome.

const AGORA = "2026-01-01T00:00:00.000Z";
let n = 0;
const pedido = (tipo: string, dados: object) =>
  IntencaoSchema.parse({ v: 1, id: `i${++n}`, tipo, dados });

function estado(ficha: object): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#222" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#333" },
    ],
    pastas: [{ id: "p", nome: "P", ordem: 0, visivel: { tipo: "todos" } }],
    personagens: [
      {
        id: "a",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: ["j1"] },
        nome: "Aldric",
        tokenPadrao: { cor: "#fff", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha,
      },
    ],
  });
}

const GUERREIRO = {
  pvAtual: 10,
  pvMax: 40,
  classes: [{ classe: "Guerreiro", nivel: 3 }],
  atributos: { con: 14 },
};

describe("ficha.dadoDeVida", () => {
  it("rola 1dN + Con, marca o dado, soma ao PV e publica o bloco no chat", () => {
    const r = processar(
      estado(GUERREIRO),
      "j1",
      pedido("ficha.dadoDeVida", { personagemId: "a", dado: "d10" }),
      AGORA,
      fonteComSemente(3),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = r.estado.personagens[0]?.ficha;
    expect(p?.dadosDeVidaUsados?.d10).toBe(1);
    expect(p?.pvAtual).toBeGreaterThanOrEqual(10 + 3); // 1d10 + 2, no mínimo 3
    const msg = r.estado.chat?.at(-1) ?? r.eventos.find((e) => e.tipo === "chat.mensagem");
    expect(msg).toBeTruthy();
    const ev = r.eventos.find((e) => e.tipo === "chat.mensagem");
    if (ev?.tipo !== "chat.mensagem") throw new Error("sem mensagem");
    const m = ev.dados.mensagem.modelo;
    expect(m?.modelo).toBe("vida");
    if (m?.modelo === "vida") {
      expect(m.nome).toBe("Dado de vida · d10");
      expect(m.curou).toBe((p?.pvAtual ?? 0) - 10);
      expect(m.pvMax).toBe(40);
    }
  });

  it("o PV não passa do máximo e o temporário não muda", () => {
    const r = processar(
      estado({ ...GUERREIRO, pvAtual: 39, pvTemp: 5 }),
      "m",
      pedido("ficha.dadoDeVida", { personagemId: "a", dado: "d10" }),
      AGORA,
      fonteComSemente(3),
    );
    if (!r.ok) throw new Error(r.erro.mensagem);
    const f = r.estado.personagens[0]?.ficha;
    expect(f?.pvAtual).toBe(40);
    expect(f?.pvTemp).toBe(5);
  });

  it("recusa sem dado disponível ou de tipo que o personagem não tem", () => {
    const gasto = estado({ ...GUERREIRO, dadosDeVidaUsados: { d10: 3 } });
    const a = processar(
      gasto,
      "j1",
      pedido("ficha.dadoDeVida", { personagemId: "a", dado: "d10" }),
      AGORA,
      fonteComSemente(1),
    );
    expect(a.ok).toBe(false);
    const b = processar(
      estado(GUERREIRO),
      "j1",
      pedido("ficha.dadoDeVida", { personagemId: "a", dado: "d6" }),
      AGORA,
      fonteComSemente(1),
    );
    expect(b.ok).toBe(false);
  });

  it("só quem edita a ficha (ou o mestre) usa", () => {
    const r = processar(
      estado(GUERREIRO),
      "j2",
      pedido("ficha.dadoDeVida", { personagemId: "a", dado: "d10" }),
      AGORA,
      fonteComSemente(1),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("sem_permissao");
  });
});

describe("item de luz pelo nome do modelo", () => {
  const modelos = [{ id: "mod-a", nome: "Fogo Fátuo" }];
  it("casa o nome sem maiúsculas, acentos nem espaços nas pontas, e só por igualdade", () => {
    expect(modeloDoItem({ nome: "  fogo fatuo " }, modelos)).toBe("mod-a");
    expect(modeloDoItem({ nome: "Fogo Fátuo Grande" }, modelos)).toBeUndefined();
    expect(modeloDoItem({ nome: "Corda" }, modelos)).toBeUndefined();
  });
  it("o modeloId vale enquanto o modelo existe; se o modelo some, volta a ser item comum", () => {
    expect(modeloDoItem({ nome: "x", modeloId: "mod-a" }, modelos)).toBe("mod-a");
    expect(modeloDoItem({ nome: "x", modeloId: "sumiu" }, modelos)).toBeUndefined();
  });
  it("as novas contam o item ligado pelo nome e o jogador não as aumenta", () => {
    const antes = { pvAtual: 1, pvMax: 1, itens: [{ nome: "Fogo Fátuo", quantidade: 2 }] };
    const depois = { ...antes, itens: [{ nome: "Fogo Fátuo", quantidade: 3 }] };
    expect(novasDoModelo(antes, "mod-a", modelos)).toBe(2);
    expect(novasDoModelo(antes, "mod-a")).toBe(0);
    expect(modelosAumentados(antes, depois, modelos)).toEqual(["mod-a"]);
  });
});
