import {
  metrosParaUnidade,
  nomeDaUnidade,
  type UnidadeDeDistancia,
  unidadeParaMetros,
} from "@tabletop/shared";
import { useEffect, useState } from "react";
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
  aoConfirmar,
}: {
  testid: string;
  rotulo: string;
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
  aoConfirmar,
}: {
  testid: string;
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
      valor={valorM === null || valorM === undefined ? "" : textoDaDistancia(valorM, unidade)}
      aoConfirmar={(t) => {
        if (t === "") return aoConfirmar(null);
        const n = Number(t.replace(",", "."));
        if (Number.isFinite(n)) aoConfirmar(unidadeParaMetros(n, unidade));
      }}
    />
  );
}
