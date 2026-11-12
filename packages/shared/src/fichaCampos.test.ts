import { describe, expect, it } from "vitest";
import {
  type AssetMeta,
  aplicarOperacoes,
  assetVisivelPara,
  chatParaUsuario,
  criarArquivoDeFicha,
  criarExportacao,
  derivar,
  type Estado,
  espacosDaFicha,
  estadoInicial,
  FichaSchema,
  fonteComSemente,
  hashesUsados,
  type Intencao,
  IntencaoSchema,
  lerArquivoDeFicha,
  lerExportacao,
  type Mensagem,
  MensagemSchema,
  personagemParaUsuario,
  processar,
  VERSAO_DA_FICHA,
} from "./index.ts";

// V4a: os campos novos da ficha (os do PDF da Biblioteca Élfica), o arquivo da ficha v2, as imagens da
// ficha e o cartão `caracteristica` no chat.

const AGORA = "2026-01-01T00:00:00.000Z";
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

const USUARIOS = [
  { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
  { id: "j1", nome: "Jogador 1", papel: "jogador", cor: "#222" },
  { id: "j2", nome: "Jogador 2", papel: "jogador", cor: "#333" },
] as const;

function criarEstadoBase(): Estado {
  return estadoInicial({
    usuarios: USUARIOS,
    pastas: [{ id: "p", nome: "Pers", ordem: 0, visivel: { tipo: "todos" } }],
    personagens: [
      {
        id: "aldric",
        pastaId: "p",
        editores: { tipo: "jogadores", ids: ["j1"] },
        nome: "Aldric",
        tokenPadrao: { cor: "#fff", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        ficha: { pvAtual: 5, pvMax: 5 },
      },
    ],
  });
}

const metaDeImagem = (hash: string): Omit<AssetMeta, "donoId"> => ({
  hash,
  tipo: "retrato",
  mime: "image/webp",
  bytes: 100,
  largura: 64,
  altura: 64,
  nomeOriginal: "r.png",
  pedacos: ["c".repeat(64)],
});

let contador = 0;
const pedido = (tipo: Intencao["tipo"], dados: object = {}): Intencao =>
  IntencaoSchema.parse({ v: 1, id: `i${++contador}`, tipo, dados });

function criarEstado(assets: readonly Omit<AssetMeta, "donoId">[] = []): Estado {
  const base = criarEstadoBase();
  if (assets.length === 0) return base;
  const r = processar(
    base,
    "m",
    IntencaoSchema.parse({ v: 1, id: "reg", tipo: "asset.registrar", dados: { metas: assets } }),
    AGORA,
    fonteComSemente(1),
  );
  if (!r.ok) throw new Error(r.erro.mensagem);
  return r.estado;
}

const executar = (estado: Estado, quem: string, i: Intencao) =>
  processar(estado, quem, i, AGORA, fonteComSemente(1));

function erroDe(estado: Estado, quem: string, i: Intencao) {
  const r = executar(estado, quem, i);
  if (r.ok) throw new Error("devia recusar");
  return r.erro;
}

describe("campos da ficha de papel", () => {
  it("a ficha antiga (só PV) continua valendo e os campos novos ficam vazios", () => {
    const r = FichaSchema.safeParse({ pvAtual: 10, pvMax: 12 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.moedas).toBeUndefined();
      expect(r.data.historia).toBeUndefined();
      expect(r.data.outrasCaracteristicas).toBeUndefined();
    }
  });

  it("aceita os campos novos e recusa o que passa do limite", () => {
    const completa = {
      pvAtual: 1,
      pvMax: 1,
      xp: 300,
      inspiracao: true,
      outrasProficiencias: "Comum, Élfico",
      moedas: { pc: 1, pp: 2, pe: 3, po: 4, pl: 5 },
      personalidade: "Calado",
      ideais: "Paz",
      ligacoes: "Família",
      defeitos: "Medo",
      ataquesTexto: "Livre",
      idade: "120",
      altura: "1,80 m",
      peso: "70 kg",
      olhos: "Verdes",
      pele: "Clara",
      cabelos: "Pretos",
      aparenciaHash: H1,
      aparencia: "Alto",
      aliados: "Os Arqueiros",
      simboloNome: "Folha",
      simboloHash: H2,
      outrasCaracteristicas: [{ nome: "Talento", descricao: "Texto" }],
      historia: "Era uma vez",
      tesouro: "Um anel",
      classeConjurador: "Clérigo",
      espacosTotal: { "1": 4 },
    };
    expect(FichaSchema.safeParse(completa).success).toBe(true);
    expect(FichaSchema.safeParse({ ...completa, aparenciaHash: "xyz" }).success).toBe(false);
    expect(FichaSchema.safeParse({ ...completa, idade: "x".repeat(41) }).success).toBe(false);
    expect(FichaSchema.safeParse({ ...completa, moedas: { po: -1 } }).success).toBe(false);
    expect(FichaSchema.safeParse({ ...completa, historia: "h".repeat(20_001) }).success).toBe(
      false,
    );
  });

  it("grava pelas operações de caminho e a ficha antiga recebe os campos sem perder nada", () => {
    const r = aplicarOperacoes({ pvAtual: 3, pvMax: 9, raca: "Elfo" }, [
      { caminho: "moedas", valor: { po: 7 } },
      { caminho: "outrasCaracteristicas", valor: [{ nome: "Sorte", descricao: "" }] },
      { caminho: "historia", valor: "Nasceu na floresta" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ficha).toMatchObject({ raca: "Elfo", pvMax: 9, moedas: { po: 7 } });
      expect(r.ficha.outrasCaracteristicas?.[0]?.nome).toBe("Sorte");
    }
  });

  it("o total de espaços escrito vence a conta das classes, só nos níveis que ele cobre", () => {
    const base = { pvAtual: 1, pvMax: 1, classes: [{ classe: "Clérigo", nivel: 5 }] };
    // Clérigo 5: 4/3/2
    expect(espacosDaFicha(base).map((e) => e.total)).toEqual([4, 3, 2]);
    const com = { ...base, espacosTotal: { "1": 6 as number } };
    expect(espacosDaFicha(com).map((e) => e.total)).toEqual([6, 3, 2]);
    // sem classe de conjuração, o escrito cria o nível
    const sem = { pvAtual: 1, pvMax: 1, espacosTotal: { "2": 2 as number } };
    expect(espacosDaFicha(sem).map((e) => e.total)).toEqual([0, 2]);
    expect(derivar(com).espacos[0]?.total).toBe(6);
  });
});

describe("arquivo da ficha (versão 2)", () => {
  it("a versão nova é a 2 e o arquivo exportado a leva", () => {
    expect(VERSAO_DA_FICHA).toBe(2);
    const arquivo = criarArquivoDeFicha("Aldric", { pvAtual: 1, pvMax: 1, historia: "x" }, AGORA);
    expect(arquivo.versao).toBe(2);
    const lido = lerArquivoDeFicha(JSON.parse(JSON.stringify(arquivo)));
    expect(lido.ok).toBe(true);
  });

  it("o arquivo da versão 1 continua lendo, sem os campos novos", () => {
    const v1 = {
      formato: "tabletop-ficha",
      versao: 1,
      nome: "Velho",
      ficha: { pvAtual: 4, pvMax: 8, raca: "Anão" },
    };
    const lido = lerArquivoDeFicha(v1);
    expect(lido.ok).toBe(true);
    if (lido.ok) {
      expect(lido.arquivo.ficha.raca).toBe("Anão");
      expect(lido.arquivo.ficha.moedas).toBeUndefined();
    }
    expect(lerArquivoDeFicha({ ...v1, versao: 3 }).ok).toBe(false);
  });
});

describe("imagens da ficha (aparência e símbolo)", () => {
  const comImagem = (assets: Omit<AssetMeta, "donoId">[]) => {
    const e = criarEstado(assets);
    const r = executar(
      e,
      "j1",
      pedido("ficha.alterar", {
        personagemId: "aldric",
        operacoes: [{ caminho: "aparenciaHash", valor: H1 }],
      }),
    );
    return r;
  };

  it("recusa um hash que a mesa não conhece e aceita o que está registrado", () => {
    expect(comImagem([]).ok).toBe(false);
    expect(comImagem([metaDeImagem(H1)]).ok).toBe(true);
  });

  it("conta como asset usado (não vira lixo) e só quem vê a ficha baixa a imagem", () => {
    const base = criarEstado([metaDeImagem(H1)]);
    const aplicada = executar(
      base,
      "j1",
      pedido("ficha.alterar", {
        personagemId: "aldric",
        operacoes: [{ caminho: "aparenciaHash", valor: H1 }],
      }),
    );
    if (!aplicada.ok) throw new Error("recusado");
    const estado = aplicada.estado;
    expect(hashesUsados(estado).has(H1)).toBe(true);
    const j1 = { id: "j1", papel: "jogador" as const };
    const j2 = { id: "j2", papel: "jogador" as const };
    expect(assetVisivelPara(H1, estado, j1)).toBe(true);
    // j2 vê o item mas não a ficha (sem `ficha.verOutras`): a imagem da ficha não é dele
    expect(assetVisivelPara(H1, estado, j2)).toBe(false);
    const p = estado.personagens[0];
    if (!p) throw new Error("sem personagem");
    expect(personagemParaUsuario(p, j2, estado.permissoes).ficha).toBeUndefined();
  });

  it("a exportação da mesa leva a meta da imagem e recusa a ficha com imagem sem meta", () => {
    const aplicada = executar(
      criarEstado([metaDeImagem(H1)]),
      "j1",
      pedido("ficha.alterar", {
        personagemId: "aldric",
        operacoes: [{ caminho: "aparenciaHash", valor: H1 }],
      }),
    );
    if (!aplicada.ok) throw new Error("recusado");
    const x = JSON.parse(JSON.stringify(criarExportacao(aplicada.estado, AGORA)));
    expect(lerExportacao(x).ok).toBe(true);
    x.dados.assets = [];
    expect(lerExportacao(x).ok).toBe(false);
  });
});

describe("mensagem caracteristica no chat", () => {
  const dados = { caracteristica: { nome: "Sentinela", descricao: "Ataque de oportunidade." } };

  function mandar(estado: Estado, quem: string, extra: object) {
    const r = executar(estado, quem, pedido("chat.caracteristica", { ...dados, ...extra }));
    if (!r.ok) throw new Error(`recusado: ${r.erro.codigo}`);
    const ev = r.eventos[0];
    if (ev?.tipo !== "chat.mensagem") throw new Error("sem mensagem");
    return { estado: r.estado, mensagem: ev.dados.mensagem };
  }

  it("publica título e descrição para todos, como o personagem que eu edito", () => {
    const { mensagem, estado } = mandar(criarEstado(), "j1", { como: "aldric" });
    expect(mensagem).toMatchObject({
      tipo: "caracteristica",
      autorId: "j1",
      visivelPara: "todos",
      como: { personagemId: "aldric", nome: "Aldric" },
      caracteristica: { nome: "Sentinela", descricao: "Ataque de oportunidade." },
    });
    expect(MensagemSchema.safeParse(mensagem).success).toBe(true);
    for (const u of USUARIOS) {
      const vista = chatParaUsuario(estado.chat ?? [], u, estado.config);
      expect((vista[0] as Mensagem).caracteristica?.nome).toBe("Sentinela");
    }
  });

  it("exige o personagem (`como`) e que quem fala o edite; o mestre manda como qualquer um", () => {
    expect(
      IntencaoSchema.safeParse({ v: 1, id: "a", tipo: "chat.caracteristica", dados }).success,
    ).toBe(false);
    expect(
      erroDe(criarEstado(), "j2", pedido("chat.caracteristica", { ...dados, como: "aldric" }))
        .codigo,
    ).toBe("sem_permissao");
    expect(
      erroDe(criarEstado(), "j1", pedido("chat.caracteristica", { ...dados, como: "fantasma" }))
        .codigo,
    ).toBe("personagem_inexistente");
    expect(mandar(criarEstado(), "m", { como: "aldric" }).mensagem.como?.nome).toBe("Aldric");
  });

  it("respeita os limites: título vazio ou grande e descrição enorme são recusados", () => {
    const ok = (c: object) =>
      IntencaoSchema.safeParse({
        v: 1,
        id: "a",
        tipo: "chat.caracteristica",
        dados: { caracteristica: c, como: "aldric" },
      }).success;
    expect(ok({ nome: "A", descricao: "" })).toBe(true);
    expect(ok({ nome: "  ", descricao: "x" })).toBe(false);
    expect(ok({ nome: "n".repeat(81), descricao: "x" })).toBe(false);
    expect(ok({ nome: "A", descricao: "d".repeat(12_001) })).toBe(false);
    expect(ok({ nome: "A", descricao: "d".repeat(12_000) })).toBe(true);
  });

  it("o que o cliente manda a mais é descartado", () => {
    const { mensagem } = mandar(criarEstado(), "j1", {
      como: "aldric",
      caracteristica: { nome: "X", descricao: "y", extra: "lixo" },
    });
    expect(mensagem.caracteristica).toEqual({ nome: "X", descricao: "y" });
  });
});
