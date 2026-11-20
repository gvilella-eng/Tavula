import { z } from "zod";
import {
  BotaoDeEventoSchema,
  CicloSchema,
  EVENTOS_DO_SISTEMA,
  MAXIMO_DE_BOTOES,
  MAXIMO_DO_REGISTRO,
  ReacaoSchema,
} from "./automacoesLegado.ts";
import type { Estado, Token } from "./estado.ts";
import {
  EsperandoSchema,
  ExecucaoDoFluxoSchema,
  FluxoSchema,
  MAXIMO_DE_EXECUCOES_ESPERANDO,
  MAXIMO_DE_FLUXOS,
} from "./fluxos.ts";
import { migrarAutomacoes } from "./fluxosConversao.ts";
import { noDeGatilhoDoTipo, temGatilho } from "./fluxosGrafo.ts";
import { CorDoSomSchema, IconeDoSomSchema } from "./mesadesom.ts";

export * from "./automacoesLegado.ts";
export * from "./fluxos.ts";
export * from "./fluxosCaixas.ts";
export * from "./fluxosConversao.ts";
export * from "./fluxosFrase.ts";
export * from "./fluxosGrafo.ts";
export * from "./fluxosLeitura.ts";
export * from "./fluxosValidar.ts";

// ---------------------------------------------------------------------------------------------
// Automações da mesa (seção 4.11), desde o AU1 por blocos (fluxos). Este arquivo tem a fatia do estado e as funções puras
// de leitura; o motor que as executa fica em `automacoesnucleo.ts`, o que fala em português em `fluxosFrase.ts`.
//
// Sigilo (regra 7): as definições (fluxos, a execução do relógio, as execuções esperando e o registro) moram na fatia
// `Estado.automacoes`, que SÓ o mestre recebe. O jogador recebe apenas os efeitos: a luz que mudou (`fonte.editada`), o
// anúncio no chat, o token mostrado e o limite de visão (`Estado.efeitos`, sem a origem).
// ---------------------------------------------------------------------------------------------

const Id = z.string().min(1).max(64);

export const ItemDoRegistroSchema = z.object({
  emSala: z.number().nonnegative(),
  texto: z.string().max(200),
});

/** O formato antigo, guardado só para leitura (não roda). */
export const LegadoSchema = z.object({
  ciclos: z.array(CicloSchema).max(100).default([]),
  reacoes: z.array(ReacaoSchema).max(600).default([]),
  botoes: z.array(BotaoDeEventoSchema).max(100).default([]),
});
export type Legado = z.infer<typeof LegadoSchema>;

const AutomacoesCorpoSchema = z.object({
  fluxos: z.array(FluxoSchema).max(MAXIMO_DE_FLUXOS).default([]),
  /** Por id de fluxo de relógio. Fluxo sem execução ainda não começou: o motor a cria no primeiro instante com a mesa rodando. */
  execucao: z.record(Id, ExecucaoDoFluxoSchema).default({}),
  esperando: z.array(EsperandoSchema).max(MAXIMO_DE_EXECUCOES_ESPERANDO).default([]),
  /** Quando cada fluxo rodou por último, no tempo da sala (a lista mostra "rodou há 4 min"). */
  ultimaVez: z.record(Id, z.number()).default({}),
  /** O que o motor quis dizer ao mestre (encadeamento cortado, ações sem alvo). Só as últimas. */
  registro: z.array(ItemDoRegistroSchema).max(MAXIMO_DO_REGISTRO).default([]),
  /** Ciclos, reações e botões do formato antigo, de antes da conversão em fluxos. Só leitura. */
  legado: LegadoSchema.optional(),
});

/**
 * Tudo o que é definição ou controle de automação: SÓ o mestre recebe. Lê o formato antigo (ciclos, reações, botões) e o
 * converte em fluxos (`migrarAutomacoes`).
 */
export const AutomacoesSchema = z.preprocess(migrarAutomacoes, AutomacoesCorpoSchema);
export type Automacoes = z.infer<typeof AutomacoesCorpoSchema>;

export const AUTOMACOES_VAZIAS: Automacoes = {
  fluxos: [],
  execucao: {},
  esperando: [],
  ultimaVez: {},
  registro: [],
};

export function automacoesDe(estado: Pick<Estado, "automacoes">): Automacoes {
  return estado.automacoes ?? AUTOMACOES_VAZIAS;
}

// --- Os nomes dos eventos do sistema ---------------------------------------------------------

/** Os eventos do sistema com o nome que o mestre lê. */
export const NOME_AMIGAVEL_DO_EVENTO: Record<(typeof EVENTOS_DO_SISTEMA)[number], string> = {
  "objeto.acendeu": "Uma luz acendeu",
  "objeto.apagou": "Uma luz apagou",
  "turno.inicio": "Começou o turno de alguém",
  "cena.ativada": "A cena do grupo mudou",
  "token.entrouNaZona": "Um token entrou numa zona",
  "token.saiuDaZona": "Um token saiu de uma zona",
};

export function ehEventoDoSistema(nome: string): nome is (typeof EVENTOS_DO_SISTEMA)[number] {
  return (EVENTOS_DO_SISTEMA as readonly string[]).includes(nome);
}

/** O nome para mostrar: o amigável nos eventos do sistema, o próprio nome nos do mestre. */
export function nomeDoEvento(nome: string): string {
  return ehEventoDoSistema(nome) ? NOME_AMIGAVEL_DO_EVENTO[nome] : nome;
}

// --- Os botões na barra (7b-3) ---------------------------------------------------------------

/** Um disparo por usuário a cada tanto (o limite de frequência dos botões liberados; assumido). */
export const INTERVALO_MINIMO_DO_BOTAO_MS = 2000;

/** Pode disparar agora? `ultimo` é o instante do último disparo aceito deste usuário (ms), se houve. */
export function botaoDentroDoLimite(ultimo: number | undefined, agora: number): boolean {
  return ultimo === undefined || agora - ultimo >= INTERVALO_MINIMO_DO_BOTAO_MS;
}

/**
 * O botão como o JOGADOR o recebe: só o id (do fluxo, com o tipo na frente), o tipo e o rótulo. Nada da definição (trilhas,
 * cenas, o que o fluxo faz). Num fluxo de relógio vai também se está desligado, para o chip mostrar "Pausar" ou "Retomar".
 */
export const BotaoParaJogadorSchema = z.object({
  id: z.string().min(1).max(80),
  tipo: z.enum(["ciclo", "evento"]),
  nome: z.string().min(1).max(64),
  pausado: z.boolean().optional(),
  /** AU2: o botão como a mesa de eventos o mostra (o rótulo do gatilho, a cor e o ícone). */
  rotulo: z.string().min(1).max(64).optional(),
  cor: CorDoSomSchema.optional(),
  icone: IconeDoSomSchema.optional(),
});
export type BotaoParaJogador = z.infer<typeof BotaoParaJogadorSchema>;
export const MAXIMO_DE_BOTOES_DO_JOGADOR = MAXIMO_DE_BOTOES + 50;

/** O id do botão de um fluxo de relógio (`ciclo:`) ou de botão (`evento:`), como o chip e o `botao.usar` o conhecem. */
export const idDoBotaoDeCiclo = (fluxoId: string) => `ciclo:${fluxoId}`;
export const idDoBotaoDeEvento = (fluxoId: string) => `evento:${fluxoId}`;

/** Os botões liberados, na ordem dos fluxos. Vazio quando não há automação. */
export function botoesParaJogador(automacoes: Pick<Automacoes, "fluxos">): BotaoParaJogador[] {
  const saida: BotaoParaJogador[] = [];
  for (const f of automacoes.fluxos) {
    if (f.liberadoParaJogadores !== true || f.rascunho === true) continue;
    if (temGatilho(f, "relogio")) {
      saida.push({ id: idDoBotaoDeCiclo(f.id), tipo: "ciclo", nome: f.nome, pausado: !f.ligado });
    }
    const botao = noDeGatilhoDoTipo(f, "botao")?.config;
    if (botao?.tipo === "botao" && f.ligado) {
      saida.push({
        id: idDoBotaoDeEvento(f.id),
        tipo: "evento",
        nome: f.nome,
        rotulo: botao.nome,
        ...(botao.cor === undefined ? {} : { cor: botao.cor }),
        ...(botao.icone === undefined ? {} : { icone: botao.icone }),
      });
    }
  }
  return saida.slice(0, MAXIMO_DE_BOTOES_DO_JOGADOR);
}

// --- O relógio dos fluxos --------------------------------------------------------------------

/** O tempo do fluxo (τ, em ms) no instante `salaMs`. */
export function tauDoFluxo(
  exec: { baseSala: number; pausadoEmTau?: number | undefined },
  salaMs: number,
): number {
  return exec.pausadoEmTau ?? Math.max(0, salaMs - exec.baseSala);
}

/**
 * Onde o fluxo de relógio está agora, para a lista e o chip: se corre, e em quantos ms ele dispara de novo (`null` quando
 * não anda: desligado, rascunho, ou outro gatilho). Fluxo que ainda não começou dispara no primeiro instante com a mesa
 * correndo.
 */
export function situacaoDoFluxo(
  fluxo: Pick<z.infer<typeof FluxoSchema>, "nos" | "ligado" | "rascunho">,
  exec: z.infer<typeof ExecucaoDoFluxoSchema> | undefined,
  salaMs: number,
): { rodando: boolean; proximaEmMs: number | null } {
  if (!temGatilho(fluxo, "relogio")) return { rodando: fluxo.ligado, proximaEmMs: null };
  const rodando = fluxo.ligado && fluxo.rascunho !== true;
  if (!rodando) return { rodando: false, proximaEmMs: null };
  if (exec === undefined) return { rodando, proximaEmMs: 0 };
  return { rodando, proximaEmMs: Math.max(0, exec.proximoTau - tauDoFluxo(exec, salaMs)) };
}

// --- Efeitos temporários em tokens ----------------------------------------------------------

/**
 * Um efeito temporário sobre um token (regra 2): um MODIFICADOR com prazo, nunca o valor base. O valor
 * final é a base mais os efeitos ativos. Sem `ateSala` o efeito vale "enquanto dentro" de uma zona (7b-2,
 * id `zona:<zona>:<token>`): a sala o põe ao entrar e o tira ao sair, desligar ou apagar. Hoje só o limite de visão (`visaoMaxM`, vale o menor); o efeito
 * de luz mora no próprio objeto (`ObjetoDeLuz.modificadores`, com `raioX` e `raioSomaM`).
 *
 * O jogador recebe só o que mexe no que ele vê: `alvo` e `efeito`, com um id opaco e SEM `ateSala` nem
 * `origem` (o nome do ciclo ou da reação nunca sai da sala).
 */
export const EfeitoSchema = z.object({
  id: z.string().min(1).max(200),
  alvo: z.object({ tipo: z.literal("token"), id: Id }),
  efeito: z.object({ visaoMaxM: z.number().min(0.5).max(1000).optional() }),
  /** No tempo da sala; sem ele, vale até alguém tirar. Só mestre e sala. */
  ateSala: z.number().nonnegative().optional(),
  /** Quem criou (a reação ou o ciclo), só para o mestre. */
  origem: z.string().max(80).optional(),
});
export type Efeito = z.infer<typeof EfeitoSchema>;

export const MAXIMO_DE_EFEITOS = 200;

/** Os efeitos que valem no instante `salaMs` (os sem prazo valem sempre). */
export function efeitosAtivos(efeitos: readonly Efeito[], salaMs: number): Efeito[] {
  return efeitos.filter((e) => e.ateSala === undefined || e.ateSala > salaMs);
}

/**
 * O limite de visão que vale para o token: o MENOR `visaoMaxM` entre os efeitos dele; `null` sem limite.
 * O cliente chama sem `salaMs` (a sala já tira os vencidos e avisa); a sala chama com ele.
 */
export function limiteDeVisaoDoToken(
  efeitos: readonly Efeito[] | undefined,
  tokenId: string,
  salaMs?: number,
): number | null {
  let menor: number | null = null;
  for (const e of efeitos ?? []) {
    if (e.alvo.id !== tokenId || e.efeito.visaoMaxM === undefined) continue;
    if (salaMs !== undefined && e.ateSala !== undefined && e.ateSala <= salaMs) continue;
    menor = menor === null ? e.efeito.visaoMaxM : Math.min(menor, e.efeito.visaoMaxM);
  }
  return menor;
}

/** O alcance final: a base (`null` = sem limite) e o limite de uma automação (`null` = nenhum); vale o menor. */
export function limitarAlcance(base: number | null, limite: number | null): number | null {
  if (limite === null) return base;
  return base === null ? limite : Math.min(base, limite);
}

/**
 * Os efeitos como o JOGADOR os recebe: um por token que ELE CONTROLA (a visão dos outros não muda o que ele
 * enxerga), com o menor limite, id opaco e sem prazo nem origem. Sem `salaMs` conta todos: é a sala quem tira os
 * vencidos e avisa, e comparar o antes e o depois não pode depender do relógio.
 */
export function efeitosParaJogador(
  efeitos: readonly Efeito[] | undefined,
  tokensDele: readonly Pick<Token, "id">[],
  salaMs?: number,
): Efeito[] {
  const saida: Efeito[] = [];
  for (const t of tokensDele) {
    const limite = limiteDeVisaoDoToken(efeitos, t.id, salaMs);
    if (limite !== null) {
      saida.push({
        id: `visao:${t.id}`,
        alvo: { tipo: "token", id: t.id },
        efeito: { visaoMaxM: limite },
      });
    }
  }
  return saida;
}
/**
 * Em quantos ms (do tempo da sala) acontece o próximo marco das automações: o disparo de um fluxo de relógio que roda, uma
 * execução esperando ou o fim de um efeito. `null` quando nada vai acontecer sozinho. Mesa pausada: nada (o chamador já
 * não agenda). O que já venceu conta como 0.
 */
export function proximoMarcoDasAutomacoes(
  estado: Pick<Estado, "automacoes" | "efeitos">,
  salaMs: number,
): number | null {
  const a = automacoesDe(estado);
  const candidatos: number[] = [];
  for (const f of a.fluxos) {
    if (f.rascunho || !f.ligado || !temGatilho(f, "relogio")) continue;
    const exec = a.execucao[f.id];
    if (exec === undefined) candidatos.push(0);
    else if (exec.pausadoEmTau === undefined)
      candidatos.push(exec.proximoTau - tauDoFluxo(exec, salaMs));
  }
  for (const p of a.esperando) candidatos.push(p.ateSala - salaMs);
  for (const e of estado.efeitos ?? []) {
    if (e.ateSala !== undefined) candidatos.push(e.ateSala - salaMs);
  }
  if (candidatos.length === 0) return null;
  return Math.max(0, Math.min(...candidatos));
}

// ---------------------------------------------------------------------------------------------
// O arquivo de campanha
// ---------------------------------------------------------------------------------------------

type Solto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Solto =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Lê a forma enxuta do arquivo de campanha (a do exemplo da 4.11) e a converte na fatia `automacoes`:
 * `dados.ciclos` no topo e `reacoes` dentro de cada modelo (a reação do modelo ganha `id` e
 * `fica: { tipo: "modelo", id }`). Reações de topo (`dados.reacoes`) valem como estão e podem
 * ter `fica` de cena ou da mesa. Se `dados.automacoes` já existe (a exportação da mesa), ele vence.
 * Devolve uma cópia do objeto sem `ciclos` no topo nem `reacoes` nos modelos; o que não for objeto passa
 * intacto (o schema reclama depois).
 */
export function converterAutomacoesDoArquivo(bruto: unknown): unknown {
  if (!ehObjeto(bruto) || !ehObjeto(bruto.dados)) return bruto;
  const dados = bruto.dados;
  const { ciclos, reacoes: reacoesDeTopo, modelos, ...resto } = dados;
  const modelosLimpos = Array.isArray(modelos)
    ? modelos.map((m) => {
        if (!ehObjeto(m)) return m;
        const { reacoes: _reacoes, ...semReacoes } = m;
        return semReacoes;
      })
    : modelos;
  const base: Solto = { ...resto, ...(modelos === undefined ? {} : { modelos: modelosLimpos }) };
  if (ehObjeto(dados.automacoes)) return { ...bruto, dados: base };
  const doModelo: unknown[] = [];
  if (Array.isArray(modelos)) {
    for (const m of modelos) {
      if (!ehObjeto(m) || !Array.isArray(m.reacoes)) continue;
      for (const [i, r] of m.reacoes.entries()) {
        if (!ehObjeto(r)) continue;
        doModelo.push({
          id: `reacao-${String(m.id)}-${i + 1}`,
          ...r,
          fica: { tipo: "modelo", id: m.id },
        });
      }
    }
  }
  const temCiclos = Array.isArray(ciclos) && ciclos.length > 0;
  const temReacoes =
    doModelo.length > 0 || (Array.isArray(reacoesDeTopo) && reacoesDeTopo.length > 0);
  if (!temCiclos && !temReacoes) return { ...bruto, dados: base };
  return {
    ...bruto,
    dados: {
      ...base,
      automacoes: {
        ciclos: Array.isArray(ciclos) ? ciclos : [],
        reacoes: [...(Array.isArray(reacoesDeTopo) ? reacoesDeTopo : []), ...doModelo],
      },
    },
  };
}
