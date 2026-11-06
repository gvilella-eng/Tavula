import { ArrowLeft, Circle, Eraser, Minus, MousePointer2, Pencil, Square } from "lucide-react";
import { type ReactNode, useState } from "react";

type Forma = "livre" | "linha" | "retangulo" | "circulo";

const FORMAS: { id: Forma; titulo: string; icone: ReactNode }[] = [
  { id: "livre", titulo: "Desenho livre", icone: <Pencil size={20} /> },
  { id: "linha", titulo: "Linha", icone: <Minus size={20} /> },
  { id: "retangulo", titulo: "Retângulo", icone: <Square size={20} /> },
  { id: "circulo", titulo: "Círculo", icone: <Circle size={20} /> },
];

const CORES = ["#e6194b", "#f58231", "#e0a030", "#3cb44b", "#4363d8", "#ffffff"];

type Props = { aoVoltar: () => void };

/** Sub-barra do pincel: só a interface por enquanto (o desenho vem num lote futuro). */
export function SubBarraPincel({ aoVoltar }: Props) {
  const [forma, setForma] = useState<Forma>("livre");
  const [cor, setCor] = useState(CORES[0] ?? "#e6194b");
  const [modo, setModo] = useState<"formas" | "selecionar" | "borracha">("formas");

  return (
    <nav
      className="barra-ferramentas sub-barra-pincel"
      aria-label="Pincel"
      data-testid="sub-barra-pincel"
    >
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-voltar"
        title="Voltar às ferramentas"
        aria-label="Voltar às ferramentas"
        onClick={aoVoltar}
      >
        <ArrowLeft size={20} />
      </button>
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-selecionar"
        title="Selecionar desenhos"
        aria-label="Selecionar desenhos"
        aria-pressed={modo === "selecionar"}
        onClick={() => setModo("selecionar")}
      >
        <MousePointer2 size={20} />
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
          onClick={() => {
            setForma(f.id);
            setModo("formas");
          }}
        >
          {f.icone}
        </button>
      ))}
      <hr />
      <fieldset className="cores-pincel">
        <legend className="so-leitor">Cor</legend>
        {CORES.map((c) => (
          <button
            key={c}
            type="button"
            className="cor-pincel"
            data-testid={`pincel-cor-${c.slice(1)}`}
            title={`Cor ${c}`}
            aria-label={`Cor ${c}`}
            aria-pressed={cor === c}
            style={{ background: c }}
            onClick={() => setCor(c)}
          />
        ))}
      </fieldset>
      <hr />
      <button
        type="button"
        className="botao-icone"
        data-testid="pincel-borracha"
        title="Borracha"
        aria-label="Borracha"
        aria-pressed={modo === "borracha"}
        onClick={() => setModo("borracha")}
      >
        <Eraser size={20} />
      </button>
      <span className="em-breve">em breve</span>
    </nav>
  );
}
