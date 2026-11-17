import { lerCompendio } from "@tabletop/shared";

/** O que `lerCompendio` devolve (válido ou com o motivo de não ser). */
export type LeituraDoCompendio = ReturnType<typeof lerCompendio>;

/** Quantos arquivos lidos ficam guardados (o mestre troca de compêndio: só os mais recentes importam). */
export const LIMITE_DE_LEITURAS = 3;

export type CacheDeLeituras = Map<string, Promise<LeituraDoCompendio | null>>;

const lidosPorHash: CacheDeLeituras = new Map();

/**
 * Lê (JSON.parse + validação) o arquivo do compêndio UMA vez por hash, para todas as instâncias de `useCompendio` (a aba
 * e cada ficha aberta). O arquivo é endereçado pelo hash do conteúdo, então o resultado é imutável: a segunda chamada
 * não pede o texto nem valida de novo e recebe o MESMO objeto (os índices por referência são compartilhados). O resultado
 * inválido também fica (é determinístico para aquele hash). Texto `null` (arquivo ainda indisponível) não fica guardado,
 * para tentar de novo depois. A promessa entra no cache antes de resolver: chamadas simultâneas dividem a mesma leitura.
 */
export function lerUmaVez(
  hash: string,
  obterTexto: () => Promise<string | null>,
  cache: CacheDeLeituras = lidosPorHash,
  limite: number = LIMITE_DE_LEITURAS,
): Promise<LeituraDoCompendio | null> {
  const guardada = cache.get(hash);
  if (guardada) {
    // Usado agora: vai para o fim da fila de saída (ficam os mais recentes).
    cache.delete(hash);
    cache.set(hash, guardada);
    return guardada;
  }
  const leitura: Promise<LeituraDoCompendio | null> = obterTexto().then(
    (texto) => {
      if (texto === null) {
        if (cache.get(hash) === leitura) cache.delete(hash);
        return null;
      }
      return lerCompendio(texto);
    },
    (erro: unknown) => {
      if (cache.get(hash) === leitura) cache.delete(hash);
      throw erro;
    },
  );
  cache.set(hash, leitura);
  while (cache.size > limite) {
    const maisAntigo = cache.keys().next();
    if (maisAntigo.done) break;
    cache.delete(maisAntigo.value);
  }
  return leitura;
}
