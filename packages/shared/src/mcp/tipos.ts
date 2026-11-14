import type { Estado, EventoSala, Usuario } from "../index.ts";

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
}
