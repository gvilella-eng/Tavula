import { useEffect, useRef, useState } from "react";
import { type ErroDeCampo, erroDeSintaxeDoJson } from "./erros";

const bonito = (v: unknown) => JSON.stringify(v, null, 2);

/**
 * "Ver como JSON": o mesmo rascunho do formulário, editável como texto. O que se escreve vale na hora no formulário (se
 * for JSON de verdade); os erros do schema aparecem embaixo, em português, e nada é enviado enquanto houver erro.
 */
export function VistaJson(p: {
  testid: string;
  valor: unknown;
  aoMudar: (v: unknown) => void;
  erros: readonly ErroDeCampo[];
}) {
  const texto0 = bonito(p.valor);
  const [texto, setTexto] = useState(texto0);
  const [sintaxe, setSintaxe] = useState<string | null>(null);
  // O último texto que veio daqui: quando o formulário muda o rascunho por fora, o texto acompanha; o que se digita
  // aqui não é reescrito debaixo do cursor.
  const ultimo = useRef(texto0);
  useEffect(() => {
    if (texto0 !== ultimo.current) {
      ultimo.current = texto0;
      setTexto(texto0);
      setSintaxe(null);
    }
  }, [texto0]);

  function mudou(novo: string) {
    setTexto(novo);
    let lido: unknown;
    try {
      lido = JSON.parse(novo);
    } catch (e) {
      setSintaxe(erroDeSintaxeDoJson(novo, e));
      return;
    }
    if (typeof lido !== "object" || lido === null || Array.isArray(lido)) {
      setSintaxe("O JSON precisa ser um objeto, entre chaves { }.");
      return;
    }
    setSintaxe(null);
    ultimo.current = bonito(lido);
    p.aoMudar(lido);
  }

  return (
    <div className="vista-json">
      <textarea
        className="json-da-peca"
        data-testid={`${p.testid}-texto`}
        aria-label="JSON da peça"
        spellCheck={false}
        rows={12}
        value={texto}
        aria-invalid={sintaxe !== null || p.erros.length > 0}
        onChange={(e) => mudou(e.target.value)}
      />
      {sintaxe !== null ? (
        <p className="nota erro" role="alert" data-testid={`${p.testid}-erros`}>
          {sintaxe}
        </p>
      ) : p.erros.length > 0 ? (
        <ul className="erros-do-json" role="alert" data-testid={`${p.testid}-erros`}>
          {p.erros.map((e) => (
            <li key={`${e.caminho}|${e.mensagem}`}>{e.texto}</li>
          ))}
        </ul>
      ) : (
        <p className="nota" data-testid={`${p.testid}-ok`}>
          O JSON está certo.
        </p>
      )}
    </div>
  );
}
