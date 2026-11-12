import { type GradeDeMemoria, gradeServe } from "@tabletop/shared";

/**
 * O que fica gravado de uma cena: a grade (uma célula por byte) e o último "esquecer" do mestre que
 * este navegador já aplicou (para esquecer também quando estava offline na hora).
 */
export type RegistroDeMemoria = {
  colunas: number;
  linhas: number;
  celulaM: number;
  dados: Uint8Array;
  esquecimento: number;
};

const NOME_DO_BANCO = "tabletop-memoria";
const NOME_DA_LOJA = "cenas";

/**
 * Memória do mapa guardada no IndexedDB, uma entrada por usuário e cena (só de tela: nunca vai para a
 * sala). Qualquer falha (navegador sem IndexedDB, janela anônima, banco bloqueado) cai numa cópia em
 * memória: a memória funciona até o refresh, e o app não quebra.
 */
export class ArmazemDeMemoria {
  private banco: Promise<IDBDatabase | null> | null = null;
  private readonly copia = new Map<string, RegistroDeMemoria>();

  private abrir(): Promise<IDBDatabase | null> {
    if (this.banco) return this.banco;
    this.banco = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const pedido = indexedDB.open(NOME_DO_BANCO, 1);
        pedido.onupgradeneeded = () => {
          if (!pedido.result.objectStoreNames.contains(NOME_DA_LOJA)) {
            pedido.result.createObjectStore(NOME_DA_LOJA);
          }
        };
        pedido.onsuccess = () => resolve(pedido.result);
        pedido.onerror = () => resolve(null);
        pedido.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.banco;
  }

  /**
   * Lê a memória de `chave`. Se não há e vem `chaveAntiga` (a mesa legada, de antes de a chave levar o id da
   * mesa), lê a antiga e a COPIA para a chave nova: a antiga fica onde estava (só se acrescenta) e o que o
   * jogador já explorou não se perde.
   */
  async ler(chave: string, chaveAntiga?: string): Promise<RegistroDeMemoria | undefined> {
    const atual = await this.lerUm(chave);
    if (atual || !chaveAntiga) return atual;
    const antigo = await this.lerUm(chaveAntiga);
    if (antigo) await this.gravar(chave, antigo);
    return antigo;
  }

  private async lerUm(chave: string): Promise<RegistroDeMemoria | undefined> {
    const banco = await this.abrir();
    if (banco) {
      try {
        const lido = await new Promise<RegistroDeMemoria | undefined>((resolve, reject) => {
          const r = banco
            .transaction(NOME_DA_LOJA, "readonly")
            .objectStore(NOME_DA_LOJA)
            .get(chave);
          r.onsuccess = () => resolve(r.result as RegistroDeMemoria | undefined);
          r.onerror = () => reject(r.error);
        });
        if (lido) return lido;
      } catch {
        // cai na cópia
      }
    }
    return this.copia.get(chave);
  }

  async gravar(chave: string, registro: RegistroDeMemoria): Promise<void> {
    this.copia.set(chave, registro);
    const banco = await this.abrir();
    if (!banco) return;
    try {
      await new Promise<void>((resolve, reject) => {
        const t = banco.transaction(NOME_DA_LOJA, "readwrite");
        t.objectStore(NOME_DA_LOJA).put(registro, chave);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    } catch {
      // a cópia em memória continua valendo
    }
  }
}

/**
 * Chave da memória: a mesa, quem e qual cena. Os ids de usuário (`mestre`, `jogador-1`) e de cena se repetem
 * entre mesas; sem o id da mesa, a área explorada de uma vazaria para outra (C2).
 */
export const chaveDaMemoria = (mesaId: string, usuarioId: string, cenaId: string) =>
  `${mesaId}|${usuarioId}|${cenaId}`;

/** A chave de antes do C2 (sem a mesa): só a mesa legada a herda, uma vez, ao abrir a cena. */
export const chaveAntigaDaMemoria = (usuarioId: string, cenaId: string) => `${usuarioId}|${cenaId}`;

/** O registro lido ainda serve para esta cena (mesmo tamanho de grade)? */
export function registroServe(
  r: RegistroDeMemoria,
  larguraM: number,
  alturaM: number,
  celulaM: number,
): boolean {
  const grade: GradeDeMemoria = { ...r };
  return gradeServe(grade, larguraM, alturaM, celulaM);
}
