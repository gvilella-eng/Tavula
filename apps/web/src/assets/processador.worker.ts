import {
  base64ParaBytes,
  converterUvtt,
  detectarFormato,
  dividirEmPedacos,
  hashesDosPedacos,
  LIMITES_DA_IMPORTACAO,
  LIMITES_DE_ASSET,
  ladoDoTile,
  lerUniversalVtt,
  type MetaNova,
  montarManifestoDeMapa,
  precisaFatiar,
  retangulosDeTiles,
  sha256Hex,
} from "@tabletop/shared";
import type { PedidoDoWorker, RespostaDoWorker, Resultado, UvttLido } from "./processador";

// Processamento pesado fora da thread da página: decodifica a imagem, redimensiona, converte para
// WebP (OffscreenCanvas), fatia o mapa grande em tiles e calcula os hashes.

const QUALIDADE_WEBP = 0.92;

async function codificar(
  imagem: ImageBitmap,
  origem: { x: number; y: number; largura: number; altura: number },
  destino: { largura: number; altura: number },
): Promise<Uint8Array> {
  const tela = new OffscreenCanvas(destino.largura, destino.altura);
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("Sem canvas 2D no worker");
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(
    imagem,
    origem.x,
    origem.y,
    origem.largura,
    origem.altura,
    0,
    0,
    destino.largura,
    destino.altura,
  );
  const blob = await tela.convertToBlob({ type: "image/webp", quality: QUALIDADE_WEBP });
  if (blob.type !== "image/webp") throw new Error("Este navegador não converte para WebP");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > LIMITES_DE_ASSET.bytesPorArquivo) {
    throw new Error("Arquivo grande demais depois de processado (limite de 30 MB)");
  }
  return bytes;
}

async function descrever(
  tipo: MetaNova["tipo"],
  bytes: Uint8Array,
  largura: number,
  altura: number,
  nomeOriginal: string,
): Promise<MetaNova> {
  return {
    hash: await sha256Hex(bytes),
    tipo,
    mime: "image/webp",
    bytes: bytes.length,
    largura,
    altura,
    nomeOriginal,
    pedacos: await hashesDosPedacos(dividirEmPedacos(bytes)),
  };
}

async function processar(
  arquivo: Blob,
  tipo: "mapa" | "token" | "retrato",
  limite: number,
  nome: string,
): Promise<Resultado> {
  const imagem = await createImageBitmap(arquivo);
  try {
    const { width, height } = imagem;
    if (tipo !== "mapa") {
      const lado = LIMITES_DE_ASSET.ladoMaximoDoToken;
      const escala = Math.min(1, lado / Math.max(width, height));
      const l = Math.max(1, Math.round(width * escala));
      const a = Math.max(1, Math.round(height * escala));
      const bytes = await codificar(
        imagem,
        { x: 0, y: 0, largura: width, altura: height },
        { largura: l, altura: a },
      );
      const meta = await descrever(tipo, bytes, l, a, nome);
      return { principal: meta.hash, itens: [{ meta, bytes }] };
    }
    if (!precisaFatiar(width, height, limite)) {
      const bytes = await codificar(
        imagem,
        { x: 0, y: 0, largura: width, altura: height },
        { largura: width, altura: height },
      );
      const meta = await descrever("mapa", bytes, width, height, nome);
      return { principal: meta.hash, itens: [{ meta, bytes }] };
    }
    const retangulos = retangulosDeTiles(width, height, ladoDoTile(limite));
    if (retangulos.length > LIMITES_DE_ASSET.tilesPorMapa) {
      throw new Error(
        `Mapa grande demais: ${retangulos.length} tiles (limite ${LIMITES_DE_ASSET.tilesPorMapa})`,
      );
    }
    const itens: Resultado["itens"] = [];
    let total = 0;
    for (const [i, r] of retangulos.entries()) {
      const bytes = await codificar(imagem, r, { largura: r.largura, altura: r.altura });
      total += bytes.length;
      if (total > LIMITES_DE_ASSET.bytesPorMapa)
        throw new Error("Mapa grande demais (limite de 200 MB)");
      const meta = await descrever(
        "tile",
        bytes,
        r.largura,
        r.altura,
        `${nome} [${i + 1}/${retangulos.length}]`,
      );
      itens.push({ meta, bytes });
    }
    const manifesto = await montarManifestoDeMapa({
      largura: width,
      altura: height,
      nomeOriginal: nome,
      mime: "image/webp",
      tiles: itens.map(({ meta }, i) => ({
        ...(retangulos[i] as (typeof retangulos)[number]),
        hash: meta.hash,
      })),
    });
    return { principal: manifesto.hash, itens, manifesto };
  } finally {
    imagem.close();
  }
}

async function miniatura(arquivo: Blob, lado: number): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
    const l = Math.max(1, Math.round(imagem.width * escala));
    const a = Math.max(1, Math.round(imagem.height * escala));
    const tela = new OffscreenCanvas(l, a);
    tela.getContext("2d")?.drawImage(imagem, 0, 0, l, a);
    return await tela.convertToBlob({ type: "image/webp", quality: 0.7 });
  } finally {
    imagem.close();
  }
}

/** Q3: lê o Universal VTT (JSON com a imagem em base64), decodifica a imagem e converte o resto para a cena da Távola. */
async function lerUvtt(p: Extract<PedidoDoWorker, { tipo: "uvtt" }>): Promise<UvttLido> {
  const inicio = performance.now();
  if (p.arquivo.size > LIMITES_DA_IMPORTACAO.bytesDoArquivo) {
    throw new Error(
      `Arquivo grande demais: o limite é ${LIMITES_DA_IMPORTACAO.bytesDoArquivo / 1024 / 1024} MB.`,
    );
  }
  const lido = lerUniversalVtt(await p.arquivo.text());
  if (!lido.ok) throw new Error(lido.motivo);
  const { imagemBase64, ...dados } = lido.dados;
  if (!imagemBase64) throw new Error("O arquivo não traz a imagem do mapa.");
  const bytes = base64ParaBytes(imagemBase64);
  if (!bytes) throw new Error("A imagem do arquivo não está em base64 válido.");
  const formato = detectarFormato(bytes);
  if (formato?.familia !== "imagem") {
    throw new Error("A imagem do arquivo não é png, jpg, webp nem gif.");
  }
  const { importacao } = converterUvtt(
    { ...dados, imagemBase64: null },
    { id: p.idDaCena, nome: p.nome },
  );
  return {
    imagem: new Blob([bytes as BufferSource], { type: formato.mime }),
    extensao: formato.extensao,
    importacao,
    ms: Math.round(performance.now() - inicio),
  };
}

// O projeto compila com a lib DOM; aqui só o que o worker usa do escopo global dele.
const escopo = self as unknown as {
  onmessage: ((e: MessageEvent<PedidoDoWorker>) => void) | null;
  postMessage(mensagem: unknown, transferiveis?: Transferable[]): void;
};

escopo.onmessage = async (e: MessageEvent<PedidoDoWorker>) => {
  const p = e.data;
  try {
    let resposta: RespostaDoWorker;
    if (p.tipo === "hash") {
      const hash = await sha256Hex(new Uint8Array(await p.arquivo.arrayBuffer()));
      resposta = { id: p.id, ok: true, tipo: "hash", hash };
    } else if (p.tipo === "uvtt") {
      resposta = { id: p.id, ok: true, tipo: "uvtt", lido: await lerUvtt(p) };
    } else if (p.tipo === "miniatura") {
      resposta = {
        id: p.id,
        ok: true,
        tipo: "miniatura",
        imagem: await miniatura(p.arquivo, p.lado),
      };
    } else {
      const resultado = await processar(p.arquivo, p.tipoAsset, p.limite, p.nome);
      const transferiveis = resultado.itens.map((i) => i.bytes.buffer as ArrayBuffer);
      escopo.postMessage(
        { id: p.id, ok: true, tipo: "processar", resultado } satisfies RespostaDoWorker,
        transferiveis,
      );
      return;
    }
    escopo.postMessage(resposta);
  } catch (erro) {
    escopo.postMessage({
      id: p.id,
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
    } satisfies RespostaDoWorker);
  }
};
