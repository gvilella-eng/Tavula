import {
  combateDe,
  type EntradaDeCombate,
  type Estado,
  LIMITES_DO_COMBATE,
  type Usuario,
} from "@tabletop/shared";
import {
  ArrowDownWideNarrow,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  ListX,
  Play,
  Trash2,
} from "lucide-react";
import {
  type MouseEvent as MouseReact,
  type KeyboardEvent as TecladoReact,
  useEffect,
  useRef,
  useState,
} from "react";
import { caixaDaArea, dentroDaArea } from "./area";
import { BotaoComDica } from "./BotaoComDica";
import { alturaDaOrdemNaColuna, apertada, noCanto } from "./janelas/geometria";
import { Janela } from "./janelas/Janela";
import { useFecharFora } from "./Popover";
import { useMenuPorTeclado } from "./useMenuPorTeclado";

type Props = {
  estado: Estado;
  eu: Usuario;
  enviar: (tipo: string, dados: object) => string | null;
  /** O mestre "vendo como" um jogador: só olha. */
  somenteLeitura: boolean;
  /** O painel do token está aberto: numa área apertada os dois dividem a coluna da direita (R6b). */
  dividirColuna?: boolean;
  /** O jogador fecha a janela só na tela dele (o mestre a fecha para todos). */
  aoFecharAqui?: () => void;
};

/**
 * Campo de número que se escreve no lugar (iniciativa e rodada): clicar e digitar; só vale ao sair do campo ou
 * com Enter (digitar, as setas e a roda do mouse mudam só o texto: nenhum frame vai para a sala); Esc devolve o
 * valor de antes. Vazio tira o valor (iniciativa) ou volta ao de antes (quando `permitirVazio` é falso).
 */
function CampoDeNumero({
  valor,
  min,
  max,
  permitirVazio,
  aoMudar,
  ...resto
}: {
  valor: number | undefined;
  min: number;
  max: number;
  permitirVazio: boolean;
  aoMudar: (valor: number | null) => void;
  testid: string;
  rotulo: string;
  className: string;
}) {
  const atual = valor === undefined ? "" : String(valor);
  const [texto, setTexto] = useState(atual);
  const cancelado = useRef(false);
  useEffect(() => setTexto(atual), [atual]);
  function confirmar() {
    if (cancelado.current) {
      cancelado.current = false;
      return setTexto(atual);
    }
    if (texto === atual) return;
    if (texto.trim() === "") {
      if (permitirVazio) return aoMudar(null);
      return setTexto(atual);
    }
    const n = Number(texto);
    if (!Number.isInteger(n)) return setTexto(atual);
    aoMudar(Math.min(Math.max(n, min), max));
  }
  return (
    <input
      type="number"
      className={resto.className}
      data-testid={resto.testid}
      aria-label={resto.rotulo}
      value={texto}
      placeholder="—"
      min={min}
      max={max}
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

type MenuAberto = { id: string; x: number; y: number };

/** Menu do botão direito numa linha (mestre): dar a vez e tirar da lista. */
function MenuDaLinha({
  entrada,
  x,
  y,
  enviar,
  aoFechar,
}: {
  entrada: EntradaDeCombate;
  x: number;
  y: number;
  enviar: Props["enviar"];
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFecharFora(ref, aoFechar);
  const aoTeclar = useMenuPorTeclado(ref, true);
  const { left, top } = dentroDaArea(x, y, 184, 96);
  return (
    <div
      ref={ref}
      className="menu-contexto"
      role="menu"
      aria-label={`Entrada: ${entrada.nome}`}
      data-testid="ordem-menu"
      style={{ left, top, maxHeight: caixaDaArea().base - caixaDaArea().topo - 16 }}
      onKeyDown={aoTeclar}
    >
      <button
        type="button"
        role="menuitem"
        className="item-menu"
        data-testid="ordem-menu-dar-vez"
        onClick={() => {
          aoFechar();
          enviar("combate.darVez", { id: entrada.id });
        }}
      >
        <Play size={16} />
        <span>Dar a vez</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="item-menu"
        data-testid="ordem-menu-tirar"
        onClick={() => {
          aoFechar();
          enviar("combate.tirar", { id: entrada.id });
        }}
      >
        <ListX size={16} />
        <span>Tirar da lista</span>
      </button>
    </div>
  );
}

/**
 * Painel flutuante da ordem de turno (Lote 11; simplificado no V2). Uma lista com o nome e o número da iniciativa
 * à direita, mais a rodada. O mestre abre e fecha a janela para todos (pelo menu Combate ou pelo ×: fechar não
 * apaga a lista nem a rodada), edita os números e a rodada no lugar, ordena, passa o turno e limpa. O jogador vê
 * a lista que a sala lhe manda e entra por ela pela ficha (Iniciativa), não por aqui.
 */
export function OrdemDeTurno({
  estado,
  eu,
  enviar,
  somenteLeitura,
  dividirColuna,
  aoFecharAqui,
}: Props) {
  const { entradas, atualId, rodada } = combateDe(estado);
  const gerencia = eu.papel === "mestre" && !somenteLeitura;
  const [confirmando, setConfirmando] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const semCombate = estado.combate === undefined;

  // Acabou a lista (Limpar, por exemplo): a confirmação e o menu não ficam pendurados.
  useEffect(() => {
    if (semCombate) {
      setConfirmando(false);
      setMenu(null);
    }
  }, [semCombate]);

  const tokenDe = (e: EntradaDeCombate) => estado.tokens.find((t) => t.id === e.tokenId);
  const semLista = entradas.length === 0 ? "A lista está vazia" : null;

  function soltarEm(alvoId: string) {
    const de = arrastando;
    setArrastando(null);
    setSobre(null);
    if (!de || de === alvoId) return;
    const indice = entradas.findIndex((e) => e.id === alvoId);
    if (indice >= 0) enviar("combate.mover", { id: de, indice });
  }

  /** Alt+↑/↓ na linha em foco move a linha uma posição (mestre). */
  function aoTeclarNaLinha(ev: TecladoReact<HTMLLIElement>, e: EntradaDeCombate, i: number) {
    if (!gerencia || ev.target !== ev.currentTarget || !ev.altKey) return;
    const passo = ev.key === "ArrowUp" ? -1 : ev.key === "ArrowDown" ? 1 : 0;
    if (passo === 0) return;
    ev.preventDefault();
    const destino = i + passo;
    if (destino < 0 || destino >= entradas.length) return;
    enviar("combate.mover", { id: e.id, indice: destino });
  }

  function abrirMenu(ev: MouseReact<HTMLLIElement>, e: EntradaDeCombate) {
    if (!gerencia) return;
    ev.preventDefault();
    // Pelo teclado (tecla de menu) o evento vem sem posição: o menu abre junto da linha.
    const r = ev.currentTarget.getBoundingClientRect();
    const dePonteiro = ev.clientX !== 0 || ev.clientY !== 0;
    setMenu({
      id: e.id,
      x: dePonteiro ? ev.clientX : r.left + 24,
      y: dePonteiro ? ev.clientY : r.bottom - 4,
    });
  }

  const rotuloDaRodada = rodada > 0 ? `Rodada: ${rodada}` : "Rodada: não começou";
  const entradaDoMenu = menu ? entradas.find((e) => e.id === menu.id) : undefined;

  return (
    <Janela
      id="ordem"
      titulo="Ordem de turno"
      icone={<ListOrdered size={16} />}
      testid="ordem-de-turno"
      dados={{ "data-gerencia": String(gerencia) }}
      classeDoCorpo="ordem-de-turno"
      padrao={noCanto("topo-direita")}
      largura={270}
      minLargura={270}
      semMinimizar
      minAltura={160}
      // Com o painel do token aberto numa área apertada, a ordem e o painel dividem a coluna da direita.
      alturaMaxima={(area) =>
        dividirColuna && apertada(area) ? `${alturaDaOrdemNaColuna(area)}px` : "calc(100% - 80px)"
      }
      redimensionar="altura"
      // O mestre fecha a janela para todos (a lista e a rodada ficam guardadas); o jogador, só na tela dele.
      {...(gerencia
        ? {
            aoFechar: () => enviar("ordemDeTurno.definir", { visivel: false }),
            rotuloDoFechar: "Fechar a ordem de turno para todos",
          }
        : aoFecharAqui
          ? { aoFechar: aoFecharAqui, rotuloDoFechar: "Fechar a ordem de turno (só para você)" }
          : {})}
    >
      <div className="ot-rodada" data-testid="ordem-rodada" data-rodada={rodada}>
        {gerencia ? (
          <>
            <span className="ot-rodada-rotulo">Rodada:</span>
            <CampoDeNumero
              className="ot-campo ot-campo-rodada"
              testid="ordem-rodada-valor"
              rotulo="Rodada (0: ainda não começou)"
              valor={rodada}
              min={0}
              max={9999}
              permitirVazio={false}
              aoMudar={(n) => n !== null && enviar("combate.rodada", { rodada: n })}
            />
            {rodada === 0 && <span className="ot-rodada-nota">não começou</span>}
          </>
        ) : (
          rotuloDaRodada
        )}
      </div>
      {entradas.length === 0 ? (
        <div className="ot-vazia" data-testid="ordem-vazia">
          <strong>Ninguém na ordem de turno.</strong>
          <span>Selecione o seu token e clique em Iniciativa na ficha.</span>
          {gerencia && <span>Ou clique direito no token e escolha Entrar na iniciativa.</span>}
        </div>
      ) : (
        <ol className="ot-lista" data-testid="ordem-lista">
          {entradas.map((e, i) => {
            const naVez = e.id === atualId;
            const token = tokenDe(e);
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
                // O mestre arrasta a linha inteira; pelo teclado, a linha em foco com Alt+↑/↓.
                tabIndex={gerencia ? 0 : undefined}
                draggable={gerencia}
                onKeyDown={(ev) => aoTeclarNaLinha(ev, e, i)}
                onContextMenu={(ev) => abrirMenu(ev, e)}
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
                <span className="ot-marca" aria-hidden>
                  {naVez ? "▶" : ""}
                </span>
                <span
                  className="ot-ponto"
                  style={{ background: token?.cor ?? "var(--borda)" }}
                  aria-hidden
                />
                <span className="ot-nome">{e.nome}</span>
                {gerencia ? (
                  <CampoDeNumero
                    className="ot-campo"
                    testid={`ordem-valor-${e.id}`}
                    rotulo={`Iniciativa de ${e.nome}`}
                    valor={e.iniciativa}
                    min={LIMITES_DO_COMBATE.iniciativaMin}
                    max={LIMITES_DO_COMBATE.iniciativaMax}
                    permitirVazio
                    aoMudar={(valor) =>
                      enviar("combate.editar", { id: e.id, mudancas: { iniciativa: valor } })
                    }
                  />
                ) : (
                  <span
                    className="ot-numero"
                    data-testid={`ordem-numero-${e.id}`}
                    data-oculto={e.valorOculto === true || undefined}
                  >
                    {e.valorOculto === true ? "?" : (e.iniciativa ?? "—")}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {gerencia && (
        <div className="ot-comandos">
          {confirmando ? (
            <div className="ot-confirmar" role="alertdialog" data-testid="ordem-encerrar-confirmar">
              <p>Limpar a ordem de turno? A lista e a rodada serão apagadas.</p>
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
                  Limpar
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
            <div className="ot-linha ot-rodape">
              <BotaoComDica
                testid="ordem-anterior"
                className="botao-icone"
                aria-label="Turno anterior"
                motivo={semLista}
                nome="Turno anterior"
                onClick={() => enviar("combate.anterior", {})}
              >
                <ChevronLeft size={16} />
              </BotaoComDica>
              <BotaoComDica
                testid="ordem-encerrar"
                className="botao-icone perigo"
                aria-label="Limpar a lista"
                motivo={semCombate && rodada === 0 ? "Não há nada para limpar" : null}
                nome="Limpar a lista"
                onClick={() => setConfirmando(true)}
              >
                <Trash2 size={16} />
              </BotaoComDica>
              <BotaoComDica
                testid="ordem-ordenar"
                className="botao-icone"
                aria-label="Ordenar pela iniciativa"
                motivo={
                  entradas.length < 2
                    ? entradas.length === 0
                      ? "A lista está vazia"
                      : "Precisa de pelo menos duas entradas"
                    : null
                }
                nome="Ordenar pela iniciativa"
                onClick={() => enviar("combate.ordenar", {})}
              >
                <ArrowDownWideNarrow size={16} />
              </BotaoComDica>
              <BotaoComDica
                testid="ordem-proximo"
                className="primario ot-proximo"
                aria-label="Próximo turno"
                motivo={semLista}
                nome="Próximo turno"
                onClick={() => enviar("combate.proximo", {})}
              >
                <ChevronRight size={18} />
              </BotaoComDica>
            </div>
          )}
        </div>
      )}
      {menu && entradaDoMenu && (
        <MenuDaLinha
          entrada={entradaDoMenu}
          x={menu.x}
          y={menu.y}
          enviar={enviar}
          aoFechar={() => setMenu(null)}
        />
      )}
    </Janela>
  );
}
