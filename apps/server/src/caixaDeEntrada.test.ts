import { LIMITES_DO_ENVIO, sha256Hex } from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { Armazenamento } from "./armazenamento";
import { CaixaDeEntrada, type NovoEnvio, publicoDoEnvio } from "./caixaDeEntrada";

// O SQLite do Durable Object só existe no workerd: o mesmo adaptador do `armazenamento.test.ts` sobre o `node:sqlite`.
type Banco = {
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    run(...p: unknown[]): { changes: number };
  };
};

async function abrir() {
  const modulo = (await import(`node:${"sqlite"}`)) as {
    DatabaseSync: new (caminho: string) => Banco;
  };
  const db = new modulo.DatabaseSync(":memory:");
  const sql = {
    exec(consulta: string, ...params: unknown[]) {
      // O workerd aceita ArrayBuffer nos bytes; o node:sqlite quer uma visão.
      const ligados = params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p));
      const declaracao = db.prepare(consulta);
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(consulta)) {
        const linhas = declaracao.all(...ligados);
        return { toArray: () => linhas, rowsWritten: 0 };
      }
      const r = declaracao.run(...ligados);
      return { toArray: () => [], rowsWritten: r.changes };
    },
  };
  return sql;
}

const T0 = 1_000_000;

async function caixaNova() {
  const sql = await abrir();
  // As migrações de verdade: a tabela nova vem da migração do M1 (e rodar de novo não faz nada).
  const banco = new Armazenamento(sql as never);
  banco.migrar();
  banco.migrar();
  return { caixa: new CaixaDeEntrada(sql as never), banco };
}

async function novo(sobra: Partial<NovoEnvio> = {}): Promise<NovoEnvio> {
  const segredo = `tve_${crypto.randomUUID()}`;
  return {
    usuarioId: "m",
    tokenId: "tok1",
    uso: "mapa",
    nome: "cripta.png",
    alvo: { cenaId: "c1" },
    opcoes: { quadrados: 45 },
    loteId: "mcp-1",
    loteDescricao: "Enviou mapa da cena: cripta.png",
    hashDoSegredo: await sha256Hex(new TextEncoder().encode(segredo)),
    ...sobra,
  };
}

describe("M1: o link de envio vale uma vez", () => {
  it("o primeiro uso passa; o segundo é recusado", async () => {
    const { caixa } = await caixaNova();
    const n = await novo();
    const id = caixa.criar(n, T0);
    const a = caixa.gastarLink(n.hashDoSegredo, T0 + 1000);
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.envio.id).toBe(id);
    const b = caixa.gastarLink(n.hashDoSegredo, T0 + 2000);
    expect(b).toEqual({ ok: false, motivo: "usado" });
  });

  it("um segredo que não existe é desconhecido", async () => {
    const { caixa } = await caixaNova();
    expect(caixa.gastarLink("0".repeat(64), T0)).toEqual({ ok: false, motivo: "desconhecido" });
  });

  it("depois de 15 minutos o link venceu e o envio vira erro", async () => {
    const { caixa } = await caixaNova();
    const n = await novo();
    const id = caixa.criar(n, T0);
    expect(caixa.gastarLink(n.hashDoSegredo, T0 + LIMITES_DO_ENVIO.prazoDoLinkMs + 1)).toEqual({
      ok: false,
      motivo: "vencido",
    });
    expect(caixa.ler(id)?.estado).toBe("erro");
    expect(caixa.ler(id)?.motivo).toMatch(/venceu/);
    // Mesmo no limite, ainda vale.
    const m = await novo();
    caixa.criar(m, T0);
    expect(caixa.gastarLink(m.hashDoSegredo, T0 + LIMITES_DO_ENVIO.prazoDoLinkMs).ok).toBe(true);
  });

  it("o link que ninguém usou vira erro na faxina e nunca guarda o segredo, só o hash", async () => {
    const { caixa } = await caixaNova();
    const n = await novo();
    const id = caixa.criar(n, T0);
    caixa.limpar(T0 + LIMITES_DO_ENVIO.prazoDoLinkMs + 5);
    expect(caixa.ler(id)?.estado).toBe("erro");
    expect(JSON.stringify(caixa.ler(id))).not.toContain("tve_");
  });
});

describe("M1: a caixa guarda os bytes em linhas e solta tudo no fim", () => {
  it("grava em pedaços, remonta na ordem e apaga quando o uso é aplicado", async () => {
    const { caixa } = await caixaNova();
    const n = await novo();
    const id = caixa.criar(n, T0);
    caixa.gastarLink(n.hashDoSegredo, T0);
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    caixa.gravarPedaco(id, 0, a);
    caixa.gravarPedaco(id, 1, b);
    caixa.receber(id, 5, "image/png", T0 + 10);
    expect(caixa.ler(id)?.estado).toBe("recebido");
    expect(caixa.bytesNaCaixa()).toBe(5);
    expect([...caixa.lerBytes(id)]).toEqual([1, 2, 3, 4, 5]);

    caixa.aplicar(id, "ab".repeat(32), "O mapa entrou na cena.");
    expect(caixa.indicesDosPedacos(id)).toEqual([]);
    expect(caixa.bytesNaCaixa()).toBe(0);
    const p = publicoDoEnvio(caixa.ler(id) as never);
    expect(p).toMatchObject({ estado: "aplicado", hash: "ab".repeat(32) });
    // O que o Claude vê não tem token, usuário nem bytes.
    expect(Object.keys(p)).not.toContain("tokenId");
    expect(Object.keys(p)).not.toContain("usuarioId");
  });

  it("falhar apaga os bytes e guarda o motivo", async () => {
    const { caixa } = await caixaNova();
    const n = await novo();
    const id = caixa.criar(n, T0);
    caixa.gravarPedaco(id, 0, new Uint8Array([9]));
    caixa.receber(id, 1, "image/png", T0);
    caixa.falhar(id, "O navegador não conseguiu abrir a imagem.");
    expect(caixa.ler(id)).toMatchObject({ estado: "erro", bytes: 0 });
    expect(caixa.indicesDosPedacos(id)).toEqual([]);
    // Depois de aplicado, um falhar atrasado não desfaz o resultado.
    const m = await novo();
    const id2 = caixa.criar(m, T0);
    caixa.receber(id2, 1, "image/png", T0);
    caixa.aplicar(id2, "cd".repeat(32), "ok");
    caixa.falhar(id2, "tarde");
    expect(caixa.ler(id2)?.estado).toBe("aplicado");
  });

  it("o arquivo que passou de 24 horas some com os bytes; o recém-chegado fica", async () => {
    const { caixa } = await caixaNova();
    const velho = await novo();
    const idVelho = caixa.criar(velho, T0);
    caixa.gravarPedaco(idVelho, 0, new Uint8Array([1]));
    caixa.receber(idVelho, 1, "image/png", T0);
    const novoEnvio = await novo({ tokenId: "tok2" });
    const idNovo = caixa.criar(novoEnvio, T0 + LIMITES_DO_ENVIO.prazoDoArquivoMs - 1000);
    caixa.gravarPedaco(idNovo, 0, new Uint8Array([2]));
    caixa.receber(idNovo, 1, "image/png", T0 + LIMITES_DO_ENVIO.prazoDoArquivoMs - 1000);
    caixa.limpar(T0 + LIMITES_DO_ENVIO.prazoDoArquivoMs + 1);
    expect(caixa.ler(idVelho)).toBeUndefined();
    expect(caixa.indicesDosPedacos(idVelho)).toEqual([]);
    expect(caixa.ler(idNovo)?.estado).toBe("recebido");
    expect([...caixa.lerBytes(idNovo)]).toEqual([2]);
  });

  it("os pendentes são os recebidos e os que o navegador largou no meio (mais de 90 s processando)", async () => {
    const { caixa } = await caixaNova();
    const a = caixa.criar(await novo(), T0);
    const b = caixa.criar(await novo({ tokenId: "tok2" }), T0 + 1);
    const c = caixa.criar(await novo({ tokenId: "tok3" }), T0 + 2);
    for (const id of [a, b, c]) caixa.receber(id, 1, "image/png", T0);
    caixa.marcarProcessando(b, T0 + 100);
    // `a` e `c` esperam; `b` está sendo processado agora e não é oferecido de novo.
    expect(caixa.pendentes(T0 + 200).map((e) => e.id)).toEqual([a, c]);
    // Passou o prazo do processamento: `b` volta à fila (o navegador fechou no meio).
    expect(caixa.pendentes(T0 + 100 + 90_001).map((e) => e.id)).toEqual([a, b, c]);
  });
});

describe("M1: tetos", () => {
  it("conta os envios abertos por token (esperando, recebido e processando), não os acabados", async () => {
    const { caixa } = await caixaNova();
    const ids = [] as string[];
    for (let i = 0; i < 3; i++) ids.push(caixa.criar(await novo(), T0));
    caixa.criar(await novo({ tokenId: "outro" }), T0);
    expect(caixa.abertosDoToken("tok1", T0 + 1)).toBe(3);
    caixa.receber(ids[0] as string, 1, "image/png", T0);
    caixa.aplicar(ids[0] as string, "ab".repeat(32), "ok");
    caixa.falhar(ids[1] as string, "x");
    expect(caixa.abertosDoToken("tok1", T0 + 1)).toBe(1);
  });

  it("a soma dos bytes da caixa só conta o que espera ou está sendo processado", async () => {
    const { caixa } = await caixaNova();
    const a = caixa.criar(await novo(), T0);
    const b = caixa.criar(await novo({ tokenId: "t2" }), T0);
    caixa.receber(a, 1000, "image/png", T0);
    caixa.receber(b, 2000, "image/png", T0);
    expect(caixa.bytesNaCaixa()).toBe(3000);
    caixa.aplicar(a, "ab".repeat(32), "ok");
    expect(caixa.bytesNaCaixa()).toBe(2000);
    expect(LIMITES_DO_ENVIO.bytesDaCaixa).toBe(300 * 1024 * 1024);
  });
});

describe("M1: a migração da caixa", () => {
  it("é aditiva e idempotente: roda duas vezes sem erro e não mexe nas outras tabelas", async () => {
    const sql = await abrir();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const antes = sql.exec("SELECT COUNT(*) AS n FROM entidades").toArray();
    banco.migrar();
    expect(sql.exec("SELECT COUNT(*) AS n FROM entidades").toArray()).toEqual(antes);
    const tabelas = (
      sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray() as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(tabelas).toContain("claude_envios");
    expect(tabelas).toContain("claude_envios_pedacos");
    expect(tabelas).toContain("claude_lotes");
  });

  it("uma mesa que já tinha a versão anterior do esquema ganha só as tabelas novas", async () => {
    const sql = await abrir();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    // Volta a versão do esquema uma migração (a do M1 é a última) e apaga as tabelas dela, como numa mesa antiga.
    const versao = Number(banco.lerMeta("versao_esquema"));
    sql.exec("DROP TABLE claude_envios_pedacos");
    sql.exec("DROP TABLE claude_envios");
    banco.gravarMeta("versao_esquema", String(versao - 1));
    banco.migrar();
    expect(Number(banco.lerMeta("versao_esquema"))).toBe(versao);
    const caixa = new CaixaDeEntrada(sql as never);
    expect(caixa.abertosDoToken("x", T0)).toBe(0);
  });
});
