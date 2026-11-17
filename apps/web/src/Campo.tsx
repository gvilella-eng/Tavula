import {
  metrosParaUnidade,
  nomeDaUnidade,
  type UnidadeDeDistancia,
  unidadeParaMetros,
} from "@tabletop/shared";
import { useEffect, useState } from "react";
import { formatarDecimal, lerDecimal } from "./decimal";
import { useUnidade } from "./unidade";

/** Campo de texto ou número com rascunho: confirma ao sair (ou Enter) e acompanha a sala. */
export function Campo({
  testid,
  rotulo,
  valor,
  tipo = "text",
  min,
  max,
  placeholder,
  desabilitado,
  ajuda,
  aoConfirmar,
}: {
  testid: string;
  rotulo: string;
  /** Q8: o texto de ajuda embaixo do campo (o rótulo fica curto). */
  ajuda?: string;
  /** O valor da sala, em texto (vazio = sem valor). */
  valor: string;
  tipo?: "text" | "number";
  min?: number | undefined;
  max?: number | undefined;
  placeholder?: string;
  desabilitado?: boolean | undefined;
  aoConfirmar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  const confirmar = () => {
    if (texto.trim() === valor) return;
    aoConfirmar(texto.trim());
    // Se a sala recusar, o valor dela volta no próximo estado; até lá, mostra o que ela tem.
    setTexto(valor);
  };
  return (
    <label className="campo-coluna">
      {rotulo}
      <input
        data-testid={testid}
        type={tipo}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={desabilitado}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      {ajuda && <span className="nota campo-ajuda">{ajuda}</span>}
    </label>
  );
}

/** O número de uma distância na unidade, para o campo: sem zeros à toa, até 2 casas ("5", "1.5"). */
export function textoDaDistancia(metros: number, unidade: UnidadeDeDistancia): string {
  return String(Math.round(metrosParaUnidade(metros, unidade) * 100) / 100);
}

/**
 * V14: campo de distância. Mostra e aceita a unidade escolhida em Preferências (metros ou pés, V13); o que
 * `aoConfirmar` recebe é sempre em metros (ou `null`, campo vazio). Sem mexer no campo nada é enviado, então
 * o valor da sala não muda por causa do arredondamento da conversão.
 */
export function CampoDeDistancia({
  testid,
  rotulo,
  nota,
  valorM,
  minM,
  maxM,
  desabilitado,
  ajuda,
  aoConfirmar,
}: {
  testid: string;
  /** Q8: o texto de ajuda embaixo do campo. */
  ajuda?: string;
  /** O nome do campo, sem a unidade: ela entra sozinha, "Luz plena (m)" ou "Luz plena (pés)". */
  rotulo: string;
  /** Complemento do parêntese, depois da unidade: "vazio = sem limite". */
  nota?: string;
  /** O valor da sala, em metros; `null` ou `undefined` = vazio. */
  valorM: number | null | undefined;
  minM?: number;
  maxM?: number;
  desabilitado?: boolean;
  aoConfirmar: (metros: number | null) => void;
}) {
  const unidade = useUnidade();
  return (
    <Campo
      testid={testid}
      rotulo={`${rotulo} (${nomeDaUnidade(unidade)}${nota ? `; ${nota}` : ""})`}
      tipo="number"
      min={minM === undefined ? undefined : Math.ceil(metrosParaUnidade(minM, unidade) * 100) / 100}
      max={
        maxM === undefined ? undefined : Math.floor(metrosParaUnidade(maxM, unidade) * 100) / 100
      }
      desabilitado={desabilitado}
      {...(ajuda ? { ajuda } : {})}
      valor={valorM === null || valorM === undefined ? "" : textoDaDistancia(valorM, unidade)}
      aoConfirmar={(t) => {
        if (t === "") return aoConfirmar(null);
        const n = Number(t.replace(",", "."));
        if (Number.isFinite(n)) aoConfirmar(unidadeParaMetros(n, unidade));
      }}
    />
  );
}

/**
 * Campo de número decimal em português: mostra com vírgula ("0,5") e aceita vírgula ou ponto na digitação. Confirma ao
 * sair do campo (ou Enter); vazio é `null`; texto que não é número volta ao valor da sala. Com `limitar`, o número
 * confirmado fica entre `min` e `max` (sem isso, quem valida é o chamador).
 */
export function CampoDecimal({
  testid,
  rotulo,
  valor,
  min,
  max,
  limitar,
  placeholder,
  dica,
  erro,
  aoConfirmar,
}: {
  testid: string;
  rotulo: string;
  valor: number | null | undefined;
  min?: number;
  max?: number;
  limitar?: boolean;
  placeholder?: string;
  dica?: string;
  /** A mensagem de erro do campo (mostrada embaixo e lida pelo leitor de tela). */
  erro?: string | undefined;
  aoConfirmar: (n: number | null) => void;
}) {
  const daSala = valor === null || valor === undefined ? "" : formatarDecimal(valor);
  const [texto, setTexto] = useState(daSala);
  useEffect(() => setTexto(daSala), [daSala]);
  function confirmar() {
    const lido = lerDecimal(texto);
    if (lido === "invalido") {
      setTexto(daSala);
      return;
    }
    if (lido === null) {
      setTexto("");
      if (valor !== null && valor !== undefined) aoConfirmar(null);
      return;
    }
    const n = limitar === true ? Math.min(max ?? lido, Math.max(min ?? lido, lido)) : lido;
    setTexto(formatarDecimal(n));
    if (n !== valor) aoConfirmar(n);
  }
  return (
    <label className="campo-coluna">
      {rotulo}
      <input
        type="text"
        inputMode="decimal"
        data-testid={testid}
        value={texto}
        placeholder={placeholder}
        title={dica}
        aria-invalid={erro !== undefined}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
        }}
      />
      {erro !== undefined && (
        <span className="erro-do-campo" role="alert" data-testid={`${testid}-erro`}>
          {erro}
        </span>
      )}
    </label>
  );
}
