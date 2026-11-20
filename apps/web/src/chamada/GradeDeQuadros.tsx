import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BotaoComDica } from "../BotaoComDica";
import { calcularGrade, itensDaPagina, totalDePaginas } from "./grade";
import { type DadosDoQuadro, QuadroDaPessoa } from "./Quadros";

// CH2: a grade da chamada. Mede o espaço, escolhe colunas e linhas para o quadro 16:9 ficar o maior possível e nunca
// rola: com mais de 9 quadros vira páginas (setas, "1/2" e as setas do teclado). O quadro da trilha é o último.

const RESPIRO = 12;
const GAP = 12;

export type MedidaDoQuadro = { largura: number; altura: number };

type Props = {
  quadros: DadosDoQuadro[];
  /** O quadro da trilha, no tamanho que a grade deu a cada quadro. */
  trilha: (medida: MedidaDoQuadro) => ReactNode;
};

type Item = { chave: string; pessoa: DadosDoQuadro | null };

export function GradeDeQuadros({ quadros, trilha }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [espaco, setEspaco] = useState({ largura: 0, altura: 0 });
  const [pagina, setPagina] = useState(0);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const ler = () =>
      setEspaco({
        largura: Math.max(0, el.clientWidth - 2 * RESPIRO),
        altura: Math.max(0, el.clientHeight - 2 * RESPIRO),
      });
    ler();
    const o = new ResizeObserver(ler);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const itens: Item[] = [
    ...quadros.map((q) => ({ chave: q.usuario.id, pessoa: q })),
    { chave: "trilha", pessoa: null },
  ];
  const paginas = totalDePaginas(itens.length);
  const atual = Math.min(pagina, paginas - 1);
  const daPagina = itensDaPagina(itens, atual);
  const g = calcularGrade(daPagina.length, espaco.largura, espaco.altura, GAP);

  const falandoEm = (p: number) => itensDaPagina(itens, p).some((i) => i.pessoa?.falando);
  const falandoAntes = Array.from({ length: atual }, (_, p) => p).some(falandoEm);
  const falandoDepois = Array.from({ length: paginas - atual - 1 }, (_, p) =>
    falandoEm(atual + 1 + p),
  ).some(Boolean);

  const ir = (p: number) => setPagina(Math.min(Math.max(0, p), paginas - 1));
  const aoTecla = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (paginas < 2 || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
      ev.preventDefault();
      ir(atual - 1);
    } else if (ev.key === "ArrowRight" || ev.key === "PageDown") {
      ev.preventDefault();
      ir(atual + 1);
    }
  };

  const estiloDoMiolo = {
    width: g.colunas * g.largura + (g.colunas - 1) * GAP,
  } as CSSProperties;
  const medida = { largura: g.largura, altura: g.altura };

  return (
    <main
      className="chamada-grade"
      data-testid="chamada-quadros"
      data-colunas={g.colunas}
      data-paginas={paginas}
      data-pagina={atual + 1}
      aria-label="Quadros da chamada"
      tabIndex={paginas > 1 ? 0 : -1}
      onKeyDown={aoTecla}
    >
      <div className="chamada-quadros" ref={area} data-testid="chamada-area-da-grade">
        <div className="chamada-quadros-miolo" style={estiloDoMiolo}>
          {daPagina.map((i) => (
            <div
              className="chamada-celula"
              key={i.chave}
              style={{ width: g.largura, height: g.altura }}
            >
              {i.pessoa ? <QuadroDaPessoa d={i.pessoa} /> : trilha(medida)}
            </div>
          ))}
        </div>
      </div>
      {paginas > 1 && (
        <nav className="chamada-paginas" aria-label="Páginas da chamada">
          <BotaoComDica
            testid="chamada-pagina-anterior"
            className="chamada-seta"
            nome="Página anterior · ←"
            motivo={atual === 0 ? "Esta é a primeira página." : null}
            data-falando={falandoAntes ? "sim" : undefined}
            onClick={() => ir(atual - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {falandoAntes && (
              <span className="chamada-seta-ponto" data-testid="chamada-ponto-antes" />
            )}
          </BotaoComDica>
          <span className="chamada-pagina-numero" data-testid="chamada-pagina-numero">
            {atual + 1}/{paginas}
          </span>
          <BotaoComDica
            testid="chamada-pagina-proxima"
            className="chamada-seta"
            nome="Próxima página · →"
            motivo={atual === paginas - 1 ? "Esta é a última página." : null}
            data-falando={falandoDepois ? "sim" : undefined}
            onClick={() => ir(atual + 1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
            {falandoDepois && (
              <span className="chamada-seta-ponto" data-testid="chamada-ponto-depois" />
            )}
          </BotaoComDica>
        </nav>
      )}
    </main>
  );
}
