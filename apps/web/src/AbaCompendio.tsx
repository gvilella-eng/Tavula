import { Search } from "lucide-react";
import { useState } from "react";

/** Compêndio de magias: só a interface. As magias virão de um JSON na pasta local (nada da internet). */
export function AbaCompendio() {
  const [busca, setBusca] = useState("");
  return (
    <div data-testid="aba-compendio-conteudo">
      <label className="campo-busca">
        <Search size={16} />
        <input
          data-testid="compendio-busca"
          type="search"
          placeholder="Buscar magia…"
          aria-label="Buscar magia"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      <p className="nota" data-testid="compendio-aviso">
        {busca.trim()
          ? "Nenhuma magia carregada ainda."
          : "Em breve: as magias de D&D virão de um arquivo JSON na sua pasta local."}
      </p>
      <p className="nota">Nada é buscado na internet: o compêndio lê só o seu arquivo.</p>
    </div>
  );
}
