import { type AssetMeta, assetVisivelPara, type TipoDeAsset } from "./assets.ts";
import type { Estado, Usuario } from "./estado.ts";
import { acoesDoFluxo } from "./fluxosLeitura.ts";
import { handoutVisivelPara, personagemVisivelPara, tokenVisivelPara } from "./mapa.ts";
import { lugaresDe } from "./mesadesom.ts";

// AS1: "Assets da mesa". Tudo o que a mesa guarda (mapas, imagens, gifs, sons, músicas, retratos, tokens, handouts, json) numa
// lista só, com quem enviou e onde cada arquivo é usado. A regra de visão é a que já existia: o mestre vê tudo; o jogador só o
// que ele já pode ver (o que está em uso na cena dele, os handouts liberados, os dele). Nunca o mapa escondido nem os sons do mestre.

type Quem = Pick<Usuario, "id" | "papel">;

/** Categoria para o filtro por tipo (junta o que o jogador entende como "a mesma coisa"). */
export const CATEGORIAS_DE_ASSET = [
  "mapa",
  "imagem",
  "animacao",
  "token",
  "retrato",
  "som",
  "json",
] as const;
export type CategoriaDeAsset = (typeof CATEGORIAS_DE_ASSET)[number];

export const ROTULO_DA_CATEGORIA: Record<CategoriaDeAsset, string> = {
  mapa: "Mapas",
  imagem: "Imagens",
  animacao: "Animações",
  token: "Tokens",
  retrato: "Retratos",
  som: "Sons e músicas",
  json: "Json",
};

export function categoriaDoAsset(tipo: TipoDeAsset): CategoriaDeAsset | null {
  switch (tipo) {
    case "mapa":
      return "mapa";
    case "imagem":
      return "imagem";
    case "animacao":
      return "animacao";
    case "token":
      return "token";
    case "retrato":
      return "retrato";
    case "som":
      return "som";
    case "compendio":
      return "json";
    default:
      return null;
  }
}

/** Um lugar onde o arquivo é usado agora. `removivel`: dá para apagar o arquivo e a mesa se arruma sozinha (tira a imagem). */
export type UsoDoAsset = { rotulo: string; removivel: boolean };

type EstadoDeUso = Pick<Estado, "cenas" | "tokens" | "personagens" | "handouts"> &
  Partial<
    Pick<
      Estado,
      "compendio" | "mesaDeSom" | "zonas" | "automacoes" | "musica" | "modelos" | "trilha"
    >
  >;

/** Onde o arquivo `hash` é usado. A ordem é a da lista (mapas, objetos, fichas, handouts, sons, luz). */
export function usosDoAsset(estado: EstadoDeUso, hash: string): UsoDoAsset[] {
  const usos: UsoDoAsset[] = [];
  const nomeDaCena = (id: string) => estado.cenas.find((c) => c.id === id)?.nome ?? "?";
  for (const c of estado.cenas) {
    if (c.mapa?.assetHash === hash)
      usos.push({ rotulo: `mapa da cena ${c.nome}`, removivel: true });
    if (c.trilha?.hash === hash) {
      usos.push({ rotulo: `trilha da cena ${c.nome}`, removivel: false });
    }
  }
  for (const t of estado.tokens) {
    if (t.assetHash !== hash) continue;
    usos.push({
      rotulo: t.imagem
        ? `imagem solta ${t.nome} (cena ${nomeDaCena(t.cenaId)})`
        : `token ${t.nome}`,
      removivel: true,
    });
  }
  for (const p of estado.personagens) {
    if (p.retratoHash === hash) usos.push({ rotulo: `retrato de ${p.nome}`, removivel: true });
    if (p.tokenPadrao.assetHash === hash) {
      usos.push({ rotulo: `token padrão de ${p.nome}`, removivel: true });
    }
    if (p.ficha?.aparenciaHash === hash) {
      usos.push({ rotulo: `aparência de ${p.nome}`, removivel: true });
    }
    if (p.ficha?.simboloHash === hash)
      usos.push({ rotulo: `símbolo de ${p.nome}`, removivel: true });
  }
  for (const h of estado.handouts ?? []) {
    if (h.imagemHash === hash) usos.push({ rotulo: `handout ${h.titulo}`, removivel: true });
  }
  if (estado.compendio?.hash === hash) {
    usos.push({ rotulo: "compêndio da mesa", removivel: false });
  }
  const lugares = lugaresDe(estado.mesaDeSom);
  lugares.efeitos.forEach((l, i) => {
    if (l?.hash === hash) {
      usos.push({ rotulo: `efeito ${i + 1} (${l.nome}) da mesa de som`, removivel: false });
    }
  });
  lugares.ambientes.forEach((l, i) => {
    if (l?.hash === hash) {
      usos.push({ rotulo: `ambiente ${i + 1} (${l.nome}) da mesa de som`, removivel: false });
    }
  });
  for (const z of estado.zonas ?? []) {
    if (z.efeitos.som?.hash === hash) usos.push({ rotulo: `zona ${z.nome}`, removivel: false });
  }
  for (const f of estado.automacoes?.fluxos ?? []) {
    if (acoesDoFluxo(f).some((a) => a.acao === "som.tocar" && a.hash === hash)) {
      usos.push({ rotulo: `automação ${f.nome}`, removivel: false });
    }
  }
  for (const f of estado.musica?.faixas ?? []) {
    if (f.hash === hash) usos.push({ rotulo: `música ${f.nome}`, removivel: false });
  }
  for (const m of estado.modelos ?? []) {
    for (const estagio of ["forte", "fraca", "morrendo"] as const) {
      if (m.animacoes?.[estagio] === hash) {
        usos.push({ rotulo: `chama ${estagio} do modelo ${m.nome}`, removivel: false });
      }
    }
  }
  if (estado.trilha?.hash === hash) usos.push({ rotulo: "trilha da mesa", removivel: false });
  return usos;
}

/** Uma linha da lista "Assets da mesa". */
export type LinhaDeAsset = {
  hash: string;
  /** O nome que a mesa mostra (o que o mestre pôs, ou o do arquivo). */
  nome: string;
  nomeOriginal: string;
  tipo: TipoDeAsset;
  categoria: CategoriaDeAsset;
  mime: string;
  bytes: number;
  largura: number;
  altura: number;
  /** Quem enviou. */
  donoId: string;
  donoNome: string;
  /** Imagem com vários quadros (gif, apng, webp animado): a lista mostra "animado". */
  animado: boolean;
  usos: string[];
  /** Todos os usos se arrumam sozinhos ao apagar (a mesa tira a imagem de onde estava). */
  usosRemoviveis: boolean;
};

/** O tamanho de um mapa fatiado é o dos tiles (o manifesto não tem bytes). */
function bytesDoAsset(estado: Pick<Estado, "assets">, meta: AssetMeta): number {
  if (!meta.tiles) return meta.bytes;
  return meta.tiles.reduce(
    (soma, t) => soma + (estado.assets?.find((a) => a.hash === t.hash)?.bytes ?? 0),
    0,
  );
}

/**
 * O estado como o jogador o enxerga para efeito de "onde é usado": só o que ele vê (tokens e objetos visíveis, fichas e handouts que
 * ele vê, o mapa da cena ativa). Sem sons, zonas, automações, música nem luz: são do mestre.
 */
function visaoDoJogador(estado: Estado, usuario: Quem): EstadoDeUso {
  return {
    cenas: estado.cenas.filter((c) => c.id === estado.cenaAtivaId),
    tokens: estado.tokens.filter((t) => tokenVisivelPara(t, usuario, estado.cenaAtivaId)),
    personagens: estado.personagens.filter((p) => personagemVisivelPara(p, usuario, estado.pastas)),
    handouts: (estado.handouts ?? []).filter((h) => handoutVisivelPara(h, usuario)),
  };
}

/** Quanto vale o nome de exibição. */
export const nomeDoAsset = (m: Pick<AssetMeta, "nomeOriginal" | "nomeExibicao">): string =>
  m.nomeExibicao ?? m.nomeOriginal;

/**
 * Os assets da mesa que este usuário vê, com o uso de cada um. O mestre vê todos (menos os tiles e os cifrados do pré-envio, que
 * são pedaços internos). O jogador vê o que ele mesmo enviou e o que está em uso numa coisa que ele vê.
 */
export function listarAssetsDaMesa(estado: Estado, usuario: Quem): LinhaDeAsset[] {
  const mestre = usuario.papel === "mestre";
  if (!mestre && usuario.papel !== "jogador") return [];
  const base: EstadoDeUso = mestre ? estado : visaoDoJogador(estado, usuario);
  const nomes = new Map(estado.usuarios.map((u) => [u.id, u.nome]));
  const linhas: LinhaDeAsset[] = [];
  for (const meta of estado.assets ?? []) {
    const categoria = categoriaDoAsset(meta.tipo);
    if (categoria === null) continue;
    const usos = usosDoAsset(base, meta.hash);
    if (!mestre && meta.donoId !== usuario.id && usos.length === 0) continue;
    // Quem não é o mestre nunca vê arquivo que a regra de visão não deixa: mesmo no uso, `assetVisivelPara` decide.
    if (!mestre && !assetVisivelPara(meta.hash, estado, usuario)) continue;
    linhas.push({
      hash: meta.hash,
      nome: nomeDoAsset(meta),
      nomeOriginal: meta.nomeOriginal,
      tipo: meta.tipo,
      categoria,
      mime: meta.mime,
      bytes: bytesDoAsset(estado, meta),
      largura: meta.largura,
      altura: meta.altura,
      donoId: meta.donoId,
      donoNome: nomes.get(meta.donoId) ?? "alguém que saiu",
      animado: meta.tipo === "animacao",
      usos: usos.map((u) => u.rotulo),
      usosRemoviveis: usos.every((u) => u.removivel),
    });
  }
  return linhas;
}

// --- filtros e ordem da lista (puros, a tela só os aplica) ------------------------------------

export type OrdemDosAssets = "nome" | "data" | "tamanho";
export type FiltroDosAssets = {
  categoria?: CategoriaDeAsset | "todas";
  /** `todos` ou o id de quem enviou. */
  dono?: string;
  busca?: string;
  ordem?: OrdemDosAssets;
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Filtra e ordena. A data é a ordem em que a mesa registrou (a lista de assets guarda na ordem de chegada): `data` põe o mais
 * novo primeiro. `nome` é alfabética; `tamanho`, do maior para o menor.
 */
export function filtrarAssets(
  linhas: readonly LinhaDeAsset[],
  filtro: FiltroDosAssets,
): LinhaDeAsset[] {
  const busca = semAcento(filtro.busca?.trim() ?? "");
  const indice = new Map(linhas.map((l, i) => [l.hash, i]));
  const certas = linhas.filter(
    (l) =>
      (filtro.categoria === undefined ||
        filtro.categoria === "todas" ||
        l.categoria === filtro.categoria) &&
      (filtro.dono === undefined || filtro.dono === "todos" || l.donoId === filtro.dono) &&
      (busca === "" ||
        semAcento(l.nome).includes(busca) ||
        semAcento(l.donoNome).includes(busca) ||
        l.usos.some((u) => semAcento(u).includes(busca))),
  );
  const ordem = filtro.ordem ?? "nome";
  return certas.sort((a, b) => {
    if (ordem === "tamanho") return b.bytes - a.bytes || a.nome.localeCompare(b.nome, "pt-BR");
    if (ordem === "data") return (indice.get(b.hash) ?? 0) - (indice.get(a.hash) ?? 0);
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}

// --- apagar -----------------------------------------------------------------------------------

export type VerificacaoDeApagar =
  | { ok: true; semUso: true }
  | { ok: true; semUso: false; usos: string[] }
  | { ok: false; motivo: string; usos: string[] };

/**
 * Pode apagar este asset? Sem uso: sim. Em uso e tudo se arruma sozinho (imagens, mapas, retratos): sim, mas o aviso
 * diz o que vai sumir. Em uso num lugar que não se arruma sozinho (sons, zonas, automações, luz, compêndio): não.
 */
export function verificarApagar(estado: Estado, hash: string): VerificacaoDeApagar {
  const meta = estado.assets?.find((a) => a.hash === hash);
  if (!meta || categoriaDoAsset(meta.tipo) === null) {
    return { ok: false, motivo: "Arquivo não encontrado.", usos: [] };
  }
  const usos = usosDoAsset(estado, hash);
  if (usos.length === 0) return { ok: true, semUso: true };
  const rotulos = usos.map((u) => u.rotulo);
  if (usos.every((u) => u.removivel)) return { ok: true, semUso: false, usos: rotulos };
  return {
    ok: false,
    motivo: `Está em uso em: ${rotulos.join("; ")}. Tire o arquivo de lá antes de apagar.`,
    usos: rotulos,
  };
}

// --- de onde carregar -------------------------------------------------------------------------

export type OrigemDoArquivo = "cache" | "pasta" | "dono" | "mestre" | "qualquer";

export type SituacaoDoArquivo = {
  /** Já está no cache deste navegador (o que ele mesmo subiu ou já baixou). */
  noCache: boolean;
  /** Sou o mestre e a pasta da mesa tem o arquivo (o hash confere ao ler). */
  naPasta: boolean;
  /** Fui eu que enviei. */
  souODono: boolean;
  donoOnline: boolean;
  mestreOnline: boolean;
};

/**
 * AS1: de onde buscar um arquivo, em ordem. O que é local sempre vence a rede (ler o disco do próprio computador não gasta
 * a conexão de ninguém): primeiro o cache (que já guarda o que eu mesmo enviei: é o "subi esse arquivo, ele ainda está aqui"),
 * depois a pasta da mesa (só o mestre tem). Sem cópia local, pede pela rede, como sempre: o dono online, depois o mestre.
 * Nunca se confia no local sem conferir o hash.
 */
export function ordemDeOrigem(s: SituacaoDoArquivo): OrigemDoArquivo[] {
  const ordem: OrigemDoArquivo[] = [];
  if (s.noCache) ordem.push("cache");
  if (s.naPasta) ordem.push("pasta");
  if (!s.souODono && s.donoOnline) ordem.push("dono");
  if (s.mestreOnline) ordem.push("mestre");
  ordem.push("qualquer");
  return ordem;
}
