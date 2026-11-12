import { useState } from "react";
import { linkDaMesa } from "./rotas";

type Props = {
  id: string;
  /** Prefixo dos `data-testid` (a tela inicial e a aba Mesa usam o mesmo bloco). */
  prefixo: string;
  /** O id em letras grandes, para ditar (logo depois de criar a mesa). */
  grande?: boolean;
};

/** Copia o texto; `false` se o navegador não deixou (sem HTTPS ou sem permissão). */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** O id da mesa com "Copiar id" e "Copiar link". */
export function IdDaMesa({ id, prefixo, grande = false }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  async function aoCopiar(qual: "id" | "link") {
    const ok = await copiar(qual === "id" ? id : linkDaMesa(id));
    setAviso(
      ok
        ? qual === "id"
          ? "Id copiado."
          : "Link copiado."
        : "Não deu para copiar: selecione o texto e copie.",
    );
  }

  return (
    <div className="id-da-mesa" data-testid={`${prefixo}-bloco`}>
      <code
        className={grande ? "id-da-mesa-valor grande" : "id-da-mesa-valor"}
        data-testid={`${prefixo}-id`}
      >
        {id}
      </code>
      <div className="linha-botoes">
        <button type="button" data-testid={`${prefixo}-copiar-id`} onClick={() => aoCopiar("id")}>
          Copiar id
        </button>
        <button
          type="button"
          data-testid={`${prefixo}-copiar-link`}
          onClick={() => aoCopiar("link")}
        >
          Copiar link
        </button>
      </div>
      <div role="status">
        {aviso && (
          <p className="nota" data-testid={`${prefixo}-copiado`}>
            {aviso}
          </p>
        )}
      </div>
    </div>
  );
}
