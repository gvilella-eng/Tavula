import {
  type AssetMeta,
  hashesPreparaveis,
  hashesUsados,
  LIMITES_DE_ASSET,
  PX_POR_QUADRADO_PADRAO,
  tamanhoDaCenaComMapa,
  validarMeta,
} from "./assets.ts";
import { ehCapacidadeDelegavel, pode } from "./capacidades.ts";
import type {
  Cena,
  Estado,
  FonteDeLuz,
  Parede,
  Pasta,
  Personagem,
  Token,
  Usuario,
} from "./estado.ts";
import { fatorDeLuzDa, luzAmbienteDa, luzVisivelPara } from "./luz.ts";
import {
  arrumarNoGrid,
  CENA_PADRAO,
  chegadaDaCena,
  controlaToken,
  ehPersonagemDeJogador,
  encaixarNoGrid,
  limitarNaCena,
  pastaVisivelPara,
  personagemVisivelPara,
  podeEditarPersonagem,
  podeMoverToken,
  tokenVisivelPara,
} from "./mapa.ts";
import {
  ALCANCE_INTERACAO_PADRAO_M,
  alternarPortaDoJogador,
  alternarPortaDoMestre,
  iluminacaoDinamicaLigada,
  paredeParaJogador,
  trajetoBloqueado,
} from "./paredes.ts";
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

export type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };

export type Resultado =
  | {
      ok: true;
      estado: Estado;
      eventos: EventoSala[];
      /** Quem deve receber um snapshot novo (em vez do evento, no caso de quem mudou de papel). */
      snapshotPara: "todos" | string[];
      /** Preenchido por `campanha.exportar`: vai só para quem pediu. */
      exportacao?: Exportacao;
      /** Preenchido por `token.mover` (transitório): a sala repassa a quem pode ver o token. */
      movendo?: { id: string; x: number; y: number };
      /** Preenchido por `cena.preparar`: a sala guarda os pacotes (chaves só dela e do mestre). */
      preparo?: { cenaId: string; pacotes: Pacote[] };
      /** Preenchido por `grupo.moverPara`: a sala entrega as chaves do preparo antes do snapshot. */
      grupoMovido?: { cenaId: string };
    }
  | { ok: false; erro: ErroDaSala };

type ResultadoOk = Extract<Resultado, { ok: true }>;
type Visao = Pick<Usuario, "id" | "papel">;
type NovoEvento = EventoSala extends infer E
  ? E extends unknown
    ? Omit<E, "seq" | "origem">
    : never
  : never;

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
  return p.ficha.pvAtual > p.ficha.pvMax
    ? { ...p, ficha: { ...p.ficha, pvAtual: p.ficha.pvMax } }
    : p;
}

function personagemDe(estado: Estado, id: string): Personagem | undefined {
  return estado.personagens.find((p) => p.id === id);
}

function pastaDe(estado: Pick<Estado, "pastas">, id: string): Pasta | undefined {
  return estado.pastas.find((p) => p.id === id);
}

const SEM_PASTA = "Pasta não encontrada.";

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

function imagemDeTokenExiste(estado: Estado, hash: string): boolean {
  const tipo = metaDoAsset(estado, hash)?.tipo;
  return tipo === "token" || tipo === "retrato";
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

/** Só os metadados dos assets que a campanha usa (mapas, imagens de tokens e tiles): nunca bytes. */
export function criarExportacao(estado: Estado, agora: string): Exportacao {
  const usados = hashesUsados(estado);
  // A memória esquecida é dado da sessão, não da campanha.
  const { memoriaEsquecida: _sessao, ...campanha } = estado;
  return {
    formato: "tabletop-campanha",
    versao: VERSAO_EXPORTACAO,
    exportadoEm: agora,
    dados: {
      ...campanha,
      notaMestre: estado.notaMestre ?? "",
      assets: (estado.assets ?? []).filter((a) => usados.has(a.hash)),
    },
  };
}

/**
 * Valida um arquivo de exportação (de v1 a v7; o resultado é sempre v7): formato, ids únicos, pelo
 * menos um mestre, exceções válidas, cena ativa, pastas, personagens e tokens coerentes.
 */
export function lerExportacao(
  bruto: unknown,
): { ok: true; exportacao: Exportacao } | { ok: false; motivo: string } {
  const r = ExportacaoSchema.safeParse(bruto);
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
    paredes,
    luzes,
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
  for (const l of luzes) {
    if (!idsDeCenas.has(l.cenaId)) {
      return { ok: false, motivo: `fonte de luz em cena desconhecida: ${l.id}` };
    }
    if (l.portador.tipo === "token") {
      const id = l.portador.tokenId;
      if (!tokens.some((t) => t.id === id && t.cenaId === l.cenaId)) {
        return { ok: false, motivo: `fonte de luz presa a token inexistente: ${l.id}` };
      }
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
  const porHash = new Map(assets.map((a) => [a.hash, a]));
  if (porHash.size !== assets.length) return { ok: false, motivo: "hashes de asset repetidos" };
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
  for (const p of personagens) {
    if (p.tokenPadrao.assetHash !== undefined && !porHash.has(p.tokenPadrao.assetHash)) {
      return { ok: false, motivo: `imagem sem meta no personagem ${p.id}` };
    }
    if (p.retratoHash !== undefined && !porHash.has(p.retratoHash)) {
      return { ok: false, motivo: `retrato sem meta no personagem ${p.id}` };
    }
  }
  return { ok: true, exportacao: r.data };
}

/**
 * Aplica um evento ao estado. Usada pela sala e pelo cliente: os dois lados nunca divergem.
 * Evento com `seq` antigo (já refletido no estado) é ignorado.
 */
export function reduzir(estado: Estado, evento: EventoSala): Estado {
  if (evento.seq <= estado.seq) return estado;
  const base = { ...estado, seq: evento.seq };
  switch (evento.tipo) {
    case "nota.alterada":
      return { ...base, notaMesa: evento.dados.texto };
    case "notaMestre.alterada":
      return { ...base, notaMestre: evento.dados.texto };
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
    case "cena.apagada":
      return { ...base, cenas: base.cenas.filter((c) => c.id !== evento.dados.cenaId) };
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
    case "ordemDeTurno.alterada":
      return { ...base, ordemDeTurnoVisivel: evento.dados.visivel };
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
  portador: FonteDeLuz["portador"],
): FonteDeLuz["portador"] | undefined {
  if (portador.tipo === "cena") return { tipo: "cena", ...limitarNaCena(portador, cena) };
  const id = portador.tokenId;
  return estado.tokens.some((t) => t.id === id && t.cenaId === cena.id) ? portador : undefined;
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
): Resultado {
  const usuario = estado.usuarios.find((u) => u.id === usuarioId);
  if (!usuario) return recusa("usuario_inexistente", "Usuário desconhecido.");

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
    const completo = { ...evento, seq: proximo.seq + 1, origem } as EventoSala;
    eventos.push(completo);
    proximo = reduzir(proximo, completo);
  };
  const aplicado = (snapshotPara: string[] | "todos" = []): ResultadoOk => ({
    ok: true,
    estado: proximo,
    eventos,
    snapshotPara,
  });

  switch (intencao.tipo) {
    case "nota.editar":
      emitir({ tipo: "nota.alterada", dados: { texto: intencao.dados.texto } });
      return aplicado();

    case "notaMestre.editar":
      emitir({ tipo: "notaMestre.alterada", dados: { texto: intencao.dados.texto } });
      return aplicado();

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
      return aplicado();
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
      const token: Token = { ...novo, ...limitarNaCena(novo, cena), cenaId: cena.id };
      emitir({ tipo: "token.criado", dados: { token } });
      return aplicado();
    }

    case "token.editar": {
      const atual = estado.tokens.find((t) => t.id === intencao.dados.id);
      if (!atual) return recusa("token_inexistente", "Token não encontrado.");
      const mudancas = intencao.dados.mudancas;
      if (mudancas.controladoPor && !usuariosExistem(estado, mudancas.controladoPor)) {
        return recusa("usuario_inexistente", "Usuário de controle não encontrado.");
      }
      const { assetHash, alcanceVisaoM, visaoNoEscuroM, ...demais } = mudancas;
      const token: Token = { ...atual, ...semIndefinidos(demais) };
      if (alcanceVisaoM === null) delete token.alcanceVisaoM;
      else if (alcanceVisaoM !== undefined) token.alcanceVisaoM = alcanceVisaoM;
      if (visaoNoEscuroM === null) delete token.visaoNoEscuroM;
      else if (visaoNoEscuroM !== undefined) token.visaoNoEscuroM = visaoNoEscuroM;
      if (assetHash === null) delete token.assetHash;
      else if (assetHash !== undefined) {
        if (!imagemDeTokenExiste(estado, assetHash)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
        token.assetHash = assetHash;
      }
      if (JSON.stringify(token) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "token.editado", dados: { token } });
      // Esconder (ou mostrar) um token que carrega luz muda o que os jogadores recebem da luz dele:
      // snapshot novo (o filtro de evento só cuida de um evento por vez).
      const aparenciaMudou =
        tokenVisivelPara(atual, JOGADOR_QUALQUER, estado.cenaAtivaId) !==
        tokenVisivelPara(token, JOGADOR_QUALQUER, estado.cenaAtivaId);
      return aplicado(aparenciaMudou && luzesDoToken(estado, token.id).length > 0 ? "todos" : []);
    }

    case "token.apagar": {
      if (!estado.tokens.some((t) => t.id === intencao.dados.id)) {
        return recusa("token_inexistente", "Token não encontrado.");
      }
      for (const l of luzesDoToken(estado, intencao.dados.id)) {
        emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
      }
      emitir({ tipo: "token.apagado", dados: { id: intencao.dados.id } });
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
          (m.tipo === "mapa" || m.tipo === "tile" || m.tipo === "cifrado")
        ) {
          return recusa("sem_permissao", "Só o mestre registra mapas e arquivos cifrados.");
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
      const p = limitarPv(intencao.dados.personagem);
      if (personagemDe(estado, p.id)) {
        return recusa("dados_invalidos", "Já existe um personagem com esse id.");
      }
      if (!pastaDe(estado, p.pastaId)) return recusa("pasta_inexistente", SEM_PASTA);
      if (!editoresValidos(estado, p.editores)) {
        return recusa("usuario_inexistente", "Editor não encontrado (precisa ser um jogador).");
      }
      for (const h of [p.tokenPadrao.assetHash, p.retratoHash]) {
        if (h !== undefined && !imagemDeTokenExiste(estado, h)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
      }
      emitir({ tipo: "personagem.alterado", dados: { personagem: p } });
      return aplicado();
    }

    case "personagem.editar": {
      const atual = personagemDe(estado, intencao.dados.id);
      // Personagem que não vejo responde igual a personagem inexistente.
      if (!atual || !personagemVisivelPara(atual, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      const m = intencao.dados.mudancas;
      if (usuario.papel !== "mestre") {
        // Quem edita (jogador) troca só as imagens, e precisa poder subir arquivos.
        if (!podeEditarPersonagem(atual, usuario)) {
          return recusa("sem_permissao", "Você não edita este personagem.");
        }
        if (Object.keys(semIndefinidos(m)).some((k) => k !== "assetHash" && k !== "retratoHash")) {
          return recusa("sem_permissao", "Só o mestre muda isso.");
        }
        if (!pode(usuario, "asset.subir", estado.permissoes)) {
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
      const tokenPadrao = {
        cor: m.cor ?? atual.tokenPadrao.cor,
        tamanhoQuadrados: m.tamanhoQuadrados ?? atual.tokenPadrao.tamanhoQuadrados,
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
        ficha: { pvAtual: m.pvAtual ?? atual.ficha.pvAtual, pvMax: m.pvMax ?? atual.ficha.pvMax },
        ...(m.modInteligencia === undefined ? {} : { modInteligencia: m.modInteligencia }),
      });
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
      return aplicado();
    }

    case "ficha.alterar": {
      const { personagemId, pvAtual, pvMax } = intencao.dados;
      const atual = personagemDe(estado, personagemId);
      // Personagem que não vejo responde igual a personagem inexistente (NPC nunca aparece).
      if (!atual || !personagemVisivelPara(atual, usuario, estado.pastas)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (!podeEditarPersonagem(atual, usuario)) {
        return recusa("sem_permissao", "Você não edita esta ficha.");
      }
      const personagem = limitarPv({
        ...atual,
        ficha: { pvAtual: pvAtual ?? atual.ficha.pvAtual, pvMax: pvMax ?? atual.ficha.pvMax },
      });
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
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
      if (estado.personagens.some((p) => p.pastaId === id)) {
        return recusa("dados_invalidos", "Só uma pasta vazia pode ser apagada.");
      }
      emitir({ tipo: "pasta.apagada", dados: { id } });
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
      if (!personagemDe(estado, id)) return recusa("personagem_inexistente", SEM_PERSONAGEM);
      for (const t of estado.tokens.filter((x) => x.personagemId === id)) {
        for (const l of luzesDoToken(estado, t.id)) {
          emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
        }
        emitir({ tipo: "token.apagado", dados: { id: t.id } });
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
      if (ehPersonagemDeJogador(p) && estado.tokens.some((t) => t.personagemId === p.id)) {
        return recusa(
          "dados_invalidos",
          "Este personagem já tem um token (o grupo leva o token junto).",
        );
      }
      const base =
        x !== undefined && y !== undefined
          ? { x, y }
          : encaixarNoGrid(
              chegadaDaCena(cena),
              p.tokenPadrao.tamanhoQuadrados,
              cena.grid.quadradoM,
            );
      const token: Token = {
        id: tokenId,
        cenaId: cena.id,
        nome: p.nome,
        cor: p.tokenPadrao.cor,
        tamanhoQuadrados: p.tokenPadrao.tamanhoQuadrados,
        ...limitarNaCena(base, cena),
        camada: "tokens",
        oculto: false,
        controladoPor: [],
        personagemId: p.id,
        ...(p.tokenPadrao.assetHash === undefined ? {} : { assetHash: p.tokenPadrao.assetHash }),
      };
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
      const { cenaId, nome, chegada } = intencao.dados;
      const atual = estado.cenas.find((c) => c.id === cenaId);
      if (!atual) return recusa("cena_inexistente", SEM_CENA);
      const { chegada: _antiga, ...semChegada } = atual;
      const nova = chegada === undefined ? atual.chegada : (chegada ?? undefined);
      const cena: Cena = {
        ...semChegada,
        nome: nome ?? atual.nome,
        ...(nova ? { chegada: limitarNaCena(nova, atual) } : {}),
      };
      if (JSON.stringify(cena) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "cena.editada", dados: { cena } });
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
      estado.paredes
        .filter((p) => p.cenaId === cenaId)
        .forEach((p, i) => {
          const parede: Parede = { ...p, id: `${novoId.slice(0, 50)}-p${i + 1}`, cenaId: novoId };
          emitir({ tipo: "parede.criada", dados: { parede } });
        });
      // As luzes fixas vão para a cena nova; as presas a token seguem o token copiado.
      const novoDe = new Map(copiados.map((t, i) => [t.id, novos[i]?.id ?? ""]));
      estado.luzes
        .filter((l) => l.cenaId === cenaId)
        .forEach((l, i) => {
          const portador =
            l.portador.tipo === "cena"
              ? l.portador
              : { tipo: "token" as const, tokenId: novoDe.get(l.portador.tokenId) ?? "" };
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

    case "cena.apagar": {
      const { cenaId } = intencao.dados;
      if (!estado.cenas.some((c) => c.id === cenaId)) return recusa("cena_inexistente", SEM_CENA);
      if (cenaId === estado.cenaAtivaId) {
        return recusa("dados_invalidos", "A cena onde está o grupo não pode ser apagada.");
      }
      for (const t of estado.tokens.filter((x) => x.cenaId === cenaId)) {
        emitir({ tipo: "token.apagado", dados: { id: t.id } });
      }
      for (const p of estado.paredes.filter((x) => x.cenaId === cenaId)) {
        emitir({ tipo: "parede.apagada", dados: { id: p.id } });
      }
      for (const l of estado.luzes.filter((x) => x.cenaId === cenaId)) {
        emitir({ tipo: "fonte.apagada", dados: { id: l.id } });
      }
      emitir({ tipo: "cena.apagada", dados: { cenaId } });
      return aplicado();
    }

    case "grupo.moverPara": {
      const destino = estado.cenas.find((c) => c.id === intencao.dados.cenaId);
      if (!destino) return recusa("cena_inexistente", SEM_CENA);
      if (destino.id === estado.cenaAtivaId) return aplicado();
      // O grupo: tokens de personagens de jogador que estão na cena ativa. Os de NPC ficam.
      const grupo = estado.tokens.filter(
        (t) => t.cenaId === estado.cenaAtivaId && ehDoGrupo(estado, t),
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
        novas.push({
          id: n.id,
          cenaId: cena.id,
          a,
          b,
          tipo: n.tipo,
          ...estadoDaParede(n.tipo, n.estado),
        });
      }
      for (const parede of novas) emitir({ tipo: "parede.criada", dados: { parede } });
      return aplicado();
    }

    case "parede.editar": {
      const { id, a, b, tipo, estado: novoEstado } = intencao.dados;
      const atual = estado.paredes.find((p) => p.id === id);
      if (!atual) return recusa("parede_inexistente", "Parede não encontrada.");
      const cena = estado.cenas.find((c) => c.id === atual.cenaId) ?? cenaAtiva(estado);
      const novoTipo = tipo ?? atual.tipo;
      const parede: Parede = {
        id: atual.id,
        cenaId: atual.cenaId,
        a: a ? limitarNaCena(a, cena) : atual.a,
        b: b ? limitarNaCena(b, cena) : atual.b,
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
      emitir({ tipo: "fonte.criada", dados: { fonte: { ...n, cenaId: cena.id, portador } } });
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
      const fonte: FonteDeLuz = {
        ...atual,
        nome: m.nome ?? atual.nome,
        portador,
        luz: { ...atual.luz, ...semIndefinidos(m.luz ?? {}) },
        intensidade: m.intensidade ?? atual.intensidade,
        acesa: m.acesa ?? atual.acesa,
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
      const novo: Estado = {
        ...lida.exportacao.dados,
        seq: Math.max(estado.seq, lida.exportacao.dados.seq),
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

/**
 * Snapshot filtrado do jogador: sem `notaMestre` e sem as metas dos assets; só as exceções dele; só
 * a cena ativa (nada de nome, grid, mapa ou chegada das outras); só tokens visíveis dessa cena; só
 * as paredes da cena ativa (a secreta disfarçada), as pastas que ele vê e só os personagens que ele edita ou que estão numa pasta que ele vê (nome de
 * pasta ou item de pasta "só mestre" nunca chega).
 */
export function visaoPara(estado: Estado, usuario: Visao): Estado {
  if (usuario.papel === "mestre") return estado;
  const { notaMestre: _oculta, assets: _assets, memoriaEsquecida: _esquecida, ...resto } = estado;
  const propria = estado.permissoes.porUsuario[usuario.id];
  return {
    ...resto,
    permissoes: {
      jogadores: estado.permissoes.jogadores,
      porUsuario: propria ? { [usuario.id]: propria } : {},
    },
    cenas: [cenaAtiva(estado)],
    tokens: estado.tokens.filter((t) => tokenVisivelPara(t, usuario, estado.cenaAtivaId)),
    paredes: estado.paredes.filter((p) => p.cenaId === estado.cenaAtivaId).map(paredeParaJogador),
    luzes: estado.luzes.filter((l) =>
      luzVisivelPara(l, usuario, estado.tokens, estado.cenaAtivaId),
    ),
    ...(estado.memoriaEsquecida?.[estado.cenaAtivaId] === undefined
      ? {}
      : {
          memoriaEsquecida: {
            [estado.cenaAtivaId]: estado.memoriaEsquecida[estado.cenaAtivaId] as number,
          },
        }),
    pastas: estado.pastas.filter((p) => pastaVisivelPara(p, usuario)),
    personagens: estado.personagens.filter((p) => personagemVisivelPara(p, usuario, estado.pastas)),
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
): EventoSala | null {
  const mestre = usuario.papel === "mestre";
  const ativaDepois = (depois ?? antes)?.cenaAtivaId;
  const ativaAntes = (antes ?? depois)?.cenaAtivaId;
  const visivel = (t: Token, ativa: string | undefined) =>
    ativa !== undefined && tokenVisivelPara(t, usuario, ativa);
  switch (evento.tipo) {
    case "notaMestre.alterada":
    case "asset.registrado":
    case "cena.criada":
    case "cena.apagada":
    case "grupo.movido":
      return mestre ? evento : null;
    case "nota.alterada":
    case "papel.alterado":
    case "ordemDeTurno.alterada":
    case "config.alterada":
      return evento;
    case "memoria.esquecida":
      return mestre || evento.dados.cenaId === ativaDepois ? evento : null;
    case "fonte.criada":
    case "fonte.editada": {
      if (mestre) return evento;
      const e = depois ?? antes;
      const fonte = evento.dados.fonte;
      if (e && luzVisivelPara(fonte, usuario, e.tokens, e.cenaAtivaId)) return evento;
      // Deixou de ser visível (a cena mudou, o token da luz ficou oculto): some, sem motivo.
      const antiga = antes?.luzes.find((l) => l.id === fonte.id);
      if (antiga && antes && luzVisivelPara(antiga, usuario, antes.tokens, antes.cenaAtivaId)) {
        return { ...evento, tipo: "fonte.apagada", dados: { id: fonte.id } };
      }
      return null;
    }
    case "fonte.apagada": {
      if (mestre) return evento;
      const antiga = antes?.luzes.find((l) => l.id === evento.dados.id);
      return antiga && antes && luzVisivelPara(antiga, usuario, antes.tokens, antes.cenaAtivaId)
        ? evento
        : null;
    }
    case "pasta.alterada": {
      if (mestre) return evento;
      const depoisP = (depois ?? antes)?.pastas.find((p) => p.id === evento.dados.pasta.id);
      if (depoisP && pastaVisivelPara(depoisP, usuario)) return evento;
      const antiga = antes?.pastas.find((p) => p.id === evento.dados.pasta.id);
      if (antiga && pastaVisivelPara(antiga, usuario)) {
        return { ...evento, tipo: "pasta.apagada", dados: { id: antiga.id } };
      }
      return null;
    }
    case "pasta.apagada": {
      if (mestre) return evento;
      const antiga = antes?.pastas.find((p) => p.id === evento.dados.id);
      return antiga && pastaVisivelPara(antiga, usuario) ? evento : null;
    }
    case "permissao.alterada":
      if (evento.dados.usuarioId === undefined) return evento;
      return mestre || evento.dados.usuarioId === usuario.id ? evento : null;
    case "cena.editada":
      return mestre || evento.dados.cena.id === ativaDepois ? evento : null;
    case "cena.gridAlterado":
    case "cena.mapaAlterado":
      return mestre || evento.dados.cenaId === ativaDepois ? evento : null;
    case "token.criado":
      return mestre || visivel(evento.dados.token, ativaDepois) ? evento : null;
    case "token.editado": {
      if (mestre || visivel(evento.dados.token, ativaDepois)) return evento;
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
      const nova = paredeParaJogador(parede);
      const antiga = antes?.paredes.find((p) => p.id === parede.id);
      // Mudança que o jogador não percebe (trancar ou destrancar a secreta) nem chega a ele.
      if (antiga && JSON.stringify(paredeParaJogador(antiga)) === JSON.stringify(nova)) return null;
      return { ...evento, dados: { parede: nova } };
    }
    case "parede.apagada": {
      if (mestre) return evento;
      const antiga = antes?.paredes.find((p) => p.id === evento.dados.id);
      return antiga && antiga.cenaId === ativaAntes ? evento : null;
    }
    case "personagem.alterado": {
      if (mestre) return evento;
      const pastas = (depois ?? antes)?.pastas;
      if (!pastas) return null;
      if (personagemVisivelPara(evento.dados.personagem, usuario, pastas)) return evento;
      const antigo = antes?.personagens.find((p) => p.id === evento.dados.personagem.id);
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
