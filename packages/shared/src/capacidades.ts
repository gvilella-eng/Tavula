import type { Permissoes, Usuario } from "./estado.ts";

/** Capacidades que o mestre pode ligar ou desligar para os jogadores. */
export const CAPACIDADES_DELEGAVEIS = [
  "nota.editar",
  "token.moverProprio",
  "porta.abrir",
  "tocha.acender",
  "tocha.entregar",
  "ponto.usar",
  "luz.apagar",
  "ficha.verOutras",
  "dado.rolarOculto",
  "asset.subir",
  "desenho.criar",
  "token.colocarProprio",
  "mapa.pingar",
  "personagem.criarProprio",
] as const;

/** Capacidades só do mestre: nunca delegáveis. */
export const CAPACIDADES_DO_MESTRE = [
  "papel.alterar",
  "permissao.alterar",
  "mesa.configurar",
  "automacao.editar",
  "camadaMestre.ver",
  "cena.editar",
  "objeto.ajustar",
  "campanha.exportar",
  "campanha.importar",
  "combate.gerir",
  "som.controlar",
] as const;

export type CapacidadeDelegavel = (typeof CAPACIDADES_DELEGAVEIS)[number];
export type CapacidadeDoMestre = (typeof CAPACIDADES_DO_MESTRE)[number];
export type Capacidade = CapacidadeDelegavel | CapacidadeDoMestre;

export const TODAS_AS_CAPACIDADES: readonly Capacidade[] = [
  ...CAPACIDADES_DELEGAVEIS,
  ...CAPACIDADES_DO_MESTRE,
];

export function ehCapacidadeDelegavel(c: string): c is CapacidadeDelegavel {
  return (CAPACIDADES_DELEGAVEIS as readonly string[]).includes(c);
}

/** Padrão da mesa para os jogadores quando a campanha não define outro. */
export const PERMISSOES_PADRAO: Record<CapacidadeDelegavel, boolean> = {
  "nota.editar": true,
  "token.moverProprio": true,
  "porta.abrir": true,
  "tocha.acender": true,
  "tocha.entregar": true,
  "ponto.usar": true,
  "luz.apagar": false,
  "ficha.verOutras": false,
  "dado.rolarOculto": false,
  "asset.subir": true,
  "desenho.criar": true,
  "token.colocarProprio": true,
  "mapa.pingar": true,
  // 12-1: ligada por padrão (decisão do Vilella): o jogador cria as próprias fichas e handouts, com teto de 20 de cada.
  "personagem.criarProprio": true,
};

/** Rótulos em pt-BR para o painel do mestre. */
export const ROTULO_DA_CAPACIDADE: Record<CapacidadeDelegavel, string> = {
  "nota.editar": "Editar a nota da mesa",
  "token.moverProprio": "Mover o próprio token",
  "porta.abrir": "Abrir portas",
  "tocha.acender": "Acender tochas",
  "tocha.entregar": "Entregar tochas",
  "ponto.usar": "Usar pontos de luz",
  "luz.apagar": "Apagar luzes",
  "ficha.verOutras": "Ver fichas dos outros",
  "dado.rolarOculto": "Rolar dados ocultos",
  "asset.subir": "Enviar arquivos",
  "desenho.criar": "Desenhar no mapa",
  "token.colocarProprio": "Pôr o próprio token no mapa (na bandeira)",
  "mapa.pingar": "Pingar o mapa e centralizar a tela de todos",
  "personagem.criarProprio": "Criar fichas e notas próprias",
};

type ComPapel = Pick<Usuario, "id" | "papel">;

/**
 * Pode este usuário exercer esta capacidade?
 * Mestre: sempre. Assistente: nada (por enquanto). Jogador: nunca as exclusivas do mestre; nas
 * demais vale a exceção por usuário, se houver, senão o padrão da mesa.
 */
export function pode(usuario: ComPapel, capacidade: Capacidade, permissoes: Permissoes): boolean {
  if (usuario.papel === "mestre") return true;
  if (usuario.papel !== "jogador") return false;
  if (!ehCapacidadeDelegavel(capacidade)) return false;
  const excecao = permissoes.porUsuario[usuario.id]?.[capacidade];
  return excecao ?? permissoes.jogadores[capacidade] === true;
}
