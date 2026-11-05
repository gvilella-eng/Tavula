import { type CandidatoAProvedor, escolherProvedor, type FrameDePedaco } from "@tabletop/shared";

/** O que a coordenação precisa da sala (separado para testar sem Durable Object). */
export interface AmbienteDeTransferencias {
  /** Conexões online que têm cópia do hash, em ordem estável. */
  candidatos(hash: string): CandidatoAProvedor[];
  /** `asset.enviar` ao provedor. */
  pedirEnvio(conexaoId: string, hash: string, indices: number[]): void;
  /** Repasse do frame binário, tal como chegou, a quem espera o pedaço. */
  repassar(conexaoId: string, frame: ArrayBuffer): void;
  /** `asset.indisponivel` a quem espera. */
  avisarIndisponivel(conexaoId: string, hash: string): void;
  agora(): number;
}

type Transferencia = {
  total: number;
  donoId: string;
  /** Quem espera o quê: conexão -> índices que ainda faltam. */
  esperando: Map<string, Set<number>>;
  provedor: string | null;
  /** Índices pedidos ao provedor e ainda não chegados. */
  pendentes: Set<number>;
  ultimoPedaco: number;
  /** Quem já foi avisado de que está indisponível (avisa de novo só quando pedir outra vez). */
  avisados: Set<string>;
};

/** Pedido que o provedor deixa sem andar por este tempo é refeito no próximo `pedir` de quem espera. */
export const TEMPO_PARADO_MS = 15_000;

/**
 * Coordena o envio de arquivos entre os navegadores. Só memória: enquanto há tráfego a sala não
 * hiberna, e se hibernar quem espera pede de novo (o cliente tem um vigia). Nunca grava pedaço.
 *
 * Um provedor por hash de cada vez: ele envia uma vez e a sala repassa a todos que esperam aquele
 * pedaço.
 */
export class Transferencias {
  private readonly porHash = new Map<string, Transferencia>();

  constructor(private readonly ambiente: AmbienteDeTransferencias) {}

  /** Hashes com alguém esperando (para testes e diagnóstico). */
  get ativas(): number {
    return this.porHash.size;
  }

  /** A conexão quer estes índices do arquivo `hash` (de `total` pedaços). */
  pedir(conexaoId: string, hash: string, total: number, donoId: string, indices: number[]): void {
    const validos = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < total);
    if (validos.length === 0) return;
    let t = this.porHash.get(hash);
    if (!t) {
      t = {
        total,
        donoId,
        esperando: new Map(),
        provedor: null,
        pendentes: new Set(),
        ultimoPedaco: this.ambiente.agora(),
        avisados: new Set(),
      };
      this.porHash.set(hash, t);
    }
    const queroEu = t.esperando.get(conexaoId) ?? new Set<number>();
    for (const i of validos) queroEu.add(i);
    t.esperando.set(conexaoId, queroEu);
    // Quem serve não pode ser quem espera o mesmo arquivo (ele que se serve de outro).
    if (t.provedor === conexaoId) this.largarProvedor(t);
    // Provedor parado: refaz o pedido (o provedor reenvia; frames repetidos são inofensivos).
    if (t.pendentes.size > 0 && this.ambiente.agora() - t.ultimoPedaco > TEMPO_PARADO_MS) {
      t.pendentes.clear();
    }
    t.avisados.delete(conexaoId);
    this.despachar(hash, t);
  }

  /**
   * Chegou um frame binário de pedaço. Só vale se a sala pediu aquele hash e índice àquele
   * socket; o resto é descartado em silêncio. Devolve `true` se foi repassado.
   */
  frame(conexaoId: string, f: FrameDePedaco, bruto: ArrayBuffer): boolean {
    const t = this.porHash.get(f.hash);
    if (!t || t.provedor !== conexaoId || !t.pendentes.has(f.indice) || f.total !== t.total) {
      return false;
    }
    t.pendentes.delete(f.indice);
    t.ultimoPedaco = this.ambiente.agora();
    for (const [c, indices] of t.esperando) {
      if (!indices.delete(f.indice)) continue;
      this.ambiente.repassar(c, bruto);
      if (indices.size === 0) t.esperando.delete(c);
    }
    this.encerrarSeAcabou(f.hash, t);
    return true;
  }

  /** O provedor respondeu "não tenho" (a sala já tirou a posse dele): pede o que falta a outro. */
  naoTem(conexaoId: string, hash: string): void {
    const t = this.porHash.get(hash);
    if (!t || t.provedor !== conexaoId) return;
    this.largarProvedor(t);
    this.despachar(hash, t);
  }

  /** Alguém anunciou que tem cópia (inventário ou `asset.tenho`): retoma o que estava indisponível. */
  posseMudou(hash: string): void {
    const t = this.porHash.get(hash);
    if (t && t.provedor === null) this.despachar(hash, t);
  }

  /** A conexão fechou: não espera mais nada e, se servia, outro assume. */
  conexaoSaiu(conexaoId: string): void {
    for (const [hash, t] of [...this.porHash]) {
      t.esperando.delete(conexaoId);
      if (t.provedor === conexaoId) this.largarProvedor(t);
      if (!this.encerrarSeAcabou(hash, t)) this.despachar(hash, t);
    }
  }

  limpar(): void {
    this.porHash.clear();
  }

  // --- internos -------------------------------------------------------------------------------

  private largarProvedor(t: Transferencia): void {
    t.provedor = null;
    t.pendentes.clear();
  }

  private encerrarSeAcabou(hash: string, t: Transferencia): boolean {
    if (t.esperando.size > 0) return false;
    this.porHash.delete(hash);
    return true;
  }

  private despachar(hash: string, t: Transferencia): void {
    const querem = new Set<number>();
    for (const indices of t.esperando.values()) for (const i of indices) querem.add(i);
    if (querem.size === 0) return;
    const semPedido = [...querem].filter((i) => !t.pendentes.has(i)).sort((a, b) => a - b);
    if (semPedido.length === 0) return;

    if (t.provedor === null) {
      const candidatos = this.ambiente
        .candidatos(hash)
        .filter((c) => !t.esperando.has(c.conexaoId));
      const escolhido = escolherProvedor(candidatos, t.donoId);
      if (!escolhido) {
        for (const c of t.esperando.keys()) {
          if (t.avisados.has(c)) continue;
          t.avisados.add(c);
          this.ambiente.avisarIndisponivel(c, hash);
        }
        return;
      }
      t.provedor = escolhido.conexaoId;
      t.avisados.clear();
      t.pendentes.clear();
      t.ultimoPedaco = this.ambiente.agora();
    }
    for (const i of semPedido) t.pendentes.add(i);
    this.ambiente.pedirEnvio(t.provedor, hash, semPedido);
  }
}
