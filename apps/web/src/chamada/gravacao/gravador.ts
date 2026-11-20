import {
  ARQUIVOS_DA_GRAVACAO,
  type EventoGravado,
  escreverWav,
  type GravacaoJson,
  nomeDaPastaDaGravacao,
  nomeDoArquivoDoTrecho,
  PASTA_DAS_GRAVACOES,
  type PessoaGravada,
  pastaDaPessoa,
  pcm16DeFloat,
} from "@tabletop/shared";
import type { FonteDeAssets } from "../../assets/fonte";
import type { Captura } from "./captura";
import { DetectorDeFala, type OpcoesDoDetector, type Trecho } from "./detectorDeFala";

// CH3: o gravador da sessão, no navegador do mestre. Para cada voz (a do próprio microfone e a de cada pessoa que chega pela
// chamada) um detector de fala corta só os trechos com fala; cada trecho vira um WAV (16 kHz, mono, 16 bits) em
// `gravacoes/<AAAA-MM-DD_HHhMM>/<pessoa>/<inicio-em-ms>.wav`. Escreve aos poucos (cada trecho assim que fecha; o
// `gravacao.json` e o `eventos.jsonl` a cada poucos segundos), para que uma queda não perca a sessão. Quem ficou de fora
// ("Não gravar a minha voz") não é escutado: a captura dessa voz nem é ligada. Nada roda no computador dos jogadores.

export type PessoaNaGravacao = {
  usuarioId: string;
  nome: string;
  personagem?: string | undefined;
  /** O áudio dela (o do meu microfone, ou o recebido pela chamada). */
  fluxo: MediaStream | null;
  naoGravar: boolean;
};

export type EstadoDoGravador = {
  fase: "parada" | "gravando";
  /** `gravacoes/<pasta>`: onde está a gravação (também depois de parar). */
  pasta: string | null;
  trechos: number;
  /** Uma escrita falhou (a pasta perdeu a permissão, o disco encheu...): a gravação segue, mas diz. */
  erro: string | null;
  inicioMs: number | null;
};

type Opcoes = {
  pasta: FonteDeAssets;
  captura: Captura;
  agora?: () => number;
  mesaNome?: string;
  opcoesDoDetector?: Partial<OpcoesDoDetector>;
  /** Quanto tempo entre as gravações do `gravacao.json` e do `eventos.jsonl` (ms). */
  intervaloDeGravacaoMs?: number;
};

type Voz = {
  pessoa: PessoaGravada;
  detector: DetectorDeFala | null;
  fluxo: MediaStream | null;
};

const INTERVALO_PADRAO_MS = 3000;

export class GravadorDaSessao {
  estado: EstadoDoGravador = {
    fase: "parada",
    pasta: null,
    trechos: 0,
    erro: null,
    inicioMs: null,
  };
  private readonly ouvintes = new Set<() => void>();
  private readonly agora: () => number;
  private readonly vozes = new Map<string, Voz>();
  private readonly pastasUsadas = new Set<string>();
  private dados: GravacaoJson | null = null;
  private eventos: EventoGravado[] = [];
  private eventosSujos = false;
  private dadosSujos = false;
  private nomeDaPasta = "";
  private fila: Promise<void> = Promise.resolve();
  private relogio: ReturnType<typeof setInterval> | undefined;
  private jaNaChamada = new Set<string>();

  constructor(private readonly o: Opcoes) {
    this.agora = o.agora ?? Date.now;
  }

  readonly assinar = (fn: () => void): (() => void) => {
    this.ouvintes.add(fn);
    return () => {
      this.ouvintes.delete(fn);
    };
  };
  readonly lerEstado = (): EstadoDoGravador => this.estado;

  private mudar(parcial: Partial<EstadoDoGravador>): void {
    this.estado = { ...this.estado, ...parcial };
    for (const fn of this.ouvintes) fn();
  }

  get gravando(): boolean {
    return this.estado.fase === "gravando";
  }

  /** Começa: cria a pasta da gravação, grava `gravacao.json` e `nomes.txt` e passa a escutar. */
  async iniciar(nomesTxt: string): Promise<void> {
    if (this.gravando) return;
    const inicio = new Date(this.agora());
    this.nomeDaPasta = nomeDaPastaDaGravacao(inicio);
    // Duas gravações no mesmo minuto não se misturam: a segunda ganha um sufixo.
    const existentes = await this.o.pasta.listarPasta([PASTA_DAS_GRAVACOES]).catch(() => []);
    const nomes = new Set(existentes.map((e) => e.nome));
    if (nomes.has(this.nomeDaPasta)) {
      let n = 2;
      while (nomes.has(`${this.nomeDaPasta}-${n}`)) n++;
      this.nomeDaPasta = `${this.nomeDaPasta}-${n}`;
    }
    this.vozes.clear();
    this.pastasUsadas.clear();
    this.jaNaChamada = new Set();
    this.eventos = [];
    this.dados = {
      versao: 1,
      inicioEpochMs: inicio.getTime(),
      inicioLocal: `${nomeDaPastaDaGravacao(inicio).replace("_", " ").replace("h", ":")}`,
      fusoMin: inicio.getTimezoneOffset(),
      ...(this.o.mesaNome ? { mesaNome: this.o.mesaNome } : {}),
      pessoas: [],
      foraDaGravacao: [],
      entradas: [],
    };
    this.mudar({
      fase: "gravando",
      pasta: `${PASTA_DAS_GRAVACOES}/${this.nomeDaPasta}`,
      trechos: 0,
      erro: null,
      inicioMs: inicio.getTime(),
    });
    this.escrever([], ARQUIVOS_DA_GRAVACAO.nomes, nomesTxt);
    this.dadosSujos = true;
    this.eventosSujos = true;
    this.gravarDados();
    this.gravarEventos();
    this.relogio = setInterval(() => {
      this.gravarDados();
      this.gravarEventos();
    }, this.o.intervaloDeGravacaoMs ?? INTERVALO_PADRAO_MS);
  }

  /** Diz quem está na chamada agora (e o fluxo de cada um): liga, troca ou solta a escuta de cada voz. */
  sincronizar(pessoas: readonly PessoaNaGravacao[]): void {
    if (!this.gravando || !this.dados) return;
    const ms = this.agora() - this.dados.inicioEpochMs;
    const presentes = new Set(pessoas.map((p) => p.usuarioId));
    // Quem saiu: fecha o trecho em curso (a fala que já foi dita fica salva).
    for (const [id, v] of this.vozes) {
      if (presentes.has(id)) continue;
      this.soltarVoz(id, v, true);
      if (this.jaNaChamada.delete(id)) {
        this.dados.entradas.push({ pessoaId: id, emMs: ms, tipo: "saiu" });
        this.dadosSujos = true;
      }
    }
    for (const p of pessoas) {
      let voz = this.vozes.get(p.usuarioId);
      if (!voz) {
        const pasta = pastaDaPessoa(p.nome, this.pastasUsadas);
        this.pastasUsadas.add(pasta.toLowerCase());
        voz = {
          pessoa: {
            id: p.usuarioId,
            nome: p.nome,
            ...(p.personagem ? { personagem: p.personagem } : {}),
            pasta,
          },
          detector: null,
          fluxo: null,
        };
        this.vozes.set(p.usuarioId, voz);
        this.dados.pessoas.push(voz.pessoa);
        this.dadosSujos = true;
      }
      if (!this.jaNaChamada.has(p.usuarioId)) {
        this.jaNaChamada.add(p.usuarioId);
        this.dados.entradas.push({ pessoaId: p.usuarioId, emMs: ms, tipo: "entrou" });
        // Quem entrou já de fora da gravação fica registrado desde o primeiro instante.
        if (p.naoGravar)
          this.dados.foraDaGravacao.push({ pessoaId: p.usuarioId, emMs: ms, fora: true });
        this.dadosSujos = true;
      }
      const estavaFora = this.foraAgora(p.usuarioId);
      if (p.naoGravar !== estavaFora && this.jaNaChamada.has(p.usuarioId)) {
        const ultimo = this.dados.foraDaGravacao.filter((x) => x.pessoaId === p.usuarioId).at(-1);
        if (ultimo?.fora !== p.naoGravar) {
          this.dados.foraDaGravacao.push({ pessoaId: p.usuarioId, emMs: ms, fora: p.naoGravar });
          this.dadosSujos = true;
        }
      }
      if (p.naoGravar) {
        // Nada dessa voz é escutado: a captura é solta e o que estava em curso é jogado fora.
        this.soltarVoz(p.usuarioId, voz, false);
        continue;
      }
      if (p.fluxo === null) {
        this.soltarVoz(p.usuarioId, voz, true);
        continue;
      }
      if (voz.fluxo !== p.fluxo) this.ligarVoz(p.usuarioId, voz, p.fluxo);
    }
  }

  /** A pessoa está de fora agora, pelo último registro. */
  private foraAgora(id: string): boolean {
    const ultimo = this.dados?.foraDaGravacao.filter((x) => x.pessoaId === id).at(-1);
    return ultimo?.fora ?? false;
  }

  private ligarVoz(id: string, voz: Voz, fluxo: MediaStream): void {
    if (!this.dados) return;
    this.soltarVoz(id, voz, true);
    const origem = this.agora() - this.dados.inicioEpochMs;
    voz.fluxo = fluxo;
    voz.detector = new DetectorDeFala(
      (t) => this.salvarTrecho(voz.pessoa, t),
      this.o.opcoesDoDetector,
      origem,
    );
    this.o.captura.adicionar(id, fluxo, (amostras) => voz.detector?.alimentar(amostras));
  }

  /** Solta a escuta: com `entregar`, o trecho em curso é fechado e salvo; sem ele, é jogado fora. */
  private soltarVoz(id: string, voz: Voz, entregar: boolean): void {
    if (!voz.detector && !voz.fluxo) return;
    this.o.captura.remover(id);
    if (entregar) voz.detector?.encerrar();
    else voz.detector?.descartar();
    voz.detector = null;
    voz.fluxo = null;
  }

  registrarEvento(e: EventoGravado): void {
    if (!this.gravando) return;
    this.eventos.push(e);
    this.eventosSujos = true;
  }

  private salvarTrecho(pessoa: PessoaGravada, t: Trecho): void {
    const wav = escreverWav(pcm16DeFloat(t.amostras));
    this.escrever(
      [pessoa.pasta],
      nomeDoArquivoDoTrecho(t.inicioMs),
      new Blob([wav as BlobPart], { type: "audio/wav" }),
      true,
    );
  }

  /** Escreve `gravacoes/<pasta>/<subpasta>/<nome>` em fila (uma escrita por vez; a ordem se mantém). */
  private escrever(
    subpasta: string[],
    nome: string,
    conteudo: string | Blob,
    trecho = false,
  ): void {
    const blob =
      typeof conteudo === "string" ? new Blob([conteudo], { type: "text/plain" }) : conteudo;
    const caminho = [PASTA_DAS_GRAVACOES, this.nomeDaPasta, ...subpasta];
    this.fila = this.fila.then(async () => {
      try {
        await this.o.pasta.gravar(caminho, nome, blob, true);
        if (trecho) this.mudar({ trechos: this.estado.trechos + 1 });
      } catch (e) {
        this.mudar({ erro: `Não consegui gravar na pasta da mesa: ${(e as Error).message}` });
      }
    });
  }

  private gravarDados(): void {
    if (!this.dados || !this.dadosSujos) return;
    this.dadosSujos = false;
    this.escrever([], ARQUIVOS_DA_GRAVACAO.dados, JSON.stringify(this.dados, null, 2));
  }

  private gravarEventos(): void {
    if (!this.eventosSujos) return;
    this.eventosSujos = false;
    this.escrever(
      [],
      ARQUIVOS_DA_GRAVACAO.eventos,
      this.eventos.map((e) => JSON.stringify(e)).join("\n") + (this.eventos.length > 0 ? "\n" : ""),
    );
  }

  /** Para: fecha os trechos em curso, grava o fim e espera as escritas terminarem. */
  async parar(): Promise<void> {
    if (!this.gravando) return;
    clearInterval(this.relogio);
    for (const [id, v] of this.vozes) this.soltarVoz(id, v, true);
    if (this.dados) {
      this.dados.fimEpochMs = this.agora();
      this.dadosSujos = true;
    }
    this.eventosSujos = true;
    this.gravarDados();
    this.gravarEventos();
    this.mudar({ fase: "parada" });
    await this.fila;
  }
}
