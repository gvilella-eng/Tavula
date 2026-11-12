import { TEXTOS_DO_TOUR } from "../textosDoTour";

/**
 * Os passos do tour de introdução. Cada passo aponta para um `data-testid` da tela (o alvo, que fica iluminado) e,
 * se o alvo mora numa aba do painel da direita, qual aba abrir antes. O texto vem de `textosDoTour.ts`, pela
 * chave do passo. Um teste (E2E `tour.spec.ts`) confere que cada alvo existe na tela do papel certo: botão
 * renomeado quebra o teste, não o tour. Alvo que não aparece na hora do tour é pulado, nunca trava.
 */
export type Passo = {
  id: string;
  titulo: string;
  /** O `data-testid` do alvo; `null`: sem alvo (cartão no meio, tela toda escurecida). */
  alvo: string | null;
  /** A aba do painel da direita que precisa estar aberta para o alvo aparecer. */
  aba?: string;
  /** A chave em `TEXTOS_DO_TOUR` (padrão: o alvo). */
  chaveDoTexto: string;
};

export type PapelDoTour = "mestre" | "jogador";

const passo = (
  id: string,
  titulo: string,
  alvo: string | null,
  chaveDoTexto: string,
  aba?: string,
): Passo => (aba ? { id, titulo, alvo, chaveDoTexto, aba } : { id, titulo, alvo, chaveDoTexto });

export const PASSOS_DO_MESTRE: readonly Passo[] = [
  passo(
    "boas-vindas",
    "Bem-vindo, mestre",
    "mesa-identificacao",
    "tour-mestre-boas-vindas",
    "mesa",
  ),
  passo("cenas", "Cenas", "menu-cenas", "menu-cenas"),
  passo("novo-token", "Novo token", "novo-token", "novo-token"),
  passo("ferramentas", "Ferramentas", "barra-ferramentas", "barra-ferramentas"),
  passo("paredes", "Paredes", "ferramenta-paredes", "ferramenta-paredes"),
  passo("luz", "Luz e Visão do mestre", "menu-grupo-luz", "menu-grupo-luz"),
  passo("fichas", "Fichas", "aba-painel-fichas", "tour-mestre-fichas", "fichas"),
  passo("compendio", "Compêndio", "aba-painel-compendio", "tour-mestre-compendio", "compendio"),
  passo("chat", "Chat e dados", "aba-painel-chat", "tour-mestre-chat", "chat"),
  passo("contas", "Pedidos de entrada e contas", "mesa-secao-contas", "mesa-secao-contas", "mesa"),
];

export const PASSOS_DO_JOGADOR: readonly Passo[] = [
  passo("boas-vindas", "Bem-vindo à mesa", null, "tour-jogador-boas-vindas"),
  passo("mapa", "O mapa e o seu token", "area-do-mapa", "area-do-mapa"),
  passo("ficha", "A sua ficha", "aba-painel-fichas", "tour-jogador-ficha", "fichas"),
  passo("chat", "Chat e dados", "aba-painel-chat", "tour-jogador-chat", "chat"),
  passo("regua", "A régua", "ferramenta-regua", "ferramenta-regua"),
  passo(
    "preferencias",
    "Preferências",
    "aba-painel-preferencias",
    "tour-jogador-preferencias",
    "preferencias",
  ),
];

export const passosDoPapel = (papel: PapelDoTour): readonly Passo[] =>
  papel === "mestre" ? PASSOS_DO_MESTRE : PASSOS_DO_JOGADOR;

/** O texto do passo (1 a 2 frases). */
export const textoDoPasso = (p: Passo): string => TEXTOS_DO_TOUR[p.chaveDoTexto] ?? "";
