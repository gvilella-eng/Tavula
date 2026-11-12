import { describe, expect, it } from "vitest";
import { MensagemSchema } from "./chat.ts";
import { type MagiaDoCompendio, magiaParaFicha } from "./compendio.ts";
import {
  extraDeEspaco,
  multiplicarExpressao,
  niveisAcima,
  opcoesDeEspaco,
  porNivelAcimaDaMagia,
  porNivelAcimaDoTexto,
} from "./conjuracao.ts";
import { fonteComSemente } from "./dados.ts";
import { type EspacoDeMagia, FichaSchema, type PactoDaFicha } from "./ficha.ts";
import { rolarAtaque, rolarEspaco } from "./rolagens.ts";

const espaco = (nivel: number, total: number, gastos: number): EspacoDeMagia => ({
  nivel,
  total,
  gastos,
  restantes: total - gastos,
});

describe("opcoesDeEspaco", () => {
  const espacos = [
    espaco(1, 4, 0),
    espaco(2, 3, 3),
    espaco(3, 0, 0),
    espaco(4, 4, 0),
    espaco(5, 2, 1),
  ];

  it("nível exato: aparece com os restantes", () => {
    const o = opcoesDeEspaco(1, [espaco(1, 4, 1)], null);
    expect(o.map((x) => x.rotulo)).toEqual(["1º · 3 restantes"]);
  });

  it("só os níveis acima quando o do nível da magia acabou", () => {
    const o = opcoesDeEspaco(3, espacos, null);
    expect(o.map((x) => x.id)).toEqual(["4", "5"]);
    expect(o[0]?.rotulo).toBe("4º · 4 restantes");
    expect(o[1]?.rotulo).toBe("5º · 1 restante");
  });

  it("nunca oferece níveis abaixo da magia nem espaços esgotados", () => {
    const o = opcoesDeEspaco(2, espacos, null);
    expect(o.map((x) => x.nivel)).toEqual([4, 5]);
  });

  it("pacto: entra no fim, sobe para o nível do pacto", () => {
    const pacto: PactoDaFicha = { quantidade: 2, nivel: 3, gastos: 1, restantes: 1 };
    const o = opcoesDeEspaco(2, [espaco(2, 1, 0)], pacto);
    expect(o.map((x) => x.rotulo)).toEqual(["2º · 1 restante", "Pacto 3º · 1 restante"]);
    expect(o[1]).toMatchObject({ tipo: "pacto", nivel: 3 });
  });

  it("pacto de nível menor que o da magia ou esgotado não aparece", () => {
    expect(opcoesDeEspaco(4, [], { quantidade: 2, nivel: 3, gastos: 0, restantes: 2 })).toEqual([]);
    expect(opcoesDeEspaco(1, [], { quantidade: 2, nivel: 3, gastos: 2, restantes: 0 })).toEqual([]);
  });

  it("nenhuma opção sem espaço e truque não pergunta", () => {
    expect(opcoesDeEspaco(3, [espaco(1, 2, 0), espaco(3, 1, 1)], null)).toEqual([]);
    expect(opcoesDeEspaco(0, espacos, null)).toEqual([]);
  });
});

describe("porNivelAcimaDoTexto", () => {
  it("lê o texto real da Bola de Fogo do fixture", () => {
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de magia de 4º nível ou superior, o dano aumenta em 1d6 para cada nível do espaço acima do 3º.",
      ),
    ).toBe("1d6");
  });

  it("lê cura e variações", () => {
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de 2º nível ou superior, a cura aumenta em 1d8 para cada nível de espaço acima do 1º.",
      ),
    ).toBe("1d8");
    expect(porNivelAcimaDoTexto("O dano aumenta em 2d6 + 1 para cada círculo acima do 2º.")).toBe(
      "2d6+1",
    );
    expect(porNivelAcimaDoTexto("Causa 1d6 de dano adicional para cada nível acima do 1º.")).toBe(
      "1d6",
    );
    expect(porNivelAcimaDoTexto("O dano aumenta em 1D10 por nível de espaço acima do 5º.")).toBe(
      "1d10",
    );
  });

  it("o que não casa volta vazio (mísseis, alvos, raios, duração)", () => {
    expect(
      porNivelAcimaDoTexto(
        "Quando você conjura esta magia usando um espaço de magia de 2º nível ou superior, a magia cria um dardo adicional para cada nível do espaço acima do 1º.",
      ),
    ).toBe("");
    expect(
      porNivelAcimaDoTexto("Você pode afetar uma criatura adicional para cada nível acima do 3º."),
    ).toBe("");
    expect(porNivelAcimaDoTexto("A duração aumenta em 1 hora para cada nível acima.")).toBe("");
    expect(porNivelAcimaDoTexto("")).toBe("");
    expect(porNivelAcimaDoTexto(undefined)).toBe("");
  });
});

describe("multiplicarExpressao e extraDeEspaco", () => {
  it("multiplica dados e constantes", () => {
    expect(multiplicarExpressao("1d6", 2)).toBe("2d6");
    expect(multiplicarExpressao("1d4+1", 3)).toBe("3d4+3");
    expect(multiplicarExpressao("2d8", 0)).toBeNull();
    expect(multiplicarExpressao("lixo", 2)).toBeNull();
  });

  it("só há extra acima do nível da magia", () => {
    expect(niveisAcima(3, 5)).toBe(2);
    expect(niveisAcima(3, 3)).toBe(0);
    expect(extraDeEspaco("1d6", 3, 5)).toBe("2d6");
    expect(extraDeEspaco("1d6", 3, 3)).toBeNull();
    expect(extraDeEspaco(undefined, 3, 5)).toBeNull();
    expect(extraDeEspaco("  ", 3, 5)).toBeNull();
  });
});

describe("porNivelAcimaDaMagia e do compêndio", () => {
  const bola: MagiaDoCompendio = {
    nome: "Bola de Fogo",
    nivel: 3,
    escola: "Evocação",
    tempo: "1 ação",
    alcance: "45 m",
    componentes: "V, S, M",
    duracao: "Instantânea",
    concentracao: false,
    ritual: false,
    classes: ["Mago"],
    descricao: "Uma explosão. 8d6 de dano de fogo.",
    emNiveisSuperiores:
      "Quando você conjura esta magia usando um espaço de magia de 4º nível ou superior, o dano aumenta em 1d6 para cada nível do espaço acima do 3º.",
  };

  it("trazer a magia do compêndio para a ficha preenche o campo", () => {
    expect(magiaParaFicha(bola).porNivelAcima).toBe("1d6");
    const { emNiveisSuperiores: _x, ...sem } = bola;
    expect(magiaParaFicha(sem).porNivelAcima).toBeUndefined();
  });

  it("o campo escrito vence; vazio usa o compêndio e depois a descrição da ficha", () => {
    const f = magiaParaFicha(bola);
    expect(porNivelAcimaDaMagia({ ...f, porNivelAcima: "2d6" })).toBe("2d6");
    const { porNivelAcima: _p, ...antiga } = f;
    expect(porNivelAcimaDaMagia(antiga)).toBe("1d6");
    expect(
      porNivelAcimaDaMagia({ ...antiga, descricao: "sem nada" }, bola.emNiveisSuperiores),
    ).toBe("1d6");
    expect(porNivelAcimaDaMagia({ ...antiga, descricao: "sem nada" })).toBe("");
  });
});

describe("rolarEspaco: o dado a mais no crítico", () => {
  const rolagemFixa = (n: number) => () => n; // sempre o dado de valor n+1

  it("soma o extra ao dano principal e dá a metade", () => {
    const r = rolarEspaco({ nivel: 5, extra: "2d6", metade: true }, 20, false, rolagemFixa(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultado.nivel).toBe(5);
    expect(r.resultado.extra?.rolagem.total).toBe(8);
    expect(r.resultado.extra?.total).toBe(28);
    expect(r.resultado.extra?.metade).toBe(14);
  });

  it("no crítico os dados extras dobram, como os do dano", () => {
    const normal = rolarEspaco({ nivel: 4, extra: "1d6+1" }, 10, false, rolagemFixa(2));
    const critico = rolarEspaco({ nivel: 4, extra: "1d6+1" }, 10, true, rolagemFixa(2));
    if (!normal.ok || !critico.ok) throw new Error("recusou");
    expect(normal.resultado.extra?.expressao).toBe("1d6+1");
    expect(critico.resultado.extra?.expressao).toBe("2d6+1");
    expect(normal.resultado.extra?.rolagem.total).toBe(4);
    expect(critico.resultado.extra?.rolagem.total).toBe(7);
    expect(critico.resultado.extra?.metade).toBeUndefined();
  });

  it("sem extra só guarda o nível; extra inválido recusa", () => {
    const sem = rolarEspaco({ nivel: 5 }, 10, false, fonteComSemente(1));
    expect(sem).toEqual({ ok: true, resultado: { nivel: 5 } });
    expect(rolarEspaco({ nivel: 5, extra: "abc" }, 10, false, fonteComSemente(1)).ok).toBe(false);
  });

  it("combina com o ataque: crítico do ataque dobra o dano e o extra", () => {
    const fonte = fonteComSemente(7);
    const a = rolarAtaque({ nome: "Raio", bonus: 5, dano: "1d10", margemCritico: 1 }, fonte);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.resultado.critico).toBe(true);
    const e = rolarEspaco(
      { nivel: 3, extra: "1d10" },
      a.resultado.dano.total,
      a.resultado.critico,
      fonte,
    );
    if (!e.ok) throw new Error("recusou");
    expect(e.resultado.extra?.expressao).toBe("2d10");
    expect(e.resultado.extra?.total).toBe(
      a.resultado.dano.total + (e.resultado.extra?.rolagem.total ?? 0),
    );
  });
});

describe("compatibilidade (V6)", () => {
  it("ficha antiga sem porNivelAcima carrega igual, e o campo novo vai e volta", () => {
    const antiga = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      magias: [{ nome: "Luz", nivel: 0, preparada: true, descricao: "" }],
    });
    expect(antiga.magias?.[0]?.porNivelAcima).toBeUndefined();
    const nova = FichaSchema.parse({
      pvAtual: 1,
      pvMax: 1,
      magias: [{ nome: "Bola", nivel: 3, preparada: true, descricao: "", porNivelAcima: "1d6" }],
    });
    expect(FichaSchema.parse(JSON.parse(JSON.stringify(nova))).magias?.[0]?.porNivelAcima).toBe(
      "1d6",
    );
  });

  it("mensagem antiga (sem o bloco do espaço) continua valendo e a nova também", () => {
    const base = {
      id: "m1",
      seq: 1,
      emReal: 1,
      autorId: "u1",
      tipo: "texto" as const,
      texto: "oi",
      visivelPara: "todos" as const,
    };
    expect(MensagemSchema.parse(base).espaco).toBeUndefined();
    expect(MensagemSchema.parse({ ...base, espaco: { nivel: 5 } }).espaco).toEqual({ nivel: 5 });
  });
});
