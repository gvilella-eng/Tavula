import {
  type AssetMeta,
  hashesPreparaveis,
  hashesUsados,
  LIMITES_DE_ASSET,
  PX_POR_QUADRADO_PADRAO,
  tamanhoDaCenaComMapa,
  validarMeta,
} from "./assets.ts";
import {
  botoesParaJogador,
  converterAutomacoesDoArquivo,
  type EventoDeAutomacao,
  efeitosParaJogador,
} from "./automacoes.ts";
import {
  type ContextoDoMotor,
  intencaoDoBotao,
  reagirAoSistema,
  rodarAutomacoes,
  rodarEvento,
  tratarAutomacao,
} from "./automacoesnucleo.ts";
import { barraDeVidaPadrao } from "./bordas.ts";
import { ehCapacidadeDelegavel, pode } from "./capacidades.ts";
import { chatParaUsuario, mensagemParaUsuario } from "./chat.ts";
import { criarMensagem, mensagemDeDadoDeVida } from "./chatnucleo.ts";
import { idDaPastaDoJogador, recusaDoClaude, TETO_DE_CRIACAO_DO_JOGADOR } from "./claude.ts";
import { combateParaUsuario } from "./combate.ts";
import {
  type ContextoDeCombate,
  combateAdicionar,
  combateAnterior,
  combateDarVez,
  combateEditar,
  combateEncerrar,
  combateEntrar,
  combateMover,
  combateOrdenar,
  combatePassar,
  combateProximo,
  combateRodada,
  combateRolar,
  combateTirar,
  semEntradasDosTokens,
  tokenCondicoes,
  tokenTemEntrada,
} from "./combatenucleo.ts";
import { type FonteDeAleatoriedade, fonteCrypto, lerExpressao, rolar } from "./dados.ts";
import { desenhoVisivelPara, LIMITES_DO_DESENHO } from "./desenho.ts";
import {
  type ContextoDeDesenho,
  desenhoApagar,
  desenhoCriar,
  desenhoLimpar,
  desenhoMover,
  desenhoRascunho,
  desenhoVoltar,
  type RascunhoRepassado,
  type SaidaDeDesenho,
} from "./desenhonucleo.ts";
import type {
  Cena,
  ConfigDaMesa,
  Estado,
  FonteDeLuz,
  Handout,
  Parede,
  Pasta,
  Personagem,
  Ponto,
  PontoDeLuz,
  PortadorFixo,
  Token,
  Usuario,
} from "./estado.ts";
import {
  absorverMochila,
  aplicarOperacoes,
  dadosDeVidaDaFicha,
  modDoAtributo,
  modelosAumentados,
  novasDoModelo,
} from "./ficha.ts";
import {
  aplicarDeltaNaVida,
  aplicarNaVida,
  copiaDoToken,
  nomeBaseDoToken,
  nomeNumerado,
  pvInicialDoToken,
  tokenParaUsuario,
  usaVidaPorToken,
  vidaDoToken,
} from "./hordas.ts";
import { fatorDeLuzDa, luzAmbienteDa, luzVisivelPara } from "./luz.ts";
import {
  arrumarNoGrid,
  CENA_PADRAO,
  chegadaDaCena,
  controlaToken,
  ehPersonagemDeJogador,
  encaixarNoGrid,
  handoutVisivelPara,
  limitarNaCena,
  pastaChegaPara,
  personagemParaUsuario,
  personagemVisivelPara,
  podeEditarPersonagem,
  podeMoverToken,
  tokenVisivelPara,
} from "./mapa.ts";
import {
  type AmbienteLigado,
  ambientesLigados,
  comLugar,
  ligadoSem,
  ligadosParaACena,
  lugarDe,
  mesaVazia,
  migrarSomDoN5,
  type SomLigado,
  somLigadoOuNada,
  tocandoAgora,
  usosDoSom,
  volumeGeralDe,
} from "./mesadesom.ts";
import { acrescentarTraco, tirarUltimoTraco } from "./nevoa.ts";
import {
  modelosParaJogador,
  objetoParaVisao,
  pontoVisivelPara,
  relogioParaVisao,
} from "./objetos.ts";
import {
  ALCANCE_INTERACAO_PADRAO_M,
  alternarPortaDoJogador,
  alternarPortaDoMestre,
  arcoPorTresPontos,
  cenaEhCartao,
  iluminacaoDinamicaLigada,
  paredeParaJogador,
  trajetoBloqueado,
} from "./paredes.ts";
import { type PingRepassado, pingar } from "./ping.ts";
import {
  type CodigoDeErro,
  capacidadeDaIntencao,
  type EventoSala,
  type Exportacao,
  ExportacaoSchema,
  type Intencao,
  type Pacote,
  VERSAO_EXPORTACAO,
} from "./protocolo.ts";
import {
  carimbarRascunho,
  eventosDePublicacao,
  intencaoDeDescarte,
  listarRascunhos,
} from "./rascunhos.ts";
import { marcoDoRelogio, restanteDoObjeto, tempoDaSala } from "./relogio.ts";
import { efeitoChegaPara } from "./somnucleo.ts";
import {
  type ContextoDeTochas,
  mochilaAjustar,
  type NovoEvento,
  objetoAjustar,
  pontoAcenderFim,
  pontoAcenderInicio,
  pontoPegar,
  tocharAcender,
  tocharAlternar,
  tocharEntregar,
  tocharGuardar,
  tocharPosar,
} from "./tochas.ts";
import { MAXIMO_DE_ZONAS, type Zona, ZonaSchema, zonasDe } from "./zonas.ts";

export type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };

/** Quanto tempo, depois de apagado, um token ainda pode ser restaurado por quem o apagou (V10). */
export const PRAZO_PARA_RESTAURAR_TOKEN_MS = 10_000;

/**
 * 12-1: o que a sala sabe da conexão que mandou a intenção. `claude`: é a conexão do Claude do usuário (a mesma
 * capacidade e a mesma visão do usuário, mais a lista de proibidos, a marca "pelo Claude" e, para o mestre, o rascunho).
 */
export type OpcoesDeProcessar = { claude?: boolean };

/** Um token que acabou de sair do mapa: a sala o guarda só na memória, pelo prazo acima. */
export type TokenApagadoRecente = { token: Token; por: string; emMs: number };

export type Resultado =
  | {
      ok: true;
      estado: Estado;
      eventos: EventoSala[];
      /** Quem deve receber um snapshot novo (em vez do evento, no caso de quem mudou de papel). */
      snapshotPara: "todos" | string[];
      /** Preenchido por `campanha.exportar`: vai só para quem pediu. */
      exportacao?: Exportacao;
      /** Preenchido por `token.apagar`: a sala guarda o token apagado (memória) para o `token.restaurar`. */
      apagado?: { token: Token; por: string };
      /** Preenchido por `token.mover` (transitório): a sala repassa a quem pode ver o token. */
      movendo?: { id: string; x: number; y: number };
      /** Preenchido por `desenho.rascunho` (transitório): a sala repassa a quem recebe a cena. */
      rascunho?: RascunhoRepassado;
      /** Preenchido por `mapa.ping` (transitório): a sala limita a frequência e repassa a quem vê a cena. */
      ping?: PingRepassado;
      /** Preenchido por `cena.preparar`: a sala guarda os pacotes (chaves só dela e do mestre). */
      preparo?: { cenaId: string; pacotes: Pacote[] };
      /** Preenchido por `grupo.moverPara`: a sala entrega as chaves do preparo antes do snapshot. */
      grupoMovido?: { cenaId: string };
    }
  | { ok: false; erro: ErroDaSala };

type ResultadoOk = Extract<Resultado, { ok: true }>;
type Visao = Pick<Usuario, "id" | "papel">;

function recusa(codigo: CodigoDeErro, mensagem: string): Resultado {
  return { ok: false, erro: { codigo, mensagem } };
}

function cenaAtiva(estado: Estado) {
  const cena = estado.cenas.find((c) => c.id === estado.cenaAtivaId) ?? estado.cenas[0];
  if (!cena) throw new Error("estado sem cenas");
  return cena;
}

/** A cena do pedido (a ativa, se o pedido não diz qual). */
function cenaDoPedido(estado: Estado, cenaId: string | undefined): Cena | undefined {
  return cenaId === undefined ? cenaAtiva(estado) : estado.cenas.find((c) => c.id === cenaId);
}

const SEM_CENA = "Cena não encontrada.";
const SEM_PERSONAGEM = "Personagem não encontrado.";

/** PV atual nunca passa do máximo. */
function limitarPv(p: Personagem): Personagem {
  const f = p.ficha;
  return f && f.pvAtual > f.pvMax ? { ...p, ficha: { ...f, pvAtual: f.pvMax } } : p;
}

function personagemDe(estado: Estado, id: string): Personagem | undefined {
  return estado.personagens.find((p) => p.id === id);
}

function pastaDe(estado: Pick<Estado, "pastas">, id: string): Pasta | undefined {
  return estado.pastas.find((p) => p.id === id);
}

const SEM_PASTA = "Pasta não encontrada.";
const SEM_HANDOUT = "Handout não encontrado.";

function handoutDe(estado: Pick<Estado, "handouts">, id: string): Handout | undefined {
  return estado.handouts.find((h) => h.id === id);
}

/** Token de personagem de jogador? (O personagem pode ter sido apagado: então não é.) */
function ehDoGrupo(estado: Estado, t: Token): boolean {
  const p = t.personagemId === undefined ? undefined : personagemDe(estado, t.personagemId);
  return p !== undefined && ehPersonagemDeJogador(p);
}

/** Só porta e secreta têm estado; sem ele nascem fechadas. */
function estadoDaParede(
  tipo: Parede["tipo"],
  estado: Parede["estado"],
): { estado?: NonNullable<Parede["estado"]> } {
  return tipo === "porta" || tipo === "secreta" ? { estado: estado ?? "fechada" } : {};
}

/** Um jogador qualquer: serve para saber se um token é visível aos jogadores (oculto e camada do mestre não são). */
const JOGADOR_QUALQUER = { id: "-", papel: "jogador" } as const;

/** Fontes de luz presas ao token. */
function luzesDoToken(estado: Estado, tokenId: string): FonteDeLuz[] {
  return estado.luzes.filter((l) => l.portador.tipo === "token" && l.portador.tokenId === tokenId);
}

function usuariosExistem(estado: Estado, ids: string[]): boolean {
  return ids.every((id) => estado.usuarios.some((u) => u.id === id));
}

function semIndefinidos<T extends object>(
  objeto: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

function metaDoAsset(estado: Estado, hash: string): AssetMeta | undefined {
  return estado.assets?.find((a) => a.hash === hash);
}

/** A cena como o jogador a recebe: sem os ambientes da mesa de som (nem a trilha antiga), que são do mestre. */
function cenaParaJogador(cena: Cena): Cena {
  const { trilha: _trilha, ambientes: _ambientes, ...resto } = cena;
  return resto;
}

/** Os ambientes ligados com o relógio da sala de `agora` (cada quem calcula o desvio e o ponto em que o ambiente está). */
function ligadoComRelogio(s: SomLigado, agora: number): SomLigado {
  return { ...s, ambientes: s.ambientes.map((a) => ({ ...a, servidorMs: agora })) };
}

function imagemDeTokenExiste(estado: Estado, hash: string): boolean {
  const tipo = metaDoAsset(estado, hash)?.tipo;
  return tipo === "token" || tipo === "retrato";
}

/**
 * O token com as mudanças do `token.editar` aplicadas (ou o erro que recusa). Serve ao pedido de um token e ao
 * `tokens.editar` (vários). `borda: null` tira a borda; `barraDeVida: true` volta ao padrão (sem o campo).
 */
function tokenComMudancas(
  estado: Estado,
  atual: Token,
  mudancas: Extract<Intencao, { tipo: "token.editar" }>["dados"]["mudancas"],
): { token: Token } | { erro: Resultado } {
  if (mudancas.controladoPor && !usuariosExistem(estado, mudancas.controladoPor)) {
    return { erro: recusa("usuario_inexistente", "Usuário de controle não encontrado.") };
  }
  const { assetHash, alcanceVisaoM, visaoNoEscuroM, borda, barraDeVida, ...demais } = mudancas;
  const token: Token = { ...atual, ...semIndefinidos(demais) };
  if (alcanceVisaoM === null) delete token.alcanceVisaoM;
  else if (alcanceVisaoM !== undefined) token.alcanceVisaoM = alcanceVisaoM;
  if (visaoNoEscuroM === null) delete token.visaoNoEscuroM;
  else if (visaoNoEscuroM !== undefined) token.visaoNoEscuroM = visaoNoEscuroM;
  if (borda === null) delete token.borda;
  else if (borda !== undefined) token.borda = borda;
  if (barraDeVida === true) delete token.barraDeVida;
  else if (barraDeVida === false) token.barraDeVida = false;
  if (assetHash === null) delete token.assetHash;
  else if (assetHash !== undefined) {
    if (!imagemDeTokenExiste(estado, assetHash)) {
      return { erro: recusa("asset_inexistente", "Imagem não encontrada.") };
    }
    token.assetHash = assetHash;
  }
  return { token };
}

/**
 * Esconder (ou mostrar) um token que carrega luz muda o que os jogadores recebem da luz dele: snapshot novo (o filtro de
 * evento só cuida de um evento por vez). O mesmo vale para a entrada do token na ordem de turno.
 */
function precisaDeSnapshot(estado: Estado, atual: Token, token: Token): boolean {
  const aparenciaMudou =
    tokenVisivelPara(atual, JOGADOR_QUALQUER, estado.cenaAtivaId) !==
    tokenVisivelPara(token, JOGADOR_QUALQUER, estado.cenaAtivaId);
  return (
    aparenciaMudou &&
    (luzesDoToken(estado, token.id).length > 0 || tokenTemEntrada(estado, token.id))
  );
}

function ehJogador(estado: Estado, id: string): boolean {
  return estado.usuarios.some((u) => u.id === id && u.papel === "jogador");
}

function editoresValidos(estado: Estado, editores: Personagem["editores"]): boolean {
  return editores.tipo === "todos" || editores.ids.every((id) => ehJogador(estado, id));
}

function totalDeMestres(estado: Estado): number {
  return estado.usuarios.filter((u) => u.papel === "mestre").length;
}

/** 12-1: o jogador pode criar mais uma ficha (ou um handout) dele? A capacidade vale e o teto de 20 de cada. */
function podeCriarDoJogador(
  estado: Estado,
  usuario: Usuario,
  tipo: "personagem" | "handout",
): Resultado | null {
  if (!pode(usuario, "personagem.criarProprio", estado.permissoes)) {
    return recusa("sem_permissao", "Sem permissão (personagem.criarProprio).");
  }
  const total =
    tipo === "personagem"
      ? estado.personagens.filter((p) => p.criadoPor === usuario.id).length
      : estado.handouts.filter((h) => h.criadoPor === usuario.id).length;
  if (total >= TETO_DE_CRIACAO_DO_JOGADOR) {
    return recusa(
      "limite_de_criacao",
      tipo === "personagem"
        ? `Você já criou ${TETO_DE_CRIACAO_DO_JOGADOR} fichas: apague uma para criar outra.`
        : `Você já criou ${TETO_DE_CRIACAO_DO_JOGADOR} handouts: apague um para criar outro.`,
    );
  }
  return null;
}

/** 12-1: a pasta própria do jogador (só ele e o mestre a veem) nasce no primeiro item dele. */
function garantirPastaDoJogador(
  estado: Estado,
  usuario: Usuario,
  emitir: (evento: NovoEvento) => void,
): void {
  const id = idDaPastaDoJogador(usuario.id);
  if (pastaDe(estado, id)) return;
  const ordem = Math.min(10_000, estado.pastas.reduce((m, p) => Math.max(m, p.ordem), -1) + 1);
  emitir({
    tipo: "pasta.alterada",
    dados: {
      pasta: {
        id,
        nome: `Fichas de ${usuario.nome}`.slice(0, 64),
        ordem,
        visivel: { tipo: "jogadores", ids: [usuario.id] },
        criadoPor: usuario.id,
      },
    },
  });
}

/**
 * 12-1: o mestre mexe em qualquer handout; o jogador, só nos que ele criou. O resto: o que ele vê responde "sem permissão",
 * o que ele não vê responde "inexistente" (não revela nada). `null`: pode.
 */
function negarHandout(h: Handout, usuario: Usuario): Resultado | null {
  if (usuario.papel === "mestre") return null;
  if (usuario.papel === "jogador" && h.criadoPor === usuario.id) return null;
  return handoutVisivelPara(h, usuario)
    ? recusa("sem_permissao", "Só o mestre mexe neste handout.")
    : recusa("handout_inexistente", SEM_HANDOUT);
}

/** Só os metadados dos assets que a campanha usa (mapas, imagens de tokens e tiles): nunca bytes. */
export function criarExportacao(estado: Estado, agora: string): Exportacao {
  const usados = hashesUsados(estado);
  // A memória esquecida e os acendimentos pendentes são dado da sessão, não da campanha.
  // O chat também: é registro da sessão, mora na tabela própria da sala e fica fora da exportação.
  const {
    memoriaEsquecida: _sessao,
    trilha: _trilha,
    somLigado: _somLigado,
    acendimentos: _pendentes,
    chat: _chat,
    retratosDoChat: _retratos,
    ...campanha
  } = estado;
  return {
    formato: "tabletop-campanha",
    versao: VERSAO_EXPORTACAO,
    exportadoEm: agora,
    dados: {
      ...campanha,
      // A campanha restaurada começa com a mesa pausada, no tempo em que foi exportada.
      relogio: {
        pausada: true,
        acumuladoMs: tempoDaSala(estado.relogio, Date.parse(agora)),
        ...marcoDoRelogio(estado.relogio),
      },
      assets: (estado.assets ?? []).filter((a) => usados.has(a.hash)),
    },
  };
}

/**
 * Valida um arquivo de exportação (de v1 a v13; o resultado é sempre v13): formato, ids únicos, pelo
 * menos um mestre, exceções válidas, cena ativa, pastas, personagens e tokens coerentes.
 */
export function lerExportacao(
  bruto: unknown,
): { ok: true; exportacao: Exportacao } | { ok: false; motivo: string } {
  // 7b-1: a forma enxuta das automações (ciclos no topo, reações dentro do modelo) vira a fatia `automacoes`.
  const r = ExportacaoSchema.safeParse(converterAutomacoesDoArquivo(bruto));
  if (!r.success) {
    const problema = r.error.issues[0];
    return { ok: false, motivo: `${problema?.path.join(".") ?? ""}: ${problema?.message ?? ""}` };
  }
  const {
    usuarios,
    permissoes,
    cenas,
    cenaAtivaId,
    tokens,
    assets,
    personagens,
    pastas,
    handouts,
    paredes,
    luzes,
    pontos,
    modelos,
    combate,
    desenhos,
    compendio,
    automacoes,
    efeitos,
    zonas,
  } = r.data.dados;
  const ids = new Set(usuarios.map((u) => u.id));
  if (ids.size !== usuarios.length) return { ok: false, motivo: "ids de usuário repetidos" };
  if (!usuarios.some((u) => u.papel === "mestre"))
    return { ok: false, motivo: "sem nenhum mestre" };
  for (const id of Object.keys(permissoes.porUsuario)) {
    if (!ids.has(id)) return { ok: false, motivo: `exceção para usuário desconhecido: ${id}` };
  }
  const idsDeCenas = new Set(cenas.map((c) => c.id));
  if (idsDeCenas.size !== cenas.length) return { ok: false, motivo: "ids de cena repetidos" };
  if (!idsDeCenas.has(cenaAtivaId)) return { ok: false, motivo: "cena ativa inexistente" };
  if (new Set(tokens.map((t) => t.id)).size !== tokens.length) {
    return { ok: false, motivo: "ids de token repetidos" };
  }
  if (new Set(paredes.map((p) => p.id)).size !== paredes.length) {
    return { ok: false, motivo: "ids de parede repetidos" };
  }
  for (const p of paredes) {
    if (!idsDeCenas.has(p.cenaId)) {
      return { ok: false, motivo: `parede em cena desconhecida: ${p.id}` };
    }
  }
  if (new Set(luzes.map((l) => l.id)).size !== luzes.length) {
    return { ok: false, motivo: "ids de fonte de luz repetidos" };
  }
  if (new Set(pontos.map((p) => p.id)).size !== pontos.length) {
    return { ok: false, motivo: "ids de ponto repetidos" };
  }
  for (const p of pontos) {
    if (!idsDeCenas.has(p.cenaId)) {
      return { ok: false, motivo: `ponto em cena desconhecida: ${p.id}` };
    }
  }
  if (new Set(modelos.map((m) => m.id)).size !== modelos.length) {
    return { ok: false, motivo: "ids de modelo repetidos" };
  }
  for (const l of luzes) {
    const p = l.portador;
    if (p.tipo === "cena" || p.tipo === "token") {
      if (l.cenaId === undefined || !idsDeCenas.has(l.cenaId)) {
        return { ok: false, motivo: `fonte de luz em cena desconhecida: ${l.id}` };
      }
    }
    if (p.tipo === "token") {
      const id = p.tokenId;
      if (!tokens.some((t) => t.id === id && t.cenaId === l.cenaId)) {
        return { ok: false, motivo: `fonte de luz presa a token inexistente: ${l.id}` };
      }
    }
    if (p.tipo === "ponto") {
      const id = p.pontoId;
      if (!pontos.some((x) => x.id === id)) {
        return { ok: false, motivo: `objeto de luz num ponto inexistente: ${l.id}` };
      }
    }
    if (
      (p.tipo === "mao" || p.tipo === "mochila") &&
      !personagens.some((x) => x.id === p.personagemId)
    ) {
      return { ok: false, motivo: `objeto de luz de personagem inexistente: ${l.id}` };
    }
  }
  const idsDePersonagens = new Set(personagens.map((p) => p.id));
  if (idsDePersonagens.size !== personagens.length) {
    return { ok: false, motivo: "ids de personagem repetidos" };
  }
  const idsDePastas = new Set(pastas.map((p) => p.id));
  if (idsDePastas.size !== pastas.length) return { ok: false, motivo: "ids de pasta repetidos" };
  for (const pasta of pastas) {
    if (pasta.visivel.tipo === "jogadores" && pasta.visivel.ids.some((id) => !ids.has(id))) {
      return { ok: false, motivo: `pasta visível para usuário desconhecido: ${pasta.id}` };
    }
  }
  for (const p of personagens) {
    if (p.editores.tipo === "jogadores" && p.editores.ids.some((id) => !ids.has(id))) {
      return { ok: false, motivo: `personagem de usuário desconhecido: ${p.id}` };
    }
    if (!idsDePastas.has(p.pastaId)) {
      return { ok: false, motivo: `personagem em pasta desconhecida: ${p.id}` };
    }
  }
  if (new Set(handouts.map((h) => h.id)).size !== handouts.length) {
    return { ok: false, motivo: "ids de handout repetidos" };
  }
  for (const h of handouts) {
    if (!idsDePastas.has(h.pastaId)) {
      return { ok: false, motivo: `handout em pasta desconhecida: ${h.id}` };
    }
    if (h.visivel.tipo === "jogadores" && h.visivel.ids.some((id) => !ids.has(id))) {
      return { ok: false, motivo: `handout visível para usuário desconhecido: ${h.id}` };
    }
  }
  for (const t of tokens) {
    if (!idsDeCenas.has(t.cenaId)) {
      return { ok: false, motivo: `token em cena desconhecida: ${t.id}` };
    }
    if (t.personagemId !== undefined && !idsDePersonagens.has(t.personagemId)) {
      return { ok: false, motivo: `token de personagem desconhecido: ${t.id}` };
    }
    if (t.controladoPor.some((id) => !ids.has(id))) {
      return { ok: false, motivo: `token controlado por usuário desconhecido: ${t.id}` };
    }
  }
  if (new Set(desenhos.map((d) => d.id)).size !== desenhos.length) {
    return { ok: false, motivo: "ids de desenho repetidos" };
  }
  const contagemPorCena = new Map<string, number>();
  for (const d of desenhos) {
    if (!idsDeCenas.has(d.cenaId)) {
      return { ok: false, motivo: `desenho em cena desconhecida: ${d.id}` };
    }
    if (!ids.has(d.autorId)) {
      return { ok: false, motivo: `desenho de usuário desconhecido: ${d.id}` };
    }
    const total = (contagemPorCena.get(d.cenaId) ?? 0) + 1;
    contagemPorCena.set(d.cenaId, total);
    if (total > LIMITES_DO_DESENHO.porCena) {
      return { ok: false, motivo: `desenhos demais na cena ${d.cenaId}` };
    }
  }
  if (combate) {
    const idsDeEntradas = new Set(combate.entradas.map((e) => e.id));
    if (idsDeEntradas.size !== combate.entradas.length) {
      return { ok: false, motivo: "ids de entrada de combate repetidos" };
    }
    if (combate.atualId !== undefined && !idsDeEntradas.has(combate.atualId)) {
      return { ok: false, motivo: "a vez é de uma entrada inexistente" };
    }
    for (const e of combate.entradas) {
      if (e.tokenId !== undefined && !tokens.some((t) => t.id === e.tokenId)) {
        return { ok: false, motivo: `entrada de combate de token desconhecido: ${e.id}` };
      }
    }
  }
  if (automacoes) {
    if (new Set(automacoes.ciclos.map((c) => c.id)).size !== automacoes.ciclos.length) {
      return { ok: false, motivo: "ids de ciclo repetidos" };
    }
    if (new Set(automacoes.reacoes.map((x) => x.id)).size !== automacoes.reacoes.length) {
      return { ok: false, motivo: "ids de reação repetidos" };
    }
  }
  if (zonas) {
    if (new Set(zonas.map((z) => z.id)).size !== zonas.length) {
      return { ok: false, motivo: "ids de zona repetidos" };
    }
    for (const z of zonas) {
      if (!idsDeCenas.has(z.cenaId))
        return { ok: false, motivo: `zona em cena desconhecida: ${z.id}` };
    }
  }
  if (efeitos && new Set(efeitos.map((x) => x.id)).size !== efeitos.length) {
    return { ok: false, motivo: "ids de efeito repetidos" };
  }
  const porHash = new Map(assets.map((a) => [a.hash, a]));
  if (porHash.size !== assets.length) return { ok: false, motivo: "hashes de asset repetidos" };
  if (compendio && porHash.get(compendio.hash)?.tipo !== "compendio") {
    return { ok: false, motivo: "compêndio sem meta" };
  }
  for (const a of assets) {
    const problema = validarMeta(a);
    if (problema) return { ok: false, motivo: `asset ${a.hash.slice(0, 8)}: ${problema}` };
    if (!ids.has(a.donoId)) return { ok: false, motivo: "asset de usuário desconhecido" };
    for (const tile of a.tiles ?? []) {
      if (porHash.get(tile.hash)?.tipo !== "tile") return { ok: false, motivo: "tile sem meta" };
    }
  }
  for (const c of cenas) {
    if (c.mapa && porHash.get(c.mapa.assetHash)?.tipo !== "mapa") {
      return { ok: false, motivo: `mapa sem meta na cena ${c.id}` };
    }
  }
  for (const t of tokens) {
    if (t.assetHash !== undefined && !porHash.has(t.assetHash)) {
      return { ok: false, motivo: `imagem sem meta no token ${t.id}` };
    }
  }
  for (const h of handouts) {
    if (h.imagemHash !== undefined && !porHash.has(h.imagemHash)) {
      return { ok: false, motivo: `imagem sem meta no handout ${h.id}` };
    }
  }
  for (const p of personagens) {
    for (const h of [p.ficha?.aparenciaHash, p.ficha?.simboloHash]) {
      if (h !== undefined && !porHash.has(h)) {
        return { ok: false, motivo: `imagem da ficha sem meta no personagem ${p.id}` };
      }
    }
    if (p.tokenPadrao.assetHash !== undefined && !porHash.has(p.tokenPadrao.assetHash)) {
      return { ok: false, motivo: `imagem sem meta no personagem ${p.id}` };
    }
    if (p.retratoHash !== undefined && !porHash.has(p.retratoHash)) {
      return { ok: false, motivo: `retrato sem meta no personagem ${p.id}` };
    }
  }
  // Q4: o som do N5 (trilha e trilha da cena) vira a mesa de som.
  const dados = migrarSomDoN5(r.data.dados);
  return { ok: true, exportacao: { ...r.data, dados } };
}

/**
 * Aplica um evento ao estado. Usada pela sala e pelo cliente: os dois lados nunca divergem.
 * Evento com `seq` antigo (já refletido no estado) é ignorado.
 */
export function reduzir(estado: Estado, evento: EventoSala): Estado {
  if (evento.seq <= estado.seq) return estado;
  const base = { ...estado, seq: evento.seq };
  switch (evento.tipo) {
    case "papel.alterado":
      return {
        ...base,
        usuarios: base.usuarios.map((u) =>
          u.id === evento.dados.usuarioId ? { ...u, papel: evento.dados.papel } : u,
        ),
      };
    case "token.criado":
    case "token.editado": {
      const { token } = evento.dados;
      const existe = base.tokens.some((t) => t.id === token.id);
      return {
        ...base,
        tokens: existe
          ? base.tokens.map((t) => (t.id === token.id ? token : t))
          : [...base.tokens, token],
      };
    }
    case "token.apagado":
    case "token.sumiu":
      return { ...base, tokens: base.tokens.filter((t) => t.id !== evento.dados.id) };
    case "token.movido": {
      const { id, x, y } = evento.dados;
      return { ...base, tokens: base.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)) };
    }
    case "parede.criada":
    case "parede.editada": {
      const { parede } = evento.dados;
      const existe = base.paredes.some((x) => x.id === parede.id);
      return {
        ...base,
        paredes: existe
          ? base.paredes.map((x) => (x.id === parede.id ? parede : x))
          : [...base.paredes, parede],
      };
    }
    case "parede.apagada":
      return { ...base, paredes: base.paredes.filter((x) => x.id !== evento.dados.id) };
    case "fonte.criada":
    case "fonte.editada": {
      const { fonte } = evento.dados;
      const existe = base.luzes.some((x) => x.id === fonte.id);
      return {
        ...base,
        luzes: existe
          ? base.luzes.map((x) => (x.id === fonte.id ? fonte : x))
          : [...base.luzes, fonte],
      };
    }
    case "fonte.apagada":
      return { ...base, luzes: base.luzes.filter((x) => x.id !== evento.dados.id) };
    case "mesa.pausada":
      return {
        ...base,
        relogio: {
          pausada: true,
          acumuladoMs: evento.dados.salaMs,
          ...marcoDoRelogio(base.relogio),
        },
      };
    case "mesa.retomada":
      return {
        ...base,
        relogio: {
          pausada: false,
          acumuladoMs: evento.dados.salaMs,
          ...(evento.dados.desdeReal === undefined ? {} : { desdeReal: evento.dados.desdeReal }),
          ...marcoDoRelogio(base.relogio),
        },
      };
    case "mesa.relogioZerado":
      // O tempo da sala não muda (mesmo valor, mesma hora): só o marco da pílula.
      return {
        ...base,
        relogio: {
          pausada: base.relogio.pausada,
          acumuladoMs: evento.dados.salaMs,
          ...(base.relogio.pausada || evento.dados.desdeReal === undefined
            ? {}
            : { desdeReal: evento.dados.desdeReal }),
          marcoMs: evento.dados.salaMs,
        },
      };
    case "modelo.alterado": {
      const { modelo } = evento.dados;
      const existe = base.modelos.some((m) => m.id === modelo.id);
      return {
        ...base,
        modelos: existe
          ? base.modelos.map((m) => (m.id === modelo.id ? modelo : m))
          : [...base.modelos, modelo],
      };
    }
    case "modelo.apagado":
      return { ...base, modelos: base.modelos.filter((m) => m.id !== evento.dados.id) };
    case "ponto.alterado": {
      const { ponto } = evento.dados;
      const existe = base.pontos.some((p) => p.id === ponto.id);
      return {
        ...base,
        pontos: existe
          ? base.pontos.map((p) => (p.id === ponto.id ? ponto : p))
          : [...base.pontos, ponto],
      };
    }
    case "ponto.apagado":
      return { ...base, pontos: base.pontos.filter((p) => p.id !== evento.dados.id) };
    case "config.alterada":
      return { ...base, config: evento.dados.config };
    case "memoria.esquecida":
      return {
        ...base,
        memoriaEsquecida: { ...base.memoriaEsquecida, [evento.dados.cenaId]: evento.dados.versao },
      };
    case "cena.gridAlterado": {
      const { cenaId, grid, larguraM, alturaM } = evento.dados;
      const dimensoes = {
        ...(larguraM === undefined ? {} : { larguraM }),
        ...(alturaM === undefined ? {} : { alturaM }),
      };
      return {
        ...base,
        cenas: base.cenas.map((c) => (c.id === cenaId ? { ...c, grid, ...dimensoes } : c)),
      };
    }
    case "cena.mapaAlterado": {
      const { cenaId, mapa, larguraM, alturaM } = evento.dados;
      return {
        ...base,
        cenas: base.cenas.map((c) => {
          if (c.id !== cenaId) return c;
          const { mapa: _antigo, ...semMapa } = c;
          return { ...semMapa, larguraM, alturaM, ...(mapa ? { mapa } : {}) };
        }),
      };
    }
    case "personagem.alterado": {
      const { personagem } = evento.dados;
      const existe = base.personagens.some((p) => p.id === personagem.id);
      return {
        ...base,
        personagens: existe
          ? base.personagens.map((p) => (p.id === personagem.id ? personagem : p))
          : [...base.personagens, personagem],
      };
    }
    case "personagem.apagado":
      return { ...base, personagens: base.personagens.filter((p) => p.id !== evento.dados.id) };
    case "cena.criada": {
      const { cena } = evento.dados;
      if (base.cenas.some((c) => c.id === cena.id)) return base;
      return { ...base, cenas: [...base.cenas, cena] };
    }
    case "cena.editada": {
      const { cena } = evento.dados;
      return { ...base, cenas: base.cenas.map((c) => (c.id === cena.id ? cena : c)) };
    }
    case "nevoa.tracada": {
      const { cenaId, traco } = evento.dados;
      return {
        ...base,
        cenas: base.cenas.map((c) => {
          if (c.id !== cenaId) return c;
          const lista = acrescentarTraco(c.nevoa, traco) ?? [...(c.nevoa ?? []), traco];
          const { nevoa: _antiga, ...semNevoa } = c;
          return lista.length > 0 ? { ...semNevoa, nevoa: lista } : semNevoa;
        }),
      };
    }
    case "nevoa.desfeita": {
      const { cenaId } = evento.dados;
      return {
        ...base,
        cenas: base.cenas.map((c) => {
          if (c.id !== cenaId) return c;
          const lista = tirarUltimoTraco(c.nevoa);
          const { nevoa: _antiga, ...semNevoa } = c;
          return lista.length > 0 ? { ...semNevoa, nevoa: lista } : semNevoa;
        }),
      };
    }
    case "cena.apagada":
      return {
        ...base,
        cenas: base.cenas.filter((c) => c.id !== evento.dados.cenaId),
        // Os desenhos da cena vão com ela.
        desenhos: base.desenhos.filter((d) => d.cenaId !== evento.dados.cenaId),
      };
    case "desenho.criado": {
      const { desenho } = evento.dados;
      if (base.desenhos.some((d) => d.id === desenho.id)) return base;
      return { ...base, desenhos: [...base.desenhos, desenho] };
    }
    case "desenho.movido": {
      const { id, pontos } = evento.dados;
      return { ...base, desenhos: base.desenhos.map((d) => (d.id === id ? { ...d, pontos } : d)) };
    }
    case "desenho.apagado":
      return { ...base, desenhos: base.desenhos.filter((d) => d.id !== evento.dados.id) };
    case "desenho.limpo":
      return { ...base, desenhos: base.desenhos.filter((d) => d.cenaId !== evento.dados.cenaId) };
    case "grupo.movido": {
      const { cenaId, tokens } = evento.dados;
      const posicoes = new Map(tokens.map((t) => [t.id, t]));
      return {
        ...base,
        cenaAtivaId: cenaId,
        // A luz presa a um token que mudou de cena vai junto com ele.
        luzes: base.luzes.map((l) =>
          l.portador.tipo === "token" && posicoes.has(l.portador.tokenId) ? { ...l, cenaId } : l,
        ),
        tokens: base.tokens.map((t) => {
          const p = posicoes.get(t.id);
          return p ? { ...t, cenaId, x: p.x, y: p.y } : t;
        }),
      };
    }
    case "pasta.alterada": {
      const { pasta } = evento.dados;
      const existe = base.pastas.some((x) => x.id === pasta.id);
      return {
        ...base,
        pastas: existe
          ? base.pastas.map((x) => (x.id === pasta.id ? pasta : x))
          : [...base.pastas, pasta],
      };
    }
    case "pasta.apagada":
      return { ...base, pastas: base.pastas.filter((x) => x.id !== evento.dados.id) };
    case "handout.alterado": {
      const { handout } = evento.dados;
      const existe = base.handouts.some((x) => x.id === handout.id);
      return {
        ...base,
        handouts: existe
          ? base.handouts.map((x) => (x.id === handout.id ? handout : x))
          : [...base.handouts, handout],
      };
    }
    case "handout.apagado":
      return { ...base, handouts: base.handouts.filter((x) => x.id !== evento.dados.id) };
    case "handout.mostrado":
      // Só avisa as telas (a janela abre); o estado não muda.
      return base;
    case "ordemDeTurno.alterada":
      return { ...base, ordemDeTurnoVisivel: evento.dados.visivel };
    case "combate.alterado": {
      const { combate: _antigo, ...semCombate } = base;
      return evento.dados.combate === null
        ? semCombate
        : { ...semCombate, combate: evento.dados.combate };
    }
    case "chat.mensagem": {
      const { mensagem } = evento.dados;
      const chat = base.chat ?? [];
      if (chat.some((m) => m.id === mensagem.id)) return base;
      // O retrato de quem fala em público vira visível a quem lê (só a sala usa esta lista).
      const retrato = mensagem.como?.retratoHash;
      const retratos =
        retrato !== undefined &&
        mensagem.visivelPara === "todos" &&
        !base.retratosDoChat?.includes(retrato)
          ? [...(base.retratosDoChat ?? []), retrato].slice(-200)
          : base.retratosDoChat;
      return {
        ...base,
        chat: [...chat, mensagem],
        ...(retratos ? { retratosDoChat: retratos } : {}),
      };
    }
    case "chat.limpo":
      return { ...base, chat: [] };
    case "automacoes.alterado":
      return { ...base, automacoes: evento.dados.automacoes };
    case "efeitos.alterados":
      return { ...base, efeitos: evento.dados.efeitos };
    case "botoes.alterados":
      return { ...base, botoes: evento.dados.botoes };
    case "zona.alterada": {
      const { zona } = evento.dados;
      const lista = base.zonas ?? [];
      return {
        ...base,
        zonas: lista.some((z) => z.id === zona.id)
          ? lista.map((z) => (z.id === zona.id ? zona : z))
          : [...lista, zona],
      };
    }
    case "zona.apagada": {
      const { id } = evento.dados;
      const zonas = (base.zonas ?? []).filter((z) => z.id !== id);
      const { zonas: _antigas, ...semZonas } = base;
      // As reações da zona vão com ela.
      const automacoes = base.automacoes
        ? {
            ...base.automacoes,
            reacoes: base.automacoes.reacoes.filter(
              (r) => !(r.fica.tipo === "zona" && r.fica.id === id),
            ),
          }
        : undefined;
      return {
        ...semZonas,
        ...(zonas.length > 0 ? { zonas } : {}),
        ...(automacoes ? { automacoes } : {}),
      };
    }
    case "compendio.alterado": {
      const { compendio: _antigo, ...semCompendio } = base;
      return evento.dados.compendio === null
        ? semCompendio
        : { ...semCompendio, compendio: evento.dados.compendio };
    }
    case "som.ligadoAlterado": {
      const { somLigado: _antigo, ...semLigado } = base;
      return evento.dados.somLigado === null
        ? semLigado
        : { ...semLigado, somLigado: evento.dados.somLigado };
    }
    case "som.lugarAlterado": {
      const { grupo, indice, lugar } = evento.dados;
      const mesa = comLugar(base.mesaDeSom, grupo, indice, lugar);
      const { mesaDeSom: _antiga, ...semMesa } = base;
      return mesaVazia(mesa) ? semMesa : { ...semMesa, mesaDeSom: mesa };
    }
    case "som.efeitoTocado":
    case "som.efeitoParado":
      // Transitórios: só chegam a quem ouve; não mudam nada no estado.
      return base;
    case "asset.removido":
      return { ...base, assets: (base.assets ?? []).filter((a) => a.hash !== evento.dados.hash) };
    case "asset.registrado": {
      const { meta } = evento.dados;
      const atuais = base.assets ?? [];
      if (atuais.some((a) => a.hash === meta.hash)) return base;
      return { ...base, assets: [...atuais, meta] };
    }
    case "permissao.alterada": {
      const { capacidade, valor, usuarioId } = evento.dados;
      if (!ehCapacidadeDelegavel(capacidade)) return base;
      const { permissoes } = base;
      if (usuarioId === undefined) {
        if (valor === null) return base;
        return {
          ...base,
          permissoes: {
            ...permissoes,
            jogadores: { ...permissoes.jogadores, [capacidade]: valor },
          },
        };
      }
      const excecoes = { ...permissoes.porUsuario[usuarioId] };
      if (valor === null) delete excecoes[capacidade];
      else excecoes[capacidade] = valor;
      const porUsuario = { ...permissoes.porUsuario, [usuarioId]: excecoes };
      if (Object.keys(excecoes).length === 0) delete porUsuario[usuarioId];
      return { ...base, permissoes: { ...permissoes, porUsuario } };
    }
  }
}

/**
 * O portador da fonte, pronto para gravar: a fixa fica dentro da cena; a presa a um token só vale se o
 * token existe na mesma cena. `undefined` se o token não serve.
 */
function portadorValido(
  estado: Estado,
  cena: Cena,
  portador: PortadorFixo,
): PortadorFixo | undefined {
  if (portador.tipo === "cena") return { tipo: "cena", ...limitarNaCena(portador, cena) };
  const id = portador.tokenId;
  return estado.tokens.some((t) => t.id === id && t.cenaId === cena.id) ? portador : undefined;
}

/** O token de um personagem, com tudo tirado da ficha (nome, cor, tamanho, imagem); o cliente não manda nada disso. */
function tokenDoPersonagem(
  p: Personagem,
  cena: Cena,
  tokenId: string,
  base: { x: number; y: number },
  /** Q10: o nome e o número que a numeração deu (NPC onde já há outro do mesmo personagem). */
  numeracao?: { nome: string; numero?: number },
): Token {
  const pv = pvInicialDoToken(p);
  return {
    id: tokenId,
    cenaId: cena.id,
    nome: numeracao?.nome ?? p.nome,
    ...(numeracao?.numero === undefined ? {} : { numero: numeracao.numero }),
    ...(pv ? { pv } : {}),
    // Q11: o token nasce com a escolha do token padrão (sem o campo, com a barra de vida).
    ...(barraDeVidaPadrao(p) ? {} : { barraDeVida: false }),
    cor: p.tokenPadrao.cor,
    tamanhoQuadrados: p.tokenPadrao.tamanhoQuadrados,
    ...limitarNaCena(base, cena),
    camada: "tokens",
    oculto: false,
    controladoPor: [],
    personagemId: p.id,
    ...(p.tokenPadrao.assetHash === undefined ? {} : { assetHash: p.tokenPadrao.assetHash }),
  };
}

/**
 * Processa uma intenção: confere a capacidade, valida as regras e devolve o novo estado e os
 * eventos (numerados a partir de `estado.seq`). Pura: não grava nem envia nada.
 */
export function processar(
  estado: Estado,
  usuarioId: string,
  intencao: Intencao,
  agora: string,
  /** De onde vêm os dados. A sala usa `crypto`; os testes, uma fonte com semente. */
  aleatorio: FonteDeAleatoriedade = fonteCrypto(),
  /** Os tokens apagados há pouco (só a sala os guarda), para o `token.restaurar`. */
  apagadosRecentes: readonly TokenApagadoRecente[] = [],
  /** 12-1: de que conexão vem a intenção (a sala a conhece; o cliente nunca diz). */
  opcoes: OpcoesDeProcessar = {},
): Resultado {
  const r = processarIntencao(
    estado,
    usuarioId,
    intencao,
    agora,
    aleatorio,
    apagadosRecentes,
    opcoes,
  );
  // 7b-1: depois de qualquer intenção que mudou algo, as automações reagem ao que aconteceu (objeto que
  // acendeu ou apagou, cena ativada, vez de turno) e põem em dia o que já venceu. A importação não conta.
  if (!r.ok || r.eventos.length === 0) return r;
  if (intencao.tipo === "campanha.importar" || intencao.tipo === "campanha.exportar") return r;
  let proximo = r.estado;
  const novos: EventoSala[] = [];
  const origem = { usuarioId, idPedido: intencao.id };
  rodarAutomacoes(
    {
      agoraMs: Date.parse(agora),
      aleatorio,
      atual: () => proximo,
      emitir: (evento) => {
        const completo = { ...evento, seq: proximo.seq + 1, origem } as EventoSala;
        novos.push(completo);
        proximo = reduzir(proximo, completo);
      },
    },
    estado,
  );
  return novos.length === 0 ? r : { ...r, estado: proximo, eventos: [...r.eventos, ...novos] };
}

function processarIntencao(
  estado: Estado,
  usuarioId: string,
  intencao: Intencao,
  agora: string,
  aleatorio: FonteDeAleatoriedade,
  apagadosRecentes: readonly TokenApagadoRecente[],
  opcoes: OpcoesDeProcessar,
): Resultado {
  const usuario = estado.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return recusa("usuario_inexistente", "Usuário desconhecido.");

  // 12-1: o que o Claude nunca faz, mesmo que o usuário possa (papéis, permissões, importar e exportar, arquivos).
  const doClaude = opcoes.claude === true;
  if (doClaude) {
    const proibida = recusaDoClaude(intencao.tipo);
    if (proibida) return recusa("sem_permissao", proibida);
  }
  // O que o Claude do MESTRE cria entra como rascunho; o jogador e o mestre pela mesa nunca criam rascunho.
  const comoRascunho = doClaude && usuario.papel === "mestre";

  const exigida = capacidadeDaIntencao[intencao.tipo];
  // Sem capacidade (vaivém de arquivos): qualquer mestre ou jogador; o sigilo é do asset.
  const autorizado =
    exigida === null
      ? usuario.papel === "mestre" || usuario.papel === "jogador"
      : pode(usuario, exigida, estado.permissoes);
  if (!autorizado) {
    return recusa("sem_permissao", `Sem permissão (${exigida ?? "mesa"}).`);
  }

  const origem = { usuarioId, idPedido: intencao.id };
  let proximo = estado;
  const eventos: EventoSala[] = [];
  const emitir = (evento: NovoEvento) => {
    let carimbado = carimbarRascunho(evento, proximo, comoRascunho);
    // 12-1: tudo o que a conexão do Claude diz ou rola leva a marca "pelo Claude", visível para todos.
    if (doClaude && carimbado.tipo === "chat.mensagem") {
      const m = carimbado.dados.mensagem;
      if (m.autorId === usuarioId) {
        carimbado = { ...carimbado, dados: { mensagem: { ...m, peloClaude: true } } };
      }
    }
    const completo = { ...carimbado, seq: proximo.seq + 1, origem } as EventoSala;
    eventos.push(completo);
    proximo = reduzir(proximo, completo);
  };
  const aplicado = (snapshotPara: string[] | "todos" = []): ResultadoOk => ({
    ok: true,
    estado: proximo,
    eventos,
    snapshotPara,
  });
  const agoraMs = Date.parse(agora);
  /** As tochas, os pontos e a mochila (tochas.ts) usam o mesmo estado vivo e os mesmos eventos. */
  const contextoDeTochas: ContextoDeTochas = {
    usuario,
    agoraMs,
    atual: () => proximo,
    emitir,
    definirAcendimentos: (acendimentos) => {
      proximo = { ...proximo, acendimentos };
    },
  };
  const contextoDeCombate: ContextoDeCombate = {
    usuario,
    agoraMs,
    aleatorio,
    atual: () => proximo,
    emitir,
  };
  const doCombate = (
    saida: { erro: ErroDaSala } | { snapshotPara?: "todos" | string[] },
  ): Resultado =>
    "erro" in saida ? { ok: false, erro: saida.erro } : aplicado(saida.snapshotPara ?? []);
  /** Tokens que saíram: as entradas deles saem da ordem de turno. */
  const limparCombate = (tokenIds: ReadonlySet<string>) => {
    const combate = semEntradasDosTokens(proximo, tokenIds);
    if (combate) emitir({ tipo: "combate.alterado", dados: { combate } });
  };
  const contextoDeDesenho: ContextoDeDesenho = { usuario, atual: () => proximo, emitir };
  const doDesenho = (saida: SaidaDeDesenho): Resultado =>
    "erro" in saida
      ? { ok: false, erro: saida.erro }
      : { ...aplicado(), ...(saida.rascunho ? { rascunho: saida.rascunho } : {}) };
  const daTocha = (
    saida: { erro: ErroDaSala } | { snapshotPara?: "todos" | string[] },
  ): Resultado =>
    "erro" in saida ? { ok: false, erro: saida.erro } : aplicado(saida.snapshotPara ?? []);
  const contextoDoMotor: ContextoDoMotor = {
    agoraMs,
    aleatorio,
    atual: () => proximo,
    emitir,
  };

  switch (intencao.tipo) {
    case "mapa.ping": {
      const saida = pingar(estado, usuario, intencao.dados);
      return "erro" in saida
        ? { ok: false, erro: saida.erro }
        : { ...aplicado(), ping: saida.ping };
    }

    case "papel.alterar": {
      const { usuarioId: alvoId, papel } = intencao.dados;
      const alvo = estado.usuarios.find((u) => u.id === alvoId);
      if (!alvo) return recusa("usuario_inexistente", "Usuário não encontrado.");
      if (alvo.papel === papel) return aplicado();
      if (alvo.papel === "mestre" && totalDeMestres(estado) <= 1) {
        return recusa("ultimo_mestre", "A mesa precisa de pelo menos um mestre.");
      }
      emitir({ tipo: "papel.alterado", dados: { usuarioId: alvoId, papel } });
      return aplicado([alvoId]);
    }

    case "permissao.alterar": {
      const { capacidade, valor, usuarioId: alvoId } = intencao.dados;
      if (!ehCapacidadeDelegavel(capacidade)) {
        return recusa("capacidade_nao_delegavel", `${capacidade} é só do mestre.`);
      }
      if (alvoId !== undefined && !estado.usuarios.some((u) => u.id === alvoId)) {
        return recusa("usuario_inexistente", "Usuário não encontrado.");
      }
      emitir({
        tipo: "permissao.alterada",
        dados:
          alvoId === undefined ? { capacidade, valor } : { capacidade, valor, usuarioId: alvoId },
      });
      // Ver a ficha dos outros muda o que cada jogador recebe dos personagens: snapshot novo.
      return aplicado(capacidade === "ficha.verOutras" ? "todos" : []);
    }

    case "token.criar": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const novo = intencao.dados.token;
      if (novo.personagemId !== undefined && !personagemDe(estado, novo.personagemId)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (estado.tokens.some((t) => t.id === novo.id)) {
        return recusa("dados_invalidos", "Já existe um token com esse id.");
      }
      if (!usuariosExistem(estado, novo.controladoPor)) {
        return recusa("usuario_inexistente", "Usuário de controle não encontrado.");
      }
      if (novo.assetHash !== undefined && !imagemDeTokenExiste(estado, novo.assetHash)) {
        return recusa("asset_inexistente", "Imagem não encontrada.");
      }
      // Q10: token de NPC nasce com a vida própria (cópia da ficha), se o pedido não trouxe uma.
      const pvDoModelo =
        novo.pv === undefined && novo.personagemId !== undefined
          ? pvInicialDoToken(personagemDe(estado, novo.personagemId))
          : undefined;
      // Q11: e com a barra de vida que o token padrão do personagem pede.
      const semBarra =
        novo.barraDeVida === undefined &&
        novo.personagemId !== undefined &&
        !barraDeVidaPadrao(personagemDe(estado, novo.personagemId));
      const token: Token = {
        ...novo,
        ...(pvDoModelo ? { pv: pvDoModelo } : {}),
        ...(semBarra ? { barraDeVida: false } : {}),
        ...limitarNaCena(novo, cena),
        cenaId: cena.id,
      };
      emitir({ tipo: "token.criado", dados: { token } });
      return aplicado();
    }

    case "token.editar": {
      const atual = estado.tokens.find((t) => t.id === intencao.dados.id);
      if (!atual) return recusa("token_inexistente", "Token não encontrado.");
      const r = tokenComMudancas(estado, atual, intencao.dados.mudancas);
      if ("erro" in r) return r.erro;
      if (JSON.stringify(r.token) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "token.editado", dados: { token: r.token } });
      return aplicado(precisaDeSnapshot(estado, atual, r.token) ? "todos" : []);
    }

    case "tokens.editar": {
      // Q11: as mesmas mudanças em vários tokens (a borda, a barra de vida...): se um só for recusado, nenhum muda.
      const { ids, mudancas } = intencao.dados;
      if (new Set(ids).size !== ids.length) return recusa("dados_invalidos", "Ids repetidos.");
      const novos: { atual: Token; token: Token }[] = [];
      for (const id of ids) {
        const atual = estado.tokens.find((t) => t.id === id);
        if (!atual) return recusa("token_inexistente", "Token não encontrado.");
        const r = tokenComMudancas(estado, atual, mudancas);
        if ("erro" in r) return r.erro;
        novos.push({ atual, token: r.token });
      }
      let snapshot = false;
      for (const { atual, token } of novos) {
        if (JSON.stringify(token) === JSON.stringify(atual)) continue;
        emitir({ tipo: "token.editado", dados: { token } });
        if (precisaDeSnapshot(estado, atual, token)) snapshot = true;
      }
      return aplicado(snapshot ? "todos" : []);
    }

    case "token.apagar": {
      const token = estado.tokens.find((t) => t.id === intencao.dados.id);
      // Token invisível para quem pergunta responde igual a token inexistente (não revela nada).
      if (!token || !tokenVisivelPara(token, usuario, estado.cenaAtivaId)) {
        return recusa("token_inexistente", "Token não encontrado.");
      }
      // V10: o mestre tira qualquer token do mapa; o jogador, só os que controla (e nunca o cenário).
      if (
        usuario.papel !== "mestre" &&
        !(token.camada === "tokens" && controlaToken(token, usuario, estado.personagens))
      ) {
        return recusa("sem_permissao", "Você só pode tirar do mapa os tokens que controla.");
      }
      for (const l of luzesDoToken(estado, intencao.dados.id)) {
        emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
      }
      emitir({ tipo: "token.apagado", dados: { id: intencao.dados.id } });
      limparCombate(new Set([intencao.dados.id]));
      return { ...aplicado(), apagado: { token, por: usuario.id } };
    }

    case "token.restaurar": {
      const guardado = apagadosRecentes.find((a) => a.token.id === intencao.dados.id);
      const dentroDoPrazo = guardado && agoraMs - guardado.emMs <= PRAZO_PARA_RESTAURAR_TOKEN_MS;
      if (
        !guardado ||
        (usuario.papel !== "mestre" && !(dentroDoPrazo && guardado.por === usuario.id))
      ) {
        return recusa("sem_permissao", "Não dá mais para desfazer: o prazo acabou.");
      }
      const antigo = guardado.token;
      if (estado.tokens.some((t) => t.id === antigo.id)) {
        return recusa("dados_invalidos", "O token já está no mapa.");
      }
      if (!estado.cenas.some((c) => c.id === antigo.cenaId)) {
        return recusa("cena_inexistente", SEM_CENA);
      }
      if (antigo.personagemId !== undefined && !personagemDe(estado, antigo.personagemId)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      emitir({ tipo: "token.criado", dados: { token: antigo } });
      return aplicado();
    }

    case "cena.configurarGrid": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const { quadradoM, visivel } = intencao.dados;
      const grid = {
        quadradoM: quadradoM ?? cena.grid.quadradoM,
        visivel: visivel ?? cena.grid.visivel,
      };
      if (grid.quadradoM === cena.grid.quadradoM && grid.visivel === cena.grid.visivel) {
        return aplicado();
      }
      // Com mapa, o quadrado define o tamanho da cena em metros (px ÷ pxPorQuadrado × quadradoM).
      const meta = cena.mapa ? metaDoAsset(estado, cena.mapa.assetHash) : undefined;
      const tamanho =
        cena.mapa && meta
          ? tamanhoDaCenaComMapa(meta, cena.mapa.pxPorQuadrado, grid.quadradoM)
          : undefined;
      if (tamanho && (tamanho.larguraM > 1000 || tamanho.alturaM > 1000)) {
        return recusa("dados_invalidos", "O mapa ficaria grande demais com esse quadrado.");
      }
      emitir({ tipo: "cena.gridAlterado", dados: { cenaId: cena.id, grid, ...tamanho } });
      return aplicado();
    }

    case "cena.definirMapa": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const { assetHash, pxPorQuadrado } = intencao.dados;
      if (assetHash === null) {
        if (!cena.mapa) return aplicado();
        emitir({
          tipo: "cena.mapaAlterado",
          dados: { cenaId: cena.id, mapa: null, larguraM: cena.larguraM, alturaM: cena.alturaM },
        });
        return aplicado();
      }
      const meta = metaDoAsset(estado, assetHash);
      if (meta?.tipo !== "mapa") return recusa("asset_inexistente", "Mapa não encontrado.");
      const px = pxPorQuadrado ?? cena.mapa?.pxPorQuadrado ?? PX_POR_QUADRADO_PADRAO;
      const { larguraM, alturaM } = tamanhoDaCenaComMapa(meta, px, cena.grid.quadradoM);
      if (larguraM > 1000 || alturaM > 1000) {
        return recusa("dados_invalidos", "O mapa fica grande demais com esse px por quadrado.");
      }
      emitir({
        tipo: "cena.mapaAlterado",
        dados: { cenaId: cena.id, mapa: { assetHash, pxPorQuadrado: px }, larguraM, alturaM },
      });
      return aplicado();
    }

    case "token.definirImagem": {
      const { id, assetHash } = intencao.dados;
      const atual = estado.tokens.find((t) => t.id === id);
      // Token que não vejo responde igual a token inexistente.
      if (!atual || !tokenVisivelPara(atual, usuario, estado.cenaAtivaId)) {
        return recusa("token_inexistente", "Token não encontrado.");
      }
      if (usuario.papel !== "mestre" && !controlaToken(atual, usuario, estado.personagens)) {
        return recusa("sem_permissao", "Você não controla este token.");
      }
      const token: Token = { ...atual };
      if (assetHash === null) delete token.assetHash;
      else {
        // Qualquer imagem de token registrada serve, não só a que eu registrei: a mesma arte baixada
        // do mesmo lugar gera o mesmo hash, e o segundo jogador precisa conseguir usá-la. Não abre
        // nada: o hash de um asset que o jogador não vê nunca chega a ele (só o conhece quem já tem o
        // arquivo ou já viu a imagem).
        if (!imagemDeTokenExiste(estado, assetHash)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
        token.assetHash = assetHash;
      }
      if (JSON.stringify(token) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "token.editado", dados: { token } });
      return aplicado();
    }

    case "asset.registrar": {
      const { metas } = intencao.dados;
      const noLote = new Map(metas.map((m) => [m.hash, m]));
      const existentes = estado.assets ?? [];
      for (const m of metas) {
        const problema = validarMeta(m);
        if (problema) return recusa("dados_invalidos", `Arquivo recusado: ${problema}.`);
        if (
          usuario.papel !== "mestre" &&
          (m.tipo === "mapa" ||
            m.tipo === "tile" ||
            m.tipo === "cifrado" ||
            m.tipo === "compendio" ||
            m.tipo === "som")
        ) {
          return recusa(
            "sem_permissao",
            "Só o mestre registra mapas, arquivos cifrados, sons e o compêndio.",
          );
        }
        if (m.tiles) {
          let bytes = 0;
          for (const t of m.tiles) {
            const tile = noLote.get(t.hash) ?? existentes.find((a) => a.hash === t.hash);
            if (tile?.tipo !== "tile") {
              return recusa("dados_invalidos", "O manifesto cita um tile que não foi registrado.");
            }
            bytes += tile.bytes;
          }
          if (bytes > LIMITES_DE_ASSET.bytesPorMapa) {
            return recusa("dados_invalidos", "Mapa grande demais.");
          }
        }
      }
      const novas = [...noLote.values()].filter((m) => !existentes.some((a) => a.hash === m.hash));
      if (existentes.length + novas.length > LIMITES_DE_ASSET.assetsNaSala) {
        return recusa("dados_invalidos", "Arquivos demais registrados na sala.");
      }
      // Quem registra um hash que já existe não muda o dono nem o que a sala sabe dele.
      for (const m of novas) {
        emitir({ tipo: "asset.registrado", dados: { meta: { ...m, donoId: usuarioId } } });
      }
      return aplicado();
    }

    // Vaivém de arquivos (pedir, inventário, tenho): não muda o estado; a sala cuida disso.
    case "asset.pedir":
    case "asset.inventario":
    case "asset.tenho":
    case "asset.naoTenho":
      return aplicado();

    case "token.mover":
    case "token.soltar": {
      const { id, x, y } = intencao.dados;
      const token = estado.tokens.find((t) => t.id === id);
      // Token invisível para quem pergunta responde igual a token inexistente (não revela nada).
      if (!token || !tokenVisivelPara(token, usuario, estado.cenaAtivaId)) {
        return recusa("token_inexistente", "Token não encontrado.");
      }
      if (!podeMoverToken(token, usuario, estado)) {
        return recusa("sem_permissao", "Você não controla este token.");
      }
      const cena = estado.cenas.find((c) => c.id === token.cenaId) ?? cenaAtiva(estado);
      const posicao = limitarNaCena({ x, y }, cena);
      // O jogador não atravessa parede, porta fechada, janela nem parede invisível; o mestre ignora.
      if (
        intencao.tipo === "token.soltar" &&
        usuario.papel !== "mestre" &&
        !cenaEhCartao(cena) &&
        trajetoBloqueado(
          { x: token.x, y: token.y },
          posicao,
          estado.paredes.filter((p) => p.cenaId === token.cenaId),
        )
      ) {
        return recusa("trajeto_bloqueado", "Uma parede bloqueia o caminho.");
      }
      if (intencao.tipo === "token.mover") {
        return { ok: true, estado, eventos, snapshotPara: [], movendo: { id, ...posicao } };
      }
      // Sempre grava e avisa, mesmo sem mudança: quem viu o movimento ao vivo precisa da posição final.
      emitir({ tipo: "token.movido", dados: { id, ...posicao } });
      return aplicado();
    }

    case "personagem.criar": {
      // A mochila do Lote 7 (se vier) vira itens da ficha; o personagem novo nunca a carrega.
      let p = limitarPv(absorverMochila(intencao.dados.personagem, estado.modelos));
      if (personagemDe(estado, p.id)) {
        return recusa("dados_invalidos", "Já existe um personagem com esse id.");
      }
      if (usuario.papel !== "mestre") {
        // 12-1: o jogador cria a própria ficha (capacidade e teto); ela é dele, na pasta dele.
        const negado = podeCriarDoJogador(estado, usuario, "personagem");
        if (negado) return negado;
        p = {
          ...p,
          pastaId: idDaPastaDoJogador(usuario.id),
          editores: { tipo: "jogadores", ids: [usuario.id] },
          criadoPor: usuario.id,
        };
        garantirPastaDoJogador(estado, usuario, emitir);
      }
      if (!pastaDe(proximo, p.pastaId)) return recusa("pasta_inexistente", SEM_PASTA);
      if (!editoresValidos(estado, p.editores)) {
        return recusa("usuario_inexistente", "Editor não encontrado (precisa ser um jogador).");
      }
      for (const h of [p.tokenPadrao.assetHash, p.retratoHash]) {
        if (h !== undefined && !imagemDeTokenExiste(estado, h)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
      }
      emitir({ tipo: "personagem.alterado", dados: { personagem: p } });
      return aplicado(usuario.papel === "mestre" ? [] : [usuario.id]);
    }

    case "personagem.editar": {
      const atual = personagemDe(estado, intencao.dados.id);
      // Personagem que não vejo responde igual a personagem inexistente.
      if (!atual || !personagemVisivelPara(atual, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      const m = intencao.dados.mudancas;
      if (usuario.papel !== "mestre") {
        // Quem edita (jogador) troca só as imagens, e precisa poder subir arquivos. Na ficha que ele mesmo criou (12-1) muda
        // tudo, menos quem edita e a pasta.
        if (!podeEditarPersonagem(atual, usuario)) {
          return recusa("sem_permissao", "Você não edita este personagem.");
        }
        const propria = atual.criadoPor === usuario.id;
        const livres = propria
          ? (k: string) => k !== "editores" && k !== "pastaId" && k !== "vidaPorToken"
          : (k: string) => k === "assetHash" || k === "retratoHash";
        if (Object.keys(semIndefinidos(m)).some((k) => !livres(k))) {
          return recusa("sem_permissao", "Só o mestre muda isso.");
        }
        if (
          (m.assetHash !== undefined || m.retratoHash !== undefined) &&
          !pode(usuario, "asset.subir", estado.permissoes)
        ) {
          return recusa("sem_permissao", "Sem permissão (asset.subir).");
        }
      }
      if (m.editores !== undefined && !editoresValidos(estado, m.editores)) {
        return recusa("usuario_inexistente", "Editor não encontrado (precisa ser um jogador).");
      }
      if (m.pastaId !== undefined && !pastaDe(estado, m.pastaId)) {
        return recusa("pasta_inexistente", SEM_PASTA);
      }
      for (const h of [m.assetHash, m.retratoHash]) {
        if (typeof h === "string" && !imagemDeTokenExiste(estado, h)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
      }
      // Q11: `barraDeVida` só fica gravada quando é `false` (sem o campo vale ligada).
      const barraPadrao = m.barraDeVida ?? barraDeVidaPadrao(atual);
      const tokenPadrao = {
        cor: m.cor ?? atual.tokenPadrao.cor,
        tamanhoQuadrados: m.tamanhoQuadrados ?? atual.tokenPadrao.tamanhoQuadrados,
        ...(barraPadrao ? {} : { barraDeVida: false }),
      };
      const assetHash = m.assetHash === undefined ? atual.tokenPadrao.assetHash : m.assetHash;
      const retratoHash = m.retratoHash === undefined ? atual.retratoHash : m.retratoHash;
      const { retratoHash: _r, ...semRetrato } = atual;
      const personagem = limitarPv({
        ...semRetrato,
        ...(retratoHash === null || retratoHash === undefined ? {} : { retratoHash }),
        nome: m.nome ?? atual.nome,
        pastaId: m.pastaId ?? atual.pastaId,
        editores: m.editores ?? atual.editores,
        tokenPadrao:
          assetHash === null || assetHash === undefined
            ? tokenPadrao
            : { ...tokenPadrao, assetHash },
        visao: {
          alcanceM: m.alcanceM === undefined ? atual.visao.alcanceM : m.alcanceM,
          visaoNoEscuroM: m.visaoNoEscuroM ?? atual.visao.visaoNoEscuroM,
        },
        ...(atual.ficha
          ? {
              ficha: {
                ...atual.ficha,
                pvAtual: m.pvAtual ?? atual.ficha.pvAtual,
                pvMax: m.pvMax ?? atual.ficha.pvMax,
              },
            }
          : {}),
        ...(m.modInteligencia === undefined ? {} : { modInteligencia: m.modInteligencia }),
        ...(m.vidaPorToken === undefined ? {} : { vidaPorToken: m.vidaPorToken }),
      });
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
      // Quem edita (ou a pasta) decide quem vê os objetos de luz que ele carrega: reenvia cada um, e o
      // filtro de cada jogador (antes × depois) decide se o objeto aparece, some ou nada muda.
      const mudouQuemVe =
        JSON.stringify(personagem.editores) !== JSON.stringify(atual.editores) ||
        personagem.pastaId !== atual.pastaId;
      if (mudouQuemVe) {
        for (const l of estado.luzes) {
          const p = l.portador;
          if ((p.tipo === "mao" || p.tipo === "mochila") && p.personagemId === personagem.id) {
            emitir({ tipo: "fonte.editada", dados: { fonte: l } });
          }
        }
      }
      // Q10: a vida própria dos tokens dele só chega a quem vê a ficha: se isso mudou, cada jogador recebe snapshot novo.
      const temVidaNosTokens = estado.tokens.some(
        (t) => t.personagemId === personagem.id && t.pv !== undefined,
      );
      return aplicado(mudouQuemVe && temVidaNosTokens ? "todos" : []);
    }

    case "ficha.alterar": {
      const { personagemId, operacoes } = intencao.dados;
      const atual = personagemDe(estado, personagemId);
      // Personagem que não vejo responde igual a personagem inexistente (NPC nunca aparece).
      if (!atual || !personagemVisivelPara(atual, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (!podeEditarPersonagem(atual, usuario)) {
        return recusa("sem_permissao", "Você não edita esta ficha.");
      }
      const r = aplicarOperacoes(atual.ficha, operacoes);
      if (!r.ok) return recusa("dados_invalidos", r.motivo);
      // A aparência e o símbolo (V4a) são imagens que já estão na mesa: hash sem meta é recusado.
      for (const h of [r.ficha.aparenciaHash, r.ficha.simboloHash]) {
        if (
          h !== undefined &&
          h !== atual.ficha?.aparenciaHash &&
          h !== atual.ficha?.simboloHash &&
          !estado.assets?.some((a) => a.hash === h)
        ) {
          return recusa("dados_invalidos", "Imagem da ficha desconhecida.");
        }
      }
      // Só o mestre repõe tochas (e outros itens de modelo): quem edita a própria ficha só gasta.
      if (
        usuario.papel !== "mestre" &&
        modelosAumentados(atual.ficha, r.ficha, estado.modelos).length > 0
      ) {
        return recusa("sem_permissao", "Só o mestre repõe tochas e outros objetos de luz.");
      }
      const personagem: Personagem = { ...atual, ficha: r.ficha };
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
      return aplicado();
    }

    case "ficha.dadoDeVida": {
      const { personagemId, dado } = intencao.dados;
      const atual = personagemDe(estado, personagemId);
      if (!atual || !personagemVisivelPara(atual, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (!podeEditarPersonagem(atual, usuario)) {
        return recusa("sem_permissao", "Você não edita esta ficha.");
      }
      const f = atual.ficha;
      const dv = f ? dadosDeVidaDaFicha(f).find((x) => x.dado === dado) : undefined;
      if (!f || !dv || dv.restantes <= 0) {
        return recusa("dados_invalidos", `Sem dado de vida ${dado} disponível.`);
      }
      const mod = modDoAtributo(f, "con");
      const lida = lerExpressao(`1${dado}${mod > 0 ? `+${mod}` : mod < 0 ? String(mod) : ""}`);
      if (!lida.ok) return recusa("dados_invalidos", lida.motivo);
      const rolagem = rolar(lida.expressao, aleatorio);
      const cura = Math.max(0, rolagem.total);
      const pvAtual = Math.min(f.pvMax, f.pvAtual + cura);
      const ficha = {
        ...f,
        pvAtual,
        dadosDeVidaUsados: { ...(f.dadosDeVidaUsados ?? {}), [dado]: dv.usados + 1 },
      };
      const mensagem = mensagemDeDadoDeVida(estado, usuario, atual, {
        nome: `Dado de vida · ${dado}`,
        rolagem,
        curou: pvAtual - f.pvAtual,
        pvAtual,
        pvMax: f.pvMax,
        agoraMs,
      });
      emitir({ tipo: "chat.mensagem", dados: { mensagem } });
      emitir({ tipo: "personagem.alterado", dados: { personagem: { ...atual, ficha } } });
      return aplicado();
    }

    case "pasta.criar": {
      const { pasta } = intencao.dados;
      if (pastaDe(estado, pasta.id)) {
        return recusa("dados_invalidos", "Já existe uma pasta com esse id.");
      }
      if (
        pasta.visivel.tipo === "jogadores" &&
        !pasta.visivel.ids.every((id) => ehJogador(estado, id))
      ) {
        return recusa("usuario_inexistente", "Jogador não encontrado.");
      }
      emitir({ tipo: "pasta.alterada", dados: { pasta } });
      return aplicado();
    }

    case "pasta.editar": {
      const { id, nome, visivel } = intencao.dados;
      const atual = pastaDe(estado, id);
      if (!atual) return recusa("pasta_inexistente", SEM_PASTA);
      if (visivel?.tipo === "jogadores" && !visivel.ids.every((x) => ehJogador(estado, x))) {
        return recusa("usuario_inexistente", "Jogador não encontrado.");
      }
      const pasta: Pasta = {
        ...atual,
        nome: nome ?? atual.nome,
        visivel: visivel ?? atual.visivel,
      };
      if (JSON.stringify(pasta) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "pasta.alterada", dados: { pasta } });
      // Mudar quem vê a pasta faz os itens dela aparecerem ou sumirem para cada jogador: snapshot novo.
      const mudouVisibilidade = JSON.stringify(pasta.visivel) !== JSON.stringify(atual.visivel);
      return aplicado(mudouVisibilidade ? "todos" : []);
    }

    case "pasta.apagar": {
      const { id } = intencao.dados;
      if (!pastaDe(estado, id)) return recusa("pasta_inexistente", SEM_PASTA);
      if (
        estado.personagens.some((p) => p.pastaId === id) ||
        estado.handouts.some((h) => h.pastaId === id)
      ) {
        return recusa("dados_invalidos", "Só uma pasta vazia pode ser apagada.");
      }
      emitir({ tipo: "pasta.apagada", dados: { id } });
      return aplicado();
    }

    case "handout.criar": {
      let { handout } = intencao.dados;
      if (handoutDe(estado, handout.id)) {
        return recusa("dados_invalidos", "Já existe um handout com esse id.");
      }
      if (usuario.papel !== "mestre") {
        // 12-1: o jogador cria o próprio handout (capacidade e teto), na pasta dele, escolhendo quem vê.
        const negado = podeCriarDoJogador(estado, usuario, "handout");
        if (negado) return negado;
        handout = { ...handout, pastaId: idDaPastaDoJogador(usuario.id), criadoPor: usuario.id };
        garantirPastaDoJogador(estado, usuario, emitir);
      }
      if (!pastaDe(proximo, handout.pastaId)) return recusa("pasta_inexistente", SEM_PASTA);
      if (
        handout.visivel.tipo === "jogadores" &&
        !handout.visivel.ids.every((id) => ehJogador(estado, id))
      ) {
        return recusa("usuario_inexistente", "Jogador não encontrado.");
      }
      if (handout.imagemHash !== undefined && !imagemDeTokenExiste(estado, handout.imagemHash)) {
        return recusa("asset_inexistente", "Imagem não encontrada.");
      }
      emitir({ tipo: "handout.alterado", dados: { handout } });
      // Quem passa a ver o handout precisa também da pasta dele: snapshot novo.
      return aplicado(handout.visivel.tipo === "mestre" ? [] : "todos");
    }

    case "handout.editar": {
      const { id, mudancas: m } = intencao.dados;
      const atual = handoutDe(estado, id);
      const negado = atual && negarHandout(atual, usuario);
      if (!atual || negado) return negado ?? recusa("handout_inexistente", SEM_HANDOUT);
      if (usuario.papel !== "mestre" && m.pastaId !== undefined) {
        return recusa("sem_permissao", "Só o mestre muda a pasta.");
      }
      if (m.pastaId !== undefined && !pastaDe(estado, m.pastaId)) {
        return recusa("pasta_inexistente", SEM_PASTA);
      }
      if (m.visivel?.tipo === "jogadores" && !m.visivel.ids.every((x) => ehJogador(estado, x))) {
        return recusa("usuario_inexistente", "Jogador não encontrado.");
      }
      if (typeof m.imagemHash === "string" && !imagemDeTokenExiste(estado, m.imagemHash)) {
        return recusa("asset_inexistente", "Imagem não encontrada.");
      }
      const { imagemHash: _antiga, ...semImagem } = atual;
      const imagemHash = m.imagemHash === undefined ? atual.imagemHash : m.imagemHash;
      const handout: Handout = {
        ...semImagem,
        ...(imagemHash === null || imagemHash === undefined ? {} : { imagemHash }),
        pastaId: m.pastaId ?? atual.pastaId,
        titulo: m.titulo ?? atual.titulo,
        texto: m.texto ?? atual.texto,
        fonte: m.fonte ?? atual.fonte,
        visivel: m.visivel ?? atual.visivel,
      };
      if (JSON.stringify(handout) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "handout.alterado", dados: { handout } });
      // Mudou quem vê ou a pasta: o jogador ganha ou perde o handout e a pasta dele, snapshot novo.
      const mudouQuemVe =
        JSON.stringify(handout.visivel) !== JSON.stringify(atual.visivel) ||
        handout.pastaId !== atual.pastaId;
      return aplicado(mudouQuemVe ? "todos" : []);
    }

    case "handout.apagar": {
      const { id } = intencao.dados;
      const atual = handoutDe(estado, id);
      const negado = atual && negarHandout(atual, usuario);
      if (!atual || negado) return negado ?? recusa("handout_inexistente", SEM_HANDOUT);
      emitir({ tipo: "handout.apagado", dados: { id } });
      return aplicado(atual.visivel.tipo === "mestre" ? [] : "todos");
    }

    case "handout.mostrar": {
      if (!handoutDe(estado, intencao.dados.id)) {
        return recusa("handout_inexistente", SEM_HANDOUT);
      }
      emitir({ tipo: "handout.mostrado", dados: { id: intencao.dados.id } });
      return aplicado();
    }

    case "ordemDeTurno.definir": {
      const { visivel } = intencao.dados;
      if (visivel === estado.ordemDeTurnoVisivel) return aplicado();
      emitir({ tipo: "ordemDeTurno.alterada", dados: { visivel } });
      return aplicado();
    }

    case "personagem.apagar": {
      const { id } = intencao.dados;
      const alvo = personagemDe(estado, id);
      // 12-1: o mestre apaga qualquer um; o jogador, só a ficha que ele criou (quem não pode responde "inexistente").
      if (!alvo || !personagemVisivelPara(alvo, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (usuario.papel !== "mestre" && alvo.criadoPor !== usuario.id) {
        return recusa("sem_permissao", "Só o mestre apaga esta ficha.");
      }
      const tokensDele = estado.tokens.filter((x) => x.personagemId === id);
      for (const t of tokensDele) {
        for (const l of luzesDoToken(estado, t.id)) {
          emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
        }
        emitir({ tipo: "token.apagado", dados: { id: t.id } });
      }
      limparCombate(new Set(tokensDele.map((t) => t.id)));
      // O que ele carrega (mão e mochila) some junto.
      for (const l of estado.luzes) {
        const p = l.portador;
        if ((p.tipo === "mao" || p.tipo === "mochila") && p.personagemId === id) {
          emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
        }
      }
      emitir({ tipo: "personagem.apagado", dados: { id } });
      return aplicado();
    }

    case "personagem.colocar": {
      const { personagemId, cenaId, tokenId, x, y } = intencao.dados;
      const p = personagemDe(estado, personagemId);
      if (!p) return recusa("personagem_inexistente", SEM_PERSONAGEM);
      const cena = estado.cenas.find((c) => c.id === cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      if (estado.tokens.some((t) => t.id === tokenId)) {
        return recusa("dados_invalidos", "Já existe um token com esse id.");
      }
      // Q8: cada cena tem o seu token do personagem de jogador; ter token em outra cena não importa.
      if (
        ehPersonagemDeJogador(p) &&
        estado.tokens.some((t) => t.cenaId === cena.id && t.personagemId === p.id)
      ) {
        return recusa("dados_invalidos", "Este personagem já tem um token nesta cena.");
      }
      const base =
        x !== undefined && y !== undefined
          ? { x, y }
          : encaixarNoGrid(
              chegadaDaCena(cena),
              p.tokenPadrao.tamanhoQuadrados,
              cena.grid.quadradoM,
            );
      const numeracao = ehPersonagemDeJogador(p)
        ? undefined
        : nomeNumerado(estado.tokens, cena.id, p.id, p.nome);
      const token = tokenDoPersonagem(p, cena, tokenId, base, numeracao);
      emitir({ tipo: "token.criado", dados: { token } });
      return aplicado();
    }

    case "personagem.colocarVarios": {
      // Q10: de 1 a 20 tokens de um NPC de uma vez, arrumados no grid e numerados na sala (um pedido só).
      const { personagemId, cenaId, tokenIds, x, y } = intencao.dados;
      const p = personagemDe(estado, personagemId);
      if (!p) return recusa("personagem_inexistente", SEM_PERSONAGEM);
      const cena = estado.cenas.find((c) => c.id === cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      if (new Set(tokenIds).size !== tokenIds.length) {
        return recusa("dados_invalidos", "Ids de token repetidos.");
      }
      if (tokenIds.some((id) => estado.tokens.some((t) => t.id === id))) {
        return recusa("dados_invalidos", "Já existe um token com esse id.");
      }
      if ((x === undefined) !== (y === undefined)) {
        return recusa("dados_invalidos", "Informe o ponto inteiro (x e y) ou nenhum.");
      }
      const jogador = ehPersonagemDeJogador(p);
      // O personagem de jogador tem um token por cena (Q8): em lote só entra um, o que ainda falta.
      if (
        jogador &&
        (tokenIds.length > 1 ||
          estado.tokens.some((t) => t.cenaId === cena.id && t.personagemId === p.id))
      ) {
        return recusa(
          "dados_invalidos",
          "Personagem de jogador tem um token só por cena; para vários, use um NPC.",
        );
      }
      const centro = x !== undefined && y !== undefined ? { x, y } : chegadaDaCena(cena);
      const naCena = estado.tokens.filter((t) => t.cenaId === cena.id && t.camada === "tokens");
      const lugares = arrumarNoGrid(
        centro,
        cena,
        tokenIds.map(() => p.tokenPadrao.tamanhoQuadrados),
        naCena,
      );
      const criados: Token[] = [];
      tokenIds.forEach((tokenId, i) => {
        const numeracao = jogador
          ? undefined
          : nomeNumerado([...estado.tokens, ...criados], cena.id, p.id, p.nome);
        const token = tokenDoPersonagem(
          p,
          cena,
          tokenId,
          lugares[i] as { x: number; y: number },
          numeracao,
        );
        criados.push(token);
        emitir({ tipo: "token.criado", dados: { token } });
      });
      return aplicado();
    }

    case "token.copiar": {
      // Q10: duplicar, Alt+arrastar e colar: a cópia é igual à origem (vida de agora), com o próximo número se é NPC.
      const { cenaId, itens } = intencao.dados;
      const cena = estado.cenas.find((c) => c.id === cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const ids = itens.map((i) => i.id);
      if (new Set(ids).size !== ids.length) return recusa("dados_invalidos", "Ids repetidos.");
      if (ids.some((id) => estado.tokens.some((t) => t.id === id))) {
        return recusa("dados_invalidos", "Já existe um token com esse id.");
      }
      const origens: Token[] = [];
      for (const item of itens) {
        const o = estado.tokens.find((t) => t.id === item.origemId);
        if (!o) return recusa("token_inexistente", "O token copiado não existe mais.");
        origens.push(o);
      }
      // O personagem de jogador tem um token só por cena (Q8): a cópia dele só entra numa cena onde ele ainda não está.
      const jogadoresNaCena = new Set(
        estado.tokens.filter((t) => t.cenaId === cena.id).map((t) => t.personagemId),
      );
      for (const o of origens) {
        const p = o.personagemId === undefined ? undefined : personagemDe(estado, o.personagemId);
        if (!p || !ehPersonagemDeJogador(p)) continue;
        if (jogadoresNaCena.has(p.id)) {
          return recusa(
            "dados_invalidos",
            `${p.nome} já tem um token nesta cena (personagem de jogador tem um só por cena).`,
          );
        }
        jogadoresNaCena.add(p.id);
      }
      const criados: Token[] = [];
      itens.forEach((item, i) => {
        const origem = origens[i] as Token;
        const p =
          origem.personagemId === undefined ? undefined : personagemDe(estado, origem.personagemId);
        const numeracao =
          p && !ehPersonagemDeJogador(p)
            ? nomeNumerado([...estado.tokens, ...criados], cena.id, p.id, nomeBaseDoToken(origem))
            : undefined;
        const lugar = limitarNaCena({ x: item.x, y: item.y }, cena);
        const token = copiaDoToken(origem, { id: item.id, cenaId: cena.id, ...lugar }, numeracao);
        criados.push(token);
        emitir({ tipo: "token.criado", dados: { token } });
      });
      return aplicado();
    }

    case "token.vida": {
      // Q10: a vida própria do token de NPC. Quem não vê o token (ou o personagem) recebe "inexistente".
      const { id, atual, max, temp } = intencao.dados;
      const token = estado.tokens.find((t) => t.id === id);
      if (!token || !tokenVisivelPara(token, usuario, estado.cenaAtivaId)) {
        return recusa("token_inexistente", "Token não encontrado.");
      }
      const p =
        token.personagemId === undefined ? undefined : personagemDe(estado, token.personagemId);
      if (!p || !podeEditarPersonagem(p, usuario)) {
        return recusa("sem_permissao", "Você não edita a vida deste token.");
      }
      if (!usaVidaPorToken(p)) {
        return recusa("dados_invalidos", "Este token usa a vida da ficha.");
      }
      const vida = vidaDoToken(token, p);
      if (!vida) return recusa("dados_invalidos", "Este token não tem vida.");
      const novo = aplicarNaVida(vida, { atual, max, temp });
      if (JSON.stringify(novo) === JSON.stringify(token.pv)) return aplicado();
      emitir({ tipo: "token.editado", dados: { token: { ...token, pv: novo } } });
      return aplicado();
    }

    case "tokens.mover": {
      // Q11: vários tokens de uma vez, com a regra de cada um (o jogador não atravessa parede; o mestre ignora).
      const { itens } = intencao.dados;
      if (new Set(itens.map((i) => i.id)).size !== itens.length) {
        return recusa("dados_invalidos", "Ids repetidos.");
      }
      const movidos: { id: string; x: number; y: number }[] = [];
      for (const { id, x, y } of itens) {
        const token = estado.tokens.find((t) => t.id === id);
        if (!token || !tokenVisivelPara(token, usuario, estado.cenaAtivaId)) {
          return recusa("token_inexistente", "Token não encontrado.");
        }
        if (!podeMoverToken(token, usuario, estado)) {
          return recusa("sem_permissao", "Você não controla este token.");
        }
        const cena = estado.cenas.find((c) => c.id === token.cenaId) ?? cenaAtiva(estado);
        const posicao = limitarNaCena({ x, y }, cena);
        if (
          usuario.papel !== "mestre" &&
          !cenaEhCartao(cena) &&
          trajetoBloqueado(
            { x: token.x, y: token.y },
            posicao,
            estado.paredes.filter((p) => p.cenaId === token.cenaId),
          )
        ) {
          return recusa("trajeto_bloqueado", "Uma parede bloqueia o caminho.");
        }
        movidos.push({ id, ...posicao });
      }
      for (const m of movidos) emitir({ tipo: "token.movido", dados: m });
      return aplicado();
    }

    case "tokens.vidaDelta": {
      // Q11: o mesmo dano (negativo) ou cura (positivo) em vários tokens. Vida própria: o `pv` de cada token; vida da
      // ficha: a ficha, UMA vez por personagem (dois tokens da mesma ficha não levam o dano duas vezes).
      const { ids, delta } = intencao.dados;
      if (new Set(ids).size !== ids.length) return recusa("dados_invalidos", "Ids repetidos.");
      const nosTokens: Token[] = [];
      const nasFichas = new Map<string, Personagem>();
      for (const id of ids) {
        const token = estado.tokens.find((t) => t.id === id);
        if (!token || !tokenVisivelPara(token, usuario, estado.cenaAtivaId)) {
          return recusa("token_inexistente", "Token não encontrado.");
        }
        const p =
          token.personagemId === undefined ? undefined : personagemDe(estado, token.personagemId);
        // Token sem personagem não tem vida: fica de fora.
        if (!p) continue;
        if (!personagemVisivelPara(p, usuario, estado.pastas)) {
          return recusa("token_inexistente", "Token não encontrado.");
        }
        if (!podeEditarPersonagem(p, usuario)) {
          return recusa("sem_permissao", "Você não edita a vida deste token.");
        }
        const vida = vidaDoToken(token, p);
        if (!vida) continue;
        if (usaVidaPorToken(p)) {
          const pv = aplicarDeltaNaVida(vida, delta);
          if (JSON.stringify(pv) !== JSON.stringify(token.pv)) nosTokens.push({ ...token, pv });
        } else if (!nasFichas.has(p.id) && p.ficha) {
          const novo = aplicarDeltaNaVida(vida, delta);
          const { pvTemp: _t, ...semTemp } = p.ficha;
          const ficha = {
            ...semTemp,
            pvAtual: novo.atual,
            ...(novo.temp ? { pvTemp: novo.temp } : {}),
          };
          if (JSON.stringify(ficha) !== JSON.stringify(p.ficha)) {
            nasFichas.set(p.id, { ...p, ficha });
          }
        }
      }
      for (const token of nosTokens) emitir({ tipo: "token.editado", dados: { token } });
      for (const personagem of nasFichas.values()) {
        emitir({ tipo: "personagem.alterado", dados: { personagem } });
      }
      return aplicado();
    }

    case "token.colocarMeu": {
      // V10b: a cena é a do grupo (a que o jogador vê); todos os campos vêm da ficha, aqui na sala.
      const { personagemId, tokenId, x, y } = intencao.dados;
      const p = personagemDe(estado, personagemId);
      if (!p || !podeEditarPersonagem(p, usuario)) {
        return recusa("sem_permissao", "Você só pode pôr no mapa o token de quem você controla.");
      }
      const cena = estado.cenas.find((c) => c.id === estado.cenaAtivaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      if (estado.tokens.some((t) => t.id === tokenId)) {
        return recusa("dados_invalidos", "Já existe um token com esse id.");
      }
      const doMestre = usuario.papel === "mestre";
      const jaNaCena = estado.tokens.filter((t) => t.cenaId === cena.id);
      if (!doMestre && jaNaCena.some((t) => t.personagemId === p.id)) {
        return recusa("dados_invalidos", "Este personagem já tem um token nesta cena.");
      }
      if ((x === undefined) !== (y === undefined)) {
        return recusa("dados_invalidos", "Informe o ponto inteiro (x e y) ou nenhum.");
      }
      let ponto: { x: number; y: number };
      // Q8: o jogador vai sempre para a bandeira, onde quer que tenha soltado; só o mestre escolhe o ponto.
      if (doMestre && x !== undefined && y !== undefined) {
        ponto = { x, y };
      } else {
        ponto = arrumarNoGrid(
          chegadaDaCena(cena),
          cena,
          [p.tokenPadrao.tamanhoQuadrados],
          jaNaCena.filter((t) => t.camada === "tokens"),
        )[0] as { x: number; y: number };
      }
      const numeracao = ehPersonagemDeJogador(p)
        ? undefined
        : nomeNumerado(estado.tokens, cena.id, p.id, p.nome);
      const token = tokenDoPersonagem(p, cena, tokenId, ponto, numeracao);
      emitir({ tipo: "token.criado", dados: { token } });
      return aplicado();
    }

    case "cena.criar": {
      const { id, nome } = intencao.dados;
      if (estado.cenas.some((c) => c.id === id)) {
        return recusa("dados_invalidos", "Já existe uma cena com esse id.");
      }
      const { larguraM, alturaM, grid } = CENA_PADRAO;
      emitir({
        tipo: "cena.criada",
        dados: { cena: { id, nome, larguraM, alturaM, grid: { ...grid } } },
      });
      return aplicado();
    }

    case "cena.editar": {
      const { cenaId, nome, chegada, mostrarParedesAosJogadores, cartao, ambientes } =
        intencao.dados;
      const atual = estado.cenas.find((c) => c.id === cenaId);
      if (!atual) return recusa("cena_inexistente", SEM_CENA);
      // Q4: os ambientes da cena (lugares da mesa de som), sem repetir e em ordem; `null` tira a lista.
      const novosAmbientes =
        ambientes === undefined
          ? atual.ambientes
          : ambientes === null
            ? undefined
            : [...new Set(ambientes)].sort((a, b) => a - b);
      const {
        chegada: _antiga,
        mostrarParedesAosJogadores: _mostrar,
        cartao: _cartao,
        trilha: _trilhaAntiga,
        ambientes: _ambientesAntigos,
        ...semChegada
      } = atual;
      const nova = chegada === undefined ? atual.chegada : (chegada ?? undefined);
      // Sem o campo (ou desligado) os jogadores não veem os contornos: só gravamos quando liga.
      const mostrar = mostrarParedesAosJogadores ?? atual.mostrarParedesAosJogadores ?? false;
      const ehCartao = cartao ?? cenaEhCartao(atual);
      const cena: Cena = {
        ...semChegada,
        nome: nome ?? atual.nome,
        ...(nova ? { chegada: limitarNaCena(nova, atual) } : {}),
        ...(mostrar ? { mostrarParedesAosJogadores: true } : {}),
        ...(ehCartao ? { cartao: true } : {}),
        ...(novosAmbientes === undefined ? {} : { ambientes: novosAmbientes }),
      };
      if (JSON.stringify(cena) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "cena.editada", dados: { cena } });
      // V10c: virar cartão (ou voltar a mapa) muda as paredes que o jogador deve ter: snapshot novo.
      return aplicado(ehCartao === cenaEhCartao(atual) ? [] : "todos");
    }

    case "nevoa.tracar": {
      const { cenaId, traco } = intencao.dados;
      const atual = estado.cenas.find((c) => c.id === cenaId);
      if (!atual) return recusa("cena_inexistente", SEM_CENA);
      if (acrescentarTraco(atual.nevoa, traco) === null) {
        return recusa(
          "dados_invalidos",
          "Névoa com traços demais nesta cena. Use Cobrir tudo ou Revelar tudo para recomeçar.",
        );
      }
      emitir({ tipo: "nevoa.tracada", dados: { cenaId, traco } });
      return aplicado();
    }

    case "nevoa.desfazer": {
      const { cenaId } = intencao.dados;
      const atual = estado.cenas.find((c) => c.id === cenaId);
      if (!atual) return recusa("cena_inexistente", SEM_CENA);
      if ((atual.nevoa ?? []).length === 0) return aplicado();
      emitir({ tipo: "nevoa.desfeita", dados: { cenaId } });
      return aplicado();
    }

    case "cena.duplicar": {
      const { cenaId, novoId } = intencao.dados;
      const origem = estado.cenas.find((c) => c.id === cenaId);
      if (!origem) return recusa("cena_inexistente", SEM_CENA);
      if (estado.cenas.some((c) => c.id === novoId)) {
        return recusa("dados_invalidos", "Já existe uma cena com esse id.");
      }
      // Cópia da cena e dos tokens, menos os dos personagens de jogador (esses vivem no grupo).
      const copiados = estado.tokens.filter((t) => t.cenaId === cenaId && !ehDoGrupo(estado, t));
      const novos = copiados.map(
        (t, i): Token => ({ ...t, id: `${novoId.slice(0, 56)}-${i + 1}`, cenaId: novoId }),
      );
      if (novos.some((t) => estado.tokens.some((x) => x.id === t.id))) {
        return recusa("dados_invalidos", "Ids de token da cópia já existem; use outro id.");
      }
      emitir({
        tipo: "cena.criada",
        dados: { cena: { ...origem, id: novoId, nome: `${origem.nome} (cópia)`.slice(0, 64) } },
      });
      for (const token of novos) emitir({ tipo: "token.criado", dados: { token } });
      estado.desenhos
        .filter((d) => d.cenaId === cenaId)
        .forEach((d, i) => {
          emitir({
            tipo: "desenho.criado",
            dados: { desenho: { ...d, id: `${novoId.slice(0, 50)}-d${i + 1}`, cenaId: novoId } },
          });
        });
      estado.paredes
        .filter((p) => p.cenaId === cenaId)
        .forEach((p, i) => {
          const parede: Parede = { ...p, id: `${novoId.slice(0, 50)}-p${i + 1}`, cenaId: novoId };
          emitir({ tipo: "parede.criada", dados: { parede } });
        });
      // 7b-2 (assumido): as zonas da cena vão para a cópia, com as reações que carregam.
      const copiaDeZona = new Map<string, string>();
      zonasDe(estado)
        .filter((z) => z.cenaId === cenaId)
        .forEach((z, i) => {
          const zona: Zona = { ...z, id: `${novoId.slice(0, 50)}-z${i + 1}`, cenaId: novoId };
          copiaDeZona.set(z.id, zona.id);
          emitir({ tipo: "zona.alterada", dados: { zona } });
        });
      if (copiaDeZona.size > 0 && estado.automacoes) {
        const reacoes = estado.automacoes.reacoes.flatMap((r, i) => {
          const novaZona = r.fica.tipo === "zona" ? copiaDeZona.get(r.fica.id) : undefined;
          return novaZona === undefined
            ? []
            : [
                {
                  ...r,
                  id: `${novoId.slice(0, 40)}-r${i + 1}`,
                  fica: { tipo: "zona" as const, id: novaZona },
                },
              ];
        });
        if (reacoes.length > 0) {
          emitir({
            tipo: "automacoes.alterado",
            dados: {
              automacoes: {
                ...estado.automacoes,
                reacoes: [...estado.automacoes.reacoes, ...reacoes].slice(0, 300),
              },
            },
          });
        }
      }
      // As luzes fixas vão para a cena nova; as presas a token seguem o token copiado. O que está em
      // ponto, mão ou mochila não é copiado (os pontos vão vazios).
      const novoDe = new Map(copiados.map((t, i) => [t.id, novos[i]?.id ?? ""]));
      estado.pontos
        .filter((p) => p.cenaId === cenaId)
        .forEach((p, i) => {
          emitir({
            tipo: "ponto.alterado",
            dados: { ponto: { ...p, id: `${novoId.slice(0, 50)}-pt${i + 1}`, cenaId: novoId } },
          });
        });
      estado.luzes
        .filter(
          (l) => l.cenaId === cenaId && (l.portador.tipo === "cena" || l.portador.tipo === "token"),
        )
        .forEach((l, i) => {
          const original = l.portador;
          if (original.tipo !== "cena" && original.tipo !== "token") return;
          const portador =
            original.tipo === "cena"
              ? original
              : { tipo: "token" as const, tokenId: novoDe.get(original.tokenId) ?? "" };
          if (portador.tipo === "token" && portador.tokenId === "") return;
          const fonte: FonteDeLuz = {
            ...l,
            id: `${novoId.slice(0, 50)}-l${i + 1}`,
            cenaId: novoId,
            portador,
          };
          emitir({ tipo: "fonte.criada", dados: { fonte } });
        });
      return aplicado();
    }

    case "cena.importarMapa": {
      const d = intencao.dados;
      if (estado.cenas.some((c) => c.id === d.id)) {
        return recusa("dados_invalidos", "Já existe uma cena com esse id.");
      }
      const meta = metaDoAsset(estado, d.assetHash);
      if (meta?.tipo !== "mapa") return recusa("asset_inexistente", "Mapa não encontrado.");
      const { quadradoM, visivel } = CENA_PADRAO.grid;
      const { larguraM, alturaM } = tamanhoDaCenaComMapa(meta, d.pxPorQuadrado, quadradoM);
      if (larguraM > 1000 || alturaM > 1000) {
        return recusa("dados_invalidos", "O mapa fica grande demais com esse px por quadrado.");
      }
      const cena: Cena = {
        id: d.id,
        nome: d.nome,
        larguraM,
        alturaM,
        grid: { quadradoM, visivel },
        mapa: { assetHash: d.assetHash, pxPorQuadrado: d.pxPorQuadrado },
        ...(d.luzAmbiente === undefined || d.luzAmbiente === 1
          ? {}
          : { luzAmbiente: d.luzAmbiente }),
      };
      const idsDeParede = new Set(estado.paredes.map((p) => p.id));
      const paredes: Parede[] = [];
      for (const n of d.paredes) {
        if (idsDeParede.has(n.id)) {
          return recusa("dados_invalidos", "Já existe uma parede com esse id.");
        }
        idsDeParede.add(n.id);
        const a = limitarNaCena(n.a, cena);
        const b = limitarNaCena(n.b, cena);
        // Parede sem comprimento (a borda do mapa a achatou) não entra; o resto da importação segue.
        if (a.x === b.x && a.y === b.y) continue;
        const meio = n.meio ? limitarNaCena(n.meio, cena) : undefined;
        paredes.push({
          id: n.id,
          cenaId: cena.id,
          a,
          b,
          ...(meio && arcoPorTresPontos(a, meio, b) ? { meio } : {}),
          tipo: n.tipo,
          ...estadoDaParede(n.tipo, n.estado),
        });
      }
      const idsDeLuz = new Set(estado.luzes.map((l) => l.id));
      const fontes: FonteDeLuz[] = [];
      for (const f of d.fontes) {
        if (idsDeLuz.has(f.id)) {
          return recusa("dados_invalidos", "Já existe uma fonte de luz com esse id.");
        }
        idsDeLuz.add(f.id);
        const portador = portadorValido(estado, cena, f.portador);
        if (!portador) continue;
        fontes.push({
          ...f,
          cenaId: cena.id,
          portador,
          saldoMs: null,
          modificadores: [],
          historico: [],
        });
      }
      emitir({ tipo: "cena.criada", dados: { cena } });
      for (const parede of paredes) emitir({ tipo: "parede.criada", dados: { parede } });
      for (const fonte of fontes) emitir({ tipo: "fonte.criada", dados: { fonte } });
      return aplicado();
    }

    case "cena.apagar": {
      const { cenaId } = intencao.dados;
      if (!estado.cenas.some((c) => c.id === cenaId)) return recusa("cena_inexistente", SEM_CENA);
      if (cenaId === estado.cenaAtivaId) {
        return recusa("dados_invalidos", "A cena onde está o grupo não pode ser apagada.");
      }
      const tokensDaCena = estado.tokens.filter((x) => x.cenaId === cenaId);
      for (const t of tokensDaCena) {
        emitir({ tipo: "token.apagado", dados: { id: t.id } });
      }
      limparCombate(new Set(tokensDaCena.map((t) => t.id)));
      for (const p of estado.paredes.filter((x) => x.cenaId === cenaId)) {
        emitir({ tipo: "parede.apagada", dados: { id: p.id } });
      }
      for (const z of zonasDe(estado).filter((x) => x.cenaId === cenaId)) {
        emitir({ tipo: "zona.apagada", dados: { id: z.id } });
      }
      const pontosDaCena = new Set(
        estado.pontos.filter((p) => p.cenaId === cenaId).map((p) => p.id),
      );
      for (const l of estado.luzes) {
        const p = l.portador;
        const nela = l.cenaId === cenaId || (p.tipo === "ponto" && pontosDaCena.has(p.pontoId));
        if (nela) emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
      }
      for (const id of pontosDaCena) emitir({ tipo: "ponto.apagado", dados: { id } });
      emitir({ tipo: "cena.apagada", dados: { cenaId } });
      return aplicado();
    }

    case "grupo.moverPara": {
      const destino = estado.cenas.find((c) => c.id === intencao.dados.cenaId);
      if (!destino) return recusa("cena_inexistente", SEM_CENA);
      if (destino.rascunho) {
        return recusa(
          "dados_invalidos",
          "Esta cena é um rascunho: publique-a antes de levar o grupo.",
        );
      }
      if (destino.id === estado.cenaAtivaId) return aplicado();
      // O grupo: tokens de personagens de jogador que estão na cena ativa. Os de NPC ficam.
      // Q8: quem já tem token na cena de destino fica com o de lá (o da origem não vai junto).
      const grupo = estado.tokens.filter(
        (t) =>
          t.cenaId === estado.cenaAtivaId &&
          ehDoGrupo(estado, t) &&
          !estado.tokens.some((o) => o.cenaId === destino.id && o.personagemId === t.personagemId),
      );
      const posicoes = arrumarNoGrid(
        limitarNaCena(chegadaDaCena(destino), destino),
        destino,
        grupo.map((t) => t.tamanhoQuadrados),
      );
      emitir({
        tipo: "grupo.movido",
        dados: {
          cenaId: destino.id,
          tokens: grupo.map((t, i) => ({
            id: t.id,
            x: posicoes[i]?.x ?? t.x,
            y: posicoes[i]?.y ?? t.y,
          })),
        },
      });
      // Q4: os ambientes da cena ligam ao levar o grupo e os outros desligam (os que já tocam e continuam marcados
      // seguem sem recomeçar). Cena sem a lista não mexe em nada.
      const ligados = ligadosParaACena(proximo, destino, agoraMs);
      if (ligados) {
        emitir({
          tipo: "som.ligadoAlterado",
          dados: { somLigado: somLigadoOuNada(ligados) ?? null },
        });
      }
      return { ...aplicado("todos"), grupoMovido: { cenaId: destino.id } };
    }

    case "cena.preparar": {
      const { cenaId, pacotes } = intencao.dados;
      if (!estado.cenas.some((c) => c.id === cenaId)) return recusa("cena_inexistente", SEM_CENA);
      // Só entra no pré-envio o que os jogadores veriam nessa cena (mapa e imagens de tokens visíveis).
      const permitidos = new Set(hashesPreparaveis(estado, cenaId));
      for (const p of pacotes) {
        if (metaDoAsset(estado, p.hashCifrado)?.tipo !== "cifrado") {
          return recusa("asset_inexistente", "Arquivo cifrado não registrado.");
        }
        if (!permitidos.has(p.hashOriginal)) {
          return recusa(
            "dados_invalidos",
            "O pacote não pertence aos arquivos que os jogadores veriam nessa cena.",
          );
        }
      }
      return { ...aplicado(), preparo: { cenaId, pacotes } };
    }

    case "parede.criar": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const ids = new Set(estado.paredes.map((p) => p.id));
      const novas: Parede[] = [];
      for (const n of intencao.dados.paredes) {
        if (ids.has(n.id)) return recusa("dados_invalidos", "Já existe uma parede com esse id.");
        ids.add(n.id);
        const a = limitarNaCena(n.a, cena);
        const b = limitarNaCena(n.b, cena);
        if (a.x === b.x && a.y === b.y) return recusa("dados_invalidos", "Parede sem comprimento.");
        const meio = n.meio ? limitarNaCena(n.meio, cena) : undefined;
        novas.push({
          id: n.id,
          cenaId: cena.id,
          a,
          b,
          // Os três pontos alinhados não fazem arco: a parede fica reta.
          ...(meio && arcoPorTresPontos(a, meio, b) ? { meio } : {}),
          tipo: n.tipo,
          ...estadoDaParede(n.tipo, n.estado),
        });
      }
      for (const parede of novas) emitir({ tipo: "parede.criada", dados: { parede } });
      return aplicado();
    }

    case "parede.editar": {
      const { id, a, b, meio: novoMeio, tipo, estado: novoEstado } = intencao.dados;
      const atual = estado.paredes.find((p) => p.id === id);
      if (!atual) return recusa("parede_inexistente", "Parede não encontrada.");
      const cena = estado.cenas.find((c) => c.id === atual.cenaId) ?? cenaAtiva(estado);
      const novoTipo = tipo ?? atual.tipo;
      const pa = a ? limitarNaCena(a, cena) : atual.a;
      const pb = b ? limitarNaCena(b, cena) : atual.b;
      // `meio`: `null` endireita; ponto novo troca; sem o campo, o arco acompanha a mudança das pontas
      // (o ponto do arco anda com o meio da corda).
      let meio: Ponto | undefined;
      if (novoMeio === null) meio = undefined;
      else if (novoMeio) meio = limitarNaCena(novoMeio, cena);
      else if (atual.meio) {
        meio = limitarNaCena(
          {
            x: atual.meio.x + (pa.x + pb.x) / 2 - (atual.a.x + atual.b.x) / 2,
            y: atual.meio.y + (pa.y + pb.y) / 2 - (atual.a.y + atual.b.y) / 2,
          },
          cena,
        );
      }
      const parede: Parede = {
        id: atual.id,
        cenaId: atual.cenaId,
        a: pa,
        b: pb,
        ...(meio && arcoPorTresPontos(pa, meio, pb) ? { meio } : {}),
        tipo: novoTipo,
        ...estadoDaParede(novoTipo, novoEstado ?? atual.estado),
      };
      if (parede.a.x === parede.b.x && parede.a.y === parede.b.y) {
        return recusa("dados_invalidos", "Parede sem comprimento.");
      }
      if (JSON.stringify(parede) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "parede.editada", dados: { parede } });
      return aplicado();
    }

    case "parede.apagar": {
      if (!estado.paredes.some((p) => p.id === intencao.dados.id)) {
        return recusa("parede_inexistente", "Parede não encontrada.");
      }
      emitir({ tipo: "parede.apagada", dados: { id: intencao.dados.id } });
      return aplicado();
    }

    case "cena.configurarIluminacao": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const { dinamica, luzAmbiente, fatorDeLuz } = intencao.dados;
      const nova: Cena = {
        ...cena,
        // Só muda o que de fato muda (sem o campo valem: ligada, dia e fator 1).
        ...(dinamica === undefined || dinamica === iluminacaoDinamicaLigada(cena)
          ? {}
          : { iluminacaoDinamica: dinamica }),
        ...(luzAmbiente === undefined || luzAmbiente === luzAmbienteDa(cena)
          ? {}
          : { luzAmbiente }),
        ...(fatorDeLuz === undefined || fatorDeLuz === fatorDeLuzDa(cena) ? {} : { fatorDeLuz }),
      };
      if (JSON.stringify(nova) === JSON.stringify(cena)) return aplicado();
      emitir({ tipo: "cena.editada", dados: { cena: nova } });
      return aplicado();
    }

    case "fonte.criar": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const n = intencao.dados.fonte;
      if (estado.luzes.some((l) => l.id === n.id)) {
        return recusa("dados_invalidos", "Já existe uma fonte de luz com esse id.");
      }
      const portador = portadorValido(estado, cena, n.portador);
      if (!portador) return recusa("token_inexistente", "O token da luz não está nessa cena.");
      emitir({
        tipo: "fonte.criada",
        dados: {
          fonte: {
            ...n,
            cenaId: cena.id,
            portador,
            saldoMs: null,
            modificadores: [],
            historico: [],
          },
        },
      });
      return aplicado();
    }

    case "fonte.editar": {
      const atual = estado.luzes.find((l) => l.id === intencao.dados.id);
      if (!atual) return recusa("fonte_inexistente", "Fonte de luz não encontrada.");
      const m = intencao.dados.mudancas;
      const cena = estado.cenas.find((c) => c.id === atual.cenaId) ?? cenaAtiva(estado);
      const portador =
        m.portador === undefined ? atual.portador : portadorValido(estado, cena, m.portador);
      if (!portador) return recusa("token_inexistente", "O token da luz não está nessa cena.");
      // O objeto de jogo (mão, mochila, ponto) só muda de portador pelas intenções de tocha.
      if (
        m.portador !== undefined &&
        atual.portador.tipo !== "cena" &&
        atual.portador.tipo !== "token"
      ) {
        return recusa("dados_invalidos", "Este objeto só muda de lugar pelas ações da tocha.");
      }
      const fonte: FonteDeLuz = {
        ...atual,
        nome: m.nome ?? atual.nome,
        portador,
        luz: { ...atual.luz, ...semIndefinidos(m.luz ?? {}) },
        intensidade: m.intensidade ?? atual.intensidade,
        estado: m.estado ?? atual.estado,
      };
      if (JSON.stringify(fonte) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "fonte.editada", dados: { fonte } });
      return aplicado();
    }

    case "fonte.apagar": {
      if (!estado.luzes.some((l) => l.id === intencao.dados.id)) {
        return recusa("fonte_inexistente", "Fonte de luz não encontrada.");
      }
      emitir({ tipo: "fonte.apagada", dados: { id: intencao.dados.id } });
      return aplicado();
    }

    case "config.iluminacao": {
      const iluminacao = {
        ...estado.config.iluminacao,
        ...semIndefinidos(intencao.dados.mudancas),
      };
      if (JSON.stringify(iluminacao) === JSON.stringify(estado.config.iluminacao))
        return aplicado();
      emitir({ tipo: "config.alterada", dados: { config: { ...estado.config, iluminacao } } });
      return aplicado();
    }

    case "config.mesa": {
      const { estagios, ...geral } = intencao.dados.mudancas;
      const config: ConfigDaMesa = {
        ...estado.config,
        ...semIndefinidos(geral),
        estagios: { ...estado.config.estagios, ...semIndefinidos(estagios ?? {}) },
      };
      if (config.estagios.morrendo > config.estagios.fraca) {
        return recusa(
          "dados_invalidos",
          "O estágio morrendo precisa ser menor que o estágio fraca.",
        );
      }
      if (JSON.stringify(config) === JSON.stringify(estado.config)) return aplicado();
      emitir({ tipo: "config.alterada", dados: { config } });
      // O que cada jogador vê do tempo e das durações depende disso: snapshot novo.
      const muda =
        config.tempoParaJogadores !== estado.config.tempoParaJogadores ||
        JSON.stringify(config.estagios) !== JSON.stringify(estado.config.estagios);
      return aplicado(muda ? "todos" : []);
    }

    case "mesa.pausar": {
      if (estado.relogio.pausada) return aplicado();
      emitir({ tipo: "mesa.pausada", dados: { salaMs: tempoDaSala(estado.relogio, agoraMs) } });
      return aplicado("todos");
    }

    case "mesa.retomar": {
      if (!estado.relogio.pausada) return aplicado();
      emitir({
        tipo: "mesa.retomada",
        dados: { salaMs: estado.relogio.acumuladoMs, desdeReal: agoraMs },
      });
      return aplicado("todos");
    }

    case "mesa.zerarRelogio": {
      // V1: o marco da pílula. O tempo da sala (e as tochas) fica exatamente como estava.
      emitir({
        tipo: "mesa.relogioZerado",
        dados: {
          salaMs: tempoDaSala(estado.relogio, agoraMs),
          ...(estado.relogio.pausada ? {} : { desdeReal: agoraMs }),
        },
      });
      return aplicado();
    }

    case "modelo.criar": {
      const { modelo } = intencao.dados;
      if (estado.modelos.some((m) => m.id === modelo.id)) {
        return recusa("dados_invalidos", "Já existe um modelo com esse id.");
      }
      emitir({ tipo: "modelo.alterado", dados: { modelo } });
      return aplicado();
    }

    case "modelo.editar": {
      const atual = estado.modelos.find((m) => m.id === intencao.dados.id);
      if (!atual) return recusa("modelo_inexistente", "Modelo de objeto não encontrado.");
      const m = intencao.dados.mudancas;
      const modelo = {
        ...atual,
        ...semIndefinidos({ nome: m.nome, ocupaMao: m.ocupaMao, tags: m.tags }),
        ...(m.duracaoS === undefined ? {} : { duracaoS: m.duracaoS }),
        luz: { ...atual.luz, ...semIndefinidos(m.luz ?? {}) },
      };
      if (JSON.stringify(modelo) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "modelo.alterado", dados: { modelo } });
      return aplicado();
    }

    case "modelo.apagar": {
      const { id } = intencao.dados;
      if (!estado.modelos.some((m) => m.id === id)) {
        return recusa("modelo_inexistente", "Modelo de objeto não encontrado.");
      }
      const emUso =
        estado.luzes.some((l) => l.modeloId === id) ||
        estado.personagens.some((p) => novasDoModelo(p.ficha, id, estado.modelos) > 0) ||
        estado.pontos.some((p) => p.modeloId === id);
      if (emUso) {
        return recusa("dados_invalidos", "Há objetos, mochilas ou pontos usando este modelo.");
      }
      emitir({ tipo: "modelo.apagado", dados: { id } });
      return aplicado();
    }

    case "ponto.criar": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      const n = intencao.dados.ponto;
      if (estado.pontos.some((p) => p.id === n.id)) {
        return recusa("dados_invalidos", "Já existe um ponto com esse id.");
      }
      if (n.modeloId !== undefined && !estado.modelos.some((m) => m.id === n.modeloId)) {
        return recusa("modelo_inexistente", "Modelo de objeto não encontrado.");
      }
      const ponto: PontoDeLuz = { ...n, ...limitarNaCena(n, cena), cenaId: cena.id };
      emitir({ tipo: "ponto.alterado", dados: { ponto } });
      return aplicado();
    }

    case "ponto.editar": {
      const atual = estado.pontos.find((p) => p.id === intencao.dados.id);
      if (!atual) return recusa("ponto_inexistente", "Ponto não encontrado.");
      const m = intencao.dados.mudancas;
      if (typeof m.modeloId === "string" && !estado.modelos.some((x) => x.id === m.modeloId)) {
        return recusa("modelo_inexistente", "Modelo de objeto não encontrado.");
      }
      const cena = estado.cenas.find((c) => c.id === atual.cenaId) ?? cenaAtiva(estado);
      const { capacidade, modeloId, segurarS, ...simples } = m;
      const { capacidade: _c, modeloId: _m, segurarS: _s, ...fixos } = atual;
      const posicao = limitarNaCena({ x: m.x ?? atual.x, y: m.y ?? atual.y }, cena);
      const cap = capacidade === null ? undefined : (capacidade ?? atual.capacidade);
      const mod = modeloId === null ? undefined : (modeloId ?? atual.modeloId);
      const seg = segurarS === null ? undefined : (segurarS ?? atual.segurarS);
      const ponto: PontoDeLuz = {
        ...fixos,
        ...semIndefinidos(simples),
        ...posicao,
        ...(cap === undefined ? {} : { capacidade: cap }),
        ...(mod === undefined ? {} : { modeloId: mod }),
        ...(seg === undefined ? {} : { segurarS: seg }),
      };
      if (JSON.stringify(ponto) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "ponto.alterado", dados: { ponto } });
      // Quem vê o ponto, e as luzes que estão nele, dependem de visibilidade e posição: snapshot novo.
      const temObjeto = estado.luzes.some(
        (l) => l.portador.tipo === "ponto" && l.portador.pontoId === atual.id,
      );
      const muda =
        ponto.visivelParaJogadores !== atual.visivelParaJogadores ||
        (temObjeto && (ponto.x !== atual.x || ponto.y !== atual.y));
      return aplicado(muda ? "todos" : []);
    }

    case "ponto.apagar": {
      const { id } = intencao.dados;
      if (!estado.pontos.some((p) => p.id === id)) {
        return recusa("ponto_inexistente", "Ponto não encontrado.");
      }
      for (const l of estado.luzes) {
        if (l.portador.tipo === "ponto" && l.portador.pontoId === id) {
          emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
        }
      }
      emitir({ tipo: "ponto.apagado", dados: { id } });
      return aplicado();
    }

    case "tocha.acender":
      return daTocha(tocharAcender(contextoDeTochas, intencao.dados));
    case "tocha.alternar":
      return daTocha(tocharAlternar(contextoDeTochas, intencao.dados));
    case "tocha.guardar":
      return daTocha(tocharGuardar(contextoDeTochas, intencao.dados));
    case "tocha.entregar":
      return daTocha(tocharEntregar(contextoDeTochas, intencao.dados));
    case "tocha.posar":
      return daTocha(tocharPosar(contextoDeTochas, intencao.dados));
    case "ponto.pegar":
      return daTocha(pontoPegar(contextoDeTochas, intencao.dados));
    case "ponto.acenderInicio":
      return daTocha(pontoAcenderInicio(contextoDeTochas, intencao.dados));
    case "ponto.acenderFim":
      return daTocha(pontoAcenderFim(contextoDeTochas, intencao.dados));
    case "objeto.ajustar":
      return daTocha(objetoAjustar(contextoDeTochas, intencao.dados));
    case "mochila.ajustar":
      return daTocha(mochilaAjustar(contextoDeTochas, intencao.dados));

    case "memoria.esquecer": {
      const cena = cenaDoPedido(estado, intencao.dados.cenaId);
      if (!cena) return recusa("cena_inexistente", SEM_CENA);
      emitir({
        tipo: "memoria.esquecida",
        dados: { cenaId: cena.id, versao: proximo.seq + 1 },
      });
      return aplicado();
    }

    case "porta.alternar": {
      const porta = estado.paredes.find((p) => p.id === intencao.dados.id);
      const inexistente = recusa("porta_inexistente", "Não há porta aí.");
      if (usuario.papel === "mestre") {
        if (!porta || (porta.tipo !== "porta" && porta.tipo !== "secreta")) return inexistente;
        emitir({
          tipo: "parede.editada",
          dados: { parede: { ...porta, estado: alternarPortaDoMestre(porta) } },
        });
        return aplicado();
      }
      // Porta de outra cena responde igual a porta inexistente.
      if (!porta || porta.cenaId !== estado.cenaAtivaId) return inexistente;
      // V10c: numa cena-cartão as portas guardadas não têm efeito para o jogador.
      if (cenaEhCartao(cenaAtiva(estado))) return inexistente;
      const tokensDele = estado.tokens.filter(
        (t) =>
          t.cenaId === estado.cenaAtivaId &&
          tokenVisivelPara(t, usuario, estado.cenaAtivaId) &&
          controlaToken(t, usuario, estado.personagens),
      );
      const r = alternarPortaDoJogador(porta, tokensDele, ALCANCE_INTERACAO_PADRAO_M);
      if (!r.ok) {
        if (r.motivo === "trancada") return recusa("porta_trancada", "A porta está trancada.");
        if (r.motivo === "longe") {
          return recusa("fora_de_alcance", "Você está longe demais da porta.");
        }
        return inexistente;
      }
      emitir({ tipo: "parede.editada", dados: { parede: { ...porta, estado: r.estado } } });
      return aplicado();
    }

    case "chat.enviar":
    case "dado.rolar":
    case "chat.modelo":
    case "chat.magia":
    case "chat.caracteristica": {
      const r = criarMensagem(estado, usuario, intencao, agoraMs, aleatorio);
      if (!r.ok) return { ok: false, erro: r.erro };
      if (r.mensagem) emitir({ tipo: "chat.mensagem", dados: { mensagem: r.mensagem } });
      return aplicado();
    }

    // A resposta (as mensagens mais antigas que ele vê) é montada pela sala, que guarda o histórico.
    case "chat.anteriores":
      return aplicado();

    case "chat.limpar":
      emitir({ tipo: "chat.limpo", dados: {} });
      return aplicado();

    case "combate.adicionar":
      return doCombate(combateAdicionar(contextoDeCombate, intencao.dados));
    case "combate.tirar":
      return doCombate(combateTirar(contextoDeCombate, intencao.dados));
    case "combate.editar":
      return doCombate(combateEditar(contextoDeCombate, intencao.dados));
    case "combate.mover":
      return doCombate(combateMover(contextoDeCombate, intencao.dados));
    case "combate.ordenar":
      return doCombate(combateOrdenar(contextoDeCombate));
    case "combate.rolar":
      return doCombate(combateRolar(contextoDeCombate, intencao.dados));
    case "combate.proximo":
      return doCombate(combateProximo(contextoDeCombate));
    case "combate.anterior":
      return doCombate(combateAnterior(contextoDeCombate));
    case "combate.passar":
      return doCombate(combatePassar(contextoDeCombate));
    case "combate.encerrar":
      return doCombate(combateEncerrar(contextoDeCombate));
    case "combate.entrar":
      return doCombate(combateEntrar(contextoDeCombate, intencao.dados));
    case "combate.rodada":
      return doCombate(combateRodada(contextoDeCombate, intencao.dados));
    case "combate.darVez":
      return doCombate(combateDarVez(contextoDeCombate, intencao.dados));
    case "token.condicoes":
      return doCombate(tokenCondicoes(contextoDeCombate, intencao.dados));

    case "desenho.criar":
      return doDesenho(desenhoCriar(contextoDeDesenho, intencao.dados));
    case "desenho.mover":
      return doDesenho(desenhoMover(contextoDeDesenho, intencao.dados));
    case "desenho.apagar":
      return doDesenho(desenhoApagar(contextoDeDesenho, intencao.dados));
    case "desenho.voltar":
      return doDesenho(desenhoVoltar(contextoDeDesenho, intencao.dados));
    case "desenho.limpar":
      return doDesenho(desenhoLimpar(contextoDeDesenho, intencao.dados));
    case "desenho.rascunho":
      return doDesenho(desenhoRascunho(contextoDeDesenho, intencao.dados));

    case "ciclo.criar":
    case "ciclo.editar":
    case "ciclo.apagar":
    case "ciclo.disparar":
    case "ciclo.pausar":
    case "ciclo.retomar":
    case "reacao.criar":
    case "reacao.editar":
    case "reacao.apagar":
    case "botao.criar":
    case "botao.editar":
    case "botao.apagar":
    case "evento.disparar": {
      const saida = tratarAutomacao(contextoDoMotor, intencao);
      return "erro" in saida ? { ok: false, erro: saida.erro } : aplicado(saida.snapshotPara ?? []);
    }
    case "botao.usar": {
      const traduzida = intencaoDoBotao(estado, intencao, usuario.papel === "mestre");
      if ("erro" in traduzida) return { ok: false, erro: traduzida.erro };
      const saida = tratarAutomacao(contextoDoMotor, traduzida.intencao);
      return "erro" in saida ? { ok: false, erro: saida.erro } : aplicado(saida.snapshotPara ?? []);
    }

    case "zona.criar": {
      const { zona } = intencao.dados;
      if (!estado.cenas.some((c) => c.id === zona.cenaId)) {
        return recusa("cena_inexistente", SEM_CENA);
      }
      if (zonasDe(estado).some((z) => z.id === zona.id)) {
        return recusa("dados_invalidos", "Já existe uma zona com esse id.");
      }
      if (zonasDe(estado).length >= MAXIMO_DE_ZONAS) {
        return recusa("dados_invalidos", "Zonas demais.");
      }
      emitir({ tipo: "zona.alterada", dados: { zona } });
      return aplicado();
    }
    case "zona.editar": {
      const { id, mudancas } = intencao.dados;
      const atual = zonasDe(estado).find((z) => z.id === id);
      if (!atual) return recusa("zona_inexistente", "Zona não encontrada.");
      const definidas = Object.fromEntries(
        Object.entries(mudancas).filter(([, v]) => v !== undefined),
      );
      const juntada = ZonaSchema.safeParse({ ...atual, ...definidas, id, cenaId: atual.cenaId });
      if (!juntada.success) {
        return recusa("dados_invalidos", juntada.error.issues[0]?.message ?? "Zona inválida.");
      }
      if (JSON.stringify(juntada.data) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "zona.alterada", dados: { zona: juntada.data } });
      return aplicado();
    }
    case "zona.apagar": {
      const { id } = intencao.dados;
      if (!zonasDe(estado).some((z) => z.id === id)) {
        return recusa("zona_inexistente", "Zona não encontrada.");
      }
      emitir({ tipo: "zona.apagada", dados: { id } });
      return aplicado();
    }

    case "rascunho.publicar": {
      const itens = intencao.dados.itens;
      const alvo = itens ?? listarRascunhos(estado);
      const eventosDePub = eventosDePublicacao(estado, itens);
      if (itens !== undefined && eventosDePub.length === 0 && alvo.length > 0) {
        return recusa("dados_invalidos", "Nenhum desses itens é um rascunho.");
      }
      // A publicação é do mestre (ou do Claude dele): o evento sai sem a marca, direto (sem o carimbo de rascunho).
      for (const ev of eventosDePub) {
        const completo = { ...ev, seq: proximo.seq + 1, origem } as EventoSala;
        eventos.push(completo);
        proximo = reduzir(proximo, completo);
      }
      return aplicado(eventosDePub.length > 0 ? "todos" : []);
    }

    case "rascunho.descartar": {
      // Cada item é apagado com as regras de apagar dele (a cena leva o que há nela; a pasta só sai vazia).
      const lista = listarRascunhos(proximo);
      for (const item of intencao.dados.itens) {
        if (!lista.some((r) => r.tipo === item.tipo && r.id === item.id)) {
          return recusa("dados_invalidos", "Só dá para descartar o que é rascunho.");
        }
      }
      for (const item of intencao.dados.itens) {
        const noMomento = listarRascunhos(proximo);
        // O item pode já ter saído junto com outro (a cena leva os tokens dela).
        if (!noMomento.some((r) => r.tipo === item.tipo && r.id === item.id)) continue;
        const sub = intencaoDeDescarte(item);
        const r = processarIntencao(
          proximo,
          usuarioId,
          { v: 1, id: intencao.id, ...sub } as Intencao,
          agora,
          aleatorio,
          [],
          { claude: false },
        );
        if (!r.ok) return r;
        proximo = r.estado;
        eventos.push(...r.eventos);
      }
      return aplicado("todos");
    }

    // A resposta (o diário do Claude) é da sala: ela intercepta este pedido antes de chegar aqui.
    case "claude.desfazer":
      return recusa("lote_inexistente", "Este lote não existe.");

    // M1: a caixa de entrada é da sala; ela intercepta estes pedidos antes de chegar aqui.
    case "caixa.concluir":
    case "caixa.falhar":
      return recusa("sem_permissao", "Só a sala conclui os arquivos do Claude.");

    case "compendio.definir": {
      const { compendio } = intencao.dados;
      if (compendio === null) {
        if (estado.compendio === undefined) return aplicado();
        emitir({ tipo: "compendio.alterado", dados: { compendio: null } });
        return aplicado();
      }
      // O arquivo é do mestre e nunca está aqui: só vale apontar para um asset `compendio` já registrado.
      if (metaDoAsset(estado, compendio.hash)?.tipo !== "compendio") {
        return recusa("asset_inexistente", "O arquivo do compêndio não foi registrado.");
      }
      if (JSON.stringify(estado.compendio) === JSON.stringify(compendio)) return aplicado();
      emitir({ tipo: "compendio.alterado", dados: { compendio } });
      return aplicado();
    }

    case "som.lugar": {
      const { grupo, indice, lugar } = intencao.dados;
      if (lugar && metaDoAsset(estado, lugar.hash)?.tipo !== "som") {
        return recusa("asset_inexistente", "Som não encontrado.");
      }
      const antes = lugarDe(estado.mesaDeSom, grupo, indice);
      if (JSON.stringify(antes) === JSON.stringify(lugar)) return aplicado();
      emitir({ tipo: "som.lugarAlterado", dados: { grupo, indice, lugar } });
      // Trocar o arquivo de um ambiente que toca (ou tirá-lo) desliga o ambiente: ele não segue tocando o antigo.
      if (grupo === "ambiente" && antes && lugar?.hash !== antes.hash) {
        const r = ligadoSem(proximo, (a) => a.indice === indice);
        if (r.mudou) emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: r.somLigado } });
      }
      return aplicado();
    }

    case "som.efeito": {
      const { lugar: indice, hash: hashPedido, volume } = intencao.dados;
      const lugar = indice === undefined ? null : lugarDe(estado.mesaDeSom, "efeito", indice);
      if (indice !== undefined && !lugar) {
        return recusa("dados_invalidos", "Este lugar está vazio.");
      }
      const hash = hashPedido ?? lugar?.hash;
      if (hash === undefined || metaDoAsset(estado, hash)?.tipo !== "som") {
        return recusa("asset_inexistente", "Som não encontrado.");
      }
      const base = volume ?? lugar?.volume ?? 0.8;
      emitir({
        tipo: "som.efeitoTocado",
        dados: {
          hash,
          volume: Math.min(1, Math.max(0, base * volumeGeralDe(estado))),
          alvo: { tipo: "todos" },
          ...(indice === undefined ? {} : { lugar: indice }),
        },
      });
      return aplicado();
    }

    case "som.efeitoParar": {
      const { lugar } = intencao.dados;
      emitir({ tipo: "som.efeitoParado", dados: lugar === undefined ? {} : { lugar } });
      return aplicado();
    }

    case "som.ambiente": {
      const { indice, ligado, volume } = intencao.dados;
      const atuais = ambientesLigados(estado);
      const atual = atuais.find((a) => a.indice === indice);
      let novos: AmbienteLigado[];
      if (!ligado) {
        if (!atual) return aplicado();
        novos = atuais.filter((a) => a.indice !== indice);
      } else {
        const lugar = lugarDe(estado.mesaDeSom, "ambiente", indice);
        if (!lugar) return recusa("dados_invalidos", "Este lugar está vazio.");
        if (metaDoAsset(estado, lugar.hash)?.tipo !== "som") {
          return recusa("asset_inexistente", "Som não encontrado.");
        }
        const mesmoSom = atual?.hash === lugar.hash;
        const v = volume ?? (mesmoSom ? atual.volume : lugar.volume);
        // Já tocando: só muda o volume, o ambiente não recomeça.
        if (atual && mesmoSom && atual.volume === v) return aplicado();
        const ambiente: AmbienteLigado =
          atual && mesmoSom
            ? { ...atual, volume: v }
            : { indice, hash: lugar.hash, volume: v, inicioMs: agoraMs, servidorMs: agoraMs };
        novos = [...atuais.filter((a) => a.indice !== indice), ambiente];
      }
      // Q4b: ligar só MARCA o ambiente; ele toca se o transporte já toca (então entra na hora, com o fade).
      const somLigado = somLigadoOuNada({
        volumeGeral: volumeGeralDe(estado),
        ambientes: novos,
        tocando: tocandoAgora(estado),
      });
      emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: somLigado ?? null } });
      return aplicado();
    }

    case "som.transporte": {
      const { tocando } = intencao.dados;
      const marcados = ambientesLigados(estado);
      if (tocando) {
        if (marcados.length === 0) return recusa("dados_invalidos", "Ligue um ou mais ambientes.");
        if (tocandoAgora(estado)) return aplicado();
        // Os ambientes marcados começam juntos, agora.
        const somLigado = somLigadoOuNada({
          volumeGeral: volumeGeralDe(estado),
          ambientes: marcados.map((a) => ({ ...a, inicioMs: agoraMs, servidorMs: agoraMs })),
          tocando: true,
        });
        emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: somLigado ?? null } });
        return aplicado();
      }
      // Parar corta os efeitos que tocam e cala os ambientes, que seguem marcados.
      emitir({ tipo: "som.efeitoParado", dados: {} });
      if (tocandoAgora(estado)) {
        const somLigado = somLigadoOuNada({
          volumeGeral: volumeGeralDe(estado),
          ambientes: marcados,
          tocando: false,
        });
        emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: somLigado ?? null } });
      }
      return aplicado();
    }

    case "som.volumeGeral": {
      const { volume } = intencao.dados;
      if (volumeGeralDe(estado) === volume) return aplicado();
      const somLigado = somLigadoOuNada({
        volumeGeral: volume,
        ambientes: ambientesLigados(estado),
        tocando: tocandoAgora(estado),
      });
      emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: somLigado ?? null } });
      return aplicado();
    }

    case "som.pararTudo": {
      emitir({ tipo: "som.efeitoParado", dados: {} });
      const r = ligadoSem(estado, () => true, false);
      if (r.mudou) {
        emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: r.somLigado } });
      } else if (tocandoAgora(estado)) {
        // Transporte tocando sem nada marcado: para também.
        const somLigado = somLigadoOuNada({
          volumeGeral: volumeGeralDe(estado),
          ambientes: [],
          tocando: false,
        });
        emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: somLigado ?? null } });
      }
      return aplicado();
    }

    case "som.apagar": {
      const { hash } = intencao.dados;
      if (metaDoAsset(estado, hash)?.tipo !== "som") {
        return recusa("asset_inexistente", "Som não encontrado.");
      }
      const usos = usosDoSom(estado, hash);
      // Corta o que toca com este arquivo e tira o som dos lugares, das zonas e das automações.
      emitir({ tipo: "som.efeitoParado", dados: {} });
      const r = ligadoSem(estado, (a) => a.hash === hash);
      if (r.mudou) emitir({ tipo: "som.ligadoAlterado", dados: { somLigado: r.somLigado } });
      for (const u of usos.lugares) {
        emitir({
          tipo: "som.lugarAlterado",
          dados: { grupo: u.grupo, indice: u.indice, lugar: null },
        });
      }
      for (const z of proximo.zonas ?? []) {
        if (z.efeitos.som?.hash !== hash) continue;
        const { som: _som, ...efeitos } = z.efeitos;
        emitir({ tipo: "zona.alterada", dados: { zona: { ...z, efeitos } } });
      }
      const automacoes = proximo.automacoes;
      if (automacoes && usos.automacoes.length > 0) {
        const reacoes = automacoes.reacoes.flatMap((x) => {
          if (!x.fazer.some((a) => a.acao === "som.tocar" && a.hash === hash)) return [x];
          const fazer = x.fazer.filter((a) => !(a.acao === "som.tocar" && a.hash === hash));
          // Sem mais nenhuma ação a reação não tem o que fazer: sai junto.
          return fazer.length === 0 ? [] : [{ ...x, fazer }];
        });
        emitir({ tipo: "automacoes.alterado", dados: { automacoes: { ...automacoes, reacoes } } });
      }
      emitir({ tipo: "asset.removido", dados: { hash } });
      return aplicado();
    }

    case "campanha.exportar":
      return {
        ok: true,
        estado,
        eventos,
        snapshotPara: [],
        exportacao: criarExportacao(estado, agora),
      };

    case "campanha.importar": {
      const lida = lerExportacao(intencao.dados.dados);
      if (!lida.ok) return recusa("importacao_invalida", `Arquivo inválido: ${lida.motivo}`);
      // O `seq` nunca volta: números já enviados não podem ser reaproveitados depois da importação.
      const importado = lida.exportacao.dados;
      const novo: Estado = {
        ...importado,
        seq: Math.max(estado.seq, importado.seq),
        // O relógio da campanha importada começa a contar agora, se não estiver pausado.
        relogio: importado.relogio.pausada
          ? importado.relogio
          : { ...importado.relogio, desdeReal: agoraMs },
      };
      if (!novo.usuarios.some((u) => u.id === usuarioId && u.papel === "mestre")) {
        return recusa(
          "importacao_invalida",
          "Quem importa precisa ser mestre também na campanha importada.",
        );
      }
      return { ok: true, estado: novo, eventos, snapshotPara: "todos" };
    }
  }
}

/** Origem dos eventos que a própria sala gera (o tempo que passa): nenhum cliente a usa. */
const ORIGEM_DO_SISTEMA = { usuarioId: "sistema", idPedido: "tempo" } as const;

/**
 * Intenção INTERNA da sala: o tempo passou. Nunca vem de um cliente (não existe em `IntencaoSchema`,
 * então nenhuma mensagem de navegador a alcança): só o alarme do agendador a chama. Consome o objeto
 * cujo tempo acabou (sai da coleção e libera a mão), tira os modificadores com prazo vencido e,
 * para cada objeto de `marcos` (os que o agendador acordou), reenvia o objeto para atualizar o
 * estágio e o tempo restante na tela. Mesa pausada: nada acontece.
 */
export function processarSistema(
  estado: Estado,
  agora: string,
  marcos: readonly string[] = [],
  /** Os sorteios das automações; a sala usa `crypto`, os testes uma semente. */
  aleatorio: FonteDeAleatoriedade = fonteCrypto(),
): Resultado {
  const agoraMs = Date.parse(agora);
  let proximo = estado;
  const eventos: EventoSala[] = [];
  const emitir = (evento: NovoEvento) => {
    const completo = { ...evento, seq: proximo.seq + 1, origem: ORIGEM_DO_SISTEMA } as EventoSala;
    eventos.push(completo);
    proximo = reduzir(proximo, completo);
  };
  const resultado = (): ResultadoOk => ({ ok: true, estado: proximo, eventos, snapshotPara: [] });
  if (estado.relogio.pausada) return resultado();
  const sala = tempoDaSala(estado.relogio, agoraMs);
  const motor: ContextoDoMotor = { agoraMs, aleatorio, atual: () => proximo, emitir };
  // 7b-1: primeiro as automações (fases dos ciclos, efeitos que vencem, eventos pendentes)...
  rodarAutomacoes(motor);
  const depoisDasAutomacoes = proximo;
  for (const l of depoisDasAutomacoes.luzes) {
    let o = l;
    const vivos = l.modificadores.filter((m) => m.ateSala === undefined || m.ateSala > sala);
    const venceu = vivos.length !== l.modificadores.length;
    if (venceu) {
      o = {
        ...l,
        modificadores: vivos,
        historico: [...l.historico, { emSala: sala, texto: "Modificador de raio venceu" }].slice(
          -40,
        ),
      };
    }
    const restante = restanteDoObjeto(o, sala);
    if (o.estado === "acesa" && restante !== null && restante <= 50) {
      emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
      continue;
    }
    if (venceu || marcos.includes(l.id)) emitir({ tipo: "fonte.editada", dados: { fonte: o } });
  }
  // ...e depois o que o tempo mudou nos objetos (uma tocha que acabou) também é evento de automação.
  if (proximo !== depoisDasAutomacoes) reagirAoSistema(motor, depoisDasAutomacoes);
  return resultado();
}

/**
 * Roda um evento de automação (e o que ele encadeia) sobre o estado e devolve o estado novo e os eventos do
 * protocolo. Pura: os sorteios usam `aleatorio`, o tempo vem do relógio da sala em `agora`. `profundidade` é
 * o nível de encadeamento de onde partir (0 é o normal); passou de 5, o motor corta e anota no registro do mestre.
 */
export function processarEvento(
  estado: Estado,
  evento: EventoDeAutomacao,
  aleatorio: FonteDeAleatoriedade,
  profundidade = 0,
  agora: string = new Date(agoraPadrao(estado)).toISOString(),
): { estado: Estado; eventos: EventoSala[] } {
  let proximo = estado;
  const eventos: EventoSala[] = [];
  rodarEvento(
    {
      agoraMs: Date.parse(agora),
      aleatorio,
      atual: () => proximo,
      emitir: (e) => {
        const completo = { ...e, seq: proximo.seq + 1, origem: ORIGEM_DO_SISTEMA } as EventoSala;
        eventos.push(completo);
        proximo = reduzir(proximo, completo);
      },
    },
    evento,
    profundidade,
  );
  return { estado: proximo, eventos };
}

/**
 * Intenção INTERNA da sala (como `processarSistema`, nenhum cliente a alcança): não sobrou nenhum
 * mestre conectado, então a mesa pausa sozinha, no tempo da sala da hora da saída (`mesa.pausada`, o
 * mesmo evento da pausa manual). Quem chama conta os mestres pelos sockets que sobraram. Com mestre
 * conectado ou com a mesa já pausada, não mexe em nada. Retomar continua sendo só do mestre.
 */
export function pausarSeSemMestre(
  estado: Estado,
  agora: string,
  mestresConectados: number,
): Resultado {
  if (mestresConectados > 0 || estado.relogio.pausada) {
    return { ok: true, estado, eventos: [], snapshotPara: [] };
  }
  const evento = {
    tipo: "mesa.pausada",
    dados: { salaMs: tempoDaSala(estado.relogio, Date.parse(agora)) },
    seq: estado.seq + 1,
    origem: ORIGEM_DO_SISTEMA,
  } as EventoSala;
  return { ok: true, estado: reduzir(estado, evento), eventos: [evento], snapshotPara: "todos" };
}

/** Sem o instante real (testes): o tempo da sala é o acumulado, sem correr. */
function agoraPadrao(estado: Pick<Estado, "relogio">): number {
  return estado.relogio.desdeReal ?? 0;
}

function contextoDeLuz(e: Estado) {
  return {
    tokens: e.tokens,
    personagens: e.personagens,
    pastas: e.pastas,
    pontos: e.pontos,
    cenaAtivaId: e.cenaAtivaId,
  };
}

/**
 * Snapshot filtrado do jogador: sem as metas dos assets; só as exceções dele; só
 * a cena ativa (nada de nome, grid, mapa ou chegada das outras); só tokens visíveis dessa cena; só
 * as paredes da cena ativa (a secreta disfarçada), as pastas que ele vê e só os personagens que ele edita ou que estão numa pasta que ele vê (nome de
 * pasta ou item de pasta "só mestre" nunca chega).
 */
export function visaoPara(estado: Estado, usuario: Visao, agoraMs?: number): Estado {
  const agora = agoraMs ?? agoraPadrao(estado);
  const {
    acendimentos: _pendentes,
    retratosDoChat: _retratos,
    trilha: _trilhaAntiga,
    somLigado: ligadoDaSala,
    ...semTrilha
  } = estado;
  // Q4: os ambientes vão com o relógio da sala de agora (o navegador calcula o desvio e o ponto em que cada um está).
  const semPendencias: Estado = {
    ...semTrilha,
    ...(ligadoDaSala ? { somLigado: ligadoComRelogio(ligadoDaSala, agora) } : {}),
  };
  // O histórico completo mora na sala: aqui só entra o que este usuário pode ver (as últimas 200).
  const chat =
    estado.chat === undefined ? {} : { chat: chatParaUsuario(estado.chat, usuario, estado.config) };
  if (usuario.papel === "mestre") {
    return {
      ...semPendencias,
      ...chat,
      luzes: estado.luzes.map((l) => objetoParaVisao(l, usuario, estado, agora)),
      relogio: relogioParaVisao(estado.relogio, usuario, agora),
    };
  }
  // 7b-1 (regra 7): a fatia de automações NUNCA chega ao jogador; dos efeitos, só os dos tokens que ele
  // controla, sem prazo nem origem.
  const {
    assets: _assets,
    memoriaEsquecida: _esquecida,
    automacoes: _automacoes,
    botoes: _botoes,
    efeitos: _efeitos,
    zonas: _zonas,
    // Q4: nome, ícone e cor dos lugares da mesa de som são do mestre.
    mesaDeSom: _mesaDeSom,
    ...resto
  } = semPendencias;
  // 7b-3: do que o mestre liberou, o jogador recebe só o rótulo de cada botão.
  const botoesDele = estado.automacoes ? botoesParaJogador(estado.automacoes) : [];
  const efeitosDele = efeitosParaJogador(
    estado.efeitos,
    estado.tokens.filter((t) => controlaToken(t, usuario, estado.personagens)),
  );
  const propria = estado.permissoes.porUsuario[usuario.id];
  const { combate: _combate, ...semCombate } = resto;
  return {
    ...semCombate,
    ...chat,
    // A ordem de turno só com as entradas que ele vê; a Destreza e o valor oculto nunca viajam.
    ...(estado.combate ? { combate: combateParaUsuario(estado.combate, usuario, estado) } : {}),
    ...(efeitosDele.length > 0 ? { efeitos: efeitosDele } : {}),
    ...(botoesDele.length > 0 ? { botoes: botoesDele } : {}),
    relogio: relogioParaVisao(estado.relogio, usuario, agora),
    modelos: modelosParaJogador(estado.modelos, estado.config),
    pontos: estado.pontos.filter((p) => pontoVisivelPara(p, usuario, estado.cenaAtivaId)),
    permissoes: {
      jogadores: estado.permissoes.jogadores,
      porUsuario: propria ? { [usuario.id]: propria } : {},
    },
    cenas: [cenaParaJogador(cenaAtiva(estado))],
    tokens: estado.tokens
      .filter((t) => tokenVisivelPara(t, usuario, estado.cenaAtivaId))
      .map((t) => tokenParaUsuario(t, usuario, estado)),
    // V10c: numa cena-cartão as paredes guardadas não chegam ao jogador (não têm efeito).
    paredes: cenaEhCartao(cenaAtiva(estado))
      ? []
      : estado.paredes.filter((p) => p.cenaId === estado.cenaAtivaId).map(paredeParaJogador),
    desenhos: estado.desenhos.filter((d) =>
      desenhoVisivelPara(d.cenaId, usuario, estado.cenaAtivaId),
    ),
    luzes: estado.luzes
      .filter((l) => luzVisivelPara(l, usuario, contextoDeLuz(estado)))
      .map((l) => objetoParaVisao(l, usuario, estado, agora)),
    ...(estado.memoriaEsquecida?.[estado.cenaAtivaId] === undefined
      ? {}
      : {
          memoriaEsquecida: {
            [estado.cenaAtivaId]: estado.memoriaEsquecida[estado.cenaAtivaId] as number,
          },
        }),
    // A pasta chega se ele a vê ou se vê algum handout dentro dela (e só com esses itens).
    pastas: estado.pastas.filter((p) => pastaChegaPara(p, estado.handouts, usuario)),
    handouts: estado.handouts.filter((h) => handoutVisivelPara(h, usuario)),
    // A ficha completa só chega a quem edita o personagem ou tem `ficha.verOutras` (Lote 9).
    personagens: estado.personagens
      .filter((p) => personagemVisivelPara(p, usuario, estado.pastas))
      .map((p) => personagemParaUsuario(p, usuario, estado.permissoes)),
  };
}

/**
 * Filtra um evento para um usuário: `null` quando ele não deve receber. Os eventos de token e de
 * personagem pedem o estado de antes e de depois (para saber se eram e passaram a ser visíveis);
 * sem eles o jogador não recebe nada (falha fechada).
 *
 * Token que deixa de ser visível: vira `token.sumiu { id }`, sem motivo. Que passa a ser visível:
 * vai inteiro (o cliente faz upsert). Que continua invisível: nada. Personagem: mesma ideia, com
 * `personagem.apagado`. Eventos de cena (criar, apagar, o grupo que se move) são só do mestre; o
 * jogador só recebe os da cena ativa (nome, grid, mapa) e, ao mudar de cena, um snapshot novo.
 */
export function eventoPara(
  evento: EventoSala,
  usuario: Visao,
  antes?: Estado,
  depois?: Estado,
  agoraMs?: number,
): EventoSala | null {
  const mestre = usuario.papel === "mestre";
  const agora =
    agoraMs ?? agoraPadrao(depois ?? antes ?? { relogio: { pausada: true, acumuladoMs: 0 } });
  const ativaDepois = (depois ?? antes)?.cenaAtivaId;
  const ativaAntes = (antes ?? depois)?.cenaAtivaId;
  const visivel = (t: Token, ativa: string | undefined) =>
    ativa !== undefined && tokenVisivelPara(t, usuario, ativa);
  // Q10: a vida própria do token de NPC só chega a quem receberia a vida da ficha (sem o estado, falha fechada).
  const comVidaFiltrada = (
    ev: Extract<EventoSala, { tipo: "token.criado" | "token.editado" }>,
    token: Token,
  ): EventoSala => {
    if (token.pv === undefined) return ev;
    const ref = depois ?? antes;
    if (!ref) {
      const { pv: _pv, ...semVida } = token;
      return { ...ev, dados: { token: semVida } };
    }
    const visto = tokenParaUsuario(token, usuario, ref);
    return visto === token ? ev : { ...ev, dados: { token: visto } };
  };
  switch (evento.tipo) {
    case "asset.registrado":
    case "cena.criada":
    case "cena.apagada":
    case "grupo.movido":
      return mestre ? evento : null;
    case "chat.mensagem": {
      if (mestre) return evento;
      // Sem a configuração a função falha fechada: o jogador não recebe o relógio da sala.
      const config = (depois ?? antes)?.config ?? { tempoParaJogadores: "oculto" as const };
      const visto = mensagemParaUsuario(evento.dados.mensagem, usuario, config);
      return visto ? { ...evento, dados: { mensagem: visto } } : null;
    }
    case "som.ligadoAlterado": {
      // Q4: o que toca é de todos; o relógio da sala vai refeito para a hora de agora.
      const s = evento.dados.somLigado;
      return s === null ? evento : { ...evento, dados: { somLigado: ligadoComRelogio(s, agora) } };
    }
    case "som.lugarAlterado":
    case "asset.removido":
      // Nome, ícone e cor dos lugares são do mestre; o jogador não guarda metas de som da mesa.
      return mestre ? evento : null;
    case "som.efeitoParado":
      return evento;
    case "som.efeitoTocado": {
      // N5: só quem ouve recebe, e sempre como "para todos": o jogador não vê a cena nem o token por trás.
      const ref = depois ?? antes;
      if (!ref || !efeitoChegaPara(evento.dados.alvo, usuario, ref)) return null;
      return { ...evento, dados: { ...evento.dados, alvo: { tipo: "todos" } } };
    }
    case "chat.limpo":
    case "compendio.alterado":
    case "papel.alterado":
    case "ordemDeTurno.alterada":
    case "config.alterada":
      return evento;
    case "combate.alterado": {
      if (mestre) return evento;
      const ref = depois ?? antes;
      if (!ref) return null;
      const novo = evento.dados.combate;
      const visto = novo === null ? null : combateParaUsuario(novo, usuario, ref);
      // Mudança que o jogador não percebe (valor de entrada oculta, entrada escondida) nem chega a ele.
      const vistoAntes = antes?.combate ? combateParaUsuario(antes.combate, usuario, antes) : null;
      if (JSON.stringify(vistoAntes) === JSON.stringify(visto)) return null;
      return { ...evento, dados: { combate: visto } };
    }
    case "memoria.esquecida":
      return mestre || evento.dados.cenaId === ativaDepois ? evento : null;
    case "fonte.criada":
    case "fonte.editada": {
      const e = depois ?? antes;
      const fonte = evento.dados.fonte;
      // O objeto chega sempre na forma do navegador: sem `saldoMs` nem `acesaDesdeSala`, com o tempo
      // calculado e filtrado por papel e por `tempoParaJogadores`.
      const paraTela = (o: typeof fonte, ref: Estado | undefined): EventoSala =>
        ref ? { ...evento, dados: { fonte: objetoParaVisao(o, usuario, ref, agora) } } : evento;
      if (mestre) return paraTela(fonte, e);
      if (e && luzVisivelPara(fonte, usuario, contextoDeLuz(e))) return paraTela(fonte, e);
      // Deixou de ser visível (a cena mudou, o token da luz ficou oculto): some, sem motivo.
      const antiga = antes?.luzes.find((l) => l.id === fonte.id);
      if (antiga && antes && luzVisivelPara(antiga, usuario, contextoDeLuz(antes))) {
        return { ...evento, tipo: "fonte.apagada", dados: { id: fonte.id } };
      }
      return null;
    }
    case "fonte.apagada": {
      if (mestre) return evento;
      const antiga = antes?.luzes.find((l) => l.id === evento.dados.id);
      return antiga && antes && luzVisivelPara(antiga, usuario, contextoDeLuz(antes))
        ? evento
        : null;
    }
    case "mesa.pausada":
      return mestre ? evento : { ...evento, dados: { salaMs: 0 } };
    case "mesa.retomada":
      return mestre ? evento : { ...evento, dados: { salaMs: 0 } };
    case "mesa.relogioZerado":
      // V1: o marco é só do mestre; o jogador não recebe nada.
      return mestre ? evento : null;
    case "automacoes.alterado": {
      if (mestre) return evento;
      // 7b-3: o jogador não recebe a fatia; recebe, se mudou, a lista dos botões que o mestre liberou (só os rótulos).
      const novos = botoesParaJogador(evento.dados.automacoes);
      const antigos = antes?.automacoes ? botoesParaJogador(antes.automacoes) : [];
      return JSON.stringify(novos) === JSON.stringify(antigos)
        ? null
        : { ...evento, tipo: "botoes.alterados", dados: { botoes: novos } };
    }
    case "botoes.alterados":
      return mestre ? null : evento;
    case "zona.alterada":
    case "zona.apagada":
      // 7b-1 e 7b-2 (regra 7): a definição das automações e as zonas (forma, nome, efeitos) são só do mestre.
      return mestre ? evento : null;
    case "efeitos.alterados": {
      if (mestre) return evento;
      const ref = depois ?? antes;
      if (!ref) return null;
      const dele = (e: Estado) =>
        efeitosParaJogador(
          e.efeitos,
          e.tokens.filter((t) => controlaToken(t, usuario, e.personagens)),
        );
      const novo = efeitosParaJogador(
        evento.dados.efeitos,
        ref.tokens.filter((t) => controlaToken(t, usuario, ref.personagens)),
      );
      // Mudança que ele não percebe (o efeito era de outro token) nem chega a ele.
      if (antes && JSON.stringify(dele(antes)) === JSON.stringify(novo)) return null;
      return { ...evento, dados: { efeitos: novo } };
    }
    case "modelo.alterado": {
      if (mestre) return evento;
      // 12-1: o modelo em rascunho não chega ao jogador.
      if (evento.dados.modelo.rascunho) return null;
      const cfg = (depois ?? antes)?.config;
      return cfg
        ? {
            ...evento,
            dados: {
              modelo: modelosParaJogador([evento.dados.modelo], cfg)[0] ?? evento.dados.modelo,
            },
          }
        : null;
    }
    case "modelo.apagado": {
      if (mestre) return evento;
      // 12-1: o modelo em rascunho nunca chegou ao jogador: apagá-lo não lhe diz nada.
      const antigo = antes?.modelos.find((m) => m.id === evento.dados.id);
      return antigo?.rascunho ? null : evento;
    }
    case "ponto.alterado": {
      if (mestre) return evento;
      const ponto = evento.dados.ponto;
      const ativa = (depois ?? antes)?.cenaAtivaId;
      if (ativa !== undefined && pontoVisivelPara(ponto, usuario, ativa)) return evento;
      const antigo = antes?.pontos.find((p) => p.id === ponto.id);
      if (antigo && antes && pontoVisivelPara(antigo, usuario, antes.cenaAtivaId)) {
        return { ...evento, tipo: "ponto.apagado", dados: { id: ponto.id } };
      }
      return null;
    }
    case "ponto.apagado": {
      if (mestre) return evento;
      const antigo = antes?.pontos.find((p) => p.id === evento.dados.id);
      return antigo && antes && pontoVisivelPara(antigo, usuario, antes.cenaAtivaId)
        ? evento
        : null;
    }
    case "pasta.alterada": {
      if (mestre) return evento;
      const ref = depois ?? antes;
      const depoisP = ref?.pastas.find((p) => p.id === evento.dados.pasta.id);
      if (depoisP && ref && pastaChegaPara(depoisP, ref.handouts, usuario)) return evento;
      const antiga = antes?.pastas.find((p) => p.id === evento.dados.pasta.id);
      if (antiga && antes && pastaChegaPara(antiga, antes.handouts, usuario)) {
        return { ...evento, tipo: "pasta.apagada", dados: { id: antiga.id } };
      }
      return null;
    }
    case "pasta.apagada": {
      if (mestre) return evento;
      const antiga = antes?.pastas.find((p) => p.id === evento.dados.id);
      return antiga && antes && pastaChegaPara(antiga, antes.handouts, usuario) ? evento : null;
    }
    case "handout.alterado": {
      if (mestre) return evento;
      if (handoutVisivelPara(evento.dados.handout, usuario)) return evento;
      // Deixou de ser visível (o mestre o escondeu): some, sem motivo; quem nunca o viu não recebe nada.
      const antigo = antes?.handouts.find((h) => h.id === evento.dados.handout.id);
      if (antigo && handoutVisivelPara(antigo, usuario)) {
        return { ...evento, tipo: "handout.apagado", dados: { id: antigo.id } };
      }
      return null;
    }
    case "handout.apagado": {
      if (mestre) return evento;
      const antigo = antes?.handouts.find((h) => h.id === evento.dados.id);
      return antigo && handoutVisivelPara(antigo, usuario) ? evento : null;
    }
    case "handout.mostrado": {
      if (mestre) return evento;
      const h = (depois ?? antes)?.handouts.find((x) => x.id === evento.dados.id);
      return h && handoutVisivelPara(h, usuario) ? evento : null;
    }
    case "permissao.alterada":
      if (evento.dados.usuarioId === undefined) return evento;
      return mestre || evento.dados.usuarioId === usuario.id ? evento : null;
    case "cena.editada":
      if (mestre) return evento;
      return evento.dados.cena.id === ativaDepois
        ? { ...evento, dados: { cena: cenaParaJogador(evento.dados.cena) } }
        : null;
    case "nevoa.tracada":
    case "nevoa.desfeita":
      // N4: a névoa manual não é segredo; o jogador recebe a da cena em que o grupo está.
      return mestre || evento.dados.cenaId === ativaDepois ? evento : null;
    case "cena.gridAlterado":
    case "cena.mapaAlterado":
      return mestre || evento.dados.cenaId === ativaDepois ? evento : null;
    case "token.criado":
      if (mestre) return evento;
      return visivel(evento.dados.token, ativaDepois)
        ? comVidaFiltrada(evento, evento.dados.token)
        : null;
    case "token.editado": {
      if (mestre) return evento;
      if (visivel(evento.dados.token, ativaDepois)) {
        return comVidaFiltrada(evento, evento.dados.token);
      }
      const antigo = antes?.tokens.find((t) => t.id === evento.dados.token.id);
      if (antigo && visivel(antigo, ativaAntes)) {
        return { ...evento, tipo: "token.sumiu", dados: { id: antigo.id } };
      }
      return null;
    }
    case "token.apagado": {
      if (mestre) return evento;
      const antigo = antes?.tokens.find((t) => t.id === evento.dados.id);
      return antigo && visivel(antigo, ativaAntes) ? evento : null;
    }
    case "token.movido": {
      if (mestre) return evento;
      const token = (depois ?? antes)?.tokens.find((t) => t.id === evento.dados.id);
      return token && visivel(token, ativaDepois) ? evento : null;
    }
    case "token.sumiu":
      return mestre ? null : evento;
    case "parede.criada":
    case "parede.editada": {
      if (mestre) return evento;
      const parede = evento.dados.parede;
      if (parede.cenaId !== ativaDepois) return null;
      if (cenaEhCartao((depois ?? antes)?.cenas.find((c) => c.id === parede.cenaId))) return null;
      const nova = paredeParaJogador(parede);
      const antiga = antes?.paredes.find((p) => p.id === parede.id);
      // Mudança que o jogador não percebe (trancar ou destrancar a secreta) nem chega a ele.
      if (antiga && JSON.stringify(paredeParaJogador(antiga)) === JSON.stringify(nova)) return null;
      return { ...evento, dados: { parede: nova } };
    }
    case "parede.apagada": {
      if (mestre) return evento;
      const antiga = antes?.paredes.find((p) => p.id === evento.dados.id);
      if (!antiga || antiga.cenaId !== ativaAntes) return null;
      if (cenaEhCartao(antes?.cenas.find((c) => c.id === antiga.cenaId))) return null;
      return evento;
    }
    case "desenho.criado":
      return mestre || desenhoVisivelPara(evento.dados.desenho.cenaId, usuario, ativaDepois)
        ? evento
        : null;
    case "desenho.movido": {
      if (mestre) return evento;
      const d = (depois ?? antes)?.desenhos.find((x) => x.id === evento.dados.id);
      return d && desenhoVisivelPara(d.cenaId, usuario, ativaDepois) ? evento : null;
    }
    case "desenho.apagado": {
      if (mestre) return evento;
      const d = antes?.desenhos.find((x) => x.id === evento.dados.id);
      return d && desenhoVisivelPara(d.cenaId, usuario, ativaAntes) ? evento : null;
    }
    case "desenho.limpo":
      return mestre || desenhoVisivelPara(evento.dados.cenaId, usuario, ativaDepois)
        ? evento
        : null;
    case "personagem.alterado": {
      if (mestre) return evento;
      const ref = depois ?? antes;
      const pastas = ref?.pastas;
      if (!pastas || !ref) return null;
      const nova = evento.dados.personagem;
      const antigo = antes?.personagens.find((p) => p.id === nova.id);
      if (personagemVisivelPara(nova, usuario, pastas)) {
        // A ficha só vai a quem a vê; quem não vê recebe o item sem ela e só se isso mudou.
        const visto = personagemParaUsuario(nova, usuario, ref.permissoes);
        if (antes && antigo && personagemVisivelPara(antigo, usuario, antes.pastas)) {
          const vistoAntes = personagemParaUsuario(antigo, usuario, antes.permissoes);
          if (JSON.stringify(vistoAntes) === JSON.stringify(visto)) return null;
        }
        return visto === nova ? evento : { ...evento, dados: { personagem: visto } };
      }
      if (antigo && personagemVisivelPara(antigo, usuario, antes?.pastas ?? pastas)) {
        return { ...evento, tipo: "personagem.apagado", dados: { id: antigo.id } };
      }
      return null;
    }
    case "personagem.apagado": {
      if (mestre) return evento;
      const antigo = antes?.personagens.find((p) => p.id === evento.dados.id);
      return antigo && antes && personagemVisivelPara(antigo, usuario, antes.pastas)
        ? evento
        : null;
    }
  }
}
