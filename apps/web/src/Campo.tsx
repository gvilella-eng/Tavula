import { useEffect, useState } from "react";

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
  min?: number;
  max?: number;
  placeholder?: string;
  desabilitado?: boolean;
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
