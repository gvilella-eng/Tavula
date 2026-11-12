import {
  assinarMensagem,
  type ChavePrivada,
  DESAFIO_VALE_MS,
  estadoDeMesaNova,
  gerarParDeChaves,
  lerMensagemDaSala,
  mensagem,
  mensagemParaAssinar,
  normalizarCodigoDeRecuperacao,
  visaoPara,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import { Armazenamento } from "./armazenamento";
import { ContasDaMesa, hashDoCodigo, hashDoToken } from "./contas";

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
      if (/^\s*(SELECT|PRAGMA|WITH)/i.test(consulta)) {
        const linhas = declaracao.all(...params);
        return { toArray: () => linhas, rowsWritten: 0 };
      }
      const r = declaracao.run(...params);
      return { toArray: () => [], rowsWritten: r.changes };
    },
  };
  return { sql };
}

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const MESA = "k7m2-qx9p-4tdn";
const derivada = (c: string) => c.repeat(43).slice(0, 43);
const SENHA_A = derivada("a");
const SENHA_B = derivada("b");
const SENHA_NOVA = derivada("n");
const mestre = { login: "Mestre", nome: "O Mestre", derivada: SENHA_A };
const CODIGO_RUIM = "aaaa-aaaa-aaaa-aaaa-aaaa";

/** Uma mesa com mestre, chave da pasta e código de recuperação. */
async function mesaProtegida() {
  const { sql } = await abrirBanco();
  new Armazenamento(sql as never).migrar();
  const contas = new ContasDaMesa(sql as never);
  const m = await contas.criarMestre(mestre, "mestre", T0);
  if (!m.ok) throw new Error("mestre");
  const par = await gerarParDeChaves();
  const k = await contas.registrarChave(m.valor.id, par.publica, null, "1.1.1.1", T0);
  if (!k.ok) throw new Error("chave");
  const codigo = await contas.gerarCodigo(m.valor.id);
  return { sql, contas, mestreId: m.valor.id, par, codigo };
}

async function assinadoPor(
  contas: ContasDaMesa,
  privada: ChavePrivada,
  agora: number,
  mesaId = MESA,
) {
  const d = contas.emitirDesafio("2.2.2.2", agora);
  if (!d.ok) throw new Error("desafio");
  const assinatura = await assinarMensagem(privada, mensagemParaAssinar(mesaId, d.valor.nonce));
  return { nonce: d.valor.nonce, assinatura };
}

const dadosDaPasta = (a: { nonce: string; assinatura: string }, login = "mestre") => ({
  mesaId: MESA,
  login,
  derivada: SENHA_NOVA,
  ...a,
});

const INVALIDA = { ok: false, erro: "recuperacao_invalida" } as const;

describe("recuperar pela pasta", () => {
  it("assinatura certa: troca a senha, derruba as sessões antigas e abre uma nova", async () => {
    const { contas, par } = await mesaProtegida();
    const antiga = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "3.3.3.3", T0 + MIN);
    if (!antiga.ok) throw new Error("entrar");
    const a = await assinadoPor(contas, par.privada, T0 + 2 * MIN);
    const r = await contas.recuperarPelaPasta(dadosDaPasta(a), "2.2.2.2", T0 + 2 * MIN);
    if (!r.ok) throw new Error(`recuperar: ${r.erro}`);
    expect(await contas.resolverSessao(antiga.valor.token, T0 + 3 * MIN)).toBeNull();
    expect((await contas.resolverSessao(r.valor.token, T0 + 3 * MIN))?.conta.login).toBe("mestre");
    const velha = await contas.entrar(
      { login: "mestre", derivada: SENHA_A },
      "3.3.3.3",
      T0 + 4 * MIN,
    );
    expect(velha.ok).toBe(false);
    const nova = await contas.entrar(
      { login: "mestre", derivada: SENHA_NOVA },
      "3.3.3.3",
      T0 + 5 * MIN,
    );
    expect(nova.ok).toBe(true);
  });

  it("o nonce é de uso único: a mesma assinatura não vale duas vezes", async () => {
    const { contas, par } = await mesaProtegida();
    const a = await assinadoPor(contas, par.privada, T0 + MIN);
    expect((await contas.recuperarPelaPasta(dadosDaPasta(a), "2.2.2.2", T0 + MIN)).ok).toBe(true);
    const deNovo = await contas.recuperarPelaPasta(dadosDaPasta(a), "2.2.2.2", T0 + MIN + 1000);
    expect(deNovo).toEqual(INVALIDA);
  });

  it("o nonce que errou também é gasto, e o que passou de 5 minutos não vale", async () => {
    const { contas, par } = await mesaProtegida();
    const outra = await gerarParDeChaves();
    const errada = await assinadoPor(contas, outra.privada, T0 + MIN);
    expect((await contas.recuperarPelaPasta(dadosDaPasta(errada), "2.2.2.2", T0 + MIN)).ok).toBe(
      false,
    );
    // a assinatura certa para um nonce vencido tampouco passa
    const d = contas.emitirDesafio("2.2.2.2", T0 + MIN);
    if (!d.ok) throw new Error("desafio");
    const certa = await assinarMensagem(par.privada, mensagemParaAssinar(MESA, d.valor.nonce));
    const velho = await contas.recuperarPelaPasta(
      dadosDaPasta({ nonce: d.valor.nonce, assinatura: certa }),
      "2.2.2.2",
      T0 + MIN + DESAFIO_VALE_MS + 1,
    );
    expect(velho).toEqual(INVALIDA);
  });

  it("nonce que o servidor nunca emitiu não vale", async () => {
    const { contas, par } = await mesaProtegida();
    const nonce = "z".repeat(43);
    const assinatura = await assinarMensagem(par.privada, mensagemParaAssinar(MESA, nonce));
    const r = await contas.recuperarPelaPasta(
      dadosDaPasta({ nonce, assinatura }),
      "2.2.2.2",
      T0 + MIN,
    );
    expect(r).toEqual(INVALIDA);
  });

  it("a pasta de outra mesa (assinou com outro id ou com outra chave) é recusada", async () => {
    const { contas, par } = await mesaProtegida();
    const outroId = await assinadoPor(contas, par.privada, T0 + MIN, "aaaa-bbbb-cccc");
    expect((await contas.recuperarPelaPasta(dadosDaPasta(outroId), "2.2.2.2", T0 + MIN)).ok).toBe(
      false,
    );
    const outra = await gerarParDeChaves();
    const outraChave = await assinadoPor(contas, outra.privada, T0 + 2 * MIN);
    expect(
      (await contas.recuperarPelaPasta(dadosDaPasta(outraChave), "2.2.2.2", T0 + 2 * MIN)).ok,
    ).toBe(false);
  });

  it("login que não é o do mestre: avisa, sem trocar a senha", async () => {
    const { contas, par } = await mesaProtegida();
    const a = await assinadoPor(contas, par.privada, T0 + MIN);
    const r = await contas.recuperarPelaPasta(dadosDaPasta(a, "outro"), "2.2.2.2", T0 + MIN);
    expect(r).toEqual({ ok: false, erro: "login_nao_confere" });
    const velha = await contas.entrar(
      { login: "mestre", derivada: SENHA_A },
      "3.3.3.3",
      T0 + 2 * MIN,
    );
    expect(velha.ok).toBe(true);
  });

  it("mesa sem chave responde igual a assinatura errada (não diz se há chave)", async () => {
    const { sql } = await abrirBanco();
    new Armazenamento(sql as never).migrar();
    const semChave = new ContasDaMesa(sql as never);
    await semChave.criarMestre(mestre, "mestre", T0);
    const par = await gerarParDeChaves();
    const a = await assinadoPor(semChave, par.privada, T0 + MIN);
    const sem = await semChave.recuperarPelaPasta(dadosDaPasta(a), "2.2.2.2", T0 + MIN);
    const { contas } = await mesaProtegida();
    const b = await assinadoPor(contas, par.privada, T0 + MIN);
    const com = await contas.recuperarPelaPasta(dadosDaPasta(b), "2.2.2.2", T0 + MIN);
    expect(sem).toEqual(com);
    expect(sem).toEqual(INVALIDA);
  });

  it("o desafio é limitado por IP e a tabela não cresce sem fim", async () => {
    const { contas, sql } = await mesaProtegida();
    for (let i = 0; i < 20; i++) expect(contas.emitirDesafio("9.9.9.9", T0 + i).ok).toBe(true);
    expect(contas.emitirDesafio("9.9.9.9", T0 + 30)).toEqual({ ok: false, erro: "muitos_pedidos" });
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 20; j++) contas.emitirDesafio(`10.0.${i}.${j}`, T0 + 100 + i);
    }
    const n = (sql.exec("SELECT COUNT(*) AS n FROM desafios").toArray()[0] as { n: number }).n;
    expect(n).toBeLessThanOrEqual(50);
  });
});

describe("recuperar pelo código", () => {
  it("o código certo troca a senha, derruba as sessões, mata o código e devolve um novo", async () => {
    const { contas, codigo } = await mesaProtegida();
    const antiga = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "3.3.3.3", T0 + MIN);
    if (!antiga.ok) throw new Error("entrar");
    // maiúsculas e sem hífens também servem
    const r = await contas.recuperarPeloCodigo(
      { login: "Mestre", codigo: codigo.toUpperCase().replaceAll("-", " "), derivada: SENHA_NOVA },
      "2.2.2.2",
      T0 + 2 * MIN,
    );
    if (!r.ok) throw new Error(`codigo: ${r.erro}`);
    expect(await contas.resolverSessao(antiga.valor.token, T0 + 3 * MIN)).toBeNull();
    expect(r.valor.codigoNovo).not.toBe(codigo);
    expect(normalizarCodigoDeRecuperacao(r.valor.codigoNovo)).toBe(r.valor.codigoNovo);
    const nova = await contas.entrar(
      { login: "mestre", derivada: SENHA_NOVA },
      "3.3.3.3",
      T0 + 4 * MIN,
    );
    expect(nova.ok).toBe(true);
    // o código usado está morto
    const usado = await contas.recuperarPeloCodigo(
      { login: "mestre", codigo, derivada: SENHA_A },
      "2.2.2.2",
      T0 + 5 * MIN,
    );
    expect(usado).toEqual(INVALIDA);
    // e o novo serve
    const novo = await contas.recuperarPeloCodigo(
      { login: "mestre", codigo: r.valor.codigoNovo, derivada: SENHA_A },
      "2.2.2.2",
      T0 + 6 * MIN,
    );
    expect(novo.ok).toBe(true);
  });

  it("código errado, mal formado ou de mesa sem código: a mesma resposta", async () => {
    const { contas } = await mesaProtegida();
    const dados = (codigo: string) => ({ login: "mestre", codigo, derivada: SENHA_NOVA });
    const errado = await contas.recuperarPeloCodigo(dados(CODIGO_RUIM), "2.2.2.2", T0 + MIN);
    const torto = await contas.recuperarPeloCodigo(dados("lixo"), "2.2.2.2", T0 + MIN);
    expect(errado).toEqual(INVALIDA);
    expect(torto).toEqual(errado);
    const { sql } = await abrirBanco();
    new Armazenamento(sql as never).migrar();
    const sem = new ContasDaMesa(sql as never);
    await sem.criarMestre(mestre, "mestre", T0);
    expect(await sem.recuperarPeloCodigo(dados(CODIGO_RUIM), "2.2.2.2", T0 + MIN)).toEqual(errado);
  });

  it("o login errado avisa, mas não gasta o código", async () => {
    const { contas, codigo } = await mesaProtegida();
    const r = await contas.recuperarPeloCodigo(
      { login: "outro", codigo, derivada: SENHA_NOVA },
      "2.2.2.2",
      T0 + MIN,
    );
    expect(r).toEqual({ ok: false, erro: "login_nao_confere" });
    const certo = await contas.recuperarPeloCodigo(
      { login: "mestre", codigo, derivada: SENHA_NOVA },
      "2.2.2.2",
      T0 + 2 * MIN,
    );
    expect(certo.ok).toBe(true);
  });
});

describe("limite de tentativas da recuperação", () => {
  it("5 erros bloqueiam a mesa (até o código certo espera); a espera acaba", async () => {
    const { contas, codigo } = await mesaProtegida();
    const dados = (c: string) => ({ login: "mestre", codigo: c, derivada: SENHA_NOVA });
    for (let i = 0; i < 4; i++) {
      // IPs diferentes: o limite da mesa não depende do IP
      expect(await contas.recuperarPeloCodigo(dados(CODIGO_RUIM), `7.7.7.${i}`, T0 + i)).toEqual(
        INVALIDA,
      );
    }
    const bloqueada = { ok: false, erro: "bloqueada", minutos: 1 };
    expect(await contas.recuperarPeloCodigo(dados(CODIGO_RUIM), "7.7.7.9", T0 + 5)).toEqual(
      bloqueada,
    );
    // o código certo também espera
    expect(await contas.recuperarPeloCodigo(dados(codigo), "8.8.8.8", T0 + 10)).toEqual(bloqueada);
    expect((await contas.recuperarPeloCodigo(dados(codigo), "8.8.8.8", T0 + 2 * MIN)).ok).toBe(
      true,
    );
  });

  it("30 erros do mesmo IP bloqueiam o IP (vale também para a pasta)", async () => {
    const { contas, par, sql } = await mesaProtegida();
    for (let i = 0; i < 30; i++) {
      sql.exec(
        "INSERT INTO limites_ip (tipo, ip, em) VALUES (?, ?, ?)",
        "falha",
        "6.6.6.6",
        T0 + i,
      );
    }
    const a = await assinadoPor(contas, par.privada, T0 + MIN);
    const r = await contas.recuperarPelaPasta(dadosDaPasta(a), "6.6.6.6", T0 + MIN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("ip_bloqueado");
  });
});

describe("login inexistente: o bloqueio aparece igual ao de uma conta que existe", () => {
  it("depois da 5ª falha a espera é dita para um login que não existe, como para a conta real", async () => {
    const { contas } = await mesaProtegida();
    const tentar = (login: string, i: number) =>
      contas.entrar({ login, derivada: SENHA_B }, `5.5.5.${i}`, T0 + i);
    for (const login of ["fantasma", "mestre"]) {
      for (let i = 0; i < 4; i++)
        expect(await tentar(login, i)).toEqual({ ok: false, erro: "credenciais" });
      expect(await tentar(login, 4)).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
      expect(await tentar(login, 5)).toEqual({ ok: false, erro: "bloqueada", minutos: 1 });
    }
    // passou a espera: volta a responder "credenciais"
    expect(await tentar("fantasma", 2 * MIN)).toEqual({ ok: false, erro: "credenciais" });
  });
});

describe("chave e código: só o mestre logado, com a senha", () => {
  it("registrar a chave e gerar código pedem a senha atual", async () => {
    const { contas, mestreId } = await mesaProtegida();
    const nova = await gerarParDeChaves();
    const errada = { ok: false, erro: "senha_atual_incorreta" };
    expect(
      await contas.registrarChave(mestreId, nova.publica, SENHA_B, "1.1.1.1", T0 + MIN),
    ).toEqual(errada);
    expect(await contas.gerarNovoCodigo(mestreId, SENHA_B, "1.1.1.1", T0 + MIN)).toEqual(errada);
    expect(
      (await contas.registrarChave(mestreId, nova.publica, SENHA_A, "1.1.1.1", T0 + MIN)).ok,
    ).toBe(true);
  });

  it("trocar a chave invalida a antiga; chave com parte privada ou fora da curva é recusada", async () => {
    const { contas, mestreId, par } = await mesaProtegida();
    const nova = await gerarParDeChaves();
    await contas.registrarChave(mestreId, nova.publica, SENHA_A, "1.1.1.1", T0 + MIN);
    const velha = await assinadoPor(contas, par.privada, T0 + 2 * MIN);
    expect((await contas.recuperarPelaPasta(dadosDaPasta(velha), "2.2.2.2", T0 + 2 * MIN)).ok).toBe(
      false,
    );
    const atual = await assinadoPor(contas, nova.privada, T0 + 3 * MIN);
    expect((await contas.recuperarPelaPasta(dadosDaPasta(atual), "2.2.2.2", T0 + 3 * MIN)).ok).toBe(
      true,
    );
    const outra = await mesaProtegida();
    const comD = { ...nova.publica, d: nova.privada.d };
    const foraDaCurva = { ...nova.publica, y: nova.publica.x };
    expect(
      (await outra.contas.registrarChave(outra.mestreId, comD, SENHA_A, "1.1.1.1", T0)).ok,
    ).toBe(false);
    expect(
      (await outra.contas.registrarChave(outra.mestreId, foraDaCurva, SENHA_A, "1.1.1.1", T0)).ok,
    ).toBe(false);
  });

  it("gerar novo código invalida o anterior; jogador não gera", async () => {
    const { contas, mestreId, codigo } = await mesaProtegida();
    const r = await contas.gerarNovoCodigo(mestreId, SENHA_A, "1.1.1.1", T0 + MIN);
    if (!r.ok) throw new Error("codigo");
    expect(r.valor.codigo).not.toBe(codigo);
    const velho = await contas.recuperarPeloCodigo(
      { login: "mestre", codigo, derivada: SENHA_NOVA },
      "2.2.2.2",
      T0 + 2 * MIN,
    );
    expect(velho.ok).toBe(false);
    const p = await contas.pedir(
      { login: "ana", nome: "Ana", derivada: SENHA_B },
      "1.1.1.1",
      T0 + MIN,
    );
    if (!p.ok) throw new Error("pedir");
    contas.aceitar(p.valor.id, "jogador-1");
    expect(await contas.gerarNovoCodigo(p.valor.id, SENHA_B, "1.1.1.1", T0 + 3 * MIN)).toEqual({
      ok: false,
      erro: "sem_permissao",
    });
  });
});

describe("migração 11 (chave, código e desafios)", () => {
  it("o banco da versão 10 ganha as colunas e a tabela sem perder conta; repetir não falha", async () => {
    const { sql } = await abrirBanco();
    const arm = new Armazenamento(sql as never);
    arm.migrar();
    const contas = new ContasDaMesa(sql as never);
    const m = await contas.criarMestre(mestre, "mestre", T0);
    if (!m.ok) throw new Error("mestre");
    // volta ao banco do C2: sem as colunas novas e sem a tabela de desafios
    sql.exec("DROP TABLE desafios");
    sql.exec("ALTER TABLE contas DROP COLUMN chave_publica");
    sql.exec("ALTER TABLE contas DROP COLUMN codigo_hash");
    arm.gravarMeta("versao_esquema", "10");
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("12");
    expect(contas.existeMestre()).toBe(true);
    expect(contas.listarParaMestre(estadoDeMesaNova().usuarios).protecao).toEqual({
      temChave: false,
      temCodigo: false,
    });
    reaberto.gravarMeta("versao_esquema", "10");
    reaberto.migrar(); // de novo: as colunas já existem
    expect(reaberto.lerMeta("versao_esquema")).toBe("12");
    const par = await gerarParDeChaves();
    expect((await contas.registrarChave(m.valor.id, par.publica, null, "1.1.1.1", T0)).ok).toBe(
      true,
    );
  });
});

describe("nada disso chega a um cliente", () => {
  it("varre os frames que a sala monta e a lista do mestre: sem chave, hash, código nem nonce", async () => {
    const { contas, sql, par, codigo } = await mesaProtegida();
    const d = contas.emitirDesafio("2.2.2.2", T0 + MIN);
    if (!d.ok) throw new Error("desafio");
    const login = await contas.entrar({ login: "mestre", derivada: SENHA_A }, "3.3.3.3", T0 + MIN);
    if (!login.ok) throw new Error("entrar");
    const guardado = sql
      .exec("SELECT sal, hash, chave_publica, codigo_hash FROM contas")
      .toArray() as { sal: string; hash: string; chave_publica: string; codigo_hash: string }[];
    const segredos = [
      SENHA_A,
      login.valor.token,
      await hashDoToken(login.valor.token),
      par.publica.x,
      par.publica.y,
      par.privada.d,
      codigo,
      codigo.replaceAll("-", ""),
      await hashDoCodigo(normalizarCodigoDeRecuperacao(codigo) as string),
      d.valor.nonce,
      ...guardado.flatMap((l) => [l.sal, l.hash, l.chave_publica, l.codigo_hash]),
    ];
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
    // a lista que o mestre recebe (da proteção, só dois booleanos)
    const lista = JSON.stringify(contas.listarParaMestre(estado.usuarios));
    for (const f of [...frames, lista]) {
      for (const s of segredos) expect(f).not.toContain(s);
      expect(f).not.toMatch(
        /"(chave|chavePublica|chavePrivada|codigo|codigo_hash|nonce|assinatura)"\s*:/,
      );
    }
    for (const f of frames) expect(lerMensagemDaSala(f).ok).toBe(true);
  });
});
