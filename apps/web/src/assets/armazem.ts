/** Chave-valor mínimo sobre o IndexedDB (a pasta escolhida e o índice arquivo original → hash). */

const BANCO = "tabletop-assets";
const REPOSITORIOS = ["pasta", "indice"] as const;
type Repositorio = (typeof REPOSITORIOS)[number];

let aberto: Promise<IDBDatabase> | null = null;

function abrirBanco(): Promise<IDBDatabase> {
  aberto ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      for (const nome of REPOSITORIOS) req.result.createObjectStore(nome);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return aberto;
}

function pedir<T>(
  repo: Repositorio,
  modo: IDBTransactionMode,
  fazer: (s: IDBObjectStore) => IDBRequest<T>,
) {
  return abrirBanco().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fazer(db.transaction(repo, modo).objectStore(repo));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function lerChave<T>(repo: Repositorio, chave: string): Promise<T | undefined> {
  try {
    return (await pedir<T | undefined>(repo, "readonly", (s) => s.get(chave))) ?? undefined;
  } catch {
    return undefined; // IndexedDB indisponível (modo privado etc.): tudo funciona, só sem memória
  }
}

export async function gravarChave(repo: Repositorio, chave: string, valor: unknown): Promise<void> {
  try {
    await pedir(repo, "readwrite", (s) => s.put(valor, chave));
  } catch {
    // sem IndexedDB: segue sem lembrar
  }
}

/** O que o índice local guarda de um arquivo original já processado. */
export type EntradaDoIndice = { assetHash: string; nome: string };

/** Índice local: SHA-256 do arquivo original (+ tipo e limite) → hash do processado. */
export const indiceLocal = {
  chave: (hashOriginal: string, tipo: string, limite: number) =>
    `${hashOriginal}|${tipo}|${limite}`,
  ler: (chave: string) => lerChave<EntradaDoIndice>("indice", chave),
  gravar: (chave: string, e: EntradaDoIndice) => gravarChave("indice", chave, e),
};
