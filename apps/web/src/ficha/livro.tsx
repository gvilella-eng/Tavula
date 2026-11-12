import { ChevronRight } from "lucide-react";
import { type HTMLAttributes, type ReactNode, useState } from "react";

/**
 * Peças da ficha no desenho aprovado (V4a): título ornamentado, caixa, bolinha de marcar e acordeão. Todas as
 * cores vêm dos tokens do tema; a pele (Livro ou Clássica) só troca fontes e molduras, por classe na raiz.
 */

/** O título de uma seção: "—— Salvaguardas ——", com filetes dos dois lados. */
export function Secao({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <h3 className={`fl-sec ${className ?? ""}`} id={id}>
      {children}
    </h3>
  );
}

/** Uma caixa de fundo (o `cx` do desenho). `moldura` põe o filete duplo dos blocos grandes. */
export function Caixa({
  children,
  className,
  moldura,
  testid,
  rotulo,
  ...resto
}: {
  children: ReactNode;
  className?: string;
  moldura?: boolean;
  testid?: string;
  rotulo?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <section
      className={`fl-cx ${moldura ? "fl-fr" : ""} ${className ?? ""}`}
      data-testid={testid}
      aria-label={rotulo}
      {...resto}
    >
      {children}
    </section>
  );
}

/** Uma bolinha que se marca e desmarca (espaço de magia, dado de vida, teste contra a morte). */
export function Bolinha({
  testid,
  rotulo,
  marcada,
  desabilitado,
  falha,
  aoMudar,
}: {
  testid: string;
  rotulo: string;
  marcada: boolean;
  desabilitado?: boolean;
  falha?: boolean;
  aoMudar: () => void;
}) {
  return (
    <label className="fl-dotb">
      <input
        type="checkbox"
        className={`fl-dot ${falha ? "falha" : ""}`}
        data-testid={testid}
        aria-label={rotulo}
        checked={marcada}
        disabled={desabilitado}
        onChange={aoMudar}
      />
    </label>
  );
}

/** Uma seção que abre e fecha (a ficha estreita). */
export function Acordeao({
  id,
  titulo,
  resumo,
  inicialmenteAberto,
  children,
}: {
  id: string;
  titulo: string;
  resumo?: string;
  inicialmenteAberto?: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(inicialmenteAberto === true);
  return (
    <section className="fl-cx fl-acc" data-testid={`acordeao-${id}`} data-aberto={aberto}>
      <h3 className="fl-acc-titulo">
        <button
          type="button"
          className="fl-acch"
          data-testid={`acordeao-${id}-alternar`}
          aria-expanded={aberto}
          onClick={() => setAberto(!aberto)}
        >
          <ChevronRight size={14} className="fl-giro" aria-hidden />
          <span className="fl-fh fl-acc-nome">{titulo}</span>
          {resumo && <span className="fl-acc-resumo">{resumo}</span>}
        </button>
      </h3>
      {aberto && <div className="fl-acc-corpo">{children}</div>}
    </section>
  );
}

/** O título de uma seção do bloco de monstro (V4b): "—— Ações ◆ ——". */
export function TituloDoBloco({ children, testid }: { children: ReactNode; testid?: string }) {
  return (
    <div className="npc-titulo">
      <h3 className="npc-h2" data-testid={testid}>
        {children}
      </h3>
      <span className="npc-filete" aria-hidden />
      <svg width="30" height="12" viewBox="0 0 30 12" fill="currentColor" aria-hidden="true">
        <path d="M15 0l4 6-4 6-4-6z" />
        <circle cx="4" cy="6" r="1.6" />
        <circle cx="26" cy="6" r="1.6" />
      </svg>
    </div>
  );
}
