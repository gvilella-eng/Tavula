import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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
  /** Quando dado, apagar o texto chama isto (em vez de não enviar nada): o "voltar ao automático". */
  aoApagar?: () => void;
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
  aoApagar,
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
        if (e.target.value === "" && aoApagar) {
          aoApagar();
          return;
        }
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

/**
 * Faz o `textarea` crescer com o texto (V4a): a altura acompanha o conteúdo, então nada fica cortado nem ganha
 * barra de rolagem. Mede de novo quando o texto muda e quando as fontes terminam de carregar.
 */
function useCrescer(alvo: RefObject<HTMLTextAreaElement | null>, ativo: boolean, texto: string) {
  const ajustar = useCallback(() => {
    const el = alvo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [alvo]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: o texto é o gatilho
  useLayoutEffect(() => {
    if (ativo) ajustar();
  }, [ativo, texto, ajustar]);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    void document.fonts?.ready.then(() => {
      if (vivo) ajustar();
    });
    return () => {
      vivo = false;
    };
  }, [ativo, ajustar]);
}

/** Troca as quebras de linha por espaço (campo de uma linha só). */
const semQuebras = (t: string) => t.split(/\r?\n/).join(" ");

type PropsTexto = {
  testid: string;
  valor: string;
  rotulo: string;
  placeholder?: string;
  maxLength?: number;
  desabilitado?: boolean;
  multilinha?: boolean;
  /**
   * Um `textarea` que cresce com o texto e quebra linha (V4a). Com `umaLinha`, Enter confirma (não quebra): é o
   * campo curto do cabeçalho, que cresce em altura em vez de cortar o texto.
   */
  crescente?: boolean;
  umaLinha?: boolean;
  /** Mostra o texto sem deixar editar, mas segue focável e clicável (o título que abre e fecha: V4a). */
  somenteLeitura?: boolean;
  aoClicar?: () => void;
  aoFocar?: () => void;
  aoDesfocar?: () => void;
  aoTeclar?: (e: KeyboardEvent) => void;
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
  crescente,
  umaLinha,
  somenteLeitura,
  aoClicar,
  aoFocar,
  aoDesfocar,
  aoTeclar,
  className,
  lista,
  aoMudar,
}: PropsTexto) {
  const area = useRef<HTMLTextAreaElement>(null);
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
    readOnly: somenteLeitura,
    onClick: aoClicar,
    onFocus: () => {
      setFoco(true);
      aoFocar?.();
    },
    onBlur: () => {
      setFoco(false);
      setInvalido(false);
      setTexto(valor);
      aoDesfocar?.();
    },
  };
  const mudou = (novo: string) => {
    setTexto(novo);
    setInvalido(aoMudar(novo) === false);
  };
  const cresce = crescente === true;
  useCrescer(area, cresce, texto);
  return multilinha || cresce ? (
    <textarea
      ref={area}
      className={`fh-texto ${cresce ? "crescente" : ""} ${className ?? ""}`}
      rows={cresce ? 1 : undefined}
      {...comum}
      onChange={(e) => mudou(umaLinha ? semQuebras(e.target.value) : e.target.value)}
      onKeyDown={(e) => {
        aoTeclar?.(e);
        if (umaLinha && e.key === "Enter" && !e.defaultPrevented) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  ) : (
    <input
      className={`fh-texto ${className ?? ""}`}
      type="text"
      list={lista}
      {...comum}
      onChange={(e) => mudou(e.target.value)}
      onKeyDown={(e) => {
        aoTeclar?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) e.currentTarget.blur();
      }}
    />
  );
}

type PropsDecimal = {
  testid: string;
  /** `undefined`: ainda sem valor (o campo aparece vazio). */
  valor: number | undefined;
  max?: number;
  rotulo: string;
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
  /** `null`: o campo foi esvaziado. */
  aoMudar: (n: number | null) => void;
};

const comVirgula = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));

/** Número com casas decimais (o peso em quilos): aceita vírgula ou ponto, vazio vale "sem valor". */
export function CampoDecimal({
  testid,
  valor,
  max = 99_999,
  rotulo,
  placeholder,
  desabilitado,
  className,
  aoMudar,
}: PropsDecimal) {
  const [texto, setTexto] = useState(comVirgula(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => {
    if (!foco) setTexto(comVirgula(valor));
  }, [valor, foco]);
  return (
    <input
      className={`fh-numero ${className ?? ""}`}
      data-testid={testid}
      aria-label={rotulo}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      disabled={desabilitado}
      value={texto}
      onFocus={() => setFoco(true)}
      onChange={(e) => {
        setTexto(e.target.value);
        const limpo = e.target.value.trim().replace(",", ".");
        if (limpo === "") return aoMudar(null);
        const n = Number(limpo);
        if (Number.isFinite(n) && n >= 0 && n <= max) aoMudar(Math.round(n * 100) / 100);
      }}
      onBlur={() => {
        setFoco(false);
        setTexto(comVirgula(valor));
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

/**
 * A linha em branco do fim de uma lista (V4a): o texto vira um item novo ao dar Enter ou sair do campo, e o campo
 * volta a ficar vazio, pronto para o próximo.
 */
export function CampoDeNovo({
  testid,
  rotulo,
  placeholder,
  maxLength = 80,
  className,
  aoCriar,
}: {
  testid: string;
  rotulo: string;
  placeholder: string;
  maxLength?: number;
  className?: string;
  /** Recebe o texto sem espaços nas pontas; nunca vazio. */
  aoCriar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const criar = () => {
    const limpo = texto.trim();
    setTexto("");
    if (limpo !== "") aoCriar(limpo);
  };
  return (
    <input
      className={`fh-texto ${className ?? ""}`}
      type="text"
      data-testid={testid}
      aria-label={rotulo}
      title={rotulo}
      placeholder={placeholder}
      maxLength={maxLength}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={criar}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          criar();
        }
      }}
    />
  );
}
