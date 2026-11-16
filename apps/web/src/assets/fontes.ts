import { ARQUIVOS_DO_COMPENDIO, PASTA_DO_COMPENDIO } from "@tabletop/shared";
import {
  type ArquivoDaFonte,
  ArquivosSoltos,
  type FonteDeAssets,
  Memoria,
  PastaLocal,
} from "./fonte";

export type EstadoDaPasta = "nenhuma" | "autorizada" | "reautorizar" | "negada";

/**
 * As fontes de arquivos deste navegador: a pasta lembrada (quando o navegador deixa), os arquivos
 * soltos e, nos testes (modo `e2e`), uma `Memoria` que faz o papel da pasta com escrita.
 */
export class Fontes {
  readonly soltos = new ArquivosSoltos();
  readonly memoria: Memoria | null = import.meta.env.MODE === "e2e" ? new Memoria() : null;
  private pasta: PastaLocal | null = null;

  /** `mesaId`: a pasta escolhida é por mesa; `legada`: a mesa herda a pasta de antes do C1. */
  constructor(
    private readonly mesaId: string,
    private readonly legada: boolean,
  ) {}
  private estadoDaPasta: EstadoDaPasta = "nenhuma";
  private versao = 0;
  private readonly ouvintes = new Set<() => void>();

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

  get estado(): EstadoDaPasta {
    return this.simulacao ?? this.estadoDaPasta;
  }
  get nomeDaPasta(): string | null {
    if (this.simulacao !== null && this.simulacao !== "nenhuma") return "pasta-de-teste";
    return this.pasta?.nome ?? null;
  }

  /** Só nos testes e2e: a `Memoria` faz o papel da pasta, com o estado que o teste mandar (nenhuma, reautorizar, autorizada). */
  private simulacao: EstadoDaPasta | null = null;
  simularPasta(estado: EstadoDaPasta | null): void {
    if (this.memoria === null) return;
    this.simulacao = estado;
    this.mudou();
  }

  /** Q1: onde o mestre guarda uma cópia de cada arquivo da mesa (`arquivos-da-mesa/`): a pasta autorizada ou, nos testes, a simulada. */
  pastaDosArquivos(): FonteDeAssets | null {
    if (this.simulacao !== null) return this.simulacao === "autorizada" ? this.memoria : null;
    return this.pastaGravavel();
  }

  /** Recupera a pasta de uma visita anterior. A permissão pode exigir um clique (reautorizar). */
  async iniciar(): Promise<void> {
    try {
      this.pasta = await PastaLocal.lembrada(this.mesaId, this.legada);
    } catch {
      this.pasta = null;
    }
    await this.conferirPermissao();
  }

  private async conferirPermissao(): Promise<void> {
    if (!this.pasta) this.estadoDaPasta = "nenhuma";
    else {
      const p = await this.pasta.permissao();
      this.estadoDaPasta =
        p === "granted" ? "autorizada" : p === "prompt" ? "reautorizar" : "negada";
    }
    this.mudou();
  }

  async escolherPasta(): Promise<void> {
    // nos testes não há seletor de verdade: escolher é a pasta simulada ficar autorizada
    if (this.memoria !== null) {
      this.simularPasta("autorizada");
      return;
    }
    this.pasta = await PastaLocal.escolher(this.mesaId);
    await this.conferirPermissao();
  }

  /** Precisa ser chamado direto de um clique: o navegador exige gesto do usuário. */
  async reautorizar(): Promise<boolean> {
    if (this.simulacao !== null) {
      this.simularPasta("autorizada");
      return true;
    }
    const ok = (await this.pasta?.autorizar()) ?? false;
    await this.conferirPermissao();
    return ok;
  }

  /** Onde gravar `recebidos/<jogador>/` (só o mestre usa): a pasta com escrita, ou a memória nos testes. */
  destinoDeCopia(): FonteDeAssets | null {
    if (this.pasta && this.estadoDaPasta === "autorizada") return this.pasta;
    return this.memoria;
  }

  /** A pasta local, se autorizada para escrita (nunca a memória dos testes): a ficha exportada vai para `fichas/`. */
  pastaGravavel(): FonteDeAssets | null {
    return this.pasta && this.estadoDaPasta === "autorizada" ? this.pasta : null;
  }

  /** Só nos testes e2e: faz a `Memoria` valer como a pasta local com escrita (o "Usar o exemplo" grava nela). */
  private memoriaComoPasta = false;
  definirMemoriaComoPasta(valor: boolean): void {
    this.memoriaComoPasta = valor && this.memoria !== null;
  }

  /** Onde "Usar o exemplo" grava o `compendio/magias.json`: a pasta local autorizada (ou, nos testes, a memória). */
  pastaDoCompendio(): FonteDeAssets | null {
    return this.pastaGravavel() ?? (this.memoriaComoPasta ? this.memoria : null);
  }

  /** Arquivos do compêndio escolhidos à mão (para quem não tem seletor de pasta); valem até recarregar a página. */
  private compendiosSoltos: File[] = [];

  /**
   * Os arquivos de `compendio/` do mestre (N3a: `compendio.json`, `magias.json`, `monstros.json` e `itens.json`, os que
   * existirem, nessa ordem): da pasta (se autorizada), da memória dos testes ou escolhidos à mão. Nenhum: lista vazia.
   */
  async abrirArquivosDoCompendio(): Promise<File[]> {
    const achados: File[] = [];
    for (const nome of ARQUIVOS_DO_COMPENDIO) {
      const caminho = [PASTA_DO_COMPENDIO, nome];
      let f: File | null = null;
      if (this.pasta && this.estadoDaPasta === "autorizada") {
        f = await this.pasta.abrirPorCaminho(caminho);
      }
      // simulando a pasta (testes): a memória só vale com ela autorizada
      if (this.simulacao === null || this.simulacao === "autorizada") {
        f ??= (await this.memoria?.abrirPorCaminho(caminho)) ?? null;
      }
      if (f) achados.push(f);
    }
    return achados.length > 0 ? achados : [...this.compendiosSoltos];
  }

  /** "Usar o exemplo" sem pasta: o arquivo vale sozinho até recarregar a página. */
  escolherCompendioSolto(arquivo: File): void {
    this.compendiosSoltos = [arquivo];
    this.mudou();
  }

  /** Sem pasta, "Carregar arquivos" soma os arquivos aos que já estavam soltos. */
  adicionarCompendiosSoltos(arquivos: readonly File[]): void {
    this.compendiosSoltos = [...this.compendiosSoltos, ...arquivos];
    this.mudou();
  }

  /** Avisa quem observa as fontes que algo mudou (o gancho de teste usa ao pôr um arquivo na pasta). */
  notificar(): void {
    this.mudou();
  }

  /** Imagens que o usuário pode usar agora: da pasta (se autorizada), soltas e da memória. */
  async listar(): Promise<ArquivoDaFonte[]> {
    const listas: ArquivoDaFonte[][] = [];
    if (this.pasta && this.estadoDaPasta === "autorizada") {
      try {
        listas.push(await this.pasta.listar());
      } catch {
        // pasta sumiu ou perdeu a permissão: fica só o resto
      }
    }
    listas.push(await this.soltos.listar());
    if (this.memoria) listas.push(await this.memoria.listar());
    return listas.flat();
  }

  /** Sons escolhidos à mão nesta sessão (para quem não tem seletor de pasta, ou escolhe um arquivo fora dela). */
  private sonsSoltos: File[] = [];

  /** N5: os sons que o mestre pode usar agora: os da pasta (se autorizada) e os escolhidos à mão. */
  async listarSons(): Promise<ArquivoDaFonte[]> {
    const lista: ArquivoDaFonte[] = [];
    if (this.pasta && this.estadoDaPasta === "autorizada") {
      try {
        lista.push(...(await this.pasta.listarSons()));
      } catch {
        // pasta sumiu ou perdeu a permissão: ficam só os escolhidos à mão
      }
    }
    for (const f of this.sonsSoltos) {
      lista.push({
        id: `som-solto:${f.name}:${f.size}:${f.lastModified}`,
        nome: f.name,
        caminho: f.name,
        tamanho: f.size,
        abrir: async () => f,
      });
    }
    return lista.sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"));
  }

  /** Guarda um som escolhido à mão (sem repetir o mesmo arquivo) e avisa quem observa. */
  adicionarSomSolto(arquivo: File): void {
    const igual = this.sonsSoltos.some(
      (a) =>
        a.name === arquivo.name &&
        a.size === arquivo.size &&
        a.lastModified === arquivo.lastModified,
    );
    if (!igual) this.sonsSoltos = [...this.sonsSoltos, arquivo];
    this.mudou();
  }

  adicionarSoltos(arquivos: Iterable<File>): void {
    this.soltos.adicionar(arquivos);
    this.mudou();
  }
}
