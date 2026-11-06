import type { ImagensDoMapa } from "./mapa/mapaPixi";

const LARGURA_DA_PREVIA = 256;
const previas = new Map<string, string>();
const emAndamento = new Map<string, Promise<string | null>>();

/**
 * Prévia do mapa em baixa resolução, gerada aqui no navegador (do cache de arquivos) e juntando os
 * tiles quando o mapa é fatiado. Devolve uma URL (blob) ou `null` se o mapa ainda não está inteiro
 * no cache. O mesmo mapa gera a prévia uma vez só.
 */
export function previaDoMapa(imagens: ImagensDoMapa, hash: string): Promise<string | null> {
  const pronta = previas.get(hash);
  if (pronta) return Promise.resolve(pronta);
  if (!imagens.pronto(hash)) return Promise.resolve(null);
  const feita = emAndamento.get(hash);
  if (feita) return feita;
  const tarefa = gerar(imagens, hash)
    .then((url) => {
      if (url) previas.set(hash, url);
      return url;
    })
    .catch(() => null)
    .finally(() => emAndamento.delete(hash));
  emAndamento.set(hash, tarefa);
  return tarefa;
}

async function gerar(imagens: ImagensDoMapa, hash: string): Promise<string | null> {
  const meta = imagens.meta(hash);
  if (!meta || meta.largura <= 0 || meta.altura <= 0) return null;
  const tiles = meta.tiles ?? [
    { hash: meta.hash, x: 0, y: 0, largura: meta.largura, altura: meta.altura },
  ];
  const escala = LARGURA_DA_PREVIA / meta.largura;
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA_DA_PREVIA;
  canvas.height = Math.max(1, Math.round(meta.altura * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "medium";
  for (const t of tiles) {
    const blob = await imagens.blob(t.hash);
    if (!blob) return null;
    const imagem = await createImageBitmap(blob);
    ctx.drawImage(
      imagem,
      Math.floor(t.x * escala),
      Math.floor(t.y * escala),
      Math.ceil(t.largura * escala),
      Math.ceil(t.altura * escala),
    );
    imagem.close();
  }
  const saida = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.7));
  return saida ? URL.createObjectURL(saida) : null;
}
