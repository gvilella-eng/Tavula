import { type Fluxo, idNovoDeNo, type No } from "@tabletop/shared";

// ---------------------------------------------------------------------------------------------
// AU3: o tour do centro de automações. Passa por cada tipo de peça (com um exemplo de mesa), mostra a mesa de eventos e o
// "Liberar aos jogadores" e depois monta, junto com a pessoa, "as tochas têm 30% de chance de apagar a cada 3 minutos".
// Aqui moram os passos e as regras puras (o que é "feito", o que o botão "Fazer este passo por mim" faz); a tela do tour está
// em `TourDasAutomacoes.tsx`.
// ---------------------------------------------------------------------------------------------

/** A marca de que esta pessoa já viu (ou pulou) o tour, neste navegador. Nunca vai para a sala. */
export const CHAVE_DO_TOUR_DAS_AUTOMACOES = "tabletop:pref:tourDasAutomacoes";
/** No teste (`MODO=teste`) o tour não abre sozinho; os testes dele ligam esta chave de propósito. */
export const CHAVE_DO_TOUR_DAS_AUTOMACOES_NO_TESTE = "tabletop:pref:tourDasAutomacoesNoTeste";

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export const tourDasAutomacoesJaVisto = (): boolean => ler(CHAVE_DO_TOUR_DAS_AUTOMACOES) === "1";

export function marcarTourDasAutomacoesVisto(): void {
  try {
    localStorage.setItem(CHAVE_DO_TOUR_DAS_AUTOMACOES, "1");
  } catch {
    // sem armazenamento: o tour só volta a abrir sozinho na próxima vez
  }
}

/**
 * O tour abre sozinho na primeira vez que alguém abre o centro de automações: só com conta (e fora do modo de teste, a não
 * ser que o teste ligue a chave).
 */
export function tourDasAutomacoesAbreSozinho(u: {
  login?: string | undefined;
  modoTeste?: boolean | undefined;
}): boolean {
  if (tourDasAutomacoesJaVisto()) return false;
  if (ler(CHAVE_DO_TOUR_DAS_AUTOMACOES_NO_TESTE) === "1") return true;
  return u.login !== undefined && u.modoTeste !== true;
}

// --- Os passos -----------------------------------------------------------------------------------

export type PassoDoTourDasAutomacoes = {
  id: string;
  titulo: string;
  texto: string;
  /** `info`: escurece a tela e ilumina o alvo; `fazer`: a pessoa age (a tela fica livre) e o passo se completa sozinho. */
  tipo: "info" | "fazer";
  /** Os `data-testid` a iluminar (o primeiro é o alvo do cartão; com `seta`, a seta vai do primeiro ao segundo). */
  alvos: (f: Fluxo) => string[];
  /** Iluminado de leve, sem tirar o foco do alvo (a frase "Em português", por exemplo). */
  suaves?: readonly string[];
  seta?: boolean;
  /** O bloco que o passo escolhe ao entrar, para o painel dele aparecer. */
  escolher?: (f: Fluxo) => string | undefined;
  /** Só nos passos de `fazer`: já está pronto? E o que "Fazer este passo por mim" muda. */
  feito?: (f: Fluxo) => boolean;
  fazer?: (f: Fluxo) => Fluxo;
  /** O texto do botão de avançar (padrão: Próximo). */
  avancar?: string;
};

const relogio = (f: Fluxo) =>
  f.nos.find((n) => n.tipo === "gatilho" && n.config.tipo === "relogio");
const paraCada = (f: Fluxo) => f.nos.find((n) => n.tipo === "paraCada");
const sortear = (f: Fluxo) => f.nos.find((n) => n.tipo === "sortear");
const apagar = (f: Fluxo) =>
  f.nos.find((n) => n.tipo === "acao" && n.config.acao.acao === "objeto.apagar");
const ligadoEntre = (f: Fluxo, de: No | undefined, saida: string, para: No | undefined) =>
  de !== undefined &&
  para !== undefined &&
  f.fios.some(
    (x) =>
      x.de.no === de.id &&
      x.de.saida === saida &&
      x.para.no === para.id &&
      x.para.entrada === "entrada",
  );

const NOME_DO_EXEMPLO = "As tochas apagam (exemplo do tour)";
export const nomeDoExemploDoTour = NOME_DO_EXEMPLO;

/** Só dá para montar o exemplo numa automação nova e vazia (um relógio e mais nada): a que já tem trabalho não se mexe. */
export const podeMontarOExemplo = (f: Fluxo): boolean =>
  f.nos.length === 1 && f.nos[0]?.tipo === "gatilho" && f.fios.length === 0 && f.nome === "";

function comNo(f: Fluxo, no: Omit<No, "id">): Fluxo {
  return { ...f, nos: [...f.nos, { ...no, id: idNovoDeNo(f.nos) } as No] };
}

const porta = (id: string | undefined, p: string) => `ed-porta-${id}-${p}`;

/** As peças, uma explicação por grupo: o mesmo roteiro no editor e (a primeira parte) no centro. */
const PASSOS_DAS_PECAS: readonly PassoDoTourDasAutomacoes[] = [
  {
    id: "boas-vindas",
    tipo: "info",
    titulo: "Conhecer as automações",
    texto:
      "Aqui você monta o que a mesa faz sozinha. Vamos ver cada tipo de peça. No fim, montamos juntos: as tochas têm 30% de chance de apagar a cada 3 minutos.",
    alvos: () => [],
  },
  {
    id: "quando",
    tipo: "info",
    titulo: "Quando: o que faz tudo começar",
    texto:
      "Os gatilhos: o que faz tudo começar. Por exemplo, “a cada 3 minutos” ou “ao apertar o botão Combate”.",
    alvos: () => ["ed-grupo-quando"],
  },
  {
    id: "fluxo",
    tipo: "info",
    titulo: "Fluxo: o caminho",
    texto:
      "Esperar segura um tempo e Sortear tira a sorte. Se confere uma condição, e Para cada repete para cada tocha ou token.",
    alvos: () => ["ed-grupo-fluxo"],
  },
  {
    id: "condicoes",
    tipo: "info",
    titulo: "Condições: verdadeiro ou falso",
    texto:
      "Respondem sim ou não e vão no “Se”. Por exemplo: o token é de um jogador, ou há 50% de chance.",
    alvos: () => ["ed-grupo-condicao"],
  },
  {
    id: "caixas",
    tipo: "info",
    titulo: "Caixas lógicas",
    texto:
      "Como os blocos “e”, “ou” e “não” do Scratch, na vertical. Cada espaço da caixa guarda uma peça: gatilho, condição, ação ou outra caixa. Clique no rótulo entre os espaços para trocar E por OU.",
    alvos: () => ["ed-grupo-logica"],
  },
  {
    id: "caixa-exemplo",
    tipo: "info",
    titulo: "Uma caixa, por exemplo",
    texto:
      "“A cada 3 min OU o botão Combate”: o relógio no espaço de cima e o botão no de baixo. Qualquer um dos dois dispara.",
    alvos: () => ["ed-grupo-logica"],
  },
  {
    id: "caixa-espacos",
    tipo: "info",
    titulo: "Mais espaços e combinações",
    texto:
      "O “+” no pé da caixa acrescenta um espaço, e o “×” tira um vazio. Ação E ação faz as duas; ação OU ação sorteia uma. Gatilho E condição só segue se a condição vale.",
    alvos: () => ["ed-grupo-logica"],
  },
  {
    id: "acoes",
    tipo: "info",
    titulo: "Faça: o que a mesa executa",
    texto:
      "O que a mesa executa: apagar a tocha, mexer na luz, avisar no chat, tocar um som. “Mandar um sinal” avisa outras automações.",
    alvos: () => ["ed-grupo-faca"],
  },
  {
    id: "eventos",
    tipo: "info",
    titulo: "Mesa de eventos e jogadores",
    texto:
      "O gatilho de botão aparece na mesa de eventos, para apertar na sessão. “Liberar aos jogadores” deixa os jogadores apertarem o botão.",
    alvos: () => ["ed-liberar"],
  },
];

/** Os passos do editor: as peças e, numa automação nova, a montagem do exemplo das tochas. */
export function passosDoEditor(comExemplo: boolean): readonly PassoDoTourDasAutomacoes[] {
  if (!comExemplo) {
    return [
      ...PASSOS_DAS_PECAS,
      {
        id: "sem-exemplo",
        tipo: "info",
        titulo: "Montar um exemplo",
        texto:
          "Esta automação já tem trabalho, então não mexo nela. Para montar o exemplo, abra “Nova automação” e clique em “Conhecer as automações”.",
        alvos: () => [],
        avancar: "Concluir",
      },
    ];
  }
  return [
    ...PASSOS_DAS_PECAS,
    {
      id: "montar",
      tipo: "info",
      titulo: "Agora, a prática",
      texto:
        "Vamos montar: relógio de 3 min, para cada tocha acesa, sortear 30%, apagar a tocha. Uma seta mostra onde cada peça vai. Se preferir, use “Fazer este passo por mim”.",
      alvos: () => [],
    },
    {
      id: "relogio",
      tipo: "fazer",
      titulo: "1. A cada 3 minutos",
      texto:
        "Este é o gatilho. No campo “A cada (segundos)”, escreva 180 (3 minutos). Olhe embaixo: a frase “Em português” vai se completando.",
      alvos: (f) => ["ed-campo-cada", `ed-no-${relogio(f)?.id}`],
      suaves: ["ed-frase-caixa"],
      escolher: (f) => relogio(f)?.id,
      feito: (f) => {
        const r = relogio(f);
        return r?.tipo === "gatilho" && r.config.tipo === "relogio" && r.config.cadaS === 180;
      },
      fazer: (f) => ({
        ...f,
        nos: f.nos.map((n) =>
          n.tipo === "gatilho" && n.config.tipo === "relogio"
            ? { ...n, config: { ...n.config, cadaS: 180 } }
            : n,
        ),
      }),
    },
    {
      id: "para-cada",
      tipo: "fazer",
      titulo: "2. Para cada tocha acesa",
      texto:
        "Arraste “Para cada” para a grade (ou clique nele). Ele repete o que vier depois para cada tocha acesa da cena.",
      alvos: () => ["ed-peca-paraCada"],
      suaves: ["ed-frase-caixa"],
      feito: (f) => paraCada(f) !== undefined,
      fazer: (f) => {
        const r = relogio(f);
        return comNo(f, {
          tipo: "paraCada",
          config: { alvo: { tipo: "objetos", acesos: true } },
          x: (r?.x ?? 80) + 300,
          y: r?.y ?? 80,
        });
      },
    },
    {
      id: "ligar-relogio",
      tipo: "fazer",
      titulo: "3. Ligue o relógio ao “Para cada”",
      texto:
        "Arraste da bolinha da direita do relógio até a bolinha da esquerda do “Para cada”. O fio mostra o que roda depois do quê.",
      alvos: (f) => [porta(relogio(f)?.id, "saida"), porta(paraCada(f)?.id, "entrada")],
      seta: true,
      suaves: ["ed-frase-caixa"],
      feito: (f) => ligadoEntre(f, relogio(f), "saida", paraCada(f)),
      fazer: (f) => {
        const r = relogio(f);
        const c = paraCada(f);
        if (!r || !c) return f;
        return {
          ...f,
          fios: [
            ...f.fios,
            { de: { no: r.id, saida: "saida" }, para: { no: c.id, entrada: "entrada" } },
          ],
        };
      },
    },
    {
      id: "sortear",
      tipo: "fazer",
      titulo: "4. Sortear",
      texto:
        "Arraste “Sortear” para a grade. A cada tocha ele tira a sorte: o “sim” segue com a chance escolhida.",
      alvos: () => ["ed-peca-sortear"],
      suaves: ["ed-frase-caixa"],
      feito: (f) => sortear(f) !== undefined,
      fazer: (f) => {
        const c = paraCada(f);
        return comNo(f, {
          tipo: "sortear",
          config: { chance: 0.5 },
          x: (c?.x ?? 380) + 300,
          y: c?.y ?? 80,
        });
      },
    },
    {
      id: "chance",
      tipo: "fazer",
      titulo: "5. Trinta por cento",
      texto: "Escolha o “Sortear” e ponha 30 no campo “Chance de sim (%)”.",
      alvos: (f) => ["ed-campo-chance", `ed-no-${sortear(f)?.id}`],
      suaves: ["ed-frase-caixa"],
      escolher: (f) => sortear(f)?.id,
      feito: (f) => {
        const s = sortear(f);
        return s?.tipo === "sortear" && Math.abs(s.config.chance - 0.3) < 0.0001;
      },
      fazer: (f) => ({
        ...f,
        nos: f.nos.map((n) => (n.tipo === "sortear" ? { ...n, config: { chance: 0.3 } } : n)),
      }),
    },
    {
      id: "ligar-sorteio",
      tipo: "fazer",
      titulo: "6. Ligue o “Para cada” ao “Sortear”",
      texto: "Use a saída “Cada um” do “Para cada”: o sorteio roda uma vez para cada tocha acesa.",
      alvos: (f) => [porta(paraCada(f)?.id, "corpo"), porta(sortear(f)?.id, "entrada")],
      seta: true,
      suaves: ["ed-frase-caixa"],
      feito: (f) => ligadoEntre(f, paraCada(f), "corpo", sortear(f)),
      fazer: (f) => {
        const c = paraCada(f);
        const s = sortear(f);
        if (!c || !s) return f;
        return {
          ...f,
          fios: [
            ...f.fios,
            { de: { no: c.id, saida: "corpo" }, para: { no: s.id, entrada: "entrada" } },
          ],
        };
      },
    },
    {
      id: "apagar",
      tipo: "fazer",
      titulo: "7. Apagar a tocha",
      texto: "Arraste “Apagar a tocha” para a grade. Ela apaga a tocha da vez, a do “Para cada”.",
      alvos: () => ["ed-peca-apagar"],
      suaves: ["ed-frase-caixa"],
      feito: (f) => apagar(f) !== undefined,
      fazer: (f) => {
        const s = sortear(f);
        return comNo(f, {
          tipo: "acao",
          config: { acao: { acao: "objeto.apagar", chance: 1 } },
          x: (s?.x ?? 680) + 300,
          y: (s?.y ?? 80) - 20,
        });
      },
    },
    {
      id: "ligar-apagar",
      tipo: "fazer",
      titulo: "8. Ligue o “sim” a “Apagar a tocha”",
      texto: "Do “Sim” do sorteio até o “Apagar”: só 30% das tochas apagam, a cada 3 minutos.",
      alvos: (f) => [porta(sortear(f)?.id, "sim"), porta(apagar(f)?.id, "entrada")],
      seta: true,
      suaves: ["ed-frase-caixa"],
      feito: (f) => ligadoEntre(f, sortear(f), "sim", apagar(f)),
      fazer: (f) => {
        const s = sortear(f);
        const a = apagar(f);
        if (!s || !a) return f;
        return {
          ...f,
          fios: [
            ...f.fios,
            { de: { no: s.id, saida: "sim" }, para: { no: a.id, entrada: "entrada" } },
          ],
        };
      },
    },
    {
      id: "fim",
      tipo: "info",
      titulo: "Pronto!",
      texto:
        "Pronta, e desligada. A chave “Ligada” a liga e “Testar agora” roda uma vez de verdade. Embaixo, “Em português” mostra o que ela faz.",
      alvos: () => ["ed-ligada", "ed-testar"],
      avancar: "Concluir",
    },
  ];
}

/** Os passos do centro (a lista): só explica; no fim, abre o editor com o tour. */
export const PASSOS_DO_CENTRO: readonly PassoDoTourDasAutomacoes[] = [
  {
    id: "centro",
    tipo: "info",
    titulo: "O centro de automações",
    texto:
      "Aqui ficam todas as automações da mesa. Cada uma mostra o que faz, em português. Dá para ligar, desligar e disparar.",
    alvos: () => ["automacoes-lista"],
  },
  {
    id: "mesa-de-eventos",
    tipo: "info",
    titulo: "A mesa de eventos",
    texto:
      "Reúne só os botões das automações, para apertar durante a sessão. No menu de cada uma, “Liberar aos jogadores” deixa os jogadores apertarem o botão.",
    alvos: () => ["auto-abrir-mesa-de-eventos"],
  },
  {
    id: "nova",
    tipo: "info",
    titulo: "Agora, as peças",
    texto:
      "O editor explica cada tipo de peça e monta com você: as tochas têm 30% de chance de apagar a cada 3 minutos. Ela fica desligada no fim.",
    alvos: () => ["auto-nova"],
    avancar: "Abrir o editor",
  },
];
