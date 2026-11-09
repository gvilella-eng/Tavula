import type { FormaDeDesenho } from "@tabletop/shared";
import {
  ArrowLeft,
  Circle,
  Eraser,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Square,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { CORES_DO_PINCEL, type ConfigDoPincel, ESPESSURAS_DO_PINCEL } from "./pincel";

const FORMAS: { id: FormaDeDesenho; titulo: string; icone: ReactNode }[] = [
  { id: "livre", titulo: "Desenho livre", icone: <Pencil size={20} /> },
  { id: "linha", titulo: "Linha", icone: <Minus size={20} /> },
  { id: "retangulo", titulo: "Retângulo", icone: <Square size={20} /> },
  { id: "circulo", titulo: "Círculo", icone: <Circle size={20} /> },
];

/** O pontinho do botão de espessura: cresce com ela, sem estourar o botão. */
function tamanhoDoPonto(valor: number): number {
  if (valor <= 2) return 3;
  if (valor <= 4) return 6;
  return valor <= 8 ? 10 : 15;
}

type Props = {
  config: ConfigDoPincel;
  aoMudar: (c: ConfigDoPincel) => void;
  /** Volta à barra de ferramentas. */
  aoFechar: () => void;
  /** "Voltar": apaga o meu desenho mais recente da cena. */
  aoDesfazer: () => void;
};

/**
 * Sub-barra do pincel (Lote 13): voltar, selecionar, formas, preenchido, paleta de 8 cores mais a cor
 * livre, espessura e borracha. É só configuração da tela de quem desenha; quem desenha é o mapa.
 */
export function SubBarraPincel({ config, aoMudar, aoFechar, aoDesfazer }: Props) {
  const { modo, forma, cor, espessura, preenchido } = config;
  const fechada = forma === "retangulo" || forma === "circulo";
  const naPaleta = (CORES_DO_PINCEL as readonly string[]).includes(cor.toLowerCase());

  return (
    <nav
      className="barra-ferramentas sub-barra-pincel"
      aria-label="Pincel"
      data-testid="sub-barra-pincel"
    >
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-fechar"
        title="Voltar às ferramentas"
        aria-label="Voltar às ferramentas"
        onClick={aoFechar}
      >
        <ArrowLeft size={20} />
      </button>
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-desfazer"
        title="Voltar: apaga o meu desenho mais recente desta cena"
        aria-label="Voltar: apaga o meu desenho mais recente desta cena"
        onClick={aoDesfazer}
      >
        <Undo2 size={20} />
      </button>
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-selecionar"
        title="Selecionar: mover e apagar desenhos (Delete apaga o selecionado)"
        aria-label="Selecionar desenhos"
        aria-pressed={modo === "selecionar"}
        onClick={() => aoMudar({ ...config, modo: "selecionar" })}
      >
        <MousePointer2 size={20} />
      </button>
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-borracha"
        title="Borracha: apaga o desenho inteiro que tocar"
        aria-label="Borracha"
        aria-pressed={modo === "borracha"}
        onClick={() => aoMudar({ ...config, modo: "borracha" })}
      >
        <Eraser size={20} />
      </button>
      <hr />
      {FORMAS.map((f) => (
        <button
          key={f.id}
          type="button"
          className="botao-icone"
          data-testid={`pincel-forma-${f.id}`}
          title={f.titulo}
          aria-label={f.titulo}
          aria-pressed={modo === "formas" && forma === f.id}
          onClick={() => aoMudar({ ...config, modo: "formas", forma: f.id })}
        >
          {f.icone}
        </button>
      ))}
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-preenchido"
        title={
          fechada ? "Preenchido (retângulo e círculo)" : "Preenchido: escolha retângulo ou círculo"
        }
        aria-label="Preenchido"
        aria-pressed={preenchido}
        aria-disabled={!fechada}
        disabled={!fechada}
        onClick={() => aoMudar({ ...config, preenchido: !preenchido })}
      >
        <PaintBucket size={20} />
      </button>
      <hr />
      <fieldset className="cores-pincel">
        <legend className="so-leitor">Cor</legend>
        {CORES_DO_PINCEL.map((c) => (
          <button
            key={c}
            type="button"
            className="cor-pincel"
            data-testid={`pincel-cor-${c.slice(1)}`}
            title={`Cor ${c}`}
            aria-label={`Cor ${c}`}
            aria-pressed={cor.toLowerCase() === c}
            style={{ background: c }}
            onClick={() => aoMudar({ ...config, cor: c })}
          />
        ))}
      </fieldset>
      <label
        className="cor-livre"
        title="Cor livre"
        data-ativa={!naPaleta}
        style={{ ["--cor-livre" as string]: cor }}
      >
        <span className="so-leitor">Cor livre</span>
        <input
          type="color"
          data-testid="pincel-cor-livre"
          value={cor}
          onChange={(e) => aoMudar({ ...config, cor: e.target.value.toLowerCase() })}
        />
      </label>
      <hr />
      <fieldset className="espessuras-pincel">
        <legend className="so-leitor">Espessura</legend>
        {ESPESSURAS_DO_PINCEL.map((e) => (
          <button
            key={e.valor}
            type="button"
            className="botao-espessura"
            data-testid={`pincel-espessura-${e.valor}`}
            title={`${e.titulo} (${e.valor})`}
            aria-label={`Espessura ${e.titulo.toLowerCase()}`}
            aria-pressed={espessura === e.valor}
            onClick={() => aoMudar({ ...config, espessura: e.valor })}
          >
            <span
              className="ponto-espessura"
              style={{ width: tamanhoDoPonto(e.valor), height: tamanhoDoPonto(e.valor) }}
            />
          </button>
        ))}
      </fieldset>
    </nav>
  );
}
