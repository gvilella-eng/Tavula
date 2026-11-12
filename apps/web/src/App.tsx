import { useCallback, useEffect, useState } from "react";
import {
  comRetentativa,
  consultarMesa,
  type DadosDaMesa,
  sair,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "./api";
import { EntradaDaMesa } from "./contas/EntradaDaMesa";
import { Logo } from "./Logo";
import { Mesa } from "./Mesa";
import { lembrarMesa } from "./mesasLocais";
import { irPara, tituloDaMesa, useRota } from "./rotas";
import { TelaInicial } from "./TelaInicial";
import { tourAbreSozinho } from "./tour/abreSozinho";

const voltarAoInicio = () => irPara("/");

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
  if (usuario === null) return <EntradaDaMesa mesa={mesa} aoEntrar={setUsuario} />;
  return (
    <Mesa
      key={usuario.id}
      mesa={mesa}
      login={usuario.login}
      tourAutomatico={tourAbreSozinho(usuario)}
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
