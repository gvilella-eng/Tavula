import {
  type AlvoDoEnvio,
  type EnvioPublico,
  ESTADOS_DE_ENVIO,
  type EstadoDeEnvio,
  LIMITES_DO_ENVIO,
  type OpcoesDoEnvio,
  type UsoDeEnvio,
} from "@tabletop/shared";

// M1: a caixa de entrada dos arquivos que o Claude manda. Pura sobre o SQLite da sala (as duas tabelas da migração do M1): quem
// decide a rota, o token e o aviso ao navegador é a sala. Aqui ficam o link de uso único (só o hash do segredo é guardado), o
// teto da caixa, o prazo, o estado de cada envio e os bytes em linhas de até 1 MB.

type Linha = {
  id: string;
  hash_segredo: string;
  usuario_id: string;
  token_id: string;
  uso: string;
  nome: string;
  alvo: string;
  opcoes: string;
  lote_id: string;
  lote_desc: string;
  estado: string;
  link_usado: number;
  mime: string | null;
  bytes: number;
  criado_em: number;
  link_expira_em: number;
  expira_em: number;
  processando_em: number | null;
  hash_arquivo: string | null;
  resultado: string | null;
  motivo: string | null;
};

/** O envio como a sala o usa (com o alvo e as opções já lidos). */
export type Envio = {
  id: string;
  usuarioId: string;
  tokenId: string;
  uso: UsoDeEnvio;
  nome: string;
  alvo: AlvoDoEnvio;
  opcoes: OpcoesDoEnvio;
  loteId: string;
  loteDescricao: string;
  estado: EstadoDeEnvio;
  mime: string | null;
  bytes: number;
  criadoEm: number;
  linkExpiraEm: number;
  processandoEm: number | null;
  hashDoArquivo: string | null;
  resultado: string | null;
  motivo: string | null;
};

export type NovoEnvio = {
  usuarioId: string;
  tokenId: string;
  uso: UsoDeEnvio;
  nome: string;
  alvo: AlvoDoEnvio;
  opcoes: OpcoesDoEnvio;
  loteId: string;
  loteDescricao: string;
  hashDoSegredo: string;
};

/** Quanto tempo o navegador tem para processar antes de a sala oferecer o arquivo de novo (assumido: 90 s). */
export const PRAZO_DO_PROCESSAMENTO_MS = 90_000;

function lerJson<T>(texto: string, padrao: T): T {
  try {
    return JSON.parse(texto) as T;
  } catch {
    return padrao;
  }
}

function doBanco(l: Linha): Envio {
  const estado = (ESTADOS_DE_ENVIO as readonly string[]).includes(l.estado)
    ? (l.estado as EstadoDeEnvio)
    : "erro";
  return {
    id: l.id,
    usuarioId: l.usuario_id,
    tokenId: l.token_id,
    uso: l.uso as UsoDeEnvio,
    nome: l.nome,
    alvo: lerJson<AlvoDoEnvio>(l.alvo, {}),
    opcoes: lerJson<OpcoesDoEnvio>(l.opcoes, {}),
    loteId: l.lote_id,
    loteDescricao: l.lote_desc,
    estado,
    mime: l.mime,
    bytes: l.bytes,
    criadoEm: l.criado_em,
    linkExpiraEm: l.link_expira_em,
    processandoEm: l.processando_em,
    hashDoArquivo: l.hash_arquivo,
    resultado: l.resultado,
    motivo: l.motivo,
  };
}

/** O que o Claude pode saber do envio dele (sem token, usuário nem bytes). */
export function publicoDoEnvio(e: Envio): EnvioPublico {
  return {
    id: e.id,
    uso: e.uso,
    nome: e.nome,
    estado: e.estado,
    bytes: e.bytes,
    criadoEm: e.criadoEm,
    ...(e.hashDoArquivo ? { hash: e.hashDoArquivo } : {}),
    ...(e.resultado ? { resultado: e.resultado } : {}),
    ...(e.motivo ? { motivo: e.motivo } : {}),
  };
}

export type ResultadoDoLink =
  | { ok: true; envio: Envio }
  | { ok: false; motivo: "desconhecido" | "usado" | "vencido" };

export class CaixaDeEntrada {
  constructor(private readonly sql: SqlStorage) {}

  private linha(id: string): Linha | undefined {
    return this.sql.exec<Linha>("SELECT * FROM claude_envios WHERE id = ?", id).toArray()[0];
  }

  /** O envio, ou `undefined`. */
  ler(id: string): Envio | undefined {
    const l = this.linha(id);
    return l ? doBanco(l) : undefined;
  }

  /** Quantos envios abertos o token tem (esperando o arquivo, o navegador ou o processamento). */
  abertosDoToken(tokenId: string, agora: number): number {
    this.limpar(agora);
    const r = this.sql
      .exec<{ n: number }>(
        `SELECT COUNT(*) AS n FROM claude_envios WHERE token_id = ? AND estado IN ('aguardando','recebido','processando')`,
        tokenId,
      )
      .toArray()[0];
    return r?.n ?? 0;
  }

  /** Abre um envio esperando o arquivo. Devolve o id. O chamador confere o teto de abertos antes. */
  criar(n: NovoEnvio, agora: number): string {
    const id = `env-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    this.sql.exec(
      `INSERT INTO claude_envios (id, hash_segredo, usuario_id, token_id, uso, nome, alvo, opcoes, lote_id, lote_desc, estado,
         criado_em, link_expira_em, expira_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando', ?, ?, ?)`,
      id,
      n.hashDoSegredo,
      n.usuarioId,
      n.tokenId,
      n.uso,
      n.nome,
      JSON.stringify(n.alvo),
      JSON.stringify(n.opcoes),
      n.loteId,
      n.loteDescricao,
      agora,
      agora + LIMITES_DO_ENVIO.prazoDoLinkMs,
      agora + LIMITES_DO_ENVIO.prazoDoArquivoMs,
    );
    return id;
  }

  /**
   * Gasta o link (uso único): confere que existe, que não foi usado e que não venceu, e o marca como usado na mesma hora (um
   * recebimento que falha depois também queima o link: o Claude pede outro). Síncrono: sem corrida entre dois PUT.
   */
  gastarLink(hashDoSegredo: string, agora: number): ResultadoDoLink {
    const l = this.sql
      .exec<Linha>("SELECT * FROM claude_envios WHERE hash_segredo = ?", hashDoSegredo)
      .toArray()[0];
    if (!l) return { ok: false, motivo: "desconhecido" };
    if (l.link_usado !== 0 || l.estado !== "aguardando") return { ok: false, motivo: "usado" };
    if (agora > l.link_expira_em) {
      this.sql.exec(
        "UPDATE claude_envios SET estado = 'erro', link_usado = 1, motivo = ? WHERE id = ?",
        "O link venceu antes de o arquivo chegar.",
        l.id,
      );
      return { ok: false, motivo: "vencido" };
    }
    this.sql.exec("UPDATE claude_envios SET link_usado = 1 WHERE id = ?", l.id);
    return { ok: true, envio: doBanco({ ...l, link_usado: 1 }) };
  }

  /** Quantos bytes a caixa guarda agora (os envios recebidos e os em processamento). */
  bytesNaCaixa(): number {
    const r = this.sql
      .exec<{ n: number | null }>(
        `SELECT SUM(bytes) AS n FROM claude_envios WHERE estado IN ('recebido','processando')`,
      )
      .toArray()[0];
    return r?.n ?? 0;
  }

  /** Guarda um pedaço (até 1 MB) do arquivo que está chegando. */
  gravarPedaco(id: string, indice: number, dados: Uint8Array): void {
    const exato = dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength);
    this.sql.exec(
      "INSERT OR REPLACE INTO claude_envios_pedacos (envio_id, indice, dados) VALUES (?, ?, ?)",
      id,
      indice,
      exato as ArrayBuffer,
    );
  }

  /** O arquivo chegou inteiro e é do formato certo: espera o navegador do mestre (o prazo de 24 h conta daqui). */
  receber(id: string, bytes: number, mime: string, agora: number): void {
    this.sql.exec(
      "UPDATE claude_envios SET estado = 'recebido', bytes = ?, mime = ?, expira_em = ? WHERE id = ?",
      bytes,
      mime,
      agora + LIMITES_DO_ENVIO.prazoDoArquivoMs,
      id,
    );
  }

  /** O envio não deu: guarda o motivo e apaga os bytes. */
  falhar(id: string, motivo: string): void {
    this.sql.exec("DELETE FROM claude_envios_pedacos WHERE envio_id = ?", id);
    this.sql.exec(
      "UPDATE claude_envios SET estado = 'erro', motivo = ?, bytes = 0, processando_em = NULL WHERE id = ? AND estado <> 'aplicado'",
      motivo.slice(0, 300),
      id,
    );
  }

  /** O uso foi aplicado: guarda o hash e o que foi feito e apaga os bytes da caixa. */
  aplicar(id: string, hash: string, resultado: string): void {
    this.sql.exec("DELETE FROM claude_envios_pedacos WHERE envio_id = ?", id);
    this.sql.exec(
      "UPDATE claude_envios SET estado = 'aplicado', hash_arquivo = ?, resultado = ?, bytes = 0, processando_em = NULL WHERE id = ?",
      hash,
      resultado.slice(0, 300),
      id,
    );
  }

  /** O navegador do mestre baixou o arquivo e está processando. */
  marcarProcessando(id: string, agora: number): void {
    this.sql.exec(
      "UPDATE claude_envios SET estado = 'processando', processando_em = ? WHERE id = ? AND estado IN ('recebido','processando')",
      agora,
      id,
    );
  }

  /**
   * O que o navegador do mestre deve processar: os recebidos e os que ficaram em processamento por mais de 90 s (o navegador
   * fechou no meio). Do mais antigo ao mais novo.
   */
  pendentes(agora: number): Envio[] {
    this.limpar(agora);
    return this.sql
      .exec<Linha>(
        `SELECT * FROM claude_envios
          WHERE estado = 'recebido' OR (estado = 'processando' AND COALESCE(processando_em, 0) < ?)
          ORDER BY criado_em, id LIMIT ?`,
        agora - PRAZO_DO_PROCESSAMENTO_MS,
        LIMITES_DO_ENVIO.pendentesNoAviso,
      )
      .toArray()
      .map(doBanco);
  }

  /** Os pedaços do arquivo, na ordem (um por vez, para não segurar 64 MB de uma vez). */
  indicesDosPedacos(id: string): number[] {
    return this.sql
      .exec<{ indice: number }>(
        "SELECT indice FROM claude_envios_pedacos WHERE envio_id = ? ORDER BY indice",
        id,
      )
      .toArray()
      .map((l) => l.indice);
  }

  lerPedaco(id: string, indice: number): Uint8Array | null {
    const l = this.sql
      .exec<{ dados: ArrayBuffer }>(
        "SELECT dados FROM claude_envios_pedacos WHERE envio_id = ? AND indice = ?",
        id,
        indice,
      )
      .toArray()[0];
    if (!l) return null;
    return new Uint8Array(l.dados);
  }

  /** Todos os bytes (para os testes e para arquivos pequenos). */
  lerBytes(id: string): Uint8Array {
    const partes = this.indicesDosPedacos(id).map((i) => this.lerPedaco(id, i) ?? new Uint8Array());
    const total = partes.reduce((s, p) => s + p.length, 0);
    const saida = new Uint8Array(total);
    let de = 0;
    for (const p of partes) {
      saida.set(p, de);
      de += p.length;
    }
    return saida;
  }

  /**
   * Faxina: o link que venceu sem arquivo vira erro; o que passou do prazo (24 h) some junto com os bytes, e o aplicado ou com
   * erro também some depois do prazo (até lá o Claude ainda consulta o resultado).
   */
  limpar(agora: number): void {
    this.sql.exec(
      "UPDATE claude_envios SET estado = 'erro', link_usado = 1, motivo = ? WHERE estado = 'aguardando' AND link_expira_em < ?",
      "O link venceu antes de o arquivo chegar.",
      agora,
    );
    this.sql.exec(
      "DELETE FROM claude_envios_pedacos WHERE envio_id IN (SELECT id FROM claude_envios WHERE expira_em < ?)",
      agora,
    );
    this.sql.exec("DELETE FROM claude_envios WHERE expira_em < ?", agora);
  }

  /** Só para o `/teste/zerar`. */
  apagarTudo(): void {
    this.sql.exec("DELETE FROM claude_envios_pedacos");
    this.sql.exec("DELETE FROM claude_envios");
  }

  /** Os abertos (para a lista de quem consulta). */
  abertos(): Envio[] {
    return this.sql
      .exec<Linha>(
        `SELECT * FROM claude_envios WHERE estado IN ('aguardando','recebido','processando') ORDER BY criado_em`,
      )
      .toArray()
      .map(doBanco);
  }
}
