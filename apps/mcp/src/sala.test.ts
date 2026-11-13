import { type Usuario, visaoPara } from "@tabletop/shared";
import { afterEach, describe, expect, it } from "vitest";
import { type Config, lerConfig } from "./config.ts";
import { Sala, type SocketLike } from "./sala.ts";
import { estadoDeTeste } from "./testes/salaSimulada.ts";

const TOKEN = `tvc_${"A".repeat(43)}`;

describe("a configuração", () => {
  it("lê URL, mesa e token; o token ruim ou ausente dá um texto que diz o que fazer", () => {
    const c = lerConfig({
      TAVOLA_URL: "http://localhost:5173",
      TAVOLA_MESA: "abc-123",
      TAVOLA_TOKEN: TOKEN,
    });
    expect(c.urlWs).toBe("ws://localhost:5173/api/m/abc-123/ws");
    expect(c.urlHttp).toBe("http://localhost:5173/api/m/abc-123/ws");
    expect(() => lerConfig({ TAVOLA_MESA: "abc" })).toThrow(/Falta o TAVOLA_TOKEN/);
    expect(() => lerConfig({ TAVOLA_MESA: "abc", TAVOLA_TOKEN: "qualquer" })).toThrow(/formato/);
    expect(() => lerConfig({ TAVOLA_TOKEN: TOKEN })).toThrow(/Falta o TAVOLA_MESA/);
  });

  it("aceita o endereço do WebSocket ou da página, com a mesa no caminho, e https vira wss", () => {
    expect(
      lerConfig({ TAVOLA_URL: "wss://mesa.exemplo/api/m/xyz/ws", TAVOLA_TOKEN: TOKEN }).urlWs,
    ).toBe("wss://mesa.exemplo/api/m/xyz/ws");
    expect(
      lerConfig({ TAVOLA_URL: "https://mesa.exemplo/m/xyz", TAVOLA_TOKEN: TOKEN }).mesaId,
    ).toBe("xyz");
    // O padrão é a sala do `pnpm dev`.
    expect(lerConfig({ TAVOLA_MESA: "xyz", TAVOLA_TOKEN: TOKEN }).urlWs).toBe(
      "ws://127.0.0.1:8787/api/m/xyz/ws",
    );
  });

  it("o texto de erro nunca repete o token", () => {
    try {
      lerConfig({ TAVOLA_URL: "ftp://x", TAVOLA_MESA: "a", TAVOLA_TOKEN: TOKEN });
    } catch (e) {
      expect(String(e)).not.toContain(TOKEN);
    }
  });
});

class SocketDeMentira implements SocketLike {
  ouvintes = new Map<string, Array<(e: { data?: unknown; code?: number }) => void>>();
  enviados: string[] = [];
  addEventListener(tipo: string, f: (e: { data?: unknown; code?: number }) => void) {
    this.ouvintes.set(tipo, [...(this.ouvintes.get(tipo) ?? []), f]);
  }
  send(t: string) {
    this.enviados.push(t);
  }
  close() {}
  emitir(tipo: string, e: { data?: unknown; code?: number } = {}) {
    for (const f of this.ouvintes.get(tipo) ?? []) f(e);
  }
  receber(m: object) {
    this.emitir("message", { data: JSON.stringify({ v: 1, ...m }) });
  }
}

const config: Config = {
  urlWs: "ws://127.0.0.1:1/api/m/x/ws",
  urlHttp: "http://127.0.0.1:1/api/m/x/ws",
  mesaId: "x",
  token: TOKEN,
  compendio: null,
  esperaMs: 300,
};

let salas: Sala[] = [];
afterEach(() => {
  for (const s of salas) s.parar();
  salas = [];
});

function iniciar(opcoes: ConstructorParameters<typeof Sala>[1] = {}) {
  const sockets: SocketDeMentira[] = [];
  const sala = new Sala(config, {
    fabrica: () => {
      const s = new SocketDeMentira();
      sockets.push(s);
      return s;
    },
    sondar: async () => "fora",
    esperaDaReconexao: () => 5,
    ...opcoes,
  });
  salas.push(sala);
  sala.iniciar();
  const snapshot = (s: SocketDeMentira) => {
    const estado = estadoDeTeste();
    s.emitir("open");
    s.receber({
      tipo: "snapshot",
      dados: { usuarioId: "j1", estado: visaoPara(estado, estado.usuarios[1] as Usuario) },
    });
  };
  return { sala, sockets, snapshot };
}

describe("a conexão com a mesa", () => {
  it("fica pronta no snapshot e mostra o estado do usuário", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    await sala.esperarPronto(500);
    expect(sala.status).toBe("conectado");
    expect(sala.eu().nome).toBe("Ana");
  });

  it("o pedido leva loteId e a descrição e resolve com o evento da resposta", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const promessa = sala.enviar(
      "dado.rolar",
      { expressao: "1d20" },
      { loteId: "mcp-abc", lote: "rolou" },
    );
    await new Promise((r) => setTimeout(r, 5));
    const enviado = JSON.parse(no(sockets, 0).enviados[0] as string);
    expect(enviado).toMatchObject({ v: 1, tipo: "dado.rolar", loteId: "mcp-abc", lote: "rolou" });
    no(sockets, 0).receber({
      tipo: "evento",
      dados: {
        seq: 1,
        origem: { usuarioId: "j1", idPedido: enviado.id },
        tipo: "ordemDeTurno.alterada",
        dados: { visivel: true },
      },
    });
    const r = await promessa;
    expect(r.ok).toBe(true);
    expect(r.ok && r.evento?.tipo).toBe("ordemDeTurno.alterada");
  });

  it("o erro da sala volta com o código e a mensagem", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const promessa = sala.enviar("cena.criar", { id: "c9", nome: "X" });
    await new Promise((r) => setTimeout(r, 5));
    const enviado = JSON.parse(no(sockets, 0).enviados[0] as string);
    no(sockets, 0).receber({
      tipo: "erro",
      dados: {
        idPedido: enviado.id,
        codigo: "sem_permissao",
        mensagem: "Sem permissão (cena.editar).",
      },
    });
    expect(await promessa).toEqual({
      ok: false,
      codigo: "sem_permissao",
      mensagem: "Sem permissão (cena.editar).",
    });
  });

  it("publicar e descartar respondem com um snapshot novo, e isso vale como resposta", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const promessa = sala.enviar("rascunho.publicar", {});
    await new Promise((r) => setTimeout(r, 5));
    snapshot(no(sockets, 0));
    expect((await promessa).ok).toBe(true);
  });

  it("sem resposta (edição sem mudança) conta como feito depois da espera", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const r = await sala.enviar("ordemDeTurno.definir", { visivel: false });
    expect(r).toEqual({ ok: true });
  });

  it("intenção fora do schema nem sai do processo", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const r = await sala.enviar("cena.criar", { id: "c9" });
    expect(r.ok).toBe(false);
    expect(no(sockets, 0).enviados).toHaveLength(0);
  });

  it("fechamento 4001 (token revogado) não reconecta e responde o erro claro", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    no(sockets, 0).emitir("close", { code: 4001 });
    await new Promise((r) => setTimeout(r, 30));
    expect(sala.status).toBe("token_invalido");
    expect(sockets).toHaveLength(1);
    await expect(sala.esperarPronto(50)).rejects.toThrow(
      "Token inválido ou revogado: gere outro em Preferências → Conectar o Claude.",
    );
    expect(() => sala.estado()).toThrow(/Conectar o Claude/);
  });

  it("recusa 401 na abertura (a sonda diz token) também não reconecta", async () => {
    const { sala, sockets } = iniciar({ sondar: async () => "token", esperaDaReconexao: () => 5 });
    no(sockets, 0).emitir("close", { code: 1006 });
    await new Promise((r) => setTimeout(r, 30));
    expect(sala.status).toBe("token_invalido");
    expect(sockets).toHaveLength(1);
  });

  it("queda comum reconecta sozinha e volta a funcionar", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    no(sockets, 0).emitir("close", { code: 1006 });
    await new Promise((r) => setTimeout(r, 40));
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    snapshot(no(sockets, 1));
    await sala.esperarPronto(500);
    expect(sala.status).toBe("conectado");
  });

  it("o IP bloqueado e a mesa que não existe têm texto próprio (sem o token)", async () => {
    const a = iniciar({ sondar: async () => "bloqueado" });
    no(a.sockets, 0).emitir("close", { code: 1006 });
    await new Promise((r) => setTimeout(r, 20));
    expect(a.sala.textoDaRecusa()).toMatch(/bloqueou este computador/);
    const b = iniciar({ sondar: async () => "mesa" });
    no(b.sockets, 0).emitir("close", { code: 1006 });
    await new Promise((r) => setTimeout(r, 20));
    expect(b.sala.textoDaRecusa()).toMatch(/mesa não existe/);
    expect(a.sala.textoDaRecusa()).not.toContain(TOKEN);
  });

  it("um snapshot (o do desfazer de uma publicação) não encerra o pedido de Desfazer: só o claude.desfeito", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    const promessa = sala.enviar("claude.desfazer", { loteId: "mcp-9" });
    await new Promise((r) => setTimeout(r, 5));
    const enviado = JSON.parse(no(sockets, 0).enviados[0] as string);
    snapshot(no(sockets, 0));
    no(sockets, 0).receber({
      tipo: "claude.desfeito",
      dados: { idPedido: enviado.id, loteId: "mcp-9", aplicados: 3, pulados: [] },
    });
    const r = await promessa;
    expect(r.ok && r.desfeito).toEqual({ aplicados: 3, pulados: [] });
  });

  it("o Desfazer resolve pelo claude.desfeito e as listas de lotes ficam guardadas", async () => {
    const { sala, sockets, snapshot } = iniciar();
    snapshot(no(sockets, 0));
    no(sockets, 0).receber({
      tipo: "claude.lotes",
      dados: {
        lotes: [
          {
            loteId: "mcp-1",
            descricao: "criou 2 NPCs",
            emMs: 1,
            itens: 2,
            desfeito: false,
            desfazivel: true,
          },
        ],
      },
    });
    expect(sala.lotes()[0]?.descricao).toBe("criou 2 NPCs");
    const promessa = sala.enviar("claude.desfazer", { loteId: "mcp-1" });
    await new Promise((r) => setTimeout(r, 5));
    const enviado = JSON.parse(no(sockets, 0).enviados[0] as string);
    no(sockets, 0).receber({
      tipo: "claude.desfeito",
      dados: { idPedido: enviado.id, loteId: "mcp-1", aplicados: 2, pulados: ['ficha "Goblin"'] },
    });
    const r = await promessa;
    expect(r.ok && r.desfeito).toEqual({ aplicados: 2, pulados: ['ficha "Goblin"'] });
  });
});

function no(lista: SocketDeMentira[], i: number): SocketDeMentira {
  const s = lista[i];
  if (!s) throw new Error(`não houve o socket ${i}`);
  return s;
}
