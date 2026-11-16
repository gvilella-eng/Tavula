import {
  type AmbienteLigado,
  desvioDoRelogio,
  FADE_DA_ZONA_MS,
  FADE_DO_AMBIENTE_MS,
  pontoDaTrilha,
  type SomLigado,
  type SomTocando,
  VOLUME_GERAL_PADRAO,
  volumeFinal,
} from "@tabletop/shared";
import { type PrefsDeSom, prefsDeSom } from "./prefsDeSom";

/**
 * N5/Q4: o motor de som deste navegador. Recebe o que DEVE tocar (os ambientes ligados da mesa de som, os sons das zonas
 * onde o jogador está, os efeitos) e cuida do resto: baixar o arquivo, ajustar o ponto de cada ambiente ao relógio da
 * sala, o fade, o volume das preferências e o bloqueio de som automático do navegador (que só deixa tocar depois de um
 * gesto). Nada daqui vai para a sala. O estado "o que está tocando" é lido pelo gancho de teste, sem depender do áudio real.
 */

export type FonteDeAudio = {
  /** A URL local (blob) do arquivo, ou `null` se ainda não chegou. */
  urlDe(hash: string): Promise<string | null>;
  /** Pede o arquivo à sala/cache (idempotente). */
  garantir(hash: string): void;
};

type Categoria = "ambiente" | "zona" | "efeito";

type Canal = {
  hash: string;
  categoria: Categoria;
  el: HTMLAudioElement;
  /** O volume do som (0 a 1), antes das preferências. */
  volume: number;
  rampa?: ReturnType<typeof setInterval> | undefined;
  /** Efeito da mesa de som: o lugar (0 a 7); `null` nos de automação e nos de arquivo solto. */
  lugar?: number | null;
};

/** Um ambiente que a sala quer tocando: o que veio dela mais o desvio do relógio dela em relação a este navegador. */
type AmbienteDesejado = { ligado: AmbienteLigado; desvio: number };

export type EstadoDoSom = {
  /** Os ambientes que tocam agora (o volume já com o geral da mesa e as preferências). */
  ambientes: { indice: number; hash: string; volume: number; tocando: boolean }[];
  zonas: { hash: string; volume: number }[];
  /** Os efeitos tocados desde que a página abriu (o volume já com as preferências). */
  efeitos: { hash: string; volume: number; lugar: number | null }[];
  /** Os efeitos que ainda estão tocando agora. */
  efeitosTocando: { hash: string; lugar: number | null }[];
  bloqueado: boolean;
};

/** Um efeito que está tocando (a janela do mestre desenha a barra de progresso com isto). */
export type EfeitoTocando = {
  /** Muda a cada toque (a barra recomeça). */
  chave: number;
  lugar: number | null;
  hash: string;
  /** Duração do arquivo em segundos (`null` enquanto não se sabe). */
  duracaoS: number | null;
};

const PASSO_DA_RAMPA_MS = 40;
const AJUSTE_DE_VOLUME_MS = 250;
/** Um ambiente que passa disto do relógio da sala é reposicionado (o resto é latência da rede). */
const DESVIO_ACEITO_S = 1.5;

export class MotorDeSom {
  private ambientesDesejados: AmbienteDesejado[] = [];
  private volumeGeral = VOLUME_GERAL_PADRAO;
  private zonasDesejadas: SomTocando[] = [];
  private readonly ambientes = new Map<number, Canal>();
  private readonly zonas = new Map<string, Canal>();
  /** Sons de zona sem laço que já tocaram desde que o jogador entrou (tocam uma vez por entrada). */
  private readonly semLacoTocados = new Set<string>();
  private readonly urls = new Map<string, string>();
  private readonly efeitosTocados: { hash: string; volume: number; lugar: number | null }[] = [];
  private readonly efeitosAtivos = new Map<number, { canal: Canal; info: EfeitoTocando }>();
  private proximaChave = 1;
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

  /** Os efeitos que estão tocando agora (a janela do mestre mostra a barra e o "parar"). */
  efeitosEmAndamento(): EfeitoTocando[] {
    return [...this.efeitosAtivos.values()].map((e) => e.info);
  }

  estado(): EstadoDoSom {
    const p = prefsDeSom();
    return {
      ambientes: [...this.ambientes.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([indice, c]) => ({
          indice,
          hash: c.hash,
          volume: this.volumeDe(c, p),
          tocando: true,
        })),
      zonas: [...this.zonas.values()].map((c) => ({ hash: c.hash, volume: this.volumeDe(c, p) })),
      efeitos: [...this.efeitosTocados],
      efeitosTocando: [...this.efeitosAtivos.values()].map((e) => ({
        hash: e.info.hash,
        lugar: e.info.lugar,
      })),
      bloqueado: this.bloqueado,
    };
  }

  // --- o que deve tocar -----------------------------------------------------------------------

  /** O que toca da mesa de som (`null`: nada) e o relógio de cada ambiente em relação ao deste navegador. */
  definirAmbientes(somLigado: SomLigado | null): void {
    const agora = Date.now();
    const antes = JSON.stringify(
      this.ambientesDesejados.map((a) => [a.ligado.indice, a.ligado.hash, a.ligado.inicioMs]),
    );
    this.ambientesDesejados = (somLigado?.ambientes ?? []).map((ligado) => ({
      ligado,
      desvio: desvioDoRelogio(ligado, agora),
    }));
    this.volumeGeral = somLigado?.volumeGeral ?? VOLUME_GERAL_PADRAO;
    const depois = JSON.stringify(
      this.ambientesDesejados.map((a) => [a.ligado.indice, a.ligado.hash, a.ligado.inicioMs]),
    );
    if (antes !== depois) this.reconciliar();
    else this.aplicarVolumes();
  }

  /** Os sons de zona que valem agora (só os do jogador, ou os do token selecionado do mestre). */
  definirZonas(sons: readonly SomTocando[]): void {
    this.zonasDesejadas = [...sons];
    this.reconciliar();
  }

  /** Um efeito, uma vez. Tocar de novo o do mesmo lugar (ou o mesmo arquivo solto) recomeça. */
  tocarEfeito(hash: string, volume: number, lugar?: number): void {
    if (this.encerrado) return;
    const p = prefsDeSom();
    const final = volumeFinal(volume, p.geral, p.efeitos, p.silenciado);
    const idLugar = lugar ?? null;
    this.efeitosTocados.push({ hash, volume: final, lugar: idLugar });
    // O antigo do mesmo lugar (ou do mesmo arquivo, sem lugar) para na hora.
    for (const [chave, e] of [...this.efeitosAtivos]) {
      const igual =
        idLugar === null ? e.info.lugar === null && e.info.hash === hash : e.info.lugar === idLugar;
      if (!igual) continue;
      this.efeitosAtivos.delete(chave);
      this.soltar(e.canal);
    }
    this.mudou();
    if (final <= 0) return;
    this.fonte.garantir(hash);
    const chave = this.proximaChave++;
    void (async () => {
      const url = await this.urlDoArquivo(hash);
      if (url === null || this.encerrado) return;
      const canal = this.novoCanal(hash, "efeito", volume, url, false);
      canal.lugar = idLugar;
      const info: EfeitoTocando = { chave, lugar: idLugar, hash, duracaoS: null };
      this.efeitosAtivos.set(chave, { canal, info });
      this.ajustar(canal, final, 0);
      const acabou = () => {
        if (this.efeitosAtivos.get(chave)?.canal === canal) this.efeitosAtivos.delete(chave);
        this.soltar(canal);
        this.mudou();
      };
      canal.el.addEventListener("ended", acabou, { once: true });
      const medir = () => {
        const d = canal.el.duration;
        if (Number.isFinite(d) && d > 0 && this.efeitosAtivos.get(chave)?.canal === canal) {
          info.duracaoS = d;
          this.mudou();
        }
      };
      if (Number.isFinite(canal.el.duration) && canal.el.duration > 0) medir();
      else canal.el.addEventListener("loadedmetadata", medir, { once: true });
      this.mudou();
      await this.comecar(canal);
    })();
  }

  /** Corta o efeito do `lugar` (sem ele, todos os efeitos). */
  pararEfeito(lugar?: number): void {
    let mexeu = false;
    for (const [chave, e] of [...this.efeitosAtivos]) {
      if (lugar !== undefined && e.info.lugar !== lugar) continue;
      this.efeitosAtivos.delete(chave);
      this.soltar(e.canal);
      mexeu = true;
    }
    if (mexeu) this.mudou();
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
    for (const c of [
      ...this.ambientes.values(),
      ...this.zonas.values(),
      ...[...this.efeitosAtivos.values()].map((e) => e.canal),
    ]) {
      this.soltar(c);
    }
    this.ambientes.clear();
    this.zonas.clear();
    this.efeitosAtivos.clear();
    for (const u of this.urls.values()) URL.revokeObjectURL(u);
    this.urls.clear();
  }

  // --- por dentro -----------------------------------------------------------------------------

  private volumeDe(c: Canal, p: PrefsDeSom): number {
    // As preferências guardam o volume dos ambientes na chave `trilha` (nome do N5, para não perder o que a pessoa ajustou).
    const cat = c.categoria === "ambiente" ? p.trilha : p.efeitos;
    const base = c.categoria === "ambiente" ? c.volume * this.volumeGeral : c.volume;
    return volumeFinal(base, p.geral, cat, p.silenciado);
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
    for (const d of this.ambientesDesejados) {
      const c = this.ambientes.get(d.ligado.indice);
      if (c && c.hash === d.ligado.hash) c.volume = d.ligado.volume;
    }
    const todos = [
      ...this.ambientes.values(),
      ...this.zonas.values(),
      ...[...this.efeitosAtivos.values()].map((e) => e.canal),
    ];
    for (const c of todos) this.ajustar(c, this.volumeDe(c, p), AJUSTE_DE_VOLUME_MS);
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
    await this.reconciliarAmbientes(depoisDoGesto);
    await this.reconciliarZonas(depoisDoGesto);
  }

  private async reconciliarAmbientes(depoisDoGesto: boolean): Promise<void> {
    const p = prefsDeSom();
    const querem = new Map(this.ambientesDesejados.map((d) => [d.ligado.indice, d]));
    // Desligado (ou trocado por outro arquivo): some com fade de 1,5 s.
    for (const [indice, canal] of [...this.ambientes]) {
      const q = querem.get(indice);
      if (q && q.ligado.hash === canal.hash) continue;
      this.ambientes.delete(indice);
      this.ajustar(canal, 0, FADE_DO_AMBIENTE_MS, () => this.soltar(canal));
    }
    for (const q of querem.values()) {
      const { ligado, desvio } = q;
      const existente = this.ambientes.get(ligado.indice);
      if (existente) {
        existente.volume = ligado.volume;
        this.ajustar(existente, this.volumeDe(existente, p), AJUSTE_DE_VOLUME_MS);
        // O ambiente que se afastou do relógio da sala (a aba ficou parada, por exemplo) volta ao ponto.
        const ponto = pontoDaTrilha(ligado, Date.now(), desvio, existente.el.duration);
        const d = existente.el.duration;
        if (
          Number.isFinite(d) &&
          Math.abs(existente.el.currentTime - ponto) > DESVIO_ACEITO_S &&
          // perto da emenda do laço os dois lados "estão certos"
          Math.abs(existente.el.currentTime - ponto) < d - DESVIO_ACEITO_S
        ) {
          existente.el.currentTime = ponto;
        }
        if (depoisDoGesto && existente.el.paused) await this.comecar(existente);
        continue;
      }
      this.fonte.garantir(ligado.hash);
      const url = await this.urlDoArquivo(ligado.hash);
      const aindaQuer = this.ambientesDesejados.some(
        (d) => d.ligado.indice === ligado.indice && d.ligado.hash === ligado.hash,
      );
      if (url === null || this.encerrado || !aindaQuer || this.ambientes.has(ligado.indice)) {
        continue;
      }
      const canal = this.novoCanal(ligado.hash, "ambiente", ligado.volume, url, true);
      this.ambientes.set(ligado.indice, canal);
      const posicionar = () => {
        canal.el.currentTime = pontoDaTrilha(ligado, Date.now(), desvio, canal.el.duration);
      };
      if (Number.isFinite(canal.el.duration) && canal.el.duration > 0) posicionar();
      else canal.el.addEventListener("loadedmetadata", posicionar, { once: true });
      this.ajustar(canal, this.volumeDe(canal, p), FADE_DO_AMBIENTE_MS);
      await this.comecar(canal);
    }
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
