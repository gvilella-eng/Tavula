// Um whisper falso para os testes do `pnpm transcrever` (nunca baixa nem roda o whisper.cpp de verdade). Imita o que o
// `whisper-cli` faz com os argumentos que o script manda (`-m modelo -f arquivo.wav -l pt -oj -of base -pp [--prompt ...]`):
// escreve `<base>.json` no formato do whisper.cpp, com um segmento para cada trecho de fala do WAV (os trechos que o script
// juntou ficam separados por 1 s de silêncio), e "progress = N%" no stderr. O texto é "<nome do arquivo> fala N".
// `WHISPER_FALSO_FALHAR=<texto>`: sai com erro se o caminho do WAV tem esse texto (um whisper que falha numa pessoa).
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const valor = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const entrada = valor("-f");
const base = valor("-of");
if (!entrada || !base) {
  console.error("whisper-falso: faltou -f ou -of");
  process.exit(2);
}
const falhar = process.env.WHISPER_FALSO_FALHAR;
if (falhar && entrada.includes(falhar)) {
  console.error("whisper-falso: falha de propósito");
  process.exit(3);
}

const bytes = readFileSync(entrada);
const dados = bytes.subarray(44);
const taxa = bytes.readUInt32LE(24);
const amostras = new Int16Array(dados.buffer, dados.byteOffset, Math.floor(dados.length / 2));
const porMs = taxa / 1000;
const total = Math.round(amostras.length / porMs);

// Regiões com som: separadas por pelo menos 800 ms de silêncio absoluto (a emenda tem 1 s).
const regioes = [];
let inicio = -1;
let zeros = 0;
for (let i = 0; i < amostras.length; i++) {
  if (amostras[i] === 0) {
    zeros++;
    if (inicio >= 0 && zeros >= 0.8 * taxa) {
      regioes.push([inicio, i - zeros + 1]);
      inicio = -1;
    }
  } else {
    if (inicio < 0) inicio = i;
    zeros = 0;
  }
}
if (inicio >= 0) regioes.push([inicio, amostras.length]);

const nome = entrada.split(/[\\/]/).pop();
const transcription = regioes.map(([a, b], n) => {
  const de = Math.round(a / porMs);
  const ate = Math.round(b / porMs);
  return {
    timestamps: { from: marca(de), to: marca(ate) },
    offsets: { from: de, to: ate },
    text: ` ${nome} fala ${n + 1}`,
  };
});
// um ruído, que o script tem de descartar
transcription.push({
  timestamps: { from: marca(total), to: marca(total) },
  offsets: { from: total, to: total },
  text: " [BLANK_AUDIO]",
});
function marca(ms) {
  const dois = (n, t = 2) => String(n).padStart(t, "0");
  return `${dois(Math.floor(ms / 3600000))}:${dois(Math.floor((ms % 3600000) / 60000))}:${dois(Math.floor((ms % 60000) / 1000))},${dois(ms % 1000, 3)}`;
}

console.error("progress =  50%");
writeFileSync(`${base}.json`, JSON.stringify({ result: { language: valor("-l") ?? "pt" }, transcription }, null, 2));
console.error("progress = 100%");
