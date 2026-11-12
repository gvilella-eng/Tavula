import { useId } from "react";

type Props = {
  testid: string;
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  tipo?: "text" | "password";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
};

/** Um campo de formulário de conta: rótulo visível em cima e o campo embaixo (texto ou senha). */
export function CampoDeConta({
  testid,
  rotulo,
  valor,
  aoMudar,
  tipo = "text",
  autoComplete,
  maxLength,
  placeholder,
}: Props) {
  const id = useId();
  return (
    <div className="campo-de-conta">
      <label htmlFor={id}>{rotulo}</label>
      <input
        id={id}
        type={tipo}
        data-testid={testid}
        value={valor}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}
