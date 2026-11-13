import {
  erroDaSenha,
  loginValido,
  nomeDeExibicaoValido,
  normalizarIdDeMesa,
  TAMANHO_MAXIMO_DA_SENHA,
  TAMANHO_MAXIMO_DO_LOGIN,
  TAMANHO_MAXIMO_DO_NOME_DA_MESA,
  TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO,
} from "@tabletop/shared";
import { ArrowRight, FolderOpen, LogIn } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { comRetentativa, criarMesa, listarMesasDoServidor, type MesaCriada } from "./api";
import { CampoDeConta } from "./contas/CampoDeConta";
import { CodigoDeRecuperacao } from "./contas/CodigoDeRecuperacao";
import {
  conferirPastaLivreParaMesa,
  escolherPastaDoMestre,
  navegadorEscolhePasta,
  type PastaDoMestre,
  prepararChave,
  TEXTO_SO_CHROME_E_EDGE,
} from "./contas/pastaDoMestre";
import { IdDaMesa } from "./IdDaMesa";
import { Logo } from "./Logo";
import { lembrarMesa, lerMesasLembradas, ordenarMesasPorUso } from "./mesasLocais";
import { caminhoDaMesa, irPara } from "./rotas";

type MesaDaLista = { id: string; nome: string; legada?: boolean; ultimaVez?: number };

const MS_DO_DIA = 86_400_000;

/** "aberta hoje", "ontem", "há N dias" ou a data: quando a mesa foi aberta neste navegador. */
function quandoFoi(ms: number, agora = Date.now()): string {
  const diaDe = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const dias = Math.round((diaDe(agora) - diaDe(ms)) / MS_DO_DIA);
  if (dias <= 0) return "aberta hoje";
  if (dias === 1) return "ontem";
  if (dias <= 30) return `há ${dias} dias`;
  return new Date(ms).toLocaleDateString("pt-BR");
}

/** As mesas deste computador: as do servidor (só no desenvolvimento) ou as que este navegador já abriu. `undefined` enquanto procura. */
function useMesasDoComputador(): MesaDaLista[] | undefined {
  const [lista, setLista] = useState<MesaDaLista[] | undefined>(undefined);

  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(listarMesasDoServidor, controle.signal)
      .then((mesas) => {
        if (controle.signal.aborted) return;
        // O servidor só lista no desenvolvimento; sem lista dele valem as mesas que este navegador já abriu.
        // Em ordem de último uso neste navegador; as nunca abertas por aqui depois, a legada primeiro.
        if (mesas === null) {
          setLista(lerMesasLembradas());
          return;
        }
        const usos = new Map(lerMesasLembradas().map((m) => [m.id, m.ultimaVez]));
        setLista(
          ordenarMesasPorUso(
            mesas.map((m) => {
              const ultimaVez = usos.get(m.id);
              return ultimaVez === undefined ? m : { ...m, ultimaVez };
            }),
          ),
        );
      })
      .catch(() => !controle.signal.aborted && setLista(lerMesasLembradas()));
    return () => controle.abort();
  }, []);

  return lista;
}

type Aba = "mesas" | "entrar" | "criar";

function EntrarNumaMesa() {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const id = normalizarIdDeMesa(texto);
    if (!id) {
      setErro("Esse id não parece certo. Ele tem 12 letras e números, como k7m2-qx9p-4tdn.");
      return;
    }
    irPara(caminhoDaMesa(id));
  }

  return (
    <form className="inicio-painel" onSubmit={aoEnviar} data-testid="inicio-entrar">
      <div className="inicio-painel-corpo">
        <h2 className="inicio-titulo">Entrar numa mesa</h2>
        <p className="nota inicio-nota">Cole o id ou o link que o mestre mandou.</p>
        <input
          type="text"
          className="inicio-campo-grande"
          aria-label="Id ou link da mesa"
          placeholder="k7m2-qx9p-4tdn"
          autoComplete="off"
          spellCheck={false}
          value={texto}
          data-testid="inicio-entrar-campo"
          onChange={(e) => {
            setTexto(e.target.value);
            setErro(null);
          }}
        />
        {erro && (
          <p className="nota erro inicio-nota" role="alert" data-testid="inicio-entrar-erro">
            {erro}
          </p>
        )}
        <button
          type="submit"
          className="primario inicio-botao-largo"
          data-testid="inicio-entrar-botao"
        >
          <LogIn size={18} aria-hidden="true" />
          Entrar
        </button>
      </div>
    </form>
  );
}

type Criada = MesaCriada & { comPasta: boolean };

/** Escolher (ou criar) a pasta da mesa: ela guarda a chave do mestre e as imagens. Opcional. */
function EscolhaDaPasta({
  pasta,
  aoEscolher,
}: {
  pasta: PastaDoMestre | null;
  aoEscolher: (p: PastaDoMestre | null) => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const possivel = navegadorEscolhePasta();

  async function escolher() {
    setErro(null);
    try {
      const nova = await escolherPastaDoMestre();
      if (!nova) return;
      // Uma pasta que já guarda a chave de outra mesa não serve: gravar por cima apagaria a prova de mestre dela.
      await conferirPastaLivreParaMesa(nova, "");
      aoEscolher(nova);
    } catch (e) {
      aoEscolher(null);
      setErro((e as Error).message);
    }
  }

  return (
    <div className="inicio-pasta" data-testid="inicio-criar-pasta-bloco">
      <p className="nota inicio-nota">
        A pasta guarda a chave que prova que você é o mestre (para recuperar o acesso se esquecer a
        senha) e as imagens da mesa. Escolha uma pasta existente ou crie uma nova no seletor. A
        chave nunca sai do seu computador.
      </p>
      {possivel ? (
        <div className="linha-botoes">
          <button type="button" data-testid="inicio-criar-pasta" onClick={escolher}>
            <FolderOpen size={16} aria-hidden="true" />
            {pasta ? "Trocar a pasta" : "Escolher a pasta"}
          </button>
          {pasta && (
            <span className="nota inicio-nota" data-testid="inicio-criar-pasta-nome">
              Pasta: {pasta.nome}
            </span>
          )}
        </div>
      ) : (
        <p className="nota inicio-nota" data-testid="inicio-criar-pasta-indisponivel">
          {TEXTO_SO_CHROME_E_EDGE} Sem ela, a mesa nasce sem a chave; o código de recuperação vale
          do mesmo jeito.
        </p>
      )}
      {erro && (
        <p className="nota erro inicio-nota" role="alert" data-testid="inicio-criar-pasta-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

/** O que o cartão mostra depois de criar a mesa: o id para ditar, o código de recuperação e o botão de entrar. */
function CartaoMesaCriada({ criada, aoCriarOutra }: { criada: Criada; aoCriarOutra: () => void }) {
  const [anotado, setAnotado] = useState(false);
  const trava = !!criada.codigo && !anotado;
  return (
    <section className="inicio-painel" data-testid="inicio-criada">
      <div className="inicio-painel-corpo">
        <h2 className="inicio-titulo">Mesa criada</h2>
        <p className="nota inicio-nota">
          <strong>{criada.nome}</strong>. Dite ou mande este id para quem vai jogar:
        </p>
        <IdDaMesa id={criada.id} prefixo="inicio-criada" grande />
        <p className="nota inicio-nota" data-testid="inicio-criada-pasta">
          {criada.comPasta
            ? "A chave do mestre foi gravada no arquivo tavola-mestre.json da pasta. Não compartilhe esse arquivo."
            : "Esta mesa ficou sem a chave da pasta. Dá para protegê-la depois, na aba Mesa, em Contas."}
        </p>
        {criada.codigo && (
          <CodigoDeRecuperacao
            codigo={criada.codigo}
            mesaNome={criada.nome}
            anotado={anotado}
            aoMudarAnotei={setAnotado}
          />
        )}
      </div>
      <div className="inicio-painel-rodape com-divisor">
        <div className="linha-botoes fim">
          <button
            type="button"
            disabled={trava}
            data-testid="inicio-criar-outra"
            onClick={aoCriarOutra}
          >
            Criar outra
          </button>
          <button
            type="button"
            className="primario"
            disabled={trava}
            data-testid="inicio-abrir-mesa"
            onClick={() => irPara(caminhoDaMesa(criada.id))}
          >
            Abrir a mesa
          </button>
        </div>
      </div>
    </section>
  );
}

function CriarMesa({ ativa, aoCriar }: { ativa: boolean; aoCriar: (c: Criada) => void }) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [nomeDoMestre, setNomeDoMestre] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [pasta, setPasta] = useState<PastaDoMestre | null>(null);

  // Trocar de aba volta ao passo 1, mas o que foi digitado fica. (assumido)
  useEffect(() => {
    if (!ativa) {
      setPasso(1);
      setErro(null);
    }
  }, [ativa]);

  /** A senha nunca sai do navegador: o tamanho dela só se confere aqui (o servidor recebe a derivada). */
  function faltaNoPasso1(): string | null {
    return nomeDeExibicaoValido(nomeDoMestre) === null
      ? `Escreva o seu nome, de 1 a ${TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO} caracteres.`
      : loginValido(login) === null
        ? `O login tem de 3 a ${TAMANHO_MAXIMO_DO_LOGIN} caracteres: letras, números, ponto, hífen e sublinhado.`
        : (erroDaSenha(senha) ??
          (senha !== confirmar ? "A confirmação não é igual à senha." : null));
  }

  async function criar() {
    if (criando) return;
    setErro(null);
    setCriando(true);
    try {
      // A chave é gerada aqui e a privada vai para a pasta ANTES de a mesa existir (a pública é a única coisa que
      // o servidor recebe): assim a mesa nunca fica com uma chave registrada sem arquivo.
      const mesa = await criarMesa(
        nome,
        { login, nome: nomeDoMestre, senha },
        pasta
          ? async (id) => {
              const chave = await prepararChave(pasta, { id, nome: nome.trim() });
              await chave.gravar();
              return chave.publica;
            }
          : undefined,
      );
      if (pasta) await pasta.lembrarPara(mesa.id).catch(() => {});
      lembrarMesa(mesa.id, mesa.nome);
      aoCriar({ ...mesa, comPasta: pasta !== null });
      setPasta(null);
      setPasso(1);
      setNome("");
      setLogin("");
      setNomeDoMestre("");
      setSenha("");
      setConfirmar("");
    } catch (falha) {
      setErro((falha as Error).message);
    } finally {
      setCriando(false);
    }
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (passo === 2) {
      void criar();
      return;
    }
    if (nome.trim() === "") return;
    const falta = faltaNoPasso1();
    if (falta) {
      setErro(falta);
      return;
    }
    setErro(null);
    setPasso(2);
  }

  return (
    <form className="inicio-painel" onSubmit={aoEnviar} data-testid="inicio-criar">
      <div className="inicio-painel-corpo">
        <div className="inicio-passos">
          <span className="nota inicio-nota" data-testid="inicio-criar-passo">
            Passo {passo} de 2
          </span>
          <span className="inicio-bolinhas" aria-hidden="true">
            <span className={passo === 1 ? "ativa" : undefined} />
            <span className={passo === 2 ? "ativa" : undefined} />
          </span>
        </div>
        {passo === 1 ? (
          <>
            <h2 className="inicio-titulo">Mesa e conta</h2>
            <div className="inicio-grade-de-campos">
              <div className="inteira">
                <CampoDeConta
                  testid="inicio-criar-nome"
                  rotulo="Nome da mesa"
                  valor={nome}
                  aoMudar={setNome}
                  maxLength={TAMANHO_MAXIMO_DO_NOME_DA_MESA}
                />
              </div>
              <CampoDeConta
                testid="inicio-criar-login"
                rotulo="Seu login de mestre"
                valor={login}
                aoMudar={setLogin}
                autoComplete="username"
                maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
              />
              <CampoDeConta
                testid="inicio-criar-nome-do-mestre"
                rotulo="Seu nome"
                valor={nomeDoMestre}
                aoMudar={setNomeDoMestre}
                autoComplete="name"
                maxLength={TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO}
              />
              <CampoDeConta
                testid="inicio-criar-senha"
                rotulo="Senha (pelo menos 5 caracteres)"
                tipo="password"
                valor={senha}
                aoMudar={setSenha}
                autoComplete="new-password"
                maxLength={TAMANHO_MAXIMO_DA_SENHA}
              />
              <CampoDeConta
                testid="inicio-criar-confirmar"
                rotulo="Confirme a senha"
                tipo="password"
                valor={confirmar}
                aoMudar={setConfirmar}
                autoComplete="new-password"
                maxLength={TAMANHO_MAXIMO_DA_SENHA}
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="inicio-titulo">Pasta da mesa</h2>
            <EscolhaDaPasta pasta={pasta} aoEscolher={setPasta} />
          </>
        )}
      </div>
      <div className="inicio-painel-rodape">
        {erro && (
          <p className="nota erro inicio-nota" role="alert" data-testid="inicio-criar-erro">
            {erro}
          </p>
        )}
        <div className="linha-botoes fim">
          {passo === 1 ? (
            <button
              key="continuar"
              type="submit"
              className="primario"
              disabled={nome.trim() === ""}
              data-testid="inicio-criar-continuar"
            >
              Continuar
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <>
              <button
                key="voltar"
                type="button"
                data-testid="inicio-criar-voltar"
                onClick={() => {
                  setErro(null);
                  setPasso(1);
                }}
              >
                Voltar
              </button>
              <button
                key="criar"
                type="submit"
                className="primario"
                disabled={criando}
                data-testid="inicio-criar-botao"
              >
                Criar
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function MinhasMesas({
  lista,
  irParaAba,
}: {
  lista: MesaDaLista[] | undefined;
  irParaAba: (aba: Aba) => void;
}) {
  return (
    <section className="inicio-painel" data-testid="inicio-mesas">
      <div className="inicio-painel-corpo">
        {lista === undefined ? (
          <div className="inicio-lista" aria-busy="true" data-testid="inicio-mesas-carregando">
            <span className="visualmente-oculto">Procurando as mesas…</span>
            {[0, 1, 2].map((i) => (
              <div key={i} className="inicio-esqueleto" aria-hidden="true" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="inicio-vazio">
            <p className="nota inicio-nota" data-testid="inicio-mesas-vazio">
              Nenhuma mesa neste computador ainda.
            </p>
            <div className="linha-botoes">
              <button
                type="button"
                data-testid="inicio-mesas-ir-entrar"
                onClick={() => irParaAba("entrar")}
              >
                Entrar com código
              </button>
              <button
                type="button"
                className="primario"
                data-testid="inicio-mesas-ir-criar"
                onClick={() => irParaAba("criar")}
              >
                Criar mesa
              </button>
            </div>
          </div>
        ) : (
          <ul className="inicio-lista" data-testid="inicio-mesas-lista">
            {lista.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="inicio-mesa"
                  data-testid={`inicio-mesa-${m.id}`}
                  onClick={() => irPara(caminhoDaMesa(m.id))}
                >
                  <span className="inicio-mesa-inicial" aria-hidden="true">
                    {m.nome.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="inicio-mesa-textos">
                    <span className="inicio-mesa-nome">{m.nome}</span>
                    <span className="inicio-mesa-id">{m.id}</span>
                  </span>
                  {m.ultimaVez !== undefined && (
                    <span className="inicio-mesa-quando">{quandoFoi(m.ultimaVez)}</span>
                  )}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const ABAS: readonly Aba[] = ["mesas", "entrar", "criar"];

/** A tela de `/`: um cartão com abas para abrir uma mesa deste computador, entrar com um código ou criar uma mesa. */
export function TelaInicial() {
  const lista = useMesasDoComputador();
  const [escolhida, setEscolhida] = useState<Aba | null>(null);
  const [criada, setCriada] = useState<Criada | null>(null);
  const prefixo = useId();
  const barra = useRef<HTMLDivElement>(null);
  // Sem escolha do usuário: "Minhas mesas" se houver mesas por aqui; senão, "Entrar com código". (assumido)
  const aba: Aba = escolhida ?? (lista !== undefined && lista.length === 0 ? "entrar" : "mesas");
  const rotulos: Record<Aba, string> = {
    mesas: lista === undefined ? "Minhas mesas" : `Minhas mesas (${lista.length})`,
    entrar: "Entrar com código",
    criar: "Criar mesa",
  };

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ABAS.indexOf(aba);
    const alvo =
      e.key === "ArrowRight"
        ? (i + 1) % ABAS.length
        : e.key === "ArrowLeft"
          ? (i + ABAS.length - 1) % ABAS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? ABAS.length - 1
              : -1;
    if (alvo < 0) return;
    e.preventDefault();
    setEscolhida(ABAS[alvo] as Aba);
    barra.current?.querySelectorAll<HTMLElement>('[role="tab"]')[alvo]?.focus();
  }

  return (
    <main className="inicio" data-testid="tela-inicial">
      <div className="inicio-coluna">
        <header className={criada ? "inicio-cabecalho compacto" : "inicio-cabecalho"}>
          <h1 className="entrada-logo">
            <Logo tamanho={56} />
          </h1>
          <p className="entrada-frase">Sua mesa de RPG, do seu jeito.</p>
        </header>
        <div className={criada ? "inicio-cartao criada" : "inicio-cartao"}>
          {criada ? (
            <CartaoMesaCriada criada={criada} aoCriarOutra={() => setCriada(null)} />
          ) : (
            <>
              <div ref={barra} className="inicio-abas" role="tablist" aria-label="Escolha uma ação">
                {ABAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="tab"
                    id={`${prefixo}-aba-${a}`}
                    aria-selected={aba === a}
                    aria-controls={`${prefixo}-painel-${a}`}
                    tabIndex={aba === a ? 0 : -1}
                    className="inicio-aba"
                    data-testid={`inicio-aba-${a}`}
                    onClick={() => setEscolhida(a)}
                    onKeyDown={aoTeclar}
                  >
                    {rotulos[a]}
                  </button>
                ))}
              </div>
              {ABAS.map((a) => (
                <div
                  key={a}
                  role="tabpanel"
                  id={`${prefixo}-painel-${a}`}
                  aria-labelledby={`${prefixo}-aba-${a}`}
                  className="inicio-aba-painel"
                  hidden={aba !== a}
                >
                  {a === "mesas" ? (
                    <MinhasMesas lista={lista} irParaAba={setEscolhida} />
                  ) : a === "entrar" ? (
                    <EntrarNumaMesa />
                  ) : (
                    <CriarMesa ativa={aba === "criar"} aoCriar={setCriada} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
