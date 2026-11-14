import { describe, expect, it } from "vitest";
import { combateDe, desfazerPassos, diffDoEstado, type Estado, type Passo } from "../index.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { glifoDe, tracosDoTexto } from "./fonteDeTracos.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  const s = await f.executar(lida, sala.contexto());
  return typeof s === "string" ? { texto: s } : s;
}

const HASH_SOM = "a".repeat(64);

function comSom(sala: SalaSimulada): void {
  sala.verdade = {
    ...sala.verdade,
    assets: [
      {
        hash: HASH_SOM,
        tipo: "som",
        mime: "audio/mpeg",
        bytes: 10,
        largura: 1,
        altura: 1,
        donoId: "m",
        nomeOriginal: "floresta.mp3",
        pedacos: [],
      },
    ],
  } as Estado;
}

/** Desfaz o que uma chamada fez, pelo diff do estado (como a sala guarda no diário). */
function desfazerTudo(sala: SalaSimulada, antes: Estado): { aplicados: number; pulados: string[] } {
  const passos: Passo[] = [diffDoEstado(antes, sala.verdade)];
  const r = desfazerPassos(sala.verdade, passos, { usuarioId: "m", idPedido: "x" });
  sala.verdade = r.estado;
  return { aplicados: r.aplicados, pulados: r.pulados };
}

describe("M2: mapa (névoa, texto, paredes)", () => {
  it("cobre tudo, revela um retângulo e o jogador recebe a névoa", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "mapa", {
      nevoa: [{ modo: "cobrir" }, { modo: "revelar", de: [10, 4], ate: [14, 20] }],
    });
    expect(r.erro).toBeFalsy();
    const nevoa = sala.verdade.cenas[0]?.nevoa ?? [];
    expect(nevoa.map((t) => `${t.modo}:${t.forma}`)).toEqual(["cobrir:tudo", "revelar:retangulo"]);
    expect(nevoa[1]?.pontos[0]).toEqual({ x: 15, y: 6 });
    expect(sala.visaoDe("j1").cenas[0]?.nevoa).toHaveLength(2);
  });

  it("escreve um texto de traços, move, apaga pelo trecho e desfaz", async () => {
    const sala = new SalaSimulada("m");
    const antes = sala.verdade;
    const r = await rodar(sala, "mapa", { textos: [{ texto: "Ponte", em: [8, 8] }] });
    expect(r.erro).toBeFalsy();
    const tracos = sala.verdade.desenhos.length;
    expect(tracos).toBeGreaterThan(5);
    expect(sala.verdade.desenhos.every((d) => d.id.startsWith("txt-ponte-"))).toBe(true);
    await rodar(sala, "mapa", { moverDesenhos: [{ texto: "ponte", dx: 1, dy: 0 }] });
    const d = desfazerTudo(sala, antes);
    expect(d.pulados).toEqual([]);
    expect(sala.verdade.desenhos).toHaveLength(0);
  });

  it("apaga um texto pelo trecho", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "mapa", {
      textos: [
        { texto: "Ponte", em: [8, 8] },
        { texto: "Rio", em: [2, 2] },
      ],
    });
    await rodar(sala, "mapa", { apagar: { textos: ["ponte"] } });
    expect(sala.verdade.desenhos.length).toBeGreaterThan(0);
    expect(sala.verdade.desenhos.every((x) => x.id.startsWith("txt-rio-"))).toBe(true);
  });

  it("apaga uma parede 'perto de' um ponto e alterna uma porta", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "cenas", {
      cenas: [
        {
          nome: "Taverna",
          paredes: [
            { de: [2, 2], ate: [12, 2] },
            { de: [12, 2], ate: [12, 8], tipo: "porta" },
          ],
        },
      ],
    });
    expect(sala.verdade.paredes).toHaveLength(2);
    await rodar(sala, "mapa", { portas: [{ perto: [12, 5], estado: "trancada" }] });
    expect(sala.verdade.paredes.find((p) => p.tipo === "porta")?.estado).toBe("trancada");
    await rodar(sala, "mapa", { paredes: [{ perto: [7, 2], apagar: true }] });
    expect(sala.verdade.paredes).toHaveLength(1);
    const longe = await rodar(sala, "mapa", { paredes: [{ perto: [30, 30], apagar: true }] });
    expect(longe.erro).toBe(true);
  });

  it("desfaz a névoa", async () => {
    const sala = new SalaSimulada("m");
    const antes = sala.verdade;
    await rodar(sala, "mapa", { nevoa: [{ modo: "cobrir" }] });
    desfazerTudo(sala, antes);
    expect(sala.verdade.cenas[0]?.nevoa ?? []).toHaveLength(0);
  });

  it("o jogador não vê o mapa e a sala recusa a névoa dele", async () => {
    const sala = new SalaSimulada("j1");
    const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === "mapa") as QualquerFerramenta;
    expect(f.visivel(sala.estado(), sala.eu())).toBe(false);
    const r = await rodar(sala, "mapa", { nevoa: [{ modo: "cobrir" }] });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("Sem permissão");
    expect(sala.verdade.cenas[0]?.nevoa ?? []).toHaveLength(0);
  });
});

describe("M2: combate", () => {
  it("monta com 2 goblins do compêndio, rola e passa o turno", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", monstro: "Goblin", quantidade: 2 }] });
    await rodar(sala, "cenas", {
      cenas: [
        { nome: "Taverna", tokens: [{ ficha: "Goblin 1" }, { ficha: "Goblin 2", em: [8.5, 5.5] }] },
      ],
    });
    const r = await rodar(sala, "combate", {
      passos: [
        { acao: "adicionar", todosOsTokens: true },
        { acao: "rolar", quem: "todos" },
        { acao: "ordenar" },
        { acao: "proximo" },
        { acao: "passar" },
      ],
      ordemVisivel: true,
    });
    expect(r.erro).toBeFalsy();
    const c = combateDe(sala.verdade);
    expect(c.entradas).toHaveLength(2);
    expect(c.entradas.every((e) => e.iniciativa !== undefined)).toBe(true);
    expect(c.rodada).toBeGreaterThanOrEqual(1);
    expect(sala.verdade.ordemDeTurnoVisivel).toBe(true);
  });

  it("o jogador não monta o combate", async () => {
    const sala = new SalaSimulada("j1");
    const r = await rodar(sala, "combate", { passos: [{ acao: "adicionar", soltas: ["Covil"] }] });
    expect(r.erro).toBe(true);
    expect(combateDe(sala.verdade).entradas).toHaveLength(0);
  });
});

describe("M2: som", () => {
  it("toca a trilha pelo nome do arquivo e define a trilha da cena", async () => {
    const sala = new SalaSimulada("m");
    comSom(sala);
    const r = await rodar(sala, "som", {
      trilha: { som: "floresta", volume: 0.5 },
      trilhaDaCena: [{ cena: "Taverna", som: "floresta.mp3" }],
    });
    expect(r.erro).toBeFalsy();
    expect(sala.verdade.trilha?.hash).toBe(HASH_SOM);
    expect(sala.verdade.trilha?.volume).toBe(0.5);
    expect(sala.verdade.cenas[0]?.trilha?.nome).toBe("floresta.mp3");
    await rodar(sala, "som", { trilha: "parar" });
    expect(sala.verdade.trilha).toBeUndefined();
  });

  it("sem som na mesa, diz o que fazer", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "som", { trilha: { som: "x.mp3" } });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("arquivos");
  });
});

describe("M2: chat", () => {
  it("narra com a marca 'pelo Claude', como um NPC e em sussurro", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", { fichas: [{ nome: "Barqueiro", tipo: "npc" }] });
    const r = await rodar(sala, "chat", { narrar: "Um vento frio sobe do poço.", emote: true });
    expect(r.erro).toBeFalsy();
    const r2 = await rodar(sala, "chat", { narrar: "Quem entra?", como: "Barqueiro" });
    expect(r2.erro).toBeFalsy();
    const r3 = await rodar(sala, "chat", { narrar: "Passos atrás da porta.", sussurrar: "Ana" });
    expect(r3.erro).toBeFalsy();
    const enviados = sala.enviados.filter((e) => e.tipo === "chat.enviar");
    expect(enviados).toHaveLength(3);
    expect((enviados[0]?.dados as { texto: string } | undefined)?.texto).toBe(
      "/em Um vento frio sobe do poço.",
    );
    expect((enviados[2]?.dados as { texto: string } | undefined)?.texto).toContain('/w "Ana"');
  });

  it("mostra um handout", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "notas", {
      notas: [{ titulo: "A Eclusa", texto: "Antiga.", visivel: "todos" }],
    });
    const r = await rodar(sala, "chat", { handout: "A Eclusa" });
    expect(r.erro).toBeFalsy();
    expect(sala.enviados.some((e) => e.tipo === "handout.mostrar")).toBe(true);
  });
});

describe("M2: fonte de traços", () => {
  it("tira o acento, ignora o que não tem glifo e mede a largura", () => {
    expect(glifoDe("é")).toBe("E");
    expect(glifoDe("€")).toBeNull();
    const r = tracosDoTexto("Ação €", 0, 0, 1.5);
    expect(r.ignorados).toEqual(["€"]);
    expect(r.tracos.length).toBeGreaterThan(4);
    expect(r.larguraM).toBeGreaterThan(1);
  });
});

describe("M2: tokens, mesa, cenas e automações", () => {
  it("edita token (mover, condições, vida) e restaura um apagado", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", monstro: "Goblin" }] });
    await rodar(sala, "cenas", { cenas: [{ nome: "Taverna", tokens: [{ ficha: "Goblin" }] }] });
    const r = await rodar(sala, "tokens", {
      tokens: [
        { token: "Goblin", mover: [5.5, 5.5], condicoes: ["amedrontado"], pv: 3, morto: true },
      ],
    });
    expect(r.erro).toBeFalsy();
    const t = sala.verdade.tokens[0];
    expect(t?.x).toBe(8.25);
    expect(t?.condicoes).toEqual(["amedrontado"]);
    expect(sala.verdade.personagens[0]?.ficha?.pvAtual).toBe(3);
    const ap = await rodar(sala, "cenas", {
      cenas: [{ nome: "Taverna", apagarTokens: ["Goblin"] }],
    });
    expect(ap.texto).toContain("ids para");
  });

  it("configura a mesa: pastas, relógio, configuração e iluminação", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "mesa", {
      configuracao: { maosPorPersonagem: 3 },
      iluminacao: { memoriaLigada: false },
      pastas: [{ nome: "Vilarejo", visivel: "todos" }],
      relogio: "pausar",
    });
    expect(r.erro).toBeFalsy();
    expect(sala.verdade.config.maosPorPersonagem).toBe(3);
    expect(sala.verdade.config.iluminacao.memoriaLigada).toBe(false);
    expect(sala.verdade.pastas.some((p) => p.nome === "Vilarejo")).toBe(true);
    const r2 = await rodar(sala, "mesa", { pastas: [{ nome: "Vilarejo", novoNome: "Aldeia" }] });
    expect(r2.erro).toBeFalsy();
    expect(sala.verdade.pastas.some((p) => p.nome === "Aldeia")).toBe(true);
    const r3 = await rodar(sala, "mesa", { pastas: [{ nome: "Aldeia", apagar: true }] });
    expect(r3.erro).toBeFalsy();
  });

  it("o jogador não configura a mesa", async () => {
    const sala = new SalaSimulada("j1");
    const r = await rodar(sala, "mesa", { configuracao: { maosPorPersonagem: 3 } });
    expect(r.erro).toBe(true);
    expect(sala.verdade.config.maosPorPersonagem).not.toBe(3);
  });

  it("duplica uma cena e leva o grupo (cena em rascunho: a mesa explica)", async () => {
    const sala = new SalaSimulada("m");
    const r = await rodar(sala, "cenas", { cenas: [{ nome: "Segunda", duplicarDe: "Taverna" }] });
    expect(r.erro).toBeFalsy();
    expect(sala.verdade.cenas.some((c) => c.nome === "Segunda")).toBe(true);
    const r2 = await rodar(sala, "cenas", { cenas: [{ nome: "Segunda", levarGrupo: true }] });
    expect(r2.erro).toBe(true);
    expect(r2.texto).toContain("rascunho");
  });

  it("dado de vida e apagar ficha", async () => {
    const sala = new SalaSimulada("m");
    await rodar(sala, "fichas", {
      fichas: [{ nome: "Brisa", classes: [{ classe: "Clérigo", nivel: 3 }] }],
    });
    const r = await rodar(sala, "fichas", { apagar: ["Brisa"] });
    expect(r.erro).toBeFalsy();
    expect(sala.verdade.personagens).toHaveLength(0);
  });

  it("nada a fazer, sem entrada útil, é dito", async () => {
    const sala = new SalaSimulada("m");
    for (const nome of ["mapa", "tokens", "mesa", "som", "chat"]) {
      const r = await rodar(sala, nome, {});
      expect(r.texto, nome).toContain("Nada a fazer");
    }
  });
});
