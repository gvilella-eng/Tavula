import {
  AutomacoesSchema,
  type Combate,
  type Desenho,
  type EventoSala,
  estadoInicial,
  type Mensagem,
  ZonaSchema,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import semente from "../../../fixtures/campanha.seed.json";
import { Armazenamento } from "./armazenamento";

// O SQLite do Durable Object só existe no workerd. Aqui um adaptador mínimo sobre o `node:sqlite`
// (em memória) cobre o que o `Armazenamento` usa: `exec(sql, ...params)` com `toArray()` e `rowsWritten`.
type Banco = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...p: unknown[]): unknown[];
    run(...p: unknown[]): { changes: number };
  };
};

async function abrirBanco() {
  // O nome do módulo vai montado para o TypeScript do servidor (tipos do workerd) não procurá-lo.
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

function mensagem(seq: number, extra: Partial<Mensagem> = {}): Mensagem {
  return {
    id: `m${seq}`,
    seq,
    emReal: 1_000 + seq,
    autorId: "jogador-1",
    tipo: "texto",
    texto: `mensagem ${seq}`,
    visivelPara: "todos",
    ...extra,
  };
}

describe("Armazenamento: histórico do chat", () => {
  it("grava, lê da mais nova para a mais antiga com paginação por seq e limpa", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    for (let i = 1; i <= 7; i++) banco.gravarMensagem(mensagem(i));
    expect(banco.chatAntes(null, 3).map((m) => m.seq)).toEqual([7, 6, 5]);
    expect(banco.chatAntes(5, 10).map((m) => m.seq)).toEqual([4, 3, 2, 1]);
    expect(banco.chatAntes(1, 10)).toEqual([]);
    banco.limparChat();
    expect(banco.chatAntes(null, 10)).toEqual([]);
  });

  it("guarda a mensagem inteira (rolagem, sussurro) e sobrevive a um novo Armazenamento sobre o mesmo banco (reinício)", async () => {
    const { sql } = await abrirBanco();
    const a = new Armazenamento(sql as never);
    a.migrar();
    const sussurro = mensagem(1, { visivelPara: { ids: ["jogador-2"] }, texto: "psiu" });
    a.gravarMensagem(sussurro);
    const b = new Armazenamento(sql as never);
    b.migrar();
    expect(b.chatAntes(null, 5)).toEqual([sussurro]);
  });

  it("banco antigo (sem a tabela, versão 5) abre sem quebrar e ganha a tabela vazia", async () => {
    const { sql } = await abrirBanco();
    const original = new Armazenamento(sql as never);
    original.migrar();
    original.salvarTudo(estadoInicial(semente));
    // volta no tempo: a campanha do Lote 7 não tinha a tabela do chat
    sql.exec("DROP TABLE chat");
    original.gravarMeta("versao_esquema", "5");

    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    // o Lote 13 acrescentou a migração dos desenhos: a versão do esquema final é 10 (o V3 acrescentou a dos handouts; o C2, a das contas)
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    expect(reaberto.chatAntes(null, 10)).toEqual([]);
    // a campanha antiga continua inteira
    const carregado = reaberto.carregar();
    expect(carregado?.personagens.map((p) => p.nome)).toContain("Aldric");
    expect(carregado?.usuarios.length).toBeGreaterThan(1);
    // e o chat já funciona
    reaberto.gravarMensagem(mensagem(1));
    expect(reaberto.chatAntes(null, 10).length).toBe(1);
  });

  it("importar a campanha (salvarTudo) não apaga o chat; apagarTudo (só teste) apaga", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.gravarMensagem(mensagem(1));
    banco.salvarTudo(estadoInicial(semente));
    expect(banco.chatAntes(null, 10).length).toBe(1);
    banco.apagarTudo();
    expect(banco.chatAntes(null, 10)).toEqual([]);
  });

  it("os retratos das mensagens públicas voltam do banco; os de sussurro não", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const hash = (c: string) => c.repeat(64);
    banco.gravarMensagem(
      mensagem(1, { como: { personagemId: "a", nome: "A", retratoHash: hash("a") } }),
    );
    banco.gravarMensagem(
      mensagem(2, {
        como: { personagemId: "b", nome: "B", retratoHash: hash("b") },
        visivelPara: { ids: ["jogador-2"] },
      }),
    );
    expect(banco.retratosDoChat()).toEqual([hash("a")]);
  });
});

describe("Armazenamento: ficha do Lote 9", () => {
  it("banco do Lote 8 (personagem com `mochila` e ficha só de PV) abre com os itens e sem reescrever a linha", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    // grava a linha no formato antigo, com a mochila
    const antigo = {
      id: "pers-antigo",
      pastaId: "pasta-personagens",
      editores: { tipo: "jogadores", ids: ["jogador-1"] },
      nome: "Antigo",
      tokenPadrao: { cor: "#123456", tamanhoQuadrados: 1 },
      visao: { alcanceM: null, visaoNoEscuroM: 0 },
      modInteligencia: 3,
      mochila: { "modelo-tocha": 4 },
      ficha: { pvAtual: 5, pvMax: 9 },
    };
    sql.exec(
      "INSERT INTO entidades (colecao, id, dados) VALUES ('personagens', 'pers-antigo', ?)",
      JSON.stringify(antigo),
    );
    const carregado = new Armazenamento(sql as never).carregar();
    const p = carregado?.personagens.find((x) => x.id === "pers-antigo");
    expect(p?.mochila).toBeUndefined();
    expect(p?.modInteligencia).toBe(3);
    expect(p?.ficha).toEqual({
      pvAtual: 5,
      pvMax: 9,
      itens: [{ nome: "Tocha 5e", quantidade: 4, modeloId: "modelo-tocha" }],
    });
    // a linha do banco continua como estava (leitura aditiva, nada reescrito)
    const linha = sql
      .exec("SELECT dados FROM entidades WHERE colecao = 'personagens' AND id = 'pers-antigo'")
      .toArray()[0] as { dados: string };
    expect(JSON.parse(linha.dados)).toEqual(antigo);
  });
});

describe("Armazenamento: combate do Lote 11", () => {
  const combate: Combate = {
    entradas: [
      {
        id: "e1",
        tokenId: "tok-jogador-1",
        nome: "Aldric",
        iniciativa: 18,
        destreza: 14,
        jogador: true,
      },
      { id: "e2", nome: "Covil", iniciativa: 20, oculta: true },
      { id: "e3", tokenId: "tok-ogro", nome: "Ogro", valorOculto: true },
    ],
    atualId: "e2",
    rodada: 2,
  };

  it("banco do Lote 10 (versão 6, sem a tabela) abre sem quebrar, sem combate, e a campanha continua inteira", async () => {
    const { sql } = await abrirBanco();
    const original = new Armazenamento(sql as never);
    original.migrar();
    original.salvarTudo(estadoInicial(semente));
    sql.exec("DROP TABLE combate");
    original.gravarMeta("versao_esquema", "6");

    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const carregado = reaberto.carregar();
    expect(carregado?.combate).toBeUndefined();
    expect(carregado?.personagens.map((p) => p.nome)).toContain("Aldric");
    expect(carregado?.tokens.length).toBeGreaterThan(3);
    // migrar de novo não faz nada
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
  });

  it("grava o combate pelos eventos, regrava a cada mudança e apaga ao encerrar", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    const evento = (c: Combate | null, seq: number): EventoSala => ({
      seq,
      origem: { usuarioId: "mestre", idPedido: "p" },
      tipo: "combate.alterado",
      dados: { combate: c },
    });
    banco.salvarEventos({ ...base, seq: 1, combate }, [evento(combate, 1)]);
    // reinício: outro Armazenamento sobre o mesmo banco
    const outro = new Armazenamento(sql as never);
    outro.migrar();
    expect(outro.carregar()?.combate).toEqual(combate);

    const proximo = { ...combate, atualId: "e1" };
    banco.salvarEventos({ ...base, seq: 2, combate: proximo }, [evento(proximo, 2)]);
    expect(outro.carregar()?.combate?.atualId).toBe("e1");

    banco.salvarEventos({ ...base, seq: 3 }, [evento(null, 3)]);
    expect(outro.carregar()?.combate).toBeUndefined();
  });

  it("importar (salvarTudo) troca o combate; sem combate na campanha importada, o antigo some; apagarTudo também", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo({ ...base, combate });
    expect(banco.carregar()?.combate).toEqual(combate);
    banco.salvarTudo(base);
    expect(banco.carregar()?.combate).toBeUndefined();
    banco.salvarTudo({ ...base, combate });
    banco.apagarTudo();
    banco.migrar();
    expect(banco.carregar()).toBeNull();
    const linhas = sql.exec("SELECT dados FROM combate").toArray();
    expect(linhas).toEqual([]);
  });

  it("linha de combate ilegível não derruba a sala: vira sem combate", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    sql.exec("INSERT OR REPLACE INTO combate (id, dados) VALUES (1, ?)", "{ não é json");
    expect(banco.carregar()?.combate).toBeUndefined();
    sql.exec(
      "INSERT OR REPLACE INTO combate (id, dados) VALUES (1, ?)",
      JSON.stringify({ rodada: "x" }),
    );
    expect(banco.carregar()?.combate).toBeUndefined();
  });

  it("as condições e a concentração moram no token e voltam do banco", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    const token = base.tokens.find((t) => t.id === "tok-jogador-1");
    if (!token) throw new Error("sem token");
    const novo = { ...token, condicoes: ["caido" as const], exaustao: 2, concentracao: "Bênção" };
    banco.salvarTudo(base);
    banco.salvarEventos(
      { ...base, seq: 1, tokens: base.tokens.map((t) => (t.id === novo.id ? novo : t)) },
      [
        {
          seq: 1,
          origem: { usuarioId: "mestre", idPedido: "p" },
          tipo: "token.editado",
          dados: { token: novo },
        },
      ],
    );
    expect(banco.carregar()?.tokens.find((t) => t.id === novo.id)).toEqual(novo);
  });
});

describe("Armazenamento: desenhos do Lote 13", () => {
  const desenho = (id: string, extra: Partial<Desenho> = {}): Desenho => ({
    id,
    cenaId: "cena-1",
    autorId: "jogador-1",
    forma: "livre",
    pontos: [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ],
    cor: "#e6194b",
    espessura: 4,
    ...extra,
  });
  const evento = (tipo: EventoSala["tipo"], dados: object, seq: number): EventoSala =>
    ({ seq, origem: { usuarioId: "mestre", idPedido: "p" }, tipo, dados }) as EventoSala;

  it("banco do Lote 11 (versão 7, sem a tabela) abre sem quebrar, sem desenhos, e a campanha continua inteira", async () => {
    const { sql } = await abrirBanco();
    const original = new Armazenamento(sql as never);
    original.migrar();
    original.salvarTudo(estadoInicial(semente));
    sql.exec("DROP TABLE desenhos");
    original.gravarMeta("versao_esquema", "7");

    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const carregado = reaberto.carregar();
    expect(carregado?.desenhos).toEqual([]);
    expect(carregado?.personagens.map((p) => p.nome)).toContain("Aldric");
    expect(carregado?.tokens.length).toBeGreaterThan(3);
    // migrar de novo não faz nada, e o desenho já grava
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const base = estadoInicial(semente);
    const d = desenho("d1");
    reaberto.salvarEventos({ ...base, seq: 1, desenhos: [d] }, [
      evento("desenho.criado", { desenho: d }, 1),
    ]);
    expect(reaberto.carregar()?.desenhos).toEqual([d]);
  });

  it("grava, move, apaga e limpa pelos eventos, e a ordem de criação sobrevive ao mover", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    const a = desenho("a");
    const b = desenho("b", { forma: "circulo", preenchido: true });
    const c = desenho("c", { cenaId: "cena-2" });
    banco.salvarEventos({ ...base, seq: 3, desenhos: [a, b, c] }, [
      evento("desenho.criado", { desenho: a }, 1),
      evento("desenho.criado", { desenho: b }, 2),
      evento("desenho.criado", { desenho: c }, 3),
    ]);
    // reinício: outro Armazenamento sobre o mesmo banco
    const outro = new Armazenamento(sql as never);
    outro.migrar();
    expect(outro.carregar()?.desenhos).toEqual([a, b, c]);

    const movido = {
      ...a,
      pontos: [
        { x: 5, y: 5 },
        { x: 6, y: 6 },
      ],
    };
    banco.salvarEventos({ ...base, seq: 4, desenhos: [movido, b, c] }, [
      evento("desenho.movido", { id: "a", pontos: movido.pontos }, 4),
    ]);
    expect(outro.carregar()?.desenhos).toEqual([movido, b, c]);

    banco.salvarEventos({ ...base, seq: 5, desenhos: [movido, c] }, [
      evento("desenho.apagado", { id: "b" }, 5),
    ]);
    expect(outro.carregar()?.desenhos.map((d) => d.id)).toEqual(["a", "c"]);

    banco.salvarEventos({ ...base, seq: 6, desenhos: [c] }, [
      evento("desenho.limpo", { cenaId: "cena-1" }, 6),
    ]);
    expect(outro.carregar()?.desenhos.map((d) => d.id)).toEqual(["c"]);

    // apagar a cena leva os desenhos dela
    banco.salvarEventos({ ...base, seq: 7, desenhos: [] }, [
      evento("cena.apagada", { cenaId: "cena-2" }, 7),
    ]);
    expect(outro.carregar()?.desenhos).toEqual([]);
  });

  it("importar (salvarTudo) troca os desenhos; apagarTudo apaga", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo({ ...base, desenhos: [desenho("a"), desenho("b")] });
    expect(banco.carregar()?.desenhos.map((d) => d.id)).toEqual(["a", "b"]);
    banco.salvarTudo({ ...base, desenhos: [desenho("z")] });
    expect(banco.carregar()?.desenhos.map((d) => d.id)).toEqual(["z"]);
    banco.salvarTudo({ ...base, desenhos: [desenho("z")] });
    banco.apagarTudo();
    expect(sql.exec("SELECT dados FROM desenhos").toArray()).toEqual([]);
  });

  it("linha de desenho ilegível não derruba a sala: é ignorada", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo({ ...estadoInicial(semente), desenhos: [desenho("a")] });
    sql.exec("INSERT INTO desenhos (id, cena_id, dados) VALUES ('x', 'cena-1', ?)", "{ não é json");
    sql.exec(
      "INSERT INTO desenhos (id, cena_id, dados) VALUES ('y', 'cena-1', ?)",
      JSON.stringify({ id: "y", forma: "quadrado" }),
    );
    expect(banco.carregar()?.desenhos.map((d) => d.id)).toEqual(["a"]);
  });
});

describe("Armazenamento: compêndio do Lote 14", () => {
  const REF = { hash: "c".repeat(64), nomeOriginal: "magias.json", magias: 3 };
  const evento = (compendio: typeof REF | null, seq: number): EventoSala => ({
    seq,
    origem: { usuarioId: "mestre", idPedido: "p" },
    tipo: "compendio.alterado",
    dados: { compendio },
  });

  it("banco do Lote 13 (versão 8) abre sem quebrar, sem compêndio, e a campanha continua inteira", async () => {
    const { sql } = await abrirBanco();
    const original = new Armazenamento(sql as never);
    original.migrar();
    original.salvarTudo(estadoInicial(semente));
    // o banco do Lote 13 nunca teve a chave `compendio` (e não há migração nova: a referência mora na meta)
    sql.exec("DELETE FROM meta WHERE chave = 'compendio'");
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const carregado = reaberto.carregar();
    expect(carregado?.compendio).toBeUndefined();
    expect(carregado?.personagens.map((p) => p.nome)).toContain("Aldric");
    expect(carregado?.tokens.length).toBeGreaterThan(3);
  });

  it("o compêndio volta do SQLite (só a referência, nunca o texto) e some ao tirar", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    banco.salvarEventos({ ...base, seq: 1, compendio: REF }, [evento(REF, 1)]);
    expect(banco.carregar()?.compendio).toEqual(REF);
    // reabrir o banco (reinício da sala)
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.carregar()?.compendio).toEqual(REF);
    const guardado = JSON.stringify(
      sql.exec("SELECT valor FROM meta WHERE chave = 'compendio'").toArray(),
    );
    expect(guardado).not.toContain("descricao");
    reaberto.salvarEventos({ ...base, seq: 2 }, [evento(null, 2)]);
    expect(reaberto.carregar()?.compendio).toBeUndefined();
  });

  it("importar (salvarTudo) troca o compêndio; sem compêndio na campanha importada ele some; apagarTudo também", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo({ ...base, compendio: REF });
    expect(banco.carregar()?.compendio).toEqual(REF);
    banco.salvarTudo(base);
    expect(banco.carregar()?.compendio).toBeUndefined();
    banco.salvarTudo({ ...base, compendio: REF });
    banco.apagarTudo();
    expect(sql.exec("SELECT valor FROM meta WHERE chave = 'compendio'").toArray()).toEqual([]);
  });

  it("valor ilegível não derruba a sala: vira sem compêndio", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    banco.gravarMeta("compendio", "{ não é json");
    expect(banco.carregar()?.compendio).toBeUndefined();
    banco.gravarMeta("compendio", JSON.stringify({ hash: "curto" }));
    expect(banco.carregar()?.compendio).toBeUndefined();
  });
});

describe("Armazenamento: o marco de zerar o relógio (V1)", () => {
  it("banco antigo (relógio sem marco) abre com marco ausente; o evento grava o marco e ele sobrevive ao reinício", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    // como o banco de antes do V1 guardava o relógio: sem `marcoMs`
    banco.gravarMeta("relogio", JSON.stringify({ pausada: true, acumuladoMs: 5000 }));
    const antigo = new Armazenamento(sql as never);
    antigo.migrar();
    expect(antigo.carregar()?.relogio).toEqual({ pausada: true, acumuladoMs: 5000 });

    const zerado = { ...base, relogio: { pausada: true, acumuladoMs: 5000, marcoMs: 5000 } };
    banco.salvarEventos(zerado, [
      {
        seq: 1,
        origem: { usuarioId: "mestre", idPedido: "p" },
        tipo: "mesa.relogioZerado",
        dados: { salaMs: 5000 },
      } as EventoSala,
    ]);
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.carregar()?.relogio).toEqual({
      pausada: true,
      acumuladoMs: 5000,
      marcoMs: 5000,
    });
  });
});

describe("Armazenamento: handouts (V3)", () => {
  /** Banco como o do V2: esquema na versão 8, com as notas na coleção `notas` e sem handouts. */
  async function bancoDoV2(notas: { mesa: string; mestre: string }) {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    const gravar = (id: string, texto: string) =>
      sql.exec(
        "INSERT INTO entidades (colecao, id, dados) VALUES ('notas', ?, ?)",
        id,
        JSON.stringify({ texto }),
      );
    gravar("mesa", notas.mesa);
    gravar("mestre", notas.mestre);
    banco.gravarMeta("versao_esquema", "8");
    return { sql, banco };
  }

  it("banco do V2 com as duas notas: viram dois handouts numa pasta nova e as notas somem", async () => {
    const { sql } = await bancoDoV2({ mesa: "Bem-vindos", mestre: "O cofre é falso" });
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const estado = reaberto.carregar();
    expect(estado?.handouts.map((h) => [h.titulo, h.texto, h.visivel.tipo, h.fonte])).toEqual([
      ["Nota da mesa", "Bem-vindos", "todos", "simples"],
      ["Nota do mestre", "O cofre é falso", "mestre", "simples"],
    ]);
    const pasta = estado?.pastas.find((p) => p.nome === "Handouts");
    expect(pasta?.visivel).toEqual({ tipo: "mestre" });
    expect(estado?.handouts.every((h) => h.pastaId === pasta?.id)).toBe(true);
    // a campanha antiga continua inteira, e a pasta nova vem depois das antigas
    expect(estado?.personagens.map((p) => p.nome)).toContain("Aldric");
    expect(estado?.pastas.at(-1)?.id).toBe(pasta?.id);
    // as notas antigas saíram do banco e do estado
    const sobrou = sql.exec("SELECT id FROM entidades WHERE colecao = 'notas'").toArray();
    expect(sobrou).toEqual([]);
    expect(Object.keys(estado ?? {})).not.toContain("notaMesa");
    // abrir de novo não duplica nada
    const outra = new Armazenamento(sql as never);
    outra.migrar();
    expect(outra.carregar()?.handouts).toHaveLength(2);
  });

  it("banco do V2 com as notas vazias: nenhum handout e nenhuma pasta nova", async () => {
    const { sql, banco } = await bancoDoV2({ mesa: "", mestre: "" });
    const antes = banco.carregar()?.pastas.length;
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    const estado = reaberto.carregar();
    expect(estado?.handouts).toEqual([]);
    expect(estado?.pastas).toHaveLength(antes ?? -1);
  });

  it("só a nota do mestre: um handout só do mestre", async () => {
    const { sql } = await bancoDoV2({ mesa: "", mestre: "Plano" });
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    const estado = reaberto.carregar();
    expect(estado?.handouts.map((h) => [h.titulo, h.visivel.tipo])).toEqual([
      ["Nota do mestre", "mestre"],
    ]);
  });

  it("grava, edita e apaga pelos eventos, e sobrevive ao reinício; salvarTudo troca tudo", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    const h = {
      id: "h1",
      pastaId: base.pastas[0]?.id ?? "x",
      titulo: "O livro",
      texto: "Era uma vez",
      fonte: "manuscrito" as const,
      visivel: { tipo: "todos" as const },
    };
    const evento = (tipo: string, dados: object, seq: number) =>
      ({ seq, origem: { usuarioId: "mestre", idPedido: "p" }, tipo, dados }) as EventoSala;
    banco.salvarEventos({ ...base, handouts: [h] }, [
      evento("handout.alterado", { handout: h }, 1),
    ]);
    const editado = { ...h, texto: "Fim" };
    banco.salvarEventos({ ...base, handouts: [editado], seq: 2 }, [
      evento("handout.alterado", { handout: editado }, 2),
    ]);
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.carregar()?.handouts).toEqual([editado]);
    // "Mostrar agora" não grava nada
    banco.salvarEventos({ ...base, handouts: [editado], seq: 3 }, [
      evento("handout.mostrado", { id: "h1" }, 3),
    ]);
    expect(reaberto.carregar()?.handouts).toEqual([editado]);
    banco.salvarEventos({ ...base, handouts: [], seq: 4 }, [
      evento("handout.apagado", { id: "h1" }, 4),
    ]);
    expect(reaberto.carregar()?.handouts).toEqual([]);
    banco.salvarTudo({ ...base, handouts: [h] });
    expect(reaberto.carregar()?.handouts).toEqual([h]);
    banco.salvarTudo(base);
    expect(reaberto.carregar()?.handouts).toEqual([]);
  });
});

describe("Armazenamento: automações (7b-1)", () => {
  const automacoes = AutomacoesSchema.parse({
    ciclos: [
      {
        id: "respiracao",
        nome: "Respiração",
        periodoS: 180,
        cenas: [],
        fases: [{ emS: 0, evento: "inspiracao", duracaoS: 20 }],
      },
    ],
    reacoes: [
      {
        id: "r1",
        fica: { tipo: "modelo", id: "modelo-tocha" },
        ao: "inspiracao",
        fazer: [{ acao: "luz.modificar", raioX: 0.5, porS: 20 }],
      },
    ],
    execucao: { respiracao: { baseSala: 0, disparadoAteTau: 0 } },
  });
  const efeitos = [
    {
      id: "auto:r1:0:t1",
      alvo: { tipo: "token" as const, id: "t1" },
      efeito: { visaoMaxM: 3 },
      ateSala: 5_000,
      origem: "r1",
    },
  ];
  const evento = (tipo: "automacoes.alterado" | "efeitos.alterados", seq: number): EventoSala =>
    tipo === "automacoes.alterado"
      ? { seq, origem: { usuarioId: "m", idPedido: "p" }, tipo, dados: { automacoes } }
      : { seq, origem: { usuarioId: "m", idPedido: "p" }, tipo, dados: { efeitos } };

  it("banco antigo (a campanha real, sem as chaves) abre sem quebrar e sem nenhuma migração nova", async () => {
    const { sql } = await abrirBanco();
    const original = new Armazenamento(sql as never);
    original.migrar();
    original.salvarTudo(estadoInicial(semente));
    // o banco de antes do 7b-1 nunca teve as chaves (e não há migração: moram na meta)
    sql.exec("DELETE FROM meta WHERE chave IN ('automacoes', 'efeitos')");
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    const carregado = reaberto.carregar();
    expect(carregado?.automacoes).toBeUndefined();
    expect(carregado?.efeitos).toBeUndefined();
    expect(carregado?.personagens.map((p) => p.nome)).toContain("Aldric");
    // abrir de novo não muda nada (idempotente)
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
  });

  it("grava pelos eventos e sobrevive ao reinício; só o mestre as lê (o estado guardado é o mesmo)", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    banco.salvarEventos({ ...base, seq: 1, automacoes }, [evento("automacoes.alterado", 1)]);
    banco.salvarEventos({ ...base, seq: 2, automacoes, efeitos }, [evento("efeitos.alterados", 2)]);
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    const carregado = reaberto.carregar();
    expect(carregado?.automacoes).toEqual(automacoes);
    expect(carregado?.efeitos).toEqual(efeitos);
    // efeito que venceu: a lista esvazia e volta vazia
    reaberto.salvarEventos({ ...base, seq: 3, automacoes, efeitos: [] }, [
      { ...evento("efeitos.alterados", 3), dados: { efeitos: [] } } as EventoSala,
    ]);
    expect(reaberto.carregar()?.efeitos).toEqual([]);
  });

  it("importar (salvarTudo) troca as automações; sem elas na campanha importada elas somem; apagarTudo também", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo({ ...base, automacoes, efeitos });
    expect(banco.carregar()?.automacoes).toEqual(automacoes);
    banco.salvarTudo(base);
    expect(banco.carregar()?.automacoes).toBeUndefined();
    expect(banco.carregar()?.efeitos).toBeUndefined();
    banco.salvarTudo({ ...base, automacoes, efeitos });
    banco.apagarTudo();
    expect(
      sql.exec("SELECT valor FROM meta WHERE chave IN ('automacoes', 'efeitos')").toArray(),
    ).toEqual([]);
  });

  it("a fatia guardada antes do 7b-3 (sem `botoes` nem `fixado`) carrega com a lista vazia e nada é reescrito", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    // como a campanha real guardou no 7b-1 e no 7b-2: sem os campos novos
    const antiga = {
      ciclos: [{ id: "c", nome: "C", periodoS: 60, cenas: [], fases: [{ emS: 0, evento: "a" }] }],
      reacoes: [],
      execucao: {},
      pendentes: [],
      registro: [],
    };
    banco.gravarMeta("automacoes", JSON.stringify(antiga));
    const carregado = banco.carregar();
    expect(carregado?.automacoes?.botoes).toEqual([]);
    expect(carregado?.automacoes?.ciclos[0]?.fixado).toBeUndefined();
    expect(carregado?.automacoes?.ciclos[0]?.liberadoParaJogadores).toBeUndefined();
    // abrir de novo não muda o que está guardado (a migração é só o padrão na leitura)
    expect(JSON.parse(banco.lerMeta("automacoes") ?? "{}")).toEqual(antiga);
    expect(banco.carregar()?.automacoes).toEqual(carregado?.automacoes);
  });

  it("valor ilegível não derruba a sala: vira sem automação", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    banco.gravarMeta("automacoes", "{ não é json");
    banco.gravarMeta("efeitos", JSON.stringify([{ id: 1 }]));
    const carregado = banco.carregar();
    expect(carregado?.automacoes).toBeUndefined();
    expect(carregado?.efeitos).toBeUndefined();
    expect(carregado?.tokens.length).toBeGreaterThan(3);
  });
});

describe("Armazenamento: zonas (7b-2)", () => {
  const zona = ZonaSchema.parse({
    id: "z1",
    cenaId: estadoInicial(semente).cenaAtivaId,
    nome: "Gás",
    pontos: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 5 },
    ],
    efeitos: { luzRaioX: 0.5 },
  });
  const origem = { usuarioId: "m", idPedido: "p" };

  it("banco antigo (sem a coleção) abre sem zona e sem migração nova", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    banco.salvarTudo(estadoInicial(semente));
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.lerMeta("versao_esquema")).toBe("15");
    expect(reaberto.carregar()?.zonas).toBeUndefined();
  });

  it("grava pelos eventos (criar, editar, apagar com as reações) e sobrevive ao reinício", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo(base);
    banco.salvarEventos({ ...base, seq: 1, zonas: [zona] }, [
      { seq: 1, origem, tipo: "zona.alterada", dados: { zona } },
    ]);
    const editada = { ...zona, nome: "Gás tóxico", ativa: false };
    banco.salvarEventos({ ...base, seq: 2, zonas: [editada] }, [
      { seq: 2, origem, tipo: "zona.alterada", dados: { zona: editada } },
    ]);
    const reaberto = new Armazenamento(sql as never);
    reaberto.migrar();
    expect(reaberto.carregar()?.zonas).toEqual([editada]);
    // apagar a zona leva as reações dela (o estado já vem sem elas)
    const automacoes = AutomacoesSchema.parse({ reacoes: [] });
    reaberto.salvarEventos({ ...base, seq: 3, automacoes }, [
      { seq: 3, origem, tipo: "zona.apagada", dados: { id: "z1" } },
    ]);
    expect(reaberto.carregar()?.zonas).toBeUndefined();
    expect(reaberto.carregar()?.automacoes).toEqual(automacoes);
  });

  it("importar (salvarTudo) troca as zonas; linha ilegível não derruba a sala", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const base = estadoInicial(semente);
    banco.salvarTudo({ ...base, zonas: [zona] });
    expect(banco.carregar()?.zonas).toEqual([zona]);
    banco.salvarTudo(base);
    expect(banco.carregar()?.zonas).toBeUndefined();
    sql.exec("INSERT INTO entidades (colecao, id, dados) VALUES ('zonas', 'ruim', '{ nada')");
    sql.exec("INSERT INTO entidades (colecao, id, dados) VALUES ('zonas', 'vazia', '{\"id\":1}')");
    expect(banco.carregar()?.zonas).toBeUndefined();
    expect(banco.carregar()?.tokens.length).toBeGreaterThan(3);
  });
});
