import { describe, expect, it } from "vitest";
import type { AssetMeta } from "../index.ts";
import { ErroDoMcp } from "./erros.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

// FG1: o MCP alcança a chama do modelo e do ponto (tamanho e animação por estágio, escolhendo um arquivo já enviado pelo
// nome), o modelo ao vivo (a edição de um modelo chega aos objetos dele) e o equipamento que o jogador dá a si mesmo.

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  try {
    const s = await f.executar(lida, sala.contexto());
    return typeof s === "string" ? { texto: s } : s;
  } catch (e) {
    if (e instanceof ErroDoMcp) return { texto: e.message, erro: true };
    throw e;
  }
}

const HASH_FORTE = "a".repeat(64);
const HASH_FRACA = "d".repeat(64);
const animacao = (hash: string, nome: string): AssetMeta => ({
  hash,
  tipo: "animacao",
  mime: "image/gif",
  bytes: 10,
  largura: 1,
  altura: 1,
  donoId: "m",
  nomeOriginal: nome,
  pedacos: ["b".repeat(64)],
});

function mesaComAnimacoes(): SalaSimulada {
  const sala = new SalaSimulada("m");
  sala.verdade = {
    ...sala.verdade,
    assets: [animacao(HASH_FORTE, "fogo-forte.gif"), animacao(HASH_FRACA, "fogo-fraco.gif")],
  };
  return sala;
}

describe("FG1: a chama pelo MCP", () => {
  it("o modelo ganha tamanho e animação por estágio, escolhendo o arquivo pelo nome; `padrao` tira", async () => {
    const sala = mesaComAnimacoes();
    const r = await rodar(sala, "objetos", {
      modelos: [
        {
          nome: "Tocha 5e",
          chama: { larguraM: 1, alturaM: 1.4 },
          animacoes: { forte: "fogo-forte.gif", fraca: "fogo-fraco.gif" },
        },
      ],
    });
    expect(r.erro, r.texto).toBeFalsy();
    const m = () => sala.verdade.modelos.find((x) => x.nome === "Tocha 5e");
    expect(m()?.chamaM).toEqual({ larguraM: 1, alturaM: 1.4 });
    expect(m()?.animacoes).toEqual({ forte: HASH_FORTE, fraca: HASH_FRACA });
    // `padrao` volta o estágio à animação da mesa; o que não foi citado fica como está.
    const r2 = await rodar(sala, "objetos", {
      modelos: [{ nome: "Tocha 5e", animacoes: { fraca: "padrao" } }],
    });
    expect(r2.erro, r2.texto).toBeFalsy();
    expect(m()?.animacoes).toEqual({ forte: HASH_FORTE });
    // Nome que não existe: erro em português, sem mexer em nada.
    const ruim = await rodar(sala, "objetos", {
      modelos: [{ nome: "Tocha 5e", animacoes: { morrendo: "nao-existe.gif" } }],
    });
    expect(ruim.texto).toMatch(/animação/i);
    expect(m()?.animacoes).toEqual({ forte: HASH_FORTE });
  });

  it("sem nenhuma animação enviada, o erro manda subir pela ferramenta `arquivos`", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "objetos", {
      modelos: [{ nome: "Tocha 5e", animacoes: { forte: "fogo.gif" } }],
    });
    expect(r.texto).toContain("arquivos");
    expect(r.texto).toContain("animacao");
  });

  it("o inflamável tem o tamanho da chama (e volta ao do modelo com `null`)", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "cenas", { cenas: [{ nome: "Cripta" }] });
    const criar = await rodar(sala, "objetos", {
      pontos: [
        {
          cena: "Cripta",
          nome: "Palha",
          em: [3, 3],
          tipo: "inflamavel",
          modelo: "Fogueira",
          chama: { larguraM: 2.4, alturaM: 1.8 },
        },
      ],
    });
    expect(criar.erro, criar.texto).toBeFalsy();
    expect(sala.verdade.pontos[0]?.chamaM).toEqual({ larguraM: 2.4, alturaM: 1.8 });
    const volta = await rodar(sala, "objetos", {
      pontos: [{ cena: "Cripta", nome: "Palha", chama: null }],
    });
    expect(volta.erro, volta.texto).toBeFalsy();
    expect(sala.verdade.pontos[0]?.chamaM).toBeUndefined();
  });

  it("editar o modelo pelo MCP chega ao objeto que já está no mapa (ao vivo)", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "cenas", { cenas: [{ nome: "Cripta" }] });
    sala.verdade = {
      ...sala.verdade,
      luzes: [
        {
          id: "o1",
          cenaId: sala.verdade.cenaAtivaId,
          nome: "Tocha 5e",
          modeloId: "modelo-tocha",
          portador: { tipo: "cena", x: 3, y: 3 },
          luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: true },
          intensidade: 1,
          estado: "acesa",
          saldoMs: null,
          modificadores: [],
          historico: [],
        },
      ],
    };
    const r = await rodar(sala, "objetos", { modelos: [{ nome: "Tocha 5e", claraM: 12 }] });
    expect(r.erro, r.texto).toBeFalsy();
    expect(sala.verdade.luzes[0]?.luz.claraM).toBe(12);
    expect(sala.verdade.luzes[0]?.estado).toBe("acesa");
  });
});

describe("FG1: o jogador dá equipamento ao próprio personagem pelo MCP", () => {
  it("na ficha dele sim; na de outra pessoa não; com a capacidade desligada, não", async () => {
    const sala = new SalaSimulada("j1");
    const criada = await rodar(sala, "fichas", { fichas: [{ nome: "Ana" }] });
    expect(criada.erro, criada.texto).toBeFalsy();
    const dar = await rodar(sala, "fichas", {
      mochila: [{ ficha: "Ana", modelo: "Tocha 5e", delta: 3 }],
    });
    expect(dar.erro, dar.texto).toBeFalsy();
    const ana = sala.verdade.personagens.find((p) => p.nome === "Ana");
    expect(ana?.ficha?.itens?.find((i) => i.modeloId === "modelo-tocha")?.quantidade).toBe(3);

    // A ficha de um NPC do mestre: o jogador nem a vê, nem a alcança.
    const mestre = new SalaSimulada("m", sala.verdade);
    await rodar(mestre, "fichas", { fichas: [{ nome: "Goblin", monstro: "Goblin" }] });
    sala.verdade = mestre.verdade;
    const alheia = await rodar(sala, "fichas", {
      mochila: [{ ficha: "Goblin", modelo: "Tocha 5e", delta: 1 }],
    });
    expect(alheia.texto).not.toMatch(/^Mochila de Goblin/);
    const goblin = sala.verdade.personagens.find((p) => p.nome === "Goblin");
    expect(goblin?.ficha?.itens?.some((i) => i.modeloId === "modelo-tocha")).toBeFalsy();

    // O mestre desliga a capacidade: o jogador volta a não dar tocha.
    sala.verdade = {
      ...sala.verdade,
      permissoes: {
        ...sala.verdade.permissoes,
        jogadores: { ...sala.verdade.permissoes.jogadores, "equipamento.dar": false },
      },
    };
    await rodar(sala, "fichas", { mochila: [{ ficha: "Ana", modelo: "Tocha 5e", delta: 1 }] });
    const depois = sala.verdade.personagens.find((p) => p.nome === "Ana");
    expect(depois?.ficha?.itens?.find((i) => i.modeloId === "modelo-tocha")?.quantidade).toBe(3);
  });
});
