import {
  DO_DA_MESA_LEGADA,
  ehIdDeMesa,
  ID_DA_MESA_LEGADA_DE_TESTE,
  NOME_DA_MESA_LEGADA,
  PREFIXO_DO_DE_MESA,
} from "@tabletop/shared";
import { describe, expect, it } from "vitest";
import semente from "../../../fixtures/campanha.seed.json";
import { Armazenamento } from "./armazenamento";
import { carregarOuSemear, criarMesaNova } from "./inicializacao";
import { IdEmUso, LIMITE_DE_MESAS_POR_HORA, RegistroDeMesas } from "./registroDeMesas";

// O SQLite do Durable Object só existe no workerd. Aqui o mesmo adaptador do `armazenamento.test.ts`,
// sobre o `node:sqlite` em memória.
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

type Sql = { exec(c: string): { toArray(): unknown[] } };

/** Tudo o que há em todas as tabelas do banco, para comparar antes e depois. */
function fotografia(sql: Sql): string {
  const tabelas = (
    sql.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").toArray() as {
      name: string;
    }[]
  ).map((t) => t.name);
  return JSON.stringify(
    tabelas.map((t) => [t, sql.exec(`SELECT * FROM "${t}" ORDER BY 1, 2`).toArray()]),
  );
}

describe("RegistroDeMesas (diretório)", () => {
  it("garante a mesa legada no DO 'campanha', uma vez só, e o id gerado fica gravado", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    const primeira = registro.listar();
    expect(primeira).toHaveLength(1);
    expect(primeira[0]).toMatchObject({
      doNome: DO_DA_MESA_LEGADA,
      nome: NOME_DA_MESA_LEGADA,
      legada: true,
    });
    expect(ehIdDeMesa(primeira[0]?.id ?? "")).toBe(true);

    // subir de novo (reinício, recarga do wrangler): nada muda, nem o id
    const antes = fotografia(sql as never);
    registro.iniciar();
    new RegistroDeMesas(sql as never).iniciar();
    new RegistroDeMesas(sql as never).iniciar("zzzz-zzzz-zzzz");
    expect(fotografia(sql as never)).toBe(antes);
    expect(registro.listar()).toEqual(primeira);
  });

  it("em modo de teste a legada recebe o id fixo dos E2E", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar(ID_DA_MESA_LEGADA_DE_TESTE);
    expect(registro.obter(ID_DA_MESA_LEGADA_DE_TESTE)?.doNome).toBe("campanha");
  });

  it("uma mesa nova ganha o DO 'mesa:<id>'; consulta por id; renomear; id desconhecido é null", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    const nova = registro.criar("Minha mesa", "1.2.3.4", 1000);
    expect(nova.doNome).toBe(`${PREFIXO_DO_DE_MESA}${nova.id}`);
    expect(nova.legada).toBe(false);
    expect(registro.obter(nova.id)).toMatchObject({ nome: "Minha mesa", criadaEm: 1000 });
    expect(registro.obter("xxxx-xxxx-xxxx")).toBeNull();
    expect(registro.renomear(nova.id, "Outro nome")).toBe(true);
    expect(registro.obter(nova.id)?.nome).toBe("Outro nome");
    expect(registro.renomear("xxxx-xxxx-xxxx", "x")).toBe(false);
    // a legada continua primeiro e intacta
    expect(registro.listar().map((m) => m.legada)).toEqual([true, false]);
  });

  it("sorteia outro id se o primeiro já existe", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    registro.criar("a", "ip", 1, () => "aaaa-aaaa-aaaa");
    const ids = ["aaaa-aaaa-aaaa", "bbbb-bbbb-bbbb"];
    const segunda = registro.criar("b", "ip", 2, () => ids.shift() ?? "cccc-cccc-cccc");
    expect(segunda.id).toBe("bbbb-bbbb-bbbb");
  });

  it("o id vem do navegador (C2): vale se estiver livre; id repetido dá IdEmUso e não registra nada", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    const nova = registro.criar("Com id do navegador", "1.1.1.1", 1, undefined, "k7m2-qx9p-4tdn");
    expect(nova.id).toBe("k7m2-qx9p-4tdn");
    expect(nova.doNome).toBe("mesa:k7m2-qx9p-4tdn");
    expect(() => registro.criar("Outra", "1.1.1.1", 2, undefined, "k7m2-qx9p-4tdn")).toThrow(
      IdEmUso,
    );
    expect(registro.listar().filter((m) => m.nome === "Outra")).toEqual([]);
  });

  it("o limite por IP vale na janela de uma hora e não mistura IPs", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    const t0 = 10_000_000;
    for (let i = 0; i < LIMITE_DE_MESAS_POR_HORA; i++) {
      expect(registro.limiteAtingido("9.9.9.9", t0 + i)).toBe(false);
      registro.criar(`m${i}`, "9.9.9.9", t0 + i);
    }
    expect(registro.limiteAtingido("9.9.9.9", t0 + 100)).toBe(true);
    expect(registro.limiteAtingido("8.8.8.8", t0 + 100)).toBe(false);
    // uma hora depois, volta a poder
    expect(registro.limiteAtingido("9.9.9.9", t0 + 3_600_000 + LIMITE_DE_MESAS_POR_HORA)).toBe(
      false,
    );
  });

  it("esquecer remove uma mesa nova, nunca a legada", async () => {
    const { sql } = await abrirBanco();
    const registro = new RegistroDeMesas(sql as never);
    registro.iniciar();
    const legada = registro.listar()[0];
    const nova = registro.criar("x", "ip", 1);
    registro.esquecer(nova.id);
    registro.esquecer(legada?.id ?? "");
    expect(registro.listar().map((m) => m.id)).toEqual([legada?.id]);
  });
});

describe("inicialização do Durable Object (carregarOuSemear / criarMesaNova)", () => {
  it("a campanha de hoje (estado antigo, DO 'campanha') carrega sem mudar um byte", async () => {
    const { sql } = await abrirBanco();
    // a campanha "de hoje": migrada, semeada e mexida
    const antigo = carregarOuSemear(new Armazenamento(sql as never), DO_DA_MESA_LEGADA, semente);
    expect(antigo?.usuarios).toHaveLength(8);
    const outraCena = antigo?.cenas[1]?.id ?? "x";
    new Armazenamento(sql as never).gravarMeta("cena_ativa", outraCena);
    const antes = fotografia(sql as never);

    // o código novo sobe sobre esse estado (duas vezes: idempotente)
    for (let i = 0; i < 2; i++) {
      const carregado = carregarOuSemear(
        new Armazenamento(sql as never),
        DO_DA_MESA_LEGADA,
        semente,
      );
      expect(carregado?.cenaAtivaId).toBe(outraCena);
      expect(carregado?.tokens).toHaveLength(antigo?.tokens.length ?? -1);
    }
    expect(fotografia(sql as never)).toBe(antes);
  });

  it("a mesa legada ainda vazia nasce da semente de exemplo, como sempre", async () => {
    const { sql } = await abrirBanco();
    const estado = carregarOuSemear(new Armazenamento(sql as never), DO_DA_MESA_LEGADA, semente);
    expect(estado?.usuarios).toHaveLength(8);
    expect(estado?.personagens.length).toBeGreaterThan(0);
  });

  it("um DO de mesa que nunca foi criado não se auto-semeia e responde 'não existe'", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    expect(carregarOuSemear(banco, "mesa:k7m2-qx9p-4tdn", semente)).toBeNull();
    expect(carregarOuSemear(banco, undefined, semente)).toBeNull();
    expect(banco.carregar()).toBeNull();
  });

  it("a mesa nova nasce vazia, e criar de novo não muda nada", async () => {
    const { sql } = await abrirBanco();
    const banco = new Armazenamento(sql as never);
    banco.migrar();
    const { estado, jaExistia } = criarMesaNova(banco);
    expect(jaExistia).toBe(false);
    expect(estado.usuarios.map((u) => u.id)).toEqual(["mestre"]);
    expect(estado.tokens).toEqual([]);
    expect(estado.personagens).toEqual([]);
    expect(estado.cenas).toHaveLength(1);

    // o DO acorda depois: carrega o que foi gravado, sem semear nada
    const recarregado = carregarOuSemear(new Armazenamento(sql as never), "mesa:x", semente);
    expect(recarregado?.usuarios).toHaveLength(1);
    expect(recarregado?.tokens).toEqual([]);

    const antes = fotografia(sql as never);
    expect(criarMesaNova(new Armazenamento(sql as never)).jaExistia).toBe(true);
    expect(fotografia(sql as never)).toBe(antes);
  });
});
