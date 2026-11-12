import { describe, expect, it } from "vitest";
import {
  ArmazemDeMemoria,
  chaveAntigaDaMemoria,
  chaveDaMemoria,
  type RegistroDeMemoria,
} from "./memoriaLocal";

const registro = (marca: number): RegistroDeMemoria => ({
  colunas: 2,
  linhas: 2,
  celulaM: 5,
  dados: Uint8Array.from([marca, 0, 0, 0]),
  esquecimento: 0,
});

// No Node não há IndexedDB: o armazém cai na cópia em memória, que é o que interessa aqui (a regra da chave).
describe("memória do mapa por mesa", () => {
  it("a chave leva o id da mesa: o mesmo usuário e a mesma cena em mesas diferentes não se misturam", () => {
    expect(chaveDaMemoria("aaaa-aaaa-aaaa", "mestre", "cena-1")).toBe(
      "aaaa-aaaa-aaaa|mestre|cena-1",
    );
    expect(chaveDaMemoria("aaaa-aaaa-aaaa", "mestre", "cena-1")).not.toBe(
      chaveDaMemoria("bbbb-bbbb-bbbb", "mestre", "cena-1"),
    );
    expect(chaveAntigaDaMemoria("mestre", "cena-1")).toBe("mestre|cena-1");
  });

  it("uma mesa que não é a legada nunca enxerga o que outra explorou", async () => {
    const armazem = new ArmazemDeMemoria();
    await armazem.gravar(chaveDaMemoria("aaaa-aaaa-aaaa", "jogador-1", "cena-1"), registro(9));
    expect(
      await armazem.ler(chaveDaMemoria("bbbb-bbbb-bbbb", "jogador-1", "cena-1")),
    ).toBeUndefined();
    expect(
      await armazem.ler(chaveDaMemoria("aaaa-aaaa-aaaa", "jogador-1", "cena-1")),
    ).toBeDefined();
  });

  it("a mesa legada herda a chave antiga na primeira vez: copia para a nova e deixa a antiga onde estava", async () => {
    const armazem = new ArmazemDeMemoria();
    const antiga = chaveAntigaDaMemoria("jogador-1", "cena-1");
    const nova = chaveDaMemoria("legada-id-aaaa", "jogador-1", "cena-1");
    await armazem.gravar(antiga, registro(7));
    const lido = await armazem.ler(nova, antiga);
    expect(lido?.dados[0]).toBe(7);
    // agora a chave nova já tem o registro, sem precisar da antiga
    expect((await armazem.ler(nova))?.dados[0]).toBe(7);
    // a antiga continua lá
    expect((await armazem.ler(antiga))?.dados[0]).toBe(7);
  });

  it("a chave nova, quando existe, vale mais que a antiga", async () => {
    const armazem = new ArmazemDeMemoria();
    const antiga = chaveAntigaDaMemoria("jogador-1", "cena-1");
    const nova = chaveDaMemoria("legada-id-aaaa", "jogador-1", "cena-1");
    await armazem.gravar(antiga, registro(1));
    await armazem.gravar(nova, registro(2));
    expect((await armazem.ler(nova, antiga))?.dados[0]).toBe(2);
  });
});
