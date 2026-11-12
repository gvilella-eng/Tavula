import { describe, expect, it } from "vitest";
import { origemPermitida } from "./origem";

describe("origem do pedido", () => {
  it("sem Origin aceita (clientes que não mandam)", () => {
    expect(origemPermitida(null, new URL("https://mesa.exemplo.com/api/m/x/ws"))).toBe(true);
  });

  it("mesma origem passa; outro site, outro porto e esquema estranho não", () => {
    const url = new URL("https://mesa.exemplo.com/api/mesas");
    expect(origemPermitida("https://mesa.exemplo.com", url)).toBe(true);
    expect(origemPermitida("https://evil.example", url)).toBe(false);
    expect(origemPermitida("https://mesa.exemplo.com:8443", url)).toBe(false);
    expect(origemPermitida("https://mesa.exemplo.com.evil.example", url)).toBe(false);
    expect(origemPermitida("null", url)).toBe(false);
    expect(origemPermitida("file://", url)).toBe(false);
    expect(origemPermitida("", url)).toBe(false);
  });

  it("no computador local (loopback) o Vite passa, mas site de fora não; na internet loopback não vale", () => {
    const local = new URL("http://127.0.0.1:8787/api/mesas");
    expect(origemPermitida("http://127.0.0.1:5173", local)).toBe(true);
    expect(origemPermitida("http://localhost:5173", local)).toBe(true);
    expect(origemPermitida("https://evil.example", local)).toBe(false);
    const internet = new URL("https://mesa.exemplo.com/api/mesas");
    expect(origemPermitida("http://localhost:5173", internet)).toBe(false);
  });
});
