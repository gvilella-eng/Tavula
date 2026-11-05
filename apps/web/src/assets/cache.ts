import { type AssetMeta, AssetMetaSchema } from "@tabletop/shared";

/**
 * Cache dos assets no OPFS (sistema de arquivos privado da origem):
 *   tabletop/assets/<hash>            arquivo completo e conferido
 *   tabletop/meta/<hash>.json         metadados (também dos manifestos de mapa)
 *   tabletop/parciais/<hash>/<i>      pedaços já conferidos de um arquivo em transferência
 * Os pedaços parciais ficam em disco para retomar depois de refresh ou queda.
 */
export class CacheOpfs {
  private readonly raiz: Promise<FileSystemDirectoryHandle>;

  constructor() {
    this.raiz = navigator.storage
      .getDirectory()
      .then((r) => r.getDirectoryHandle("tabletop", { create: true }));
  }

  private async pasta(...caminho: string[]): Promise<FileSystemDirectoryHandle> {
    let dir = await this.raiz;
    for (const parte of caminho) dir = await dir.getDirectoryHandle(parte, { create: true });
    return dir;
  }

  private async escrever(dir: FileSystemDirectoryHandle, nome: string, dados: Blob | BufferSource) {
    const arquivo = await dir.getFileHandle(nome, { create: true });
    const saida = await arquivo.createWritable();
    await saida.write(dados);
    await saida.close(); // só aqui o arquivo passa a valer (troca atômica)
  }

  private async ler(dir: FileSystemDirectoryHandle, nome: string): Promise<File | null> {
    try {
      return await (await dir.getFileHandle(nome)).getFile();
    } catch {
      return null;
    }
  }

  // --- arquivos completos ---------------------------------------------------------------------

  async lerArquivo(hash: string): Promise<File | null> {
    return this.ler(await this.pasta("assets"), hash);
  }

  async gravarArquivo(hash: string, dados: Blob | BufferSource): Promise<void> {
    await this.escrever(await this.pasta("assets"), hash, dados);
  }

  async apagarArquivo(hash: string): Promise<void> {
    try {
      await (await this.pasta("assets")).removeEntry(hash);
    } catch {
      // já não existia
    }
  }

  /** Hashes de todos os arquivos completos (o inventário que vai à sala ao conectar). */
  async listarArquivos(): Promise<string[]> {
    const hashes: string[] = [];
    const dir = (await this.pasta("assets")) as FileSystemDirectoryHandle & {
      keys(): AsyncIterable<string>;
    };
    for await (const nome of dir.keys()) hashes.push(nome);
    return hashes;
  }

  // --- metadados ------------------------------------------------------------------------------

  async lerMeta(hash: string): Promise<AssetMeta | null> {
    const arquivo = await this.ler(await this.pasta("meta"), `${hash}.json`);
    if (!arquivo) return null;
    try {
      const r = AssetMetaSchema.safeParse(JSON.parse(await arquivo.text()));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }

  async gravarMeta(meta: AssetMeta): Promise<void> {
    await this.escrever(
      await this.pasta("meta"),
      `${meta.hash}.json`,
      new Blob([JSON.stringify(meta)]),
    );
  }

  async listarMetas(): Promise<AssetMeta[]> {
    const dir = (await this.pasta("meta")) as FileSystemDirectoryHandle & {
      values(): AsyncIterable<FileSystemHandle>;
    };
    const metas: AssetMeta[] = [];
    for await (const e of dir.values()) {
      if (e.kind !== "file" || !e.name.endsWith(".json")) continue;
      const meta = await this.lerMeta(e.name.slice(0, -5));
      if (meta) metas.push(meta);
    }
    return metas;
  }

  // --- pedaços parciais -----------------------------------------------------------------------

  async gravarPedaco(hash: string, indice: number, dados: Uint8Array): Promise<void> {
    await this.escrever(await this.pasta("parciais", hash), String(indice), dados as BufferSource);
  }

  async pedacosPresentes(hash: string): Promise<Set<number>> {
    const dir = (await this.pasta("parciais", hash)) as FileSystemDirectoryHandle & {
      keys(): AsyncIterable<string>;
    };
    const presentes = new Set<number>();
    for await (const nome of dir.keys()) presentes.add(Number(nome));
    return presentes;
  }

  async lerPedaco(hash: string, indice: number): Promise<File | null> {
    return this.ler(await this.pasta("parciais", hash), String(indice));
  }

  async apagarPedacos(hash: string): Promise<void> {
    try {
      await (await this.pasta("parciais")).removeEntry(hash, { recursive: true });
    } catch {
      // nada a apagar
    }
  }
}
