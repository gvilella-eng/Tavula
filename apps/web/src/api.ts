import {
  assinarMensagem,
  type ChavePrivada,
  type ChavePublica,
  derivarSenha,
  gerarIdDeMesa,
  type ListaDeContas,
  mensagemDeErroDeConta,
  mensagemParaAssinar,
  normalizarLogin,
  type ResumoDaMesa,
  type SituacaoDaMesa,
} from "@tabletop/shared";
import { atrasoDaTentativa } from "./useSala";

/**
 * `login`: o login da conta (a sessão de verdade); falta no login solto de teste. `tourVisto`: a conta já viu (ou
 * pulou) o tour de introdução; também só existe com conta. `modoTeste`: o servidor roda com MODO=teste.
 */
export type UsuarioDaEntrada = {
  id: string;
  nome: string;
  cor: string;
  login?: string;
  tourVisto?: boolean;
  modoTeste?: boolean;
};

/**
 * A sala não respondeu: ainda está subindo (no `pnpm dev` o Vite fica pronto antes do wrangler) ou
 * caiu. Vale tentar de novo, ao contrário de um 4xx.
 */
export class SalaIndisponivel extends Error {
  constructor() {
    super("A sala não respondeu.");
  }
}

async function pedir(url: string, init?: RequestInit): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    throw new SalaIndisponivel();
  }
  // O proxy do Vite responde 5xx quando o wrangler ainda não está escutando.
  if (r.status >= 500) throw new SalaIndisponivel();
  return r;
}

const esperarDeVerdade = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Repete `fn` enquanto a sala estiver indisponível, com o mesmo backoff da reconexão. */
export async function comRetentativa<T>(
  fn: () => Promise<T>,
  sinal?: AbortSignal,
  esperar: (ms: number) => Promise<void> = esperarDeVerdade,
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof SalaIndisponivel) || sinal?.aborted) throw e;
      await esperar(atrasoDaTentativa(tentativa));
      if (sinal?.aborted) throw e;
    }
  }
}

/** A mesa não existe (id que ninguém criou). */
export class MesaInexistente extends Error {
  constructor() {
    super("Essa mesa não existe.");
  }
}

/** Tudo o que é da sala fica sob `/api/m/<id>` (C1). */
const daMesa = (mesaId: string, rota: string) => `/api/m/${mesaId}/${rota}`;

export async function listarUsuarios(mesaId: string): Promise<UsuarioDaEntrada[]> {
  const r = await pedir(daMesa(mesaId, "usuarios"));
  if (r.status === 404) throw new MesaInexistente();
  if (!r.ok) throw new Error("Não foi possível listar os usuários.");
  return (await r.json()) as UsuarioDaEntrada[];
}

/** Usuário da sessão atual nesta mesa, ou `null` se ninguém entrou. */
export async function usuarioDaSessao(mesaId: string): Promise<UsuarioDaEntrada | null> {
  const r = await pedir(daMesa(mesaId, "eu"));
  if (r.status === 401) return null;
  if (r.status === 404) throw new MesaInexistente();
  if (!r.ok) throw new Error("A sala não respondeu.");
  return (await r.json()) as UsuarioDaEntrada;
}

/** O tour de introdução acabou (ou foi pulado): a conta não o vê de novo sozinha, em nenhum navegador. */
export async function marcarTourVisto(mesaId: string): Promise<void> {
  try {
    await fetch(daMesa(mesaId, "conta/tour-visto"), { method: "POST" });
  } catch {
    // sem rede: o tour só abre de novo no próximo acesso
  }
}

export async function entrar(mesaId: string, usuarioId: string): Promise<void> {
  const r = await pedir(daMesa(mesaId, "entrar"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId }),
  });
  if (!r.ok) throw new Error("Não foi possível entrar.");
}

export async function sair(mesaId: string): Promise<void> {
  await fetch(daMesa(mesaId, "sair"), { method: "POST" });
}

/** O que a tela sabe de uma mesa. `legada`: é a campanha de sempre (a pasta de imagens já escolhida vale). */
export type DadosDaMesa = ResumoDaMesa & { legada: boolean };

/** A mesa pelo id (já na forma canônica), ou `null` se não existe. */
export async function consultarMesa(id: string): Promise<DadosDaMesa | null> {
  const r = await pedir(`/api/mesas/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Não foi possível consultar a mesa.");
  return (await r.json()) as DadosDaMesa;
}

/** Um erro de conta ou de mesa com o texto pronto para a tela (o servidor manda `mensagem`; sem ela, o texto do código). */
export class ErroDeConta extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly minutos?: number,
  ) {
    super(mensagem);
  }
}

async function lerErro(r: Response): Promise<ErroDeConta> {
  let corpo: { erro?: string; mensagem?: string; minutos?: number } = {};
  try {
    corpo = (await r.json()) as typeof corpo;
  } catch {
    // sem corpo
  }
  const codigo = corpo.erro ?? "desconhecido";
  return new ErroDeConta(
    codigo,
    corpo.mensagem ?? mensagemDeErroDeConta(codigo, corpo.minutos),
    corpo.minutos,
  );
}

/** POST em JSON; resposta fora de 2xx vira `ErroDeConta` com a mensagem do servidor. */
async function postar(url: string, corpo: object): Promise<Response> {
  const r = await pedir(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw await lerErro(r);
  return r;
}

/** A mesa criada e, uma única vez, o código de recuperação do mestre (o servidor guarda só o hash dele). */
export type MesaCriada = ResumoDaMesa & { codigo?: string };

/**
 * Cria uma mesa com a conta do mestre e devolve o id dela. A senha é esticada aqui (PBKDF2) e nunca sai do
 * navegador; o id é sorteado aqui porque entra no sal. `chave` (C3): chamada com o id, gera o par de chaves,
 * grava a privada na pasta e devolve só a pública, que vai ao servidor.
 */
export async function criarMesa(
  nome: string,
  mestre: { login: string; nome: string; senha: string },
  chave?: (mesaId: string) => Promise<ChavePublica>,
): Promise<MesaCriada> {
  for (let tentativa = 0; ; tentativa++) {
    const id = gerarIdDeMesa();
    const derivada = await derivarSenha(mestre.senha, id, mestre.login);
    const chavePublica = chave ? await chave(id) : undefined;
    try {
      const r = await postar("/api/mesas", {
        id,
        nome,
        mestre: { login: normalizarLogin(mestre.login), nome: mestre.nome, derivada },
        ...(chavePublica ? { chavePublica } : {}),
      });
      return (await r.json()) as MesaCriada;
    } catch (e) {
      // O id já existia (quase impossível): sorteia outro.
      if (e instanceof ErroDeConta && e.codigo === "id_em_uso" && tentativa < 3) continue;
      if (e instanceof ErroDeConta && e.codigo === "nome_invalido") {
        throw new Error("O nome da mesa precisa ter de 1 a 60 caracteres.");
      }
      if (e instanceof ErroDeConta && e.codigo === "muitas_mesas") {
        throw new Error("Você criou mesas demais por agora. Tente de novo daqui a uma hora.");
      }
      throw e;
    }
  }
}

/** A lista de mesas do servidor, ou `null` se ele não lista (na internet não lista: ninguém descobre as mesas dos outros). */
export async function listarMesasDoServidor(): Promise<DadosDaMesa[] | null> {
  const r = await pedir("/api/mesas");
  if (!r.ok) return null;
  return (await r.json()) as DadosDaMesa[];
}

/** Muda o nome da mesa (só o mestre; a sala confere). */
export async function renomearMesa(mesaId: string, nome: string): Promise<string> {
  const r = await pedir(daMesa(mesaId, "renomear"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
  if (r.status === 403) throw new Error("Só o mestre muda o nome da mesa.");
  if (r.status === 400) throw new Error("O nome da mesa precisa ter de 1 a 60 caracteres.");
  if (!r.ok) throw new Error("Não foi possível mudar o nome.");
  return ((await r.json()) as ResumoDaMesa).nome;
}

// --- Contas (C2) -----------------------------------------------------------------------------------

/** O que a tela de entrada precisa saber antes de mostrar os formulários. */
export async function situacaoDaMesa(mesaId: string): Promise<SituacaoDaMesa> {
  const r = await pedir(daMesa(mesaId, "situacao"));
  if (r.status === 404) throw new MesaInexistente();
  if (!r.ok) throw new Error("A sala não respondeu.");
  return (await r.json()) as SituacaoDaMesa;
}

/** Entrar com login e senha (a senha vira a derivada aqui e só ela é enviada). */
export async function entrarComConta(mesaId: string, login: string, senha: string): Promise<void> {
  const derivada = await derivarSenha(senha, mesaId, login);
  await postar(daMesa(mesaId, "conta/entrar"), { login: normalizarLogin(login), derivada });
}

/** Pedir para entrar na mesa: o mestre precisa aceitar. */
export async function pedirParaEntrar(
  mesaId: string,
  dados: { nome: string; login: string; senha: string },
): Promise<void> {
  const derivada = await derivarSenha(dados.senha, mesaId, dados.login);
  await postar(daMesa(mesaId, "conta/pedir"), {
    login: normalizarLogin(dados.login),
    nome: dados.nome,
    derivada,
  });
}

/** "Esqueci a senha": avisa o mestre (a resposta é a mesma existindo o login ou não). */
export async function esqueciASenha(mesaId: string, login: string): Promise<void> {
  await postar(daMesa(mesaId, "conta/esqueci"), { login: normalizarLogin(login) });
}

/** Define a senha nova depois de o mestre liberar (vale 30 minutos). */
export async function definirNovaSenha(
  mesaId: string,
  login: string,
  senha: string,
): Promise<void> {
  const derivada = await derivarSenha(senha, mesaId, login);
  await postar(daMesa(mesaId, "conta/redefinir"), { login: normalizarLogin(login), derivada });
}

/** Trocar a própria senha (as outras sessões caem). */
export async function trocarSenha(
  mesaId: string,
  login: string,
  atual: string,
  nova: string,
): Promise<void> {
  const [a, n] = await Promise.all([
    derivarSenha(atual, mesaId, login),
    derivarSenha(nova, mesaId, login),
  ]);
  await postar(daMesa(mesaId, "conta/trocar-senha"), { atual: a, nova: n });
}

/** A mesa legada sem conta de mestre: cria a conta dele (só de uma requisição local). */
export async function criarContaDoMestre(
  mesaId: string,
  dados: { login: string; nome: string; senha: string },
): Promise<{ codigo?: string }> {
  const derivada = await derivarSenha(dados.senha, mesaId, dados.login);
  const r = await postar(daMesa(mesaId, "conta/mestre-inicial"), {
    login: normalizarLogin(dados.login),
    nome: dados.nome,
    derivada,
  });
  return (await r.json()) as { codigo?: string };
}

// --- Chave da pasta e código de recuperação do mestre (C3) --------------------------------------------

/** Registra ou troca a chave pública da pasta (só a pública vai; o mestre confirma com a senha atual). */
export async function registrarChaveDaPasta(
  mesaId: string,
  login: string,
  senha: string,
  chavePublica: ChavePublica,
): Promise<void> {
  await postar(daMesa(mesaId, "conta/chave"), {
    senha: await derivarSenha(senha, mesaId, login),
    chavePublica,
  });
}

/** Gera um código de recuperação novo (o anterior morre). O texto só vem nesta resposta. */
export async function gerarNovoCodigo(
  mesaId: string,
  login: string,
  senha: string,
): Promise<string> {
  const r = await postar(daMesa(mesaId, "conta/codigo"), {
    senha: await derivarSenha(senha, mesaId, login),
  });
  return ((await r.json()) as { codigo: string }).codigo;
}

/** Recupera o acesso do mestre com a chave da pasta: o desafio do servidor é assinado aqui e a privada nunca viaja. */
export async function recuperarPelaPasta(
  mesaId: string,
  login: string,
  novaSenha: string,
  privada: ChavePrivada,
): Promise<void> {
  const d = await postar(daMesa(mesaId, "conta/recuperar/desafio"), {});
  const { nonce } = (await d.json()) as { nonce: string };
  const assinatura = await assinarMensagem(privada, mensagemParaAssinar(mesaId, nonce));
  await postar(daMesa(mesaId, "conta/recuperar/pasta"), {
    login: normalizarLogin(login),
    nonce,
    assinatura,
    derivada: await derivarSenha(novaSenha, mesaId, login),
  });
}

/** Recupera o acesso do mestre com o código anotado. Devolve o código novo (o usado morreu). */
export async function recuperarPeloCodigo(
  mesaId: string,
  login: string,
  codigo: string,
  novaSenha: string,
): Promise<string> {
  const r = await postar(daMesa(mesaId, "conta/recuperar/codigo"), {
    login: normalizarLogin(login),
    codigo,
    derivada: await derivarSenha(novaSenha, mesaId, login),
  });
  return ((await r.json()) as { codigo: string }).codigo;
}

/** As contas da mesa, como o mestre as vê. */
export async function listarContas(mesaId: string): Promise<ListaDeContas> {
  const r = await pedir(daMesa(mesaId, "contas"));
  if (!r.ok) throw await lerErro(r);
  return (await r.json()) as ListaDeContas;
}

/** Aceita o pedido. `personagemId` é a "Ficha dele" (opcional): sem ela a pessoa entra como jogador novo. */
export async function aceitarConta(
  mesaId: string,
  contaId: string,
  personagemId?: string,
): Promise<void> {
  await postar(
    daMesa(mesaId, `contas/${contaId}/aceitar`),
    personagemId === undefined ? {} : { personagemId },
  );
}

export async function recusarConta(mesaId: string, contaId: string): Promise<void> {
  await postar(daMesa(mesaId, `contas/${contaId}/recusar`), {});
}

export async function removerConta(mesaId: string, contaId: string): Promise<void> {
  await postar(daMesa(mesaId, `contas/${contaId}/remover`), {});
}

export async function liberarRedefinicao(mesaId: string, contaId: string): Promise<void> {
  await postar(daMesa(mesaId, `contas/${contaId}/liberar-redefinicao`), {});
}
