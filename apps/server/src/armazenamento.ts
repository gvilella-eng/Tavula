import {
  type AssetMeta,
  CENA_PADRAO,
  type Cena,
  type Estado,
  type EventoSala,
  PERMISSOES_PADRAO,
  type Permissoes,
  type Token,
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
  // Lote 3: quem tem cada asset, por conexão (sobrevive à hibernação; só metadados, nunca bytes).
  (sql) => {
    sql.exec(`CREATE TABLE posse (
      conexao TEXT NOT NULL,
      usuario TEXT NOT NULL,
      hash TEXT NOT NULL,
      PRIMARY KEY (conexao, hash)
    )`);
    sql.exec("CREATE INDEX posse_hash ON posse (hash)");
  },
];

/** Quem tem cópia de um asset: uma conexão de um usuário. */
export type Posse = { conexao: string; usuario: string };

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
      ...this.carregarMapa(),
    };
  }

  /** Cenas, tokens e assets. Banco do Lote 1 (sem cena): cria a cena padrão, sem quebrar o resto. */
  private carregarMapa(): Pick<Estado, "cenas" | "cenaAtivaId" | "tokens" | "assets"> {
    const ler = <T>(colecao: string): T[] =>
      this.sql
        .exec<{ dados: string }>(
          "SELECT dados FROM entidades WHERE colecao = ? ORDER BY rowid",
          colecao,
        )
        .toArray()
        .map((l) => JSON.parse(l.dados) as T);
    const cenas = ler<Cena>("cenas");
    if (cenas.length === 0) cenas.push(CENA_PADRAO);
    const ativa = this.lerMeta("cena_ativa");
    const cenaAtivaId = cenas.some((c) => c.id === ativa)
      ? (ativa as string)
      : (cenas[0]?.id ?? CENA_PADRAO.id);
    return { cenas, cenaAtivaId, tokens: ler<Token>("tokens"), assets: ler<AssetMeta>("assets") };
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
    for (const c of estado.cenas) this.gravarEntidade("cenas", c.id, c);
    for (const t of estado.tokens) this.gravarEntidade("tokens", t.id, t);
    for (const a of estado.assets ?? []) this.gravarEntidade("assets", a.hash, a);
    this.gravarMeta("cena_ativa", estado.cenaAtivaId);
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
        case "token.criado":
        case "token.editado":
          this.gravarEntidade("tokens", ev.dados.token.id, ev.dados.token);
          break;
        case "token.movido": {
          const t = estado.tokens.find((x) => x.id === ev.dados.id);
          if (t) this.gravarEntidade("tokens", t.id, t);
          break;
        }
        case "token.apagado":
        case "token.sumiu":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'tokens' AND id = ?", ev.dados.id);
          break;
        case "cena.gridAlterado":
        case "cena.mapaAlterado": {
          const c = estado.cenas.find((x) => x.id === ev.dados.cenaId);
          if (c) this.gravarEntidade("cenas", c.id, c);
          break;
        }
        case "asset.registrado":
          this.gravarEntidade("assets", ev.dados.meta.hash, ev.dados.meta);
          break;
      }
    }
    this.gravarMeta("seq", String(estado.seq));
  }

  // --- posse de assets ------------------------------------------------------------------------

  /** Troca tudo o que a conexão tem pelo inventário que ela acabou de mandar. */
  substituirPosse(conexao: string, usuario: string, hashes: string[]): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ?", conexao);
    for (const hash of new Set(hashes)) {
      this.sql.exec(
        "INSERT INTO posse (conexao, usuario, hash) VALUES (?, ?, ?)",
        conexao,
        usuario,
        hash,
      );
    }
  }

  adicionarPosse(conexao: string, usuario: string, hash: string): void {
    this.sql.exec(
      "INSERT OR REPLACE INTO posse (conexao, usuario, hash) VALUES (?, ?, ?)",
      conexao,
      usuario,
      hash,
    );
  }

  removerPosse(conexao: string, hash: string): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ? AND hash = ?", conexao, hash);
  }

  /** Conexão fechada: ela não tem mais nada. */
  limparPosse(conexao: string): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ?", conexao);
  }

  /** Quem tem o hash, na ordem em que anunciou (estável). */
  possesDe(hash: string): Posse[] {
    return this.sql
      .exec<Posse>("SELECT conexao, usuario FROM posse WHERE hash = ? ORDER BY rowid", hash)
      .toArray();
  }

  /** Ao acordar: some a posse de conexões que não existem mais. */
  limparPosseOrfa(conexoesVivas: string[]): void {
    const vivas = new Set(conexoesVivas);
    const todas = this.sql
      .exec<{ conexao: string }>("SELECT DISTINCT conexao FROM posse")
      .toArray();
    for (const { conexao } of todas) if (!vivas.has(conexao)) this.limparPosse(conexao);
  }

  /** Apaga todo o estado (só para as rotas de teste). */
  apagarTudo(): void {
    this.sql.exec("DELETE FROM posse");
    this.sql.exec("DELETE FROM entidades");
    this.sql.exec("DELETE FROM agenda");
    this.sql.exec("DELETE FROM meta WHERE chave <> 'versao_esquema'");
  }
}
