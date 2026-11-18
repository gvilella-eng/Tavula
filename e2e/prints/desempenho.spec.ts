import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, CDPSession, Page } from "@playwright/test";
import { abrirAba, test as base, expect, Mesa, type Sessao } from "../tests/ajudas";
import { arquivoPng, assets, definirMapa, pngDeRuido } from "../tests/ajudasAssets";
import { ClaudeWs, gerarToken } from "../tests/ajudasClaude";
import { abrirFicha, FICHA_DARION, mandar } from "../tests/ajudasFicha";
import { entrarNoMapa, type GanchoDoMapa, tokensDe } from "../tests/ajudasMapa";

// Medição de desempenho (Playwright + Chrome DevTools Protocol): números ANTES e DEPOIS das otimizações das abas do
// painel, do compêndio e da ficha. Fora do `pnpm verify`:
//   $env:PRINTS_DIR="<pasta>"; $env:MEDIDA="<rótulo>"; pnpm --filter @tabletop/e2e prints desempenho
// Grava `desempenho-<rótulo>.json` na PRINTS_DIR e imprime uma tabela. É só medição: os `expect` conferem que a cena foi
// montada e que os eventos chegaram, nunca um limite de tempo. O roteiro usa só a tela, os `data-testid` e as ajudas
// de e2e/tests, para rodar igual no código de hoje e no código depois da mudança.
//
// Cena pesada: 45x45 quadrados, ~160 paredes, 5 tokens de personagem (um conjurador com 30 magias), ~400 mensagens no
// chat e um compêndio sintético grande (1.000 magias, 300 monstros, 300 itens, 200 itens mágicos). O mestre (1600x900)
// é a página observada; os eventos vêm de WebSockets de Node (o jeito do Claude), sem abrir outra página.

const PASTA = process.env.PRINTS_DIR;
if (!PASTA) throw new Error("Defina PRINTS_DIR (a pasta onde o JSON da medição será gravado).");
mkdirSync(PASTA, { recursive: true });
const ROTULO = (process.env.MEDIDA ?? "sem-rotulo").replace(/[^\w.-]+/g, "-");

const AQUECIMENTOS = 1;
const REPETICOES = 3;
/** A rajada do cenário A: 40 mensagens, uma a cada 50 ms. */
const RAJADA = 40;
const PASSO_DA_RAJADA_MS = 50;
const TEXTO_DIGITADO = "Aventureiro de teste de desempenho 0123456789".slice(0, 40);
const ASSENTAR_MS = 500;
/** Liga os perfis de CPU (uma execução extra depois das repetições medidas). */
const PERFIL = process.env.MEDIDA_PERFIL === "1";
/** Filtro de cenários: nomes (ou começos de nome) separados por vírgula, ex.: "A0" ou "B1,C0". Sem ele, todos. */
const SO = (process.env.MEDIDA_SO ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const roda = (nome: string) => SO.length === 0 || SO.some((s) => nome.startsWith(s));
/** Quadros do código da página (PixiJS) a cada tanto: 0 deixa livre (60 por segundo). Ver `instalarSondas`. */
const RAF_DA_PAGINA_MS = Number(process.env.MEDIDA_RAF_MS ?? 0);
/** Servidor web de produção (vite build + preview), pelo `playwright.medidas.config.ts` com MEDIDA_PROD=1. */
const PRODUCAO = process.env.MEDIDA_PROD === "1";

const CONJURADOR = "pers-conjurador-medida";
const CAMINHO_DO_COMPENDIO = "compendio/magias.json";

// ---------------------------------------------------------------------------------------------
// Dados sintéticos (determinísticos: nada de arquivo no repositório)
// ---------------------------------------------------------------------------------------------

const ELEMENTOS = [
  "Chama",
  "Gelo",
  "Raio",
  "Sombra",
  "Luz",
  "Vento",
  "Pedra",
  "Mar",
  "Aço",
  "Sangue",
];
const ADJETIVOS = [
  "Ardente",
  "Sagrado",
  "Antigo",
  "Profundo",
  "Cruel",
  "Brilhante",
  "Sereno",
  "Fatal",
  "Oculto",
  "Real",
];
const DONOS = [
  "Aldric",
  "Brisa",
  "Cael",
  "Darion",
  "Eldoria",
  "Fenrir",
  "Garra",
  "Hexa",
  "Ilmar",
  "Jorund",
];
const ESCOLAS = [
  "Abjuração",
  "Adivinhação",
  "Conjuração",
  "Encantamento",
  "Evocação",
  "Ilusão",
  "Necromancia",
  "Transmutação",
];
const CLASSES = [
  "Mago",
  "Feiticeiro",
  "Clérigo",
  "Bardo",
  "Druida",
  "Bruxo",
  "Paladino",
  "Patrulheiro",
];
const ATRIBUTOS_SINTETICOS = { for: 12, des: 14, con: 13, int: 10, sab: 11, car: 9 };

/** Um nome distinto por índice (até 1.000): "Chama Ardente de Aldric". */
const nomeSintetico = (i: number, base: string[] = ELEMENTOS) =>
  `${base[i % 10]} ${ADJETIVOS[Math.floor(i / 10) % 10]} de ${DONOS[Math.floor(i / 100) % 10]}`;

/** Um texto de tamanho parecido com o de um livro (cerca de `alvo` caracteres), diferente a cada índice. */
function textoLongo(i: number, alvo: number): string {
  const frase = `A criatura ou o objeto no alcance sofre o efeito número ${i} e deve realizar uma salvaguarda; se falhar, sofre dano e fica desorientado até o fim do próximo turno. `;
  let t = "";
  while (t.length < alvo) t += frase;
  return t.slice(0, alvo).trim();
}

/** O compêndio sintético no formato que `lerCompendio` aceita (um arquivo só, com todos os tipos). */
function compendioSintetico(): string {
  const magias = Array.from({ length: 1000 }, (_, i) => ({
    nome: nomeSintetico(i),
    nomeOriginal: `Synthetic Spell ${String(i).padStart(4, "0")}`,
    nivel: i % 10,
    escola: ESCOLAS[i % ESCOLAS.length] as string,
    tempo: "1 ação",
    alcance: `${9 + (i % 5) * 9} metros`,
    componentes: "V, S, M (um pedaço de coisa sintética)",
    duracao: i % 3 === 0 ? "Concentração, até 1 minuto" : "Instantânea",
    concentracao: i % 3 === 0,
    ritual: i % 7 === 0,
    classes: [CLASSES[i % CLASSES.length] as string, CLASSES[(i + 3) % CLASSES.length] as string],
    descricao: textoLongo(i, 900 + (i % 5) * 150),
    emNiveisSuperiores: textoLongo(i + 1, 200),
  }));
  const monstros = Array.from({ length: 300 }, (_, i) => ({
    nome: `${nomeSintetico(i, ADJETIVOS)} Besta ${i}`,
    tamanho: "Médio",
    tipo: "Fera",
    ca: { valor: 10 + (i % 8) },
    pv: { media: 10 + (i % 90), formula: "4d8 + 8" },
    deslocamento: "9 m",
    deslocamentoM: 9,
    atributos: ATRIBUTOS_SINTETICOS,
    nd: "1",
    tracos: [{ nome: "Traço sintético", texto: textoLongo(i, 300) }],
    acoes: [
      {
        nome: "Mordida",
        texto: textoLongo(i, 200),
        tipo: "cac",
        acerto: 4,
        alcance: "1,5 m",
        dano: "1d6+2",
        tipoDeDano: "perfurante",
      },
    ],
  }));
  const itens = Array.from({ length: 300 }, (_, i) => ({
    nome: `${nomeSintetico(i, DONOS)} (item ${i})`,
    descricao: textoLongo(i, 200),
    peso: 1 + (i % 5),
    custo: `${1 + (i % 50)} po`,
  }));
  const itensMagicos = Array.from({ length: 200 }, (_, i) => ({
    nome: `${nomeSintetico(i, ELEMENTOS)} (relíquia ${i})`,
    tipo: "maravilhoso",
    raridade: "incomum",
    descricao: textoLongo(i, 500),
  }));
  return JSON.stringify({
    formato: "tabletop-compendio",
    versao: 1,
    creditos: "Compêndio sintético gerado pela medição de desempenho.",
    magias,
    monstros,
    itens,
    itensMagicos,
  });
}

/** As magias da ficha do conjurador: 30, de truques ao 5º nível. */
function magiasDaFicha() {
  return Array.from({ length: 30 }, (_, i) => ({
    nome: `Magia da ficha ${String(i + 1).padStart(2, "0")}`,
    nivel: i % 6,
    preparada: i % 2 === 0,
    escola: ESCOLAS[i % ESCOLAS.length] as string,
    descricao: textoLongo(i, 400),
    tempo: "1 ação",
    componentes: "V, S",
    duracao: "Instantânea",
  }));
}

/** ~160 segmentos de parede em quadrados de 1,5 m, de 2 a 6 quadrados, num gerador congruente (sempre os mesmos). */
function paredesDeTeste(quantidade = 160) {
  let semente = 20_251_113;
  const sorteio = () => {
    semente = (Math.imul(semente, 1_103_515_245) + 12_345) >>> 0;
    return semente / 2 ** 32;
  };
  const Q = 1.5;
  return Array.from({ length: quantidade }, (_, i) => {
    const horizontal = sorteio() < 0.5;
    const compr = 2 + Math.floor(sorteio() * 5);
    const gx = 1 + Math.floor(sorteio() * (43 - compr));
    const gy = 1 + Math.floor(sorteio() * (43 - compr));
    const a = { x: gx * Q, y: gy * Q };
    const b = horizontal ? { x: (gx + compr) * Q, y: gy * Q } : { x: gx * Q, y: (gy + compr) * Q };
    const tipo = i % 12 === 5 ? "porta" : i % 17 === 3 ? "janela" : "parede";
    return { id: `par-medida-${String(i).padStart(3, "0")}`, a, b, tipo };
  });
}

// ---------------------------------------------------------------------------------------------
// Sondas na página (tarefas longas, Event Timing e latência de cada tecla) e métricas do CDP
// ---------------------------------------------------------------------------------------------

type Sondas = {
  longas: { ini: number; dur: number }[];
  eventos: { nome: string; dur: number }[];
  teclas: number[];
  /** O instante (performance.now) da última tarefa longa terminada, ou do último `zerar`. */
  ultima: number;
  zerar(): void;
};

/**
 * Roda dentro da página (via `addInitScript`, para sobreviver ao reload, e via `evaluate`, para a página atual).
 * `rafMs` > 0 espaça os quadros do código da PÁGINA (o laço do PixiJS gasta quase todo o tempo da tela com a cena
 * pesada e afogaria a diferença que se quer ver); o React não usa rAF, e o Playwright roda em outro mundo de scripts.
 */
function instalarSondas(opcoes: { rafMs: number }) {
  const w = window as unknown as { __med?: Sondas };
  if (w.__med) return;
  const rafNativo = window.requestAnimationFrame.bind(window);
  const cancelarNativo = window.cancelAnimationFrame.bind(window);
  if (opcoes.rafMs > 0) {
    const internos = new Map<number, number>();
    window.requestAnimationFrame = (cb) => {
      const t = window.setTimeout(() => {
        internos.set(
          t,
          rafNativo((agora) => {
            internos.delete(t);
            cb(agora);
          }),
        );
      }, opcoes.rafMs);
      return t;
    };
    window.cancelAnimationFrame = (id) => {
      window.clearTimeout(id);
      const interno = internos.get(id);
      if (interno !== undefined) cancelarNativo(interno);
      internos.delete(id);
    };
  }
  const med: Sondas = {
    longas: [],
    eventos: [],
    teclas: [],
    ultima: performance.now(),
    zerar() {
      med.longas = [];
      med.eventos = [];
      med.teclas = [];
      med.ultima = performance.now();
    },
  };
  w.__med = med;
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        med.longas.push({ ini: e.startTime, dur: e.duration });
        med.ultima = Math.max(med.ultima, e.startTime + e.duration);
      }
    }).observe({ type: "longtask" });
  } catch {
    // o navegador sem longtask: a medição segue sem essa parte
  }
  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        if (e.name === "keydown" || e.name === "input") {
          med.eventos.push({ nome: e.name, dur: e.duration });
        }
      }
    }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    // idem para o Event Timing
  }
  // O Event Timing só relata eventos de 16 ms ou mais: para ter a mediana de TODAS as teclas, cada keydown também
  // mede o tempo até a pintura seguinte (rAF + uma tarefa depois dele).
  document.addEventListener(
    "keydown",
    (e) => {
      const t = e.timeStamp;
      rafNativo(() => setTimeout(() => med.teclas.push(performance.now() - t), 0));
    },
    true,
  );
}

type Metricas = { script: number; tarefa: number; layout: number; estilo: number };

async function lerMetricas(cdp: CDPSession): Promise<Metricas> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = new Map(metrics.map((x) => [x.name, x.value]));
  return {
    script: m.get("ScriptDuration") ?? 0,
    tarefa: m.get("TaskDuration") ?? 0,
    layout: m.get("LayoutDuration") ?? 0,
    estilo: m.get("RecalcStyleDuration") ?? 0,
  };
}

type EventoDeTraco = {
  ph: string;
  name: string;
  pid: number;
  tid: number;
  ts: number;
  dur?: number;
  args?: { name?: string };
};

const NOMES_DE_SCRIPT = new Set([
  "FunctionCall",
  "EvaluateScript",
  "v8.run",
  "v8.compile",
  "v8.compileModule",
  "v8.evaluateModule",
]);

/**
 * Soma, no traço do Chrome (o que o Performance do DevTools grava), o que a thread principal da página gastou: tarefas,
 * script (só as chamadas de nível mais alto, sem contar as aninhadas), layout e recálculo de estilo. Serve para o
 * reload, onde o `Performance.getMetrics` zera junto com o documento.
 */
function somarTraco(buffer: Buffer): Metricas {
  const bruto = JSON.parse(buffer.toString("utf8")) as
    | EventoDeTraco[]
    | { traceEvents: EventoDeTraco[] };
  const eventos = Array.isArray(bruto) ? bruto : bruto.traceEvents;
  const principais = new Set(
    eventos
      .filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain")
      .map((e) => `${e.pid}:${e.tid}`),
  );
  const completos = eventos.filter(
    (e) => e.ph === "X" && typeof e.dur === "number" && principais.has(`${e.pid}:${e.tid}`),
  );
  const soma = (nome: string) =>
    completos.filter((e) => e.name === nome).reduce((s, e) => s + (e.dur as number), 0) / 1e6;
  let fim = 0;
  let script = 0;
  for (const e of completos
    .filter((x) => NOMES_DE_SCRIPT.has(x.name))
    .sort((a, b) => a.ts - b.ts || (b.dur as number) - (a.dur as number))) {
    if (e.ts >= fim) {
      script += e.dur as number;
      fim = e.ts + (e.dur as number);
    }
  }
  return {
    script: script / 1e6,
    tarefa: soma("RunTask"),
    layout: soma("Layout"),
    estilo: soma("UpdateLayoutTree") + soma("RecalculateStyles"),
  };
}

/** Espera a página assentar: 500 ms sem tarefa longa (contados do fim da última, ou do último `zerar`). */
async function assentar(p: Page) {
  await p.waitForFunction(
    (ms) => {
      const m = (window as unknown as { __med?: Sondas }).__med;
      return m !== undefined && performance.now() - m.ultima > ms;
    },
    ASSENTAR_MS,
    { timeout: 30_000, polling: 100 },
  );
}

type Medida = Record<string, number>;

const arredonda = (n: number) => Math.round(n * 100) / 100;

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? (o[meio] as number) : ((o[meio - 1] as number) + (o[meio] as number)) / 2;
}

const resumo = (valores: number[]) => ({
  n: valores.length,
  mediana: arredonda(mediana(valores)),
  max: arredonda(valores.length ? Math.max(...valores) : 0),
});

// ---------------------------------------------------------------------------------------------
// O medidor
// ---------------------------------------------------------------------------------------------

type Cenario = {
  descricao: string;
  medidas: Medida[];
  mediana: Medida;
  /** (máximo - mínimo) / mediana, em %, do script e da tarefa total: quanto as repetições divergem. */
  variacaoPct: { script: number; tarefa: number };
};

const resultado: {
  rotulo: string;
  observacao: string;
  quando: string;
  ambiente: Record<string, unknown>;
  cenarios: Record<string, Cenario>;
  perfis: Record<string, ReturnType<typeof analisarPerfil>>;
} = {
  rotulo: ROTULO,
  observacao:
    "Servidor de teste em Vite no modo de DESENVOLVIMENTO (React de desenvolvimento, sem minificação): os números absolutos são maiores que em produção. O que vale é a comparação entre rótulos (antes x depois). Sem throttling de CPU. Cada cenário: 1 aquecimento descartado e 3 medidas na mesma página; deltas de Performance.getMetrics em ms (script, tarefa total, layout, recálculo de estilo), tarefas longas (>50 ms) e, na digitação, latência de cada tecla até a pintura e Event Timing (só eventos de 16 ms ou mais). Perfis (MEDIDA_PERFIL=1): Profiler do CDP a 200 us, numa execução extra depois das repetições; o tempo inclusivo soma todos os nós com o nome da função (um dentro do outro conta nos dois, e a recursão do mesmo nome conta uma vez): serve para ordem de grandeza, não para somar.",
  quando: new Date().toISOString(),
  ambiente: {},
  cenarios: {},
  perfis: {},
};

function gravar() {
  writeFileSync(
    join(PASTA as string, `desempenho-${ROTULO}.json`),
    `${JSON.stringify(resultado, null, 2)}\n`,
    "utf8",
  );
}

const variacao = (valores: number[]) => {
  const m = mediana(valores);
  return m === 0 ? 0 : arredonda(((Math.max(...valores) - Math.min(...valores)) / m) * 100);
};

function registrar(nome: string, descricao: string, medidas: Medida[]) {
  const chaves = [...new Set(medidas.flatMap((x) => Object.keys(x)))];
  const med: Medida = {};
  for (const k of chaves) med[k] = arredonda(mediana(medidas.map((m) => m[k] ?? 0)));
  resultado.cenarios[nome] = {
    descricao,
    medidas,
    mediana: med,
    variacaoPct: {
      script: variacao(medidas.map((m) => m.scriptMs as number)),
      tarefa: variacao(medidas.map((m) => m.tarefaMs as number)),
    },
  };
  gravar();
  const c = resultado.cenarios[nome] as Cenario;
  console.log(
    `[medida] ${nome.padEnd(34)} script ${String(med.scriptMs).padStart(8)} ms | tarefa ${String(med.tarefaMs).padStart(8)} ms | layout ${String(med.layoutMs).padStart(7)} | estilo ${String(med.estiloMs).padStart(7)} | longas ${med.longasQtd} (${med.longasMs} ms) | var ${c.variacaoPct.script}%/${c.variacaoPct.tarefa}%`,
  );
}

// ---------------------------------------------------------------------------------------------
// Perfil de CPU: tempo próprio por função, por arquivo e por grupo; tempo inclusivo dos componentes
// ---------------------------------------------------------------------------------------------

type NoDoPerfil = {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
};
type PerfilDoChrome = { nodes: NoDoPerfil[]; samples: number[]; timeDeltas: number[] };

const FUNCOES_INCLUSIVAS = [
  "Mesa",
  "AbaChat",
  "MensagemDoChat",
  "AbaFichas",
  "AbaCompendio",
  "AbaPreferencias",
  "AbaMesa",
  "BarraLateral",
  "JanelaDaFicha",
  "Mapa",
  "lerMensagemDaSala",
  "reduzir",
  "aplicarOperacoes",
  "derivar",
  "lerCompendio",
  "buscarEmTodas",
];

/** O caminho sem o host e sem a consulta (`?v=`, `?t=`): "/src/Mesa.tsx". */
function caminhoDoArquivo(url: string): string {
  if (!url) return "";
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url.split("?")[0] ?? url;
  }
}

const ABAS =
  /\/src\/(AbaChat|MensagemDoChat|AbaFichas|AbaCompendio|Compendio\w*|AbaMesa|abas|BarraLateral)\.tsx?$/;

function grupoDoArquivo(arquivo: string, nome: string): string {
  if (nome === "(program)" || nome === "(idle)" || nome === "(garbage collector)") return nome;
  if (arquivo === "") return "(sem arquivo: nativo/anônimo)";
  if (/\/(react|react-dom|scheduler)\b|react-dom|react_jsx|\/deps\/react|scheduler/.test(arquivo))
    return "react";
  if (/zod/i.test(arquivo)) return "zod";
  if (/pixi/i.test(arquivo)) return "pixi";
  if (/shared\/src\//.test(arquivo)) {
    const base = arquivo.split("/").pop() ?? "";
    if (/^nucleo/.test(base)) return "shared:nucleo";
    if (/^protocolo/.test(base)) return "shared:protocolo";
    if (/^ficha/.test(base)) return "shared:ficha";
    return "shared:resto";
  }
  if (/\/src\/mapa\//.test(arquivo)) return "mapa";
  if (ABAS.test(arquivo)) return "abas";
  if (/\/src\/ficha\//.test(arquivo)) return "ficha-tela";
  if (/\/src\/Mesa\.tsx$/.test(arquivo)) return "Mesa.tsx";
  if (/\/src\//.test(arquivo)) return "outros do app";
  return "outros (dependências: chunks do Vite e demais)";
}

/** Do perfil do Chrome: as tabelas (a) funções, (b) arquivos e grupos, e o inclusivo. Tempos em ms. */
function analisarPerfil(perfil: PerfilDoChrome) {
  const nos = new Map(perfil.nodes.map((n) => [n.id, n]));
  const proprio = new Map<number, number>();
  perfil.samples.forEach((id, i) => {
    // o intervalo da amostra i é o que passou até a amostra seguinte
    const dt = (perfil.timeDeltas[i + 1] ?? 0) / 1000;
    proprio.set(id, (proprio.get(id) ?? 0) + dt);
  });
  const total = [...proprio.values()].reduce((s, x) => s + x, 0);
  const pct = (ms: number) => arredonda(total === 0 ? 0 : (ms / total) * 100);
  const porFuncao = new Map<string, { nome: string; arquivo: string; ms: number }>();
  const porArquivo = new Map<string, number>();
  const porGrupo = new Map<string, number>();
  for (const [id, ms] of proprio) {
    const cf = (nos.get(id) as NoDoPerfil).callFrame;
    const arquivo = caminhoDoArquivo(cf.url);
    const nome = cf.functionName || `(anônima @${cf.lineNumber + 1})`;
    const chave = `${nome}|${arquivo}|${cf.lineNumber}`;
    const f = porFuncao.get(chave) ?? { nome, arquivo, ms: 0 };
    f.ms += ms;
    porFuncao.set(chave, f);
    const nomeDoArquivo = arquivo || nome;
    porArquivo.set(nomeDoArquivo, (porArquivo.get(nomeDoArquivo) ?? 0) + ms);
    const g = grupoDoArquivo(arquivo, cf.functionName);
    porGrupo.set(g, (porGrupo.get(g) ?? 0) + ms);
  }
  const ordenar = <T>(m: Map<string, T>, ms: (v: T) => number) =>
    [...m.entries()].sort((a, b) => ms(b[1]) - ms(a[1]));
  // inclusivo: própria + filhos; um nome já no caminho de cima não conta de novo (recursão)
  const incl = new Map<string, number>();
  // do app (apps/web/src, packages/shared; no build de produção, o pacote index-*.js): inclusivo e próprio por função,
  // e por arquivo só o das funções de topo (sem ancestral do mesmo arquivo)
  const doApp = new Map<string, { nome: string; arquivo: string; incl: number; proprio: number }>();
  const topoDoArquivo = new Map<string, number>();
  const emFuncao = new Map<string, number>();
  const emArquivo = new Map<string, number>();
  const somaInclusiva = (id: number, pilha: Set<string>): number => {
    const no = nos.get(id) as NoDoPerfil;
    const nome = no.callFrame.functionName;
    const arquivo = caminhoDoArquivo(no.callFrame.url);
    const ehApp = /\/src\/|\/assets\/index-/.test(arquivo) && !/node_modules/.test(arquivo);
    const chave = `${nome || `(anônima @${no.callFrame.lineNumber + 1})`}|${arquivo}|${no.callFrame.lineNumber}`;
    const conta = FUNCOES_INCLUSIVAS.includes(nome) && !pilha.has(nome);
    if (conta) pilha.add(nome);
    const primeiraDaFuncao = ehApp && !emFuncao.get(chave);
    const primeiraDoArquivo = ehApp && !emArquivo.get(arquivo);
    if (ehApp) {
      emFuncao.set(chave, (emFuncao.get(chave) ?? 0) + 1);
      emArquivo.set(arquivo, (emArquivo.get(arquivo) ?? 0) + 1);
    }
    const meu = proprio.get(id) ?? 0;
    let ms = meu;
    for (const filho of no.children ?? []) ms += somaInclusiva(filho, pilha);
    if (ehApp) {
      emFuncao.set(chave, (emFuncao.get(chave) ?? 1) - 1);
      emArquivo.set(arquivo, (emArquivo.get(arquivo) ?? 1) - 1);
      const f = doApp.get(chave) ?? {
        nome: nome || `(anônima @${no.callFrame.lineNumber + 1})`,
        arquivo,
        incl: 0,
        proprio: 0,
      };
      f.proprio += meu;
      if (primeiraDaFuncao) f.incl += ms;
      doApp.set(chave, f);
      if (primeiraDoArquivo) topoDoArquivo.set(arquivo, (topoDoArquivo.get(arquivo) ?? 0) + ms);
    }
    if (conta) {
      pilha.delete(nome);
      incl.set(nome, (incl.get(nome) ?? 0) + ms);
    }
    return ms;
  };
  somaInclusiva(perfil.nodes[0]?.id as number, new Set());
  return {
    inclusivoDoApp: [...doApp.values()]
      .sort((a, b) => b.incl - a.incl)
      .slice(0, 40)
      .map((f) => ({
        funcao: f.nome,
        arquivo: f.arquivo,
        inclusivoMs: arredonda(f.incl),
        proprioMs: arredonda(f.proprio),
      })),
    inclusivoPorArquivoDoApp: [...topoDoArquivo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([arquivo, ms]) => ({ arquivo, inclusivoMs: arredonda(ms) })),
    amostradoMs: arredonda(total),
    topFuncoes: ordenar(porFuncao, (f) => f.ms)
      .slice(0, 30)
      .map(([, f]) => ({
        funcao: f.nome,
        arquivo: f.arquivo,
        ms: arredonda(f.ms),
        pct: pct(f.ms),
      })),
    porArquivo: ordenar(porArquivo, (v) => v)
      .slice(0, 25)
      .map(([arquivo, ms]) => ({ arquivo, ms: arredonda(ms), pct: pct(ms) })),
    porGrupo: ordenar(porGrupo, (v) => v).map(([grupo, ms]) => ({
      grupo,
      ms: arredonda(ms),
      pct: pct(ms),
    })),
    inclusivo: FUNCOES_INCLUSIVAS.map((f) => ({ funcao: f, ms: arredonda(incl.get(f) ?? 0) })).sort(
      (a, b) => b.ms - a.ms,
    ),
  };
}

function registrarPerfil(nome: string, a: ReturnType<typeof analisarPerfil>) {
  resultado.perfis[nome] = a;
  gravar();
  console.log(`\n--- perfil ${nome} (amostrado ${a.amostradoMs} ms) ---`);
  console.log("grupos:", a.porGrupo.map((g) => `${g.grupo} ${g.ms} ms (${g.pct}%)`).join(" | "));
  console.log("do app (inclusivo / próprio):");
  for (const f of a.inclusivoDoApp.slice(0, 20)) {
    console.log(
      `  ${String(f.inclusivoMs).padStart(8)} / ${String(f.proprioMs).padStart(7)} ms  ${f.funcao}  ${f.arquivo}`,
    );
  }
  console.log("funções (próprio):");
  for (const f of a.topFuncoes.slice(0, 15)) {
    console.log(
      `  ${String(f.ms).padStart(8)} ms ${String(f.pct).padStart(5)}%  ${f.funcao}  ${f.arquivo}`,
    );
  }
  console.log(
    "inclusivo:",
    a.inclusivo
      .filter((x) => x.ms > 0)
      .map((x) => `${x.funcao} ${x.ms}`)
      .join(" | "),
  );
}

class Medidor {
  constructor(
    readonly browser: Browser,
    readonly p: Page,
    readonly cdp: CDPSession,
  ) {}

  /**
   * Uma medida: espera assentar, zera as sondas, roda `acao`, espera assentar e devolve os deltas. `comTraco`: lê o
   * traço do Chrome em vez do `Performance.getMetrics` (para o reload, que troca o documento).
   */
  async uma(acao: () => Promise<void>, comTeclas = false, comTraco = false): Promise<Medida> {
    await assentar(this.p);
    await this.p.evaluate(() => {
      (window as unknown as { __med: Sondas }).__med.zerar();
      (window as unknown as { __rendersDaFicha?: Record<string, number> }).__rendersDaFicha = {};
    });
    if (comTraco) {
      await this.browser.startTracing(this.p, {
        categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"],
      });
    }
    const antes = comTraco
      ? { script: 0, tarefa: 0, layout: 0, estilo: 0 }
      : await lerMetricas(this.cdp);
    const t0 = Date.now();
    await acao();
    await assentar(this.p);
    const duracaoMs = Date.now() - t0;
    const depois = comTraco
      ? somarTraco(await this.browser.stopTracing())
      : await lerMetricas(this.cdp);
    const lidas = await this.p.evaluate(() => {
      const m = (window as unknown as { __med: Sondas }).__med;
      const renders = (window as unknown as { __rendersDaFicha?: Record<string, number> })
        .__rendersDaFicha;
      return { longas: m.longas, eventos: m.eventos, teclas: m.teclas, renders: renders ?? {} };
    });
    const delta = (a: number, b: number) => (b - a) * 1000;
    const medida: Medida = {
      scriptMs: arredonda(delta(antes.script, depois.script)),
      tarefaMs: arredonda(delta(antes.tarefa, depois.tarefa)),
      layoutMs: arredonda(delta(antes.layout, depois.layout)),
      estiloMs: arredonda(delta(antes.estilo, depois.estilo)),
      longasQtd: lidas.longas.length,
      longasMs: arredonda(lidas.longas.reduce((s, l) => s + l.dur, 0)),
      duracaoMs,
      // fração da janela em que a thread principal esteve ocupada
      ocupacaoPct: arredonda((delta(antes.tarefa, depois.tarefa) / duracaoMs) * 100),
    };
    // Q14: quantas vezes cada seção da ficha redesenhou (contador só do modo de teste); "secoes" = quantas seções
    // diferentes redesenharam ao menos uma vez, "renders" = a soma de todos os redesenhos.
    const nomes = Object.keys(lidas.renders).filter((k) => k !== "JanelaDaFicha");
    if (Object.keys(lidas.renders).length > 0) {
      medida.secoesQueRenderizam = nomes.length;
      medida.rendersDeSecoes = nomes.reduce((t, k) => t + (lidas.renders[k] ?? 0), 0);
      medida.rendersDaJanela = lidas.renders.JanelaDaFicha ?? 0;
      for (const k of nomes) medida[`r:${k}`] = lidas.renders[k] ?? 0;
    }
    if (comTeclas) {
      const tecla = resumo(lidas.teclas);
      const evento = resumo(lidas.eventos.map((e) => e.dur));
      medida.teclasN = tecla.n;
      medida.teclaMedianaMs = tecla.mediana;
      medida.teclaMaxMs = tecla.max;
      medida.eventTimingN = evento.n;
      medida.eventTimingMedianaMs = evento.mediana;
      medida.eventTimingMaxMs = evento.max;
    }
    return medida;
  }

  /**
   * Um cenário: `preparar` (fora da medida) antes de cada rodada, 1 aquecimento descartado e 3 medidas. `depois`
   * (fora da medida) fecha a rodada.
   */
  async cenario(
    nome: string,
    descricao: string,
    acao: () => Promise<void>,
    opcoes: {
      preparar?: () => Promise<void>;
      depois?: () => Promise<void>;
      comTeclas?: boolean;
      comTraco?: boolean;
    } = {},
  ) {
    if (!roda(nome)) return;
    const medidas: Medida[] = [];
    for (let r = 0; r < AQUECIMENTOS + REPETICOES; r++) {
      await opcoes.preparar?.();
      const m = await this.uma(acao, opcoes.comTeclas, opcoes.comTraco);
      await opcoes.depois?.();
      if (r >= AQUECIMENTOS) medidas.push(m);
    }
    registrar(nome, descricao, medidas);
  }

  /**
   * Perfil de CPU (Profiler do CDP, amostra a cada 200 us) de UMA execução extra de `acao`, depois das repetições
   * medidas. Só com MEDIDA_PERFIL=1.
   */
  async perfil(
    nome: string,
    acao: () => Promise<void>,
    opcoes: { preparar?: () => Promise<void>; depois?: () => Promise<void> } = {},
  ) {
    if (!PERFIL || !roda(nome)) return;
    await opcoes.preparar?.();
    await assentar(this.p);
    await this.cdp.send("Profiler.enable");
    await this.cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await this.cdp.send("Profiler.start");
    await acao();
    await assentar(this.p);
    const { profile } = await this.cdp.send("Profiler.stop");
    await this.cdp.send("Profiler.disable");
    await opcoes.depois?.();
    // o perfil cru, que abre no DevTools (Performance > Load profile)
    writeFileSync(join(PASTA as string, `${ROTULO}-${nome}.cpuprofile`), JSON.stringify(profile));
    registrarPerfil(nome, analisarPerfil(profile as PerfilDoChrome));
  }
}

// ---------------------------------------------------------------------------------------------
// Ações da cena
// ---------------------------------------------------------------------------------------------

const dorme = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const tres = (n: number) => String(n).padStart(3, "0");

/** Espera o marcador chegar à página (nos frames de texto da sala): os 300 últimos bastam. */
async function esperarChegar(s: Sessao, marcador: string) {
  await expect
    .poll(() => s.frames.slice(-300).some((f) => f.includes(marcador)), {
      timeout: 30_000,
      message: `o marcador "${marcador}" não chegou à página`,
    })
    .toBe(true);
}

/** Manda `RAJADA` eventos, um a cada 50 ms (agenda absoluta), e espera o último chegar à página. */
async function rajada(s: Sessao, enviar: (i: number) => void, ultimo: string) {
  const inicio = Date.now();
  for (let i = 1; i <= RAJADA; i++) {
    enviar(i);
    const espera = inicio + i * PASSO_DA_RAJADA_MS - Date.now();
    if (espera > 0) await dorme(espera);
  }
  await esperarChegar(s, ultimo);
}

/** Manda muitas mensagens de chat pela própria página, por vários sockets (10 por socket, por causa do limite). */
async function encherOChat(p: Page, quantidade: number) {
  await p.evaluate(async (n) => {
    const sockets = Math.ceil(n / 10);
    await Promise.all(
      Array.from(
        { length: sockets },
        (_, s) =>
          new Promise<void>((resolve) => {
            const ws = new WebSocket(`ws://${location.host}/api/m/t3st-m3sa-e2e7/ws`);
            ws.onopen = () => {
              for (let i = 0; i < 10 && s * 10 + i < n; i++) {
                ws.send(
                  JSON.stringify({
                    v: 1,
                    id: `m${s}-${i}`,
                    tipo: "chat.enviar",
                    dados: { texto: `historico ${String(s * 10 + i + 1).padStart(3, "0")}` },
                  }),
                );
              }
              setTimeout(() => {
                ws.close();
                resolve();
              }, 800);
            };
          }),
      ),
    );
  }, quantidade);
}

async function fecharAsFichas(p: Page) {
  const fechar = p.getByTestId("janela-ficha-fechar");
  while ((await fechar.count()) > 0) await fechar.first().click();
  await expect(p.getByTestId("janela-ficha")).toHaveCount(0);
}

async function esperarAListaDoCompendio(p: Page) {
  await abrirAba(p, "compendio");
  await expect(p.getByTestId("compendio-lista")).toBeVisible({ timeout: 60_000 });
}

/** Abre a aba sem expandir as seções (na Mesa o `abrirAba` abre tudo; aqui vale o estado normal). */
async function irParaAba(p: Page, id: string) {
  await p.getByTestId(`aba-${id}`).click();
  await expect(p.getByTestId(`aba-painel-${id}`)).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// O roteiro
// ---------------------------------------------------------------------------------------------

base(
  "desempenho: abas do painel, compêndio por instância e digitação na ficha",
  async ({ browser, request }) => {
    base.setTimeout(720_000);
    const mesa = new Mesa(browser, { viewport: { width: 1600, height: 900 } });
    const claudes: ClaudeWs[] = [];
    try {
      expect((await request.post("/teste/zerar")).ok()).toBe(true);
      resultado.ambiente = {
        modo: PRODUCAO
          ? "producao (vite build --mode e2e + vite preview)"
          : "desenvolvimento (vite dev:e2e)",
        rafDaPaginaMs: RAF_DA_PAGINA_MS,
        navegador: browser.version(),
        node: process.version,
        so: process.platform,
        janela: "1600x900",
        aquecimentos: AQUECIMENTOS,
        repeticoes: REPETICOES,
        rajada: { mensagens: RAJADA, passoMs: PASSO_DA_RAJADA_MS },
        teclasDigitadas: TEXTO_DIGITADO.length,
      };

      // ---- a cena pesada ------------------------------------------------------------------
      const ms = await entrarNoMapa(mesa, "mestre");
      const p = ms.pagina;
      await p.addInitScript(instalarSondas, { rafMs: RAF_DA_PAGINA_MS });
      await p.evaluate(instalarSondas, { rafMs: RAF_DA_PAGINA_MS });

      // 45x45 quadrados: um mapa de 450x450 px a 10 px por quadrado (1,5 m cada).
      await definirMapa(p, "cena-1", arquivoPng("medida.png", pngDeRuido(450, 450, 7, 10)), 10);

      await mandar(p, "parede.criar", { cenaId: "cena-1", paredes: paredesDeTeste(160) });
      await mandar(p, "personagem.criar", {
        personagem: {
          id: CONJURADOR,
          pastaId: "pasta-personagens",
          editores: { tipo: "jogadores", ids: ["jogador-1"] },
          nome: "Conjurador",
          tokenPadrao: { cor: "#8e44ad", tamanhoQuadrados: 1 },
          visao: { alcanceM: null, visaoNoEscuroM: 18 },
          ficha: { ...FICHA_DARION, magias: magiasDaFicha() },
        },
      });
      await mandar(p, "token.colocarMeu", {
        personagemId: CONJURADOR,
        tokenId: "tok-conjurador-medida",
        x: 24.75,
        y: 9.75,
      });
      await encherOChat(p, 400);

      // O snapshot traz as 200 mais novas: recarrega para a página começar como começaria de verdade.
      await p.reload();
      await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
      await expect(p.getByTestId("chat-mensagem")).toHaveCount(200, { timeout: 20_000 });
      await expect
        .poll(() =>
          p.evaluate(
            () => (window as unknown as { __tabletop?: unknown }).__tabletop !== undefined,
          ),
        )
        .toBe(true);
      await p.evaluate(() =>
        (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.definirZoom(1),
      );

      const nomes = (await tokensDe(p)).map((t) => t.nome);
      for (const n of ["Aldric", "Brisa", "Cael", "Ogro", "Conjurador"]) expect(nomes).toContain(n);
      const nParedes = await p.evaluate(
        () => (window as unknown as { __tabletop: GanchoDoMapa }).__tabletop.paredes().length,
      );
      expect(nParedes).toBeGreaterThanOrEqual(160);

      // Os clientes que mandam os eventos: um token do Claude para o chat (4 conexões, por causa do limite de 10 por
      // segundo por conexão) e outro para as mudanças de ficha.
      const tokenChat = (await gerarToken(p, "Medida chat")).token;
      const tokenFicha = (await gerarToken(p, "Medida ficha")).token;
      const chatWs = await Promise.all(
        Array.from({ length: 4 }, () => ClaudeWs.conectar(tokenChat)),
      );
      const fichaWs = await ClaudeWs.conectar(tokenFicha);
      claudes.push(...chatWs, fichaWs);
      const cena = fichaWs.snapshot().cenas?.find((c: { id: string }) => c.id === "cena-1");
      expect([cena?.larguraM, cena?.alturaM]).toEqual([67.5, 67.5]);
      resultado.ambiente.cena = {
        quadrados: "45x45",
        paredes: nParedes,
        tokensDePersonagem: 5,
        magiasNaFicha: 30,
        mensagensNoChat: "400 (o snapshot traz as 200 mais novas)",
      };

      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Performance.enable");
      const m = new Medidor(browser, p, cdp);

      // ---- B. digitar na ficha ---------------------------------------------------------------
      const pede = (re: RegExp) => SO.length === 0 || SO.some((t) => re.test(t));
      const comB = pede(/^B/);
      let janela = comB
        ? await abrirFicha(p, CONJURADOR, "principal")
        : p.getByTestId("janela-ficha");
      const campo = () => janela.getByTestId("ficha-antecedente");
      const prepararDigitacao = async () => {
        await campo().fill("");
        await campo().focus();
      };
      const digitar = () => p.keyboard.type(TEXTO_DIGITADO, { delay: 30 });
      const soltarOCampo = () => campo().blur();
      await m.cenario(
        "B1-digitar-ficha-sem-compendio",
        "40 teclas no campo Antecedente da ficha do conjurador (30 magias), mesa sem compêndio",
        digitar,
        { preparar: prepararDigitacao, depois: soltarOCampo, comTeclas: true },
      );
      await m.perfil("B1-digitar-perfil", digitar, {
        preparar: prepararDigitacao,
        depois: soltarOCampo,
      });

      // ---- Q14: o que a ficha redesenha em cada gesto (sem compêndio) ---------------------------
      const abrirTalento = async () => {
        const alternar = janela.getByTestId("caracteristica-alternar-0");
        if ((await alternar.getAttribute("aria-expanded")) !== "true") await alternar.click();
      };
      const textoDoTalento = () => janela.getByTestId("caracteristica-descricao-0");
      await m.cenario(
        "B3-digitar-talentos",
        "40 teclas na descrição do primeiro talento (Características e Talentos) da ficha do conjurador",
        digitar,
        {
          preparar: async () => {
            await abrirTalento();
            await textoDoTalento().fill("");
            await textoDoTalento().focus();
          },
          depois: () => textoDoTalento().blur(),
          comTeclas: true,
        },
      );
      const xp = () => janela.getByTestId("ficha-xp");
      await m.cenario(
        "B4-digitar-numero",
        "40 teclas no campo XP (número): 20 vezes um dígito e Backspace",
        async () => {
          for (let i = 0; i < 20; i++) {
            await p.keyboard.press("7", { delay: 10 });
            await p.keyboard.press("Backspace", { delay: 10 });
            await p.waitForTimeout(40);
          }
        },
        { preparar: () => xp().focus(), depois: () => xp().blur(), comTeclas: true },
      );
      await m.cenario(
        "B5-mudar-atributo",
        "10 mudanças do valor de Força (uma a cada 150 ms) e o que as derivadas redesenham",
        async () => {
          for (let i = 0; i < 10; i++) {
            await janela.getByTestId("atributo-valor-for").fill(String(10 + i));
            await p.waitForTimeout(150);
          }
        },
      );
      await m.cenario(
        "B6-marcar-proficiencia",
        "10 cliques na bolinha de proficiência da perícia Furtividade e da salvaguarda de Destreza",
        async () => {
          for (let i = 0; i < 5; i++) {
            await janela.getByTestId("prof-pericia-furtividade").click();
            await janela.getByTestId("prof-salva-des").click();
            await p.waitForTimeout(100);
          }
        },
      );

      // ---- o compêndio grande entra na mesa ---------------------------------------------------
      if (pede(/^(B2|A-|C)/)) {
        const texto = compendioSintetico();
        resultado.ambiente.compendio = {
          bytes: Buffer.byteLength(texto, "utf8"),
          magias: 1000,
          monstros: 300,
          itens: 300,
          itensMagicos: 200,
        };
        await assets(p, "adicionarNaPasta", CAMINHO_DO_COMPENDIO, texto);
        await esperarAListaDoCompendio(p);
        await expect(p.getByTestId("compendio-contagem")).toContainText(/1.?000 magias/, {
          timeout: 60_000,
        });
      }
      // a ficha reabre com o compêndio já na mesa (a janela lê de novo)
      await fecharAsFichas(p);
      if (roda("B2")) janela = await abrirFicha(p, CONJURADOR, "principal");
      await m.cenario(
        "B2-digitar-ficha-com-compendio",
        "o mesmo, com o compêndio de 1.000 magias carregado na mesa",
        digitar,
        { preparar: prepararDigitacao, depois: soltarOCampo, comTeclas: true },
      );
      await fecharAsFichas(p);

      // ---- A. eventos da sala com cada aba à vista --------------------------------------------
      await abrirAba(p, "chat");
      await m.cenario(
        "A0-ocioso",
        "2,5 s sem evento nenhum, com a aba Chat: a linha de base (o que a página gasta parada)",
        () => dorme(2500),
      );
      await m.perfil("A0-ocioso-perfil", () => dorme(2500));
      let serie = 0;
      const acaoChat = async () => {
        const marca = `r${++serie}`;
        await rajada(
          ms,
          (i) =>
            chatWs[i % chatWs.length]?.enviar("chat.enviar", {
              texto: `rajada ${marca} ${tres(i)}`,
            }),
          `rajada ${marca} ${tres(RAJADA)}`,
        );
      };
      const acaoFicha = async () => {
        const marca = `r${++serie}`;
        await rajada(
          ms,
          (i) =>
            fichaWs.enviar("ficha.alterar", {
              personagemId: CONJURADOR,
              operacoes: [{ caminho: "antecedente", valor: `rajada ${marca} ${tres(i)}` }],
            }),
          `rajada ${marca} ${tres(RAJADA)}`,
        );
      };
      const estados: { id: string; descricao: string; abrir: () => Promise<void> }[] = [
        { id: "chat", descricao: "aba Chat", abrir: () => abrirAba(p, "chat") },
        { id: "fichas", descricao: "aba Fichas", abrir: () => abrirAba(p, "fichas") },
        {
          id: "compendio",
          descricao: "aba Compêndio (lista à vista)",
          abrir: () => esperarAListaDoCompendio(p),
        },
        {
          id: "preferencias",
          descricao: "aba Preferências",
          abrir: () => abrirAba(p, "preferencias"),
        },
        { id: "mesa", descricao: "aba Mesa", abrir: () => irParaAba(p, "mesa") },
        {
          id: "recolhido",
          descricao: "painel recolhido",
          abrir: async () => {
            await p.getByTestId("lateral-recolher").click();
            await expect(p.getByTestId("aba-painel-mesa")).toBeHidden();
          },
        },
      ];
      for (const e of estados) {
        if (!roda(`A-${e.id}-`)) continue;
        await e.abrir();
        await m.cenario(
          `A-${e.id}-chat`,
          `${RAJADA} mensagens de chat (uma a cada ${PASSO_DA_RAJADA_MS} ms) com o painel em: ${e.descricao}`,
          acaoChat,
        );
        await m.cenario(
          `A-${e.id}-ficha`,
          `${RAJADA} mudanças de ficha (ficha.alterar do Antecedente, fichas fechadas), uma a cada ${PASSO_DA_RAJADA_MS} ms, com o painel em: ${e.descricao}`,
          acaoFicha,
        );
        // perfis: só com o painel recolhido e com a aba Chat à vista
        if (e.id === "chat" || e.id === "recolhido") {
          await m.perfil(`A-${e.id}-chat-perfil`, acaoChat);
          await m.perfil(`A-${e.id}-ficha-perfil`, acaoFicha);
        }
      }
      await abrirAba(p, "chat");

      // ---- C. o compêndio por instância ------------------------------------------------------
      await m.cenario(
        "C0-recarregar-ate-conectar",
        "recarregar a página do mestre (cache local já cheio) até a sala conectar: referência sem o compêndio na tela",
        async () => {
          await p.reload();
          await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
        },
        { comTraco: true },
      );
      await m.cenario(
        "C1-recarregar-ate-lista-do-compendio",
        "recarregar a página do mestre e abrir a aba Compêndio até a lista aparecer (uma leitura)",
        async () => {
          await p.reload();
          await expect(p.getByTestId("status-conexao")).toHaveText("conectado");
          await esperarAListaDoCompendio(p);
        },
        { comTraco: true },
      );
      await abrirAba(p, "chat");

      // Três fichas, uma após a outra: cada janela de ficha lê o compêndio por conta própria (hoje).
      const fichas = [CONJURADOR, "pers-aldric", "pers-brisa"];
      const porFicha: Medida[][] = fichas.map(() => []);
      const totais: Medida[] = [];
      const rodadas = roda("C2") || roda("C3") ? AQUECIMENTOS + REPETICOES : 0;
      for (let r = 0; r < rodadas; r++) {
        const medidasDaRodada: Medida[] = [];
        for (const id of fichas) {
          medidasDaRodada.push(
            await m.uma(async () => {
              await abrirFicha(p, id, "principal");
            }),
          );
          // cada ficha abre sozinha: as janelas se sobrepõem no mesmo canto e a anterior tampa o botão de fechar
          await fecharAsFichas(p);
        }
        if (r < AQUECIMENTOS) continue;
        medidasDaRodada.forEach((medida, i) => {
          porFicha[i]?.push(medida);
        });
        const chaves = Object.keys(medidasDaRodada[0] as Medida);
        totais.push(
          Object.fromEntries(
            chaves.map((k) => [
              k,
              arredonda(medidasDaRodada.reduce((s, x) => s + (x[k] as number), 0)),
            ]),
          ),
        );
      }
      if (rodadas > 0) {
        fichas.forEach((id, i) => {
          registrar(
            `C2-abrir-ficha-${i + 1}-${id}`,
            `abrir a ficha ${i + 1} de 3 (${id}) pela aba Fichas, com o compêndio grande na mesa`,
            porFicha[i] as Medida[],
          );
        });
        registrar(
          "C3-abrir-3-fichas-total",
          "soma das três aberturas de ficha, uma após a outra (fechando as três entre as rodadas)",
          totais,
        );
      }

      // ---- a tabela ---------------------------------------------------------------------------
      console.log(`\n=== medianas (${ROTULO}) ===`);
      console.log(
        `${"cenário".padEnd(36)}${"script".padStart(10)}${"tarefa".padStart(10)}${"layout".padStart(9)}${"estilo".padStart(9)}${"longas".padStart(8)}${"longas ms".padStart(11)}${"var%".padStart(12)}`,
      );
      for (const [nome, c] of Object.entries(resultado.cenarios)) {
        const x = c.mediana;
        console.log(
          `${nome.padEnd(36)}${String(x.scriptMs).padStart(10)}${String(x.tarefaMs).padStart(10)}${String(x.layoutMs).padStart(9)}${String(x.estiloMs).padStart(9)}${String(x.longasQtd).padStart(8)}${String(x.longasMs).padStart(11)}${`${c.variacaoPct.script}/${c.variacaoPct.tarefa}`.padStart(12)}`,
        );
      }
      for (const [nome, c] of Object.entries(resultado.cenarios)) {
        const x = c.mediana;
        if (x.secoesQueRenderizam === undefined) continue;
        console.log(
          `${nome}: ${x.secoesQueRenderizam} seções renderizam (${x.rendersDeSecoes} renders de seção, ${x.rendersDaJanela} da janela); por seção: ${Object.entries(
            x,
          )
            .filter(([k]) => k.startsWith("r:"))
            .map(([k, v]) => `${k.slice(2)} ${v}`)
            .join(", ")}`,
        );
      }
      for (const nome of ["B1-digitar-ficha-sem-compendio", "B2-digitar-ficha-com-compendio"]) {
        const x = resultado.cenarios[nome]?.mediana;
        if (!x) continue;
        console.log(
          `${nome}: tecla->pintura mediana ${x.teclaMedianaMs} ms, máx ${x.teclaMaxMs} ms (${x.teclasN} teclas); Event Timing >=16 ms: ${x.eventTimingN} eventos, mediana ${x.eventTimingMedianaMs} ms, máx ${x.eventTimingMaxMs} ms`,
        );
      }
      gravar();
    } finally {
      await Promise.all(claudes.map((c) => c.fechar().catch(() => {})));
      await mesa.fechar();
    }
  },
);
