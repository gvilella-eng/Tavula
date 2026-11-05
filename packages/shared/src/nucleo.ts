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
import type { Cena, Estado, Personagem, Token, Usuario } from "./estado.ts";
import {
  arrumarNoGrid,
  CENA_PADRAO,
  chegadaDaCena,
  controlaToken,
  encaixarNoGrid,
  limitarNaCena,
  personagemVisivelPara,
  podeMoverToken,
  tokenVisivelPara,
} from "./mapa.ts";
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

function totalDeMestres(estado: Estado): number {
  return estado.usuarios.filter((u) => u.papel === "mestre").length;
}

/** Só os metadados dos assets que a campanha usa (mapas, imagens de tokens e tiles): nunca bytes. */
export function criarExportacao(estado: Estado, agora: string): Exportacao {
  const usados = hashesUsados(estado);
  return {
    formato: "tabletop-campanha",
    versao: VERSAO_EXPORTACAO,
    exportadoEm: agora,
    dados: {
      ...estado,
      notaMestre: estado.notaMestre ?? "",
      assets: (estado.assets ?? []).filter((a) => usados.has(a.hash)),
    },
  };
}

/**
 * Valida um arquivo de exportação (de v1 a v4; o resultado é sempre v4): formato, ids únicos, pelo
 * menos um mestre, exceções válidas, cena ativa, personagens e tokens coerentes.
 */
export function lerExportacao(
  bruto: unknown,
): { ok: true; exportacao: Exportacao } | { ok: false; motivo: string } {
  const r = ExportacaoSchema.safeParse(bruto);
  if (!r.success) {
    const problema = r.error.issues[0];
    return { ok: false, motivo: `${problema?.path.join(".") ?? ""}: ${problema?.message ?? ""}` };
  }
  const { usuarios, permissoes, cenas, cenaAtivaId, tokens, assets, personagens } = r.data.dados;
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
  const idsDePersonagens = new Set(personagens.map((p) => p.id));
  if (idsDePersonagens.size !== personagens.length) {
    return { ok: false, motivo: "ids de personagem repetidos" };
  }
  for (const p of personagens) {
    if (p.donoId !== null && !ids.has(p.donoId)) {
      return { ok: false, motivo: `personagem de usuário desconhecido: ${p.id}` };
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
        tokens: base.tokens.map((t) => {
          const p = posicoes.get(t.id);
          return p ? { ...t, cenaId, x: p.x, y: p.y } : t;
        }),
      };
    }
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
      // Ver a ficha dos outros muda o que cada jogador pode ter: snapshot novo em vez de remendar.
      if (capacidade === "ficha.verOutras")
        return aplicado(alvoId === undefined ? "todos" : [alvoId]);
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
      const { assetHash, ...demais } = mudancas;
      const token: Token = { ...atual, ...semIndefinidos(demais) };
      if (assetHash === null) delete token.assetHash;
      else if (assetHash !== undefined) {
        if (!imagemDeTokenExiste(estado, assetHash)) {
          return recusa("asset_inexistente", "Imagem não encontrada.");
        }
        token.assetHash = assetHash;
      }
      if (JSON.stringify(token) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "token.editado", dados: { token } });
      return aplicado();
    }

    case "token.apagar": {
      if (!estado.tokens.some((t) => t.id === intencao.dados.id)) {
        return recusa("token_inexistente", "Token não encontrado.");
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
      if (p.donoId !== null && !ehJogador(estado, p.donoId)) {
        return recusa("usuario_inexistente", "Dono não encontrado (precisa ser um jogador).");
      }
      if (
        p.tokenPadrao.assetHash !== undefined &&
        !imagemDeTokenExiste(estado, p.tokenPadrao.assetHash)
      ) {
        return recusa("asset_inexistente", "Imagem não encontrada.");
      }
      emitir({ tipo: "personagem.alterado", dados: { personagem: p } });
      return aplicado();
    }

    case "personagem.editar": {
      const atual = personagemDe(estado, intencao.dados.id);
      if (!atual) return recusa("personagem_inexistente", SEM_PERSONAGEM);
      const m = intencao.dados.mudancas;
      if (m.donoId !== undefined && m.donoId !== null && !ehJogador(estado, m.donoId)) {
        return recusa("usuario_inexistente", "Dono não encontrado (precisa ser um jogador).");
      }
      if (typeof m.assetHash === "string" && !imagemDeTokenExiste(estado, m.assetHash)) {
        return recusa("asset_inexistente", "Imagem não encontrada.");
      }
      const tokenPadrao = {
        cor: m.cor ?? atual.tokenPadrao.cor,
        tamanhoQuadrados: m.tamanhoQuadrados ?? atual.tokenPadrao.tamanhoQuadrados,
      };
      const assetHash = m.assetHash === undefined ? atual.tokenPadrao.assetHash : m.assetHash;
      const personagem = limitarPv({
        ...atual,
        nome: m.nome ?? atual.nome,
        donoId: m.donoId === undefined ? atual.donoId : m.donoId,
        tokenPadrao:
          assetHash === null || assetHash === undefined
            ? tokenPadrao
            : { ...tokenPadrao, assetHash },
        visao: {
          alcanceM: m.alcanceM === undefined ? atual.visao.alcanceM : m.alcanceM,
          visaoNoEscuroM: m.visaoNoEscuroM ?? atual.visao.visaoNoEscuroM,
        },
        ficha: { pvAtual: m.pvAtual ?? atual.ficha.pvAtual, pvMax: m.pvMax ?? atual.ficha.pvMax },
      });
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
      return aplicado();
    }

    case "ficha.alterar": {
      const { personagemId, pvAtual, pvMax } = intencao.dados;
      const atual = personagemDe(estado, personagemId);
      // Personagem que não vejo responde igual a personagem inexistente (NPC nunca aparece).
      if (!atual || !personagemVisivelPara(atual, usuario, estado.permissoes)) {
        return recusa("personagem_inexistente", SEM_PERSONAGEM);
      }
      if (usuario.papel !== "mestre" && atual.donoId !== usuario.id) {
        return recusa("sem_permissao", "A ficha não é sua.");
      }
      const personagem = limitarPv({
        ...atual,
        ficha: { pvAtual: pvAtual ?? atual.ficha.pvAtual, pvMax: pvMax ?? atual.ficha.pvMax },
      });
      if (JSON.stringify(personagem) === JSON.stringify(atual)) return aplicado();
      emitir({ tipo: "personagem.alterado", dados: { personagem } });
      return aplicado();
    }

    case "personagem.apagar": {
      const { id } = intencao.dados;
      if (!personagemDe(estado, id)) return recusa("personagem_inexistente", SEM_PERSONAGEM);
      for (const t of estado.tokens.filter((x) => x.personagemId === id)) {
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
      if (p.donoId !== null && estado.tokens.some((t) => t.personagemId === p.id)) {
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
      const copiados = estado.tokens.filter(
        (t) =>
          t.cenaId === cenaId &&
          (t.personagemId === undefined || personagemDe(estado, t.personagemId)?.donoId === null),
      );
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
      emitir({ tipo: "cena.apagada", dados: { cenaId } });
      return aplicado();
    }

    case "grupo.moverPara": {
      const destino = estado.cenas.find((c) => c.id === intencao.dados.cenaId);
      if (!destino) return recusa("cena_inexistente", SEM_CENA);
      if (destino.id === estado.cenaAtivaId) return aplicado();
      // O grupo: tokens de personagens de jogador que estão na cena ativa. Os de NPC ficam.
      const grupo = estado.tokens.filter(
        (t) =>
          t.cenaId === estado.cenaAtivaId &&
          t.personagemId !== undefined &&
          (personagemDe(estado, t.personagemId)?.donoId ?? null) !== null,
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
 * a cena ativa (nada de nome, grid, mapa ou chegada das outras); só tokens visíveis dessa cena; e
 * só os personagens que ele pode ver (os dele; os de outros jogadores com `ficha.verOutras`; NPC
 * nunca).
 */
export function visaoPara(estado: Estado, usuario: Visao): Estado {
  if (usuario.papel === "mestre") return estado;
  const { notaMestre: _oculta, assets: _assets, ...resto } = estado;
  const propria = estado.permissoes.porUsuario[usuario.id];
  return {
    ...resto,
    permissoes: {
      jogadores: estado.permissoes.jogadores,
      porUsuario: propria ? { [usuario.id]: propria } : {},
    },
    cenas: [cenaAtiva(estado)],
    tokens: estado.tokens.filter((t) => tokenVisivelPara(t, usuario, estado.cenaAtivaId)),
    personagens: estado.personagens.filter((p) =>
      personagemVisivelPara(p, usuario, estado.permissoes),
    ),
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
      return evento;
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
    case "personagem.alterado": {
      if (mestre) return evento;
      const permissoes = (depois ?? antes)?.permissoes;
      if (!permissoes) return null;
      if (personagemVisivelPara(evento.dados.personagem, usuario, permissoes)) return evento;
      const antigo = antes?.personagens.find((p) => p.id === evento.dados.personagem.id);
      if (antigo && personagemVisivelPara(antigo, usuario, antes?.permissoes ?? permissoes)) {
        return { ...evento, tipo: "personagem.apagado", dados: { id: antigo.id } };
      }
      return null;
    }
    case "personagem.apagado": {
      if (mestre) return evento;
      const antigo = antes?.personagens.find((p) => p.id === evento.dados.id);
      return antigo && antes && personagemVisivelPara(antigo, usuario, antes.permissoes)
        ? evento
        : null;
    }
  }
}
