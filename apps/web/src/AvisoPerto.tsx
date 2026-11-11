import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { caixaDaArea } from "./area";
import type { Aviso } from "./useSala";

type Props = { aviso: Aviso; aoDispensar: () => void };

/**
 * O aviso (toast) de erro da sala, dentro da área do mapa: perto de onde a pessoa agiu (o ponto do clique
 * ou o campo com o foco) ou, se não há origem (a sala é quem avisa), no alto da área. Fica o tempo que
 * `aviso.duracaoMs` diz e um clique (ou o X) o dispensa.
 */
export function AvisoPerto({ aviso, aoDispensar }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);
  const { origem, numero } = aviso;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refaz a posição quando chega um aviso novo
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const area = caixaDaArea();
    const larguraDaArea = area.direita - area.esquerda;
    const alturaDaArea = area.base - area.topo;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!origem) {
      setPosicao({ left: Math.max(8, (larguraDaArea - w) / 2), top: 12 });
      return;
    }
    const x = origem.x - area.esquerda;
    const y = origem.y - area.topo;
    const left = Math.max(8, Math.min(x + 14, larguraDaArea - w - 8));
    // Abaixo do ponto; se não couber, acima dele (nunca em cima do clique).
    const abaixo = y + 22;
    const top = abaixo + h > alturaDaArea - 8 ? Math.max(8, y - h - 14) : abaixo;
    setPosicao({ left, top });
  }, [numero, origem]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: o teclado dispensa pelo botão; o clique no aviso todo é um atalho do mouse
    <div
      ref={ref}
      className="aviso"
      role="alert"
      data-testid="aviso"
      data-codigo={aviso.codigo ?? ""}
      data-origem={origem ? "clique" : "alto"}
      style={
        posicao
          ? { left: posicao.left, top: posicao.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
      onClick={aoDispensar}
    >
      <span>{aviso.texto}</span>
      <button
        type="button"
        className="aviso-fechar"
        aria-label="Dispensar o aviso"
        title="Dispensar"
        onClick={(e) => {
          e.stopPropagation();
          aoDispensar();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
