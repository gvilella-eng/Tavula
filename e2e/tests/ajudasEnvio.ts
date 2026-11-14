import { request as httpRequest } from "node:http";
import { deflateSync } from "node:zlib";

// M1: ajudas dos testes do envio de arquivos pelo Claude. Tudo é gerado no teste (nada de arquivo no repositório, nada baixado).

export type RespostaDoEnvio = {
  status: number;
  corpo: string;
  json: { ok?: boolean; estado?: string; mensagem?: string; erro?: string; envio?: string } | null;
};

/** O link de envio que a ferramenta `arquivos` escreveu no texto (entre aspas, no comando do curl). */
export function linkDoTexto(texto: string): string {
  const m = /"(https?:\/\/[^"\s]+\/claude\/envio\/tve_[A-Za-z0-9_-]+)"/.exec(texto);
  if (!m?.[1]) throw new Error(`a resposta não trouxe o link de envio:\n${texto}`);
  return m[1];
}

/** O id do envio (`env-...`) que a ferramenta escreveu. */
export function idDoEnvio(texto: string): string {
  const m = /(env-[0-9a-f]+)/.exec(texto);
  if (!m?.[1]) throw new Error(`a resposta não trouxe o id do envio:\n${texto}`);
  return m[1];
}

/**
 * O PUT do `curl -T`, com controle do que vai no cabeçalho. `semTamanho`: manda em pedaços (`chunked`), sem Content-Length.
 */
export function enviarPor(
  link: string,
  corpo: Buffer,
  opcoes: { origem?: string; semTamanho?: boolean } = {},
): Promise<RespostaDoEnvio> {
  return new Promise((resolve, reject) => {
    const cabecalhos: Record<string, string | number> = {};
    if (opcoes.origem) cabecalhos.Origin = opcoes.origem;
    if (opcoes.semTamanho) cabecalhos["Transfer-Encoding"] = "chunked";
    else cabecalhos["Content-Length"] = corpo.length;
    const req = httpRequest(new URL(link), { method: "PUT", headers: cabecalhos }, (res) => {
      let texto = "";
      res.setEncoding("utf8");
      res.on("data", (d: string) => {
        texto += d;
      });
      res.on("end", () => {
        let json: RespostaDoEnvio["json"] = null;
        try {
          json = JSON.parse(texto) as RespostaDoEnvio["json"];
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode ?? 0, corpo: texto, json });
      });
    });
    // A sala recusa o corpo grande sem ler; se ela fechar a conexão enquanto o corpo ainda sobe, o erro vem DEPOIS da resposta.
    let respondeu = false;
    req.on("response", () => {
      respondeu = true;
    });
    req.on("error", (e) => {
      if (!respondeu) reject(new Error(`PUT ${JSON.stringify(opcoes)}: ${e.message}`));
    });
    req.end(corpo);
  });
}

/** Um som WAV de silêncio (mono, 8 kHz, 8 bits): uns 500 bytes, o bastante para a mesa aceitar como som. */
export function wavMudo(amostras = 400): Buffer {
  const dados = Buffer.alloc(amostras, 128);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0, "ascii");
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write("WAVEfmt ", 8, "ascii");
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(8000, 24);
  cab.writeUInt32LE(8000, 28);
  cab.writeUInt16LE(1, 32);
  cab.writeUInt16LE(8, 34);
  cab.write("data", 36, "ascii");
  cab.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cab, dados]);
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const b of dados) c = (TABELA_CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const saida = Buffer.alloc(12 + dados.length);
  saida.writeUInt32BE(dados.length, 0);
  saida.write(tipo, 4, "ascii");
  dados.copy(saida, 8);
  saida.writeUInt32BE(crc32(saida.subarray(4, 8 + dados.length)), 8 + dados.length);
  return saida;
}

/**
 * Um PNG grande que comprime bem (um tabuleiro de quadrados de `lado` px com duas cores): 3150 x 3150 sai com poucos KB, mas o
 * navegador tem de decodificar os 9,9 milhões de pixels e cortar em tiles, como num mapa de verdade.
 */
export function pngGrande(largura: number, altura: number, lado = 70): Buffer {
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura * 3 + 1);
    linhas[base] = 0;
    for (let x = 0; x < largura; x++) {
      const claro = (Math.floor(x / lado) + Math.floor(y / lado)) % 2 === 0;
      const i = base + 1 + x * 3;
      linhas[i] = claro ? 190 : 70;
      linhas[i + 1] = claro ? 170 : 60;
      linhas[i + 2] = claro ? 130 : 50;
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho[8] = 8;
  cabecalho[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", cabecalho),
    bloco("IDAT", deflateSync(linhas, { level: 6 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}
