import {
  automacoesDe,
  type BotaoParaJogador,
  type Ciclo,
  type Estado,
  nomeDoEvento,
  situacaoDoCiclo,
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
  /** O relógio da sala em ms (só o mestre o recebe; sem ele o tempo da fase não aparece). */
  salaMs: () => number | undefined;
};

/**
 * Os botões das automações na barra de cima (7b-3). O mestre vê os que fixou (ciclos e botões de evento); o jogador vê
 * só os que o mestre liberou, com o nome e a ação e nada da definição. Cada chip é pequeno: nome, fase (no mestre) e
 * os botões de disparar e de pausar ou retomar.
 */
export function BotoesDaBarra({ estado, euMestre, enviar, salaMs }: Props) {
  if (euMestre) {
    const a = automacoesDe(estado);
    const ciclos = a.ciclos.filter((c) => c.fixado === true);
    const botoes = a.botoes.filter((b) => b.fixado === true);
    if (ciclos.length === 0 && botoes.length === 0) return null;
    return (
      <div className="botoes-da-barra" data-testid="botoes-da-barra">
        <span className="so-leitor">Automações fixadas</span>
        {ciclos.map((c) => (
          <ChipDoCicloDoMestre
            key={c.id}
            ciclo={c}
            execucao={a.execucao[c.id]}
            enviar={enviar}
            salaMs={salaMs}
          />
        ))}
        {botoes.map((b) => (
          <div className="chip-da-barra" key={b.id} data-testid={`chip-evento-${b.id}`}>
            <span className="chip-nome" title={b.nome}>
              {b.nome}
            </span>
            <BotaoComDica
              className="botao-icone pequeno icone-do-chip"
              testid={`chip-evento-${b.id}-disparar`}
              nome={`Disparar “${b.nome}”`}
              onClick={() =>
                enviar("evento.disparar", {
                  evento: b.evento,
                  ...(b.cenaId === undefined ? {} : { cenaId: b.cenaId }),
                })
              }
            >
              <Zap size={14} />
            </BotaoComDica>
          </div>
        ))}
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

function ChipDoCicloDoMestre(p: {
  ciclo: Ciclo;
  execucao: ReturnType<typeof automacoesDe>["execucao"][string] | undefined;
  enviar: Enviar;
  salaMs: () => number | undefined;
}) {
  const { ciclo: c } = p;
  useTic(true);
  const sala = p.salaMs();
  const s = situacaoDoCiclo(c, p.execucao, sala ?? 0);
  const fase = s.atual ? nomeDoEvento(s.atual.evento) : "no começo";
  const proxima =
    s.pausado || p.execucao === undefined || sala === undefined || s.proximaEmMs === null
      ? ""
      : ` · ${duracaoCurta(s.proximaEmMs)}`;
  return (
    <div className="chip-da-barra" data-testid={`chip-ciclo-${c.id}`} data-pausado={s.pausado}>
      <span className="chip-nome" title={c.nome}>
        {c.nome}
      </span>
      <span className="chip-fase" data-testid={`chip-ciclo-${c.id}-fase`}>
        {s.pausado ? "pausado" : fase}
        {proxima}
      </span>
      <BotaoComDica
        className="botao-icone pequeno icone-do-chip"
        testid={`chip-ciclo-${c.id}-disparar`}
        nome={`Disparar a próxima fase de “${c.nome}”`}
        onClick={() => p.enviar("ciclo.disparar", { id: c.id })}
      >
        <SkipForward size={14} />
      </BotaoComDica>
      <BotaoComDica
        className="botao-icone pequeno icone-do-chip"
        testid={`chip-ciclo-${c.id}-pausa`}
        nome={s.pausado ? `Retomar “${c.nome}”` : `Pausar “${c.nome}”`}
        onClick={() => p.enviar(s.pausado ? "ciclo.retomar" : "ciclo.pausar", { id: c.id })}
      >
        {s.pausado ? <Play size={14} /> : <Pause size={14} />}
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
        nome={
          b.tipo === "ciclo" ? `Disparar a próxima fase de “${b.nome}”` : `Disparar “${b.nome}”`
        }
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
