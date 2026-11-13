import { EVENTOS_DO_SISTEMA, ehEventoDoSistema, NOME_AMIGAVEL_DO_EVENTO } from "@tabletop/shared";
import { type ReactNode, useId, useState } from "react";

// Os campos pequenos dos formulários das automações (7b-3). Todos controlados: quem usa guarda o rascunho.

/** A frase de erro de um campo (lida pelo leitor de tela). */
export function ErroDoCampo({ erro, testid }: { erro: string | undefined; testid: string }) {
  if (erro === undefined) return null;
  return (
    <span className="erro-do-campo" role="alert" data-testid={`${testid}-erro`}>
      {erro}
    </span>
  );
}

export function CampoDeTexto(p: {
  testid: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  erro?: string | undefined;
  maxLength?: number;
  placeholder?: string;
  /** Várias linhas. */
  area?: boolean;
  /** Sugestões do campo (um `datalist`). */
  sugestoes?: readonly string[];
}) {
  const lista = useId();
  const sugestoes = p.sugestoes && p.sugestoes.length > 0 ? p.sugestoes : null;
  const erro = <ErroDoCampo erro={p.erro} testid={p.testid} />;
  if (p.area) {
    return (
      <label className="campo-coluna">
        {p.rotulo}
        <textarea
          rows={2}
          data-testid={p.testid}
          value={p.valor}
          maxLength={p.maxLength}
          placeholder={p.placeholder}
          aria-invalid={p.erro !== undefined}
          onChange={(e) => p.aoMudar(e.target.value)}
        />
        {erro}
      </label>
    );
  }
  return (
    <label className="campo-coluna">
      {p.rotulo}
      <input
        type="text"
        data-testid={p.testid}
        value={p.valor}
        maxLength={p.maxLength}
        placeholder={p.placeholder}
        aria-invalid={p.erro !== undefined}
        list={sugestoes ? lista : undefined}
        onChange={(e) => p.aoMudar(e.target.value)}
      />
      {sugestoes && (
        <datalist id={lista}>
          {sugestoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {erro}
    </label>
  );
}

const OUTRO = "__outro";

/**
 * O evento de uma reação: os do sistema aparecem com o nome amigável numa lista ("Uma luz acendeu"); os do mestre são
 * texto livre, com a sugestão dos que já existem na mesa.
 */
export function CampoDeEvento(p: {
  testid: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  /** Os eventos que o mestre já criou. */
  sugestoes: readonly string[];
  erro?: string | undefined;
}) {
  const [forcarOutro, setForcarOutro] = useState(false);
  const doSistema = ehEventoDoSistema(p.valor);
  const modo = doSistema && !forcarOutro ? p.valor : OUTRO;
  return (
    <div className="campo-de-evento">
      <label className="campo-coluna">
        {p.rotulo}
        <select
          data-testid={p.testid}
          value={modo}
          onChange={(e) => {
            if (e.target.value === OUTRO) {
              setForcarOutro(true);
              if (doSistema) p.aoMudar("");
            } else {
              setForcarOutro(false);
              p.aoMudar(e.target.value);
            }
          }}
        >
          <optgroup label="Da mesa">
            {EVENTOS_DO_SISTEMA.map((n) => (
              <option key={n} value={n}>
                {NOME_AMIGAVEL_DO_EVENTO[n]}
              </option>
            ))}
          </optgroup>
          <option value={OUTRO}>Um evento seu…</option>
        </select>
      </label>
      {modo === OUTRO && (
        <CampoDeTexto
          testid={`${p.testid}-outro`}
          rotulo="Nome do evento"
          valor={p.valor}
          aoMudar={p.aoMudar}
          erro={p.erro}
          maxLength={48}
          placeholder="Ex.: inspiracao"
          sugestoes={p.sugestoes}
        />
      )}
      {modo !== OUTRO && <ErroDoCampo erro={p.erro} testid={p.testid} />}
    </div>
  );
}

/** Uma caixa de marcar com o nome ao lado. */
export function Marcador(p: {
  testid: string;
  rotulo: ReactNode;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="linha-opcao">
      <input
        type="checkbox"
        data-testid={p.testid}
        checked={p.marcado}
        onChange={(e) => p.aoMudar(e.target.checked)}
      />
      {p.rotulo}
    </label>
  );
}

/** As cenas da mesa como caixas de marcar (as marcadas viram a lista de ids). */
export function EscolhaDeCenas(p: {
  testid: string;
  cenas: readonly { id: string; nome: string }[];
  valor: readonly string[];
  aoMudar: (ids: string[]) => void;
}) {
  return (
    <div className="escolha-de-cenas" data-testid={p.testid}>
      {p.cenas.map((c) => (
        <Marcador
          key={c.id}
          testid={`${p.testid}-${c.id}`}
          rotulo={c.nome}
          marcado={p.valor.includes(c.id)}
          aoMudar={(v) => p.aoMudar(v ? [...p.valor, c.id] : p.valor.filter((x) => x !== c.id))}
        />
      ))}
    </div>
  );
}
