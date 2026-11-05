import {
  CAPACIDADES_DELEGAVEIS,
  type Cena,
  type Estado,
  ROTULO_DA_CAPACIDADE,
  type Uso,
} from "@tabletop/shared";
import { type ChangeEvent, useState } from "react";

type Props = {
  estado: Estado;
  cena: Cena;
  uso: Uso | null;
  enviar: (tipo: string, dados: object) => string | null;
};

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
}

type Excecao = "herdar" | "sim" | "nao";

export function PainelDoMestre({ estado, cena, uso, enviar }: Props) {
  const jogadores = estado.usuarios.filter((u) => u.papel === "jogador");
  const [alvo, setAlvo] = useState<string>("");
  const alvoValido = jogadores.some((u) => u.id === alvo) ? alvo : (jogadores[0]?.id ?? "");

  function mudarPadrao(capacidade: string, valor: boolean) {
    enviar("permissao.alterar", { capacidade, valor });
  }

  function mudarExcecao(capacidade: string, valor: Excecao) {
    enviar("permissao.alterar", {
      capacidade,
      valor: valor === "herdar" ? null : valor === "sim",
      usuarioId: alvoValido,
    });
  }

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    let dados: unknown;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      dados = null; // a sala recusa e o aviso aparece
    }
    enviar("campanha.importar", { dados });
  }

  const excecoes = estado.permissoes.porUsuario[alvoValido] ?? {};

  return (
    <div className="painel-mestre" data-testid="painel-mestre">
      <p>
        <span data-testid="uso-hoje">
          uso de hoje: {uso ? formatarPercentual(uso.percentual) : "—"}
        </span>
      </p>

      <h3>Grid da cena</h3>
      <div className="linha-opcao">
        <label>
          <input
            type="checkbox"
            data-testid="grid-visivel"
            checked={cena.grid.visivel}
            onChange={(e) =>
              enviar("cena.configurarGrid", { cenaId: cena.id, visivel: e.target.checked })
            }
          />{" "}
          Mostrar o grid
        </label>
        <label>
          Quadrado (m){" "}
          <input
            type="number"
            data-testid="grid-quadrado"
            key={cena.grid.quadradoM}
            defaultValue={cena.grid.quadradoM}
            min={0.3}
            max={10}
            step={0.25}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.3 && v <= 10 && v !== cena.grid.quadradoM) {
                enviar("cena.configurarGrid", { cenaId: cena.id, quadradoM: v });
              }
            }}
          />
        </label>
      </div>

      <h3>Capacidades dos jogadores</h3>
      <label>
        Exceções para:{" "}
        <select
          data-testid="excecao-usuario"
          value={alvoValido}
          onChange={(e) => setAlvo(e.target.value)}
        >
          {jogadores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </label>
      <table>
        <thead>
          <tr>
            <th>Capacidade</th>
            <th>Padrão da mesa</th>
            <th>Exceção</th>
          </tr>
        </thead>
        <tbody>
          {CAPACIDADES_DELEGAVEIS.map((c) => {
            const excecao = excecoes[c];
            const valor: Excecao = excecao === undefined ? "herdar" : excecao ? "sim" : "nao";
            return (
              <tr key={c}>
                <td>{ROTULO_DA_CAPACIDADE[c]}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${ROTULO_DA_CAPACIDADE[c]}: padrão da mesa`}
                    data-testid={`perm-padrao-${c}`}
                    checked={estado.permissoes.jogadores[c] === true}
                    onChange={(e) => mudarPadrao(c, e.target.checked)}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${ROTULO_DA_CAPACIDADE[c]}: exceção`}
                    data-testid={`perm-excecao-${c}`}
                    value={valor}
                    disabled={!alvoValido}
                    onChange={(e) => mudarExcecao(c, e.target.value as Excecao)}
                  >
                    <option value="herdar">herdar</option>
                    <option value="sim">sim</option>
                    <option value="nao">não</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Campanha</h3>
      <p>
        <button
          type="button"
          data-testid="exportar"
          onClick={() => enviar("campanha.exportar", {})}
        >
          Exportar campanha
        </button>{" "}
        <label>
          Importar campanha:{" "}
          <input
            type="file"
            accept="application/json,.json"
            data-testid="importar-arquivo"
            onChange={aoEscolherArquivo}
          />
        </label>
      </p>
    </div>
  );
}
