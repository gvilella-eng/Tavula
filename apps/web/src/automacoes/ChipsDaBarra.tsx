import {
  automacoesDe,
  type BotaoParaJogador,
  type Estado,
  type Fluxo,
  situacaoDoFluxo,
} from "@tabletop/shared";
import { Pause, Play, SkipForward, Zap } from "lucide-react";
import { BotaoComDica } from "../BotaoComDica";
import { useTic } from "../tempo";
import { duracaoCurta } from "./rascunho";

type Enviar = (tipo: string, dados: object) => string | null;

type Props = {
  estado: Estado;
  euMestre: boolean;
  enviar: Enviar;
  /** O relógio da sala em ms (só o mestre o recebe; sem ele o tempo do próximo disparo não aparece). */
  salaMs: () => number | undefined;
};

/**
 * Os botões das automações na barra de cima (7b-3; AU1: com os fluxos). O mestre vê os que fixou (automações de relógio e de
 * botão); o jogador vê só os que o mestre liberou, com o nome e a ação e nada da definição. Cada chip é pequeno: nome,
 * quando dispara de novo (no mestre) e os botões de disparar e de pausar ou retomar.
 */
export function BotoesDaBarra({ estado, euMestre, enviar, salaMs }: Props) {
  if (euMestre) {
    const a = automacoesDe(estado);
    const fixados = a.fluxos.filter(
      (f) =>
        f.fixado === true &&
        !f.rascunho &&
        (f.gatilho.tipo === "relogio" || f.gatilho.tipo === "botao"),
    );
    if (fixados.length === 0) return null;
    return (
      <div className="botoes-da-barra" data-testid="botoes-da-barra">
        <span className="so-leitor">Automações fixadas</span>
        {fixados.map((f) =>
          f.gatilho.tipo === "relogio" ? (
            <ChipDoRelogioDoMestre
              key={f.id}
              fluxo={f}
              execucao={a.execucao[f.id]}
              enviar={enviar}
              salaMs={salaMs}
            />
          ) : (
            <div className="chip-da-barra" key={f.id} data-testid={`chip-evento-${f.id}`}>
              <span className="chip-nome" title={f.nome}>
                {f.nome}
              </span>
              <BotaoComDica
                className="botao-icone pequeno icone-do-chip"
                testid={`chip-evento-${f.id}-disparar`}
                nome={`Disparar “${f.nome}”`}
                onClick={() => enviar("fluxo.disparar", { id: f.id })}
              >
                <Zap size={14} />
              </BotaoComDica>
            </div>
          ),
        )}
      </div>
    );
  }
  const liberados = estado.botoes ?? [];
  if (liberados.length === 0) return null;
  return (
    <div className="botoes-da-barra" data-testid="botoes-da-barra">
      <span className="so-leitor">Botões da mesa</span>
      {liberados.map((b) => (
        <ChipDoJogador key={b.id} botao={b} enviar={enviar} />
      ))}
    </div>
  );
}

function ChipDoRelogioDoMestre(p: {
  fluxo: Fluxo;
  execucao: ReturnType<typeof automacoesDe>["execucao"][string] | undefined;
  enviar: Enviar;
  salaMs: () => number | undefined;
}) {
  const { fluxo: f } = p;
  useTic(true);
  const sala = p.salaMs();
  const s = situacaoDoFluxo(f, p.execucao, sala ?? 0);
  const parado = !f.ligado;
  const proxima =
    parado || sala === undefined || s.proximaEmMs === null
      ? ""
      : `próxima em ${duracaoCurta(s.proximaEmMs)}`;
  return (
    <div className="chip-da-barra" data-testid={`chip-ciclo-${f.id}`} data-pausado={parado}>
      <span className="chip-nome" title={f.nome}>
        {f.nome}
      </span>
      <span className="chip-fase" data-testid={`chip-ciclo-${f.id}-fase`}>
        {parado ? "pausado" : proxima}
      </span>
      <BotaoComDica
        className="botao-icone pequeno icone-do-chip"
        testid={`chip-ciclo-${f.id}-disparar`}
        nome={`Disparar “${f.nome}” agora`}
        onClick={() => p.enviar("fluxo.disparar", { id: f.id })}
      >
        <SkipForward size={14} />
      </BotaoComDica>
      <BotaoComDica
        className="botao-icone pequeno icone-do-chip"
        testid={`chip-ciclo-${f.id}-pausa`}
        nome={parado ? `Retomar “${f.nome}”` : `Pausar “${f.nome}”`}
        onClick={() => p.enviar("fluxo.ligar", { id: f.id, ligado: parado })}
      >
        {parado ? <Play size={14} /> : <Pause size={14} />}
      </BotaoComDica>
    </div>
  );
}

function ChipDoJogador(p: { botao: BotaoParaJogador; enviar: Enviar }) {
  const { botao: b } = p;
  const chave = b.tipo === "ciclo" ? "ciclo" : "evento";
  const bruto = b.id.slice(b.id.indexOf(":") + 1);
  return (
    <div
      className="chip-da-barra"
      data-testid={`chip-botao-${bruto}`}
      data-tipo={chave}
      data-pausado={b.pausado}
    >
      <span className="chip-nome" title={b.nome}>
        {b.nome}
      </span>
      {b.tipo === "ciclo" && b.pausado === true && <span className="chip-fase">pausado</span>}
      <BotaoComDica
        className="botao-icone pequeno icone-do-chip"
        testid={`chip-botao-${bruto}-disparar`}
        nome={b.tipo === "ciclo" ? `Disparar “${b.nome}” agora` : `Disparar “${b.nome}”`}
        onClick={() => p.enviar("botao.usar", { botaoId: b.id, acao: "disparar" })}
      >
        {b.tipo === "ciclo" ? <SkipForward size={14} /> : <Zap size={14} />}
      </BotaoComDica>
      {b.tipo === "ciclo" && (
        <BotaoComDica
          className="botao-icone pequeno icone-do-chip"
          testid={`chip-botao-${bruto}-pausa`}
          nome={b.pausado ? `Retomar “${b.nome}”` : `Pausar “${b.nome}”`}
          onClick={() =>
            p.enviar("botao.usar", { botaoId: b.id, acao: b.pausado ? "retomar" : "pausar" })
          }
        >
          {b.pausado ? <Play size={14} /> : <Pause size={14} />}
        </BotaoComDica>
      )}
    </div>
  );
}
