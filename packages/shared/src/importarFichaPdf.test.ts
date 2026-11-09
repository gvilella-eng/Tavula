/// <reference types="node" />
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  conjuradoras,
  derivar,
  espacosDaFicha,
  FichaSchema,
  type ImportacaoDoPdf,
  importarFichaDoPdf,
  type Pedaco,
  pedacosDoTextoDoPdf,
  pesParaMetros,
} from "./index.ts";

// ---------------------------------------------------------------------------------------------
// O PDF de verdade (fixtures/fichas/darion.pdf), lido pelo pdf.js em Node, contra a seção 8
// do PROJETO.md.
// ---------------------------------------------------------------------------------------------

async function pedacosDoPdf(caminho: URL): Promise<Pedaco[]> {
  const dados = new Uint8Array(readFileSync(caminho));
  const doc = await getDocument({ data: dados, useSystemFonts: false }).promise;
  const pedacos: Pedaco[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const texto = await (await doc.getPage(n)).getTextContent();
    pedacos.push(...pedacosDoTextoDoPdf(n, texto.items as never));
  }
  return pedacos;
}

describe("importar o PDF do Darion (seção 8)", () => {
  let r: ImportacaoDoPdf;
  beforeAll(async () => {
    const pedacos = await pedacosDoPdf(
      new URL("../../../fixtures/fichas/darion.pdf", import.meta.url),
    );
    r = importarFichaDoPdf(pedacos);
  });

  const incertoDe = (caminho: string) => r.incertos.filter((i) => i.caminho === caminho);

  it("reconhece a ficha e valida no schema", () => {
    expect(r.reconhecido).toBe(true);
    expect(FichaSchema.safeParse(r.ficha).success).toBe(true);
  });

  it("cabeçalho", () => {
    expect(r.nome).toBe("Darion");
    expect(r.ficha.raca).toBe("Elfo da floresta");
    expect(r.ficha.antecedente).toBe("Forasteiro");
    expect(r.ficha.alinhamento).toBe("Caótico Mau");
    expect(r.ficha.classes).toEqual([
      { classe: "Patrulheiro", subclasse: "Hunter", nivel: 5 },
      { classe: "Clérigo", nivel: 5 },
    ]);
  });

  it("atributos, modificadores e salvaguardas", () => {
    expect(r.ficha.atributos).toEqual({ for: 25, des: 18, con: 14, int: 14, sab: 14, car: 11 });
    const d = derivar(r.ficha);
    expect(Object.values(d.atributos).map((a) => a.mod)).toEqual([7, 4, 2, 2, 2, 0]);
    expect(d.salvaguardas.for).toEqual({ nivel: "proficiente", total: 11 });
    expect(d.salvaguardas.des).toEqual({ nivel: "proficiente", total: 8 });
    expect(d.salvaguardas.con).toEqual({ nivel: "nenhuma", total: 2 });
    expect(d.salvaguardas.int.total).toBe(2);
    expect(d.salvaguardas.sab.total).toBe(2);
    expect(d.salvaguardas.car).toEqual({ nivel: "nenhuma", total: 0 });
  });

  it("gerais", () => {
    const d = derivar(r.ficha);
    expect(d.proficiencia).toBe(4);
    expect(r.ficha.ca?.valor).toBe(20);
    expect(d.iniciativa).toBe(4);
    expect(r.ficha.deslocamentoFt).toBe(30);
    expect(pesParaMetros(r.ficha.deslocamentoFt ?? 0)).toBe(9);
    expect(r.ficha.pvMax).toBe(97);
    expect(d.percepcaoPassiva).toBe(12);
  });

  it("perícias, com a proficiência deduzida pela conta", () => {
    const esperado: Record<string, [number, string]> = {
      acrobacia: [4, "nenhuma"],
      adestrarAnimais: [6, "proficiente"],
      arcanismo: [2, "nenhuma"],
      atletismo: [11, "proficiente"],
      enganacao: [0, "nenhuma"],
      historia: [2, "nenhuma"],
      intuicao: [2, "nenhuma"],
      intimidacao: [0, "nenhuma"],
      investigacao: [2, "nenhuma"],
      medicina: [2, "nenhuma"],
      natureza: [6, "proficiente"],
      percepcao: [2, "nenhuma"],
      atuacao: [0, "nenhuma"],
      persuasao: [0, "nenhuma"],
      religiao: [2, "nenhuma"],
      prestidigitacao: [4, "nenhuma"],
      furtividade: [8, "proficiente"],
      sobrevivencia: [6, "proficiente"],
    };
    const d = derivar(r.ficha);
    for (const [id, [total, nivel]] of Object.entries(esperado)) {
      const p = d.pericias.find((x) => x.id === id);
      expect([id, p?.total, p?.nivel]).toEqual([id, total, nivel]);
    }
    expect(r.incertos.filter((i) => i.caminho.startsWith("pericias."))).toEqual([]);
  });

  it("conjuração e espaços", () => {
    const c = conjuradoras(r.ficha);
    expect(c.every((x) => x.habilidade === "sab")).toBe(true);
    expect(c.map((x) => [x.cd, x.ataque])).toEqual([
      [14, 6],
      [14, 6],
    ]);
    expect(espacosDaFicha(r.ficha).map((e) => e.total)).toEqual([4, 3, 3, 1]);
    expect(incertoDe("conjuracao")).toEqual([]);
    expect(incertoDe("espacos")).toEqual([]);
  });

  it("listas de magias por nível", () => {
    const por = (n: number) =>
      (r.ficha.magias ?? []).filter((m) => m.nivel === n).map((m) => m.nome);
    expect(por(0)).toEqual([
      "Chill Touch (Mago)",
      "Prestidigitation (Mago)",
      "Sacred Flame",
      "Spare the Dying",
      "Light",
      "Thaumaturgy",
    ]);
    expect(por(1)).toEqual([
      "Hunter's Mark",
      "Cure Wounds - Curar Ferimentos",
      "Convocar Familiar (Mago)",
      "Speak with Animals",
      "Shield of Faith",
      "Inflict Wounds",
      "Guiding Bolt",
      "Burning Hands",
      "Faerie Fire",
      "Command",
    ]);
    expect(por(2)).toEqual([
      "Silence",
      "Flaming Sphere",
      "Scorching Ray",
      "Spiritual Weapon",
      "Locate Object",
      "Lesser Restoration",
    ]);
    expect(por(3)).toEqual(["Fireball", "Daylight"]);
    expect(r.ficha.magias).toHaveLength(24);
    // Toda magia da lista achou a sua descrição.
    expect((r.ficha.magias ?? []).filter((m) => m.descricao === "")).toEqual([]);
  });

  it("a descrição de Convocar Familiar vem inteira, com o UPDATE", () => {
    const m = r.ficha.magias?.find((x) => x.nome === "Convocar Familiar (Mago)");
    expect(m?.descricao).toContain("UPDATE: 1d10+1d6-1 pra random summon.");
    expect(m?.descricao).toContain("Bônus de proficiência do Darion");
    expect(m?.descricao).toContain("You gain the service of a familiar");
    expect(m?.descricao).toContain("you use your attack modifier for the roll.");
    expect(m?.escola).toBe("Conjuração");
  });

  it("a descrição das magias das três colunas não se mistura", () => {
    const chill = r.ficha.magias?.find((x) => x.nome === "Chill Touch (Mago)")?.descricao ?? "";
    expect(chill).toContain("Alcance: 120 feet");
    expect(chill).toContain("(3d8), and 17th level (4d8).");
    expect(chill).not.toContain("Prestidigitation");
    const marca = r.ficha.magias?.find((x) => x.nome === "Hunter's Mark")?.descricao ?? "";
    expect(marca).toContain("concentration on the spell for up to 24 hours.");
    const bola = r.ficha.magias?.find((x) => x.nome === "Daylight")?.descricao ?? "";
    expect(bola).toContain("the spell that created the darkness is dispelled.");
  });

  it("os 20 ataques, na ordem, como valor fixo", () => {
    const linhas = (r.ficha.ataques ?? []).map((a) => {
      const acerto =
        a.cd !== undefined
          ? `CD ${a.cd}`
          : a.acerto
            ? `${a.acerto.tipo === "fixo" ? a.acerto.valor : "?"}`
            : "-";
      return [a.nome, acerto, a.dano ?? "", a.tipo ?? ""].join("|");
    });
    expect(linhas).toEqual([
      "Cimitarra|7|1d6+7|",
      "Machadinho …|11|1d6+7|",
      "Machadinho …|11|1d6|Cortante",
      "Machadinho …|13|1d6+7|",
      "Arco longo|13|1d8+7|perfur…",
      "Hunter's Mark|-|1d6|",
      "Cure Wounds - Curar Ferimentos|-|1d8+2|Healing",
      "Chill Touch (Mago)|6|2d8|Necrotic",
      "Sacred Flame|CD 14|2d8|Radiant",
      "Inflict Wounds|6|3d10|Necrotic",
      "Guiding Bolt|6|4d6|Radiant",
      "Burning Hands|-|3d6|Fire",
      "Armadura de c…|11|7|",
      "Flaming Sphere|-|2d6|fire",
      "Scorching Ray|6|2d6|Fire",
      "Spiritual Weapon|6|1d8+2|Force",
      "Sun Blade|13|1d8+9|Radiant",
      "Sun Blade 2h|13|1d10+9|Radiant",
      "Fireball|CD 14|8d6|Fire",
      "Sun Blade - un…|13|1d8+9|Radiant…",
    ]);
    // Nunca recalculado: o ataque importado é sempre valor fixo.
    for (const a of r.ficha.ataques ?? []) if (a.acerto) expect(a.acerto.tipo).toBe("fixo");
  });

  it("os nomes cortados vão para revisão, sem chute", () => {
    for (const i of [1, 2, 3, 12, 19]) {
      const inc = incertoDe(`ataques.${i}.nome`);
      expect(inc, `ataques.${i}.nome`).toHaveLength(1);
      expect(inc[0]?.motivo).not.toMatch(/^recuperado/);
      expect(r.ficha.ataques?.[i]?.nome).toMatch(/…$/);
    }
    // O dano cortado também.
    expect(incertoDe("ataques.4.tipo")).toHaveLength(1);
    expect(incertoDe("ataques.19.tipo")).toHaveLength(1);
    // A sugestão do equipamento aparece no motivo, mas não preenche o nome.
    expect(incertoDe("ataques.12.nome")[0]?.motivo).toContain("Armadura de couro");
  });

  it("os recuperáveis vêm preenchidos e marcados como recuperado", () => {
    expect(r.ficha.ataques?.[6]?.nome).toBe("Cure Wounds - Curar Ferimentos");
    expect(r.ficha.ataques?.[7]?.nome).toBe("Chill Touch (Mago)");
    for (const i of [6, 7]) {
      const inc = incertoDe(`ataques.${i}.nome`);
      expect(inc).toHaveLength(1);
      expect(inc[0]?.motivo).toMatch(/^recuperado/);
    }
  });

  it("as caixas de recurso entram sempre como incertas", () => {
    const nomes = (r.ficha.recursos ?? []).map((x) => x.nome);
    expect(nomes).toEqual(["Flechas", "Tochas", "Labareda Protetora", "Rad do Amanhecer"]);
    for (let i = 0; i < nomes.length; i++) expect(incertoDe(`recursos.${i}`)).toHaveLength(1);
    expect(incertoDe("recursos.0")[0]?.motivo).toContain("aparece");
  });

  it("campos vazios e sem rótulo vão para revisão", () => {
    expect(r.ficha.pvAtual).toBe(97);
    expect(incertoDe("pvAtual")).toHaveLength(1);
    expect(incertoDe("pvTemp")).toHaveLength(1);
    expect(incertoDe("dadosDeVida")[0]?.trecho).toBe("10");
    expect(incertoDe("idiomas")).toHaveLength(1);
  });

  it("características", () => {
    const nomes = (r.ficha.caracteristicas ?? []).map((c) => c.nome.toLowerCase());
    expect(nomes).toEqual(
      [
        "Inimigo Favorito",
        "Explorador Natural",
        "Estilo de Luta - Arquearia",
        "Conjuração",
        "Consciência Primitiva",
        "Conclave do Caçador",
        "Visão no Escuro",
        "Ancestral Feérico",
        "Iniciado em Magia",
        "Ritual Casting",
        "Labareda Protetora",
        "Canalizar Divindade: Radiação do Amanhecer",
        "Sentinela",
      ].map((n) => n.toLowerCase()),
    );
    const sentinela = r.ficha.caracteristicas?.find((c) => c.nome === "Sentinela");
    expect(sentinela?.descricao).toContain("contra a criatura atacante.");
    const inimigo = r.ficha.caracteristicas?.find((c) => c.nome === "Inimigo Favorito");
    expect(inimigo?.descricao).toContain("que seja falado pelos seus inimigos favoritos");
    expect(inimigo?.descricao).not.toContain("EXPLORADOR NATURAL");
    expect((r.ficha.caracteristicas ?? []).filter((c) => c.descricao === "")).toEqual([]);
  });

  it("equipamento", () => {
    expect((r.ficha.itens ?? []).map((i) => [i.quantidade, i.nome])).toEqual([
      [1, "Armadura de couro"],
      [1, "Machadinho (dir)"],
      [1, "Arco longo"],
      [9, "Flechas"],
      [1, "Pacote explorador"],
      [1, "Violino velho QUEBRADO"],
      [1, "2 erva do padre, 2 carvão e 8 incenso"],
      [1, "Cimitarra"],
      [1, "anel do rudolf"],
      [1, "Sun Blade"],
      [1, "Sun Blade 2h"],
      [1, "escudo"],
    ]);
  });

  it("notas: personalidade e moedas", () => {
    expect(r.ficha.notas).toContain("Ideais: Defender e proteger quem é importante para mim.");
    expect(r.ficha.notas).toContain("Moedas: 7 GP");
    // O texto do cabeçalho (Caótico Mau, ALINHAMENTO) não vaza para a personalidade.
    expect(r.ficha.notas).not.toContain("ALINHAMENTO");
    expect(r.ficha.notas).not.toContain("Caótico");
    expect(r.ficha.notas?.startsWith("Traços de personalidade: Tendo vivido sozinho")).toBe(true);
  });

  it("guarda o trecho de cada seção para a tela de revisão", () => {
    for (const secao of ["cabecalho", "atributos", "pericias", "ataques", "magias", "equipamento"])
      expect(r.trechos[secao], secao).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
// Pedaços sintéticos: rótulo em inglês, deslocamento de escala e conta que não fecha.
// ---------------------------------------------------------------------------------------------

type Mudanca = (p: Pedaco) => Pedaco;
const IGUAL: Mudanca = (p) => p;
/** Escala e desloca (A4 para Carta: 612 x 792 contra 595 x 842). */
const emCarta: Mudanca = (p) => ({
  ...p,
  x: p.x * 0.92 + 14,
  y: p.y * 0.92 - 20,
  largura: p.largura * 0.92,
  altura: p.altura * 0.92,
});

function rotulo(str: string, x: number, y: number): Pedaco {
  return { pagina: 1, str, x, y, largura: str.length * 3.4, altura: 5.9 };
}
function texto(str: string, x: number, y: number, altura = 7.1): Pedaco {
  return { pagina: 1, str, x, y, largura: str.length * 3.6, altura };
}

/** Uma ficha mínima em inglês: Fighter 5, FOR 16, DES 14, SAB 10. */
function fichaEmIngles(mudar: Mudanca, opcoes: { stealth?: number } = {}): Pedaco[] {
  const atributos: [string, number, number, string][] = [
    ["STRENGTH", 40, 700, "16"],
    ["DEXTERITY", 34, 620, "14"],
    ["CONSTITUTION", 27, 540, "12"],
    ["INTELLIGENCE", 29, 460, "10"],
    ["WISDOM", 32, 380, "10"],
    ["CHARISMA", 36, 300, "8"],
  ];
  const modulos: Record<string, string> = { "16": "3", "14": "2", "12": "1", "10": "0", "8": "-1" };
  const base: Pedaco[] = [
    texto("Ana", 41, 784, 11.9),
    rotulo("CHARACTER NAME", 62, 760),
    texto("Fighter 5", 256, 803, 8.3),
    rotulo("CLASS & LEVEL", 256, 792),
    texto("Soldier", 357, 803, 8.3),
    rotulo("BACKGROUND", 357, 792),
    texto("Human", 256, 778, 8.3),
    rotulo("RACE", 256, 767),
    texto("Lawful Good", 357, 778, 8.3),
    rotulo("ALIGNMENT", 357, 767),
    texto("3", 97, 683, 11.9),
    rotulo("PROFICIENCY BONUS", 120, 685),
    texto("Hit Point Maximum", 223, 652),
    texto("44", 328, 652),
  ];
  for (const [nome, x, y, valor] of atributos) {
    base.push(rotulo(nome, x, y));
    base.push({
      pagina: 1,
      str: modulos[valor] ?? "0",
      x: x + 4,
      y: y - 27,
      largura: 13,
      altura: 23.8,
    });
    base.push({ pagina: 1, str: valor, x: x + 4, y: y - 46, largura: 13, altura: 11.9 });
  }
  // Salvaguardas (Strength proficiente) e perícias na coluna do meio.
  const linhas: [string, string][] = [
    ["6", "Strength"],
    ["2", "Dexterity"],
    ["6", "Athletics (Str)"],
    [String(opcoes.stealth ?? 5), "Stealth (Dex)"],
    ["6", "Perception (Wis)"],
    ["2", "Acrobatics (Dex)"],
  ];
  linhas.forEach(([valor, nome], i) => {
    base.push(texto(valor, 110, 600 - i * 14.2));
    base.push(texto(nome, 123, 600 - i * 14.2));
  });
  return base.map(mudar);
}

describe("parser com pedaços sintéticos", () => {
  it("lê os rótulos em inglês", () => {
    const r = importarFichaDoPdf(fichaEmIngles(IGUAL));
    expect(r.reconhecido).toBe(true);
    expect(r.nome).toBe("Ana");
    expect(r.ficha.raca).toBe("Human");
    expect(r.ficha.antecedente).toBe("Soldier");
    expect(r.ficha.alinhamento).toBe("Lawful Good");
    expect(r.ficha.classes).toEqual([{ classe: "Guerreiro", nivel: 5 }]);
    expect(r.ficha.atributos).toEqual({ for: 16, des: 14, con: 12, int: 10, sab: 10, car: 8 });
    expect(r.ficha.pvMax).toBe(44);
    expect(r.ficha.salvaguardas).toEqual({ for: { nivel: "proficiente" } });
    expect(r.ficha.pericias?.atletismo).toEqual({ nivel: "proficiente" });
    expect(r.ficha.pericias?.furtividade).toEqual({ nivel: "proficiente" });
    // Percepção 6 com modificador 0 e proficiência 3 = 2x: especialização.
    expect(r.ficha.pericias?.percepcao).toEqual({ nivel: "especialista" });
    expect(r.ficha.pericias?.acrobacia).toBeUndefined();
  });

  it("A4 e Carta (escala e deslocamento) dão a mesma ficha", () => {
    const a4 = importarFichaDoPdf(fichaEmIngles(IGUAL));
    const carta = importarFichaDoPdf(fichaEmIngles(emCarta));
    expect(carta.ficha).toEqual(a4.ficha);
    expect(carta.incertos.map((i) => i.caminho)).toEqual(a4.incertos.map((i) => i.caminho));
  });

  it("a perícia que não fecha a conta vai para revisão, sem chute de proficiência", () => {
    // Furtividade 9: modificador 2, proficiência 3, 2x = 6. Nenhuma conta fecha.
    for (const mudar of [IGUAL, emCarta]) {
      const r = importarFichaDoPdf(fichaEmIngles(mudar, { stealth: 9 }));
      const inc = r.incertos.filter((i) => i.caminho === "pericias.furtividade");
      expect(inc).toHaveLength(1);
      expect(inc[0]?.trecho).toContain("Stealth");
      expect(r.ficha.pericias?.furtividade).toEqual({ nivel: "nenhuma", bonus: 7 });
      // O valor lido se mantém: modificador + bônus = 9.
      expect(derivar(r.ficha).pericias.find((p) => p.id === "furtividade")?.total).toBe(9);
    }
  });

  it("um PDF que não é uma ficha 5e não é reconhecido", () => {
    const r = importarFichaDoPdf([texto("Qualquer coisa", 10, 10)]);
    expect(r.reconhecido).toBe(false);
    expect(r.incertos).toHaveLength(1);
  });
});
