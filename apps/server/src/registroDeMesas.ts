import {
  DO_DA_MESA_LEGADA,
  gerarIdDeMesa,
  NOME_DA_MESA_LEGADA,
  PREFIXO_DO_DE_MESA,
} from "@tabletop/shared";

/** Uma mesa do diretório. `legada`: é a campanha de sempre, no Durable Object "campanha". */
export type RegistroDaMesa = {
  id: string;
  doNome: string;
  nome: string;
  criadaEm: number;
  legada: boolean;
};

/** Quantas mesas um mesmo IP cria por hora (assumido; é só um freio simples). */
export const LIMITE_DE_MESAS_POR_HORA = 5;
const JANELA_DO_LIMITE_MS = 3_600_000;

type Linha = { id: string; do_nome: string; nome: string; criada_em: number; legada: number };

const paraRegistro = (l: Linha): RegistroDaMesa => ({
  id: l.id,
  doNome: l.do_nome,
  nome: l.nome,
  criadaEm: l.criada_em,
  legada: l.legada === 1,
});

/**
 * A lista de mesas do servidor (Durable Object `Diretorio`, SQLite). Só acrescenta: criar a tabela e
 * garantir a entrada da mesa legada são idempotentes, e nada aqui toca o Durable Object "campanha".
 */
export class RegistroDeMesas {
  constructor(private readonly sql: SqlStorage) {}

  /** Cria as tabelas (se não existem) e garante a entrada da mesa legada, uma vez só. */
  iniciar(idDaLegada: string | null = null): void {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS mesas (
      id TEXT PRIMARY KEY,
      do_nome TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      criada_em INTEGER NOT NULL,
      legada INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS criacoes (
      ip TEXT NOT NULL,
      em INTEGER NOT NULL
    )`);
    const ja = this.sql.exec("SELECT id FROM mesas WHERE do_nome = ?", DO_DA_MESA_LEGADA).toArray();
    if (ja.length > 0) return;
    this.sql.exec(
      "INSERT OR IGNORE INTO mesas (id, do_nome, nome, criada_em, legada) VALUES (?, ?, ?, ?, 1)",
      idDaLegada ?? gerarIdDeMesa(),
      DO_DA_MESA_LEGADA,
      NOME_DA_MESA_LEGADA,
      Date.now(),
    );
  }

  obter(id: string): RegistroDaMesa | null {
    const l = this.sql.exec("SELECT * FROM mesas WHERE id = ?", id).toArray()[0] as
      | Linha
      | undefined;
    return l ? paraRegistro(l) : null;
  }

  listar(): RegistroDaMesa[] {
    return (
      this.sql.exec("SELECT * FROM mesas ORDER BY legada DESC, criada_em ASC").toArray() as Linha[]
    ).map(paraRegistro);
  }

  /** O IP já criou mesas demais na última hora? (não conta nada, só consulta) */
  limiteAtingido(ip: string, agora: number, limite = LIMITE_DE_MESAS_POR_HORA): boolean {
    const n = this.sql
      .exec(
        "SELECT COUNT(*) AS n FROM criacoes WHERE ip = ? AND em > ?",
        ip,
        agora - JANELA_DO_LIMITE_MS,
      )
      .toArray()[0] as { n: number };
    return n.n >= limite;
  }

  /** Registra uma mesa nova (o Durable Object dela só passa a existir quando o diretório o manda criar). */
  criar(nome: string, ip: string, agora: number, aleatorio?: () => string): RegistroDaMesa {
    this.sql.exec("DELETE FROM criacoes WHERE em <= ?", agora - JANELA_DO_LIMITE_MS);
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const id = aleatorio ? aleatorio() : gerarIdDeMesa();
      const doNome = `${PREFIXO_DO_DE_MESA}${id}`;
      const r = this.sql.exec(
        "INSERT OR IGNORE INTO mesas (id, do_nome, nome, criada_em, legada) VALUES (?, ?, ?, ?, 0)",
        id,
        doNome,
        nome,
        agora,
      );
      if (r.rowsWritten === 0) continue; // id repetido (quase impossível): sorteia outro
      this.sql.exec("INSERT INTO criacoes (ip, em) VALUES (?, ?)", ip, agora);
      return { id, doNome, nome, criadaEm: agora, legada: false };
    }
    throw new Error("não foi possível sortear um id livre");
  }

  renomear(id: string, nome: string): boolean {
    return this.sql.exec("UPDATE mesas SET nome = ? WHERE id = ?", nome, id).rowsWritten > 0;
  }

  /** Desfaz o registro de uma mesa cuja criação falhou no Durable Object dela. */
  esquecer(id: string): void {
    this.sql.exec("DELETE FROM mesas WHERE id = ? AND legada = 0", id);
  }
}
