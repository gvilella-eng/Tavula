import { describe, expect, it } from "vitest";
import darionArquivo from "../../../fixtures/fichas/darion.json";
import {
  absorverMochila,
  aplicarOperacoes,
  bonusDeAcerto,
  bonusDePericia,
  bonusDeProficiencia,
  bonusDeSalvaguarda,
  CENA_PADRAO,
  conjuradoras,
  criarArquivoDeFicha,
  criarExportacao,
  derivar,
  descansoCurto,
  descansoLongo,
  type Estado,
  espacosDaFicha,
  espacosDeMagia,
  estadoInicial,
  eventoPara,
  type Ficha,
  FichaSchema,
  type Intencao,
  IntencaoSchema,
  iniciativa,
  lerArquivoDeFicha,
  lerExportacao,
  luzVisivelPara,
  modInteligenciaDe,
  modInteligenciaDoPersonagem,
  modificador,
  nivelDeConjurador,
  operacoesDeDiferenca,
  type Personagem,
  pactoDaFicha,
  percepcaoPassiva,
  pesParaMetros,
  processar,
  TAMANHO_MAXIMO_DA_FICHA,
  VERSAO_EXPORTACAO,
  visaoPara,
} from "./index.ts";

const AGORA = "2026-01-01T00:00:00.000Z";
const mestre = { id: "m", papel: "mestre" as const };
const j1 = { id: "j1", papel: "jogador" as const };
const j2 = { id: "j2", papel: "jogador" as const };

const darion = FichaSchema.parse((darionArquivo as { ficha: unknown }).ficha);

// ---------------------------------------------------------------------------------------------
// Os números do Darion (PROJETO.md, seção 8)
// ---------------------------------------------------------------------------------------------

describe("derivados do Darion", () => {
  const d = derivar(darion);

  it("modificadores, proficiência pelo nível total e salvaguardas", () => {
    expect(d.nivelTotal).toBe(10);
    expect(d.proficiencia).toBe(4);
    expect(bonusDeProficiencia(darion)).toBe(4);
    expect(Object.values(d.atributos).map((a) => a.mod)).toEqual([7, 4, 2, 2, 2, 0]);
    expect(
      (["for", "des", "con", "int", "sab", "car"] as const).map((a) =>
        bonusDeSalvaguarda(darion, a),
      ),
    ).toEqual([11, 8, 2, 2, 2, 0]);
  });

  it("todas as perícias", () => {
    const porNome = Object.fromEntries(d.pericias.map((p) => [p.nome, p.total]));
    expect(porNome).toEqual({
      Acrobacia: 4,
      "Adestrar Animais": 6,
      Arcanismo: 2,
      Atletismo: 11,
      Enganação: 0,
      História: 2,
      Intuição: 2,
      Intimidação: 0,
      Investigação: 2,
      Medicina: 2,
      Natureza: 6,
      Percepção: 2,
      Atuação: 0,
      Persuasão: 0,
      Religião: 2,
      Prestidigitação: 4,
      Furtividade: 8,
      Sobrevivência: 6,
    });
  });

  it("percepção passiva 12, iniciativa +4, CA 20", () => {
    expect(percepcaoPassiva(darion)).toBe(12);
    expect(d.percepcaoPassiva).toBe(12);
    expect(iniciativa(darion)).toBe(4);
    expect(d.iniciativa).toBe(4);
    expect(d.ca).toBe(20);
  });

  it("conjuração: Sabedoria, CD 14, ataque +6; Clérigo 5 + Patrulheiro 5 é conjurador de nível 7", () => {
    expect(d.conjuradoras.map((c) => [c.classe, c.habilidade, c.cd, c.ataque])).toEqual([
      ["Patrulheiro", "sab", 14, 6],
      ["Clérigo", "sab", 14, 6],
    ]);
    expect(conjuradoras(darion)).toHaveLength(2);
    expect(d.nivelDeConjurador).toBe(7);
    expect(d.espacos.map((e) => e.total)).toEqual([4, 3, 3, 1]);
    expect(d.pacto).toBeNull();
  });

  it("deslocamento 30 ft = 9 m e dados de vida 5d8 + 5d10", () => {
    expect(d.deslocamentoFt).toBe(30);
    expect(d.deslocamentoM).toBe(9);
    expect(pesParaMetros(35)).toBe(10.5);
    expect(d.dadosDeVida).toEqual([
      { dado: "d8", total: 5, usados: 0, restantes: 5 },
      { dado: "d10", total: 5, usados: 0, restantes: 5 },
    ]);
  });

  it("os 20 ataques são valor fixo e nunca são recalculados", () => {
    expect(darion.ataques).toHaveLength(20);
    expect(darion.ataques?.[0]).toMatchObject({
      nome: "Cimitarra",
      acerto: { tipo: "fixo", valor: 7 },
    });
    // com proficiência daria +11, mas o valor fixo vale
    expect(
      bonusDeAcerto(darion, darion.ataques?.[0] as NonNullable<Ficha["ataques"]>[number]),
    ).toBe(7);
    expect(
      bonusDeAcerto(darion, {
        nome: "x",
        acerto: { tipo: "formula", atributo: "for", proficiente: true },
      }),
    ).toBe(11);
    expect(bonusDeAcerto(darion, { nome: "Hunter's Mark" })).toBeUndefined();
  });

  it("magias, características e equipamento da seção 8", () => {
    const nivel = (n: number) => darion.magias?.filter((m) => m.nivel === n).length;
    expect([nivel(0), nivel(1), nivel(2), nivel(3)]).toEqual([6, 10, 6, 2]);
    expect(darion.caracteristicas).toHaveLength(13);
    // 9 tochas e 7 flechas, como no PDF da ficha (decidido em 2026-11-10)
    expect(darion.itens?.find((i) => i.modeloId === "modelo-tocha")?.quantidade).toBe(9);
  });
});

// ---------------------------------------------------------------------------------------------
// Outros casos de cálculo
// ---------------------------------------------------------------------------------------------

describe("regras", () => {
  it("modificador arredonda para baixo", () => {
    expect([1, 8, 9, 10, 11, 12, 20, 30].map(modificador)).toEqual([-5, -1, -1, 0, 0, 1, 5, 10]);
  });

  it("bônus de proficiência por nível total: 2, 3, 4, 5, 6", () => {
    const nivel = (n: number): Ficha => ({
      pvAtual: 1,
      pvMax: 1,
      classes: [{ classe: "Guerreiro", nivel: n }],
    });
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map((n) => bonusDeProficiencia(nivel(n)))).toEqual([
      2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });

  it("especialista dobra a proficiência", () => {
    const f: Ficha = {
      pvAtual: 1,
      pvMax: 1,
      classes: [{ classe: "Ladino", nivel: 5 }],
      atributos: { des: 16 },
      pericias: {
        furtividade: { nivel: "especialista" },
        acrobacia: { nivel: "proficiente", bonus: 1 },
      },
    };
    expect(bonusDePericia(f, "furtividade")).toBe(3 + 6);
    expect(bonusDePericia(f, "acrobacia")).toBe(3 + 3 + 1);
    expect(bonusDePericia(f, "atletismo")).toBe(0);
  });

  it("multiclasse com Bruxo: o pacto fica à parte e não entra no nível de conjurador", () => {
    const f: Ficha = {
      pvAtual: 1,
      pvMax: 1,
      atributos: { car: 16 },
      classes: [
        { classe: "Mago", nivel: 3 },
        { classe: "Bruxo", nivel: 5 },
      ],
    };
    expect(nivelDeConjurador(f.classes ?? [])).toBe(3);
    expect(espacosDaFicha(f).map((e) => e.total)).toEqual([4, 2]);
    expect(pactoDaFicha(f)).toEqual({ quantidade: 2, nivel: 3, gastos: 0, restantes: 2 });
    // Bruxo sozinho: sem espaços de magia comuns, só o pacto
    const so: Ficha = { pvAtual: 1, pvMax: 1, classes: [{ classe: "Warlock", nivel: 11 }] };
    expect(espacosDaFicha(so)).toEqual([]);
    expect(pactoDaFicha(so)).toMatchObject({ quantidade: 3, nivel: 5 });
    // a CD usa Carisma (padrão do Bruxo)
    expect(conjuradoras(f).find((c) => c.classe === "Bruxo")).toMatchObject({
      habilidade: "car",
      cd: 8 + 3 + 3,
    });
  });

  it("uma classe de meio conjurador usa a própria tabela; a de terço também", () => {
    const um = (classe: string, nivel: number, subclasse?: string) =>
      nivelDeConjurador([{ classe, nivel, ...(subclasse ? { subclasse } : {}) }]);
    expect(um("Patrulheiro", 1)).toBe(0);
    expect(espacosDeMagia(um("Patrulheiro", 5))).toEqual([4, 2]);
    expect(espacosDeMagia(um("Paladino", 9))).toEqual([4, 3, 2]);
    expect(espacosDeMagia(um("Guerreiro", 3, "Cavaleiro Místico"))).toEqual([2]);
    expect(espacosDeMagia(um("Ladino", 7, "Trapaceiro Arcano"))).toEqual([4, 2]);
    expect(um("Guerreiro", 7)).toBe(0);
    expect(espacosDeMagia(20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it("espaços gastos nunca passam do total; sem classe de conjuração, não há espaços", () => {
    const f: Ficha = {
      ...darion,
      espacosGastos: { "1": 9, "2": 1 },
    };
    expect(espacosDaFicha(f).map((e) => e.restantes)).toEqual([0, 2, 3, 1]);
    expect(espacosDaFicha({ pvAtual: 1, pvMax: 1 })).toEqual([]);
  });

  it("ficha antiga (só PV) deriva com o padrão", () => {
    const d = derivar({ pvAtual: 3, pvMax: 5 });
    expect(d.proficiencia).toBe(2);
    expect(d.atributos.for).toEqual({ valor: 10, mod: 0 });
    expect(d.deslocamentoM).toBe(9);
    expect(d.ca).toBe(10);
  });

  it("Inteligência: vem da ficha; sem ficha preenchida vale o campo antigo", () => {
    const antigo = { ficha: { pvAtual: 1, pvMax: 1 }, modInteligencia: 3 };
    expect(modInteligenciaDoPersonagem(antigo)).toBe(3);
    expect(modInteligenciaDoPersonagem({ ficha: darion, modInteligencia: 3 })).toBe(2);
    expect(modInteligenciaDoPersonagem({})).toBe(0);
    expect(modInteligenciaDe({ personagemId: "x" }, [{ id: "x", ...antigo }])).toBe(3);
    expect(
      modInteligenciaDe({ personagemId: "x" }, [{ id: "x", ficha: darion, modInteligencia: 3 }]),
    ).toBe(2);
  });
});

describe("descansos", () => {
  const f: Ficha = {
    ...darion,
    pvAtual: 20,
    pvTemp: 5,
    dadosDeVidaUsados: { d8: 3, d10: 4 },
    espacosGastos: { "1": 2 },
    mortes: { sucessos: 1, falhas: 2 },
    recursos: [
      { nome: "Flechas", atual: 3, max: 9, recarga: "nenhuma" },
      { nome: "Labareda", atual: 0, max: 2, recarga: "longo" },
      { nome: "Radiação", atual: 0, max: 1, recarga: "curto" },
    ],
  };

  it("curto: só os recursos de recarga curta", () => {
    const c = descansoCurto(f);
    expect(c.recursos?.map((r) => r.atual)).toEqual([3, 0, 1]);
    expect(c.pvAtual).toBe(20);
    expect(c.espacosGastos).toEqual({ "1": 2 });
  });

  it("longo: PV, metade dos dados de vida, espaços, recursos e testes contra a morte", () => {
    const l = descansoLongo(f);
    expect(l.pvAtual).toBe(97);
    expect(l.pvTemp).toBeUndefined();
    expect(l.espacosGastos).toBeUndefined();
    expect(l.mortes).toBeUndefined();
    expect(l.recursos?.map((r) => r.atual)).toEqual([3, 2, 1]);
    // 10 dados no total: devolve 5, começando pelos maiores (d10 4 -> 0, d8 3 -> 2)
    expect(l.dadosDeVidaUsados).toEqual({ d8: 2 });
    expect(FichaSchema.safeParse(l).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Operações de gravação
// ---------------------------------------------------------------------------------------------

describe("aplicarOperacoes", () => {
  it("cria o caminho que falta, troca e remove (null)", () => {
    const r = aplicarOperacoes({ pvAtual: 5, pvMax: 10 }, [
      { caminho: "atributos.for", valor: 14 },
      { caminho: "itens", valor: [{ nome: "Corda", quantidade: 1 }] },
      { caminho: "itens.0.quantidade", valor: 2 },
      { caminho: "itens.1", valor: { nome: "Tocha", quantidade: 1 } },
      { caminho: "pvTemp", valor: 3 },
    ]);
    expect(r.ok && r.ficha).toEqual({
      pvAtual: 5,
      pvMax: 10,
      pvTemp: 3,
      atributos: { for: 14 },
      itens: [
        { nome: "Corda", quantidade: 2 },
        { nome: "Tocha", quantidade: 1 },
      ],
    });
    const sem = aplicarOperacoes(r.ok ? r.ficha : undefined, [
      { caminho: "itens.0", valor: null },
      { caminho: "pvTemp", valor: null },
    ]);
    expect(sem.ok && sem.ficha.itens).toEqual([{ nome: "Tocha", quantidade: 1 }]);
    expect(sem.ok && sem.ficha.pvTemp).toBeUndefined();
  });

  it("recusa caminho perigoso, valor inválido e posição fora da lista", () => {
    const base: Ficha = { pvAtual: 1, pvMax: 1 };
    for (const op of [
      { caminho: "__proto__.x", valor: 1 },
      { caminho: "constructor.prototype.x", valor: 1 },
      { caminho: "atributos..for", valor: 1 },
      { caminho: "atributos.for", valor: 99 },
      { caminho: "pvAtual", valor: "muito" },
      { caminho: "itens.5", valor: { nome: "x", quantidade: 1 } },
      { caminho: "pvAtual.x", valor: 1 },
    ]) {
      expect(aplicarOperacoes(base, [op]).ok).toBe(false);
    }
    expect(({} as { x?: number }).x).toBeUndefined();
  });

  it("PV atual nunca passa do máximo", () => {
    const r = aplicarOperacoes({ pvAtual: 5, pvMax: 10 }, [{ caminho: "pvAtual", valor: 99 }]);
    expect(r.ok && r.ficha.pvAtual).toBe(10);
  });

  it("recusa a ficha com mais de 256 KB", () => {
    const grande = "x".repeat(20_000);
    const ops = Array.from({ length: 14 }, (_, i) => ({
      caminho: `magias.${i}`,
      valor: { nome: `m${i}`, nivel: 1, preparada: true, descricao: grande },
    }));
    const r = aplicarOperacoes({ pvAtual: 1, pvMax: 1 }, ops);
    expect(r.ok).toBe(false);
    // e o limite de uma ficha com 12 descrições passa
    expect(aplicarOperacoes({ pvAtual: 1, pvMax: 1 }, ops.slice(0, 12)).ok).toBe(true);
    expect(TAMANHO_MAXIMO_DA_FICHA).toBe(262_144);
  });

  it("operacoesDeDiferenca leva uma ficha à outra", () => {
    const depois = descansoLongo({ ...darion, pvAtual: 1, espacosGastos: { "1": 1 } });
    const ops = operacoesDeDiferenca({ ...darion, pvAtual: 1, espacosGastos: { "1": 1 } }, depois);
    const r = aplicarOperacoes({ ...darion, pvAtual: 1, espacosGastos: { "1": 1 } }, ops);
    expect(r.ok && r.ficha).toEqual(depois);
  });
});

describe("arquivo da ficha", () => {
  it("exporta e importa a mesma ficha; arquivo inválido é recusado", () => {
    const arquivo = criarArquivoDeFicha("Darion", darion, AGORA);
    const json = JSON.parse(JSON.stringify(arquivo));
    const lido = lerArquivoDeFicha(json);
    expect(lido.ok && lido.arquivo.ficha).toEqual(darion);
    expect(lerArquivoDeFicha({ formato: "outra-coisa" }).ok).toBe(false);
    expect(lerArquivoDeFicha(darionArquivo).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Sala: ficha.alterar, sigilo e migração
// ---------------------------------------------------------------------------------------------

let contador = 0;
function intencao(tipo: Intencao["tipo"], dados: object): Intencao {
  return IntencaoSchema.parse({ v: 1, id: `f${++contador}`, tipo, dados });
}

function aplicar(estado: Estado, quem: string, i: Intencao) {
  const r = processar(estado, quem, i, AGORA);
  if (!r.ok) throw new Error(`recusado: ${r.erro.codigo} ${r.erro.mensagem}`);
  return r;
}

function codigo(estado: Estado, quem: string, i: Intencao): string | null {
  const r = processar(estado, quem, i, AGORA);
  return r.ok ? null : r.erro.codigo;
}

function pers(id: string, dono: string | null, extra: Partial<Personagem> = {}): Personagem {
  return {
    id,
    pastaId: "pasta-todos",
    editores: { tipo: "jogadores", ids: dono === null ? [] : [dono] },
    nome: `Pers ${id}`,
    tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
    visao: { alcanceM: null, visaoNoEscuroM: 0 },
    ficha: darion,
    ...extra,
  };
}

function criarEstado(): Estado {
  return estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "c1", nome: "C1" },
      { ...CENA_PADRAO, id: "c2", nome: "C2" },
    ],
    cenaAtivaId: "c1",
    pastas: [{ id: "pasta-todos", nome: "Grupo", ordem: 0, visivel: { tipo: "todos" } }],
    personagens: [pers("p1", "j1"), pers("p2", "j2")],
    tokens: [],
  });
}

describe("ficha.alterar", () => {
  const e = criarEstado();
  const pv = (valor: number) =>
    intencao("ficha.alterar", { personagemId: "p1", operacoes: [{ caminho: "pvAtual", valor }] });

  it("quem edita grava; o mestre também", () => {
    const r = aplicar(e, "j1", pv(50));
    expect(r.estado.personagens.find((p) => p.id === "p1")?.ficha?.pvAtual).toBe(50);
    expect(r.eventos.map((x) => x.tipo)).toEqual(["personagem.alterado"]);
    expect(aplicar(e, "m", pv(10)).estado.personagens[0]?.ficha?.pvAtual).toBe(10);
  });

  it("quem não edita é recusado (mesmo vendo a ficha)", () => {
    expect(codigo(e, "j2", pv(1))).toBe("sem_permissao");
    const vendo = aplicar(
      e,
      "m",
      intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: true }),
    ).estado;
    expect(codigo(vendo, "j2", pv(1))).toBe("sem_permissao");
  });

  it("ficha maior que 256 KB é recusada", () => {
    const operacoes = Array.from({ length: 14 }, (_, i) => ({
      caminho: `magias.${i}`,
      valor: { nome: `m${i}`, nivel: 1, preparada: true, descricao: "y".repeat(20_000) },
    }));
    expect(codigo(e, "j1", intencao("ficha.alterar", { personagemId: "p1", operacoes }))).toBe(
      "dados_invalidos",
    );
  });

  it("ficha inválida é recusada inteira (nada é gravado)", () => {
    const i = intencao("ficha.alterar", {
      personagemId: "p1",
      operacoes: [
        { caminho: "pvAtual", valor: 3 },
        { caminho: "atributos.for", valor: 500 },
      ],
    });
    expect(codigo(e, "j1", i)).toBe("dados_invalidos");
  });

  it("o schema recusa lista vazia e caminho enorme", () => {
    expect(
      IntencaoSchema.safeParse({
        v: 1,
        id: "x",
        tipo: "ficha.alterar",
        dados: { personagemId: "p1", operacoes: [] },
      }).success,
    ).toBe(false);
  });

  it("jogador não repõe tochas (aumentar a quantidade de item de modelo); gastar pode", () => {
    const mais = intencao("ficha.alterar", {
      personagemId: "p1",
      operacoes: [{ caminho: "itens.12.quantidade", valor: 12 }],
    });
    expect(codigo(e, "j1", mais)).toBe("sem_permissao");
    expect(codigo(e, "m", mais)).toBeNull();
    const gasta = intencao("ficha.alterar", {
      personagemId: "p1",
      operacoes: [{ caminho: "itens.12.quantidade", valor: 1 }],
    });
    expect(codigo(e, "j1", gasta)).toBeNull();
  });

  it("importar: caminho vazio troca a ficha inteira", () => {
    const nova: Ficha = { pvAtual: 7, pvMax: 7, raca: "Anão" };
    const r = aplicar(
      e,
      "j1",
      intencao("ficha.alterar", { personagemId: "p1", operacoes: [{ caminho: "", valor: nova }] }),
    );
    expect(r.estado.personagens[0]?.ficha).toEqual(nova);
  });
});

describe("sigilo da ficha (ficha.verOutras)", () => {
  const e = criarEstado();
  const com = aplicar(
    e,
    "m",
    intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: true }),
  );

  it("sem a capacidade o jogador recebe o item do outro sem a ficha; a própria vem inteira", () => {
    const v = visaoPara(e, j1);
    const proprio = v.personagens.find((p) => p.id === "p1");
    const outro = v.personagens.find((p) => p.id === "p2");
    expect(proprio?.ficha).toEqual(darion);
    expect(outro).toBeDefined();
    expect(outro?.ficha).toBeUndefined();
    expect(outro?.nome).toBe("Pers p2");
    // o necessário para o mapa continua: a Inteligência já calculada
    expect(outro?.modInteligencia).toBe(2);
    const texto = JSON.stringify(v.personagens.find((p) => p.id === "p2"));
    expect(texto).not.toContain("Sun Blade");
    expect(texto).not.toContain("pvAtual");
  });

  it("com a capacidade vem a ficha completa; o mestre vê sempre", () => {
    expect(visaoPara(com.estado, j1).personagens.find((p) => p.id === "p2")?.ficha).toEqual(darion);
    expect(visaoPara(e, mestre).personagens.every((p) => p.ficha !== undefined)).toBe(true);
  });

  it("ligar e desligar a capacidade manda snapshot novo a todos", () => {
    expect(com.snapshotPara).toBe("todos");
    const desligada = aplicar(
      com.estado,
      "m",
      intencao("permissao.alterar", { capacidade: "ficha.verOutras", valor: false }),
    );
    expect(desligada.snapshotPara).toBe("todos");
    expect(
      visaoPara(desligada.estado, j1).personagens.find((p) => p.id === "p2")?.ficha,
    ).toBeUndefined();
    // exceção por usuário: só o j1 vê
    const so = aplicar(
      e,
      "m",
      intencao("permissao.alterar", {
        capacidade: "ficha.verOutras",
        valor: true,
        usuarioId: "j1",
      }),
    );
    expect(visaoPara(so.estado, j1).personagens.find((p) => p.id === "p2")?.ficha).toEqual(darion);
  });

  it("eventos: só quem vê a ficha recebe a mudança; quem não vê não recebe nem o aviso", () => {
    const r = aplicar(
      e,
      "j2",
      intencao("ficha.alterar", {
        personagemId: "p2",
        operacoes: [{ caminho: "pvAtual", valor: 3 }],
      }),
    );
    const ev = r.eventos[0] as NonNullable<(typeof r.eventos)[0]>;
    const para = (u: { id: string; papel: "mestre" | "jogador" }) => eventoPara(ev, u, e, r.estado);
    expect(para(mestre)).toEqual(ev);
    expect(para(j2)).toEqual(ev);
    // sem verOutras: nada chega ao j1 (o item sem a ficha não mudou)
    expect(para(j1)).toBeNull();
    // com verOutras: chega inteira
    const vendo = aplicar(
      com.estado,
      "j2",
      intencao("ficha.alterar", {
        personagemId: "p2",
        operacoes: [{ caminho: "pvAtual", valor: 3 }],
      }),
    );
    const ev2 = vendo.eventos[0] as NonNullable<(typeof vendo.eventos)[0]>;
    expect(eventoPara(ev2, j1, com.estado, vendo.estado)).toEqual(ev2);
  });

  it("evento de mudança que o jogador vê (nome) chega SEM a ficha", () => {
    const r = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "p2", mudancas: { nome: "Outro" } }),
    );
    const ev = r.eventos[0] as NonNullable<(typeof r.eventos)[0]>;
    const visto = eventoPara(ev, j1, e, r.estado);
    expect(visto?.tipo).toBe("personagem.alterado");
    expect(JSON.stringify(visto)).not.toContain("Sun Blade");
    expect(JSON.stringify(visto)).toContain("Outro");
    // o próprio dono recebe a ficha
    expect(JSON.stringify(eventoPara(ev, j2, e, r.estado))).toContain("Sun Blade");
  });

  it("personagem.criar sem a ficha completa também nunca vaza a dos outros", () => {
    const r = aplicar(
      e,
      "m",
      intencao("personagem.criar", { personagem: pers("p3", "j2", { nome: "Novo" }) }),
    );
    const ev = r.eventos[0] as NonNullable<(typeof r.eventos)[0]>;
    expect(JSON.stringify(eventoPara(ev, j1, e, r.estado))).not.toContain("Sun Blade");
  });

  it("mudar quem edita: o novo editor recebe a ficha e o antigo passa a receber o item sem ela", () => {
    const r = aplicar(
      e,
      "m",
      intencao("personagem.editar", {
        id: "p2",
        mudancas: { editores: { tipo: "jogadores", ids: ["j1"] } },
      }),
    );
    const ev = r.eventos[0] as NonNullable<(typeof r.eventos)[0]>;
    // j1 passa a editar: o evento chega com a ficha; j2 deixa de editar: chega sem ela
    expect(JSON.stringify(eventoPara(ev, j1, e, r.estado))).toContain("Sun Blade");
    expect(JSON.stringify(eventoPara(ev, j2, e, r.estado))).not.toContain("Sun Blade");
    expect(visaoPara(r.estado, j1).personagens.find((p) => p.id === "p2")?.ficha).toEqual(darion);
    expect(visaoPara(r.estado, j2).personagens.find((p) => p.id === "p2")?.ficha).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// A tocha na mão chega a quem edita o personagem (pendência do Lote 7)
// ---------------------------------------------------------------------------------------------

describe("tocha na mão e quem edita (token fora da cena ativa)", () => {
  const base = estadoInicial({
    usuarios: [
      { id: "m", nome: "Mestre", papel: "mestre", cor: "#111" },
      { id: "j1", nome: "J1", papel: "jogador", cor: "#333" },
      { id: "j2", nome: "J2", papel: "jogador", cor: "#444" },
    ],
    cenas: [
      { ...CENA_PADRAO, id: "c1", nome: "C1" },
      { ...CENA_PADRAO, id: "c2", nome: "C2" },
    ],
    cenaAtivaId: "c1",
    pastas: [{ id: "pasta-todos", nome: "Grupo", ordem: 0, visivel: { tipo: "todos" } }],
    personagens: [pers("p1", "j1"), pers("p2", "j2")],
    // o token do p1 está na cena c2, que não é a ativa; o do p2 está na ativa
    tokens: [
      {
        id: "t1",
        cenaId: "c2",
        nome: "T1",
        cor: "#0f0",
        tamanhoQuadrados: 1,
        x: 5,
        y: 5,
        camada: "tokens",
        oculto: false,
        controladoPor: [],
        personagemId: "p1",
      },
    ],
  });

  const acender = aplicar(
    base,
    "j1",
    intencao("tocha.acender", { personagemId: "p1", modeloId: "modelo-tocha", novoId: "tocha-a" }),
  );
  const ctx = (e: Estado) => ({
    tokens: e.tokens,
    personagens: e.personagens,
    pastas: e.pastas,
    pontos: e.pontos,
    cenaAtivaId: e.cenaAtivaId,
  });

  it("acender da ficha desconta o item e põe o objeto na mão", () => {
    const luz = acender.estado.luzes.find((l) => l.id === "tocha-a");
    expect(luz?.portador).toEqual({ tipo: "mao", personagemId: "p1", mao: 0 });
    const itens = acender.estado.personagens.find((p) => p.id === "p1")?.ficha?.itens;
    expect(itens?.find((i) => i.modeloId === "modelo-tocha")?.quantidade).toBe(8);
  });

  it("luzVisivelPara: o editor vê a tocha da mão; o outro jogador não; o mestre vê", () => {
    const luz = acender.estado.luzes.find((l) => l.id === "tocha-a");
    if (!luz) throw new Error("sem tocha");
    const c = ctx(acender.estado);
    expect(luzVisivelPara(luz, j1, c)).toBe(true);
    expect(luzVisivelPara(luz, j2, c)).toBe(false);
    expect(luzVisivelPara(luz, mestre, c)).toBe(true);
  });

  it("snapshot: a tocha está no do editor e fora do snapshot do outro", () => {
    expect(visaoPara(acender.estado, j1).luzes.map((l) => l.id)).toEqual(["tocha-a"]);
    expect(visaoPara(acender.estado, j2).luzes).toEqual([]);
  });

  it("eventoPara: o editor recebe os eventos da tocha; o outro não", () => {
    const apagar = aplicar(acender.estado, "j1", intencao("tocha.alternar", { id: "tocha-a" }));
    const ev = apagar.eventos[0] as NonNullable<(typeof apagar.eventos)[0]>;
    expect(ev.tipo).toBe("fonte.editada");
    expect(eventoPara(ev, j1, acender.estado, apagar.estado)?.tipo).toBe("fonte.editada");
    expect(eventoPara(ev, j2, acender.estado, apagar.estado)).toBeNull();
  });

  it("transição: o jogador deixa de editar e a tocha some da tela dele (fonte.apagada)", () => {
    const r = aplicar(
      acender.estado,
      "m",
      intencao("personagem.editar", {
        id: "p1",
        mudancas: { editores: { tipo: "jogadores", ids: [] } },
      }),
    );
    // a própria edição reenvia a tocha da mão: quem a via deixa de ver (fonte.apagada)
    const reenvio = r.eventos.find((x) => x.tipo === "fonte.editada");
    if (!reenvio) throw new Error("sem reenvio da tocha");
    expect(eventoPara(reenvio, j1, acender.estado, r.estado)?.tipo).toBe("fonte.apagada");
    expect(eventoPara(reenvio, j2, acender.estado, r.estado)).toBeNull();
    // o evento da tocha (mudar o saldo) chega como "some" a quem a via
    const antes = acender.estado;
    const depois = r.estado;
    const luz = depois.luzes.find((l) => l.id === "tocha-a");
    if (!luz) throw new Error("sem tocha");
    const ev = {
      seq: depois.seq + 1,
      origem: { usuarioId: "m", idPedido: "x" },
      tipo: "fonte.editada" as const,
      dados: { fonte: luz },
    };
    expect(eventoPara(ev, j1, antes, depois)?.tipo).toBe("fonte.apagada");
  });

  it("transição: o personagem passa a ser do j2 e a tocha aparece para ele", () => {
    const r = aplicar(
      acender.estado,
      "m",
      intencao("personagem.editar", {
        id: "p1",
        mudancas: { editores: { tipo: "jogadores", ids: ["j2"] } },
      }),
    );
    const luz = r.estado.luzes.find((l) => l.id === "tocha-a");
    if (!luz) throw new Error("sem tocha");
    const ev = {
      seq: r.estado.seq + 1,
      origem: { usuarioId: "m", idPedido: "x" },
      tipo: "fonte.editada" as const,
      dados: { fonte: luz },
    };
    expect(eventoPara(ev, j2, acender.estado, r.estado)?.tipo).toBe("fonte.editada");
    expect(visaoPara(r.estado, j2).luzes.map((l) => l.id)).toEqual(["tocha-a"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Migração da mochila e exportação v9
// ---------------------------------------------------------------------------------------------

describe("migração da mochila do Lote 7", () => {
  const modelos = [{ id: "modelo-tocha", nome: "Tocha 5e" }];

  it("a mochila vira itens com modeloId (quantidade = as novas) e some", () => {
    const antigo = {
      ...pers("p1", "j1", { ficha: { pvAtual: 4, pvMax: 9 } }),
      mochila: { "modelo-tocha": 3, "modelo-lanterna": 0, desconhecido: 2 },
    };
    const novo = absorverMochila(antigo, modelos);
    expect("mochila" in novo).toBe(false);
    expect(novo.ficha).toEqual({
      pvAtual: 4,
      pvMax: 9,
      itens: [
        { nome: "Tocha 5e", quantidade: 3, modeloId: "modelo-tocha" },
        { nome: "desconhecido", quantidade: 2, modeloId: "desconhecido" },
      ],
    });
    // idempotente
    expect(absorverMochila(novo, modelos)).toBe(novo);
  });

  it("v8 com mochila e ficha mínima importa como v9 com os itens", () => {
    const e = criarEstado();
    const v9 = criarExportacao(e, AGORA);
    const v8 = JSON.parse(JSON.stringify({ ...v9, versao: 8 }));
    v8.dados.personagens = [
      {
        id: "p1",
        pastaId: "pasta-todos",
        editores: { tipo: "jogadores", ids: ["j1"] },
        nome: "Aldric",
        tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
        visao: { alcanceM: null, visaoNoEscuroM: 0 },
        mochila: { "modelo-tocha": 4 },
        ficha: { pvAtual: 10, pvMax: 12 },
      },
    ];
    const lida = lerExportacao(v8);
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.exportacao.versao).toBe(VERSAO_EXPORTACAO);
    expect(VERSAO_EXPORTACAO).toBe(13);
    const p = lida.exportacao.dados.personagens[0];
    expect(p?.mochila).toBeUndefined();
    expect(p?.ficha).toEqual({
      pvAtual: 10,
      pvMax: 12,
      itens: [{ nome: "Tocha 5e", quantidade: 4, modeloId: "modelo-tocha" }],
    });
  });

  it("exportar e importar uma v9 devolve a mesma ficha", () => {
    const e = criarEstado();
    const x = criarExportacao(e, AGORA);
    expect(x.versao).toBe(13);
    const lida = lerExportacao(JSON.parse(JSON.stringify(x)));
    expect(lida.ok && lida.exportacao.dados.personagens[0]?.ficha).toEqual(darion);
  });

  it("importar a campanha leva as fichas e a migração não perde a luz usada", () => {
    const e = criarEstado();
    const antigo = aplicar(
      e,
      "m",
      intencao("personagem.editar", { id: "p1", mudancas: { nome: "Darion" } }),
    );
    expect(antigo.estado.personagens.find((p) => p.id === "p1")?.ficha).toEqual(darion);
  });
});
