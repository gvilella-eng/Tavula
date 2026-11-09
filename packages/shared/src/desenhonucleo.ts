import {
  type Desenho,
  desenhoVisivelPara,
  deslocamentoNaCena,
  LIMITES_DO_DESENHO,
  podeMexerNoDesenho,
  pontosDeslocados,
  pontosNaCena,
} from "./desenho.ts";
import type { Cena, Estado, Usuario } from "./estado.ts";
import type { CodigoDeErro, Intencao } from "./protocolo.ts";
import type { NovoEvento } from "./tochas.ts";

// Intenções do Lote 13 (pincel e camada de desenho). Separado do `nucleo.ts` como o `combatenucleo.ts`:
// recebe o estado vivo e uma função para emitir eventos.

type ErroDaSala = { codigo: CodigoDeErro; mensagem: string };

/**
 * O que a sala repassa sem gravar: o rascunho de um traço (`desenho`) ou o fim dele (`fimId`: cancelou).
 * A sala descobre a cena do fim pelo último rascunho daquele id.
 */
export type RascunhoRepassado = { desenho: Desenho } | { fimId: string };

export type SaidaDeDesenho = { erro: ErroDaSala } | { rascunho?: RascunhoRepassado };

export type ContextoDeDesenho = {
  usuario: Usuario;
  atual: () => Estado;
  emitir: (evento: NovoEvento) => void;
};

type De<T extends Intencao["tipo"]> = Extract<Intencao, { tipo: T }>["dados"];

const erro = (codigo: CodigoDeErro, mensagem: string): { erro: ErroDaSala } => ({
  erro: { codigo, mensagem },
});

const ehMestre = (c: ContextoDeDesenho) => c.usuario.papel === "mestre";

/**
 * A cena em que o pedido age. Jogador: sempre a ativa (a outra nem chega a ele). Mestre: a pedida,
 * ou a ativa.
 */
function cenaDoPedido(c: ContextoDeDesenho, cenaId: string | undefined): Cena | ErroDaSala {
  const estado = c.atual();
  if (!ehMestre(c) && cenaId !== undefined && cenaId !== estado.cenaAtivaId) {
    return { codigo: "sem_permissao", mensagem: "Você só desenha na cena ativa." };
  }
  const cena = estado.cenas.find((x) => x.id === (cenaId ?? estado.cenaAtivaId));
  return cena ?? { codigo: "cena_inexistente", mensagem: "Cena não encontrada." };
}

const ehErro = (x: Cena | ErroDaSala): x is ErroDaSala => "codigo" in x;

/** Onde o desenho fica: formas fechadas aceitam preenchimento; o resto nunca é preenchido. */
function preenchimentoDa(forma: Desenho["forma"], preenchido: boolean | undefined) {
  return (forma === "retangulo" || forma === "circulo") && preenchido === true
    ? { preenchido: true }
    : {};
}

/** O desenho que o pedido descreve, já na cena e sem pontos fora dela. */
function montar(
  c: ContextoDeDesenho,
  cena: Cena,
  id: string,
  d: Omit<De<"desenho.criar">["desenho"], "id" | "cenaId">,
): Desenho {
  return {
    id,
    cenaId: cena.id,
    autorId: c.usuario.id,
    forma: d.forma,
    pontos: pontosNaCena(d.pontos, cena),
    cor: d.cor.toLowerCase(),
    espessura: d.espessura,
    ...preenchimentoDa(d.forma, d.preenchido),
  };
}

export function desenhoCriar(c: ContextoDeDesenho, dados: De<"desenho.criar">): SaidaDeDesenho {
  const cena = cenaDoPedido(c, dados.desenho.cenaId);
  if (ehErro(cena)) return { erro: cena };
  const estado = c.atual();
  if (estado.desenhos.some((x) => x.id === dados.desenho.id)) {
    return erro("dados_invalidos", "Já existe um desenho com esse id.");
  }
  if (estado.desenhos.filter((x) => x.cenaId === cena.id).length >= LIMITES_DO_DESENHO.porCena) {
    return erro(
      "limite_de_desenhos",
      `Esta cena já tem ${LIMITES_DO_DESENHO.porCena} desenhos: apague alguns.`,
    );
  }
  c.emitir({
    tipo: "desenho.criado",
    dados: { desenho: montar(c, cena, dados.desenho.id, dados.desenho) },
  });
  return {};
}

/** Rascunho: valida como se fosse criar, mas só devolve o que a sala repassa. */
export function desenhoRascunho(
  c: ContextoDeDesenho,
  dados: De<"desenho.rascunho">,
): SaidaDeDesenho {
  if (dados.desenho === null) return { rascunho: { fimId: dados.id } };
  const cena = cenaDoPedido(c, dados.desenho.cenaId);
  if (ehErro(cena)) return { erro: cena };
  return { rascunho: { desenho: montar(c, cena, dados.id, dados.desenho) } };
}

/** O desenho que quem pede enxerga e pode mexer, ou o erro. */
function desenhoMexivel(c: ContextoDeDesenho, id: string): Desenho | ErroDaSala {
  const estado = c.atual();
  const d = estado.desenhos.find((x) => x.id === id);
  if (!d || !desenhoVisivelPara(d.cenaId, c.usuario, estado.cenaAtivaId)) {
    return { codigo: "desenho_inexistente", mensagem: "Desenho não encontrado." };
  }
  if (!podeMexerNoDesenho(d, c.usuario)) {
    return { codigo: "sem_permissao", mensagem: "Só o mestre mexe nos desenhos dos outros." };
  }
  return d;
}

const ehErroDeDesenho = (x: Desenho | ErroDaSala): x is ErroDaSala => "codigo" in x;

export function desenhoMover(c: ContextoDeDesenho, dados: De<"desenho.mover">): SaidaDeDesenho {
  const d = desenhoMexivel(c, dados.id);
  if (ehErroDeDesenho(d)) return { erro: d };
  const cena = c.atual().cenas.find((x) => x.id === d.cenaId);
  if (!cena) return erro("cena_inexistente", "Cena não encontrada.");
  const { dx, dy } = deslocamentoNaCena(d, cena, dados.dx, dados.dy);
  if (dx === 0 && dy === 0) return {};
  c.emitir({
    tipo: "desenho.movido",
    dados: { id: d.id, pontos: pontosDeslocados(d.pontos, dx, dy) },
  });
  return {};
}

export function desenhoApagar(c: ContextoDeDesenho, dados: De<"desenho.apagar">): SaidaDeDesenho {
  const estado = c.atual();
  const alvos: Desenho[] = [];
  for (const id of new Set(dados.ids)) {
    // Quem já foi apagado (por outra pessoa, ao mesmo tempo) não é erro: apagar é idempotente.
    if (!estado.desenhos.some((x) => x.id === id)) continue;
    const d = desenhoMexivel(c, id);
    if (ehErroDeDesenho(d)) return { erro: d };
    alvos.push(d);
  }
  for (const d of alvos) c.emitir({ tipo: "desenho.apagado", dados: { id: d.id } });
  return {};
}

/** "Voltar": apaga o desenho mais recente de quem pede, na cena. */
export function desenhoVoltar(c: ContextoDeDesenho, dados: De<"desenho.voltar">): SaidaDeDesenho {
  const cena = cenaDoPedido(c, dados.cenaId);
  if (ehErro(cena)) return { erro: cena };
  const meus = c.atual().desenhos.filter((x) => x.cenaId === cena.id && x.autorId === c.usuario.id);
  const ultimo = meus[meus.length - 1];
  if (ultimo) c.emitir({ tipo: "desenho.apagado", dados: { id: ultimo.id } });
  return {};
}

/** Mestre: apaga todos os desenhos da cena (a capacidade `cena.editar` já foi conferida). */
export function desenhoLimpar(c: ContextoDeDesenho, dados: De<"desenho.limpar">): SaidaDeDesenho {
  const cena = cenaDoPedido(c, dados.cenaId);
  if (ehErro(cena)) return { erro: cena };
  if (!c.atual().desenhos.some((x) => x.cenaId === cena.id)) return {};
  c.emitir({ tipo: "desenho.limpo", dados: { cenaId: cena.id } });
  return {};
}
