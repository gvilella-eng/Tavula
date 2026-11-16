import type { TipoIntencao } from "../index.ts";

// M2: a tabela de paridade. Para CADA intenção do protocolo (`IntencaoSchema`) ela diz uma de duas coisas: qual ferramenta
// do MCP (e qual campo dela) a alcança, ou por que a intenção fica de fora, numa categoria fechada. Como o tipo é um
// `Record<TipoIntencao, ...>`, uma intenção nova sem entrada nem compila; o teste `paridade.test.ts` confere também que
// a ferramenta e o campo apontados existem. Regra de lote: intenção nova precisa de entrada nesta tabela.

/** Uma ferramenta do MCP e o campo (ou valor de `acao`) de entrada dela que alcança a intenção. */
export type Alvo = { ferramenta: string; acao: string; detalhe?: string };

/**
 * Por que a intenção não tem ferramenta:
 * - `proibida`: segurança (papéis, permissões, exportar, importar); a sala também a recusa ao Claude;
 * - `transporte`: coisa da conexão (arquivos por pedaços, caixa de entrada, histórico paginado);
 * - `gesto ao vivo`: gesto físico da tela, sem sentido para o Claude.
 */
export const CATEGORIAS_FORA = ["proibida", "transporte", "gesto ao vivo"] as const;
export type CategoriaFora = (typeof CATEGORIAS_FORA)[number];
export type Fora = { fora: CategoriaFora; motivo: string };

export type EntradaDeParidade = Alvo | Fora;

export function estaFora(e: EntradaDeParidade): e is Fora {
  return "fora" in e;
}

const via = (ferramenta: string, acao: string, detalhe?: string): Alvo => ({
  ferramenta,
  acao,
  ...(detalhe ? { detalhe } : {}),
});
const fora = (categoria: CategoriaFora, motivo: string): Fora => ({ fora: categoria, motivo });

const POR_ARQUIVOS = "O arquivo entra pela ferramenta `arquivos` (a caixa de entrada da mesa).";

export const PARIDADE_COM_O_MCP: Record<TipoIntencao, EntradaDeParidade> = {
  // --- segurança ---
  "papel.alterar": fora("proibida", "Mudar papéis é só da pessoa, pela mesa."),
  "permissao.alterar": fora("proibida", "Mudar permissões é só da pessoa, pela mesa."),
  "campanha.exportar": fora("proibida", "Exportar a campanha é só da pessoa."),
  "campanha.importar": fora("proibida", "Importar a campanha é só da pessoa."),

  // --- transporte ---
  "asset.registrar": fora("transporte", POR_ARQUIVOS),
  "asset.pedir": fora("transporte", "Troca de pedaços de arquivo entre navegadores e sala."),
  "asset.inventario": fora("transporte", "Troca de pedaços de arquivo entre navegadores e sala."),
  "asset.tenho": fora("transporte", "Troca de pedaços de arquivo entre navegadores e sala."),
  "asset.naoTenho": fora("transporte", "Troca de pedaços de arquivo entre navegadores e sala."),
  "caixa.concluir": fora("transporte", "É o navegador do mestre fechando um envio da caixa."),
  "caixa.falhar": fora("transporte", "É o navegador do mestre fechando um envio da caixa."),
  "chat.anteriores": fora(
    "transporte",
    "Paginação do histórico para a tela; o Claude lê o chat com `ler`.",
  ),
  "cena.preparar": fora("transporte", "Pré-envio cifrado do mapa pelo navegador do mestre."),

  // --- gestos ao vivo ---
  "mapa.ping": fora("gesto ao vivo", "Um ping é um gesto da tela, efêmero."),
  "desenho.rascunho": fora(
    "gesto ao vivo",
    "O traço em andamento do pincel; o Claude desenha o desenho pronto.",
  ),
  "token.mover": fora(
    "gesto ao vivo",
    "O arrasto em andamento (transitório, não grava); o Claude move com `tokens`, que grava a posição final.",
  ),
  "ponto.acenderInicio": fora(
    "gesto ao vivo",
    "Segurar a tocha sobre o ponto, no tempo real da sala.",
  ),
  "ponto.acenderFim": fora(
    "gesto ao vivo",
    "Segurar a tocha sobre o ponto, no tempo real da sala.",
  ),

  // --- cenas ---
  "cena.criar": via("cenas", "cenas"),
  "cena.editar": via("cenas", "cenas"),
  "cena.apagar": via("cenas", "cenas", "apagar"),
  "cena.duplicar": via("cenas", "cenas", "duplicarDe"),
  "cena.importarMapa": via("arquivos", "enviar", "uso dungeondraft (mapa Universal VTT)"),
  "cena.configurarGrid": via("cenas", "cenas", "grid"),
  "cena.configurarIluminacao": via("cenas", "cenas", "iluminacao"),
  "cena.definirMapa": via("arquivos", "enviar", "uso mapa"),
  "grupo.moverPara": via("cenas", "cenas", "levarGrupo"),
  "memoria.esquecer": via("mapa", "esquecerMemoria"),

  // --- mapa ---
  "nevoa.tracar": via("mapa", "nevoa"),
  "nevoa.desfazer": via("mapa", "desfazerNevoa"),
  "desenho.criar": via("mapa", "desenhos", "e textos"),
  "desenho.mover": via("mapa", "moverDesenhos"),
  "desenho.apagar": via("mapa", "apagar"),
  "desenho.voltar": via("mapa", "apagar", "ultimos"),
  "desenho.limpar": via("mapa", "apagar", "todos"),
  "parede.criar": via("cenas", "cenas", "paredes"),
  "parede.editar": via("mapa", "paredes"),
  "parede.apagar": via("mapa", "paredes", "apagar"),
  "porta.alternar": via("mapa", "portas"),

  // --- tokens ---
  "token.criar": via("cenas", "cenas", "tokens"),
  "token.editar": via("tokens", "tokens"),
  "token.apagar": via("cenas", "cenas", "apagarTokens"),
  "token.restaurar": via("tokens", "restaurar"),
  "token.colocarMeu": via("tokens", "colocar"),
  "token.soltar": via("tokens", "tokens", "mover"),
  "token.condicoes": via("tokens", "tokens", "condicoes"),
  "token.definirImagem": via("arquivos", "enviar", "uso token"),
  "personagem.colocar": via("tokens", "colocar"),

  // --- fichas, notas e pastas ---
  "personagem.criar": via("fichas", "fichas"),
  "personagem.editar": via("fichas", "fichas"),
  "personagem.apagar": via("fichas", "apagar"),
  "ficha.alterar": via("fichas", "fichas"),
  "ficha.dadoDeVida": via("fichas", "dadoDeVida"),
  "mochila.ajustar": via("fichas", "mochila"),
  "handout.criar": via("notas", "notas"),
  "handout.editar": via("notas", "notas"),
  "handout.apagar": via("notas", "notas", "apagar"),
  "handout.mostrar": via("chat", "handout"),
  "pasta.criar": via("mesa", "pastas"),
  "pasta.editar": via("mesa", "pastas"),
  "pasta.apagar": via("mesa", "pastas", "apagar"),
  "compendio.definir": via("mesa", "compendio", "tirar; para pôr, `arquivos`"),

  // --- luz ---
  "fonte.criar": via("objetos", "luzes"),
  "fonte.editar": via("objetos", "luzes"),
  "fonte.apagar": via("objetos", "luzes", "apagar"),
  "modelo.criar": via("objetos", "modelos"),
  "modelo.editar": via("objetos", "modelos"),
  "modelo.apagar": via("objetos", "modelos", "apagar"),
  "ponto.criar": via("objetos", "pontos"),
  "ponto.editar": via("objetos", "pontos"),
  "ponto.apagar": via("objetos", "pontos", "apagar"),
  "ponto.pegar": via("objetos", "tocha", "pegar"),
  "tocha.acender": via("objetos", "tocha", "acender"),
  "tocha.alternar": via("objetos", "tocha", "alternar"),
  "tocha.guardar": via("objetos", "tocha", "guardar"),
  "tocha.entregar": via("objetos", "tocha", "entregar"),
  "tocha.posar": via("objetos", "tocha", "posar"),
  "objeto.ajustar": via("objetos", "ajustes"),

  // --- mesa ---
  "config.iluminacao": via("mesa", "iluminacao"),
  "config.mesa": via("mesa", "configuracao"),
  "mesa.pausar": via("mesa", "relogio", "pausar"),
  "mesa.retomar": via("mesa", "relogio", "retomar"),
  "mesa.zerarRelogio": via("mesa", "relogio", "zerar"),

  // --- chat e dados ---
  "chat.enviar": via("chat", "narrar"),
  "chat.magia": via("chat", "magia"),
  "chat.caracteristica": via("chat", "caracteristica"),
  "chat.limpar": via("chat", "limpar"),
  "chat.modelo": via("rolar", "teste", "e ataque"),
  "dado.rolar": via("rolar", "expressao"),

  // --- combate ---
  "ordemDeTurno.definir": via("combate", "ordemVisivel"),
  "combate.adicionar": via("combate", "passos", "adicionar"),
  "combate.tirar": via("combate", "passos", "tirar"),
  "combate.editar": via("combate", "passos", "editar"),
  "combate.mover": via("combate", "passos", "mover"),
  "combate.ordenar": via("combate", "passos", "ordenar"),
  "combate.rolar": via("combate", "passos", "rolar"),
  "combate.proximo": via("combate", "passos", "proximo"),
  "combate.anterior": via("combate", "passos", "anterior"),
  "combate.passar": via("combate", "passos", "passar"),
  "combate.encerrar": via("combate", "passos", "encerrar"),
  "combate.entrar": via("combate", "passos", "entrar"),
  "combate.rodada": via("combate", "passos", "rodada"),
  "combate.darVez": via("combate", "passos", "darVez"),

  // --- som ---
  "som.lugar": via("som", "lugares"),
  "som.efeito": via("som", "efeito"),
  "som.efeitoParar": via("som", "pararEfeito"),
  "som.ambiente": via("som", "ambientes"),
  "som.volumeGeral": via("som", "volumeGeral"),
  "som.pararTudo": via("som", "pararTudo"),
  "som.apagar": via("som", "apagar"),

  // --- automações ---
  "ciclo.criar": via("automacoes", "ciclos"),
  "ciclo.editar": via("automacoes", "ciclos"),
  "ciclo.apagar": via("automacoes", "ciclos", "apagar"),
  "ciclo.disparar": via("automacoes", "acionar", "disparar"),
  "ciclo.pausar": via("automacoes", "acionar", "pausar"),
  "ciclo.retomar": via("automacoes", "acionar", "retomar"),
  "reacao.criar": via("automacoes", "reacoes"),
  "reacao.editar": via("automacoes", "reacoes"),
  "reacao.apagar": via("automacoes", "reacoes", "apagar"),
  "zona.criar": via("automacoes", "zonas"),
  "zona.editar": via("automacoes", "zonas"),
  "zona.apagar": via("automacoes", "zonas", "apagar"),
  "botao.criar": via("automacoes", "botoes"),
  "botao.editar": via("automacoes", "botoes"),
  "botao.apagar": via("automacoes", "botoes", "apagar"),
  "botao.usar": via("automacoes", "usarBotoes"),
  "evento.disparar": via("automacoes", "eventos"),

  // --- rascunhos e desfazer ---
  "rascunho.publicar": via("rascunhos", "publicar"),
  "rascunho.descartar": via("rascunhos", "descartar"),
  "claude.desfazer": via("desfazer", "desfazer"),
};
