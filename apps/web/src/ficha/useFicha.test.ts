import { aplicarOperacoes, type Ficha, fichaNova, type OperacaoDeFicha } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { filaCom, proporOperacoes, vivasDe } from "./useFicha";

/** A montagem da fila como o código anterior fazia, operação a operação (muta a fila). */
function filaDeAntes(fila: OperacaoDeFicha[], operacoes: OperacaoDeFicha[]): void {
  for (const op of operacoes) {
    const anterior = fila[fila.length - 1];
    if (anterior && anterior.caminho === op.caminho) fila[fila.length - 1] = op;
    else fila.push(op);
  }
}

const op = (caminho: string, valor: unknown): OperacaoDeFicha => ({ caminho, valor });

/** Uma "tecla" = uma chamada de `alterar`; cada item é a lista de operações dela. */
const SEQUENCIAS: Record<string, OperacaoDeFicha[][]> = {
  texto: [[op("raca", "E")], [op("raca", "El")], [op("raca", "Elf")], [op("antecedente", "Sábio")]],
  numero: [[op("pvAtual", 7)], [op("pvAtual", 6)], [op("pvMax", 12)], [op("ca.valor", 15)]],
  aninhado: [
    [op("atributos.for", 14)],
    [op("atributos.des", 16)],
    [op("atributos.for", 15)],
    [op("classes.0", { classe: "Guerreiro", nivel: 3 })],
    [op("classes.0.nivel", 4)],
  ],
  "varias por tecla": [
    [op("raca", "Anão"), op("antecedente", "Soldado")],
    [op("antecedente", "Soldado"), op("antecedente", "Nobre")],
    [op("ca.valor", 16), op("ca.nota", "escudo")],
  ],
  "remover campo": [[op("raca", "Elfo")], [op("antecedente", "Sábio")], [op("raca", null)]],
};

describe("filaCom", () => {
  it("a operação do mesmo caminho da última substitui a última", () => {
    const fila = [op("raca", "E")];
    const nova = filaCom(fila, [op("raca", "El")]);
    expect(nova).toEqual([op("raca", "El")]);
    expect(filaCom(nova, [op("antecedente", "x")])).toEqual([
      op("raca", "El"),
      op("antecedente", "x"),
    ]);
  });

  it("só substitui a ÚLTIMA: o mesmo caminho mais atrás soma", () => {
    const fila = [op("raca", "E"), op("antecedente", "S")];
    expect(filaCom(fila, [op("raca", "El")])).toEqual([
      op("raca", "E"),
      op("antecedente", "S"),
      op("raca", "El"),
    ]);
  });

  it("não altera a fila de entrada", () => {
    const fila = [op("raca", "E")];
    filaCom(fila, [op("raca", "El"), op("antecedente", "x")]);
    expect(fila).toEqual([op("raca", "E")]);
  });

  it("repetidas na mesma chamada também se substituem", () => {
    expect(filaCom([], [op("raca", "a"), op("raca", "b"), op("ca.valor", 3)])).toEqual([
      op("raca", "b"),
      op("ca.valor", 3),
    ]);
  });

  for (const [nome, teclas] of Object.entries(SEQUENCIAS)) {
    it(`${nome}: a fila e a ficha batem com o jeito de antes, tecla a tecla`, () => {
      const base: Ficha = fichaNova(10);
      // Antes: valida cada tecla sobre a ficha calculada e muta a fila; a tela mostrava `aplicarOperacoes(base, fila)`.
      const filaAntiga: OperacaoDeFicha[] = [];
      let calculada: Ficha = base;
      // Agora: uma validação por tecla, sobre a base, com a fila nova.
      let filaNova: OperacaoDeFicha[] = [];
      for (const operacoes of teclas) {
        const validou = aplicarOperacoes(calculada, operacoes).ok;
        const r = proporOperacoes(base, [], filaNova, operacoes);
        expect(r.ok).toBe(validou);
        if (!validou || !r.ok) continue;
        filaDeAntes(filaAntiga, operacoes);
        filaNova = r.fila;
        expect(filaNova).toEqual(filaAntiga);
        const mostrada = aplicarOperacoes(base, filaAntiga);
        expect(mostrada.ok).toBe(true);
        if (!mostrada.ok) throw new Error("não devia falhar");
        calculada = mostrada.ficha;
        expect(r.ficha).toEqual(calculada);
        expect(aplicarOperacoes(base, filaNova)).toEqual(mostrada);
      }
    });
  }
});

describe("proporOperacoes", () => {
  it("recusa a operação inválida no meio sem mudar a fila, e a seguinte continua valendo", () => {
    const base = fichaNova(10);
    const t1 = proporOperacoes(base, [], [], [op("raca", "Elfo")]);
    expect(t1.ok).toBe(true);
    if (!t1.ok) return;
    const fila = t1.fila;
    const copia = [...fila];
    // nível 99 passa do máximo; "__proto__" é caminho proibido; atributo fora da faixa
    for (const ruim of [
      op("classes.0", { classe: "Mago", nivel: 99 }),
      op("__proto__.x", 1),
      op("atributos.for", 99),
    ]) {
      const r = proporOperacoes(base, [], fila, [ruim]);
      expect(r).toEqual({ ok: false });
      expect(fila).toEqual(copia);
    }
    const t3 = proporOperacoes(base, [], fila, [op("antecedente", "Sábio")]);
    expect(t3.ok).toBe(true);
    if (t3.ok) expect(t3.ficha).toMatchObject({ raca: "Elfo", antecedente: "Sábio" });
  });

  it("uma operação boa e outra inválida na mesma chamada: nenhuma vale", () => {
    const r = proporOperacoes(
      fichaNova(10),
      [],
      [op("raca", "Elfo")],
      [op("antecedente", "Sábio"), op("atributos.for", 99)],
    );
    expect(r).toEqual({ ok: false });
  });

  it("as enviadas vivas entram por baixo da fila", () => {
    const base = fichaNova(10);
    const enviadas = [{ ops: [op("raca", "Elfo")], ate: 1000 }];
    const vivas = vivasDe(enviadas, 500);
    const r = proporOperacoes(base, vivas, [], [op("antecedente", "Sábio")]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ficha).toMatchObject({ raca: "Elfo", antecedente: "Sábio" });
    // vencidas não contam
    expect(vivasDe(enviadas, 1000)).toEqual([]);
  });

  it("o resultado é o mesmo de aplicar vivas + fila de uma vez sobre a base", () => {
    const base = fichaNova(10);
    const vivas = [op("pvAtual", 4)];
    const fila = [op("raca", "Elfo")];
    const r = proporOperacoes(base, vivas, fila, [op("ca.valor", 14)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(aplicarOperacoes(base, [...vivas, ...r.fila])).toEqual({ ok: true, ficha: r.ficha });
  });
});
