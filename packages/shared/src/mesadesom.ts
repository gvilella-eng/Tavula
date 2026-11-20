import { z } from "zod";
import { HashSchema } from "./assets.ts";
import type { Estado } from "./estado.ts";
import { acoesDoFluxo } from "./fluxosLeitura.ts";
import { VolumeSchema } from "./som.ts";

// ---------------------------------------------------------------------------------------------
// Mesa de som (Q4): 8 efeitos de um toque e 8 ambientes em laço, cada um num "lugar" que o mestre configura
// (arquivo, nome do botão, ícone, cor da etiqueta, volume padrão). Este arquivo tem os dados e as contas puras.
//
// - `Estado.mesaDeSom` (a configuração dos 16 lugares): só o mestre recebe; entra na exportação.
// - `Estado.somLigado` (o que toca agora: ambientes ligados e o volume geral): todos recebem; é dado da sessão e não
//   entra na exportação (o relógio dele seria de outra sessão).
// ---------------------------------------------------------------------------------------------

/** Quantos lugares há em cada grupo (efeitos e ambientes). */
export const LUGARES_POR_GRUPO = 8;

export const GRUPOS_DE_SOM = ["efeito", "ambiente"] as const;
export const GrupoDeSomSchema = z.enum(GRUPOS_DE_SOM);
export type GrupoDeSom = z.infer<typeof GrupoDeSomSchema>;

/** Os 12 ícones que o mestre escolhe (a tela mostra cada um com o ícone do lucide-react). */
export const ICONES_DO_SOM = [
  "chama",
  "vento",
  "espadas",
  "porta",
  "sino",
  "gota",
  "caveira",
  "trovao",
  "passos",
  "multidao",
  "musica",
  "criatura",
] as const;
export const IconeDoSomSchema = z.enum(ICONES_DO_SOM);
export type IconeDoSom = z.infer<typeof IconeDoSomSchema>;

/** As cores da etiqueta (a tela as liga aos tokens do tema). */
export const CORES_DO_SOM = ["ambar", "laranja", "verde", "azul", "vermelho", "pedra"] as const;
export const CorDoSomSchema = z.enum(CORES_DO_SOM);
export type CorDoSom = z.infer<typeof CorDoSomSchema>;

/** O nome do botão cabe em 12 letras. */
export const MAXIMO_DO_NOME_DO_LUGAR = 12;

export const LugarDeSomSchema = z.object({
  /** O arquivo (um asset `som` já registrado). */
  hash: HashSchema,
  nome: z.string().trim().min(1).max(MAXIMO_DO_NOME_DO_LUGAR),
  icone: IconeDoSomSchema,
  cor: CorDoSomSchema,
  /** O volume padrão do lugar (0 a 1). */
  volume: VolumeSchema,
});
export type LugarDeSom = z.infer<typeof LugarDeSomSchema>;

/** Uma lista de lugares: o que falta ou é `null` é um lugar vazio (a leitura completa até 8). */
const ListaDeLugares = z.array(LugarDeSomSchema.nullable()).max(LUGARES_POR_GRUPO);

export const MesaDeSomSchema = z.object({
  efeitos: ListaDeLugares,
  ambientes: ListaDeLugares,
});
export type MesaDeSom = z.infer<typeof MesaDeSomSchema>;

export const IndiceDoLugarSchema = z
  .number()
  .int()
  .min(0)
  .max(LUGARES_POR_GRUPO - 1);

/** Um ambiente que toca agora. `inicioMs` e `servidorMs` são o relógio da SALA (ms reais), como na trilha do N5. */
export const AmbienteLigadoSchema = z.object({
  indice: IndiceDoLugarSchema,
  hash: HashSchema,
  /** O volume dele agora (0 a 1); começa no padrão do lugar. */
  volume: VolumeSchema,
  inicioMs: z.number().nonnegative(),
  /** O relógio da sala no instante em que esta cópia foi montada (cada evento e cada snapshot o refaz). */
  servidorMs: z.number().nonnegative().optional(),
});
export type AmbienteLigado = z.infer<typeof AmbienteLigadoSchema>;

export const SomLigadoSchema = z.object({
  /** O volume geral da mesa de som (0 a 1): vale para efeitos e ambientes, para todos. */
  volumeGeral: VolumeSchema,
  /** Os ambientes MARCADOS (Q4b): só tocam enquanto o transporte toca. */
  ambientes: z.array(AmbienteLigadoSchema).max(LUGARES_POR_GRUPO),
  /**
   * O transporte geral (Q4b): `true` toca os ambientes marcados, `false` os deixa marcados e calados. Sem o campo (estado
   * de antes do Q4b) vale "tocando" se há ambiente marcado (assumido), como era.
   */
  tocando: z.boolean().optional(),
});
export type SomLigado = z.infer<typeof SomLigadoSchema>;

export const VOLUME_GERAL_PADRAO = 1;
/** A entrada e a saída suaves de um ambiente, em ms. */
export const FADE_DO_AMBIENTE_MS = 1500;

/** A mesa de som completa: sempre 8 lugares em cada grupo (os que faltam, `null`). */
export function lugaresDe(mesa: MesaDeSom | undefined): {
  efeitos: (LugarDeSom | null)[];
  ambientes: (LugarDeSom | null)[];
} {
  const completa = (l: readonly (LugarDeSom | null)[] | undefined) =>
    Array.from({ length: LUGARES_POR_GRUPO }, (_, i) => l?.[i] ?? null);
  return { efeitos: completa(mesa?.efeitos), ambientes: completa(mesa?.ambientes) };
}

export function lugarDe(
  mesa: MesaDeSom | undefined,
  grupo: GrupoDeSom,
  indice: number,
): LugarDeSom | null {
  const l = lugaresDe(mesa);
  return (grupo === "efeito" ? l.efeitos : l.ambientes)[indice] ?? null;
}

/** Põe (ou, com `null`, tira) um lugar. Devolve a mesa nova, sempre com 8 lugares em cada grupo. */
export function comLugar(
  mesa: MesaDeSom | undefined,
  grupo: GrupoDeSom,
  indice: number,
  lugar: LugarDeSom | null,
): MesaDeSom {
  const l = lugaresDe(mesa);
  const lista = grupo === "efeito" ? l.efeitos : l.ambientes;
  lista[indice] = lugar;
  return { efeitos: l.efeitos, ambientes: l.ambientes };
}

/** A mesa de som sem nenhum lugar preenchido (e sem nada ligado) não precisa existir. */
export function mesaVazia(mesa: MesaDeSom | undefined): boolean {
  const l = lugaresDe(mesa);
  return l.efeitos.every((x) => x === null) && l.ambientes.every((x) => x === null);
}

/** Os ambientes ligados agora, em ordem de lugar. */
export function ambientesLigados(estado: Pick<Estado, "somLigado">): AmbienteLigado[] {
  return [...(estado.somLigado?.ambientes ?? [])].sort((a, b) => a.indice - b.indice);
}

/** O transporte da mesa de som toca agora? (Estado de antes do Q4b, sem o campo: toca se há ambiente marcado.) */
export function tocandoAgora(estado: Pick<Estado, "somLigado">): boolean {
  const s = estado.somLigado;
  if (!s) return false;
  return s.tocando ?? s.ambientes.length > 0;
}

export function volumeGeralDe(estado: Pick<Estado, "somLigado">): number {
  return estado.somLigado?.volumeGeral ?? VOLUME_GERAL_PADRAO;
}

/** O que a mesa guarda de som: `somLigado` sem ambientes e com o volume geral padrão não precisa existir. */
export function somLigadoOuNada(s: SomLigado): SomLigado | undefined {
  if (s.ambientes.length === 0 && s.tocando !== true) {
    // Nada marcado e o transporte parado: só o volume geral (se não for o padrão) vale a pena guardar.
    if (s.volumeGeral === VOLUME_GERAL_PADRAO) return undefined;
    return { volumeGeral: s.volumeGeral, ambientes: [] };
  }
  return s;
}

/** Os ambientes da cena que ainda existem (índices válidos, sem repetir, em ordem). */
export function ambientesDaCena(
  cena: { ambientes?: readonly number[] | undefined },
  mesa: MesaDeSom | undefined,
): number[] {
  const l = lugaresDe(mesa).ambientes;
  return [...new Set(cena.ambientes ?? [])]
    .filter((i) => Number.isInteger(i) && l[i] !== null && l[i] !== undefined)
    .sort((a, b) => a - b);
}

/**
 * Desliga os ambientes que `quais` aponta. `mudou` diz se algum estava tocando; `somLigado` é o valor novo para o evento
 * (`null`: nada toca e o volume geral é o padrão).
 */
export function ligadoSem(
  estado: Pick<Estado, "somLigado">,
  quais: (a: AmbienteLigado) => boolean,
  /** Para o transporte junto (o "parar tudo"); sem ele o transporte fica como está. */
  tocando: boolean = tocandoAgora(estado),
): { mudou: boolean; somLigado: SomLigado | null } {
  const atuais = ambientesLigados(estado);
  const ficam = atuais.filter((a) => !quais(a));
  if (ficam.length === atuais.length) return { mudou: false, somLigado: null };
  return {
    mudou: true,
    somLigado:
      somLigadoOuNada({ volumeGeral: volumeGeralDe(estado), ambientes: ficam, tocando }) ?? null,
  };
}

/**
 * Ao levar o grupo para uma cena com `ambientes`: liga os marcados e desliga os outros. O que já toca e continua
 * marcado segue sem recomeçar (e com o volume em que está). Devolve o `somLigado` novo, ou `undefined` se nada muda.
 * Cena sem o campo não mexe em nada.
 */
export function ligadosParaACena(
  estado: Pick<Estado, "mesaDeSom" | "somLigado">,
  cena: { ambientes?: readonly number[] | undefined },
  agoraMs: number,
): SomLigado | undefined {
  if (cena.ambientes === undefined) return undefined;
  const querem = ambientesDaCena(cena, estado.mesaDeSom);
  const lugares = lugaresDe(estado.mesaDeSom).ambientes;
  const atuais = ambientesLigados(estado);
  const novos: AmbienteLigado[] = [];
  for (const i of querem) {
    const lugar = lugares[i];
    if (!lugar) continue;
    const ja = atuais.find((a) => a.indice === i && a.hash === lugar.hash);
    novos.push(
      ja ?? {
        indice: i,
        hash: lugar.hash,
        volume: lugar.volume,
        inicioMs: agoraMs,
        servidorMs: agoraMs,
      },
    );
  }
  // Q4b: a cena que tem ambientes põe o transporte para tocar (a cena existe para isso); sem ambientes, ele fica como está.
  const tocando = querem.length > 0 ? true : tocandoAgora(estado);
  const igual =
    novos.length === atuais.length &&
    novos.every((n, k) => atuais[k]?.indice === n.indice && atuais[k]?.hash === n.hash) &&
    tocando === tocandoAgora(estado);
  if (igual) return undefined;
  // Saindo do transporte parado, tudo começa junto, agora.
  const comecando = tocando && !tocandoAgora(estado);
  return {
    volumeGeral: volumeGeralDe(estado),
    ambientes: comecando
      ? novos.map((n) => ({ ...n, inicioMs: agoraMs, servidorMs: agoraMs }))
      : novos,
    tocando,
  };
}

// ---------------------------------------------------------------------------------------------
// Onde um som é usado (para o aviso de "apagar este som da mesa")
// ---------------------------------------------------------------------------------------------

export type UsoDoSom = {
  lugares: { grupo: GrupoDeSom; indice: number; nome: string }[];
  zonas: string[];
  automacoes: string[];
};

export function usosDoSom(
  estado: Pick<Estado, "mesaDeSom" | "zonas" | "automacoes">,
  hash: string,
): UsoDoSom {
  const l = lugaresDe(estado.mesaDeSom);
  const lugares: UsoDoSom["lugares"] = [];
  l.efeitos.forEach((x, indice) => {
    if (x?.hash === hash) lugares.push({ grupo: "efeito", indice, nome: x.nome });
  });
  l.ambientes.forEach((x, indice) => {
    if (x?.hash === hash) lugares.push({ grupo: "ambiente", indice, nome: x.nome });
  });
  const zonas = (estado.zonas ?? []).filter((z) => z.efeitos.som?.hash === hash).map((z) => z.nome);
  const automacoes = (estado.automacoes?.fluxos ?? [])
    .filter((f) => acoesDoFluxo(f).some((a) => a.acao === "som.tocar" && a.hash === hash))
    .map((f) => f.nome);
  return { lugares, zonas, automacoes };
}

// ---------------------------------------------------------------------------------------------
// Conversão do som do N5 (trilha única e trilha da cena) para a mesa de som
// ---------------------------------------------------------------------------------------------

type ComSomAntigo = Pick<Estado, "cenas" | "mesaDeSom" | "somLigado" | "trilha">;

/**
 * Converte o som do N5 para o modelo da mesa de som, sem perder nada que caiba:
 * - a trilha que tocava vira um ambiente ligado (o mesmo ponto: `inicioMs`);
 * - a trilha padrão de cada cena vira um ambiente da cena (`cena.ambientes`).
 * Cada arquivo ganha um lugar de ambiente (ícone de música, etiqueta âmbar, o nome do arquivo cortado em 12
 * letras); se os 8 lugares já estão cheios, a trilha antiga é descartada. Idempotente: sem som antigo devolve o
 * mesmo objeto. Funciona sobre o estado e sobre os dados de uma exportação.
 */
export function migrarSomDoN5<T extends ComSomAntigo>(estado: T): T {
  const temTrilhaDeCena = estado.cenas.some((c) => c.trilha !== undefined);
  if (estado.trilha === undefined && !temTrilhaDeCena) return estado;
  let mesa = estado.mesaDeSom;
  let ligado = estado.somLigado;
  const lugarPara = (hash: string, nome: string, volume: number): number | null => {
    const ambientes = lugaresDe(mesa).ambientes;
    const existente = ambientes.findIndex((x) => x?.hash === hash);
    if (existente >= 0) return existente;
    const livre = ambientes.indexOf(null);
    if (livre < 0) return null;
    mesa = comLugar(mesa, "ambiente", livre, {
      hash,
      nome: (nome.replace(/\.[^.]+$/, "").trim() || "Som").slice(0, MAXIMO_DO_NOME_DO_LUGAR),
      icone: "musica",
      cor: "ambar",
      volume,
    });
    return livre;
  };
  const { trilha: tocando, ...semTrilha } = estado;
  if (tocando !== undefined) {
    const i = lugarPara(tocando.hash, tocando.nome, tocando.volume);
    if (i !== null && !(ligado?.ambientes ?? []).some((a) => a.indice === i)) {
      ligado = {
        volumeGeral: ligado?.volumeGeral ?? VOLUME_GERAL_PADRAO,
        ambientes: [
          ...(ligado?.ambientes ?? []),
          {
            indice: i,
            hash: tocando.hash,
            volume: tocando.volume,
            inicioMs: tocando.inicioMs,
            ...(tocando.servidorMs === undefined ? {} : { servidorMs: tocando.servidorMs }),
          },
        ],
      };
    }
  }
  // A trilha da cena vem depois: o que tocava ocupa o primeiro lugar livre.
  const cenas = estado.cenas.map((c) => {
    const { trilha, ...resto } = c;
    if (trilha === undefined) return c;
    const i = lugarPara(trilha.hash, trilha.nome, trilha.volume);
    const ambientes = new Set(c.ambientes ?? []);
    if (i !== null) ambientes.add(i);
    return {
      ...resto,
      ...(ambientes.size > 0 ? { ambientes: [...ambientes].sort((a, b) => a - b) } : {}),
    };
  });
  return {
    ...semTrilha,
    cenas,
    ...(mesa ? { mesaDeSom: mesa } : {}),
    ...(ligado ? { somLigado: ligado } : {}),
  } as T;
}
