import {
  type ArquivoDaChave,
  type ChavePublica,
  gerarParDeChaves,
  lerArquivoDaChave,
  montarArquivoDaChave,
  NOME_DO_ARQUIVO_DA_CHAVE,
} from "@tabletop/shared";
import { PastaLocal, temSeletorDePasta } from "../assets/fonte";

/**
 * A pasta da mesa do ponto de vista da chave do mestre (C3): lê e grava o `tavola-mestre.json`. É a mesma pasta
 * local das imagens (File System Access, só Chrome e Edge). A chave PRIVADA só existe aqui e no arquivo: nunca
 * vai ao servidor. No modo `e2e` o seletor é trocado por uma "pasta" de teste (ver `instalarGanchoDePastas`).
 */
export type PastaDoMestre = {
  nome: string;
  lerTexto(nome: string): Promise<string | null>;
  gravarTexto(nome: string, texto: string): Promise<void>;
  /** Faz desta a pasta de imagens da mesa (não faz nada nas pastas de teste). */
  lembrarPara(mesaId: string): Promise<void>;
};

const ehE2E = () => import.meta.env.MODE === "e2e";

/** O navegador deixa escolher uma pasta (só Chrome e Edge)? Nos testes sempre. */
export const navegadorEscolhePasta = () => ehE2E() || temSeletorDePasta();

export const TEXTO_SO_CHROME_E_EDGE =
  "A pasta da mesa só funciona no Chrome e no Edge (o mesmo das imagens locais).";

// --- Pastas de teste (modo e2e) ---------------------------------------------------------------------

const CHAVE_DAS_PASTAS_E2E = "tabletop:e2e:pastas";
type PastasE2E = Record<string, Record<string, string>>;

function lerPastasE2E(): PastasE2E {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_DAS_PASTAS_E2E) ?? "{}") as PastasE2E;
  } catch {
    return {};
  }
}
function gravarPastasE2E(p: PastasE2E): void {
  try {
    sessionStorage.setItem(CHAVE_DAS_PASTAS_E2E, JSON.stringify(p));
  } catch {
    // sem sessionStorage: a pasta de teste vale só enquanto a página não recarrega
  }
}

let proximaPastaE2E: string | null = null;

function pastaDeTeste(nome: string): PastaDoMestre {
  return {
    nome,
    lerTexto: async (arquivo) => lerPastasE2E()[nome]?.[arquivo] ?? null,
    gravarTexto: async (arquivo, texto) => {
      const todas = lerPastasE2E();
      todas[nome] = { ...todas[nome], [arquivo]: texto };
      gravarPastasE2E(todas);
    },
    lembrarPara: async () => {},
  };
}

/**
 * Gancho de teste (`window.__tabletopPastas`), só no modo `e2e`: `escolher(nome)` diz qual pasta o próximo
 * "Escolher a pasta" devolve (sem isso, é como cancelar); `ler`, `definir` e `arquivos` olham e mexem no
 * conteúdo da pasta de teste.
 */
export function instalarGanchoDePastas(): void {
  if (!ehE2E()) return;
  (window as unknown as { __tabletopPastas?: unknown }).__tabletopPastas = {
    escolher: (nome: string | null) => {
      proximaPastaE2E = nome;
    },
    ler: (nome: string, arquivo: string) => lerPastasE2E()[nome]?.[arquivo] ?? null,
    definir: (nome: string, arquivo: string, texto: string) => {
      const todas = lerPastasE2E();
      todas[nome] = { ...todas[nome], [arquivo]: texto };
      gravarPastasE2E(todas);
    },
    arquivos: (nome: string) => Object.keys(lerPastasE2E()[nome] ?? {}),
  };
}
instalarGanchoDePastas();

// --- Escolher e usar -----------------------------------------------------------------------------------

/** Abre o seletor de pasta (precisa de um clique). `null` se a pessoa cancelou. */
export async function escolherPastaDoMestre(): Promise<PastaDoMestre | null> {
  if (ehE2E()) {
    const nome = proximaPastaE2E;
    proximaPastaE2E = null;
    return nome ? pastaDeTeste(nome) : null;
  }
  if (!temSeletorDePasta()) throw new Error(TEXTO_SO_CHROME_E_EDGE);
  const pasta = await PastaLocal.escolherSemLembrar();
  return pasta
    ? {
        nome: pasta.nome,
        lerTexto: (n) => pasta.lerTexto(n),
        gravarTexto: (n, t) => pasta.gravarTexto(n, t),
        lembrarPara: (id) => pasta.lembrarPara(id),
      }
    : null;
}

/** O arquivo de chave da pasta: `null` se não há; lança se há um arquivo que não é do Távola. */
export async function lerChaveDaPasta(pasta: PastaDoMestre): Promise<ArquivoDaChave | null> {
  const texto = await pasta.lerTexto(NOME_DO_ARQUIVO_DA_CHAVE);
  if (texto === null) return null;
  const arquivo = lerArquivoDaChave(texto);
  if (!arquivo) {
    throw new Error(
      `O ${NOME_DO_ARQUIVO_DA_CHAVE} desta pasta não é um arquivo de chave do Távola.`,
    );
  }
  return arquivo;
}

/**
 * Antes de gravar a chave de `mesaId` nesta pasta: ela não pode já guardar a chave de OUTRA mesa (gravar por
 * cima apagaria a prova de mestre dela). Lança com o texto para a tela.
 */
export async function conferirPastaLivreParaMesa(
  pasta: PastaDoMestre,
  mesaId: string,
): Promise<void> {
  let existente: ArquivoDaChave | null;
  try {
    existente = await lerChaveDaPasta(pasta);
  } catch {
    throw new Error(
      `Esta pasta já tem um ${NOME_DO_ARQUIVO_DA_CHAVE} que o Távola não entende. Escolha outra pasta.`,
    );
  }
  if (existente && existente.mesaId !== mesaId) {
    throw new Error(
      `Esta pasta já guarda a chave de outra mesa (${existente.nomeDaMesa}). Escolha outra pasta.`,
    );
  }
}

/** Um par novo de chaves: a pública para o servidor e uma função que grava a privada na pasta. */
export async function prepararChave(
  pasta: PastaDoMestre,
  mesa: { id: string; nome: string },
): Promise<{ publica: ChavePublica; gravar: () => Promise<void> }> {
  const par = await gerarParDeChaves();
  return {
    publica: par.publica,
    gravar: () =>
      pasta.gravarTexto(
        NOME_DO_ARQUIVO_DA_CHAVE,
        montarArquivoDaChave({ mesaId: mesa.id, nomeDaMesa: mesa.nome, chavePrivada: par.privada }),
      ),
  };
}
