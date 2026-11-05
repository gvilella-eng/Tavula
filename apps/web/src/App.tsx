import { type Exportacao, pode } from "@tabletop/shared";
import { useCallback, useEffect, useState } from "react";
import { entrar, listarUsuarios, sair, type UsuarioDaEntrada, usuarioDaSessao } from "./api";
import { CampoNota } from "./CampoNota";
import { PainelDoMestre } from "./PainelDoMestre";
import { useSala } from "./useSala";

function baixarExportacao(exportacao: Exportacao) {
  const blob = new Blob([JSON.stringify(exportacao, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `campanha-${exportacao.exportadoEm.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function TelaDeEntrada({ aoEntrar }: { aoEntrar: (u: UsuarioDaEntrada) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioDaEntrada[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios()
      .then(setUsuarios)
      .catch((e: Error) => setFalha(e.message));
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

function Mesa({ aoSair, aoPerderSessao }: { aoSair: () => void; aoPerderSessao: () => void }) {
  const { status, estado, eu, presenca, uso, aviso, enviar, ouvir } = useSala({
    aoExportar: baixarExportacao,
    aoPerderSessao,
  });

  const pronto = status === "conectado" && estado !== null;
  const euMestre = eu?.papel === "mestre";
  const podeEditarNota = eu && estado ? pode(eu, "nota.editar", estado.permissoes) : false;

  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1>Tabletop</h1>
        <p>
          Conexão com a sala: <strong data-testid="status-conexao">{status}</strong>
        </p>
        {aviso && (
          <p className="aviso" role="alert" data-testid="aviso" data-codigo={aviso.codigo ?? ""}>
            {aviso.texto}
          </p>
        )}
      </header>

      {!estado || !eu ? (
        <p>Carregando a mesa…</p>
      ) : (
        <>
          <section>
            <p>
              Você é <strong data-testid="eu-nome">{eu.nome}</strong>, papel:{" "}
              <strong data-testid="eu-papel">{eu.papel}</strong>{" "}
              <button type="button" data-testid="trocar-usuario" onClick={aoSair}>
                Trocar usuário
              </button>
            </p>
          </section>

          <section>
            <h2>Presença</h2>
            <ul className="lista-simples" data-testid="presenca">
              {estado.usuarios.map((u) => (
                <li key={u.id} data-testid={`presenca-${u.id}`}>
                  <span className="bolinha" style={{ background: u.cor }} />
                  {u.nome}{" "}
                  <span data-testid={`presenca-estado-${u.id}`}>{presenca[u.id] ?? "offline"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Notas</h2>
            <CampoNota
              testid="nota-mesa"
              rotulo="Nota da mesa (todos veem)"
              campo="mesa"
              usuarioId={eu.id}
              servidor={estado.notaMesa}
              editavel={podeEditarNota}
              pronto={pronto}
              enviar={enviar}
              ouvir={ouvir}
            />
            {euMestre && (
              <CampoNota
                testid="nota-mestre"
                rotulo="Nota do mestre (só mestres veem)"
                campo="mestre"
                usuarioId={eu.id}
                servidor={estado.notaMestre ?? ""}
                editavel
                pronto={pronto}
                enviar={enviar}
                ouvir={ouvir}
              />
            )}
          </section>

          {euMestre && <PainelDoMestre estado={estado} uso={uso} enviar={enviar} />}
        </>
      )}
    </main>
  );
}

export function App() {
  // `undefined` = ainda perguntando à sala; `null` = ninguém entrou.
  const [usuario, setUsuario] = useState<UsuarioDaEntrada | null | undefined>(undefined);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    usuarioDaSessao()
      .then(setUsuario)
      .catch((e: Error) => setFalha(e.message));
  }, []);

  const aoSair = useCallback(async () => {
    await sair();
    setUsuario(null);
  }, []);
  const aoPerderSessao = useCallback(() => setUsuario(null), []);

  if (falha) return <p role="alert">{falha}</p>;
  if (usuario === undefined) return <p>Carregando…</p>;
  if (usuario === null) return <TelaDeEntrada aoEntrar={setUsuario} />;
  return <Mesa key={usuario.id} aoSair={aoSair} aoPerderSessao={aoPerderSessao} />;
}
