import type { ReactNode } from "react";
import { Logo } from "./Logo";

type Props = {
  /** O nome da cena do grupo (onde a mesa está agora). */
  cena: string;
  /** Os menus do mestre (ficam como estão; o jogador não tem). */
  menus?: ReactNode;
  /** Presença e estado da mesa, à direita. */
  children: ReactNode;
};

/** O topo fixo (48 px): marca e cena à esquerda, menus no meio e presença e estado da mesa à direita. */
export function Topo({ cena, menus, children }: Props) {
  return (
    <header className="topo" data-testid="topo">
      <div className="topo-marca">
        <Logo tamanho={22} />
        <span className="topo-cena" data-testid="topo-cena">
          {cena}
        </span>
      </div>
      <div className="topo-menus">{menus}</div>
      <div className="topo-direita">{children}</div>
    </header>
  );
}
