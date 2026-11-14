import type {
  AlvoDoEnvio,
  EnvioPublico,
  Estado,
  EventoSala,
  OpcoesDoEnvio,
  UsoDeEnvio,
  Usuario,
} from "../index.ts";

/** O que cada chamada de ferramenta manda em toda intenção, para o "Desfazer" da mesa agrupar o que ela fez. */
export type Lote = { loteId: string; lote: string };

export type LoteDoClaude = {
  loteId: string;
  descricao: string;
  emMs: number;
  itens: number;
  desfeito: boolean;
  desfazivel: boolean;
};

export type RespostaDaSala =
  | { ok: true; evento?: EventoSala; desfeito?: { aplicados: number; pulados: string[] } }
  | { ok: false; codigo: string; mensagem: string };

/** O pedido de um envio de arquivo (M1): o uso, o nome para exibição, o alvo, as opções e o lote do Desfazer. */
export type PedidoDeEnvio = {
  uso: UsoDeEnvio;
  nome: string;
  alvo: AlvoDoEnvio;
  opcoes: OpcoesDoEnvio;
  lote: Lote;
};

/**
 * M1: a caixa de entrada de arquivos do Claude. Só a rota HTTP da sala a tem (o link de envio mora lá); o MCP em stdio não
 * (a ferramenta `arquivos` avisa). Quem a implementa: a sala e a sala de mentira dos testes.
 */
export interface ArquivosDaSala {
  /** Abre um envio e dá o link de uso único (`PUT`). Falha com `ErroDoMcp` se há envios demais abertos. */
  criarEnvio(p: PedidoDeEnvio): Promise<{ id: string; link: string; expiraEmMs: number }>;
  /** O arquivo já em mãos (base64): guarda na caixa e abre o envio de uma vez. */
  guardarBytes(p: PedidoDeEnvio & { bytes: Uint8Array }): Promise<{ id: string }>;
  /** O estado do envio; com `esperaMs`, espera até acabar (aplicado ou erro) ou o prazo passar. `null`: não existe. */
  estado(id: string, esperaMs?: number): Promise<EnvioPublico | null>;
  /** Há um navegador de mestre conectado agora? (para dizer se vai processar já ou quando a mesa abrir) */
  mestreOnline(): boolean;
}

/**
 * O que as ferramentas precisam da conexão com a mesa. Quem a implementa: o cliente WebSocket do `apps/mcp` (stdio), a
 * sala (rota HTTP `mcp`, que fala direto com o estado) e a sala de mentira dos testes.
 */
export interface SalaLike {
  /** O estado como a sala o mostra a este usuário. Falha com um texto claro se não há conexão. */
  estado(): Estado;
  eu(): Usuario;
  lotes(): LoteDoClaude[];
  enviar(tipo: string, dados: unknown, lote?: Lote): Promise<RespostaDaSala>;
  /** M1: a caixa de entrada de arquivos (só na rota HTTP da sala). */
  arquivos?: ArquivosDaSala;
}
