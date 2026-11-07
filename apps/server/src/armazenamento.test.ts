import { estadoInicial, type Mensagem } from "@tabletop/shared";
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
    expect(reaberto.lerMeta("versao_esquema")).toBe("6");
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
