import { useEffect, useState } from "react";

/**
 * Campos da ficha. Diferente do `Campo` do resto da interface (que confirma ao sair), estes mandam cada
 * mudança válida na hora: a gravação agrupada (`useFichaEditavel`) junta tudo em ~400 ms.
 */

type PropsNumero = {
  testid: string;
  valor: number;
  min?: number;
  max?: number;
  rotulo: string;
  desabilitado?: boolean;
  className?: string;
  aoMudar: (n: number) => void;
};

/** Número inteiro. Texto vazio ou fora dos limites não é enviado; ao sair, volta ao valor da ficha. */
export function CampoNumero({
  testid,
  valor,
  min = 0,
  max = 9999,
  rotulo,
  desabilitado,
  className,
  aoMudar,
}: PropsNumero) {
  const [texto, setTexto] = useState(String(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (!foco) setTexto(String(valor));
  }, [valor, foco]);
  return (
    <input
      className={`fh-numero ${className ?? ""}`}
      data-testid={testid}
      aria-label={rotulo}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      disabled={desabilitado}
      value={texto}
      onFocus={() => setFoco(true)}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isInteger(n) && n >= min && n <= max) aoMudar(n);
      }}
      onBlur={() => {
        setFoco(false);
        setTexto(String(valor));
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

type PropsTexto = {
  testid: string;
  valor: string;
  rotulo: string;
  placeholder?: string;
  maxLength?: number;
  desabilitado?: boolean;
  multilinha?: boolean;
  className?: string;
  /** Id de um `<datalist>` com sugestões. */
  lista?: string;
  /** Devolve `false` se a ficha recusaria o texto (ex.: nome vazio). */
  aoMudar: (texto: string) => boolean | undefined;
};

export function CampoTexto({
  testid,
  valor,
  rotulo,
  placeholder,
  maxLength,
  desabilitado,
  multilinha,
  className,
  lista,
  aoMudar,
}: PropsTexto) {
  const [texto, setTexto] = useState(valor);
  const [foco, setFoco] = useState(false);
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    if (!foco) setTexto(valor);
  }, [valor, foco]);
  const comum = {
    "data-testid": testid,
    "aria-label": rotulo,
    title: rotulo,
    placeholder,
    maxLength,
    disabled: desabilitado,
    value: texto,
    "aria-invalid": invalido || undefined,
    onFocus: () => setFoco(true),
    onBlur: () => {
      setFoco(false);
      setInvalido(false);
      setTexto(valor);
    },
  };
  const mudou = (novo: string) => {
    setTexto(novo);
    setInvalido(aoMudar(novo) === false);
  };
  return multilinha ? (
    <textarea
      className={`fh-texto ${className ?? ""}`}
      {...comum}
      onChange={(e) => mudou(e.target.value)}
    />
  ) : (
    <input
      className={`fh-texto ${className ?? ""}`}
      type="text"
      list={lista}
      {...comum}
      onChange={(e) => mudou(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
