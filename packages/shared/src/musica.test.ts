import { describe, expect, it } from "vitest";
import {
  anteriorMusica,
  criarExportacao,
  decorridoDaMusica,
  type Estado,
  type EventoSala,
  embaralhar,
  energiaDe,
  estadoInicial,
  etiquetasDaBiblioteca,
  etiquetasDoCaminho,
  eventoPara,
  type FaixaDeMusica,
  faixasDoFiltro,
  fonteComSemente,
  hashesUsados,
  type Intencao,
  IntencaoSchema,
  iniciarMusica,
  lerExportacao,
  localizar,
  type MusicaTocando,
  modelosPadrao,
  montarFila,
  musicaAgora,
  normalizarEtiquetas,
  passosDaFila,
  pausarMusica,
  processar,
  proximaMusica,
  retomarMusica,
  visaoPara,
  voltarMusica,
} from "./index.ts";
import type { QualquerFerramenta, Saida } from "./mcp/ferramentas/base.ts";
import { TODAS_AS_FERRAMENTAS } from "./mcp/ferramentas/index.ts";
import { SalaSimulada } from "./mcp/testes/salaSimulada.ts";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const iso = (segundos: number) => new Date(T0 + segundos * 1000).toISOString();
const hashDe = (n: number) => n.toString(16).padStart(64, "0");
const SEGREDO = "NOME-SECRETO-DA-MUSICA";

const faixa = (n: number, extra: Partial<FaixaDeMusica> = {}): FaixaDeMusica => ({
  hash: hashDe(n),
  nome: `Musica ${n}`,
  duracaoMs: 60_000,
  etiquetas: [],
  ...extra,
});

describe("MU1: etiquetas, pasta e filtro", () => {
  it("limpa as etiquetas: sem espaço sobrando, sem repetir (maiúscula não conta), no máximo 12", () => {
    expect(normalizarEtiquetas([" Combate ", "combate", "", "Em   Campo"])).toEqual([
      "Combate",
      "Em Campo",
    ]);
    expect(normalizarEtiquetas(Array.from({ length: 20 }, (_, i) => `e${i}`))).toHaveLength(12);
  });

  it("as subpastas viram etiquetas; arquivo solto na raiz fica sem etiqueta", () => {
    expect(etiquetasDoCaminho("Musicas/Combate/Chefe/x.mp3")).toEqual(["Combate", "Chefe"]);
    expect(etiquetasDoCaminho("Musicas\\Combate\\x.mp3")).toEqual(["Combate"]);
    expect(etiquetasDoCaminho("Musicas/x.mp3")).toEqual([]);
    expect(etiquetasDoCaminho("Combate/x.mp3", false)).toEqual(["Combate"]);
  });

  it("várias etiquetas: só as que têm todas; a energia só filtra (sem nota vale 3)", () => {
    const lista = [
      faixa(1, { etiquetas: ["Combate"], energia: 4 }),
      faixa(2, { etiquetas: ["Combate", "Chefe"], energia: 5 }),
      faixa(3, { etiquetas: ["Taverna"] }),
    ];
    expect(faixasDoFiltro(lista, { etiquetas: ["combate"] }).map((f) => f.hash)).toEqual([
      hashDe(1),
      hashDe(2),
    ]);
    expect(faixasDoFiltro(lista, { etiquetas: ["Combate", "Chefe"] })).toHaveLength(1);
    expect(faixasDoFiltro(lista, { etiquetas: [], energiaMin: 3, energiaMax: 4 })).toHaveLength(2);
    expect(energiaDe(lista[2] as FaixaDeMusica)).toBe(3);
    expect(etiquetasDaBiblioteca(lista)).toEqual([
      { nome: "Chefe", qtd: 1 },
      { nome: "Combate", qtd: 2 },
      { nome: "Taverna", qtd: 1 },
    ]);
  });
});

describe("MU1: aleatória sem repetir e crescente", () => {
  const dez = Array.from({ length: 10 }, (_, i) => faixa(i + 1));

  it("é como um baralho: cada passada toca todas uma vez, e a última nunca volta em seguida", () => {
    const fila = montarFila(dez, "aleatoria", 42);
    expect(new Set(fila.inicial.map((p) => p.hash)).size).toBe(10);
    const tocadas: string[] = [];
    for (const passo of passosDaFila({ ...fila, semente: 42 })) {
      tocadas.push(passo.peca.hash);
      if (tocadas.length === 100) break;
    }
    for (let k = 0; k < 10; k++) {
      expect(new Set(tocadas.slice(k * 10, k * 10 + 10)).size).toBe(10);
    }
    for (let i = 1; i < tocadas.length; i++) expect(tocadas[i]).not.toBe(tocadas[i - 1]);
  });

  it("a mesma semente dá a mesma sequência (todos os navegadores contam igual)", () => {
    const a = embaralhar([1, 2, 3, 4, 5, 6, 7, 8], 7);
    expect(embaralhar([1, 2, 3, 4, 5, 6, 7, 8], 7)).toEqual(a);
    expect(embaralhar([1, 2, 3, 4, 5, 6, 7, 8], 8)).not.toEqual(a);
  });

  it("uma música só toca em laço sem erro", () => {
    const fila = montarFila([faixa(1)], "aleatoria", 1);
    const m = { ...fila, semente: 1 };
    expect(localizar(m, 250_000)?.atual.peca.hash).toBe(hashDe(1));
  });

  it("crescente: da energia mais baixa para a mais alta e, no topo, fica só nas mais fortes", () => {
    const lista = [
      faixa(1, { energia: 1 }),
      faixa(2, { energia: 2 }),
      faixa(3, { energia: 2 }),
      faixa(4, { energia: 5 }),
      faixa(5, { energia: 5 }),
      faixa(6),
    ];
    const fila = montarFila(lista, "crescente", 9);
    const energias = fila.inicial.map((p) =>
      energiaDe(lista.find((f) => f.hash === p.hash) as FaixaDeMusica),
    );
    expect(energias).toEqual([...energias].sort((a, b) => a - b));
    expect(energias[0]).toBe(1);
    expect(energias[energias.length - 1]).toBe(5);
    expect(fila.ciclo.map((p) => p.hash).sort()).toEqual([hashDe(4), hashDe(5)]);
    // depois da primeira passada só tocam as duas mais fortes, sem repetir em seguida
    const depois: string[] = [];
    let n = 0;
    for (const passo of passosDaFila({ ...fila, semente: 9 })) {
      if (n++ < fila.inicial.length) continue;
      depois.push(passo.peca.hash);
      if (depois.length === 12) break;
    }
    expect(new Set(depois)).toEqual(new Set([hashDe(4), hashDe(5)]));
    for (let i = 1; i < depois.length; i++) expect(depois[i]).not.toBe(depois[i - 1]);
  });
});

describe("MU1: a posição pela fila e pelas durações", () => {
  const lista = [
    faixa(1, { duracaoMs: 10_000 }),
    faixa(2, { duracaoMs: 20_000 }),
    faixa(3, { duracaoMs: 30_000 }),
  ];
  const toca = (): MusicaTocando => {
    const m = iniciarMusica(
      { botaoNome: "X", ordem: "aleatoria", faixas: lista, volume: 0.5 },
      undefined,
      T0,
    );
    if (!m) throw new Error("sem música");
    return m;
  };

  it("acha a música e o ponto somando as durações (igual para todos)", () => {
    const m = toca();
    const [p1, p2] = m.inicial;
    expect(musicaAgora(m, T0)).toMatchObject({ peca: p1, pontoMs: 0 });
    expect(musicaAgora(m, T0 + (p1?.duracaoMs ?? 0) + 5_000)).toMatchObject({
      peca: p2,
      pontoMs: 5_000,
    });
    // dois navegadores com o mesmo relógio da sala veem a mesma coisa
    expect(musicaAgora(m, T0 + 100_000)).toEqual(musicaAgora({ ...m }, T0 + 100_000));
  });

  it("pausar guarda a posição e retomar continua dela", () => {
    const m = toca();
    const p = pausarMusica(m, T0 + 12_000);
    expect(p.tocando).toBe(false);
    expect(decorridoDaMusica(p, T0 + 999_999)).toBe(12_000);
    const r = retomarMusica(p, T0 + 50_000);
    expect(decorridoDaMusica(r, T0 + 53_000)).toBe(15_000);
  });

  it("próxima vai para o começo da seguinte; anterior recomeça a atual (depois de 3 s) ou volta uma", () => {
    const m = toca();
    const d0 = m.inicial[0]?.duracaoMs ?? 0;
    const n = proximaMusica(m, T0 + 2_000);
    expect(decorridoDaMusica(n, T0 + 2_000)).toBe(d0);
    const recomeca = anteriorMusica(n, T0 + 2_000 + 8_000);
    expect(decorridoDaMusica(recomeca, T0 + 10_000)).toBe(d0);
    const volta = anteriorMusica(n, T0 + 2_000 + 1_000);
    expect(decorridoDaMusica(volta, T0 + 3_000)).toBe(0);
    // pausada, "próxima" segue pausada
    const pp = proximaMusica(pausarMusica(m, T0 + 1_000), T0 + 1_000);
    expect(pp.tocando).toBe(false);
    expect(pp.pausadoEm).toBe(d0);
  });

  it("voltar retoma o botão de antes do ponto onde parou, e o que tocava vira o 'anterior'", () => {
    const a = toca();
    const b = iniciarMusica(
      { botaoNome: "Outro", ordem: "crescente", faixas: lista, volume: 0.5 },
      a,
      T0 + 40_000,
    );
    expect(b?.anterior).toMatchObject({ botaoNome: "X", decorridoMs: 40_000 });
    if (!b) return;
    const v = voltarMusica(b, T0 + 100_000);
    expect(v?.botaoNome).toBe("X");
    expect(decorridoDaMusica(v as MusicaTocando, T0 + 100_000)).toBe(40_000);
    expect(v?.anterior?.botaoNome).toBe("Outro");
    expect(voltarMusica(a, T0)).toBeNull();
  });
});

// ---- a sala ----------------------------------------------------------------------------------

let contador = 0;
const intencao = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `mu${++contador}`, tipo, dados });
const J1 = { id: "j1", papel: "jogador" as const };
const MESTRE = { id: "m", papel: "mestre" as const };

function criarEstado(): Estado {
  const base = estadoInicial(
    {
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
        { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      ],
      cenas: [
        {
          id: "c",
          nome: "C",
          larguraM: 40,
          alturaM: 40,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "c",
      modelos: modelosPadrao(),
    },
    T0,
  );
  return {
    ...base,
    assets: [1, 2, 3, 4].map((n) => ({
      hash: hashDe(n),
      tipo: "som" as const,
      mime: "audio/mpeg",
      bytes: 10,
      largura: 1,
      altura: 1,
      donoId: "m",
      nomeOriginal: `m${n}.mp3`,
      pedacos: ["e".repeat(64)],
    })),
  };
}

function ok(estado: Estado, quem: string, i: Intencao, segundos = 0) {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} (${r.erro.mensagem})`);
  return r;
}
const recusado = (estado: Estado, quem: string, i: Intencao, segundos = 0) => {
  const r = processar(estado, quem, i, iso(segundos), fonteComSemente(1));
  expect(r.ok).toBe(false);
  return r.ok ? null : r.erro.codigo;
};

function comBiblioteca(): Estado {
  const e = criarEstado();
  return ok(
    e,
    "m",
    intencao("musica.adicionar", {
      faixas: [
        { ...faixa(1, { nome: SEGREDO, energia: 4, etiquetas: ["Combate"] }) },
        { ...faixa(2, { energia: 5, etiquetas: ["Combate", "Chefe"] }) },
        { ...faixa(3, { etiquetas: ["Taverna"] }) },
      ],
    }),
  ).estado;
}

const botao = (extra: Record<string, unknown> = {}) => ({
  id: "b1",
  nome: "Combate",
  icone: "espadas",
  cor: "laranja",
  etiquetas: ["Combate"],
  energiaMin: 1,
  energiaMax: 5,
  ordem: "aleatoria",
  ...extra,
});

describe("MU1: a biblioteca e os botões na sala", () => {
  it("só quem controla o som mexe; o jogador é barrado em tudo", () => {
    const e = comBiblioteca();
    const tentativas: [Intencao["tipo"], object][] = [
      ["musica.adicionar", { faixas: [faixa(4)] }],
      ["musica.editarFaixas", { hashes: [hashDe(1)], energia: 2 }],
      ["musica.tirarFaixas", { hashes: [hashDe(1)] }],
      ["musica.botao", { botao: botao() }],
      ["musica.botaoApagar", { id: "b1" }],
      [
        "musica.tocar",
        { filtro: { etiquetas: [], energiaMin: 1, energiaMax: 5, ordem: "aleatoria" } },
      ],
      ["musica.controle", { acao: "pausar" }],
      ["musica.volume", { volume: 0.2 }],
    ];
    for (const [tipo, dados] of tentativas) {
      expect(recusado(e, "j1", intencao(tipo, dados)), tipo).toBe("sem_permissao");
    }
  });

  it("adicionar exige som registrado, não repete o arquivo (só ganha etiquetas) e a duração tem piso", () => {
    const e = comBiblioteca();
    expect(recusado(criarEstado(), "m", intencao("musica.adicionar", { faixas: [faixa(9)] }))).toBe(
      "asset_inexistente",
    );
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "musica.adicionar",
        dados: { faixas: [faixa(1, { duracaoMs: 10 })] },
      }).success,
    ).toBe(false);
    const de = ok(
      e,
      "m",
      intencao("musica.adicionar", { faixas: [faixa(3, { etiquetas: ["Cidade"] })] }),
    ).estado;
    expect(de.musica?.faixas).toHaveLength(3);
    expect(de.musica?.faixas.find((f) => f.hash === hashDe(3))?.etiquetas).toEqual([
      "Taverna",
      "Cidade",
    ]);
    expect(hashesUsados(de).has(hashDe(1))).toBe(true);
  });

  it("etiqueta e energia em lote (mais, menos, troca) e tirar da lista", () => {
    let e = comBiblioteca();
    e = ok(
      e,
      "m",
      intencao("musica.editarFaixas", {
        hashes: [hashDe(1), hashDe(3)],
        maisEtiquetas: ["Noite"],
        energia: 2,
      }),
    ).estado;
    expect(e.musica?.faixas.filter((f) => f.etiquetas.includes("Noite"))).toHaveLength(2);
    expect(e.musica?.faixas.find((f) => f.hash === hashDe(3))?.energia).toBe(2);
    e = ok(
      e,
      "m",
      intencao("musica.editarFaixas", {
        hashes: [hashDe(1)],
        menosEtiquetas: ["combate"],
        energia: null,
      }),
    ).estado;
    const um = e.musica?.faixas.find((f) => f.hash === hashDe(1));
    expect(um?.etiquetas).toEqual(["Noite"]);
    expect(um?.energia).toBeUndefined();
    e = ok(e, "m", intencao("musica.tirarFaixas", { hashes: [hashDe(1), hashDe(2)] })).estado;
    expect(e.musica?.faixas).toHaveLength(1);
    e = ok(e, "m", intencao("musica.tirarFaixas", { hashes: [hashDe(3)] })).estado;
    expect(e.musica).toBeUndefined();
  });

  it("botão: cria, troca, não aceita nome repetido nem energia invertida, e apaga", () => {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.botao", { botao: botao() })).estado;
    expect(e.musica?.botoes).toHaveLength(1);
    expect(recusado(e, "m", intencao("musica.botao", { botao: botao({ id: "b2" }) }))).toBe(
      "dados_invalidos",
    );
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "musica.botao",
        dados: { botao: botao({ energiaMin: 4, energiaMax: 2 }) },
      }).success,
    ).toBe(false);
    e = ok(e, "m", intencao("musica.botao", { botao: botao({ ordem: "crescente" }) })).estado;
    expect(e.musica?.botoes[0]?.ordem).toBe("crescente");
    e = ok(e, "m", intencao("musica.botaoApagar", { id: "b1" })).estado;
    expect(e.musica?.botoes).toEqual([]);
  });
});

describe("MU1: tocar, pausar, próxima e voltar na sala", () => {
  const filtroTodas = { etiquetas: [], energiaMin: 1, energiaMax: 5, ordem: "aleatoria" };

  it("toca um botão para todos; filtro sem música é recusado", () => {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.botao", { botao: botao() })).estado;
    expect(recusado(e, "m", intencao("musica.tocar", { botaoId: "nao-existe" }))).toBe(
      "dados_invalidos",
    );
    expect(
      recusado(
        e,
        "m",
        intencao("musica.tocar", { filtro: { ...filtroTodas, etiquetas: ["Zzz"] } }),
      ),
    ).toBe("dados_invalidos");
    const r = ok(e, "m", intencao("musica.tocar", { botaoId: "b1" }), 10);
    expect(r.estado.musicaTocando).toMatchObject({
      botaoId: "b1",
      botaoNome: "Combate",
      tocando: true,
      inicioMs: T0 + 10_000,
    });
    expect(r.estado.musicaTocando?.inicial).toHaveLength(2);
  });

  it("pausar, retomar, próxima, anterior e volume mexem só no que toca", () => {
    let e = comBiblioteca();
    expect(recusado(e, "m", intencao("musica.controle", { acao: "pausar" }))).toBe(
      "dados_invalidos",
    );
    e = ok(e, "m", intencao("musica.tocar", { filtro: filtroTodas }), 0).estado;
    e = ok(e, "m", intencao("musica.controle", { acao: "pausar" }), 20).estado;
    expect(e.musicaTocando).toMatchObject({ tocando: false, pausadoEm: 20_000 });
    e = ok(e, "m", intencao("musica.controle", { acao: "retomar" }), 100).estado;
    expect(decorridoDaMusica(e.musicaTocando as MusicaTocando, T0 + 105_000)).toBe(25_000);
    e = ok(e, "m", intencao("musica.controle", { acao: "proxima" }), 105).estado;
    expect(decorridoDaMusica(e.musicaTocando as MusicaTocando, T0 + 105_000)).toBe(60_000);
    e = ok(e, "m", intencao("musica.volume", { volume: 0.2 })).estado;
    expect(e.musicaTocando?.volume).toBe(0.2);
  });

  it("'Voltar' retoma o botão anterior do ponto onde parou", () => {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.botao", { botao: botao() })).estado;
    e = ok(
      e,
      "m",
      intencao("musica.botao", {
        botao: botao({ id: "b2", nome: "Taverna", etiquetas: ["Taverna"] }),
      }),
    ).estado;
    e = ok(e, "m", intencao("musica.tocar", { botaoId: "b1" }), 0).estado;
    e = ok(e, "m", intencao("musica.tocar", { botaoId: "b2" }), 45).estado;
    expect(e.musicaTocando?.botaoNome).toBe("Taverna");
    expect(e.musicaTocando?.anterior?.botaoNome).toBe("Combate");
    e = ok(e, "m", intencao("musica.controle", { acao: "voltar" }), 90).estado;
    expect(e.musicaTocando?.botaoNome).toBe("Combate");
    expect(decorridoDaMusica(e.musicaTocando as MusicaTocando, T0 + 90_000)).toBe(45_000);
    expect(e.musicaTocando?.anterior?.botaoNome).toBe("Taverna");
    // tocar o mesmo botão de novo não troca o "anterior"
    e = ok(e, "m", intencao("musica.tocar", { botaoId: "b1" }), 100).estado;
    expect(e.musicaTocando?.anterior?.botaoNome).toBe("Taverna");
  });

  it("parar tudo pausa a música; apagar o som tira da lista e para a música que o usa", () => {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.tocar", { filtro: filtroTodas }), 0).estado;
    e = ok(e, "m", intencao("som.pararTudo"), 30).estado;
    expect(e.musicaTocando).toMatchObject({ tocando: false, pausadoEm: 30_000 });
    e = ok(e, "m", intencao("som.apagar", { hash: hashDe(1) }), 31).estado;
    expect(e.musica?.faixas.some((f) => f.hash === hashDe(1))).toBe(false);
    expect(e.musicaTocando).toBeUndefined();
  });
});

describe("MU1: o que o jogador recebe", () => {
  function tocandoComAnterior(): Estado {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.botao", { botao: botao() })).estado;
    e = ok(e, "m", intencao("musica.tocar", { botaoId: "b1" }), 0).estado;
    return ok(
      e,
      "m",
      intencao("musica.tocar", {
        filtro: { etiquetas: ["Taverna"], energiaMin: 1, energiaMax: 5, ordem: "aleatoria" },
      }),
      5,
    ).estado;
  }

  it("a visão do jogador traz o que toca (sem o 'anterior') e nunca a biblioteca nem os botões", () => {
    const e = tocandoComAnterior();
    expect(e.musicaTocando?.anterior).toBeDefined();
    const visao = visaoPara(e, J1, T0 + 9_000);
    expect(visao.musica).toBeUndefined();
    expect(visao.musicaTocando?.botaoNome).toBe("Taverna");
    expect(visao.musicaTocando?.anterior).toBeUndefined();
    expect(visao.musicaTocando?.servidorMs).toBe(T0 + 9_000);
    const texto = JSON.stringify(visao);
    expect(texto).not.toContain(SEGREDO);
    expect(texto).not.toContain("Chefe");
    expect(visaoPara(e, MESTRE, T0).musica?.faixas).toHaveLength(3);
    expect(visaoPara(e, MESTRE, T0).musicaTocando?.anterior).toBeDefined();
  });

  it("os eventos: a biblioteca só vai ao mestre; o que toca vai a todos, sem o 'anterior' para o jogador", () => {
    const antes = comBiblioteca();
    const r = ok(
      antes,
      "m",
      intencao("musica.tocar", {
        filtro: { etiquetas: [], energiaMin: 1, energiaMax: 5, ordem: "aleatoria" },
      }),
      3,
    );
    const ev = r.eventos.find((x) => x.tipo === "musica.tocandoAlterado") as EventoSala;
    expect(eventoPara(ev, J1, antes, r.estado, T0 + 6_000)).toMatchObject({
      tipo: "musica.tocandoAlterado",
      dados: { musicaTocando: { servidorMs: T0 + 6_000 } },
    });
    const r2 = ok(r.estado, "m", intencao("musica.botao", { botao: botao() }), 4);
    const evBib = r2.eventos.find((x) => x.tipo === "musica.bibliotecaAlterada") as EventoSala;
    expect(eventoPara(evBib, J1, r.estado, r2.estado, T0)).toBeNull();
    expect(eventoPara(evBib, MESTRE, r.estado, r2.estado, T0)).not.toBeNull();
  });

  it("a exportação leva a biblioteca e os botões, e não leva o que toca; arquivo antigo abre sem música", () => {
    let e = comBiblioteca();
    e = ok(e, "m", intencao("musica.botao", { botao: botao() })).estado;
    e = ok(e, "m", intencao("musica.tocar", { botaoId: "b1" }), 0).estado;
    const texto = JSON.stringify(criarExportacao(e, iso(5)));
    expect(texto).toContain(SEGREDO);
    expect(texto).not.toContain("inicioMs");
    const lida = lerExportacao(JSON.parse(texto));
    expect(lida.ok && lida.exportacao.dados.musica?.botoes[0]?.nome).toBe("Combate");
    expect(
      lida.ok && (lida.exportacao.dados as { musicaTocando?: unknown }).musicaTocando,
    ).toBeUndefined();
    const antigo = JSON.parse(JSON.stringify(criarExportacao(criarEstado(), iso(5))));
    const semMusica = lerExportacao(antigo);
    expect(semMusica.ok && semMusica.exportacao.dados.musica).toBeUndefined();
  });
});

describe("MU1: o MCP na sala simulada", () => {
  async function rodar(sala: SalaSimulada, entrada: object): Promise<Saida> {
    const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === "musica") as QualquerFerramenta;
    const s = await f.executar(
      f.entrada.parse((entrada as { musica: object }).musica),
      sala.contexto(),
    );
    return typeof s === "string" ? { texto: s } : s;
  }
  function salaComMusicas(): SalaSimulada {
    const sala = new SalaSimulada("m");
    const com = comBiblioteca();
    sala.verdade = { ...sala.verdade, assets: com.assets, musica: com.musica } as Estado;
    return sala;
  }

  it("etiqueta, dá energia, cria botão, toca, pausa, vai para a próxima e volta (tudo por nome)", async () => {
    const sala = salaComMusicas();
    let r = await rodar(sala, {
      musica: {
        faixas: [{ musica: "Musica 2", maisEtiquetas: ["Emboscada"], energia: 3 }],
      },
    });
    expect(r.erro).toBeFalsy();
    const dois = sala.verdade.musica?.faixas.find((f) => f.hash === hashDe(2));
    expect(dois?.etiquetas).toContain("Emboscada");
    expect(dois?.energia).toBe(3);

    r = await rodar(sala, {
      musica: {
        botoes: [{ nome: "Luta", etiquetas: ["Combate"], ordem: "crescente", cor: "vermelho" }],
      },
    });
    expect(r.erro).toBeFalsy();
    expect(r.texto).toContain("crescente");
    expect(sala.verdade.musica?.botoes[0]).toMatchObject({ nome: "Luta", ordem: "crescente" });
    // editar pelo nome não cria outro
    await rodar(sala, { musica: { botoes: [{ nome: "luta", energiaMin: 2 }] } });
    expect(sala.verdade.musica?.botoes).toHaveLength(1);
    expect(sala.verdade.musica?.botoes[0]?.energiaMin).toBe(2);

    await rodar(sala, { musica: { tocar: { botao: "Luta" } } });
    expect(sala.verdade.musicaTocando?.botaoNome).toBe("Luta");
    await rodar(sala, { musica: { tocar: { etiquetas: ["Taverna"] } } });
    expect(sala.verdade.musicaTocando?.anterior?.botaoNome).toBe("Luta");
    await rodar(sala, { musica: { controle: "pausar" } });
    expect(sala.verdade.musicaTocando?.tocando).toBe(false);
    await rodar(sala, { musica: { controle: "retomar" } });
    await rodar(sala, { musica: { controle: "proxima", volume: 0.3 } });
    expect(sala.verdade.musicaTocando?.volume).toBe(0.3);
    await rodar(sala, { musica: { controle: "voltar" } });
    expect(sala.verdade.musicaTocando?.botaoNome).toBe("Luta");
    const lista = await rodar(sala, { musica: { listar: true } });
    expect(lista.texto).toContain("Luta");
    expect(lista.texto).toContain("Tocando");
    await rodar(sala, {
      musica: {
        botoes: [{ nome: "Luta", apagar: true }],
        faixas: [{ musica: "Musica 3", tirar: true }],
      },
    });
    expect(sala.verdade.musica?.botoes).toEqual([]);
    expect(sala.verdade.musica?.faixas).toHaveLength(2);
  });

  it("nome que não existe diz o que há, e o jogador não tem a ferramenta", async () => {
    const sala = salaComMusicas();
    const r = await rodar(sala, { musica: { faixas: [{ musica: "Nada", energia: 2 }] } });
    expect(r.erro).toBe(true);
    expect(r.texto).toContain("Existem");
    const f = TODAS_AS_FERRAMENTAS.find((x) => x.nome === "musica") as QualquerFerramenta;
    const jogador = sala.verdade.usuarios.find((u) => u.id === "j1");
    expect(jogador && f.visivel(sala.verdade, jogador)).toBe(false);
  });
});
