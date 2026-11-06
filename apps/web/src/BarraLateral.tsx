import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { type ReactNode, useState } from "react";

export type Aba = {
  id: string;
  titulo: string;
  icone: ReactNode;
  conteudo: ReactNode;
  /** Bolinha discreta no ícone (ex.: transferência de arquivo em andamento). */
  indicador?: boolean;
};

type Props = {
  abas: Aba[];
  /** Avisa a largura ocupada, para o zoom flutuante ficar ao lado e não por baixo. */
  aoMudarAberta?: (aberta: boolean) => void;
};

/**
 * Barra lateral direita recolhível, com abas por ícone. Todos os painéis ficam montados (só o
 * ativo aparece): campos com rascunho não perdem o estado ao trocar de aba.
 */
export function BarraLateral({ abas, aoMudarAberta }: Props) {
  const [aberta, setAberta] = useState(true);
  const [ativa, setAtiva] = useState("chat");
  const ativaValida = abas.some((a) => a.id === ativa) ? ativa : (abas[0]?.id ?? "");

  function definirAberta(v: boolean) {
    setAberta(v);
    aoMudarAberta?.(v);
  }

  return (
    <aside className="lateral" data-aberta={aberta} data-testid="barra-lateral">
      <nav className="abas" aria-label="Abas">
        <button
          type="button"
          className="botao-icone"
          data-testid="lateral-recolher"
          title={aberta ? "Recolher a barra lateral" : "Abrir a barra lateral"}
          aria-label={aberta ? "Recolher a barra lateral" : "Abrir a barra lateral"}
          aria-expanded={aberta}
          onClick={() => definirAberta(!aberta)}
        >
          {aberta ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </button>
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            className="botao-icone"
            data-testid={`aba-${a.id}`}
            title={a.titulo}
            aria-label={a.titulo}
            aria-selected={aberta && ativaValida === a.id}
            onClick={() => {
              setAtiva(a.id);
              definirAberta(true);
            }}
          >
            {a.icone}
            {a.indicador && <span className="indicador" data-testid={`indicador-${a.id}`} />}
          </button>
        ))}
      </nav>
      <div className="lateral-conteudo" hidden={!aberta}>
        {abas.map((a) => (
          <section
            key={a.id}
            className="painel-aba"
            data-testid={`aba-painel-${a.id}`}
            hidden={ativaValida !== a.id}
          >
            <h2>{a.titulo}</h2>
            {a.conteudo}
          </section>
        ))}
      </div>
    </aside>
  );
}
