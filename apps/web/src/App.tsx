import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  comRetentativa,
  consultarMesa,
  type DadosDaMesa,
  sair,
  type UsuarioDaEntrada,
  usuarioDaSessao,
} from "./api";
import { tourDasAutomacoesAbreSozinho } from "./automacoes/passosDoTour";
import { Logo } from "./Logo";
import { lembrarMesa } from "./mesasLocais";
import { irPara, lerRota, type Rota, tituloDaMesa, useRota } from "./rotas";
import { tourAbreSozinho } from "./tour/abreSozinho";

/**
 * Um pedaço do app baixado à parte (cada rota é um: a tela inicial não baixa o pixi.js nem a Mesa inteira).
 * Sem `lazy` + `Suspense` de propósito: o React segura por uns décimos de segundo a troca do conteúdo suspenso, e
 * com dois pedaços por entrada a mesa abria ~0,8 s mais tarde. Aqui o módulo pronto entra já no primeiro render.
 */
type Pedaco<M> = { baixar: () => Promise<M>; pronto: () => M | null };

function pedaco<M>(importar: () => Promise<M>): Pedaco<M> {
  let modulo: M | null = null;
  let pedido: Promise<M> | null = null;
  const baixar = () => {
    pedido ??= importar().then((m) => {
      modulo = m;
      return m;
    });
    return pedido;
  };
  return { baixar, pronto: () => modulo };
}

/** O módulo de um pedaço: já no primeiro render se ele chegou antes; senão `null` até chegar. */
function useModulo<M>(p: Pedaco<M>): M | null {
  const [m, setM] = useState<M | null>(p.pronto);
  useEffect(() => {
    if (m) return;
    let vivo = true;
    void p.baixar().then((x) => {
      if (vivo) setM(x);
    });
    return () => {
      vivo = false;
    };
  }, [m, p]);
  return m;
}

const pedacoDaEntrada = pedaco(() => import("./contas/EntradaDaMesa"));
const pedacoDaAutomacao = pedaco(() => import("./automacoes/AutomacaoEmJanelaPropria"));
const pedacoDosEventos = pedaco(() => import("./automacoes/EventosEmJanelaPropria"));
const pedacoDaChamada = pedaco(() => import("./chamada/ChamadaEmJanelaPropria"));
const pedacoDaFicha = pedaco(() => import("./ficha/FichaEmJanelaPropria"));
const pedacoDaMesa = pedaco(() => import("./Mesa"));
const pedacoDoSom = pedaco(() => import("./som/SomEmJanelaPropria"));
const pedacoDoInicio = pedaco(() => import("./TelaInicial"));

/** Mostra o que depende de um pedaço quando ele chega (até lá, nada). Cada uso leva uma `key` própria. */
function ComPedaco<M>({ de, children }: { de: Pedaco<M>; children: (modulo: M) => ReactNode }) {
  const modulo = useModulo(de);
  return modulo ? children(modulo) : null;
}

/** Começa a baixar o pedaço de uma rota (pedir de novo reaproveita o mesmo pedido). */
function adiantarRota(rota: Rota): void {
  if (rota.tipo === "inicio") {
    void pedacoDoInicio.baixar();
    return;
  }
  if (!rota.id) return;
  void pedacoDaEntrada.baixar();
  void (
    rota.painel === "eventos"
      ? pedacoDosEventos
      : rota.painel === "som"
        ? pedacoDoSom
        : rota.painel === "chamada"
          ? pedacoDaChamada
          : rota.automacaoId
            ? pedacoDaAutomacao
            : rota.fichaId
              ? pedacoDaFicha
              : pedacoDaMesa
  ).baixar();
}

// Já na avaliação do módulo, sem esperar o primeiro render (o `main.tsx` o segura até as fontes chegarem): o pedaço
// da rota baixa junto com as fontes, como quando tudo vinha num arquivo só.
adiantarRota(lerRota(location.pathname));

const voltarAoInicio = () => irPara("/");

/**
 * Uma mesa já encontrada no servidor: a escolha de usuário de hoje e depois a Mesa. Com `fichaId` (V9, a janela
 * própria de uma ficha) o que aparece depois da entrada é só a ficha.
 */
function MesaEncontrada({
  mesa,
  fichaId,
  painel,
  automacaoId,
  aoRenomear,
}: {
  mesa: DadosDaMesa;
  fichaId?: string | undefined;
  painel?: "som" | "chamada" | "eventos" | undefined;
  automacaoId?: string | undefined;
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
      <ComPedaco key="entrada" de={pedacoDaEntrada}>
        {(m) => <m.EntradaDaMesa mesa={mesa} aoEntrar={setUsuario} />}
      </ComPedaco>
    );
  }
  if (painel === "chamada") {
    return (
      <ComPedaco key="chamada" de={pedacoDaChamada}>
        {(m) => (
          <m.ChamadaEmJanelaPropria key={usuario.id} mesa={mesa} aoPerderSessao={aoPerderSessao} />
        )}
      </ComPedaco>
    );
  }
  if (painel === "eventos") {
    return (
      <ComPedaco key="eventos" de={pedacoDosEventos}>
        {(m) => (
          <m.EventosEmJanelaPropria key={usuario.id} mesa={mesa} aoPerderSessao={aoPerderSessao} />
        )}
      </ComPedaco>
    );
  }
  if (painel === "som") {
    return (
      <ComPedaco key="som" de={pedacoDoSom}>
        {(m) => (
          <m.SomEmJanelaPropria key={usuario.id} mesa={mesa} aoPerderSessao={aoPerderSessao} />
        )}
      </ComPedaco>
    );
  }
  if (automacaoId) {
    return (
      <ComPedaco key="automacao" de={pedacoDaAutomacao}>
        {(m) => (
          <m.AutomacaoEmJanelaPropria
            key={usuario.id}
            mesa={mesa}
            automacaoId={automacaoId}
            aoPerderSessao={aoPerderSessao}
          />
        )}
      </ComPedaco>
    );
  }
  if (fichaId) {
    return (
      <ComPedaco key="ficha" de={pedacoDaFicha}>
        {(m) => (
          <m.FichaEmJanelaPropria
            key={usuario.id}
            mesa={mesa}
            fichaId={fichaId}
            aoPerderSessao={aoPerderSessao}
          />
        )}
      </ComPedaco>
    );
  }
  return (
    <ComPedaco key="mesa" de={pedacoDaMesa}>
      {(m) => (
        <m.Mesa
          key={usuario.id}
          mesa={mesa}
          login={usuario.login}
          tourAutomatico={tourAbreSozinho(usuario)}
          tourDasAutomacoes={tourDasAutomacoesAbreSozinho(usuario)}
          aoSair={aoSair}
          aoPerderSessao={aoPerderSessao}
          aoTrocarDeMesa={voltarAoInicio}
          aoRenomear={aoRenomear}
        />
      )}
    </ComPedaco>
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
  automacaoId,
}: {
  id: string | null;
  bruto: string;
  fichaId?: string | undefined;
  painel?: "som" | "chamada" | "eventos" | undefined;
  automacaoId?: string | undefined;
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
    if (fichaId || painel || automacaoId) return;
    document.title = tituloDaMesa(nome);
    return () => {
      document.title = tituloDaMesa();
    };
  }, [nome, fichaId, painel, automacaoId]);

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
      automacaoId={automacaoId}
      aoRenomear={aoRenomear}
    />
  );
}

export function App() {
  const rota = useRota();
  // Trocar de rota sem recarregar (da tela inicial para uma mesa): o pedaço dela baixa junto com a consulta à sala.
  useEffect(() => adiantarRota(rota));
  if (rota.tipo === "inicio") {
    return (
      <ComPedaco key="inicio" de={pedacoDoInicio}>
        {(m) => <m.TelaInicial />}
      </ComPedaco>
    );
  }
  return (
    <RotaDaMesa
      key={`${rota.id ?? rota.bruto}/${rota.fichaId ?? ""}/${rota.painel ?? ""}/${rota.automacaoId ?? ""}`}
      id={rota.id}
      bruto={rota.bruto}
      fichaId={rota.fichaId}
      painel={rota.painel}
      automacaoId={rota.automacaoId}
    />
  );
}
