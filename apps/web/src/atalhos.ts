// A tabela única de atalhos do teclado (R6a). As dicas dos botões (`<kbd>`) e a lista "Atalhos do teclado" da aba
// Preferências nascem daqui: atalho novo entra aqui e nos dois lugares aparece. Só tem o que existe de fato no
// código (`Mesa.tsx`, `mapa/mapaPixi.ts`, `BarraLateral.tsx`, `janelas/Janela.tsx`, `AbaChat.tsx`...).

/** Uma combinação: as teclas apertadas juntas, na ordem ("Shift", "F10"). */
export type Combinacao = readonly string[];

export type GrupoDeAtalhos = "Ferramentas" | "Mapa" | "Menus" | "Janelas e painéis" | "Campos";

export type Atalho = {
  /** O que o atalho faz, em uma frase curta. */
  descricao: string;
  grupo: GrupoDeAtalhos;
  /** Formas equivalentes de fazer a mesma coisa (cada uma é uma combinação). */
  teclas: readonly Combinacao[];
  /** As teclas são um conjunto só (as quatro setas: "← ↑ ↓ →"), não alternativas: sem "ou" entre elas. */
  juntas?: true;
};

export const ATALHOS = {
  selecionar: {
    descricao: "Selecionar e mover",
    grupo: "Ferramentas",
    teclas: [["V"]],
  },
  mao: {
    descricao: "Mão: arrastar o mapa",
    grupo: "Ferramentas",
    teclas: [["H"]],
  },
  regua: {
    descricao: "Régua",
    grupo: "Ferramentas",
    teclas: [["R"]],
  },
  arrastarVista: {
    descricao: "Segurar e arrastar o mapa, com qualquer ferramenta",
    grupo: "Mapa",
    teclas: [["Espaço"]],
  },
  soltar: {
    descricao: "Soltar a seleção, fechar menus e cancelar o gesto em andamento",
    grupo: "Mapa",
    teclas: [["Esc"]],
  },
  apagar: {
    descricao: "Apagar o desenho ou a parede selecionados",
    grupo: "Mapa",
    teclas: [["Delete"], ["Backspace"]],
  },
  encaixe: {
    descricao: "Segurar ao arrastar ou clicar: inverte o encaixe no grid",
    grupo: "Mapa",
    teclas: [["Alt"]],
  },
  fixarRegua: {
    descricao: "Soltar a régua com Shift deixa a medida fixa na tela",
    grupo: "Mapa",
    teclas: [["Shift"]],
  },
  menuDoToken: {
    descricao: "Abrir o menu do token selecionado (foco no mapa)",
    grupo: "Menus",
    teclas: [["Shift", "F10"], ["Menu"]],
  },
  menuNavegar: {
    descricao: "Andar pelos itens de um menu",
    grupo: "Menus",
    teclas: [["↑"], ["↓"], ["Home"], ["End"]],
  },
  menuAtivar: {
    descricao: "Ativar o item do menu em foco",
    grupo: "Menus",
    teclas: [["Enter"], ["Espaço"]],
  },
  dicaFechar: {
    descricao: "Esconder a dica de um botão",
    grupo: "Menus",
    teclas: [["Esc"]],
  },
  janelaMover: {
    descricao: "Mover a janela com o cabeçalho em foco (Shift: passo maior)",
    grupo: "Janelas e painéis",
    teclas: [["←"], ["↑"], ["↓"], ["→"]],
    juntas: true,
  },
  painelLargura: {
    descricao: "Ajustar a largura do painel com a alça em foco (Shift: passo maior)",
    grupo: "Janelas e painéis",
    teclas: [["←"], ["→"], ["Home"], ["End"]],
  },
  chatEnviar: {
    descricao: "Enviar a mensagem do chat",
    grupo: "Campos",
    teclas: [["Enter"]],
  },
  chatLinha: {
    descricao: "Quebrar a linha no chat",
    grupo: "Campos",
    teclas: [["Shift", "Enter"]],
  },
  campoConfirmar: {
    descricao: "Confirmar o campo editado (a iniciativa só vale assim)",
    grupo: "Campos",
    teclas: [["Enter"]],
  },
  campoDesfazer: {
    descricao: "Voltar o campo da iniciativa ao valor de antes",
    grupo: "Campos",
    teclas: [["Esc"]],
  },
  dadoOculto: {
    descricao: "Clicar num dado rápido com Shift: rolagem oculta (mestre)",
    grupo: "Campos",
    teclas: [["Shift"]],
  },
} as const satisfies Record<string, Atalho>;

export type IdDoAtalho = keyof typeof ATALHOS;

export const IDS_DOS_ATALHOS = Object.keys(ATALHOS) as IdDoAtalho[];

export const GRUPOS_DE_ATALHOS: readonly GrupoDeAtalhos[] = [
  "Ferramentas",
  "Mapa",
  "Menus",
  "Janelas e painéis",
  "Campos",
];

/** As combinações de um atalho como texto simples ("Shift + F10 ou Menu"), para `aria-keyshortcuts` e testes. */
export function textoDasTeclas(teclas: readonly Combinacao[]): string {
  return teclas.map((c) => c.join(" + ")).join(" ou ");
}

/** O que `aria-keyshortcuts` espera: os nomes de tecla do padrão ARIA, combinações separadas por espaço. */
export function teclasParaAria(teclas: readonly Combinacao[]): string {
  const nome: Record<string, string> = {
    Espaço: "Space",
    Esc: "Escape",
    "←": "ArrowLeft",
    "→": "ArrowRight",
    "↑": "ArrowUp",
    "↓": "ArrowDown",
    Menu: "ContextMenu",
  };
  return teclas.map((c) => c.map((t) => nome[t] ?? t).join("+")).join(" ");
}

/** Os atalhos de um grupo, na ordem da tabela. */
export function atalhosDoGrupo(grupo: GrupoDeAtalhos): { id: IdDoAtalho; atalho: Atalho }[] {
  return IDS_DOS_ATALHOS.filter((id) => ATALHOS[id].grupo === grupo).map((id) => ({
    id,
    atalho: ATALHOS[id],
  }));
}
