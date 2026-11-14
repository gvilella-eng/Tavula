import {
  desvioDoRelogio,
  FADE_DA_ZONA_MS,
  pontoDaTrilha,
  type SomTocando,
  TRANSICAO_DA_TRILHA_MS,
  type Trilha,
  volumeFinal,
} from "@tabletop/shared";
import { type PrefsDeSom, prefsDeSom } from "./prefsDeSom";

/**
 * N5: o motor de som deste navegador. Recebe o que DEVE tocar (a trilha, os sons das zonas onde o jogador está, os
 * efeitos) e cuida do resto: baixar o arquivo, ajustar o ponto da trilha ao relógio da sala, o fade, o volume das
 * preferências e o bloqueio de som automático do navegador (que só deixa tocar depois de um gesto).
 * Nada daqui vai para a sala. O estado "o que está tocando" é lido pelo gancho de teste, sem depender do áudio real.
 */

export type FonteDeAudio = {
  /** A URL local (blob) do arquivo, ou `null` se ainda não chegou. */
  urlDe(hash: string): Promise<string | null>;
  /** Pede o arquivo à sala/cache (idempotente). */
  garantir(hash: string): void;
};

type Categoria = "trilha" | "zona" | "efeito";

type Canal = {
  hash: string;
  categoria: Categoria;
  el: HTMLAudioElement;
  /** O volume do som (0 a 1), antes das preferências. */
  volume: number;
  rampa?: ReturnType<typeof setInterval> | undefined;
};

export type EstadoDoSom = {
  trilha: { hash: string; volume: number; tocando: boolean } | null;
  zonas: { hash: string; volume: number }[];
  /** Os efeitos tocados desde que a página abriu (o volume já com as preferências). */
  efeitos: { hash: string; volume: number }[];
  bloqueado: boolean;
};

const PASSO_DA_RAMPA_MS = 40;
const AJUSTE_DE_VOLUME_MS = 250;
/** A trilha que passa disto do relógio da sala é reposicionada (o resto é latência da rede). */
const DESVIO_ACEITO_S = 1.5;

export class MotorDeSom {
  private trilhaDesejada: Trilha | null = null;
  private desvio = 0;
  private zonasDesejadas: SomTocando[] = [];
  private trilhaAtual: Canal | null = null;
  private readonly zonas = new Map<string, Canal>();
  /** Sons de zona sem laço que já tocaram desde que o jogador entrou (tocam uma vez por entrada). */
  private readonly semLacoTocados = new Set<string>();
  private readonly urls = new Map<string, string>();
  private readonly efeitosTocados: { hash: string; volume: number }[] = [];
  private bloqueado = false;
  private encerrado = true;
  private fila: Promise<void> = Promise.resolve();
  private readonly ouvintes = new Set<() => void>();
  private versao = 0;
  private desinscrever: () => void = () => {};

  constructor(
    private readonly fonte: FonteDeAudio,
    private readonly assinarPrefs: (aoMudar: () => void) => () => void,
    private readonly criarAudio: (url: string) => HTMLAudioElement = (url) => new Audio(url),
  ) {}

  /** Liga o motor (e de novo, se foi encerrado: o modo estrito do React monta, desmonta e monta). */
  iniciar(): void {
    if (!this.encerrado) return;
    this.encerrado = false;
    this.desinscrever = this.assinarPrefs(() => this.aplicarVolumes());
    this.reconciliar();
  }

  // --- o que a tela observa -------------------------------------------------------------------

  readonly assinar = (aoMudar: () => void): (() => void) => {
    this.ouvintes.add(aoMudar);
    return () => {
      this.ouvintes.delete(aoMudar);
    };
  };
  readonly versaoAtual = (): number => this.versao;

  private mudou(): void {
    this.versao++;
    for (const o of this.ouvintes) o();
  }

  /** O navegador está bloqueando o som até alguém clicar: a tela mostra "Clique para ativar o som". */
  estaBloqueado(): boolean {
    return this.bloqueado;
  }

  estado(): EstadoDoSom {
    const p = prefsDeSom();
    return {
      trilha: this.trilhaAtual
        ? {
            hash: this.trilhaAtual.hash,
            volume: this.volumeDe(this.trilhaAtual, p),
            tocando: true,
          }
        : null,
      zonas: [...this.zonas.values()].map((c) => ({ hash: c.hash, volume: this.volumeDe(c, p) })),
      efeitos: [...this.efeitosTocados],
      bloqueado: this.bloqueado,
    };
  }

  // --- o que deve tocar -----------------------------------------------------------------------

  /** A trilha da sala (`null`: parada) e o relógio dela em relação ao deste navegador. */
  definirTrilha(trilha: Trilha | null): void {
    const mudouDeSom = trilha?.hash !== this.trilhaDesejada?.hash;
    const mudouInicio = trilha?.inicioMs !== this.trilhaDesejada?.inicioMs;
    if (trilha) this.desvio = desvioDoRelogio(trilha, Date.now());
    this.trilhaDesejada = trilha;
    if (mudouDeSom || mudouInicio || trilha === null) this.reconciliar();
    else this.aplicarVolumes();
  }

  /** Os sons de zona que valem agora (só os do jogador, ou os do token selecionado do mestre). */
  definirZonas(sons: readonly SomTocando[]): void {
    this.zonasDesejadas = [...sons];
    this.reconciliar();
  }

  /** Um efeito, uma vez. */
  tocarEfeito(hash: string, volume: number): void {
    if (this.encerrado) return;
    const p = prefsDeSom();
    const final = volumeFinal(volume, p.geral, p.efeitos, p.silenciado);
    this.efeitosTocados.push({ hash, volume: final });
    this.mudou();
    if (final <= 0) return;
    this.fonte.garantir(hash);
    void (async () => {
      const url = await this.urlDoArquivo(hash);
      if (url === null || this.encerrado) return;
      const canal = this.novoCanal(hash, "efeito", volume, url, false);
      this.ajustar(canal, final, 0);
      canal.el.addEventListener("ended", () => this.soltar(canal), { once: true });
      await this.comecar(canal);
    })();
  }

  /** O arquivo chegou (ou algo mudou): tenta de novo o que estava esperando. */
  arquivoChegou(): void {
    this.reconciliar();
  }

  /** Só o modo de teste: finge que o navegador bloqueou o som (para ver o aviso). */
  simularBloqueio(): void {
    this.bloqueado = true;
    this.mudou();
  }

  /** Um clique da pessoa: o navegador deixa o som tocar. */
  ativar(): void {
    if (!this.bloqueado) return;
    this.bloqueado = false;
    this.mudou();
    this.reconciliar(true);
  }

  encerrar(): void {
    this.encerrado = true;
    this.desinscrever();
    for (const c of [this.trilhaAtual, ...this.zonas.values()]) if (c) this.soltar(c);
    this.trilhaAtual = null;
    this.zonas.clear();
    for (const u of this.urls.values()) URL.revokeObjectURL(u);
    this.urls.clear();
  }

  // --- por dentro -----------------------------------------------------------------------------

  private volumeDe(c: Canal, p: PrefsDeSom): number {
    const cat =
      c.categoria === "trilha" ? p.trilha : c.categoria === "efeito" ? p.efeitos : p.efeitos;
    return volumeFinal(c.volume, p.geral, cat, p.silenciado);
  }

  private async urlDoArquivo(hash: string): Promise<string | null> {
    const feita = this.urls.get(hash);
    if (feita) return feita;
    const url = await this.fonte.urlDe(hash);
    if (url !== null) this.urls.set(hash, url);
    return url;
  }

  private novoCanal(
    hash: string,
    categoria: Categoria,
    volume: number,
    url: string,
    laco: boolean,
  ): Canal {
    const el = this.criarAudio(url);
    el.loop = laco;
    el.preload = "auto";
    el.volume = 0;
    return { hash, categoria, el, volume };
  }

  /** Começa a tocar; se o navegador exige um gesto, avisa e espera o clique. */
  private async comecar(canal: Canal): Promise<boolean> {
    try {
      await canal.el.play();
      return true;
    } catch (e) {
      if ((e as Error).name === "NotAllowedError") {
        this.bloqueado = true;
        this.mudou();
      }
      return false;
    }
  }

  private soltar(canal: Canal): void {
    if (canal.rampa) clearInterval(canal.rampa);
    try {
      canal.el.pause();
      canal.el.removeAttribute("src");
      canal.el.load();
    } catch {
      // elemento já solto
    }
  }

  /** Leva o volume do canal até `alvo` em `ms` (sem estalo); `aoFim` roda no fim. */
  private ajustar(canal: Canal, alvo: number, ms: number, aoFim?: () => void): void {
    if (canal.rampa) clearInterval(canal.rampa);
    const de = canal.el.volume;
    if (ms <= 0 || Math.abs(alvo - de) < 0.005) {
      canal.el.volume = alvo;
      aoFim?.();
      return;
    }
    const passos = Math.max(1, Math.round(ms / PASSO_DA_RAMPA_MS));
    let i = 0;
    canal.rampa = setInterval(() => {
      i++;
      canal.el.volume = Math.min(1, Math.max(0, de + ((alvo - de) * i) / passos));
      if (i >= passos) {
        if (canal.rampa) clearInterval(canal.rampa);
        canal.rampa = undefined;
        aoFim?.();
      }
    }, PASSO_DA_RAMPA_MS);
  }

  private aplicarVolumes(): void {
    const p = prefsDeSom();
    const todos = [this.trilhaAtual, ...this.zonas.values()];
    for (const c of todos) {
      if (c) this.ajustar(c, this.volumeDe(c, p), AJUSTE_DE_VOLUME_MS);
    }
    if (this.trilhaAtual && this.trilhaDesejada)
      this.trilhaAtual.volume = this.trilhaDesejada.volume;
    this.mudou();
  }

  private reconciliar(depoisDoGesto = false): void {
    this.fila = this.fila
      .then(() => this.reconciliarAgora(depoisDoGesto))
      .catch((e) => console.warn("Som: não consegui acertar o que toca", e))
      .then(() => this.mudou());
  }

  private async reconciliarAgora(depoisDoGesto: boolean): Promise<void> {
    if (this.encerrado) return;
    await this.reconciliarTrilha(depoisDoGesto);
    await this.reconciliarZonas(depoisDoGesto);
  }

  private async reconciliarTrilha(depoisDoGesto: boolean): Promise<void> {
    const alvo = this.trilhaDesejada;
    const atual = this.trilhaAtual;
    const p = prefsDeSom();
    if (atual && alvo && atual.hash === alvo.hash) {
      atual.volume = alvo.volume;
      this.ajustar(atual, this.volumeDe(atual, p), AJUSTE_DE_VOLUME_MS);
      // A trilha que se afastou do relógio da sala (a aba ficou parada, por exemplo) volta ao ponto.
      const ponto = pontoDaTrilha(alvo, Date.now(), this.desvio, atual.el.duration);
      if (
        Number.isFinite(atual.el.duration) &&
        Math.abs(atual.el.currentTime - ponto) > DESVIO_ACEITO_S &&
        // perto da emenda do laço os dois lados "estão certos"
        Math.abs(atual.el.currentTime - ponto) < atual.el.duration - DESVIO_ACEITO_S
      ) {
        atual.el.currentTime = ponto;
      }
      if (depoisDoGesto && atual.el.paused) await this.comecar(atual);
      return;
    }
    if (atual) {
      // Troca suave: a de antes some em 2 s e a nova entra na mesma hora.
      this.trilhaAtual = null;
      this.ajustar(atual, 0, TRANSICAO_DA_TRILHA_MS, () => this.soltar(atual));
    }
    if (!alvo) return;
    this.fonte.garantir(alvo.hash);
    const url = await this.urlDoArquivo(alvo.hash);
    if (url === null || this.encerrado || this.trilhaDesejada?.hash !== alvo.hash) return;
    const canal = this.novoCanal(alvo.hash, "trilha", alvo.volume, url, true);
    this.trilhaAtual = canal;
    const posicionar = () => {
      canal.el.currentTime = pontoDaTrilha(alvo, Date.now(), this.desvio, canal.el.duration);
    };
    if (Number.isFinite(canal.el.duration) && canal.el.duration > 0) posicionar();
    else canal.el.addEventListener("loadedmetadata", posicionar, { once: true });
    this.ajustar(
      canal,
      this.volumeDe(canal, p),
      atual ? TRANSICAO_DA_TRILHA_MS : AJUSTE_DE_VOLUME_MS,
    );
    await this.comecar(canal);
  }

  private async reconciliarZonas(depoisDoGesto: boolean): Promise<void> {
    const p = prefsDeSom();
    const querem = new Map(this.zonasDesejadas.map((s) => [s.hash, s]));
    // Saiu da zona: o som some com fade.
    for (const [hash, canal] of [...this.zonas]) {
      if (querem.has(hash)) continue;
      this.zonas.delete(hash);
      this.ajustar(canal, 0, FADE_DA_ZONA_MS, () => this.soltar(canal));
    }
    for (const hash of [...this.semLacoTocados])
      if (!querem.has(hash)) this.semLacoTocados.delete(hash);
    for (const som of querem.values()) {
      const existente = this.zonas.get(som.hash);
      if (!som.laco && !existente && this.semLacoTocados.has(som.hash)) continue;
      if (existente) {
        existente.volume = som.volume;
        existente.el.loop = som.laco;
        this.ajustar(existente, this.volumeDe(existente, p), AJUSTE_DE_VOLUME_MS);
        if (depoisDoGesto && existente.el.paused) await this.comecar(existente);
        continue;
      }
      this.fonte.garantir(som.hash);
      const url = await this.urlDoArquivo(som.hash);
      if (url === null || this.encerrado) continue;
      if (!this.zonasDesejadas.some((s) => s.hash === som.hash)) continue;
      const canal = this.novoCanal(som.hash, "zona", som.volume, url, som.laco);
      this.zonas.set(som.hash, canal);
      this.ajustar(canal, this.volumeDe(canal, p), FADE_DA_ZONA_MS);
      if (!som.laco) {
        this.semLacoTocados.add(som.hash);
        canal.el.addEventListener("ended", () => this.zonas.delete(som.hash), { once: true });
      }
      await this.comecar(canal);
    }
  }
}
