import {
  erroDaSenha,
  loginValido,
  nomeDeExibicaoValido,
  type SituacaoDaMesa,
  TAMANHO_MAXIMO_DA_SENHA,
  TAMANHO_MAXIMO_DO_LOGIN,
  TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO,
} from "@tabletop/shared";
import { type FormEvent, useEffect, useState } from "react";
import { iniciais } from "../Avatar";
import {
  comRetentativa,
  criarContaDoMestre,
  type DadosDaMesa,
  definirNovaSenha,
  entrar,
  entrarComConta,
  esqueciASenha,
  listarUsuarios,
  pedirParaEntrar,
  situacaoDaMesa,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "../api";
import { corDoTextoSobre } from "../contrasteDeCor";
import { Logo } from "../Logo";
import { irPara } from "../rotas";
import { CampoDeConta } from "./CampoDeConta";

type Visao = "entrar" | "pedir" | "esqueci" | "redefinir" | "mestre";

/** (assumido) A escolha de usuário de teste não sabe os papéis (a sala não os manda antes de entrar): o selo vale para a vaga "mestre". */
const ehMestre = (u: UsuarioDaEntrada) => u.id === "mestre";

const voltarAoInicio = () => irPara("/");

/** Confere os campos das contas no navegador (o servidor nunca vê a senha, então o tamanho dela só se confere aqui). */
function erroDosCampos(c: {
  nome?: string;
  login: string;
  senha?: string;
  confirmar?: string;
}): string | null {
  if (c.nome !== undefined && nomeDeExibicaoValido(c.nome) === null) {
    return `Escreva um nome de 1 a ${TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO} caracteres.`;
  }
  if (loginValido(c.login) === null) {
    return `O login tem de 3 a ${TAMANHO_MAXIMO_DO_LOGIN} caracteres: letras, números, ponto, hífen e sublinhado.`;
  }
  if (c.senha !== undefined) {
    const e = erroDaSenha(c.senha);
    if (e) return e;
    if (c.confirmar !== undefined && c.senha !== c.confirmar)
      return "A confirmação não é igual à senha.";
  }
  return null;
}

/** Os formulários de conta compartilham o envio: trava o botão, mostra o erro do servidor com o texto pronto. */
function useEnvio() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(acao: () => Promise<void>): Promise<boolean> {
    if (enviando) return false;
    setErro(null);
    setEnviando(true);
    try {
      await acao();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }
  return { erro, setErro, enviando, enviar };
}

function Erro({ texto, testid }: { texto: string | null; testid: string }) {
  if (!texto) return null;
  return (
    <p className="nota erro" role="alert" data-testid={testid}>
      {texto}
    </p>
  );
}

function FormEntrar({
  mesa,
  aoEntrar,
  aoEscolher,
}: {
  mesa: DadosDaMesa;
  aoEntrar: (u: UsuarioDaEntrada) => void;
  aoEscolher: (v: Visao) => void;
}) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (loginValido(login) === null || senha === "") {
      setErro("Login ou senha incorretos.");
      return;
    }
    const ok = await enviar(async () => {
      await entrarComConta(mesa.id, login, senha);
      const u = await usuarioDaSessao(mesa.id);
      if (!u) throw new Error("Não foi possível abrir a sessão. Tente de novo.");
      aoEntrar(u);
    });
    if (ok) setSenha("");
  }

  return (
    <form className="entrada-form" onSubmit={aoEnviar} data-testid="entrada-form-entrar">
      <CampoDeConta
        testid="entrada-login"
        rotulo="Login"
        valor={login}
        aoMudar={setLogin}
        autoComplete="username"
        maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
      />
      <CampoDeConta
        testid="entrada-senha"
        rotulo="Senha"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="current-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <Erro texto={erro} testid="entrada-erro" />
      <div className="linha-botoes">
        <button type="submit" className="primario" disabled={enviando} data-testid="entrada-entrar">
          Entrar
        </button>
      </div>
      <div className="entrada-links">
        <button
          type="button"
          className="link-da-entrada"
          data-testid="esqueci-link"
          onClick={() => aoEscolher("esqueci")}
        >
          Esqueci a senha
        </button>
        <button
          type="button"
          className="link-da-entrada"
          data-testid="mestre-esqueci-link"
          onClick={() => aoEscolher("mestre")}
        >
          Sou o mestre e esqueci a senha
        </button>
      </div>
    </form>
  );
}

function FormPedir({ mesa }: { mesa: DadosDaMesa }) {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviado, setEnviado] = useState(false);
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const falta = erroDosCampos({ nome, login, senha, confirmar });
    if (falta) {
      setErro(falta);
      return;
    }
    const ok = await enviar(() => pedirParaEntrar(mesa.id, { nome, login, senha }));
    if (ok) {
      setEnviado(true);
      setSenha("");
      setConfirmar("");
    }
  }

  if (enviado) {
    return (
      <p className="entrada-aviso" role="status" data-testid="pedir-enviado">
        Pedido enviado. O mestre precisa aceitar; depois entre com seu login e senha.
      </p>
    );
  }
  return (
    <form className="entrada-form" onSubmit={aoEnviar} data-testid="entrada-form-pedir">
      <CampoDeConta
        testid="pedir-nome"
        rotulo="Seu nome (como a mesa vai chamar você)"
        valor={nome}
        aoMudar={setNome}
        autoComplete="name"
        maxLength={TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO}
      />
      <CampoDeConta
        testid="pedir-login"
        rotulo="Login"
        valor={login}
        aoMudar={setLogin}
        autoComplete="username"
        maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
      />
      <CampoDeConta
        testid="pedir-senha"
        rotulo="Senha (pelo menos 5 caracteres)"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <CampoDeConta
        testid="pedir-confirmar"
        rotulo="Confirme a senha"
        tipo="password"
        valor={confirmar}
        aoMudar={setConfirmar}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <Erro texto={erro} testid="pedir-erro" />
      <div className="linha-botoes">
        <button type="submit" className="primario" disabled={enviando} data-testid="pedir-enviar">
          Pedir para entrar
        </button>
      </div>
    </form>
  );
}

function FormEsqueci({ mesa, aoEscolher }: { mesa: DadosDaMesa; aoEscolher: (v: Visao) => void }) {
  const [login, setLogin] = useState("");
  const [enviado, setEnviado] = useState(false);
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (loginValido(login) === null) {
      setErro("Escreva o seu login.");
      return;
    }
    if (await enviar(() => esqueciASenha(mesa.id, login))) setEnviado(true);
  }

  return (
    <form className="entrada-form" onSubmit={aoEnviar} data-testid="entrada-form-esqueci">
      <h2 className="entrada-subtitulo">Esqueci a senha</h2>
      {enviado ? (
        <p className="entrada-aviso" role="status" data-testid="esqueci-enviado">
          Se esse login existe, o mestre foi avisado. Confirme com ele, por voz ou mensagem, que é
          você. Quando ele liberar, volte aqui e defina a nova senha.
        </p>
      ) : (
        <>
          <p className="nota">
            O mestre recebe o pedido e libera uma nova senha por 30 minutos. Ele vai pedir que você
            confirme, por voz ou mensagem, que é você mesmo.
          </p>
          <CampoDeConta
            testid="esqueci-login"
            rotulo="Login"
            valor={login}
            aoMudar={setLogin}
            autoComplete="username"
            maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
          />
          <Erro texto={erro} testid="esqueci-erro" />
          <div className="linha-botoes">
            <button
              type="submit"
              className="primario"
              disabled={enviando}
              data-testid="esqueci-enviar"
            >
              Avisar o mestre
            </button>
          </div>
        </>
      )}
      <div className="entrada-links">
        <button
          type="button"
          className="link-da-entrada"
          data-testid="redefinir-link"
          onClick={() => aoEscolher("redefinir")}
        >
          O mestre já liberou: definir nova senha
        </button>
        <button
          type="button"
          className="link-da-entrada"
          data-testid="esqueci-voltar"
          onClick={() => aoEscolher("entrar")}
        >
          Voltar
        </button>
      </div>
    </form>
  );
}

function FormRedefinir({
  mesa,
  aoEntrar,
  aoEscolher,
}: {
  mesa: DadosDaMesa;
  aoEntrar: (u: UsuarioDaEntrada) => void;
  aoEscolher: (v: Visao) => void;
}) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const falta = erroDosCampos({ login, senha, confirmar });
    if (falta) {
      setErro(falta);
      return;
    }
    await enviar(async () => {
      await definirNovaSenha(mesa.id, login, senha);
      const u = await usuarioDaSessao(mesa.id);
      if (u) aoEntrar(u);
      else aoEscolher("entrar");
    });
  }

  return (
    <form className="entrada-form" onSubmit={aoEnviar} data-testid="entrada-form-redefinir">
      <h2 className="entrada-subtitulo">Definir nova senha</h2>
      <p className="nota">Vale só depois de o mestre liberar, e por 30 minutos.</p>
      <CampoDeConta
        testid="redefinir-login"
        rotulo="Login"
        valor={login}
        aoMudar={setLogin}
        autoComplete="username"
        maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
      />
      <CampoDeConta
        testid="redefinir-senha"
        rotulo="Nova senha (pelo menos 5 caracteres)"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <CampoDeConta
        testid="redefinir-confirmar"
        rotulo="Confirme a nova senha"
        tipo="password"
        valor={confirmar}
        aoMudar={setConfirmar}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <Erro texto={erro} testid="redefinir-erro" />
      <div className="linha-botoes">
        <button
          type="submit"
          className="primario"
          disabled={enviando}
          data-testid="redefinir-enviar"
        >
          Definir nova senha
        </button>
        <button type="button" data-testid="redefinir-voltar" onClick={() => aoEscolher("entrar")}>
          Voltar
        </button>
      </div>
    </form>
  );
}

/** O lugar do mestre que esqueceu a senha: a recuperação dele (pasta e código) é do C3. */
function MestreEsqueci({ aoEscolher }: { aoEscolher: (v: Visao) => void }) {
  return (
    <div className="entrada-form" data-testid="entrada-mestre-esqueci">
      <h2 className="entrada-subtitulo">Sou o mestre e esqueci a senha</h2>
      <p className="entrada-aviso" data-testid="mestre-esqueci-texto">
        Em breve: a recuperação da conta do mestre ainda não existe.
      </p>
      <div className="linha-botoes">
        <button
          type="button"
          data-testid="mestre-esqueci-voltar"
          onClick={() => aoEscolher("entrar")}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

/** A mesa legada ainda sem conta de mestre: só de uma requisição local o servidor aceita criar. */
function CriarContaDoMestre({
  mesa,
  aoEntrar,
}: {
  mesa: DadosDaMesa;
  aoEntrar: (u: UsuarioDaEntrada) => void;
}) {
  const [login, setLogin] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const { erro, setErro, enviando, enviar } = useEnvio();

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    const falta = erroDosCampos({ nome, login, senha, confirmar });
    if (falta) {
      setErro(falta);
      return;
    }
    await enviar(async () => {
      await criarContaDoMestre(mesa.id, { login, nome, senha });
      const u = await usuarioDaSessao(mesa.id);
      if (!u) throw new Error("Não foi possível abrir a sessão. Tente de novo.");
      aoEntrar(u);
    });
  }

  return (
    <form
      className="entrada-form entrada-cartao destaque"
      onSubmit={aoEnviar}
      data-testid="entrada-mestre-inicial"
    >
      <h2 className="entrada-subtitulo">Criar a conta do mestre desta mesa</h2>
      <p className="nota">
        Esta mesa ainda não tem dono. A conta fica ligada à vaga do mestre que já existe, com tudo o
        que está nela. Depois, cada jogador pede para entrar e você liga cada um à vaga dele.
      </p>
      <CampoDeConta
        testid="mestre-inicial-login"
        rotulo="Login"
        valor={login}
        aoMudar={setLogin}
        autoComplete="username"
        maxLength={TAMANHO_MAXIMO_DO_LOGIN + 8}
      />
      <CampoDeConta
        testid="mestre-inicial-nome"
        rotulo="Seu nome"
        valor={nome}
        aoMudar={setNome}
        autoComplete="name"
        maxLength={TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO}
      />
      <CampoDeConta
        testid="mestre-inicial-senha"
        rotulo="Senha (pelo menos 5 caracteres)"
        tipo="password"
        valor={senha}
        aoMudar={setSenha}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <CampoDeConta
        testid="mestre-inicial-confirmar"
        rotulo="Confirme a senha"
        tipo="password"
        valor={confirmar}
        aoMudar={setConfirmar}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_DA_SENHA}
      />
      <Erro texto={erro} testid="mestre-inicial-erro" />
      <div className="linha-botoes">
        <button
          type="submit"
          className="primario"
          disabled={enviando}
          data-testid="mestre-inicial-criar"
        >
          Criar a conta do mestre
        </button>
      </div>
    </form>
  );
}

/** A escolha de usuário de desenvolvimento: só existe com `MODO=teste` (os E2E antigos entram por ela). */
function EntradaDeTeste({
  mesa,
  aoEntrar,
}: {
  mesa: DadosDaMesa;
  aoEntrar: (u: UsuarioDaEntrada) => void;
}) {
  const [usuarios, setUsuarios] = useState<UsuarioDaEntrada[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(() => listarUsuarios(mesa.id), controle.signal)
      .then((lista) => !controle.signal.aborted && setUsuarios(lista))
      .catch((e: Error) => !controle.signal.aborted && setFalha(e.message));
    return () => controle.abort();
  }, [mesa.id]);

  async function escolher(u: UsuarioDaEntrada) {
    try {
      await entrar(mesa.id, u.id);
      aoEntrar(u);
    } catch (e) {
      setFalha((e as Error).message);
    }
  }

  return (
    <section className="entrada-teste" data-testid="entrada-de-teste">
      <p className="entrada-frase pequena">Quem senta à mesa hoje? (modo de teste)</p>
      {falha && <p role="alert">{falha}</p>}
      <ul className="entrada-usuarios" data-testid="lista-usuarios">
        {usuarios?.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="cartao-de-usuario"
              data-testid={`entrar-${u.id}`}
              onClick={() => escolher(u)}
            >
              <span
                className="avatar-entrada"
                style={{ background: u.cor, color: corDoTextoSobre(u.cor) }}
                aria-hidden="true"
              >
                {iniciais(u.nome)}
              </span>
              <span className="cartao-de-usuario-nome">{u.nome}</span>
              {ehMestre(u) && <span className="selo-mestre">Mestre</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A tela de `/m/<id>` sem sessão: o nome da mesa no topo e as abas "Entrar" e "Pedir para entrar". Os
 * formulários mandam só a senha já esticada (PBKDF2): ela nunca sai do navegador.
 */
export function EntradaDaMesa({
  mesa,
  aoEntrar,
}: {
  mesa: DadosDaMesa;
  aoEntrar: (u: UsuarioDaEntrada) => void;
}) {
  const [situacao, setSituacao] = useState<SituacaoDaMesa | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("entrar");

  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(() => situacaoDaMesa(mesa.id), controle.signal)
      .then((s) => !controle.signal.aborted && setSituacao(s))
      .catch((e: Error) => !controle.signal.aborted && setFalha(e.message));
    return () => controle.abort();
  }, [mesa.id]);

  const nasAbas = visao === "entrar" || visao === "pedir";

  return (
    <main className="entrada" data-testid="tela-de-entrada">
      <h1 className="entrada-logo">
        <Logo tamanho={56} />
      </h1>
      <p className="entrada-mesa" data-testid="entrada-nome-da-mesa">
        {mesa.nome}
      </p>
      {falha && <p role="alert">{falha}</p>}
      {situacao?.semMestre && situacao.podeCriarMestre && (
        <CriarContaDoMestre mesa={mesa} aoEntrar={aoEntrar} />
      )}
      {situacao?.semMestre && !situacao.podeCriarMestre && !situacao.modoTeste && (
        <p className="entrada-aviso" data-testid="entrada-sem-mestre">
          Esta mesa ainda não tem mestre.
        </p>
      )}
      {situacao && (!situacao.semMestre || situacao.modoTeste) && (
        <div className="entrada-cartao" data-testid="entrada-cartao">
          {nasAbas && (
            <div className="abas-de-entrada" role="tablist" aria-label="Como entrar">
              {(
                [
                  ["entrar", "Entrar"],
                  ["pedir", "Pedir para entrar"],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={visao === id}
                  className="aba-de-entrada"
                  data-testid={`entrada-aba-${id}`}
                  onClick={() => setVisao(id)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}
          {visao === "entrar" && (
            <FormEntrar mesa={mesa} aoEntrar={aoEntrar} aoEscolher={setVisao} />
          )}
          {visao === "pedir" && <FormPedir mesa={mesa} />}
          {visao === "esqueci" && <FormEsqueci mesa={mesa} aoEscolher={setVisao} />}
          {visao === "redefinir" && (
            <FormRedefinir mesa={mesa} aoEntrar={aoEntrar} aoEscolher={setVisao} />
          )}
          {visao === "mestre" && <MestreEsqueci aoEscolher={setVisao} />}
        </div>
      )}
      {situacao?.modoTeste && <EntradaDeTeste mesa={mesa} aoEntrar={aoEntrar} />}
      <button
        type="button"
        className="entrada-trocar-de-mesa"
        data-testid="entrada-trocar-de-mesa"
        onClick={voltarAoInicio}
      >
        Trocar de mesa
      </button>
    </main>
  );
}
