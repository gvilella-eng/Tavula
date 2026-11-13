import { pode } from "./capacidades.ts";
import type {
  Cena,
  Estado,
  Handout,
  Pasta,
  Permissoes,
  Personagem,
  Token,
  Usuario,
} from "./estado.ts";
import { modInteligenciaDoPersonagem } from "./ficha.ts";

/** Cena que existe quando a campanha não define nenhuma (semente, banco antigo, exportação v1). */
export const CENA_PADRAO: Cena = {
  id: "cena-1",
  nome: "Cena inicial",
  larguraM: 60,
  alturaM: 45,
  grid: { quadradoM: 1.5, visivel: true },
};

type Quem = Pick<Usuario, "id" | "papel">;

/**
 * O mestre vê tudo. Os demais só veem tokens da cena ativa, das camadas `mapa` e `tokens` e não
 * ocultos: token de outra cena conta como invisível.
 */
export function tokenVisivelPara(token: Token, usuario: Quem, cenaAtivaId: string): boolean {
  if (usuario.papel === "mestre") return true;
  // 12-1: o rascunho do Claude do mestre nunca chega ao jogador.
  if (token.rascunho) return false;
  return (
    token.cenaId === cenaAtivaId &&
    (token.camada === "tokens" || token.camada === "mapa") &&
    !token.oculto
  );
}

/** A pasta é visível para este usuário? O mestre vê todas; o jogador, as "todos" e as que o citam. */
export function pastaVisivelPara(pasta: Pasta, usuario: Quem): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador" || pasta.rascunho) return false;
  const v = pasta.visivel;
  if (v.tipo === "todos") return true;
  return v.tipo === "jogadores" && v.ids.includes(usuario.id);
}

/** O handout é visível para este usuário? O mestre vê todos; o jogador só os que `visivel` cita (V3). */
export function handoutVisivelPara(
  handout: Pick<Handout, "visivel" | "rascunho" | "criadoPor">,
  usuario: Quem,
): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador" || handout.rascunho) return false;
  // 12-1: o jogador sempre vê o handout que ele criou, ainda que escolha "só o mestre".
  if (handout.criadoPor === usuario.id) return true;
  const v = handout.visivel;
  if (v.tipo === "todos") return true;
  return v.tipo === "jogadores" && v.ids.includes(usuario.id);
}

/**
 * A pasta chega a este usuário? Se ele a vê, ou se ele vê algum handout dentro dela (V3): então a pasta
 * aparece só com esses itens. (Os personagens seguem `personagemVisivelPara`, que usa só a pasta.)
 */
export function pastaChegaPara(
  pasta: Pasta,
  handouts: readonly Pick<Handout, "pastaId" | "visivel" | "rascunho" | "criadoPor">[],
  usuario: Quem,
): boolean {
  return (
    pastaVisivelPara(pasta, usuario) ||
    handouts.some((h) => h.pastaId === pasta.id && handoutVisivelPara(h, usuario))
  );
}

/** Personagem de jogador: tem alguém que o edita. NPC não tem ninguém (só o mestre). */
export function ehPersonagemDeJogador(personagem: Pick<Personagem, "editores">): boolean {
  const e = personagem.editores;
  return e.tipo === "todos" || e.ids.length > 0;
}

/** Quem edita o personagem: o mestre sempre; o jogador se for citado (ou "todos os jogadores"). */
export function podeEditarPersonagem(
  personagem: Pick<Personagem, "editores">,
  usuario: Quem,
): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador") return false;
  const e = personagem.editores;
  return e.tipo === "todos" || e.ids.includes(usuario.id);
}

/**
 * Quem vê o item: o mestre; quem o edita; e quem vê a pasta dele. Pasta que não existe (ou que o
 * jogador não vê) não revela nada.
 */
export function personagemVisivelPara(
  personagem: Personagem,
  usuario: Quem,
  pastas: readonly Pasta[],
): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador" || personagem.rascunho) return false;
  if (podeEditarPersonagem(personagem, usuario)) return true;
  const pasta = pastas.find((p) => p.id === personagem.pastaId);
  return pasta !== undefined && pastaVisivelPara(pasta, usuario);
}

/**
 * Quem vê a ficha COMPLETA de um personagem: o mestre, quem o edita e, com `ficha.verOutras`, os demais
 * jogadores que já veem o item (Lote 9).
 */
export function fichaVisivelPara(
  personagem: Pick<Personagem, "editores">,
  usuario: Quem,
  permissoes: Permissoes,
): boolean {
  if (usuario.papel === "mestre") return true;
  return podeEditarPersonagem(personagem, usuario) || pode(usuario, "ficha.verOutras", permissoes);
}

/**
 * O item como este usuário o recebe: inteiro para quem vê a ficha; para os outros, sem a ficha (nem a
 * mochila antiga), só com o que o mapa precisa (nome, retrato, token, visão) e o modificador de
 * Inteligência já calculado (a memória do mapa depende dele).
 */
export function personagemParaUsuario(
  personagem: Personagem,
  usuario: Quem,
  permissoes: Permissoes,
): Personagem {
  if (fichaVisivelPara(personagem, usuario, permissoes)) return personagem;
  const { ficha: _ficha, mochila: _mochila, ...resto } = personagem;
  return { ...resto, modInteligencia: modInteligenciaDoPersonagem(personagem) };
}

/** Quem controla o token: quem edita o personagem dele ou quem o mestre pôs em `controladoPor`. */
export function controlaToken(
  token: Token,
  usuario: Quem,
  personagens: readonly Personagem[],
): boolean {
  if (token.controladoPor.includes(usuario.id)) return true;
  if (token.personagemId === undefined) return false;
  const p = personagens.find((x) => x.id === token.personagemId);
  return p !== undefined && podeEditarPersonagem(p, usuario);
}

/**
 * Quem move: o mestre qualquer token; o jogador só se tem `token.moverProprio`, controla o token
 * (`controlaToken`), o token é visível para ele e está na camada `tokens` (o cenário da camada
 * `mapa` é fixo para os jogadores).
 */
export function podeMoverToken(
  token: Token,
  usuario: Quem,
  estado: Pick<Estado, "permissoes" | "cenaAtivaId" | "personagens">,
): boolean {
  if (usuario.papel === "mestre") return true;
  return (
    token.camada === "tokens" &&
    pode(usuario, "token.moverProprio", estado.permissoes) &&
    controlaToken(token, usuario, estado.personagens) &&
    tokenVisivelPara(token, usuario, estado.cenaAtivaId)
  );
}

/** Tira o ruído de ponto flutuante (1.5 * 3 = 4.5 etc.). */
function limpar(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Encaixe no grid. Tamanho ímpar (1, 3): o centro vai para o meio da célula. Tamanho par (2, 4):
 * o centro vai para a interseção das linhas.
 */
export function encaixarNoGrid(
  ponto: { x: number; y: number },
  tamanhoQuadrados: number,
  quadradoM: number,
): { x: number; y: number } {
  const eixo = (v: number) =>
    tamanhoQuadrados % 2 === 1
      ? (Math.floor(v / quadradoM) + 0.5) * quadradoM
      : Math.round(v / quadradoM) * quadradoM;
  return { x: limpar(eixo(ponto.x)), y: limpar(eixo(ponto.y)) };
}

/** Posição fora da cena é limitada à borda (o centro do token fica dentro da cena). */
export function limitarNaCena(
  ponto: { x: number; y: number },
  cena: Pick<Cena, "larguraM" | "alturaM">,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(ponto.x, 0), cena.larguraM),
    y: Math.min(Math.max(ponto.y, 0), cena.alturaM),
  };
}

export type Medida = { metros: number; quadrados: number; rotulo: string };

/** V13: a unidade em que o app mostra as distâncias no mapa. O estado continua sempre em metros. */
export type UnidadeDeDistancia = "m" | "pes";

export const UNIDADES_DE_DISTANCIA: readonly UnidadeDeDistancia[] = ["m", "pes"];

/** A conversão do D&D em português: 1 pé = 0,3 m (1,5 m = 5 pés). */
export const METROS_POR_PE = 0.3;

/** Metros para o valor na unidade (pés sem arredondar; 1,5 m = 5). */
export function metrosParaUnidade(metros: number, unidade: UnidadeDeDistancia): number {
  return unidade === "pes" ? limpar(metros / METROS_POR_PE) : metros;
}

/** O valor na unidade de volta para metros (o que se guarda no estado). */
export function unidadeParaMetros(valor: number, unidade: UnidadeDeDistancia): number {
  return unidade === "pes" ? limpar(valor * METROS_POR_PE) : valor;
}

/** O nome curto da unidade para rótulos: "m" ou "pés". */
export function nomeDaUnidade(unidade: UnidadeDeDistancia): string {
  return unidade === "pes" ? "pés" : "m";
}

/**
 * O texto de uma distância na unidade escolhida. Metros: uma casa decimal ("1,5 m"). Pés: o inteiro
 * mais próximo, no singular quando é 1 ("5 pés", "1 pé"). Com `casas` (só metros) muda a precisão.
 */
export function formatarDistancia(
  metros: number,
  unidade: UnidadeDeDistancia = "m",
  casas = 1,
): string {
  if (unidade === "pes") {
    const pes = Math.round(metrosParaUnidade(metros, "pes"));
    return `${pes} ${pes === 1 ? "pé" : "pés"}`;
  }
  const f = 10 ** casas;
  return `${(Math.round(metros * f) / f).toFixed(casas).replace(".", ",")} m`;
}

/** O número da distância na unidade, sem o nome, para campos de formulário ("1,5" ou "5"). */
export function numeroDaDistancia(metros: number, unidade: UnidadeDeDistancia = "m"): string {
  if (unidade === "pes") return String(Math.round(metrosParaUnidade(metros, "pes")));
  return String(limpar(metros)).replace(".", ",");
}

export type OpcoesDaRegua = {
  unidade?: UnidadeDeDistancia;
  /** Régua livre: só a distância em linha reta, sem a regra de quadrados do grid. */
  livre?: boolean;
};

function rotuloDaMedida(
  metros: number,
  quadrados: number,
  { unidade = "m", livre = false }: OpcoesDaRegua,
): string {
  const distancia = formatarDistancia(metros, unidade);
  if (livre) return distancia;
  return `${distancia} (${quadrados} ${quadrados === 1 ? "quadrado" : "quadrados"})`;
}

/**
 * Régua. Os metros são em linha reta. Os quadrados seguem o 5e 2014: cada diagonal conta 1, então
 * são os quadrados do maior dos dois eixos. Livre (V13): só a distância, sem quadrados.
 */
export function medirRegua(
  a: { x: number; y: number },
  b: { x: number; y: number },
  quadradoM: number,
  opcoes: OpcoesDaRegua = {},
): Medida {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const metros = Math.hypot(dx, dy);
  const quadrados = Math.round(Math.max(dx, dy) / quadradoM);
  return { metros, quadrados, rotulo: rotuloDaMedida(metros, quadrados, opcoes) };
}

/** V13: a régua com pontos de virada: a medida de cada trecho e o total (a soma dos trechos). */
export type Percurso = { trechos: Medida[]; total: Medida };

export function medirPercurso(
  pontos: readonly { x: number; y: number }[],
  quadradoM: number,
  opcoes: OpcoesDaRegua = {},
): Percurso {
  const trechos: Medida[] = [];
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    if (a && b) trechos.push(medirRegua(a, b, quadradoM, opcoes));
  }
  const metros = trechos.reduce((soma, t) => soma + t.metros, 0);
  const quadrados = trechos.reduce((soma, t) => soma + t.quadrados, 0);
  return {
    trechos,
    total: { metros, quadrados, rotulo: rotuloDaMedida(metros, quadrados, opcoes) },
  };
}

/**
 * Suavização exponencial para a interpolação nos outros clientes: devolve a posição depois de
 * `dtMs`, aproximando-se do alvo. Encosta exatamente no alvo quando falta quase nada.
 */
export function suavizar(atual: number, alvo: number, dtMs: number, constanteMs: number): number {
  const fator = 1 - Math.exp(-Math.max(dtMs, 0) / constanteMs);
  const proximo = atual + (alvo - atual) * fator;
  return Math.abs(alvo - proximo) < 0.002 ? alvo : proximo;
}

/**
 * Arruma tokens lado a lado a partir do ponto de chegada, sem sobreposição. Cada token ocupa
 * `tamanho × tamanho` quadrados; os candidatos são as posições do grid em torno da chegada, da
 * mesma fileira para as vizinhas (centro, direita, esquerda, depois a fileira de cima e a de
 * baixo). Devolve o centro de cada token, na ordem de `tamanhos`. Sem lugar livre na cena, o token
 * fica na chegada mesmo (a cena é pequena demais para o grupo).
 */
export function arrumarNoGrid(
  chegada: { x: number; y: number },
  cena: Pick<Cena, "larguraM" | "alturaM" | "grid">,
  tamanhos: number[],
  /** V10b: os tokens que já estão na cena; as casas deles contam como ocupadas. */
  jaNoMapa: readonly { x: number; y: number; tamanhoQuadrados: number }[] = [],
): { x: number; y: number }[] {
  const q = cena.grid.quadradoM;
  const raio = 20;
  const candidatos: { dx: number; dy: number }[] = [];
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) candidatos.push({ dx, dy });
  }
  candidatos.sort(
    (a, b) =>
      Math.abs(a.dy) - Math.abs(b.dy) ||
      Math.abs(a.dx) - Math.abs(b.dx) ||
      a.dy - b.dy ||
      b.dx - a.dx,
  );
  const ocupadas = new Set<string>();
  const celulasDe = (centro: { x: number; y: number }, tamanho: number) => {
    const i0 = Math.round((centro.x - (tamanho * q) / 2) / q);
    const j0 = Math.round((centro.y - (tamanho * q) / 2) / q);
    const celulas: { i: number; j: number }[] = [];
    for (let j = j0; j < j0 + tamanho; j++)
      for (let i = i0; i < i0 + tamanho; i++) celulas.push({ i, j });
    return celulas;
  };
  const cabeNaCena = (celulas: { i: number; j: number }[]) =>
    celulas.every(
      ({ i, j }) =>
        i >= 0 &&
        j >= 0 &&
        (i + 1) * q <= cena.larguraM + 1e-6 &&
        (j + 1) * q <= cena.alturaM + 1e-6,
    );
  for (const t of jaNoMapa) {
    for (const { i, j } of celulasDe(t, t.tamanhoQuadrados)) ocupadas.add(`${i},${j}`);
  }
  return tamanhos.map((tamanho) => {
    for (const { dx, dy } of candidatos) {
      const centro = encaixarNoGrid({ x: chegada.x + dx * q, y: chegada.y + dy * q }, tamanho, q);
      const celulas = celulasDe(centro, tamanho);
      if (!cabeNaCena(celulas) || celulas.some(({ i, j }) => ocupadas.has(`${i},${j}`))) continue;
      for (const { i, j } of celulas) ocupadas.add(`${i},${j}`);
      return centro;
    }
    return limitarNaCena(encaixarNoGrid(chegada, tamanho, q), cena);
  });
}

/** Ponto de chegada da cena: o definido pelo mestre ou, sem ele, o centro. */
export function chegadaDaCena(cena: Pick<Cena, "larguraM" | "alturaM" | "chegada">): {
  x: number;
  y: number;
} {
  return cena.chegada ?? { x: cena.larguraM / 2, y: cena.alturaM / 2 };
}

/** V10b: o raio da área da bandeira, em quadrados da cena: só aí o jogador põe o próprio token. */
export const RAIO_DA_BANDEIRA_QUADRADOS = 3;

/** A área da bandeira: um círculo em volta do ponto de chegada (centro e raio, em metros). */
export function areaDaBandeira(cena: Pick<Cena, "larguraM" | "alturaM" | "chegada" | "grid">): {
  x: number;
  y: number;
  raioM: number;
} {
  return { ...chegadaDaCena(cena), raioM: RAIO_DA_BANDEIRA_QUADRADOS * cena.grid.quadradoM };
}

/** O ponto (metros) está dentro da área da bandeira da cena? */
export function dentroDaAreaDaBandeira(
  cena: Pick<Cena, "larguraM" | "alturaM" | "chegada" | "grid">,
  ponto: { x: number; y: number },
): boolean {
  const a = areaDaBandeira(cena);
  return Math.hypot(ponto.x - a.x, ponto.y - a.y) <= a.raioM + 1e-6;
}

/**
 * V10b: este jogador pode pôr o token deste personagem na cena do grupo? Controla o personagem, tem a capacidade
 * `token.colocarProprio` e o personagem ainda não tem token nessa cena (um por personagem por cena). O mestre não
 * passa por aqui (ele põe onde quiser).
 */
export function podeColocarProprioToken(
  estado: Pick<Estado, "permissoes" | "cenaAtivaId" | "tokens">,
  usuario: Quem,
  personagem: Pick<Personagem, "id" | "editores">,
): boolean {
  return (
    usuario.papel === "jogador" &&
    pode(usuario, "token.colocarProprio", estado.permissoes) &&
    podeEditarPersonagem(personagem, usuario) &&
    !estado.tokens.some((t) => t.cenaId === estado.cenaAtivaId && t.personagemId === personagem.id)
  );
}

/**
 * V10b: a bandeira aparece para o jogador que controla algum personagem, pode pôr o próprio token e não tem nenhum
 * token dele na cena do grupo.
 */
export function jogadorVeABandeira(
  estado: Pick<Estado, "permissoes" | "cenaAtivaId" | "tokens" | "personagens">,
  usuario: Quem,
): boolean {
  if (usuario.papel !== "jogador" || !pode(usuario, "token.colocarProprio", estado.permissoes)) {
    return false;
  }
  if (!estado.personagens.some((p) => podeEditarPersonagem(p, usuario))) return false;
  return !estado.tokens.some(
    (t) =>
      t.cenaId === estado.cenaAtivaId &&
      t.camada === "tokens" &&
      controlaToken(t, usuario, estado.personagens),
  );
}
