import {
  type AssetMeta,
  arquivoConfere,
  LIMITES_DE_ASSET,
  lerFrameDePedaco,
  limiteDeTextura,
  type MensagemDaSala,
  type MetaNova,
  montarFrameDePedaco,
  pedacoConfere,
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
  ganchos: () => GanchosE2E | undefined;
};

type Entrada = StatusDeAsset & { ultimoPedaco: number; ultimaPergunta: number };

/** Folga do `bufferedAmount` do socket antes de mandar o próximo pedaço (não inundar). */
const BUFFER_MAXIMO = 1024 * 1024;
const TENTATIVAS_POR_PEDACO = 5;
const TENTATIVAS_DO_ARQUIVO = 3;
const PARADO_MS = 20_000;
const REPERGUNTAR_MS = 30_000;

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
    if (m.tipo === "asset.meta") void this.aoMeta(m.dados.meta);
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
    if (this.estaPronto(hash)) return;
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
