import { bytesParaHex, sha256Hex } from "@tabletop/shared";
import type { EstadoDaPasta, Fontes } from "./fontes";
import type { GanchosE2E, GerenteDeAssets } from "./gerente";

/**
 * Gancho de teste dos assets (`window.__tabletopAssets`), só no modo `e2e`. Também lê
 * `window.__tabletopE2E` (definido pelo teste) para deixar o envio lento, corromper um pedaço ou
 * reduzir o limite do tile.
 */
export function ganchosDoTeste(): GanchosE2E | undefined {
  if (import.meta.env.MODE !== "e2e") return undefined;
  return (window as unknown as { __tabletopE2E?: GanchosE2E }).__tabletopE2E;
}

export function instalarGanchoDeAssets(gerente: GerenteDeAssets, fontes: Fontes): () => void {
  if (import.meta.env.MODE !== "e2e") return () => {};
  const w = window as unknown as { __tabletopAssets?: unknown };
  w.__tabletopAssets = {
    /** Hashes dos arquivos completos no cache. */
    inventario: () => gerente.inventario(),
    metas: () => gerente.metasConhecidas(),
    pronto: (hash: string) => gerente.estaPronto(hash),
    status: () => gerente.listarStatus(),
    /** Relê cada arquivo do OPFS e recalcula o SHA-256: o hash tem de bater com o nome. */
    verificarCache: async () => {
      const saida: { hash: string; ok: boolean; bytes: number }[] = [];
      for (const hash of gerente.inventario()) {
        const arquivo = await gerente.blobDe(hash);
        if (!arquivo) continue;
        const dados = new Uint8Array(await arquivo.arrayBuffer());
        saida.push({ hash, ok: (await sha256Hex(dados)) === hash, bytes: dados.length });
      }
      return saida;
    },
    /** Conteúdo (hex) dos primeiros `n` bytes do arquivo: o teste procura isso nos frames alheios. */
    inicioDe: async (hash: string, n = 64) => {
      const arquivo = await gerente.blobDe(hash);
      return arquivo ? bytesParaHex(new Uint8Array(await arquivo.slice(0, n).arrayBuffer())) : null;
    },
    /** Põe um arquivo de texto na "pasta" do mestre (a `Memoria`): é assim que os testes criam o `compendio/magias.json`. */
    adicionarNaPasta: (caminho: string, texto: string) => {
      fontes.memoria?.adicionarTexto(caminho, texto);
      fontes.notificar();
    },
    /** Faz a "pasta" dos testes (a `Memoria`) valer como a pasta local com escrita (compêndio: "Usar o exemplo"). */
    usarMemoriaComoPasta: (valor: boolean) => fontes.definirMemoriaComoPasta(valor),
    /** Q1: o estado da "pasta" dos testes: `nenhuma`, `reautorizar` ou `autorizada` (`null` desliga a simulação). */
    simularPasta: (estado: EstadoDaPasta | null) => fontes.simularPasta(estado),
    /** Q1: tudo o que a "pasta" guarda (arquivos gravados), em base64, para levar a OUTRO navegador (a mesma pasta do computador). */
    exportarPasta: () =>
      (fontes.memoria?.gravados() ?? []).map((g) => ({
        caminho: g.caminho,
        base64: btoa(Array.from(g.bytes, (b) => String.fromCharCode(b)).join("")),
      })),
    /** Q1: o outro lado: põe na "pasta" deste navegador o que `exportarPasta` devolveu. */
    importarPasta: (lista: { caminho: string; base64: string }[]) => {
      for (const l of lista) {
        fontes.memoria?.importarBytes(
          l.caminho,
          Uint8Array.from(atob(l.base64), (c) => c.charCodeAt(0)),
        );
      }
      fontes.notificar();
    },
    /** O que foi "gravado na pasta" (a `Memoria` do modo e2e): caminho, tamanho e SHA-256. */
    gravados: async () => {
      const lista = fontes.memoria?.gravados() ?? [];
      return Promise.all(
        lista.map(async (g) => ({
          caminho: g.caminho,
          bytes: g.bytes.length,
          sha256: await sha256Hex(g.bytes),
        })),
      );
    },
  };
  return () => {
    w.__tabletopAssets = undefined;
  };
}
