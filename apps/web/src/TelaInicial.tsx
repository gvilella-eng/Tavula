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
import { type FormEvent, useEffect, useState } from "react";
import { comRetentativa, criarMesa, listarMesasDoServidor } from "./api";
import { CampoDeConta } from "./contas/CampoDeConta";
import { IdDaMesa } from "./IdDaMesa";
import { Logo } from "./Logo";
import { lembrarMesa, lerMesasLembradas, ordenarMesasPorUso } from "./mesasLocais";
import { caminhoDaMesa, irPara } from "./rotas";

type MesaDaLista = { id: string; nome: string; legada?: boolean; ultimaVez?: number };

/** "agora", "há 5 min", "há 3 h" ou a data: quando a mesa foi aberta neste navegador. */
function quandoFoi(ms: number, agora = Date.now()): string {
  const min = Math.floor((agora - ms) / 60_000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return new Date(ms).toLocaleDateString("pt-BR");
}

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
    <form className="cartao-inicio" onSubmit={aoEnviar} data-testid="inicio-entrar">
      <h2>Entrar numa mesa</h2>
      <p className="nota">Cole o id ou o link que o mestre mandou.</p>
      <input
        type="text"
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
        <p className="nota erro" role="alert" data-testid="inicio-entrar-erro">
          {erro}
        </p>
      )}
      <div className="linha-botoes">
        <button type="submit" className="primario" data-testid="inicio-entrar-botao">
          Entrar
        </button>
      </div>
    </form>
  );
}

type Criada = { id: string; nome: string };

function CriarMesa() {
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [nomeDoMestre, setNomeDoMestre] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [criada, setCriada] = useState<Criada | null>(null);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (criando) return;
    // A senha nunca sai do navegador: o tamanho dela só se confere aqui (o servidor recebe a derivada).
    const falta =
      nomeDeExibicaoValido(nomeDoMestre) === null
        ? `Escreva o seu nome, de 1 a ${TAMANHO_MAXIMO_DO_NOME_DE_EXIBICAO} caracteres.`
        : loginValido(login) === null
          ? `O login tem de 3 a ${TAMANHO_MAXIMO_DO_LOGIN} caracteres: letras, números, ponto, hífen e sublinhado.`
          : (erroDaSenha(senha) ??
            (senha !== confirmar ? "A confirmação não é igual à senha." : null));
    if (falta) {
      setErro(falta);
      return;
    }
    setErro(null);
    setCriando(true);
    try {
      const mesa = await criarMesa(nome, { login, nome: nomeDoMestre, senha });
      lembrarMesa(mesa.id, mesa.nome);
      setCriada(mesa);
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

  if (criada) {
    return (
      <section className="cartao-inicio" data-testid="inicio-criada">
        <h2>Mesa criada</h2>
        <p className="nota">
          <strong>{criada.nome}</strong>. Dite ou mande este id para quem vai jogar:
        </p>
        <IdDaMesa id={criada.id} prefixo="inicio-criada" grande />
        <div className="linha-botoes">
          <button
            type="button"
            className="primario"
            data-testid="inicio-abrir-mesa"
            onClick={() => irPara(caminhoDaMesa(criada.id))}
          >
            Abrir a mesa
          </button>
          <button type="button" data-testid="inicio-criar-outra" onClick={() => setCriada(null)}>
            Criar outra
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="cartao-inicio" onSubmit={aoEnviar} data-testid="inicio-criar">
      <h2>Criar mesa</h2>
      <p className="nota">
        Uma mesa nova começa vazia: você é o mestre e entra com a conta que criar aqui.
      </p>
      <CampoDeConta
        testid="inicio-criar-nome"
        rotulo="Nome da mesa"
        valor={nome}
        aoMudar={setNome}
        maxLength={TAMANHO_MAXIMO_DO_NOME_DA_MESA}
      />
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
      {erro && (
        <p className="nota erro" role="alert" data-testid="inicio-criar-erro">
          {erro}
        </p>
      )}
      <div className="linha-botoes">
        <button
          type="submit"
          className="primario"
          disabled={criando || nome.trim() === ""}
          data-testid="inicio-criar-botao"
        >
          Criar
        </button>
      </div>
    </form>
  );
}

function MesasNesteComputador() {
  // `undefined`: ainda perguntando ao servidor.
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

  return (
    <section className="cartao-inicio largo" data-testid="inicio-mesas">
      <h2>Mesas neste computador</h2>
      {lista === undefined ? (
        <p className="nota">Procurando as mesas…</p>
      ) : lista.length === 0 ? (
        <p className="nota" data-testid="inicio-mesas-vazio">
          Nenhuma mesa aberta por aqui ainda. Crie uma ou entre com um id.
        </p>
      ) : (
        <ul className="inicio-lista" data-testid="inicio-mesas-lista">
          {lista.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="cartao-de-mesa"
                data-testid={`inicio-mesa-${m.id}`}
                onClick={() => irPara(caminhoDaMesa(m.id))}
              >
                <span className="cartao-de-mesa-nome">{m.nome}</span>
                <span className="cartao-de-mesa-id">{m.id}</span>
                {m.ultimaVez !== undefined && (
                  <span className="cartao-de-mesa-quando">{quandoFoi(m.ultimaVez)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A tela de `/`: entrar numa mesa pelo id, criar uma mesa e as mesas deste computador. */
export function TelaInicial() {
  return (
    <main className="inicio" data-testid="tela-inicial">
      <h1 className="entrada-logo">
        <Logo tamanho={56} />
      </h1>
      <p className="entrada-frase">Sua mesa de RPG, do seu jeito.</p>
      <div className="inicio-grade">
        <EntrarNumaMesa />
        <CriarMesa />
        <MesasNesteComputador />
      </div>
    </main>
  );
}
