import { type FormEvent, useState } from "react";
import { useSala } from "./useSala";

export function App() {
  const { statusConexao, eco, enviar } = useSala();
  const [texto, setTexto] = useState("");

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    enviar(texto);
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Tabletop</h1>
      <p>
        Conexão com a sala: <strong data-testid="status-conexao">{statusConexao}</strong>
      </p>
      <form onSubmit={aoEnviar}>
        <input
          aria-label="Texto para a sala"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />{" "}
        <button type="submit" disabled={statusConexao !== "conectado"}>
          Enviar
        </button>
      </form>
      <p>
        Eco da sala: <output data-testid="eco">{eco}</output>
      </p>
    </main>
  );
}
