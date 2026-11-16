/// <reference types="node" />
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lerCompendio } from "../compendio.ts";
import {
  arquivoDoCompendio,
  extrairItensDoLivro,
  extrairMagiasDoLivro,
  extrairMonstrosDoLivro,
  type ResultadoDoLivro,
} from "./livros.ts";
import { aplicarNomesOriginais, lerTabelaDeNomes, type TabelaDeNomes } from "./nomes.ts";
import { lerPdf, letrasDoLivro } from "./pdf.ts";
import { type LivroDoRelatorio, montarRelatorio } from "./relatorio.ts";

// ---------------------------------------------------------------------------------------------
// pnpm compendio:extrair -- --livros "<pasta>" --saida "<pasta>"
//
// Lê o Livro do Jogador (magias), o Manual dos Monstros (monstros) e o Guia do Mestre (itens mágicos), em PDF com
// texto, e escreve magias.json, monstros.json, itens.json e relatorio.md na pasta de saída. A saída NUNCA pode ficar
// dentro do repositório: o texto dos livros não entra nele. Roda 100% local (sem rede, sem OCR).
// ---------------------------------------------------------------------------------------------

const LIVROS = [
  {
    chave: "magias" as const,
    titulo: "Livro do Jogador (magias)",
    padrao: /livro-do-jogador/i,
    saida: "magias.json",
  },
  {
    chave: "monstros" as const,
    titulo: "Manual dos Monstros (monstros)",
    padrao: /manual-dos-monstros/i,
    saida: "monstros.json",
  },
  {
    chave: "itens" as const,
    titulo: "Guia do Mestre (itens mágicos)",
    padrao: /guia-do-mestre/i,
    saida: "itens.json",
  },
];

export function lerArgumentos(argv: readonly string[]): {
  livros?: string;
  saida?: string;
  nomes?: string;
} {
  const lidos: { livros?: string; saida?: string; nomes?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const proximo = argv[i + 1];
    if (a === "--livros" && proximo) {
      lidos.livros = proximo;
      i++;
    } else if (a === "--saida" && proximo) {
      lidos.saida = proximo;
      i++;
    } else if (a === "--nomes" && proximo) {
      lidos.nomes = proximo;
      i++;
    }
  }
  return lidos;
}

/** A raiz do repositório (onde mora o pnpm-workspace.yaml), de onde esta ferramenta roda. */
function raizDoRepositorio(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  return dir;
}

export function estaDentro(pasta: string, raiz: string): boolean {
  const rel = relative(resolve(raiz), resolve(pasta));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function principal(): Promise<number> {
  const { livros, saida, nomes } = lerArgumentos(process.argv.slice(2));
  if (!livros || !saida) {
    console.error(
      'Uso: pnpm compendio:extrair -- --livros "<pasta dos PDFs>" --saida "<pasta de saída>" [--nomes "<nomes-originais.json>"]',
    );
    return 2;
  }
  const base = process.env.INIT_CWD ?? process.cwd();
  const pastaDosLivros = resolve(base, livros);
  const pastaDeSaida = resolve(base, saida);
  if (estaDentro(pastaDeSaida, raizDoRepositorio())) {
    console.error(
      "A pasta de saída está dentro do repositório. O conteúdo dos livros não pode entrar nele: escolha outra pasta.",
    );
    return 2;
  }
  if (!existsSync(pastaDosLivros) || !statSync(pastaDosLivros).isDirectory()) {
    console.error(`Pasta dos livros não encontrada: ${pastaDosLivros}`);
    return 2;
  }
  mkdirSync(pastaDeSaida, { recursive: true });
  // Q2: a tabela de nomes em inglês (opcional) fica fora do repositório, na pasta de saída por padrão.
  const arquivoDeNomes = nomes ? resolve(base, nomes) : join(pastaDeSaida, "nomes-originais.json");
  let tabelaDeNomes: TabelaDeNomes | null = null;
  if (existsSync(arquivoDeNomes)) {
    if (estaDentro(arquivoDeNomes, raizDoRepositorio())) {
      console.error("A tabela de nomes está dentro do repositório: escolha outra pasta.");
      return 2;
    }
    const lida = lerTabelaDeNomes(readFileSync(arquivoDeNomes, "utf8"));
    if (!lida.ok) {
      console.error(`Tabela de nomes (${arquivoDeNomes}): ${lida.motivo}.`);
      return 2;
    }
    tabelaDeNomes = lida.tabela;
    console.log(`Nomes em inglês: ${arquivoDeNomes}`);
  } else if (nomes) {
    console.error(`Tabela de nomes não encontrada: ${arquivoDeNomes}`);
    return 2;
  }
  const pdfs = readdirSync(pastaDosLivros).filter((n) => n.toLowerCase().endsWith(".pdf"));

  const relatorio: LivroDoRelatorio[] = [];
  let magiasLidas: ResultadoDoLivro<{ nome: string }>["validas"] = [];
  for (const livro of LIVROS) {
    const arquivo = pdfs.find((n) => livro.padrao.test(n));
    if (!arquivo) {
      console.warn(`${livro.titulo}: PDF não encontrado em ${pastaDosLivros}.`);
      relatorio.push({
        titulo: livro.titulo,
        arquivo: "(não encontrado)",
        saida: null,
        resultado: null,
      });
      continue;
    }
    console.log(`${livro.titulo}: lendo ${arquivo}...`);
    const paginas = await lerPdf(join(pastaDosLivros, arquivo));
    if (letrasDoLivro(paginas) < 1000) {
      const aviso = "O PDF não tem texto (parece escaneado). O extrator não faz OCR: livro pulado.";
      console.warn(`${livro.titulo}: ${aviso}`);
      relatorio.push({ titulo: livro.titulo, arquivo, saida: null, resultado: null, aviso });
      continue;
    }
    let resultado: ResultadoDoLivro<{ nome: string }>;
    let texto: string;
    if (livro.chave === "magias") {
      const r = extrairMagiasDoLivro(paginas);
      if (tabelaDeNomes) {
        const n = aplicarNomesOriginais(r.validas, tabelaDeNomes.magias);
        r.validas = n.entradas;
        console.log(`  nomes em inglês: ${n.preenchidos} de ${r.validas.length} magias`);
      }
      magiasLidas = r.validas;
      resultado = r;
      texto = JSON.stringify(arquivoDoCompendio("magias", { magias: r.validas }));
    } else if (livro.chave === "monstros") {
      const r = extrairMonstrosDoLivro(paginas, magiasLidas as { nome: string }[]);
      if (tabelaDeNomes) {
        const n = aplicarNomesOriginais(r.validas, tabelaDeNomes.monstros);
        r.validas = n.entradas;
        console.log(`  nomes em inglês: ${n.preenchidos} de ${r.validas.length} monstros`);
      }
      resultado = r;
      texto = JSON.stringify(arquivoDoCompendio("monstros", { monstros: r.validas }));
    } else {
      const r = extrairItensDoLivro(paginas);
      if (tabelaDeNomes) {
        const n = aplicarNomesOriginais(r.validas, tabelaDeNomes.itens);
        r.validas = n.entradas;
        console.log(`  nomes em inglês: ${n.preenchidos} de ${r.validas.length} itens mágicos`);
      }
      resultado = r;
      texto = JSON.stringify(arquivoDoCompendio("itens", { itensMagicos: r.validas }));
    }
    // O arquivo final tem de passar pela mesma leitura que a mesa faz.
    const conferido = lerCompendio(texto);
    if (!conferido.ok) {
      const aviso = `O arquivo gerado não passou na leitura da mesa: ${conferido.motivo}`;
      console.error(`${livro.titulo}: ${aviso}`);
      relatorio.push({ titulo: livro.titulo, arquivo, saida: null, resultado, aviso });
      continue;
    }
    writeFileSync(join(pastaDeSaida, livro.saida), `${texto}\n`, "utf8");
    console.log(
      `${livro.titulo}: ${resultado.validas.length} de ${resultado.lidas} entradas -> ${livro.saida}`,
    );
    relatorio.push({ titulo: livro.titulo, arquivo, saida: livro.saida, resultado });
  }
  const hoje = new Date().toISOString().slice(0, 10);
  writeFileSync(join(pastaDeSaida, "relatorio.md"), montarRelatorio(relatorio, hoje), "utf8");
  console.log(`Relatório em ${join(pastaDeSaida, "relatorio.md")}`);
  return 0;
}

// Roda só quando chamado como comando (os testes importam as funções sem disparar a extração).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (erro) => {
      console.error(erro instanceof Error ? erro.message : String(erro));
      process.exitCode = 1;
    },
  );
}
