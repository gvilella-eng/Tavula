import { describe, expect, it } from "vitest";
import {
  AtaqueSchema,
  bonusDeAcerto,
  cargaDaFicha,
  cdDaRolagem,
  expressaoDeDano,
  expressaoDeDanoCritico,
  type Ficha,
  fonteComSemente,
  MagiaSchema,
  margemDeCritico,
  moedasEmOuro,
  previaDoAtaque,
  receberDano,
  rolarAtaque,
  tipoDeDano,
} from "./index.ts";

// V4a: o editor da engrenagem (ataque e magia) vira expressão de dano, CD e prévia.

// Nível 10 (proficiência +4), Força 16 (+3), Destreza 14 (+2), Sabedoria 18 (+4).
const ficha: Ficha = {
  pvAtual: 10,
  pvMax: 10,
  classes: [{ classe: "Clérigo", nivel: 10 }],
  atributos: { for: 16, des: 14, sab: 18 },
};

describe("ataque do editor", () => {
  it("soma atributo, proficiência, bônus extra e bônus mágico no acerto", () => {
    const a = {
      nome: "Lâmina Solar",
      acerto: { tipo: "formula" as const, atributo: "for" as const, proficiente: true, bonus: 1 },
      bonusMagico: 2,
    };
    expect(bonusDeAcerto(ficha, a)).toBe(3 + 4 + 1 + 2);
  });

  it("o acerto fixo do import também ganha o bônus mágico", () => {
    expect(
      bonusDeAcerto(ficha, { nome: "x", acerto: { tipo: "fixo", valor: 5 }, bonusMagico: 1 }),
    ).toBe(6);
    expect(bonusDeAcerto(ficha, { nome: "x", acerto: { tipo: "fixo", valor: 5 } })).toBe(5);
  });

  it("o dano antigo (expressão inteira, sem os campos novos) sai como estava", () => {
    expect(expressaoDeDano(ficha, { nome: "x", dano: "1d8+7" })).toBe("1d8+7");
    expect(expressaoDeDano(ficha, { nome: "x" })).toBeUndefined();
    expect(expressaoDeDano(ficha, { nome: "x", dano: "  " })).toBeUndefined();
  });

  it("monta o dano com atributo, bônus, bônus mágico e o segundo dano", () => {
    const a = {
      nome: "Lâmina Solar",
      dano: "1d8",
      atributoDano: "for" as const,
      bonusDano: 1,
      bonusMagico: 2,
      tipo: "radiante",
      dano2: { dados: "1d6", atributo: "sab" as const, tipo: "fogo" },
    };
    expect(expressaoDeDano(ficha, a)).toBe("1d8+6+1d6+4");
    expect(tipoDeDano(a)).toBe("radiante + fogo");
  });

  it("dano negativo vira subtração", () => {
    expect(expressaoDeDano(ficha, { nome: "x", dano: "1d4", bonusDano: -2 })).toBe("1d4-2");
  });

  it("o crítico dobra os dados e soma os extras; os modificadores não dobram", () => {
    const a = { nome: "x", dano: "1d8", atributoDano: "for" as const, danoCritico: "1d6" };
    expect(expressaoDeDanoCritico(ficha, a)).toBe("2d8+3+1d6");
    expect(expressaoDeDanoCritico(ficha, { nome: "x", dano: "1d8+9" })).toBe("2d8+9");
  });

  it("a CD vem de 8 + proficiência + modificador + bônus, ou da CD escrita", () => {
    const a = {
      nome: "Bola de Fogo",
      salvaguarda: {
        alvo: "des" as const,
        cdAtributo: "sab" as const,
        cdBonus: 1,
        sucesso: "metade" as const,
      },
    };
    expect(cdDaRolagem(ficha, a)).toBe(8 + 4 + 4 + 1);
    expect(cdDaRolagem(ficha, { nome: "x", cd: 13 })).toBe(13);
    expect(cdDaRolagem(ficha, { nome: "x" })).toBeUndefined();
  });

  it("a prévia mostra acerto, dano, crítico e salvaguarda", () => {
    const a = {
      nome: "Lâmina Solar",
      acerto: { tipo: "formula" as const, atributo: "for" as const, proficiente: true },
      bonusMagico: 2,
      dano: "1d8",
      atributoDano: "for" as const,
      tipo: "Radiante",
      salvaguarda: { alvo: "des" as const, cdAtributo: "sab" as const, sucesso: "metade" as const },
    };
    const p = previaDoAtaque(ficha, a);
    expect(p.acerto).toBe("+9 para acertar");
    expect(p.dano).toBe("1d8+5 radiante");
    expect(p.critico).toBe("crítico 2d8+5");
    expect(p.salvaguarda).toBe("CD 16 de Destreza (metade se passar)");
  });

  it("sem acerto não há crítico na prévia", () => {
    expect(previaDoAtaque(ficha, { nome: "x", dano: "8d6", tipo: "fogo" })).toEqual({
      dano: "8d6 fogo",
    });
  });

  it("a margem de crítico vale 20 por padrão", () => {
    expect(margemDeCritico({ nome: "x" })).toBe(20);
    expect(margemDeCritico({ nome: "x", margemCritico: 19 })).toBe(19);
  });

  it("o schema aceita ataque antigo e os campos novos, e recusa margem fora de 18 a 20", () => {
    expect(
      AtaqueSchema.safeParse({ nome: "Espada", dano: "1d8+3", tipo: "cortante" }).success,
    ).toBe(true);
    expect(
      AtaqueSchema.safeParse({ nome: "Espada", margemCritico: 19, bonusMagico: 1 }).success,
    ).toBe(true);
    expect(AtaqueSchema.safeParse({ nome: "Espada", margemCritico: 17 }).success).toBe(false);
    expect(
      MagiaSchema.safeParse({
        nome: "Raio",
        nivel: 2,
        preparada: true,
        descricao: "",
        emAtaques: true,
        dano: "2d6",
      }).success,
    ).toBe(true);
  });
});

describe("rolagem do ataque com margem de crítico", () => {
  // Procura uma semente cujo d20 caia no 19: com margem 19 é crítico, com margem 20 não.
  function achar(margem: number | undefined) {
    for (let semente = 1; semente < 5000; semente++) {
      const r = rolarAtaque(
        {
          nome: "x",
          bonus: 0,
          dano: "1d8",
          ...(margem ? { margemCritico: margem } : {}),
          danoCritico: "1d6",
        },
        fonteComSemente(semente),
      );
      if (!r.ok) continue;
      const d20 = r.resultado.acerto.termos[0];
      if (d20?.tipo === "dados" && d20.dados[0]?.valor === 19) return r.resultado;
    }
    throw new Error("sem semente");
  }

  it("19 natural é crítico com margem 19, soma o dano extra e dobra os dados", () => {
    const r = achar(19);
    expect(r.critico).toBe(true);
    expect(r.dano.expressao).toBe("2d8+1d6");
  });

  it("19 natural não é crítico com a margem padrão", () => {
    const r = achar(undefined);
    expect(r.critico).toBe(false);
    expect(r.dano.expressao).toBe("1d8");
  });

  it("leva a salvaguarda do alvo para o resultado", () => {
    const r = rolarAtaque(
      {
        nome: "x",
        bonus: 0,
        dano: "1d8",
        salvaguarda: { cd: 15, atributo: "Destreza", sucesso: "metade" },
      },
      fonteComSemente(1),
    );
    expect(r.ok && r.resultado.salvaguarda).toEqual({
      cd: 15,
      atributo: "Destreza",
      sucesso: "metade",
    });
  });
});

describe("moedas, carga e dano na ficha", () => {
  it("converte as moedas para peças de ouro", () => {
    expect(
      moedasEmOuro({ pvAtual: 1, pvMax: 1, moedas: { pc: 50, pp: 30, pe: 2, po: 12, pl: 1 } }),
    ).toBe(0.5 + 3 + 1 + 12 + 10);
    expect(moedasEmOuro({ pvAtual: 1, pvMax: 1 })).toBe(0);
  });

  it("a carga soma quantidade vezes peso (item sem peso conta zero)", () => {
    expect(
      cargaDaFicha({
        pvAtual: 1,
        pvMax: 1,
        itens: [
          { nome: "Tocha", quantidade: 2, peso: 0.5 },
          { nome: "Armadura", quantidade: 1, peso: 6.5 },
          { nome: "Corda", quantidade: 3 },
        ],
      }),
    ).toBe(7.5);
  });

  it("o dano consome os PV temporários primeiro", () => {
    expect(receberDano({ pvAtual: 10, pvTemp: 4 }, 3)).toEqual({ pvAtual: 10, pvTemp: 1 });
    expect(receberDano({ pvAtual: 10, pvTemp: 4 }, 6)).toEqual({ pvAtual: 8, pvTemp: 0 });
    expect(receberDano({ pvAtual: 2, pvTemp: 0 }, 9)).toEqual({ pvAtual: 0, pvTemp: 0 });
    expect(receberDano({ pvAtual: 5 }, 1)).toEqual({ pvAtual: 4, pvTemp: 0 });
  });
});
