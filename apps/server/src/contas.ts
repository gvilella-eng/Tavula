import {
  base64UrlParaBytes,
  bloqueioDoIp,
  bytesParaBase64Url,
  type ChavePublica,
  ChavePublicaSchema,
  type CodigoDeErroDeConta,
  type ContaParaMestre,
  chavePublicaValida,
  DESAFIO_VALE_MS,
  DESAFIOS_POR_IP_POR_HORA,
  ESQUECI_POR_IP_POR_HORA,
  FORMATO_DO_TOKEN_DO_CLAUDE,
  gerarCodigoDeRecuperacao,
  gerarParDeChaves,
  JANELA_DO_IP_MS,
  JANELA_POR_HORA_MS,
  type ListaDeContas,
  MAXIMO_DE_DESAFIOS_ABERTOS,
  MAXIMO_DE_PEDIDOS_PENDENTES,
  MAXIMO_DE_SESSOES_POR_CONTA,
  MAXIMO_DE_TOKENS_DO_CLAUDE,
  mensagemParaAssinar,
  minutosAte,
  normalizarCodigoDeRecuperacao,
  normalizarLogin,
  novoTokenDoClaude,
  type PapelDeConta,
  PEDIDOS_POR_IP_POR_HORA,
  PEDIR_DE_NOVO_APOS_RECUSA_MS,
  REDEFINICAO_VALE_MS,
  registrarFalhaDaConta,
  SESSAO_VALE_MS,
  type StatusDeConta,
  sessaoPrecisaRenovar,
  TAMANHO_MAXIMO_DO_NOME_DO_TOKEN,
  type TokenDoClaudePublico,
  type Usuario,
  verificarAssinatura,
} from "@tabletop/shared";

/**
 * As contas de UMA mesa (C2), no SQLite da própria sala. Tudo aqui é segredo do servidor: o sal, o hash
 * e os hashes dos tokens nunca saem desta classe (`listarParaMestre` devolve só o que o mestre pode ver).
 * A senha nem chega aqui: o navegador manda a "derivada" (PBKDF2 de 600.000 iterações) e a sala guarda
 * `SHA-256(sal || derivada)` com um sal aleatório de 16 bytes, comparado em tempo constante.
 * O tempo (`agora`) vem sempre de fora, para os testes.
 */

export type ContaPublica = {
  id: string;
  login: string;
  nome: string;
  papel: PapelDeConta;
  status: StatusDeConta;
  usuarioId: string | null;
  /** O tour de introdução já foi visto por esta conta (ou pulado). */
  tourVisto: boolean;
};

export type Falha = { ok: false; erro: CodigoDeErroDeConta; minutos?: number };
export type Resultado<T> = { ok: true; valor: T } | Falha;

const falha = (erro: CodigoDeErroDeConta, minutos?: number): Falha =>
  minutos === undefined ? { ok: false, erro } : { ok: false, erro, minutos };
const certo = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

type Linha = {
  id: string;
  login: string;
  login_norm: string;
  nome_exibicao: string;
  sal: string;
  hash: string;
  papel: PapelDeConta;
  usuario_id: string | null;
  status: StatusDeConta;
  criada_em: number;
  ultimo_acesso: number | null;
  redefinicao_ate: number | null;
  redefinicao_pedida_em: number | null;
  recusada_em: number | null;
  falhas: number;
  bloqueios: number;
  bloqueada_ate: number;
  /** C3: a chave pública do mestre (JWK em JSON) e o SHA-256 do código de recuperação. Segredos da sala. */
  chave_publica: string | null;
  codigo_hash: string | null;
  /** Tour: 1 = a conta já viu (ou pulou) o tour de introdução. */
  tour_visto: number;
};

const publica = (l: Linha): ContaPublica => ({
  id: l.id,
  login: l.login,
  nome: l.nome_exibicao,
  papel: l.papel,
  status: l.status,
  usuarioId: l.usuario_id,
  tourVisto: l.tour_visto === 1,
});

const codificador = new TextEncoder();

async function sha256(...partes: Uint8Array[]): Promise<Uint8Array> {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const junto = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    junto.set(p, i);
    i += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", junto));
}

/** O que a sala guarda no lugar da senha: `SHA-256(sal || derivada)` em base64url. */
export async function hashDaDerivada(sal: Uint8Array, derivada: string): Promise<string> {
  const bytes = base64UrlParaBytes(derivada) ?? new Uint8Array(0);
  return bytesParaBase64Url(await sha256(sal, bytes));
}

/** O que a sala guarda no lugar do token de sessão: `SHA-256(token)` em base64url. */
export async function hashDoToken(token: string): Promise<string> {
  return bytesParaBase64Url(await sha256(codificador.encode(token)));
}

/** O que a sala guarda do código de recuperação: `SHA-256(código canônico)` em base64url (o código tem entropia alta, sem PBKDF2). */
export async function hashDoCodigo(codigoCanonico: string): Promise<string> {
  return bytesParaBase64Url(await sha256(codificador.encode(codigoCanonico)));
}

function safeJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Compara dois textos sem parar no primeiro byte diferente (o tempo não depende de onde eles diferem). */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const x = codificador.encode(a);
  const y = codificador.encode(b);
  let diferenca = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diferenca |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferenca === 0;
}

const sortearBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Um sal e um hash que nenhuma senha satisfaz: a conta que não existe gasta o mesmo trabalho que a que existe. */
const SAL_DE_MENTIRA = new Uint8Array(16);
const HASH_DE_MENTIRA = bytesParaBase64Url(new Uint8Array(32).fill(7));

/**
 * Uma chave pública de mentira (de uma privada que ninguém guarda): quando a mesa não tem chave, a conferência
 * da assinatura roda contra ela, para o tempo da resposta não dizer se a mesa tem chave.
 */
let chaveDeMentira: Promise<ChavePublica> | null = null;
const obterChaveDeMentira = () => {
  chaveDeMentira ??= gerarParDeChaves().then((p) => p.publica);
  return chaveDeMentira;
};

const HORA = JANELA_POR_HORA_MS;
const UM_DIA = 24 * HORA;

/** Um limite de falhas com espera crescente (1, 5, 15, 60 min), guardado em `limites_ip` (tipo + chave + instante). */
type LimiteNomeado = {
  espera(agora: number): number;
  registrar(agora: number): number;
  zerar(): void;
};

export class ContasDaMesa {
  constructor(
    private readonly sql: SqlStorage,
    private readonly sortear: (n: number) => Uint8Array = sortearBytes,
  ) {}

  // --- consultas ----------------------------------------------------------------------------

  private linhas(consulta: string, ...params: unknown[]): Linha[] {
    return this.sql.exec(consulta, ...params).toArray() as unknown as Linha[];
  }

  private porLogin(loginNorm: string): Linha | null {
    return this.linhas("SELECT * FROM contas WHERE login_norm = ?", loginNorm)[0] ?? null;
  }

  private porId(id: string): Linha | null {
    return this.linhas("SELECT * FROM contas WHERE id = ?", id)[0] ?? null;
  }

  private contar(consulta: string, ...params: unknown[]): number {
    return (this.sql.exec(consulta, ...params).toArray()[0] as { n: number }).n;
  }

  /** A mesa já tem uma conta de mestre ativa? */
  existeMestre(): boolean {
    return (
      this.contar("SELECT COUNT(*) AS n FROM contas WHERE papel = 'mestre' AND status = 'ativa'") >
      0
    );
  }

  /** Quantos pedidos de entrada e de redefinição esperam o mestre. */
  pendencias(): { pendentes: number; redefinicoes: number } {
    return {
      pendentes: this.contar("SELECT COUNT(*) AS n FROM contas WHERE status = 'pendente'"),
      redefinicoes: this.contar(
        "SELECT COUNT(*) AS n FROM contas WHERE status = 'ativa' AND redefinicao_pedida_em IS NOT NULL AND redefinicao_ate IS NULL",
      ),
    };
  }

  /** Tem conta ativa nesta vaga? */
  vagaOcupada(usuarioId: string, ignorarContaId?: string): boolean {
    return (
      this.contar(
        "SELECT COUNT(*) AS n FROM contas WHERE usuario_id = ? AND status = 'ativa' AND id <> ?",
        usuarioId,
        ignorarContaId ?? "",
      ) > 0
    );
  }

  /** Os ids dos usuários que têm conta ativa (V7: são os membros da mesa, junto com o mestre). */
  usuariosComContaAtiva(): Set<string> {
    return new Set(
      this.linhas(
        "SELECT usuario_id FROM contas WHERE status = 'ativa' AND usuario_id IS NOT NULL",
      ).map((l) => l.usuario_id as string),
    );
  }

  /** A conta (sem sal nem hash) ou `null`. */
  conta(id: string): ContaPublica | null {
    const l = this.porId(id);
    return l ? publica(l) : null;
  }

  /** O que o mestre vê: id, login, nome, vaga, status e último acesso. Nunca sal, hash nem token. */
  listarParaMestre(vagas: readonly Usuario[]): ListaDeContas {
    const nomeDaVaga = new Map(vagas.map((u) => [u.id, u.nome]));
    const contas = this.linhas("SELECT * FROM contas ORDER BY criada_em, id").map(
      (l): ContaParaMestre => ({
        id: l.id,
        login: l.login,
        nome: l.nome_exibicao,
        papel: l.papel,
        status: l.status,
        vagaId: l.usuario_id,
        vagaNome: l.usuario_id ? (nomeDaVaga.get(l.usuario_id) ?? null) : null,
        criadaEm: l.criada_em,
        ultimoAcesso: l.ultimo_acesso,
        redefinicaoPedida: l.redefinicao_pedida_em !== null && l.redefinicao_ate === null,
        redefinicaoAte: l.redefinicao_ate,
      }),
    );
    const ocupadas = new Set(
      contas.filter((c) => c.status === "ativa" && c.vagaId).map((c) => c.vagaId),
    );
    const mestre = this.mestreAtivo();
    return {
      contas,
      protecao: { temChave: !!mestre?.chave_publica, temCodigo: !!mestre?.codigo_hash },
      vagasLivres: vagas
        .filter((u) => u.papel === "jogador" && !ocupadas.has(u.id))
        .map((u) => ({ id: u.id, nome: u.nome })),
    };
  }

  // --- limites por IP -------------------------------------------------------------------------

  private registrarDoIp(tipo: string, ip: string, agora: number): void {
    this.sql.exec("INSERT INTO limites_ip (tipo, ip, em) VALUES (?, ?, ?)", tipo, ip, agora);
  }

  private contarDoIp(tipo: string, ip: string, desde: number): number {
    return this.contar(
      "SELECT COUNT(*) AS n FROM limites_ip WHERE tipo = ? AND ip = ? AND em > ?",
      tipo,
      ip,
      desde,
    );
  }

  /** Minutos que o IP ainda espera, ou `0` se ele pode tentar. */
  private esperaDoIp(ip: string, agora: number): number {
    const falhas = (
      this.sql
        .exec(
          "SELECT em FROM limites_ip WHERE tipo = 'falha' AND ip = ? AND em > ?",
          ip,
          agora - JANELA_DO_IP_MS,
        )
        .toArray() as { em: number }[]
    ).map((l) => l.em);
    const ate = bloqueioDoIp(falhas, agora);
    return ate ? minutosAte(ate, agora) : 0;
  }

  /** Apaga o que já não serve: sessões vencidas, desafios vencidos e registros de limite com mais de um dia. */
  limpar(agora: number): void {
    this.sql.exec("DELETE FROM sessoes WHERE expira <= ?", agora);
    this.sql.exec("DELETE FROM limites_ip WHERE em <= ?", agora - UM_DIA);
    this.sql.exec("DELETE FROM desafios WHERE expira <= ?", agora);
  }

  /**
   * Falhas com espera crescente para uma `chave` de um `tipo` (o login que não existe, a recuperação da mesa).
   * Cada falha é uma linha `tipo`; ao bloquear, as falhas somem e fica uma linha `tipo:bloqueio` cujo
   * instante é o fim da espera (quantas linhas de bloqueio há = o degrau da próxima espera).
   */
  private limite(tipo: string, chave: string): LimiteNomeado {
    const bloqueio = `${tipo}:bloqueio`;
    return {
      espera: (agora) => {
        const ate = (
          this.sql
            .exec("SELECT MAX(em) AS m FROM limites_ip WHERE tipo = ? AND ip = ?", bloqueio, chave)
            .toArray()[0] as { m: number | null }
        ).m;
        return ate && ate > agora ? minutosAte(ate, agora) : 0;
      },
      registrar: (agora) => {
        const falhas = this.contar(
          "SELECT COUNT(*) AS n FROM limites_ip WHERE tipo = ? AND ip = ?",
          tipo,
          chave,
        );
        const bloqueios = this.contar(
          "SELECT COUNT(*) AS n FROM limites_ip WHERE tipo = ? AND ip = ?",
          bloqueio,
          chave,
        );
        const r = registrarFalhaDaConta({ falhas, bloqueios }, agora);
        if (r.bloqueadaAte) {
          this.sql.exec("DELETE FROM limites_ip WHERE tipo = ? AND ip = ?", tipo, chave);
          this.registrarDoIp(bloqueio, chave, r.bloqueadaAte);
          return minutosAte(r.bloqueadaAte, agora);
        }
        this.registrarDoIp(tipo, chave, agora);
        return 0;
      },
      zerar: () => {
        this.sql.exec(
          "DELETE FROM limites_ip WHERE tipo IN (?, ?) AND ip = ?",
          tipo,
          bloqueio,
          chave,
        );
      },
    };
  }

  // --- senha -----------------------------------------------------------------------------------

  private async novaSenha(derivada: string): Promise<{ sal: string; hash: string }> {
    const sal = this.sortear(16);
    return { sal: bytesParaBase64Url(sal), hash: await hashDaDerivada(sal, derivada) };
  }

  /** A derivada confere com a conta? Sem conta, faz a mesma conta contra um hash de mentira (e dá `false`). */
  private async confere(conta: Linha | null, derivada: string): Promise<boolean> {
    const sal = conta ? (base64UrlParaBytes(conta.sal) ?? SAL_DE_MENTIRA) : SAL_DE_MENTIRA;
    const calculado = await hashDaDerivada(sal, derivada);
    const certoHash = iguaisEmTempoConstante(calculado, conta ? conta.hash : HASH_DE_MENTIRA);
    return conta !== null && certoHash;
  }

  /** Conta uma senha errada: contra a conta (espera crescente) e contra o IP. Devolve a espera da conta, se bloqueou agora. */
  private registrarSenhaErrada(
    conta: Linha | null,
    ip: string,
    agora: number,
    loginNorm?: string,
  ): number {
    this.registrarDoIp("falha", ip, agora);
    // Login que não existe: as falhas contam por login normalizado, com a mesma espera crescente, para que a
    // mensagem de espera apareça igual e a resposta não diga se a conta existe.
    if (!conta) return loginNorm ? this.limite("login", loginNorm).registrar(agora) : 0;
    const r = registrarFalhaDaConta({ falhas: conta.falhas, bloqueios: conta.bloqueios }, agora);
    this.sql.exec(
      "UPDATE contas SET falhas = ?, bloqueios = ?, bloqueada_ate = ? WHERE id = ?",
      r.falhas,
      r.bloqueios,
      r.bloqueadaAte || conta.bloqueada_ate,
      conta.id,
    );
    return r.bloqueadaAte ? minutosAte(r.bloqueadaAte, agora) : 0;
  }

  private zerarFalhas(contaId: string): void {
    this.sql.exec(
      "UPDATE contas SET falhas = 0, bloqueios = 0, bloqueada_ate = 0 WHERE id = ?",
      contaId,
    );
  }

  // --- sessões ---------------------------------------------------------------------------------

  /** Abre uma sessão para a conta e devolve o token (que só existe aqui e no cookie; no banco fica o hash). */
  private async abrirSessao(contaId: string, agora: number): Promise<string> {
    const token = bytesParaBase64Url(this.sortear(32));
    this.sql.exec(
      "INSERT INTO sessoes (hash_token, conta_id, criada_em, ultimo_uso, expira) VALUES (?, ?, ?, ?, ?)",
      await hashDoToken(token),
      contaId,
      agora,
      agora,
      agora + SESSAO_VALE_MS,
    );
    // No máximo 10 sessões por conta: as mais antigas caem.
    this.sql.exec(
      `DELETE FROM sessoes WHERE conta_id = ? AND hash_token NOT IN (
         SELECT hash_token FROM sessoes WHERE conta_id = ? ORDER BY ultimo_uso DESC, criada_em DESC LIMIT ?)`,
      contaId,
      contaId,
      MAXIMO_DE_SESSOES_POR_CONTA,
    );
    this.sql.exec("UPDATE contas SET ultimo_acesso = ? WHERE id = ?", agora, contaId);
    return token;
  }

  /**
   * Quem é o dono deste token? A sessão vencida, ou de conta que não está ativa, não vale. Usar a sessão
   * a renova (no máximo uma vez por hora); `renovou` avisa quem chama para reenviar o cookie.
   */
  async resolverSessao(
    token: string,
    agora: number,
  ): Promise<{ conta: ContaPublica; sessaoHash: string; renovou: boolean } | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const sessaoHash = await hashDoToken(token);
    const s = this.sql
      .exec("SELECT * FROM sessoes WHERE hash_token = ?", sessaoHash)
      .toArray()[0] as { conta_id: string; ultimo_uso: number; expira: number } | undefined;
    if (!s) return null;
    if (s.expira <= agora) {
      this.sql.exec("DELETE FROM sessoes WHERE hash_token = ?", sessaoHash);
      return null;
    }
    const conta = this.porId(s.conta_id);
    if (conta?.status !== "ativa") return null;
    let renovou = false;
    if (sessaoPrecisaRenovar(s.ultimo_uso, agora)) {
      this.sql.exec(
        "UPDATE sessoes SET ultimo_uso = ?, expira = ? WHERE hash_token = ?",
        agora,
        agora + SESSAO_VALE_MS,
        sessaoHash,
      );
      this.sql.exec("UPDATE contas SET ultimo_acesso = ? WHERE id = ?", agora, conta.id);
      renovou = true;
    }
    return { conta: publica(conta), sessaoHash, renovou };
  }

  /** O tour de introdução foi visto (ou pulado) por esta conta: nunca mais abre sozinho, em nenhum navegador. */
  marcarTourVisto(contaId: string): void {
    this.sql.exec("UPDATE contas SET tour_visto = 1 WHERE id = ?", contaId);
  }

  /** Sair: apaga a sessão. */
  async sair(token: string): Promise<void> {
    this.sql.exec("DELETE FROM sessoes WHERE hash_token = ?", await hashDoToken(token));
  }

  /** Apaga as sessões de uma conta (menos a de `manter`, se vier). */
  private derrubarSessoes(contaId: string, manterHash?: string): void {
    this.sql.exec(
      "DELETE FROM sessoes WHERE conta_id = ? AND hash_token <> ?",
      contaId,
      manterHash ?? "",
    );
  }

  // --- criar contas ------------------------------------------------------------------------------

  /** A conta do mestre (mesa nova, ou a mesa legada na primeira vez), já ativa e ligada à vaga dele. */
  async criarMestre(
    dados: { login: string; nome: string; derivada: string },
    usuarioId: string,
    agora: number,
  ): Promise<Resultado<ContaPublica>> {
    if (this.existeMestre()) return falha("ja_tem_mestre");
    const loginNorm = dados.login.trim().toLowerCase();
    if (this.porLogin(loginNorm)) return falha("login_em_uso");
    const { sal, hash } = await this.novaSenha(dados.derivada);
    const id = crypto.randomUUID();
    this.sql.exec(
      `INSERT INTO contas (id, login, login_norm, nome_exibicao, sal, hash, papel, usuario_id, status, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, 'mestre', ?, 'ativa', ?)`,
      id,
      loginNorm,
      loginNorm,
      dados.nome,
      sal,
      hash,
      usuarioId,
      agora,
    );
    return certo(publica(this.porId(id) as Linha));
  }

  /** Um pedido de entrada: a conta nasce `pendente` e só entra quando o mestre aceita. */
  async pedir(
    dados: { login: string; nome: string; derivada: string },
    ip: string,
    agora: number,
  ): Promise<Resultado<{ id: string }>> {
    if (!this.existeMestre()) return falha("mesa_sem_mestre");
    this.limpar(agora);
    // Cada tentativa de pedir conta para o IP (inclusive as de login repetido: senão dava para varrer logins).
    if (this.contarDoIp("pedido", ip, agora - HORA) >= PEDIDOS_POR_IP_POR_HORA) {
      return falha("muitos_pedidos");
    }
    this.registrarDoIp("pedido", ip, agora);
    if (
      this.contar("SELECT COUNT(*) AS n FROM contas WHERE status = 'pendente'") >=
      MAXIMO_DE_PEDIDOS_PENDENTES
    ) {
      return falha("muitos_pedidos");
    }
    const loginNorm = dados.login.trim().toLowerCase();
    const existente = this.porLogin(loginNorm);
    const { sal, hash } = await this.novaSenha(dados.derivada);
    if (existente) {
      if (existente.status !== "recusada") return falha("login_em_uso");
      const espera = (existente.recusada_em ?? 0) + PEDIR_DE_NOVO_APOS_RECUSA_MS - agora;
      if (espera > 0) return falha("pedido_recusado_recente", Math.ceil(espera / 60_000));
      // Recusada há mais de 10 minutos: o mesmo login pede de novo (a linha vira um pedido novo).
      this.sql.exec(
        `UPDATE contas SET nome_exibicao = ?, sal = ?, hash = ?, status = 'pendente', usuario_id = NULL,
           criada_em = ?, recusada_em = NULL, redefinicao_ate = NULL, redefinicao_pedida_em = NULL,
           falhas = 0, bloqueios = 0, bloqueada_ate = 0 WHERE id = ?`,
        dados.nome,
        sal,
        hash,
        agora,
        existente.id,
      );
      return certo({ id: existente.id });
    }
    const id = crypto.randomUUID();
    this.sql.exec(
      `INSERT INTO contas (id, login, login_norm, nome_exibicao, sal, hash, papel, usuario_id, status, criada_em)
       VALUES (?, ?, ?, ?, ?, ?, 'jogador', NULL, 'pendente', ?)`,
      id,
      loginNorm,
      loginNorm,
      dados.nome,
      sal,
      hash,
      agora,
    );
    return certo({ id });
  }

  // --- entrar ---------------------------------------------------------------------------------------

  async entrar(
    dados: { login: string; derivada: string },
    ip: string,
    agora: number,
  ): Promise<Resultado<{ token: string; conta: ContaPublica }>> {
    this.limpar(agora);
    const esperaIp = this.esperaDoIp(ip, agora);
    if (esperaIp) return falha("ip_bloqueado", esperaIp);
    const loginNorm = dados.login.trim().toLowerCase();
    const conta = this.porLogin(loginNorm);
    if (conta && conta.bloqueada_ate > agora) {
      return falha("bloqueada", minutosAte(conta.bloqueada_ate, agora));
    }
    if (!conta) {
      const esperaDoLogin = this.limite("login", loginNorm).espera(agora);
      if (esperaDoLogin) return falha("bloqueada", esperaDoLogin);
    }
    if (!(await this.confere(conta, dados.derivada)) || !conta) {
      const espera = this.registrarSenhaErrada(conta, ip, agora, loginNorm);
      return espera ? falha("bloqueada", espera) : falha("credenciais");
    }
    // Senha certa: zera a contagem; só então se diz em que pé está o pedido (quem erra a senha não descobre).
    this.zerarFalhas(conta.id);
    if (conta.status === "pendente") return falha("pedido_pendente");
    if (conta.status === "recusada") return falha("pedido_recusado");
    if (!conta.usuario_id) return falha("sem_vaga");
    const token = await this.abrirSessao(conta.id, agora);
    return certo({ token, conta: publica(conta) });
  }

  /** Uma sessão nova para a conta já conferida por outro caminho (a mesa nova abre a sessão do mestre). */
  async abrirSessaoDe(contaId: string, agora: number): Promise<string> {
    return this.abrirSessao(contaId, agora);
  }

  // --- esqueci a senha e redefinição -----------------------------------------------------------------

  /**
   * "Esqueci a senha": marca o pedido na conta de jogador. A resposta ao cliente é sempre a mesma (existindo
   * ou não o login). Devolve a conta só quando este pedido é novo e o mestre deve ser avisado.
   */
  esqueci(loginNorm: string, ip: string, agora: number): ContaPublica | null {
    this.limpar(agora);
    if (this.contarDoIp("esqueci", ip, agora - HORA) >= ESQUECI_POR_IP_POR_HORA) return null;
    this.registrarDoIp("esqueci", ip, agora);
    const conta = this.porLogin(loginNorm);
    if (conta?.status !== "ativa" || conta.papel !== "jogador") return null;
    // Já há um pedido esperando (ou uma liberação ainda no prazo): não avisa o mestre de novo.
    const liberacaoVencida = conta.redefinicao_ate !== null && conta.redefinicao_ate <= agora;
    if (conta.redefinicao_pedida_em !== null && !liberacaoVencida) return null;
    this.sql.exec(
      "UPDATE contas SET redefinicao_pedida_em = ?, redefinicao_ate = NULL WHERE id = ?",
      agora,
      conta.id,
    );
    return publica(conta);
  }

  /** O mestre libera a redefinição: a conta ganha 30 minutos para definir a senha nova. */
  liberarRedefinicao(contaId: string, agora: number): Resultado<ContaPublica> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (
      conta.papel !== "jogador" ||
      conta.status !== "ativa" ||
      conta.redefinicao_pedida_em === null
    ) {
      return falha("sem_pedido");
    }
    this.sql.exec(
      "UPDATE contas SET redefinicao_ate = ? WHERE id = ?",
      agora + REDEFINICAO_VALE_MS,
      contaId,
    );
    return certo(publica(conta));
  }

  /** Define a senha nova de uma conta com redefinição liberada e ainda no prazo. As sessões antigas caem. */
  async redefinir(
    dados: { login: string; derivada: string },
    ip: string,
    agora: number,
  ): Promise<Resultado<{ conta: ContaPublica; token: string | null }>> {
    this.limpar(agora);
    const esperaIp = this.esperaDoIp(ip, agora);
    if (esperaIp) return falha("ip_bloqueado", esperaIp);
    const conta = this.porLogin(dados.login.trim().toLowerCase());
    if (
      conta?.status !== "ativa" ||
      conta.papel !== "jogador" ||
      conta.redefinicao_ate === null ||
      conta.redefinicao_ate <= agora
    ) {
      this.registrarDoIp("falha", ip, agora);
      return falha("redefinicao_indisponivel");
    }
    const { sal, hash } = await this.novaSenha(dados.derivada);
    this.sql.exec(
      `UPDATE contas SET sal = ?, hash = ?, redefinicao_ate = NULL, redefinicao_pedida_em = NULL,
         falhas = 0, bloqueios = 0, bloqueada_ate = 0 WHERE id = ?`,
      sal,
      hash,
      conta.id,
    );
    this.derrubarSessoes(conta.id);
    const token = conta.usuario_id ? await this.abrirSessao(conta.id, agora) : null;
    return certo({ conta: publica(conta), token });
  }

  /** Trocar a senha estando logado: confere a atual (errar conta como no login) e derruba as outras sessões. */
  async trocarSenha(
    contaId: string,
    dados: { atual: string; nova: string },
    sessaoHash: string,
    ip: string,
    agora: number,
  ): Promise<Resultado<null>> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (conta.bloqueada_ate > agora)
      return falha("bloqueada", minutosAte(conta.bloqueada_ate, agora));
    const esperaIp = this.esperaDoIp(ip, agora);
    if (esperaIp) return falha("ip_bloqueado", esperaIp);
    if (!(await this.confere(conta, dados.atual))) {
      const espera = this.registrarSenhaErrada(conta, ip, agora);
      return espera ? falha("bloqueada", espera) : falha("senha_atual_incorreta");
    }
    const { sal, hash } = await this.novaSenha(dados.nova);
    this.sql.exec(
      "UPDATE contas SET sal = ?, hash = ?, falhas = 0, bloqueios = 0, bloqueada_ate = 0 WHERE id = ?",
      sal,
      hash,
      contaId,
    );
    this.derrubarSessoes(contaId, sessaoHash);
    return certo(null);
  }

  // --- chave da pasta e código de recuperação (C3) -------------------------------------------------------

  /** A conta do mestre (a mesa tem uma só). */
  private mestreAtivo(): Linha | null {
    return (
      this.linhas("SELECT * FROM contas WHERE papel = 'mestre' AND status = 'ativa' LIMIT 1")[0] ??
      null
    );
  }

  /** Confere a senha atual de uma conta já logada; errar conta como no login (conta e IP). `null` = confere. */
  private async conferirSenhaAtual(
    conta: Linha,
    derivada: string,
    ip: string,
    agora: number,
  ): Promise<Falha | null> {
    if (conta.bloqueada_ate > agora)
      return falha("bloqueada", minutosAte(conta.bloqueada_ate, agora));
    const esperaIp = this.esperaDoIp(ip, agora);
    if (esperaIp) return falha("ip_bloqueado", esperaIp);
    if (!(await this.confere(conta, derivada))) {
      const espera = this.registrarSenhaErrada(conta, ip, agora);
      return espera ? falha("bloqueada", espera) : falha("senha_atual_incorreta");
    }
    return null;
  }

  /** Um código novo para a conta (o anterior morre): o texto só existe aqui e na resposta; no banco fica o SHA-256. */
  async gerarCodigo(contaId: string): Promise<string> {
    const codigo = gerarCodigoDeRecuperacao(this.sortear);
    const canonico = normalizarCodigoDeRecuperacao(codigo) as string;
    this.sql.exec(
      "UPDATE contas SET codigo_hash = ? WHERE id = ?",
      await hashDoCodigo(canonico),
      contaId,
    );
    return codigo;
  }

  /** "Gerar novo código": o mestre logado, com a senha atual. */
  async gerarNovoCodigo(
    contaId: string,
    derivada: string,
    ip: string,
    agora: number,
  ): Promise<Resultado<{ codigo: string }>> {
    const conta = this.porId(contaId);
    if (conta?.papel !== "mestre") return falha("sem_permissao");
    const erro = await this.conferirSenhaAtual(conta, derivada, ip, agora);
    if (erro) return erro;
    this.zerarFalhas(conta.id);
    return certo({ codigo: await this.gerarCodigo(conta.id) });
  }

  /** Registra (ou troca) a chave pública do mestre. A troca invalida a antiga. Só a pública chega aqui. */
  async registrarChave(
    contaId: string,
    chave: unknown,
    derivada: string | null,
    ip: string,
    agora: number,
  ): Promise<Resultado<null>> {
    const conta = this.porId(contaId);
    if (conta?.papel !== "mestre") return falha("sem_permissao");
    if (derivada !== null) {
      const erro = await this.conferirSenhaAtual(conta, derivada, ip, agora);
      if (erro) return erro;
      this.zerarFalhas(conta.id);
    }
    const r = ChavePublicaSchema.safeParse(chave);
    if (!r.success || !(await chavePublicaValida(r.data))) return falha("corpo_invalido");
    this.sql.exec(
      "UPDATE contas SET chave_publica = ? WHERE id = ?",
      JSON.stringify(r.data),
      contaId,
    );
    return certo(null);
  }

  /** Um desafio para a recuperação pela pasta: nonce aleatório de 32 bytes, 5 minutos, uso único. Sempre emite (não diz se há chave). */
  emitirDesafio(ip: string, agora: number): Resultado<{ nonce: string; expira: number }> {
    this.limpar(agora);
    if (this.contarDoIp("desafio", ip, agora - HORA) >= DESAFIOS_POR_IP_POR_HORA) {
      return falha("muitos_pedidos");
    }
    this.registrarDoIp("desafio", ip, agora);
    const nonce = bytesParaBase64Url(this.sortear(32));
    this.sql.exec(
      "INSERT INTO desafios (nonce, criado_em, expira) VALUES (?, ?, ?)",
      nonce,
      agora,
      agora + DESAFIO_VALE_MS,
    );
    // Os mais antigos caem quando há demais abertos (a tabela não cresce sem fim).
    this.sql.exec(
      `DELETE FROM desafios WHERE nonce NOT IN (SELECT nonce FROM desafios ORDER BY criado_em DESC, rowid DESC LIMIT ?)`,
      MAXIMO_DE_DESAFIOS_ABERTOS,
    );
    return certo({ nonce, expira: agora + DESAFIO_VALE_MS });
  }

  /** Gasta o nonce (síncrono: sem `await` entre ler e apagar, dois pedidos não gastam o mesmo). `true` se valia. */
  private consumirDesafio(nonce: string, agora: number): boolean {
    const linha = this.sql
      .exec("SELECT expira FROM desafios WHERE nonce = ?", nonce)
      .toArray()[0] as { expira: number } | undefined;
    this.sql.exec("DELETE FROM desafios WHERE nonce = ?", nonce);
    return !!linha && linha.expira > agora;
  }

  /** Os limites da recuperação: por IP (o das falhas do C2) e por mesa (espera crescente). Devolve a espera em minutos. */
  private esperaDaRecuperacao(ip: string, agora: number): Falha | null {
    const esperaIp = this.esperaDoIp(ip, agora);
    if (esperaIp) return falha("ip_bloqueado", esperaIp);
    const esperaMesa = this.limite("recuperar", "mesa").espera(agora);
    return esperaMesa ? falha("bloqueada", esperaMesa) : null;
  }

  private falhaDeRecuperacao(ip: string, agora: number): Falha {
    this.registrarDoIp("falha", ip, agora);
    const espera = this.limite("recuperar", "mesa").registrar(agora);
    return espera ? falha("bloqueada", espera) : falha("recuperacao_invalida");
  }

  /** Troca a senha do mestre, derruba todas as sessões dele e abre uma nova. */
  private async retomarMestre(
    mestre: Linha,
    derivada: string,
    agora: number,
  ): Promise<{ conta: ContaPublica; token: string }> {
    const { sal, hash } = await this.novaSenha(derivada);
    this.sql.exec(
      "UPDATE contas SET sal = ?, hash = ?, falhas = 0, bloqueios = 0, bloqueada_ate = 0 WHERE id = ?",
      sal,
      hash,
      mestre.id,
    );
    this.derrubarSessoes(mestre.id);
    this.limite("recuperar", "mesa").zerar();
    return { conta: publica(mestre), token: await this.abrirSessao(mestre.id, agora) };
  }

  /**
   * Recuperar pela pasta: o navegador assinou `tavola-recuperar:<mesa>:<nonce>` com a chave privada da pasta.
   * O nonce é gasto antes de tudo (certa ou errada, a assinatura não vale duas vezes). Sem chave na mesa, a
   * conferência roda contra uma chave de mentira: a resposta e o tempo são os mesmos.
   */
  async recuperarPelaPasta(
    dados: { mesaId: string; login: string; nonce: string; assinatura: string; derivada: string },
    ip: string,
    agora: number,
  ): Promise<Resultado<{ conta: ContaPublica; token: string }>> {
    this.limpar(agora);
    const bloqueio = this.esperaDaRecuperacao(ip, agora);
    if (bloqueio) return bloqueio;
    const valia = this.consumirDesafio(dados.nonce, agora);
    const mestre = this.mestreAtivo();
    let real: ChavePublica | null = null;
    if (mestre?.chave_publica) {
      const lida = ChavePublicaSchema.safeParse(safeJson(mestre.chave_publica));
      real = lida.success ? lida.data : null;
    }
    const conferiu = await verificarAssinatura(
      real ?? (await obterChaveDeMentira()),
      mensagemParaAssinar(dados.mesaId, dados.nonce),
      dados.assinatura,
    );
    if (!mestre || !real || !valia || !conferiu) return this.falhaDeRecuperacao(ip, agora);
    if (normalizarLogin(dados.login) !== mestre.login_norm) return falha("login_nao_confere");
    return certo(await this.retomarMestre(mestre, dados.derivada, agora));
  }

  /** Recuperar pelo código: o código morre e um novo é devolvido na hora (para mostrar uma vez). */
  async recuperarPeloCodigo(
    dados: { login: string; codigo: string; derivada: string },
    ip: string,
    agora: number,
  ): Promise<Resultado<{ conta: ContaPublica; token: string; codigoNovo: string }>> {
    this.limpar(agora);
    const bloqueio = this.esperaDaRecuperacao(ip, agora);
    if (bloqueio) return bloqueio;
    const mestre = this.mestreAtivo();
    const canonico = normalizarCodigoDeRecuperacao(dados.codigo);
    const calculado = await hashDoCodigo(canonico ?? "invalido");
    const guardado = mestre?.codigo_hash ?? HASH_DE_MENTIRA;
    const confere = iguaisEmTempoConstante(calculado, guardado);
    if (!mestre?.codigo_hash || !canonico || !confere) {
      return this.falhaDeRecuperacao(ip, agora);
    }
    if (normalizarLogin(dados.login) !== mestre.login_norm) return falha("login_nao_confere");
    const r = await this.retomarMestre(mestre, dados.derivada, agora);
    // O código usado morre; o novo substitui na hora.
    this.sql.exec("UPDATE contas SET codigo_hash = NULL WHERE id = ?", mestre.id);
    return certo({ ...r, codigoNovo: await this.gerarCodigo(mestre.id) });
  }

  // --- o que o mestre faz ------------------------------------------------------------------------------

  /** Aceita um pedido: a conta fica ativa, ligada à vaga. Quem chama confere antes que a vaga é de jogador e está livre. */
  aceitar(contaId: string, usuarioId: string): Resultado<ContaPublica> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (conta.status !== "pendente") return falha("sem_pedido");
    if (this.vagaOcupada(usuarioId, contaId)) return falha("vaga_invalida");
    this.sql.exec(
      "UPDATE contas SET status = 'ativa', usuario_id = ?, recusada_em = NULL WHERE id = ?",
      usuarioId,
      contaId,
    );
    return certo(publica(this.porId(contaId) as Linha));
  }

  recusar(contaId: string, agora: number): Resultado<ContaPublica> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (conta.papel === "mestre") return falha("conta_do_mestre");
    if (conta.status !== "pendente") return falha("sem_pedido");
    this.sql.exec(
      "UPDATE contas SET status = 'recusada', recusada_em = ?, usuario_id = NULL WHERE id = ?",
      agora,
      contaId,
    );
    this.derrubarSessoes(contaId);
    this.revogarTokensDaConta(contaId);
    return certo(publica(conta));
  }

  /** Remove a conta (a vaga fica e perde a conta). A do mestre não sai por aqui. */
  remover(contaId: string): Resultado<ContaPublica> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (conta.papel === "mestre") return falha("conta_do_mestre");
    this.derrubarSessoes(contaId);
    this.revogarTokensDaConta(contaId);
    this.sql.exec("DELETE FROM contas WHERE id = ?", contaId);
    return certo(publica(conta));
  }

  /** Liga uma conta ativa de jogador a outra vaga (livre, de jogador: quem chama confere). */
  trocarVaga(contaId: string, usuarioId: string): Resultado<ContaPublica> {
    const conta = this.porId(contaId);
    if (!conta) return falha("conta_inexistente");
    if (conta.papel !== "jogador" || conta.status !== "ativa") return falha("sem_pedido");
    if (this.vagaOcupada(usuarioId, contaId)) return falha("vaga_invalida");
    this.sql.exec("UPDATE contas SET usuario_id = ? WHERE id = ?", usuarioId, contaId);
    // O token é de uma pessoa nesta mesa: trocar a vaga da conta o revoga.
    this.revogarTokensDaConta(contaId);
    return certo(publica(this.porId(contaId) as Linha));
  }

  /**
   * A campanha foi importada e as vagas mudaram: a conta ligada a uma vaga que não existe mais fica sem
   * vaga (o mestre a liga de novo) e perde as sessões. Devolve os ids das contas afetadas.
   */
  desligarVagasQueSumiram(vagasQueExistem: ReadonlySet<string>): string[] {
    const afetadas = this.linhas("SELECT * FROM contas WHERE usuario_id IS NOT NULL").filter(
      (c) => c.usuario_id !== null && !vagasQueExistem.has(c.usuario_id),
    );
    for (const c of afetadas) {
      this.sql.exec("UPDATE contas SET usuario_id = NULL WHERE id = ?", c.id);
      this.derrubarSessoes(c.id);
      this.revogarTokensDaConta(c.id);
    }
    return afetadas.map((c) => c.id);
  }

  // --- tokens de acesso do Claude (12-1) ---------------------------------------------------------------

  /** Os tokens de quem pede: da conta; sem conta (só MODO=teste), do usuário do login solto. */
  private tokensDe(contaId: string | null, usuarioId: string): TokenDoClaudePublico[] {
    const linhas = (contaId === null
      ? this.sql.exec(
          "SELECT id, nome, criado_em, ultimo_uso FROM tokens_claude WHERE conta_id IS NULL AND usuario_id = ? ORDER BY criado_em",
          usuarioId,
        )
      : this.sql.exec(
          "SELECT id, nome, criado_em, ultimo_uso FROM tokens_claude WHERE conta_id = ? ORDER BY criado_em",
          contaId,
        )
    ).toArray() as unknown as {
      id: string;
      nome: string;
      criado_em: number;
      ultimo_uso: number | null;
    }[];
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      criadoEm: l.criado_em,
      ultimoUso: l.ultimo_uso,
    }));
  }

  listarTokensDoClaude(contaId: string | null, usuarioId: string): TokenDoClaudePublico[] {
    return this.tokensDe(contaId, usuarioId);
  }

  /**
   * Gera um token do Claude para a conta (ou, sem conta, para o usuário do login solto de teste). O token vai só na
   * resposta (a sala guarda o SHA-256); no máximo 5 por conta.
   */
  async gerarTokenDoClaude(
    contaId: string | null,
    usuarioId: string,
    nome: string,
    agora: number,
  ): Promise<Resultado<{ token: string; publico: TokenDoClaudePublico }>> {
    if (this.tokensDe(contaId, usuarioId).length >= MAXIMO_DE_TOKENS_DO_CLAUDE) {
      return falha("limite_de_tokens");
    }
    const token = novoTokenDoClaude(this.sortear);
    const id = bytesParaBase64Url(this.sortear(9));
    const nomeFinal = nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_TOKEN) || "Claude";
    this.sql.exec(
      "INSERT INTO tokens_claude (id, hash_token, conta_id, usuario_id, nome, criado_em, ultimo_uso) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      id,
      await hashDoToken(token),
      contaId,
      usuarioId,
      nomeFinal,
      agora,
    );
    return certo({ token, publico: { id, nome: nomeFinal, criadoEm: agora, ultimoUso: null } });
  }

  /** Revoga um token de quem pede (vale na hora). Devolve o id, ou falha se o token não é dele. */
  revogarTokenDoClaude(
    contaId: string | null,
    usuarioId: string,
    id: string,
  ): Resultado<{ id: string }> {
    if (!this.tokensDe(contaId, usuarioId).some((t) => t.id === id)) {
      return falha("token_inexistente");
    }
    this.sql.exec("DELETE FROM tokens_claude WHERE id = ?", id);
    return certo({ id });
  }

  /** Revoga todos os tokens de uma conta (a conta saiu da mesa, foi recusada ou trocou de vaga). Devolve os ids. */
  revogarTokensDaConta(contaId: string): string[] {
    const ids = (
      this.sql
        .exec("SELECT id FROM tokens_claude WHERE conta_id = ?", contaId)
        .toArray() as unknown as {
        id: string;
      }[]
    ).map((l) => l.id);
    if (ids.length > 0) this.sql.exec("DELETE FROM tokens_claude WHERE conta_id = ?", contaId);
    return ids;
  }

  /**
   * De quem é este token (o do cabeçalho `Authorization: Bearer` do WebSocket)? Token fora do formato, que não existe ou
   * que foi revogado dão a MESMA resposta (`null`), e cada falha entra no mesmo bloqueio progressivo por IP do login. Com
   * o IP bloqueado nem se confere. `permitirSemConta`: só com MODO=teste (o login solto não tem conta).
   */
  async resolverTokenDoClaude(
    token: string | null,
    ip: string,
    agora: number,
    permitirSemConta: boolean,
  ): Promise<
    | { ok: true; usuarioId: string; contaId: string | null; tokenId: string }
    | { ok: false; minutos: number }
  > {
    this.limpar(agora);
    const espera = this.esperaDoIp(ip, agora);
    if (espera) return { ok: false, minutos: espera };
    const falhou = (): { ok: false; minutos: number } => {
      this.registrarDoIp("falha", ip, agora);
      return { ok: false, minutos: 0 };
    };
    if (token === null || !FORMATO_DO_TOKEN_DO_CLAUDE.test(token)) return falhou();
    const l = this.sql
      .exec("SELECT * FROM tokens_claude WHERE hash_token = ?", await hashDoToken(token))
      .toArray()[0] as unknown as
      | { id: string; conta_id: string | null; usuario_id: string }
      | undefined;
    if (!l) return falhou();
    if (l.conta_id === null) {
      if (!permitirSemConta) return falhou();
    } else {
      // O token só vale enquanto a conta está ativa e ligada à mesma vaga.
      const conta = this.porId(l.conta_id);
      if (conta?.status !== "ativa" || conta.usuario_id !== l.usuario_id) return falhou();
    }
    this.sql.exec("UPDATE tokens_claude SET ultimo_uso = ? WHERE id = ?", agora, l.id);
    return { ok: true, usuarioId: l.usuario_id, contaId: l.conta_id, tokenId: l.id };
  }

  /**
   * M1: o token do Claude (pelo id) ainda vale? Existe, não foi revogado e, se tem conta, ela segue ativa e ligada à mesma vaga.
   * O link de envio de arquivo fica preso ao token que o pediu: revogar o token mata o link. `permitirSemConta`: só com MODO=teste.
   */
  tokenDoClaudeValido(tokenId: string, permitirSemConta: boolean): boolean {
    const l = this.sql
      .exec("SELECT conta_id, usuario_id FROM tokens_claude WHERE id = ?", tokenId)
      .toArray()[0] as unknown as { conta_id: string | null; usuario_id: string } | undefined;
    if (!l) return false;
    if (l.conta_id === null) return permitirSemConta;
    const conta = this.porId(l.conta_id);
    return conta?.status === "ativa" && conta.usuario_id === l.usuario_id;
  }

  /** Só para o `/teste/zerar` (MODO=teste): esquece contas, sessões e limites. */
  apagarTudo(): void {
    this.sql.exec("DELETE FROM sessoes");
    this.sql.exec("DELETE FROM tokens_claude");
    this.sql.exec("DELETE FROM limites_ip");
    this.sql.exec("DELETE FROM desafios");
    this.sql.exec("DELETE FROM contas");
  }
}
