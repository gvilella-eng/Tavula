import { FluxoSchema, fraseDoFluxo, nomesDaMesa, problemasDoFluxo } from "@tabletop/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fluxoNovo } from "./blocos";
import {
  CHAVE_DO_TOUR_DAS_AUTOMACOES,
  CHAVE_DO_TOUR_DAS_AUTOMACOES_NO_TESTE,
  marcarTourDasAutomacoesVisto,
  PASSOS_DO_CENTRO,
  passosDoEditor,
  podeMontarOExemplo,
  tourDasAutomacoesAbreSozinho,
  tourDasAutomacoesJaVisto,
} from "./passosDoTour";

describe("o tour das automações: os passos", () => {
  it("passa por cada tipo de peça e termina na montagem do exemplo das tochas", () => {
    const ids = passosDoEditor(true).map((p) => p.id);
    expect(ids).toEqual([
      "boas-vindas",
      "quando",
      "fluxo",
      "condicoes",
      "caixas",
      "caixa-exemplo",
      "caixa-espacos",
      "acoes",
      "eventos",
      "montar",
      "relogio",
      "para-cada",
      "ligar-relogio",
      "sortear",
      "chance",
      "ligar-sorteio",
      "apagar",
      "ligar-apagar",
      "fim",
    ]);
    // os cinco grupos de peça têm um passo cada, e cada passo ilumina o grupo na paleta
    const grupos = passosDoEditor(true)
      .filter((p) => ["quando", "fluxo", "condicoes", "caixas", "acoes"].includes(p.id))
      .map((p) => p.alvos(fluxoNovo("x"))[0]);
    expect(grupos).toEqual([
      "ed-grupo-quando",
      "ed-grupo-fluxo",
      "ed-grupo-condicao",
      "ed-grupo-logica",
      "ed-grupo-faca",
    ]);
  });

  it("o centro explica a lista e a mesa de eventos, e o último passo abre o editor", () => {
    expect(PASSOS_DO_CENTRO.map((p) => p.id)).toEqual(["centro", "mesa-de-eventos", "nova"]);
    expect(PASSOS_DO_CENTRO.at(-1)?.avancar).toBe("Abrir o editor");
  });

  it("'Fazer este passo por mim', passo a passo, monta a automação das tochas e cada passo fica feito", () => {
    let f = fluxoNovo("exemplo");
    expect(podeMontarOExemplo(f)).toBe(true);
    for (const passo of passosDoEditor(true)) {
      if (passo.tipo !== "fazer") continue;
      expect(passo.feito?.(f), `${passo.id} ainda não está feito`).toBe(false);
      f = passo.fazer?.(f) ?? f;
      expect(passo.feito?.(f), `${passo.id} ficou feito`).toBe(true);
    }
    const nomes = nomesDaMesa({ cenas: [], modelos: [], zonas: [] });
    const frase = fraseDoFluxo(f, nomes);
    expect(frase).toContain("A cada 3 min");
    expect(frase).toContain("30% de chance");
    expect(frase).toContain("apaga");
    // a automação final passa na conferência do esquema e não tem problema (só falta o nome, que o fim do tour põe)
    const final = { ...f, nome: "As tochas apagam", ligado: false };
    expect(FluxoSchema.safeParse(final).success).toBe(true);
    expect(
      problemasDoFluxo(final, {
        cenas: new Set(),
        modelos: new Set(),
        zonas: new Set(),
        sons: new Set(),
      }),
    ).toEqual([]);
  });

  it("só monta o exemplo numa automação nova e vazia; a que já tem trabalho não se mexe", () => {
    expect(podeMontarOExemplo(fluxoNovo("a"))).toBe(true);
    expect(podeMontarOExemplo({ ...fluxoNovo("a"), nome: "Meu trabalho" })).toBe(false);
    const f = fluxoNovo("a");
    expect(podeMontarOExemplo({ ...f, nos: [...f.nos, { ...f.nos[0], id: "n2" }] } as never)).toBe(
      false,
    );
    expect(passosDoEditor(false).some((p) => p.tipo === "fazer")).toBe(false);
    expect(passosDoEditor(false).at(-1)?.id).toBe("sem-exemplo");
  });
});

describe("o tour das automações: a marca de visto (preferência do navegador, nunca da sala)", () => {
  const guardado = new Map<string, string>();
  const original = globalThis.localStorage;
  beforeEach(() => {
    guardado.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => guardado.get(k) ?? null,
        setItem: (k: string, v: string) => void guardado.set(k, v),
      },
    });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
  });

  it("usa a chave tabletop:pref:...", () => {
    expect(CHAVE_DO_TOUR_DAS_AUTOMACOES).toBe("tabletop:pref:tourDasAutomacoes");
    expect(CHAVE_DO_TOUR_DAS_AUTOMACOES_NO_TESTE.startsWith("tabletop:pref:")).toBe(true);
  });

  it("abre sozinho só com conta, fora do modo de teste, e só enquanto não foi visto", () => {
    expect(tourDasAutomacoesAbreSozinho({ login: "ana" })).toBe(true);
    expect(tourDasAutomacoesAbreSozinho({})).toBe(false);
    expect(tourDasAutomacoesAbreSozinho({ login: "ana", modoTeste: true })).toBe(false);
    guardado.set(CHAVE_DO_TOUR_DAS_AUTOMACOES_NO_TESTE, "1");
    expect(tourDasAutomacoesAbreSozinho({ modoTeste: true })).toBe(true);
    marcarTourDasAutomacoesVisto();
    expect(tourDasAutomacoesJaVisto()).toBe(true);
    expect(tourDasAutomacoesAbreSozinho({ login: "ana" })).toBe(false);
    expect(tourDasAutomacoesAbreSozinho({ modoTeste: true })).toBe(false);
  });

  it("sem armazenamento (privado, bloqueado) não quebra", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("bloqueado");
      },
    });
    expect(tourDasAutomacoesJaVisto()).toBe(false);
    expect(() => marcarTourDasAutomacoesVisto()).not.toThrow();
  });
});
