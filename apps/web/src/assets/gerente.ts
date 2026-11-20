import {
  type AssetMeta,
  arquivoConfere,
  cifrar,
  decifrarEConferir,
  detectarFormato,
  dividirEmPedacos,
  hashesDosPedacos,
  type ImportacaoDeMapa,
  LIMITES_DE_ASSET,
  lerFrameDePedaco,
  limiteDeTextura,
  type MensagemDaSala,
  type MetaNova,
  metaDoCifrado,
  mimeDeAnimacaoValido,
  mimeDeSomValido,
  mimeDoSomPeloNome,
  montarFrameDePedaco,
  nomeDaCenaDoArquivo,
  type Pacote,
  pedacoConfere,
  sha256Hex,
  TAMANHO_PEDACO,
  totalDePedacos,
} from "@tabletop/shared";
import { indiceLocal } from "./armazem";
import type { CacheOpfs } from "./cache";
import type { FonteDeAssets } from "./fonte";
import { maxTextureSize, type Processador } from "./processador";

export type EstadoDaTransferencia = "pedindo" | "baixando" | "pronto" | "indisponivel" | "erro";

export type StatusDeAsset = {
  hash: string;
  nome: string;
  tipo: AssetMeta["tipo"] | "?";
  estado: EstadoDaTransferencia;
  recebidos: number;
  total: number;
  mensagem?: string;
};

/** A conexão com a sala, como o gerente a enxerga. */
export type Canal = {
  conectado(): boolean;
  enviar(tipo: string, dados: object): string | null;
  enviarBinario(dados: Uint8Array): boolean;
  bufferizado(): number;
};

/** Ganchos de teste (só existem no modo `e2e`): deixar o envio lento, corromper, reduzir o tile. */
export type GanchosE2E = {
  atrasoPorPedacoMs?: number;
  /** Corrompe este índice de pedaço ao enviar (as primeiras `corromperVezes` vezes de cada hash). */
  corromperIndice?: number;
  corromperVezes?: number;
  limiteTile?: number;
};

type Dependencias = {
  cache: CacheOpfs;
  processador: Processador;
  canal: () => Canal | null;
  meuId: string;
  euMestre: () => boolean;
  nomeDoUsuario: (id: string) => string | undefined;
  destinoDeCopia: () => FonteDeAssets | null;
  /** Q1: a pasta da mesa com escrita (só o mestre a usa): guarda uma cópia de cada arquivo da mesa em `arquivos-da-mesa/`. */
  pastaDosArquivos: () => FonteDeAssets | null;
  ganchos: () => GanchosE2E | undefined;
};

type Entrada = StatusDeAsset & { ultimoPedaco: number; ultimaPergunta: number };

/** Folga do `bufferedAmount` do socket antes de mandar o próximo pedaço (não inundar). */
const BUFFER_MAXIMO = 1024 * 1024;
const TENTATIVAS_POR_PEDACO = 5;
const TENTATIVAS_DO_ARQUIVO = 3;
const PARADO_MS = 20_000;
const REPERGUNTAR_MS = 30_000;

/** Q1: a subpasta da pasta da mesa onde cada arquivo do cache tem uma cópia, com o hash por nome. */
export const PASTA_DOS_ARQUIVOS_DA_MESA = "arquivos-da-mesa";

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const semDono = ({ donoId: _d, ...resto }: AssetMeta): MetaNova => resto;

function nomeSeguro(nome: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: tira caracteres de controle de nomes de arquivo
  return nome.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "sem-nome";
}

/**
 * Tudo o que o navegador faz com arquivos da campanha: processar e registrar o que o usuário usa,
 * pedir o que falta (retomando do que já está no OPFS), conferir pedaço a pedaço, servir os outros
 * e, no mestre, guardar cópia do que os jogadores sobem. O servidor só repassa bytes.
 */
export class GerenteDeAssets {
  private readonly metas = new Map<string, AssetMeta>();
  private readonly completos = new Set<string>();
  private readonly status = new Map<string, Entrada>();
  private readonly presentes = new Map<string, Set<number>>();
  private readonly tentativas = new Map<string, number>();
  private readonly arquivosRefeitos = new Map<string, number>();
  private readonly filas = new Map<string, Promise<void>>();
  private readonly pedidos = new Map<string, string>();
  private readonly copiados = new Set<string>();
  private readonly corrompidosEnviados = new Map<string, number>();
  /** Originais que estão sendo decifrados agora: ninguém pede esses pela rede (PROJETO.md, Lote 4). */
  private readonly decifrando = new Set<string>();
  private readonly ouvintes = new Set<() => void>();
  private readonly ouvintesDeProntos = new Set<() => void>();
  private versao = 0;
  private prontosVersao = 0;
  private vigia: ReturnType<typeof setInterval> | undefined;
  private persistiu = false;
  private encerrado = false;

  constructor(private readonly d: Dependencias) {}

  // --- ciclo de vida --------------------------------------------------------------------------

  async iniciar(): Promise<void> {
    const [arquivos, metas] = await Promise.all([
      this.d.cache.listarArquivos(),
      this.d.cache.listarMetas(),
    ]);
    for (const h of arquivos) this.completos.add(h);
    for (const m of metas) this.metas.set(m.hash, m);
    if (this.encerrado) return;
    this.vigia = setInterval(() => this.vigiar(), 4000);
    this.mudou();
    this.prontosMudaram();
  }

  encerrar(): void {
    this.encerrado = true;
    clearInterval(this.vigia);
  }

  // --- observação (useSyncExternalStore) ------------------------------------------------------

  readonly assinar = (fn: () => void): (() => void) => {
    this.ouvintes.add(fn);
    return () => {
      this.ouvintes.delete(fn);
    };
  };
  readonly versaoAtual = (): number => this.versao;

  private mudou(): void {
    this.versao++;
    for (const fn of this.ouvintes) fn();
  }

  /** Muda só quando algo fica pronto no cache (o mapa redesenha o fundo e os tokens). */
  readonly assinarProntos = (fn: () => void): (() => void) => {
    this.ouvintesDeProntos.add(fn);
    return () => {
      this.ouvintesDeProntos.delete(fn);
    };
  };
  readonly versaoDeProntos = (): number => this.prontosVersao;

  private prontosMudaram(): void {
    this.prontosVersao++;
    for (const fn of this.ouvintesDeProntos) fn();
  }

  listarStatus(): StatusDeAsset[] {
    return [...this.status.values()].map(({ ultimoPedaco: _u, ultimaPergunta: _p, ...s }) => s);
  }

  /** Há algum arquivo sendo pedido ou baixado? Leitura barata (sem alocar), para assinar só esse booleano. */
  readonly haTransferencia = (): boolean => {
    for (const s of this.status.values()) {
      if (s.estado === "pedindo" || s.estado === "baixando") return true;
    }
    return false;
  };

  // --- consultas ------------------------------------------------------------------------------

  meta(hash: string): AssetMeta | undefined {
    return this.metas.get(hash);
  }

  /** O asset está inteiro no cache (no mapa fatiado: todos os tiles)? */
  estaPronto(hash: string): boolean {
    const m = this.metas.get(hash);
    if (m?.tiles) return m.tiles.every((t) => this.completos.has(t.hash));
    return this.completos.has(hash);
  }

  /** Todas as metas que este navegador conhece (também de manifestos e de arquivos em transferência). */
  metasConhecidas(): AssetMeta[] {
    return [...this.metas.values()];
  }

  inventario(): string[] {
    return [...this.completos];
  }

  async blobDe(hash: string): Promise<Blob | null> {
    return this.d.cache.lerArquivo(hash);
  }

  /** Quantos pedaços de arquivo o cache aguenta de início: o limite real de tile desta máquina. */
  limiteDeTile(): number {
    return this.d.ganchos()?.limiteTile ?? limiteDeTextura(maxTextureSize());
  }

  // --- conexão --------------------------------------------------------------------------------

  /** Conexão (re)aberta: diz à sala o que tenho e volta a pedir o que ainda falta. */
  aoConectar(): void {
    const canal = this.d.canal();
    if (!canal?.conectado()) return;
    canal.enviar("asset.inventario", {
      hashes: [...this.completos].slice(0, LIMITES_DE_ASSET.inventario),
    });
    for (const [hash, st] of this.status) if (st.estado !== "pronto") void this.perguntar(hash);
  }

  aoMensagem(m: MensagemDaSala): void {
    if (m.tipo === "preparo.disponivel") {
      // Pré-envio: baixa os arquivos cifrados (opacos) enquanto o grupo ainda está na outra cena.
      for (const hash of m.dados.hashes) this.garantir(hash);
    } else if (m.tipo === "preparo.chaves") this.aoChaves(m.dados.pacotes);
    else if (m.tipo === "asset.meta") void this.aoMeta(m.dados.meta);
    else if (m.tipo === "asset.enviar") void this.servir(m.dados.hash, m.dados.indices);
    else if (m.tipo === "asset.indisponivel") {
      const st = this.status.get(m.dados.hash);
      if (st && st.estado !== "pronto") {
        st.estado = "indisponivel";
        st.mensagem = "Ninguém com o arquivo está online";
        this.mudou();
      }
    }
  }

  /** `erro` da sala: se foi resposta a um pedido de arquivo, marca a transferência. */
  aoErro(idPedido: string | null, codigo: string): void {
    const hash = idPedido ? this.pedidos.get(idPedido) : undefined;
    if (!idPedido || !hash) return;
    this.pedidos.delete(idPedido);
    const st = this.status.get(hash);
    if (st && codigo === "asset_inexistente" && st.estado !== "pronto") {
      st.estado = "erro";
      st.mensagem = "A sala não tem este arquivo";
      this.mudou();
    }
  }

  /** Frame binário que a sala repassou: um pedaço do arquivo que pedi. */
  aoPedaco(bruto: ArrayBuffer): void {
    const f = lerFrameDePedaco(bruto);
    if (!f) return;
    this.enfileirar(f.hash, async () => {
      const meta = this.metas.get(f.hash);
      const st = this.status.get(f.hash);
      if (!meta || !st || this.completos.has(f.hash) || meta.pedacos.length !== f.total) return;
      const ja = await this.pedacosPresentes(f.hash);
      if (ja.has(f.indice)) return;
      const dados = f.dados.slice();
      if (!(await pedacoConfere(meta, f.indice, dados))) {
        await this.pedirDeNovo(f.hash, f.indice, st);
        return;
      }
      await this.d.cache.gravarPedaco(f.hash, f.indice, dados);
      ja.add(f.indice);
      st.recebidos = ja.size;
      st.total = meta.pedacos.length;
      st.estado = "baixando";
      delete st.mensagem;
      st.ultimoPedaco = Date.now();
      this.mudou();
      if (ja.size === meta.pedacos.length) await this.finalizar(f.hash);
    });
  }

  // --- pedir ----------------------------------------------------------------------------------

  /** Garante que o asset chegue ao cache (idempotente): lê do OPFS, senão pede à sala. */
  garantir(hash: string): void {
    if (this.estaPronto(hash) || this.decifrando.has(hash)) return;
    // Já pedido (mesmo indisponível ou com erro): o vigia pergunta de novo de tempos em tempos.
    if (this.status.get(hash)?.estado !== undefined && this.status.get(hash)?.estado !== "pronto")
      return;
    this.criarStatus(hash);
    const meta = this.metas.get(hash);
    if (meta?.tiles) {
      for (const t of meta.tiles) this.garantir(t.hash);
      this.atualizarManifesto(meta);
      return;
    }
    void this.perguntar(hash);
  }

  /** Meta já conhecida por outro caminho (snapshot do mestre): poupa a ida à sala. */
  conhecerMeta(meta: AssetMeta): void {
    if (this.metas.has(meta.hash)) return;
    this.metas.set(meta.hash, meta);
    void this.d.cache.gravarMeta(meta);
  }

  private criarStatus(hash: string): Entrada {
    const meta = this.metas.get(hash);
    const st: Entrada = {
      hash,
      nome: meta?.nomeOriginal ?? hash.slice(0, 8),
      tipo: meta?.tipo ?? "?",
      estado: "pedindo",
      recebidos: 0,
      total: meta ? (meta.tiles?.length ?? meta.pedacos.length) : 0,
      ultimoPedaco: Date.now(),
      ultimaPergunta: 0,
    };
    this.status.set(hash, st);
    this.mudou();
    return st;
  }

  private async pedacosPresentes(hash: string): Promise<Set<number>> {
    let s = this.presentes.get(hash);
    if (!s) {
      s = await this.d.cache.pedacosPresentes(hash);
      this.presentes.set(hash, s);
    }
    return s;
  }

  /** Pergunta à sala (meta e pedaços). Com a meta no cache, só os pedaços que ainda faltam. */
  private async perguntar(hash: string): Promise<void> {
    const canal = this.d.canal();
    const st = this.status.get(hash);
    if (!canal?.conectado() || !st || this.estaPronto(hash)) return;
    const meta = this.metas.get(hash);
    let faltam: number[] | undefined;
    if (meta && !meta.tiles) {
      const ja = await this.pedacosPresentes(hash);
      const total = meta.pedacos.length;
      faltam = Array.from({ length: total }, (_, i) => i).filter((i) => !ja.has(i));
      st.recebidos = ja.size;
      st.total = total;
      if (faltam.length === 0) {
        await this.finalizar(hash);
        return;
      }
      if (ja.size > 0) st.estado = "baixando";
    }
    st.ultimaPergunta = Date.now();
    const id = canal.enviar("asset.pedir", faltam ? { hash, faltam } : { hash });
    if (id) this.pedidos.set(id, hash);
    this.mudou();
  }

  private async pedirDeNovo(hash: string, indice: number, st: Entrada): Promise<void> {
    const chave = `${hash}:${indice}`;
    const n = (this.tentativas.get(chave) ?? 0) + 1;
    this.tentativas.set(chave, n);
    if (n > TENTATIVAS_POR_PEDACO) {
      st.estado = "erro";
      st.mensagem = "Pedaço corrompido repetidamente";
      this.mudou();
      return;
    }
    const id = this.d.canal()?.enviar("asset.pedir", { hash, faltam: [indice] });
    if (id) this.pedidos.set(id, hash);
  }

  private async aoMeta(meta: AssetMeta): Promise<void> {
    this.metas.set(meta.hash, meta);
    await this.d.cache.gravarMeta(meta);
    const st = this.status.get(meta.hash) ?? this.criarStatus(meta.hash);
    st.nome = meta.nomeOriginal;
    st.tipo = meta.tipo;
    if (meta.tiles) {
      for (const t of meta.tiles) this.garantir(t.hash);
      this.atualizarManifesto(meta);
      return;
    }
    st.total = meta.pedacos.length;
    st.ultimoPedaco = Date.now();
    // O arquivo já estava no cache (veio decifrado do pré-envio): a meta só faltava para desenhar.
    if (this.completos.has(meta.hash)) {
      st.estado = "pronto";
      st.recebidos = meta.pedacos.length;
      this.aoFicarPronto(meta.hash);
      return;
    }
    this.mudou();
  }

  private atualizarManifesto(meta: AssetMeta): void {
    const st = this.status.get(meta.hash);
    if (!st || !meta.tiles) return;
    const prontos = meta.tiles.filter((t) => this.completos.has(t.hash)).length;
    st.nome = meta.nomeOriginal;
    st.tipo = meta.tipo;
    st.total = meta.tiles.length;
    st.recebidos = prontos;
    st.estado = prontos === meta.tiles.length ? "pronto" : "baixando";
    st.ultimoPedaco = Date.now();
    this.mudou();
  }

  private enfileirar(hash: string, tarefa: () => Promise<void>): void {
    const anterior = this.filas.get(hash) ?? Promise.resolve();
    const proxima = anterior.then(tarefa).catch((e) => console.error("Falha ao receber pedaço", e));
    this.filas.set(hash, proxima);
  }

  /** Todos os pedaços chegaram: monta, confere o hash inteiro, grava e avisa que tem. */
  private async finalizar(hash: string): Promise<void> {
    const meta = this.metas.get(hash);
    const st = this.status.get(hash);
    if (!meta || !st) return;
    const partes: Blob[] = [];
    for (let i = 0; i < meta.pedacos.length; i++) {
      const p = await this.d.cache.lerPedaco(hash, i);
      if (!p) {
        (await this.pedacosPresentes(hash)).delete(i);
        await this.perguntar(hash);
        return;
      }
      partes.push(p);
    }
    const bytes = new Uint8Array(await new Blob(partes).arrayBuffer());
    if (!(await arquivoConfere(meta, bytes))) {
      const n = (this.arquivosRefeitos.get(hash) ?? 0) + 1;
      this.arquivosRefeitos.set(hash, n);
      await this.d.cache.apagarPedacos(hash);
      this.presentes.set(hash, new Set());
      if (n > TENTATIVAS_DO_ARQUIVO) {
        st.estado = "erro";
        st.mensagem = "O arquivo não confere com o hash";
        this.mudou();
        return;
      }
      await this.perguntar(hash);
      return;
    }
    await this.d.cache.gravarArquivo(hash, bytes as BufferSource);
    await this.d.cache.apagarPedacos(hash);
    this.presentes.delete(hash);
    this.completos.add(hash);
    st.estado = "pronto";
    st.recebidos = st.total = meta.pedacos.length;
    this.d.canal()?.enviar("asset.tenho", { hash });
    this.aoFicarPronto(hash);
    void this.copiarSePreciso(meta);
    void this.guardarNaPasta(hash);
  }

  private aoFicarPronto(hash: string): void {
    for (const m of this.metas.values()) {
      if (m.tiles?.some((t) => t.hash === hash)) this.atualizarManifesto(m);
    }
    this.mudou();
    this.prontosMudaram();
  }

  /** Quem espera há tempo demais pergunta de novo (a sala pode ter hibernado e perdido o pedido). */
  private vigiar(): void {
    const canal = this.d.canal();
    if (!canal?.conectado()) return;
    const agora = Date.now();
    for (const [hash, st] of this.status) {
      const parado = agora - Math.max(st.ultimoPedaco, st.ultimaPergunta);
      const andando = st.estado === "pedindo" || st.estado === "baixando";
      const meta = this.metas.get(hash);
      if (meta?.tiles) continue; // os tiles perguntam por si
      if (andando && parado > PARADO_MS) void this.perguntar(hash);
      else if (
        (st.estado === "indisponivel" || st.estado === "erro") &&
        agora - st.ultimaPergunta > REPERGUNTAR_MS
      ) {
        void this.perguntar(hash);
      }
    }
  }

  // --- servir ---------------------------------------------------------------------------------

  /** A sala me escolheu: leio do OPFS e envio os pedaços pedidos, sem inundar o socket. */
  private async servir(hash: string, indices: number[]): Promise<void> {
    const canal = this.d.canal();
    if (!canal) return;
    const arquivo = await this.d.cache.lerArquivo(hash);
    if (!arquivo) {
      this.completos.delete(hash);
      canal.enviar("asset.naoTenho", { hash });
      return;
    }
    const total = totalDePedacos(arquivo.size);
    for (const indice of indices) {
      if (indice >= total) continue;
      const ganchos = this.d.ganchos();
      if (ganchos?.atrasoPorPedacoMs) await dormir(ganchos.atrasoPorPedacoMs);
      const dados = new Uint8Array(
        await arquivo.slice(indice * TAMANHO_PEDACO, (indice + 1) * TAMANHO_PEDACO).arrayBuffer(),
      );
      if (ganchos?.corromperIndice === indice) {
        const chave = `${hash}:${indice}`;
        const feitas = this.corrompidosEnviados.get(chave) ?? 0;
        if (feitas < (ganchos.corromperVezes ?? 1)) {
          this.corrompidosEnviados.set(chave, feitas + 1);
          dados[0] = (dados[0] ?? 0) ^ 0xff;
        }
      }
      while (canal.conectado() && canal.bufferizado() > BUFFER_MAXIMO) await dormir(10);
      if (!canal.enviarBinario(montarFrameDePedaco({ hash, indice, total, dados }))) return;
    }
  }

  // --- pré-envio cifrado de cenas (PROJETO.md, Lote 4) ---------------------------------------

  /**
   * No mestre: cifra cada arquivo (AES-GCM, chave e IV novos), guarda o cifrado no cache e o
   * registra como asset `cifrado` (sem nome nem dimensões reais). Devolve os pacotes para a
   * intenção `cena.preparar` (as chaves só vão à sala).
   */
  async cifrarParaPreparo(hashes: string[]): Promise<Pacote[]> {
    const canal = this.d.canal();
    if (!canal?.conectado()) throw new Error("Sem conexão com a sala.");
    const pacotes: Pacote[] = [];
    const metas: MetaNova[] = [];
    for (const hashOriginal of hashes) {
      const arquivo = await this.d.cache.lerArquivo(hashOriginal);
      if (!arquivo)
        throw new Error(
          "Um arquivo da cena não está neste navegador (escolha-o de novo na Biblioteca).",
        );
      const { cifrado, chave } = await cifrar(new Uint8Array(await arquivo.arrayBuffer()));
      const meta = await metaDoCifrado(cifrado);
      await this.d.cache.gravarArquivo(meta.hash, cifrado as BufferSource);
      this.completos.add(meta.hash);
      await this.guardarMeta({ ...meta, donoId: this.d.meuId });
      metas.push(meta);
      pacotes.push({ hashCifrado: meta.hash, hashOriginal, chave });
    }
    for (let i = 0; i < metas.length; i += LIMITES_DE_ASSET.metasPorRegistro) {
      const lote = metas.slice(i, i + LIMITES_DE_ASSET.metasPorRegistro);
      if (canal.enviar("asset.registrar", { metas: lote }) === null) {
        throw new Error("Sem conexão com a sala.");
      }
      for (const m of lote) canal.enviar("asset.tenho", { hash: m.hash });
    }
    this.persistir();
    this.mudou();
    return pacotes;
  }

  /**
   * O grupo foi para a cena: abre o que já baixei cifrado. Marca os originais como "em decifração"
   * na hora (o snapshot chega logo depois e não pode pedi-los pela rede); o que não chegou a
   * baixar, ou não confere, segue pelo caminho normal.
   */
  private aoChaves(pacotes: Pacote[]): void {
    const feitos = pacotes.filter(
      (p) => this.completos.has(p.hashCifrado) && !this.completos.has(p.hashOriginal),
    );
    for (const p of feitos) this.decifrando.add(p.hashOriginal);
    void this.decifrarPacotes(pacotes);
  }

  private async decifrarPacotes(pacotes: Pacote[]): Promise<void> {
    for (const p of pacotes) {
      try {
        if (this.completos.has(p.hashCifrado)) {
          if (!this.completos.has(p.hashOriginal)) await this.abrirPacote(p);
          await this.descartarCifrado(p.hashCifrado);
        }
      } catch (e) {
        console.error("Falha ao decifrar o pré-envio", e);
      } finally {
        this.decifrando.delete(p.hashOriginal);
      }
      // Não abriu (não baixou, chave ou conteúdo não conferem): o caminho normal pede o original.
      if (!this.completos.has(p.hashOriginal)) this.garantir(p.hashOriginal);
    }
    this.mudou();
    this.prontosMudaram();
  }

  private async abrirPacote(p: Pacote): Promise<void> {
    const arquivo = await this.d.cache.lerArquivo(p.hashCifrado);
    if (!arquivo) return;
    const claro = await decifrarEConferir(
      new Uint8Array(await arquivo.arrayBuffer()),
      p.chave,
      p.hashOriginal,
    );
    if (!claro) return;
    await this.d.cache.gravarArquivo(p.hashOriginal, claro as BufferSource);
    this.completos.add(p.hashOriginal);
    const canal = this.d.canal();
    canal?.enviar("asset.tenho", { hash: p.hashOriginal });
    // Falta só a meta (largura, altura, tiles) para desenhar; sem pedaços ("faltam" vazio).
    if (this.metas.has(p.hashOriginal)) this.aoFicarPronto(p.hashOriginal);
    else canal?.enviar("asset.pedir", { hash: p.hashOriginal, faltam: [] });
  }

  private async descartarCifrado(hash: string): Promise<void> {
    this.completos.delete(hash);
    this.status.delete(hash);
    await this.d.cache.apagarArquivo(hash);
    this.d.canal()?.enviar("asset.naoTenho", { hash });
  }

  // --- usar um arquivo do usuário -------------------------------------------------------------

  /**
   * Processa (WebP, tiles), guarda no cache, registra na sala e avisa que tenho. Um arquivo já
   * processado antes é reconhecido pelo hash do original (índice local), mesmo se foi renomeado.
   * Devolve o hash que a cena ou o token vão usar.
   */
  async usarArquivo(arquivo: File, tipo: "mapa" | "token" | "retrato"): Promise<string> {
    const canal = this.d.canal();
    if (!canal?.conectado()) throw new Error("Sem conexão com a sala.");
    const limite = this.limiteDeTile();
    const hashOriginal = await this.d.processador.hashDoArquivo(arquivo);
    const chave = indiceLocal.chave(hashOriginal, tipo, limite);
    const conhecido = await indiceLocal.ler(chave);
    let metas: MetaNova[] | null = null;
    let principal = conhecido?.assetHash ?? "";
    if (conhecido && this.estaPronto(conhecido.assetHash)) {
      const m = this.metas.get(conhecido.assetHash);
      if (m) {
        const tiles = (m.tiles ?? []).flatMap((t) => {
          const meta = this.metas.get(t.hash);
          return meta ? [semDono(meta)] : [];
        });
        metas = [...tiles, semDono(m)];
      }
    }
    if (!metas) {
      const nome = arquivo.name.slice(0, 200) || "imagem";
      const r = await this.d.processador.processar(arquivo, tipo, limite, nome);
      metas = [];
      for (const { meta, bytes } of r.itens) {
        await this.d.cache.gravarArquivo(meta.hash, bytes as BufferSource);
        this.completos.add(meta.hash);
        await this.guardarMeta({ ...meta, donoId: this.d.meuId });
        void this.guardarNaPasta(meta.hash);
        metas.push(meta);
      }
      if (r.manifesto) {
        await this.guardarMeta({ ...r.manifesto, donoId: this.d.meuId });
        metas.push(r.manifesto);
      }
      principal = r.principal;
      await indiceLocal.gravar(chave, { assetHash: principal, nome: arquivo.name });
    }
    this.persistir();
    if (canal.enviar("asset.registrar", { metas }) === null)
      throw new Error("Sem conexão com a sala.");
    for (const m of metas) if (!m.tiles) canal.enviar("asset.tenho", { hash: m.hash });
    this.mudou();
    this.prontosMudaram();
    return principal;
  }

  /**
   * Q3: importa um mapa do Dungeondraft (Universal VTT). O worker lê o arquivo e decodifica a imagem; a imagem entra pelo mesmo
   * caminho do botão de subir o mapa (`usarArquivo`: tiles, cifra, cópia na pasta da mesa). Devolve o hash do mapa, a cena
   * convertida (para a intenção `cena.importarMapa`) e a imagem (para a cópia em `mapas/`). Lança com o motivo se não serve.
   */
  async lerMapaUniversalVtt(
    arquivo: File,
  ): Promise<{ hash: string; importacao: ImportacaoDeMapa; imagem: File; ms: number }> {
    const idDaCena = `cena-${crypto.randomUUID().slice(0, 8)}`;
    const nome = nomeDaCenaDoArquivo(arquivo.name);
    const lido = await this.d.processador.lerUniversalVtt(arquivo, nome, idDaCena);
    const imagem = new File([lido.imagem], `${nome}.${lido.extensao}`, { type: lido.imagem.type });
    const hash = await this.usarArquivo(imagem, "mapa");
    return { hash, importacao: lido.importacao, imagem, ms: lido.ms };
  }

  /**
   * Compêndio de magias (Lote 14), só no mestre: guarda o `magias.json` já validado no cache, registra
   * como asset `compendio` (só a meta vai para a sala; os bytes saem por pedaços, quando alguém pedir) e
   * avisa que tenho. Devolve o hash. O mesmo arquivo registrado de novo dá o mesmo hash.
   */
  async registrarCompendio(bytes: Uint8Array, nomeOriginal: string): Promise<string> {
    const canal = this.d.canal();
    if (!canal?.conectado()) throw new Error("Sem conexão com a sala.");
    const hash = await sha256Hex(bytes);
    const meta: MetaNova = {
      hash,
      tipo: "compendio",
      mime: "application/json",
      bytes: bytes.length,
      largura: 1,
      altura: 1,
      nomeOriginal: nomeOriginal.slice(0, 200) || "magias.json",
      pedacos: await hashesDosPedacos(dividirEmPedacos(bytes)),
    };
    if (!this.completos.has(hash)) {
      await this.d.cache.gravarArquivo(hash, bytes as BufferSource);
      this.completos.add(hash);
    }
    void this.guardarNaPasta(hash);
    await this.guardarMeta({ ...meta, donoId: this.d.meuId });
    this.persistir();
    if (canal.enviar("asset.registrar", { metas: [meta] }) === null) {
      throw new Error("Sem conexão com a sala.");
    }
    canal.enviar("asset.tenho", { hash });
    this.mudou();
    return hash;
  }

  /**
   * Som ambiente (N5), só no mestre: confere o formato (mp3, ogg ou wav) e o tamanho (até 20 MB), guarda no cache,
   * registra como asset `som` (a sala só recebe a meta; os bytes saem por pedaços, quando alguém pedir) e avisa que
   * tenho. Devolve o hash e o nome. O mesmo arquivo registrado de novo dá o mesmo hash.
   */
  async registrarSom(arquivo: File): Promise<{ hash: string; nome: string }> {
    const canal = this.d.canal();
    if (!canal?.conectado()) throw new Error("Sem conexão com a sala.");
    const mime = mimeDeSomValido(arquivo.type) ? arquivo.type : mimeDoSomPeloNome(arquivo.name);
    if (mime === null || !mimeDeSomValido(mime)) throw new Error("Só mp3, ogg e wav.");
    if (arquivo.size <= 0) throw new Error("O arquivo está vazio.");
    if (arquivo.size > LIMITES_DE_ASSET.bytesDoSom)
      throw new Error("Som grande demais (até 20 MB).");
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const hash = await sha256Hex(bytes);
    const nome = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Som";
    const meta: MetaNova = {
      hash,
      tipo: "som",
      mime,
      bytes: bytes.length,
      largura: 1,
      altura: 1,
      nomeOriginal: arquivo.name.slice(0, 200) || "som",
      pedacos: await hashesDosPedacos(dividirEmPedacos(bytes)),
    };
    if (!this.completos.has(hash)) {
      await this.d.cache.gravarArquivo(hash, bytes as BufferSource);
      this.completos.add(hash);
    }
    void this.guardarNaPasta(hash);
    await this.guardarMeta({ ...meta, donoId: this.d.meuId });
    this.persistir();
    if (canal.enviar("asset.registrar", { metas: [meta] }) === null) {
      throw new Error("Sem conexão com a sala.");
    }
    canal.enviar("asset.tenho", { hash });
    this.mudou();
    this.prontosMudaram();
    return { hash, nome };
  }

  /**
   * FG1, só no mestre: registra uma animação de chama (gif, webp animado ou apng) como asset `animacao`, sem processar
   * (o arquivo vai como veio, até 4 MB). Mesmo caminho do som: cache, pasta da mesa, meta na sala e bytes sob demanda.
   */
  async registrarAnimacao(arquivo: File): Promise<{ hash: string; nome: string }> {
    const canal = this.d.canal();
    if (!canal?.conectado()) throw new Error("Sem conexão com a sala.");
    if (arquivo.size <= 0) throw new Error("O arquivo está vazio.");
    if (arquivo.size > LIMITES_DE_ASSET.bytesDaAnimacao)
      throw new Error("Animação grande demais (até 4 MB).");
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const mime = detectarFormato(bytes)?.mime;
    if (mime === undefined || !mimeDeAnimacaoValido(mime)) throw new Error("Só gif, webp ou apng.");
    const hash = await sha256Hex(bytes);
    const nome = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Animação";
    const meta: MetaNova = {
      hash,
      tipo: "animacao",
      mime,
      bytes: bytes.length,
      largura: 1,
      altura: 1,
      nomeOriginal: arquivo.name.slice(0, 200) || "animacao",
      pedacos: await hashesDosPedacos(dividirEmPedacos(bytes)),
    };
    if (!this.completos.has(hash)) {
      await this.d.cache.gravarArquivo(hash, bytes as BufferSource);
      this.completos.add(hash);
    }
    void this.guardarNaPasta(hash);
    await this.guardarMeta({ ...meta, donoId: this.d.meuId });
    this.persistir();
    if (canal.enviar("asset.registrar", { metas: [meta] }) === null) {
      throw new Error("Sem conexão com a sala.");
    }
    canal.enviar("asset.tenho", { hash });
    this.mudou();
    this.prontosMudaram();
    return { hash, nome };
  }

  // --- a cópia na pasta da mesa (Q1) ---------------------------------------------------------

  private readonly naPasta = new Set<string>();
  private sincronizando: Promise<void> | null = null;

  /**
   * Só no mestre, com a pasta liberada para escrita: copia o arquivo do cache para `arquivos-da-mesa/<hash>`. Assim a
   * pasta guarda tudo o que a mesa usa e outro navegador do mesmo computador carrega dela, sem o primeiro estar online.
   * Nunca derruba nada: sem pasta ou com erro, o cache segue valendo.
   */
  async guardarNaPasta(hash: string): Promise<void> {
    if (!this.d.euMestre() || this.naPasta.has(hash) || !this.completos.has(hash)) return;
    const pasta = this.d.pastaDosArquivos();
    if (!pasta?.podeGravar) return;
    try {
      const arquivo = await this.d.cache.lerArquivo(hash);
      if (!arquivo) return;
      await pasta.gravar([PASTA_DOS_ARQUIVOS_DA_MESA], hash, arquivo);
      this.naPasta.add(hash);
    } catch (e) {
      console.warn("Não consegui guardar o arquivo na pasta da mesa", e);
    }
  }

  /**
   * Só no mestre, com a pasta liberada (ao abrir a mesa, ao escolher ou reautorizar a pasta e quando chegam metas
   * novas): traz da pasta o que a mesa usa e este navegador não tem (confere o hash de cada um) e leva para a pasta o
   * que o cache tem e ela não. `metas` são as metas da mesa que este navegador deve ter.
   */
  sincronizarComAPasta(metas: readonly AssetMeta[]): Promise<void> {
    if (!this.d.euMestre() || !this.d.pastaDosArquivos()) return Promise.resolve();
    const anterior = this.sincronizando ?? Promise.resolve();
    const atual = anterior
      .then(() => this.sincronizar(metas))
      .catch((e) => console.warn("Não consegui sincronizar com a pasta da mesa", e));
    this.sincronizando = atual;
    return atual;
  }

  private async sincronizar(metas: readonly AssetMeta[]): Promise<void> {
    const pasta = this.d.pastaDosArquivos();
    if (!pasta) return;
    for (const meta of metas) {
      if (this.completos.has(meta.hash) || meta.tiles) continue;
      const arquivo = await pasta.abrirPorCaminho([PASTA_DOS_ARQUIVOS_DA_MESA, meta.hash]);
      if (!arquivo) continue;
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      if (!(await arquivoConfere(meta, bytes))) continue; // arquivo estranho na pasta: ignora
      this.metas.set(meta.hash, meta);
      await this.d.cache.gravarMeta(meta);
      await this.d.cache.gravarArquivo(meta.hash, bytes as BufferSource);
      this.completos.add(meta.hash);
      this.naPasta.add(meta.hash);
      const st = this.status.get(meta.hash);
      if (st) {
        st.estado = "pronto";
        delete st.mensagem;
        st.recebidos = st.total = meta.pedacos.length;
      }
      this.d.canal()?.enviar("asset.tenho", { hash: meta.hash });
      this.aoFicarPronto(meta.hash);
    }
    for (const hash of [...this.completos]) await this.guardarNaPasta(hash);
  }

  /** O texto de um arquivo que já está no cache (o compêndio); `null` se ainda não chegou. */
  async textoDe(hash: string): Promise<string | null> {
    if (!this.completos.has(hash)) return null;
    const arquivo = await this.d.cache.lerArquivo(hash);
    return arquivo ? arquivo.text() : null;
  }

  /** O estado da transferência deste asset (para a aba mostrar "recebendo" ou "indisponível"). */
  statusDe(hash: string): StatusDeAsset | undefined {
    const s = this.status.get(hash);
    if (!s) return undefined;
    const { ultimoPedaco: _u, ultimaPergunta: _p, ...resto } = s;
    return resto;
  }

  private async guardarMeta(meta: AssetMeta): Promise<void> {
    this.metas.set(meta.hash, meta);
    await this.d.cache.gravarMeta(meta);
  }

  /** Pede ao navegador para não apagar o cache quando faltar espaço (ao adicionar o primeiro asset). */
  private persistir(): void {
    if (this.persistiu) return;
    this.persistiu = true;
    void navigator.storage?.persist?.().catch(() => {});
  }

  // --- cópia para o mestre --------------------------------------------------------------------

  /** No mestre: grava em `recebidos/<jogador>/` da pasta o que um jogador subiu (se há pasta com escrita). */
  async copiarSePreciso(meta: AssetMeta): Promise<void> {
    if (!this.d.euMestre() || meta.donoId === this.d.meuId || meta.tiles) return;
    // O compêndio de magias (texto) não é imagem de jogador: não vai para recebidos/.
    if (meta.tipo === "compendio") return;
    if (this.copiados.has(meta.hash) || !this.completos.has(meta.hash)) return;
    const destino = this.d.destinoDeCopia();
    if (!destino?.podeGravar) return;
    const arquivo = await this.d.cache.lerArquivo(meta.hash);
    if (!arquivo) return;
    const jogador = nomeSeguro(this.d.nomeDoUsuario(meta.donoId) ?? meta.donoId);
    const base = nomeSeguro(meta.nomeOriginal.replace(/\.[^.]+$/, ""));
    try {
      await destino.gravar(
        ["recebidos", jogador],
        `${base}-${meta.hash.slice(0, 8)}.webp`,
        arquivo,
      );
      this.copiados.add(meta.hash);
    } catch (e) {
      console.warn("Não consegui copiar para recebidos/", e);
    }
  }
}
