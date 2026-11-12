import { z } from "zod";

/**
 * Contas por mesa (C2). Aqui moram só as regras puras e a derivação da senha, que roda no NAVEGADOR:
 * a senha nunca sai dele. O servidor recebe a "derivada" (32 bytes em base64url) e guarda só um hash
 * dela com sal (ver `apps/server/src/contas.ts`). Nada deste arquivo é segredo.
 */

// --- Senha: derivação no navegador -------------------------------------------------------------

/** O navegador estica a senha com PBKDF2-SHA256 nesta quantidade de iterações (o servidor na internet tem CPU curta). */
export const ITERACOES_PBKDF2 = 600_000;

/** Mais de 4 caracteres (pedido do Vilella). O servidor nunca vê a senha: quem confere o tamanho é o navegador. */
export const TAMANHO_MINIMO_DA_SENHA = 5;
export const TAMANHO_MAXIMO_DA_SENHA = 128;
export const TAMANHO_MINIMO_DO_LOGIN = 3;
export const TAMANHO_MAXIMO_DO_LOGIN = 32;
export const TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO = 40;

export function bytesParaBase64Url(bytes: Uint8Array): string {
  let texto = "";
  for (const b of bytes) texto += String.fromCharCode(b);
  return btoa(texto).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Os bytes de um texto base64url (sem preenchimento), ou `null` se o texto não for base64url. */
export function base64UrlParaBytes(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) return null;
  const padrao = texto.replaceAll("-", "+").replaceAll("_", "/");
  const comPreenchimento = padrao + "=".repeat((4 - (padrao.length % 4)) % 4);
  try {
    const bruto = atob(comPreenchimento);
    return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** O login sem espaços nas pontas e em minúsculas: é como ele vale (único por mesa sem diferenciar maiúsculas). */
export function normalizarLogin(texto: string): string {
  return texto.trim().toLowerCase();
}

/** O sal da derivação: `"tavola:" + id da mesa + ":" + login normalizado`. */
export function salDaDerivacao(mesaId: string, login: string): string {
  return `tavola:${mesaId}:${normalizarLogin(login)}`;
}

/**
 * A senha esticada (PBKDF2-SHA256, 600.000 iterações, 32 bytes, base64url). É o que o navegador manda; a
 * senha em si nunca sai dele. O texto da senha entra normalizado (NFKC) para que o mesmo texto digitado
 * de jeitos diferentes (acento composto ou separado) dê a mesma derivada.
 */
export async function derivarSenha(
  senha: string,
  mesaId: string,
  login: string,
  iteracoes: number = ITERACOES_PBKDF2,
): Promise<string> {
  const codificador = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(senha.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: codificador.encode(salDaDerivacao(mesaId, login)),
      iterations: iteracoes,
    },
    chave,
    256,
  );
  return bytesParaBase64Url(new Uint8Array(bits));
}

// --- Validação do que a pessoa digita -----------------------------------------------------------

const REGEX_DO_LOGIN = /^[a-z0-9._-]+$/;

/** O login normalizado, ou `null`: de 3 a 32 caracteres, letras, dígitos, ponto, hífen e sublinhado. */
export function loginValido(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const login = normalizarLogin(texto);
  if (login.length < TAMANHO_MINIMO_DO_LOGIN || login.length > TAMANHO_MAXIMO_DO_LOGIN) return null;
  return REGEX_DO_LOGIN.test(login) ? login : null;
}

/** O nome de exibição limpo (sem controles, espaços únicos), de 1 a 40 caracteres, ou `null`. */
export function nomeDeExibicaoValido(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpo = [...texto]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length >= 1 && limpo.length <= TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO ? limpo : null;
}

/** O que está errado na senha (texto para a tela), ou `null` se ela serve. */
export function erroDaSenha(senha: string): string | null {
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
    return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  }
  if (senha.length > TAMANHO_MAXIMO_DA_SENHA) {
    return `A senha pode ter no máximo ${TAMANHO_MAXIMO_DA_SENHA} caracteres.`;
  }
  return null;
}

// --- Corpos das requisições (validados com zod no Worker e na sala) ------------------------------

/** 32 bytes em base64url, sem preenchimento: 43 caracteres. */
export const DerivadaSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "derivada inválida");
const LoginSchema = z
  .string()
  .max(64)
  .refine((t) => loginValido(t) !== null, "login inválido");
const NomeSchema = z
  .string()
  .max(200)
  .refine((t) => nomeDeExibicaoValido(t) !== null, "nome inválido");

export const CorpoEntrarSchema = z.object({ login: LoginSchema, derivada: DerivadaSchema });
export const CorpoPedirSchema = z.object({
  login: LoginSchema,
  nome: NomeSchema,
  derivada: DerivadaSchema,
});
export const CorpoEsqueciSchema = z.object({ login: LoginSchema });
export const CorpoRedefinirSchema = z.object({ login: LoginSchema, derivada: DerivadaSchema });
export const CorpoTrocarSenhaSchema = z.object({ atual: DerivadaSchema, nova: DerivadaSchema });
export const CorpoMestreInicialSchema = z.object({
  login: LoginSchema,
  nome: NomeSchema,
  derivada: DerivadaSchema,
});
export const CorpoAceitarSchema = z.object({
  vaga: z.union([
    z.object({ usuarioId: z.string().min(1).max(64) }),
    z.object({ nova: z.literal(true) }),
  ]),
});
export const CorpoTrocarVagaSchema = z.object({ usuarioId: z.string().min(1).max(64) });
/** O mestre de uma mesa nova. */
export const MestreDaMesaNovaSchema = z.object({
  login: LoginSchema,
  nome: NomeSchema,
  derivada: DerivadaSchema,
});
export type MestreDaMesaNova = z.infer<typeof MestreDaMesaNovaSchema>;

// --- Estados e limites ---------------------------------------------------------------------------

export const PAPEIS_DE_CONTA = ["mestre", "jogador"] as const;
export type PapelDeConta = (typeof PAPEIS_DE_CONTA)[number];
export const STATUS_DE_CONTA = ["pendente", "ativa", "recusada"] as const;
export type StatusDeConta = (typeof STATUS_DE_CONTA)[number];

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Depois de 5 falhas seguidas, a conta espera: 1, 5, 15 e 60 minutos (e continua em 60). O acerto zera. */
export const FALHAS_PARA_BLOQUEAR_A_CONTA = 5;
export const ESPERAS_DA_CONTA_MIN = [1, 5, 15, 60] as const;
/** Por IP (`CF-Connecting-IP`; sem ele "local"): 30 falhas em 15 minutos bloqueiam o IP por 15 minutos. */
export const FALHAS_PARA_BLOQUEAR_O_IP = 30;
export const JANELA_DO_IP_MS = 15 * MINUTO;
export const BLOQUEIO_DO_IP_MS = 15 * MINUTO;
/** Pedidos de entrada: no máximo 10 pendentes por mesa e 3 por IP por hora. */
export const MAXIMO_DE_PEDIDOS_PENDENTES = 10;
export const PEDIDOS_POR_IP_POR_HORA = 3;
/** "Esqueci a senha": no máximo 5 por IP por hora (assumido). */
export const ESQUECI_POR_IP_POR_HORA = 5;
export const JANELA_POR_HORA_MS = HORA;
/** Quem teve o pedido recusado pode pedir de novo depois de 10 minutos. */
export const PEDIR_DE_NOVO_APOS_RECUSA_MS = 10 * MINUTO;
/** A redefinição de senha liberada pelo mestre vale por 30 minutos. */
export const REDEFINICAO_VALE_MS = 30 * MINUTO;
/** A sessão vale 30 dias, renovada com o uso (no máximo uma vez por hora, para não gravar a cada requisição). */
export const SESSAO_VALE_MS = 30 * 24 * HORA;
export const SESSAO_RENOVA_APOS_MS = HORA;
export const MAXIMO_DE_SESSOES_POR_CONTA = 10;
/** Quantas vagas a mesa comporta ("Nova vaga" para de oferecer depois disso; assumido). */
export const MAXIMO_DE_VAGAS = 12;

export type EstadoDeFalhas = { falhas: number; bloqueios: number };

/**
 * Registra uma falha de senha de uma conta. Na quinta falha seguida a conta é bloqueada pela espera do
 * degrau atual e o contador de falhas recomeça (o degrau só sobe com a próxima rodada de falhas).
 */
export function registrarFalhaDaConta(
  estado: EstadoDeFalhas,
  agora: number,
): EstadoDeFalhas & { bloqueadaAte: number } {
  const falhas = estado.falhas + 1;
  if (falhas < FALHAS_PARA_BLOQUEAR_A_CONTA) {
    return { falhas, bloqueios: estado.bloqueios, bloqueadaAte: 0 };
  }
  const degrau = Math.min(estado.bloqueios, ESPERAS_DA_CONTA_MIN.length - 1);
  const espera = (ESPERAS_DA_CONTA_MIN[degrau] ?? 60) * MINUTO;
  return { falhas: 0, bloqueios: estado.bloqueios + 1, bloqueadaAte: agora + espera };
}

/** Quantos minutos (arredondado para cima, no mínimo 1) faltam para `ate`. */
export function minutosAte(ate: number, agora: number): number {
  return Math.max(1, Math.ceil((ate - agora) / MINUTO));
}

/**
 * Até quando o IP está bloqueado (ms desde 1970), ou `0` se não está. `falhasEm`: os instantes das
 * falhas do IP (qualquer ordem). Bloqueado quando há 30 falhas dentro dos últimos 15 minutos, até 15
 * minutos depois da 30ª falha mais recente.
 */
export function bloqueioDoIp(falhasEm: readonly number[], agora: number): number {
  const recentes = falhasEm.filter((t) => t > agora - JANELA_DO_IP_MS).sort((a, b) => b - a);
  const trigesima = recentes[FALHAS_PARA_BLOQUEAR_O_IP - 1];
  if (trigesima === undefined) return 0;
  const ate = trigesima + BLOQUEIO_DO_IP_MS;
  return ate > agora ? ate : 0;
}

/** A sessão ainda vale? */
export function sessaoValida(expira: number, agora: number): boolean {
  return expira > agora;
}

/** A sessão deve ser renovada (usada de novo faz mais de uma hora da última renovação)? */
export function sessaoPrecisaRenovar(ultimoUso: number, agora: number): boolean {
  return agora - ultimoUso >= SESSAO_RENOVA_APOS_MS;
}

// --- Erros de conta ------------------------------------------------------------------------------

export const CODIGOS_DE_ERRO_DE_CONTA = [
  "corpo_invalido",
  "tipo_invalido",
  "credenciais",
  "bloqueada",
  "ip_bloqueado",
  "pedido_pendente",
  "pedido_recusado",
  "sem_vaga",
  "login_em_uso",
  "muitos_pedidos",
  "pedido_recusado_recente",
  "redefinicao_indisponivel",
  "senha_atual_incorreta",
  "sem_sessao",
  "sem_permissao",
  "conta_inexistente",
  "vaga_invalida",
  "ja_tem_mestre",
  "so_local",
  "conta_do_mestre",
  "mestre_obrigatorio",
  "id_em_uso",
  "sem_pedido",
  "mesa_sem_mestre",
  "recuperacao_invalida",
  "login_nao_confere",
  "origem_invalida",
] as const;
export type CodigoDeErroDeConta = (typeof CODIGOS_DE_ERRO_DE_CONTA)[number];

const emMinutos = (n: number) => `${n} ${n === 1 ? "minuto" : "minutos"}`;

/** O texto em português de cada erro de conta (o mesmo vale no servidor e na tela). */
export function mensagemDeErroDeConta(codigo: string, minutos?: number): string {
  switch (codigo as CodigoDeErroDeConta) {
    case "corpo_invalido":
    case "tipo_invalido":
      return "Os dados enviados não parecem certos. Confira os campos.";
    case "credenciais":
      return "Login ou senha incorretos.";
    case "bloqueada":
    case "ip_bloqueado":
      return `Muitas tentativas. Tente de novo em ${emMinutos(minutos ?? 1)}.`;
    case "pedido_pendente":
      return "Seu pedido ainda não foi aceito.";
    case "pedido_recusado":
      return "Seu pedido foi recusado.";
    case "sem_vaga":
      return "Sua conta ainda não está ligada a uma vaga. Peça ao mestre para ligá-la.";
    case "login_em_uso":
      return "Esse login já está em uso nesta mesa. Escolha outro.";
    case "muitos_pedidos":
      return "Há pedidos demais por agora. Tente de novo mais tarde.";
    case "pedido_recusado_recente":
      return `Seu pedido foi recusado. Você pode pedir de novo em ${emMinutos(minutos ?? 1)}.`;
    case "redefinicao_indisponivel":
      return "Não há redefinição liberada para esse login. Peça ao mestre e tente de novo.";
    case "senha_atual_incorreta":
      return "A senha atual não confere.";
    case "sem_sessao":
      return "Você precisa entrar na mesa.";
    case "sem_permissao":
      return "Só o mestre faz isso.";
    case "conta_inexistente":
      return "Essa conta não existe mais.";
    case "vaga_invalida":
      return "Essa vaga não está livre.";
    case "ja_tem_mestre":
      return "Esta mesa já tem um mestre.";
    case "so_local":
      return "Isso só vale no computador onde o servidor roda.";
    case "conta_do_mestre":
      return "A conta do mestre não pode ser removida nem recusada.";
    case "mestre_obrigatorio":
      return "Uma mesa nova precisa da conta do mestre (login, nome e senha).";
    case "id_em_uso":
      return "Esse id de mesa já existe. Tente de novo.";
    case "sem_pedido":
      return "Não há pedido de redefinição dessa conta.";
    case "mesa_sem_mestre":
      return "Esta mesa ainda não tem mestre para aceitar pedidos.";
    case "recuperacao_invalida":
      // Igual para pasta errada, sem chave, sem código, assinatura ruim ou código errado: não diz o que a mesa tem.
      return "Não foi possível recuperar o acesso com isso. Confira e tente de novo.";
    case "login_nao_confere":
      return "Esse não é o login do mestre desta mesa.";
    case "origem_invalida":
      return "Pedido recusado: ele não veio desta página.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

// --- O que o mestre vê das contas ----------------------------------------------------------------

/** Uma conta como o mestre a vê: nada de sal, hash nem token. */
export const ContaParaMestreSchema = z.object({
  id: z.string(),
  login: z.string(),
  nome: z.string(),
  papel: z.enum(PAPEIS_DE_CONTA),
  status: z.enum(STATUS_DE_CONTA),
  vagaId: z.string().nullable(),
  vagaNome: z.string().nullable(),
  criadaEm: z.number(),
  ultimoAcesso: z.number().nullable(),
  /** A pessoa pediu para redefinir a senha e o mestre ainda não liberou. */
  redefinicaoPedida: z.boolean(),
  /** A redefinição liberada vale até este instante (ou `null`). */
  redefinicaoAte: z.number().nullable(),
});
export type ContaParaMestre = z.infer<typeof ContaParaMestreSchema>;

export const ListaDeContasSchema = z.object({
  contas: z.array(ContaParaMestreSchema),
  /** Só o mestre vê: a mesa tem chave da pasta e código de recuperação? (nunca a chave nem o hash). */
  protecao: z.object({ temChave: z.boolean(), temCodigo: z.boolean() }),
  /** As vagas de jogador ainda sem conta ativa. */
  vagasLivres: z.array(z.object({ id: z.string(), nome: z.string() })),
});
export type ListaDeContas = z.infer<typeof ListaDeContasSchema>;

/** O que a tela de entrada pergunta antes de mostrar os formulários (rota pública, sem dado de ninguém). */
export const SituacaoDaMesaSchema = z.object({
  /** `MODO=teste`: a escolha de usuário de desenvolvimento também vale. */
  modoTeste: z.boolean(),
  /** A mesa ainda não tem conta de mestre. */
  semMestre: z.boolean(),
  /** E esta requisição é local, então pode criá-la. */
  podeCriarMestre: z.boolean(),
});
export type SituacaoDaMesa = z.infer<typeof SituacaoDaMesaSchema>;

/** O resumo que o mestre recebe pelo WebSocket: quantos pedidos esperam e, se acabou de chegar um, qual. */
export const AvisoDeContasSchema = z.object({
  pendentes: z.number().int().nonnegative(),
  redefinicoes: z.number().int().nonnegative(),
  novo: z
    .object({ tipo: z.enum(["entrada", "redefinicao"]), nome: z.string(), login: z.string() })
    .nullable(),
});
export type AvisoDeContas = z.infer<typeof AvisoDeContasSchema>;
