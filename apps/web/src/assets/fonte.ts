import { ehArquivoDeSom } from "@tabletop/shared";
import { gravarChave, lerChave } from "./armazem";

/** Um arquivo de imagem que a fonte oferece (ainda sem ler o conteúdo). */
export type ArquivoDaFonte = {
  /** Identificador estável dentro da fonte (caminho ou nome + tamanho). */
  id: string;
  nome: string;
  caminho: string;
  tamanho: number;
  abrir(): Promise<File>;
};

/**
 * De onde vêm (e para onde vão) os arquivos do usuário. Três implementações: `PastaLocal` (File
 * System Access, Chrome e Edge), `ArquivosSoltos` (input e arrastar; serve Firefox e Safari) e
 * `Memoria` (testes).
 */
export interface FonteDeAssets {
  readonly tipo: "pasta" | "soltos" | "memoria";
  listar(): Promise<ArquivoDaFonte[]>;
  /** Dá para gravar nela (a cópia `recebidos/<jogador>/` do mestre)? */
  readonly podeGravar: boolean;
  /** Um arquivo pelo caminho (`["compendio", "magias.json"]`), sem varrer a pasta; `null` se não existe. */
  abrirPorCaminho(caminho: readonly string[]): Promise<File | null>;
  /**
   * Grava em `pasta/…/nome`. `false` se já existia um arquivo igual (nada foi escrito); com
   * `substituir` grava sempre (a ficha exportada, que muda sem mudar de tamanho).
   */
  gravar(pasta: string[], nome: string, dados: Blob, substituir?: boolean): Promise<boolean>;
  /** CH3: o que há dentro de uma pasta (só o primeiro nível). Pasta que não existe: lista vazia. */
  listarPasta(caminho: readonly string[]): Promise<{ nome: string; tipo: "arquivo" | "pasta" }[]>;
  /** CH3: apaga um arquivo ou uma pasta inteira. `false` se não existia (ou não deu). */
  apagar(caminho: readonly string[]): Promise<boolean>;
}

const EXTENSOES = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
export const ehImagem = (nome: string) => EXTENSOES.test(nome);

// ---------------------------------------------------------------------------------------------

/** Arquivos que o usuário escolheu no input ou arrastou. Só valem enquanto a página está aberta. */
export class ArquivosSoltos implements FonteDeAssets {
  readonly tipo = "soltos" as const;
  readonly podeGravar = false;
  private readonly arquivos: File[] = [];

  adicionar(novos: Iterable<File>): void {
    for (const f of novos) {
      if (!ehImagem(f.name) && !f.type.startsWith("image/")) continue;
      const igual = this.arquivos.some(
        (a) => a.name === f.name && a.size === f.size && a.lastModified === f.lastModified,
      );
      if (!igual) this.arquivos.push(f);
    }
  }

  async listar(): Promise<ArquivoDaFonte[]> {
    return this.arquivos.map((f) => ({
      id: `solto:${f.name}:${f.size}:${f.lastModified}`,
      nome: f.name,
      caminho: f.name,
      tamanho: f.size,
      abrir: async () => f,
    }));
  }

  async abrirPorCaminho(): Promise<File | null> {
    return null;
  }

  async gravar(): Promise<boolean> {
    throw new Error("Arquivos soltos não aceitam gravação.");
  }

  async listarPasta(): Promise<{ nome: string; tipo: "arquivo" | "pasta" }[]> {
    return [];
  }

  async apagar(): Promise<boolean> {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------

/** Fonte em memória para testes: lista o que se adicionou e guarda o que "gravou". */
export class Memoria implements FonteDeAssets {
  readonly tipo = "memoria" as const;
  readonly podeGravar = true;
  private readonly arquivos = new Map<string, { bytes: Uint8Array; mime: string }>();
  private readonly gravadosEm = new Map<string, Uint8Array>();
  /** Arquivos que não são imagem (o `compendio/magias.json` dos testes), pelo caminho completo. */
  private readonly outros = new Map<string, string>();

  adicionar(nome: string, bytes: Uint8Array, mime = "image/png"): void {
    this.arquivos.set(nome, { bytes, mime });
  }

  /** Põe um arquivo de texto na "pasta" (só os testes e2e o fazem). */
  adicionarTexto(caminho: string, texto: string): void {
    this.outros.set(caminho, texto);
  }

  /** Só os testes e2e: põe bytes na "pasta" como se tivessem sido gravados (uma pasta que outro navegador encheu). */
  importarBytes(caminho: string, bytes: Uint8Array): void {
    this.gravadosEm.set(caminho, bytes);
    if (caminho.endsWith(".json")) this.outros.set(caminho, new TextDecoder().decode(bytes));
  }

  async abrirPorCaminho(caminho: readonly string[]): Promise<File | null> {
    const chave = caminho.join("/");
    const gravado = this.gravadosEm.get(chave);
    if (gravado) {
      return new File([gravado as BlobPart], caminho[caminho.length - 1] ?? chave);
    }
    const texto = this.outros.get(chave);
    if (texto === undefined) return null;
    return new File([texto], caminho[caminho.length - 1] ?? chave, { type: "application/json" });
  }

  async listar(): Promise<ArquivoDaFonte[]> {
    return [...this.arquivos].map(([nome, { bytes, mime }]) => ({
      id: `memoria:${nome}`,
      nome,
      caminho: nome,
      tamanho: bytes.length,
      abrir: async () => new File([bytes as BlobPart], nome, { type: mime }),
    }));
  }

  async gravar(pasta: string[], nome: string, dados: Blob, substituir = false): Promise<boolean> {
    const caminho = [...pasta, nome].join("/");
    const bytes = new Uint8Array(await dados.arrayBuffer());
    if (!substituir && this.gravadosEm.get(caminho)?.length === bytes.length) return false;
    this.gravadosEm.set(caminho, bytes);
    // o que se grava em JSON pode ser lido de volta (o `compendio/magias.json` que "Usar o exemplo" grava)
    if (nome.endsWith(".json")) this.outros.set(caminho, new TextDecoder().decode(bytes));
    return true;
  }

  async listarPasta(
    caminho: readonly string[],
  ): Promise<{ nome: string; tipo: "arquivo" | "pasta" }[]> {
    const prefixo = caminho.length === 0 ? "" : `${caminho.join("/")}/`;
    const achados = new Map<string, "arquivo" | "pasta">();
    for (const chave of [...this.gravadosEm.keys(), ...this.outros.keys()]) {
      if (!chave.startsWith(prefixo)) continue;
      const resto = chave.slice(prefixo.length);
      const [primeiro, ...mais] = resto.split("/");
      if (!primeiro) continue;
      if (mais.length > 0) achados.set(primeiro, "pasta");
      else if (!achados.has(primeiro)) achados.set(primeiro, "arquivo");
    }
    return [...achados].map(([nome, tipo]) => ({ nome, tipo }));
  }

  async apagar(caminho: readonly string[]): Promise<boolean> {
    const alvo = caminho.join("/");
    let apagou = false;
    for (const mapa of [this.gravadosEm, this.outros] as Map<string, unknown>[]) {
      for (const chave of [...mapa.keys()]) {
        if (chave === alvo || chave.startsWith(`${alvo}/`)) {
          mapa.delete(chave);
          apagou = true;
        }
      }
    }
    return apagou;
  }

  /** O que foi gravado (caminho e bytes), para o gancho de teste. */
  gravados(): { caminho: string; bytes: Uint8Array }[] {
    return [...this.gravadosEm].map(([caminho, bytes]) => ({ caminho, bytes }));
  }
}

// ---------------------------------------------------------------------------------------------

type Permissao = "granted" | "denied" | "prompt";
type PastaComPermissao = FileSystemDirectoryHandle & {
  queryPermission(d: { mode: "read" | "readwrite" }): Promise<Permissao>;
  requestPermission(d: { mode: "read" | "readwrite" }): Promise<Permissao>;
  values(): AsyncIterable<FileSystemHandle>;
};

/** A pasta de imagens é uma por mesa (C1): cada mesa guarda a sua no IndexedDB. */
const chaveDaPasta = (mesaId: string) => `handle:${mesaId}`;
/** A chave de antes do C1, quando a pasta era uma só. */
const CHAVE_ANTIGA_DA_PASTA = "handle";

const PASTAS_IGNORADAS = new Set([
  "recebidos",
  "backup",
  "node_modules",
  ".git",
  // Q1: a cópia dos arquivos da mesa, com o hash por nome: não é biblioteca de imagens nem de sons
  "arquivos-da-mesa",
  // CH3: os trechos de voz da gravação da sessão (WAV) não são biblioteca de sons
  "gravacoes",
]);
const PROFUNDIDADE_MAXIMA = 4;

export const temSeletorDePasta = () =>
  typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
  "function";

/** Pasta do computador (File System Access API). O handle fica no IndexedDB. */
export class PastaLocal implements FonteDeAssets {
  readonly tipo = "pasta" as const;
  readonly podeGravar = true;

  constructor(private readonly pasta: PastaComPermissao) {}

  get nome(): string {
    return this.pasta.name;
  }

  /** Abre o seletor do navegador (exige gesto do usuário) e lembra a pasta escolhida para esta mesa. */
  static async escolher(mesaId: string): Promise<PastaLocal> {
    const abrir = (
      window as unknown as {
        showDirectoryPicker(o: { mode: "readwrite"; id: string }): Promise<PastaComPermissao>;
      }
    ).showDirectoryPicker;
    const pasta = await abrir.call(window, { mode: "readwrite", id: "tabletop" });
    await gravarChave("pasta", chaveDaPasta(mesaId), pasta);
    return new PastaLocal(pasta);
  }

  /**
   * Abre o seletor sem lembrar a escolha (C3): quem escolhe só decide depois se a pasta serve à mesa (a pasta
   * de outra mesa não pode virar a pasta de imagens desta). `null` se a pessoa cancelou.
   */
  static async escolherSemLembrar(): Promise<PastaLocal | null> {
    const abrir = (
      window as unknown as {
        showDirectoryPicker(o: { mode: "readwrite"; id: string }): Promise<PastaComPermissao>;
      }
    ).showDirectoryPicker;
    try {
      return new PastaLocal(await abrir.call(window, { mode: "readwrite", id: "tabletop" }));
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      throw e;
    }
  }

  /** Faz desta a pasta de imagens da mesa (a mesma pasta guarda a chave do mestre). */
  async lembrarPara(mesaId: string): Promise<void> {
    await gravarChave("pasta", chaveDaPasta(mesaId), this.pasta);
  }

  /** O texto de um arquivo da raiz da pasta, ou `null` se não existe. */
  async lerTexto(nome: string): Promise<string | null> {
    return (await (await this.abrirPorCaminho([nome]))?.text()) ?? null;
  }

  /** Grava (ou substitui) um arquivo de texto na raiz da pasta. */
  async gravarTexto(nome: string, texto: string): Promise<void> {
    await this.gravar([], nome, new Blob([texto], { type: "application/json" }), true);
  }

  /**
   * A pasta lembrada desta mesa de uma visita anterior (a permissão pode precisar ser pedida de novo).
   * A mesa legada (a campanha de antes do C1) herda a pasta que já estava escolhida, sem pedir de novo: a
   * chave antiga é copiada para a chave da mesa e fica onde estava (só se acrescenta).
   */
  static async lembrada(mesaId: string, legada: boolean): Promise<PastaLocal | null> {
    let pasta = await lerChave<PastaComPermissao>("pasta", chaveDaPasta(mesaId));
    if (!pasta && legada) {
      pasta = await lerChave<PastaComPermissao>("pasta", CHAVE_ANTIGA_DA_PASTA);
      if (pasta) await gravarChave("pasta", chaveDaPasta(mesaId), pasta);
    }
    return pasta ? new PastaLocal(pasta) : null;
  }

  async permissao(): Promise<Permissao> {
    try {
      return await this.pasta.queryPermission({ mode: "readwrite" });
    } catch {
      return "denied";
    }
  }

  /** Pedir a permissão precisa de um gesto do usuário (um clique). */
  async autorizar(): Promise<boolean> {
    try {
      return (await this.pasta.requestPermission({ mode: "readwrite" })) === "granted";
    } catch {
      return false;
    }
  }

  async listar(): Promise<ArquivoDaFonte[]> {
    return this.varrerPasta(ehImagem);
  }

  /** N5: os arquivos de som (mp3, ogg e wav) da pasta, de `sons/` ou de qualquer subpasta. */
  async listarSons(): Promise<ArquivoDaFonte[]> {
    return this.varrerPasta(ehArquivoDeSom);
  }

  private async varrerPasta(servem: (nome: string) => boolean): Promise<ArquivoDaFonte[]> {
    const achados: ArquivoDaFonte[] = [];
    const varrer = async (dir: PastaComPermissao, caminho: string[]) => {
      for await (const e of dir.values()) {
        if (e.kind === "directory") {
          if (caminho.length < PROFUNDIDADE_MAXIMA && !PASTAS_IGNORADAS.has(e.name)) {
            await varrer(e as PastaComPermissao, [...caminho, e.name]);
          }
        } else if (servem(e.name)) {
          const arquivo = e as FileSystemFileHandle;
          const completo = [...caminho, e.name].join("/");
          const info = await arquivo.getFile();
          achados.push({
            id: `pasta:${completo}:${info.size}:${info.lastModified}`,
            nome: e.name,
            caminho: completo,
            tamanho: info.size,
            abrir: () => arquivo.getFile(),
          });
        }
      }
    };
    await varrer(this.pasta, []);
    return achados.sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"));
  }

  async abrirPorCaminho(caminho: readonly string[]): Promise<File | null> {
    try {
      let dir: FileSystemDirectoryHandle = this.pasta;
      for (const parte of caminho.slice(0, -1)) dir = await dir.getDirectoryHandle(parte);
      const nome = caminho[caminho.length - 1] ?? "";
      return await (await dir.getFileHandle(nome)).getFile();
    } catch {
      return null; // a pasta ou o arquivo não existem (ou a permissão acabou)
    }
  }

  async gravar(pasta: string[], nome: string, dados: Blob, substituir = false): Promise<boolean> {
    let dir: FileSystemDirectoryHandle = this.pasta;
    for (const parte of pasta) dir = await dir.getDirectoryHandle(parte, { create: true });
    if (!substituir)
      try {
        const existente = await (await dir.getFileHandle(nome)).getFile();
        if (existente.size === dados.size) return false;
      } catch {
        // não existe: grava
      }
    const arquivo = await dir.getFileHandle(nome, { create: true });
    const saida = await arquivo.createWritable();
    await saida.write(dados);
    await saida.close();
    return true;
  }

  private async pastaDe(caminho: readonly string[]): Promise<PastaComPermissao | null> {
    try {
      let dir: FileSystemDirectoryHandle = this.pasta;
      for (const parte of caminho) dir = await dir.getDirectoryHandle(parte);
      return dir as PastaComPermissao;
    } catch {
      return null;
    }
  }

  async listarPasta(
    caminho: readonly string[],
  ): Promise<{ nome: string; tipo: "arquivo" | "pasta" }[]> {
    const dir = await this.pastaDe(caminho);
    if (!dir) return [];
    const lista: { nome: string; tipo: "arquivo" | "pasta" }[] = [];
    try {
      for await (const e of dir.values()) {
        lista.push({ nome: e.name, tipo: e.kind === "directory" ? "pasta" : "arquivo" });
      }
    } catch {
      // a permissão acabou no meio
    }
    return lista;
  }

  async apagar(caminho: readonly string[]): Promise<boolean> {
    const nome = caminho[caminho.length - 1];
    if (!nome) return false;
    const pai = await this.pastaDe(caminho.slice(0, -1));
    if (!pai) return false;
    try {
      await pai.removeEntry(nome, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}
