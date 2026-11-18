import { describe, expect, it } from "vitest";
import { secao } from "./secoes";

// Q15: o comparador das seções em `memo` (caminho `npc.<campo>`, `props` aninhado e a fatia livre `mudou`). O `memo` do
// React guarda o comparador em `.compare`: devolve `true` quando a seção pode ficar como está.

type Comparador = (a: object, b: object) => boolean;
const comparador = (componente: unknown) => (componente as { compare: Comparador }).compare;
const vazio = () => null;

describe("secao: caminho dentro do NPC", () => {
  const s = comparador(secao("Teste", vazio, { ficha: ["npc.sentidos"] }));
  it("só redesenha quando o campo declarado muda", () => {
    const a = { ficha: { npc: { sentidos: "x", nd: "1" } } };
    expect(s(a, { ficha: { npc: { sentidos: "x", nd: "2" } } })).toBe(true);
    expect(s(a, { ficha: { npc: { sentidos: "y", nd: "1" } } })).toBe(false);
  });
});

describe("secao: props aninhado", () => {
  const s = comparador(secao("Teste", vazio, { ficha: ["magias"], d: ["espacos"] } as never));
  const ficha = { magias: [1], atributos: { for: 10 } };
  const d = { espacos: [1], pericias: [1] };
  const base = { editar: true, ficha, d };
  it("ignora o objeto novo se o que há dentro vale o mesmo", () => {
    expect(s({ n: 1, props: base }, { n: 1, props: { ...base } })).toBe(true);
  });
  it("vale pelas fatias da ficha e de d dentro de props", () => {
    expect(
      s({ n: 1, props: base }, { n: 1, props: { ...base, ficha: { ...ficha, atributos: {} } } }),
    ).toBe(true);
    expect(
      s({ n: 1, props: base }, { n: 1, props: { ...base, ficha: { ...ficha, magias: [2] } } }),
    ).toBe(false);
    expect(s({ n: 1, props: base }, { n: 1, props: { ...base, d: { ...d, espacos: [2] } } })).toBe(
      false,
    );
  });
  it("uma prop comum de dentro, por identidade, redesenha", () => {
    expect(s({ n: 1, props: base }, { n: 1, props: { ...base, editar: false } })).toBe(false);
    expect(s({ n: 1, props: base }, { n: 2, props: base })).toBe(false);
  });
});

describe("secao: fatia livre", () => {
  const s = comparador(
    secao("Teste", vazio, {
      fichaExceto: ["magias"],
      mudou: (
        a: { props: { ficha: { magias: number[] } } },
        b: { props: { ficha: { magias: number[] } } },
      ) => a.props.ficha.magias[0] !== b.props.ficha.magias[0],
    } as never),
  );
  it("a fatia decide sobre a chave tirada da declaração", () => {
    const a = { props: { ficha: { magias: [1, 5] } } };
    expect(s(a, { props: { ficha: { magias: [1, 9] } } })).toBe(true);
    expect(s(a, { props: { ficha: { magias: [2, 5] } } })).toBe(false);
  });
});
