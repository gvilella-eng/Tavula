import { useEffect, useState } from "react";
import type { ImagensDoMapa } from "./mapa/mapaPixi";

const cacheDeUrls = new Map<string, string>();

/**
 * URL (blob) da imagem de um asset que já está no cache local, ou `null` enquanto não chega.
 * `versao` muda quando algo novo fica pronto (o hook refaz a tentativa).
 */
export function useImagem(
  imagens: ImagensDoMapa | null,
  hash: string | undefined,
  versao: number,
): string | null {
  const [url, setUrl] = useState<string | null>(hash ? (cacheDeUrls.get(hash) ?? null) : null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a versão avisa que o cache mudou
  useEffect(() => {
    if (!hash || !imagens) {
      setUrl(null);
      return;
    }
    const pronta = cacheDeUrls.get(hash);
    if (pronta) {
      setUrl(pronta);
      return;
    }
    if (!imagens.pronto(hash)) {
      setUrl(null);
      return;
    }
    let cancelado = false;
    imagens
      .blob(hash)
      .then((b) => {
        if (!b || cancelado) return;
        const nova = URL.createObjectURL(b);
        cacheDeUrls.set(hash, nova);
        setUrl(nova);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [imagens, hash, versao]);
  return url;
}
