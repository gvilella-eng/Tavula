import {
  type Estado,
  type EventoSala,
  PERMISSOES_PADRAO,
  type Permissoes,
  type Usuario,
} from "@tabletop/shared";

/** Contadores de uso do dia (dia UTC). */
export type UsoDoDia = { dia: string; mensagens: number; conexoes: number };

type Migracao = (sql: SqlStorage) => void;

/** Migrações versionadas. Nunca edite uma já aplicada: acrescente outra no fim. */
const MIGRACOES: Migracao[] = [
  (sql) => {
    sql.exec(`CREATE TABLE entidades (
      colecao TEXT NOT NULL,
      id TEXT NOT NULL,
      dados TEXT NOT NULL,
      PRIMARY KEY (colecao, id)
    )`);
    sql.exec(`CREATE TABLE agenda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quando INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      chave TEXT NOT NULL,
      dados TEXT NOT NULL,
      UNIQUE (tipo, chave)
    )`);
  },
];

/** Camada de persistência da sala sobre o SQLite do Durable Object. */
export class Armazenamento {
  constructor(private readonly sql: SqlStorage) {}

  /** Cria `meta` e aplica as migrações que faltam (a versão fica em `meta.versao_esquema`). */
  migrar(): void {
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT)");
    const atual = Number(this.lerMeta("versao_esquema") ?? "0");
    for (let v = atual; v < MIGRACOES.length; v++) {
      MIGRACOES[v]?.(this.sql);
      this.gravarMeta("versao_esquema", String(v + 1));
    }
  }

  // --- meta -------------------------------------------------------------------------------

  lerMeta(chave: string): string | null {
    const linha = this.sql
      .exec<{ valor: string }>("SELECT valor FROM meta WHERE chave = ?", chave)
      .toArray()[0];
    return linha?.valor ?? null;
  }

  gravarMeta(chave: string, valor: string): void {
    this.sql.exec("INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)", chave, valor);
  }

  lerUso(): UsoDoDia | null {
    const bruto = this.lerMeta("uso");
    return bruto ? (JSON.parse(bruto) as UsoDoDia) : null;
  }

  gravarUso(uso: UsoDoDia): void {
    this.gravarMeta("uso", JSON.stringify(uso));
  }

  // --- estado -------------------------------------------------------------------------------

  /** Carrega o estado da campanha, ou `null` se o banco está vazio (nunca foi semeado). */
  carregar(): Estado | null {
    const permissoes = this.lerMeta("permissoes");
    if (permissoes === null) return null;
    const salvas = JSON.parse(permissoes) as Permissoes;
    const usuarios = this.sql
      .exec<{ dados: string }>(
        "SELECT dados FROM entidades WHERE colecao = 'usuarios' ORDER BY rowid",
      )
      .toArray()
      .map((l) => JSON.parse(l.dados) as Usuario);
    return {
      seq: Number(this.lerMeta("seq") ?? "0"),
      usuarios,
      // Capacidades novas (lotes futuros) entram com o padrão sem perder o que já foi salvo.
      permissoes: { ...salvas, jogadores: { ...PERMISSOES_PADRAO, ...salvas.jogadores } },
      notaMesa: this.lerNota("mesa"),
      notaMestre: this.lerNota("mestre"),
    };
  }

  private lerNota(id: string): string {
    const linha = this.sql
      .exec<{ dados: string }>("SELECT dados FROM entidades WHERE colecao = 'notas' AND id = ?", id)
      .toArray()[0];
    return linha ? (JSON.parse(linha.dados) as { texto: string }).texto : "";
  }

  private gravarEntidade(colecao: string, id: string, dados: unknown): void {
    const json = JSON.stringify(dados);
    // UPDATE primeiro para manter o rowid (a ordem dos usuários).
    const r = this.sql.exec(
      "UPDATE entidades SET dados = ? WHERE colecao = ? AND id = ?",
      json,
      colecao,
      id,
    );
    if (r.rowsWritten === 0) {
      this.sql.exec(
        "INSERT INTO entidades (colecao, id, dados) VALUES (?, ?, ?)",
        colecao,
        id,
        json,
      );
    }
  }

  /** Substitui o estado inteiro (semente, importação). */
  salvarTudo(estado: Estado): void {
    this.sql.exec("DELETE FROM entidades");
    for (const u of estado.usuarios) this.gravarEntidade("usuarios", u.id, u);
    this.gravarEntidade("notas", "mesa", { texto: estado.notaMesa });
    this.gravarEntidade("notas", "mestre", { texto: estado.notaMestre ?? "" });
    this.gravarMeta("permissoes", JSON.stringify(estado.permissoes));
    this.gravarMeta("seq", String(estado.seq));
  }

  /** Grava só o que os eventos mudaram, mais o `seq`. */
  salvarEventos(estado: Estado, eventos: EventoSala[]): void {
    for (const ev of eventos) {
      switch (ev.tipo) {
        case "nota.alterada":
          this.gravarEntidade("notas", "mesa", { texto: estado.notaMesa });
          break;
        case "notaMestre.alterada":
          this.gravarEntidade("notas", "mestre", { texto: estado.notaMestre ?? "" });
          break;
        case "papel.alterado": {
          const u = estado.usuarios.find((x) => x.id === ev.dados.usuarioId);
          if (u) this.gravarEntidade("usuarios", u.id, u);
          break;
        }
        case "permissao.alterada":
          this.gravarMeta("permissoes", JSON.stringify(estado.permissoes));
          break;
      }
    }
    this.gravarMeta("seq", String(estado.seq));
  }

  /** Apaga todo o estado (só para as rotas de teste). */
  apagarTudo(): void {
    this.sql.exec("DELETE FROM entidades");
    this.sql.exec("DELETE FROM agenda");
    this.sql.exec("DELETE FROM meta WHERE chave <> 'versao_esquema'");
  }
}
