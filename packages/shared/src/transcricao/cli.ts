import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatarDuracao } from "../gravacao.ts";
import { lerConfiguracao, type Passo, transcrever } from "./transcrever.ts";

// CH3: `pnpm transcrever "<pasta da gravação>"`. Ver `docs/WHISPER.md`.

const RAIZ_DO_REPOSITORIO = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

async function lerArquivoDeConfiguracao(): Promise<unknown> {
  for (const base of [process.cwd(), RAIZ_DO_REPOSITORIO]) {
    try {
      return JSON.parse(await readFile(resolve(base, "transcrever.config.json"), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error(`transcrever.config.json não é um JSON válido: ${(e as Error).message}`);
    }
  }
  return null;
}

export function textoDoPasso(p: Passo): string {
  const falta =
    p.faltaMs === null ? "calculando o tempo…" : `faltam cerca de ${formatarDuracao(p.faltaMs)}`;
  return `${p.pessoa} (${p.indiceDaPessoa}/${p.totalDePessoas}) · trecho ${p.trecho} de ${p.totalDeTrechos} · ${p.percentual}% · ${falta}`;
}

export async function principal(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const pasta = argv.find((a) => !a.startsWith("-"));
  if (!pasta) {
    console.error('Uso: pnpm transcrever "<pasta da gravação>"');
    console.error(
      "A pasta é a de dentro de gravacoes/ na pasta da mesa (a que tem o gravacao.json).",
    );
    return 2;
  }
  let arquivo: unknown;
  try {
    arquivo = await lerArquivoDeConfiguracao();
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  const c = lerConfiguracao(env, arquivo);
  if (!c.ok) {
    console.error(c.motivo);
    return 2;
  }
  const tty = process.stdout.isTTY === true;
  let ultimaLinha = "";
  let ultimoPercentual = -10;
  const escrever = (linha: string) => {
    if (tty && ultimaLinha !== "") process.stdout.write("\n");
    ultimaLinha = "";
    console.log(linha);
  };
  try {
    const r = await transcrever({
      pasta,
      config: c.config,
      escrever,
      aoPasso: (p) => {
        const texto = textoDoPasso(p);
        if (tty) {
          process.stdout.write(`\r${texto.padEnd(Math.max(ultimaLinha.length, texto.length))}`);
          ultimaLinha = texto;
        } else if (p.percentual - ultimoPercentual >= 10 || p.percentual === 100) {
          ultimoPercentual = p.percentual;
          console.log(texto);
        }
      },
    });
    if (tty && ultimaLinha !== "") process.stdout.write("\n");
    console.log(
      `Pronto: ${r.falas} ${r.falas === 1 ? "fala" : "falas"} em transcricao.md e transcricao.json.`,
    );
    if (r.semFala.length > 0) console.log(`Sem fala gravada: ${r.semFala.join(", ")}.`);
    if (r.falhas.length > 0) {
      console.error("");
      console.error("O whisper falhou em:");
      for (const f of r.falhas) console.error(`  - ${f.pessoa}: ${f.motivo}`);
      console.error(
        "As outras vozes saíram no texto. Rode de novo depois de corrigir (o resultado é refeito).",
      );
      return 1;
    }
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await principal(process.argv.slice(2), process.env);
}
