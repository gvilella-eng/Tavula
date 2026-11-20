import type { Estado } from "@tabletop/shared";
import { AppWindow, ChevronDown, ChevronUp, LayoutGrid, PanelBottom, Undo2, X } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { BotaoComDica } from "../BotaoComDica";
import { MARGEM, noCanto } from "../janelas/geometria";
import { Janela } from "../janelas/Janela";
import { CORES, IconeDoLugar } from "../som/iconesDoSom";
import { type BotaoDeEvento, botoesDaMesaDeEventos, useModoDosEventos } from "./eventosDaMesa";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  euMestre: boolean;
  enviar: Enviar;
  aoFechar: () => void;
  /** Abre a mesa de eventos numa janela própria do navegador. */
  aoAbrirEmJanela?: (() => void) | undefined;
  /** A mesa de eventos na janela própria: a página inteira, sem janela flutuante nem faixa. */
  propria?: { aoVoltar: () => void } | undefined;
};

/** Quanto tempo o botão fica brilhando e dizendo "Disparou" (ms). */
const BRILHO_MS = 900;

/**
 * A mesa de eventos (AU2): uma mesa no estilo da mesa de som, mas só com botões grandes, um para cada automação cujo
 * gatilho é um botão. Cada um mostra o nome, a cor e o ícone que o mestre escolheu no gatilho, e se a automação está ligada.
 * Clicar dispara e dá um retorno rápido (brilho e "Disparou"). O jogador vê só os botões que o mestre liberou. Aparece como
 * janela flutuante, como faixa no pé da tela (a escolha fica neste navegador) ou numa janela própria do navegador.
 */
export function MesaDeEventos(p: Props) {
  const { modo, mudarModo, recolhida, mudarRecolhida } = useModoDosEventos();
  const botoes = useMemo(() => botoesDaMesaDeEventos(p.estado, p.euMestre), [p.estado, p.euMestre]);
  const [disparados, setDisparados] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const x of t.values()) clearTimeout(x);
      t.clear();
    };
  }, []);

  function disparar(b: BotaoDeEvento) {
    p.enviar("botao.usar", { botaoId: b.botaoId });
    setDisparados((d) => ({ ...d, [b.botaoId]: Date.now() }));
    const antigo = timers.current.get(b.botaoId);
    if (antigo) clearTimeout(antigo);
    timers.current.set(
      b.botaoId,
      setTimeout(() => {
        setDisparados((d) => {
          const { [b.botaoId]: _fora, ...resto } = d;
          return resto;
        });
        timers.current.delete(b.botaoId);
      }, BRILHO_MS),
    );
  }

  // A faixa diz ao mapa quanto do pé ela ocupa (`--faixa-dos-eventos`), para o zoom e os avisos subirem.
  const faixaRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const faixa = faixaRef.current;
    const pai = faixa?.parentElement;
    if (p.propria || modo !== "faixa" || !faixa || !pai) return;
    const atualizar = () =>
      pai.style.setProperty(
        "--faixa-dos-eventos",
        `${Math.ceil(faixa.getBoundingClientRect().height) + 8}px`,
      );
    atualizar();
    const olho = new ResizeObserver(atualizar);
    olho.observe(faixa);
    return () => {
      olho.disconnect();
      pai.style.removeProperty("--faixa-dos-eventos");
    };
  }, [modo, p.propria]);

  const resumo =
    botoes.length === 0
      ? "nenhum botão"
      : botoes.length === 1
        ? "1 botão"
        : `${botoes.length} botões`;

  const corpo = (
    <div className="eventos-corpo" data-testid="eventos-corpo">
      {botoes.length === 0 ? (
        <p className="nota eventos-vazia" data-testid="eventos-vazia">
          {p.euMestre
            ? "Nenhuma automação com gatilho de botão. Crie uma em Automações, com o gatilho “Ao apertar um botão”."
            : "O mestre ainda não liberou nenhum botão para você."}
        </p>
      ) : (
        <div className="eventos-grade" data-testid="eventos-grade">
          {botoes.map((b) => {
            const brilhando = disparados[b.botaoId] !== undefined;
            return (
              <button
                key={b.botaoId}
                type="button"
                className="evento-botao"
                data-testid={`evento-botao-${b.fluxoId}`}
                data-ligada={b.ligada}
                data-disparou={brilhando}
                style={{ "--cor-do-som": CORES[b.cor].variavel } as CSSProperties}
                onClick={() => disparar(b)}
              >
                <span className="evento-icone" aria-hidden="true">
                  <IconeDoLugar icone={b.icone} tamanho={26} />
                </span>
                <span className="evento-nome">{b.nome}</span>
                <span
                  className="evento-estado"
                  data-testid={`evento-estado-${b.fluxoId}`}
                  role="status"
                >
                  {brilhando ? "Disparou" : b.ligada ? "Ligada" : "Desligada"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const botaoEmJanela = p.aoAbrirEmJanela && (
    <BotaoComDica
      testid="eventos-abrir-em-janela"
      nome="Abrir em outra janela"
      className="botao-icone pequeno"
      onClick={p.aoAbrirEmJanela}
    >
      <AppWindow size={16} aria-hidden="true" />
    </BotaoComDica>
  );

  if (p.propria) {
    return (
      <section className="som-propria" data-testid="eventos-propria" aria-label="Mesa de eventos">
        <header className="som-propria-topo">
          <LayoutGrid size={16} aria-hidden="true" className="som-faixa-icone" />
          <h2>Mesa de eventos</h2>
          <span className="som-faixa-espaco" />
          <BotaoComDica
            testid="eventos-voltar-para-mesa"
            nome="Voltar para a mesa"
            className="botao-icone pequeno"
            onClick={p.propria.aoVoltar}
          >
            <Undo2 size={16} aria-hidden="true" />
          </BotaoComDica>
        </header>
        <div className="som-propria-corpo eventos-propria-corpo">{corpo}</div>
      </section>
    );
  }

  if (modo === "faixa") {
    return (
      <section
        ref={faixaRef}
        className="eventos-faixa"
        data-testid="eventos-faixa"
        data-recolhida={recolhida ? "sim" : "nao"}
        aria-label="Mesa de eventos"
      >
        <header className="som-faixa-topo">
          <LayoutGrid size={16} aria-hidden="true" className="som-faixa-icone" />
          <h2>Eventos</h2>
          <span className="som-resumo" data-testid="eventos-resumo">
            {resumo}
          </span>
          <span className="som-faixa-espaco" />
          {botaoEmJanela}
          <BotaoComDica
            testid="eventos-soltar"
            nome="Soltar em janela"
            className="botao-icone pequeno"
            onClick={() => mudarModo("janela")}
          >
            <PanelBottom size={16} aria-hidden="true" />
          </BotaoComDica>
          <BotaoComDica
            testid="eventos-faixa-recolher"
            nome={recolhida ? "Abrir a faixa" : "Recolher a faixa"}
            className="botao-icone pequeno"
            onClick={() => mudarRecolhida(!recolhida)}
          >
            {recolhida ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
          </BotaoComDica>
          <BotaoComDica
            testid="eventos-fechar"
            nome="Fechar a mesa de eventos"
            className="botao-icone pequeno"
            onClick={p.aoFechar}
          >
            <X size={16} aria-hidden="true" />
          </BotaoComDica>
        </header>
        {!recolhida && corpo}
      </section>
    );
  }

  return (
    <Janela
      id="eventos"
      titulo="Mesa de eventos"
      icone={<LayoutGrid size={14} />}
      testid="painel-eventos"
      classeDoCorpo="painel-eventos"
      padrao={noCanto("topo-esquerda", 72 + MARGEM, 64 + 24)}
      largura={420}
      altura={(area) => Math.min(520, area.altura - 24)}
      redimensionar="ambos"
      minLargura={260}
      acoes={
        <>
          {botaoEmJanela}
          <BotaoComDica
            testid="eventos-encaixar"
            nome="Encaixar como faixa no pé da tela"
            className="botao-icone pequeno"
            onClick={() => mudarModo("faixa")}
          >
            <PanelBottom size={16} aria-hidden="true" />
          </BotaoComDica>
        </>
      }
      aoFechar={p.aoFechar}
      rotuloDoFechar="Fechar a mesa de eventos"
      testidDoFechar="eventos-fechar"
    >
      {corpo}
    </Janela>
  );
}
