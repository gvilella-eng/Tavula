import {
  criarArquivoDeFicha,
  type Ficha,
  lerArquivoDeFicha,
  type Personagem,
  semAcento,
} from "@tabletop/shared";
import type { Fontes } from "../assets/fontes";

/** Nome de arquivo seguro a partir do nome do personagem. */
export function nomeDoArquivoDaFicha(nome: string): string {
  const limpo = semAcento(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${limpo || "ficha"}.json`;
}

function baixar(texto: string, nome: string) {
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Exporta a ficha em JSON: na subpasta `fichas/` da pasta local escolhida em Configurações; sem pasta
 * (ou sem permissão de escrita), baixa o arquivo. Devolve o aviso para mostrar.
 */
export async function exportarFicha(personagem: Personagem, fontes: Fontes): Promise<string> {
  if (!personagem.ficha) return "Não há ficha para exportar.";
  const nome = nomeDoArquivoDaFicha(personagem.nome);
  const texto = `${JSON.stringify(
    criarArquivoDeFicha(personagem.nome, personagem.ficha, new Date().toISOString()),
    null,
    2,
  )}\n`;
  const pasta = fontes.pastaGravavel();
  if (pasta) {
    try {
      await pasta.gravar(["fichas"], nome, new Blob([texto], { type: "application/json" }), true);
      return `Salvo em fichas/${nome}.`;
    } catch {
      // sem permissão ou pasta sumiu: cai no download
    }
  }
  baixar(texto, nome);
  return `Baixado: ${nome}.`;
}

/** Lê e valida o arquivo de ficha escolhido. */
export async function lerFichaDoArquivo(
  arquivo: File,
): Promise<{ ok: true; ficha: Ficha } | { ok: false; motivo: string }> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(await arquivo.text());
  } catch {
    return { ok: false, motivo: "O arquivo não é um JSON válido." };
  }
  const lido = lerArquivoDeFicha(bruto);
  return lido.ok
    ? { ok: true, ficha: lido.arquivo.ficha }
    : { ok: false, motivo: `Arquivo de ficha inválido: ${lido.motivo}` };
}
