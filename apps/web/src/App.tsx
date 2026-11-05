import { useCallback, useEffect, useState } from "react";
import {
  comRetentativa,
  entrar,
  listarUsuarios,
  sair,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "./api";
import { Mesa } from "./Mesa";

function TelaDeEntrada({ aoEntrar }: { aoEntrar: (u: UsuarioDaEntrada) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioDaEntrada[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(listarUsuarios, controle.signal)
      .then((lista) => !controle.signal.aborted && setUsuarios(lista))
      .catch((e: Error) => !controle.signal.aborted && setFalha(e.message));
    return () => controle.abort();
  }, []);

  async function escolher(u: UsuarioDaEntrada) {
    try {
      await entrar(u.id);
      aoEntrar(u);
    } catch (e) {
      setFalha((e as Error).message);
    }
  }

  return (
    <main className="pagina">
      <h1>Tabletop</h1>
      <p>Quem é você?</p>
      {falha && <p role="alert">{falha}</p>}
      <ul className="lista-simples" data-testid="lista-usuarios">
        {usuarios?.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              data-testid={`entrar-${u.id}`}
              onClick={() => escolher(u)}
              style={{ borderLeft: `8px solid ${u.cor}` }}
            >
              {u.nome}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function App() {
  // `undefined` = ainda perguntando à sala; `null` = ninguém entrou.
  const [usuario, setUsuario] = useState<UsuarioDaEntrada | null | undefined>(undefined);
  const [falha, setFalha] = useState<string | null>(null);

  // No `pnpm dev` a página pode abrir antes de a sala subir: espera em vez de mostrar erro.
  useEffect(() => {
    const controle = new AbortController();
    comRetentativa(usuarioDaSessao, controle.signal)
      .then((u) => !controle.signal.aborted && setUsuario(u))
      .catch((e: Error) => !controle.signal.aborted && setFalha(e.message));
    return () => controle.abort();
  }, []);

  const aoSair = useCallback(async () => {
    await sair();
    setUsuario(null);
  }, []);
  const aoPerderSessao = useCallback(() => setUsuario(null), []);

  if (falha) return <p role="alert">{falha}</p>;
  if (usuario === undefined) return <p>Conectando à sala…</p>;
  if (usuario === null) return <TelaDeEntrada aoEntrar={setUsuario} />;
  return <Mesa key={usuario.id} aoSair={aoSair} aoPerderSessao={aoPerderSessao} />;
}
