type Linha = { id: number; tipo: string; chave: string; dados: string };
type Vencimento = { tipo: string; chave: string; dados: unknown };

/**
 * Agendador único da sala (base do agendador do Lote 7). Os vencimentos ficam no SQLite e o
 * `alarm()` do Durable Object, que só pode ter um, aponta sempre para o próximo.
 * Um vencimento é identificado por `tipo` + `chave`; agendar de novo o substitui.
 */
export class Agendador {
  constructor(
    private readonly sql: SqlStorage,
    private readonly armazenamento: DurableObjectStorage,
  ) {}

  /** Insere o vencimento sem mexer no alarme: quem anota em lote chama `reprogramar()` uma vez no fim. */
  anotar(tipo: string, chave: string, quando: number, dados: unknown = {}): void {
    this.sql.exec(
      "INSERT OR REPLACE INTO agenda (tipo, chave, quando, dados) VALUES (?, ?, ?, ?)",
      tipo,
      chave,
      quando,
      JSON.stringify(dados),
    );
  }

  async agendar(tipo: string, chave: string, quando: number, dados: unknown = {}): Promise<void> {
    this.anotar(tipo, chave, quando, dados);
    await this.reprogramar();
  }

  /** Remove um vencimento. O alarme pode disparar à toa uma vez: o `alarm()` ignora. */
  cancelar(tipo: string, chave: string): void {
    this.sql.exec("DELETE FROM agenda WHERE tipo = ? AND chave = ?", tipo, chave);
  }

  existe(tipo: string, chave: string): boolean {
    return (
      this.sql.exec("SELECT 1 FROM agenda WHERE tipo = ? AND chave = ?", tipo, chave).toArray()
        .length > 0
    );
  }

  chaves(tipo: string): string[] {
    return this.sql
      .exec<{ chave: string }>("SELECT chave FROM agenda WHERE tipo = ?", tipo)
      .toArray()
      .map((l) => l.chave);
  }

  /** Remove e devolve os vencimentos que já passaram. */
  tomarVencidos(agora: number): Vencimento[] {
    const linhas = this.sql
      .exec<Linha>(
        "SELECT id, tipo, chave, dados FROM agenda WHERE quando <= ? ORDER BY quando, id",
        agora,
      )
      .toArray();
    for (const l of linhas) this.sql.exec("DELETE FROM agenda WHERE id = ?", l.id);
    return linhas.map((l) => ({
      tipo: l.tipo,
      chave: l.chave,
      dados: JSON.parse(l.dados) as unknown,
    }));
  }

  /** Aponta o alarme do Durable Object para o próximo vencimento (ou o apaga). */
  async reprogramar(): Promise<void> {
    const proximo = this.sql
      .exec<{ quando: number }>("SELECT MIN(quando) AS quando FROM agenda")
      .toArray()[0]?.quando;
    if (proximo === null || proximo === undefined) await this.armazenamento.deleteAlarm();
    else await this.armazenamento.setAlarm(proximo);
  }
}
