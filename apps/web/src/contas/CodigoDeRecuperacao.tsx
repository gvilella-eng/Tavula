import { useState } from "react";

/** Copia o texto; `false` se o navegador não deixou (sem HTTPS ou sem permissão). */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Baixa o código num .txt (o texto nunca passa por servidor: é montado aqui). */
function baixarTxt(codigo: string, mesaNome: string): void {
  const texto = `Código de recuperação do mestre da mesa "${mesaNome}"\n\n${codigo}\n\nGuarde fora deste computador. Quem tem este código recupera o acesso de mestre.\n`;
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "tavola-codigo-de-recuperacao.txt";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * O código de recuperação do mestre (C3), mostrado UMA vez: caixa grande, "Copiar", "Baixar .txt" e a caixa
 * "Anotei o código". Quem usa só deixa seguir (fechar, abrir a mesa) depois de `aoMudarAnotei(true)`. O servidor
 * guarda só o SHA-256: se este texto se perder, só um código novo resolve.
 */
export function CodigoDeRecuperacao({
  codigo,
  mesaNome,
  anotado,
  aoMudarAnotei,
}: {
  codigo: string;
  mesaNome: string;
  anotado: boolean;
  aoMudarAnotei: (v: boolean) => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);

  async function aoCopiar() {
    setAviso(
      (await copiar(codigo))
        ? "Código copiado."
        : "Não deu para copiar: selecione o texto e copie.",
    );
  }

  return (
    <section className="codigo-de-recuperacao" data-testid="codigo-de-recuperacao">
      <h3 className="codigo-de-recuperacao-titulo">Código de recuperação do mestre</h3>
      <p className="nota">
        Se você esquecer a senha e perder a pasta da mesa, só este código devolve o seu acesso. Ele
        aparece só agora. <strong>Anote e guarde fora deste computador.</strong>
      </p>
      <code className="codigo-de-recuperacao-valor" data-testid="codigo-valor">
        {codigo}
      </code>
      <div className="linha-botoes">
        <button type="button" data-testid="codigo-copiar" onClick={aoCopiar}>
          Copiar
        </button>
        <button
          type="button"
          data-testid="codigo-baixar"
          onClick={() => baixarTxt(codigo, mesaNome)}
        >
          Baixar .txt
        </button>
      </div>
      <div role="status">
        {aviso && (
          <p className="nota" data-testid="codigo-copiado">
            {aviso}
          </p>
        )}
      </div>
      <label className="codigo-anotei">
        <input
          type="checkbox"
          checked={anotado}
          data-testid="codigo-anotei"
          onChange={(e) => aoMudarAnotei(e.target.checked)}
        />
        Anotei o código
      </label>
    </section>
  );
}

/** O código sozinho numa tela, com "Continuar" só depois de marcar "Anotei o código" (a mesa legada e a recuperação). */
export function TelaDoCodigo({
  codigo,
  mesaNome,
  aoContinuar,
  rotuloDoBotao = "Continuar",
}: {
  codigo: string;
  mesaNome: string;
  aoContinuar: () => void;
  rotuloDoBotao?: string;
}) {
  const [anotado, setAnotado] = useState(false);
  return (
    <div className="entrada-form entrada-cartao destaque" data-testid="tela-do-codigo">
      <CodigoDeRecuperacao
        codigo={codigo}
        mesaNome={mesaNome}
        anotado={anotado}
        aoMudarAnotei={setAnotado}
      />
      <div className="linha-botoes">
        <button
          type="button"
          className="primario"
          disabled={!anotado}
          data-testid="codigo-continuar"
          onClick={aoContinuar}
        >
          {rotuloDoBotao}
        </button>
      </div>
    </div>
  );
}
