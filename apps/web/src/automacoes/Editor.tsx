import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
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

/**
 * A moldura de uma peça em edição (ciclo, reação, botão): o voltar, os campos (`children`), o "Ver como JSON", o
 * resumo dos erros e Salvar e Cancelar. Salvar com erro não envia nada: mostra os erros nos campos e na lista.
 */
export function EditorDaPeca(p: {
  testid: string;
  titulo: string;
  rascunho: unknown;
  aoMudarRascunho: (v: unknown) => void;
  erros: readonly ErroDeCampo[];
  aoSalvar: () => void;
  aoCancelar: () => void;
  /** Os campos; recebe se já é para mostrar os erros ao lado deles (depois de uma tentativa de salvar). */
  children: (mostrarErros: boolean) => ReactNode;
}) {
  const [tentou, setTentou] = useState(false);
  function salvar() {
    if (p.erros.length > 0) {
      setTentou(true);
      return;
    }
    p.aoSalvar();
  }
  return (
    <form
      className="editor-da-peca"
      data-testid={p.testid}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      // Enter dentro de um campo só confirma o campo; quem salva é o botão Salvar.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
    >
      <header className="cabecalho-da-peca">
        <button
          type="button"
          className="botao-icone pequeno"
          data-testid={`${p.testid}-voltar`}
          aria-label="Voltar para a lista"
          onClick={p.aoCancelar}
        >
          <ArrowLeft size={16} />
        </button>
        <strong>{p.titulo}</strong>
      </header>
      <div className="corpo-da-peca">{p.children(tentou)}</div>
      <details className="avancado json-da-peca-aberto" data-testid={`${p.testid}-json`}>
        <summary>Ver como JSON</summary>
        <VistaJson
          testid={`${p.testid}-json`}
          valor={p.rascunho}
          aoMudar={p.aoMudarRascunho}
          erros={p.erros}
        />
      </details>
      {tentou && p.erros.length > 0 && (
        <div className="resumo-de-erros" role="alert" data-testid={`${p.testid}-resumo`}>
          <p>
            {p.erros.length === 1
              ? "Corrija este ponto para salvar:"
              : `Corrija estes ${p.erros.length} pontos para salvar:`}
          </p>
          <ul>
            {p.erros.map((e) => (
              <li key={`${e.caminho}|${e.mensagem}`}>{e.texto}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="linha-botoes fim">
        <button type="button" data-testid={`${p.testid}-cancelar`} onClick={p.aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="primario" data-testid={`${p.testid}-salvar`}>
          Salvar
        </button>
      </div>
    </form>
  );
}
