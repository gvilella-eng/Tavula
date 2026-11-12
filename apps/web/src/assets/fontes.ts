import { CAMINHO_DO_COMPENDIO } from "@tabletop/shared";
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
    return this.estadoDaPasta;
  }
  get nomeDaPasta(): string | null {
    return this.pasta?.nome ?? null;
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
    this.pasta = await PastaLocal.escolher(this.mesaId);
    await this.conferirPermissao();
  }

  /** Precisa ser chamado direto de um clique: o navegador exige gesto do usuário. */
  async reautorizar(): Promise<boolean> {
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

  /** Um arquivo do compêndio escolhido à mão (para quem não tem seletor de pasta); vale até recarregar a página. */
  private compendioSolto: File | null = null;

  /** O arquivo `compendio/magias.json` do mestre: da pasta (se autorizada), da memória dos testes ou escolhido à mão. */
  async abrirCompendio(): Promise<File | null> {
    const caminho = CAMINHO_DO_COMPENDIO;
    if (this.pasta && this.estadoDaPasta === "autorizada") {
      const f = await this.pasta.abrirPorCaminho(caminho);
      if (f) return f;
    }
    const daMemoria = await this.memoria?.abrirPorCaminho(caminho);
    if (daMemoria) return daMemoria;
    return this.compendioSolto;
  }

  escolherCompendioSolto(arquivo: File): void {
    this.compendioSolto = arquivo;
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

  adicionarSoltos(arquivos: Iterable<File>): void {
    this.soltos.adicionar(arquivos);
    this.mudou();
  }
}
