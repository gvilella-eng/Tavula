// Temas de cor da interface: a ÚNICA fonte dos tokens. Só cores (disposição e fontes são iguais nos 11
// temas). O mapa (PixiJS) não muda com o tema: é o conteúdo da cena. A escolha é preferência de cada
// navegador (localStorage), nunca da sala. Os tokens viram variáveis CSS no `documentElement`.

/** Os ids `grimorio`, `escuro` e `claro` vêm do R1 e ficam (quem os escolheu continua neles). */
export type IdDoTema =
  | "grimorio"
  | "taverna"
  | "forja"
  | "licantropo"
  | "paladino"
  | "druida"
  | "leviata"
  | "vampiro"
  | "arcana"
  | "escuro"
  | "claro";

export const TEMA_PADRAO: IdDoTema = "grimorio";
export const CHAVE_TEMA = "tabletop:pref:tema";

/** Todas as chaves de token; cada uma vira a variável CSS `--<chave-em-kebab>`. */
export const CHAVES_DE_TOKEN = [
  "fundoMesa", // em volta do mapa
  "fundo", // fundo da página
  "barra", // barras fixas (carvão no Grimório)
  "bordaBarra",
  "painelTopo", // degradê do painel direito: no alto
  "painelMeio", // aos 160 px
  "painelFim", // embaixo
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
    fundoMesa: "#080808",
    fundo: "#0C0C0C",
    barra: "#1B1B1B",
    bordaBarra: "#313131",
    painelTopo: "#202020",
    painelMeio: "#181818",
    painelFim: "#151515",
    painel: "#252525",
    borda: "#3C3C3C",
    cabecalho: "#2A2A2A",
    campo: "#121212",
    texto: "#EDEDED",
    textoSuave: "#A8A8A8",
    textoDesabilitado: "#7A7A7A",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#4A2323",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#3A3622",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(0, 0, 0, 0.62)",
    veu: "rgba(12, 12, 12, 0.88)",
    pontoOff: "#6F6F6F",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  taverna: {
    fundoMesa: "#0B0806",
    fundo: "#0E0B09",
    barra: "#2B211A",
    bordaBarra: "#4A3A2B",
    painelTopo: "#34281F",
    painelMeio: "#261D17",
    painelFim: "#221A15",
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
  forja: {
    fundoMesa: "#0A0A09",
    fundo: "#0E0E0D",
    barra: "#232220",
    bordaBarra: "#3A3835",
    painelTopo: "#2A2926",
    painelMeio: "#1F1E1C",
    painelFim: "#1C1B19",
    painel: "#2D2C29",
    borda: "#46443F",
    cabecalho: "#32312E",
    campo: "#181716",
    texto: "#EEEAE2",
    textoSuave: "#ADA79C",
    textoDesabilitado: "#7D7971",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#502725",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#453E1F",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(10, 10, 9, 0.62)",
    veu: "rgba(14, 14, 13, 0.88)",
    pontoOff: "#65625C",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  licantropo: {
    fundoMesa: "#090B0D",
    fundo: "#0D1013",
    barra: "#1F252C",
    bordaBarra: "#343D48",
    painelTopo: "#252C35",
    painelMeio: "#1B2127",
    painelFim: "#181D23",
    painel: "#29313A",
    borda: "#3F4955",
    cabecalho: "#2E363F",
    campo: "#151A1F",
    texto: "#ECEFF2",
    textoSuave: "#A3ADB9",
    textoDesabilitado: "#767E87",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#4D292E",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#434129",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(9, 11, 13, 0.62)",
    veu: "rgba(13, 16, 19, 0.88)",
    pontoOff: "#60666E",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  paladino: {
    fundoMesa: "#070A13",
    fundo: "#0A0E1A",
    barra: "#161E33",
    bordaBarra: "#2B3654",
    painelTopo: "#1A243D",
    painelMeio: "#131A2D",
    painelFim: "#111828",
    painel: "#1F2942",
    borda: "#354262",
    cabecalho: "#242E47",
    campo: "#0F1526",
    texto: "#EEF0F6",
    textoSuave: "#A7B0C8",
    textoDesabilitado: "#787F94",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#482533",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#3D3D2E",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(7, 10, 19, 0.62)",
    veu: "rgba(10, 14, 26, 0.88)",
    pontoOff: "#60677A",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  druida: {
    fundoMesa: "#080C0A",
    fundo: "#0B110E",
    barra: "#1A2621",
    bordaBarra: "#2D4037",
    painelTopo: "#1F2E28",
    painelMeio: "#17211D",
    painelFim: "#151E1A",
    painel: "#22322B",
    borda: "#374C42",
    cabecalho: "#273730",
    campo: "#111A16",
    texto: "#ECF1EC",
    textoSuave: "#A3B5AA",
    textoDesabilitado: "#75847B",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#4A2A26",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#3F4220",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(8, 12, 10, 0.62)",
    veu: "rgba(11, 17, 14, 0.88)",
    pontoOff: "#5F6B64",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  leviata: {
    fundoMesa: "#060D0E",
    fundo: "#091315",
    barra: "#142629",
    bordaBarra: "#254046",
    painelTopo: "#182E31",
    painelMeio: "#122124",
    painelFim: "#101E20",
    painel: "#1B3135",
    borda: "#2E4C53",
    cabecalho: "#20363A",
    campo: "#0D1A1C",
    texto: "#EAF2F2",
    textoSuave: "#9FB7B9",
    textoDesabilitado: "#728688",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#46292C",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#3B4126",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(6, 13, 14, 0.62)",
    veu: "rgba(9, 19, 21, 0.88)",
    pontoOff: "#5C6D6F",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  vampiro: {
    fundoMesa: "#0C0709",
    fundo: "#120B0D",
    barra: "#2A1A1E",
    bordaBarra: "#4A2F36",
    painelTopo: "#321F24",
    painelMeio: "#25171A",
    painelFim: "#211518",
    painel: "#362329",
    borda: "#573A42",
    cabecalho: "#3B282E",
    campo: "#1B1013",
    texto: "#F4EAEA",
    textoSuave: "#C2A8AD",
    textoDesabilitado: "#8D797D",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#552225",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#4B391F",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(12, 7, 9, 0.62)",
    veu: "rgba(18, 11, 13, 0.88)",
    pontoOff: "#736165",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  arcana: {
    fundoMesa: "#0A080E",
    fundo: "#0F0C14",
    barra: "#221C2E",
    bordaBarra: "#3A3150",
    painelTopo: "#292237",
    painelMeio: "#1E1928",
    painelFim: "#1B1624",
    painel: "#2C253B",
    borda: "#463C5E",
    cabecalho: "#312A40",
    campo: "#17121F",
    texto: "#EFEAF5",
    textoSuave: "#B0A6C3",
    textoDesabilitado: "#80788F",
    acento: "#E2AE4F",
    acentoTexto: "#1E150B",
    acentoSuave: "rgba(226, 174, 79, 0.18)",
    acentoForte: "#F0C46E",
    perigo: "#EE8A55",
    perigoTexto: "#1E0F08",
    perigoFundo: "#4F232F",
    sucesso: "#7BCB8B",
    sucessoTexto: "#0E2418",
    sucessoSuave: "rgba(123, 203, 139, 0.16)",
    aviso: "#F5C542",
    avisoTexto: "#2A2100",
    avisoFundo: "#453A2A",
    avisoSuave: "rgba(245, 197, 66, 0.16)",
    avisoBorda: "#D9A521",
    oculta: "#C7B5F5",
    sobreposicao: "rgba(10, 8, 14, 0.62)",
    veu: "rgba(15, 12, 20, 0.88)",
    pontoOff: "#686174",
    sombra: "0 6px 24px rgba(0, 0, 0, 0.5)",
  },
  escuro: {
    fundoMesa: "#0A0B0E",
    fundo: "#0F1115",
    barra: "#1F2228",
    bordaBarra: "#323640",
    painelTopo: "#262A32",
    painelMeio: "#1B1E23",
    painelFim: "#181B20",
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
    painelTopo: "#FBF9F5",
    painelMeio: "#F7F4EE",
    painelFim: "#F5F1EA",
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

/** Nome mostrado de cada tema (o id não muda). */
export const NOMES_DOS_TEMAS: Record<IdDoTema, string> = {
  grimorio: "Grimório",
  taverna: "Taverna",
  forja: "Forja",
  licantropo: "Licantropo",
  paladino: "Paladino",
  druida: "Druida",
  leviata: "Leviatã",
  vampiro: "Vampiro",
  arcana: "Arcana",
  escuro: "Edgerunner",
  claro: "Pergaminho",
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
