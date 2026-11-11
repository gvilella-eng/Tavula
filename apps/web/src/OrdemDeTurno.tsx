import {
  combateDe,
  controlaToken,
  type EntradaDeCombate,
  type Estado,
  ehPersonagemDeJogador,
  LIMITES_DO_COMBATE,
  type Usuario,
} from "@tabletop/shared";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dices,
  EyeOff,
  GripVertical,
  HelpCircle,
  ListOrdered,
  Plus,
  Square,
  SquareArrowDown,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BotaoComDica } from "./BotaoComDica";
import { alturaDaOrdemNaColuna, apertada, noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { gravarMontarDaOrdem, lerMontarDaOrdem } from "./preferencias";

type Props = {
  estado: Estado;
  eu: Usuario;
  enviar: (tipo: string, dados: object) => string | null;
  /** O token selecionado no mapa (o mestre o adiciona pelo botão). */
  selecionadoId: string | null;
  /** O mestre "vendo como" um jogador: só olha. */
  somenteLeitura: boolean;
  /** O painel do token está aberto: numa área apertada os dois dividem a coluna da direita (R6b). */
  dividirColuna?: boolean;
};

const novoId = () => `ent-${crypto.randomUUID().slice(0, 8)}`;

/**
 * Campo do valor da iniciativa: só vale ao sair do campo ou com Enter (digitar, as setas e a roda do mouse
 * mudam só o texto: nenhum frame vai para a sala e a lista não reordena); Esc devolve o valor de antes;
 * vazio tira o valor.
 */
function CampoDeValor({
  entrada,
  aoMudar,
}: {
  entrada: EntradaDeCombate;
  aoMudar: (valor: number | null) => void;
}) {
  const atual = entrada.iniciativa === undefined ? "" : String(entrada.iniciativa);
  const [texto, setTexto] = useState(atual);
  const cancelado = useRef(false);
  useEffect(() => setTexto(atual), [atual]);
  function confirmar() {
    if (cancelado.current) {
      cancelado.current = false;
      return setTexto(atual);
    }
    if (texto === atual) return;
    if (texto.trim() === "") return aoMudar(null);
    const n = Number(texto);
    if (!Number.isInteger(n)) return setTexto(atual);
    aoMudar(
      Math.min(Math.max(n, LIMITES_DO_COMBATE.iniciativaMin), LIMITES_DO_COMBATE.iniciativaMax),
    );
  }
  return (
    <input
      type="number"
      className="ot-valor"
      data-testid={`ordem-valor-${entrada.id}`}
      aria-label={`Iniciativa de ${entrada.nome}`}
      value={texto}
      placeholder="—"
      min={LIMITES_DO_COMBATE.iniciativaMin}
      max={LIMITES_DO_COMBATE.iniciativaMax}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        // Esc devolve o valor de antes e sai do campo sem mandar nada para a sala.
        if (e.key === "Escape") {
          cancelado.current = true;
          setTexto(atual);
          e.currentTarget.blur();
        }
      }}
      // A roda do mouse num campo com foco mudaria o número sem querer: tira o foco e deixa a lista rolar.
      onWheel={(e) => e.currentTarget.blur()}
    />
  );
}

/**
 * Painel flutuante da ordem de turno (Lote 11). Liga e desliga para todos (inclusive o mestre) pelo menu
 * superior. O mestre monta e conduz o combate; o jogador vê a lista que a sala lhe manda (sem as
 * entradas ocultas, "?" no valor oculto), rola a própria iniciativa e passa o próprio turno.
 */
export function OrdemDeTurno({
  estado,
  eu,
  enviar,
  selecionadoId,
  somenteLeitura,
  dividirColuna,
}: Props) {
  const combate = estado.combate;
  const { entradas, atualId, rodada } = combateDe(estado);
  const gerencia = eu.papel === "mestre" && !somenteLeitura;
  const [confirmando, setConfirmando] = useState(false);
  const [soltaNome, setSoltaNome] = useState("");
  const [soltaValor, setSoltaValor] = useState("");
  const [soltaOculta, setSoltaOculta] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  // "Montar" (rolar, ordenar, adicionar, encerrar): a pessoa escolhe aberta ou fechada e o navegador lembra.
  // Sem escolha, fica aberta enquanto o combate não começou (rodada 0) e recolhida depois.
  const [escolhaDoMontar, setEscolhaDoMontar] = useState<boolean | null>(lerMontarDaOrdem);
  const montarAberto = escolhaDoMontar ?? rodada === 0;
  function alternarMontar() {
    const nova = !montarAberto;
    setEscolhaDoMontar(nova);
    gravarMontarDaOrdem(nova);
  }

  // Mudou o combate (acabou, por exemplo): a confirmação de encerrar não fica pendurada.
  useEffect(() => {
    if (!combate) setConfirmando(false);
  }, [combate]);

  const tokenDe = (e: EntradaDeCombate) => estado.tokens.find((t) => t.id === e.tokenId);
  /** Quem controla o token da entrada (o jogador rola e passa só a própria; a sala confere de novo). */
  const ehMinha = (e: EntradaDeCombate): boolean => {
    if (somenteLeitura) return false;
    const t = tokenDe(e);
    return t !== undefined && controlaToken(t, eu, estado.personagens);
  };
  const vez = entradas.find((e) => e.id === atualId);
  const euPassoOTurno = vez !== undefined && ehMinha(vez);
  const tokensDoGrupo = estado.tokens.filter((t) => {
    if (t.cenaId !== estado.cenaAtivaId) return false;
    const p = estado.personagens.find((x) => x.id === t.personagemId);
    return p !== undefined && ehPersonagemDeJogador(p);
  });
  const jaNaLista = (tokenId: string) => entradas.some((e) => e.tokenId === tokenId);
  const semLista = entradas.length === 0 ? "A lista está vazia" : null;

  function adicionarSolta() {
    const nome = soltaNome.trim();
    if (!nome) return;
    const n = soltaValor.trim() === "" ? undefined : Number(soltaValor);
    if (n !== undefined && !Number.isInteger(n)) return;
    enviar("combate.adicionar", {
      entradas: [
        {
          id: novoId(),
          nome,
          ...(n === undefined ? {} : { iniciativa: n }),
          ...(soltaOculta ? { oculta: true } : {}),
        },
      ],
    });
    setSoltaNome("");
    setSoltaValor("");
  }

  function soltarEm(alvoId: string) {
    const de = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!de || de === alvoId) return;
    const indice = entradas.findIndex((e) => e.id === alvoId);
    if (indice >= 0) enviar("combate.mover", { id: de, indice });
  }

  const rotuloDaRodada = rodada > 0 ? `Rodada ${rodada}` : "Não começou";

  return (
    <Janela
      id="ordem"
      titulo="Ordem de turno"
      icone={<ListOrdered size={16} />}
      testid="ordem-de-turno"
      dados={{ "data-gerencia": String(gerencia) }}
      classeDoCorpo="ordem-de-turno"
      padrao={noCanto("topo-direita")}
      largura={364}
      minLargura={364}
      minAltura={160}
      // Com o painel do token aberto numa área apertada, a ordem e o painel dividem a coluna da direita.
      alturaMaxima={(area) =>
        dividirColuna && apertada(area) ? `${alturaDaOrdemNaColuna(area)}px` : "calc(100% - 80px)"
      }
      redimensionar="altura"
      acoes={
        <span
          className="ot-rodada"
          data-testid="ordem-rodada"
          data-rodada={rodada}
          title="Rodada atual"
        >
          {rotuloDaRodada}
        </span>
      }
    >
      {entradas.length === 0 ? (
        <p className="nota" data-testid="ordem-vazia">
          {gerencia
            ? "Ninguém na ordem ainda. Adicione tokens ou uma entrada solta."
            : "Nenhum combate em andamento."}
        </p>
      ) : (
        <ol className="ot-lista" data-testid="ordem-lista">
          {entradas.map((e, i) => {
            const naVez = e.id === atualId;
            const token = tokenDe(e);
            const escondida =
              e.oculta === true || token?.oculto === true || token?.camada === "mestre";
            const minha = ehMinha(e);
            return (
              <li
                key={e.id}
                className="ot-entrada"
                data-testid="ordem-entrada"
                data-id={e.id}
                data-nome={e.nome}
                data-posicao={i}
                data-vez={naVez || undefined}
                data-sobre={sobre === e.id || undefined}
                aria-current={naVez ? "step" : undefined}
                draggable={gerencia}
                onDragStart={(ev) => {
                  if (!gerencia) return;
                  setArrastando(e.id);
                  ev.dataTransfer.effectAllowed = "move";
                  ev.dataTransfer.setData("text/plain", e.id);
                }}
                onDragOver={(ev) => {
                  if (!gerencia || !arrastando) return;
                  ev.preventDefault();
                  setSobre(e.id);
                }}
                onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  soltarEm(e.id);
                }}
                onDragEnd={() => {
                  setArrastando(null);
                  setSobre(null);
                }}
              >
                {gerencia ? (
                  <GripVertical size={14} className="ot-alca" aria-hidden />
                ) : (
                  <span className="ot-marca" aria-hidden>
                    {naVez ? "▶" : ""}
                  </span>
                )}
                <span
                  className="ot-ponto"
                  style={{ background: token?.cor ?? "var(--borda)" }}
                  aria-hidden
                />
                <span className="ot-nome" title={e.nome}>
                  {e.nome}
                </span>
                {gerencia && escondida && (
                  <span
                    className="ot-selo"
                    data-testid="ordem-escondida"
                    title="Os jogadores não veem esta entrada"
                  >
                    <EyeOff size={12} />
                  </span>
                )}
                {gerencia ? (
                  <>
                    <BotaoComDica
                      className="botao-icone pequeno"
                      testid={`ordem-valor-oculto-${e.id}`}
                      aria-pressed={e.valorOculto === true}
                      dica="Mostrar o valor com ? para os jogadores"
                      aria-label={`Esconder o valor de ${e.nome} dos jogadores`}
                      onClick={() =>
                        enviar("combate.editar", {
                          id: e.id,
                          mudancas: { valorOculto: e.valorOculto !== true },
                        })
                      }
                    >
                      <HelpCircle size={14} />
                    </BotaoComDica>
                    <BotaoComDica
                      className="botao-icone pequeno"
                      testid={`ordem-oculta-${e.id}`}
                      aria-pressed={e.oculta === true}
                      dica="Esconder a entrada inteira dos jogadores"
                      aria-label={`Esconder ${e.nome} dos jogadores`}
                      onClick={() =>
                        enviar("combate.editar", {
                          id: e.id,
                          mudancas: { oculta: e.oculta !== true },
                        })
                      }
                    >
                      <EyeOff size={14} />
                    </BotaoComDica>
                    <CampoDeValor
                      entrada={e}
                      aoMudar={(valor) =>
                        enviar("combate.editar", { id: e.id, mudancas: { iniciativa: valor } })
                      }
                    />
                    <BotaoComDica
                      className="botao-icone pequeno"
                      testid={`ordem-tirar-${e.id}`}
                      dica="Tirar da ordem"
                      aria-label={`Tirar ${e.nome} da ordem`}
                      onClick={() => enviar("combate.tirar", { id: e.id })}
                    >
                      <X size={14} />
                    </BotaoComDica>
                  </>
                ) : (
                  <>
                    <span
                      className="ot-numero"
                      data-testid={`ordem-numero-${e.id}`}
                      data-oculto={e.valorOculto === true || undefined}
                    >
                      {e.valorOculto === true ? "?" : (e.iniciativa ?? "—")}
                    </span>
                    {minha && e.iniciativa === undefined && e.valorOculto !== true && (
                      <BotaoComDica
                        className="ot-rolar"
                        testid={`ordem-rolar-${e.id}`}
                        dica="Rolar a iniciativa"
                        onClick={() => enviar("combate.rolar", { ids: [e.id] })}
                      >
                        <Dices size={14} /> Rolar
                      </BotaoComDica>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!somenteLeitura && !gerencia && euPassoOTurno && (
        <button
          type="button"
          className="primario ot-passar"
          data-testid="ordem-passar"
          onClick={() => enviar("combate.passar", {})}
        >
          <ChevronRight size={16} /> Passar o meu turno
        </button>
      )}

      {gerencia && (
        <div className="ot-comandos">
          <div className="ot-linha ot-turno">
            <BotaoComDica
              testid="ordem-anterior"
              motivo={semLista}
              dica="Volta ao turno anterior"
              onClick={() => enviar("combate.anterior", {})}
            >
              <ChevronLeft size={14} /> Anterior
            </BotaoComDica>
            <BotaoComDica
              testid="ordem-proximo"
              className="primario"
              motivo={semLista}
              dica="Passa para o próximo turno (a rodada muda quando a lista dá a volta)"
              onClick={() => enviar("combate.proximo", {})}
            >
              Próximo turno <ChevronRight size={14} />
            </BotaoComDica>
            <BotaoComDica
              className="ot-montar-botao"
              testid="ordem-montar-alternar"
              aria-expanded={montarAberto}
              aria-controls="ordem-montar"
              dica="Montar o combate: rolar, ordenar, adicionar e encerrar"
              onClick={alternarMontar}
            >
              Montar
              {montarAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </BotaoComDica>
          </div>
          {montarAberto && (
            <div className="ot-montar" id="ordem-montar" data-testid="ordem-montar">
              <div className="ot-linha">
                <BotaoComDica
                  testid="ordem-rolar-todos"
                  motivo={
                    entradas.length === 0
                      ? "A lista está vazia"
                      : entradas.every((e) => e.iniciativa !== undefined)
                        ? "Todos já têm iniciativa"
                        : null
                  }
                  dica="Rola a iniciativa de quem ainda não tem valor (as dos NPCs vão ocultas)"
                  onClick={() => enviar("combate.rolar", {})}
                >
                  <Dices size={14} /> Rolar para todos
                </BotaoComDica>
                <BotaoComDica
                  testid="ordem-ordenar"
                  motivo={
                    entradas.length === 0
                      ? "A lista está vazia"
                      : entradas.length < 2
                        ? "Precisa de pelo menos duas entradas"
                        : null
                  }
                  dica="Volta a lista à ordem pelos valores"
                  onClick={() => enviar("combate.ordenar", {})}
                >
                  <SquareArrowDown size={14} /> Ordenar
                </BotaoComDica>
              </div>
              <div className="ot-linha">
                <BotaoComDica
                  testid="ordem-adicionar-selecionados"
                  motivo={
                    selecionadoId === null
                      ? "Selecione um token no mapa"
                      : jaNaLista(selecionadoId)
                        ? "Já está na lista"
                        : null
                  }
                  dica="Adiciona o token selecionado no mapa"
                  onClick={() =>
                    selecionadoId &&
                    enviar("combate.adicionar", {
                      entradas: [{ id: novoId(), tokenId: selecionadoId }],
                    })
                  }
                >
                  <Plus size={14} /> Adicionar selecionados
                </BotaoComDica>
                <BotaoComDica
                  testid="ordem-adicionar-grupo"
                  motivo={
                    tokensDoGrupo.length === 0
                      ? "Não há personagens de jogadores nesta cena"
                      : tokensDoGrupo.every((t) => jaNaLista(t.id))
                        ? "O grupo já está na lista"
                        : null
                  }
                  dica="Adiciona os tokens dos personagens dos jogadores na cena do grupo"
                  onClick={() =>
                    enviar("combate.adicionar", {
                      entradas: tokensDoGrupo
                        .filter((t) => !jaNaLista(t.id))
                        .map((t) => ({ id: novoId(), tokenId: t.id })),
                    })
                  }
                >
                  <Plus size={14} /> O grupo
                </BotaoComDica>
              </div>
              <form
                className="ot-solta"
                data-testid="ordem-solta"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  adicionarSolta();
                }}
              >
                <input
                  type="text"
                  data-testid="ordem-solta-nome"
                  aria-label="Nome da entrada solta"
                  placeholder="Entrada solta (Covil)"
                  maxLength={64}
                  value={soltaNome}
                  onChange={(e) => setSoltaNome(e.target.value)}
                />
                <input
                  type="number"
                  data-testid="ordem-solta-valor"
                  aria-label="Valor da entrada solta"
                  placeholder="20"
                  value={soltaValor}
                  onChange={(e) => setSoltaValor(e.target.value)}
                />
                <BotaoComDica
                  className="botao-icone pequeno"
                  testid="ordem-solta-oculta"
                  aria-pressed={soltaOculta}
                  dica="Entrada escondida dos jogadores"
                  aria-label="Entrada solta escondida dos jogadores"
                  onClick={() => setSoltaOculta(!soltaOculta)}
                >
                  <EyeOff size={14} />
                </BotaoComDica>
                <BotaoComDica
                  testid="ordem-solta-adicionar"
                  type="submit"
                  className="botao-icone pequeno"
                  motivo={soltaNome.trim() ? null : "Escreva o nome da entrada"}
                  dica="Adiciona a entrada solta à lista"
                  aria-label="Adicionar a entrada solta"
                >
                  <Plus size={14} />
                </BotaoComDica>
              </form>
              {confirmando ? (
                <div
                  className="ot-confirmar"
                  role="alertdialog"
                  data-testid="ordem-encerrar-confirmar"
                >
                  <p>Encerrar o combate? A lista e a rodada serão apagadas.</p>
                  <div className="ot-linha">
                    <button
                      type="button"
                      className="perigo"
                      data-testid="ordem-encerrar-sim"
                      onClick={() => {
                        enviar("combate.encerrar", {});
                        setConfirmando(false);
                      }}
                    >
                      Encerrar
                    </button>
                    <button
                      type="button"
                      data-testid="ordem-encerrar-nao"
                      onClick={() => setConfirmando(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <BotaoComDica
                  testid="ordem-encerrar"
                  className="perigo"
                  motivo={combate === undefined ? "Não há combate em andamento" : null}
                  dica="Apaga a lista e a rodada (pede confirmação)"
                  onClick={() => setConfirmando(true)}
                >
                  <Square size={14} /> Encerrar combate
                </BotaoComDica>
              )}
            </div>
          )}
        </div>
      )}
    </Janela>
  );
}
