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
  /**
   * Grava em `pasta/…/nome`. `false` se já existia um arquivo igual (nada foi escrito); com
   * `substituir` grava sempre (a ficha exportada, que muda sem mudar de tamanho).
   */
  gravar(pasta: string[], nome: string, dados: Blob, substituir?: boolean): Promise<boolean>;
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

  async gravar(): Promise<boolean> {
    throw new Error("Arquivos soltos não aceitam gravação.");
  }
}

// ---------------------------------------------------------------------------------------------

/** Fonte em memória para testes: lista o que se adicionou e guarda o que "gravou". */
export class Memoria implements FonteDeAssets {
  readonly tipo = "memoria" as const;
  readonly podeGravar = true;
  private readonly arquivos = new Map<string, { bytes: Uint8Array; mime: string }>();
  private readonly gravadosEm = new Map<string, Uint8Array>();

  adicionar(nome: string, bytes: Uint8Array, mime = "image/png"): void {
    this.arquivos.set(nome, { bytes, mime });
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

  async gravar(pasta: string[], nome: string, dados: Blob): Promise<boolean> {
    const caminho = [...pasta, nome].join("/");
    const bytes = new Uint8Array(await dados.arrayBuffer());
    if (this.gravadosEm.get(caminho)?.length === bytes.length) return false;
    this.gravadosEm.set(caminho, bytes);
    return true;
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

const PASTAS_IGNORADAS = new Set(["recebidos", "backup", "node_modules", ".git"]);
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

  /** Abre o seletor do navegador (exige gesto do usuário) e lembra a pasta escolhida. */
  static async escolher(): Promise<PastaLocal> {
    const abrir = (
      window as unknown as {
        showDirectoryPicker(o: { mode: "readwrite"; id: string }): Promise<PastaComPermissao>;
      }
    ).showDirectoryPicker;
    const pasta = await abrir.call(window, { mode: "readwrite", id: "tabletop" });
    await gravarChave("pasta", "handle", pasta);
    return new PastaLocal(pasta);
  }

  /** A pasta lembrada de uma visita anterior (a permissão pode precisar ser pedida de novo). */
  static async lembrada(): Promise<PastaLocal | null> {
    const pasta = await lerChave<PastaComPermissao>("pasta", "handle");
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
    const achados: ArquivoDaFonte[] = [];
    const varrer = async (dir: PastaComPermissao, caminho: string[]) => {
      for await (const e of dir.values()) {
        if (e.kind === "directory") {
          if (caminho.length < PROFUNDIDADE_MAXIMA && !PASTAS_IGNORADAS.has(e.name)) {
            await varrer(e as PastaComPermissao, [...caminho, e.name]);
          }
        } else if (ehImagem(e.name)) {
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
}
