import { existsSync, renameSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// CH4: a câmera falsa embutida do Chromium (a que sai de --use-fake-device-for-media-stream sozinho) some do navegador
// em cerca de metade das aberturas neste computador: a faixa de vídeo termina uns 250 ms depois de nascer e a câmera
// deixa de existir na lista ("Requested device not found" dali em diante), com o app fora da jogada (provado com uma
// página em branco e só getUserMedia). Com um arquivo de vídeo como fonte da câmera falsa isso não acontece. O arquivo
// é gerado aqui (um Y4M pequeno, quadros que mudam) e não entra no repositório.

const LARGURA = 320;
const ALTURA = 180;
const QUADROS = 20;

function caminhoDoVideoFalso(): string {
  const destino = join(tmpdir(), `tavola-e2e-camera-${LARGURA}x${ALTURA}.y4m`);
  const cabecalho = Buffer.from(`YUV4MPEG2 W${LARGURA} H${ALTURA} F10:1 Ip A1:1 C420jpeg\n`);
  const tamanho = cabecalho.length + QUADROS * (6 + (LARGURA * ALTURA * 3) / 2);
  if (existsSync(destino) && statSync(destino).size === tamanho) return destino;
  const partes: Buffer[] = [cabecalho];
  for (let q = 0; q < QUADROS; q++) {
    partes.push(Buffer.from("FRAME\n"));
    const luz = Buffer.alloc(LARGURA * ALTURA);
    for (let p = 0; p < luz.length; p++) luz[p] = ((p % LARGURA) + q * 8) % 256;
    partes.push(
      luz,
      Buffer.alloc((LARGURA * ALTURA) / 4, 128),
      Buffer.alloc((LARGURA * ALTURA) / 4, 128),
    );
  }
  // grava num nome só deste processo e renomeia: dois workers nunca leem um arquivo pela metade
  const provisorio = `${destino}.${process.pid}`;
  writeFileSync(provisorio, Buffer.concat(partes));
  renameSync(provisorio, destino);
  return destino;
}

/** Os argumentos do Chromium para câmera e microfone falsos, sem pedir permissão. */
export function argsDeMidiaFalsa(): string[] {
  return [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${caminhoDoVideoFalso()}`,
  ];
}
