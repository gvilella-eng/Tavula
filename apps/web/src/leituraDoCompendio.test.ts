import { describe, expect, it, vi } from "vitest";
import { TEXTO_DO_EXEMPLO_SRD } from "./exemploSrd";
import { type CacheDeLeituras, lerUmaVez } from "./leituraDoCompendio";

const novoCache = (): CacheDeLeituras => new Map();

describe("lerUmaVez", () => {
  it("lê uma vez por hash e devolve o MESMO objeto às duas chamadas", async () => {
    const cache = novoCache();
    const obter = vi.fn(async () => TEXTO_DO_EXEMPLO_SRD);
    const a = await lerUmaVez("h1", obter, cache);
    const b = await lerUmaVez("h1", obter, cache);
    expect(obter).toHaveBeenCalledTimes(1);
    expect(a?.ok).toBe(true);
    expect(b).toBe(a);
    if (a?.ok && b?.ok) expect(b.compendio).toBe(a.compendio);
  });

  it("chamadas simultâneas dividem a mesma leitura", async () => {
    const cache = novoCache();
    const obter = vi.fn(async () => TEXTO_DO_EXEMPLO_SRD);
    const [a, b] = await Promise.all([
      lerUmaVez("h1", obter, cache),
      lerUmaVez("h1", obter, cache),
    ]);
    expect(obter).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("texto null não fica guardado: a próxima chamada tenta de novo", async () => {
    const cache = novoCache();
    const obter = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null);
    expect(await lerUmaVez("h1", obter, cache)).toBeNull();
    expect(cache.size).toBe(0);
    obter.mockResolvedValueOnce(TEXTO_DO_EXEMPLO_SRD);
    const r = await lerUmaVez("h1", obter, cache);
    expect(obter).toHaveBeenCalledTimes(2);
    expect(r?.ok).toBe(true);
  });

  it("o resultado inválido também fica guardado", async () => {
    const cache = novoCache();
    const obter = vi.fn(async () => "isto não é um compêndio");
    const a = await lerUmaVez("h1", obter, cache);
    const b = await lerUmaVez("h1", obter, cache);
    expect(a?.ok).toBe(false);
    expect(b).toBe(a);
    expect(obter).toHaveBeenCalledTimes(1);
  });

  it("se pedir o texto falhar, a falha passa adiante e nada fica guardado", async () => {
    const cache = novoCache();
    await expect(
      lerUmaVez("h1", () => Promise.reject(new Error("sem arquivo")), cache),
    ).rejects.toThrow("sem arquivo");
    expect(cache.size).toBe(0);
  });

  it("guarda só os hashes mais recentes (o usado há mais tempo sai primeiro)", async () => {
    const cache = novoCache();
    const obter = vi.fn(async () => TEXTO_DO_EXEMPLO_SRD);
    await lerUmaVez("h1", obter, cache, 2);
    await lerUmaVez("h2", obter, cache, 2);
    // h1 foi usado de novo: o mais antigo agora é h2.
    await lerUmaVez("h1", obter, cache, 2);
    await lerUmaVez("h3", obter, cache, 2);
    expect([...cache.keys()]).toEqual(["h1", "h3"]);
    expect(obter).toHaveBeenCalledTimes(3);
    // h2 saiu: lê de novo.
    await lerUmaVez("h2", obter, cache, 2);
    expect(obter).toHaveBeenCalledTimes(4);
    expect(cache.size).toBe(2);
  });
});
