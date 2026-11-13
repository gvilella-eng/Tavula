import {
  estadoDeMesaNova,
  FORMATO_DO_TOKEN_DO_CLAUDE,
  MAXIMO_DE_LOTES_POR_USUARIO,
  type Passo,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { Armazenamento } from "./armazenamento";
import { ContasDaMesa, hashDoToken } from "./contas";

// 12-1: os tokens de acesso do Claude (só o hash no banco, revogação, bloqueio por IP) e o diário do Desfazer.

type Banco = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    run(...p: unknown[]): { changes: number };
  };
};

async function abrirBanco() {
  const modulo = (await import(`node:${"sqlite"}`)) as {
    DatabaseSync: new (caminho: string) => Banco;
  };
  const db = new modulo.DatabaseSync(":memory:");
  const sql = {
    exec(consulta: string, ...params: unknown[]) {
      const declaracao = db.prepare(consulta);
      const retorna = /^\s*(SELECT|PRAGMA|WITH)/i.test(consulta);
      if (retorna) {
        const linhas = declaracao.all(...params);
        return { toArray: () => linhas, rowsWritten: 0 };
      }
      const r = declaracao.run(...params);
      return { toArray: () => [], rowsWritten: r.changes };
    },
  };
  return { db, sql };
}

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const derivada = (c: string) => c.repeat(43).slice(0, 43);

async function mesa() {
  const { sql } = await abrirBanco();
  const arm = new Armazenamento(sql as never);
  arm.migrar();
  const contas = new ContasDaMesa(sql as never);
  const m = await contas.criarMestre(
    { login: "Mestre", nome: "Mestre", derivada: derivada("a") },
    "mestre",
    T0,
  );
  if (!m.ok) throw new Error("mestre");
  const p = await contas.pedir(
    { login: "ana", nome: "Ana", derivada: derivada("b") },
    "1.1.1.1",
    T0 + MIN,
  );
  if (!p.ok) throw new Error("pedir");
  const a = contas.aceitar(p.valor.id, "j1");
  if (!a.ok) throw new Error("aceitar");
  return { sql, arm, contas, mestreId: m.valor.id, anaId: p.valor.id };
}

describe("tokens do Claude", () => {
  it("o token tem 32 bytes aleatórios (43 caracteres) e o banco guarda só o SHA-256", async () => {
    const { contas, sql, mestreId } = await mesa();
    const r = await contas.gerarTokenDoClaude(mestreId, "mestre", "Claude no meu PC", T0 + 2 * MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.token).toMatch(FORMATO_DO_TOKEN_DO_CLAUDE);
    expect(r.valor.token.length).toBe(4 + 43);
    const linhas = sql.exec("SELECT * FROM tokens_claude").toArray() as Record<string, unknown>[];
    expect(linhas).toHaveLength(1);
    const texto = JSON.stringify(linhas);
    expect(texto).not.toContain(r.valor.token);
    expect(linhas[0]?.hash_token).toBe(await hashDoToken(r.valor.token));
    expect(linhas[0]).toMatchObject({
      conta_id: mestreId,
      usuario_id: "mestre",
      nome: "Claude no meu PC",
    });
    // dois tokens nunca são iguais
    const outro = await contas.gerarTokenDoClaude(mestreId, "mestre", "", T0 + 3 * MIN);
    expect(outro.ok && outro.valor.token !== r.valor.token).toBe(true);
    // sem nome: um nome padrão
    expect(outro.ok && outro.valor.publico.nome).toBe("Claude");
  });

  it("a lista nunca devolve o token nem o hash; no máximo 5 por conta e mesa", async () => {
    const { contas, mestreId } = await mesa();
    for (let i = 0; i < 5; i++) {
      const r = await contas.gerarTokenDoClaude(mestreId, "mestre", `t${i}`, T0 + (i + 2) * MIN);
      expect(r.ok).toBe(true);
    }
    const sexto = await contas.gerarTokenDoClaude(mestreId, "mestre", "t5", T0 + 10 * MIN);
    expect(sexto).toMatchObject({ ok: false, erro: "limite_de_tokens" });
    const lista = contas.listarTokensDoClaude(mestreId, "mestre");
    expect(lista).toHaveLength(5);
    expect(Object.keys(lista[0] ?? {}).sort()).toEqual(["criadoEm", "id", "nome", "ultimoUso"]);
    // a conta de outra pessoa não tem nada
    expect(contas.listarTokensDoClaude("outra-conta", "j1")).toEqual([]);
  });

  it("o token abre o usuário dele; errado, fora do formato e revogado dão a mesma resposta", async () => {
    const { contas, anaId } = await mesa();
    const r = await contas.gerarTokenDoClaude(anaId, "j1", "Ana", T0 + 2 * MIN);
    if (!r.ok) throw new Error("gerar");
    const bom = await contas.resolverTokenDoClaude(r.valor.token, "9.9.9.9", T0 + 3 * MIN, false);
    expect(bom).toEqual({ ok: true, usuarioId: "j1", contaId: anaId, tokenId: r.valor.publico.id });
    // o último uso é anotado
    expect(contas.listarTokensDoClaude(anaId, "j1")[0]?.ultimoUso).toBe(T0 + 3 * MIN);

    const errado = await contas.resolverTokenDoClaude(
      `tvc_${"x".repeat(43)}`,
      "9.9.9.9",
      T0 + 4 * MIN,
      false,
    );
    const lixo = await contas.resolverTokenDoClaude("lixo", "9.9.9.9", T0 + 4 * MIN, false);
    const ausente = await contas.resolverTokenDoClaude(null, "9.9.9.9", T0 + 4 * MIN, false);
    expect(errado).toEqual({ ok: false, minutos: 0 });
    expect(lixo).toEqual(errado);
    expect(ausente).toEqual(errado);

    const rev = contas.revogarTokenDoClaude(anaId, "j1", r.valor.publico.id);
    expect(rev.ok).toBe(true);
    const revogado = await contas.resolverTokenDoClaude(
      r.valor.token,
      "9.9.9.9",
      T0 + 5 * MIN,
      false,
    );
    expect(revogado).toEqual(errado);
  });

  it("só quem é dono revoga o token (de outra conta: inexistente)", async () => {
    const { contas, mestreId, anaId } = await mesa();
    const r = await contas.gerarTokenDoClaude(mestreId, "mestre", "m", T0 + 2 * MIN);
    if (!r.ok) throw new Error("gerar");
    expect(contas.revogarTokenDoClaude(anaId, "j1", r.valor.publico.id)).toMatchObject({
      ok: false,
      erro: "token_inexistente",
    });
    expect(contas.listarTokensDoClaude(mestreId, "mestre")).toHaveLength(1);
  });

  it("as falhas entram no bloqueio progressivo por IP (o mesmo do login) e, bloqueado, nem o token certo vale", async () => {
    const { contas, anaId } = await mesa();
    const r = await contas.gerarTokenDoClaude(anaId, "j1", "Ana", T0 + 2 * MIN);
    if (!r.ok) throw new Error("gerar");
    for (let i = 0; i < 30; i++) {
      await contas.resolverTokenDoClaude(
        `tvc_${String(i).repeat(43).slice(0, 43)}`,
        "7.7.7.7",
        T0 + 3 * MIN + i,
        false,
      );
    }
    const bloqueado = await contas.resolverTokenDoClaude(
      r.valor.token,
      "7.7.7.7",
      T0 + 3 * MIN + 100,
      false,
    );
    expect(bloqueado.ok).toBe(false);
    expect(!bloqueado.ok && bloqueado.minutos).toBeGreaterThan(0);
    // outro IP segue normal
    const outro = await contas.resolverTokenDoClaude(r.valor.token, "8.8.8.8", T0 + 4 * MIN, false);
    expect(outro.ok).toBe(true);
    // passada a espera (15 min), volta
    const depois = await contas.resolverTokenDoClaude(
      r.valor.token,
      "7.7.7.7",
      T0 + 25 * MIN,
      false,
    );
    expect(depois.ok).toBe(true);
  });

  it("remover, recusar ou trocar a vaga da conta revoga os tokens dela; a conta que fica não perde os seus", async () => {
    const { contas, mestreId, anaId } = await mesa();
    const t = await contas.gerarTokenDoClaude(anaId, "j1", "Ana", T0 + 2 * MIN);
    const m = await contas.gerarTokenDoClaude(mestreId, "mestre", "M", T0 + 2 * MIN);
    if (!t.ok || !m.ok) throw new Error("gerar");
    contas.remover(anaId);
    expect(
      await contas.resolverTokenDoClaude(t.valor.token, "1.2.3.4", T0 + 3 * MIN, false),
    ).toMatchObject({
      ok: false,
    });
    expect(contas.listarTokensDoClaude(anaId, "j1")).toEqual([]);
    expect(
      await contas.resolverTokenDoClaude(m.valor.token, "1.2.3.4", T0 + 3 * MIN, false),
    ).toMatchObject({
      ok: true,
      usuarioId: "mestre",
    });
  });

  it("trocar a vaga da conta revoga (o token é de uma pessoa nesta mesa) e a conta que sumiu da mesa também", async () => {
    const { contas, anaId } = await mesa();
    const t = await contas.gerarTokenDoClaude(anaId, "j1", "Ana", T0 + 2 * MIN);
    if (!t.ok) throw new Error("gerar");
    contas.trocarVaga(anaId, "j2");
    expect(contas.listarTokensDoClaude(anaId, "j1")).toEqual([]);
    const t2 = await contas.gerarTokenDoClaude(anaId, "j2", "Ana", T0 + 3 * MIN);
    if (!t2.ok) throw new Error("gerar");
    contas.desligarVagasQueSumiram(new Set(["mestre"]));
    expect(
      await contas.resolverTokenDoClaude(t2.valor.token, "1.2.3.4", T0 + 4 * MIN, false),
    ).toMatchObject({
      ok: false,
    });
  });

  it("sem conta (login solto de teste) só vale com MODO=teste", async () => {
    const { contas } = await mesa();
    const t = await contas.gerarTokenDoClaude(null, "j3", "teste", T0 + 2 * MIN);
    if (!t.ok) throw new Error("gerar");
    expect(
      await contas.resolverTokenDoClaude(t.valor.token, "1.2.3.4", T0 + 3 * MIN, false),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await contas.resolverTokenDoClaude(t.valor.token, "5.6.7.8", T0 + 3 * MIN, true),
    ).toMatchObject({
      ok: true,
      usuarioId: "j3",
      contaId: null,
    });
    expect(contas.listarTokensDoClaude(null, "j3")).toHaveLength(1);
  });
});

describe("migrações 13 e 14 (tokens e diário do Claude)", () => {
  it("o banco da versão 12 ganha as tabelas sem perder nada; repetir não falha; a exportação nunca leva tokens", async () => {
    const { sql } = await abrirBanco();
    const novo = new Armazenamento(sql as never);
    novo.migrar();
    novo.salvarTudo(estadoDeMesaNova());
    novo.gravarMeta("marca", "campanha-real");
    const contas = new ContasDaMesa(sql as never);
    const m = await contas.criarMestre(
      { login: "Mestre", nome: "Mestre", derivada: derivada("a") },
      "mestre",
      T0,
    );
    if (!m.ok) throw new Error("mestre");
    // volta no tempo: o banco de antes do 12-1 (versão 12, sem as duas tabelas)
    sql.exec("DROP TABLE tokens_claude");
    sql.exec("DROP TABLE claude_lotes");
    novo.gravarMeta("versao_esquema", "12");
    const entidades = JSON.stringify(
      sql.exec("SELECT * FROM entidades ORDER BY colecao, id").toArray(),
    );
    const contasAntes = JSON.stringify(sql.exec("SELECT * FROM contas").toArray());

    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    expect(sql.exec("SELECT COUNT(*) AS n FROM tokens_claude").toArray()).toEqual([{ n: 0 }]);
    expect(sql.exec("SELECT COUNT(*) AS n FROM claude_lotes").toArray()).toEqual([{ n: 0 }]);
    expect(reaberto.lerMeta("marca")).toBe("campanha-real");
    expect(JSON.stringify(sql.exec("SELECT * FROM entidades ORDER BY colecao, id").toArray())).toBe(
      entidades,
    );
    expect(JSON.stringify(sql.exec("SELECT * FROM contas").toArray())).toBe(contasAntes);
    // idempotente: rodar as migrações por cima de tabelas que já existem não falha nem perde linha
    const t = await contas.gerarTokenDoClaude(m.valor.id, "mestre", "x", T0 + MIN);
    expect(t.ok).toBe(true);
    reaberto.gravarMeta("versao_esquema", "12");
    reaberto.migrar();
    expect(sql.exec("SELECT COUNT(*) AS n FROM tokens_claude").toArray()).toEqual([{ n: 1 }]);
    // o estado carregado (e, portanto, a exportação) não tem nada de token
    expect(JSON.stringify(reaberto.carregar())).not.toContain("tvc_");
  });
});

describe("diário do Desfazer", () => {
  const passo = (id: string, antes: unknown = null, depois: unknown = { id }): Passo => [
    { c: "personagens", id, antes, depois },
  ];

  it("agrupa os passos pelo loteId (e conta os itens sem repetir), lista do mais novo ao mais velho", async () => {
    const { arm } = await mesa();
    arm.anotarLote("j1", "L1", "criou 2 NPCs", passo("a"), T0);
    arm.anotarLote("j1", "L1", "criou 2 NPCs", passo("b"), T0 + 1);
    arm.anotarLote("j1", "L1", "criou 2 NPCs", passo("a", { id: "a" }, { id: "a", x: 1 }), T0 + 2);
    arm.anotarLote("j1", "L2", "pôs um mapa", passo("c"), T0 + 3);
    arm.anotarLote("mestre", "L1", "de outro usuário", passo("z"), T0 + 4);
    const lotes = arm.lotesDe("j1");
    expect(lotes.map((l) => l.loteId)).toEqual(["L2", "L1"]);
    expect(lotes[1]).toMatchObject({
      descricao: "criou 2 NPCs",
      emMs: T0,
      itens: 2,
      desfeito: false,
      desfazivel: true,
    });
    expect(arm.passosDoLote("j1", "L1")).toHaveLength(3);
    // o usuário só alcança os lotes dele
    expect(arm.passosDoLote("mestre", "L2")).toBeNull();
    expect(arm.lotesDe("mestre")).toHaveLength(1);
  });

  it("guarda só os últimos 50 lotes por usuário, marca o desfeito e recusa o lote grande demais", async () => {
    const { arm } = await mesa();
    for (let i = 0; i < MAXIMO_DE_LOTES_POR_USUARIO + 5; i++) {
      arm.anotarLote("j1", `L${i}`, `lote ${i}`, passo(`p${i}`), T0 + i);
    }
    arm.anotarLote("mestre", "M0", "do mestre", passo("m"), T0);
    const lotes = arm.lotesDe("j1");
    expect(lotes).toHaveLength(MAXIMO_DE_LOTES_POR_USUARIO);
    expect(lotes[0]?.loteId).toBe(`L${MAXIMO_DE_LOTES_POR_USUARIO + 4}`);
    expect(lotes.at(-1)?.loteId).toBe("L5");
    expect(arm.lotesDe("mestre")).toHaveLength(1);

    arm.marcarLoteDesfeito("j1", "L10");
    expect(arm.passosDoLote("j1", "L10")).toBeNull();
    expect(arm.lotesDe("j1").find((l) => l.loteId === "L10")?.desfeito).toBe(true);

    arm.anotarLote(
      "j1",
      "grande",
      "enorme",
      passo("g", null, { id: "g", texto: "x".repeat(1_600_000) }),
      T0 + 999,
    );
    expect(arm.passosDoLote("j1", "grande")).toBeNull();
    expect(arm.lotesDe("j1")[0]).toMatchObject({ loteId: "grande", desfazivel: false });
  });
});

describe("migração 15 (conserta o banco com a tabela do diário na forma antiga)", () => {
  it("acrescenta as colunas que faltam (itens...) sem perder linha; repetir não faz nada; lotesDe volta a funcionar", async () => {
    const { sql } = await abrirBanco();
    const arm = new Armazenamento(sql as never);
    arm.migrar();
    // a forma antiga da migração 14: sem `itens`
    sql.exec("DROP TABLE claude_lotes");
    sql.exec(`CREATE TABLE claude_lotes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      lote_id TEXT NOT NULL,
      descricao TEXT NOT NULL,
      criado_em INTEGER NOT NULL,
      passos TEXT NOT NULL,
      desfazivel INTEGER NOT NULL DEFAULT 1,
      desfeito INTEGER NOT NULL DEFAULT 0,
      UNIQUE (usuario_id, lote_id)
    )`);
    sql.exec(
      "INSERT INTO claude_lotes (usuario_id, lote_id, descricao, criado_em, passos) VALUES ('j1', 'L1', 'antigo', 5, '[]')",
    );
    arm.gravarMeta("versao_esquema", "14");
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const lotes = reaberto.lotesDe("j1");
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({
      loteId: "L1",
      descricao: "antigo",
      itens: 0,
      desfazivel: true,
    });
    reaberto.anotarLote(
      "j1",
      "L2",
      "novo",
      [{ c: "tokens", id: "t", antes: null, depois: { id: "t" } }],
      9,
    );
    expect(reaberto.lotesDe("j1")[0]?.itens).toBe(1);
    // idempotente
    reaberto.gravarMeta("versao_esquema", "14");
    reaberto.migrar();
    expect(reaberto.lotesDe("j1")).toHaveLength(2);
  });
});
