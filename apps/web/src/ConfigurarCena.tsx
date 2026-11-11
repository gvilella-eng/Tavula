import { type Cena, PX_POR_QUADRADO_PADRAO } from "@tabletop/shared";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PedirImagem } from "./FaixaDeCenas";

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
  // `undefined`: não mexe; `null`: tira o mapa; texto: o mapa novo (já processado e registrado).
  const [novoMapa, setNovoMapa] = useState<string | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      // Com o seletor de imagem por cima, o Esc é dele.
      if (e.key === "Escape" && !document.querySelector('[data-testid="seletor-imagem"]'))
        aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

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
    if (limpo !== cena.nome) enviar("cena.editar", { cenaId: cena.id, nome: limpo });
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

  return (
    <div className="fundo-modal">
      <form
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
          <button
            type="button"
            className="botao-icone pequeno"
            title="Fechar"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <X size={16} />
          </button>
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
    </div>
  );
}
