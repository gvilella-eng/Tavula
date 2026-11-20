import {
  type Acao,
  type BotaoDeEvento,
  BotaoDeEventoSchema,
  type Ciclo,
  CicloSchema,
  type CondicaoDeReacao,
  ehEventoDoSistemaLegado,
  type Reacao,
  ReacaoSchema,
} from "./automacoesLegado.ts";
import {
  type AcaoDeFluxo,
  type AlvoDoParaCada,
  type Bloco,
  type Fluxo,
  type Gatilho,
  MAXIMO_DE_FLUXOS,
  PRAZO_PADRAO_S,
} from "./fluxos.ts";

// ---------------------------------------------------------------------------------------------
// AU1: da forma antiga (ciclos, reações e botões de evento) para os fluxos. Nada se perde: o que roda vira fluxo e o
// original fica guardado só para leitura. Roda na carga da mesa e na importação de um arquivo antigo.
// ---------------------------------------------------------------------------------------------

export type AutomacoesAntigas = {
  ciclos: Ciclo[];
  reacoes: Reacao[];
  botoes: BotaoDeEvento[];
};

type Solto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Solto =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Em que o evento da reação traz alguém: um objeto (acendeu, apagou), um token da zona, ou ninguém. */
function trazDoEvento(ao: string): "objeto" | "token" | "nada" {
  if (ao === "objeto.acendeu" || ao === "objeto.apagou") return "objeto";
  if (ao === "token.entrouNaZona" || ao === "token.saiuDaZona") return "token";
  return "nada";
}

function gatilhoDoSistema(r: Reacao, etiqueta: string | undefined): Gatilho | null {
  switch (r.ao) {
    case "objeto.acendeu":
    case "objeto.apagou":
      return {
        tipo: "tocha",
        muda: r.ao === "objeto.acendeu" ? "acende" : "apaga",
        ...(r.fica.tipo === "modelo" ? { modelo: r.fica.id } : {}),
        ...(etiqueta === undefined ? {} : { etiqueta }),
      };
    case "token.entrouNaZona":
    case "token.saiuDaZona":
      return {
        tipo: "zona",
        quando: r.ao === "token.entrouNaZona" ? "entra" : "sai",
        ...(r.fica.tipo === "zona" ? { zona: r.fica.id } : {}),
      };
    case "turno.inicio":
      return { tipo: "turno" };
    case "cena.ativada":
      return { tipo: "cena" };
    default:
      return null;
  }
}

function comPrazo(a: AcaoDeFluxo, duracaoS: number | undefined): AcaoDeFluxo {
  if (duracaoS === undefined) return a;
  if ((a.acao === "luz.modificar" || a.acao === "visao.limitar") && a.porS === undefined) {
    return { ...a, porS: duracaoS };
  }
  return a;
}

/** A condição antiga como bloco "se" ou "sortear" em volta de `dentro`. */
function envolverNaCondicao(
  c: CondicaoDeReacao,
  ficaZona: string | undefined,
  dentro: Bloco[],
): Bloco[] {
  switch (c.condicao) {
    case "chance":
      return [{ bloco: "sortear", chance: c.valor, sim: dentro, nao: [] }];
    case "tag":
      return [
        { bloco: "se", condicao: { condicao: "etiqueta", etiqueta: c.tag }, sim: dentro, nao: [] },
      ];
    case "cena":
      return [
        { bloco: "se", condicao: { condicao: "cena", cenas: c.cenas }, sim: dentro, nao: [] },
      ];
    case "dentroDaZona":
      return [
        {
          bloco: "se",
          condicao: { condicao: "dentroDaZona", zona: c.zona ?? ficaZona ?? "zona-inexistente" },
          sim: dentro,
          nao: [],
        },
      ];
  }
}

/** O corpo de uma reação, como blocos (o que acontece quando o gatilho dispara). */
function corpoDaReacao(
  r: Reacao,
  opcoes: {
    duracaoS: number | undefined;
    etiquetaNoGatilho: boolean;
    cenasDoEmissor: readonly string[] | null;
    sistema: boolean;
  },
): Bloco[] {
  const traz = trazDoEvento(r.ao);
  const ficaZona = r.fica.tipo === "zona" ? r.fica.id : undefined;
  const noModelo = r.fica.tipo === "modelo" && traz !== "objeto";
  const naZona = ficaZona === undefined ? {} : { naZona: ficaZona };

  const alvoDeObjetos = (
    extra: { modelo?: string | undefined; etiqueta?: string | undefined } = {},
  ): AlvoDoParaCada => ({
    tipo: "objetos",
    ...(extra.modelo === undefined ? {} : { modelo: extra.modelo }),
    ...(extra.etiqueta === undefined ? {} : { etiqueta: extra.etiqueta }),
    ...naZona,
  });

  const acoes: Bloco[] = [];
  for (const legada of r.fazer) {
    if (legada.acao === "evento.disparar") {
      acoes.push({
        bloco: "sinal",
        nome: legada.evento,
        ...(legada.atrasoS === undefined || legada.atrasoS === 0
          ? {}
          : { atrasoS: legada.atrasoS }),
      });
      continue;
    }
    const { alvo, ...sem } = legada as Acao & {
      alvo?: { modeloId?: string; tag?: string; ids?: string[] };
    };
    const acao = comPrazo(
      (legada.acao === "zona.ativar"
        ? {
            acao: "zona.ativar",
            zona: legada.zona ?? ficaZona ?? "zona-inexistente",
            ativa: legada.ativa,
          }
        : sem) as AcaoDeFluxo,
      opcoes.duracaoS,
    );
    const bloco: Bloco = { bloco: "acao", acao };
    const deObjeto =
      acao.acao === "luz.modificar" ||
      acao.acao === "objeto.apagar" ||
      acao.acao === "objeto.ajustarTempo";
    const deToken =
      acao.acao === "visao.limitar" ||
      acao.acao === "token.mostrar" ||
      acao.acao === "token.ocultar";
    if (deObjeto) {
      if (alvo !== undefined && (alvo.modeloId !== undefined || alvo.tag !== undefined)) {
        acoes.push({
          bloco: "paraCada",
          alvo: alvoDeObjetos({ modelo: alvo.modeloId, etiqueta: alvo.tag }),
          corpo: [bloco],
        });
      } else if (noModelo || traz === "objeto") acoes.push(bloco);
      else acoes.push({ bloco: "paraCada", alvo: alvoDeObjetos(), corpo: [bloco] });
    } else if (deToken) {
      if (alvo?.ids !== undefined) {
        acoes.push({
          bloco: "paraCada",
          alvo: { tipo: "tokens", ids: alvo.ids, ...naZona },
          corpo: [bloco],
        });
      } else if (traz === "token" || traz === "objeto" || noModelo) acoes.push(bloco);
      else acoes.push({ bloco: "paraCada", alvo: { tipo: "tokens", ...naZona }, corpo: [bloco] });
    } else acoes.push(bloco);
  }

  // As condições, da primeira (mais de fora) à última.
  let dentro = acoes;
  const condicoes = r.se.filter(
    (c, i) => !(opcoes.etiquetaNoGatilho && c.condicao === "tag" && i === primeiraTag(r.se)),
  );
  for (const c of [...condicoes].reverse()) dentro = envolverNaCondicao(c, ficaZona, dentro);

  if (noModelo && r.fica.tipo === "modelo") {
    dentro = [{ bloco: "paraCada", alvo: { tipo: "objetos", modelo: r.fica.id }, corpo: dentro }];
  }
  // A zona ligada (a reação de uma zona desligada não roda), exceto no próprio gatilho da zona.
  if (ficaZona !== undefined && traz !== "token") {
    dentro = [
      { bloco: "se", condicao: { condicao: "zonaLigada", zona: ficaZona }, sim: dentro, nao: [] },
    ];
  }
  // A reação presa a uma cena, dentro de um ciclo que vale em outras: só vale nela.
  if (r.fica.tipo === "cena" && opcoes.sistema === false) {
    const c = r.fica.id;
    const contida =
      opcoes.cenasDoEmissor !== null &&
      opcoes.cenasDoEmissor.length > 0 &&
      opcoes.cenasDoEmissor.every((x) => x === c);
    if (!contida)
      dentro = [{ bloco: "se", condicao: { condicao: "cena", cenas: [c] }, sim: dentro, nao: [] }];
  }
  return dentro;
}

const primeiraTag = (se: readonly CondicaoDeReacao[]): number =>
  se.findIndex((c) => c.condicao === "tag");

const idUnico = (usados: Set<string>, base: string): string => {
  let id = base.slice(0, 64);
  let n = 2;
  while (usados.has(id)) id = `${base.slice(0, 60)}-${n++}`;
  usados.add(id);
  return id;
};

/**
 * Converte. O ciclo vira um fluxo de relógio (uma trilha por fase: esperar o `emS`, e o que a fase faz); as reações cujo
 * evento só liga aquele ciclo a elas ficam dentro da trilha; as demais viram fluxos "ao receber o sinal" (ou o gatilho do
 * sistema) e o ciclo manda o sinal. O botão de evento vira um fluxo de botão que manda o sinal.
 */
export function converterParaFluxos(
  antigas: AutomacoesAntigas,
  execucaoAntiga: Record<string, { pausadoEmTau?: number | undefined }> = {},
): Fluxo[] {
  const { ciclos, reacoes, botoes } = antigas;
  const usados = new Set<string>();
  // Quantos emitem cada nome de evento (fases, botões e reações que o disparam).
  const emissores = new Map<string, number>();
  const mais = (nome: string) => emissores.set(nome, (emissores.get(nome) ?? 0) + 1);
  for (const c of ciclos) for (const f of c.fases) mais(f.evento);
  for (const b of botoes) mais(b.evento);
  for (const r of reacoes)
    for (const a of r.fazer) if (a.acao === "evento.disparar") mais(a.evento);

  const ouvintes = (nome: string) => reacoes.filter((r) => r.ao === nome);
  const podeEmbutir = (nome: string): boolean => {
    if (ehEventoDoSistemaLegado(nome) || emissores.get(nome) !== 1) return false;
    const ls = ouvintes(nome);
    return ls.length > 0 && ls.every((r) => r.ativa && r.rascunho !== true);
  };
  const embutidas = new Set<string>();
  const duracoesDoEvento = (nome: string): number[] => {
    const ds = new Set<number>();
    for (const c of ciclos)
      for (const f of c.fases)
        if (f.evento === nome && f.duracaoS !== undefined) ds.add(f.duracaoS);
    return [...ds];
  };

  const fluxos: Fluxo[] = [];
  for (const c of ciclos) {
    const ordenadas = [...c.fases].sort((a, b) => a.emS - b.emS);
    const trilhas: Bloco[][] = ordenadas.map((fase) => {
      const trilha: Bloco[] = [];
      if (fase.emS > 0) trilha.push({ bloco: "esperar", s: fase.emS });
      if (podeEmbutir(fase.evento)) {
        for (const r of ouvintes(fase.evento)) {
          embutidas.add(r.id);
          trilha.push(
            ...corpoDaReacao(r, {
              duracaoS: fase.duracaoS,
              etiquetaNoGatilho: false,
              cenasDoEmissor: c.cenas.length === 0 ? null : c.cenas,
              sistema: false,
            }),
          );
        }
      } else trilha.push({ bloco: "sinal", nome: fase.evento });
      return trilha;
    });
    const parado = execucaoAntiga[c.id]?.pausadoEmTau !== undefined;
    fluxos.push({
      id: idUnico(usados, c.id),
      nome: c.nome,
      ligado: !parado,
      cenas: c.cenas.length === 0 ? null : [...c.cenas],
      ...(c.fixado === undefined ? {} : { fixado: c.fixado }),
      ...(c.liberadoParaJogadores === undefined
        ? {}
        : { liberadoParaJogadores: c.liberadoParaJogadores }),
      ...(c.rascunho === undefined ? {} : { rascunho: c.rascunho }),
      gatilho: { tipo: "relogio", cadaS: c.periodoS },
      trilhas,
    });
  }

  for (const b of botoes) {
    fluxos.push({
      id: idUnico(usados, `botao-${b.id}`),
      nome: b.nome,
      ligado: true,
      cenas: null,
      ...(b.fixado === undefined ? {} : { fixado: b.fixado }),
      ...(b.liberadoParaJogadores === undefined
        ? {}
        : { liberadoParaJogadores: b.liberadoParaJogadores }),
      ...(b.rascunho === undefined ? {} : { rascunho: b.rascunho }),
      gatilho: {
        tipo: "botao",
        nome: b.nome,
        ...(b.cenaId === undefined ? {} : { cena: b.cenaId }),
      },
      trilhas: [[{ bloco: "sinal", nome: b.evento }]],
    });
  }

  for (const r of reacoes) {
    if (embutidas.has(r.id)) continue;
    const etiqueta =
      trazDoEvento(r.ao) === "objeto" ? r.se.find((c) => c.condicao === "tag") : undefined;
    const tag = etiqueta?.condicao === "tag" ? etiqueta.tag : undefined;
    const gatilho = gatilhoDoSistema(r, tag) ?? { tipo: "sinal" as const, nome: r.ao };
    const duracoes = gatilho.tipo === "sinal" ? duracoesDoEvento(r.ao) : [];
    const corpo = corpoDaReacao(r, {
      duracaoS: duracoes.length === 1 ? duracoes[0] : undefined,
      etiquetaNoGatilho: tag !== undefined,
      cenasDoEmissor: null,
      sistema: gatilho.tipo !== "sinal",
    });
    fluxos.push({
      id: idUnico(usados, `rx-${r.id}`),
      nome: r.nome ?? `Ao receber ${r.ao}`,
      ligado: r.ativa,
      cenas: r.fica.tipo === "cena" ? [r.fica.id] : null,
      ...(r.rascunho === undefined ? {} : { rascunho: r.rascunho }),
      gatilho,
      trilhas: [corpo],
    });
  }
  return fluxos.slice(0, MAXIMO_DE_FLUXOS);
}

/**
 * A fatia de automações como vem do disco ou de um arquivo: se traz o formato antigo (ciclos, reações, botões), converte
 * em fluxos e guarda o original em `legado`. Já no formato novo passa como está. O estado de execução e os eventos pendentes
 * do formato antigo não valem mais (o relógio dos fluxos recomeça).
 */
export function migrarAutomacoes(bruto: unknown): unknown {
  if (!ehObjeto(bruto)) return bruto;
  const { ciclos, reacoes, botoes, pendentes: _pendentes, execucao, ...resto } = bruto;
  const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const parseia = <T>(
    itens: unknown[],
    schema: { safeParse: (x: unknown) => { success: boolean; data?: T } },
  ): T[] =>
    itens.flatMap((i) => {
      const r = schema.safeParse(i);
      return r.success ? [r.data as T] : [];
    });
  const antigas: AutomacoesAntigas = {
    ciclos: parseia<Ciclo>(lista(ciclos), CicloSchema),
    reacoes: parseia<Reacao>(lista(reacoes), ReacaoSchema),
    botoes: parseia<BotaoDeEvento>(lista(botoes), BotaoDeEventoSchema),
  };
  const execNova = Object.fromEntries(
    Object.entries(ehObjeto(execucao) ? execucao : {}).filter(
      ([, v]) => ehObjeto(v) && typeof v.proximoTau === "number",
    ),
  );
  const execAntiga = Object.fromEntries(
    Object.entries(ehObjeto(execucao) ? execucao : {}).filter(
      ([, v]) => ehObjeto(v) && typeof v.disparadoAteTau === "number",
    ),
  ) as Record<string, { pausadoEmTau?: number; baseSala?: number; disparadoAteTau?: number }>;
  const temAntigas = antigas.ciclos.length + antigas.reacoes.length + antigas.botoes.length > 0;
  const base: Solto = { ...resto };
  if (Object.keys(execNova).length > 0) base.execucao = execNova;
  if (!temAntigas) return base;
  const convertidos = converterParaFluxos(antigas, execAntiga);
  const jaTem = lista(resto.fluxos);
  base.fluxos = jaTem.length > 0 ? jaTem : convertidos;
  // Ciclo que estava pausado continua pausado; o que corria recomeça no próximo período (o que faltava deste não roda).
  const exec: Record<string, unknown> = { ...execNova };
  for (const c of antigas.ciclos) {
    const ex = execAntiga[c.id];
    if (ex === undefined || jaTem.length > 0) continue;
    const periodo = c.periodoS * 1000;
    const proximoTau = Math.floor(Math.max(0, ex.disparadoAteTau ?? 0) / periodo + 1) * periodo;
    exec[c.id] = {
      baseSala: ex.baseSala ?? 0,
      ...(ex.pausadoEmTau === undefined ? {} : { pausadoEmTau: ex.pausadoEmTau }),
      proximoTau,
    };
  }
  if (Object.keys(exec).length > 0) base.execucao = exec;
  const legadoAntes = ehObjeto(resto.legado) ? resto.legado : {};
  base.legado = {
    ciclos: [...lista(legadoAntes.ciclos), ...antigas.ciclos],
    reacoes: [...lista(legadoAntes.reacoes), ...antigas.reacoes],
    botoes: [...lista(legadoAntes.botoes), ...antigas.botoes],
  };
  return base;
}

/** O prazo padrão, para quem lê a conversão. */
export const PRAZO_PADRAO_DA_CONVERSAO_S = PRAZO_PADRAO_S;
