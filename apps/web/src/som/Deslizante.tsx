import { useEffect, useRef, useState } from "react";

type Props = {
  testid: string;
  rotulo: string;
  /** 0 a 1. */
  valor: number;
  aoMudar: (v: number) => void;
  desligado?: boolean;
};

/** Deslizante de 0 a 100% que acompanha um valor de 0 a 1 e entrega o que a pessoa arrasta (também com as setas). */
export function Deslizante({ testid, rotulo, valor, aoMudar, desligado }: Props) {
  const [local, setLocal] = useState(Math.round(valor * 100));
  const arrastando = useRef(false);
  useEffect(() => {
    if (!arrastando.current) setLocal(Math.round(valor * 100));
  }, [valor]);
  return (
    <div className="deslizante">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={rotulo}
        data-testid={testid}
        disabled={desligado}
        value={local}
        onPointerDown={() => {
          arrastando.current = true;
        }}
        onPointerUp={() => {
          arrastando.current = false;
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocal(v);
          aoMudar(v / 100);
        }}
      />
      <output data-testid={`${testid}-valor`}>{local}%</output>
    </div>
  );
}
