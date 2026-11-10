// Temas de cor da interface: a ÚNICA fonte dos tokens. Só cores (disposição e fontes são iguais nos 3
// temas). O mapa (PixiJS) não muda com o tema: é o conteúdo da cena. A escolha é preferência de cada
// navegador (localStorage), nunca da sala. Os tokens viram variáveis CSS no `documentElement`.

export type IdDoTema = "grimorio" | "escuro" | "claro";

export const TEMA_PADRAO: IdDoTema = "grimorio";
export const CHAVE_TEMA = "tabletop:pref:tema";

/** Todas as chaves de token; cada uma vira a variável CSS `--<chave-em-kebab>`. */
export const CHAVES_DE_TOKEN = [
  "fundoMesa", // em volta do mapa
  "fundo", // fundo da página
  "barra", // barras fixas (couro)
  "bordaBarra",
  "painel", // painéis e cartões
  "borda",
  "cabecalho", // cabeçalho de janela e botões sobre o painel
  "campo", // inputs
  "texto",
  "textoSuave",
  "textoDesabilitado", // exceção de contraste (controle desabilitado)
  "acento", // preenchimento de destaque
  "acentoTexto", // texto sobre o destaque
  "acentoSuave", // fundo suave de destaque
  "acentoForte", // texto e ícone em destaque
  "perigo", // perigo e dano (texto e preenchimento)
  "perigoTexto", // texto sobre o perigo
  "perigoFundo", // fundo opaco de cartão de falha crítica
  "sucesso",
  "sucessoTexto",
  "sucessoSuave",
  "aviso", // amarelo: texto, ícone e preenchimento
  "avisoTexto", // texto sobre o amarelo
  "avisoFundo", // fundo opaco de cartão em destaque (20 natural)
  "avisoSuave", // fundo suave de "incerto"
  "avisoBorda",
  "oculta", // roxo de "oculta do jogador"
  "sobreposicao", // véu de modal
  "veu", // véu sobre o mapa (rótulos de progresso)
  "pontoOff", // ponto de presença offline
  "sombra",
] as const;

export type ChaveDeToken = (typeof CHAVES_DE_TOKEN)[number];
export type Tema = Record<ChaveDeToken, string>;

export const TEMAS: Record<IdDoTema, Tema> = {
  grimorio: {
    fundoMesa: "#0B0806",
    fundo: "#0E0B09",
    barra: "#2B211A",
    bordaBarra: "#4A3A2B",
    painel: "#352920",
    borda: "#57442F",
    cabecalho: "#3E3025",
    campo: "#1A130E",
    texto: "#F3E9D8",
    textoSuave: "#BCA98F",
    textoDesabilitado: "#8A785F",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#4A2418",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#4A3A12",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(8, 5, 3, 0.62)",
    veu: "rgba(14, 11, 9, 0.88)",
    pontoOff: "#8A785F",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  escuro: {
    fundoMesa: "#0A0B0E",
    fundo: "#0F1115",
    barra: "#1F2228",
    bordaBarra: "#323640",
    painel: "#282C33",
    borda: "#3B404A",
    cabecalho: "#2F343C",
    campo: "#16181D",
    texto: "#E8EAED",
    textoSuave: "#A0A7B3",
    textoDesabilitado: "#6F7684",
    acento: "#5B9BF0",
    acentoTexto: "#0B1424",
    acentoSuave: "rgba(91, 155, 240, 0.18)",
    acentoForte: "#8DBBF6",
    perigo: "#F08A72",
    perigoTexto: "#1F0A06",
    perigoFundo: "#3E1E19",
    sucesso: "#6FCF97",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(111, 207, 151, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#3F3410",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#B9A5F0",
    sobreposicao: "rgba(5, 7, 10, 0.62)",
    veu: "rgba(15, 17, 21, 0.88)",
    pontoOff: "#6F7684",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  claro: {
    fundoMesa: "#CFC8BC",
    fundo: "#EFEBE4",
    barra: "#FBF9F5",
    bordaBarra: "#DCD4C6",
    painel: "#FFFFFF",
    borda: "#DCD4C6",
    cabecalho: "#F3EEE6",
    campo: "#FFFFFF",
    texto: "#231E19",
    textoSuave: "#675D52",
    textoDesabilitado: "#9A8F82",
    acento: "#E2AE4F",
    acentoTexto: "#231E19",
    acentoSuave: "rgba(226, 174, 79, 0.24)",
    acentoForte: "#8A5D10",
    perigo: "#A83A15",
    perigoTexto: "#FFFFFF",
    perigoFundo: "#FDEBE3",
    sucesso: "#1F7A3D",
    sucessoTexto: "#FFFFFF",
    sucessoSuave: "rgba(31, 122, 61, 0.14)",
    aviso: "#8A6500",
    avisoTexto: "#FFFFFF",
    avisoFundo: "#FFF1C2",
    avisoSuave: "rgba(217, 165, 33, 0.22)",
    avisoBorda: "#B58300",
    oculta: "#6B4BB8",
    sobreposicao: "rgba(35, 30, 25, 0.45)",
    veu: "rgba(251, 249, 245, 0.92)",
    pontoOff: "#9A8F82",
    sombra: "0 6px 20px rgba(60, 45, 25, 0.2)",
  },
};

export const NOMES_DOS_TEMAS: Record<IdDoTema, string> = {
  grimorio: "Grimório",
  escuro: "Escuro neutro",
  claro: "Claro",
};

export const IDS_DOS_TEMAS = Object.keys(TEMAS) as IdDoTema[];

export function ehIdDeTema(v: unknown): v is IdDoTema {
  return typeof v === "string" && v in TEMAS;
}

/** `textoSuave` -> `--texto-suave`. */
export function nomeDaVariavel(chave: ChaveDeToken): string {
  return `--${chave.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

/** O tema guardado neste navegador (ou o padrão, se não houver ou o localStorage estiver bloqueado). */
export function lerTema(): IdDoTema {
  try {
    const v = localStorage.getItem(CHAVE_TEMA);
    return ehIdDeTema(v) ? v : TEMA_PADRAO;
  } catch {
    return TEMA_PADRAO;
  }
}

/** Aplica os tokens no `documentElement` (variáveis CSS e `data-tema`). Não grava nada. */
export function aplicarTema(id: IdDoTema, alvo: HTMLElement = document.documentElement): void {
  const tema = TEMAS[id];
  for (const chave of CHAVES_DE_TOKEN) alvo.style.setProperty(nomeDaVariavel(chave), tema[chave]);
  alvo.dataset.tema = id;
  alvo.style.colorScheme = id === "claro" ? "light" : "dark";
}

/** Guarda a escolha neste navegador e aplica. Nada vai para a sala. */
export function escolherTema(id: IdDoTema): void {
  try {
    localStorage.setItem(CHAVE_TEMA, id);
  } catch {
    // sem localStorage: vale só nesta sessão
  }
  aplicarTema(id);
}
