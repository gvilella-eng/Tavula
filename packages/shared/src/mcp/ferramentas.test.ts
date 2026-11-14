import { describe, expect, it } from "vitest";
import { listarRascunhos, normalizarBusca } from "../index.ts";
import type { QualquerFerramenta, Saida } from "./ferramentas/base.ts";
import { ferramentasVisiveis, TODAS_AS_FERRAMENTAS } from "./ferramentas/index.ts";
import { chamarFerramenta, definicaoDaFerramenta } from "./servidor.ts";
import { SalaSimulada } from "./testes/salaSimulada.ts";

const nomes = (fs: readonly QualquerFerramenta[]) => fs.map((f) => f.nome);

async function rodar(sala: SalaSimulada, nome: string, entrada: object): Promise<Saida> {
  const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === nome) as QualquerFerramenta;
  const lida = f.entrada.parse(entrada);
  const s = await f.executar(lida, sala.contexto());
  return typeof s === "string" ? { texto: s } : s;
}

const MESTRE = "m";
const ANA = "j1";

describe("cada papel vê só as suas ferramentas", () => {
  it("o mestre vê todas", () => {
    const sala = new SalaSimulada(MESTRE);
    expect(nomes(ferramentasVisiveis(sala.estado(), sala.eu()))).toEqual([
      "panorama",
      "ler",
      "fichas",
      "compendio",
      "notas",
      "objetos",
      "cenas",
      "mapa",
      "tokens",
      "automacoes",
      "combate",
      "mesa",
      "som",
      "chat",
      "rolar",
      "rascunhos",
      "arquivos",
      "desfazer",
    ]);
  });

  it("o jogador não vê objetos, cenas, automações nem rascunhos", () => {
    const sala = new SalaSimulada(ANA);
    const vistas = nomes(ferramentasVisiveis(sala.estado(), sala.eu()));
    expect(vistas).toEqual([
      "panorama",
      "ler",
      "fichas",
      "compendio",
      "notas",
      "tokens",
      "chat",
      "rolar",
      "arquivos",
      "desfazer",
    ]);
    for (const proibida of [
      "objetos",
      "cenas",
      "mapa",
      "automacoes",
      "combate",
      "mesa",
      "som",
      "rascunhos",
    ]) {
      expect(vistas).not.toContain(proibida);
    }
  });

  it("com 'Criar fichas e notas próprias' desligado e sem ficha para editar, o jogador perde fichas e notas", () => {
    const sala = new SalaSimulada(ANA);
    sala.verdade = {
      ...sala.verdade,
      permissoes: {
        ...sala.verdade.permissoes,
        jogadores: { ...sala.verdade.permissoes.jogadores, "personagem.criarProprio": false },
      },
    };
    const vistas = nomes(ferramentasVisiveis(sala.estado(), sala.eu()));
    expect(vistas).not.toContain("fichas");
    expect(vistas).not.toContain("notas");
    expect(vistas).toContain("panorama");
  });

  it("chamar de qualquer jeito uma ferramenta que não é do papel é recusado com texto claro", async () => {
    const sala = new SalaSimulada(ANA);
    const r = await chamarFerramenta(
      "cenas",
      { cenas: [{ nome: "X" }] },
      conexaoDe(sala),
      sala.contexto().compendio,
    );
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/não está liberada para Ana/);
    expect(sala.enviados).toHaveLength(0);
  });

  it("entrada inválida volta com o campo errado, sem chegar à mesa", async () => {
    const sala = new SalaSimulada(MESTRE);
    const r = await chamarFerramenta(
      "fichas",
      { fichas: [{ nome: "X", forca: 10 }] },
      conexaoDe(sala),
      sala.contexto().compendio,
    );
    expect(r.isError).toBe(true);
    expect(r.content[0]?.text).toMatch(/Entrada inválida/);
    expect(sala.enviados).toHaveLength(0);
  });
});

function conexaoDe(sala: SalaSimulada) {
  return Object.assign(sala, {
    esperarPronto: async () => undefined,
    estadoOuNulo: () => sala.estado(),
  });
}

describe("o jogador monta o personagem", () => {
  it("cria a ficha com magias do compêndio, e só ele (e o mestre) a vê", async () => {
    const sala = new SalaSimulada(ANA);
    const r = await rodar(sala, "fichas", {
      fichas: [
        {
          nome: "Brisa",
          raca: "Anã",
          classes: [{ classe: "Mago", nivel: 5 }],
          atributos: { for: 8, des: 14, con: 14, int: 16, sab: 12, car: 10 },
          compendio: ["Bola de Fogo", "Mísseis Mágicos", "Adaga"],
          itens: [{ nome: "Corda", quantidade: 1 }],
        },
      ],
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toContain('Criou "Brisa"');
    const dela = sala.visaoDe(ANA).personagens.find((p) => p.nome === "Brisa");
    expect(dela?.ficha?.magias?.map((m) => m.nome)).toEqual(["Bola de Fogo", "Mísseis Mágicos"]);
    expect(dela?.editores).toEqual({ tipo: "jogadores", ids: [ANA] });
    expect(dela?.criadoPor).toBe(ANA);
    expect(dela?.rascunho).toBeUndefined();
    // Bia não vê a ficha da Ana; o mestre vê.
    expect(sala.visaoDe("j2").personagens.some((p) => p.nome === "Brisa")).toBe(false);
    expect(sala.visaoDe(MESTRE).personagens.some((p) => p.nome === "Brisa")).toBe(true);
  });

  it("a segunda chamada com o mesmo nome edita (não cria outra) e só manda o que mudou", async () => {
    const sala = new SalaSimulada(ANA);
    await rodar(sala, "fichas", { fichas: [{ nome: "Brisa", pv: { max: 10 } }] });
    const antes = sala.enviados.length;
    const r = await rodar(sala, "fichas", {
      fichas: [{ nome: "brisa", historia: "Nasceu na montanha." }],
    });
    expect(r.texto).toContain('Editou "Brisa"');
    expect(sala.enviados.slice(antes).map((e) => e.tipo)).toEqual(["ficha.alterar"]);
    expect(sala.visaoDe(ANA).personagens.filter((p) => p.nome === "Brisa")).toHaveLength(1);
    // Sem mudança nenhuma, nada é enviado.
    const antes2 = sala.enviados.length;
    const r2 = await rodar(sala, "fichas", {
      fichas: [{ nome: "Brisa", historia: "Nasceu na montanha." }],
    });
    expect(r2.texto).toContain("nada mudou");
    expect(sala.enviados).toHaveLength(antes2);
  });

  it("o jogador não cria NPC nem escolhe dono", async () => {
    const sala = new SalaSimulada(ANA);
    const r = await rodar(sala, "fichas", {
      fichas: [
        { nome: "Capanga", tipo: "npc" },
        { nome: "Outra", dono: ["Bia"] },
      ],
    });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("Só o mestre cria NPCs");
    expect(r.texto).toContain("Só o mestre escolhe quem edita");
    expect(sala.enviados).toHaveLength(0);
  });

  it("respeita o teto de 20 fichas, dizendo o que fazer", async () => {
    const sala = new SalaSimulada(ANA);
    for (let i = 1; i <= 20; i++) {
      const r = await rodar(sala, "fichas", { fichas: [{ nome: `PJ ${i}`, pv: { max: 5 } }] });
      expect(r.erro).toBeFalsy();
    }
    const r = await rodar(sala, "fichas", { fichas: [{ nome: "PJ 21", pv: { max: 5 } }] });
    expect(r.erro).toBe(true);
    expect(r.texto).toMatch(/teto.*apague uma/);
  });

  it("a ficha de outro jogador que ele vê não é editada", async () => {
    const sala = new SalaSimulada(MESTRE);
    // O mestre (sem Claude, direto na verdade) deixa uma ficha da Bia numa pasta que todos veem.
    sala.verdade = {
      ...sala.verdade,
      pastas: [
        ...sala.verdade.pastas,
        { id: "pasta-grupo", nome: "Grupo", ordem: 9, visivel: { tipo: "todos" } },
      ],
      personagens: [
        {
          id: "p-bia",
          pastaId: "pasta-grupo",
          editores: { tipo: "jogadores", ids: ["j2"] },
          nome: "Heroína da Bia",
          tokenPadrao: { cor: "#2980b9", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 0 },
          ficha: { pvAtual: 9, pvMax: 9 },
        },
      ],
    };
    const ana = new SalaSimulada(ANA, sala.verdade);
    const r = await rodar(ana, "fichas", { fichas: [{ nome: "Heroína da Bia", pv: { max: 99 } }] });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("Você não edita a ficha");
    expect(ana.enviados).toHaveLength(0);
  });

  it("rola 4d6kh3 seis vezes: a mesa rola e a ferramenta devolve cada resultado", async () => {
    const sala = new SalaSimulada(ANA);
    const r = await rodar(sala, "rolar", { expressao: "4d6kh3", vezes: 6 });
    const linhas = r.texto.split("\n");
    expect(linhas).toHaveLength(6);
    for (const l of linhas) expect(l).toMatch(/4d6kh3.*= \d+/);
    expect(sala.enviados.filter((e) => e.tipo === "dado.rolar")).toHaveLength(6);
    // As seis rolagens são uma chamada: o mesmo lote.
    expect(new Set(sala.enviados.map((e) => e.lote?.loteId)).size).toBe(1);
  });

  it("rola um teste de perícia da ficha com o bônus que a mesa calcula", async () => {
    const sala = new SalaSimulada(ANA);
    await rodar(sala, "fichas", {
      fichas: [
        {
          nome: "Brisa",
          classes: [{ classe: "Clérigo", nivel: 3 }],
          atributos: { sab: 16 },
          pericias: ["Medicina"],
        },
      ],
    });
    const r = await rodar(sala, "rolar", {
      teste: { ficha: "Brisa", pericia: "Medicina", cd: 10 },
    });
    expect(r.texto).toMatch(/Medicina \(Brisa\)/);
    const envio = sala.enviados.find((e) => e.tipo === "chat.modelo");
    expect((envio?.dados as { bonus: number } | undefined)?.bonus).toBe(5);
  });
});

describe("o lote leva o loteId", () => {
  it("todas as intenções de uma chamada levam o mesmo loteId e a descrição; outra chamada, outro loteId", async () => {
    const sala = new SalaSimulada(MESTRE);
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", pv: { max: 7 }, ca: 15 }] });
    const primeiro = sala.enviados.map((e) => e.lote);
    expect(primeiro.length).toBeGreaterThan(0);
    const l = primeiro[0];
    expect(l?.loteId).toMatch(/^mcp-[0-9a-f]{16}$/);
    expect(l?.lote).toContain("Goblin");

    sala.enviados.length = 0;
    await rodar(sala, "cenas", {
      cenas: [
        {
          nome: "Eclusa",
          paredes: [
            { de: [2, 2], ate: [12, 2] },
            { de: [12, 2], ate: [12, 8], tipo: "porta" },
          ],
          tokens: [{ ficha: "Goblin", quantidade: 4, em: [6.5, 5.5], oculto: true }],
        },
      ],
    });
    const tipos = sala.enviados.map((e) => e.tipo);
    expect(tipos).toEqual([
      "cena.criar",
      "parede.criar",
      "token.criar",
      "token.criar",
      "token.criar",
      "token.criar",
    ]);
    const ids = new Set(sala.enviados.map((e) => e.lote?.loteId));
    expect(ids.size).toBe(1);
    expect(ids.has(l?.loteId)).toBe(false);
    expect(sala.enviados.every((e) => (e.lote?.lote ?? "").startsWith("cenas: Eclusa"))).toBe(true);
  });
});

describe("o mestre monta o mundo (rascunho até publicar)", () => {
  it("cena com paredes, arco, NPC e ciclo: tudo em rascunho, invisível ao jogador até publicar", async () => {
    const sala = new SalaSimulada(MESTRE);
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", pv: { max: 7 } }] });
    const r = await rodar(sala, "cenas", {
      cenas: [
        {
          nome: "Eclusa",
          paredes: [
            { de: [2, 2], ate: [12, 2] },
            { de: [12, 2], ate: [12, 8], por: [14.5, 5] },
            { de: [3, 3], ate: [5, 3], tipo: "porta", estado: "trancada" },
          ],
          tokens: [{ ficha: "Goblin", quantidade: 4, em: [6.5, 5.5], oculto: true }],
        },
      ],
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toContain("rascunho");
    const m = sala.visaoDe(MESTRE);
    const cena = m.cenas.find((c) => c.nome === "Eclusa");
    expect(cena?.rascunho).toBe(true);
    const paredes = m.paredes.filter((p) => p.cenaId === cena?.id);
    expect(paredes).toHaveLength(3);
    // Coordenadas em células viram metros (1,5 m) e o arco guarda o ponto por onde passa.
    expect(paredes[0]).toMatchObject({ a: { x: 3, y: 3 }, b: { x: 18, y: 3 } });
    expect(paredes[1]?.meio).toEqual({ x: 21.75, y: 7.5 });
    expect(paredes[2]).toMatchObject({ tipo: "porta", estado: "trancada" });
    const tokens = m.tokens.filter((t) => t.cenaId === cena?.id);
    expect(tokens.map((t) => t.nome)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3", "Goblin 4"]);
    expect(tokens.every((t) => t.oculto && t.personagemId)).toBe(true);

    await rodar(sala, "automacoes", {
      ciclos: [
        { nome: "Vento", periodoS: 600, fases: [{ emS: 0, evento: "vento.sopra", duracaoS: 60 }] },
      ],
    });
    expect(sala.visaoDe(MESTRE).automacoes?.ciclos.map((c) => c.nome)).toEqual(["Vento"]);
    expect(sala.visaoDe(MESTRE).automacoes?.ciclos[0]?.rascunho).toBe(true);

    // O jogador não vê nada até publicar.
    const ana = sala.visaoDe(ANA);
    expect(ana.cenas.some((c) => c.nome === "Eclusa")).toBe(false);
    expect(ana.personagens.some((p) => p.nome === "Goblin")).toBe(false);
    expect(ana.automacoes).toBeUndefined();
    expect(ana.paredes.filter((p) => p.cenaId === cena?.id)).toHaveLength(0);

    const lista = await rodar(sala, "rascunhos", { acao: "listar" });
    expect(lista.texto).toMatch(/cena: Eclusa/);
    expect(lista.texto).toMatch(/ciclo: Vento/);
    expect(listarRascunhos(sala.verdade).length).toBeGreaterThanOrEqual(3);

    const pub = await rodar(sala, "rascunhos", { acao: "publicar" });
    expect(pub.texto).toContain("Restam 0");
    expect(sala.visaoDe(MESTRE).cenas.find((c) => c.nome === "Eclusa")?.rascunho).toBeUndefined();
  });

  it("nome ambíguo ou inexistente na cena dá erro que diz o que fazer, e os outros itens seguem", async () => {
    const sala = new SalaSimulada(MESTRE);
    await rodar(sala, "fichas", {
      fichas: [{ nome: "Ogro", pv: { max: 59 } }],
    });
    // Duas fichas com o mesmo nome (a ferramenta não cria a segunda: edita a primeira), então força o empate na mão.
    sala.verdade = {
      ...sala.verdade,
      personagens: [
        ...sala.verdade.personagens,
        {
          ...(sala.verdade.personagens[0] as NonNullable<(typeof sala.verdade.personagens)[0]>),
          id: "ogro-2",
        },
      ],
    };
    const r = await rodar(sala, "cenas", {
      cenas: [
        { nome: "A", tokens: [{ ficha: "Ogro" }] },
        { nome: "B", tokens: [{ ficha: "Dragão" }] },
        { nome: "C" },
      ],
    });
    expect(r.texto).toMatch(/Há 2 fichas chamadas "Ogro"\. Use o id/);
    expect(r.texto).toMatch(/Não achei a ficha "Dragão"/);
    expect(r.texto).toContain('Cena "C"');
    expect(r.texto).toMatch(/1 de 3 feitos; 2 com erro/);
  });

  it("notas do mestre entram como rascunho e o jogador escolhe quem vê as dele", async () => {
    const mestre = new SalaSimulada(MESTRE);
    await rodar(mestre, "notas", {
      notas: [{ titulo: "A Eclusa", texto: "Uma comporta.", visivel: "todos" }],
    });
    expect(mestre.visaoDe(MESTRE).handouts[0]?.rascunho).toBe(true);
    expect(mestre.visaoDe(ANA).handouts).toHaveLength(0);

    const ana = new SalaSimulada(ANA);
    await rodar(ana, "notas", {
      notas: [{ titulo: "Meu diário", texto: "Dia 1.", visivel: ["Bia"] }],
    });
    expect(ana.visaoDe("j2").handouts.map((h) => h.titulo)).toEqual(["Meu diário"]);
    expect(ana.visaoDe(ANA).handouts[0]?.criadoPor).toBe(ANA);
    // Acrescentar soma ao texto.
    await rodar(ana, "notas", { notas: [{ titulo: "Meu diário", acrescentar: "Dia 2." }] });
    expect(ana.visaoDe(ANA).handouts[0]?.texto).toBe("Dia 1.\n\nDia 2.");
  });

  it("o compêndio acha por nome, classe e nível com resposta curta", async () => {
    const sala = new SalaSimulada(ANA);
    const r = await rodar(sala, "compendio", { tipo: "magia", classe: "Clérigo", nivel: 1 });
    expect(normalizarBusca(r.texto)).toContain("detectar magia");
    expect(r.texto).not.toContain("Bola de Fogo");
    const nada = await rodar(sala, "compendio", { busca: "xyzzy" });
    expect(nada.texto).toMatch(/Nada encontrado/);
  });

  it("N3a: o compêndio acha monstros por nome, tipo e ND e itens mágicos por tipo e raridade", async () => {
    const sala = new SalaSimulada(ANA);
    const goblin = await rodar(sala, "compendio", { tipo: "monstro", busca: "goblin" });
    expect(goblin.texto).toContain("monstro: Goblin");
    expect(goblin.texto).toContain("ND 1/4");
    const faixa = await rodar(sala, "compendio", { ndMin: "1", ndMax: "10" });
    expect(faixa.texto).toContain("Mago");
    expect(faixa.texto).not.toContain("Goblin");
    const feras = await rodar(sala, "compendio", { tipoDeCriatura: "Fera" });
    expect(feras.texto).toContain("Lobo");
    const anel = await rodar(sala, "compendio", { raridade: "raro", tipoDeItem: "anel" });
    expect(anel.texto).toContain("item mágico: Anel de Proteção");
    expect(anel.texto).not.toContain("Poção");
    const detalhe = await rodar(sala, "compendio", {
      busca: "mago",
      tipo: "monstro",
      detalhe: true,
    });
    expect(detalhe.texto).toContain("ações: Adaga");
  });

  it("N3a: o mestre cria vários NPCs de um monstro pelo nome, e o jogador não", async () => {
    const sala = new SalaSimulada(MESTRE);
    const r = await rodar(sala, "fichas", {
      fichas: [{ nome: "Goblin", monstro: "Goblin", quantidade: 4 }],
    });
    expect(r.erro).toBeFalsy();
    const goblins = sala.visaoDe(MESTRE).personagens.filter((p) => /^Goblin [0-9]$/.test(p.nome));
    expect(goblins.map((p) => p.nome)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3", "Goblin 4"]);
    expect(goblins[0]?.ficha).toMatchObject({
      apresentacao: "npc",
      pvMax: 7,
      npc: { nd: "1/4" },
    });
    expect(goblins[0]?.ficha?.ataques?.map((a) => a.nome)).toEqual(["Cimitarra", "Arco Curto"]);
    expect(goblins[0]?.editores).toEqual({ tipo: "jogadores", ids: [] });
    // O mago leva as magias que o compêndio tem.
    await rodar(sala, "fichas", { fichas: [{ nome: "Mestre Arcano", monstro: "Mago" }] });
    const mago = sala.visaoDe(MESTRE).personagens.find((p) => p.nome === "Mestre Arcano");
    expect(mago?.ficha?.magias?.find((m) => m.nome === "Bola de Fogo")?.descricao).toContain(
      "Tempo de conjuração",
    );
    // Monstro inexistente e nome repetido dão erro claro.
    const falta = await rodar(sala, "fichas", { fichas: [{ nome: "X", monstro: "Tarrasque" }] });
    expect(falta.texto).toMatch(/Não achei "Tarrasque"/);
    const igual = await rodar(sala, "fichas", {
      fichas: [{ nome: "Goblin 1", monstro: "Goblin" }],
    });
    expect(igual.texto).toMatch(/Já existe uma ficha/);
    // O jogador não cria NPC.
    const ana = new SalaSimulada(ANA);
    const negado = await rodar(ana, "fichas", { fichas: [{ nome: "Lobo", monstro: "Lobo" }] });
    expect(negado.texto).toMatch(/Só o mestre cria NPCs/);
  });
});

describe("o panorama mostra só o que o usuário vê", () => {
  it("o jogador não vê automações nem rascunhos; o mestre sim", async () => {
    const sala = new SalaSimulada(MESTRE);
    await rodar(sala, "fichas", { fichas: [{ nome: "Goblin", pv: { max: 7 } }] });
    const m = await rodar(sala, "panorama", {});
    expect(m.texto).toContain("Você é Mestre (mestre)");
    expect(m.texto).toContain("Rascunhos do Claude: 1");
    expect(m.texto).toContain("Automações:");
    const ana = new SalaSimulada(ANA, sala.verdade);
    const a = await rodar(ana, "panorama", {});
    expect(a.texto).toContain("Você é Ana (jogador)");
    expect(a.texto).not.toContain("Automações:");
    expect(a.texto).not.toContain("Rascunhos");
    expect(a.texto).not.toContain("Goblin");
    expect(a.texto).toContain("de 20 fichas");
  });
});

describe("as definições que a IA recebe", () => {
  it("todas têm nome, descrição com exemplo e um esquema de entrada em JSON", () => {
    for (const f of TODAS_AS_FERRAMENTAS) {
      const d = definicaoDaFerramenta(f);
      expect(d.name).toBe(f.nome);
      expect(d.inputSchema.type, f.nome).toBe("object");
      expect(d.description.length, f.nome).toBeGreaterThan(40);
      expect(d.description.length, f.nome).toBeLessThan(1600);
      expect(JSON.stringify(d.inputSchema).length, f.nome).toBeLessThan(40_000);
    }
  });

  it("não há ferramenta genérica de mandar qualquer intenção", () => {
    const nomesDeTodas = TODAS_AS_FERRAMENTAS.map((f) => f.nome);
    expect(nomesDeTodas).toHaveLength(18);
    for (const f of TODAS_AS_FERRAMENTAS) {
      const campos = JSON.stringify(definicaoDaFerramenta(f).inputSchema);
      expect(campos, f.nome).not.toMatch(/"(intencao|tipo_da_intencao|dados_crus)"/);
    }
  });
});
