import { describe, expect, it } from "vitest";
import { derivar, modelosPadrao } from "../index.ts";
import { CompendioLocal } from "./compendio.ts";
import { ErroDoMcp } from "./erros.ts";
import {
  FichaPartesSchema,
  lerAtributo,
  lerPericia,
  montarFicha,
  pvPorClasses,
} from "./fichaPorPartes.ts";

const compendio = CompendioLocal.doExemplo();
const base = { npc: false, criando: true, compendio, modelos: modelosPadrao() };
const partes = (p: object) => FichaPartesSchema.parse(p);

describe("a ficha montada por partes", () => {
  it("anão clérigo nível 3: atributos, salvaguardas da classe, perícias e PV como a mesa calcula", () => {
    const { ficha } = montarFicha(
      undefined,
      partes({
        raca: "Anã",
        classes: [{ classe: "clérigo", nivel: 3 }],
        atributos: { for: 10, des: 12, con: 14, int: 10, sab: 16, car: 12 },
        pericias: ["Religião", "medicina"],
      }),
      base,
    );
    const d = derivar(ficha);
    // PV: 8 + 2 no 1º nível, e 5 + 2 em cada um dos outros dois.
    expect(ficha.pvMax).toBe(24);
    expect(ficha.pvAtual).toBe(24);
    expect(ficha.classes).toEqual([{ classe: "Clérigo", nivel: 3 }]);
    expect(d.proficiencia).toBe(2);
    expect(d.atributos.sab.mod).toBe(3);
    // Salvaguardas da primeira classe (Sabedoria e Carisma) sem ninguém pedir.
    expect(d.salvaguardas.sab).toEqual({ nivel: "proficiente", total: 5 });
    expect(d.salvaguardas.car.total).toBe(3);
    expect(d.salvaguardas.for.nivel).toBe("nenhuma");
    expect(d.pericias.find((p) => p.id === "religiao")?.nivel).toBe("proficiente");
    expect(d.pericias.find((p) => p.id === "medicina")?.total).toBe(5);
  });

  it("PV dados à mão valem; o atual não passa do máximo", () => {
    const { ficha } = montarFicha(
      undefined,
      partes({ pv: { max: 7, atual: 99 }, ca: 15, atributos: { des: 14 } }),
      { ...base, npc: true },
    );
    expect(ficha.pvMax).toBe(7);
    expect(ficha.pvAtual).toBe(7);
    expect(ficha.apresentacao).toBe("npc");
    expect(derivar(ficha).ca).toBe(15);
  });

  it("sem classe nem PV põe 10 e avisa", () => {
    const { ficha, avisos } = montarFicha(undefined, partes({ raca: "Humano" }), base);
    expect(ficha.pvMax).toBe(10);
    expect(avisos.join(" ")).toMatch(/10 PV/);
  });

  it("nomes do compêndio: magia na lista, arma como ataque calculado e item no equipamento", () => {
    const { ficha } = montarFicha(
      undefined,
      partes({
        classes: [{ classe: "Mago", nivel: 5 }],
        atributos: { for: 14, int: 16 },
        compendio: ["Bola de Fogo", "espada longa", "Poção de cura"],
      }),
      base,
    );
    expect(ficha.magias?.map((m) => m.nome)).toEqual(["Bola de Fogo"]);
    const ataque = ficha.ataques?.[0];
    expect(ataque?.nome).toBe("Espada longa");
    expect(ataque?.acerto).toEqual({ tipo: "formula", atributo: "for", proficiente: true });
    expect(ficha.itens?.map((i) => i.nome)).toEqual(["Poção de cura"]);
  });

  it("nome do compêndio que não existe dá um erro claro", () => {
    expect(() =>
      montarFicha(undefined, partes({ compendio: ["Excalibur de Ouro"] }), base),
    ).toThrow(/Não achei "Excalibur de Ouro" no compêndio/);
  });

  it("itens: soma, atualiza a quantidade pelo nome e liga o modelo de objeto", () => {
    const antes = montarFicha(
      undefined,
      partes({
        itens: [
          { nome: "Corda", quantidade: 1 },
          { nome: "Tocha", modelo: "Tocha 5e", quantidade: 3 },
        ],
      }),
      base,
    ).ficha;
    expect(antes.itens?.[1]).toMatchObject({
      nome: "Tocha",
      quantidade: 3,
      modeloId: "modelo-tocha",
    });
    const depois = montarFicha(antes, partes({ itens: [{ nome: "corda", quantidade: 5 }] }), {
      ...base,
      criando: false,
    }).ficha;
    expect(depois.itens?.map((i) => [i.nome, i.quantidade])).toEqual([
      ["corda", 5],
      ["Tocha", 3],
    ]);
  });

  it("editar mantém o resto da ficha e remove pelo nome", () => {
    const antes = montarFicha(
      undefined,
      partes({
        atributos: { for: 16 },
        pv: { max: 12 },
        ataques: [{ nome: "Soco" }, { nome: "Chute" }],
        caracteristicas: [{ nome: "Visão no escuro", descricao: "18 m." }],
      }),
      base,
    ).ficha;
    const { ficha, avisos } = montarFicha(
      antes,
      partes({
        historia: "Veio do norte.",
        remover: { ataques: ["soco", "Voadora"] },
      }),
      { ...base, criando: false },
    );
    expect(ficha.atributos?.for).toBe(16);
    expect(ficha.pvMax).toBe(12);
    expect(ficha.historia).toBe("Veio do norte.");
    expect(ficha.ataques?.map((a) => a.nome)).toEqual(["Chute"]);
    expect(avisos.join(" ")).toMatch(/"Voadora" não estava/);
  });

  it("não mexe na ficha de origem (cópia)", () => {
    const origem = montarFicha(undefined, partes({ pv: { max: 5 } }), base).ficha;
    montarFicha(origem, partes({ pv: { max: 50 } }), { ...base, criando: false });
    expect(origem.pvMax).toBe(5);
  });

  it("perícia ou atributo que não existe dá um erro que lista as opções", () => {
    expect(() => montarFicha(undefined, partes({ pericias: ["Voar"] }), base)).toThrow(ErroDoMcp);
    expect(() => lerPericia("Voar")).toThrow(/As perícias são: Acrobacia/);
    expect(() => lerAtributo("xyz")).toThrow(/Use for, des, con/);
    expect(lerAtributo("Constituição")).toBe("con");
    expect(lerAtributo("FORCA")).toBe("for");
    expect(lerPericia("adestrar animais")).toBe("adestrarAnimais");
  });

  it("campo desconhecido é recusado em vez de ignorado", () => {
    expect(FichaPartesSchema.safeParse({ forca: 10 }).success).toBe(false);
    expect(FichaPartesSchema.safeParse({ atributos: { forca: 10 } }).success).toBe(false);
  });

  it("PV por classe: dado cheio no 1º nível, média depois, mínimo 1 por nível", () => {
    expect(pvPorClasses([{ classe: "Guerreiro", nivel: 1 }], 2)).toBe(12);
    expect(pvPorClasses([{ classe: "Mago", nivel: 2 }], -5)).toBe(2);
    expect(pvPorClasses([{ classe: "Inventada", nivel: 2 }], 0)).toBeNull();
  });
});

describe("conjuração inata, ritual e dados por nível (N2)", () => {
  it("põe magia inata no NPC, com atributo, CD e o contador do grupo", () => {
    const { ficha } = montarFicha(
      undefined,
      partes({
        npc: { nd: "3" },
        atributos: { car: 16 },
        conjuracaoInata: { habilidade: "car", cd: 13, grupo: { max: 3 } },
        magias: [
          { nome: "Luz", nivel: 0, inata: { frequencia: "vontade" } },
          { nome: "Voo", nivel: 3, inata: { frequencia: "cada", max: 1 } },
          { nome: "Invisibilidade", nivel: 2, inata: { frequencia: "grupo" } },
          {
            nome: "Raio de Fogo",
            nivel: 0,
            ritual: false,
            dadosPorNivel: [{ nivel: 5, expressao: "1d10" }],
          },
        ],
      }),
      { ...base, npc: true },
    );
    expect(ficha.inata).toEqual({ habilidade: "car", cd: 13, grupo: { max: 3, gastos: 0 } });
    expect(ficha.magias?.map((m) => m.inata?.frequencia)).toEqual([
      "vontade",
      "cada",
      "grupo",
      undefined,
    ]);
    expect(ficha.magias?.[3]?.dadosPorNivel).toEqual([{ nivel: 5, expressao: "1d10" }]);
  });
});
