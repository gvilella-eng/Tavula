import { expect, type Page } from "@playwright/test";

// N5: ajudas dos testes de som. O áudio é gerado aqui (um wav de silêncio de 8 kHz, mono, 8 bits): nada é baixado, e o gancho
// `window.__tabletopSom` diz o que a mesa "está tocando" sem depender do som real.

/** Um wav de silêncio. A duração muda os bytes (e o hash), então cada duração é um som diferente. */
export function wavDeSilencio(segundos: number, taxa = 8000): Buffer {
  const dados = Buffer.alloc(Math.round(taxa * segundos), 0x80);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write("WAVE", 8);
  cab.write("fmt ", 12);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20); // PCM
  cab.writeUInt16LE(1, 22); // mono
  cab.writeUInt32LE(taxa, 24);
  cab.writeUInt32LE(taxa, 28);
  cab.writeUInt16LE(1, 32);
  cab.writeUInt16LE(8, 34);
  cab.write("data", 36);
  cab.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cab, dados]);
}

export const arquivoWav = (nome: string, segundos: number) => ({
  name: nome,
  mimeType: "audio/wav",
  buffer: wavDeSilencio(segundos),
});

export type EstadoDoSom = {
  trilha: { hash: string; volume: number; tocando: boolean } | null;
  zonas: { hash: string; volume: number }[];
  efeitos: { hash: string; volume: number }[];
  bloqueado: boolean;
};

export const somDe = (p: Page): Promise<EstadoDoSom> =>
  p.evaluate(() =>
    (window as unknown as { __tabletopSom: { estado(): EstadoDoSom } }).__tabletopSom.estado(),
  );

/**
 * Manda uma intenção cuja resposta é um snapshot novo para todos (`grupo.moverPara`): o `enviarCru` só espera `evento` e
 * `erro`. Aqui a resposta é o segundo snapshot (o primeiro é o da própria conexão) ou um erro; devolve o tipo recebido.
 */
export function enviarEEsperarSnapshot(p: Page, texto: string): Promise<string | null> {
  return p.evaluate(
    (t) =>
      new Promise<string | null>((resolve) => {
        const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
        let snapshots = 0;
        const fim = setTimeout(() => {
          ws.close();
          resolve(null);
        }, 4000);
        ws.onopen = () => ws.send(t);
        ws.onmessage = (e) => {
          const m = JSON.parse(e.data as string);
          if (m.tipo === "snapshot") snapshots++;
          if (m.tipo === "erro" || snapshots >= 2) {
            clearTimeout(fim);
            ws.close();
            resolve(m.tipo);
          }
        };
      }),
    texto,
  );
}

/** Espera o som com este nome de arquivo aparecer no navegador do mestre (a meta chega logo depois do envio) e devolve o hash. */
export async function esperarHashDoSom(p: Page, nomeDoArquivo: string): Promise<string> {
  let achado = "";
  await expect
    .poll(async () => {
      achado = (await hashDoSom(p, nomeDoArquivo)) ?? "";
      return achado;
    })
    .toMatch(/^[0-9a-f]{64}$/);
  return achado;
}

/** O hash do som com este nome de arquivo, como o navegador o conhece. */
export const hashDoSom = (p: Page, nomeDoArquivo: string): Promise<string | undefined> =>
  p.evaluate(
    (n) =>
      (
        window as unknown as {
          __tabletopAssets: { metas(): { tipo: string; nomeOriginal: string; hash: string }[] };
        }
      ).__tabletopAssets
        .metas()
        .find((m) => m.tipo === "som" && m.nomeOriginal === n)?.hash,
    nomeDoArquivo,
  );
