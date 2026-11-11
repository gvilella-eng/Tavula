import type {
  ConfigDaMesa,
  Estado,
  ModeloDeObjeto,
  Modificador,
  ObjetoDeLuz,
  PontoDeLuz,
  Usuario,
} from "./estado.ts";
import { estagioDe, restanteDoObjeto, tempoDaSala } from "./relogio.ts";

type Visao = Pick<Usuario, "id" | "papel">;

// ---------------------------------------------------------------------------------------------
// Modelos de objeto da semente
// ---------------------------------------------------------------------------------------------

export const MODELO_TOCHA_ID = "modelo-tocha";
export const MODELO_LANTERNA_ID = "modelo-lanterna";
export const MODELO_FOGUEIRA_ID = "modelo-fogueira";

/** Semente: Tocha 5e (6 m + 6 m, 60 min), Lanterna (9 m + 9 m, 6 h) e Fogueira (infinita, sem mão). */
export function modelosPadrao(): ModeloDeObjeto[] {
  return [
    {
      id: MODELO_TOCHA_ID,
      nome: "Tocha 5e",
      luz: { claraM: 6, penumbraM: 6, cor: "#ffb347", tremula: true },
      duracaoS: 3600,
      ocupaMao: true,
      tags: ["chama"],
    },
    {
      id: MODELO_LANTERNA_ID,
      nome: "Lanterna",
      luz: { claraM: 9, penumbraM: 9, cor: "#ffd98a", tremula: false },
      duracaoS: 6 * 3600,
      ocupaMao: true,
      tags: ["chama"],
    },
    {
      id: MODELO_FOGUEIRA_ID,
      nome: "Fogueira",
      luz: { claraM: 6, penumbraM: 6, cor: "#ff9d3c", tremula: true },
      duracaoS: null,
      ocupaMao: false,
      tags: ["chama"],
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Alcance
// ---------------------------------------------------------------------------------------------

/** Quem ocupa quadrados: um token (centro e tamanho) ou um ponto (um quadrado só, o que o contém). */
export type Ocupante = { x: number; y: number; tamanhoQuadrados?: number };

/** Faixa de índices de quadrados [de, ate] (inclusive) que o ocupante cobre num eixo. */
function faixa(centro: number, tamanho: number, quadradoM: number): [number, number] {
  if (tamanho <= 0) {
    const i = Math.floor(centro / quadradoM + 1e-9);
    return [i, i];
  }
  const de = Math.round((centro - (tamanho * quadradoM) / 2) / quadradoM);
  return [de, de + tamanho - 1];
}

/**
 * Distância 5e no grid, em quadrados, entre os quadrados mais próximos ocupados por cada um (a
 * diagonal conta 1: Chebyshev). Dois vizinhos, inclusive na diagonal, estão a 1; o mesmo quadrado, a 0.
 */
export function distanciaEmQuadrados(a: Ocupante, b: Ocupante, quadradoM: number): number {
  const [ax0, ax1] = faixa(a.x, a.tamanhoQuadrados ?? 0, quadradoM);
  const [ay0, ay1] = faixa(a.y, a.tamanhoQuadrados ?? 0, quadradoM);
  const [bx0, bx1] = faixa(b.x, b.tamanhoQuadrados ?? 0, quadradoM);
  const [by0, by1] = faixa(b.y, b.tamanhoQuadrados ?? 0, quadradoM);
  const dx = Math.max(0, bx0 - ax1, ax0 - bx1);
  const dy = Math.max(0, by0 - ay1, ay0 - by1);
  return Math.max(dx, dy);
}

/**
 * `a` e `b` estão dentro do alcance de interação (entregar tocha, usar ponto)? Distância em quadrados
 * do 5e vezes o lado do quadrado ≤ `alcanceM`. Com 1,5 m e quadrado de 1,5 m, só os adjacentes.
 */
export function dentroDoAlcance(
  a: Ocupante,
  b: Ocupante,
  alcanceM: number,
  quadradoM: number,
): boolean {
  return distanciaEmQuadrados(a, b, quadradoM) * quadradoM <= alcanceM + 1e-9;
}

// ---------------------------------------------------------------------------------------------
// Mãos
// ---------------------------------------------------------------------------------------------

/** Os objetos que o personagem segura (portador `mao`). */
export function objetosNasMaos(luzes: readonly ObjetoDeLuz[], personagemId: string): ObjetoDeLuz[] {
  return luzes.filter((l) => l.portador.tipo === "mao" && l.portador.personagemId === personagemId);
}

/**
 * A primeira mão livre do personagem (0, 1...), ou `undefined` se as `maos` estão ocupadas. A tocha
 * apagada continua ocupando a mão até ser guardada.
 */
export function maoLivre(
  luzes: readonly ObjetoDeLuz[],
  personagemId: string,
  maos: number,
): number | undefined {
  const ocupadas = objetosNasMaos(luzes, personagemId);
  if (ocupadas.length >= maos) return undefined;
  const usadas = new Set(ocupadas.map((l) => (l.portador.tipo === "mao" ? l.portador.mao : -1)));
  for (let i = 0; i < maos; i++) if (!usadas.has(i)) return i;
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Modificadores e a visão enviada ao navegador
// ---------------------------------------------------------------------------------------------

/** Os modificadores que valem no instante `salaMs` (sem prazo ou com prazo no futuro). */
export function modificadoresAtivos(mods: readonly Modificador[], salaMs: number): Modificador[] {
  return mods.filter((m) => m.ateSala === undefined || m.ateSala > salaMs);
}

/** Produto dos `raioX` dos modificadores ativos (1 sem nenhum). */
export function fatorDosModificadores(mods: readonly Modificador[], salaMs: number): number {
  return modificadoresAtivos(mods, salaMs).reduce((p, m) => p * m.raioX, 1);
}

type ContextoDaVisao = Pick<Estado, "relogio" | "config" | "pontos">;

/**
 * O objeto como o navegador o recebe. `saldoMs` e `acesaDesdeSala` nunca saem da sala (nem para o
 * mestre). Calcula `restanteMs`, `contando` e `estagio` no instante `agoraMs`:
 * - mestre: tudo, mais modificadores e histórico;
 * - jogador, `tempoParaJogadores` = `exato`: `restanteMs` e `contando`; `estagio`: só o `estagio`;
 *   `oculto`: nenhum dos dois. O jogador nunca recebe o histórico, a lista de modificadores nem a
 *   duração (só o `fatorDeRaio` que vale);
 * - objeto num ponto escondido do jogador vira uma luz fixa naquela posição (o ponto não chega a ele).
 */
export function objetoParaVisao(
  objeto: ObjetoDeLuz,
  usuario: Visao,
  ctx: ContextoDaVisao,
  agoraMs: number,
): ObjetoDeLuz {
  const salaMs = tempoDaSala(ctx.relogio, agoraMs);
  const { saldoMs: _saldo, acesaDesdeSala: _desde, ...resto } = objeto;
  const restante = restanteDoObjeto(objeto, salaMs);
  const estagio =
    restante !== null && objeto.duracaoMs
      ? estagioDe(restante, objeto.duracaoMs, ctx.config.estagios)
      : undefined;
  const contando = objeto.estado === "acesa" && restante !== null && !ctx.relogio.pausada;
  const fator = fatorDosModificadores(objeto.modificadores, salaMs);
  const comFator = fator === 1 ? {} : { fatorDeRaio: fator };
  const tempo = restante === null ? {} : { restanteMs: restante, contando };
  if (usuario.papel === "mestre") {
    return { ...resto, ...comFator, ...tempo, ...(estagio ? { estagio } : {}) };
  }
  const modo = ctx.config.tempoParaJogadores;
  const { modificadores: _m, historico: _h, duracaoMs: _d, ...publico } = resto;
  let portador = publico.portador;
  let cenaId = publico.cenaId;
  if (portador.tipo === "ponto") {
    const id = portador.pontoId;
    const ponto = ctx.pontos.find((p) => p.id === id);
    if (ponto && !ponto.visivelParaJogadores) {
      portador = { tipo: "cena", x: ponto.x, y: ponto.y };
      cenaId = ponto.cenaId;
    }
  }
  return {
    ...publico,
    portador,
    ...(cenaId === undefined ? {} : { cenaId }),
    modificadores: [],
    historico: [],
    ...comFator,
    ...(modo === "exato" ? tempo : {}),
    ...(modo === "estagio" && estagio ? { estagio } : {}),
  };
}

/** O relógio como o navegador o recebe: pausada e o tempo da sala na hora (o jogador recebe 0). */
export function relogioParaVisao(
  relogio: Estado["relogio"],
  usuario: Visao,
  agoraMs: number,
): Estado["relogio"] {
  // O marco do "zerar o relógio" (V1) vai só ao mestre.
  return {
    pausada: relogio.pausada,
    acumuladoMs: usuario.papel === "mestre" ? tempoDaSala(relogio, agoraMs) : 0,
    ...(usuario.papel === "mestre" && relogio.marcoMs !== undefined
      ? { marcoMs: relogio.marcoMs }
      : {}),
  };
}

/** Os modelos como o jogador os vê: sem a duração real, salvo no modo `exato`. */
export function modelosParaJogador(
  modelos: readonly ModeloDeObjeto[],
  config: Pick<ConfigDaMesa, "tempoParaJogadores">,
): ModeloDeObjeto[] {
  if (config.tempoParaJogadores === "exato") return [...modelos];
  return modelos.map((m) => ({ ...m, duracaoS: m.duracaoS === null ? null : 1 }));
}

/** O ponto chega a este usuário? O mestre vê todos; os demais, só os visíveis da cena ativa. */
export function pontoVisivelPara(
  ponto: Pick<PontoDeLuz, "cenaId" | "visivelParaJogadores">,
  usuario: Visao,
  cenaAtivaId: string,
): boolean {
  if (usuario.papel === "mestre") return true;
  return ponto.cenaId === cenaAtivaId && ponto.visivelParaJogadores;
}
