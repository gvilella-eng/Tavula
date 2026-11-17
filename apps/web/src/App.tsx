import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  comRetentativa,
  consultarMesa,
  type DadosDaMesa,
  sair,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "./api";
import { Logo } from "./Logo";
import { lembrarMesa } from "./mesasLocais";
import { irPara, tituloDaMesa, useRota } from "./rotas";
import { tourAbreSozinho } from "./tour/abreSozinho";

// Cada rota vira um pedaço próprio: a tela inicial não baixa o pixi.js nem a Mesa inteira.
const EntradaDaMesa = lazy(() =>
  import("./contas/EntradaDaMesa").then((m) => ({ default: m.EntradaDaMesa })),
);
const FichaEmJanelaPropria = lazy(() =>
  import("./ficha/FichaEmJanelaPropria").then((m) => ({ default: m.FichaEmJanelaPropria })),
);
const Mesa = lazy(() => import("./Mesa").then((m) => ({ default: m.Mesa })));
const SomEmJanelaPropria = lazy(() =>
  import("./som/SomEmJanelaPropria").then((m) => ({ default: m.SomEmJanelaPropria })),
);
const TelaInicial = lazy(() => import("./TelaInicial").then((m) => ({ default: m.TelaInicial })));

const voltarAoInicio = () => irPara("/");

/**
 * Uma mesa já encontrada no servidor: a escolha de usuário de hoje e depois a Mesa. Com `fichaId` (V9, a janela
 * própria de uma ficha) o que aparece depois da entrada é só a ficha.
 */
function MesaEncontrada({
  mesa,
  fichaId,
  painel,
  aoRenomear,
}: {
  mesa: DadosDaMesa;
  fichaId?: string | undefined;
  painel?: "som" | undefined;
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
  if (usuario === null) {
    return (
      <Suspense fallback={null}>
        <EntradaDaMesa mesa={mesa} aoEntrar={setUsuario} />
      </Suspense>
    );
  }
  if (painel === "som") {
    return (
      <Suspense fallback={null}>
        <SomEmJanelaPropria key={usuario.id} mesa={mesa} aoPerderSessao={aoPerderSessao} />
      </Suspense>
    );
  }
  if (fichaId) {
    return (
      <Suspense fallback={null}>
        <FichaEmJanelaPropria
          key={usuario.id}
          mesa={mesa}
          fichaId={fichaId}
          aoPerderSessao={aoPerderSessao}
        />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
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
    </Suspense>
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
function RotaDaMesa({
  id,
  bruto,
  fichaId,
  painel,
}: {
  id: string | null;
  bruto: string;
  fichaId?: string | undefined;
  painel?: "som" | undefined;
}) {
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

  // O título da aba é o nome da mesa (a janela própria da ficha põe o dela).
  const nome = mesa?.nome;
  useEffect(() => {
    if (fichaId || painel) return;
    document.title = tituloDaMesa(nome);
    return () => {
      document.title = tituloDaMesa();
    };
  }, [nome, fichaId, painel]);

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
  return (
    <MesaEncontrada
      key={mesa.id}
      mesa={mesa}
      fichaId={fichaId}
      painel={painel}
      aoRenomear={aoRenomear}
    />
  );
}

export function App() {
  const rota = useRota();
  if (rota.tipo === "inicio") {
    return (
      <Suspense fallback={null}>
        <TelaInicial />
      </Suspense>
    );
  }
  return (
    <RotaDaMesa
      key={`${rota.id ?? rota.bruto}/${rota.fichaId ?? ""}/${rota.painel ?? ""}`}
      id={rota.id}
      bruto={rota.bruto}
      fichaId={rota.fichaId}
      painel={rota.painel}
    />
  );
}
