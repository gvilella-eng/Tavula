import {
  type EnvioPublico,
  type Estado,
  estadoInicial,
  fonteComSemente,
  IntencaoSchema,
  LIMITES_DO_ENVIO,
  modelosPadrao,
  processar,
  type Usuario,
  VERSAO_PROTOCOLO,
  visaoPara,
} from "../../index.ts";
import { CompendioLocal } from "../compendio.ts";
import type { Contexto } from "../ferramentas/base.ts";
import { novoLote } from "../servidor.ts";
import type {
  ArquivosDaSala,
  Lote,
  LoteDoClaude,
  PedidoDeEnvio,
  RespostaDaSala,
  SalaLike,
} from "../tipos.ts";

// Uma sala de mentira para os testes das ferramentas: ela roda as regras de verdade (`processar` do shared, com a marca
// do Claude), então o que o teste confere é o que a mesa faria. Guarda o que foi enviado, com o lote de cada pedido.

const T0 = Date.parse("2026-01-01T00:00:00.000Z");

export type Enviado = { tipo: string; dados: unknown; lote: Lote | undefined };

export function estadoDeTeste(): Estado {
  return estadoInicial(
    {
      usuarios: [
        { id: "m", nome: "Mestre", papel: "mestre", cor: "#111111" },
        { id: "j1", nome: "Ana", papel: "jogador", cor: "#333333" },
        { id: "j2", nome: "Bia", papel: "jogador", cor: "#444444" },
      ],
      cenas: [
        {
          id: "c1",
          nome: "Taverna",
          larguraM: 60,
          alturaM: 45,
          grid: { quadradoM: 1.5, visivel: true },
        },
      ],
      cenaAtivaId: "c1",
      modelos: modelosPadrao(),
    },
    T0,
  );
}

export class SalaSimulada implements SalaLike {
  /** A verdade da mesa (o que a sala guarda). */
  verdade: Estado;
  readonly enviados: Enviado[] = [];
  lotesDoClaude: LoteDoClaude[] = [];
  /** M1: a caixa de entrada de mentira (só os testes de `arquivos` a ligam). */
  arquivos?: ArquivosDaSala;
  private relogio = 0;

  constructor(
    private readonly usuarioId: string,
    inicial: Estado = estadoDeTeste(),
  ) {
    this.verdade = inicial;
  }

  eu(): Usuario {
    const u = this.verdade.usuarios.find((x) => x.id === this.usuarioId);
    if (!u) throw new Error("usuário de teste não existe");
    return u;
  }

  estado(): Estado {
    return visaoPara(this.verdade, this.eu());
  }

  lotes(): LoteDoClaude[] {
    return this.lotesDoClaude;
  }

  async enviar(tipo: string, dados: unknown, lote?: Lote): Promise<RespostaDaSala> {
    this.enviados.push({ tipo, dados, lote });
    const lida = IntencaoSchema.safeParse({
      v: VERSAO_PROTOCOLO,
      id: `t${this.enviados.length}`,
      tipo,
      dados,
      ...(lote ? { loteId: lote.loteId, lote: lote.lote } : {}),
    });
    if (!lida.success) {
      return {
        ok: false,
        codigo: "mensagem_invalida",
        mensagem: lida.error.issues[0]?.message ?? "inválido",
      };
    }
    if (tipo === "claude.desfazer") return { ok: true, desfeito: { aplicados: 1, pulados: [] } };
    const agora = new Date(T0 + ++this.relogio * 1000).toISOString();
    const r = processar(this.verdade, this.usuarioId, lida.data, agora, fonteComSemente(7), [], {
      claude: true,
    });
    if (!r.ok) return { ok: false, codigo: r.erro.codigo, mensagem: r.erro.mensagem };
    this.verdade = r.estado;
    const evento = r.eventos[0];
    return evento ? { ok: true, evento } : { ok: true };
  }

  /** O contexto das ferramentas, com o compêndio de exemplo do programa. */
  contexto(): Contexto {
    return {
      sala: this,
      compendio: CompendioLocal.doExemplo(),
      novoLote,
    };
  }

  /** O que cada usuário vê agora. */
  visaoDe(usuarioId: string): Estado {
    const u = this.verdade.usuarios.find((x) => x.id === usuarioId);
    if (!u) throw new Error("usuário de teste não existe");
    return visaoPara(this.verdade, u);
  }
}

/** M1: a caixa de entrada de mentira: guarda os pedidos, devolve um link falso e dá o resultado que o teste combinar. */
export class CaixaSimulada implements ArquivosDaSala {
  readonly pedidos: PedidoDeEnvio[] = [];
  readonly guardados: (PedidoDeEnvio & { bytes: Uint8Array })[] = [];
  readonly estados = new Map<string, EnvioPublico>();
  online = true;

  async criarEnvio(p: PedidoDeEnvio) {
    this.pedidos.push(p);
    return {
      id: `env-${this.pedidos.length}`,
      link: `http://sala/api/m/mesa/claude/envio/tve_${"a".repeat(43)}`,
      expiraEmMs: LIMITES_DO_ENVIO.prazoDoLinkMs,
    };
  }

  async guardarBytes(p: PedidoDeEnvio & { bytes: Uint8Array }) {
    this.guardados.push(p);
    const id = `env-b${this.guardados.length}`;
    this.estados.set(id, {
      id,
      uso: p.uso,
      nome: p.nome,
      estado: "aplicado",
      bytes: p.bytes.length,
      criadoEm: 0,
      hash: "ab".repeat(32),
      resultado: "O mapa entrou na cena.",
    });
    return { id };
  }

  async estado(id: string) {
    return this.estados.get(id) ?? null;
  }

  mestreOnline() {
    return this.online;
  }
}
