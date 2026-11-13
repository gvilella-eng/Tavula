import { ChevronDown, Monitor } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  gravarSecaoDePreferencias,
  lerSecoesDePreferencias,
  SECAO_ABERTA_POR_PADRAO,
} from "./preferencias";

/** A marca pequena das seções que ficam guardadas só neste navegador (não vão para a mesa). */
export function MarcaSoNesteNavegador() {
  return (
    <span className="pref-marca" data-testid="pref-marca-navegador">
      <Monitor size={11} aria-hidden="true" />
      só neste navegador
    </span>
  );
}

type Props = {
  /** Identifica a seção (testids e memória de aberta/fechada). */
  id: string;
  titulo: string;
  icone: ReactNode;
  /** O estado atual numa linha; aparece sob o título com a seção fechada. */
  resumo: string;
  /** Realça o resumo (por exemplo, uma transferência em andamento). */
  destaque?: boolean;
  children: ReactNode;
};

/**
 * P1: um cartão recolhível da aba Preferências (o Modelo B, "sanfona com resumo"). `<details>` nativo: Enter e Espaço
 * abrem e fecham no título; o `aria-expanded` acompanha. O que a pessoa abriu ou fechou fica lembrado neste navegador.
 */
export function SecaoDePreferencias({ id, titulo, icone, resumo, destaque, children }: Props) {
  const [aberta, setAberta] = useState(() => {
    const lembrada = lerSecoesDePreferencias()[id];
    return lembrada ?? id === SECAO_ABERTA_POR_PADRAO;
  });
  return (
    <details
      className="pref-secao"
      open={aberta}
      data-testid={`pref-secao-${id}`}
      onToggle={(e) => {
        const agora = e.currentTarget.open;
        if (agora === aberta) return;
        setAberta(agora);
        gravarSecaoDePreferencias(id, agora);
      }}
    >
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: o <summary> é um botão que abre e fecha (aria-expanded vale) */}
      <summary
        className="pref-secao-cabeca"
        aria-expanded={aberta}
        data-testid={`pref-secao-${id}-titulo`}
      >
        <span className="pref-secao-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="pref-secao-texto">
          <b>{titulo}</b>
          <span
            className="pref-secao-resumo"
            data-testid={`pref-resumo-${id}`}
            data-destaque={destaque ? "true" : undefined}
            title={resumo}
          >
            {resumo}
          </span>
        </span>
        <ChevronDown className="pref-secao-seta" size={14} aria-hidden="true" />
      </summary>
      <div className="pref-secao-corpo">{children}</div>
    </details>
  );
}
