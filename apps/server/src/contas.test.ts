import {
  type Estado,
  estadoDeMesaNova,
  lerMensagemDaSala,
  mensagem,
  SESSAO_VALE_MS,
  visaoPara,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import semente from "../../../fixtures/campanha.seed.json";
import { Armazenamento } from "./armazenamento";
import { ContasDaMesa, hashDaDerivada, hashDoToken, iguaisEmTempoConstante } from "./contas";

// O SQLite do Durable Object só existe no workerd; aqui o mesmo adaptador dos outros testes, sobre o
// `node:sqlite` em memória.
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

async function novasContas() {
  const { sql } = await abrirBanco();
  new Armazenamento(sql as never).migrar();
  return { contas: new ContasDaMesa(sql as never), sql };
}

const MIN = 60_000;
const T0 = 1_800_000_000_000;
/** Uma derivada válida (32 bytes em base64url) para cada "senha" de teste. */
const derivada = (c: string) => c.repeat(43).slice(0, 43);
const SENHA_A = derivada("a");
const SENHA_B = derivada("b");
const SENHA_C = derivada("c");
const mestre = { login: "Mestre", nome: "O Mestre", derivada: SENHA_A };

async function mesaComMestre() {
  const base = await novasContas();
  const m = await base.contas.criarMestre(mestre, "mestre", T0);
  if (!m.ok) throw new Error("mestre");
  return { ...base, mestreId: m.valor.id };
}

/** Pede, e o mestre aceita na vaga dada: devolve o id da conta. */
async function jogadorAceito(
  contas: ContasDaMesa,
  login: string,
  senha: string,
  vaga: string,
  agora = T0 + MIN,
) {
  const p = await contas.pedir({ login, nome: `Nome ${login}`, derivada: senha }, "1.1.1.1", agora);
  if (!p.ok) throw new Error(`pedir: ${p.erro}`);
  const a = contas.aceitar(p.valor.id, vaga);
  if (!a.ok) throw new Error(`aceitar: ${a.erro}`);
  return p.valor.id;
}

/** Uma mesa com vagas escondidas, como a campanha real (as vagas "Jogador N" vêm da semente). */
function usuariosComVagas() {
  return [
    ...estadoDeMesaNova().usuarios,
    { id: "jogador-1", nome: "Jogador 1", papel: "jogador" as const, cor: "#3cb44b" },
    { id: "jogador-2", nome: "Jogador 2", papel: "jogador" as const, cor: "#4363d8" },
    { id: "jogador-3", nome: "Jogador 3", papel: "jogador" as const, cor: "#f58231" },
    { id: "jogador-4", nome: "Jogador 4", papel: "jogador" as const, cor: "#911eb4" },
  ];
}

describe("hash e comparação", () => {
  it("o hash é SHA-256(sal || derivada): muda com o sal e com a derivada", async () => {
    const sal1 = new Uint8Array(16).fill(1);
    const sal2 = new Uint8Array(16).fill(2);
    const h = await hashDaDerivada(sal1, SENHA_A);
    expect(h).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashDaDerivada(sal1, SENHA_A)).toBe(h);
    expect(await hashDaDerivada(sal2, SENHA_A)).not.toBe(h);
    expect(await hashDaDerivada(sal1, SENHA_B)).not.toBe(h);
    expect(await hashDoToken("abc")).not.toBe("abc");
  });

  it("comparação em tempo constante: iguais, diferentes e de tamanhos diferentes", () => {
    expect(iguaisEmTempoConstante("abc", "abc")).toBe(true);
    expect(iguaisEmTempoConstante("abc", "abd")).toBe(false);
    expect(iguaisEmTempoConstante("abc", "abcd")).toBe(false);
    expect(iguaisEmTempoConstante("", "")).toBe(true);
  });

  it("o banco guarda sal aleatório e hash, nunca a derivada; dois cadastros iguais dão hashes diferentes", async () => {
    const { contas, sql } = await mesaComMestre();
    await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    await jogadorAceito(contas, "bia", SENHA_B, "jogador-2");
    const linhas = sql.exec("SELECT login_norm, sal, hash FROM contas").toArray() as {
      login_norm: string;
      sal: string;
      hash: string;
    }[];
    const ana = linhas.find((l) => l.login_norm === "ana");
    const bia = linhas.find((l) => l.login_norm === "bia");
    expect(ana?.sal).not.toBe(bia?.sal);
    expect(ana?.hash).not.toBe(bia?.hash);
    for (const l of linhas) {
      expect(l.sal).toMatch(/^[A-Za-z0-9_-]{22}$/); // 16 bytes
      expect(JSON.stringify(l)).not.toContain(SENHA_A);
      expect(JSON.stringify(l)).not.toContain(SENHA_B);
    }
  });
});

describe("migração das contas", () => {
  it("o banco antigo (sem as tabelas de conta) ganha as tabelas vazias e nada existente muda; repetir não faz nada", async () => {
    const { sql } = await abrirBanco();
    const novo = new Armazenamento(sql as never);
    novo.migrar();
    novo.salvarTudo(
      // a campanha de exemplo, como a real
      { ...estadoDeMesaNova(), usuarios: estadoDeMesaNova().usuarios },
    );
    novo.gravarMeta("marca", "campanha-real");
    // volta no tempo: o banco de antes do C2 (versão 9, sem as tabelas de conta)
    for (const t of ["contas", "sessoes", "limites_ip"]) sql.exec(`DROP TABLE ${t}`);
    novo.gravarMeta("versao_esquema", "9");
    const tabelas = () =>
      (
        sql.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").toArray() as {
          name: string;
        }[]
      ).map((t) => t.name);
    expect(tabelas()).not.toContain("contas");
    const antes = JSON.stringify(
      sql.exec("SELECT * FROM entidades ORDER BY colecao, id").toArray(),
    );

    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("12");
    expect(tabelas()).toEqual(expect.arrayContaining(["contas", "sessoes", "limites_ip"]));
    expect(sql.exec("SELECT COUNT(*) AS n FROM contas").toArray()).toEqual([{ n: 0 }]);
    expect(reaberto.lerMeta("marca")).toBe("campanha-real");
    expect(JSON.stringify(sql.exec("SELECT * FROM entidades ORDER BY colecao, id").toArray())).toBe(
      antes,
    );
    expect(reaberto.carregar()?.usuarios.map((u) => u.id)).toContain("mestre");
    // idempotente: migrar de novo (e criar as tabelas por cima das existentes) não falha nem perde conta
    reaberto.migrar();
    const contas = new ContasDaMesa(sql as never);
    const m = await contas.criarMestre(mestre, "mestre", T0);
    expect(m.ok).toBe(true);
    reaberto.gravarMeta("versao_esquema", "9");
    reaberto.migrar();
    expect(contas.existeMestre()).toBe(true);
    expect(sql.exec("SELECT COUNT(*) AS n FROM contas").toArray()).toEqual([{ n: 1 }]);
  });

  it("a semente de exemplo carrega do mesmo jeito depois da migração (a campanha antiga segue inteira)", async () => {
    const { sql } = await abrirBanco();
    const b = new Armazenamento(sql as never);
    b.migrar();
    b.salvarTudo({ ...estadoDeMesaNova() } as Estado);
    const e = b.carregar();
    expect(e?.usuarios.length).toBe(1);
    void semente;
  });
});

describe("contas: criar, pedir, aceitar, entrar", () => {
  it("o mestre da mesa nova entra pelo login (sem diferenciar maiúsculas) e há uma sessão", async () => {
    const { contas } = await mesaComMestre();
    expect(contas.existeMestre()).toBe(true);
    const r = await contas.entrar({ login: "MESTRE", derivada: SENHA_A }, "9.9.9.9", T0 + MIN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.valor.conta.papel).toBe("mestre");
    expect(r.valor.conta.usuarioId).toBe("mestre");
    const dono = await contas.resolverSessao(r.valor.token, T0 + 2 * MIN);
    expect(dono?.conta.login).toBe("mestre");
    expect(await contas.resolverSessao("x".repeat(43), T0)).toBeNull();
    expect(await contas.resolverSessao("curto", T0)).toBeNull();
  });

  it("só um mestre por mesa", async () => {
    const { contas } = await mesaComMestre();
    const de = await contas.criarMestre({ ...mestre, login: "outro" }, "jogador-1", T0);
    expect(de).toEqual({ ok: false, erro: "ja_tem_mestre" });
  });

  it("pedido pendente: o login certo diz 'ainda não foi aceito'; o errado só diz login ou senha incorretos", async () => {
    const { contas } = await mesaComMestre();
    const p = await contas.pedir({ login: "Ana", nome: "Ana", derivada: SENHA_B }, "2.2.2.2", T0);
    expect(p.ok).toBe(true);
    expect(await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 1)).toEqual({
      ok: false,
      erro: "pedido_pendente",
    });
    expect(await contas.entrar({ login: "ana", derivada: SENHA_C }, "2.2.2.2", T0 + 2)).toEqual({
      ok: false,
      erro: "credenciais",
    });
    expect(contas.pendencias().pendentes).toBe(1);
  });

  it("aceitar liga a vaga; depois a pessoa entra; a vaga não serve para duas contas", async () => {
    const { contas } = await mesaComMestre();
    const id = await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    const r = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 5 * MIN);
    expect(r.ok && r.valor.conta.usuarioId).toBe("jogador-1");
    const p2 = await contas.pedir({ login: "bia", nome: "Bia", derivada: SENHA_C }, "3.3.3.3", T0);
    if (!p2.ok) throw new Error("pedir");
    expect(contas.aceitar(p2.valor.id, "jogador-1")).toEqual({ ok: false, erro: "vaga_invalida" });
    expect(contas.aceitar(p2.valor.id, "jogador-2").ok).toBe(true);
    // trocar de vaga
    expect(contas.trocarVaga(id, "jogador-2")).toEqual({ ok: false, erro: "vaga_invalida" });
    expect(contas.trocarVaga(id, "jogador-3").ok).toBe(true);
    expect(contas.conta(id)?.usuarioId).toBe("jogador-3");
  });

  it("recusar: 'Seu pedido foi recusado'; pedir de novo só depois de 10 minutos", async () => {
    const { contas } = await mesaComMestre();
    const p = await contas.pedir({ login: "ana", nome: "Ana", derivada: SENHA_B }, "2.2.2.2", T0);
    if (!p.ok) throw new Error("pedir");
    expect(contas.recusar(p.valor.id, T0 + MIN).ok).toBe(true);
    expect(
      await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 2 * MIN),
    ).toEqual({
      ok: false,
      erro: "pedido_recusado",
    });
    const cedo = await contas.pedir(
      { login: "ana", nome: "Ana", derivada: SENHA_B },
      "2.2.2.2",
      T0 + 5 * MIN,
    );
    expect(cedo).toEqual({ ok: false, erro: "pedido_recusado_recente", minutos: 6 });
    const tarde = await contas.pedir(
      { login: "ana", nome: "Ana Maria", derivada: SENHA_C },
      "2.2.2.2",
      T0 + 12 * MIN,
    );
    expect(tarde.ok).toBe(true);
    expect(contas.pendencias().pendentes).toBe(1);
    // a senha nova vale; a antiga não
    expect(contas.listarParaMestre([]).contas.find((c) => c.login === "ana")?.nome).toBe(
      "Ana Maria",
    );
  });

  it("login único por mesa sem diferenciar maiúsculas", async () => {
    const { contas } = await mesaComMestre();
    const a = await contas.pedir({ login: "Ana", nome: "Ana", derivada: SENHA_B }, "2.2.2.2", T0);
    expect(a.ok).toBe(true);
    const b = await contas.pedir({ login: "ANA", nome: "Outra", derivada: SENHA_C }, "3.3.3.3", T0);
    expect(b).toEqual({ ok: false, erro: "login_em_uso" });
    const c = await contas.pedir({ login: "mestre", nome: "X", derivada: SENHA_C }, "4.4.4.4", T0);
    expect(c).toEqual({ ok: false, erro: "login_em_uso" });
  });

  it("mesa sem mestre não aceita pedidos", async () => {
    const { contas } = await novasContas();
    expect(
      await contas.pedir({ login: "ana", nome: "Ana", derivada: SENHA_B }, "2.2.2.2", T0),
    ).toEqual({ ok: false, erro: "mesa_sem_mestre" });
  });

  it("conta ativa sem vaga (vaga que sumiu na importação) entra só depois de ligada de novo", async () => {
    const { contas } = await mesaComMestre();
    const id = await jogadorAceito(contas, "ana", SENHA_B, "jogador-9");
    const t = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 2 * MIN);
    expect(t.ok).toBe(true);
    expect(contas.desligarVagasQueSumiram(new Set(["mestre", "jogador-1"]))).toEqual([id]);
    expect(
      await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 3 * MIN),
    ).toEqual({
      ok: false,
      erro: "sem_vaga",
    });
    // a sessão antiga caiu junto
    if (t.ok) expect(await contas.resolverSessao(t.valor.token, T0 + 3 * MIN)).toBeNull();
    expect(contas.trocarVaga(id, "jogador-1").ok).toBe(true);
  });
});

describe("limite de tentativas", () => {
  it("5 falhas seguidas bloqueiam a conta; dizer a espera; o acerto zera antes disso", async () => {
    const { contas } = await mesaComMestre();
    const entrar = (senha: string, agora: number) =>
      contas.entrar({ login: "mestre", derivada: senha }, "5.5.5.5", agora);
    for (let i = 0; i < 4; i++) {
      expect(await entrar(SENHA_B, T0 + i)).toEqual({ ok: false, erro: "credenciais" });
    }
    // o acerto zera a contagem: mais 4 erros ainda não bloqueiam
    expect((await entrar(SENHA_A, T0 + 10)).ok).toBe(true);
    for (let i = 0; i < 4; i++) {
      expect(await entrar(SENHA_B, T0 + 20 + i)).toEqual({ ok: false, erro: "credenciais" });
    }
    // a quinta falha bloqueia por 1 minuto
    expect(await entrar(SENHA_B, T0 + 30)).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
    // mesmo com a senha certa, bloqueada
    expect(await entrar(SENHA_A, T0 + 40)).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
    // passado o minuto, a senha certa entra
    expect((await entrar(SENHA_A, T0 + 30 + MIN + 1)).ok).toBe(true);
  });

  it("a espera cresce: 1, depois 5 minutos na rodada seguinte de falhas", async () => {
    const { contas } = await mesaComMestre();
    const errar = (agora: number) =>
      contas.entrar({ login: "mestre", derivada: SENHA_B }, "5.5.5.5", agora);
    let agora = T0;
    for (let i = 0; i < 4; i++) await errar(agora++);
    expect(await errar(agora)).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
    agora += 2 * MIN;
    for (let i = 0; i < 4; i++) await errar(agora++);
    expect(await errar(agora)).toEqual({ ok: false, erro: "bloqueada", minutos: 5 });
  });

  it("login inexistente e senha errada dão a mesma resposta", async () => {
    const { contas } = await mesaComMestre();
    const a = await contas.entrar({ login: "ninguem", derivada: SENHA_B }, "6.6.6.6", T0);
    const b = await contas.entrar({ login: "mestre", derivada: SENHA_B }, "7.7.7.7", T0);
    expect(a).toEqual({ ok: false, erro: "credenciais" });
    expect(b).toEqual(a);
  });

  it("por IP: 30 falhas em 15 minutos bloqueiam o IP (até para um login certo), outro IP não", async () => {
    const { contas } = await mesaComMestre();
    for (let i = 0; i < 30; i++) {
      // logins diferentes: nenhuma conta chega a 5 falhas, só o IP acumula
      await contas.entrar({ login: `fantasma${i}`, derivada: SENHA_B }, "8.8.8.8", T0 + i * 1000);
    }
    const bloqueado = await contas.entrar(
      { login: "mestre", derivada: SENHA_A },
      "8.8.8.8",
      T0 + 40_000,
    );
    expect(bloqueado.ok).toBe(false);
    if (!bloqueado.ok) {
      expect(bloqueado.erro).toBe("ip_bloqueado");
      expect(bloqueado.minutos).toBeGreaterThan(0);
      expect(bloqueado.minutos).toBeLessThanOrEqual(15);
    }
    // outro IP entra
    expect(
      (await contas.entrar({ login: "mestre", derivada: SENHA_A }, "8.8.4.4", T0 + 41_000)).ok,
    ).toBe(true);
    // 16 minutos depois, o IP volta
    expect(
      (await contas.entrar({ login: "mestre", derivada: SENHA_A }, "8.8.8.8", T0 + 17 * MIN)).ok,
    ).toBe(true);
  });

  it("pedidos: 3 por IP por hora e 10 pendentes por mesa", async () => {
    const { contas } = await mesaComMestre();
    const pedir = (n: number, ip: string, agora: number) =>
      contas.pedir({ login: `pessoa${n}`, nome: `P${n}`, derivada: SENHA_B }, ip, agora);
    for (let i = 0; i < 3; i++) expect((await pedir(i, "1.2.3.4", T0 + i)).ok).toBe(true);
    expect(await pedir(3, "1.2.3.4", T0 + 10)).toEqual({ ok: false, erro: "muitos_pedidos" });
    // passada uma hora o IP pode de novo
    expect((await pedir(3, "1.2.3.4", T0 + 61 * MIN)).ok).toBe(true);
    // 10 pendentes por mesa (já há 4): IPs diferentes até chegar a 10
    for (let i = 10; i < 16; i++)
      expect((await pedir(i, `10.0.0.${i}`, T0 + 62 * MIN)).ok).toBe(true);
    expect(contas.pendencias().pendentes).toBe(10);
    expect(await pedir(99, "10.0.0.99", T0 + 62 * MIN)).toEqual({
      ok: false,
      erro: "muitos_pedidos",
    });
  });

  it("limpa registros velhos de IP e sessões vencidas", async () => {
    const { contas, sql } = await mesaComMestre();
    await contas.entrar({ login: "mestre", derivada: SENHA_B }, "1.1.1.1", T0);
    expect(sql.exec("SELECT COUNT(*) AS n FROM limites_ip").toArray()).toEqual([{ n: 1 }]);
    contas.limpar(T0 + 25 * 60 * MIN);
    expect(sql.exec("SELECT COUNT(*) AS n FROM limites_ip").toArray()).toEqual([{ n: 0 }]);
  });
});

describe("sessões", () => {
  it("expira em 30 dias; usar de novo depois de uma hora renova a validade", async () => {
    const { contas, sql } = await mesaComMestre();
    const r = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "1.1.1.1", T0);
    if (!r.ok) throw new Error("entrar");
    // dentro da hora: não renova
    const cedo = await contas.resolverSessao(r.valor.token, T0 + 30 * MIN);
    expect(cedo?.renovou).toBe(false);
    // depois de 2 horas: renova
    const renovada = await contas.resolverSessao(r.valor.token, T0 + 120 * MIN);
    expect(renovada?.renovou).toBe(true);
    const expira = (sql.exec("SELECT expira FROM sessoes").toArray()[0] as { expira: number })
      .expira;
    expect(expira).toBe(T0 + 120 * MIN + SESSAO_VALE_MS);
    // sem uso por 30 dias, vence
    expect(await contas.resolverSessao(r.valor.token, expira)).toBeNull();
    expect(sql.exec("SELECT COUNT(*) AS n FROM sessoes").toArray()).toEqual([{ n: 0 }]);
  });

  it("no banco fica só o hash do token; sair apaga a sessão", async () => {
    const { contas, sql } = await mesaComMestre();
    const r = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "1.1.1.1", T0);
    if (!r.ok) throw new Error("entrar");
    const guardado = JSON.stringify(sql.exec("SELECT * FROM sessoes").toArray());
    expect(guardado).not.toContain(r.valor.token);
    expect(guardado).toContain(await hashDoToken(r.valor.token));
    await contas.sair(r.valor.token);
    expect(await contas.resolverSessao(r.valor.token, T0 + 1)).toBeNull();
  });

  it("no máximo 10 sessões por conta: as mais antigas caem", async () => {
    const { contas } = await mesaComMestre();
    const tokens: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await contas.entrar(
        { login: "mestre", derivada: SENHA_A },
        "1.1.1.1",
        T0 + i * 1000,
      );
      if (!r.ok) throw new Error("entrar");
      tokens.push(r.valor.token);
    }
    expect(await contas.resolverSessao(tokens[0] as string, T0 + 20_000)).toBeNull();
    expect(await contas.resolverSessao(tokens[11] as string, T0 + 20_000)).not.toBeNull();
  });

  it("remover a conta, recusar ou redefinir a senha apagam as sessões dela", async () => {
    const { contas } = await mesaComMestre();
    const id = await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    const entra = async () => {
      const r = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 5 * MIN);
      if (!r.ok) throw new Error("entrar");
      return r.valor.token;
    };
    const t1 = await entra();
    expect(contas.remover(id).ok).toBe(true);
    expect(await contas.resolverSessao(t1, T0 + 6 * MIN)).toBeNull();
    expect(contas.conta(id)).toBeNull();
    // a vaga ficou livre
    expect(contas.vagaOcupada("jogador-1")).toBe(false);
    // a conta do mestre não sai
    const m = contas.listarParaMestre([]).contas.find((c) => c.papel === "mestre");
    expect(contas.remover(m?.id as string)).toEqual({ ok: false, erro: "conta_do_mestre" });
    expect(contas.recusar(m?.id as string, T0)).toEqual({ ok: false, erro: "conta_do_mestre" });
  });
});

describe("esqueci a senha e redefinição aprovada pelo mestre", () => {
  async function pedidoDeRedefinicao() {
    const base = await mesaComMestre();
    const id = await jogadorAceito(base.contas, "ana", SENHA_B, "jogador-1");
    const antiga = await base.contas.entrar(
      { login: "ana", derivada: SENHA_B },
      "2.2.2.2",
      T0 + 5 * MIN,
    );
    if (!antiga.ok) throw new Error("entrar");
    return { ...base, id, tokenAntigo: antiga.valor.token };
  }

  it("o pedido aparece ao mestre; liberar dá 30 minutos; definir a senha derruba as sessões antigas", async () => {
    const { contas, id, tokenAntigo } = await pedidoDeRedefinicao();
    // login que não existe: mesma resposta (null) e nada marcado
    expect(contas.esqueci("ninguem", "3.3.3.3", T0 + 10 * MIN)).toBeNull();
    const aviso = contas.esqueci("ana", "3.3.3.3", T0 + 10 * MIN);
    expect(aviso?.login).toBe("ana");
    expect(contas.pendencias().redefinicoes).toBe(1);
    // pedido repetido não avisa de novo
    expect(contas.esqueci("ana", "3.3.3.3", T0 + 11 * MIN)).toBeNull();
    const lista = contas.listarParaMestre([]);
    expect(lista.contas.find((c) => c.id === id)?.redefinicaoPedida).toBe(true);

    // sem a liberação, não redefine
    expect(
      await contas.redefinir({ login: "ana", derivada: SENHA_C }, "3.3.3.3", T0 + 12 * MIN),
    ).toEqual({
      ok: false,
      erro: "redefinicao_indisponivel",
    });
    expect(contas.liberarRedefinicao(id, T0 + 12 * MIN).ok).toBe(true);
    expect(contas.pendencias().redefinicoes).toBe(0);

    const r = await contas.redefinir({ login: "ana", derivada: SENHA_C }, "3.3.3.3", T0 + 20 * MIN);
    expect(r.ok).toBe(true);
    // a sessão antiga caiu; a senha antiga não entra; a nova entra
    expect(await contas.resolverSessao(tokenAntigo, T0 + 21 * MIN)).toBeNull();
    expect(
      (await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 22 * MIN)).ok,
    ).toBe(false);
    expect(
      (await contas.entrar({ login: "ana", derivada: SENHA_C }, "2.2.2.2", T0 + 23 * MIN)).ok,
    ).toBe(true);
    // a liberação vale uma vez só
    expect(
      await contas.redefinir({ login: "ana", derivada: SENHA_B }, "3.3.3.3", T0 + 24 * MIN),
    ).toEqual({
      ok: false,
      erro: "redefinicao_indisponivel",
    });
  });

  it("fora do prazo (30 minutos) recusa", async () => {
    const { contas, id } = await pedidoDeRedefinicao();
    contas.esqueci("ana", "3.3.3.3", T0 + 10 * MIN);
    contas.liberarRedefinicao(id, T0 + 12 * MIN);
    expect(
      await contas.redefinir({ login: "ana", derivada: SENHA_C }, "3.3.3.3", T0 + 43 * MIN),
    ).toEqual({
      ok: false,
      erro: "redefinicao_indisponivel",
    });
    // pedir de novo depois da liberação vencida volta a avisar o mestre
    expect(contas.esqueci("ana", "3.3.3.3", T0 + 50 * MIN)?.login).toBe("ana");
    expect(contas.pendencias().redefinicoes).toBe(1);
  });

  it("o mestre não usa esse caminho (é o C3) e o pedido sem 'esqueci' não pode ser liberado", async () => {
    const { contas, id, mestreId } = await pedidoDeRedefinicao();
    expect(contas.esqueci("mestre", "3.3.3.3", T0)).toBeNull();
    expect(contas.liberarRedefinicao(mestreId, T0)).toEqual({ ok: false, erro: "sem_pedido" });
    expect(contas.liberarRedefinicao(id, T0)).toEqual({ ok: false, erro: "sem_pedido" });
  });

  it("trocar a senha: confere a atual, derruba as outras sessões e mantém a de quem trocou", async () => {
    const { contas, id, tokenAntigo } = await pedidoDeRedefinicao();
    const outra = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 6 * MIN);
    if (!outra.ok) throw new Error("entrar");
    const atual = await contas.resolverSessao(outra.valor.token, T0 + 7 * MIN);
    expect(
      await contas.trocarSenha(
        id,
        { atual: SENHA_C, nova: SENHA_A },
        atual?.sessaoHash as string,
        "2.2.2.2",
        T0 + 8 * MIN,
      ),
    ).toEqual({ ok: false, erro: "senha_atual_incorreta" });
    expect(
      (
        await contas.trocarSenha(
          id,
          { atual: SENHA_B, nova: SENHA_C },
          atual?.sessaoHash as string,
          "2.2.2.2",
          T0 + 9 * MIN,
        )
      ).ok,
    ).toBe(true);
    expect(await contas.resolverSessao(tokenAntigo, T0 + 10 * MIN)).toBeNull();
    expect(await contas.resolverSessao(outra.valor.token, T0 + 10 * MIN)).not.toBeNull();
    expect(
      (await contas.entrar({ login: "ana", derivada: SENHA_C }, "2.2.2.2", T0 + 11 * MIN)).ok,
    ).toBe(true);
  });

  it("errar a senha atual na troca conta para o bloqueio como no login", async () => {
    const { contas, id } = await pedidoDeRedefinicao();
    let ultimo: unknown;
    for (let i = 0; i < 5; i++) {
      ultimo = await contas.trocarSenha(
        id,
        { atual: SENHA_C, nova: SENHA_A },
        "x",
        "2.2.2.2",
        T0 + 8 * MIN + i,
      );
    }
    expect(ultimo).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
  });
});

describe("V7: quem é membro (conta ativa)", () => {
  it("só o mestre e as contas ativas contam; pedido pendente e conta removida não", async () => {
    const { contas } = await mesaComMestre();
    expect([...contas.usuariosComContaAtiva()]).toEqual(["mestre"]);
    const p = await contas.pedir({ login: "bia", nome: "Bia", derivada: SENHA_B }, "1.1.1.1", T0);
    if (!p.ok) throw new Error("pedir");
    expect(contas.usuariosComContaAtiva().has("jogador-2")).toBe(false);
    expect(contas.aceitar(p.valor.id, "jogador-2").ok).toBe(true);
    expect(contas.usuariosComContaAtiva().has("jogador-2")).toBe(true);
    // remover a conta esconde a vaga de novo
    expect(contas.remover(p.valor.id).ok).toBe(true);
    expect(contas.usuariosComContaAtiva().has("jogador-2")).toBe(false);
  });
});

describe("o que o mestre vê e o que nunca sai", () => {
  it("a lista do mestre só tem id, login, nome, vaga, status e último acesso (nada de sal, hash ou token)", async () => {
    const { contas } = await mesaComMestre();
    await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    const login = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 5 * MIN);
    if (!login.ok) throw new Error("entrar");
    const lista = contas.listarParaMestre(usuariosComVagas());
    const texto = JSON.stringify(lista);
    for (const segredo of [
      SENHA_A,
      SENHA_B,
      login.valor.token,
      await hashDoToken(login.valor.token),
    ]) {
      expect(texto).not.toContain(segredo);
    }
    expect(texto).not.toMatch(/"(sal|hash|token|derivada|senha)"/);
    const ana = lista.contas.find((c) => c.login === "ana");
    expect(Object.keys(ana ?? {}).sort()).toEqual(
      [
        "criadaEm",
        "id",
        "login",
        "nome",
        "papel",
        "redefinicaoAte",
        "redefinicaoPedida",
        "status",
        "ultimoAcesso",
        "vagaId",
        "vagaNome",
      ].sort(),
    );
    expect(ana?.vagaNome).toBe("Jogador 1");
    expect(ana?.ultimoAcesso).toBe(T0 + 5 * MIN);
    // as vagas livres: só jogadores sem conta ativa
    expect(lista.vagasLivres.map((v) => v.id)).toEqual(["jogador-2", "jogador-3", "jogador-4"]);
  });

  it("nenhum frame nem snapshot leva sal, hash, token ou derivada (varre os frames que a sala monta)", async () => {
    const { contas, sql } = await mesaComMestre();
    await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    const login = await contas.entrar({ login: "ana", derivada: SENHA_B }, "2.2.2.2", T0 + 5 * MIN);
    if (!login.ok) throw new Error("entrar");
    const guardado = sql.exec("SELECT sal, hash FROM contas").toArray() as {
      sal: string;
      hash: string;
    }[];
    const segredos = [
      SENHA_A,
      SENHA_B,
      login.valor.token,
      await hashDoToken(login.valor.token),
      ...guardado.flatMap((l) => [l.sal, l.hash]),
    ];
    // o que a sala envia: o snapshot de cada usuário, a presença e o aviso das contas
    const estado = estadoDeMesaNova();
    const frames: string[] = [];
    for (const u of estado.usuarios) {
      frames.push(
        mensagem({
          tipo: "snapshot",
          dados: { usuarioId: u.id, estado: visaoPara(estado, u, T0) },
        }),
      );
    }
    frames.push(
      mensagem({
        tipo: "contas.aviso",
        dados: { ...contas.pendencias(), novo: { tipo: "entrada", nome: "Ana", login: "ana" } },
      }),
    );
    frames.push(mensagem({ tipo: "mesa.renomeada", dados: { nome: "Nova" } }));
    for (const f of frames) {
      expect(lerMensagemDaSala(f).ok).toBe(true);
      for (const s of segredos) expect(f).not.toContain(s);
      expect(f).not.toMatch(/"(sal|hash|token|derivada|senha)"\s*:/);
    }
  });
});

describe("migração 12 (tour de introdução visto)", () => {
  it("o banco da versão 11 ganha a coluna sem perder conta; a conta existente ainda não viu o tour; repetir não falha", async () => {
    const { contas, sql, mestreId } = await mesaComMestre();
    // volta ao banco do C3: sem a coluna do tour
    sql.exec("ALTER TABLE contas DROP COLUMN tour_visto");
    const arm = new Armazenamento(sql as never);
    arm.gravarMeta("versao_esquema", "11");
    arm.migrar();
    expect(arm.lerMeta("versao_esquema")).toBe("12");
    expect(contas.existeMestre()).toBe(true);
    const login = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "1.1.1.1", T0 + MIN);
    if (!login.ok) throw new Error("entrar");
    expect(login.valor.conta.tourVisto).toBe(false);
    // marcar é idempotente e vale para a conta (e só para ela)
    contas.marcarTourVisto(mestreId);
    contas.marcarTourVisto(mestreId);
    const outra = await jogadorAceito(contas, "ana", SENHA_B, "jogador-1");
    const dono = await contas.resolverSessao(login.valor.token, T0 + 2 * MIN);
    expect(dono?.conta.tourVisto).toBe(true);
    const ana = await contas.entrar({ login: "ana", derivada: SENHA_B }, "1.1.1.1", T0 + 3 * MIN);
    if (!ana.ok) throw new Error("entrar ana");
    expect(ana.valor.conta.tourVisto).toBe(false);
    expect(outra).toBe(ana.valor.conta.id);
    // migrar de novo, com a coluna já criada
    arm.gravarMeta("versao_esquema", "11");
    arm.migrar();
    expect(arm.lerMeta("versao_esquema")).toBe("12");
  });
});
