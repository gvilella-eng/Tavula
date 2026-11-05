import { describe, expect, it } from "vitest";
import { comRetentativa, SalaIndisponivel } from "./api";

const semEspera = async () => {};

describe("comRetentativa", () => {
  it("espera a sala subir em vez de desistir", async () => {
    let chamadas = 0;
    const fn = async () => {
      chamadas++;
      if (chamadas < 3) throw new SalaIndisponivel();
      return "pronta";
    };
    await expect(comRetentativa(fn, undefined, semEspera)).resolves.toBe("pronta");
    expect(chamadas).toBe(3);
  });

  it("não insiste em erro que não é de sala indisponível", async () => {
    let chamadas = 0;
    const fn = async () => {
      chamadas++;
      throw new Error("usuário desconhecido");
    };
    await expect(comRetentativa(fn, undefined, semEspera)).rejects.toThrow("usuário desconhecido");
    expect(chamadas).toBe(1);
  });

  it("para quando a tela é desmontada", async () => {
    const controle = new AbortController();
    let chamadas = 0;
    const fn = async () => {
      chamadas++;
      throw new SalaIndisponivel();
    };
    const esperar = async () => controle.abort();
    await expect(comRetentativa(fn, controle.signal, esperar)).rejects.toBeInstanceOf(
      SalaIndisponivel,
    );
    expect(chamadas).toBe(1);
  });
});
