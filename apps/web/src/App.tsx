import { useCallback, useEffect, useState } from "react";
import { iniciais } from "./Avatar";
import {
  comRetentativa,
  consultarMesa,
  type DadosDaMesa,
  entrar,
  listarUsuarios,
  sair,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "./api";
import { corDoTextoSobre } from "./contrasteDeCor";
import { Logo } from "./Logo";
import { Mesa } from "./Mesa";
import { lembrarMesa } from "./mesasLocais";
import { irPara, tituloDaMesa, useRota } from "./rotas";
import { TelaInicial } from "./TelaInicial";

/** (assumido) A tela de entrada ainda não sabe os papéis (a sala não os manda antes de entrar): o selo vale para o usuário semeado "mestre". */
function ehMestre(u: UsuarioDaEntrada): boolean {
  return u.id === "mestre";
}

const voltarAoInicio = () => irPara("/");

function TelaDeEntrada({
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
    <main className="entrada" data-testid="tela-de-entrada">
      <h1 className="entrada-logo">
        <Logo tamanho={56} />
      </h1>
      <p className="entrada-mesa" data-testid="entrada-nome-da-mesa">
        {mesa.nome}
      </p>
      <p className="entrada-frase">Quem senta à mesa hoje?</p>
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

/** Uma mesa já encontrada no servidor: a escolha de usuário de hoje e depois a Mesa. */
function MesaEncontrada({
  mesa,
  aoRenomear,
}: {
  mesa: DadosDaMesa;
  aoRenomear: (n: string) => void;
}) {
  // `undefined` = ainda perguntando à sala; `null` = ninguém entrou nesta mesa.
  const [usuario, setUsuario] = useState<UsuarioDaEntrada | null | undefined>(undefined);
  const [falha, setFalha] = useState<string | null>(null);

  // No `pnpm dev` a página pode abrir antes de a sala subir: espera em vez de mostrar erro.
  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(() => usuarioDaSessao(mesa.id), controle.signal)
      .then((u) => !controle.signal.aborted && setUsuario(u))
      .catch((e: Error) => !controle.signal.aborted && setFalha(e.message));
    return () => controle.abort();
  }, [mesa.id]);

  const aoSair = useCallback(async () => {
    await sair(mesa.id);
    setUsuario(null);
  }, [mesa.id]);
  const aoPerderSessao = useCallback(() => setUsuario(null), []);

  if (falha) return <p role="alert">{falha}</p>;
  if (usuario === undefined) return <p>Conectando à sala…</p>;
  if (usuario === null) return <TelaDeEntrada mesa={mesa} aoEntrar={setUsuario} />;
  return (
    <Mesa
      key={usuario.id}
      mesa={mesa}
      aoSair={aoSair}
      aoPerderSessao={aoPerderSessao}
      aoTrocarDeMesa={voltarAoInicio}
      aoRenomear={aoRenomear}
    />
  );
}

function MesaNaoEncontrada({ texto }: { texto: string }) {
  return (
    <main className="entrada" data-testid="mesa-inexistente">
      <h1 className="entrada-logo">
        <Logo tamanho={56} />
      </h1>
      <p className="entrada-frase">Não achei essa mesa.</p>
      <p className="nota" data-testid="mesa-inexistente-texto">
        {texto}
      </p>
      <button
        type="button"
        className="primario"
        data-testid="voltar-ao-inicio"
        onClick={voltarAoInicio}
      >
        Voltar ao início
      </button>
    </main>
  );
}

/** A rota `/m/<id>`: confere a mesa no servidor, mostra o nome na aba do navegador e a lembra neste navegador. */
function RotaDaMesa({ id, bruto }: { id: string | null; bruto: string }) {
  // `undefined`: consultando; `null`: não existe.
  const [mesa, setMesa] = useState<DadosDaMesa | null | undefined>(undefined);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setMesa(undefined);
    setFalha(null);
    const controle = new AbortController();
    comRetentativa(() => consultarMesa(id), controle.signal)
      .then((m) => {
        if (controle.signal.aborted) return;
        if (m) lembrarMesa(m.id, m.nome);
        setMesa(m);
      })
      .catch((e: Error) => {
        if (controle.signal.aborted) return;
        setFalha(e.message);
      });
    return () => controle.abort();
  }, [id]);

  // O título da aba é o nome da mesa.
  const nome = mesa?.nome;
  useEffect(() => {
    document.title = tituloDaMesa(nome);
    return () => {
      document.title = tituloDaMesa();
    };
  }, [nome]);

  const aoRenomear = useCallback((novo: string) => {
    setMesa((atual) => {
      if (atual) lembrarMesa(atual.id, novo);
      return atual ? { ...atual, nome: novo } : atual;
    });
  }, []);

  if (!id) {
    return (
      <MesaNaoEncontrada
        texto={`“${bruto.slice(0, 40)}” não é um id de mesa. O id tem 12 letras e números, como k7m2-qx9p-4tdn.`}
      />
    );
  }
  if (falha) return <p role="alert">{falha}</p>;
  if (mesa === undefined) return <p>Conectando à sala…</p>;
  if (mesa === null) {
    return <MesaNaoEncontrada texto={`Nenhuma mesa tem o id ${id}. Confira com quem mandou.`} />;
  }
  // `key`: trocar de mesa pelo histórico do navegador reinicia a tela.
  return <MesaEncontrada key={mesa.id} mesa={mesa} aoRenomear={aoRenomear} />;
}

export function App() {
  const rota = useRota();
  if (rota.tipo === "inicio") return <TelaInicial />;
  return <RotaDaMesa key={rota.id ?? rota.bruto} id={rota.id} bruto={rota.bruto} />;
}
