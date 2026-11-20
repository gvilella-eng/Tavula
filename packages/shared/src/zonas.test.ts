import { describe, expect, it } from "vitest";
import {
  AutomacoesSchema,
  criarExportacao,
  type Estado,
  type EventoSala,
  entradasESaidas,
  estadoInicial,
  eventoPara,
  eventosDoSistema,
  fonteComSemente,
  type Intencao,
  IntencaoSchema,
  lerExportacao,
  modelosPadrao,
  type ObjetoDeLuz,
  objetoNaZona,
  pontoNaZona,
  processar,
  processarEvento,
  processarSistema,
  ReacaoSchema,
  raiosEfetivos,
  reagirAoSistema,
  visaoPara,
  type Zona,
  ZonaSchema,
} from "./index.ts";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();
const MESTRE = { id: "m", papel: "mestre" as const };
const J1 = { id: "j1", papel: "jogador" as const };
const SEGREDO = "ZONA-SECRETA-DO-MESTRE";

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `p${++contador}`, tipo, dados });

const QUADRADO = [
  { x: 10, y: 10 },
  { x: 20, y: 10 },
  { x: 20, y: 20 },
  { x: 10, y: 20 },
];

const zona = (parcial: Partial<Zona> = {}): Zona =>
  ZonaSchema.parse({
    id: "z1",
    cenaId: "pulmao",
    nome: SEGREDO,
    pontos: QUADRADO,
    efeitos: { luzRaioX: 0.5, visaoMaxM: 3 },
    ...parcial,
  });

const tocha = (id: string, extra: Partial<ObjetoDeLuz> = {}): ObjetoDeLuz => ({
  id,
  cenaId: "pulmao",
  nome: id,
  modeloId: "modelo-tocha",
  portador: { tipo: "token", tokenId: "t1" },
  luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: false },
  intensidade: 1,
  estado: "acesa",
  saldoMs: 1_800_000,
  acesaDesdeSala: 0,
  duracaoMs: 1_800_000,
  modificadores: [],
  historico: [],
  ...extra,
});

const token = (id: string, x: number, y: number, cenaId = "pulmao") => ({
  id,
  cenaId,
  nome: id,
  cor: "#0f0",
  tamanhoQuadrados: 1,
  x,
  y,
  camada: "tokens" as const,
  oculto: false,
  controladoPor: id === "t1" ? ["j1"] : [],
});

function criarEstado(extra: Partial<Estado> = {}): Estado {
  return {
    ...estadoInicial(
      {
        usuarios: [
          { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
          { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
        ],
        cenas: [
          {
            id: "pulmao",
            nome: "Pulmão",
            larguraM: 40,
            alturaM: 40,
            grid: { quadradoM: 1.5, visivel: true },
          },
          {
            id: "fora",
            nome: "Fora",
            larguraM: 40,
            alturaM: 40,
            grid: { quadradoM: 1.5, visivel: true },
          },
        ],
        cenaAtivaId: "pulmao",
        modelos: modelosPadrao(),
        luzes: [tocha("o1")],
        tokens: [token("t1", 5, 5), token("t2", 5, 5)],
      },
      T0,
    ),
    ...extra,
  };
}

const reacao = (r: object) => ReacaoSchema.parse(r);
/** Manda um sinal pelo nome (o que o "evento manual" fazia): roda as automações que o escutam. */
const emitir = (e: Estado, nome: string, cenaId?: string) => {
  const r = processarEvento(
    e,
    { nome, cenas: cenaId === undefined ? null : [cenaId], origem: "manual" },
    fonteComSemente(1),
  );
  // e a passada seguinte da sala, que põe os efeitos das zonas em dia
  const depois = processarSistema(r.estado, iso(0), [], fonteComSemente(1));
  return { estado: depois.ok ? depois.estado : r.estado };
};
const comZona = (e: Estado, z: Zona = zona(), automacoes?: Record<string, unknown>): Estado => ({
  ...e,
  zonas: [...(e.zonas ?? []), z],
  ...(automacoes ? { automacoes: AutomacoesSchema.parse(automacoes) } : {}),
});

function ok(estado: Estado, quem: string, i: Intencao, segundos = 0) {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
const mover = (e: Estado, id: string, x: number, y: number, seg = 0) =>
  ok(e, "m", intencao("token.soltar", { id, x, y }), seg);
const anuncios = (e: Estado) =>
  (e.chat ?? []).filter((m) => m.tipo === "aviso").map((m) => m.texto);
const objeto = (e: Estado, id: string) => e.luzes.find((l) => l.id === id) as ObjetoDeLuz;
const efeitoDe = (e: Estado, tokenId: string) =>
  (e.efeitos ?? []).find((x) => x.alvo.id === tokenId && x.efeito.visaoMaxM !== undefined);
const modZona = (e: Estado, id: string) =>
  objeto(e, id).modificadores.filter((m) => m.id.startsWith("zona:"));

describe("ponto dentro do polígono", () => {
  it("dentro, fora, na borda e no vértice", () => {
    expect(pontoNaZona({ x: 15, y: 15 }, QUADRADO)).toBe(true);
    expect(pontoNaZona({ x: 25, y: 15 }, QUADRADO)).toBe(false);
    expect(pontoNaZona({ x: 9.99, y: 15 }, QUADRADO)).toBe(false);
    expect(pontoNaZona({ x: 10, y: 15 }, QUADRADO)).toBe(true); // borda esquerda
    expect(pontoNaZona({ x: 20, y: 15 }, QUADRADO)).toBe(true); // borda direita
    expect(pontoNaZona({ x: 15, y: 10 }, QUADRADO)).toBe(true); // borda de cima
    expect(pontoNaZona({ x: 20, y: 20 }, QUADRADO)).toBe(true); // vértice
  });

  it("polígono côncavo (um U): o vão não conta, os braços contam", () => {
    const u = [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 9 },
      { x: 6, y: 9 },
      { x: 6, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 9 },
      { x: 0, y: 9 },
    ];
    expect(pontoNaZona({ x: 1, y: 8 }, u)).toBe(true); // braço esquerdo
    expect(pontoNaZona({ x: 8, y: 8 }, u)).toBe(true); // braço direito
    expect(pontoNaZona({ x: 4.5, y: 1 }, u)).toBe(true); // fundo do U
    expect(pontoNaZona({ x: 4.5, y: 6 }, u)).toBe(false); // dentro do vão
    expect(pontoNaZona({ x: 3, y: 6 }, u)).toBe(true); // na borda do vão
  });

  it("a zona precisa de 3 a 64 pontos", () => {
    expect(ZonaSchema.safeParse({ ...zona(), pontos: QUADRADO.slice(0, 2) }).success).toBe(false);
    const muitos = Array.from({ length: 65 }, (_, i) => ({ x: i, y: i % 2 }));
    expect(ZonaSchema.safeParse({ ...zona(), pontos: muitos }).success).toBe(false);
    expect(zona().ativa).toBe(true);
  });

  it("a luz na mão acompanha o token; a luz num ponto conta a posição do ponto", () => {
    const e = comZona(
      criarEstado({ pontos: [{ id: "pt", cenaId: "pulmao", x: 15, y: 15 } as never] }),
    );
    const z = (e.zonas as Zona[])[0] as Zona;
    const presa = tocha("p1");
    expect(objetoNaZona(presa, z, e)).toBe(false); // t1 está fora
    const noPonto = tocha("p2", { portador: { tipo: "ponto", pontoId: "pt" } });
    expect(objetoNaZona(noPonto, z, e)).toBe(true);
    const dentro = {
      ...e,
      tokens: e.tokens.map((t) => (t.id === "t1" ? { ...t, x: 12, y: 12 } : t)),
    };
    expect(objetoNaZona(presa, z, dentro)).toBe(true);
    expect(objetoNaZona(presa, { ...z, ativa: false }, dentro)).toBe(false);
  });
});

describe("entrar e sair geram os eventos uma vez só", () => {
  const reacoes = [
    reacao({
      id: "rz-entra",
      fica: { tipo: "zona", id: "z1" },
      ao: "token.entrouNaZona",
      fazer: [{ acao: "chat.anunciar", texto: "entrou" }],
    }),
    reacao({
      id: "rz-sai",
      fica: { tipo: "zona", id: "z1" },
      ao: "token.saiuDaZona",
      fazer: [{ acao: "chat.anunciar", texto: "saiu" }],
    }),
  ];
  const base = () => comZona(criarEstado(), zona({ efeitos: {} }), { reacoes });

  it("soltar dentro entra uma vez; mexer dentro não repete; soltar fora sai uma vez", () => {
    let e = base();
    e = mover(e, "t1", 15, 15).estado;
    expect(anuncios(e)).toEqual(["entrou"]);
    e = mover(e, "t1", 16, 16).estado;
    e = mover(e, "t1", 12, 18).estado;
    expect(anuncios(e)).toEqual(["entrou"]);
    e = mover(e, "t1", 30, 30).estado;
    expect(anuncios(e)).toEqual(["entrou", "saiu"]);
    e = mover(e, "t1", 31, 31).estado;
    expect(anuncios(e)).toEqual(["entrou", "saiu"]);
  });

  it("o evento leva a zona e o token; os dois tokens contam cada um", () => {
    const antes = base();
    const depois = {
      ...antes,
      tokens: antes.tokens.map((t) => ({ ...t, x: 15, y: 15 })),
    };
    const eventos = eventosDoSistema(antes, depois).filter((x) => x.nome.startsWith("token."));
    expect(eventos.map((x) => [x.nome, x.tokenId, x.zonaId])).toEqual([
      ["token.entrouNaZona", "t1", "z1"],
      ["token.entrouNaZona", "t2", "z1"],
    ]);
  });

  it("colocar o token dentro entra; apagar o token dentro sai; trocar de cena sai", () => {
    const antes = base();
    const com = {
      ...antes,
      tokens: [...antes.tokens, token("t3", 15, 15)],
    };
    expect(entradasESaidas(antes, com).entrou.map((x) => x.tokenId)).toEqual(["t3"]);
    expect(entradasESaidas(com, antes).saiu.map((x) => x.tokenId)).toEqual(["t3"]);
    const naZona = {
      ...antes,
      tokens: antes.tokens.map((t) => (t.id === "t1" ? { ...t, x: 15, y: 15 } : t)),
    };
    const outraCena = {
      ...naZona,
      tokens: naZona.tokens.map((t) => (t.id === "t1" ? { ...t, cenaId: "fora" } : t)),
    };
    expect(entradasESaidas(naZona, outraCena).saiu.map((x) => x.tokenId)).toEqual(["t1"]);
    expect(entradasESaidas(outraCena, naZona).entrou.map((x) => x.tokenId)).toEqual(["t1"]);
  });

  it("ligar, desligar, criar e apagar a zona não é entrar nem sair", () => {
    const naZona = (e: Estado) => ({
      ...e,
      tokens: e.tokens.map((t) => (t.id === "t1" ? { ...t, x: 15, y: 15 } : t)),
    });
    const ligada = naZona(base());
    const desligada = { ...ligada, zonas: [zona({ ativa: false, efeitos: {} })] };
    const e1 = entradasESaidas(ligada, desligada);
    expect(e1.entrou.length + e1.saiu.length).toBe(0);
    const sem = { ...ligada, zonas: [] };
    const e2 = entradasESaidas(sem, ligada);
    expect(e2.entrou.length + e2.saiu.length).toBe(0);
  });

  it("a reação de uma zona não responde ao evento de outra", () => {
    const outra = zona({
      id: "z2",
      nome: "outra",
      efeitos: {},
      pontos: QUADRADO.map((p) => ({ x: p.x + 15, y: p.y })),
    });
    let e = comZona(base(), outra);
    e = mover(e, "t1", 15, 15).estado;
    expect(anuncios(e)).toEqual(["entrou"]);
    e = mover(e, "t1", 30, 15).estado; // sai da z1 e entra na z2 (sem reação)
    expect(anuncios(e)).toEqual(["entrou", "saiu"]);
  });
});

describe("o efeito enquanto dentro entra, sai e nunca fica preso", () => {
  const luzDe = (e: Estado) =>
    raiosEfetivos(visaoPara(e, MESTRE, T0).luzes.find((l) => l.id === "o1") as ObjetoDeLuz, 1);

  it("entrar põe a luz menor e a visão limitada; sair devolve", () => {
    let e = comZona(criarEstado());
    expect(modZona(e, "o1")).toHaveLength(0);
    e = mover(e, "t1", 15, 15).estado;
    expect(modZona(e, "o1")).toHaveLength(1);
    expect(luzDe(e).claraM).toBe(3);
    expect(efeitoDe(e, "t1")?.efeito.visaoMaxM).toBe(3);
    expect(efeitoDe(e, "t1")?.ateSala).toBeUndefined();
    expect(efeitoDe(e, "t2")).toBeUndefined();
    e = mover(e, "t1", 30, 30).estado;
    expect(modZona(e, "o1")).toHaveLength(0);
    expect(luzDe(e).claraM).toBe(6);
    expect(efeitoDe(e, "t1")).toBeUndefined();
    // rodar de novo não muda nada
    const r = mover(e, "t1", 31, 31);
    expect(r.eventos.map((x) => x.tipo)).not.toContain("efeitos.alterados");
    expect(r.eventos.map((x) => x.tipo)).not.toContain("fonte.editada");
  });

  it("o efeito de soma em metros também entra e sai", () => {
    let e = comZona(criarEstado(), zona({ efeitos: { luzSomaM: -2 } }));
    e = mover(e, "t1", 15, 15).estado;
    expect(luzDe(e).claraM).toBe(4);
    e = mover(e, "t1", 30, 30).estado;
    expect(luzDe(e).claraM).toBe(6);
  });

  it("desligar a zona, ou apagá-la, tira o efeito; ligar de novo o devolve", () => {
    let e = comZona(criarEstado());
    e = mover(e, "t1", 15, 15).estado;
    e = ok(e, "m", intencao("zona.editar", { id: "z1", mudancas: { ativa: false } })).estado;
    expect(modZona(e, "o1")).toHaveLength(0);
    expect(efeitoDe(e, "t1")).toBeUndefined();
    e = ok(e, "m", intencao("zona.editar", { id: "z1", mudancas: { ativa: true } })).estado;
    expect(modZona(e, "o1")).toHaveLength(1);
    expect(efeitoDe(e, "t1")).toBeDefined();
    e = ok(e, "m", intencao("zona.apagar", { id: "z1" })).estado;
    expect(e.zonas ?? []).toHaveLength(0);
    expect(modZona(e, "o1")).toHaveLength(0);
    expect(luzDe(e).claraM).toBe(6);
    expect(efeitoDe(e, "t1")).toBeUndefined();
  });

  it("mudar o efeito ou o desenho da zona com alguém dentro atualiza na hora", () => {
    let e = comZona(criarEstado());
    e = mover(e, "t1", 15, 15).estado;
    e = ok(
      e,
      "m",
      intencao("zona.editar", { id: "z1", mudancas: { efeitos: { luzRaioX: 0.25 } } }),
    ).estado;
    expect(luzDe(e).claraM).toBe(1.5);
    expect(efeitoDe(e, "t1")).toBeUndefined(); // a visão saiu dos efeitos
    // encolher o polígono para longe do token tira tudo
    e = ok(
      e,
      "m",
      intencao("zona.editar", {
        id: "z1",
        mudancas: {
          pontos: [
            { x: 30, y: 30 },
            { x: 35, y: 30 },
            { x: 35, y: 35 },
          ],
        },
      }),
    ).estado;
    expect(modZona(e, "o1")).toHaveLength(0);
  });

  it("a tocha guardada na mochila não fica presa; a que volta à zona a recebe", () => {
    let e = comZona(criarEstado());
    e = mover(e, "t1", 15, 15).estado;
    expect(modZona(e, "o1")).toHaveLength(1);
    // o objeto vai para a mochila: sem posição, sem efeito (simulado pelo estado)
    const guardado = {
      ...e,
      luzes: e.luzes.map(
        (l) => ({ ...l, portador: { tipo: "mochila", personagemId: "x" } }) as ObjetoDeLuz,
      ),
    };
    const ctxEventos: EventoSala[] = [];
    let proximo = guardado;
    reagirAoSistema(
      {
        agoraMs: T0,
        aleatorio: fonteComSemente(1),
        atual: () => proximo,
        emitir: (ev) => {
          const completo = {
            ...ev,
            seq: proximo.seq + 1,
            origem: { usuarioId: "s", idPedido: "x" },
          } as EventoSala;
          ctxEventos.push(completo);
          // reduzir indireto: aplica o que importa para o teste
          if (completo.tipo === "fonte.editada") {
            proximo = {
              ...proximo,
              seq: completo.seq,
              luzes: proximo.luzes.map((l) =>
                l.id === completo.dados.fonte.id ? completo.dados.fonte : l,
              ),
            };
          } else proximo = { ...proximo, seq: completo.seq };
        },
      },
      e,
    );
    expect(modZona(proximo, "o1")).toHaveLength(0);
  });

  it("cena-cartão não aplica o limite de visão (a luz continua)", () => {
    const base = criarEstado();
    const cartao = {
      ...base,
      cenas: base.cenas.map((c) => (c.id === "pulmao" ? { ...c, cartao: true } : c)),
    };
    let e = comZona(cartao);
    e = mover(e, "t1", 15, 15).estado;
    expect(efeitoDe(e, "t1")).toBeUndefined();
    expect(modZona(e, "o1")).toHaveLength(1);
  });

  it("apagar a cena da zona leva a zona, as automações dela e o efeito", () => {
    // a zona fica na cena "fora"; o token e a luz também; a cena ativa é "pulmao"
    const base = criarEstado();
    let e: Estado = {
      ...base,
      tokens: base.tokens.map((t) => (t.id === "t1" ? { ...t, cenaId: "fora", x: 15, y: 15 } : t)),
      luzes: base.luzes.map((l) => ({ ...l, cenaId: "fora" })),
    };
    e = comZona(e, zona({ cenaId: "fora" }), {
      reacoes: [
        reacao({
          id: "rz",
          fica: { tipo: "zona", id: "z1" },
          ao: "token.entrouNaZona",
          fazer: [{ acao: "chat.anunciar", texto: "oi" }],
        }),
      ],
    });
    e = ok(e, "m", intencao("zona.editar", { id: "z1", mudancas: { nome: "z" } })).estado;
    expect(modZona(e, "o1")).toHaveLength(1);
    e = ok(e, "m", intencao("cena.apagar", { cenaId: "fora" })).estado;
    expect(e.zonas ?? []).toHaveLength(0);
    expect(e.automacoes?.fluxos ?? []).toHaveLength(0);
    expect(efeitoDe(e, "t1")).toBeUndefined();
  });
});

describe("zona.ativar e dentroDaZona", () => {
  it("zona.ativar liga e desliga a zona de uma reação qualquer", () => {
    const reacoes = [
      reacao({
        id: "apaga",
        fica: { tipo: "mesa" },
        ao: "ventilar",
        fazer: [{ acao: "zona.ativar", zona: "z1", ativa: false }],
      }),
      reacao({
        id: "liga",
        fica: { tipo: "mesa" },
        ao: "fechar",
        fazer: [{ acao: "zona.ativar", zona: "z1", ativa: true }],
      }),
    ];
    let e = comZona(criarEstado(), zona(), { reacoes });
    e = mover(e, "t1", 15, 15).estado;
    expect(modZona(e, "o1")).toHaveLength(1);
    e = emitir(e, "ventilar").estado;
    expect(e.zonas?.[0]?.ativa).toBe(false);
    expect(modZona(e, "o1")).toHaveLength(0);
    expect(efeitoDe(e, "t1")).toBeUndefined();
    e = emitir(e, "fechar").estado;
    expect(e.zonas?.[0]?.ativa).toBe(true);
    expect(modZona(e, "o1")).toHaveLength(1);
  });

  it("a reação de uma zona liga a outra (encadeia sem se perder)", () => {
    const outra = zona({
      id: "z2",
      nome: "outra",
      efeitos: {},
      ativa: false,
      pontos: QUADRADO.map((p) => ({ x: p.x + 15, y: p.y })),
    });
    const reacoes = [
      reacao({
        id: "rz",
        fica: { tipo: "zona", id: "z1" },
        ao: "token.entrouNaZona",
        fazer: [{ acao: "zona.ativar", zona: "z2", ativa: true }],
      }),
    ];
    let e = comZona(comZona(criarEstado()), outra, reacoes ? { reacoes } : undefined);
    e = mover(e, "t1", 15, 15).estado;
    expect(e.zonas?.find((z) => z.id === "z2")?.ativa).toBe(true);
  });

  it("dentroDaZona deixa a reação valer só para o que está dentro", () => {
    const e0 = comZona(
      criarEstado({
        luzes: [
          tocha("dentro", { portador: { tipo: "cena", x: 15, y: 15 } }),
          tocha("fora", { portador: { tipo: "cena", x: 30, y: 30 } }),
        ],
      }),
      zona({ efeitos: {} }),
      {
        reacoes: [
          reacao({
            id: "r",
            fica: { tipo: "modelo", id: "modelo-tocha" },
            ao: "sopro",
            se: [{ condicao: "dentroDaZona", zona: "z1" }],
            fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 60 }],
          }),
        ],
      },
    );
    const e = emitir(e0, "sopro").estado;
    expect(objeto(e, "dentro").modificadores).toHaveLength(1);
    expect(objeto(e, "fora").modificadores).toHaveLength(0);
  });

  it("dentroDaZona num token: o do evento; sem zona, vale a da própria reação", () => {
    const reacoes = [
      reacao({
        id: "r",
        fica: { tipo: "zona", id: "z1" },
        ao: "token.entrouNaZona",
        se: [{ condicao: "dentroDaZona" }],
        fazer: [{ acao: "visao.limitar", alcanceM: 2, porS: 60 }],
      }),
    ];
    let e = comZona(criarEstado(), zona({ efeitos: {} }), { reacoes });
    e = mover(e, "t1", 15, 15).estado;
    expect(efeitoDe(e, "t1")?.efeito.visaoMaxM).toBe(2);
    expect(efeitoDe(e, "t2")).toBeUndefined(); // só o token que entrou
  });

  it("zona desligada ou inexistente nunca passa na condição", () => {
    const reacoes = [
      reacao({
        id: "r",
        fica: { tipo: "mesa" },
        ao: "x",
        se: [{ condicao: "dentroDaZona", zona: "z1" }],
        fazer: [{ acao: "chat.anunciar", texto: "passou" }],
      }),
    ];
    const e0 = {
      ...criarEstado({ luzes: [] }),
      tokens: [token("t1", 15, 15)],
    };
    const desligada = comZona(e0, zona({ ativa: false, efeitos: {} }), { reacoes });
    const e1 = emitir(desligada, "x", "pulmao");
    expect(anuncios(e1.estado)).toEqual([]);
  });
});

describe("as intenções da zona", () => {
  it("criar, editar e apagar; o jogador não pode; cena e id conferidos", () => {
    let e = criarEstado();
    const nova = { id: "zn", cenaId: "pulmao", nome: "Nova", pontos: QUADRADO };
    expect(
      processar(e, "j1", intencao("zona.criar", { zona: nova }), iso(0), fonteComSemente(1)).ok,
    ).toBe(false);
    const semCena = processar(
      e,
      "m",
      intencao("zona.criar", { zona: { ...nova, cenaId: "nada" } }),
      iso(0),
    );
    expect(semCena.ok).toBe(false);
    e = ok(e, "m", intencao("zona.criar", { zona: nova })).estado;
    expect(e.zonas?.[0]).toMatchObject({ id: "zn", ativa: true, efeitos: {} });
    expect(processar(e, "m", intencao("zona.criar", { zona: nova }), iso(0)).ok).toBe(false);
    e = ok(e, "m", intencao("zona.editar", { id: "zn", mudancas: { nome: "Outra" } })).estado;
    expect(e.zonas?.[0]?.nome).toBe("Outra");
    const inexistente = processar(e, "m", intencao("zona.apagar", { id: "nada" }), iso(0));
    expect(inexistente.ok).toBe(false);
    e = ok(e, "m", intencao("zona.apagar", { id: "zn" })).estado;
    expect(e.zonas).toBeUndefined();
    // o Desfazer recria a mesma zona com o mesmo id
    e = ok(e, "m", intencao("zona.criar", { zona: nova })).estado;
    expect(e.zonas).toHaveLength(1);
  });

  it("a automação de zona precisa de uma zona que existe", () => {
    const e = criarEstado();
    const r = processar(
      e,
      "m",
      intencao("fluxo.criar", {
        fluxo: {
          id: "r",
          nome: "r",
          gatilho: { tipo: "zona", quando: "entra", zona: "nada" },
          trilhas: [[{ bloco: "acao", acao: { acao: "chat.anunciar", texto: "a" } }]],
        },
      }),
      iso(0),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.mensagem).toContain("zona não existe");
  });

  it("duplicar a cena leva as zonas (e as automações delas)", () => {
    let e = comZona(criarEstado(), zona(), {
      reacoes: [
        reacao({
          id: "rz",
          fica: { tipo: "zona", id: "z1" },
          ao: "token.entrouNaZona",
          fazer: [{ acao: "chat.anunciar", texto: "oi" }],
        }),
      ],
    });
    e = ok(e, "m", intencao("cena.duplicar", { cenaId: "pulmao", novoId: "copia" })).estado;
    const copia = e.zonas?.find((z) => z.cenaId === "copia");
    expect(copia).toBeDefined();
    expect(copia?.id).not.toBe("z1");
    expect(copia?.pontos).toEqual(QUADRADO);
    expect(e.zonas).toHaveLength(2);
    expect(e.automacoes?.fluxos.filter((f) => f.gatilho.tipo === "zona")).toHaveLength(2);
    expect(
      e.automacoes?.fluxos.some((f) => f.gatilho.tipo === "zona" && f.gatilho.zona === copia?.id),
    ).toBe(true);
  });
});

describe("o sigilo: nada da zona chega ao jogador", () => {
  const montar = () => {
    const frames: EventoSala[] = [];
    let e = comZona(criarEstado(), zona(), {
      reacoes: [
        reacao({
          id: "rz",
          nome: SEGREDO,
          fica: { tipo: "zona", id: "z1" },
          ao: "token.entrouNaZona",
          fazer: [{ acao: "chat.anunciar", texto: "so-mestre", para: "mestre" }],
        }),
      ],
    });
    const antes = e;
    const passos = [
      intencao("zona.criar", {
        zona: { id: "zz", cenaId: "pulmao", nome: SEGREDO, pontos: QUADRADO },
      }),
      intencao("zona.editar", {
        id: "zz",
        mudancas: { nome: `${SEGREDO}-2`, efeitos: { visaoMaxM: 2 } },
      }),
      intencao("token.soltar", { id: "t1", x: 15, y: 15 }),
      intencao("zona.apagar", { id: "zz" }),
      intencao("token.soltar", { id: "t1", x: 30, y: 30 }),
    ];
    for (const p of passos) {
      const r = ok(e, "m", p);
      frames.push(...r.eventos);
      e = r.estado;
    }
    return { e, frames, antes };
  };

  it("o snapshot do jogador não traz as zonas nem o nome delas", () => {
    let { e } = montar();
    e = mover(e, "t1", 15, 15).estado;
    expect(e.zonas?.length).toBeGreaterThan(0);
    const visto = visaoPara(e, J1, T0);
    expect(visto.zonas).toBeUndefined();
    const texto = JSON.stringify(visto);
    expect(texto).not.toContain(SEGREDO);
    expect(texto).not.toContain("zonas");
    expect(texto).not.toContain("zona:");
    expect(texto).not.toContain("z1");
    // ele vê só o resultado: a luz menor e a visão limitada
    expect(visto.efeitos?.[0]?.efeito.visaoMaxM).toBe(3);
    expect(visto.luzes.find((l) => l.id === "o1")?.fatorDeRaio).toBe(0.5);
    // o mestre vê a zona
    expect(visaoPara(e, MESTRE, T0).zonas?.length).toBeGreaterThan(0);
  });

  it("nenhum frame do jogador traz a zona, o nome ou as reações; chegam só a luz, a visão e o chat", () => {
    const { frames, antes } = montar();
    expect(frames.some((f) => f.tipo === "zona.alterada")).toBe(true);
    expect(frames.some((f) => f.tipo === "zona.apagada")).toBe(true);
    const recebidos: EventoSala[] = [];
    for (const f of frames) {
      const v = eventoPara(f, J1, antes, antes, T0);
      if (v) recebidos.push(v);
    }
    const texto = JSON.stringify(recebidos);
    expect(texto).not.toContain(SEGREDO);
    expect(texto).not.toContain("so-mestre");
    expect(texto).not.toContain("zona:");
    expect(texto).not.toContain("pontos");
    const tipos = recebidos.map((r) => r.tipo);
    expect(tipos).not.toContain("zona.alterada");
    expect(tipos).not.toContain("zona.apagada");
    expect(tipos).not.toContain("automacoes.alterado");
    expect(tipos).toContain("fonte.editada");
    expect(tipos).toContain("efeitos.alterados");
    // o mestre recebe tudo
    expect(frames.map((f) => eventoPara(f, MESTRE, antes, antes, T0)?.tipo)).toContain(
      "zona.alterada",
    );
  });
});

describe("exportar e importar levam as zonas", () => {
  it("a exportação traz as zonas e a importação as devolve com os efeitos", () => {
    let e = comZona(criarEstado());
    e = mover(e, "t1", 15, 15).estado;
    const exportado = criarExportacao(e, iso(0));
    expect(exportado.dados.zonas).toHaveLength(1);
    const lida = lerExportacao(JSON.parse(JSON.stringify(exportado)));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.dados.zonas?.[0]).toMatchObject({
      id: "z1",
      nome: SEGREDO,
      ativa: true,
    });
    expect(lida.exportacao.dados.zonas?.[0]?.pontos).toEqual(QUADRADO);
    // pela intenção: a sala fica com as zonas
    const vazio = criarEstado();
    const r = ok(
      vazio,
      "m",
      intencao("campanha.importar", { dados: JSON.parse(JSON.stringify(exportado)) }),
    );
    expect(r.estado.zonas).toHaveLength(1);
  });

  it("o arquivo antigo, sem zonas, carrega; zona numa cena desconhecida é recusada", () => {
    const exportado = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), iso(0))));
    expect(exportado.dados.zonas).toBeUndefined();
    expect(lerExportacao(exportado).ok).toBe(true);
    exportado.dados.zonas = [{ ...zona(), cenaId: "sumiu" }];
    expect(lerExportacao(exportado).ok).toBe(false);
    exportado.dados.zonas = [zona(), zona()];
    expect(lerExportacao(exportado).ok).toBe(false);
  });
});

describe("editar só um campo não zera os outros (automação e zona)", () => {
  it("fluxo.editar com só o nome mantém o ligado, as cenas e os blocos", () => {
    const r = reacao({
      id: "r1",
      ativa: false,
      fica: { tipo: "mesa" },
      ao: "x",
      se: [{ condicao: "chance", valor: 0.5 }],
      fazer: [{ acao: "chat.anunciar", texto: "oi" }],
    });
    let e = comZona(criarEstado(), zona(), {
      reacoes: [r],
      ciclos: [
        {
          id: "c1",
          nome: "Ciclo",
          periodoS: 60,
          cenas: ["pulmao"],
          fases: [{ emS: 0, evento: "a" }],
        },
      ],
    });
    e = ok(e, "m", intencao("fluxo.editar", { id: "rx-r1", mudancas: { nome: "Nova" } })).estado;
    expect(e.automacoes?.fluxos.find((f) => f.id === "rx-r1")).toMatchObject({
      nome: "Nova",
      ligado: false,
      trilhas: [[{ bloco: "sortear", chance: 0.5 }]],
    });
    e = ok(e, "m", intencao("fluxo.editar", { id: "c1", mudancas: { nome: "Outro" } })).estado;
    expect(e.automacoes?.fluxos.find((f) => f.id === "c1")).toMatchObject({
      nome: "Outro",
      cenas: ["pulmao"],
    });
  });

  it("zona.editar só com o nome mantém ligada e efeitos", () => {
    let e = comZona(criarEstado(), zona({ ativa: false }));
    e = ok(e, "m", intencao("zona.editar", { id: "z1", mudancas: { nome: "Outro" } })).estado;
    expect(e.zonas?.[0]).toMatchObject({
      nome: "Outro",
      ativa: false,
      efeitos: { luzRaioX: 0.5, visaoMaxM: 3 },
    });
  });
});
