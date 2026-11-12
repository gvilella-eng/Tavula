import {
  type AssetMeta,
  absorverMochila,
  CENA_PADRAO,
  type Cena,
  type Combate,
  CombateSchema,
  type CompendioDaMesa,
  CompendioDaMesaSchema,
  configComPadrao,
  type Desenho,
  DesenhoSchema,
  type Estado,
  type EventoSala,
  type Handout,
  type Mensagem,
  MensagemSchema,
  type ModeloDeObjeto,
  migrarNotasParaHandouts,
  modelosPadrao,
  type ObjetoDeLuz,
  objetoDoBanco,
  type Pacote,
  type Parede,
  type Pasta,
  PERMISSOES_PADRAO,
  type Permissoes,
  type PontoDeLuz,
  pastasPadrao,
  personagemDoBanco,
  type RelogioSala,
  RelogioSalaSchema,
  type Token,
  type Usuario,
} from "@tabletop/shared";

/** Contadores de uso do dia (dia UTC). */
export type UsoDoDia = { dia: string; mensagens: number; conexoes: number };

type Migracao = (sql: SqlStorage) => void;

/** Migrações versionadas. Nunca edite uma já aplicada: acrescente outra no fim. */
const MIGRACOES: Migracao[] = [
  (sql) => {
    sql.exec(`CREATE TABLE entidades (
      colecao TEXT NOT NULL,
      id TEXT NOT NULL,
      dados TEXT NOT NULL,
      PRIMARY KEY (colecao, id)
    )`);
    sql.exec(`CREATE TABLE agenda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quando INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      chave TEXT NOT NULL,
      dados TEXT NOT NULL,
      UNIQUE (tipo, chave)
    )`);
  },
  // Lote 3: quem tem cada asset, por conexão (sobrevive à hibernação; só metadados, nunca bytes).
  (sql) => {
    sql.exec(`CREATE TABLE posse (
      conexao TEXT NOT NULL,
      usuario TEXT NOT NULL,
      hash TEXT NOT NULL,
      PRIMARY KEY (conexao, hash)
    )`);
    sql.exec("CREATE INDEX posse_hash ON posse (hash)");
  },
  // Lote 4: preparo cifrado de cenas. As chaves são dado só do mestre e da sala: nunca vão a jogador
  // antes de o grupo ir para a cena, e não entram na exportação.
  (sql) => {
    sql.exec(`CREATE TABLE preparos (
      cena_id TEXT NOT NULL,
      hash_cifrado TEXT NOT NULL,
      hash_original TEXT NOT NULL,
      chave TEXT NOT NULL,
      PRIMARY KEY (cena_id, hash_cifrado)
    )`);
  },
  // Lote 4b: pastas das Fichas. O personagem troca `donoId` por "quem edita" e vai para uma pasta só do
  // mestre ("Personagens" ou "NPCs"): quem o via continua vendo (o antigo dono) e quem não via, não.
  (sql) => {
    const linhas = sql
      .exec<{ id: string; dados: string }>(
        "SELECT id, dados FROM entidades WHERE colecao = 'personagens'",
      )
      .toArray();
    for (const l of linhas) {
      const novo = personagemDoBanco(JSON.parse(l.dados));
      sql.exec(
        "UPDATE entidades SET dados = ? WHERE colecao = 'personagens' AND id = ?",
        JSON.stringify(novo),
        l.id,
      );
    }
    for (const pasta of pastasPadrao()) {
      sql.exec(
        "INSERT OR IGNORE INTO entidades (colecao, id, dados) VALUES ('pastas', ?, ?)",
        pasta.id,
        JSON.stringify(pasta),
      );
    }
  },
  // Lote 7: os modelos de objeto de luz (Tocha 5e, Lanterna, Fogueira) entram na campanha antiga. As
  // luzes do Lote 6 (`acesa: boolean`) NÃO são reescritas aqui: `objetoDoBanco` as lê no formato novo
  // ao carregar, e cada uma é regravada quando mudar. O relógio da sala nasce ao primeiro carregamento.
  (sql) => {
    for (const modelo of modelosPadrao()) {
      sql.exec(
        "INSERT OR IGNORE INTO entidades (colecao, id, dados) VALUES ('modelos', ?, ?)",
        modelo.id,
        JSON.stringify(modelo),
      );
    }
  },
  // Lote 8: o histórico do chat numa tabela própria (fora de `entidades`, que a importação apaga e a
  // exportação lê): aditiva, o banco antigo ganha a tabela vazia. `seq` é o do evento que criou a
  // mensagem e nunca se repete; `dados` é a mensagem inteira em JSON.
  (sql) => {
    sql.exec(`CREATE TABLE IF NOT EXISTS chat (
      seq INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      dados TEXT NOT NULL
    )`);
  },
  // Lote 11: a ordem de turno (o combate) numa tabela própria de uma linha só: aditiva, o banco antigo
  // ganha a tabela vazia (= sem combate). As condições e a concentração moram dentro do token.
  (sql) => {
    sql.exec(`CREATE TABLE IF NOT EXISTS combate (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      dados TEXT NOT NULL
    )`);
  },
  // Lote 13: os desenhos do pincel numa tabela própria (um por linha, `dados` em JSON): aditiva, o banco
  // antigo ganha a tabela vazia. Fora de `entidades` para a importação regravar com `salvarTudo`
  // sem misturar e para apagar os de uma cena com um índice.
  (sql) => {
    sql.exec(`CREATE TABLE IF NOT EXISTS desenhos (
      id TEXT PRIMARY KEY,
      cena_id TEXT NOT NULL,
      dados TEXT NOT NULL
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS desenhos_cena ON desenhos (cena_id)");
  },
  // V3: a aba Notas saiu. A nota da mesa e a do mestre (coleção `notas`, quando não vazias) viram handouts
  // (coleção `handouts`) numa pasta nova "Handouts" só do mestre; a nota da mesa vale para todos, a do mestre
  // só para ele. As linhas de `notas` somem. Banco sem notas (ou só vazias): nada nasce.
  (sql) => {
    const lerColecao = (colecao: string) =>
      sql
        .exec<{ id: string; dados: string }>(
          "SELECT id, dados FROM entidades WHERE colecao = ? ORDER BY rowid",
          colecao,
        )
        .toArray();
    const texto = (id: string) => {
      const linha = lerColecao("notas").find((l) => l.id === id);
      return linha ? (JSON.parse(linha.dados) as { texto?: string }).texto : undefined;
    };
    const pastas = lerColecao("pastas").map((l) => JSON.parse(l.dados) as Pasta);
    const migrado = migrarNotasParaHandouts(
      { notaMesa: texto("mesa"), notaMestre: texto("mestre") },
      pastas,
    );
    for (const pasta of migrado.pastas) {
      if (pastas.some((x) => x.id === pasta.id)) continue;
      sql.exec(
        "INSERT OR IGNORE INTO entidades (colecao, id, dados) VALUES ('pastas', ?, ?)",
        pasta.id,
        JSON.stringify(pasta),
      );
    }
    for (const h of migrado.handouts) {
      sql.exec(
        "INSERT OR IGNORE INTO entidades (colecao, id, dados) VALUES ('handouts', ?, ?)",
        h.id,
        JSON.stringify(h),
      );
    }
    sql.exec("DELETE FROM entidades WHERE colecao = 'notas'");
  },
  // C2: contas por mesa, sessões e os registros do limite de tentativas. Só tabelas novas, fora de
  // `entidades` (que a importação apaga e a exportação lê): nada aqui entra no estado da mesa, no snapshot,
  // em frame algum nem na exportação. O banco antigo (a campanha real) ganha as tabelas vazias.
  (sql) => {
    sql.exec(`CREATE TABLE IF NOT EXISTS contas (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL,
      login_norm TEXT NOT NULL UNIQUE,
      nome_exibicao TEXT NOT NULL,
      sal TEXT NOT NULL,
      hash TEXT NOT NULL,
      papel TEXT NOT NULL,
      usuario_id TEXT,
      status TEXT NOT NULL,
      criada_em INTEGER NOT NULL,
      ultimo_acesso INTEGER,
      redefinicao_ate INTEGER,
      redefinicao_pedida_em INTEGER,
      recusada_em INTEGER,
      falhas INTEGER NOT NULL DEFAULT 0,
      bloqueios INTEGER NOT NULL DEFAULT 0,
      bloqueada_ate INTEGER NOT NULL DEFAULT 0
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS sessoes (
      hash_token TEXT PRIMARY KEY,
      conta_id TEXT NOT NULL,
      criada_em INTEGER NOT NULL,
      ultimo_uso INTEGER NOT NULL,
      expira INTEGER NOT NULL
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes (conta_id)");
    sql.exec(`CREATE TABLE IF NOT EXISTS limites_ip (
      tipo TEXT NOT NULL,
      ip TEXT NOT NULL,
      em INTEGER NOT NULL
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS limites_ip_busca ON limites_ip (tipo, ip, em)");
  },
];

/** Um arquivo pré-enviado de uma cena. */
export type PacoteDeCena = Pacote & { cenaId: string };

/** Quem tem cópia de um asset: uma conexão de um usuário. */
export type Posse = { conexao: string; usuario: string };

/** Camada de persistência da sala sobre o SQLite do Durable Object. */
export class Armazenamento {
  constructor(private readonly sql: SqlStorage) {}

  /** Cria `meta` e aplica as migrações que faltam (a versão fica em `meta.versao_esquema`). */
  migrar(): void {
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT)");
    const atual = Number(this.lerMeta("versao_esquema") ?? "0");
    for (let v = atual; v < MIGRACOES.length; v++) {
      MIGRACOES[v]?.(this.sql);
      this.gravarMeta("versao_esquema", String(v + 1));
    }
  }

  // --- meta -------------------------------------------------------------------------------

  lerMeta(chave: string): string | null {
    const linha = this.sql
      .exec<{ valor: string }>("SELECT valor FROM meta WHERE chave = ?", chave)
      .toArray()[0];
    return linha?.valor ?? null;
  }

  gravarMeta(chave: string, valor: string): void {
    this.sql.exec("INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)", chave, valor);
  }

  lerUso(): UsoDoDia | null {
    const bruto = this.lerMeta("uso");
    return bruto ? (JSON.parse(bruto) as UsoDoDia) : null;
  }

  gravarUso(uso: UsoDoDia): void {
    this.gravarMeta("uso", JSON.stringify(uso));
  }

  // --- estado -------------------------------------------------------------------------------

  /** Carrega o estado da campanha, ou `null` se o banco está vazio (nunca foi semeado). */
  carregar(): Estado | null {
    const permissoes = this.lerMeta("permissoes");
    if (permissoes === null) return null;
    const salvas = JSON.parse(permissoes) as Permissoes;
    const usuarios = this.sql
      .exec<{ dados: string }>(
        "SELECT dados FROM entidades WHERE colecao = 'usuarios' ORDER BY rowid",
      )
      .toArray()
      .map((l) => JSON.parse(l.dados) as Usuario);
    return {
      seq: Number(this.lerMeta("seq") ?? "0"),
      usuarios,
      // Capacidades novas (lotes futuros) entram com o padrão sem perder o que já foi salvo.
      permissoes: { ...salvas, jogadores: { ...PERMISSOES_PADRAO, ...salvas.jogadores } },
      ...this.carregarMapa(),
      ...this.carregarCombate(),
      ...this.carregarCompendio(),
      desenhos: this.carregarDesenhos(),
    };
  }

  /** Cenas, tokens e assets. Banco do Lote 1 (sem cena): cria a cena padrão, sem quebrar o resto. */
  private carregarMapa(): Pick<
    Estado,
    | "cenas"
    | "cenaAtivaId"
    | "tokens"
    | "paredes"
    | "luzes"
    | "modelos"
    | "pontos"
    | "relogio"
    | "config"
    | "memoriaEsquecida"
    | "assets"
    | "personagens"
    | "pastas"
    | "handouts"
    | "ordemDeTurnoVisivel"
  > {
    const ler = <T>(colecao: string): T[] =>
      this.sql
        .exec<{ dados: string }>(
          "SELECT dados FROM entidades WHERE colecao = ? ORDER BY rowid",
          colecao,
        )
        .toArray()
        .map((l) => JSON.parse(l.dados) as T);
    const modelos = ler<ModeloDeObjeto>("modelos");
    const cenas = ler<Cena>("cenas");
    if (cenas.length === 0) cenas.push(CENA_PADRAO);
    const ativa = this.lerMeta("cena_ativa");
    const cenaAtivaId = cenas.some((c) => c.id === ativa)
      ? (ativa as string)
      : (cenas[0]?.id ?? CENA_PADRAO.id);
    return {
      cenas,
      cenaAtivaId,
      tokens: ler<Token>("tokens"),
      // Lote 5: banco anterior não tem a coleção (nada a migrar: `entidades` é genérica).
      paredes: ler<Parede>("paredes"),
      // Lote 6: coleção nova e configuração com padrão; banco anterior continua como estava.
      luzes: ler<unknown>("luzes").map(objetoDoBanco) satisfies ObjetoDeLuz[],
      modelos,
      pontos: ler<PontoDeLuz>("pontos"),
      relogio: this.lerRelogio(),
      config: configComPadrao(JSON.parse(this.lerMeta("config") ?? "{}")),
      memoriaEsquecida: JSON.parse(this.lerMeta("memoria_esquecida") ?? "{}") as Record<
        string,
        number
      >,
      // Banco anterior ao Lote 4: sem personagens, e continua funcionando.
      // Lote 9: a mochila do Lote 7 vira itens da ficha ao carregar (só leitura: a linha antiga só é
      // regravada quando o personagem mudar).
      personagens: ler<unknown>("personagens")
        .map(personagemDoBanco)
        .map((p) => absorverMochila(p, modelos)),
      pastas: ler<Pasta>("pastas").sort((a, b) => a.ordem - b.ordem),
      // V3: coleção nova (a migração cria as dos handouts vindos das notas); banco anterior: nenhum.
      handouts: ler<Handout>("handouts"),
      ordemDeTurnoVisivel: this.lerMeta("ordem_de_turno") === "1",
      assets: ler<AssetMeta>("assets"),
    };
  }

  /** Os desenhos gravados, na ordem de criação; linha ilegível é ignorada (nunca derruba a carga). */
  private carregarDesenhos(): Desenho[] {
    const desenhos: Desenho[] = [];
    const linhas = this.sql
      .exec<{ dados: string }>("SELECT dados FROM desenhos ORDER BY rowid")
      .toArray();
    for (const l of linhas) {
      try {
        const r = DesenhoSchema.safeParse(JSON.parse(l.dados));
        if (r.success) desenhos.push(r.data);
      } catch {
        // linha corrompida: o desenho se perde, a campanha continua
      }
    }
    return desenhos;
  }

  /** UPDATE primeiro para manter o rowid (a ordem de criação, que o "voltar" usa). */
  private gravarDesenho(d: Desenho): void {
    const json = JSON.stringify(d);
    const r = this.sql.exec(
      "UPDATE desenhos SET dados = ?, cena_id = ? WHERE id = ?",
      json,
      d.cenaId,
      d.id,
    );
    if (r.rowsWritten === 0) {
      this.sql.exec(
        "INSERT INTO desenhos (id, cena_id, dados) VALUES (?, ?, ?)",
        d.id,
        d.cenaId,
        json,
      );
    }
  }

  /** O combate gravado; linha ausente ou ilegível = sem combate (nunca quebra a carga). */
  private carregarCombate(): { combate?: Combate } {
    const linha = this.sql
      .exec<{ dados: string }>("SELECT dados FROM combate WHERE id = 1")
      .toArray()[0];
    if (!linha) return {};
    try {
      const r = CombateSchema.safeParse(JSON.parse(linha.dados));
      return r.success ? { combate: r.data } : {};
    } catch {
      return {};
    }
  }

  private gravarCombate(combate: Combate | undefined): void {
    if (combate === undefined) this.sql.exec("DELETE FROM combate");
    else {
      this.sql.exec(
        "INSERT OR REPLACE INTO combate (id, dados) VALUES (1, ?)",
        JSON.stringify(combate),
      );
    }
  }

  /**
   * O compêndio da mesa (Lote 14): só a referência ao asset, na tabela `meta` (sem migração: o banco antigo
   * simplesmente não tem a chave = sem compêndio). Nunca o texto das magias. Valor ilegível = sem compêndio.
   */
  private carregarCompendio(): { compendio?: CompendioDaMesa } {
    const bruto = this.lerMeta("compendio");
    if (bruto === null) return {};
    try {
      const r = CompendioDaMesaSchema.safeParse(JSON.parse(bruto));
      return r.success ? { compendio: r.data } : {};
    } catch {
      return {};
    }
  }

  private gravarCompendio(compendio: CompendioDaMesa | undefined): void {
    if (compendio === undefined) this.sql.exec("DELETE FROM meta WHERE chave = 'compendio'");
    else this.gravarMeta("compendio", JSON.stringify(compendio));
  }

  /** O relógio da sala; sem ele (banco antigo) a mesa está rodando e a sala preenche `desdeReal`. */
  private lerRelogio(): RelogioSala {
    const bruto = this.lerMeta("relogio");
    const r = bruto === null ? undefined : RelogioSalaSchema.safeParse(JSON.parse(bruto));
    return r?.success ? r.data : { pausada: false, acumuladoMs: 0 };
  }

  gravarRelogio(relogio: RelogioSala): void {
    this.gravarMeta("relogio", JSON.stringify(relogio));
  }

  private gravarEntidade(colecao: string, id: string, dados: unknown): void {
    const json = JSON.stringify(dados);
    // UPDATE primeiro para manter o rowid (a ordem dos usuários).
    const r = this.sql.exec(
      "UPDATE entidades SET dados = ? WHERE colecao = ? AND id = ?",
      json,
      colecao,
      id,
    );
    if (r.rowsWritten === 0) {
      this.sql.exec(
        "INSERT INTO entidades (colecao, id, dados) VALUES (?, ?, ?)",
        colecao,
        id,
        json,
      );
    }
  }

  /** Substitui o estado inteiro (semente, importação). */
  salvarTudo(estado: Estado): void {
    this.sql.exec("DELETE FROM entidades");
    for (const u of estado.usuarios) this.gravarEntidade("usuarios", u.id, u);
    for (const c of estado.cenas) this.gravarEntidade("cenas", c.id, c);
    for (const t of estado.tokens) this.gravarEntidade("tokens", t.id, t);
    for (const p of estado.paredes) this.gravarEntidade("paredes", p.id, p);
    for (const l of estado.luzes) this.gravarEntidade("luzes", l.id, l);
    for (const m of estado.modelos) this.gravarEntidade("modelos", m.id, m);
    for (const p of estado.pontos) this.gravarEntidade("pontos", p.id, p);
    this.gravarRelogio(estado.relogio);
    this.gravarMeta("config", JSON.stringify(estado.config));
    this.gravarMeta("memoria_esquecida", JSON.stringify(estado.memoriaEsquecida ?? {}));
    for (const p of estado.pastas) this.gravarEntidade("pastas", p.id, p);
    for (const p of estado.personagens) this.gravarEntidade("personagens", p.id, p);
    for (const h of estado.handouts) this.gravarEntidade("handouts", h.id, h);
    for (const a of estado.assets ?? []) this.gravarEntidade("assets", a.hash, a);
    this.gravarMeta("cena_ativa", estado.cenaAtivaId);
    this.gravarMeta("ordem_de_turno", estado.ordemDeTurnoVisivel ? "1" : "0");
    this.gravarCombate(estado.combate);
    this.gravarCompendio(estado.compendio);
    this.sql.exec("DELETE FROM desenhos");
    for (const d of estado.desenhos) this.gravarDesenho(d);
    this.gravarMeta("permissoes", JSON.stringify(estado.permissoes));
    this.gravarMeta("seq", String(estado.seq));
  }

  /** C2: as vagas mudaram fora de uma intenção (conta aceita, vaga nova, nome da vaga): grava as que mudaram. */
  gravarUsuarios(usuarios: Usuario[]): void {
    for (const u of usuarios) this.gravarEntidade("usuarios", u.id, u);
  }

  /** Grava só o que os eventos mudaram, mais o `seq`. */
  salvarEventos(estado: Estado, eventos: EventoSala[]): void {
    for (const ev of eventos) {
      switch (ev.tipo) {
        case "papel.alterado": {
          const u = estado.usuarios.find((x) => x.id === ev.dados.usuarioId);
          if (u) this.gravarEntidade("usuarios", u.id, u);
          break;
        }
        case "permissao.alterada":
          this.gravarMeta("permissoes", JSON.stringify(estado.permissoes));
          break;
        case "token.criado":
        case "token.editado":
          this.gravarEntidade("tokens", ev.dados.token.id, ev.dados.token);
          break;
        case "token.movido": {
          const t = estado.tokens.find((x) => x.id === ev.dados.id);
          if (t) this.gravarEntidade("tokens", t.id, t);
          break;
        }
        case "token.apagado":
        case "token.sumiu":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'tokens' AND id = ?", ev.dados.id);
          break;
        case "parede.criada":
        case "parede.editada":
          this.gravarEntidade("paredes", ev.dados.parede.id, ev.dados.parede);
          break;
        case "parede.apagada":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'paredes' AND id = ?", ev.dados.id);
          break;
        case "fonte.criada":
        case "fonte.editada":
          this.gravarEntidade("luzes", ev.dados.fonte.id, ev.dados.fonte);
          break;
        case "fonte.apagada":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'luzes' AND id = ?", ev.dados.id);
          break;
        case "config.alterada":
          this.gravarMeta("config", JSON.stringify(estado.config));
          break;
        case "mesa.pausada":
        case "mesa.retomada":
        case "mesa.relogioZerado":
          this.gravarRelogio(estado.relogio);
          break;
        case "modelo.alterado":
          this.gravarEntidade("modelos", ev.dados.modelo.id, ev.dados.modelo);
          break;
        case "modelo.apagado":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'modelos' AND id = ?", ev.dados.id);
          break;
        case "ponto.alterado":
          this.gravarEntidade("pontos", ev.dados.ponto.id, ev.dados.ponto);
          break;
        case "ponto.apagado":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'pontos' AND id = ?", ev.dados.id);
          break;
        case "memoria.esquecida":
          this.gravarMeta("memoria_esquecida", JSON.stringify(estado.memoriaEsquecida ?? {}));
          break;
        case "cena.gridAlterado":
        case "cena.mapaAlterado": {
          const c = estado.cenas.find((x) => x.id === ev.dados.cenaId);
          if (c) this.gravarEntidade("cenas", c.id, c);
          break;
        }
        case "asset.registrado":
          this.gravarEntidade("assets", ev.dados.meta.hash, ev.dados.meta);
          break;
        case "personagem.alterado":
          this.gravarEntidade("personagens", ev.dados.personagem.id, ev.dados.personagem);
          break;
        case "personagem.apagado":
          this.sql.exec(
            "DELETE FROM entidades WHERE colecao = 'personagens' AND id = ?",
            ev.dados.id,
          );
          break;
        case "pasta.alterada":
          this.gravarEntidade("pastas", ev.dados.pasta.id, ev.dados.pasta);
          break;
        case "pasta.apagada":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'pastas' AND id = ?", ev.dados.id);
          break;
        case "handout.alterado":
          this.gravarEntidade("handouts", ev.dados.handout.id, ev.dados.handout);
          break;
        case "handout.apagado":
          this.sql.exec("DELETE FROM entidades WHERE colecao = 'handouts' AND id = ?", ev.dados.id);
          break;
        case "ordemDeTurno.alterada":
          this.gravarMeta("ordem_de_turno", ev.dados.visivel ? "1" : "0");
          break;
        case "combate.alterado":
          this.gravarCombate(estado.combate);
          break;
        case "compendio.alterado":
          this.gravarCompendio(estado.compendio);
          break;
        case "desenho.criado":
          this.gravarDesenho(ev.dados.desenho);
          break;
        case "desenho.movido": {
          const d = estado.desenhos.find((x) => x.id === ev.dados.id);
          if (d) this.gravarDesenho(d);
          break;
        }
        case "desenho.apagado":
          this.sql.exec("DELETE FROM desenhos WHERE id = ?", ev.dados.id);
          break;
        case "desenho.limpo":
          this.sql.exec("DELETE FROM desenhos WHERE cena_id = ?", ev.dados.cenaId);
          break;
        case "chat.mensagem":
          this.gravarMensagem(ev.dados.mensagem);
          break;
        case "chat.limpo":
          this.limparChat();
          break;
        case "cena.criada":
        case "cena.editada":
          this.gravarEntidade("cenas", ev.dados.cena.id, ev.dados.cena);
          break;
        case "cena.apagada":
          this.sql.exec(
            "DELETE FROM entidades WHERE colecao = 'cenas' AND id = ?",
            ev.dados.cenaId,
          );
          // Os desenhos da cena vão com ela.
          this.sql.exec("DELETE FROM desenhos WHERE cena_id = ?", ev.dados.cenaId);
          break;
        case "grupo.movido": {
          this.gravarMeta("cena_ativa", estado.cenaAtivaId);
          // A luz presa a um token que mudou de cena vai junto.
          const movidos = new Set(ev.dados.tokens.map((t) => t.id));
          for (const l of estado.luzes) {
            if (l.portador.tipo === "token" && movidos.has(l.portador.tokenId)) {
              this.gravarEntidade("luzes", l.id, l);
            }
          }
          for (const { id } of ev.dados.tokens) {
            const t = estado.tokens.find((x) => x.id === id);
            if (t) this.gravarEntidade("tokens", t.id, t);
          }
          break;
        }
      }
    }
    this.gravarMeta("seq", String(estado.seq));
  }

  // --- chat -----------------------------------------------------------------------------------

  /** Grava a mensagem no histórico (sem limite de gravação: a tabela só cresce, até o mestre limpar). */
  gravarMensagem(m: Mensagem): void {
    this.sql.exec(
      "INSERT OR REPLACE INTO chat (seq, id, dados) VALUES (?, ?, ?)",
      m.seq,
      m.id,
      JSON.stringify(m),
    );
  }

  /**
   * Até `limite` mensagens com `seq` menor que `antesDoSeq` (sem valor: as mais recentes), da mais
   * nova para a mais antiga e SEM filtro: quem chama filtra pelo que o usuário pode ver.
   */
  chatAntes(antesDoSeq: number | null, limite: number): Mensagem[] {
    const linhas =
      antesDoSeq === null
        ? this.sql
            .exec<{ dados: string }>("SELECT dados FROM chat ORDER BY seq DESC LIMIT ?", limite)
            .toArray()
        : this.sql
            .exec<{ dados: string }>(
              "SELECT dados FROM chat WHERE seq < ? ORDER BY seq DESC LIMIT ?",
              antesDoSeq,
              limite,
            )
            .toArray();
    const mensagens: Mensagem[] = [];
    for (const l of linhas) {
      const lida = MensagemSchema.safeParse(JSON.parse(l.dados));
      if (lida.success) mensagens.push(lida.data);
    }
    return mensagens;
  }

  limparChat(): void {
    this.sql.exec("DELETE FROM chat");
  }

  /** Retratos usados em mensagens públicas (a sala libera a imagem a quem lê a mensagem). */
  retratosDoChat(): string[] {
    const retratos = new Set<string>();
    for (const m of this.chatAntes(null, 2000)) {
      if (m.visivelPara === "todos" && m.como?.retratoHash) retratos.add(m.como.retratoHash);
      if (retratos.size >= 200) break;
    }
    return [...retratos].reverse();
  }

  // --- posse de assets ------------------------------------------------------------------------

  /** Troca tudo o que a conexão tem pelo inventário que ela acabou de mandar. */
  substituirPosse(conexao: string, usuario: string, hashes: string[]): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ?", conexao);
    for (const hash of new Set(hashes)) {
      this.sql.exec(
        "INSERT INTO posse (conexao, usuario, hash) VALUES (?, ?, ?)",
        conexao,
        usuario,
        hash,
      );
    }
  }

  adicionarPosse(conexao: string, usuario: string, hash: string): void {
    this.sql.exec(
      "INSERT OR REPLACE INTO posse (conexao, usuario, hash) VALUES (?, ?, ?)",
      conexao,
      usuario,
      hash,
    );
  }

  removerPosse(conexao: string, hash: string): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ? AND hash = ?", conexao, hash);
  }

  /** Conexão fechada: ela não tem mais nada. */
  limparPosse(conexao: string): void {
    this.sql.exec("DELETE FROM posse WHERE conexao = ?", conexao);
  }

  /** Quem tem o hash, na ordem em que anunciou (estável). */
  possesDe(hash: string): Posse[] {
    return this.sql
      .exec<Posse>("SELECT conexao, usuario FROM posse WHERE hash = ? ORDER BY rowid", hash)
      .toArray();
  }

  /** Ao acordar: some a posse de conexões que não existem mais. */
  limparPosseOrfa(conexoesVivas: string[]): void {
    const vivas = new Set(conexoesVivas);
    const todas = this.sql
      .exec<{ conexao: string }>("SELECT DISTINCT conexao FROM posse")
      .toArray();
    for (const { conexao } of todas) if (!vivas.has(conexao)) this.limparPosse(conexao);
  }

  // --- preparos de cena ----------------------------------------------------------------------

  /** Guarda os pacotes de um preparo (preparar de novo só acrescenta o que falta). */
  guardarPreparo(cenaId: string, pacotes: Pacote[]): void {
    for (const p of pacotes) {
      this.sql.exec(
        "INSERT OR REPLACE INTO preparos (cena_id, hash_cifrado, hash_original, chave) VALUES (?, ?, ?, ?)",
        cenaId,
        p.hashCifrado,
        p.hashOriginal,
        p.chave,
      );
    }
  }

  preparos(): PacoteDeCena[] {
    return this.sql
      .exec<{ cena_id: string; hash_cifrado: string; hash_original: string; chave: string }>(
        "SELECT cena_id, hash_cifrado, hash_original, chave FROM preparos ORDER BY rowid",
      )
      .toArray()
      .map((l) => ({
        cenaId: l.cena_id,
        hashCifrado: l.hash_cifrado,
        hashOriginal: l.hash_original,
        chave: l.chave,
      }));
  }

  /** Descarta os preparos de uma cena (depois da ida do grupo, ou se a cena foi apagada). */
  descartarPreparos(cenaId: string): void {
    this.sql.exec("DELETE FROM preparos WHERE cena_id = ?", cenaId);
  }

  descartarTodosOsPreparos(): void {
    this.sql.exec("DELETE FROM preparos");
  }

  /** Apaga todo o estado (só para as rotas de teste). */
  apagarTudo(): void {
    this.sql.exec("DELETE FROM preparos");
    this.sql.exec("DELETE FROM combate");
    this.sql.exec("DELETE FROM desenhos");
    this.sql.exec("DELETE FROM chat");
    this.sql.exec("DELETE FROM posse");
    this.sql.exec("DELETE FROM entidades");
    this.sql.exec("DELETE FROM agenda");
    this.sql.exec("DELETE FROM meta WHERE chave <> 'versao_esquema'");
  }
}
