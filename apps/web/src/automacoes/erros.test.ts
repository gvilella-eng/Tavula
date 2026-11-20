import { CicloSchema, ReacaoSchema } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { erroDeSintaxeDoJson, erroDoCampo, errosEmPortugues, rotuloDoCaminho } from "./erros";

const ciclo = (extra: object) => ({
  id: "c",
  nome: "Respiração",
  periodoS: 180,
  cenas: [],
  fases: [{ emS: 0, evento: "inspiracao" }],
  ...extra,
});

function erros(schema: typeof CicloSchema | typeof ReacaoSchema, valor: unknown) {
  const r = schema.safeParse(valor);
  if (r.success) throw new Error("devia falhar");
  return errosEmPortugues(r.error);
}

describe("erros do zod em português", () => {
  it("campo obrigatório e número fora do limite dizem o campo e o que corrigir", () => {
    const e = erros(CicloSchema, ciclo({ nome: undefined, periodoS: -5 }));
    expect(e.map((x) => x.texto)).toEqual(
      expect.arrayContaining([
        "Nome: preencha este campo.",
        "Período (segundos): precisa ser maior que 0.",
      ]),
    );
    expect(erroDoCampo(e, "periodoS")).toBe("precisa ser maior que 0.");
  });

  it("o caminho das fases aponta a linha certa", () => {
    const e = erros(
      CicloSchema,
      ciclo({
        fases: [
          { emS: 0, evento: "a" },
          { emS: -1, evento: "b" },
        ],
      }),
    );
    expect(e[0]?.caminho).toBe("fases.1.emS");
    expect(e[0]?.texto).toBe("Fase 2: Em quantos segundos: precisa ser pelo menos 0.");
  });

  it("as frases que o schema já escreveu passam como estão", () => {
    const e = erros(CicloSchema, ciclo({ fases: [{ emS: 200, evento: "a" }] }));
    expect(e.some((x) => x.mensagem === "A fase precisa cair antes do fim do período.")).toBe(true);
    // AU2: o nome do evento (do sinal) é o que a pessoa escreveu, com acento e espaço; só o vazio é recusado.
    expect(
      CicloSchema.safeParse(ciclo({ fases: [{ emS: 0, evento: "Inspiração dela" }] })).success,
    ).toBe(true);
    expect(erros(CicloSchema, ciclo({ fases: [{ emS: 0, evento: "  " }] }))[0]?.mensagem).toBe(
      "não pode ficar vazio.",
    );
  });

  it("lista vazia, texto vazio e tipo errado", () => {
    expect(erros(CicloSchema, ciclo({ fases: [] }))[0]?.mensagem).toBe(
      "inclua pelo menos um item.",
    );
    expect(erros(CicloSchema, ciclo({ nome: "" }))[0]?.mensagem).toBe("não pode ficar vazio.");
    expect(erros(CicloSchema, ciclo({ periodoS: "x" }))[0]?.mensagem).toBe(
      "precisa ser um número.",
    );
  });

  it("a ação com tipo que não existe aponta a ação", () => {
    const e = erros(ReacaoSchema, {
      id: "r",
      fica: { tipo: "mesa" },
      ao: "x",
      fazer: [{ acao: "explodir" }],
    });
    expect(e[0]?.texto).toContain("Ação 1");
  });

  it("o raio sem fator nem soma fala em português", () => {
    const e = erros(ReacaoSchema, {
      id: "r",
      fica: { tipo: "mesa" },
      ao: "x",
      fazer: [{ acao: "luz.modificar" }],
    });
    expect(e[0]?.mensagem).toBe("Diga o raioX, o raioSomaM ou os dois.");
  });

  it("rótulos do caminho", () => {
    expect(rotuloDoCaminho(["fazer", 2, "chance"])).toBe("Ação 3: Chance");
    expect(rotuloDoCaminho([])).toBe("");
  });

  it("erro de escrita do JSON em português", () => {
    expect(
      erroDeSintaxeDoJson("{\n\n  x", new Error("Expected property name at position 5")),
    ).toMatch(/linha 3, coluna 3/);
    expect(erroDeSintaxeDoJson("{", new Error("Unexpected end of JSON input"))).toMatch(
      /incompleto/,
    );
    expect(
      erroDeSintaxeDoJson("]", new Error("Unexpected token ']', \"]\" is not valid JSON")),
    ).toMatch(/perto de "]"/);
    expect(erroDeSintaxeDoJson("x", new Error("outra coisa"))).toMatch(/erro de escrita/);
  });
});
