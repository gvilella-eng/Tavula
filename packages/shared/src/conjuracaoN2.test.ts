import { describe, expect, it } from "vitest";
import { cdDaRolagem } from "./ataques.ts";
import { type MagiaDoCompendio, magiaParaFicha } from "./compendio.ts";
import { aplicarEntradaNaFicha } from "./compendioParaFicha.ts";
import {
  ataqueDaInata,
  cdDaInata,
  dadosPorNivelDaMagia,
  dadosPorNivelDoTexto,
  extraDoTruque,
  lerFrequenciaInata,
  lerPorNivelAcima,
  magiaInataParaRolar,
  nivelParaTruque,
  porNivelAcimaDoTexto,
  quantidadeDaConjuracao,
  somarExpressoes,
  textoDaQuantidade,
  usosRestantesDaInata,
} from "./conjuracao.ts";
import { fonteComSemente } from "./dados.ts";
import { bonusDeAcerto, descansoLongo, FichaSchema, type Magia } from "./ficha.ts";
import { rolarEspaco } from "./rolagens.ts";

const TEXTO_RAIO_DE_FOGO =
  "Você arremessa um glóbulo de fogo numa criatura. Faça um ataque de magia à distância. Em um sucesso, o alvo sofre 1d10 de dano de fogo. O dano da magia aumenta em 1d10 quando você alcança o 5º nível (2d10), 11º nível (3d10) e 17º nível (4d10).";
const TEXTO_RAJADA =
  "Um raio de energia estala em direção a uma criatura. Em um sucesso, o alvo sofre 1d10 de dano de energia. A magia cria mais de um raio quando você alcança níveis superiores: dois raios no 5º nível, três raios no 11º nível e quatro raios no 17º nível.";

describe("frequência da magia inata", () => {
  it("lê à vontade, N/dia cada e N/dia", () => {
    expect(lerFrequenciaInata("À vontade:")).toEqual({ frequencia: "vontade" });
    expect(lerFrequenciaInata("1/dia cada")).toEqual({ frequencia: "cada", max: 1 });
    expect(lerFrequenciaInata("3/dia cada:")).toEqual({ frequencia: "cada", max: 3 });
    expect(lerFrequenciaInata("3/dia")).toEqual({ frequencia: "grupo", max: 3 });
    expect(lerFrequenciaInata("mensalmente")).toBeNull();
  });

  it("os usos: à vontade sem limite, cada por magia, grupo no contador", () => {
    const f = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      inata: { grupo: { max: 3, gastos: 1 } },
    });
    expect(usosRestantesDaInata(f, { inata: { frequencia: "vontade" } })).toBeNull();
    expect(usosRestantesDaInata(f, { inata: { frequencia: "cada", max: 2, gastos: 1 } })).toEqual({
      restantes: 1,
      max: 2,
    });
    expect(usosRestantesDaInata(f, { inata: { frequencia: "grupo" } })).toEqual({
      restantes: 2,
      max: 3,
    });
  });

  it("a CD e o ataque da inata saem do atributo e da CD próprios, não da classe", () => {
    const f = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      atributos: { car: 16, int: 10 },
      npc: { nd: "3" },
      inata: { habilidade: "car" },
    });
    // ND 3: proficiência +2; Carisma 16: +3 → CD 13, ataque +5
    expect(cdDaInata(f)).toBe(13);
    expect(ataqueDaInata(f)).toBe(5);
    const explicita = FichaSchema.parse({ ...f, inata: { habilidade: "car", cd: 15 } });
    expect(cdDaInata(explicita)).toBe(15);
    const m: Magia = {
      nome: "Sono",
      nivel: 1,
      preparada: true,
      descricao: "",
      acerto: { tipo: "formula", atributo: "int", proficiente: true },
      salvaguarda: { alvo: "sab", cdAtributo: "int", sucesso: "nenhum" },
    };
    const r = magiaInataParaRolar(explicita, m);
    expect(cdDaRolagem(explicita, r)).toBe(15);
    expect(bonusDeAcerto(explicita, r)).toBe(7);
    // sem CD escrita, vale o atributo da inata
    const r2 = magiaInataParaRolar(f, m);
    expect(cdDaRolagem(f, r2)).toBe(13);
    expect(bonusDeAcerto(f, r2)).toBe(5);
  });

  it("descanso longo devolve os usos da inata e do grupo", () => {
    const f = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 5,
      inata: { grupo: { max: 3, gastos: 2 } },
      magias: [
        {
          nome: "Voo",
          nivel: 3,
          preparada: true,
          descricao: "",
          inata: { frequencia: "cada", max: 2, gastos: 2 },
        },
        { nome: "Luz", nivel: 0, preparada: true, descricao: "", inata: { frequencia: "vontade" } },
      ],
    });
    const depois = descansoLongo(f);
    expect(depois.magias?.[0]?.inata).toEqual({ frequencia: "cada", max: 2 });
    expect(depois.inata?.grupo).toEqual({ max: 3, gastos: 0 });
    expect(FichaSchema.safeParse(depois).success).toBe(true);
  });

  it("soltar na parte inata põe a magia no fim, marcada, sem espaço", () => {
    const luz: MagiaDoCompendio = {
      nome: "Luz",
      nivel: 0,
      escola: "Evocação",
      tempo: "1 ação",
      alcance: "Toque",
      componentes: "V",
      duracao: "1 hora",
      concentracao: false,
      ritual: false,
      classes: [],
      descricao: "O objeto emite luz.",
    };
    const f = FichaSchema.parse({ pvAtual: 1, pvMax: 1 });
    const r = aplicarEntradaNaFicha(f, { tipo: "magia", magia: luz }, "npc", {
      posicao: null,
      inata: { frequencia: "cada", max: 3 },
    });
    if (!r.ok) throw new Error(r.motivo);
    const magias = r.operacoes[0]?.valor as Magia[];
    expect(magias[0]?.inata).toEqual({ frequencia: "cada", max: 3 });
  });
});

describe("dados por nível do personagem (truques)", () => {
  it("lê o Raio de Fogo: +1d10 no 5, +2d10 no 11, +3d10 no 17", () => {
    expect(dadosPorNivelDoTexto(TEXTO_RAIO_DE_FOGO)).toEqual([
      { nivel: 5, expressao: "1d10" },
      { nivel: 11, expressao: "2d10" },
      { nivel: 17, expressao: "3d10" },
    ]);
  });

  it("lê a Rajada Mística: um raio a mais no 5, 11 e 17", () => {
    expect(dadosPorNivelDoTexto(TEXTO_RAJADA)).toEqual([
      { nivel: 5, expressao: "1d10" },
      { nivel: 11, expressao: "2d10" },
      { nivel: 17, expressao: "3d10" },
    ]);
  });

  it("o dado a mais vale nos níveis 1, 5, 11 e 17", () => {
    const lista = dadosPorNivelDoTexto(TEXTO_RAIO_DE_FOGO);
    expect(extraDoTruque(lista, 1)).toBeNull();
    expect(extraDoTruque(lista, 4)).toBeNull();
    expect(extraDoTruque(lista, 5)).toEqual({ nivel: 5, expressao: "1d10" });
    expect(extraDoTruque(lista, 10)?.expressao).toBe("1d10");
    expect(extraDoTruque(lista, 11)?.expressao).toBe("2d10");
    expect(extraDoTruque(lista, 17)?.expressao).toBe("3d10");
    expect(extraDoTruque(lista, 20)?.expressao).toBe("3d10");
    expect(somarExpressoes("1d10", "1d10")).toBe("2d10");
    expect(somarExpressoes("1d10", "2d10")).toBe("3d10");
    expect(somarExpressoes("1d10", "1d6")).toBe("1d10+1d6");
  });

  it("vem do compêndio quando a magia é truque e a ficha não traz o campo", () => {
    const m = { nivel: 0, descricao: "" };
    expect(dadosPorNivelDaMagia(m, TEXTO_RAIO_DE_FOGO)).toHaveLength(3);
    expect(dadosPorNivelDaMagia({ ...m, nivel: 1 }, TEXTO_RAIO_DE_FOGO)).toEqual([]);
    expect(
      dadosPorNivelDaMagia({ ...m, dadosPorNivel: [{ nivel: 3, expressao: "1d4" }] }, "x"),
    ).toEqual([{ nivel: 3, expressao: "1d4" }]);
  });

  it("o compêndio já leva os dados por nível e o ritual para a ficha", () => {
    const fogo: MagiaDoCompendio = {
      nome: "Raio de Fogo",
      nivel: 0,
      escola: "Evocação",
      tempo: "1 ação",
      alcance: "36 metros",
      componentes: "V, S",
      duracao: "Instantânea",
      concentracao: false,
      ritual: false,
      classes: [],
      descricao: TEXTO_RAIO_DE_FOGO,
    };
    expect(magiaParaFicha(fogo).dadosPorNivel).toHaveLength(3);
    expect(magiaParaFicha({ ...fogo, ritual: true }).ritual).toBe(true);
    expect(magiaParaFicha(fogo).ritual).toBeUndefined();
  });

  it("o nível do truque: classes, senão o ND (fração vale 1), senão 1", () => {
    expect(
      nivelParaTruque(
        FichaSchema.parse({ pvAtual: 1, pvMax: 1, classes: [{ classe: "Mago", nivel: 5 }] }),
      ),
    ).toBe(5);
    expect(nivelParaTruque(FichaSchema.parse({ pvAtual: 1, pvMax: 1, npc: { nd: "9" } }))).toBe(9);
    expect(nivelParaTruque(FichaSchema.parse({ pvAtual: 1, pvMax: 1, npc: { nd: "1/2" } }))).toBe(
      1,
    );
    expect(nivelParaTruque(FichaSchema.parse({ pvAtual: 1, pvMax: 1 }))).toBe(1);
  });
});

describe("dardos, raios e alvos por nível", () => {
  it("lê o 'Em níveis superiores' das três magias", () => {
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de magia de 2º nível ou superior, a magia cria um dardo adicional para cada nível do espaço acima do 1º.",
      ),
    ).toBe("1 dardo");
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de magia de 3º nível ou superior, você cria um raio adicional para cada nível do espaço acima do 2º.",
      ),
    ).toBe("1 raio");
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de magia de 3º nível ou superior, você pode afetar uma criatura adicional para cada nível do espaço acima do 2º.",
      ),
    ).toBe("1 criatura");
    // dado continua dado
    expect(
      porNivelAcimaDoTexto("o dano aumenta em 1d6 para cada nível do espaço acima do 3º"),
    ).toBe("1d6");
  });

  it("o campo aceita dados ou quantidade", () => {
    expect(lerPorNivelAcima("1d6")).toEqual({ tipo: "dados", expressao: "1d6" });
    expect(lerPorNivelAcima("+1 dardo")).toEqual({ tipo: "quantidade", por: 1, unidade: "dardo" });
    expect(lerPorNivelAcima("2 raios")).toEqual({ tipo: "quantidade", por: 2, unidade: "raio" });
    expect(lerPorNivelAcima("1 criatura")).toEqual({
      tipo: "quantidade",
      por: 1,
      unidade: "criatura",
    });
    expect(lerPorNivelAcima("lixo")).toBeNull();
  });

  it("Mísseis Mágicos no 2º espaço: 4 dardos; no nível dela, nada", () => {
    const m = { descricao: "Você cria três dardos brilhantes.", quantidadeBase: undefined };
    expect(quantidadeDaConjuracao(m, "1 dardo", 1, 2)).toEqual({ total: 4, unidade: "dardo" });
    expect(quantidadeDaConjuracao(m, "1 dardo", 1, 4)).toEqual({ total: 6, unidade: "dardo" });
    expect(quantidadeDaConjuracao(m, "1 dardo", 1, 1)).toBeNull();
    expect(quantidadeDaConjuracao(m, "1d6", 1, 3)).toBeNull();
    // o campo vence o texto; sem os dois, a base é 1 (Imobilizar Pessoa)
    expect(quantidadeDaConjuracao({ ...m, quantidadeBase: 5 }, "1 dardo", 1, 2)?.total).toBe(6);
    expect(
      quantidadeDaConjuracao({ descricao: "Escolha um humanoide." }, "1 criatura", 2, 3),
    ).toEqual({ total: 2, unidade: "criatura" });
    expect(textoDaQuantidade(4, "dardo")).toBe("4 dardos");
    expect(textoDaQuantidade(1, "raio")).toBe("1 raio");
  });

  it("a sala rola cada dardo separado, com o total; só mostra o número sem dano", () => {
    const fonte = fonteComSemente(7);
    const r = rolarEspaco(
      { nivel: 2, quantidade: { total: 4, unidade: "dardo", cada: "1d4+1" } },
      0,
      false,
      fonte,
    );
    if (!r.ok) throw new Error(r.motivo);
    const q = r.resultado.quantidade;
    expect(q?.total).toBe(4);
    expect(q?.rolagens).toHaveLength(4);
    expect(q?.soma).toBe(q?.rolagens?.reduce((t, x) => t + x.total, 0));
    for (const x of q?.rolagens ?? []) expect(x.total).toBeGreaterThanOrEqual(2);
    const so = rolarEspaco(
      { nivel: 3, quantidade: { total: 2, unidade: "criatura" } },
      0,
      false,
      fonte,
    );
    if (!so.ok) throw new Error(so.motivo);
    expect(so.resultado.quantidade).toEqual({ total: 2, unidade: "criatura" });
  });
});

describe("ritual e inata no cartão", () => {
  it("o espaço do pedido carrega a marca e não rola nada", () => {
    const fonte = fonteComSemente(1);
    const r = rolarEspaco({ nivel: 1, ritual: true }, 0, false, fonte);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.resultado).toEqual({ nivel: 1, ritual: true });
    const i = rolarEspaco({ nivel: 3, inata: true }, 0, false, fonte);
    if (!i.ok) throw new Error(i.motivo);
    expect(i.resultado).toEqual({ nivel: 3, inata: true });
  });
});

describe("compatibilidade (N2)", () => {
  it("a ficha antiga carrega igual e os campos novos vão e voltam", () => {
    const antiga = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      magias: [{ nome: "Luz", nivel: 0, preparada: true, descricao: "" }],
    });
    expect(antiga.inata).toBeUndefined();
    expect(antiga.magias?.[0]?.inata).toBeUndefined();
    const nova = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      inata: { habilidade: "car", cd: 13, grupo: { max: 3, gastos: 1 } },
      magias: [
        {
          nome: "Raio de Fogo",
          nivel: 0,
          preparada: true,
          descricao: "",
          ritual: true,
          quantidadeBase: 3,
          dadosPorNivel: [{ nivel: 5, expressao: "1d10" }],
          inata: { frequencia: "cada", max: 1, gastos: 0 },
        },
      ],
    });
    const volta = FichaSchema.parse(JSON.parse(JSON.stringify(nova)));
    expect(volta.inata?.grupo).toEqual({ max: 3, gastos: 1 });
    expect(volta.magias?.[0]?.dadosPorNivel).toEqual([{ nivel: 5, expressao: "1d10" }]);
  });
});
