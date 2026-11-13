import { type Cena, cenaEhCartao, PX_POR_QUADRADO_PADRAO } from "@tabletop/shared";
import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BotaoComDica } from "./BotaoComDica";
import type { PedirImagem } from "./FaixaDeCenas";
import { useDialogo } from "./useDialogo";

type Props = {
  cena: Cena;
  enviar: (tipo: string, dados: object) => string | null;
  pedirImagem: PedirImagem;
  aoFechar: () => void;
};

/** Configurar a cena: nome, mapa (a imagem entra aqui), pixels por quadrado e o grid (quadrado em metros e visível). */
export function ConfigurarCena({ cena, enviar, pedirImagem, aoFechar }: Props) {
  const [nome, setNome] = useState(cena.nome);
  const [px, setPx] = useState(String(cena.mapa?.pxPorQuadrado ?? PX_POR_QUADRADO_PADRAO));
  const [gridVisivel, setGridVisivel] = useState(cena.grid.visivel);
  const [quadradoM, setQuadradoM] = useState(String(cena.grid.quadradoM));
  const [mostrarParedes, setMostrarParedes] = useState(cena.mostrarParedesAosJogadores === true);
  const [cartao, setCartao] = useState(cenaEhCartao(cena));
  // `undefined`: não mexe; `null`: tira o mapa; texto: o mapa novo (já processado e registrado).
  const [novoMapa, setNovoMapa] = useState<string | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const caixa = useRef<HTMLFormElement>(null);
  // Esc fecha só o diálogo de cima (o seletor de imagem, se estiver aberto); o foco volta a quem abriu.
  const nivel = useDialogo(caixa, aoFechar);

  const mapaAtual = novoMapa === undefined ? cena.mapa?.assetHash : (novoMapa ?? undefined);

  function salvar() {
    const pxNumero = Number(px);
    if (!(pxNumero >= 10 && pxNumero <= 1000)) {
      setErro("Pixels por quadrado: entre 10 e 1000.");
      return;
    }
    const quadradoNumero = Number(quadradoM);
    if (!(quadradoNumero >= 0.3 && quadradoNumero <= 10)) {
      setErro("Quadrado do grid: entre 0,3 e 10 metros.");
      return;
    }
    const limpo = nome.trim();
    if (!limpo) {
      setErro("A cena precisa de um nome.");
      return;
    }
    const mudouParedes = mostrarParedes !== (cena.mostrarParedesAosJogadores === true);
    const mudouCartao = cartao !== cenaEhCartao(cena);
    if (limpo !== cena.nome || mudouParedes || mudouCartao) {
      enviar("cena.editar", {
        cenaId: cena.id,
        ...(limpo !== cena.nome ? { nome: limpo } : {}),
        ...(mudouParedes ? { mostrarParedesAosJogadores: mostrarParedes } : {}),
        ...(mudouCartao ? { cartao } : {}),
      });
    }
    if (gridVisivel !== cena.grid.visivel || quadradoNumero !== cena.grid.quadradoM) {
      enviar("cena.configurarGrid", {
        cenaId: cena.id,
        ...(gridVisivel !== cena.grid.visivel ? { visivel: gridVisivel } : {}),
        ...(quadradoNumero !== cena.grid.quadradoM ? { quadradoM: quadradoNumero } : {}),
      });
    }
    if (novoMapa === null) {
      if (cena.mapa) enviar("cena.definirMapa", { cenaId: cena.id, assetHash: null });
    } else if (mapaAtual && (novoMapa !== undefined || pxNumero !== cena.mapa?.pxPorQuadrado)) {
      enviar("cena.definirMapa", {
        cenaId: cena.id,
        assetHash: mapaAtual,
        pxPorQuadrado: pxNumero,
      });
    }
    aoFechar();
  }

  // No `body`: dentro da faixa de cenas (z-index 20) o modal ficaria atrás das janelas flutuantes (R6b).
  return createPortal(
    <div className="fundo-modal" style={{ zIndex: 80 + nivel }}>
      <form
        ref={caixa}
        className="modal modal-configurar"
        noValidate
        data-testid="configurar-cena"
        aria-label={`Configurar a cena ${cena.nome}`}
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <header className="cabecalho-modal">
          <strong>Configurar cena</strong>
          <BotaoComDica
            className="botao-icone pequeno"
            testid="configurar-cena-fechar"
            nome="Fechar"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={16} />
          </BotaoComDica>
        </header>
        <label className="campo-coluna">
          Nome
          <input
            data-testid="cfg-nome"
            value={nome}
            maxLength={64}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <div className="campo-coluna">
          Mapa da cena
          <div className="linha-botoes">
            <button
              type="button"
              data-testid="cfg-mapa"
              onClick={() =>
                pedirImagem("Mapa da cena", "mapa", (hash) => {
                  setNovoMapa(hash);
                  setErro(null);
                })
              }
            >
              <ImagePlus size={16} /> {mapaAtual ? "Trocar a imagem…" : "Escolher a imagem…"}
            </button>
            {mapaAtual && (
              <button type="button" data-testid="cfg-tirar-mapa" onClick={() => setNovoMapa(null)}>
                Tirar o mapa
              </button>
            )}
          </div>
          <span className="nota" data-testid="cfg-mapa-estado">
            {novoMapa === null
              ? "O mapa será tirado ao salvar."
              : novoMapa !== undefined
                ? "Imagem nova escolhida: vale ao salvar."
                : cena.mapa
                  ? "A cena tem um mapa."
                  : "A cena ainda não tem mapa."}
          </span>
        </div>
        <label className="campo-coluna">
          Pixels por quadrado
          <input
            type="number"
            min={10}
            max={1000}
            data-testid="cfg-px"
            value={px}
            onChange={(e) => setPx(e.target.value)}
          />
        </label>
        <fieldset className="quem-controla" data-testid="cfg-grid">
          <legend>Grid da cena</legend>
          <label className="linha-opcao">
            <input
              type="checkbox"
              data-testid="cfg-grid-visivel"
              checked={gridVisivel}
              onChange={(e) => setGridVisivel(e.target.checked)}
            />
            Grid visível
          </label>
          <label className="campo-coluna">
            Quadrado (metros)
            <input
              type="number"
              min={0.3}
              max={10}
              step={0.25}
              data-testid="grid-quadrado"
              value={quadradoM}
              onChange={(e) => setQuadradoM(e.target.value)}
            />
          </label>
        </fieldset>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid="cfg-mostrar-paredes"
            checked={mostrarParedes}
            onChange={(e) => setMostrarParedes(e.target.checked)}
          />
          Mostrar paredes e portas aos jogadores
        </label>
        <label className="linha-opcao">
          <input
            type="checkbox"
            data-testid="cfg-cartao"
            checked={cartao}
            onChange={(e) => setCartao(e.target.checked)}
          />
          Cena como cartão: mostra a imagem inteira, sem luz nem visão
        </label>
        {erro && (
          <p className="nota erro" role="alert" data-testid="cfg-erro">
            {erro}
          </p>
        )}
        <div className="linha-botoes fim">
          <button type="button" data-testid="cfg-cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="primario" data-testid="cfg-salvar">
            Salvar
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
